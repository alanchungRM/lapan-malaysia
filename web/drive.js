(function(root){
const math={
 angle:(a,b)=>a+((b-a+540)%360-180),
 bearing:(a,b)=>Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI,
 distance:(a,b)=>Math.hypot((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*111320,
 nearest(pos,coords){let best={distance:Infinity,point:pos,bearing:0};for(let i=0;i<coords.length-1;i++){const a=coords[i],b=coords[i+1],cos=Math.cos(pos[1]*Math.PI/180),ax=(a[0]-pos[0])*cos,ay=a[1]-pos[1],dx=(b[0]-a[0])*cos,dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],distance=math.distance(pos,point);if(distance<best.distance)best={distance,point,bearing:math.bearing(a,b)}}return best}
};
if(typeof module==='object')module.exports=math;
const sunset=()=>root.document?.documentElement?.dataset.skin==='sunset';
if(!root.document)return;
const driveViewKey='lapan-driving-view';
let tilt=false;
try{tilt=root.localStorage.getItem(driveViewKey)==='3d'}catch{}
let gl=null,ready=false,active=false,following=true,marker=null,finishFlag=null,frame=null,rendered=null,heading=0,lastTime=0,pending=null,routeRef=null,loadTimer=null,vehicleElement=null;
const $=id=>document.getElementById(id),motion=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hiddenExtrusions=new Set();
function pixelRatio(){
 const native=root.devicePixelRatio||1;
 return tilt?native:Math.min(native,1.5);
}
const navigationView=$('navigationView');
function updateModeControls(){
 navigationView.value=tilt?'3d':'2d';
 const button=$('driveMode');
 button.textContent=tilt?'3D':'2D';
 button.setAttribute('aria-pressed',String(tilt));
}
function syncBuildings(){
 const style=gl.getStyle();
 if(!style)return;
 for(const layer of style.layers){
  if(layer.type!=='fill-extrusion'||layer.id==='lapan-buildings')continue;
  if(!tilt&&layer.layout?.visibility!=='none'){
   hiddenExtrusions.add(layer.id);
   gl.setLayoutProperty(layer.id,'visibility','none');
  }else if(tilt&&hiddenExtrusions.delete(layer.id)&&layer.layout?.visibility==='none'){
   gl.setLayoutProperty(layer.id,'visibility','visible');
  }
 }
 const buildings=gl.getLayer('lapan-buildings');
 if(!tilt){
  if(buildings)gl.removeLayer('lapan-buildings');
  return;
 }
 if(buildings)return;
 const source=Object.keys(style.sources).find(key=>style.sources[key].type==='vector');
 if(!source)return;
 const before=style.layers.find(layer=>layer.type==='symbol')?.id;
 gl.addLayer({
  id:'lapan-buildings',type:'fill-extrusion',source,'source-layer':'building',minzoom:15,
  paint:{
   'fill-extrusion-color':sunset()?'#684b74':'#d4dce1',
   'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],5],
   'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
   'fill-extrusion-opacity':0.7
  }
 },before);
}
function progress(text){const el=$('navigationProgress');if(el){el.hidden=!text;if(text)el.textContent=text}}
function collapseCredits(){document.querySelector?.('#driveMap .maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')}
function fallback(reason){progress(null);clearTimeout(loadTimer);ready=false;document.body.classList.remove('drive-ready');$('driveMode').textContent='2D';$('driveMode').setAttribute('aria-pressed','false');$('driveMode').disabled=true;$('driveMode').title=typeof reason==='string'?reason:'3D map unavailable on this device; using the 2D map';finishFlag?.remove();finishFlag=null;if(gl){gl.remove();gl=null}hiddenExtrusions.clear();cancelAnimationFrame(frame);frame=null}
function init(pos){if(gl)return;if(!root.maplibregl){fallback("3D renderer did not load; using the 2D map");return}try{gl=new maplibregl.Map({container:'driveMap',trackResize:false,style:root.LapanMapAppearance?.url()||'https://tiles.openfreemap.org/styles/liberty',center:pos,zoom:tilt?17.3:16.5,pitch:tilt?52:0,pixelRatio:pixelRatio(),bearing:heading,maxPitch:60,attributionControl:{compact:true},canvasContextAttributes:{antialias:false},fadeDuration:150});root.LapanMapAppearance?.bind(gl);loadTimer=setTimeout(()=>{if(!ready)fallback()},18000);gl.on('load',()=>{root.requestAnimationFrame?.(collapseCredits);clearTimeout(loadTimer);ready=true;root.LapanSignals?.attachGL(gl);syncBuildings();const el=document.createElement('div');el.className='vehicle-arrow';vehicleElement=el;el.setAttribute('aria-label','Your vehicle');el.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 33 34 20 27 7 34Z" fill="#1783ee" stroke="white" stroke-width="3" stroke-linejoin="round"/></svg>';if(root.LapanVehiclePointer)root.LapanVehiclePointer.paint(el);marker=new maplibregl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'viewport'}).setLngLat(pos).addTo(gl);if(active){document.body.classList.add('drive-ready');gl.resize();if(pending)draw(pending.p,pending.route,true)}});gl.on('styledata',()=>{if(ready)syncBuildings()});gl.on('render',()=>{
 if(!active||!ready)return;
 if(pending&&routeRef!==pending.route&&gl.isStyleLoaded?.())draw(pending.p,pending.route,true);
 if(routeRef===pending?.route&&gl.getLayer('lapan-route-line')&&gl.isSourceLoaded?.('lapan-route'))progress(null);
});gl.on('dragstart',()=>{following=false;$('locate').textContent='⌖';$('locate').title='Resume following your vehicle'});gl.on('error',e=>{if(!ready&&e.error?.message?.includes('WebGL'))fallback()});gl.getCanvas().addEventListener('webglcontextlost',fallback,{once:true})}catch(e){fallback("3D is unavailable in this browser; using the 2D map")}}
let finishKind=null;
function drawFinishFlag(point){
 const saved=root.LapanSaved,kind=saved?.routeKind?.()||null;
 if(!finishFlag||finishKind!==kind){
  finishFlag?.remove();
  finishKind=kind;
  const icon=saved?.routeIcon?.(kind);
  const element=document.createElement('div');
  element.className=icon?.className||'route-finish-flag';
  if(icon)element.append(icon.html);
  element.setAttribute('role','img');
  const label=icon?.label||'Destination';
  element.setAttribute('aria-label',root.LapanI18n?.t?.(label)||label);
  finishFlag=new maplibregl.Marker({element,anchor:'bottom',offset:icon?[0,0]:[11,0],rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat(point).addTo(gl);
  return;
 }
 finishFlag.setLngLat(point);
}
function drawCongestion(route){
 if(!gl||!ready)return;
 const data=root.LapanTrafficColors?.features(route)||{type:'FeatureCollection',features:[]};
 if(gl.getSource('lapan-congestion'))gl.getSource('lapan-congestion').setData(data);
 else{
  gl.addSource('lapan-congestion',{type:'geojson',data});
  gl.addLayer({id:'lapan-congestion-line',type:'line',source:'lapan-congestion',filter:['!', ['has','community']],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':['get','color'],'line-width':7}});
  gl.addLayer({id:'lapan-community-traffic-line',type:'line',source:'lapan-congestion',filter:['has','community'],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':['get','color'],'line-width':7,'line-dasharray':[1.5,.75]}});
 }
}
root.LapanTrafficColors?.subscribe(route=>{if(active&&route===routeRef)drawCongestion(route)});
function draw(p,route,first=false){if(!ready||!active)return;const raw=[p.coords.longitude,p.coords.latitude],near=math.nearest(raw,route.geometry.coordinates),target=near.distance<35&&(p.coords.accuracy||0)<60?near.point:raw,speed=p.coords.speed;const previous=rendered||target,moved=math.distance(previous,target);let nextHeading=Number.isFinite(p.coords.heading)&&Number.isFinite(speed)&&speed>2?p.coords.heading:moved>4?math.bearing(previous,target):heading||near.bearing;nextHeading=math.angle(heading,nextHeading);if(moved<3&&(!Number.isFinite(speed)||speed<1))target.splice(0,2,...previous);const now=performance.now(),ms=motion()||first||!rendered?0:Math.min(1400,Math.max(600,now-lastTime));lastTime=now;const fromHeading=heading;heading=first?nextHeading:fromHeading+(nextHeading-fromHeading)*0.65;
if(routeRef!==route&&(!gl.isStyleLoaded||gl.isStyleLoaded())){routeRef=route;drawFinishFlag(route.geometry.coordinates.at(-1));const geo={type:'Feature',properties:{},geometry:route.geometry};if(gl.getSource('lapan-route'))gl.getSource('lapan-route').setData(geo);else{gl.addSource('lapan-route',{type:'geojson',data:geo});gl.addLayer({id:'lapan-route-halo',type:'line',source:'lapan-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':sunset()?'#ffe2d6':'#fff','line-width':12,'line-opacity':0.9}});gl.addLayer({id:'lapan-route-line',type:'line',source:'lapan-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':sunset()?'#ff6c9b':'#16bc68','line-width':7}})}drawCongestion(route)}
cancelAnimationFrame(frame);const start=performance.now();function tick(time){if(!active||!marker)return;const t=ms?Math.min(1,(time-start)/ms):1,e=t*t*(3-2*t);rendered=[previous[0]+(target[0]-previous[0])*e,previous[1]+(target[1]-previous[1])*e];marker.setLngLat(rendered).setRotation(fromHeading+(heading-fromHeading)*e);if(t<1)frame=requestAnimationFrame(tick);else frame=null}tick(start);if(following){const opts={center:target,zoom:tilt?17.3:16.5,pitch:tilt?52:0,bearing:heading,offset:[0,tilt?Math.min(130,gl.getContainer().clientHeight*.16):Math.min(90,gl.getContainer().clientHeight*.12)],duration:ms,easing:t=>t*t*(3-2*t)};gl.easeTo(opts)}$('driveSpeed').textContent=Number.isFinite(speed)&&speed>=0?String(Math.round(speed*3.6)):'—';$('driveMode').disabled=false}
root.LapanDrive={update(p,route){if(!route?.geometry?.coordinates?.length)return;if(!active||routeRef!==route)progress('Drawing route…');active=true;pending={p,route};const raw=[p.coords.longitude,p.coords.latitude];if(!gl)init(raw);if(ready){document.body.classList.add('drive-ready');draw(p,route,!rendered)}},stop(){progress(null);active=false;pending=null;rendered=null;routeRef=null;finishFlag?.remove();finishFlag=null;lastTime=0;heading=0;following=true;cancelAnimationFrame(frame);gl?.stop();document.body.classList.remove('drive-ready');$('driveSpeed').textContent='—'},reportMap(){return active&&ready?gl:null},isReady(){return active&&ready},resize(){if(ready&&active){gl.stop();gl.resize();if(following&&pending)draw(pending.p,pending.route,true);root.requestAnimationFrame?.(collapseCredits)}},recenter(){following=true;if(pending&&ready)draw(pending.p,pending.route,true)},toggle(){setTilt(!tilt)}};
function setTilt(value){
 if(tilt===value)return;
 tilt=value;
 following=true;
 try{root.localStorage.setItem(driveViewKey,tilt?'3d':'2d')}catch{}
 updateModeControls();
 if(gl)gl.setPixelRatio(pixelRatio());
 if(ready){
  syncBuildings();
  if(pending)draw(pending.p,pending.route,true);
 }
}
root.LapanVehiclePointer?.subscribe(()=>{if(vehicleElement)root.LapanVehiclePointer.paint(vehicleElement)});
updateModeControls();
navigationView.onchange=()=>setTilt(navigationView.value==='3d');
$('driveMode').onclick=()=>root.LapanDrive.toggle();
})(typeof window==='object'?window:globalThis);
