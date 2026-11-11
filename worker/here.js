// HERE Routing API v8 adapter. API credentials remain on the server.
const hereAlphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function decodeHerePolyline(encoded){
 if(typeof encoded!=='string'||encoded.length>1000000)throw Error('Invalid HERE polyline');let index=0;
 const unsigned=()=>{let result=0n,shift=0n;for(let n=0;n<13;n++){const value=hereAlphabet.indexOf(encoded[index++]);if(value<0)throw Error('Invalid HERE polyline');result|=BigInt(value&31)<<shift;if(!(value&32))return result;shift+=5n}throw Error('Invalid HERE polyline')};
 if(unsigned()!==1n)throw Error('Unsupported HERE polyline');const header=Number(unsigned()),precision=header&15,third=(header>>4)&7;if(third!==0||precision>7)throw Error('Unsupported HERE polyline dimensions');
 const signed=()=>{const x=unsigned();return Number((x&1n)?-(x>>1n)-1n:x>>1n)};let lat=0,lon=0;const points=[],scale=10**precision;
 while(index<encoded.length){lat+=signed();lon+=signed();const p=[lon/scale,lat/scale];if(!routePoint(p)||points.length>=100000)throw Error('Invalid HERE route coordinates');points.push(p)}if(points.length<2)throw Error('Incomplete HERE route');return points;
}
const hereText=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,600):'';
function hereRoad(values){return Array.isArray(values)?[...new Set(values.map(v=>hereText(v?.value)).filter(Boolean))].join(';'):''}
function hereCritical(route){return [...(route.notices||[]),...(route.sections||[]).flatMap(s=>s.notices||[])].some(n=>n.severity==='critical'||/violated(BlockedRoad|Avoid|TurnRestriction|TransportMode|VehicleRestriction)|forbidden/i.test(n.code||''))}
function normalizeHereRoute(route,checkedAt){
 if(!route||!Array.isArray(route.sections)||!route.sections.length||route.sections.length>100||hereCritical(route))throw Error('HERE route violates a road restriction');
 let duration=0,distance=0,baseDuration=0,baseKnown=true;const coordinates=[],legs=[],trafficSections=[];
 const types={depart:'depart',arrive:'arrive',turn:'turn',continue:'continue',keep:'fork',merge:'merge',exit:'off ramp',ramp:'on ramp',uturn:'turn',uTurn:'turn',enterHighway:'on ramp',continueHighway:'continue',roundaboutEnter:'roundabout',roundaboutExit:'exit roundabout',roundaboutPass:'roundabout'};
 for(const section of route.sections){
  if(section.type!=='vehicle')throw Error('Unsupported HERE route section');const summary=section.summary,points=decodeHerePolyline(section.polyline),actions=section.turnByTurnActions;
  if(!summary||!Number.isFinite(summary.duration)||summary.duration<=0||!Number.isFinite(summary.length)||summary.length<=0||!Array.isArray(actions)||actions.length<2||actions.length>10000)throw Error('Incomplete HERE guidance');
  if(actions[0].action!=='depart'||actions[0].offset!==0||actions.at(-1).action!=='arrive'||actions.at(-1).offset!==points.length-1)throw Error('Missing HERE endpoints');
  duration+=summary.duration;distance+=summary.length;if(Number.isFinite(summary.baseDuration)&&summary.baseDuration>=0)baseDuration+=summary.baseDuration;else baseKnown=false;
  const steps=actions.map((a,n)=>{const next=actions[n+1];if(!Object.hasOwn(types,a.action)||!Number.isInteger(a.offset)||a.offset<0||a.offset>=points.length||(n&&a.offset<actions[n-1].offset)||!Number.isFinite(a.duration)||a.duration<0||!Number.isFinite(a.length)||a.length<0)throw Error('Invalid HERE action');const road=a.nextRoad||a.currentRoad||{},middle=['keep','ramp','enterHighway','continueHighway'].includes(a.action)&&a.direction==='middle',modifier=['uturn','uTurn'].includes(a.action)?'uturn':middle?'straight':a.direction||'straight';if(!['left','right','straight','uturn'].includes(modifier))throw Error('Unsupported HERE direction');return {name:hereRoad(road.name),ref:hereRoad(road.number),exits:hereText(a.exitNumber),destinations:hereRoad(a.signpost?.labels?.map(l=>({value:l.text}))),distance:a.length,duration:a.duration,instruction:'',geometry:{type:'LineString',coordinates:points.slice(a.offset,next?next.offset+1:a.offset+1)},maneuver:{location:points[a.offset],type:types[a.action],modifier,...(middle?{branch:'middle'}:{}),...(Number.isInteger(a.exit)&&a.exit>0?{exit:a.exit}:{})}}});
  const actionTime=steps.reduce((n,s)=>n+s.duration,0),actionLength=steps.reduce((n,s)=>n+s.distance,0);if(Math.abs(actionTime-summary.duration)>Math.max(30,summary.duration*.05)||Math.abs(actionLength-summary.length)>Math.max(50,summary.length*.05))throw Error('Incomplete HERE action totals');
  legs.push({steps});for(const p of points){if(!coordinates.length||coordinates.at(-1)[0]!==p[0]||coordinates.at(-1)[1]!==p[1])coordinates.push(p);if(coordinates.length>100000)throw Error('HERE route too large')}
  const spans=Array.isArray(section.spans)?section.spans:[];let budget=20000;
  for(let i=0;i<Math.min(spans.length,2000);i++){const s=spans[i],end=spans[i+1]?.offset??points.length-1,d=s.dynamicSpeedInfo;if(!Number.isInteger(s.offset)||!Number.isInteger(end)||s.offset<0||end>=points.length||end<=s.offset||!Number.isFinite(d?.baseSpeed)||d.baseSpeed<=0||!Number.isFinite(d?.trafficSpeed)||d.trafficSpeed<0||!(s.length>=50))continue;const ratio=d.trafficSpeed/d.baseSpeed,severity=ratio<.3?'heavy':ratio<.65?'moderate':null,c=points.slice(s.offset,end+1);if(severity&&c.length<=budget){budget-=c.length;trafficSections.push({severity,geometry:{type:'LineString',coordinates:c}})}}
 }
 if(globalThis.LapanRoadRestrictions.blocked(coordinates))throw Error('HERE route crosses a reported restriction');
 return {provider:'HERE',duration,distance,geometry:{type:'LineString',coordinates},legs,trafficSections:trafficSections.slice(0,2000),trafficCheckedAt:checkedAt,closureCheckedAt:checkedAt,trafficDelay:baseKnown?Math.max(0,duration-baseDuration):null,tollEstimate:null,hereRouteHandle:typeof route.routeHandle==='string'&&route.routeHandle.length<=100000?route.routeHandle:null};
}
// Adapt HERE geometry/toll flags to the existing local Class 1 fare matcher.
// Never ask HERE for toll prices; no second route, route import or toll API call.
function hereTollRoute(raw){
 const points=[],sections=[],instructions=[];
 for(const section of raw.sections){
  const coords=decodeHerePolyline(section.polyline),base=points.length;points.push(...coords.map(([longitude,latitude])=>({longitude,latitude})));
  for(const a of section.turnByTurnActions||[]){const road=a.nextRoad||a.currentRoad||{};instructions.push({pointIndex:base+a.offset,street:hereRoad(road.name),roadNumbers:Array.isArray(road.number)?road.number.map(n=>hereText(n.value)).filter(Boolean):[]})}
  const spans=section.spans;if(!Array.isArray(spans)||spans.length>100000)continue;
  // An invalid span layout is not evidence of toll-free roads or priced coverage.
  if(spans.some((span,i)=>!Number.isInteger(span.offset)||span.offset<0||span.offset>=coords.length||(i&&span.offset<=spans[i-1].offset)))continue;
  for(let i=0;i<spans.length;i++){
   const span=spans[i],end=spans[i+1]?.offset??coords.length-1;
   if(end<=span.offset||!Array.isArray(span.carAttributes)||!span.carAttributes.includes('tollRoad'))continue;
   const startPointIndex=base+span.offset,endPointIndex=base+end,last=sections.at(-1);
   if(last&&last.endPointIndex===startPointIndex)last.endPointIndex=endPointIndex;
   else sections.push({sectionType:'TOLL',startPointIndex,endPointIndex});
  }
 }
 return {provider:'HERE',legs:[{points}],sections,guidance:{instructions}};
}
async function hereLocalTolls(raw,estimateTolls){
 const empty={status:'unavailable',currency:'MYR',vehicleClass:1,amount:null,items:[],basis:'local-fares',note:'Local Class 1 fare coverage is incomplete. Missing prices never mean toll-free.'};
 try{
  const route=hereTollRoute(raw);if(!route.sections.length)return empty;
  const toll=await estimateTolls(route);if(!toll)return empty;
  const known=(toll.items||[]).filter(i=>Number.isFinite(i.amount)&&i.amount>0),amount=Math.round(known.reduce((n,i)=>n+i.amount,0)*100)/100;
  // Even a matched subtotal cannot prove every Malaysian toll was identified.
  if(!known.length||!Number.isFinite(amount)||amount<=0)return {...toll,...empty,items:toll.items||[]};
  return {...toll,status:'partial',currency:'MYR',vehicleClass:1,amount,basis:'local-fares',note:empty.note};
 }catch{return empty}
}
const hereFailures={HERE_AUTH:'HERE rejected the API key. Check the configured HERE credentials.',HERE_ACCESS:'HERE Routing access is denied. Check the linked service and project permissions.',HERE_REQUEST:'HERE rejected the routing request. Please retry or choose another point.',HERE_GUIDANCE:'HERE returned guidance Lapan cannot use. Please try another route.',HERE_NO_ROUTE:'HERE could not return a usable road route between these points.',HERE_LIMIT:'HERE request allowance or rate limit reached. Please wait before retrying.'};
const herePending=new Map(),hereCache=new Map(),hereClients=new Map();let hereInFlight=0,herePauseUntil=0;
async function hereLimited(request,env,purpose,key,refresh,run){
 const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store'}}),now=Date.now();
 if(!env.HERE_API_KEY)return json({error:'HERE is not configured. OSRM fallback is available.',allowBasic:true},503);
 if(now<herePauseUntil)return json({error:'HERE is temporarily limited.',allowBasic:true},429);
 const cached=hereCache.get(key);if(refresh)hereCache.delete(key);if(!refresh&&cached&&now-cached.at<(purpose==='planning'?120000:30000))return json(cached.data);if(herePending.has(key))return (await herePending.get(key)).clone();
 const ip=request.headers.get('cf-connecting-ip')||'anonymous',c=hereClients.get(ip);if(hereInFlight>=4||(c&&now-c.at<60000&&c.count>=15))return json({error:'HERE routing is busy. Try again shortly.',allowBasic:true},429);
 hereClients.set(ip,c&&now-c.at<60000?{at:c.at,count:c.count+1}:{at:now,count:1});if(hereClients.size>1000)hereClients.delete(hereClients.keys().next().value);hereInFlight++;
 const work=(async()=>{try{const data=await run();hereCache.set(key,{at:Date.now(),data});if(hereCache.size>20)hereCache.delete(hereCache.keys().next().value);return json(data)}catch(e){if(e.noTollRoute)return json({error:'No route avoiding tolls was found. Try Faster or change your starting point or destination.',allowBasic:false},422);const code=Object.hasOwn(hereFailures,e.code||'')?e.code:'HERE_UNAVAILABLE';return json({error:e.restricted?'HERE returned a route violating a road restriction. Choose another point.':hereFailures[code]||'HERE routing is temporarily unavailable. Please retry.',code,allowBasic:!e.restricted},e.restricted?422:502)}finally{hereInFlight--}})();herePending.set(key,work);try{return (await work).clone()}finally{herePending.delete(key)}
}
async function fetchHere(url,env,purpose,timeout=18000){await globalThis.LapanHereUsage?.record(env,purpose);const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(response.status===429)herePauseUntil=Date.now()+Math.max(30,Math.min(300,Number(response.headers.get('Retry-After'))||60))*1000;if(!response.ok)throw Object.assign(Error('HERE unavailable'),{code:({400:'HERE_REQUEST',401:'HERE_AUTH',403:'HERE_ACCESS',429:'HERE_LIMIT'})[response.status]||'HERE_UNAVAILABLE'});return response.json()}
function hereParameters(url,env,vehicle='car',localTolls=false){for(const [key,value]of Object.entries({apiKey:env.HERE_API_KEY,transportMode:vehicle==='motorcycle'?'scooter':'car',routingMode:'fast',return:'polyline,summary,turnByTurnActions,routeHandle',spans:'dynamicSpeedInfo,length'+(localTolls?',carAttributes':''),lang:'en-GB'}))url.searchParams.set(key,value);if(vehicle==='motorcycle'){url.searchParams.set('scooter[allowHighway]','true');url.searchParams.set('vehicle[speedCap]','30.555556')}const areas=globalThis.LapanRoadRestrictions.list();if(areas.length)url.searchParams.set('avoid[areas]',areas.map(r=>'bbox:'+r.west+','+r.south+','+r.east+','+r.north).join('|'));return url}
export async function planHereRoute(request,env,body,estimateTolls=async()=>null){
 const avoidTolls=body.avoidTolls===true;
 const key='route:'+JSON.stringify({from:body.from,to:body.to,alternatives:body.alternatives,vehicle:body.vehicle||'car',avoidTolls});return hereLimited(request,env,body.purpose||'planning',key,body.refresh===true,async()=>{
  const url=hereParameters(new URL('https://router.hereapi.com/v8/routes'),env,body.vehicle,body.vehicle!=='motorcycle'||avoidTolls);url.searchParams.set('origin',body.from[1]+','+body.from[0]);url.searchParams.set('destination',body.to[1]+','+body.to[0]);url.searchParams.set('alternatives',body.alternatives?'2':'0');if(avoidTolls)url.searchParams.set('avoid[features]','tollRoad');const raw=await fetchHere(url,env,body.purpose||'planning',avoidTolls?12000:18000),checkedAt=new Date().toISOString(),routes=[];let guidanceFailure=false;
  const topNotices=raw.notices||[];
  if(avoidTolls&&topNotices.some(n=>n.code==='noRouteFound'))throw Object.assign(Error('No toll-avoiding route'),{noTollRoute:true});
  if(topNotices.some(n=>n.severity==='critical'||n.code==='noRouteFound'))throw Object.assign(Error('No permitted HERE route'),{restricted:true});
  for(const route of (raw.routes||[]).slice(0,3)){
   if(hereCritical(route)){if(!avoidTolls&&!routes.length)throw Object.assign(Error('Restricted'),{restricted:true});continue}
   if(avoidTolls&&route.sections?.some(section=>section.spans?.some(span=>span.carAttributes?.includes('tollRoad'))))continue;
   try{const normalized={...normalizeHereRoute(route,checkedAt),vehicle:body.vehicle||'car'};if(body.vehicle!=='motorcycle')normalized.tollEstimate=await hereLocalTolls(route,estimateTolls);routes.push(normalized)}catch(e){guidanceFailure=true;if(/restriction/.test(e.message))throw Object.assign(e,{restricted:true})}
  }
  if(avoidTolls&&!routes.length&&!guidanceFailure)throw Object.assign(Error('No toll-avoiding route'),{noTollRoute:true});
  if(!routes.length)throw Object.assign(Error('No usable HERE route'),{code:guidanceFailure?'HERE_GUIDANCE':'HERE_NO_ROUTE'});return {code:'Ok',source:'HERE',checkedAt,routes};
 });
}
export async function hereTraffic(request,env,body){
 const u=new URL(request.url);if(request.method!=='POST'||(request.headers.get('origin')&&request.headers.get('origin')!==u.origin))return Response.json({error:'Request not allowed'},{status:403});
 const coords=body.coordinates,handle=body.hereRouteHandle;if(!Array.isArray(coords)||coords.length<2||coords.length>20000||!coords.every(routePoint)||typeof handle!=='string'||!handle.length||handle.length>100000||!/^[A-Za-z0-9_~.\-]+$/.test(handle))return Response.json({error:'HERE route handle or geometry unavailable. Replan to update traffic.'},{status:400});
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([body.vehicle||'car',handle,coords]))),key='traffic:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return hereLimited(request,env,'traffic_refresh',key,false,async()=>{
  const url=hereParameters(new URL('https://router.hereapi.com/v8/routes/'+encodeURIComponent(handle)),env,body.vehicle);url.searchParams.delete('routingMode');const raw=await fetchHere(url,env,'traffic_refresh'),r=raw.routes?.[0];if(hereCritical(r||{}))throw Object.assign(Error('Restricted'),{restricted:true});const checkedAt=new Date().toISOString(),route=normalizeHereRoute(r,checkedAt),points=route.geometry.coordinates;
  // Re-evaluating a handle must not substitute a different road. Bound matching work.
  let samples=0,misses=0;const stride=Math.max(1,Math.ceil(coords.length/60));for(let i=0;i<coords.length;i+=stride){samples++;if(routeGap(coords[i],points)>75)misses++}if(misses>Math.max(1,samples*.05)||routeGap(coords.at(-1),points)>75)throw Error('HERE road mismatch');
  const pos=coords[0],cos=Math.cos(pos[1]*Math.PI/180);let best=null;const edges=[];
  for(const leg of route.legs)for(const step of leg.steps){const c=step.geometry.coordinates,lengths=c.slice(1).map((p,i)=>geoDistance(c[i],p)),sum=lengths.reduce((n,l)=>n+l,0);for(let i=0;i<lengths.length;i++)edges.push({a:c[i],b:c[i+1],seconds:sum?step.duration*lengths[i]/sum:0})}
  for(let i=0;i<edges.length;i++){const {a,b}=edges[i],ax=(a[0]-pos[0])*cos,ay=a[1]-pos[1],dx=(b[0]-a[0])*cos,dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),gap=Math.hypot(ax+dx*t,ay+dy*t)*111320;if(!best||gap<best.gap)best={i,t,gap}}
  if(!best||best.gap>75)throw Error('HERE start mismatch');const seconds=edges.slice(best.i+1).reduce((n,e)=>n+e.seconds,0)+edges[best.i].seconds*(1-best.t);
  return {seconds,delaySeconds:route.trafficDelay,trafficSections:route.trafficSections,checkedAt,source:'HERE',basis:'traffic-aware route estimate'};
 });
}
