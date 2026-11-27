(function(root){
const math={
 angle:(a,b)=>a+((b-a+540)%360-180),
 bearing:(a,b)=>Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI,
 distance:(a,b)=>Math.hypot((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*111320,
 nearest(pos,coords,start=0,end=coords.length-1){let best={distance:Infinity,point:pos,bearing:0};for(let i=start;i<end;i++){const a=coords[i],b=coords[i+1],cos=Math.cos(pos[1]*Math.PI/180),ax=(a[0]-pos[0])*cos,ay=a[1]-pos[1],dx=(b[0]-a[0])*cos,dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],distance=math.distance(pos,point);if(distance<best.distance)best={distance,point,bearing:math.bearing(a,b),index:i,fraction:t}}return best}
};
function distances(coords){
 const offsets=[0];
 for(let i=1;i<coords.length;i++)offsets.push(offsets[i-1]+math.distance(coords[i-1],coords[i]));
 return offsets;
}
function splitAt(coords,offsets,distance){
 let low=0,high=coords.length-1;
 while(low+1<high){
  const mid=(low+high)>>1;
  if(offsets[mid]<=distance)low=mid;
  else high=mid;
 }
 const a=coords[low],b=coords[high],span=offsets[high]-offsets[low];
 const t=span?Math.min(1,(distance-offsets[low])/span):0;
 return {next:high,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]};
}
function remaining(coords,offsets,distance){
 if(distance<=0)return coords;
 if(distance>=offsets.at(-1))return [];
 const split=splitAt(coords,offsets,distance);
 return [split.point,...coords.slice(split.next)];
}
math.routeProgress=function(coords){
 const offsets=distances(coords);
 let index=0,covered=0,lastFix=null,rejoinFix=null,cachedDistance=0,cachedPath=coords;
 return {
  // Limit matching to the current portion of the route at loops and junctions.
  rejoined:false,
  update(pos,accuracy){
   this.rejoined=false;
   if(accuracy>=60||coords.length<2){rejoinFix=null;return covered}
   let start=index,end=index;
   const reach=lastFix?Math.max(75,math.distance(lastFix,pos)*2+35):150;
   while(start>0&&offsets[start]>covered-35)start--;
   while(end<coords.length-1&&offsets[end]<=covered+reach)end++;
   const along=match=>offsets[match.index]+match.fraction*(offsets[match.index+1]-offsets[match.index]);
   let match=math.nearest(pos,coords,start,end);
   // A route may start before the first usable GPS fix.
   if(!lastFix&&(match.distance>=35||along(match)>reach))match=math.nearest(pos,coords);
   let candidate=along(match);
   if(lastFix&&(match.distance>=20||candidate>covered+reach)){
    // A detour may rejoin beyond the local window. Require two consistent fixes
    // before skipping the old route, so a nearby parallel road cannot erase it.
    const forward=math.nearest(pos,coords,index);
    const ahead=along(forward);
    if(forward.distance<20&&ahead>covered+reach&&(candidate>covered+reach||forward.distance+8<match.distance)){
     const previous=rejoinFix;
     rejoinFix={pos,distance:ahead};
     if(!previous||ahead<previous.distance-5||ahead-previous.distance>Math.max(60,math.distance(previous.pos,pos)*2+25))return covered;
     match=forward;candidate=ahead;this.rejoined=true;
    }
   }
   rejoinFix=null;
   if(match.distance>=35||lastFix&&candidate>covered+reach&&!this.rejoined)return covered;
   lastFix=pos;
   if(candidate>covered){index=match.index;covered=candidate}
   return covered;
  },
  position(distance){return coords.length<2?coords[0]:splitAt(coords,offsets,distance).point},
  remaining(distance){
   if(distance!==cachedDistance){cachedDistance=distance;cachedPath=remaining(coords,offsets,distance)}
   return cachedPath;
  },
  traffic(data){
   const indices=new Map();
   coords.forEach((point,i)=>{const key=point.join(',');if(!indices.has(key))indices.set(key,[]);indices.get(key).push(i)});
   const sections=data.features.map(feature=>{
    const points=feature.geometry.coordinates;
    const measures=distances(points);
    const {routeSegment,routeFraction,centerIndex}=feature.properties;
    let start;
    if(Number.isInteger(routeSegment)&&coords[routeSegment+1]){
     start=offsets[routeSegment]+routeFraction*(offsets[routeSegment+1]-offsets[routeSegment])-measures[centerIndex];
    }else{
     const candidates=indices.get(points[0].join(','))||[];
     const first=candidates.find(i=>points.every((p,j)=>p[0]===coords[i+j]?.[0]&&p[1]===coords[i+j]?.[1]));
     if(first!==undefined)start=offsets[first];
     else {
      // ETA refreshes can start partway through a route segment.
      const second=(indices.get(points[1]?.join(','))||[]).find(i=>i>0&&
       points.slice(1).every((p,j)=>p[0]===coords[i+j]?.[0]&&p[1]===coords[i+j]?.[1])&&
       math.nearest(points[0],coords,i-1,i).distance<2);
      if(second!==undefined)start=offsets[second]-measures[1];
     }
    }
    return {feature,start,measures};
   });
   return distance=>({type:'FeatureCollection',features:sections.flatMap(({feature,start,measures})=>{
    if(distance<=0||distance<=start)return [feature];
    if(start===undefined)return [];
    const coordinates=remaining(feature.geometry.coordinates,measures,distance-start);
    return coordinates.length<2?[]:[{...feature,geometry:{type:'LineString',coordinates}}];
   })});
  }
 };
};
if(typeof module==='object')module.exports=math;
const sunset=()=>root.document?.documentElement?.dataset.skin==='sunset';
if(!root.document)return;
const driveViewKey='lapan-driving-view';
let tilt=true;
try{tilt=root.localStorage.getItem(driveViewKey)!=='2d'}catch{}
let gl=null,ready=false,active=false,following=true,marker=null,finishFlag=null,frame=null,rendered=null,pointerBearing=0,heading=0,lastTime=0,pending=null,routeRef=null,loadTimer=null,vehicleElement=null,rendererFailed=false,driveWidth=0,driveHeight=0;
let progressGeometry=null,routeProgress=null,matchedDistance=0,drawnDistance=0,vehicleDistance=0,lastPaint=-Infinity;
let trafficData=null,trimTraffic=null,resetAnimation=false;
function trafficAhead(route,distance,refresh=false){
 if(refresh||!trimTraffic){
  trafficData=root.LapanTrafficColors?.features(route)||{type:'FeatureCollection',features:[]};
  trimTraffic=routeProgress?.traffic(trafficData);
 }
 return trimTraffic?trimTraffic(distance):trafficData;
}
function routeAhead(distance){
 const coordinates=routeProgress.remaining(distance);
 return {type:'FeatureCollection',features:coordinates.length<2?[]:[{
  type:'Feature',properties:{},geometry:{type:'LineString',coordinates}
 }]};
}
function paintAhead(route,distance,time,force=false){
 const source=gl.getSource('lapan-route');
 if(routeRef!==route||!source||distance===drawnDistance||(!force&&time-lastPaint<65))return;
 source.setData(routeAhead(distance));
 gl.getSource('lapan-congestion')?.setData(trafficAhead(route,distance));
 drawnDistance=distance;
 lastPaint=time;
}
const $=id=>document.getElementById(id),motion=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hiddenExtrusions=new Set();
function pixelRatio(){
 const native=root.devicePixelRatio||1;
 return Math.min(native,tilt?2:1.5);
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
function fallback(reason){rendererFailed=true;routeRef=null;progress(null);clearTimeout(loadTimer);ready=false;document.body.classList.remove('drive-ready');$('driveMode').textContent='2D';$('driveMode').setAttribute('aria-pressed','false');$('driveMode').disabled=true;$('driveMode').title=typeof reason==='string'?reason:'3D map unavailable on this device; using the 2D map';finishFlag?.remove();finishFlag=null;if(gl){const failed=gl;gl=null;driveWidth=driveHeight=0;try{failed.remove()}catch{}}hiddenExtrusions.clear();cancelAnimationFrame(frame);frame=null}
function init(pos){if(gl)return;if(!root.maplibregl){fallback("3D renderer did not load; using the 2D map");return}try{gl=new maplibregl.Map({container:'driveMap',trackResize:false,style:root.LapanMapAppearance?.url()||'https://tiles.openfreemap.org/styles/liberty',center:pos,zoom:tilt?17.3:16.5,pitch:tilt?52:0,pixelRatio:pixelRatio(),bearing:heading,maxPitch:60,attributionControl:{compact:true},canvasContextAttributes:{antialias:false},fadeDuration:150});root.LapanMapAppearance?.bind(gl);loadTimer=setTimeout(()=>{if(!ready)fallback()},18000);gl.on('load',()=>{root.requestAnimationFrame?.(collapseCredits);clearTimeout(loadTimer);ready=true;root.LapanSignals?.attachGL(gl);syncBuildings();const el=document.createElement('div');el.className='vehicle-arrow';vehicleElement=el;el.setAttribute('aria-label','Your vehicle');el.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 33 34 20 27 7 34Z" fill="#1783ee" stroke="white" stroke-width="3" stroke-linejoin="round"/></svg>';if(root.LapanVehiclePointer)root.LapanVehiclePointer.paint(el);marker=new maplibregl.Marker({element:el,rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat(pos).addTo(gl);if(active){document.body.classList.add('drive-ready');resizeDrive();if(pending)draw(pending.p,pending.route,true)}});gl.on('styledata',()=>{if(ready)syncBuildings()});gl.on('move',updatePointerRotation);gl.on('render',()=>{
 if(!active||!ready)return;
 if(pending&&(routeRef!==pending.route||!gl.getSource('lapan-route'))&&gl.isStyleLoaded?.())draw(pending.p,pending.route,true);
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
 const data=trafficAhead(route,drawnDistance,true);
 if(gl.getSource('lapan-congestion'))gl.getSource('lapan-congestion').setData(data);
 else{
  gl.addSource('lapan-congestion',{type:'geojson',data});
  gl.addLayer({id:'lapan-congestion-line',type:'line',source:'lapan-congestion',filter:['!', ['has','community']],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':['get','color'],'line-width':7}});
  gl.addLayer({id:'lapan-community-traffic-line',type:'line',source:'lapan-congestion',filter:['has','community'],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':['get','color'],'line-width':7,'line-dasharray':[1.5,.75]}});
 }
}
root.LapanTrafficColors?.subscribe(route=>{if(active&&route===routeRef)drawCongestion(route)});
function resizeDrive(){
 const box=gl.getContainer();
 if(!box.clientWidth||!box.clientHeight)return false;
 if(driveWidth!==box.clientWidth||driveHeight!==box.clientHeight){
  gl.stop();
  gl.resize();
  driveWidth=box.clientWidth;
  driveHeight=box.clientHeight;
 }
 return true;
}
function updatePointerRotation(){
 if(!active||!ready||!marker||!rendered)return;
 // Project a short segment beside the vehicle to account for camera pitch and offset.
 const radians=pointerBearing*Math.PI/180;
 const [lng,lat]=rendered;
 const step=.0001;
 const ahead=[lng+Math.sin(radians)*step/Math.cos(lat*Math.PI/180),lat+Math.cos(radians)*step];
 const from=gl.project(rendered),to=gl.project(ahead);
 marker.setRotation(Math.atan2(to.x-from.x,from.y-to.y)*180/Math.PI);
}
function draw(p,route,first=false){if(!ready||!active)return;const raw=[p.coords.longitude,p.coords.latitude],near=math.nearest(raw,route.geometry.coordinates),snapped=near.distance<35&&(p.coords.accuracy||0)<60,target=snapped?near.point:raw,speed=p.coords.speed;const matchedPoint=routeProgress.position(matchedDistance);
const routeAligned=snapped&&math.distance(target,matchedPoint)<8;
if(routeAligned)target.splice(0,2,...matchedPoint);
const previous=rendered||target,moved=math.distance(previous,target);let nextHeading=Number.isFinite(p.coords.heading)&&Number.isFinite(speed)&&speed>2?p.coords.heading:moved>4?math.bearing(previous,target):heading||near.bearing;nextHeading=math.angle(heading,nextHeading);if(moved<3&&(!Number.isFinite(speed)||speed<1))target.splice(0,2,...previous);const now=performance.now(),ms=motion()||first||!rendered||resetAnimation?0:Math.min(1400,Math.max(600,now-lastTime));lastTime=now;resetAnimation=false;const fromHeading=heading;heading=first?nextHeading:fromHeading+(nextHeading-fromHeading)*0.65;
if((routeRef!==route||!gl.getSource('lapan-route'))&&(!gl.isStyleLoaded||gl.isStyleLoaded())){routeRef=route;drawFinishFlag(route.geometry.coordinates.at(-1));const geo=routeAhead(drawnDistance);if(gl.getSource('lapan-route'))gl.getSource('lapan-route').setData(geo);else{gl.addSource('lapan-route',{type:'geojson',data:geo});gl.addLayer({id:'lapan-route-halo',type:'line',source:'lapan-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':sunset()?'#ffe2d6':'#fff','line-width':12,'line-opacity':0.9}});gl.addLayer({id:'lapan-route-line',type:'line',source:'lapan-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':sunset()?'#ff6c9b':'#16bc68','line-width':7}})}drawCongestion(route)}
cancelAnimationFrame(frame);const start=performance.now(),fromDistance=vehicleDistance;
const animateOnRoute=routeAligned&&math.distance(previous,routeProgress.position(fromDistance))<8;
function tick(time){if(!active||!marker)return;const t=ms?Math.min(1,(time-start)/ms):1,e=t*t*(3-2*t);rendered=[previous[0]+(target[0]-previous[0])*e,previous[1]+(target[1]-previous[1])*e];pointerBearing=snapped?near.bearing:fromHeading+(heading-fromHeading)*e;
 const distance=fromDistance+(matchedDistance-fromDistance)*e;
 if(animateOnRoute)rendered=routeProgress.position(distance);
 if(animateOnRoute||t===1)vehicleDistance=distance;
 marker.setLngLat(rendered);
 if(animateOnRoute||t===1)paintAhead(route,distance,time,t===1);
 updatePointerRotation();if(t<1)frame=requestAnimationFrame(tick);else frame=null}tick(start);if(following){const opts={center:target,zoom:tilt?17.3:16.5,pitch:tilt?52:0,bearing:heading,offset:root.LapanNavLayout?.cameraOffset(gl.getContainer().getBoundingClientRect())||[0,tilt?Math.min(130,gl.getContainer().clientHeight*.16):Math.min(90,gl.getContainer().clientHeight*.12)],duration:ms,easing:t=>t*t*(3-2*t)};gl.easeTo(opts)}$('driveSpeed').textContent=Number.isFinite(speed)&&speed>=0?String(Math.round(speed*3.6)):'—';$('driveMode').disabled=false}
root.LapanDrive={update(p,route){if(!route?.geometry?.coordinates?.length)return;
 const coords=route.geometry.coordinates;
 if(coords!==progressGeometry){
  progressGeometry=coords;routeProgress=math.routeProgress(coords);
  matchedDistance=drawnDistance=vehicleDistance=0;trimTraffic=null;lastPaint=-Infinity;resetAnimation=false;
  cancelAnimationFrame(frame);rendered=null;
 }
 matchedDistance=routeProgress.update([p.coords.longitude,p.coords.latitude],p.coords.accuracy||0);
 resetAnimation||=routeProgress.rejoined;
 if(!active||routeRef!==route)progress('Drawing route…');active=true;pending={p,route};const raw=[p.coords.longitude,p.coords.latitude];if(!gl&&!rendererFailed)init(raw);if(ready){document.body.classList.add('drive-ready');const box=gl.getContainer();if(box.clientWidth===driveWidth&&box.clientHeight===driveHeight)draw(p,route,!rendered)}},remaining(route){return route.geometry?.coordinates===progressGeometry?routeProgress.remaining(matchedDistance):route.geometry?.coordinates},
 trafficAhead(route,refresh){return route.geometry?.coordinates===progressGeometry?trafficAhead(route,matchedDistance,refresh):root.LapanTrafficColors?.features(route)},stop(){progress(null);active=false;
 progressGeometry=null;routeProgress=null;matchedDistance=drawnDistance=vehicleDistance=0;trimTraffic=null;trafficData=null;resetAnimation=false;rendererFailed=false;pending=null;rendered=null;routeRef=null;finishFlag?.remove();finishFlag=null;lastTime=0;heading=0;following=true;cancelAnimationFrame(frame);gl?.stop();document.body.classList.remove('drive-ready');$('driveSpeed').textContent='—'},reportMap(){return active&&ready?gl:null},isReady(){return active&&ready},resize(){if(ready&&active&&resizeDrive()){if(following&&pending)draw(pending.p,pending.route,true);root.requestAnimationFrame?.(collapseCredits)}},suspendGestures(){
 const current=gl;
 if(!current)return;
 current.stop();
 const handlers=[current.dragPan,current.touchZoomRotate,current.touchPitch].filter(handler=>handler?.isEnabled());
 handlers.forEach(handler=>handler.disable());
 return ()=>{if(gl===current)handlers.forEach(handler=>handler.enable())};
},recenter(){following=true;if(pending&&ready)draw(pending.p,pending.route,true)},toggle(){setTilt(!tilt)}};
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
