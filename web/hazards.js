// One alert at a time: whichever of a camera and a hazard is nearer is shown. Road hazard alerts on the planned route: toll plazas, railway crossings and speed bumps from mapped data, and sharp curves found in the route's own shape.
(function(root){
const SCALE=111320,RANGE={toll:600,rail:500,curve:300,bump:250},MARGIN=0.0004;
const {project}=typeof module==='object'?require('./cameras.js'):root.LapanCameras;
const DATA_REV='__HAZARD_REV__';
const cosOf=lat=>Math.cos(lat*Math.PI/180);
function cumulative(coords){const cum=[0];for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i];cum.push(cum[i-1]+Math.hypot((b[0]-a[0])*SCALE*cosOf(a[1]),(b[1]-a[1])*SCALE))}return cum}
function pointAt(coords,cum,d){if(d<=0)return coords[0];if(d>=cum.at(-1))return coords.at(-1);let lo=1,hi=cum.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<d)lo=mid+1;else hi=mid}const i=lo;const t=(d-cum[i-1])/((cum[i]-cum[i-1])||1),a=coords[i-1],b=coords[i];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}
const heading=(a,b)=>Math.atan2((b[0]-a[0])*cosOf(a[1]),b[1]-a[1])*180/Math.PI;
const wrap=d=>((d+540)%360)-180;
function routeProjector(coords){
 const cell=.002,grid=new Map(),long=[],cum=cumulative(coords);
 for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i],x0=Math.floor(Math.min(a[0],b[0])/cell),x1=Math.floor(Math.max(a[0],b[0])/cell),y0=Math.floor(Math.min(a[1],b[1])/cell),y1=Math.floor(Math.max(a[1],b[1])/cell);if((x1-x0+1)*(y1-y0+1)>200){long.push(i);continue}for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=x+','+y;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i)}}
 return point=>{const x=Math.floor(point[0]/cell),y=Math.floor(point[1]/cell),ids=new Set(long);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const i of grid.get((x+dx)+','+(y+dy))||[])ids.add(i);let best={distance:Infinity,along:0};for(const i of ids){const hit=project(point,[coords[i-1],coords[i]]);if(hit.distance<best.distance)best={distance:hit.distance,along:cum[i-1]+hit.along}}return best};
}
// Stretches of the route where a turn is already announced as a manoeuvre, as [from, to] distances along the route.
function manoeuvreZones(route,coords,cum,locate){
 const zones=[];
 for(const s of route.legs?.flatMap(l=>l.steps)||[]){const loc=s.maneuver?.location;if(!loc||s.maneuver.type==='depart'||s.maneuver.type==='arrive')continue;const at=locate(loc).along,span=s.maneuver.type==='roundabout'?s.distance||0:0;zones.push([at-70,at+span+70])}
 return zones;
}
// A bend counts as sharp when the heading changes by at least minAngle within about 80 m of road. Bends at junction turns are skipped because they are announced as turns.
function curves(route,minAngle=60,locate){
 const coords=route?.geometry?.coordinates;if(!Array.isArray(coords)||coords.length<3)return [];
 const cum=cumulative(coords),total=cum.at(-1),zones=manoeuvreZones(route,coords,cum,locate||routeProjector(coords)),found=[];
 for(let i=1;i<coords.length-1;i++){const d=cum[i];if(d<60||d>total-60)continue;const delta=wrap(heading(coords[i],pointAt(coords,cum,d+40))-heading(pointAt(coords,cum,d-40),coords[i]));if(Math.abs(delta)<minAngle)continue;if(zones.some(z=>d>=z[0]&&d<=z[1]))continue;found.push({kind:'curve',along:d,angle:Math.round(Math.abs(delta)),side:delta<0?'left':'right'})}
 const out=[];for(const c of found){const last=out.at(-1);if(last&&c.along-last.along<80){if(c.angle>last.angle)out[out.length-1]=c}else out.push(c)}
 return out;
}
// Mapped points that lie on the route. Bumps closer than 80 m to each other become one alert.
function pointsOnRoute(data,route,tolerance=20,locate){
 const coords=route?.geometry?.coordinates;if(!Array.isArray(coords)||coords.length<2||!data)return [];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const c of coords){if(c[0]<minX)minX=c[0];if(c[0]>maxX)maxX=c[0];if(c[1]<minY)minY=c[1];if(c[1]>maxY)maxY=c[1]}
 locate=locate||routeProjector(coords);
 const hits=[];
 for(const kind of ['toll','rail','bump'])for(const p of Array.isArray(data[kind])?data[kind]:[]){if(!Array.isArray(p)||p[0]<minX-MARGIN||p[0]>maxX+MARGIN||p[1]<minY-MARGIN||p[1]>maxY+MARGIN)continue;const pr=locate(p);if(pr.distance<=(kind==='toll'?30:tolerance))hits.push({kind,along:pr.along,count:1,key:kind+':'+p[0]+','+p[1]})}
 hits.sort((a,b)=>a.along-b.along);
 const out=[];for(const h of hits){const last=out.at(-1);if(last&&last.kind===h.kind&&h.along-last.along<(h.kind==='bump'?80:60)){last.count++}else out.push(h)}
 return out;
}
function describe(h,remaining,i18n){
 const plain=(key,vars)=>vars?key.replace(/\{(\w+)\}/g,(x,k)=>k in vars?vars[k]:x):key,t=i18n?.t||plain,s=i18n?.s||plain,m=Math.max(10,Math.round(remaining/10)*10);
 const words={toll:['Toll plaza ahead','Toll plaza ahead, in {m} metres.'],rail:['Railway crossing ahead','Railway crossing ahead, in {m} metres. Slow down.'],bump:h.count>1?['Speed bumps ahead','Speed bumps ahead, in {m} metres.']:['Speed bump ahead','Speed bump ahead, in {m} metres.'],curve:h.side==='left'?['Sharp curve to the left','Sharp curve to the left, in {m} metres.']:['Sharp curve to the right','Sharp curve to the right, in {m} metres.']}[h.kind];
 return {text:t(words[0])+' · '+m+' m',voice:s(words[1],{m})};
}
function upcoming(items,along){return items.map(h=>({...h,remaining:h.along-along})).filter(h=>h.remaining>0&&h.remaining<=RANGE[h.kind]).sort((a,b)=>a.remaining-b.remaining)[0]||null}
if(typeof module==='object')module.exports={curves,pointsOnRoute,describe,upcoming,cumulative,RANGE,routeProjector};
if(!root.document)return;
const $=id=>document.getElementById(id),TTL=86400000,URL='/hazards.json?rev='+DATA_REV,CACHE='lapan-hazards-v1';
let data=null,route=null,items=[],warned=new Set(),enabled=true,loading=null,loadedAt=0,active=false,controller=null,locate=null,prepared=null;
try{enabled=localStorage.getItem('lapan-hazard-alerts')!=='off'}catch{}
function hide(){prepared=null;if(root.LapanHazards)root.LapanHazards.remaining=null;$('hazardWarning')?.classList.add('hidden')}
function valid(d){return d&&['toll','rail','bump'].every(k=>Array.isArray(d[k])&&d[k].length<=50000&&d[k].every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=99&&p[0]<=120&&p[1]>=.8&&p[1]<=7.6))}
function info(d){$('hazardInfo').textContent='Toll plazas, railway crossings and speed bumps are mapped by OpenStreetMap contributors (data '+String(d.dataThrough||'date unknown').slice(0,10)+'); only a share of them is mapped. Sharp curves are found from the route shape. Never rely on this alone.'}
async function load(){
 if(!enabled||!active||document.visibilityState==='hidden')return;
 if(loading)return loading;if(data&&Date.now()-loadedAt<TTL)return;
 const ctrl=new AbortController();controller=ctrl;
 loading=(async()=>{let cache;try{
  try{cache=await root.caches?.open(CACHE);const saved=await cache?.match(URL);if(saved){const at=Number(saved.headers.get('X-Lapan-Cached-At')),d=await saved.json();if(at>0&&at<=Date.now()&&Date.now()-at<TTL&&valid(d)){data=d;loadedAt=at;route=null;info(d);return}}}catch{}
  if(!active||!enabled||ctrl.signal.aborted||document.visibilityState==='hidden')return;
  const response=await fetch(URL,{signal:ctrl.signal,cache:'default'});if(!response.ok)throw Error();const text=await response.text();if(text.length>2000000)throw Error();const d=JSON.parse(text);if(!valid(d))throw Error();
  if(ctrl.signal.aborted)return;data=d;loadedAt=Date.now();route=null;info(d);
  if(cache)try{await cache.put(URL,new Response(text,{headers:{'Content-Type':'application/json','X-Lapan-Cached-At':String(loadedAt)}}));for(const key of await cache.keys())if(new globalThis.URL(key.url).search!==new globalThis.URL(URL,'https://lapan.invalid').search)await cache.delete(key)}catch{}
 }catch(e){if(e.name!=='AbortError')$('hazardInfo').textContent='Mapped hazard data could not load. Route-shape curve alerts remain available. Try again by switching road hazard alerts off and on during navigation.'}
 finally{if(controller===ctrl)controller=null;loading=null}})();return loading;
}
function resumeLoad(){return loading&&controller?.signal.aborted?loading.then(()=>active&&enabled&&load()):load()}
function stop(){active=false;controller?.abort();hide();route=null;locate=null;warned.clear()}
function prepare(fix,nextRoute){
 prepared=null;root.LapanHazards.remaining=null;
 const coords=nextRoute?.geometry?.coordinates;
 if(!active||!enabled||document.visibilityState==='hidden'||!coords?.length||!Number.isFinite(fix.coords.accuracy)||fix.coords.accuracy>60){hide();return null}
 if(route!==nextRoute){route=nextRoute;locate=routeProjector(coords);items=[...pointsOnRoute(data||{},nextRoute,20,locate),...curves(nextRoute,60,locate)].sort((a,b)=>a.along-b.along)}
 const here=locate([fix.coords.longitude,fix.coords.latitude]);if(here.distance>45){hide();return null}
 const next=upcoming(items,here.along);if(!next){hide();return null}
 root.LapanHazards.remaining=next.remaining;prepared={fix,nextRoute,next};return next;
}
root.LapanHazards={stop,hide,remaining:null,start(){active=true;return resumeLoad()},prepare,update(fix,nextRoute){
 const next=prepared?.fix===fix&&prepared.nextRoute===nextRoute?prepared.next:prepare(fix,nextRoute);if(!next)return;
 const camera=root.LapanCameras.remaining;if(camera!=null&&camera<=next.remaining){$('hazardWarning').classList.add('hidden');return}
 $('cameraWarning').classList.add('hidden');const I=root.LapanI18n,alert=describe(next,next.remaining,I&&{t:(k,v)=>I.t(k,v),s:(k,v)=>I.speechLang()==='ms'?I.t(k,v):k.replace(/\{(\w+)\}/g,(x,n)=>n in(v||{})?v[n]:x)});
 $('hazardWarning').textContent=alert.text;$('hazardWarning').classList.remove('hidden');const key=next.kind+':'+Math.round(next.along);if(!warned.has(key)){warned.add(key);root.LapanVoice?.speak(alert.voice)}
}};
document.addEventListener('DOMContentLoaded',()=>{$('hazardAlerts').checked=enabled;$('hazardAlerts').onchange=()=>{enabled=$('hazardAlerts').checked;try{localStorage.setItem('lapan-hazard-alerts',enabled?'on':'off')}catch{}controller?.abort();hide();route=null;if(enabled&&active)resumeLoad()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')hide()});
})(typeof window==='object'?window:globalThis);
