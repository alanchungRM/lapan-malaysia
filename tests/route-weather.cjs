const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const date='2026-11-21';
let now=Date.parse(date+'T12:00:00+08:00');
let data={
 date,
 forecasts:[
  {location:{location_id:'Ds001',location_name:'Wet District'},summary_forecast:'Hujan di beberapa tempat'},
  {location:{location_id:'Ds002',location_name:'Storm District'},summary_forecast:'Ribut petir'},
  {location:{location_id:'Ds003',location_name:'Dry District'},summary_forecast:'Tiada hujan'},
  {location:{location_id:'Ds004',location_name:'Off Route'},summary_forecast:'Hujan'}
 ],
 warnings:[{
  warning_issue:{title_en:'Thunderstorm Warning',title_bm:'Amaran Ribut Petir',issued:date+'T10:00:00+08:00'},
  valid_from:date+'T10:00:00+08:00',valid_to:date+'T13:00:00+08:00',
  text_bm:'Ribut petir di Selangor (Storm District) sehingga 1 petang.'
 }]
};
function district(w,e,s=2.9,n=3.1){return [[[[w,s],[e,s],[e,n],[w,n],[w,s]]]]}
const areas={ADM2:{areas:{
 'Wet District':district(101.1,101.2),'Storm District':district(101.2,101.3),
 'Dry District':district(101.3,101.4),'Off Route':district(101.1,101.2,4,5)
}}};
const dom=()=>({children:[],isConnected:true,append(child){child.parentElement=this;this.children.push(child)},
 replaceChildren(){this.children=[]},addEventListener(){},setAttribute(){},remove(){this.isConnected=false}});
const map={panes:new Map(),getPane(name){return this.panes.get(name)},
 createPane(name){const pane={style:{}};this.panes.set(name,pane);return pane},
 removeLayer(group){group.removed=true}};
const groups=[],requests=[];
let refresh,languageChanged;
const L={
 layerGroup(){return {geo:null,pins:[],addTo(){groups.push(this);return this}}},
 geoJSON(geo,options){return {addTo(group){group.geo={geo,options};return this}}},
 marker(point,options){return {addTo(group){group.pins.push({point,options});return this}}},
 divIcon:options=>options
};
const context={
 window:{},L,document:{documentElement:{lang:'en'},createElement:dom,createElementNS:dom},
 fetch:async path=>{requests.push(path);return {ok:true,json:async()=>path.includes('areas')?areas:data}},
 AbortSignal,Date:class extends Date{static now(){return now}},
 MutationObserver:class{constructor(fn){languageChanged=fn}observe(){}},
 setInterval:fn=>{refresh=fn;return 1},clearInterval:()=>{refresh=null}
};
const code=fs.readFileSync('web/route-weather.js','utf8');
vm.runInNewContext(code,context);
const app=context.window.LapanRouteWeather;
const tick=()=>new Promise(setImmediate);
const route={geometry:{type:'LineString',coordinates:[[101.05,3],[101.45,3]]}};
const markerStyles=()=>groups.at(-1).geo.geo.features.map(feature=>({
 ...feature.properties,fill:groups.at(-1).geo.options.style(feature).fillColor
}));
(async()=>{
 const card=dom();
 app.show(card,route,['Wet District',3,101.15],map);
 await tick();
 assert.deepEqual(requests,['/api/route-weather','/weather-areas.json']);
 assert.equal(groups.at(-1).geo.options.pane,'route-weather');
 assert.equal(map.getPane('route-weather').style.zIndex,'350','weather sits below Leaflet routes');
 assert.deepEqual(JSON.parse(JSON.stringify(markerStyles())),[
  {kind:'rain',warning:false,fill:'url(#lapan-weather-rain)'},
  {kind:'storm',warning:true,fill:'url(#lapan-weather-storm)'}
 ]);
 assert.equal(groups.at(-1).pins.length,1,'one static thunderstorm icon');
 assert.match(card.children[0].children[0].children[0].textContent,/Thunderstorm Warning/);
 context.document.documentElement.lang='ms';
 languageChanged();
 assert.match(card.children[0].children[0].children[0].textContent,/Amaran Ribut Petir/);
 now=Date.parse(date+'T13:00:00+08:00');
 refresh();await tick();
 assert.equal(markerStyles()[1].warning,false,'expired warning loses its outline while the daily forecast remains');
 assert.equal(groups.at(-2).removed,true);
 data={...data,date:'2026-11-20',warnings:[]};
 now+=121000;
 refresh();await tick();
 assert.equal(groups.at(-1).removed,true,'a stale daily forecast removes all effects');
 app.show(dom(),route,['Wet District',3,101.15],map);
 app.clear();
 await tick();
 assert.equal(refresh,null,'cleared routes stop weather refresh');
 assert.ok(groups.every(group=>group.removed),'cleared routes cannot leave any weather layers');
 console.log('PASS: route-local rain, thunderstorm priority, 2D weather pane, Malay labels, expiry and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1});
