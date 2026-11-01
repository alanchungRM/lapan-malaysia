const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('web/ui2.js','utf8');
function run(search,stored={}){
 const store={...stored},appended=[],dataset={},listeners={};
 const toggle={href:'?ui=2',textContent:'Try the new look (beta)'};
 vm.runInNewContext(code,{location:{search},URLSearchParams,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}},
  document:{documentElement:{dataset},head:{append:n=>appended.push(n)},createElement:()=>({}),getElementById:id=>id==='uiToggle'?toggle:null,addEventListener:(k,fn)=>listeners[k]=fn}});
 if(listeners.DOMContentLoaded)listeners.DOMContentLoaded();
 return {store,appended,dataset,toggle};
}
// Off by default: nothing is added, so the classic app downloads and runs exactly as before.
let r=run('');assert.equal(r.appended.length,0);assert.equal(r.dataset.ui,undefined);assert.equal(r.toggle.href,'?ui=2');
// ?ui=2 turns it on, loads only the new stylesheet, and is remembered for the next visit.
r=run('?ui=2');assert.equal(r.dataset.ui,'2');assert.deepEqual(r.appended.map(n=>[n.rel,n.href]),[['stylesheet','/ui2.css']]);assert.equal(r.store['lapan-ui'],'2');
assert.equal(r.toggle.href,'?ui=1');assert.match(r.toggle.textContent,/classic/i);
r=run('',{'lapan-ui':'2'});assert.equal(r.dataset.ui,'2','remembered choice');
// ?ui=1 always gets you back to the classic look, even if the new one was remembered.
r=run('?ui=1',{'lapan-ui':'2'});assert.equal(r.dataset.ui,undefined);assert.equal(r.store['lapan-ui'],undefined);assert.equal(r.appended.length,0);
// Unrelated or unknown values change nothing.
r=run('?ui=3');assert.equal(r.dataset.ui,undefined);r=run('?other=1&ui=2x');assert.equal(r.dataset.ui,undefined);
// If browser storage is blocked, the query string alone still works for that page.
let d={};vm.runInNewContext(code,{location:{search:'?ui=2'},URLSearchParams,get localStorage(){throw Error('blocked')},document:{documentElement:{dataset:d},head:{append(){}},createElement:()=>({}),addEventListener(){}}});assert.equal(d.ui,'2');
console.log('PASS: off by default and loads nothing, ?ui=2 turns on and persists, ?ui=1 turns off, unknown values ignored, works when storage is blocked');
