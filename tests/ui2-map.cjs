const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function load({ui,themeNow}){
 const events={},saved={},input={value:''},note={},dataset={...(ui?{ui:'2'}:{})},calls=[];
 const media={matches:true,addEventListener(){}};
 const ctx={window:{matchMedia:()=>media,addEventListener:(k,fn)=>events[k]=fn,LapanTheme:ui?{current:()=>themeNow,apply:()=>calls.push('apply')}:undefined},document:{documentElement:{dataset},getElementById:id=>id==='mapAppearance'?input:note,addEventListener:(k,fn)=>events[k]=fn},localStorage:{getItem:()=>null,setItem:(k,v)=>saved[k]=v},fetch:async()=>({ok:true,json:async()=>({version:8,sources:{},layers:[]})})};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/map-appearance.js','utf8'),ctx);events.DOMContentLoaded();return {api:ctx.window.LapanMapAppearance,input,note,dataset,calls,saved};
}
// The classic look is untouched: first visit is Day, Auto follows the device.
let c=load({ui:false});assert.equal(c.input.value,'day');assert.match(c.note.textContent,/device/);assert.equal(c.calls.length,0);
// The new look starts on Auto, asks the theme controller what to show, and tells it to update on every refresh.
c=load({ui:true,themeNow:'night'});assert.equal(c.input.value,'auto');assert.match(c.api.url(),/map-night-gray/);assert.equal(c.dataset.mapTheme,'night');assert.match(c.note.textContent,/sunrise and sunset/);assert.ok(c.calls.includes('apply'));
c=load({ui:true,themeNow:'day'});assert.match(c.api.url(),/liberty/);assert.equal(typeof c.api.refresh,'function');const before=c.calls.length;c.api.refresh();assert.equal(c.calls.length,before+1,'refresh re-applies the theme');
console.log('PASS: classic look unchanged, new look defaults to Auto, map style follows the theme controller, refresh hook works');
