// Share a place or a drive with one short link, and open links friends send. No tracking: a link holds a place (and your estimated arrival in the message), never your position.
(function(root){
const valid=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=.8&&lat<=7.6&&lon>=99&&lon<=120;
const clean=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,80):'';
const unnamed=name=>!name||/^Map pin\b/.test(name)||name==='My location';
// Links that carry the place inside them (used when the short-link database is not available). Must match worker/share.js.
function encodeStateless(place){
 const text=place.lat.toFixed(5)+','+place.lon.toFixed(5)+','+(unnamed(place.name)?'':clean(place.name)),bytes=new TextEncoder().encode(text);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);
 return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeStateless(payload){
 try{const bin=atob(String(payload).replace(/-/g,'+').replace(/_/g,'/')),text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bin,c=>c.charCodeAt(0))),m=text.match(/^(-?\d{1,3}\.\d{1,6}),(-?\d{1,3}\.\d{1,6}),(.*)$/s);if(!m)return null;const lat=Number(m[1]),lon=Number(m[2]);return valid(lat,lon)?{name:clean(m[3]),lat,lon}:null}catch{return null}
}
// The English message; the app's language engine supplies the Malay one.
function message(kind,name,url,time,i18n){
 const t=i18n?.t||((k,v)=>k.replace(/\{(\w+)\}/g,(x,n)=>n in v?v[n]:x));
 if(kind==='drive'&&time)return t("I'm on my way to {name}, arriving about {time}. Open in Lapan: {url}",{name,time,url});
 return t('Meet me at {name}. Open in Lapan: {url}',{name,url});
}
const coords=p=>p.lat.toFixed(4)+', '+p.lon.toFixed(4);
const labelOf=p=>unnamed(p.name)?coords(p):p.name;
// A short name for a tapped point from Photon's reverse lookup, or null.
function parseReverse(data){
 const p=data&&Array.isArray(data.features)&&data.features[0]&&data.features[0].properties;if(!p)return null;
 const street=[p.street,p.housenumber].filter(Boolean).join(' '),parts=[p.name,street,p.district||p.suburb,p.city||p.town||p.village||p.county].map(v=>typeof v==='string'?clean(v):'').filter(Boolean);
 const unique=[...new Set(parts)].slice(0,2);return unique.length?unique.join(', '):null;
}
// The place a shared page carries: {place} or {error}, or null for an ordinary visit.
function readShared(doc){
 const read=n=>doc.querySelector('meta[name="'+n+'"]')?.getAttribute('content');
 const raw=read('lapan-share');if(raw){try{const j=JSON.parse(raw),lat=Number(j.la),lon=Number(j.lo);if(valid(lat,lon))return {place:{name:clean(j.n),lat,lon}}}catch{}return {error:'invalid'}}
 const err=read('lapan-share-error');return err?{error:err}:null;
}
async function makeLink(place,fetchFn,origin){
 try{const r=await fetchFn('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:unnamed(place.name)?'':place.name,lat:place.lat,lon:place.lon})});
  if(r.ok){const j=await r.json();if(typeof j.url==='string'&&j.url.startsWith(origin+'/s/')&&/^[2-9a-hj-km-np-zA-HJ-NP-Z]{7}$/.test(j.url.slice(origin.length+3)))return {url:j.url,short:true}}}catch{}
 return {url:origin+'/l/'+encodeStateless(place),short:false};
}
if(typeof module==='object')module.exports={encodeStateless,decodeStateless,message,parseReverse,readShared,makeLink,labelOf,unnamed,coords,valid};
if(!root.document)return;
const $=id=>document.getElementById(id);let ctl=null,card=null,pin=null,lookup=null,toastTimer=0;
const I=()=>root.LapanI18n&&{t:(k,v)=>root.LapanI18n.t(k,v)};
const say=text=>{if(card){$('placeCardSub').textContent=text;return}const el=$('shareToast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),6000)};
const tr=(key,vars)=>root.LapanI18n?root.LapanI18n.t(key,vars):key.replace(/\{(\w+)\}/g,(x,n)=>n in(vars||{})?vars[n]:x);
let busy=false;
const settle=()=>{if(card)$('placeCardSub').textContent=coords(card)};
async function share(place,kind){
 if(busy)return;busy=true;
 try{
  say(tr('Making your link…'));
  const {url}=await makeLink(place,(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(4000)}),location.origin),name=labelOf(place);
  let time='';if(kind==='drive'){const eta=root.LapanDriveUI?.parse(ctl?.eta?.()||'');if(eta)time=eta.time+(eta.meridiem||'')}
  const text=message(kind,name,url,time.replace(/ /g,' ').trim(),I());
  if(navigator.share){try{await navigator.share({title:tr('Lapan: {name}',{name}),text});$('shareToast').classList.add('hidden');settle();return}catch(e){if(e&&e.name==='AbortError'){$('shareToast').classList.add('hidden');settle();return}}}
  if(navigator.clipboard&&navigator.clipboard.writeText){try{await navigator.clipboard.writeText(text);say(tr('Link copied. Paste it in a chat.'));setTimeout(settle,4000);return}catch{}}
  settle();$('shareToast').classList.add('hidden');
  const dialog=$('shareLinkDialog');
  $('shareLinkText').value=text;
  dialog.showModal();$('shareLinkText').focus();$('shareLinkText').select();
 }finally{busy=false}
}
$('shareLinkClose').onclick=()=>$('shareLinkDialog').close();
$('shareLinkSend').onclick=async()=>{
 const text=$('shareLinkText').value;
 if(navigator.share){
  try{await navigator.share({text});$('shareLinkDialog').close();return}catch(error){if(error.name==='AbortError')return}
 }
 try{await navigator.clipboard.writeText(text);$('shareLinkDialog').close();say(tr('Link copied. Paste it in a chat.'))}
 catch{$('shareLinkText').focus();$('shareLinkText').select()}
};
// Tap a point on the map: a card with its name, Send and Routes.
function showSaved(kind,[name,lat,lon]){
 if(!valid(lat,lon)||document.body.classList.contains('guiding'))return;
 hideCard();
 card={name,lat,lon};
 const title=document.createElement('span');
 title.textContent=kind==='work'?'Work':'Home';
 const placeName=document.createElement('span');
 placeName.setAttribute('data-no-i18n','');
 placeName.textContent=' · '+labelOf(card);
 $('placeCardName').replaceChildren(title,placeName);
 $('placeCardSub').textContent=coords(card);
 $('placeCardSend').textContent='Share location';
 $('placeCard').classList.remove('hidden');
}
function hideCard(){card=null;$('placeCardSend').textContent='Send';lookup?.abort();lookup=null;$('placeCard').classList.add('hidden');if(pin&&ctl?.map){ctl.map.removeLayer(pin);pin=null}}
async function showCard(lat,lon){
 if(!valid(lat,lon)||document.body.classList.contains('guiding'))return;
 hideCard();card={name:'',lat:Math.round(lat*1e5)/1e5,lon:Math.round(lon*1e5)/1e5};
 pin=root.L.marker([card.lat,card.lon],{icon:root.L.divIcon({className:'',html:'<div class="marker end"></div>',iconSize:[22,22],iconAnchor:[11,11]}),interactive:false,keyboard:false}).addTo(ctl.map);
 $('placeCardName').textContent=coords(card);$('placeCardSub').textContent=tr('Looking up the place…');$('placeCard').classList.remove('hidden');
 const mine=card,c=new AbortController(),timer=setTimeout(()=>c.abort(),4000);lookup=c;
 try{const u=new URL('https://photon.komoot.io/reverse');u.searchParams.set('lon',String(mine.lon));u.searchParams.set('lat',String(mine.lat));u.searchParams.set('lang','en');u.searchParams.set('limit','1');const r=await fetch(u,{signal:c.signal});if(r.ok){const name=parseReverse(await r.json());if(card===mine&&name){mine.name=name;$('placeCardName').textContent=name;$('placeCardSub').textContent=coords(mine);return}}}catch{}finally{clearTimeout(timer)}
 if(card===mine){$('placeCardName').textContent=coords(mine);$('placeCardSub').textContent=tr('Unnamed road')}
}
const pinned=()=>card&&{name:card.name||'Map pin '+card.lat.toFixed(5)+', '+card.lon.toFixed(5),lat:card.lat,lon:card.lon};
function apply(found){
 if(!found)return;
 if(found.error){say(tr('This shared link has expired or is not valid.'));return}
 const place=found.place;ctl.choose(place,false);
 const go=()=>{if(ctl.destination()?.[1]===place.lat&&ctl.destination()?.[2]===place.lon)ctl.choose(place,true)};
 if(navigator.permissions&&navigator.permissions.query)navigator.permissions.query({name:'geolocation'}).then(s=>{if(s.state==='granted')go()}).catch(()=>{});
}
root.LapanShare={showSaved,bind(options){
 ctl=options;
 if(ctl.map)ctl.map.on('click',e=>{if(e&&e.latlng)showCard(e.latlng.lat,e.latlng.lng)});
 apply(readShared(document));
}};
for(const b of document.querySelectorAll('[data-share-place]'))b.onclick=()=>{const d=ctl?.destination();if(!d||!valid(d[1],d[2])||d[0]==='My location'){say(tr('Choose a destination first.'));return}share({name:d[0],lat:d[1],lon:d[2]},'place')};
$('navShare').onclick=()=>{const d=ctl?.destination();if(!d||!valid(d[1],d[2])||d[0]==='My location'){say(tr('Choose a destination first.'));return}share({name:d[0],lat:d[1],lon:d[2]},'drive')};
$('placeCardSend').onclick=()=>{const p=pinned();if(p)share({...p,name:card.name||''},'place')};
$('placeCardRoutes').onclick=()=>{const p=pinned();if(!p)return;hideCard();ctl.choose(p,true)};
$('placeCardClose').onclick=hideCard;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&card)hideCard()});
new MutationObserver(()=>{if(document.body.classList.contains('guiding')&&card)hideCard()}).observe(document.body,{attributes:true,attributeFilter:['class']});
})(typeof window==='object'?window:globalThis);
