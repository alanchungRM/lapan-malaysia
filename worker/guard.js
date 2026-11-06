// Optional edge rate limiting. The in-memory limits inside each handler are per isolate and
// therefore only a best-effort backstop. When a Workers Rate Limiting binding named RATE_LIMITER is
// configured (see README), requests are limited across the whole location; without it this is a no-op.
const limitedRoutes=new Set(['/api/route','/api/routing-config','/api/place-search','/api/traffic-eta','/api/visit','/api/nearby']);
export async function edgeLimited(request,env){
 const limiter=env?.RATE_LIMITER;
 if(!limiter||typeof limiter.limit!=='function')return null;
 const path=new URL(request.url).pathname;
 if(!limitedRoutes.has(path))return null;
 try{
  const ip=request.headers.get('cf-connecting-ip')||'anonymous',result=await limiter.limit({key:path+':'+ip});
  if(result&&result.success===false)return Response.json({error:'Too many requests. Please retry shortly.'},{status:429,headers:{'Retry-After':'60','Cache-Control':'private, no-store'}});
 }catch{/* Fail open: a limiter outage must not take navigation down. */}
 return null;
}
