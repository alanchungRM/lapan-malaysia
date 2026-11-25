(()=>{const key='lapan-map-appearance',media=window.matchMedia?.('(prefers-color-scheme: dark)'),styles={day:'https://tiles.openfreemap.org/styles/liberty',night:'/map-night-gray.json',sunset:'/map-sunset.json'};const ui2=()=>document.documentElement.dataset.ui==='2';const defaultMode=()=>ui2()?'auto':'day';let mode=defaultMode();try{const v=localStorage.getItem(key);if(['auto','day','night'].includes(v))mode=v}catch{}const bindings=new Set();const sunset=()=>document.documentElement.dataset.skin==='sunset';const theme=()=>sunset()?'sunset':ui2()&&window.LapanTheme?window.LapanTheme.current():mode==='auto'?(media?.matches?'night':'day'):mode;const url=()=>styles[theme()];
function bind(gl){let version=0,applied=url();async function update(){const token=++version,target=url();if(target===applied)return;try{const r=await fetch(target);if(!r.ok)throw Error();const style=await r.json();if(token!==version)return;const old=gl.getStyle(),layers=(old.layers||[]).filter(l=>l.id.startsWith('lapan-')),sources={...style.sources};for(const layer of layers)if(old.sources[layer.source])sources[layer.source]=old.sources[layer.source];gl.setStyle({...style,sources,layers:[...style.layers,...layers]});applied=target}catch{const note=document.getElementById('mapAppearanceNote');if(note)note.textContent='Map appearance could not update. Your current map remains available; try choosing again.'}}bindings.add(update);gl.on?.('remove',()=>{version++;bindings.delete(update)});return gl}
function sync(){if(ui2())window.LapanTheme?.apply();document.documentElement.dataset.mapTheme=theme();const input=document.getElementById('mapAppearance');if(input){input.value=mode;input.disabled=sunset()}const note=document.getElementById('mapAppearanceNote');if(note)note.textContent=sunset()?'Sunset Drive uses its own map colours.':ui2()?'Saved in this browser. Auto follows sunrise and sunset where you are.':'Saved in this browser. Auto follows your device’s light or dark setting.';bindings.forEach(fn=>fn())}
window.LapanMapAppearance={url,bind,refresh:sync,mode:()=>mode};media?.addEventListener?.('change',()=>{if(mode==='auto')sync()});window.addEventListener('storage',e=>{if(e.key===key){mode=['auto','day','night'].includes(e.newValue)?e.newValue:defaultMode();sync()}});document.addEventListener('DOMContentLoaded',()=>{const input=document.getElementById('mapAppearance');if(input)input.onchange=()=>{mode=input.value;try{localStorage.setItem(key,mode)}catch{}sync()};sync()});})();

// Satellite imagery is a planning-map overlay. The driving renderer keeps its standard style.
window.LapanMapAppearance.bindSatellite=(gl,selector)=>{
 const mapWrap=document.querySelector('.mapwrap'),credit=document.getElementById('satelliteCredit'),
  esriCredit=document.getElementById('esriMapCredit'),esriImageryCredit=document.getElementById('esriImageryCredit'),
  status=document.getElementById('satelliteStatus');
 const sources={
  esri:{type:'raster',tileSize:256,maxzoom:19,tiles:[window.location.origin+'/satellite/esri/{z}/{y}/{x}.jpg']},
  eox:{type:'raster',tileSize:256,maxzoom:14,
   tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg']}
 };
 const hiddenLayers=new Map(),layerId='planning-satellite';
 let provider='esri',suspended=false,styleReady=gl.isStyleLoaded();
 selector.value='standard';
 const active=()=>selector.value==='satellite'&&!suspended;
 function updateCredits(){
  const visible=active()&&!!gl.getLayer(layerId),esri=visible&&provider==='esri';
  credit.hidden=!visible||esri;
  esriCredit.hidden=esriImageryCredit.hidden=!esri;
  mapWrap.classList.toggle('satellite-planning',visible);
 }
 function removeOverlay(){
  if(gl.getLayer(layerId))gl.removeLayer(layerId);
  for(const key of Object.keys(sources)){
   const id=layerId+'-'+key;
   if(gl.getSource(id))gl.removeSource(id);
  }
  for(const [id,visibility] of hiddenLayers)if(gl.getLayer(id))gl.setLayoutProperty(id,'visibility',visibility);
  hiddenLayers.clear();
 }
 function sync(){
  if(!active()){
   removeOverlay();
   updateCredits();
   return;
  }
  const source=layerId+'-'+provider;
  if(!styleReady||gl.getSource(source))return;
  const layers=gl.getStyle().layers||[];
  const insertAt=layers.findIndex(layer=>layer.type==='symbol'||layer.id.startsWith('lapan-'));
  gl.addSource(source,sources[provider]);
  gl.addLayer({id:layerId,type:'raster',source,paint:{'raster-fade-duration':0}},layers[insertAt]?.id);
  if(insertAt>=0){
   for(const layer of layers.slice(insertAt)){
    if(layer.id.startsWith('lapan-')||!['background','fill','fill-extrusion','raster'].includes(layer.type))continue;
    hiddenLayers.set(layer.id,gl.getLayoutProperty(layer.id,'visibility')||'visible');
    gl.setLayoutProperty(layer.id,'visibility','none');
   }
  }
  updateCredits();
 }
 const message=text=>{status.textContent=window.LapanI18n?.t(text)||text};
 selector.onchange=()=>{
  provider='esri';
  status.textContent='';
  sync();
 };
 gl.on('style.load',()=>{styleReady=true;hiddenLayers.clear();sync()});
 gl.on('error',event=>{
  if(!active()||event.sourceId!==layerId+'-'+provider)return;
  removeOverlay();
  if(provider==='esri'){
   provider='eox';
   message('Esri imagery unavailable. Showing EOX satellite imagery.');
  }else{
   selector.value='standard';
   message('Satellite imagery unavailable. Showing the standard map.');
  }
  sync();
 });
 return guiding=>{
  if(suspended===guiding)return;
  suspended=guiding;
  sync();
 };
};
