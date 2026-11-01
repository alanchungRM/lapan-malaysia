import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile('dist/server/index.js','utf8'),{default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const get=(path,init,env)=>worker.fetch(new Request('https://test'+path,init),env);

// Security headers on pages, assets, errors and API responses.
for(const path of ['/','/statistics','/changelog','/app.js','/nope','/api/route','/api/nearby?kind=bad']){
 const r=await get(path);
 for(const name of ['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Content-Security-Policy','Permissions-Policy'])assert.ok(r.headers.get(name),name+' missing on '+path);
}
const csp=(await get('/')).headers.get('Content-Security-Policy');
for(const directive of ["default-src 'self'","object-src 'none'","frame-ancestors 'none'","base-uri 'self'"])assert.ok(csp.includes(directive),directive);
assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline|script-src[^;]*\*/.test(csp),'script-src must stay strict');
assert.equal((await get('/')).headers.get('Permissions-Policy').includes('screen-wake-lock=(self)'),true);

// Validators and cache policy: revalidate app code, cache versioned bundles and icons.
let r=await get('/app.js');const etag=r.headers.get('ETag');assert.match(etag,/^"[A-Za-z0-9_-]{22}"$/);assert.equal(r.headers.get('Cache-Control'),'no-cache');assert.equal(r.status,200);await r.arrayBuffer();
r=await get('/app.js',{headers:{'If-None-Match':etag}});assert.equal(r.status,304);assert.equal(r.headers.get('ETag'),etag);assert.equal((await r.text()),'');
r=await get('/app.js',{headers:{'If-None-Match':'W/'+etag+', "other"'}});assert.equal(r.status,304);
r=await get('/app.js',{headers:{'If-None-Match':'"stale"'}});assert.equal(r.status,200);await r.arrayBuffer();
r=await get('/maplibre.js');assert.match(r.headers.get('Cache-Control'),/max-age=3600/);await r.arrayBuffer();
r=await get('/lapan-512.png');assert.match(r.headers.get('Cache-Control'),/max-age=3600/);assert.equal(r.headers.get('Content-Type'),'image/png; charset=utf-8');const first=new Uint8Array(await r.arrayBuffer());assert.equal(String.fromCharCode(...first.slice(1,4)),'PNG');
r=await get('/lapan-512.png');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),first,'repeat request returns identical bytes');
r=await get('/',{method:'HEAD'});assert.equal(r.status,200);assert.equal(await r.text(),'');
r=await get('/',{method:'POST'});assert.equal(r.status,405);assert.equal(r.headers.get('Allow'),'GET, HEAD');
assert.equal((await get('/changelog/')).status,200);assert.equal((await get('/statistics/')).status,200);
assert.equal((await get('/__proto__')).status,404);assert.equal((await get('/api/unknown')).status,404);

// Optional edge limiter: blocks when the binding says so, passes otherwise, and fails open.
const limiter=success=>({limit:async({key})=>{limiter.keys.push(key);return {success}}});limiter.keys=[];
let blocked=limiter(false);r=await get('/api/nearby?kind=petrol&lat=3.1&lon=101.7',{headers:{'cf-connecting-ip':'203.0.113.9'}},{RATE_LIMITER:blocked});
assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'60');assert.ok(r.headers.get('Strict-Transport-Security'));assert.deepEqual(limiter.keys,['/api/nearby:203.0.113.9']);
limiter.keys=[];r=await get('/app.js',{},{RATE_LIMITER:blocked});assert.equal(r.status,200,'static assets are never limited');assert.deepEqual(limiter.keys,[]);
r=await get('/api/route',{method:'POST',body:'{}'},{RATE_LIMITER:limiter(true)});assert.equal(r.status,400,'allowed requests reach the handler');
r=await get('/api/route',{method:'POST',body:'{}'},{RATE_LIMITER:{limit:async()=>{throw Error('limiter down')}}});assert.equal(r.status,400,'limiter outage fails open');
r=await get('/api/route',{method:'POST',body:'{}'},{});assert.equal(r.status,400,'no binding is a no-op');

// Page markup: third-party scripts/styles carry integrity hashes and fonts do not block through @import.
const html=await readFile('web/index.html','utf8');
for(const tag of html.match(/<(?:script|link)[^>]+unpkg\.com[^>]*>/g))assert.match(tag,/integrity="sha384-[A-Za-z0-9+/]+=*"/),tag.slice(0,90);
assert.ok(!html.includes('@import'),'fonts must use link tags');assert.ok(html.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin'));
console.log('PASS: security headers, CSP strictness, ETag/304 revalidation, cache tiers, binary assets, method handling, optional edge rate limiter and SRI');
