// Server-side provider selection. Each Site has its own database and default.
const routingProviders=['TomTom','OSRM','HERE'];
export async function routingSetting(env={}){
 const fallback=env.TOMTOM_ROUTING_DISABLED==='true'?'OSRM':'TomTom';
 if(!env.DB)return {provider:fallback,revision:0,updatedAt:null};
 try{const row=await env.DB.prepare("SELECT provider,revision,updated_at FROM routing_settings WHERE id=1").first();return row&&routingProviders.includes(row.provider)?{provider:row.provider,revision:row.revision,updatedAt:row.updated_at}:{provider:fallback,revision:0,updatedAt:null}}
 catch{return {provider:'OSRM',revision:0,updatedAt:null,unavailable:true}}
}
export async function routingConfiguration(request,env){
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'GET required'},{status:405});
 const setting=await routingSetting(env);return new Response(request.method==='HEAD'?null:JSON.stringify({provider:setting.provider,revision:setting.revision}),{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
}
export async function dispatchRoute(request,env,estimateTolls){
 // Keep all provider selection authoritative on the server.
 let body;try{const text=await request.clone().text();if(text.length>1024)throw Error();body=JSON.parse(text);if(!body||Object.keys(body).some(k=>!['from','to','alternatives','purpose','refresh','vehicle'].includes(k))||(body.vehicle!==undefined&&!['car','motorcycle'].includes(body.vehicle))||!routePoint(body.from)||!routePoint(body.to)||typeof body.alternatives!=='boolean'||(body.purpose!==undefined&&!['planning','rerouting'].includes(body.purpose))||(body.refresh!==undefined&&typeof body.refresh!=='boolean'))throw Error()}catch{return Response.json({error:'Choose valid Malaysian starting and destination points.'},{status:400})}
 if(request.method!=='POST')return Response.json({error:'POST required'},{status:405});
 const u=new URL(request.url);if(request.headers.get('origin')&&request.headers.get('origin')!==u.origin)return Response.json({error:'Origin not allowed'},{status:403});
 const setting=await routingSetting(env);
 if(setting.provider==='OSRM')return Response.json({error:body.vehicle==='motorcycle'?'Motorcycle routing requires TomTom or HERE.':'Paid routing is disabled. OSRM is selected.',allowBasic:body.vehicle!=='motorcycle'},{status:503,headers:{'Cache-Control':'private, no-store'}});
 const response=await (setting.provider==='HERE'?planHereRoute(request,env,body):planLiveRoute(request,{...env,TOMTOM_ROUTING_DISABLED:'false'},estimateTolls));
 if(body.vehicle==='motorcycle'&&!response.ok){const data=await response.json();return Response.json({...data,allowBasic:false},{status:response.status,headers:response.headers})}
 return response;
}
export async function dispatchTraffic(request,env){
 const setting=await routingSetting(env);
 if(setting.provider==='OSRM')return Response.json({error:'Paid traffic refresh is disabled. OSRM is selected.'},{status:503});
 let body;try{const raw=await request.clone().text();if(raw.length>1000000)throw Error();body=JSON.parse(raw)}catch{return Response.json({error:'Invalid traffic request'},{status:400})}
 if(body.vehicle!==undefined&&!['car','motorcycle'].includes(body.vehicle))return Response.json({error:'Invalid vehicle'},{status:400});
 const provider=body.provider||'TomTom';
 if(provider!==setting.provider)return Response.json({error:'Routing provider changed. Refresh or replan this route before requesting traffic.'},{status:409});
 return provider==='HERE'?hereTraffic(request,env,body):trafficETA(request,{...env,TOMTOM_ROUTING_DISABLED:'false'});
}
