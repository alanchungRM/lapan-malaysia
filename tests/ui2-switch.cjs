const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('web/ui2.js','utf8');
function run(search,stored={},options={}){
 const store={...stored},appended=[],dataset={},listeners={};let current;
 const storage={...store};
 Object.defineProperties(storage,{getItem:{value:k=>storage[k]??null},setItem:{value:(k,v)=>{store[k]=v;storage[k]=v}}});
 vm.runInNewContext(code,{location:{search},URLSearchParams,localStorage:storage,
  navigator:options.navigator||{},window:{matchMedia:()=>({matches:!!options.standalone})},
  document:{documentElement:{dataset},querySelector:selector=>({setAttribute:(name,value)=>{if(name==='aria-current'&&value==='true')current=selector}}),head:{append:n=>appended.push(n)},createElement:()=>({}),addEventListener:(k,fn)=>listeners[k]=fn}});
 if(listeners.DOMContentLoaded)listeners.DOMContentLoaded();
 return {store,appended,dataset,current};
}
// First-time website visitors start on Sunset; existing browsers keep their implicit Adaptive skin.
let r=run('');assert.equal(r.appended.length,1);assert.equal(r.dataset.ui,'2');assert.equal(r.dataset.skin,'sunset');assert.equal(r.store['lapan-ui'],'sunset');
assert.equal(run('',r.store,{standalone:true}).dataset.skin,'sunset','a new visitor retains Sunset when installed');
for(const [storage,options] of [
 [{'lapan-voice':'{}'},{}],
 [{},{navigator:{serviceWorker:{controller:{}}}}],
 [{},{navigator:{standalone:true}}],
 [{},{standalone:true}]
]){
 const previous=run('',storage,options);
 assert.equal(previous.dataset.skin,undefined);
 assert.equal(previous.store['lapan-ui'],'2');
 assert.equal(run('',previous.store).dataset.skin,undefined);
}
assert.equal(run('',{'lapan-ui':'1'},{standalone:true}).dataset.ui,undefined);
assert.equal(run('',{'lapan-ui':'2'},{standalone:true}).dataset.skin,undefined);
// ?ui=2 turns it on, loads only the new stylesheet, and is remembered for the next visit.
r=run('?ui=2');assert.equal(r.dataset.ui,'2');assert.deepEqual(r.appended.map(n=>[n.rel,n.href]),[['stylesheet','/ui2.css']]);assert.equal(r.store['lapan-ui'],'2');
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/mobile.css','utf8');
assert.ok(html.includes('<div class="appearance-options"><a class="link" href="?ui=1">Classic</a><a class="link" href="?ui=2">Adaptive</a><a class="link" href="?ui=sunset">GTA Sunset</a></div>'));
assert.ok(css.includes('#uiAppearance:not([open]) .appearance-options{display:none}'));
r=run('',{'lapan-ui':'2'});assert.equal(r.dataset.ui,'2','remembered choice');
// ?ui=1 always gets you back to the classic look, even if the new one was remembered.
r=run('?ui=1',{'lapan-ui':'2'});assert.equal(r.dataset.ui,undefined);assert.equal(r.store['lapan-ui'],'1');assert.equal(r.appended.length,0);assert.equal(run('',r.store).dataset.ui,undefined);
r=run('?ui=sunset',{'lapan-ui':'1'});
assert.equal(r.dataset.ui,'2');
assert.equal(r.dataset.skin,'sunset');
assert.match(r.current,/ui=sunset/);
assert.match(run('?ui=2',r.store).current,/ui=2/);
assert.match(run('?ui=1',r.store).current,/ui=1/);
assert.equal(run('',r.store).dataset.skin,'sunset');
assert.equal(run('?ui=2',r.store).dataset.skin,undefined);
assert.equal(run('?ui=1',r.store).appended.length,0);
// Unrelated or unknown values change nothing.
r=run('?ui=3');assert.equal(r.dataset.ui,'2');r=run('?other=1&ui=2x',{'lapan-ui':'1'});assert.equal(r.dataset.ui,undefined);
// If browser storage is blocked, the query string alone still works for that page.
let d={};vm.runInNewContext(code,{location:{search:'?ui=2'},URLSearchParams,navigator:{},window:{},get localStorage(){throw Error('blocked')},document:{documentElement:{dataset:d},head:{append(){}},createElement:()=>({}),addEventListener(){}}});assert.equal(d.ui,'2');
console.log('PASS: Sunset first visit, existing and installed skin preserved, Classic loads no new stylesheet, ?ui=2 turns on and persists, ?ui=1 turns off, unknown values ignored, works when storage is blocked');
