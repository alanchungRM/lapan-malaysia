const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/sw.js','utf8').replace('{{APP_VERSION}}','9.9.9').replace('__SHELL__',JSON.stringify(['/','/app.js']));

function setup({network}){
 const stores=new Map(),listeners={};let delays=[];
 class Resp{constructor(body,{status=200,type='basic'}={}){this.body=body;this.status=status;this.ok=status>=200&&status<300;this.type=type}clone(){return new Resp(this.body,this)}}
 const cache=name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);
  return {add:async r=>{const res=await network(r);if(!res.ok)throw Error('bad');m.set(r.url,res)},put:async(r,res)=>{m.set(r.url||r,res)},match:async(r,o={})=>{const key=typeof r==='string'?new URL(r,'https://lapan.test').href:r.url;return m.get(key)||(o.ignoreSearch?[...m].find(([k])=>k.split('?')[0]===key.split('?')[0])?.[1]:undefined)}}};
 const ctx={URL,Request:class{constructor(url,init={}){this.url=new URL(url,'https://lapan.test').href;this.method=init.method||'GET';this.mode=init.mode||'cors';this.cache=init.cache}},Promise,Error,
  self:{location:{origin:'https://lapan.test'},addEventListener:(k,fn)=>listeners[k]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},
  caches:{open:async n=>cache(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)},
  fetch:r=>network(r),setTimeout:(fn,ms)=>{const t={fn,ms};delays.push(t);return t},clearTimeout:t=>{delays=delays.filter(d=>d!==t)}};
 vm.runInNewContext(source,ctx);
 const fetchEvent=request=>new Promise(resolve=>{let p;listeners.fetch({request,respondWith:x=>{p=x}});resolve(p)});
 return {ctx,stores,listeners,fetchEvent,Resp,delays:()=>delays,Request:ctx.Request};
}

(async()=>{
 // Cacheable decisions: live API data and writes are never cached, third-party hosts other than Leaflet are untouched.
 const t=setup({network:async()=>({ok:true})});
 const bypass=async url=>{let responded=false;t.listeners.fetch({request:new t.Request(url),respondWith:()=>{responded=true}});return !responded};
 assert.ok(await bypass('/api/route'),'api bypasses the worker');assert.ok(await bypass('/sw.js'));assert.ok(await bypass('https://tiles.openfreemap.org/planet/1'));assert.ok(await bypass('https://photon.komoot.io/api/?q=x'));assert.ok(await bypass('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'),'third-party hosts are never touched');
 {let responded=false;t.listeners.fetch({request:new t.Request('/api/x',{method:'POST'}),respondWith:()=>{responded=true}});assert.ok(!responded)}
 {let responded=false;t.listeners.fetch({request:new t.Request('/app.js'),respondWith:()=>{responded=true}});assert.ok(responded,'static assets are handled')}

 // Network first: a healthy network always wins, and the response is cached for later.
 let online=true;const s=setup({network:async r=>{if(!online)throw Error('offline');return new s.Resp('fresh:'+r.url)}});
 let res=await (await s.fetchEvent(new s.Request('/app.js')));assert.equal(res.body,'fresh:https://lapan.test/app.js');
 await new Promise(r=>setImmediate(r));
 online=false;res=await (await s.fetchEvent(new s.Request('/app.js')));assert.equal(res.body,'fresh:https://lapan.test/app.js','falls back to the cached copy when offline');
 // A navigation to an uncached page falls back to the cached shell page.
 online=true;await (await s.fetchEvent(new s.Request('/',{mode:'navigate'})));await new Promise(r=>setImmediate(r));online=false;
 res=await (await s.fetchEvent(new s.Request('/?utm=1',{mode:'navigate'})));assert.ok(res,'navigation falls back to the cached shell');
 // Nothing cached and no network: the error surfaces rather than a fake page.
 await assert.rejects(async()=>await (await s.fetchEvent(new s.Request('/never-seen.js'))),/offline/);
 // Error responses are not cached over a good copy.
 online=true;const bad=setup({network:async r=>new bad.Resp('boom',{status:503})});await (await bad.fetchEvent(new bad.Request('/x.js')));await new Promise(r=>setImmediate(r));
 assert.equal(bad.stores.get('lapan-shell-9.9.9').has('https://lapan.test/x.js'),false,'503 is not cached');

 // Slow network triggers the timeout path, and activation removes caches from older versions only.
 const slow=setup({network:()=>new Promise(()=>{})});const p=slow.fetchEvent(new slow.Request('/app.js'));
 await new Promise(r=>setImmediate(r));const timer=slow.delays().find(d=>d.ms===4000);assert.ok(timer,'4 second timeout is armed');
 const cacheStore=await slow.ctx.caches.open('lapan-shell-9.9.9');await cacheStore.put('https://lapan.test/app.js',new slow.Resp('cached'));timer.fn();
 const slowResult=await (await p);assert.equal(slowResult.body,'cached','timeout serves the cached copy');
 await slow.ctx.caches.open('lapan-shell-1.0.0');await slow.ctx.caches.open('other-app-cache');
 let finished;slow.listeners.activate({waitUntil:x=>finished=x});await finished;
 assert.deepEqual([...slow.stores.keys()].sort(),['lapan-shell-9.9.9','other-app-cache'],'old Lapan caches removed, foreign caches left alone');
 console.log('PASS: live data bypass, network-first caching, offline and timeout fallbacks, navigation shell fallback, error responses not cached, old cache cleanup');
})().catch(e=>{console.error(e);process.exit(1)});
