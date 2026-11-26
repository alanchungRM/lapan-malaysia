(function(){
const $ = id => document.getElementById(id);
const dialog = $('stopsDialog');
const categories = document.querySelectorAll('[data-stop]');
const rvFilters = document.querySelectorAll('[data-rv-use]');
const labels = {petrol:'Petrol stations', rest:'R&R stops', shopping:'Shopping centres', prayer:'Masjid / Surau', rv:'RV stops'};
let generation = 0, controller, kind, rvUse = 'all', busy = false, asDestination = false;
const savedCampsitesKey = 'lapan-saved-campsites';
const offlineView = 'saved-rv';

function savedCampsites(){
 const items=JSON.parse(localStorage.getItem(savedCampsitesKey)||'[]');
 return Array.isArray(items)?items.filter(item=>item&&typeof item.id==='string'&&item.id.startsWith('rv/')&&Number.isFinite(item.lat)&&Number.isFinite(item.lon)):[];
}

function updateRvConnectionStatus(){
 $('rvConnectionStatus').hidden=(kind!=='rv'&&kind!==offlineView)||navigator.onLine!==false;
}

function showSavedCampsites(){
 if(!window.LapanStopsContext.allowsRv())return;
 cancelSearch();
 kind=offlineView;
 asDestination=true;
 for(const id of ['quickStopCategories','rvOptions','stopsSourceCredit','prayerNotice','prayerCredit','rvGpsStatus'])$(id).hidden=true;
 $('stopsTitle').textContent='Saved campsites';
 $('savedCampsitesHelp').hidden=false;
 $('clearSavedCampsites').hidden=true;
 $('retryStops').classList.add('hidden');
 const results=$('stopsResults');
 results.replaceChildren();
 updateRvConnectionStatus();
 let items;
 try{items=savedCampsites()}catch{
  message('Saved campsites are unavailable on this device.');
  open();
  return;
 }
 $('clearSavedCampsites').hidden=items.length===0;
 message(items.length?'Saved on this device for offline use.':'No campsites saved yet.');
 for(const item of items){
  const row=document.createElement('div');
  row.className='stop-result';
  const details=document.createElement('div');
  const name=document.createElement('strong');
  name.textContent=item.name;
  const address=document.createElement('small');
  address.textContent=item.address;
  const label=document.createElement('small');
  const hasEntrance=Number.isFinite(item.entranceLat)&&Number.isFinite(item.entranceLon);
  label.textContent=hasEntrance?'Entrance coordinates':'Campsite coordinates';
  const coords=document.createElement('small');
  coords.className='saved-campsite-coordinates';
  coords.textContent=(hasEntrance?item.entranceLat:item.lat).toFixed(6)+', '+(hasEntrance?item.entranceLon:item.lon).toFixed(6);
  const note=document.createElement('small');
  note.textContent=item.accessNotes||'Access notes unavailable. Confirm the entrance with the campsite.';
  details.append(name,address,label,coords,note);
  if(/^\+?[\d -]{5,24}$/.test(item.phone||'')){
   const contact=document.createElement('small');
   const call=document.createElement('a');
   call.href='tel:'+item.phone;
   call.textContent=item.phone;
   contact.append(call);
   details.append(contact);
  }
  const remove=document.createElement('button');
  remove.type='button';
  remove.textContent='Remove';
  remove.onclick=()=>{
   try{localStorage.setItem(savedCampsitesKey,JSON.stringify(savedCampsites().filter(saved=>saved.id!==item.id)))}
   catch{message('Could not remove this campsite from this device.');return}
   showSavedCampsites();
  };
  row.append(details,remove);
  results.append(row);
 }
 open();
}

function campsiteSaveButton(item){
 const save=document.createElement('button');
 save.type='button';
 save.textContent='Save campsite offline';
 const markSaved=()=>{
  save.textContent='Saved offline';
  save.disabled=true;
 };
 try{if(savedCampsites().some(saved=>saved.id===item.id))markSaved()}catch{}
 save.onclick=()=>{
  if(!window.LapanStopsContext.allowsRv()||!item.id?.startsWith('rv/'))return;
  const {id,name,address,lat,lon,phone,entranceLat,entranceLon,accessNotes}=item;
  try{
   const items=savedCampsites().filter(saved=>saved.id!==id);
   items.push({id,name,address,lat,lon,phone,entranceLat,entranceLon,accessNotes});
   localStorage.setItem(savedCampsitesKey,JSON.stringify(items));
  }catch{message('Could not save this campsite on this device.');return}
  markSaved();
 };
 return save;
}

function open(){
 if(!dialog.open) dialog.showModal();
}

function cancelSearch(){
 generation++;
 controller?.abort();
}

function close(){
 cancelSearch();
 dialog.close();
}

document.querySelectorAll('[data-open-stops]').forEach(button => button.addEventListener('click', () => {
 if(asDestination){
  cancelSearch();asDestination=false;kind=null;
  $('quickStopCategories').hidden=false;
  $('rvOptions').hidden=true;
  $('savedCampsitesHelp').hidden=true;
  $('clearSavedCampsites').hidden=true;
  $('rvGpsStatus').hidden=true;
  updateRvConnectionStatus();
  $('stopsSourceCredit').hidden=false;
  $('stopsTitle').textContent='Quick stops';
  $('stopsResults').replaceChildren();
  $('retryStops').classList.add('hidden');
  message('Choose a stop type.');
 }
 open();
}));
$('closeStops').onclick = close;
dialog.addEventListener('cancel', cancelSearch);
dialog.addEventListener('click', event => {
 if(event.target !== dialog) return;
 const bounds = dialog.getBoundingClientRect();
 if(event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
});

function setSource(source){
 const credit = $('stopsSource');
 const directory = source === 'Overture Maps contributors';
 credit.href = directory ? '/place-data-notices' : 'https://www.openstreetmap.org/copyright';
 credit.textContent = directory ? 'Overture Maps contributors' : 'OpenStreetMap contributors';
}

function message(text){
 $('stopsStatus').textContent = text;
}

function rvDetails(item){
 const facilities = document.createElement('small');
 for(const [index, facility] of item.facilities.entries()){
  if(index) facilities.append(' · ');
  const label = document.createElement('span');
  label.textContent = facility;
  facilities.append(label);
 }
 const links = document.createElement('small');
 const call = document.createElement('a');
 call.href = 'tel:' + item.phone;
 call.textContent = 'Call campsite';
 const source = document.createElement('a');
 source.href = item.sourceUrl;
 source.target = '_blank';
 source.rel = 'noopener';
 source.textContent = 'Listing source';
 links.append(call, ' · ', source);
 const date = document.createElement('small');
 date.textContent = 'Source reviewed: ' + item.reviewedOn;
 return item.facilities.length ? [facilities, links, date] : [links, date];
}

function renderStop(item, origin, isRv, picker){
 const row = document.createElement('div');
 row.className = 'stop-result';
 const text = document.createElement('div');
 const name = document.createElement('strong');
 const meta = document.createElement('small');
 const go = document.createElement('button');
 name.textContent = item.name;
 const distance = item.distance < 1000 ? item.distance + ' m' : (item.distance / 1000).toFixed(1) + ' km';
 const proximity=distance+' away';
 meta.textContent = [proximity,item.address].filter(Boolean).join(' · ');
 text.append(name, meta);
 if(isRv){
  const use = document.createElement('small');
  use.textContent = item.uses.map(value => value === 'day' ? 'Day Rest' : 'Overnight Stay').join(' · ');
  text.append(use, ...rvDetails(item));
 }
 go.type = 'button';
 go.textContent = picker ? 'Use as destination' : 'Route here';
 go.onclick = async () => {
  if(busy||(isRv&&!window.LapanStopsContext.allowsRv()))return;
  if(picker){
   if(picker.select(item))close();
   return;
  }
  busy = true;
  go.disabled = true;
  go.textContent = 'Planning…';
  message('Planning a road route to ' + item.name + '…');
  try{
   if(await (window.LapanStopsContext.route(item, origin))) close();
   else message('Could not plan this route. Try again or choose another place.');
  }catch{
   message('Route unavailable. Please try again.');
  }finally{
   busy = false;
   go.disabled = false;
   go.textContent = picker ? 'Use as destination' : 'Route here';
  }
 };
 if(isRv){
  row.classList.add('rv-result');
  const actions=document.createElement('div');
  actions.className='rv-result-actions';
  actions.append(go,campsiteSaveButton(item));
  row.append(text,actions);
 }else row.append(text,go);
 $('stopsResults').append(row);
}

async function search(category, use = rvUse, forDestination = false){
 const context = window.LapanStopsContext;
 if(busy||(category==='rv'&&!context.allowsRv())) return;
 kind = category;
 rvUse = use;
 asDestination = forDestination;
 const isRv = category === 'rv';
 $('savedCampsitesHelp').hidden=!isRv;
 $('clearSavedCampsites').hidden=true;
 $('rvGpsStatus').hidden=true;
 updateRvConnectionStatus();
 $('rvOptions').hidden = !isRv;
 $('quickStopCategories').hidden=forDestination;
 $('stopsSourceCredit').hidden = isRv;
 $('prayerNotice').hidden = category !== 'prayer';
 $('prayerCredit').hidden = category !== 'prayer';
 open();
 cancelSearch();
 const token = generation;
 controller = new AbortController();
 categories.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.stop === category)));
 rvFilters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rvUse === use)));
 $('stopsTitle').textContent = forDestination ? 'Choose an RV campsite' : labels[category];
 $('stopsResults').replaceChildren();
 $('retryStops').classList.add('hidden');
 setSource();
 message('Finding your location…');
 try{
  if(isRv&&navigator.onLine===false)throw Error('Open Saved campsites to view your offline details.');
  const picker=forDestination?context.rvDestinationPicker():null;
  const origin=await context.location({requireGps:isRv});
  if(token !== generation) return;
  $('rvGpsStatus').hidden=!isRv||!(origin.accuracy>100);
  message(isRv?'Finding RV campsites…':'Finding ' + labels[category].toLowerCase() + ' near ' + origin.label + '…');
  const query=new URLSearchParams({kind:category,lat:origin.lat,lon:origin.lon});
  if(isRv) query.set('use', use);
  const response = await fetch('/api/nearby?' + query, {signal:controller.signal});
  const data = await response.json();
  if(token !== generation) return;
  if(!response.ok) throw Error(data.error || 'Search unavailable. Please try again.');
  if(!isRv) setSource(data.source);
  if(isRv){
   message(data.items.length ? data.items.length+' RV stops in Malaysia · closest first' : 'No listed RV stops match this filter.');
  }else message(data.items.length ? data.items.length + ' places near ' + origin.label + ' · closest first'
   : 'No mapped places found within ' + data.radius / 1000 + ' km. Try another category.');
  for(const item of data.items) renderStop(item, origin, isRv, picker);
 }catch(error){
  if(token !== generation || error.name === 'AbortError') return;
  updateRvConnectionStatus();
  message(error.message || 'Nearby search unavailable. Please try again.');
  $('retryStops').classList.remove('hidden');
 }
}

function closeUnavailableRvPicker(){
 const context=window.LapanStopsContext;
 if(dialog.open&&(kind==='rv'||kind===offlineView)&&!context.allowsRv()) close();
}
$('vehicle').addEventListener('change',closeUnavailableRvPicker);
$('rvEnabled').addEventListener('change',closeUnavailableRvPicker);
$('viewSavedCampsites').onclick=showSavedCampsites;
$('clearSavedCampsites').onclick=()=>{
 if(kind!==offlineView||$('clearSavedCampsites').hidden)return;
 const prompt='Clear all saved campsites from this device?';
 if(!window.confirm(window.LapanI18n?.t?.(prompt)||prompt))return;
 try{localStorage.removeItem(savedCampsitesKey)}
 catch{message('Could not clear saved campsites from this device.');return}
 showSavedCampsites();
 $('closeStops').focus();
};
window.addEventListener('online',updateRvConnectionStatus);
window.addEventListener('offline',updateRvConnectionStatus);
$('findRvDestination').onclick=()=>search('rv',rvUse,true);
categories.forEach(button => button.onclick = () => search(button.dataset.stop));
rvFilters.forEach(button => button.onclick = () => search('rv', button.dataset.rvUse, asDestination));
$('retryStops').onclick = () => { if(kind) search(kind, rvUse, asDestination); };
})();
