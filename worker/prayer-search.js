// Bundled prayer-place search. No paid provider, GPS input, persistent query storage or upstream requests.
const prayerNormalize=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\bmosque\b/g,'masjid').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export async function prayerPlaceSearch(request,data){
 const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store'}}),url=new URL(request.url);
 if(request.method!=='POST')return json({error:'POST required'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Origin not allowed'},403);
 let query;try{const raw=await request.text();if(raw.length>1200)throw Error();const body=JSON.parse(raw);if(!body||Object.keys(body).some(k=>k!=='query')||typeof body.query!=='string')throw Error();query=body.query.trim();if(query.length<3||query.length>180||/[\u0000-\u001f\u007f]/.test(query))throw Error()}catch{return json({error:'Enter a place name between 3 and 180 characters.'},400)}
 if(!Array.isArray(data?.places))return json({error:'Prayer-place search is unavailable.'},503);
 const q=prayerNormalize(query),tokens=q.split(' ').filter(Boolean);if(!tokens.length||tokens.length>20)return json({items:[],source:'OpenStreetMap contributors'});
 const found=[];for(const p of data.places){
  if(!p.name||p.name==='Masjid / Surau'||['no','private'].includes(p.access)||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat<.8||p.lat>7.6||p.lon<99||p.lon>120)continue;
  const names=[p.name,...(Array.isArray(p.aliases)?p.aliases:[])].map(prayerNormalize),address=prayerNormalize(p.address||'');let best=-1;
  for(const name of names){const nameWords=name.split(' '),all=(name+' '+address).split(' ');if(!tokens.every((t,i)=>all.includes(t)||(i===tokens.length-1&&t.length>=3&&all.some(w=>w.startsWith(t)))))continue;const score=(name===q?1000:0)+tokens.filter(t=>nameWords.includes(t)).length*10+(name.startsWith(q)?20:0);best=Math.max(best,score)}
  if(best<0)continue;const label=[p.name,p.address,'Malaysia'].filter(Boolean).join(', ').slice(0,300);
  if(!found.some(x=>x.item[0]===label&&Math.abs(x.item[1]-p.lat)<.001&&Math.abs(x.item[2]-p.lon)<.001))found.push({item:[label,p.lat,p.lon],score:best});
 }
 found.sort((a,b)=>b.score-a.score||a.item[0].localeCompare(b.item[0]));return json({items:found.slice(0,12).map(x=>x.item),source:'OpenStreetMap contributors',licence:'ODbL-1.0',dataAsOf:data.dataAsOf});
}
