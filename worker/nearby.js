const stopTypes={
 petrol:{tags:['amenity:fuel'],radius:12000,label:'Petrol station'},
 rest:{tags:['highway:services','highway:rest_area'],radius:45000,label:'R&R stop'},
 shopping:{tags:['shop:mall'],radius:20000,label:'Shopping centre'},
 prayer:{radius:12000,label:'Masjid / Surau'},
 rv:{}
};
const stopCache=new Map(), stopClients=new Map(), stopPending=new Map();
const stopFreshFor=300000, stopStaleFor=86400000;
const nearbyError='Nearby search is busy or unavailable. Please try again shortly.';

async function fetchStopElements(lat,lon,spec,timeouts){
 const url=new URL('https://photon.komoot.io/reverse');
 for(const [key,value] of Object.entries({lat,lon,radius:spec.radius/1000,limit:50}))url.searchParams.set(key,value);
 for(const tag of spec.tags)url.searchParams.append('osm_tag',tag);
 // Retry transient failures once. An explicit upstream rejection should not trigger a retry.
 for(const timeout of timeouts){
  try{
   const response=await fetch(url.toString(),{
    headers:{'User-Agent':'Lapan/1.0 (https://lapan-malaysia.com)'},signal:AbortSignal.timeout(timeout)
   });
   if(!response.ok){
    if(response.status>=500||response.status===408)continue;
    break;
   }
   const data=await response.json();
   if(!Array.isArray(data.features))continue;
   const elements=[];
   for(const feature of data.features){
    const properties=feature?.properties, point=feature?.geometry?.coordinates;
    if(!spec.tags.includes(properties?.osm_key+':'+properties?.osm_value)||
      !Array.isArray(point)||!Number.isFinite(point[0])||!Number.isFinite(point[1]))continue;
    elements.push({type:properties.osm_type,id:properties.osm_id,lat:point[1],lon:point[0],
     tags:{name:properties.name,'addr:street':properties.street,'addr:city':properties.city}});
   }
   return elements;
  }catch{/* A network or response parsing failure can clear on retry. */}
 }
 throw Error(nearbyError);
}

function stopDistance(a,b){const r=Math.PI/180,x=(b[1]-a[1])*r*Math.cos((a[0]+b[0])/2*r),y=(b[0]-a[0])*r;return Math.hypot(x,y)*6371000}
export async function nearbyStops(request,prayerData=null,directory=null,rvStops=[]){
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});if(request.method!=='GET')return json({error:'GET required'},405);
const u=new URL(request.url),kind=u.searchParams.get('kind'),spec=Object.hasOwn(stopTypes,kind)?stopTypes[kind]:null,lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
const browseRv=kind==='rv'&&!u.searchParams.has('lat')&&!u.searchParams.has('lon');
if(!browseRv&&(!spec||!u.searchParams.has('lat')||!u.searchParams.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<.8||lat>7.6||lon<99||lon>120))return json({error:'Choose a category and a location in Malaysia.'},400);
if(kind==='rv'){
 const use=u.searchParams.get('use')??'all';
 if(!['all','day','overnight'].includes(use))return json({error:'Choose All RV stops, Day Rest or Overnight Stay.'},400);
 const items=rvStops.filter(place=>use==='all'||place.uses.includes(use))
  .map(place=>({...place,distance:browseRv?null:Math.round(stopDistance([lat,lon],[place.lat,place.lon]))}))
  .sort(browseRv?(a,b)=>a.name.localeCompare(b.name):(a,b)=>a.distance-b.distance);
 return json({items,kind});
}
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
const directoryItems=[];
for(const [name,y,x,address] of directory?.categories?.[kind]||[]){
 if(!Number.isFinite(y)||!Number.isFinite(x)||Math.abs(y-lat)>spec.radius/110000||Math.abs(x-lon)>spec.radius/109000)continue;
 const distance=stopDistance([lat,lon],[y,x]);
 if(distance>spec.radius)continue;
 directoryItems.push({id:'directory/'+y+'/'+x+'/'+name,name,lat:y,lon:x,address,distance:Math.round(distance)});
}
directoryItems.sort((a,b)=>a.distance-b.distance);
const directoryMatches=[];
for(const item of directoryItems){
 if(directoryMatches.some(p=>p.name.toLowerCase()===item.name.toLowerCase()&&
   stopDistance([p.lat,p.lon],[item.lat,item.lon])<200))continue;
 directoryMatches.push(item);
 if(directoryMatches.length===15)break;
}
const directoryResponse=()=>json({items:directoryMatches,radius:spec.radius,kind,
 source:'Overture Maps contributors',directoryFallback:true,dataAsOf:directory.release});
const key=kind+':'+lat.toFixed(3)+':'+lon.toFixed(3);
const now=Date.now(), cached=stopCache.get(key);
let elements=cached&&now-cached.time<stopFreshFor?cached.elements:null;
const stale=cached&&now-cached.time<stopStaleFor?cached.elements:null;
if(!elements){
 let pending=stopPending.get(key);
 if(!pending){
  const ip=request.headers.get('cf-connecting-ip')||'anonymous';
  const client=stopClients.get(ip);
  const recent=client&&now-client.at<60000;
  if((recent&&client.n>=20)||stopPending.size>=4){
   if(!stale?.length&&directoryMatches.length)return directoryResponse();
   if(!stale)return json({error:'Nearby search is busy. Please try again shortly.'},429);
   elements=stale;
  }else{
   stopClients.set(ip,recent?{at:client.at,n:client.n+1}:{at:now,n:1});
   if(stopClients.size>1000)stopClients.delete(stopClients.keys().next().value);
   pending=fetchStopElements(lat,lon,spec,directoryMatches.length?[4000]:[9000,6000]).then(results=>{
    stopCache.delete(key);
    stopCache.set(key,{elements:results,time:Date.now()});
    if(stopCache.size>100)stopCache.delete(stopCache.keys().next().value);
    return results;
   }).finally(()=>stopPending.delete(key));
   stopPending.set(key,pending);
  }
 }
 if(pending){
  try{elements=await pending}
  catch{
   if(!stale?.length&&directoryMatches.length)return directoryResponse();
   if(!stale)return json({error:nearbyError},502);
   elements=stale;
  }
 }
}
const items=[];for(const e of elements){const y=e.lat??e.center?.lat,x=e.lon??e.center?.lon;if(!Number.isFinite(y)||!Number.isFinite(x)||y<.8||y>7.6||x<99||x>120)continue;const t=e.tags||{},name=String(t.name||t['name:en']||t.brand||t.operator||spec.label).slice(0,180),distance=stopDistance([lat,lon],[y,x]);if(distance>spec.radius)continue;if(items.some(p=>p.name===name&&stopDistance([p.lat,p.lon],[y,x])<200))continue;items.push({id:e.type+'/'+e.id,name,lat:y,lon:x,distance:Math.round(distance),brand:String(t.brand||t.operator||'').slice(0,100),address:[t['addr:street'],t['addr:city']].filter(Boolean).join(', ').slice(0,200)})}
items.sort((a,b)=>a.distance-b.distance);
if(!items.length&&directoryMatches.length)return directoryResponse();
return json({items:items.slice(0,15),radius:spec.radius,source:'OpenStreetMap contributors',kind});
}
