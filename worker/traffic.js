let trafficProviderPauseUntil=0;
// Server-only TomTom route reassessment. Never include API keys in client assets.
const trafficCache=new Map(),trafficClients=new Map();let trafficInFlight=0;
const geoDistance=(a,b)=>Math.hypot((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1])*111320;
function routeGap(p,coords){let best=Infinity;const cos=Math.cos(p[1]*Math.PI/180);for(let i=0;i<coords.length-1;i++){const a=coords[i],b=coords[i+1],ax=(a[0]-p[0])*cos,ay=a[1]-p[1],dx=(b[0]-a[0])*cos,dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy)*111320)}return best}
export async function trafficETA(request,env={}){
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}}),u=new URL(request.url);
if(request.method!=='POST')return json({error:'POST required'},405);
if(request.headers.get('origin')&&request.headers.get('origin')!==u.origin)return json({error:'Origin not allowed'},403);
if(!env.TOMTOM_API_KEY)return json({error:'Traffic service is not configured. Road estimate remains available.'},503);
let coords;try{const raw=await request.text();if(raw.length>1000000)throw Error();coords=JSON.parse(raw).coordinates;if(!Array.isArray(coords)||coords.length<2||coords.length>20000||!coords.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=99&&p[0]<=120&&p[1]>=.8&&p[1]<=7.6))throw Error()}catch{return json({error:'Invalid Malaysian route geometry'},400)}
if(Date.now()<trafficProviderPauseUntil)return json({error:'Traffic refresh temporarily limited. Using road estimate.'},429);
const signature=JSON.stringify(coords),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)),key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),cached=trafficCache.get(key);
if(cached&&Date.now()-cached.at<120000)return json(cached.data);
const ip=request.headers.get('cf-connecting-ip')||'anonymous',now=Date.now(),client=trafficClients.get(ip);if(client&&now-client.at<60000&&client.count>=6)return json({error:'Traffic refresh limit reached. Using road estimate.'},429);if(trafficInFlight>=2)return json({error:'Traffic service busy. Using road estimate.'},429);
trafficClients.set(ip,client&&now-client.at<60000?{at:client.at,count:client.count+1}:{at:now,count:1});if(trafficClients.size>1000)trafficClients.delete(trafficClients.keys().next().value);trafficInFlight++;
try{const first=coords[0],last=coords.at(-1),url=new URL(`https://api.tomtom.com/routing/1/calculateRoute/${first[1]},${first[0]}:${last[1]},${last[0]}/json`);for(const [k,v]of Object.entries({key:env.TOMTOM_API_KEY,traffic:'true',departAt:'now',computeTravelTimeFor:'all',routeRepresentation:'polyline',reconstructionMode:'normal',maxAlternatives:'0',travelMode:'car'}))url.searchParams.set(k,v);
const response=await fetch(url.toString(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supportingPoints:coords.map(p=>({latitude:p[1],longitude:p[0]}))}),signal:AbortSignal.timeout(18000)});
if(response.status===429)trafficProviderPauseUntil=Date.now()+Math.max(30,Math.min(300,Number(response.headers.get('Retry-After'))||60))*1000;
if(!response.ok)return json({error:response.status===401||response.status===403?'Traffic key access is unavailable. Using road estimate.':response.status===429?'Traffic allowance or request limit reached. Using road estimate.':'Traffic provider unavailable. Using road estimate.'},502);
const result=await response.json(),route=result.routes?.[0],s=route?.summary,seconds=s?.liveTrafficIncidentsTravelTimeInSeconds??s?.travelTimeInSeconds,delaySeconds=s?.trafficDelayInSeconds??0;
if(!Number.isFinite(seconds)||seconds<0||seconds>604800||!Number.isFinite(delaySeconds)||delaySeconds<0)throw Error();
const points=(route.legs||[]).flatMap(l=>(l.points||[]).map(p=>[p.longitude,p.latitude]));if(points.length<2)throw Error();let misses=0,samples=0;const stride=Math.max(1,Math.floor(points.length/60));for(let i=0;i<points.length;i+=stride){samples++;if(routeGap(points[i],coords)>150)misses++}if(misses>Math.max(1,samples*.05))return json({error:'Traffic route differs from your selected road route. Using road estimate.'},422);
const data={seconds,delaySeconds,checkedAt:new Date().toISOString(),source:'TomTom',basis:'traffic-aware route estimate'};trafficCache.set(key,{at:Date.now(),data});if(trafficCache.size>100)trafficCache.delete(trafficCache.keys().next().value);return json(data);
}catch{return json({error:'Traffic estimate unavailable. Using road estimate.'},502)}finally{trafficInFlight--}
}
