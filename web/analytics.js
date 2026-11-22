(()=>{const disabled=()=>{try{return localStorage.getItem('lapan-analytics-disabled')==='1'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true}catch{return true}};let id=null;try{id=crypto.randomUUID()}catch{return}const ua=navigator.userAgent,device=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?'iPhone/iPad':/Android/.test(ua)?'Android':'Desktop/other',browser=/SamsungBrowser/.test(ua)?'Samsung Internet':/Edg|EdgiOS/.test(ua)?'Edge':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Other';let started=false;
function dailyBrowser(){if(disabled())return null;try{const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()),key='lapan-browser-day',saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.day===day&&/^[a-f0-9-]{36}$/i.test(saved.id))return saved.id;const id=crypto.randomUUID();localStorage.setItem(key,JSON.stringify({day,id}));return JSON.parse(localStorage.getItem(key)).id}catch{return null}}
// Web Locks serialises first-use creation across tabs where supported.

async function send(kind){if(disabled()||document.visibilityState==='hidden'&&kind!=='leave')return;try{const browserId=kind==='leave'?null:await(navigator.locks?.request?navigator.locks.request('lapan-daily-browser',()=>dailyBrowser()):Promise.resolve(dailyBrowser()));if(disabled())return;const r=await fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,kind,device,browser,...(browserId?{browserId}:{})}),keepalive:kind==='leave'});if(r.ok&&kind==='page')started=true}catch{}}
let countedDay=null,inflight=false,retryAt=0;
let trip=null;
function sendEngagement(force=false){
 if(!trip||disabled())return;
 const active=trip,now=Date.now(),units=Math.min(15000,Math.floor(active.metres/100));
 if(units<=active.sent||(!force&&(active.pending||now-active.at<30000&&units!==2)))return;
 active.at=now;
 active.pending=true;
 fetch('/api/navigation-engagement',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:active.id,day:active.day,units}),keepalive:true})
  .then(response=>{if(response.ok)active.sent=Math.max(active.sent,units)})
  .catch(()=>{}).finally(()=>{active.pending=false});
}
function sampleEngagement(position){
 if(disabled()){trip=null;return}
 const {latitude,longitude,accuracy}=position.coords;
 if(![latitude,longitude,accuracy].every(Number.isFinite)||accuracy<0||accuracy>65)return;
 const time=Number.isFinite(position.timestamp)?position.timestamp:Date.now();
 if(!trip){
  trip={id:crypto.randomUUID(),day:new Date(Date.now()+8*3600000).toISOString().slice(0,10),metres:0,sent:-1,at:0};
  sendEngagement(true);
 }
 const current={latitude,longitude,accuracy,time},previous=trip.point;
 if(trip.latest>=time)return;
 if(!previous||time-trip.latest>20000){trip.point=current;trip.latest=time;sendEngagement();return}
 trip.latest=time;
 const dx=(longitude-previous.longitude)*111320*Math.cos(latitude*Math.PI/180);
 const dy=(latitude-previous.latitude)*111320;
 const metres=Math.hypot(dx,dy);
 if(metres>=Math.max(10,(accuracy+previous.accuracy)/2)){
  if(metres/(time-previous.time)*1000<=70)trip.metres+=metres;
  trip.point=current;
 }
 sendEngagement();
}
function pauseEngagement(){
 sendEngagement(true);
 if(trip)trip.point=null;
}
function endEngagement(){pauseEngagement();trip=null}
window.addEventListener('storage',event=>{if(event.key==='lapan-analytics-disabled'&&disabled())trip=null});
window.LapanAnalytics={sampleEngagement,pauseEngagement,endEngagement,async navigation(position){
 if(disabled()||document.visibilityState==='hidden'||inflight)return;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now());
 if(countedDay===day||Date.now()<retryAt)return;
 const region=window.LapanNavigationRegion?.classify(position);if(!region)return;
 inflight=true;retryAt=Date.now()+30000;try{const browserId=await(navigator.locks?.request?navigator.locks.request('lapan-daily-browser',()=>dailyBrowser()):Promise.resolve(dailyBrowser()));if(!browserId||disabled())return;
 const r=await fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,kind:'navigation',device,browser,browserId,navigationRegion:region})});if(r.ok)countedDay=day;
 }catch{}finally{inflight=false}
}};
send('page');setInterval(()=>send(started?'heartbeat':'page'),30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')send(started?'heartbeat':'page')});window.addEventListener('pagehide',()=>send('leave'));window.addEventListener('storage',e=>{if(e.key==='lapan-analytics-disabled'&&disabled())fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,kind:'leave',device,browser}),keepalive:true}).catch(()=>{})});})();
