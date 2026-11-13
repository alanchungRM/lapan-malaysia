function routeTrafficSections(route,points){
 const result=[];let budget=20000;
 for(const s of (Array.isArray(route.sections)?route.sections:[]).slice(0,2000)){
  const a=s.startPointIndex,b=s.endPointIndex;
  if(s.sectionType!=='TRAFFIC'||s.simpleCategory!=='JAM'||![a,b].every(Number.isInteger)||a<0||b>=points.length||b<=a)continue;
  const severity=s.magnitudeOfDelay===3?'heavy':[1,2].includes(s.magnitudeOfDelay)?'moderate':null;
  if(!severity)continue;
  const coordinates=points.slice(a,b+1);
  if(coordinates.length>budget||!coordinates.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=99&&p[0]<=120&&p[1]>=.8&&p[1]<=7.6))continue;
  budget-=coordinates.length;result.push({severity,geometry:{type:'LineString',coordinates}});
 }
 return result;
}
let routeProviderPauseUntil=0;
// Server-only live route planning. Keys never enter response payloads.
const liveRoutePending=new Map(),liveRouteCache=new Map(),liveRouteClients=new Map();let liveRouteInFlight=0;
const routePoint=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=99&&p[0]<=120&&p[1]>=.8&&p[1]<=7.6;
const routeText=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,600):'';
// OSM way 762748956 connects these one-way carriageways at the confirmed opening.
const bayuWest=[101.4507836,2.9773533],bayuEast=[101.4508994,2.9773543];
const bayuMetres=(a,b)=>111320*Math.hypot((a[0]-b[0])*.99865,a[1]-b[1]);
function applyBayuCrossover(route){
 const leg=route.legs?.[0],instructions=route.guidance?.instructions;
 if(route.legs?.length!==1||!Array.isArray(instructions)||!Array.isArray(leg.points))return route;
 const points=leg.points.map(p=>[p.longitude,p.latitude]);
 const gate=2.97732;
 const startLatitude=points[0]?.[1];
 const entryLatitude=startLatitude>=gate&&startLatitude<bayuWest[1]&&
  Math.abs(points[0][0]-bayuWest[0])<.00007?Math.min(bayuWest[1],startLatitude+.000001):gate;
 let entry=null,exit=null;
 for(let i=1;i<points.length;i++){
  const [a,b]=[points[i-1],points[i]];
  const northbound=b[1]>a[1],target=northbound?bayuWest:bayuEast;
  const latitude=northbound?entryLatitude:gate;
  if(northbound?!(a[1]<latitude&&b[1]>=latitude):!(a[1]>=latitude&&b[1]<latitude))continue;
  const fraction=(latitude-a[1])/(b[1]-a[1]);
  const crossing=[a[0]+(b[0]-a[0])*fraction,latitude];
  if(Math.abs(crossing[0]-target[0])>.00007)continue;
  if(northbound)entry={index:i,fraction,crossing};
  else if(entry){exit={index:i,fraction,crossing};break;}
 }
 if(!entry||!exit)return route;
 const first=entry.index,last=exit.index;
 const within=i=>i.pointIndex>=first&&i.pointIndex<last;
 const replaced=instructions.filter(within);
 const providerUTurn=replaced.some(i=>i.maneuver==='MAKE_UTURN');
 // TomTom can also cross the median, then loop around the adjacent streets.
 const firstTurn=replaced[0],lastTurn=replaced.at(-1);
 const crossesMedian=firstTurn?.maneuver==='TURN_RIGHT'&&lastTurn?.maneuver==='TURN_LEFT'&&
  bayuMetres(points[firstTurn.pointIndex],bayuWest)<=8&&
  Math.abs(points[lastTurn.pointIndex][0]-bayuEast[0])<=.00007&&
  points.slice(first,last).every(([lon,lat])=>lon>=101.45069&&lon<=101.45200&&lat>=gate&&lat<=2.97890);
 if((!providerUTurn&&!crossesMedian)||
    replaced.some(i=>/^DEPART|^ARRIVE|ROUNDABOUT|MOTORWAY|FREEWAY/.test(i.maneuver)))return route;
 const sections=route.sections||[];
 if(sections.some(s=>s.endPointIndex>=first&&s.startPointIndex<last&&
    (s.sectionType==='TOLL'||s.simpleCategory==='ROAD_CLOSURE')))return route;

 // Interpolate TomTom's route distance and time at the two cut points.
 const along=[0];
 for(let i=1;i<points.length;i++)along.push(along[i-1]+bayuMetres(points[i-1],points[i]));
 const measure=({index,fraction})=>{
  const next=instructions.findIndex(i=>i.pointIndex>=index);
  if(next<=0)return null;
  const a=instructions[next-1],b=instructions[next];
  const position=along[index-1]+(along[index]-along[index-1])*fraction;
  const span=along[b.pointIndex]-along[a.pointIndex];
  if(!(span>0))return null;
  const f=(position-along[a.pointIndex])/span;
  return [a.routeOffsetInMeters+f*(b.routeOffsetInMeters-a.routeOffsetInMeters),
          a.travelTimeInSeconds+f*(b.travelTimeInSeconds-a.travelTimeInSeconds)];
 };
 const before=measure(entry),after=measure(exit);
 if(!before||!after||![...before,...after].every(Number.isFinite))return route;
 const distanceRemoved=after[0]-before[0],secondsRemoved=after[1]-before[1];
 if(distanceRemoved<100||distanceRemoved>500||secondsRemoved<0)return route;

 const point=([longitude,latitude])=>({longitude,latitude});
 const approachDistance=bayuMetres(entry.crossing,bayuWest);
 const crossingDistance=approachDistance+bayuMetres(bayuWest,bayuEast)+bayuMetres(bayuEast,exit.crossing);
 const distanceDelta=Math.round(crossingDistance-distanceRemoved);
 // Allow for slowing and crossing the median at the replacement turn.
 const timeDelta=8-Math.round(secondsRemoved);
 const indexDelta=first+2-last;
 const turn={pointIndex:first,point:point(bayuWest),maneuver:'MAKE_UTURN',
  routeOffsetInMeters:Math.round(before[0]+approachDistance),travelTimeInSeconds:Math.round(before[1])+1};
 const adjustedInstructions=[...instructions.filter(i=>i.pointIndex<first),turn,
  ...instructions.filter(i=>i.pointIndex>=last).map(i=>({...i,pointIndex:i.pointIndex+indexDelta,
   routeOffsetInMeters:i.routeOffsetInMeters+distanceDelta,travelTimeInSeconds:i.travelTimeInSeconds+timeDelta}))];
 const shiftedSections=sections.filter(s=>s.endPointIndex<first||s.startPointIndex>=last)
  .map(s=>s.startPointIndex<last?s:{...s,startPointIndex:s.startPointIndex+indexDelta,endPointIndex:s.endPointIndex+indexDelta});
 return {...route,bayuCrossover:true,legs:[{...leg,points:[...leg.points.slice(0,first),point(bayuWest),point(bayuEast),...leg.points.slice(last)]}],
  guidance:{...route.guidance,instructions:adjustedInstructions},sections:shiftedSections,
  summary:{...route.summary,lengthInMeters:route.summary.lengthInMeters+distanceDelta,
   travelTimeInSeconds:route.summary.travelTimeInSeconds+timeDelta,trafficDelayInSeconds:null}};
}
function normalizeLiveRoute(route,checkedAt){const summary=route.summary,points=(route.legs||[]).flatMap(l=>(l.points||[]).map(p=>[p.longitude,p.latitude])),instructions=route.guidance?.instructions;if(!summary||!Number.isFinite(summary.travelTimeInSeconds)||summary.travelTimeInSeconds<=0||!Number.isFinite(summary.lengthInMeters)||summary.lengthInMeters<=0||points.length<2||points.length>100000||!points.every(routePoint)||!Array.isArray(instructions)||instructions.length<2)throw Error('Incomplete route');if((route.sections||[]).some(s=>s.simpleCategory==='ROAD_CLOSURE'))throw Error('Closed route');if(globalThis.LapanRoadRestrictions.blocked(points))throw Error('Reported restricted junction');
const duration=summary.travelTimeInSeconds,distance=summary.lengthInMeters;let lastIndex=-1,lastOffset=-1,lastTime=-1;const records=instructions.map(i=>{if(!Number.isInteger(i.pointIndex)||i.pointIndex<0||i.pointIndex>=points.length||i.pointIndex<lastIndex||!Number.isFinite(i.routeOffsetInMeters)||i.routeOffsetInMeters<lastOffset||i.routeOffsetInMeters>distance+10||!Number.isFinite(i.travelTimeInSeconds)||i.travelTimeInSeconds<lastTime||i.travelTimeInSeconds>duration+10||!routePoint([i.point?.longitude,i.point?.latitude]))throw Error('Invalid guidance');lastIndex=i.pointIndex;lastOffset=i.routeOffsetInMeters;lastTime=i.travelTimeInSeconds;return i});if(records[0].maneuver!=='DEPART'||!/^ARRIVE/.test(records.at(-1).maneuver)||records[0].routeOffsetInMeters>10||Math.abs(records.at(-1).routeOffsetInMeters-distance)>30)throw Error('Missing endpoints');
const steps=records.map((i,n)=>{const next=records[n+1],point=[i.point.longitude,i.point.latitude],code=i.maneuver||'',type=code==='DEPART'?'depart':/^ARRIVE/.test(code)?'arrive':/EXIT/.test(code)?'off ramp':/ROUNDABOUT/.test(code)?'roundabout':/ENTER_MOTORWAY|ENTER_FREEWAY|ENTER_HIGHWAY/.test(code)?'on ramp':/KEEP|BEAR/.test(code)?'fork':code==='STRAIGHT'?'continue':'turn',modifier=/LEFT/.test(code)?'left':/RIGHT/.test(code)?'right':code==='MAKE_UTURN'?'uturn':'straight';let coordinates=next?[point,...points.slice(i.pointIndex+1,next.pointIndex+1),[next.point.longitude,next.point.latitude]]:[point];coordinates=coordinates.filter((p,j,a)=>!j||p[0]!==a[j-1][0]||p[1]!==a[j-1][1]);return {name:routeText(i.street),ref:Array.isArray(i.roadNumbers)?i.roadNumbers.map(routeText).filter(Boolean).join(';'):'',exits:routeText(i.exitNumber),destinations:routeText(i.signpostText),instruction:routeText(i.message),distance:next?Math.max(0,next.routeOffsetInMeters-i.routeOffsetInMeters):0,duration:next?Math.max(0,next.travelTimeInSeconds-i.travelTimeInSeconds):0,geometry:{type:'LineString',coordinates},maneuver:{location:point,type,modifier,...(Number.isInteger(i.roundaboutExitNumber)?{exit:i.roundaboutExitNumber}:{})}}});
const tollSections=(route.sections||[]).filter(s=>s.sectionType==='TOLL'&&Number.isInteger(s.startPointIndex)&&Number.isInteger(s.endPointIndex)&&s.startPointIndex>=0&&s.endPointIndex<points.length&&s.startPointIndex<s.endPointIndex).map(s=>({startPointIndex:s.startPointIndex,endPointIndex:s.endPointIndex}));
return {duration,distance,tollSections,trafficSections:routeTrafficSections(route,points),geometry:{type:'LineString',coordinates:points},legs:[{steps}],provider:'TomTom',closureCheckedAt:checkedAt,trafficCheckedAt:checkedAt,trafficDelay:route.bayuCrossover?null:Number(summary.trafficDelayInSeconds)||0};}
export async function planLiveRoute(request,env={},estimateTolls=async()=>null){const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store'}}),u=new URL(request.url);if(request.method!=='POST')return json({error:'POST required'},405);if(request.headers.get('origin')&&request.headers.get('origin')!==u.origin)return json({error:'Origin not allowed'},403);let body;try{const raw=await request.text();if(raw.length>1024)throw Error();body=JSON.parse(raw);if(!body||Object.keys(body).some(k=>!['from','to','alternatives','purpose','refresh','vehicle','avoidTolls'].includes(k))||(body.avoidTolls!==undefined&&typeof body.avoidTolls!=='boolean')||(body.vehicle!==undefined&&!['car','motorcycle'].includes(body.vehicle))||!routePoint(body.from)||!routePoint(body.to)||typeof body.alternatives!=='boolean'||(body.refresh!==undefined&&typeof body.refresh!=='boolean')||(body.purpose!==undefined&&!['planning','rerouting'].includes(body.purpose)))throw Error()}catch{return json({error:'Choose valid Malaysian starting and destination points.'},400)}if(env.TOMTOM_ROUTING_DISABLED==='true')return json({error:'TomTom routing is disabled for OSRM staging tests.',allowBasic:true},503);if(!env.TOMTOM_API_KEY)return json({error:'Live routing is unavailable. Closures have not been checked.',allowBasic:true},503);
if(Date.now()<routeProviderPauseUntil)return json({error:'Live routing is temporarily limited. Please wait before retrying.',allowBasic:true,retryAfterSeconds:Math.ceil((routeProviderPauseUntil-Date.now())/1000)},429);
const key=JSON.stringify({from:body.from,to:body.to,alternatives:body.alternatives,vehicle:body.vehicle||'car',avoidTolls:body.avoidTolls===true}),now=Date.now(),cached=liveRouteCache.get(key);if(body.refresh)liveRouteCache.delete(key);if(!body.refresh&&cached&&now-cached.at<((body.purpose||'planning')==='planning'?120000:30000))return json(cached.data);if(liveRoutePending.has(key))return (await liveRoutePending.get(key)).clone();const ip=request.headers.get('cf-connecting-ip')||'anonymous',client=liveRouteClients.get(ip);if(client&&now-client.at<60000&&client.n>=15||liveRouteInFlight>=4)return json({error:'Live routing is busy. Please retry shortly.',allowBasic:true},429);liveRouteClients.set(ip,client&&now-client.at<60000?{at:client.at,n:client.n+1}:{at:now,n:1});if(liveRouteClients.size>1000)liveRouteClients.delete(liveRouteClients.keys().next().value);liveRouteInFlight++;
const work=(async()=>{
 try{
  const a=body.from,b=body.to,url=new URL(`https://api.tomtom.com/routing/1/calculateRoute/${a[1]},${a[0]}:${b[1]},${b[0]}/json`);
  for(const [k,v]of Object.entries({key:env.TOMTOM_API_KEY,traffic:'true',departAt:'now',routeType:'fastest',travelMode:body.vehicle||'car',routeRepresentation:'polyline',instructionsType:'text',language:'en-GB',maxAlternatives:body.alternatives?'2':'0',sectionType:'traffic'}))url.searchParams.set(k,v);
  url.searchParams.append('sectionType','toll');
  if(body.avoidTolls)url.searchParams.append('avoid','tollRoads');
  const avoidAreas=globalThis.LapanRoadRestrictions.avoidAreas(),hasAreas=avoidAreas.rectangles.length>0;
  const signal=AbortSignal.timeout(body.avoidTolls?12000:18000);
  async function fetchRoutes(withAreas){
   const options=withAreas?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({avoidAreas})}:{method:'GET'};
   await globalThis.LapanTomTomUsage?.record(env,body.purpose||'planning');
   return fetch(url.toString(),{...options,signal});
  }
  const noRoute=()=>json({error:body.avoidTolls?'No route avoiding tolls was found. Try Faster or change your starting point or destination.':'No usable route avoiding reported restrictions was returned. Try a nearby accessible starting point or destination.',allowBasic:false},422);
  function upstreamError(response){
   if(response.status===429){
    const retry=Math.max(30,Math.min(300,Number(response.headers.get('Retry-After'))||60));
    routeProviderPauseUntil=Date.now()+retry*1000;
    return json({error:'Live routing allowance or request limit reached. Please wait before retrying.',allowBasic:true,retryAfterSeconds:retry},429);
   }
   if([400,404,422].includes(response.status))return body.avoidTolls?noRoute():json({error:'No live route could be calculated. Try a nearby accessible starting point or destination.',allowBasic:false},422);
   if(body.avoidTolls)console.warn('TomTom toll avoidance upstream failure',{status:response.status});
   return json({error:'Live routing is unavailable. Please retry; closures have not been checked.',allowBasic:true},502);
  }
  async function routeCandidates(response){
   const raw=await response.json(),checkedAt=new Date().toISOString(),routes=[];
   let blocked=false;
   for(const route of (raw.routes||[]).slice(0,3)){
    if(body.avoidTolls&&route.sections?.some(s=>s.sectionType==='TOLL'))continue;
    try{
     let normalized=normalizeLiveRoute(route,checkedAt);
     const corrected=body.vehicle==='motorcycle'?route:applyBayuCrossover(route);
     if(corrected!==route){
      try{
       normalized={...normalizeLiveRoute(corrected,checkedAt),bayuCrossover:true};
      }catch{/* Keep the validated original if the adjustment cannot be normalized. */}
     }
     normalized.vehicle=body.vehicle||'car';
     routes.push({normalized,route:normalized.bayuCrossover?corrected:route});
    }catch(error){if(error.message==='Reported restricted junction')blocked=true}
   }
   return {routes,checkedAt,blocked};
  }
  // Check every candidate against Lapan's restrictions. Send avoidance areas only
  // when the standard toll-avoidance request cannot produce a legal candidate.
  let response=await fetchRoutes(hasAreas&&!body.avoidTolls);
  if(!response.ok)return upstreamError(response);
  let candidates=await routeCandidates(response);
  if(body.avoidTolls&&hasAreas&&candidates.blocked&&!candidates.routes.length){
   response=await fetchRoutes(true);
   if(!response.ok)return upstreamError(response);
   candidates=await routeCandidates(response);
  }
  if(!candidates.routes.length)return noRoute();
  const routes=await Promise.all(candidates.routes.map(async({normalized,route})=>{
   try{normalized.tollEstimate=body.vehicle==='motorcycle'?null:await estimateTolls(route)}
   catch{normalized.tollEstimate=null}
   return normalized;
  }));
  const data={code:'Ok',routes,source:'TomTom',checkedAt:candidates.checkedAt};
  liveRouteCache.set(key,{at:Date.now(),data});
  if(liveRouteCache.size>60)liveRouteCache.delete(liveRouteCache.keys().next().value);
  return json(data);
 }catch{
  return json({error:'Live routing timed out or is unavailable. Closures have not been checked.',allowBasic:true},502);
 }finally{liveRouteInFlight--}
})();
liveRoutePending.set(key,work);try{return (await work).clone()}finally{liveRoutePending.delete(key)}}
