// Anonymous community reports while driving: report a crash, stopped vehicle, object, flood or pothole, see what other drivers reported ahead on your route, and say whether it is still there.
(function(root){
const KINDS=['crash','stopped','object','flood','pothole'],RANGE=500,ASK=120,REFRESH_MS=60000,REFRESH_M=1000,FIX_MAX_MS=30000;
const {project}=typeof module==='object'?require('./cameras.js'):root.LapanCameras;
const LABELS={crash:'Crash',stopped:'Stopped vehicle',object:'Object on road',flood:'Flooding',pothole:'Pothole'};
const NAMES={crash:'Crash reported ahead',stopped:'Stopped vehicle reported ahead',object:'Object on the road reported ahead',flood:'Flooding reported ahead',pothole:'Pothole reported ahead'};
const VOICE={crash:'Crash reported ahead, in {m} metres.',stopped:'Stopped vehicle reported ahead, in {m} metres.',object:'Object on the road reported ahead, in {m} metres.',flood:'Flooding reported ahead, in {m} metres.',pothole:'Pothole reported ahead, in {m} metres.'};
// Reports that sit on the planned route, with their distance along it.
function placeOnRoute(reports,route,tolerance=40){
 const coords=route?.geometry?.coordinates;if(!Array.isArray(coords)||coords.length<2||!Array.isArray(reports))return [];
 const out=[];for(const r of reports){if(!r||!KINDS.includes(r.kind)||!Number.isFinite(r.lat)||!Number.isFinite(r.lon))continue;const p=project([r.lon,r.lat],coords);if(p.distance<=tolerance)out.push({...r,along:p.along})}
 return out.sort((a,b)=>a.along-b.along);
}
const ahead=(items,along)=>items.map(r=>({...r,remaining:r.along-along})).filter(r=>r.remaining>0&&r.remaining<=RANGE).sort((a,b)=>a.remaining-b.remaining)[0]||null;
function ageText(seconds,i18n){const t=i18n?.t||((k,v)=>v?k.replace(/\{(\w+)\}/g,(x,n)=>n in v?v[n]:x):k),minutes=Math.floor(Math.max(0,seconds)/60);return minutes<1?t(' · just now'):minutes<90?t(' · {n} min ago',{n:minutes}):t(' · {n} h ago',{n:Math.round(minutes/60)})}
function describe(r,i18n){
 const plain=(key,vars)=>vars?key.replace(/\{(\w+)\}/g,(x,k)=>k in vars?vars[k]:x):key,t=i18n?.t||plain,s=i18n?.s||plain,m=Math.max(10,Math.round(r.remaining/10)*10);
 return {text:t(NAMES[r.kind])+' · '+m+' m'+ageText(r.ageSeconds,i18n),voice:s(VOICE[r.kind],{m})};
}
// Fetch again after a minute, or once the driver has moved a kilometre.
function shouldRefresh(last,fix,now){if(!last)return true;if(now-last.at>=REFRESH_MS)return true;const dy=(fix.latitude-last.lat)*111320,dx=(fix.longitude-last.lon)*111320*Math.cos(fix.latitude*Math.PI/180);return Math.hypot(dx,dy)>=REFRESH_M}
if(typeof module==='object')module.exports={LABELS,placeOnRoute,ahead,describe,ageText,shouldRefresh,KINDS,RANGE,ASK};
if(!root.document)return;
const $=id=>document.getElementById(id),SEEN='lapan-report-votes';
let available=null,checkedAt=0,last=null,inflight=false,fix=null,fixAt=0,route=null,items=[],raw=[],voted=new Set(),spoken=new Set(),map=null,layer=null,askFor=null,askTimer=0;
try{voted=new Set(JSON.parse(localStorage.getItem(SEEN)||'[]'))}catch{}
const remember=id=>{voted.add(id);try{localStorage.setItem(SEEN,JSON.stringify([...voted].slice(-80)))}catch{}};
const I18=()=>{const I=root.LapanI18n;return I&&{t:(k,v)=>I.t(k,v),s:(k,v)=>I.speechLang()==='ms'?I.t(k,v):k.replace(/\{(\w+)\}/g,(x,n)=>n in(v||{})?v[n]:x)}};
function setAvailable(v){available=v;checkedAt=Date.now();$('navReport').hidden=!v}
async function call(path,options){const r=await fetch(path,options);let body=null;try{body=await r.json()}catch{}return {status:r.status,body}}
function paintMap(){if(!map)return;if(layer){map.removeLayer(layer);layer=null}if(!document.body.classList.contains('guiding')||!raw.length)return;
 layer=L.layerGroup(raw.filter(r=>KINDS.includes(r.kind)).map(r=>{const icon=document.querySelector('[data-report="'+r.kind+'"] svg'),el=document.createElement('div');el.className='report-pin report-'+r.kind;el.setAttribute('aria-hidden','true');if(icon)el.append(icon.cloneNode(true));return L.marker([r.lat,r.lon],{icon:L.divIcon({className:'',html:el,iconSize:[30,30],iconAnchor:[15,15]}),interactive:false,keyboard:false})})).addTo(map)}
async function refresh(f){if(inflight)return;inflight=true;const at=Date.now();try{const q=new URLSearchParams({lat:f.latitude.toFixed(4),lon:f.longitude.toFixed(4),r:'5000'}),res=await call('/api/reports?'+q);if(res.status===503){setAvailable(false);raw=[];items=[];paintMap();return}if(res.status!==200||!Array.isArray(res.body?.reports))return;setAvailable(true);last={at,lat:f.latitude,lon:f.longitude};raw=res.body.reports;items=placeOnRoute(raw,route);paintMap()}catch{}finally{inflight=false}}
function hideBanner(){$('reportWarning').classList.add('hidden')}
function hideAll(){hideBanner();$('reportAsk').classList.add('hidden');askFor=null;clearTimeout(askTimer)}
async function vote(id,still){remember(id);$('reportAsk').classList.add('hidden');askFor=null;try{await call('/api/reports/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,still})})}catch{}last=null}
$('reportYes').onclick=()=>askFor&&vote(askFor,true);$('reportNo').onclick=()=>askFor&&vote(askFor,false);
function stop(){hideAll();route=null;items=[];raw=[];last=null;spoken.clear();paintMap()}
function update(position,nextRoute){
 const c=position.coords;if(!c||c.accuracy>100){return}
 fix=c;fixAt=Date.now();
 if(route!==nextRoute){route=nextRoute;items=placeOnRoute(raw,route)}
 if(available===false&&Date.now()-checkedAt<600000)return;
 if(shouldRefresh(last,c,Date.now()))refresh(c);
 const coords=route?.geometry?.coordinates;if(!coords?.length||!items.length)return hideBanner();
 const here=project([c.longitude,c.latitude],coords);if(here.distance>45)return hideBanner();
 const next=ahead(items,here.along);if(!next)return hideBanner();
 const alert=describe(next,I18());$('reportWarning').textContent=alert.text;$('reportWarning').classList.remove('hidden');
 if(!spoken.has(next.id)){spoken.add(next.id);root.LapanVoice?.speak(alert.voice)}
 if(next.remaining<=ASK&&!voted.has(next.id)&&askFor!==next.id){askFor=next.id;$('reportAskKind').textContent=LABELS[next.kind];$('reportAsk').classList.remove('hidden');clearTimeout(askTimer);askTimer=setTimeout(()=>{if(askFor===next.id){remember(next.id);$('reportAsk').classList.add('hidden');askFor=null}},10000)}
}
// Reporting
const dialog=$('reportDialog'),say=text=>{$('reportStatus').textContent=text};
function open(){say('');dialog.showModal();dialog.querySelector('[data-report]').focus()}
$('navReport').onclick=open;$('closeReport').onclick=$('cancelReport').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
let sending=false;
for(const b of dialog.querySelectorAll('[data-report]'))b.onclick=async()=>{
 if(sending)return;if(!fix||Date.now()-fixAt>FIX_MAX_MS)return say('Waiting for a GPS fix. Try again in a moment.');
 sending=true;say('Sending…');
 try{const res=await call('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:b.dataset.report,lat:fix.latitude,lon:fix.longitude})});
  if(res.status===200||res.status===201){if(res.body?.id)remember(res.body.id);say('Thank you. Your report helps drivers behind you.');last=null;setTimeout(()=>{if(dialog.open)dialog.close()},1400)}
  else if(res.status===429)say('Too many reports. Please wait a minute.');else if(res.status===503){setAvailable(false);say('Reports are not available right now.')}else say('Could not send the report. Please try again.')
 }catch{say('Could not send. Check your connection and try again.')}finally{sending=false}};
root.LapanReports={update,stop,bind(options){map=options.map||map}};
})(typeof window==='object'?window:globalThis);
