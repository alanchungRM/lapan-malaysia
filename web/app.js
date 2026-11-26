const $=s=>document.getElementById(s), places=[['Kuala Lumpur City Centre',3.1579,101.7116],['Genting Highlands',3.4238,101.7932],['KL Sentral',3.134,101.686],['KLIA Terminal 1',2.7456,101.7072],['George Town, Penang',5.4141,100.3288],['Ipoh',4.5975,101.0901],['Johor Bahru',1.4927,103.7414],['Melaka',2.1896,102.2501],['Shah Alam',3.0738,101.5183],['Petaling Jaya',3.1073,101.6067],['Kota Kinabalu',5.9804,116.0735],['Kuching',1.5533,110.3592],['Cameron Highlands',4.4704,101.376]];
let chosen={origin:null,destination:null},routes=[],selected=0,lines=[],markers=[],watch=null,userMarker=null,spoken=-1,searchId=0;
const map=L.map('map',{trackResize:false,zoomControl:false,attributionControl:false}).setView([3.24,101.73],11);L.control.zoom({position:'topright'}).addTo(map);document.getElementById('browseReports')?.addEventListener('click',()=>window.LapanReports?.browse(map));const baseMap=L.maplibreGL({style:window.LapanMapAppearance?.url()||'https://tiles.openfreemap.org/styles/liberty',interactive:false,attribution:'© OpenMapTiles · © OpenStreetMap contributors'}).addTo(map);if(baseMap?.getMaplibreMap)window.LapanMapAppearance?.bind(baseMap.getMaplibreMap());
const credits=L.control({position:'bottomleft'});credits.onAdd=()=>{const wrap=L.DomUtil.create('div','compact-credits');wrap.innerHTML='<details><summary aria-label="Map credits" title="Map credits">ⓘ</summary><div>Signals © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · Map © OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors<p id="satelliteCredit" hidden><a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> by EOX IT Services GmbH · Contains modified Copernicus Sentinel data 2016</p><p id="esriImageryCredit" hidden>Imagery: Esri, Vantor, Earthstar Geographics and the GIS User Community</p></div></details><a id="esriMapCredit" href="https://www.esri.com/" target="_blank" rel="noopener" hidden>Powered by Esri</a>';L.DomEvent.disableClickPropagation(wrap);L.DomEvent.disableScrollPropagation(wrap);return wrap};credits.addTo(map);
const planningBasemap=$('planningBasemap');
const updatePlanningBasemap=planningBasemap&&baseMap?.getMaplibreMap
 ?window.LapanMapAppearance?.bindSatellite?.(baseMap.getMaplibreMap(),planningBasemap):null;

let congestionLayer=null;
function drawCongestion(){
 if(congestionLayer){map.removeLayer(congestionLayer);congestionLayer=null}
 const data=window.LapanTrafficColors?.features(routes[selected]);
 if(data?.features.length)congestionLayer=L.geoJSON(data,{style:f=>({color:f.properties.color,weight:7,opacity:1,lineCap:'butt',dashArray:f.properties.community?'10 5':null,className:'route-congestion'}),interactive:false}).addTo(map);
}
window.LapanTrafficColors?.subscribe(route=>{if(route===routes[selected])drawCongestion()});
const status=t=>$('status').textContent=t;
function followLeaflet(pos,animate=true){
 const offset=window.LapanNavLayout?.cameraOffset(map.getContainer().getBoundingClientRect());
 const zoom=16;
 const center=offset?map.unproject(map.project(pos,zoom).subtract(L.point(offset)),zoom):pos;
 if(map.getZoom()!==zoom)map.setView(center,zoom);
 else map.panTo(center,{animate,duration:0.8});
}
function marker(p,end){const label=document.createElement('span');label.textContent=p[0];const icon=end?{className:'route-finish-flag',iconSize:[32,30],iconAnchor:[5,30]}:{className:'',html:'<div class="marker"></div>',iconSize:[22,22],iconAnchor:[11,11]};return L.marker([p[1],p[2]],{icon:L.divIcon(icon),title:p[0],zIndexOffset:end?1200:0}).addTo(map).bindPopup(label)}
function rvStopMarker(stop){
 const label=document.createElement('span');
 const caption=document.createElement('strong');
 caption.textContent='RV stop';
 label.append(caption,document.createElement('br'),stop[0]);
 const icon=L.divIcon({className:'rv-stop-marker',html:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17V7a2 2 0 0 1 2-2h9l6 6v6H3zm11-12v6h6M7 9h3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',iconSize:[40,40],iconAnchor:[20,36],popupAnchor:[0,-32]});
 return L.marker([stop[1],stop[2]],{icon,title:stop[0],zIndexOffset:1250}).addTo(map).bindPopup(label);
}
markers=[];
function invalidatePlan(){$('refreshRoute').classList.add('hidden');plannedKey=null;plannedAt=0;window.LapanRouteCosts?.render(null);if(document.body.classList.contains('guiding'))endGuidance();window.LapanRouteCosts?.render(null);routes=[];window.LapanReports?.stopPreview?.();drawCongestion();lines.forEach(l=>map.removeLayer(l));lines=[];markers.forEach(m=>map.removeLayer(m));markers=[];window.LapanSaved?.setRouteDestination?.(null);window.LapanRouteWeather?.clear();$('routes').replaceChildren();$('steps').replaceChildren();$('routecount').textContent='';$('routeBasis').classList.add('hidden');$('start').classList.add('hidden');document.body.classList.remove('has-route');rvStop=null;updateRvTripControls();}
let rvStop=null;
const activeDestination=()=>rvStop||chosen.destination;
function updateRvTripControls(){
 $('rvTripSummary').hidden=vehicleMode()!=='car'||!routes[selected]||!rvStop;
 $('rvTripStop').textContent=rvStop?.[0]||'';
 $('rvTripFinal').textContent=rvStop?chosen.destination[0]:'';
}
let searchLocation=null;
const placeSearch=window.LapanSearch.init({get:id=>chosen[id],set:(id,p)=>{chosen[id]=p;if(id==='destination')chosen.savedKind=null},places,status,invalidate:invalidatePlan,
 nearby:()=>searchLocation&&Date.now()-searchLocation.at<900000?searchLocation.coordinates:null});
document.addEventListener('click',e=>{if(!e.target.closest('.field')&&!e.target.closest('#suggest'))$('suggest').style.display='none'});
$('swap').onclick=()=>{placeSearch.cancel();invalidatePlan();[chosen.origin,chosen.destination]=[chosen.destination,chosen.origin];[$('origin').value,$('destination').value]=[$('destination').value,$('origin').value]};
function locate(setOrigin){if(!navigator.geolocation)return status('This browser does not support location.');status('Finding your location…');navigator.geolocation.getCurrentPosition(p=>{const {latitude:y,longitude:x}=p.coords;if(x<99||x>120||y<0.8||y>7.6)return status('Your location is outside Malaysia. Choose a Malaysian starting point.');if(p.coords.accuracy<=1000)searchLocation={coordinates:[y,x],at:Date.now()};if(setOrigin){if(!chosen.origin||chosen.origin[1]!==y||chosen.origin[2]!==x)invalidatePlan();chosen.origin=['My location',y,x];$('origin').value='My location'}if(userMarker)map.removeLayer(userMarker);userMarker=L.circleMarker([y,x],{radius:8,color:'#fff',weight:3,fillColor:'#2583c5',fillOpacity:1}).addTo(map);map.setView([y,x],15);status('Location found. Ready to plan your journey.')},()=>status('Location is unavailable or permission was denied. Choose your start manually.'),{enableHighAccuracy:true,timeout:15000})}
$('gps').onclick=()=>{placeSearch.cancel();locate(true)};$('locate').onclick=()=>{if(window.LapanDrive?.isReady())window.LapanDrive.recenter();else if(document.body.classList.contains('guiding')&&lastGPS){const {latitude,longitude}=lastGPS.p.coords;followLeaflet([latitude,longitude],false)}else locate(false)};
function duration(sec){const m=Math.round(sec/60);return m>=60?Math.floor(m/60)+' h '+m%60+' min':m+' min'}
let allowBasicRoute=false,plannedKey=null,plannedAt=0;
const avoidTollsMode=()=>$('avoidTolls').checked;
$('routePreference').onchange=()=>{invalidatePlan();$('basicRoute').classList.add('hidden');status('');};
const vehicleMode=()=>$('vehicle').value==='motorcycle'?'motorcycle':'car';
const allowsRv=()=>vehicleMode()==='car'&&$('rvEnabled').checked;
try{
 $('rvEnabled').checked=localStorage.getItem('lapan-rv-enabled')==='true';
 const vehicle=$('vehicle'),saved=localStorage.getItem('lapan-vehicle');
 if(Array.from(vehicle.options).some(option=>option.value===saved))vehicle.value=saved;
}catch{}
function updateVehicleControls(){
 const mode=vehicleMode();
 $('vehicleNote').hidden=mode!=='motorcycle';
 $('rvPreference').hidden=mode!=='car';
 const showRv=allowsRv();
 $('findRvDestination').hidden=!showRv;
 document.querySelectorAll('[data-stop="rv"]').forEach(button=>{button.hidden=!showRv});
}
updateVehicleControls();
$('rvEnabled').addEventListener('change',()=>{
 updateVehicleControls();
 try{localStorage.setItem('lapan-rv-enabled',String($('rvEnabled').checked))}catch{}
});
$('vehicle').onchange=()=>{invalidatePlan();window.LapanETA?.stop();updateVehicleControls();try{localStorage.setItem('lapan-vehicle',vehicleMode())}catch{}status(vehicleMode()==='motorcycle'?'Motorcycle selected. Find a new route using TomTom or HERE.':'Car selected. Find a new route.');};
function keepDestination(place,savedKind=null){const same=chosen.destination&&chosen.destination[1]===place[1]&&chosen.destination[2]===place[2];if(!same)invalidatePlan();chosen.destination=place.slice();chosen.savedKind=savedKind;$('destination').value=place[0];return same&&routes.length>0}
function positionFinishFlag(route){
 const [lon,lat]=route.geometry.coordinates.at(-1);
 const finish=markers[1],saved=window.LapanSaved;
 const kind=saved?.setRouteDestination?.(rvStop?null:chosen.destination,rvStop?null:chosen.savedKind)||null;
 if(!finish||rvStop)return;
 if(kind!==(finish.savedKind||null)){
  finish.setIcon(L.divIcon(saved?.routeIcon?.(kind)||{className:'route-finish-flag',iconSize:[32,30],iconAnchor:[5,30]}));
  finish.savedKind=kind;
 }
 finish.setLatLng([lat,lon]);
}
function instruction(s){return window.LapanDirections.format(s)}
function selectRoute(i){if(!routes[i]||!chosen.origin||!chosen.destination)return;if(watch!==null)endGuidance();selected=i;positionFinishFlag(routes[i]);lines.forEach((l,n)=>l.setStyle({color:n===i?'var(--planning-selected, #175b48)':'var(--planning-alternative, #8fa5a0)',weight:n===i?7:4,opacity:n===i?1:.8}));lines[i].bringToFront();drawCongestion();window.LapanRouteWeather?.show($('routes').children[i],routes[i],activeDestination(),map);const bounds=lines[i].getBounds();const visibleBounds=rvStop?L.latLngBounds(bounds.getSouthWest(),bounds.getNorthEast()).extend(rvStop.slice(1)).extend(chosen.destination.slice(1)):bounds;map.fitBounds(visibleBounds,{padding:[50,65]});window.LapanReports?.preview?.(routes[i],map,bounds);document.querySelectorAll('.route').forEach((c,n)=>{c.classList.toggle('active',n===i);const arrival=c.querySelector('.route-arrival'),strong=c.querySelector('.top strong');if(arrival&&routes[n])arrival.textContent=window.LapanETA?.preview(routes[n])||'No live traffic';if(strong&&routes[n])strong.textContent=duration(routes[n].duration)});$('steps').replaceChildren();const heading=document.createElement('h3');heading.textContent='Turn-by-turn directions';heading.style.fontSize='14px';$('steps').append(heading);routes[i].legs.flatMap(l=>l.steps).forEach(s=>{const d=document.createElement('div');d.className='step';const span=document.createElement('span');span.textContent=s.distance>=1000?(s.distance/1000).toFixed(1)+' km':Math.round(s.distance)+' m';d.append(span,document.createTextNode(instruction(s)));$('steps').append(d)});window.LapanETA?.setRoute(routes[i]);window.LapanRouteCosts?.render(routes[i]);$('routeBasis').textContent=window.LapanRouting.label(routes[i]);$('routeBasis').classList.remove('hidden');$('start').classList.remove('hidden');$('refreshRoute').classList.remove('hidden');document.body.classList.add('has-route');updateRvTripControls();document.querySelector('.search-panel').open=false;$('journeytitle').textContent=chosen.destination[0];map.invalidateSize();if(window.matchMedia('(max-width:760px)').matches)window.scrollTo({top:0,behavior:'smooth'})}
$('plan').onclick=async(forceRefresh=false,stillCurrent=()=>true)=>{forceRefresh=forceRefresh===true;if($('plan').disabled)return false;$('plan').disabled=true;let resolved;try{resolved=await placeSearch.resolveAll()}finally{$('plan').disabled=false}if(!resolved||!stillCurrent())return false;if(!chosen.origin&&!$('origin').value.trim()){try{status('Finding your starting location…');const p=await new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('GPS unavailable'));navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:5000})});chosen.origin=['My location',p.coords.latitude,p.coords.longitude];$('origin').value='My location'}catch{status('Location unavailable. Enter a starting point, or allow location access and retry.');document.querySelector('.search-panel').open=true;return false}}if(!chosen.origin||!chosen.destination)return status('Please select both places from the search results.');if(chosen.origin[1]===chosen.destination[1]&&chosen.origin[2]===chosen.destination[2])return status('Choose a different destination.');const requestKey=JSON.stringify([chosen.origin.slice(1),chosen.destination.slice(1),vehicleMode(),avoidTollsMode(),...(rvStop?[rvStop.slice(1)]:[])]);if(!forceRefresh&&!allowBasicRoute&&routes.length&&plannedKey===requestKey&&Date.now()-plannedAt<120000){if(watch===null)selectRoute(selected);status('Showing your recently checked route.');return true}const previousRoute=routes[selected];$('routecount').textContent='Planning…';$('routeBasis').classList.add('hidden');$('start').classList.add('hidden');$('plan').disabled=true;$('plan').textContent='Finding the way…';$('basicRoute').classList.add('hidden');const avoidTolls=avoidTollsMode();$('routePreference').disabled=true;status(avoidTolls?'Looking for a route that avoids tolls…':'Finding a live route with current traffic and reported closures…');try{const a=chosen.origin,final=chosen.destination,b=activeDestination(),vehicle=vehicleMode();const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),40000);let d;try{d=await window.LapanRouting.request([a[2],a[1]],[b[2],b[1]],true,ctrl.signal,allowBasicRoute,'planning',forceRefresh,vehicle,avoidTolls)}finally{clearTimeout(timeout)}if(!stillCurrent()||chosen.origin!==a||chosen.destination!==final||activeDestination()!==b||(vehicleMode()!==vehicle||avoidTollsMode()!==avoidTolls))return false;endGuidance();window.LapanRouteCosts?.render(null);routes=[];window.LapanReports?.stopPreview?.();drawCongestion();lines.forEach(l=>map.removeLayer(l));lines=[];markers.forEach(m=>map.removeLayer(m));markers=[];window.LapanSaved?.setRouteDestination?.(null);window.LapanRouteWeather?.clear();$('routes').replaceChildren();$('steps').replaceChildren();$('refreshRoute').classList.add('hidden');routes=d.routes;plannedKey=requestKey;plannedAt=Date.parse(d.checkedAt)||Date.now();markers=[marker(a),marker(final,true)];if(rvStop)markers.push(rvStopMarker(rvStop));lines=routes.map(r=>L.geoJSON(r.geometry,{style:{className:'planning-route'}}).addTo(map));window.LapanRouteWeather?.clear();$('routes').replaceChildren();routes.forEach((r,i)=>{const c=document.createElement('div');c.className='route';c.tabIndex=0;const top=document.createElement('div');top.className='top';const strong=document.createElement('strong');strong.textContent=duration(r.duration);const badge=document.createElement('span');badge.className='badge';badge.textContent=i===0?(r.avoidTolls?'Avoid Tolls':'Faster'):'ALTERNATIVE '+i;top.append(strong,badge);const p=document.createElement('p');p.append(document.createTextNode((r.distance/1000).toFixed(1)+' km · '));const toll=document.createElement('span');toll.className='toll-badge';toll.textContent=window.LapanRouteCosts?.label(r)||'Toll estimate unavailable';p.append(toll);const arrival=document.createElement('small');arrival.className='route-arrival';arrival.textContent=window.LapanETA?.preview(r)||'No live traffic';c.append(top,p,arrival);c.onclick=()=>selectRoute(i);c.onkeydown=e=>{if(e.key==='Enter')selectRoute(i)};$('routes').append(c)});window.LapanHistory?.remember(final,'planned');$('routecount').textContent=routes.length+' available';selectRoute(0);status(window.LapanRouting.label(routes[0]));return true}catch(e){if(!stillCurrent())return false;if(previousRoute&&routes[selected]===previousRoute){$('routecount').textContent=routes.length+' available';$('routeBasis').classList.remove('hidden');$('start').classList.remove('hidden');$('refreshRoute').classList.remove('hidden');status(e.message);return false}$('routecount').textContent='No route available';if(!avoidTolls){const empty=document.createElement('p');empty.textContent='Route planning did not finish. Check the locations above and try again.';$('routes').replaceChildren(empty)}if(e.allowBasic)$('basicRoute').classList.remove('hidden');status(e.name==='AbortError'?'Routing timed out. Please try again.':e.message);return false}finally{allowBasicRoute=false;$('routePreference').disabled=false;$('plan').disabled=false;$('plan').textContent='Find my route'}};
let tolls=[];try{tolls=JSON.parse(localStorage.getItem('lapan-tolls')||'[]');if(!Array.isArray(tolls))tolls=[]}catch{}
function total(){const nums=tolls.filter(t=>t.amount!==''&&Number.isFinite(+t.amount)&&+t.amount>=0);$('total').textContent=nums.length?'RM '+nums.reduce((a,t)=>a+ +t.amount,0).toFixed(2):'RM —';try{localStorage.setItem('lapan-tolls',JSON.stringify(tolls))}catch{}}
function renderTolls(){$('tolls').replaceChildren();tolls.forEach((t,i)=>{const row=document.createElement('div');row.className='tollrow';const name=document.createElement('input');name.placeholder='Plaza / highway';name.value=t.name;name.setAttribute('aria-label','Toll plaza');name.oninput=()=>{t.name=name.value;total()};const n=document.createElement('input');n.type='number';n.min='0';n.step='.01';n.placeholder='RM';n.value=t.amount;n.setAttribute('aria-label','Toll fare in RM');n.oninput=()=>{t.amount=n.value;total()};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Remove toll');del.onclick=()=>{tolls.splice(i,1);renderTolls()};row.append(name,n,del);$('tolls').append(row)});total()}
$('addtoll').onclick=()=>{tolls.push({name:'',amount:''});renderTolls()};renderTolls();
let rerouteLast=0,rerouteFailures=0,rerouteMisses=0,rerouteBusy=false,rerouteRetry=null,rerouteController=null;
let navView=false;
let navResume=null,navBackground=false,gpsGeneration=0,navAcquireAt=0;
let navSession=0,navDeadline=null,navFreshness=null,lastFix=0,navProgress=0,offRouteSince=0,lastGPS=null;
const navTitle=$('navpanel').querySelector('b');
function setNavText(node,text){if(node.textContent!==text)node.textContent=text}
// Optional browser integrations must not prevent the user from leaving guidance.
function cleanupNavigation(task){try{const result=task();result?.catch?.(()=>{})}catch{}}
function releaseGPS(){window.LapanAnalytics?.pauseEngagement?.();gpsGeneration++;const previous=watch;watch=null;clearTimeout(navDeadline);clearInterval(navFreshness);navDeadline=null;navFreshness=null;if(previous!==null)cleanupNavigation(()=>navigator.geolocation?.clearWatch(previous))}

function pauseRoutingRequests(){
clearTimeout(rerouteRetry);rerouteRetry=null;
const pendingRoute=rerouteController;rerouteController=null;rerouteBusy=false;
cleanupNavigation(()=>pendingRoute?.abort());
cleanupNavigation(()=>window.LapanETA?.suspend?.());
}
function renderNextTurnPreview(step){
 for(const id of ['navThen','landscapeNavThen'])window.LapanDirections?.renderThen?.($(id),step);
}
const directionReportDialog=$('wrongDirectionDialog');
let latestDirection=null,previousDirection=null;
function rememberDirection(step,message,route){
 const point=step?.maneuver?.location;
 const [lon,lat]=Array.isArray(point)?point:[];
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||['depart','arrive'].includes(step.maneuver.type))return;
 if(latestDirection?.point!==point)previousDirection=latestDirection;
 latestDirection={point,lat,lon,provider:route?.provider||'Unknown',message};
}

const directionReportStep=$('wrongDirectionStep'),directionReportPreview=$('wrongDirectionPreview');
const directionReportStatus=$('wrongDirectionStatus'),shareDirectionReport=$('shareWrongDirection');
let directionReportSnapshot, directionReportSending=false;
const sendDirectionReport=$('sendWrongDirection');
function renderDirectionReport(){
 const report=directionReportSnapshot?.[directionReportStep.value];
 const t=text=>window.LapanI18n?.t?.(text)||text;
 directionReportStatus.textContent=report?'':t('No navigation instruction is available yet.');
 shareDirectionReport.disabled=!report;
 sendDirectionReport.disabled=!report||directionReportSending;
 directionReportPreview.value='';
 if(!report)return;
 const {lat,lon,provider,message}=report;
 const pin=lat.toFixed(6)+','+lon.toFixed(6);
 directionReportPreview.value=[
  'Lapan Malaysia — '+t('Report wrong direction'),
  t('Routing provider')+': '+provider,
  t('Instruction')+': '+message,
  'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(pin)
 ].join('\n');
}
directionReportStep.onchange=renderDirectionReport;
$('reportWrongDirection').onclick=()=>{
 directionReportSnapshot={latest:latestDirection,previous:previousDirection};
 directionReportStep.value='latest';
 directionReportStep.options[1].disabled=!previousDirection;
 renderDirectionReport();
 $('reportDialog').close();
 directionReportDialog.showModal();
};
$('closeWrongDirection').onclick=()=>directionReportDialog.close();
directionReportDialog.addEventListener('close',()=>{
 directionReportSnapshot=null;
 directionReportPreview.value='';
 if(document.body.classList.contains('guiding'))$('navReport').focus();
});
sendDirectionReport.onclick=async()=>{
 const snapshot=directionReportSnapshot;
 const report=snapshot?.[directionReportStep.value];
 if(!report||directionReportSending)return;
 directionReportSending=true;
 directionReportStep.disabled=true;
 sendDirectionReport.disabled=true;
 const {lat,lon,provider,message}=report;
 try{
  const response=await fetch('/api/reports/direction',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({lat,lon,provider,instruction:message.slice(0,500)})
  });
  if(!response.ok)throw Error();
  if(directionReportSnapshot===snapshot){
   snapshot[directionReportStep.value]=null;
   setNavText(directionReportStatus,'Direction report sent to Lapan.');
  }
 }catch{
  if(directionReportSnapshot===snapshot)setNavText(directionReportStatus,'Could not send right now. Try again or use Share direction report.');
 }finally{
  directionReportSending=false;
  directionReportStep.disabled=false;
  sendDirectionReport.disabled=!directionReportSnapshot?.[directionReportStep.value];
 }
};
shareDirectionReport.onclick=async()=>{
 const text=directionReportPreview.value;
 if(!text)return;
 if(navigator.share){
  try{await navigator.share({text});return}catch(error){if(error.name==='AbortError')return}
 }
 try{
  await navigator.clipboard.writeText(text);
  setNavText(directionReportStatus,'Report copied. Paste it into your feedback message.');
 }catch{
  directionReportPreview.focus();
  directionReportPreview.select();
  setNavText(directionReportStatus,'Copy the selected report to share it.');
 }
};
function showNav(title,message,step,followingStep){if(title==='GPS guidance active')rememberDirection(step,message,routes[selected]);$('exitArrival').classList.toggle('hidden',title!=='You have arrived');const continueButton=$('continueRvTrip');continueButton.hidden=!rvStop||continueButton.disabled;const progress=$('navigationProgress');if(progress&&title==='Finding your location…'){progress.textContent='Finding GPS…';progress.hidden=false}if(progress&&(title==='Location unavailable'||title==='You have arrived'))progress.hidden=true;if(!navView){navView=true;window.requestAnimationFrame?.(()=>map.invalidateSize());}setNavText($('navDestination'),activeDestination()?.[0]||'Your destination');$('navRvTarget').hidden=!rvStop;setNavText($('navRvStopName'),rvStop?.[0]||'');setNavText($('navRvFinalName'),rvStop?chosen.destination[0]:'');$('landscapeRvTarget').hidden=!rvStop;setNavText($('landscapeRvFinal'),rvStop?chosen.destination[0]:'');{const trip=window.LapanETA?.text(routes[selected])||(routes[selected]?duration(routes[selected].duration)+' · '+(routes[selected].distance/1000).toFixed(1)+' km planned':'Route guidance');if(window.LapanDriveUI)window.LapanDriveUI.paintTrip($('navTrip'),trip);else setNavText($('navTrip'),trip)}$('navpanel').dataset.mode=title==='GPS guidance active'?'active':'status';$('navpanel').classList.remove('hidden');if(!document.body.classList.contains('guiding')){document.body.classList.add('guiding');updatePlanningBasemap?.(true)}setNavText(navTitle,title);if(step&&window.LapanDirections?.render)window.LapanDirections.render($('nextturn'),step,message);else setNavText($('nextturn'),message);renderNextTurnPreview(followingStep)}
function endGuidance(){directionReportSnapshot=latestDirection=previousDirection=null;if(directionReportDialog.open)directionReportDialog.close();const progress=$('navigationProgress');if(progress)progress.hidden=true;
// Invalidate callbacks and dismiss the driving UI before touching browser APIs.
window.LapanAnalytics?.endEngagement?.();navResume=null;navBackground=false;navSession++;navView=false;spoken=-1;lastFix=0;navProgress=0;offRouteSince=0;lastGPS=null;
clearTimeout(rerouteRetry);rerouteRetry=null;rerouteBusy=false;rerouteLast=0;rerouteMisses=0;rerouteFailures=0;
const pendingRoute=rerouteController;rerouteController=null;
document.body.classList.remove('guiding','details-open','drive-ready');
updatePlanningBasemap?.(false);
$('navpanel').classList.add('hidden');$('replan').classList.add('hidden');
$('navdetails').setAttribute?.('aria-expanded','false');$('navdetails').textContent='Details';
$('start').disabled=false;$('start').textContent='Start Navigation ➤';
releaseGPS();
cleanupNavigation(()=>pendingRoute?.abort());
cleanupNavigation(()=>window.LapanETA?.stop());
cleanupNavigation(()=>window.LapanAwake?.stop());
cleanupNavigation(()=>window.LapanDrive?.stop());
cleanupNavigation(()=>window.LapanVoice?.cancel());
cleanupNavigation(()=>window.LapanVoice?.endTrip?.());
cleanupNavigation(()=>window.LapanHazards?.stop());cleanupNavigation(()=>window.LapanCameras?.stop());cleanupNavigation(()=>window.LapanReports?.stop());cleanupNavigation(()=>window.LapanSpeed?.stop());
cleanupNavigation(()=>window.requestAnimationFrame?.(()=>{cleanupNavigation(()=>map.invalidateSize());cleanupNavigation(()=>window.LapanDrive?.resize())}));
}

$('stop').onclick=$('exitArrival').onclick=()=>{
 endGuidance();
 if(routes[selected]&&lines[selected])window.LapanReports?.preview?.(routes[selected],map,lines[selected].getBounds());
};
function failNavigation(message,session,title='Location unavailable'){if(session!==navSession)return;cleanupNavigation(()=>window.LapanHazards?.stop());cleanupNavigation(()=>window.LapanReports?.stop());window.LapanAnalytics?.endEngagement?.();navResume=null;navBackground=false;navSession++;releaseGPS();pauseRoutingRequests();cleanupNavigation(()=>window.LapanETA?.stop());window.LapanAwake?.stop();window.LapanVoice?.cancel();showNav(title,message);$('start').disabled=false;$('start').textContent='Retry GPS navigation';}
function gpsError(error,session){const message=error.code===1?'Please allow Lapan Malaysia to use your location for navigation. Open the location permissions for this site, select Allow, then retry navigation.':error.code===2?'Your device could not find a location. Check Location Services, move to an area with a clearer signal, then retry.':'GPS took too long to respond. Check that location services are on, then retry.';failNavigation(message,session,error.code===1?'Allow location access':undefined)}
// Distance from the GPS fix to each road segment, rather than only to junctions.
function nearestRoad(pos,steps){let best={distance:Infinity,index:0};const scale=111320,cos=Math.cos(pos[0]*Math.PI/180);steps.forEach((s,index)=>{const coords=s.geometry?.coordinates||[s.maneuver.location];for(let i=0;i<Math.max(1,coords.length-1);i++){const a=coords[i],b=coords[Math.min(i+1,coords.length-1)],ax=(a[0]-pos[1])*scale*cos,ay=(a[1]-pos[0])*scale,bx=(b[0]-pos[1])*scale*cos,by=(b[1]-pos[0])*scale,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(ax+t*dx,ay+t*dy);if(distance<best.distance)best={distance,index}}});return best}
$('start').onclick=()=>{
 const voice=window.LapanVoice;
 if(!voice?.needsPreparation?.())return startGuidance();
 const button=$('start'),route=routes[selected],session=navSession,selectedVoice=voice.selectedVoice();
 if(button.disabled)return;
 if(!route?.legs?.length)return startGuidance();
 button.disabled=true;
 setNavText(button,'Preparing navigation voice…');
 return voice.prepare().then(ready=>{
  if(session!==navSession)return;
  button.disabled=false;
  setNavText(button,'Start Navigation ➤');
  if(route!==routes[selected])return;
  if(!voice.needsPreparation())return startGuidance();
  if(selectedVoice!==voice.selectedVoice())return status('Voice changed. Tap Start Navigation again.');
  if(!ready)return status('The navigation voice could not load. Tap Start Navigation to retry, or select another voice.');
  status('');
  return startGuidance();
 });
};
function startGuidance(){endGuidance();window.LapanReports?.stopBrowsing?.();window.LapanReports?.stopPreview?.();window.LapanVoice?.unlock();window.LapanSpeed?.preload();const session=navSession;if(!routes[selected]?.legs?.length)return status('Plan a route before starting navigation.');const dest=activeDestination();window.LapanAwake?.start();showNav('Finding your location…','Allow location access when prompted. GPS guidance starts after a location is received.');$('start').disabled=true;$('start').textContent='Finding GPS…';if(!window.isSecureContext)return failNavigation('GPS requires a secure HTTPS connection. Open the published Lapan site and retry.',session);if(!navigator.geolocation)return failNavigation('Location access is unavailable here. Open this site in a browser that supports location and allow access when prompted.',session);cleanupNavigation(()=>window.LapanETA?.start?.(routes[selected]));const steps=routes[selected].legs.flatMap(l=>l.steps);navProgress=0;window.LapanHazards?.start();
const onFix=p=>{if(session!==navSession||document.visibilityState==='hidden'||navBackground||$('continueRvTrip').disabled)return;const steps=routes[selected].legs.flatMap(l=>l.steps);const fixTime=Number.isFinite(p.timestamp)?p.timestamp:Date.now();if(lastGPS&&(fixTime<lastGPS.time||Number.isFinite(p.timestamp)&&fixTime===lastGPS.time))return;if(Date.now()-fixTime>15000){if(!lastFix)showNav('Waiting for fresh GPS…','The last location is old. Waiting for a current position.');return}const lastFixFirst=!lastFix;lastFix=Date.now();clearTimeout(navDeadline);const pos=[p.coords.latitude,p.coords.longitude];if(!pos.every(Number.isFinite)||pos[0]<0.8||pos[0]>7.6||pos[1]<99||pos[1]>120)return failNavigation('An invalid GPS location was received. Please retry.',session);const accuracy=p.coords.accuracy||0;if(accuracy>100){window.LapanHazards?.hide();window.LapanSpeed?.stop();offRouteSince=0;rerouteMisses=0;showNav('GPS signal is weak','Waiting for a more accurate location. Current accuracy: approximately '+Math.round(accuracy)+' m.');return}lastGPS={p,time:fixTime};window.LapanTheme?.locate(p.coords.latitude,p.coords.longitude);window.LapanAnalytics?.navigation(p);window.LapanAnalytics?.sampleEngagement?.(p);const hotPointer=!!window.LapanVehiclePointer?.enabled();if(userMarker&&!!userMarker._lapanHotFM!==hotPointer){map.removeLayer(userMarker);userMarker=null}if(userMarker?.setLatLng)userMarker.setLatLng(pos);else userMarker=(window.LapanVehiclePointer?.createLeaflet(L,pos)||L.circleMarker(pos,{radius:9,color:'white',fillColor:'#2583c5',fillOpacity:1})).addTo(map);window.LapanDrive?.update(p,routes[selected]);if(!window.LapanDrive?.isReady()){followLeaflet(pos)}$('start').disabled=true;setNavText($('start'),'Navigation running');if(accuracy>150){showNav('GPS signal is weak','Waiting for a more accurate location. Current accuracy: approximately '+Math.round(accuracy)+' m.');return}cleanupNavigation(()=>window.LapanSpeed?.update(p,routes[selected]));window.LapanHazards?.prepare(p,routes[selected]);window.LapanCameras?.update(p,routes[selected]);window.LapanReports?.update(p,routes[selected]);window.LapanHazards?.update(p,routes[selected]);const road=nearestRoad(pos,steps);
// Use the complete road polyline for off-route detection, including geometry between instructions.
if(routes[selected].geometry?.coordinates?.length>1)road.distance=nearestRoad(pos,[{geometry:routes[selected].geometry}]).distance;
if(road.distance>Math.max(40,accuracy*1.5)||rerouteBusy)window.LapanETA?.suspend?.();else window.LapanETA?.update(p,routes[selected]);
if(road.distance>Math.max(40,accuracy*1.5)){
 if(rerouteBusy){showNav('Replanning…','Finding a new route from your current location.');return}
 if(rerouteRetry)return; // Preserve the real retry reason/countdown instead of overwriting it every GPS fix.
 if(accuracy>80){offRouteSince=0;rerouteMisses=0;showNav('GPS signal is weak','Waiting for a more accurate position before changing your route.');return}
 window.LapanVoice?.cancel();rerouteMisses++;if(!offRouteSince)offRouteSince=Date.now();
 const confirmed=lastFixFirst&&road.distance>150&&accuracy<=50||rerouteMisses>=3&&Date.now()-offRouteSince>=2500;
 if(confirmed&&Date.now()-rerouteLast>4000){rerouteFrom(pos);return}
 showNav('Checking your route…','Checking the GPS position before changing your route.');$('replan').classList.add('hidden');return
}if(rerouteBusy){showNav('Replanning…','Finding a new route from your current location.');return}
if(rerouteRetry){clearTimeout(rerouteRetry);rerouteRetry=null;rerouteFailures=0}
rerouteMisses=0;offRouteSince=0;$('replan').classList.add('hidden');navProgress=Math.max(navProgress,road.index);const next=Math.min(navProgress+1,steps.length-1),s=steps[next],target=s.maneuver.location,remaining=map.distance(pos,[target[1],target[0]]);if(next===steps.length-1&&remaining<30){cleanupNavigation(()=>window.LapanReports?.stop({keepFix:true}));cleanupNavigation(()=>window.LapanCameras?.stop());window.LapanAnalytics?.endEngagement?.();navResume=null;navBackground=false;navSession++;releaseGPS();cleanupNavigation(()=>window.LapanAwake?.stop());cleanupNavigation(()=>window.LapanHazards?.stop());cleanupNavigation(()=>window.LapanETA?.arrived());cleanupNavigation(()=>window.LapanSpeed?.stop());showNav('You have arrived',rvStop?'You’ve reached your RV stop. Continue when you’re ready to leave.':'Your destination is nearby. End navigation when safely parked.');cleanupNavigation(()=>window.LapanHistory?.remember(dest,'visited'));cleanupNavigation(()=>window.LapanVoice?.speak(rvStop?'You have arrived at your RV stop.':'You have arrived at your destination.'));return}const text=instruction(s);showNav('GPS guidance active',(remaining<1000?Math.round(remaining)+' m':(remaining/1000).toFixed(1)+' km')+' · '+text,s,steps[next+1]);const voiceStage=remaining>500?0:remaining>200?1:remaining>50?2:3,voiceKey=next+':'+voiceStage;if((spoken===-1||spoken.next!==next||voiceStage>spoken.stage)&&$('voice').value!=='off'){const announcement=window.LapanDirections?.prompt?.(s,remaining)||text;if(window.LapanVoice?.instruction(announcement,voiceKey,voiceStage,()=>window.LapanDirections.prompt({...s,ref:'',exits:''},remaining),s))spoken={next,stage:voiceStage}}};
function acquireGPS(){releaseGPS();const generation=gpsGeneration;navAcquireAt=Date.now();
navDeadline=setTimeout(()=>{if(generation!==gpsGeneration||document.visibilityState==='hidden')return;failNavigation('No GPS response yet. Check that location services are on and allow location access for this site, then retry.',session)},18000);
navigator.geolocation.getCurrentPosition(p=>{if(session!==navSession||generation!==gpsGeneration||document.visibilityState==='hidden')return;onFix(p);if(session!==navSession||navTitle.textContent==='You have arrived')return;watch=navigator.geolocation.watchPosition(p=>{if(generation===gpsGeneration)onFix(p)},e=>{if(generation===gpsGeneration&&document.visibilityState!=='hidden')gpsError(e,session)},{enableHighAccuracy:true,timeout:12000,maximumAge:1000});navFreshness=setInterval(()=>{if(session===navSession&&generation===gpsGeneration&&document.visibilityState!=='hidden'&&!navBackground&&Date.now()-Math.max(lastFix,navAcquireAt)>20000)failNavigation('The GPS signal stopped updating. Retry when your device has a clear signal.',session)},5000)},e=>{if(generation===gpsGeneration&&document.visibilityState!=='hidden')gpsError(e,session)},{enableHighAccuracy:true,timeout:12000,maximumAge:0})}
navResume=()=>{if(session!==navSession)return;offRouteSince=0;rerouteMisses=0;spoken=-1;window.LapanAwake?.start();showNav('Finding your location…','Allow location access when prompted. GPS guidance starts after a location is received.');acquireGPS()};acquireGPS()}
// A hidden browser document may receive no GPS updates. Resume once, with a fresh acquisition window.
function navigationVisibility(){
 if(!navResume)return;
 if(document.visibilityState==='hidden'){
  if(navBackground)return;navBackground=true;cleanupNavigation(()=>window.LapanReports?.stop());releaseGPS();pauseRoutingRequests();
  cleanupNavigation(()=>window.LapanVoice?.cancel());cleanupNavigation(()=>window.LapanHazards?.hide());cleanupNavigation(()=>window.LapanSpeed?.stop());
 }else if(navBackground){navBackground=false;navResume()}
}
document.addEventListener?.('visibilitychange',navigationVisibility);
window.addEventListener?.('pagehide',()=>{if(navResume&&!navBackground){navBackground=true;cleanupNavigation(()=>window.LapanReports?.stop());releaseGPS();pauseRoutingRequests()}});
window.addEventListener?.('pageshow',navigationVisibility);

async function rerouteFrom(pos){
if(!navResume||navBackground||document.visibilityState==='hidden'||rerouteBusy||rerouteRetry||$('continueRvTrip').disabled)return;clearTimeout(rerouteRetry);rerouteRetry=null;rerouteBusy=true;rerouteLast=Date.now();rerouteMisses=0;const token=navSession,dest=activeDestination().slice();
window.LapanETA?.suspend?.();window.LapanVoice?.cancel();showNav('Replanning…','Finding a new route automatically.');$('replan').classList.add('hidden');
const ctrl=new AbortController();let timeout,timedOut=false;const deadline=new Promise((resolve,reject)=>{timeout=setTimeout(()=>{timedOut=true;ctrl.abort();reject(new Error('Route request timed out.'))},32000)});rerouteController=ctrl;
try{const data=await Promise.race([window.LapanRouting.request([pos[1],pos[0]],[dest[2],dest[1]],false,ctrl.signal,routes[selected]?.provider==='OSRM','rerouting',false,routes[selected]?.vehicle||'car',routes[selected]?.avoidTolls===true),deadline]);if(token!==navSession||ctrl.signal.aborted||rerouteController!==ctrl||!navResume||navBackground||document.visibilityState==='hidden')return;
const latest=userMarker?.getLatLng?.();if(latest&&map.distance([latest.lat,latest.lng],pos)>100&&nearestRoad([latest.lat,latest.lng],data.routes[0].legs.flatMap(l=>l.steps)).distance>Math.max(50,(lastGPS?.p.coords.accuracy||0)*1.5)){showNav('Updating from your location…','You have moved beyond the returned route. Updating automatically.');rerouteRetry=setTimeout(()=>{if(!rerouteRetry||token!==navSession)return;rerouteRetry=null;const fresh=userMarker?.getLatLng?.();rerouteFrom(fresh?[fresh.lat,fresh.lng]:[latest.lat,latest.lng])},1000);return}
chosen.origin=['My location',pos[0],pos[1]];$('origin').value='My location';routes=data.routes;selected=0;positionFinishFlag(routes[0]);navProgress=0;spoken=-1;lines.forEach(l=>map.removeLayer(l));lines=routes.map(r=>L.geoJSON(r.geometry,{style:{className:'planning-route',color:'var(--planning-selected, #175b48)',weight:7,opacity:1}}).addTo(map));drawCongestion();window.LapanETA?.setRoute(routes[0],{rerouting:true});if(lastGPS)window.LapanDrive?.update(lastGPS.p,routes[0]);window.LapanRouteCosts?.render(routes[0]);$('routeBasis').textContent=window.LapanRouting.label(routes[0]);
window.LapanRouteWeather?.clear();$('routes').replaceChildren();const card=document.createElement('div');card.className='route active';card.textContent=duration(routes[0].duration)+' · '+(routes[0].distance/1000).toFixed(1)+' km · '+(window.LapanRouteCosts?.label(routes[0])||'Toll estimate unavailable');$('routes').append(card);$('routecount').textContent='1 available';$('steps').replaceChildren();routes[0].legs.flatMap(l=>l.steps).forEach(s=>{const row=document.createElement('div');row.className='step';row.textContent=instruction(s);$('steps').append(row)});
offRouteSince=0;rerouteFailures=0;showNav('Route updated','Continue along the highlighted route.');window.LapanVoice?.speak('Route updated. Follow the highlighted route.');
}catch(e){if(token!==navSession||rerouteController!==ctrl||!navResume||navBackground||document.visibilityState==='hidden'||ctrl.signal.aborted&&!timedOut)return;rerouteFailures++;const retryMs=Math.max(Math.min(60000,10000*2**Math.min(3,rerouteFailures-1)),Math.min(300000,Number(e.retryAfterMs)||0));showNav('Retrying live route…',e.message+' Retrying automatically in '+Math.ceil(retryMs/1000)+' seconds.');rerouteRetry=setTimeout(()=>{if(!rerouteRetry||token!==navSession)return;rerouteRetry=null;const current=userMarker?.getLatLng?.();rerouteFrom(current?[current.lat,current.lng]:pos)},retryMs)}finally{clearTimeout(timeout);if(rerouteController===ctrl){rerouteController=null;if(token===navSession)rerouteBusy=false}}
}
$('basicRoute').onclick=()=>{allowBasicRoute=true;$('plan').onclick()};
$('replan').onclick=()=>{if(!userMarker)return;const p=userMarker.getLatLng();rerouteFrom([p.lat,p.lng])};

document.querySelector('.mapwrap').append($('navpanel'));
// Phone rotation produces several transient sizes. Resize only after the map settles.
let mapResizeTimer,lastMapSize='';
let restoreMapGestures=null;
function handleDriveRotation(){
 if(document.body.classList.contains('guiding')&&!restoreMapGestures){
  document.body.classList.add('drive-rotating');
  map.stop();
  const handlers=[map.dragging,map.touchZoom].filter(handler=>handler?.enabled());
  handlers.forEach(handler=>handler.disable());
  const resumeDriveGestures=window.LapanDrive?.suspendGestures?.();
  restoreMapGestures=()=>{
   handlers.forEach(handler=>handler.enable());
   resumeDriveGestures?.();
   document.body.classList.remove('drive-rotating');
   restoreMapGestures=null;
  };
 }
 scheduleMapResize();
}
function scheduleMapResize(){
 clearTimeout(mapResizeTimer);
 mapResizeTimer=setTimeout(()=>{
  const box=document.querySelector('.mapwrap');
  const width=box.clientWidth,height=box.clientHeight;
  if(!width||!height){restoreMapGestures?.();return}
  const size=width+'x'+height;
  if(size===lastMapSize&&!restoreMapGestures)return;
  lastMapSize=size;
  try{
   map.invalidateSize({animate:false,pan:false,debounceMoveend:true});
   if(window.LapanDrive?.isReady())window.LapanDrive.resize();
   else if(document.body.classList.contains('guiding')&&lastGPS){
    const {latitude,longitude}=lastGPS.p.coords;
    followLeaflet([latitude,longitude],false);
   }
  }finally{restoreMapGestures?.()}
 },120);
}
if(typeof ResizeObserver==='function')new ResizeObserver(scheduleMapResize).observe(document.querySelector('.mapwrap'));
window.addEventListener('resize',scheduleMapResize);
window.addEventListener('orientationchange',handleDriveRotation);
window.matchMedia('(orientation: landscape)').addEventListener?.('change',handleDriveRotation);
window.visualViewport?.addEventListener('resize',scheduleMapResize);

initToll();

document.body.append($('navBar'));
function toggleNavDetails(open){document.body.classList.toggle('details-open',open);$('navdetails').setAttribute('aria-expanded',String(open));$('navdetails').textContent=open?'Map':'Details';window.requestAnimationFrame(()=>{map.invalidateSize();window.LapanDrive?.resize()});(open?$('closeDetails'):$('navdetails')).focus({preventScroll:true})}
$('navdetails').onclick=()=>toggleNavDetails(!document.body.classList.contains('details-open'));
$('closeDetails').onclick=()=>toggleNavDetails(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('details-open'))toggleNavDetails(false)});

window.LapanShare?.bind({map,destination:()=>chosen.destination?.[0]===$('destination').value.trim()?chosen.destination:null,eta:()=>window.LapanETA?.text(routes[selected])||'',choose:(p,plan)=>{
 if(document.body.classList.contains('guiding'))return;
 placeSearch.cancel();keepDestination([p.name||'Map pin '+p.lat.toFixed(5)+', '+p.lon.toFixed(5),p.lat,p.lon]);
 $('suggest').replaceChildren();$('suggest').style.display='none';document.querySelector('.search-panel').open=true;
 status('Place selected. Tap Find my route.');
 if(plan)$('plan').click();else $('plan').focus();
}});
window.LapanSaved?.bind({map,openPin:(kind,place)=>window.LapanShare?.showSaved(kind,place),destination:()=>chosen.destination,pickMap:options=>placeSearch.pickSaved(options)});window.addEventListener('lapan-saved-place',e=>{const place=window.LapanSaved?.get(e.detail?.kind);if(!place)return;placeSearch.cancel();const kept=keepDestination(place,e.detail.kind);if(kept&&markers[1])positionFinishFlag(routes[selected]);$('suggest').replaceChildren();$('suggest').style.display='none';document.querySelector('.search-panel').open=true;status(kept?'Current route kept. Tap Refresh route for a fresh calculation.':e.detail.kind==='work'?'Work selected. Tap Find my route.':'Home selected. Tap Find my route.');$('plan').focus()});
window.addEventListener('lapan-place',e=>{placeSearch.cancel();const kept=keepDestination(e.detail);document.querySelector('.search-panel').open=true;status(kept?'Current route kept. Tap Refresh route for a fresh calculation.':'Recent destination selected. Tap Find my route.');});

async function changeRvStop(next, continuationOrigin=chosen.origin, stillCurrent=()=>true){
 if($('plan').disabled)return false;
 const previous=rvStop, origin=chosen.origin, final=chosen.destination;
 if(continuationOrigin!==origin){
  chosen.origin=continuationOrigin;
  $('origin').value=continuationOrigin[0];
 }
 rvStop=next;
 const ok=await $('plan').onclick(false,stillCurrent);
 if(!ok&&chosen.destination===final&&chosen.origin===continuationOrigin&&rvStop===next){
  rvStop=previous;
  chosen.origin=origin;
  $('origin').value=origin[0];
  updateRvTripControls();
 }
 return ok;
}
$('removeRvStop').onclick=()=>changeRvStop(null);
$('continueRvTrip').onclick=async()=>{
 const button=$('continueRvTrip');
 if(!rvStop||button.hidden||button.disabled)return;
 const session=navSession, arrived=!navResume;
 const stillCurrent=()=>session===navSession;
 button.disabled=true;
 button.hidden=true;
 pauseRoutingRequests();
 showNav('Replanning…','Finding a new route from your current location.');
 $('navRvTarget').hidden=true;
 let planned=false, retry='Could not plan the next leg. Try continuing again.';
 try{
  const {lat,lon}=await window.LapanStopsContext.location({requireGps:true});
  if(stillCurrent())planned=await changeRvStop(null,['My location',lat,lon],stillCurrent);
 }catch{
  retry='Could not get your current location. Try continuing again.';
 }finally{button.disabled=false}
 if(planned)$('start').onclick();
 else if(stillCurrent()&&rvStop&&document.body.classList.contains('guiding')){
  showNav(arrived?'You have arrived':'Route unchanged',retry);
 }
};
$('continueRvLandscape').onclick=()=>$('continueRvTrip').onclick();
window.LapanStopsContext={
allowsRv,
rvDestinationPicker(){
 const destination=chosen.destination;
 return {
  select(place){
   if(!allowsRv()||chosen.destination!==destination||document.body.classList.contains('guiding'))return false;
   placeSearch.cancel();
   keepDestination([place.name,place.lat,place.lon]);
   $('suggest').style.display='none';
   document.querySelector('.search-panel').open=true;
   status('RV campsite selected. Tap Find my route.');
   return true;
  }
 };
},
async location({requireGps=false}={}){
 const currentLocation=({latitude:lat,longitude:lon,accuracy})=>{
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<.8||lat>7.6||lon<99||lon>120)throw Error();
  return {lat,lon,accuracy,label:'your location'};
 };
 try{
  if(!requireGps&&lastGPS&&Date.now()-lastGPS.time<=10000)return currentLocation(lastGPS.p.coords);
  const p=await new Promise((resolve,reject)=>{
   if(!navigator.geolocation)return reject(Error());
   navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:requireGps?0:10000});
  });
  return currentLocation(p.coords);
 }catch{
  if(requireGps)throw Error('Current location unavailable. Allow location access in Malaysia and try again.');
  if(chosen.origin)return {lat:chosen.origin[1],lon:chosen.origin[2],label:chosen.origin[0]==='My location'?'your last known location':'your starting point'};
  throw Error('Allow location access, or choose a starting point first.');
 }
},
async route(item,origin){const resume=document.body.classList.contains('guiding');endGuidance();rvStop=null;chosen.origin=['My location',origin.lat,origin.lon];$('origin').value='My location';chosen.destination=[item.name,item.lat,item.lon];chosen.savedKind=null;$('destination').value=item.name;window.LapanHistory?.remember(chosen.destination,'selected');const ok=await $('plan').onclick();if(ok&&resume)$('start').onclick();return !!ok}
};

window.addEventListener('lapan-voice-enabled',()=>{spoken=-1});

window.LapanSignals?.attachLeaflet(map);

// Refresh displayed manoeuvres after language changes without changing the trip or GPS watch.
window.LapanI18n?.onChange(()=>{spoken=-1;const route=routes[selected];if(!route)return;const steps=route.legs?.flatMap(l=>l.steps)||[];$('steps').replaceChildren();for(const step of steps){const row=document.createElement('div');row.className='step';row.textContent=instruction(step);$('steps').append(row)}if(document.body.classList.contains('guiding')&&$('navpanel').dataset.mode==='active'){const next=Math.min(navProgress+1,steps.length-1),step=steps[next];if(step){const prefix=$('nextturn').textContent.match(/^\d+(?:\.\d+)?\s*(?:m|km)\s*·\s*/)?.[0]||'';window.LapanDirections.render($('nextturn'),step,prefix+instruction(step));renderNextTurnPreview(steps[next+1])}}});

$('refreshRoute').onclick=()=>{if(!$('plan').disabled)return $('plan').onclick(true)};
