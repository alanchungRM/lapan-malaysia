// Backward-compatible camera endpoint: packaged OSM snapshot only; no cache API or upstream lookup.
export async function speedCameras(request,data){
 if(!['GET','HEAD'].includes(request.method))return new Response('GET or HEAD required',{status:405,headers:{Allow:'GET, HEAD'}});
 if(!Array.isArray(data?.cameras))return Response.json({error:'Camera data unavailable; camera coverage cannot be confirmed.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return new Response(request.method==='HEAD'?null:JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
