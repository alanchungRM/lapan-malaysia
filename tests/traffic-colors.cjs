const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('../web/traffic-colors.js');
const now=Date.now(),geometry={type:'LineString',coordinates:[[101,3],[101.005,3],[101.01,3]]},section=(severity)=>({severity,geometry}),route={provider:'TomTom',trafficCheckedAt:new Date(now).toISOString(),trafficSections:[section('heavy'),section('moderate'),section('bad')]};
assert.deepEqual(T.features(route,now).features.map(f=>f.properties.color),['#FF8C00','#dc2626']);
for(const r of [{...route,provider:'OSRM'},{...route,trafficCheckedAt:null},{...route,trafficCheckedAt:new Date(now-600000).toISOString()},{...route,trafficSections:[{severity:'heavy',geometry:{type:'LineString',coordinates:[[NaN,3],[101,3]]}}]}])assert.equal(T.features(r,now).features.length,0);
let layers=[],removed=0,listener;const context={window:{LapanTrafficColors:{features:r=>T.features(r,now),subscribe:f=>listener=f}},routes:[route],selected:0,map:{removeLayer(){removed++}},L:{geoJSON(data,opts){layers.push({data,opts});return {addTo(){return this}}}}};vm.createContext(context);const app=fs.readFileSync('web/app.js','utf8');vm.runInContext(app.slice(app.indexOf('let congestionLayer='),app.indexOf('const status=')),context);context.drawCongestion();assert.equal(layers[0].data.features.length,2);assert.equal(layers[0].opts.style(layers[0].data.features[1]).color,'#dc2626');listener({...route});assert.equal(layers.length,1,'late old-route events ignored');route.trafficSections=[];listener(route);assert.equal(removed,1,'clear old overlays when traffic is cleared');assert.equal(layers.length,1);
console.log('PASS: segment colours and severity ordering, missing/stale/OSRM exclusion, Leaflet rendering and old-route/overlay cleanup');

const {placeOnRoute}=require('../web/reports.js');
const basic={provider:'Valhalla',geometry};
const reports=[
 {kind:'traffic-standstill',lon:101.005,lat:3},
 {kind:'traffic-heavy',lon:101.005,lat:3},
 {kind:'traffic-heavy',lon:101.005,lat:3.002},
 {kind:'crash',lon:101.006,lat:3}
];
T.setCommunity(basic,placeOnRoute(reports,basic));
const colored=T.features(basic,now).features;
assert.deepEqual(colored.map(f=>f.properties),[
 {color:'#ff8c00',severity:'traffic-heavy',community:true},
 {color:'#be123c',severity:'traffic-standstill',community:true}
],'community traffic works with basic routing, rejects nearby off-route and other reports, and paints standstill last');
const path=colored[0].geometry.coordinates;
assert.ok(path[0][0]>101.004&&path[0][0]<101.005);
assert.ok(path.at(-1)[0]>101.005&&path.at(-1)[0]<101.006);
assert.ok(path.every(point=>point[1]===3),'the painted line follows route geometry rather than extending the reported point');
T.setCommunity(basic,[]);
assert.equal(T.features(basic,now).features.length,0,'cleared community traffic is removed');
