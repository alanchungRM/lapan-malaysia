// Anonymous reports store a rounded location and a fixed eight-hour expiry.
// Vote receipts are scoped to one report and are deleted with the report.
const reportKinds=new Set(['crash','stopped','object','flood','pothole','police-hidden']);
const reportLifetime=8*60*60;
const reportWrites=new Map();
const reportPoint=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=0.8&&lat<=7.6&&lon>=99&&lon<=120;
const reportHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const reportReceipt=async(id,key)=>reportHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+':'+key))));
const malaysiaReportDay=now=>new Date((now+8*3600)*1000).toISOString().slice(0,10);
let nextReportSweep=0;
export async function sweepCommunityReports(env,now=Math.floor(Date.now()/1000),force=false){
 if(!force&&now<nextReportSweep)return;
 nextReportSweep=now+60;
 try{
  await env.DB.batch([
   env.DB.prepare('DELETE FROM community_reports WHERE expires_at<=?').bind(now),
   env.DB.prepare('DELETE FROM community_report_daily WHERE day<?').bind(malaysiaReportDay(now))
  ]);
 }catch(error){nextReportSweep=0;throw error}
}
async function addCommunityVote(db,id,receipt,vote,now){
 await db.prepare('INSERT OR IGNORE INTO community_report_votes (report_id,receipt,vote,created_at) SELECT id,?,?,? FROM community_reports WHERE id=? AND expires_at>? AND confirms+denies<100').bind(receipt,vote,now,id,now).run();
}
export async function communityReports(request,env){
 const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!env?.DB)return json({error:'Community reports are not available yet.'},503);
 const {DB:db}=env,url=new URL(request.url),now=Math.floor(Date.now()/1000);
 try{
  if(url.pathname==='/api/reports/cleanup'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   await sweepCommunityReports(env,now,true);
   return json({ok:true});
  }
  if(request.method==='GET'&&url.pathname==='/api/reports'){
   const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')),radius=Math.min(20000,Math.max(200,Number(url.searchParams.get('r'))||3000));
   if(!reportPoint(lat,lon))return json({error:'Choose a valid Malaysian location.'},400);
   await sweepCommunityReports(env,now,true);
   const dLat=radius/111320,dLon=radius/(111320*Math.cos(lat*Math.PI/180));
   const rows=await db.prepare('SELECT id,kind,lat,lon,created_at,expires_at,confirms,denies FROM community_reports WHERE expires_at>? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 100').bind(now,lat-dLat,lat+dLat,lon-dLon,lon+dLon).all();
   return json({reports:(rows.results||[]).map(r=>({
    id:r.id,kind:r.kind,lat:r.lat,lon:r.lon,ageSeconds:now-r.created_at,
    remainingSeconds:r.expires_at-now,confirms:r.confirms,denies:r.denies
   }))});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'Same-origin requests only'},403);
  const key=request.headers.get('x-lapan-report-key')||'';
  if(!/^[a-f0-9]{32}$/.test(key))return json({error:'Invalid request.'},400);
  if(Number(request.headers.get('content-length'))>256)return json({error:'Request too large'},413);
  const ip=request.headers.get('cf-connecting-ip')||'anonymous',recent=(reportWrites.get(ip)||[]).filter(t=>now-t<60);
  if(recent.length>=6)return json({error:'Too many reports. Please wait a minute.'},429);
  recent.push(now);reportWrites.set(ip,recent);
  if(reportWrites.size>2000)reportWrites.delete(reportWrites.keys().next().value);
  const raw=await request.text();
  if(raw.length>256)return json({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
  await sweepCommunityReports(env,now,true);
  if(url.pathname==='/api/reports/vote'){
   if(Object.keys(body).some(k=>k!=='id'&&k!=='still')||typeof body.id!=='string'||!/^[0-9a-f]{24}$/.test(body.id)||typeof body.still!=='boolean')return json({error:'Invalid request.'},400);
   const row=await db.prepare('SELECT id FROM community_reports WHERE id=? AND expires_at>?').bind(body.id,now).first();
   if(!row)return json({error:'This report has expired.'},410);
   await addCommunityVote(db,row.id,await reportReceipt(row.id,key),body.still?1:-1,now);
   return json({ok:true});
  }
  if(Object.keys(body).some(k=>!['kind','lat','lon'].includes(k))||!reportKinds.has(body.kind)||!reportPoint(body.lat,body.lon))return json({error:'Choose a report type and a valid Malaysian location.'},400);
  const lat=Math.round(body.lat*1e5)/1e5,lon=Math.round(body.lon*1e5)/1e5,near=150;
  const dLat=near/111320,dLon=near/(111320*Math.cos(lat*Math.PI/180));
  const nearby='kind=? AND expires_at>? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?';
  const bounds=[body.kind,now,lat-dLat,lat+dLat,lon-dLon,lon+dLon];
  const id=reportHex(crypto.getRandomValues(new Uint8Array(12)));
  const receipt=await reportReceipt(id,key);
  const [created]=await db.batch([
   db.prepare('INSERT INTO community_reports (id,kind,lat,lon,created_at,expires_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM community_reports WHERE '+nearby+') AND (SELECT COUNT(*) FROM community_reports WHERE expires_at>?)<20000 RETURNING id').bind(id,body.kind,lat,lon,now,now+reportLifetime,...bounds,now),
   db.prepare('INSERT INTO community_report_votes (report_id,receipt,vote,created_at) SELECT id,?,0,? FROM community_reports WHERE id=?').bind(receipt,now,id)
  ]);
  if(created.results?.length)return json({id,merged:false},201);
  const same=await db.prepare('SELECT id FROM community_reports WHERE '+nearby+' ORDER BY created_at,id LIMIT 1').bind(...bounds).first();
  if(same){
   await addCommunityVote(db,same.id,await reportReceipt(same.id,key),1,now);
   return json({id:same.id,merged:true});
  }
  return json({error:'Reports are busy right now. Please try again later.'},503);
 }catch{return json({error:'Community reports are temporarily unavailable.'},503)}
}
