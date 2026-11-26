import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile('web/app.js', 'utf8');
const tripHandler = app.slice(app.indexOf('async function changeRvStop'), app.indexOf("$('removeRvStop').onclick"));
const origin = ['Start', 3.1, 101.7], final = ['Finish', 2.2, 102.2], stop = ['Campsite', 2.7, 102.1];
const context = vm.createContext({origin, final, stop});
vm.runInContext(`
 let rvStop=null, succeeds=true;
 const chosen={origin, destination:final};
 const fields={origin:{value:origin[0]}, plan:{onclick:async()=>succeeds}};
 const $=id=>fields[id];
 const updateRvTripControls=()=>{};
 ${tripHandler}
`, context);
const evalIn = source => vm.runInContext(source, context);
assert.equal(await evalIn('changeRvStop(stop)'), true);
assert.equal(evalIn('rvStop===stop && chosen.destination===final && chosen.origin===origin'), true);
assert.equal(await evalIn('succeeds=false; changeRvStop(null,stop)'), false);
assert.equal(evalIn('rvStop===stop && chosen.origin===origin && fields.origin.value===origin[0]'), true);
assert.equal(await evalIn('succeeds=true; changeRvStop(null,stop)'), true);
assert.equal(evalIn('rvStop===null && chosen.destination===final && chosen.origin[1]===stop[1]'), true);
assert.match(app, /dest=activeDestination\(\)\.slice\(\)/);

const stops = await readFile('web/stops.js','utf8');
const pickerSource=app.slice(app.indexOf('rvDestinationPicker(){'),app.indexOf('async location({requireGps'));
const contextForPicker=vm.createContext({
 chosen:{origin:null,destination:null}, allowsRv:()=>contextForPicker.rvEnabled, rvEnabled:true,
 document:{body:{classList:{contains:()=>false}},querySelector:()=>({})},
 placeSearch:{cancel(){}}, $:()=>({style:{}}), status(){},
 keepDestination:place=>{contextForPicker.chosen.destination=Array.from(place)}
});
const picker=vm.runInContext('({'+pickerSource+'}).rvDestinationPicker()',contextForPicker);
assert.equal(picker.select({name:'Campsite',lat:2.7,lon:102.1}),true);
assert.deepEqual(contextForPicker.chosen.destination,stop);
assert.equal(contextForPicker.chosen.origin,null);
assert.equal(picker.select({name:'Stale result',lat:3,lon:101}),false);
const nearby=vm.runInContext('({'+pickerSource+'}).rvDestinationPicker()',contextForPicker);
contextForPicker.rvEnabled=false;
assert.equal(nearby.select({name:'Disabled result',lat:3,lon:101}),false);
assert.match(stops,/Use as destination/);
const locationSource=app.slice(app.indexOf('async location({requireGps'),app.indexOf('async route(item,origin)'));
let gpsOptions;
const locationContext={
 chosen:{origin:['Starting point',3,101],destination:['Destination',1.48,110.28]},
 lastGPS:{time:Date.now(),p:{coords:{latitude:3,longitude:101}}},
 navigator:{geolocation:{getCurrentPosition(success,_failure,options){
  gpsOptions=options;
  success({coords:{latitude:5.98,longitude:116.07}});
 }}}
};
const requestLocation=vm.runInNewContext('({'+locationSource+'}).location',locationContext);
assert.equal((await requestLocation({requireGps:true})).lat,5.98);
assert.equal(gpsOptions.maximumAge,0);
locationContext.navigator.geolocation.getCurrentPosition=(_success,failure)=>failure();
await assert.rejects(requestLocation({requireGps:true}),/Current location unavailable/);

const searchSource=stops.slice(stops.indexOf('async function search('),stops.indexOf('function closeUnavailableRvPicker'));
const requests=[];
let rendered;
const gpsStatus={};
const searchContext=vm.createContext({
 window:{LapanStopsContext:{
  allowsRv:()=>true,
  rvDestinationPicker:()=>({select(){}}),
  location:async options=>{assert.equal(options.requireGps,true);return {lat:5.98,lon:116.07,label:'your location',accuracy:120}}
 }},
 $:id=>id==='rvGpsStatus'?gpsStatus:{replaceChildren(){},classList:{add(){},remove(){}}},
 busy:false,kind:null,rvUse:'all',asDestination:false,generation:0,controller:null,
 navigator:{onLine:true},updateRvConnectionStatus(){},
 categories:[],rvFilters:[],labels:{rv:'RV stops'},open(){},cancelSearch(){},setSource(){},message(){},
 AbortController,URLSearchParams,
 fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({items:[{name:'Campsite'}]})}},
 renderStop:(item,origin,isRv,picker)=>{rendered={item,origin,isRv,picker}}
});
const search=vm.runInContext(searchSource+';search',searchContext);
await search('rv','all',false);
assert.equal(rendered.picker,null);
assert.equal(gpsStatus.hidden,false,'weak location accuracy has its own status');
await search('rv','overnight',true);
assert.equal(typeof rendered.picker.select,'function');
assert.deepEqual(requests,[
 '/api/nearby?kind=rv&lat=5.98&lon=116.07&use=all',
 '/api/nearby?kind=rv&lat=5.98&lon=116.07&use=overnight'
]);
searchContext.window.LapanStopsContext.location=async()=>{throw Error('Current location unavailable')};
await search('rv','all',true);
assert.equal(requests.length,2,'no alphabetical or route-based fallback when GPS is unavailable');
console.log('PASS: both RV listings use fresh GPS and preserve the selected filter');
const css = await readFile('web/ui2.css','utf8');
assert.match(css, /details:is\(\.recent-settings,\.quick-stops\)>summary::after\{[^}]*var\(--brand\)/);
console.log('PASS: RV destination picker, preserved destination, continuation and retry, themed chevron');

const markerCode = app.slice(app.indexOf('function rvStopMarker'), app.indexOf('markers=[];\nfunction invalidatePlan'));
const element = () => ({append(){}});
const pin = vm.runInNewContext(markerCode + 'rvStopMarker(stop)', {
 stop, map:{}, document:{createElement:element},
 L:{divIcon:icon=>icon,marker:(point, options)=>({addTo:()=>({bindPopup:()=>({point, options})})})}
});
assert.deepEqual(Array.from(pin.point), stop.slice(1));
assert.equal(pin.options.icon.className, 'rv-stop-marker');
assert.match(app, /markers=\[marker\(a\),marker\(final,true\)\];if\(rvStop\)markers.push\(rvStopMarker\(rvStop\)\)/);
assert.match(app, /setNavText\(\$\('navRvStopName'\),rvStop/);
assert.match(app, /setNavText\(\$\('navRvFinalName'\),rvStop\?chosen.destination/);
console.log('PASS: distinct campsite pin and final destination flag, with both destinations shown during RV guidance');

const continuationCode = app.slice(app.indexOf("$('continueRvTrip').onclick="), app.indexOf("$('continueRvLandscape').onclick"));
const continuationButton = {hidden:false, disabled:false}, target = {hidden:false};
let finishPlanning, started = 0, retries = 0;
vm.runInNewContext(continuationCode, {
 rvStop:stop, navSession:1, navResume:()=>{}, pauseRoutingRequests(){},
 window:{LapanStopsContext:{location:async options=>{
  assert.equal(options.requireGps,true);
  return {lat:3.12,lon:101.72};
 }}},
 $:id=>({continueRvTrip:continuationButton, navRvTarget:target, start:{onclick:()=>started++}})[id],
 changeRvStop:(next,point,isCurrent)=>{
  assert.equal(next,null);
  assert.deepEqual(Array.from(point),['My location',3.12,101.72]);
  assert.equal(isCurrent(),true);
  return new Promise(resolve=>{finishPlanning=resolve});
 },
 document:{body:{classList:{contains:()=>true}}},
 showNav:title=>{if(title==='Replanning…')return;assert.equal(title,'Route unchanged');assert.equal(continuationButton.disabled,false);continuationButton.hidden=false;retries++}
});
const pending = continuationButton.onclick();
assert.equal(continuationButton.hidden,true);
assert.equal(target.hidden,true);
await new Promise(setImmediate);
finishPlanning(false);
await pending;
assert.equal(retries,1);
assert.equal(continuationButton.hidden,false);
const retry = continuationButton.onclick();
await new Promise(setImmediate);
finishPlanning(true);
await retry;
assert.equal(started,1);
assert.equal(continuationButton.hidden,true);
assert.match(app, /continueButton.hidden=!rvStop\|\|continueButton.disabled;/);
assert.match(await readFile('web/drive-ui.css','utf8'), /#continueRvTrip\[hidden\]\{display:none!important\}/);
console.log('PASS: Continue hides immediately and stays hidden on success, with a retry on failure');

const visibilityCode = app.slice(app.indexOf('function updateRvTripControls()'), app.indexOf('let searchLocation'));
const vehicleCode = app.slice(app.indexOf('function updateVehicleControls()'), app.indexOf('updateVehicleControls();'));
const controls = {rvEnabled:{checked:false}};
const options = [{},{}];
const vehicleContext = vm.createContext({
 mode:'motorcycle', routes:[{}], selected:0, rvStop:null,
 vehicleMode:()=>vehicleContext.mode,
 allowsRv:()=>vehicleContext.mode==='car'&&controls.rvEnabled.checked,
 $:id=>controls[id]??={},
 document:{querySelectorAll:()=>options}
});
vm.runInContext(visibilityCode + vehicleCode + 'updateVehicleControls();updateRvTripControls();',vehicleContext);
assert.ok(options.every(option=>option.hidden));
assert.equal(controls.findRvDestination.hidden,true);
vehicleContext.mode='car';
vm.runInContext('updateVehicleControls();updateRvTripControls();',vehicleContext);
assert.ok(options.every(option=>option.hidden));
assert.equal(controls.rvPreference.hidden,false);
assert.equal(controls.findRvDestination.hidden,true);
controls.rvEnabled.checked=true;
vm.runInContext('updateVehicleControls()',vehicleContext);
assert.ok(options.every(option=>!option.hidden));
assert.equal(controls.findRvDestination.hidden,false);
for(const mode of ['motorcycle','truck']){
 vehicleContext.mode=mode;
 vm.runInContext('updateVehicleControls()',vehicleContext);
 assert.ok(options.every(option=>option.hidden));
 assert.equal(controls.rvPreference.hidden,true);
 assert.equal(controls.findRvDestination.hidden,true);
}
assert.equal(controls.rvTripSummary.hidden,true);
const plannerHtml = await readFile('web/index.html','utf8');
assert.equal((plannerHtml.match(/Find RV campsite/g)||[]).length,1);
assert.match(plannerHtml,/<input id="rvEnabled" type="checkbox" autocomplete="off">/);
assert.match(plannerHtml, /id="moreOptions".*?id="vehicle".*?id="rvPreference"/);
assert.equal((plannerHtml.match(/data-stop="rv" hidden/g)||[]).length,2);
assert.match(plannerHtml, /id="findRvDestination"[^>]*>.*?<\/button><div class="fields">/);
assert.doesNotMatch(plannerHtml, /id="openSavedCampsites"/);
assert.match(plannerHtml, /id="rvOptions"[^>]*><button id="viewSavedCampsites"/);
console.log('PASS: RV campsite picker is available from the destination planner only');
console.log('PASS: RV campsite finder and both Quick Stops entry points require Car mode and RV opt-in');
