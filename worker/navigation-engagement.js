const engagementDay = ms => new Date(ms+8*3600000).toISOString().slice(0,10);

export async function navigationEngagement(request,env){
 const reply=status=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply(405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply(403);
 if(!env.DB)return reply(503);
 if(Number(request.headers.get('content-length'))>220)return reply(413);
 let payload;
 try{
  const text=await request.text();
  if(text.length>220)return reply(413);
  payload=JSON.parse(text);
 }catch{return reply(400)}
 const now=Date.now(),today=engagementDay(now),yesterday=engagementDay(now-86400000);
 if(!payload||typeof payload!=='object'||Object.keys(payload).some(key=>!['id','day','units'].includes(key)))return reply(400);
 const {id,day,units}=payload;
 if(typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)||
  ![today,yesterday].includes(day)||!Number.isInteger(units)||units<0||units>15000)return reply(400);
 try{
  await env.DB.batch([
   env.DB.prepare('DELETE FROM navigation_usage_receipts WHERE day<?').bind(yesterday),
   env.DB.prepare('INSERT INTO navigation_usage_receipts(id,day,units) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET units=excluded.units WHERE day=excluded.day AND units<excluded.units').bind(id,day,units)
  ]);
  return reply(204);
 }catch{return reply(503)}
}
