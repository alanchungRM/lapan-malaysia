(function(root){
// Bound each provider independently so a stalled live service leaves time for fallback.
async function getJSON(url,options,signal,timeoutMs){
 const ctrl=new AbortController();let timer;
 const cancel=()=>ctrl.abort(signal.reason);
 if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');
 signal?.addEventListener('abort',cancel,{once:true});
 try{return await Promise.race([
  fetch(url,{...options,signal:ctrl.signal}).then(async r=>({r,d:await r.json()})),
  new Promise((_,reject)=>{timer=setTimeout(()=>{ctrl.abort();reject(new Error('Routing provider timed out'))},timeoutMs)})
 ])}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
}
// One browser-session entry; never persist route coordinates or journeys.
let lastPlan=null;
const copy=data=>JSON.parse(JSON.stringify(data));
const roadName=value=>typeof value==='string'?value.trim().toLowerCase():'';
const roadRefs=value=>roadName(value).split(';').map(ref=>ref.trim()).filter(Boolean);
function sameRoad(a,b){
 const name=roadName(a.name),refs=roadRefs(a.ref);
 return (name&&name===roadName(b.name))||roadRefs(b.ref).some(ref=>refs.includes(ref));
}
function pointAlong(points,meters){
 for(let i=1;i<points.length;i++){
  const [x,y]=points[i-1],[nextX,nextY]=points[i],dx=nextX-x,dy=nextY-y,length=Math.hypot(dx,dy);
  if(length&&meters<=length)return [x+dx*meters/length,y+dy*meters/length];
  meters-=length;
 }
 return null;
}
// A provider can label the entrance to a median crossover as a fork or turn.
// Require a tight reversal onto the same road before overriding that guidance.
function reversesOnSameRoad(previous,step){
 const maneuver=step.maneuver;
 if(!['fork','turn','continue'].includes(maneuver?.type)||!/\b(left|right)$/.test(maneuver.modifier)||step.exits||!sameRoad(previous,step))return false;
 const incoming=previous.geometry?.coordinates,outgoing=step.geometry?.coordinates;
 if(!Array.isArray(incoming)||incoming.length<2||!Array.isArray(outgoing)||outgoing.length<2)return false;
 const [lon,lat]=outgoing[0],scale=111320,lonScale=scale*Math.cos(lat*Math.PI/180);
 const local=([x,y])=>[(x-lon)*lonScale,(y-lat)*scale];
 const approach=[];
 let length=0;
 for(let i=incoming.length-1;i>=0&&length<20;i--){
  const point=local(incoming[i]),last=approach.at(-1);
  if(last)length+=Math.hypot(point[0]-last[0],point[1]-last[1]);
  approach.push(point);
 }
 if(Math.hypot(...approach[0])>5)return false;
 const before=pointAlong(approach,20);
 if(!before)return false;
 const dx=approach[0][0]-before[0],dy=approach[0][1]-before[1],chord=Math.hypot(dx,dy);
 if(chord<17)return false;
 const forward=([x,y])=>(x*dx+y*dy)/chord,side=([x,y])=>(y*dx-x*dy)/chord;
 const path=[];
 length=0;
 for(const coordinate of outgoing){
  const point=local(coordinate),last=path.at(-1);
  if(last)length+=Math.hypot(point[0]-last[0],point[1]-last[1]);
  path.push(point);
  if(length>=85)break;
 }
 for(let start=0;start<=60;start+=5){
  const a=pointAlong(path,start),b=pointAlong(path,start+25);
  if(!a||!b||forward(a)>25||Math.abs(side(a))>48)break;
  if(forward(b)-forward(a)<=-22&&Math.abs(side(b)-side(a))<=10&&Math.abs(side(b))<=48)return true;
 }
 return false;
}
function correctUTurns(route){
 for(const leg of route.legs||[]){
  const steps=leg.steps||[];
  for(let i=1;i<steps.length;i++){
   const step=steps[i];
   if(reversesOnSameRoad(steps[i-1],step)){
    step.maneuver={...step.maneuver,type:'turn',modifier:'uturn'};
    step.instruction='';
   }
  }
 }
}
// Bayu Impian 2 has a mapped median crossover before the larger junction.
// Measure the northbound-to-southbound loop between the two carriageways.
const bayuGate=2.97727;
const bayuSouthbound=[101.4509,2.97715];
function bayuLoopMetres(route){
 const coords=route.geometry?.coordinates||[];
 let entered=null,travel=0;
 for(let i=1;i<coords.length;i++){
  const [x,y]=coords[i-1],[nx,ny]=coords[i];
  const length=Math.hypot(nx-x,ny-y)*111320;
  if((y<bayuGate&&ny>=bayuGate)||(y>=bayuGate&&ny<bayuGate)){
   const t=(bayuGate-y)/(ny-y),lon=x+t*(nx-x),at=travel+t*length;
   if(ny>y&&lon>=101.45070&&lon<=101.45083)entered=at;
   if(entered!==null&&ny<y&&lon>=101.45084&&lon<=101.45095)return at-entered;
  }
  travel+=length;
 }
 return null;
}
function basicURL(points,alternatives){
 return `https://router.project-osrm.org/route/v1/driving/${points.map(p=>p.join(',')).join(';')}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`;
}
function markBasic(route){
 route.provider='OSRM';route.closureCheckedAt=null;route.trafficCheckedAt=null;
}
async function preferBayuCrossover(data,from,to,alternatives,signal,refresh){
 const primary=data.routes[0],loop=bayuLoopMetres(primary);
 if(loop===null||loop<110)return;
 const earlier=data.routes.findIndex(r=>{const distance=bayuLoopMetres(r);return distance!==null&&distance<75});
 if(earlier>0){data.routes.unshift(...data.routes.splice(earlier,1));return}
 const url=basicURL([from,bayuSouthbound,to],false)+'&continue_straight=true';
 try{
  const {r,d}=await getJSON(url,refresh?{cache:'reload'}:{},signal,6000);
  const route=d.routes?.[0];
  if(!r.ok||d.code!=='Ok'||!route||route.legs?.length!==2||root.LapanRoadRestrictions.blocked(route.geometry?.coordinates))return;
  const correctedLoop=bayuLoopMetres(route);
  const [approach,rest]=route.legs.map(leg=>leg.steps);
  if(correctedLoop===null||correctedLoop>=75||route.distance>primary.distance+1500||!approach?.length||!rest?.length)return;
  const turn=approach.find(step=>step.maneuver?.modifier==='uturn');
  const [lon,lat]=turn?.maneuver?.location||[];
  if(!(lon>=101.45070&&lon<=101.45083&&Math.abs(lat-2.9773533)<.0001))return;
  if(approach.at(-1).maneuver.type!=='arrive'||rest[0].maneuver.type!=='depart')return;
  // The intermediate point is a routing constraint, so omit its arrival and
  // join the departure geometry to the preceding instruction.
  const last=approach.at(-2),departure=rest[0];
  last.geometry.coordinates=[...last.geometry.coordinates,...departure.geometry.coordinates.slice(1)];
  last.distance+=departure.distance;
  last.duration+=departure.duration;
  turn.maneuver.type='turn';
  route.legs=[{steps:[...approach.slice(0,-1),...rest.slice(1)]}];
  markBasic(route);
  route.vehicle='car';
  data.routes=alternatives?[route,...data.routes.slice(0,2)]:[route];
 }catch(error){
  if(signal?.aborted)throw error;
  // The provider's original route is still usable if the local check fails.
 }
}
async function request(from,to,alternatives,signal,_allowBasic,purpose='planning',refresh=false,vehicle='car',avoidTolls=false){
 if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');
 let provider=root.document?.documentElement?.dataset?.routingProvider||'TomTom',revision=0;
 if(root.document?.documentElement?.dataset?.routingConfig==='server'){
  try{const {r,d}=await getJSON('/api/routing-config',{cache:'no-store'},signal,4000);if(!r.ok||!['TomTom','OSRM','HERE'].includes(d.provider))throw Error();provider=d.provider;revision=d.revision||0}
  catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');provider='OSRM'}
 }
 if(!['car','motorcycle'].includes(vehicle))throw Error('Choose Car or Motorcycle.');
 if(avoidTolls&&provider==='OSRM')throw Error('Toll avoidance is unavailable with basic routing. Choose Faster or try again later.');
 if(vehicle==='motorcycle'&&provider==='OSRM')throw Error('Motorcycle routing requires TomTom or HERE. Ask the administrator to change the routing provider.');
 const key=JSON.stringify({from,to,alternatives,provider,revision,vehicle,avoidTolls});
 if(purpose==='planning'&&!refresh&&lastPlan?.key===key&&Date.now()-lastPlan.at<120000)return copy(lastPlan.data);
 if(purpose==='planning'&&refresh)lastPlan=null;
 const remember=data=>{
  data.routes.forEach(correctUTurns);
  if(avoidTolls)data.routes.forEach(route=>route.avoidTolls=true);
  if(purpose==='planning'){
   const checked=Date.parse(data.checkedAt),at=['TomTom','HERE'].includes(data.source)?checked:Date.now();
   lastPlan=Number.isFinite(at)?{key,at,data:copy(data)}:null;
  }
  return data;
 };
 let error;
 const osrmOnly=provider==='OSRM';
 if(osrmOnly)error={allowBasic:true,retryAfterMs:0};
 if(!osrmOnly){
 try{
  const {r,d}=await getJSON('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,alternatives,purpose,vehicle,...(refresh?{refresh:true}:{}),...(avoidTolls?{avoidTolls:true}:{})})},signal,avoidTolls?29000:19000);
  if(r.ok&&d.code==='Ok'&&d.routes?.length){
   d.routes.forEach(route=>route.vehicle=vehicle);
   if(vehicle==='car'&&!avoidTolls)await preferBayuCrossover(d,from,to,alternatives,signal,refresh);
   return remember(d);
  }
  // Never bypass input errors, no-route decisions or rejected restricted routes.
  error=Object.assign(new Error(d.error||'Live routing unavailable'),{allowBasic:d.allowBasic===true||r.status===429||r.status>=500,retryAfterMs:Math.min(300000,Math.max(0,Number(d.retryAfterSeconds)||0))*1000});
 }catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');error=Object.assign(new Error('Live routing connection unavailable.'),{allowBasic:true})}
 }
 if(avoidTolls){
  if(error.allowBasic)error.message='Toll avoidance is temporarily unavailable. Choose Faster or try again later.';
  error.allowBasic=false;throw error;
 }
 if(vehicle==='motorcycle')throw Object.assign(new Error((error.message||'Motorcycle routing is unavailable.')+' For motorcycles, car routing cannot be used as a fallback.'),{allowBasic:false});
 if(!error.allowBasic)throw error;
 if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');
 let result;
 try{result=await getJSON(basicURL([from,to],alternatives),refresh?{cache:'reload'}:{},signal,10000)}catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');throw Object.assign(new Error('Live and basic routing are unavailable. Please retry.'),{retryAfterMs:error.retryAfterMs})}
 const {r,d}=result;
 if(!r.ok||d.code!=='Ok'||!d.routes?.length)throw Object.assign(new Error('Basic routing is also unavailable. Please retry.'),{retryAfterMs:error.retryAfterMs});
 d.routes=d.routes.filter(route=>Array.isArray(route.geometry?.coordinates)&&route.geometry.coordinates.length>=2&&!root.LapanRoadRestrictions.blocked(route.geometry.coordinates));
 if(!d.routes.length)throw Error('No basic route avoiding the reported restriction is available.');
 d.routes.forEach(markBasic);return remember(d);
}
function label(route){const provider=route?.provider;if(route?.vehicle==='motorcycle')return provider+' motorcycle route · '+(provider==='TomTom'?'beta · ':'')+'restrictions and dedicated lanes may be incomplete · obey road signs';if(['TomTom','HERE'].includes(provider))return provider+' live route · closures checked at '+new Date(route.closureCheckedAt).toLocaleTimeString('en-MY',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kuala_Lumpur'})+' · reported closures only';return 'OSRM basic route · no live traffic · road closures NOT checked'}
root.LapanRouting={request,label};if(typeof module==='object')module.exports={request,label};
})(typeof window==='object'?window:globalThis);
