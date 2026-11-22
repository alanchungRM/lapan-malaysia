const assert=require('node:assert/strict'),math=require('../web/drive.js');
assert.equal(math.angle(359,1),361);assert.equal(math.angle(1,359),-1);
let n=math.nearest([101.05,3.00001],[[101,3],[101.1,3]]);assert.ok(n.distance<2);assert.ok(Math.abs(n.point[0]-101.05)<.000001);assert.ok(Math.abs(n.point[1]-3)<.000001);assert.ok(Math.abs(n.bearing-90)<.01);
n=math.nearest([101.2,3],[[101,3],[101.1,3]]);assert.equal(n.point[0],101.1);assert.ok(n.distance>10000);
assert.ok(math.distance([101,3],[101,3])===0);console.log('PASS: shortest heading rotation, road projection, segment clamping and stationary distance');
const vm=require('node:vm'),fs=require('node:fs');
let now=0,raf=[],layers=[],eases=[],markerPos,finishPoint,finishClass,finishRemoved=false,finishCount=0,mapOptions,resolution,styleLoaded=true;
const els={};
const el=id=>els[id]??={textContent:'',title:'',disabled:false,classList:{add(){},remove(){}},setAttribute(key,value){this[key]=value},addEventListener(){},clientHeight:800};
const events={},sources={},preferences=new Map();
const basemapBuildings={id:'basemap-buildings',type:'fill-extrusion',layout:{}};
const inactiveBuildings={id:'inactive-buildings',type:'fill-extrusion',layout:{visibility:'none'}};
class GL{
 constructor(options){mapOptions=options}
 on(name,fn){events[name]=fn}
 getStyle(){return {sources:{osm:{type:'vector'}},layers:[basemapBuildings,inactiveBuildings,...layers]}}
 getLayer(id){return layers.find(layer=>layer.id===id)}
 addLayer(layer){layers.push(layer)}
 removeLayer(id){layers=layers.filter(layer=>layer.id!==id)}
 setLayoutProperty(id,key,value){this.getStyle().layers.find(layer=>layer.id===id).layout[key]=value}
 setPixelRatio(value){resolution=value}
 isStyleLoaded(){return styleLoaded}
 resize(){}
 getCanvas(){return el('canvas')}
 getContainer(){return el('map')}
 getSource(id){return sources[id]}
 addSource(id){sources[id]={setData(data){this.data=data}}}
 easeTo(options){eases.push(options)}
 stop(){}
 remove(){}
}
class Marker{
 constructor({element}){
  this.finish=element.className==='route-finish-flag'||element.className.includes('saved-destination-pin');
  if(this.finish){finishCount++;finishClass=element.className}
 }
 setLngLat(p){if(this.finish)finishPoint=p;else markerPos=p;return this}
 remove(){if(this.finish)finishRemoved=true}
 setRotation(){return this}
 addTo(){return this}
}
let trafficListener;
const trafficFeatures={type:'FeatureCollection',features:[]};
const ctx={
 LapanTrafficColors:{features:()=>trafficFeatures,subscribe:fn=>trafficListener=fn},
 document:{getElementById:el,createElement:()=>({setAttribute(){},append(){}}),body:{classList:{add(){},remove(){}}}},
 maplibregl:{Map:GL,Marker},localStorage:{getItem:key=>preferences.get(key),setItem:(key,value)=>preferences.set(key,value)},
 devicePixelRatio:3,addEventListener(){},matchMedia:()=>({matches:false}),performance:{now:()=>now},
 requestAnimationFrame(fn){raf.push(fn);return raf.length},cancelAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},Math,Number
};
ctx.window=ctx;
vm.createContext(ctx);
const source=fs.readFileSync('web/drive.js','utf8');
vm.runInContext(source,ctx);
const route={geometry:{type:'LineString',coordinates:[[101,3],[101.1,3]]}};
const fix=longitude=>({coords:{longitude,latitude:3,accuracy:10,heading:90,speed:10}});
assert.equal(els.navigationView.value,'2d');
els.navigationView.value='3d';
els.navigationView.onchange();
assert.equal(els.driveMode.textContent,'3D');
assert.equal(preferences.get('lapan-driving-view'),'3d');
assert.equal(mapOptions,undefined,'choosing a navigation view does not start the map');
els.navigationView.value='2d';
els.navigationView.onchange();
ctx.LapanDrive.update(fix(101),route);
assert.equal(mapOptions.pitch,0);
assert.equal(mapOptions.pixelRatio,1.5);
events.load();
assert.equal(ctx.LapanDrive.isReady(),true);
assert.ok(layers.some(layer=>layer.id==='lapan-route-line'));
assert.equal(basemapBuildings.layout.visibility,'none');
assert.ok(!layers.some(layer=>layer.id==='lapan-buildings'));
assert.equal(els.driveMode['aria-pressed'],'false');
assert.ok(Math.abs(eases.at(-1).bearing-90)<1,'2D follows vehicle heading');
assert.ok(eases.at(-1).offset[1]>0,'vehicle stays below centre for road ahead');
assert.equal(els.driveSpeed.textContent,'36');
basemapBuildings.layout={};
events.styledata();
assert.equal(basemapBuildings.layout.visibility,'none','a refreshed style is also kept flat');
assert.equal(eases.at(-1).duration,0,'the first fix positions the camera immediately');
now=1000;
ctx.LapanDrive.update(fix(101.001),route);
assert.equal(eases.at(-1).pitch,0);
assert.equal(eases.at(-1).duration,1000,'2D camera eases between GPS fixes');
raf.at(-1)(1500);
assert.ok(markerPos[0]>101&&markerPos[0]<101.001,'2D vehicle moves between GPS fixes');
raf.at(-1)(2000);
assert.ok(Math.abs(markerPos[0]-101.001)<.000001,'2D vehicle reaches the latest fix');
styleLoaded=false;
ctx.LapanDrive.toggle();
assert.equal(eases.at(-1).pitch,52,'toggling updates the camera while route tiles are loading');
styleLoaded=true;
assert.equal(resolution,3);
assert.equal(els.driveMode['aria-pressed'],'true');
assert.equal(els.navigationView.value,'3d','the driving toggle updates More options');
assert.equal(basemapBuildings.layout.visibility,'visible');
assert.equal(inactiveBuildings.layout.visibility,'none','layers already hidden by the style stay hidden');
assert.ok(layers.some(layer=>layer.id==='lapan-buildings'));
assert.equal(preferences.get('lapan-driving-view'),'3d');
now=2000;
ctx.LapanDrive.update(fix(101.002),route);
assert.equal(eases.at(-1).duration,1000);
raf.at(-1)(2500);
assert.ok(markerPos[0]>101.001&&markerPos[0]<101.002);
ctx.LapanDrive.toggle();
assert.equal(eases.at(-1).pitch,0);
assert.equal(resolution,1.5);
assert.ok(!layers.some(layer=>layer.id==='lapan-buildings'));
trafficListener(route);
assert.equal(sources['lapan-congestion'].data,trafficFeatures,'traffic updates repaint GL without a new GPS fix');
assert.deepEqual(finishPoint,[101.1,3],'the finish flag sits at the last route point');
const rerouted={geometry:{type:'LineString',coordinates:[[101,3],[101.2,3.01]]}};
ctx.LapanDrive.update({coords:{longitude:101.001,latitude:3,accuracy:10,heading:90,speed:10}},rerouted);
assert.deepEqual(finishPoint,[101.2,3.01],'rerouting moves the finish flag');
assert.equal(finishCount,1,'GPS updates and rerouting reuse one flag');
ctx.LapanSaved={routeKind:()=> 'home',routeIcon:kind=>({className:'saved-destination-pin saved-map-pin-'+kind,label:'Home',html:{}})};
ctx.LapanDrive.update({coords:{longitude:101,latitude:3,accuracy:10}},route);
assert.match(finishClass,/saved-map-pin-home/,'Home keeps its icon in the driving view');
ctx.LapanSaved.routeKind=()=> 'work';
ctx.LapanDrive.update({coords:{longitude:101,latitude:3,accuracy:10}},rerouted);
assert.match(finishClass,/saved-map-pin-work/,'Work keeps its icon in the driving view');
ctx.LapanDrive.stop();assert.equal(finishRemoved,true,'ending guidance removes the driving flag');assert.equal(ctx.LapanDrive.isReady(),false);console.log('PASS: lighter 2D startup, 3D toggle, GPS speed, route overlays and cleanup');
els.navigationView.value='3d';
els.navigationView.onchange();
vm.runInContext(source,ctx);
assert.equal(els.navigationView.value,'3d','More options restores the saved driving view');
ctx.LapanDrive.update(fix(101),route);
assert.equal(mapOptions.pitch,52,'a saved 3D choice is used at the next startup');
assert.equal(mapOptions.pixelRatio,3);
