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
async function request(from,to,alternatives,signal,_allowBasic,purpose='planning',refresh=false,vehicle='car'){
 if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');
 let provider=root.document?.documentElement?.dataset?.routingProvider||'TomTom',revision=0;
 if(root.document?.documentElement?.dataset?.routingConfig==='server'){
  try{const {r,d}=await getJSON('/api/routing-config',{cache:'no-store'},signal,4000);if(!r.ok||!['TomTom','OSRM','HERE'].includes(d.provider))throw Error();provider=d.provider;revision=d.revision||0}
  catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');provider='OSRM'}
 }
 if(!['car','motorcycle'].includes(vehicle))throw Error('Choose Car or Motorcycle.');
 if(vehicle==='motorcycle'&&provider==='OSRM')throw Error('Motorcycle routing requires TomTom or HERE. Ask the administrator to change the routing provider.');
 const key=JSON.stringify({from,to,alternatives,provider,revision,vehicle});
 if(purpose==='planning'&&!refresh&&lastPlan?.key===key&&Date.now()-lastPlan.at<120000)return copy(lastPlan.data);
 if(purpose==='planning'&&refresh)lastPlan=null;
 const remember=data=>{
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
  const {r,d}=await getJSON('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,alternatives,purpose,vehicle,...(refresh?{refresh:true}:{})})},signal,19000);
  if(r.ok&&d.code==='Ok'&&d.routes?.length){d.routes.forEach(route=>route.vehicle=vehicle);return remember(d);}
  // Never bypass input errors, no-route decisions or rejected restricted routes.
  error=Object.assign(new Error(d.error||'Live routing unavailable'),{allowBasic:d.allowBasic===true||r.status===429||r.status>=500,retryAfterMs:Math.min(300000,Math.max(0,Number(d.retryAfterSeconds)||0))*1000});
 }catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');error=Object.assign(new Error('Live routing connection unavailable.'),{allowBasic:true})}
 }
 if(vehicle==='motorcycle')throw Object.assign(new Error((error.message||'Motorcycle routing is unavailable.')+' For motorcycles, car routing cannot be used as a fallback.'),{allowBasic:false});
 if(!error.allowBasic)throw error;
 if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');
 let result;
 try{result=await getJSON(`https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`,refresh?{cache:'reload'}:{},signal,10000)}catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');throw Object.assign(new Error('Live and basic routing are unavailable. Please retry.'),{retryAfterMs:error.retryAfterMs})}
 const {r,d}=result;
 if(!r.ok||d.code!=='Ok'||!d.routes?.length)throw Object.assign(new Error('Basic routing is also unavailable. Please retry.'),{retryAfterMs:error.retryAfterMs});
 d.routes=d.routes.filter(route=>Array.isArray(route.geometry?.coordinates)&&route.geometry.coordinates.length>=2&&!root.LapanRoadRestrictions.blocked(route.geometry.coordinates));
 if(!d.routes.length)throw Error('No basic route avoiding the reported restriction is available.');
 d.routes.forEach(route=>{route.provider='OSRM';route.closureCheckedAt=null;route.trafficCheckedAt=null});return remember(d);
}
function label(route){const provider=route?.provider;if(route?.vehicle==='motorcycle')return provider+' motorcycle route · '+(provider==='TomTom'?'beta · ':'')+'restrictions and dedicated lanes may be incomplete · obey road signs';if(['TomTom','HERE'].includes(provider))return provider+' live route · closures checked at '+new Date(route.closureCheckedAt).toLocaleTimeString('en-MY',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kuala_Lumpur'})+' · reported closures only';return 'OSRM basic route · no live traffic · road closures NOT checked'}
root.LapanRouting={request,label};if(typeof module==='object')module.exports={request,label};
})(typeof window==='object'?window:globalThis);
