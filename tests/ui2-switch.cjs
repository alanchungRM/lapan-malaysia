const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('web/ui2.js','utf8');
function run(search,stored={}){
 const store={...stored},appended=[],dataset={},listeners={};
 vm.runInNewContext(code,{location:{search},URLSearchParams,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}},
  document:{documentElement:{dataset},head:{append:n=>appended.push(n)},createElement:()=>({}),addEventListener:(k,fn)=>listeners[k]=fn}});
 if(listeners.DOMContentLoaded)listeners.DOMContentLoaded();
 return {store,appended,dataset};
}
// The new look is the default until a visitor chooses Classic.
let r=run('');assert.equal(r.appended.length,1);assert.equal(r.dataset.ui,'2');assert.equal(r.store['lapan-ui'],undefined);
// ?ui=2 turns it on, loads only the new stylesheet, and is remembered for the next visit.
r=run('?ui=2');assert.equal(r.dataset.ui,'2');assert.deepEqual(r.appended.map(n=>[n.rel,n.href]),[['stylesheet','/ui2.css']]);assert.equal(r.store['lapan-ui'],'2');
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/mobile.css','utf8');
assert.ok(html.includes('<details id="uiAppearance"><summary aria-label="App appearance"></summary><a class="link" href="?ui=2">Try the new look</a><a class="link" href="?ui=1">Back to the classic look</a></details>'));
assert.ok(css.includes('#uiAppearance:not([open]) a,'));
assert.ok(css.includes('html:not([data-ui="2"]) #uiAppearance a[href="?ui=1"]'));
assert.ok(css.includes('html[data-ui="2"] #uiAppearance a[href="?ui=2"]'));
r=run('',{'lapan-ui':'2'});assert.equal(r.dataset.ui,'2','remembered choice');
// ?ui=1 always gets you back to the classic look, even if the new one was remembered.
r=run('?ui=1',{'lapan-ui':'2'});assert.equal(r.dataset.ui,undefined);assert.equal(r.store['lapan-ui'],'1');assert.equal(r.appended.length,0);assert.equal(run('',r.store).dataset.ui,undefined);
// Unrelated or unknown values change nothing.
r=run('?ui=3');assert.equal(r.dataset.ui,'2');r=run('?other=1&ui=2x',{'lapan-ui':'1'});assert.equal(r.dataset.ui,undefined);
// If browser storage is blocked, the query string alone still works for that page.
let d={};vm.runInNewContext(code,{location:{search:'?ui=2'},URLSearchParams,get localStorage(){throw Error('blocked')},document:{documentElement:{dataset:d},head:{append(){}},createElement:()=>({}),addEventListener(){}}});assert.equal(d.ui,'2');
console.log('PASS: new look by default, Classic loads no new stylesheet, ?ui=2 turns on and persists, ?ui=1 turns off, unknown values ignored, works when storage is blocked');
