(function(root){
// Rendering only: this module never fetches data or starts a timer.
const communityByRoute=new WeakMap();
const reportColors={'traffic-heavy':'#ff8c00','traffic-standstill':'#be123c'};
const REPORT_RADIUS_METRES=100;

function reportGeometry(coords,report){
 const {segment,fraction,lat}=report;
 const a=coords[segment],b=coords[segment+1],scale=Math.cos(lat*Math.PI/180);
 const interpolate=(from,to,t)=>[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t];
 const center=interpolate(a,b,fraction);
 function walk(index,step){
  const points=[];
  let remaining=REPORT_RADIUS_METRES,from=center;
  for(let i=index;i>=0&&i<coords.length;i+=step){
   const to=coords[i],metres=111320*Math.hypot((to[0]-from[0])*scale,to[1]-from[1]);
   if(!metres)continue;
   points.push(metres>=remaining?interpolate(from,to,remaining/metres):to);
   if(metres>=remaining)break;
   remaining-=metres;
   from=to;
  }
  return points;
 }
 return {type:'LineString',coordinates:[...walk(segment,-1).reverse(),center,...walk(segment+1,1)]};
}
function setCommunity(route,reports){
 if(!route?.geometry?.coordinates?.length)return;
 const coords=route.geometry.coordinates;
 const features=reports.filter(r=>Object.hasOwn(reportColors,r.kind)&&Number.isInteger(r.segment)&&coords[r.segment+1])
  .sort((a,b)=>(a.kind==='traffic-standstill')-(b.kind==='traffic-standstill'))
  .map(r=>({type:'Feature',properties:{color:reportColors[r.kind],severity:r.kind,community:true},geometry:reportGeometry(coords,r)}));
 if(!features.length&&!communityByRoute.has(route))return;
 if(features.length)communityByRoute.set(route,features);
 else communityByRoute.delete(route);
 for(const fn of listeners)fn(route);
}

const colors={moderate:'#FF8C00',heavy:'#dc2626'},listeners=new Set(),FRESH_MS=600000;
function providerFeatures(route,now){
 if(!['TomTom','HERE'].includes(route?.provider)||!Number.isFinite(Date.parse(route.trafficCheckedAt))||now-Date.parse(route.trafficCheckedAt)>=FRESH_MS||Date.parse(route.trafficCheckedAt)>now+60000)return {type:'FeatureCollection',features:[]};
 const sections=Array.isArray(route.trafficSections)?route.trafficSections:[];
 return {type:'FeatureCollection',features:sections.slice(0,2000).filter(s=>colors[s.severity]&&s.geometry?.type==='LineString'&&Array.isArray(s.geometry.coordinates)&&s.geometry.coordinates.length>=2&&s.geometry.coordinates.length<=20000&&s.geometry.coordinates.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=99&&p[0]<=120&&p[1]>=.8&&p[1]<=7.6)).sort((a,b)=>(a.severity==='heavy')-(b.severity==='heavy')).map(s=>({type:'Feature',properties:{color:colors[s.severity],severity:s.severity},geometry:s.geometry}))};
}
function features(route,now=Date.now()){
 const result=providerFeatures(route,now);
 result.features.push(...communityByRoute.get(route)||[]);
 return result;
}
let expiry=null;
const api={features,setCommunity,reportColors:Object.freeze(reportColors),reportRadiusMetres:REPORT_RADIUS_METRES,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)},changed(route){if(root.document&&root.setTimeout){root.clearTimeout(expiry);expiry=null;const until=Date.parse(route?.trafficCheckedAt)+FRESH_MS-Date.now();if(['TomTom','HERE'].includes(route?.provider)&&route.trafficSections?.length&&until>0&&until<=FRESH_MS)expiry=root.setTimeout(()=>{route.trafficSections=[];for(const fn of listeners)fn(route)},until)}for(const fn of listeners)fn(route)}};
root.LapanTrafficColors=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
