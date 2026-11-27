const assert=require('node:assert/strict'),math=require('../web/drive.js');
assert.equal(math.angle(359,1),361);assert.equal(math.angle(1,359),-1);
let n=math.nearest([101.05,3.00001],[[101,3],[101.1,3]]);assert.ok(n.distance<2);assert.ok(Math.abs(n.point[0]-101.05)<.000001);assert.ok(Math.abs(n.point[1]-3)<.000001);assert.ok(Math.abs(n.bearing-90)<.01);
n=math.nearest([101.2,3],[[101,3],[101.1,3]]);assert.equal(n.point[0],101.1);assert.ok(n.distance>10000);
assert.ok(math.distance([101,3],[101,3])===0);console.log('PASS: shortest heading rotation, road projection, segment clamping and stationary distance');
const loop=[[101,3],[101.001,3],[101.002,3],[101.002,3.001],[101,3.001],[101,3]];
const track=math.routeProgress(loop);
assert.equal(track.update([101,3],10),0,'do not skip ahead at a loop');
const passed=track.update([101.0007,3],10);
assert.deepEqual(track.remaining(passed),[[101.0007,3],...loop.slice(1)]);
assert.equal(track.update([101.0006,3],10),passed,'GPS jitter cannot undo progress');
assert.equal(track.update([101.001,3],80),passed,'weak GPS cannot advance progress');
assert.equal(track.update([101.002,3.01],10),passed,'off-route fixes do not advance progress');
const joined=math.routeProgress([[101,3],[101.01,3]]);
assert.deepEqual(joined.remaining(joined.update([101.005,3],10)),[[101.005,3],[101.01,3]],'first GPS fix can join an already-started route');
const detour=math.routeProgress([[101,3],[101.0005,3],[101.0005,3.004],[101.001,3.004],[101.001,3],[101.003,3]]);
detour.update([101,3],10);
const beforeDetour=detour.update([101.0004,3],10);
assert.equal(detour.update([101.001,2.998],10),beforeDetour,'keep progress off-route');
assert.equal(detour.update([101.0015,3],10),beforeDetour,'one distant rejoin fix cannot erase the route');
const rejoined=detour.update([101.0016,3],10);
assert.equal(detour.rejoined,true);
assert.deepEqual(detour.remaining(rejoined),[[101.0016,3],[101.003,3]],'rejoining farther ahead clips all passed sections');
assert.equal(detour.update([101.0015,3],10),rejoined,'backward jitter after rejoining keeps progress');
assert.equal(detour.rejoined,false);
const section=(coordinates,properties={})=>({type:'Feature',properties,geometry:{type:'LineString',coordinates}});
const traffic=track.traffic({features:[section(loop.slice(0,3)),section([[101.0003,3],...loop.slice(1,3)]),section(loop.slice(2,4)),
 section([[101.0004,3],[101.0006,3],[101.0008,3]],{routeSegment:0,routeFraction:.6,centerIndex:1,community:true})]});
const ahead=traffic(passed).features;
assert.deepEqual(ahead.slice(0,2).map(f=>f.geometry.coordinates),[[[101.0007,3],...loop.slice(1,3)],[[101.0007,3],...loop.slice(1,3)]]);
assert.deepEqual(ahead[2].geometry.coordinates,loop.slice(2,4),'traffic wholly ahead is preserved');
assert.equal(ahead[3].properties.community,true);
assert.ok(Math.abs(ahead[3].geometry.coordinates[0][0]-101.0007)<1e-9,'a community band is clipped at the vehicle');
assert.equal(traffic(1000).features.length,0,'passed traffic bands disappear');
const vm=require('node:vm'),fs=require('node:fs');
let now=0,raf=[],layers=[],eases=[],markerPos,markerRotation,markerAlignment,finishPoint,finishClass,finishRemoved=false,finishCount=0,mapOptions,resolution,styleLoaded=true;
const els={};
const el=id=>els[id]??={textContent:'',title:'',disabled:false,classList:{add(){},remove(){}},setAttribute(key,value){this[key]=value},addEventListener(){},clientWidth:390,clientHeight:800};
const events={},sources={},preferences=new Map();
const basemapBuildings={id:'basemap-buildings',type:'fill-extrusion',layout:{}};
const inactiveBuildings={id:'inactive-buildings',type:'fill-extrusion',layout:{visibility:'none'}};
let dragEnabled=true, pitchEnabled=false, projectedSlope=-.25;
class GL{
 constructor(options){
  mapOptions=options;
  this.dragPan={isEnabled:()=>dragEnabled,disable:()=>{dragEnabled=false},enable:()=>{dragEnabled=true}};
  this.touchPitch={isEnabled:()=>pitchEnabled,enable:()=>{pitchEnabled=true}};
 }
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
 easeTo(options){eases.push(options);events.move?.()}
 project([lng,lat]){return {x:(lat-3)+(lng-101)*projectedSlope,y:101-lng}}
 stop(){}
 remove(){}
}
class Marker{
 constructor({element,rotationAlignment}){
  this.finish=element.className==='route-finish-flag'||element.className.includes('saved-destination-pin');
  if(this.finish){finishCount++;finishClass=element.className}
  else markerAlignment=rotationAlignment
 }
 setLngLat(p){if(this.finish)finishPoint=p;else markerPos=p;return this}
 remove(){if(this.finish)finishRemoved=true}
 setRotation(angle){if(!this.finish)markerRotation=angle;return this}
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
assert.equal(els.navigationView.value,'3d','More options defaults to 3D without a saved choice');
assert.equal(els.driveMode.textContent,'3D');
assert.equal(preferences.has('lapan-driving-view'),false,'the default is not stored as an explicit choice');
ctx.LapanDrive.update(fix(101),route);
assert.equal(mapOptions.pitch,52,'the first drive defaults to 3D');
ctx.LapanDrive.stop();
vm.runInContext(source,ctx);
const previousMap=mapOptions;
els.navigationView.value='2d';
els.navigationView.onchange();
assert.equal(mapOptions,previousMap,'choosing a navigation view does not start the map');
assert.equal(preferences.get('lapan-driving-view'),'2d');
vm.runInContext(source,ctx);
assert.equal(els.navigationView.value,'2d','a saved 2D choice takes precedence over the default');
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
assert.equal(sources['lapan-route'].data.features[0].geometry.coordinates[0][0],markerPos[0],'line shrinks in the same animation as the pointer');
raf.at(-1)(2000);
assert.ok(Math.abs(markerPos[0]-101.001)<.000001,'2D vehicle reaches the latest fix');
assert.equal(sources['lapan-route'].data.features[0].geometry.coordinates[0][0],101.001);
assert.equal(ctx.LapanDrive.remaining(route)[0][0],101.001,'Leaflet receives the same matched cutoff');

const restoreGestures=ctx.LapanDrive.suspendGestures();
assert.equal(dragEnabled,false,'active map gestures are cancelled when rotation starts');
restoreGestures();
assert.equal(dragEnabled,true,'map gestures resume once rotation settles');
assert.equal(pitchEnabled,false,'previously disabled gestures stay disabled');
const beforeRotate=eases.length;
els.map.clientWidth=800;
els.map.clientHeight=390;
ctx.LapanDrive.update(fix(101.0015),route);
assert.equal(eases.length,beforeRotate,'skip camera animation while the viewport is changing');
ctx.LapanDrive.resize();
assert.equal(eases.at(-1).center[0],101.0015,'reposition at the latest fix after rotation');
styleLoaded=false;
ctx.LapanDrive.toggle();
assert.equal(eases.at(-1).pitch,52,'toggling updates the camera while route tiles are loading');
styleLoaded=true;
assert.equal(resolution,2);
assert.equal(els.driveMode['aria-pressed'],'true');
assert.equal(els.navigationView.value,'3d','the driving toggle updates More options');
assert.equal(basemapBuildings.layout.visibility,'visible');
assert.equal(inactiveBuildings.layout.visibility,'none','layers already hidden by the style stay hidden');
assert.ok(layers.some(layer=>layer.id==='lapan-buildings'));
assert.equal(preferences.get('lapan-driving-view'),'3d');
assert.equal(markerAlignment,'viewport');
assert.ok(Math.abs(markerRotation-Math.atan(-.25)*180/Math.PI)<.01,'pointer follows the projected route in landscape');
projectedSlope=.5;
events.move();
assert.ok(Math.abs(markerRotation-Math.atan(.5)*180/Math.PI)<.01,'camera movement realigns the pointer without a GPS update');
const turningFix={coords:{...fix(101.0015).coords,heading:60}};
ctx.LapanDrive.update(turningFix,route);
assert.ok(eases.at(-1).bearing<90,'camera still follows the measured heading');
assert.ok(Math.abs(markerRotation-Math.atan(.5)*180/Math.PI)<.01,'snapped pointer follows the route instead of a divergent GPS heading');

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
assert.equal(sources['lapan-congestion'].data.features.length,trafficFeatures.features.length,'traffic updates repaint GL without a new GPS fix');
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
const detourRoute={geometry:{type:'LineString',coordinates:[[101,3],[101.0005,3],[101.0005,3.004],[101.001,3.004],[101.001,3],[101.003,3]]}};
ctx.LapanDrive.update(fix(101),detourRoute);
ctx.LapanDrive.update(fix(101.0015),detourRoute);
ctx.LapanDrive.update(fix(101.0016),detourRoute);
assert.equal(markerPos[0],101.0016,'the pointer snaps to the confirmed rejoin');
assert.equal(sources['lapan-route'].data.features[0].geometry.coordinates[0][0],101.0016,'the line trims immediately at the rejoin');
ctx.LapanDrive.stop();assert.equal(finishRemoved,true,'ending guidance removes the driving flag');assert.equal(ctx.LapanDrive.isReady(),false);console.log('PASS: 3D default, saved 2D and 3D choices, GPS speed, route overlays and cleanup');
els.navigationView.value='3d';
els.navigationView.onchange();
vm.runInContext(source,ctx);
assert.equal(els.navigationView.value,'3d','More options restores the saved driving view');
ctx.LapanDrive.update(fix(101),route);
assert.equal(mapOptions.pitch,52,'a saved 3D choice is used at the next startup');
assert.equal(mapOptions.pixelRatio,2);
