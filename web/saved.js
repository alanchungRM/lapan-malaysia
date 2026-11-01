// Home and Work shortcuts. Two saved places kept only in this browser (localStorage), shown as one-tap chips above Recent locations.
(function(root){
const KEY='lapan-saved',KINDS=['home','work'],LABEL={home:'Home',work:'Work'};
// A saved place is [name, lat, lon] inside Malaysia, the same bounds the app uses for GPS fixes.
function clean(p){if(!Array.isArray(p)||typeof p[0]!=='string')return null;const name=p[0].trim().slice(0,160),lat=Number(p[1]),lon=Number(p[2]);if(!name||name==='My location'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<0.8||lat>7.6||lon<99||lon>120)return null;return [name,lat,lon]}
function createStore(storage){
 let data={home:null,work:null};
 try{const raw=JSON.parse(storage.getItem(KEY)||'{}')||{};for(const k of KINDS)data[k]=clean(raw[k])}catch{}
 const save=()=>{try{storage.setItem(KEY,JSON.stringify(data));return true}catch{return false}};
 return {get:kind=>KINDS.includes(kind)?data[kind]:null,
  set(kind,place){const p=clean(place);if(!KINDS.includes(kind)||!p)return false;data[kind]=p;return save()},
  clear(kind){if(!KINDS.includes(kind))return false;data[kind]=null;return save()}};
}
// A current-location fix has no street name, so it is stored by its coordinates and shows the same in both languages.
const coordinates=(lat,lon)=>lat.toFixed(4)+', '+lon.toFixed(4);
if(typeof module==='object')module.exports={clean,createStore,coordinates,KEY,KINDS};
if(!root.document)return;
const $=id=>document.getElementById(id),store=createStore(root.localStorage||{getItem:()=>null,setItem(){throw Error('unavailable')}});
let kind='home',destination=()=>null;
const chip=k=>document.querySelector('[data-saved="'+k+'"]'),edit=k=>document.querySelector('[data-saved-edit="'+k+'"]');
function render(){for(const k of KINDS){const place=store.get(k),c=chip(k);if(!c)continue;c.querySelector('.saved-name').textContent=place?place[0]:'';c.querySelector('.saved-name').hidden=!place;c.querySelector('.saved-hint').hidden=!!place;edit(k).hidden=!place;c.classList.toggle('is-set',!!place)}}
function dialogState(message=''){const place=store.get(kind),to=destination();$('savedTitle').textContent=(place?'Change ':'Set ')+LABEL[kind];$('savedCurrent').hidden=!place;$('savedName').textContent=place?place[0]:'';$('savedUseTo').disabled=!clean(to);$('savedToName').textContent=clean(to)?to[0]:'';$('savedToName').hidden=!clean(to);$('savedRemove').textContent='Remove '+LABEL[kind];$('savedRemove').hidden=!place;$('savedStatus').textContent=message}
function open(k){kind=k;dialogState();$('savedDialog').showModal();$('savedUseTo').disabled?$('savedUseHere').focus():$('savedUseTo').focus()}
function saved(place){if(store.set(kind,place)){render();$('savedDialog').close();$('status').textContent=LABEL[kind]+' saved.'}else dialogState('This browser cannot save places right now.')}
for(const k of KINDS){chip(k).onclick=()=>{const place=store.get(k);if(!place)return open(k);root.dispatchEvent(new CustomEvent('lapan-saved-place',{detail:{kind:k,place:place.slice()}}))};edit(k).onclick=()=>open(k)}
$('savedUseTo').onclick=()=>{const to=clean(destination());if(to)saved(to);else dialogState('Search for a place in the To box first.')};
$('savedUseHere').onclick=()=>{if(!navigator.geolocation)return dialogState('This browser does not support location.');dialogState('Finding your location…');navigator.geolocation.getCurrentPosition(p=>{const {latitude:y,longitude:x}=p.coords,place=clean([coordinates(y,x),y,x]);if(place)saved(place);else dialogState('Your location is outside Malaysia. Choose a Malaysian starting point.')},()=>dialogState('Location is unavailable or permission was denied.'),{enableHighAccuracy:true,timeout:15000,maximumAge:30000})};
$('savedRemove').onclick=()=>{store.clear(kind);render();$('savedDialog').close();$('status').textContent=LABEL[kind]+' removed.'};
$('closeSaved').onclick=$('doneSaved').onclick=()=>$('savedDialog').close();
$('savedDialog').addEventListener('click',e=>{if(e.target===$('savedDialog')){const r=$('savedDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('savedDialog').close()}});
root.LapanSaved={get:k=>store.get(k),bind(options){destination=options.destination||destination},render};
render();
})(typeof window!=='undefined'?window:globalThis);
