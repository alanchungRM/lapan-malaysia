const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('web/saved.js','utf8');
function setup(blocked=false){const nodes=new Map(),chips={},edits={},callbacks=[],writes=[],events=[],listeners={};
 const element=id=>({id,hidden:false,disabled:false,textContent:'',open:false,classList:{toggle(){}},children:{},querySelector(s){return this.children[s]??=element(s)},listeners:{},addEventListener(k,f){this.listeners[k]=f},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()},focus(){}});
 for(const k of ['home','work']){chips[k]=element(k);edits[k]=element(k+'Edit')}
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id)},querySelector(s){return s.includes('edit')?edits[s.match(/"(.*?)"/)[1]]:chips[s.match(/"(.*?)"/)[1]]}};
 const root={document,navigator:{geolocation:{getCurrentPosition(ok,fail){callbacks.push({ok,fail})}}},dispatchEvent:e=>events.push(e)};
 if(blocked)Object.defineProperty(root,'localStorage',{get(){throw Error('blocked')}});else root.localStorage={getItem:()=>null,setItem:(k,v)=>writes.push(JSON.parse(v))};
 vm.runInNewContext(code,{window:root,document,navigator:root.navigator,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 const get=id=>document.getElementById(id),dialog=get('savedDialog');
 return {root,get,chips,edits,callbacks,writes,events};
}
// A late GPS success after cancelling and opening Work cannot accidentally save Home's fix as Work.
let x=setup();x.chips.home.onclick();x.get('savedUseHere').onclick();x.get('savedDialog').open=false;x.chips.work.onclick();x.callbacks[0].ok({coords:{latitude:3.14,longitude:101.69}});assert.equal(x.writes.length,0);assert.equal(x.root.LapanSaved.get('work'),null);
// Manual selection while GPS is pending wins; the later callback cannot overwrite it.
x.root.LapanSaved.bind({destination:()=>['Office',3.15,101.71]});x.get('savedUseHere').onclick();x.get('savedUseTo').onclick();assert.equal(x.writes.length,1);x.callbacks[1].ok({coords:{latitude:3.2,longitude:101.8}});assert.equal(x.writes.length,1);assert.equal(x.root.LapanSaved.get('work')[0],'Office');x.chips.work.onclick();assert.equal(x.events[0].detail.place[0],'Office');
// Storage getter denial does not prevent initialization and never claims persistence succeeded.
x=setup(true);x.root.LapanSaved.bind({destination:()=>['Office',3.15,101.71]});x.chips.home.onclick();x.get('savedUseTo').onclick();assert.equal(x.root.LapanSaved.get('home'),null);assert.equal(x.get('savedDialog').open,true);assert.equal(x.get('savedStatus').textContent,'This browser cannot save places right now.');
console.log('PASS: saved shortcut stale GPS, manual selection and blocked storage initialization');
// Exercise the real planner listener so a saved destination cancels stale search/routes and preserves From.
const app=fs.readFileSync('web/app.js','utf8'),start=app.indexOf('window.LapanSaved?.bind('),end=app.indexOf("window.addEventListener('lapan-place'",start),chosen={origin:['Start',3.1,101.6],destination:null},elements={destination:{value:''},suggest:{replaceChildren(){this.cleared=true},style:{}},plan:{focus(){this.focused=true}}},panel={open:false};let listener,cancelled=0,invalidated=0,message='';
vm.runInNewContext(app.slice(start,end),{window:{LapanSaved:{bind(){},get:k=>k==='home'?['Home place',3.15,101.7]:null},addEventListener:(k,fn)=>listener=fn},chosen,placeSearch:{cancel(){cancelled++}},invalidatePlan(){invalidated++},$:id=>elements[id],document:{querySelector:()=>panel},status:m=>message=m});
listener({detail:{kind:'home'}});assert.equal(chosen.destination[0],'Home place');assert.equal(chosen.origin[0],'Start');assert.equal(elements.destination.value,'Home place');assert.equal(cancelled,1);assert.equal(invalidated,1);assert.equal(elements.suggest.style.display,'none');assert.equal(panel.open,true);assert.equal(elements.plan.focused,true);assert.match(message,/Home selected/);
console.log('PASS: saved-place selection resolves planner coordinates and invalidates previous routes');
