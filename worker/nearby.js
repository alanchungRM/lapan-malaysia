const stopTypes={petrol:{filter:'nwr[amenity=fuel]',radius:12000,label:'Petrol station'},rest:{filter:'nwr[highway~"^(services|rest_area)$"]',radius:45000,label:'R&R stop'},shopping:{filter:'nwr[shop=mall]',radius:20000,label:'Shopping centre'},prayer:{radius:12000,label:'Masjid / Surau'}};
const stopCache=new Map(),stopClients=new Map();let stopInFlight=0;
function stopDistance(a,b){const r=Math.PI/180,x=(b[1]-a[1])*r*Math.cos((a[0]+b[0])/2*r),y=(b[0]-a[0])*r;return Math.hypot(x,y)*6371000}
export async function nearbyStops(request,prayerData=null){
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});if(request.method!=='GET')return json({error:'GET required'},405);
const u=new URL(request.url),kind=u.searchParams.get('kind'),spec=Object.hasOwn(stopTypes,kind)?stopTypes[kind]:null,lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
if(!spec||!u.searchParams.has('lat')||!u.searchParams.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<.8||lat>7.6||lon<99||lon>120)return json({error:'Choose a category and a location in Malaysia.'},400);
// Prayer locations use a packaged Malaysia OSM snapshot, never a paid search or public API per visitor.
if(kind==='prayer'){
 if(!Array.isArray(prayerData?.places))return json({error:'Prayer-place data is temporarily unavailable. Please try again later.'},503);
 const items=[];for(const p of prayerData.places){
  if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat<.8||p.lat>7.6||p.lon<99||p.lon>120||['private','no'].includes(p.access))continue;
  const distance=stopDistance([lat,lon],[p.lat,p.lon]);if(distance>spec.radius)continue;
  const normal=name=>String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();const name=normal(p.name);
  if(items.some(x=>{const other=normal(x.name),same=other===name||(Math.min(other.length,name.length)>=10&&(other.startsWith(name+' ')||name.startsWith(other+' ')));return x.id===p.id||(same&&stopDistance([x.lat,x.lon],[p.lat,p.lon])<100)}))continue;
  items.push({id:p.id,name:p.name,lat:p.lat,lon:p.lon,distance:Math.round(distance),address:p.address||'',openingHours:p.openingHours||'',access:p.access||''});
 }
 items.sort((a,b)=>a.distance-b.distance);return json({items:items.slice(0,15),radius:spec.radius,source:prayerData.source,kind,dataAsOf:prayerData.dataAsOf});
}
const key=kind+':'+lat.toFixed(3)+':'+lon.toFixed(3),cached=stopCache.get(key);let elements,counted=false;
try{if(cached&&Date.now()-cached.time<300000)elements=cached.elements;else{const ip=request.headers.get('cf-connecting-ip')||'anonymous',now=Date.now(),client=stopClients.get(ip);if((client&&now-client.at<60000&&client.n>=20)||stopInFlight>=4)return json({error:'Nearby search is busy. Please try again shortly.'},429);stopClients.set(ip,client&&now-client.at<60000?{at:client.at,n:client.n+1}:{at:now,n:1});if(stopClients.size>1000)stopClients.delete(stopClients.keys().next().value);stopInFlight++;counted=true;const url=new URL('https://photon.komoot.io/reverse');for(const [k,v]of Object.entries({lat,lon,radius:spec.radius/1000,limit:50}))url.searchParams.set(k,v);const tags=kind==='petrol'?['amenity:fuel']:kind==='shopping'?['shop:mall']:['highway:services','highway:rest_area'];tags.forEach(tag=>url.searchParams.append('osm_tag',tag));const r=await fetch(url.toString(),{headers:{'User-Agent':'Lapan/1.0 (https://lapan-malaysia.com)'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.features))throw Error();elements=data.features.filter(f=>tags.includes(f.properties?.osm_key+':'+f.properties?.osm_value)).map(f=>({type:f.properties.osm_type,id:f.properties.osm_id,lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],tags:{name:f.properties.name,'addr:street':f.properties.street,'addr:city':f.properties.city}}));stopCache.set(key,{elements,time:Date.now()});if(stopCache.size>100)stopCache.delete(stopCache.keys().next().value)}
const items=[];for(const e of elements){const y=e.lat??e.center?.lat,x=e.lon??e.center?.lon;if(!Number.isFinite(y)||!Number.isFinite(x)||y<.8||y>7.6||x<99||x>120)continue;const t=e.tags||{},name=String(t.name||t['name:en']||t.brand||t.operator||spec.label).slice(0,180),distance=stopDistance([lat,lon],[y,x]);if(distance>spec.radius)continue;if(items.some(p=>p.name===name&&stopDistance([p.lat,p.lon],[y,x])<200))continue;items.push({id:e.type+'/'+e.id,name,lat:y,lon:x,distance:Math.round(distance),brand:String(t.brand||t.operator||'').slice(0,100),address:[t['addr:street'],t['addr:city']].filter(Boolean).join(', ').slice(0,200)})}
items.sort((a,b)=>a.distance-b.distance);return json({items:items.slice(0,15),radius:spec.radius,source:'OpenStreetMap contributors',kind});
}catch{return json({error:'Nearby search is busy or unavailable. Please try again shortly.'},502)}finally{if(counted)stopInFlight--}
}
