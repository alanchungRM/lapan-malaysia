const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('web/saved.js','utf8'),tick=()=>new Promise(setImmediate);
function setup({blocked=false,seed={}}={}){const nodes=new Map(),chips={},edits={},callbacks=[],writes=[],events=[],timers=[];let persisted=JSON.stringify(seed),failure=blocked,searcher=async()=>({items:[]});
 class El{constructor(){this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.open=false;this.classList={toggle(){}};this.children=[];this.selectors={};this.listeners={}}querySelector(s){return this.selectors[s]??=new El()}addEventListener(k,f){(this.listeners[k]??=[]).push(f)}fire(k,e={}){for(const f of this.listeners[k]||[])f(e)}showModal(){this.open=true}close(){this.open=false;setImmediate(()=>this.fire('close'))}focus(){this.focused=true}replaceChildren(){this.children=[]}append(...c){this.children.push(...c)}setAttribute(){}cloneNode(){return new El()}}
 for(const k of ['home','work']){chips[k]=new El();edits[k]=new El()}
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)},querySelector(s){return s.includes('edit')?edits[s.match(/"(.*?)"/)[1]]:chips[s.match(/"(.*?)"/)[1]]},createElement:()=>new El()};
 const layers=[];
 const root={document,L:{
  layerGroup:()=>({addTo(){return this},clearLayers(){layers.length=0}}),
  divIcon:options=>options,
  marker:(coords,options)=>({coords,options,addTo(){layers.push(this);return this},getElement:()=>new El(),on(event,callback){this[event]=callback}})
 },navigator:{geolocation:{getCurrentPosition(ok,fail){callbacks.push({ok,fail})}}},dispatchEvent:e=>events.push(e),LapanSearch:{search:(...args)=>searcher(...args)}};
 if(blocked)Object.defineProperty(root,'localStorage',{get(){throw Error('blocked')}});else root.localStorage={getItem:()=>persisted,setItem:(k,v)=>{if(failure)throw Error('denied');persisted=v;writes.push(JSON.parse(v))}};
 vm.runInNewContext(code,{window:root,document,AbortController,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:i=>{timers[i-1]=null},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 const get=id=>document.getElementById(id);return {root,get,chips,edits,callbacks,writes,events,layers,set failure(v){failure=v},set searcher(v){searcher=v},input(q){get('savedSearch').value=q;get('savedSearch').fire('input')},async search(){for(const fn of timers.splice(0))if(fn)await fn()}};
}
(async()=>{
 // Existing pins appear on bind, pin clicks use saved coordinates, and editing updates the map.
 const pinTest=setup({seed:{home:['Old home',3.1,101.5],work:['Office',3.1,101.5]}});
 let clicked;
 pinTest.root.LapanSaved.bind({map:{},openPin:(kind,place)=>clicked=[kind,place[0],place[1],place[2]]});
 assert.equal(pinTest.layers.length,2);
 assert.notEqual(pinTest.layers[0].options.icon.iconAnchor[0],pinTest.layers[1].options.icon.iconAnchor[0]);
 pinTest.layers[1].click();
 assert.deepEqual(clicked,['work','Office',3.1,101.5]);
 assert.equal(pinTest.events.length,0,'clicking a pin does not choose a route');
 pinTest.edits.home.onclick();pinTest.get('savedUseHere').onclick();
 pinTest.callbacks[0].ok({coords:{latitude:3.2,longitude:101.6}});
 pinTest.get('saveSaved').onclick();await tick();
 assert.equal(pinTest.layers[0].coords[0],3.2);
 pinTest.edits.home.onclick();pinTest.get('savedRemove').onclick();await tick();
 assert.equal(pinTest.layers.length,1);
 assert.equal(pinTest.layers[0].options.title,'Work');
 // GPS is a draft. Cancelling discards it; only Save writes to storage.
 let x=setup();x.chips.home.onclick();x.get('savedUseHere').onclick();x.callbacks[0].ok({coords:{latitude:3.14,longitude:101.69,accuracy:10}});assert.equal(x.writes.length,0);assert.equal(x.get('saveSaved').disabled,false);x.get('cancelSaved').onclick();await tick();assert.equal(x.root.LapanSaved.get('home'),null);
 x.chips.home.onclick();x.get('savedUseHere').onclick();x.callbacks[1].ok({coords:{latitude:3.14,longitude:101.69}});x.get('saveSaved').onclick();await tick();assert.equal(x.writes.length,1);assert.equal(x.root.LapanSaved.get('home')[1],3.14);
 // Changing/cancelling never removes the original; a failed write/removal never claims success.
 x.edits.home.onclick();x.get('savedUseHere').onclick();x.callbacks[2].ok({coords:{latitude:3.2,longitude:101.8}});assert.equal(x.root.LapanSaved.get('home')[1],3.14);x.failure=true;x.get('saveSaved').onclick();assert.equal(x.root.LapanSaved.get('home')[1],3.14);assert.equal(x.get('savedDialog').open,true);assert.match(x.get('savedStatus').textContent,/cannot save/);x.get('savedRemove').onclick();assert.equal(x.root.LapanSaved.get('home')[1],3.14);x.failure=false;x.get('cancelSaved').onclick();await tick();assert.equal(x.root.LapanSaved.get('home')[1],3.14);
 // Late GPS callbacks cannot save into another shortcut or replace a newer search selection.
 x.chips.work.onclick();x.get('savedUseHere').onclick();x.get('cancelSaved').onclick();x.edits.home.onclick();x.callbacks[3].ok({coords:{latitude:3.3,longitude:101.9}});assert.equal(x.get('saveSaved').disabled,true);assert.equal(x.root.LapanSaved.get('work'),null);
 x.get('savedUseHere').onclick();x.input('Office');let args;x.searcher=async(...a)=>{args=a;return {items:[['Office, Klang',3.1,101.4]]}};await x.search();x.get('savedResults').children[0].onclick();x.callbacks[4].ok({coords:{latitude:3.5,longitude:102}});assert.equal(x.get('savedSelectedName').textContent,'Office, Klang');assert.equal(args[3],false,'shortcut search uses existing free providers, without paid secondary search');assert.equal(x.writes.length,1);x.get('saveSaved').onclick();await tick();assert.equal(x.root.LapanSaved.get('home')[0],'Office, Klang');
 // Search result arriving after a map selection cannot replace the chosen pin.
 x.edits.home.onclick();let resolve; x.searcher=()=>new Promise(r=>resolve=r);x.input('Delayed');const pending=x.search();let picker;x.root.LapanSaved.bind({pickMap:options=>picker=options});x.get('savedUseMap').onclick();await tick();assert.equal(x.get('savedDialog').open,false);picker.onChoose(['Map pin',3.2,101.6]);resolve({items:[['Old result',3.4,102]]});await pending;assert.equal(x.get('savedDialog').open,true);assert.equal(x.get('savedSelectedName').textContent,'Map pin');assert.equal(x.get('savedResults').children.length,0);assert.equal(x.root.LapanSaved.get('home')[0],'Office, Klang');x.get('saveSaved').onclick();await tick();assert.equal(x.root.LapanSaved.get('home')[0],'Map pin');
 // Map cancellation returns to the unsaved draft; Home/Work remain independent.
 x.edits.home.onclick();x.get('savedUseHere').onclick();x.callbacks.at(-1).ok({coords:{latitude:3.1,longitude:101.5,accuracy:250}});assert.match(x.get('savedStatus').textContent,/accuracy is low/);const draft=x.get('savedSelectedName').textContent;x.get('savedUseMap').onclick();await tick();picker.onCancel();assert.equal(x.get('savedDialog').open,true);assert.equal(x.get('savedSelectedName').textContent,draft);x.get('cancelSaved').onclick();await tick();assert.equal(x.root.LapanSaved.get('home')[0],'Map pin');x.chips.home.onclick();assert.equal(x.events[0].detail.place[0],'Map pin');
 x=setup({blocked:true});x.chips.home.onclick();x.get('savedUseHere').onclick();x.callbacks[0].ok({coords:{latitude:3.1,longitude:101.5}});x.get('saveSaved').onclick();assert.equal(x.root.LapanSaved.get('home'),null);assert.match(x.get('savedStatus').textContent,/cannot save/);
 // Extended search is explicit, preserves saved data and ignores results after an edit.
 x=setup({seed:{home:['Old home',3.1,101.5]}});x.edits.home.onclick();x.input('Missing business');x.searcher=async()=>({items:[]});await x.search();let calls=0,finish;x.root.LapanSearch.lookupMore=()=>{calls++;return new Promise(r=>finish=r)};x.root.LapanSearch.rank=items=>items;assert.equal(calls,0);assert.equal(x.get('savedMore').hidden,false);const more=x.get('savedMore').onclick();assert.equal(calls,1);assert.equal(x.get('savedMore').disabled,true);x.get('savedMore').onclick();assert.equal(calls,1);finish([['Found business',3.2,101.7]]);await more;assert.equal(x.get('savedResults').children.length,1);assert.equal(x.root.LapanSaved.get('home')[0],'Old home');x.get('savedResults').children[0].onclick();assert.equal(x.writes.length,0);x.get('saveSaved').onclick();await tick();assert.equal(x.root.LapanSaved.get('home')[0],'Found business');
 x.edits.home.onclick();x.input('Old query');const staleMore=x.get('savedMore').onclick();x.input('New query');finish([['Stale business',3.3,101.8]]);await staleMore;assert.equal(x.get('savedResults').children.length,0);assert.equal(x.root.LapanSaved.get('home')[0],'Found business');
 x.root.LapanSearch.lookupMore=async()=>{throw Error('denied')};await x.get('savedMore').onclick();assert.match(x.get('savedStatus').textContent,/unavailable/);assert.equal(x.get('savedMore').disabled,false);
 console.log('PASS: explicit saved-place confirmation, old-place preservation, storage denial, stale search/GPS, map confirm/cancel and free-provider search');
})().catch(e=>{console.error(e);process.exitCode=1});
// Exercise the planner listener to verify resolved coordinates and previous-route invalidation.
const app=fs.readFileSync('web/app.js','utf8'),start=app.indexOf('window.LapanSaved?.bind('),end=app.indexOf("window.addEventListener('lapan-place'",start),chosen={origin:['Start',3.1,101.6],destination:null},elements={destination:{value:''},suggest:{replaceChildren(){this.cleared=true},style:{}},plan:{focus(){this.focused=true}}},panel={open:false};let listener,cancelled=0,invalidated=0;
vm.runInNewContext(app.slice(app.indexOf('function keepDestination('),app.indexOf('function instruction('))+app.slice(start,end),{routes:[],map:{},window:{LapanSaved:{bind(){},get:k=>k==='home'?['Home place',3.15,101.7]:null},addEventListener:(k,fn)=>listener=fn},chosen,placeSearch:{cancel(){cancelled++}},invalidatePlan(){invalidated++},$:id=>elements[id],document:{querySelector:()=>panel},status(){}});
listener({detail:{kind:'home'}});assert.equal(chosen.destination[0],'Home place');assert.equal(chosen.origin[0],'Start');assert.equal(elements.destination.value,'Home place');assert.equal(cancelled,1);assert.equal(invalidated,1);assert.equal(elements.suggest.style.display,'none');assert.equal(panel.open,true);assert.equal(elements.plan.focused,true);
