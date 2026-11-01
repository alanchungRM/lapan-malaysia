// Share a place with one short link. A friend who opens it sees the place in Lapan, ready for directions, and a chat app shows a preview.
// Short links (/s/CODE) are kept in D1 (drizzle/0003_shared_places.sql): a name, a point and an expiry, with no account and no network address.
// Without the database, the app falls back to a link that carries the place inside itself (/l/PAYLOAD), so sharing always works.
const shareAlphabet='23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',shareLife=15552000,shareWrites=new Map();
const sharePoint=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=0.8&&lat<=7.6&&lon>=99&&lon<=120;
const shareName=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,80):'';
const shareHtml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
async function shareCode(lat,lon,name,round){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(lat+'|'+lon+'|'+name+'|'+round)));
 let n=0n;for(let i=0;i<5;i++)n=n*256n+BigInt(bytes[i]);let code='';for(let i=0;i<7;i++){code=shareAlphabet[Number(n%BigInt(shareAlphabet.length))]+code;n/=BigInt(shareAlphabet.length)}return code;
}
// /l/ links: "lat,lon,name" as URL-safe base64 of UTF-8.
function shareDecode(payload){
 try{if(!/^[A-Za-z0-9_-]{8,400}$/.test(payload))return null;const b=atob(payload.replace(/-/g,'+').replace(/_/g,'/')),text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(b,c=>c.charCodeAt(0))),m=text.match(/^(-?\d{1,3}\.\d{1,6}),(-?\d{1,3}\.\d{1,6}),(.*)$/s);if(!m)return null;const lat=Number(m[1]),lon=Number(m[2]);return sharePoint(lat,lon)?{name:shareName(m[3]),lat,lon}:null}catch{return null}
}
export async function sharedPlaces(request,env){
 const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return json({error:'Same-origin requests only'},403);
 if(Number(request.headers.get('content-length'))>512)return json({error:'Request too large'},413);
 if(!env?.DB)return json({error:'Short links are not available yet.'},503);
 const now=Math.floor(Date.now()/1000),ip=request.headers.get('cf-connecting-ip')||'anonymous',recent=(shareWrites.get(ip)||[]).filter(t=>now-t<60);
 if(recent.length>=10)return json({error:'Too many links. Please wait a minute.'},429);
 recent.push(now);shareWrites.set(ip,recent);if(shareWrites.size>2000)shareWrites.delete(shareWrites.keys().next().value);
 let body;try{body=JSON.parse(await request.text())}catch{return json({error:'Invalid request.'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['name','lat','lon'].includes(k))||!sharePoint(body.lat,body.lon)||(body.name!==undefined&&typeof body.name!=='string'))return json({error:'Choose a valid Malaysian place.'},400);
 const lat=Math.round(body.lat*1e5)/1e5,lon=Math.round(body.lon*1e5)/1e5,name=shareName(body.name);
 try{
  if(Math.random()<0.02)await env.DB.prepare('DELETE FROM shared_places WHERE expires_at<?').bind(now).run();
  for(let round=0;round<5;round++){
   const code=await shareCode(lat,lon,name,round),row=await env.DB.prepare('SELECT name,lat,lon,expires_at FROM shared_places WHERE code=?').bind(code).first();
   if(row&&row.name===name&&row.lat===lat&&row.lon===lon){if(row.expires_at<now+shareLife/2)await env.DB.prepare('UPDATE shared_places SET expires_at=? WHERE code=?').bind(now+shareLife,code).run();return json({code,url:url.origin+'/s/'+code})}
   if(row&&row.expires_at>now)continue;
   if(row)await env.DB.prepare('DELETE FROM shared_places WHERE code=?').bind(code).run();
   const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM shared_places WHERE expires_at>?').bind(now).first();if((total?.n||0)>=200000)return json({error:'Sharing is busy right now. Please try again later.'},503);
   await env.DB.prepare('INSERT INTO shared_places (code,name,lat,lon,created_at,expires_at) VALUES (?,?,?,?,?,?)').bind(code,name,lat,lon,now,now+shareLife).run();
   return json({code,url:url.origin+'/s/'+code},201);
  }
  return json({error:'Could not create a link. Please try again.'},503);
 }catch{return json({error:'Short links are temporarily unavailable.'},503)}
}
// The app page for a shared link: the normal app plus a preview for chat apps and the place for the app to open. Unknown or expired links open the plain app with a note.
export async function sharedPlacePage(request,env,index){
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const url=new URL(request.url),now=Math.floor(Date.now()/1000),kind=url.pathname.slice(1,2),key=url.pathname.slice(3);
 let place=null,status='missing';
 if(kind==='l')place=shareDecode(key);
 else if(/^[2-9a-hj-km-np-zA-HJ-NP-Z]{7}$/.test(key)&&env?.DB){
  try{const row=await env.DB.prepare('SELECT name,lat,lon,expires_at FROM shared_places WHERE code=?').bind(key).first();
   if(row&&row.expires_at>now){place={name:row.name,lat:row.lat,lon:row.lon};if(row.expires_at<now+shareLife-2592000)await env.DB.prepare('UPDATE shared_places SET expires_at=? WHERE code=?').bind(now+shareLife,key).run()}else if(row)status='expired'}catch{status='unavailable'}
 }
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':place?'public, max-age=300':'no-store','X-Robots-Tag':'noindex'};
 const base='<meta charset="utf-8"><base href="/">';
 let head;
 if(place){
  const label=place.name||place.lat.toFixed(4)+', '+place.lon.toFixed(4),title='Lapan · '+label,page=url.origin+url.pathname;
  head=base+'<meta property="og:type" content="website"><meta property="og:site_name" content="Lapan"><meta property="og:title" content="'+shareHtml(title)+'"><meta property="og:description" content="Ketik untuk arah perjalanan · Tap for directions. Percuma, tanpa log masuk · Free, no login."><meta property="og:image" content="'+shareHtml(url.origin)+'/lapan-512.png"><meta property="og:url" content="'+shareHtml(page)+'"><meta name="twitter:card" content="summary"><meta name="robots" content="noindex"><meta name="lapan-share" content="'+shareHtml(JSON.stringify({n:place.name,la:place.lat,lo:place.lon}))+'">';
 }else head=base+'<meta name="robots" content="noindex"><meta name="lapan-share-error" content="'+shareHtml(status)+'">';
 let body=index.body.replace('<meta charset="utf-8">',head);
 if(place)body=body.replace(/<title>[^<]*<\/title>/,'<title>'+shareHtml('Lapan · '+(place.name||place.lat.toFixed(4)+', '+place.lon.toFixed(4)))+'</title>');
 return new Response(request.method==='HEAD'?null:body,{status:200,headers});
}
