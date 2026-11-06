(function(root){
// Rendering only: this module never fetches data or starts a timer.
const colors={moderate:'#FF8C00',heavy:'#dc2626'},listeners=new Set(),FRESH_MS=600000;
function features(route,now=Date.now()){
 if(!['TomTom','HERE'].includes(route?.provider)||!Number.isFinite(Date.parse(route.trafficCheckedAt))||now-Date.parse(route.trafficCheckedAt)>=FRESH_MS||Date.parse(route.trafficCheckedAt)>now+60000)return {type:'FeatureCollection',features:[]};
 const sections=Array.isArray(route.trafficSections)?route.trafficSections:[];
 return {type:'FeatureCollection',features:sections.slice(0,2000).filter(s=>colors[s.severity]&&s.geometry?.type==='LineString'&&Array.isArray(s.geometry.coordinates)&&s.geometry.coordinates.length>=2&&s.geometry.coordinates.length<=20000&&s.geometry.coordinates.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=99&&p[0]<=120&&p[1]>=.8&&p[1]<=7.6)).sort((a,b)=>(a.severity==='heavy')-(b.severity==='heavy')).map(s=>({type:'Feature',properties:{color:colors[s.severity],severity:s.severity},geometry:s.geometry}))};
}
let expiry=null;
const api={features,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)},changed(route){if(root.document&&root.setTimeout){root.clearTimeout(expiry);expiry=null;const until=Date.parse(route?.trafficCheckedAt)+FRESH_MS-Date.now();if(['TomTom','HERE'].includes(route?.provider)&&route.trafficSections?.length&&until>0&&until<=FRESH_MS)expiry=root.setTimeout(()=>{route.trafficSections=[];for(const fn of listeners)fn(route)},until)}for(const fn of listeners)fn(route)}};
root.LapanTrafficColors=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
