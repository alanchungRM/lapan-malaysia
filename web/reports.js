// Anonymous community reports while driving: report a crash, stopped vehicle, object, flood, pothole or hidden police, see what other drivers reported ahead on your route, and say whether it is still there.
(function(root){
const KINDS=['crash','stopped','object','flood','pothole','police-hidden'],RANGE=500,ASK=120,REFRESH_MS=60000,REFRESH_M=1000,FIX_MAX_MS=30000;
const {project}=typeof module==='object'?require('./cameras.js'):root.LapanCameras;
const LABELS={crash:'Crash',stopped:'Stopped vehicle',object:'Object on road',flood:'Flooding',pothole:'Pothole','police-hidden':'Police Hidden'};
const NAMES={crash:'Crash reported ahead',stopped:'Stopped vehicle reported ahead',object:'Object on the road reported ahead',flood:'Flooding reported ahead',pothole:'Pothole reported ahead','police-hidden':'Police reported ahead'};
const VOICE={crash:'Crash reported ahead, in {m} metres.',stopped:'Stopped vehicle reported ahead, in {m} metres.',object:'Object on the road reported ahead, in {m} metres.',flood:'Flooding reported ahead, in {m} metres.',pothole:'Pothole reported ahead, in {m} metres.','police-hidden':'Police reported ahead, in {m} metres.'};
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
function remainingText(milliseconds,t){
 const seconds=Math.max(0,Math.ceil(milliseconds/1000));
 if(!seconds)return t('Report expired');
 const h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;
 return h?t('Time remaining: {h} h {m} min',{h,m}):t('Time remaining: {m} min {s} s',{m,s});
}
if(typeof module==='object')module.exports={LABELS,placeOnRoute,ahead,describe,ageText,shouldRefresh,remainingText,KINDS,RANGE,ASK};
if(!root.document)return;
const $=id=>document.getElementById(id),SEEN='lapan-report-votes',KEY='lapan-report-key';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
let browserKey=hex(crypto.getRandomValues(new Uint8Array(16)));
let available=null,checkedAt=0,last=null,inflight=null,fix=null,fixAt=0,route=null,items=[],raw=[],voted=new Set(),spoken=new Set(),markers=new Map(),askFor=null,askTimer=0,ticker=0;
try{
 const saved=localStorage.getItem(KEY);
 if(/^[a-f0-9]{32}$/.test(saved||''))browserKey=saved;
 else localStorage.setItem(KEY,browserKey);
 voted=new Set(JSON.parse(localStorage.getItem(SEEN)||'[]'));
}catch{}
const prompted=new Set(),pendingVotes=new Set();
const remember=id=>{voted.add(id);try{localStorage.setItem(SEEN,JSON.stringify([...voted].slice(-80)))}catch{}};
const translate=(key,vars)=>root.LapanI18n?.t(key,vars)??key.replace(/\{(\w+)\}/g,(token,name)=>vars?.[name]??token);
function setText(node,text){
 if(node.textContent!==text)node.textContent=text;
}
const I18=()=>{const I=root.LapanI18n;return I&&{t:translate,s:(k,v)=>I.speechLang()==='ms'?I.t(k,v):k.replace(/\{(\w+)\}/g,(x,n)=>n in(v||{})?v[n]:x)}};
function setAvailable(v){available=v;checkedAt=Date.now();$('navReport').hidden=!v}
async function call(path,options){const r=await fetch(path,options);let body=null;try{body=await r.json()}catch{}return {status:r.status,body}}
function write(path,body){return call(path,{method:'POST',headers:{'Content-Type':'application/json','X-Lapan-Report-Key':browserKey},body:JSON.stringify(body)})}
function clearMarkers(){for(const {marker} of markers.values())marker.remove();markers.clear()}
function paintMap(){
 const map=root.LapanDrive?.reportMap();
 for(const [id,entry] of markers){
  if(map&&raw.some(r=>r.id===id))continue;
  entry.marker.remove();markers.delete(id);
 }
 if(!map)return;
 for(const report of raw){
  if(markers.has(report.id))continue;
  const icon=document.querySelector('[data-report="'+report.kind+'"] svg');
  const el=document.createElement('button');el.type='button';el.className='report-pin report-'+report.kind;
  el.setAttribute('aria-label',translate(LABELS[report.kind]));if(icon)el.append(icon.cloneNode(true));
  const content=document.createElement('div'),header=document.createElement('div'),badge=document.createElement('span');
  const name=document.createElement('strong'),time=document.createElement('span'),close=document.createElement('button');
  const actions=document.createElement('div'),still=document.createElement('button'),cleared=document.createElement('button'),status=document.createElement('p');
  content.className='report-popup';header.className='report-popup-header';badge.className='report-popup-icon report-'+report.kind;
  time.className='report-details';close.className='report-popup-close';actions.className='report-vote-actions';
  if(icon)badge.append(icon.cloneNode(true));
  badge.setAttribute('aria-hidden','true');
  close.type=still.type=cleared.type='button';close.textContent='×';
  close.setAttribute('aria-label',translate('Close report'));
  status.setAttribute('role','status');
  still.onclick=()=>vote(report.id,true);cleared.onclick=()=>vote(report.id,false);
  header.append(badge,name,close);actions.append(still,cleared);content.append(header,time,actions,status);
  const popup=new root.maplibregl.Popup({
   offset:21,closeButton:false,focusAfterOpen:false,className:'lapan-report-popup',maxWidth:'min(288px, calc(100vw - 32px))'
  }).setDOMContent(content);
  close.onclick=()=>{popup.remove();el.focus({preventScroll:true})};
  const marker=new root.maplibregl.Marker({element:el}).setLngLat([report.lon,report.lat]).setPopup(popup).addTo(map);
  markers.set(report.id,{marker,name,time,close,actions,still,cleared,status});
 }
}
function refreshDetails(){
 const now=Date.now(),live=raw.filter(r=>r.deadline>now);
 if(live.length!==raw.length){raw=live;items=placeOnRoute(raw,route);renderAhead(false)}
 paintMap();
 for(const report of raw){
  const entry=markers.get(report.id);
  if(!entry)continue;
  setText(entry.name,translate(LABELS[report.kind]));
  const closeLabel=translate('Close report');
  if(entry.close.getAttribute('aria-label')!==closeLabel)entry.close.setAttribute('aria-label',closeLabel);
  setText(entry.time,remainingText(report.deadline-now,translate));
  paintVote(report.id);
 }
}
async function refresh(f){
 if(inflight)return;
 const controller=new AbortController();inflight=controller;
 const at=Date.now();
 last={at,lat:f.latitude,lon:f.longitude};
 try{
  const q=new URLSearchParams({lat:f.latitude.toFixed(4),lon:f.longitude.toFixed(4),r:'5000'});
  const res=await call('/api/reports?'+q,{signal:controller.signal});
  if(controller.signal.aborted)return;
  if(res.status===503){setAvailable(false);raw=[];items=[];hideAll();paintMap();return}
  if(res.status!==200||!Array.isArray(res.body?.reports))return;
  setAvailable(true);
  raw=res.body.reports.filter(r=>KINDS.includes(r.kind)&&r.remainingSeconds>0).map(r=>({...r,deadline:at+r.remainingSeconds*1000}));
  items=placeOnRoute(raw,route);refreshDetails();renderAhead(false);
 }catch{}finally{if(inflight===controller)inflight=null}
}
function hideBanner(){$('reportWarning').classList.add('hidden')}
function hideAsk(){$('reportAsk').classList.add('hidden');askFor=null;clearTimeout(askTimer)}
function hideAll(){hideBanner();hideAsk()}
function paintVote(id){
 const entry=markers.get(id);
 if(!entry)return;
 setText(entry.still,translate('Still there'));
 setText(entry.cleared,translate('Cleared'));
 const hidden=voted.has(id),disabled=pendingVotes.has(id);
 if(entry.actions.hidden!==hidden)entry.actions.hidden=hidden;
 if(entry.still.disabled!==disabled)entry.still.disabled=entry.cleared.disabled=disabled;
}
async function vote(id,still){
 if(voted.has(id)||pendingVotes.has(id)||!raw.some(report=>report.id===id&&report.deadline>Date.now()))return;
 if(askFor===id)hideAsk();
 pendingVotes.add(id);paintVote(id);
 const entry=markers.get(id);
 if(entry)entry.status.textContent='';
 try{
  const result=await write('/api/reports/vote',{id,still});
  if(result.status===200||result.status===410){
   remember(id);
   if(entry)entry.status.textContent=translate(result.status===200?'Report updated':'Report expired');
  }else if(entry)entry.status.textContent=translate('Could not update the report. Try again.');
 }catch{if(entry)entry.status.textContent=translate('Could not update the report. Try again.')}
 finally{pendingVotes.delete(id);paintVote(id);last=null}
}
$('reportYes').onclick=()=>askFor&&vote(askFor,true);$('reportNo').onclick=()=>askFor&&vote(askFor,false);
function stop({keepFix=false}={}){
 inflight?.abort();inflight=null;hideAll();route=null;items=[];raw=[];last=null;
 clearInterval(ticker);ticker=0;spoken.clear();prompted.clear();clearMarkers();
 // Arrival stops background reports, but a fresh fix can still be used in the report dialog.
 if(!keepFix){
  fix=null;fixAt=0;
  if(dialog.open)dialog.close();
 }
}
function renderAhead(announce){
 const coords=route?.geometry?.coordinates;
 if(!fix||!coords?.length||!items.length){hideAll();return}
 const here=project([fix.longitude,fix.latitude],coords);
 const next=here.distance<=45?ahead(items.filter(r=>r.deadline>Date.now()),here.along):null;
 if(!next){hideAll();return}
 const alert=describe(next,I18()),banner=$('reportWarning');
 const text=alert.text;
 if(banner.textContent!==text)banner.textContent=text;
 banner.classList.remove('hidden');
 if(announce&&!spoken.has(next.id)){spoken.add(next.id);root.LapanVoice?.speak(alert.voice)}
 if(askFor&&askFor!==next.id)hideAsk();
 if(announce&&next.remaining<=ASK&&!voted.has(next.id)&&!pendingVotes.has(next.id)&&!prompted.has(next.id)&&!askFor){
  askFor=next.id;prompted.add(next.id);$('reportAskKind').textContent=translate(LABELS[next.kind]);$('reportAsk').classList.remove('hidden');
  askTimer=setTimeout(()=>{if(askFor===next.id)hideAsk()},10000);
 }
}
function update(position,nextRoute){
 const c=position.coords;if(!c||c.accuracy>100)return;
 fix=c;fixAt=Date.now();
 if(route!==nextRoute){route=nextRoute;items=placeOnRoute(raw,route)}
 if(!ticker)ticker=setInterval(refreshDetails,1000);
 if(available!==false||Date.now()-checkedAt>=600000){
  if(shouldRefresh(last,c,Date.now()))refresh(c);
 }
 renderAhead(true);
}
// The first tap selects a category and captures the location. Only confirmation sends it.
const dialog=$('reportDialog'),choices=dialog.querySelector('.report-kinds'),confirmation=$('reportConfirm'),save=$('reportSave');
const say=text=>{$('reportStatus').textContent=translate(text)};
let selection=null,sending=false,dialogSession=0,closeTimer=0;
function resetSelection(){
 const previous=selection?.button;
 selection=null;choices.hidden=false;confirmation.hidden=true;say('');
 if(dialog.open)(previous||choices.querySelector('[data-report]')).focus();
}
function open(){
 if(sending)return;
 dialogSession++;clearTimeout(closeTimer);dialog.showModal();resetSelection();
}
$('navReport').onclick=open;
$('closeReport').onclick=$('cancelReport').onclick=()=>dialog.close();
$('reportBack').onclick=resetSelection;
dialog.addEventListener('close',()=>{clearTimeout(closeTimer);resetSelection()});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
for(const button of choices.querySelectorAll('[data-report]'))button.onclick=()=>{
 if(sending)return;
 if(!fix||Date.now()-fixAt>FIX_MAX_MS)return say('Waiting for a GPS fix. Try again in a moment.');
 selection={button,at:fixAt,body:{kind:button.dataset.report,lat:fix.latitude,lon:fix.longitude}};
 $('reportConfirmText').textContent=translate('Submit a {kind} report here?',{kind:translate(LABELS[selection.body.kind])});
 choices.hidden=true;confirmation.hidden=false;say('');save.focus();
};
save.onclick=async()=>{
 if(!selection||sending||!dialog.open)return;
 if(!fix||Date.now()-selection.at>FIX_MAX_MS){
  resetSelection();return say('Location is out of date. Choose the report again.');
 }
 const session=dialogSession;
 sending=true;save.disabled=$('reportBack').disabled=true;say('Sending…');
 try{
  const res=await write('/api/reports',selection.body);
  const accepted=res.status===200||res.status===201;
  if(accepted){if(res.body?.id)remember(res.body.id);last=null}
  if(!dialog.open||session!==dialogSession)return;
  if(accepted){
   selection=null;say('Thank you. Your report helps drivers behind you.');
   closeTimer=setTimeout(()=>{if(dialog.open&&session===dialogSession)dialog.close()},1400);
  }else if(res.status===429)say('Too many reports. Please wait a minute.');
  else if(res.status===503){setAvailable(false);say('Reports are not available right now.')}
  else say('Could not send the report. Please try again.');
 }catch{if(dialog.open&&session===dialogSession)say('Could not send. Check your connection and try again.')}
 finally{sending=false;save.disabled=$('reportBack').disabled=false}
};
root.LapanReports={update,stop};
})(typeof window==='object'?window:globalThis);
