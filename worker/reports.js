// Anonymous community reports (crash, stopped vehicle, object, flood, pothole). A report is only a kind, a point and a clock:
// no account, no name, no free text, no device or network identifier. Every report expires by itself, and drivers can confirm or deny it.
// Needs the D1 binding DB (drizzle/0002_community_reports.sql). Without it the endpoints answer 503 and the app hides the feature.
const reportKinds={crash:7200,stopped:3600,object:3600,flood:10800,pothole:259200};
const reportWrites=new Map();
const reportPoint=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=0.8&&lat<=7.6&&lon>=99&&lon<=120;
const reportClean=r=>({id:r.id,kind:r.kind,lat:r.lat,lon:r.lon,ageSeconds:Math.max(0,r.now-r.created_at),confirms:r.confirms,denies:r.denies});
export async function communityReports(request,env){
 const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!env?.DB)return json({error:'Community reports are not available yet.'},503);
 const url=new URL(request.url),now=Math.floor(Date.now()/1000);
 try{
  if(request.method==='GET'&&url.pathname==='/api/reports'){
   const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')),radius=Math.min(20000,Math.max(200,Number(url.searchParams.get('r'))||3000));
   if(!reportPoint(lat,lon))return json({error:'Choose a valid Malaysian location.'},400);
   const dLat=radius/111320,dLon=radius/(111320*Math.cos(lat*Math.PI/180));
   const rows=await env.DB.prepare('SELECT id,kind,lat,lon,created_at,confirms,denies FROM community_reports WHERE expires_at>? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 100').bind(now,lat-dLat,lat+dLat,lon-dLon,lon+dLon).all();
   return json({reports:(rows.results||[]).map(r=>reportClean({...r,now}))});
  }
  if(request.method!=='POST'||(url.pathname!=='/api/reports'&&url.pathname!=='/api/reports/vote'))return json({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'Same-origin requests only'},403);
  if(Number(request.headers.get('content-length'))>256)return json({error:'Request too large'},413);
  const ip=request.headers.get('cf-connecting-ip')||'anonymous',recent=(reportWrites.get(ip)||[]).filter(t=>now-t<60);
  if(recent.length>=6)return json({error:'Too many reports. Please wait a minute.'},429);
  recent.push(now);reportWrites.set(ip,recent);if(reportWrites.size>2000)reportWrites.delete(reportWrites.keys().next().value);
  let body;try{body=JSON.parse(await request.text())}catch{return json({error:'Invalid request.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
  if(Math.random()<0.02)await env.DB.prepare('DELETE FROM community_reports WHERE expires_at<?').bind(now-86400).run();
  if(url.pathname==='/api/reports/vote'){
   if(Object.keys(body).some(k=>k!=='id'&&k!=='still')||typeof body.id!=='string'||!/^[0-9a-f]{24}$/.test(body.id)||typeof body.still!=='boolean')return json({error:'Invalid request.'},400);
   const row=await env.DB.prepare('SELECT id,kind,created_at,expires_at,confirms,denies FROM community_reports WHERE id=?').bind(body.id).first();
   if(!row||row.expires_at<=now)return json({error:'This report has expired.'},410);
   if(body.still){const ttl=reportKinds[row.kind],next=Math.min(row.created_at+2*ttl,Math.max(row.expires_at,now+Math.floor(ttl/2)));await env.DB.prepare('UPDATE community_reports SET confirms=MIN(confirms+1,50),expires_at=? WHERE id=?').bind(next,row.id).run()}
   else{const gone=row.denies+1>=2&&row.denies+1>row.confirms;await env.DB.prepare('UPDATE community_reports SET denies=MIN(denies+1,50),expires_at=CASE WHEN ? THEN ? ELSE expires_at END WHERE id=?').bind(gone?1:0,now,row.id).run()}
   return json({ok:true});
  }
  if(Object.keys(body).some(k=>!['kind','lat','lon'].includes(k))||!Object.hasOwn(reportKinds,body.kind)||!reportPoint(body.lat,body.lon))return json({error:'Choose a report type and a valid Malaysian location.'},400);
  const lat=Math.round(body.lat*1e5)/1e5,lon=Math.round(body.lon*1e5)/1e5,near=150,dLat=near/111320,dLon=near/(111320*Math.cos(lat*Math.PI/180));
  const same=await env.DB.prepare('SELECT id,created_at,expires_at FROM community_reports WHERE kind=? AND expires_at>? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 1').bind(body.kind,now,lat-dLat,lat+dLat,lon-dLon,lon+dLon).first();
  if(same){const ttl=reportKinds[body.kind],next=Math.min(same.created_at+2*ttl,Math.max(same.expires_at,now+Math.floor(ttl/2)));await env.DB.prepare('UPDATE community_reports SET confirms=MIN(confirms+1,50),expires_at=? WHERE id=?').bind(next,same.id).run();return json({id:same.id,merged:true});}
  const active=await env.DB.prepare('SELECT COUNT(*) AS n FROM community_reports WHERE expires_at>?').bind(now).first();
  if((active?.n||0)>=20000)return json({error:'Reports are busy right now. Please try again later.'},503);
  const id=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');
  await env.DB.prepare('INSERT INTO community_reports (id,kind,lat,lon,created_at,expires_at) VALUES (?,?,?,?,?,?)').bind(id,body.kind,lat,lon,now,now+reportKinds[body.kind]).run();
  return json({id,merged:false},201);
 }catch{return json({error:'Community reports are temporarily unavailable.'},503)}
}
