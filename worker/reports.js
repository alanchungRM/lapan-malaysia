// Anonymous reports store a rounded location and a fixed expiry by report type.
// Vote receipts are scoped to one report and are deleted with the report.
const trafficReportKinds=new Set(['traffic-heavy','traffic-standstill']);
const reportKinds=new Set(['crash','stopped','object','flood','pothole','police-hidden',...trafficReportKinds]);
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
const directionReportRetention=7*86400;
const directionReportProviders=new Set(['TomTom','Valhalla','OSRM','HERE','Unknown']);
async function ensureDirectionReports(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS direction_reports (id INTEGER PRIMARY KEY, reported_at INTEGER NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, provider TEXT NOT NULL, instruction TEXT NOT NULL)').run();
}
async function receiveDirectionReport(request,db,now,json){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Same-origin requests only'},403);
 if(Number(request.headers.get('content-length'))>4096)return json({error:'Request too large'},413);
 if(!request.body)return json({error:'Invalid direction report'},400);
 const reader=request.body.getReader(),decoder=new TextDecoder();
 let size=0,raw='';
 for(;;){
  const {value,done}=await reader.read();
  if(done)break;
  size+=value.byteLength;
  if(size>4096){await reader.cancel();return json({error:'Request too large'},413)}
  raw+=decoder.decode(value,{stream:true});
 }
 let body;
 try{body=JSON.parse(raw+decoder.decode())}catch{return json({error:'Invalid direction report'},400)}
 if(!body||typeof body!=='object'||Object.keys(body).some(key=>!['lat','lon','provider','instruction'].includes(key))||
  !reportPoint(body.lat,body.lon)||!directionReportProviders.has(body.provider)||
  typeof body.instruction!=='string'||!body.instruction.trim()||body.instruction.length>500)
  return json({error:'Invalid direction report'},400);
 await ensureDirectionReports(db);
 const [,result]=await db.batch([
  db.prepare('DELETE FROM direction_reports WHERE reported_at<?').bind(now-directionReportRetention),
  db.prepare('INSERT INTO direction_reports (reported_at,lat,lon,provider,instruction) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM direction_reports WHERE reported_at>=?)<500 RETURNING id')
   .bind(now,Number(body.lat.toFixed(6)),Number(body.lon.toFixed(6)),body.provider,body.instruction.trim(),now-86400)
 ]);
 return result.results?.length?json({ok:true},201):json({error:'Direction reports are busy. Try again later.'},429);
}
export async function communityReports(request,env){
 const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(!env?.DB)return json({error:'Community reports are not available yet.'},503);
 const {DB:db}=env,url=new URL(request.url),now=Math.floor(Date.now()/1000);
 try{
  if(url.pathname==='/api/reports/direction')return await receiveDirectionReport(request,db,now,json);
  if(url.pathname==='/api/reports/cleanup'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   await sweepCommunityReports(env,now,true);
   return json({ok:true});
  }
  if(request.method==='GET'&&url.pathname==='/api/reports'&&url.searchParams.get('scope')==='all'){
   const before=url.searchParams.get('before');
   const cursor=before?.match(/^(\d{1,12})\.([0-9a-f]{24})$/);
   if(before!==null&&!cursor)return json({error:'Invalid report page.'},400);
   const pageSize=50;
   await sweepCommunityReports(env,now);
   const {results}=await db.prepare('SELECT id,kind,lat,lon,created_at,expires_at FROM community_reports WHERE expires_at>? AND (created_at,id)<(?,?) ORDER BY created_at DESC,id DESC LIMIT ?')
    .bind(now,cursor?Number(cursor[1]):now+1,cursor?.[2]||'',pageSize+1).all();
   const page=results.slice(0,pageSize),last=page.at(-1);
   return json({
    reports:page.map(r=>({kind:r.kind,lat:Number(r.lat.toFixed(3)),lon:Number(r.lon.toFixed(3)),reportedAt:r.created_at,remainingSeconds:r.expires_at-now})),
    next:results.length>pageSize?last.created_at+'.'+last.id:null
   });
  }
  if(request.method==='GET'&&url.pathname==='/api/reports'){
   const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')),radius=Math.min(20000,Math.max(200,Number(url.searchParams.get('r'))||3000));
   const box=url.searchParams.get('bbox');
   let bounds,limit=100;
   if(box!==null){
    const parts=box.split(',');
    bounds=parts.map(Number);
    const [south,west,north,east]=bounds;
    if(parts.length!==4||parts.some(value=>!value.trim())||!reportPoint(south,west)||!reportPoint(north,east)||south>=north||west>=east)return json({error:'Choose valid Malaysian map bounds.'},400);
    bounds=[south,north,west,east];
    limit=500;
   }else{
    if(!reportPoint(lat,lon))return json({error:'Choose a valid Malaysian location.'},400);
    const dLat=radius/111320,dLon=radius/(111320*Math.cos(lat*Math.PI/180));
    bounds=[lat-dLat,lat+dLat,lon-dLon,lon+dLon];
   }
   await sweepCommunityReports(env,now,box===null);
   const rows=await db.prepare('SELECT id,kind,lat,lon,created_at,expires_at,confirms,denies FROM community_reports WHERE expires_at>? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ?').bind(now,...bounds,limit).all();
   return json({reports:(rows.results||[]).map(r=>({
    id:r.id,kind:r.kind,lat:r.lat,lon:r.lon,ageSeconds:now-r.created_at,reportedAt:r.created_at,
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
  const reportLifetime=trafficReportKinds.has(body.kind)?30*60:8*60*60;
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
