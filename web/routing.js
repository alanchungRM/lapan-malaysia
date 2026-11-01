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
async function request(from,to,alternatives,signal){
 let error;
 try{
  const {r,d}=await getJSON('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,alternatives})},signal,19000);
  if(r.ok&&d.code==='Ok'&&d.routes?.length)return d;
  // Never bypass input errors, no-route decisions or rejected restricted routes.
  error=Object.assign(new Error(d.error||'Live routing unavailable'),{allowBasic:d.allowBasic===true||r.status===429||r.status>=500,retryAfterMs:Math.min(300000,Math.max(0,Number(d.retryAfterSeconds)||0))*1000});
 }catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');error=Object.assign(new Error('Live routing connection unavailable.'),{allowBasic:true})}
 if(!error.allowBasic)throw error;
 if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');
 let result;
 try{result=await getJSON(`https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`,{},signal,10000)}catch(e){if(signal?.aborted)throw new DOMException('Routing cancelled','AbortError');throw Object.assign(new Error('Live and basic routing are unavailable. Please retry.'),{retryAfterMs:error.retryAfterMs})}
 const {r,d}=result;
 if(!r.ok||d.code!=='Ok'||!d.routes?.length)throw Object.assign(new Error('Basic routing is also unavailable. Please retry.'),{retryAfterMs:error.retryAfterMs});
 d.routes=d.routes.filter(route=>Array.isArray(route.geometry?.coordinates)&&route.geometry.coordinates.length>=2&&!root.LapanRoadRestrictions.blocked(route.geometry.coordinates));
 if(!d.routes.length)throw Error('No basic route avoiding the reported restriction is available.');
 d.routes.forEach(route=>{route.provider='OSRM';route.closureCheckedAt=null;route.trafficCheckedAt=null});return d;
}
function label(route){return route?.provider==='TomTom'?'TomTom live route · closures checked at '+new Date(route.closureCheckedAt).toLocaleTimeString('en-MY',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kuala_Lumpur'})+' · reported closures only':'OSRM basic route · no live traffic · road closures NOT checked'}
root.LapanRouting={request,label};if(typeof module==='object')module.exports={request,label};
})(typeof window==='object'?window:globalThis);
