import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'))}catch{console.log('SKIP: this Node.js has no built-in SQLite (needs 22.5 or newer), so the shared-link database test did not run');process.exit(0)}
const require=createRequire(import.meta.url),client=require('../web/share.js');
const source=await readFile('worker/share.js','utf8'),{sharedPlaces,sharedPlacePage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function d1(){const db=new DatabaseSync(':memory:');for(const part of readFileSync('drizzle/0003_shared_places.sql','utf8').split('--> statement-breakpoint'))db.exec(part);
 const stmt=sql=>{const q=db.prepare(sql);let args=[];const o={bind(...a){args=a;return o},async all(){return {results:q.all(...args)}},async first(){return q.get(...args)??null},async run(){q.run(...args);return {success:true}}};return o};return {prepare:stmt,raw:db}}
const db=d1(),env={DB:db};let clock=1_800_000_000_000;const realNow=Date.now;Date.now=()=>clock;
const O='https://lapan.test',index={body:'<!doctype html><html><head><meta charset="utf-8"><title>Lapan — Malaysia, your way</title><script src="app.js"></script></head><body>APP</body></html>'};
let ipN=0;const post=(body,extra={},e=env)=>sharedPlaces(new Request(O+'/api/share',{method:'POST',headers:{origin:O,'cf-connecting-ip':extra.ip||'198.51.100.'+(++ipN),...extra.headers},body:typeof body==='string'?body:JSON.stringify(body)}),e);
const page=(path,e=env,method='GET')=>sharedPlacePage(new Request(O+path,{method}),e,index);
const meta=(html,name)=>{const m=html.match(new RegExp('<meta name="'+name+'" content="([^"]*)"'));return m&&m[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')};
const KL={name:'Menara KL',lat:3.15283,lon:101.70379};

// Without the database: no short links, but a page still opens the plain app with a note.
assert.equal((await post(KL,{},{})).status,503);let r=await page('/s/Ab3dEfG',{});assert.equal(r.status,200);let html=await r.text();assert.equal(meta(html,'lapan-share-error'),'missing');assert.ok(html.includes('<base href="/">'));

// Create. Same place gives the same link; a different name or point gives another.
r=await post(KL);let j=await r.json();assert.equal(r.status,201);assert.match(j.code,/^[2-9a-hj-km-np-zA-HJ-NP-Z]{7}$/);assert.equal(j.url,O+'/s/'+j.code);assert.equal(r.headers.get('Cache-Control'),'no-store');const code=j.code;
r=await post(KL);j=await r.json();assert.equal(r.status,200);assert.equal(j.code,code,'idempotent');
assert.notEqual((await (await post({...KL,name:'Menara KL 2'})).json()).code,code);assert.notEqual((await (await post({...KL,lat:3.1539})).json()).code,code);
assert.equal((await (await post({name:'Menara KL',lat:3.152834,lon:101.703794})).json()).code,code,'coordinates are rounded to a metre first');
// Privacy: only the place is kept.
assert.deepEqual(db.raw.prepare('PRAGMA table_info(shared_places)').all().map(c=>c.name),['code','name','lat','lon','created_at','expires_at']);assert.ok(!JSON.stringify(db.raw.prepare('SELECT * FROM shared_places').all()).includes('198.51.100'));
// Every generated code is well formed and distinct.
{const seen=new Set();for(let i=0;i<400;i++){const c=(await (await post({name:'p'+i,lat:1+i*0.01,lon:100+(i%50)*0.1},{ip:'192.0.2.'+(i%250)})).json()).code;assert.match(c,/^[2-9a-hj-km-np-zA-HJ-NP-Z]{7}$/,c);seen.add(c)}assert.equal(seen.size,400)}
clock+=61_000;
// Names are cleaned; an unnamed place is allowed.
j=await (await post({name:'  A\u0007\nB\u2028C  '+'x'.repeat(200),lat:4,lon:101})).json();const row=db.raw.prepare('SELECT name FROM shared_places WHERE code=?').get(j.code);assert.equal(row.name.length,80);assert.ok(!/[\u0000-\u001f\u2028]/.test(row.name));assert.ok(row.name.startsWith('A B C'));
assert.equal((await post({lat:4.5,lon:101.5})).status,201);
// Validation, origin, size.
for(const bad of [{name:'x',lat:40,lon:101},{name:'x',lat:3,lon:'a'},{name:5,lat:3,lon:101},{name:'x',lat:3,lon:101,url:'http://evil'},[],'null','{bad',{lat:3}])assert.equal((await post(bad)).status,400,JSON.stringify(bad));
assert.equal((await post(KL,{headers:{origin:'https://evil.example'}})).status,403);assert.equal((await sharedPlaces(new Request(O+'/api/share',{method:'POST',body:'{}'}),env)).status,403);assert.equal((await post(KL,{headers:{'content-length':'9999'}})).status,413);
assert.equal((await sharedPlaces(new Request(O+'/api/share',{method:'GET'}),env)).status,405);
// A clash between two different places on one code is resolved with a new code.
db.raw.prepare("UPDATE shared_places SET name='someone else' WHERE code=?").run(code);j=await (await post(KL)).json();assert.notEqual(j.code,code,'clashing code is not reused');assert.equal(db.raw.prepare('SELECT name FROM shared_places WHERE code=?').get(code).name,'someone else','the other place is untouched');
// The shared page.
const code2=j.code;r=await page('/s/'+code2);html=await r.text();assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'text/html; charset=utf-8');assert.equal(r.headers.get('X-Robots-Tag'),'noindex');assert.equal(r.headers.get('Cache-Control'),'public, max-age=300');
assert.ok(html.includes('<base href="/">')&&html.indexOf('<base')<html.indexOf('app.js'),'relative files still load from /');assert.ok(html.includes('<meta property="og:title" content="Lapan · Menara KL">'));assert.ok(html.includes('<title>Lapan · Menara KL</title>'));assert.ok(html.includes('property="og:image" content="'+O+'/lapan-512.png"'));assert.ok(html.includes('content="'+O+'/s/'+code2+'"'));
assert.deepEqual(JSON.parse(meta(html,'lapan-share')),{n:'Menara KL',la:3.15283,lo:101.70379});assert.ok(html.includes('<body>APP</body>')&&html.includes('<script src="app.js">'),'the app itself is unchanged');
r=await page('/s/'+code2,env,'HEAD');assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal((await page('/s/'+code2,env,'POST')).status,405);
// A hostile name cannot break out of the page.
const evil='"><script>alert(1)</script><img src=x onerror=alert(2)> \'';j=await (await post({name:evil,lat:3.2,lon:101.6})).json();html=await (await page('/s/'+j.code)).text();assert.equal((html.match(/<script/g)||[]).length,1,'no extra script tag');assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('alert(1)</script>'));assert.equal(JSON.parse(meta(html,'lapan-share')).n,evil.trim().replace(/\s+/g,' '),'the name arrives intact as data');
// Ampersands and entities in a name survive exactly, in the tags and in the data.
{const name='Tom &amp; Jerry & <b>Co</b>',x=await (await post({name,lat:3.3,lon:101.3})).json(),h=await (await page('/s/'+x.code)).text();assert.equal(JSON.parse(meta(h,'lapan-share')).n,name);assert.ok(h.includes('og:title" content="Lapan · Tom &amp;amp; Jerry &amp; &lt;b&gt;Co&lt;/b&gt;"'))}
// A clash where only the point differs is also detected.
{const x=await (await post({name:'Same name',lat:3.4,lon:101.4})).json();db.raw.prepare('UPDATE shared_places SET lat=3.5 WHERE code=?').run(x.code);const y=await (await post({name:'Same name',lat:3.4,lon:101.4})).json();assert.notEqual(y.code,x.code);assert.equal(db.raw.prepare('SELECT lat FROM shared_places WHERE code=?').get(x.code).lat,3.5)}
// Unnamed place is shown by coordinates.
j=await (await post({lat:4.5,lon:101.5})).json();html=await (await page('/s/'+j.code)).text();assert.ok(html.includes('og:title" content="Lapan · 4.5000, 101.5000"'));
// Unknown, malformed and expired links open the plain app with a note.
for(const [path,why] of [['/s/2222222','missing'],['/s/short','missing'],['/s/Ab3dEfGh1','missing'],['/s/0O1Il22','missing'],['/s/'+code2+'%00','missing']]){html=await (await page(path)).text();assert.equal(meta(html,'lapan-share-error'),why,path);assert.ok(!html.includes('name="lapan-share"'),path)}
assert.equal((await page('/s/2222222')).headers.get('Cache-Control'),'no-store');
clock+=15552001*1000;r=await page('/s/'+code2);html=await r.text();assert.equal(meta(html,'lapan-share-error'),'expired','links expire after about six months');
j=await (await post(KL)).json();assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM shared_places WHERE code=?').get(j.code).n,1,'an expired row is replaced');assert.equal(meta(await (await page('/s/'+j.code)).text(),'lapan-share')!==null,true);
// A link that is still being used does not expire.
{const t=Math.floor(clock/1000);db.raw.prepare('UPDATE shared_places SET expires_at=? WHERE code=?').run(t+100*86400,j.code);await page('/s/'+j.code);assert.equal(db.raw.prepare('SELECT expires_at FROM shared_places WHERE code=?').get(j.code).expires_at,t+15552000,'viewing renews it');
 db.raw.prepare('UPDATE shared_places SET expires_at=? WHERE code=?').run(t+170*86400,j.code);await page('/s/'+j.code);assert.equal(db.raw.prepare('SELECT expires_at FROM shared_places WHERE code=?').get(j.code).expires_at,t+170*86400,'but not on every view')}
// Links that carry the place inside them need no database.
const enc=client.encodeStateless({name:'Café Ñandú 咖啡',lat:3.1,lon:101.7});html=await (await page('/l/'+enc,{})).text();assert.deepEqual(JSON.parse(meta(html,'lapan-share')),{n:'Café Ñandú 咖啡',la:3.1,lo:101.7});
html=await (await page('/l/'+client.encodeStateless({name:'Map pin 3.10000, 101.70000',lat:3.1,lon:101.7}),{})).text();assert.equal(JSON.parse(meta(html,'lapan-share')).n,'');
for(const bad of ['!!!','AAAA','x'.repeat(500),Buffer.from('99.00000,101.00000,x').toString('base64url'),Buffer.from('3.1,101.7').toString('base64url'),Buffer.from([0xff,0xfe,0xfd,0xfc,0xfb,0xfa,0xf9,0xf8]).toString('base64url'),Buffer.from('3.10000,101.70000,').toString('base64url').slice(0,-3)+'$$'])assert.equal(meta(await (await page('/l/'+bad,{})).text(),'lapan-share-error'),'missing',bad);
assert.deepEqual(client.decodeStateless(enc),{name:'Café Ñandú 咖啡',lat:3.1,lon:101.7},'browser and server agree on the format');
// Rate limit and global cap.
const spam=await Promise.all(Array.from({length:12},(_,i)=>post({name:'s'+i,lat:5,lon:100.5},{ip:'203.0.113.7'})));assert.equal(spam.filter(x=>x.status===429).length,2);clock+=61_000;assert.equal((await post({name:'later',lat:5,lon:100.5},{ip:'203.0.113.7'})).status,201);
{const t=Math.floor(clock/1000),ins=db.raw.prepare('INSERT INTO shared_places (code,name,lat,lon,created_at,expires_at) VALUES (?,?,?,?,?,?)');db.raw.exec('DELETE FROM shared_places;BEGIN');for(let i=0;i<200000;i++)ins.run('x'+i.toString().padStart(6,'0'),'n',3,101,t,t+1000);db.raw.exec('COMMIT');assert.equal((await post({name:'over',lat:6,lon:100})).status,503,'cap')}
// Database trouble never shows internals.
const broken={DB:{prepare(){throw Error('d1 down: secret detail')}}};const failed=await post(KL,{},broken);assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('secret'));html=await (await page('/s/Ab3dEfG',broken)).text();assert.equal(meta(html,'lapan-share-error'),'unavailable');
// The real app page works as the template.
const real={body:readFileSync('web/index.html','utf8')};const shared=await (await sharedPlacePage(new Request(O+'/l/'+enc),{},real)).text();assert.ok(shared.includes('<base href="/">')&&shared.includes('src="app.js"')&&shared.length>real.body.length);assert.equal((shared.match(/<script/g)||[]).length,(real.body.match(/<script/g)||[]).length,'no script added');
Date.now=realNow;
console.log('PASS: short links (create, repeat, clash, expiry, renewal), validation and limits, shared page with preview tags and safe escaping, links without a database, errors and privacy of stored columns');
