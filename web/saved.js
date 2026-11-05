// Home and Work shortcuts. Two saved places kept only in this browser (localStorage), shown as one-tap chips above Recent locations.
(function(root){
const KEY='lapan-saved',KINDS=['home','work'],LABEL={home:'Home',work:'Work'};
// A saved place is [name, lat, lon] inside Malaysia, the same bounds the app uses for GPS fixes.
function clean(p){if(!Array.isArray(p)||typeof p[0]!=='string')return null;const name=p[0].trim().slice(0,160),lat=p[1],lon=p[2];if(!name||name==='My location'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<0.8||lat>7.6||lon<99||lon>120)return null;return [name,lat,lon]}
function createStore(storage){
 let data={home:null,work:null};
 try{const raw=JSON.parse(storage.getItem(KEY)||'{}')||{};for(const k of KINDS)data[k]=clean(raw[k])}catch{}
 const save=next=>{try{storage.setItem(KEY,JSON.stringify(next));data=next;return true}catch{return false}};
 return {get:kind=>KINDS.includes(kind)?data[kind]?.slice()||null:null,
  set(kind,place){const p=clean(place);if(!KINDS.includes(kind)||!p)return false;return save({...data,[kind]:p})},
  clear(kind){if(!KINDS.includes(kind))return false;return save({...data,[kind]:null})}};
}
// A current-location fix has no street name, so it is stored by its coordinates and shows the same in both languages.
const coordinates=(lat,lon)=>lat.toFixed(4)+', '+lon.toFixed(4);
// A chip is narrow, so coordinates are shown to three decimals (about 100 m).
const chipLabel=name=>/^-?\d+\.\d{4}, -?\d+\.\d{4}$/.test(name)?name.replace(/(\d\.\d{3})\d/g,'$1'):name;
if(typeof module==='object')module.exports={clean,createStore,coordinates,chipLabel,KEY,KINDS};
if(!root.document)return;
let storage;try{storage=root.localStorage}catch{}
const $=id=>document.getElementById(id),store=createStore(storage||{getItem:()=>null,setItem(){throw Error('unavailable')}}),dialog=$('savedDialog');
let kind='home',destination=()=>null,pickMap=null,candidate=null,session=0,request=0,timer,controller,suspended=false;
const chip=k=>document.querySelector('[data-saved="'+k+'"]'),edit=k=>document.querySelector('[data-saved-edit="'+k+'"]');
function render(){for(const k of KINDS){const place=store.get(k),c=chip(k);if(!c)continue;c.querySelector('.saved-name').textContent=place?chipLabel(place[0]):'';c.querySelector('.saved-name').hidden=!place;c.querySelector('.saved-hint').hidden=!!place;edit(k).hidden=!place;c.classList.toggle('is-set',!!place)}}
function stopPending(){request++;clearTimeout(timer);controller?.abort();controller=null;$('savedUseHere').disabled=false}
function message(text=''){$('savedStatus').textContent=text}
function selection(place){candidate=clean(place);$('savedSelection').hidden=!candidate;$('savedSelectedName').textContent=candidate?candidate[0]:'';$('savedSelectedCoords').textContent=candidate?candidate[1].toFixed(5)+', '+candidate[2].toFixed(5):'';$('saveSaved').disabled=!candidate}
function select(place){stopPending();selection(place);$('savedResults').replaceChildren();message('Check the location, then tap Save.');$('saveSaved').focus()}
function open(k){stopPending();session++;suspended=false;kind=k;const place=store.get(k);$('savedTitle').textContent=(place?'Change ':'Set ')+LABEL[kind];$('saveSaved').textContent='Save '+LABEL[kind];$('savedRemove').textContent='Remove '+LABEL[kind];$('savedRemove').hidden=!place;$('savedCurrent').hidden=!place;$('savedName').textContent=place?place[0]:'';$('savedSearch').value='';$('savedResults').replaceChildren();selection(null);message();dialog.showModal();$('savedSearch').focus()}
function local(query){const q=root.LapanPlaces?.normalize(query)||query.toLowerCase();return [...(root.LapanPlaces?.search(query)||[]),...(root.LapanHistory?.places()||[]).filter(p=>p[0].toLowerCase().includes(q))]}
function showResults(items){$('savedResults').replaceChildren();for(const place of items.slice(0,15)){const p=clean(place);if(!p)continue;const button=document.createElement('button'),name=document.createElement('strong'),detail=document.createElement('small');button.type='button';button.className='saved-result';name.setAttribute('data-no-i18n','');detail.setAttribute('data-no-i18n','');name.textContent=p[0];detail.textContent=p[1].toFixed(5)+', '+p[2].toFixed(5);button.append(name,detail);button.onclick=()=>select(p);$('savedResults').append(button)}}
async function runSearch(query,token){if(token!==request||!dialog.open)return;controller=new AbortController();message('Searching for matching places…');try{const result=await root.LapanSearch.search(query,local(query),controller.signal,false);if(token!==request||!dialog.open)return;showResults(result.items);message(result.items.length?'Select a place. Check the town and address.':'No matching places. Try a town or choose on map.')}catch(e){if(token!==request||!dialog.open)return;showResults(local(query));message('Online search is unavailable. Choose a listed place or choose on map.')}}
$('savedSearch').addEventListener('input',()=>{stopPending();selection(null);$('savedResults').replaceChildren();const query=$('savedSearch').value.trim();if(query.length<3){message('Enter at least 3 characters, or choose on map.');return}showResults(local(query));const token=request;timer=setTimeout(()=>runSearch(query,token),450)});
$('savedSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(timer);const query=$('savedSearch').value.trim();if(query.length>=3){stopPending();selection(null);runSearch(query,request)}}});
$('savedUseHere').onclick=()=>{stopPending();const token=request;if(!root.navigator?.geolocation)return message('This browser does not support location.');message('Finding your location…');$('savedUseHere').disabled=true;try{root.navigator.geolocation.getCurrentPosition(p=>{if(token!==request||!dialog.open)return;$('savedUseHere').disabled=false;const y=p.coords.latitude,x=p.coords.longitude;if(!Number.isFinite(y)||!Number.isFinite(x))return message('Location is unavailable or permission was denied.');const place=clean([coordinates(y,x),y,x]);if(!place)return message('Your location is outside Malaysia. Choose a Malaysian starting point.');select(place);if(p.coords.accuracy>100)message('GPS accuracy is low. Check the location on the map before saving.');},()=>{if(token!==request||!dialog.open)return;$('savedUseHere').disabled=false;message('Location is unavailable or permission was denied.')},{enableHighAccuracy:true,timeout:15000,maximumAge:0})}catch{if(token===request){$('savedUseHere').disabled=false;message('Location is unavailable or permission was denied.')}}};
$('savedUseMap').onclick=()=>{if(!pickMap)return message('Map selection is unavailable. Try searching for a place.');stopPending();const token=session;suspended=true;dialog.close();const restore=()=>{if(token!==session)return false;dialog.showModal();suspended=false;return true};try{pickMap({place:candidate||store.get(kind)||clean(destination()),title:'Choose '+LABEL[kind]+' on map',onChoose(place){if(!restore())return;select(place)},onCancel(){if(restore())$('savedUseMap').focus()}})}catch{if(restore())message('Map selection is unavailable. Try searching for a place.')}};
$('saveSaved').onclick=()=>{if(!candidate)return;stopPending();if(!store.set(kind,candidate))return message('This browser cannot save places right now.');render();dialog.close();$('status').textContent=LABEL[kind]+' saved.'};
$('savedRemove').onclick=()=>{stopPending();if(!store.clear(kind))return message('This browser cannot save places right now.');render();dialog.close();$('status').textContent=LABEL[kind]+' removed.'};
for(const k of KINDS){chip(k).onclick=()=>{const place=store.get(k);if(!place)return open(k);root.dispatchEvent(new CustomEvent('lapan-saved-place',{detail:{kind:k,place:place.slice()}}))};edit(k).onclick=()=>open(k)}
$('closeSaved').onclick=$('cancelSaved').onclick=()=>{suspended=false;stopPending();session++;dialog.close()};
dialog.addEventListener('cancel',()=>{suspended=false;stopPending();session++});
dialog.addEventListener('close',()=>{if(!dialog.open&&!suspended){stopPending();session++}});
root.LapanSaved={get:k=>store.get(k),bind(options){destination=options.destination||destination;pickMap=options.pickMap||pickMap},render};
render();
})(typeof window!=='undefined'?window:globalThis);
