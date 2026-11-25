// Anonymous reports can be submitted and confirmed while driving, and viewed on the selected route preview.
(function(root){
const KINDS=['crash','stopped','object','flood','pothole','police-hidden','traffic-heavy','traffic-standstill'],RANGE=500,ASK=300,ASK_DURATION_MS=15000,REFRESH_MS=60000,REFRESH_M=1000,FIX_MAX_MS=30000;
const {project}=typeof module==='object'?require('./cameras.js'):root.LapanCameras;
const LABELS={crash:'Crash',stopped:'Stopped vehicle',object:'Object on road',flood:'Flooding',pothole:'Pothole','police-hidden':'Police Hidden','traffic-heavy':'Heavy traffic','traffic-standstill':'Standstill traffic'};
const NAMES={crash:'Crash reported ahead',stopped:'Stopped vehicle reported ahead',object:'Object on the road reported ahead',flood:'Flooding reported ahead',pothole:'Pothole reported ahead','police-hidden':'Police reported ahead'};
const VOICE={crash:'Crash reported ahead, in {m} metres.',stopped:'Stopped vehicle reported ahead, in {m} metres.',object:'Object on the road reported ahead, in {m} metres.',flood:'Flooding reported ahead, in {m} metres.',pothole:'Pothole reported ahead, in {m} metres.','police-hidden':'Police reported ahead, in {m} metres.'};
// Reports that sit on the planned route, with their distance along it.
function placeOnRoute(reports,route,tolerance=40){
 const coords=route?.geometry?.coordinates;if(!Array.isArray(coords)||coords.length<2||!Array.isArray(reports))return [];
 const out=[];for(const r of reports){if(!r||!KINDS.includes(r.kind)||!Number.isFinite(r.lat)||!Number.isFinite(r.lon))continue;const p=project([r.lon,r.lat],coords);if(p.distance<=tolerance)out.push({...r,along:p.along,segment:p.segment,fraction:p.fraction})}
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
if(typeof module==='object')module.exports={LABELS,placeOnRoute,ahead,describe,ageText,shouldRefresh,remainingText,KINDS,RANGE,ASK,ASK_DURATION_MS};
if(!root.document)return;
const $=id=>document.getElementById(id),SEEN='lapan-report-votes',KEY='lapan-report-key';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
let browserKey=hex(crypto.getRandomValues(new Uint8Array(16)));
let available=null,checkedAt=0,last=null,inflight=null,fix=null,fixAt=0,route=null,items=[],raw=[],voted=new Set(),spoken=new Set(),markers=new Map(),askFor=null,askTimer=0,askEndsAt=0,ticker=0;
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
 refreshAskCountdown();
 const now=Date.now(),live=raw.filter(r=>r.deadline>now);
 if(live.length!==raw.length){raw=live;syncDrivingReports();renderAhead(false)}
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
  if(res.status===503){setAvailable(false);raw=[];syncDrivingReports();hideAll();paintMap();return}
  if(res.status!==200||!Array.isArray(res.body?.reports))return;
  setAvailable(true);
  raw=res.body.reports.filter(r=>KINDS.includes(r.kind)&&r.remainingSeconds>0).map(r=>({...r,deadline:at+r.remainingSeconds*1000}));
  syncDrivingReports();refreshDetails();renderAhead(false);
 }catch{}finally{if(inflight===controller)inflight=null}
}
function syncDrivingReports(){
 items=placeOnRoute(raw,route);
 root.LapanTrafficColors?.setCommunity(route,items);
}
function hideBanner(){$('reportWarning').classList.add('hidden')}
function hideAsk(){
 clearTimeout(askTimer);askTimer=0;askEndsAt=0;
 $('reportAsk').classList.add('hidden');askFor=null;
}
function refreshAskCountdown(){
 if(!askFor)return;
 const remaining=askEndsAt-Date.now();
 if(remaining<=0){hideAsk();return}
 setText($('reportAskCountdown'),translate('Closes in {s} s',{s:Math.ceil(remaining/1000)}));
}
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
$('reportAskDismiss').onclick=hideAsk;
$('reportYes').onclick=()=>askFor&&vote(askFor,true);$('reportNo').onclick=()=>askFor&&vote(askFor,false);
function stop({keepFix=false}={}){
 inflight?.abort();inflight=null;hideAll();root.LapanTrafficColors?.setCommunity(route,[]);route=null;items=[];raw=[];last=null;
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
 const now=Date.now();
 const live=here.distance<=45?items.filter(r=>r.deadline>now):[];
 // A prompt keeps its original deadline after the driver passes its report.
 const active=askFor?live.find(report=>report.id===askFor):null;
 if(askFor&&!active)hideAsk();
 const next=ahead(live.filter(report=>Object.hasOwn(NAMES,report.kind)),here.along);
 if(next){
  const alert=describe(next,I18());
  setText($('reportWarning'),alert.text);$('reportWarning').classList.remove('hidden');
  if(announce&&!spoken.has(next.id)){spoken.add(next.id);root.LapanVoice?.speak(alert.voice)}
  if(announce&&next.remaining<=ASK&&!voted.has(next.id)&&!pendingVotes.has(next.id)&&!prompted.has(next.id)&&!askFor){
   askFor=next.id;prompted.add(next.id);askEndsAt=now+ASK_DURATION_MS;
   $('reportAskKind').textContent=translate(LABELS[next.kind]);$('reportAsk').classList.remove('hidden');
   askTimer=setTimeout(hideAsk,ASK_DURATION_MS);
  }
 }else hideBanner();
 if(askFor){
  const report=live.find(report=>report.id===askFor),remaining=report.along-here.along;
  const distance=Math.max(10,Math.round(remaining/10)*10);
  setText($('reportAskDistance'),remaining>0?translate('Community report · {m} m',{m:distance}):translate('Community report · just passed'));
  refreshAskCountdown();
 }
}
function update(position,nextRoute){
 const c=position.coords;if(!c||c.accuracy>100)return;
 fix=c;fixAt=Date.now();
 if(route!==nextRoute){root.LapanTrafficColors?.setCommunity(route,[]);route=nextRoute;syncDrivingReports()}
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
  if(accepted){if(res.body?.id)remember(res.body.id);last=null;if(route&&fix)refresh(fix)}
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
function reportIcon(kind){
 const badge=document.createElement('span');
 badge.className='report-pin report-'+kind;
 badge.setAttribute('aria-hidden','true');
 const icon=document.querySelector('[data-report="'+kind+'"] svg');
 if(icon)badge.append(icon.cloneNode(true));
 return badge;
}
// Planning uses a separate, read-only overlay and never feeds results into routing.
let previewSession=null;
function stopPreview(){
 const previous=previewSession;
 if(!previous)return;
 previewSession=null;
 clearInterval(previous.timer);
 previous.request?.abort();
 previous.layer.remove();
 root.LapanTrafficColors?.setCommunity(previous.route,[]);
}
function preview(selected,map,bounds){
 if(previewSession?.route===selected)return;
 stopPreview();
 const bbox=[
  Math.max(.8,Math.floor((bounds.getSouth()-.001)*1000)/1000),
  Math.max(99,Math.floor((bounds.getWest()-.001)*1000)/1000),
  Math.min(7.6,Math.ceil((bounds.getNorth()+.001)*1000)/1000),
  Math.min(120,Math.ceil((bounds.getEast()+.001)*1000)/1000)
 ];
 if(bbox[0]>=bbox[2]||bbox[1]>=bbox[3])return;
 const L=root.L, layer=L.layerGroup().addTo(map);
 const session={route:selected,layer,request:null,checked:0,pins:new Map()};
 previewSession=session;
 const tick=()=>{
  const now=Date.now();
  let expired=false;
  for(const [id,pin] of session.pins){
   if(pin.deadline>now)continue;
   expired=true;
   layer.removeLayer(pin.marker);
   session.pins.delete(id);
  }
  if(expired)root.LapanTrafficColors?.setCommunity(selected,[...session.pins.values()].map(pin=>pin.report));
  if(!document.hidden&&!session.request&&now-session.checked>=REFRESH_MS)refreshPreview();
 };
 async function refreshPreview(){
  const controller=new AbortController(),at=Date.now();
  session.request=controller;
  session.checked=at;
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const result=await call('/api/reports?bbox='+encodeURIComponent(bbox.join(',')),{signal:controller.signal});
   if(previewSession!==session||controller.signal.aborted||result.status!==200||!Array.isArray(result.body?.reports))return;
   const received=placeOnRoute(result.body.reports,selected).filter(r=>at+r.remainingSeconds*1000>Date.now());
   root.LapanTrafficColors?.setCommunity(selected,received);
   const active=new Set(received.map(r=>r.id));
   for(const [id,pin] of session.pins){
    if(active.has(id))continue;
    layer.removeLayer(pin.marker);
    session.pins.delete(id);
   }
   for(const report of received){
    if(session.pins.has(report.id))continue;
    const marker=L.marker([report.lat,report.lon],{
     icon:L.divIcon({className:'planning-report-marker',html:reportIcon(report.kind),iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-18]}),
     title:translate(LABELS[report.kind])
    }).bindPopup(()=>{
     const label=document.createElement('span');
     label.textContent=translate(LABELS[report.kind])+ageText(report.ageSeconds+(Date.now()-at)/1000,I18());
     return label;
    }).addTo(layer);
    marker.getElement()?.setAttribute('aria-label',translate(LABELS[report.kind]));
    session.pins.set(report.id,{marker,report,deadline:at+report.remainingSeconds*1000});
   }
  }catch{}finally{
   clearTimeout(timeout);
   session.request=null;
  }
 }
 session.timer=setInterval(tick,1000);
 if(!document.hidden)refreshPreview();
}
const browseDialog=$('browseReportsDialog'),browseList=$('browseReportsList'),browseStatus=$('browseReportsStatus');
const browseMore=$('browseReportsMore');
let browseRequest=null,browsePin=null,browseExpiry=0;
browseDialog.querySelector('button').onclick=()=>browseDialog.close();
browseDialog.addEventListener('close',()=>{
 if(browseDialog.open)return;
 browseRequest?.abort();
 browseRequest=null;
 browseMore.disabled=false;
 browseList.replaceChildren();
});
function clearBrowsePin(){
 clearTimeout(browseExpiry);
 browsePin?.remove();
 browsePin=null;
}
function stopBrowsing(){
 browseRequest?.abort();
 browseRequest=null;
 if(browseDialog.open)browseDialog.close();
 clearBrowsePin();
}
function showBrowsePin(map,report,deadline){
 if(deadline<=Date.now())return;
 clearBrowsePin();
 browseDialog.close();
 const label=document.createElement('span');
 label.textContent=translate(LABELS[report.kind]);
 const point=[report.lat,report.lon],L=root.L;
 map.setView(point,Math.max(15,map.getZoom()),{animate:false});
 browsePin=L.marker(point,{
  icon:L.divIcon({className:'planning-report-marker',html:reportIcon(report.kind),iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-18]}),
  title:label.textContent
 }).bindPopup(label).addTo(map);
 browsePin.openPopup();
 map.getContainer().scrollIntoView({block:'nearest'});
 browseExpiry=setTimeout(clearBrowsePin,deadline-Date.now());
}
function browse(map){
 if(browseDialog.open||document.body.classList.contains('guiding'))return;
 clearBrowsePin();
 browseRequest?.abort();
 browseRequest=null;
 browseList.replaceChildren();
 browseMore.hidden=true;
 browseDialog.showModal();
 return loadReportPage(map);
}
async function loadReportPage(map,before){
 if(browseRequest||!browseDialog.open)return;
 browseMore.disabled=true;
 browseStatus.textContent=translate('Checking road reports…');
 const controller=new AbortController(),at=Date.now();
 browseRequest=controller;
 const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const params=new URLSearchParams({scope:'all'});
  if(before)params.set('before',before);
  const result=await call('/api/reports?'+params,{signal:controller.signal});
  if(browseRequest!==controller||!browseDialog.open)return;
  if(result.status!==200||!Array.isArray(result.body?.reports))throw new Error('Reports unavailable');
  const now=Date.now();
  const live=result.body.reports.filter(r=>KINDS.includes(r.kind)&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&at+r.remainingSeconds*1000>now);
  const next=result.body.next;
  browseMore.hidden=!next;
  browseMore.onclick=next?()=>loadReportPage(map,next):null;
  browseStatus.textContent=live.length?'':translate(browseList.children.length?'No more active reports.':'No active reports.');
  let firstButton;
  const formatTime=new Intl.DateTimeFormat(root.LapanI18n?.lang()==='ms'?'ms-MY':'en-MY',{
   timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  for(const report of live){
   const row=document.createElement('tr'),kind=document.createElement('td'),reported=document.createElement('td'),location=document.createElement('td');
   const button=document.createElement('button'),time=document.createElement('time');
   const lat=report.lat.toFixed(3),lon=report.lon.toFixed(3);
   const timestamp=report.reportedAt*1000;
   kind.textContent=translate(LABELS[report.kind]);
   if(Number.isFinite(timestamp)){
    time.dateTime=new Date(timestamp).toISOString();
    time.textContent=formatTime.format(timestamp);
    reported.append(time);
   }else reported.textContent='—';
   button.type='button';
   button.textContent=lat+', '+lon;
   button.title=translate('Show on map');
   button.setAttribute('aria-label',button.title+' · '+kind.textContent+' · '+button.textContent);
   button.onclick=()=>{
    const deadline=at+report.remainingSeconds*1000;
    if(deadline>Date.now())showBrowsePin(map,{...report,lat:Number(lat),lon:Number(lon)},deadline);
    else{
     row.remove();
     browseStatus.textContent=translate(browseList.children.length?'Report expired':'No active reports.');
     (browseList.querySelector('button')||browseDialog.querySelector('button')).focus();
    }
   };
   location.append(button);
   row.append(kind,reported,location);
   browseList.append(row);
   firstButton??=button;
  }
  if(before)(firstButton||browseDialog.querySelector('button')).focus();
 }catch{
  if(browseRequest===controller&&browseDialog.open)browseStatus.textContent=translate('Reports are not available right now.');
 }finally{
  clearTimeout(timeout);
  if(browseRequest===controller){browseRequest=null;browseMore.disabled=false}
 }
}
root.LapanReports={update,stop,preview,stopPreview,browse,stopBrowsing,onRoute:selected=>selected===route?items:null};
})(typeof window==='object'?window:globalThis);
