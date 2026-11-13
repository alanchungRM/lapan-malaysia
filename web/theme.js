(function(root){
// Day and night for the opt-in new look. Auto follows sunrise and sunset where you are; Day and Night are your explicit choice.
const KEY='lapan-sun-region',MODE='lapan-map-appearance',COLORS={day:'#0F7B5F',night:'#0B1411'};
function createTheme(env){
 const {sun,storage,doc,now,clock,mapAppearance}=env;
 let place={lat:3.139,lon:101.687},last=null;
 try{const s=JSON.parse(storage.getItem(KEY)||'null');if(s&&Number.isFinite(s.lat)&&Number.isFinite(s.lon))place=s}catch{}
 const mode=()=>{try{return mapAppearance()?.mode?.()??storage?.getItem(MODE)}catch{return 'auto'}};
 const current=()=>{const m=mode();return m==='day'||m==='night'?m:sun.themeAt(now(),place.lat,place.lon)};
 function apply(){
  const theme=current();last=theme;doc.documentElement.dataset.theme=theme;
  const meta=doc.querySelector('meta[name="theme-color"]');if(meta)meta.content=COLORS[theme];
  return theme;
 }
 // Re-evaluate and tell the map to follow, but only when the answer changed, so the map style is not reloaded every minute.
 function check(){
  const theme=current();if(theme===last)return;
  last=theme;if(mapAppearance()?.refresh)mapAppearance().refresh();else apply();
 }
 // Only a coarse region is remembered (nearest whole degree, about 110 km), never an exact position.
 function locate(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<.8||lat>7.6||lon<99||lon>120)return;
  if(Math.abs(lat-place.lat)<.25&&Math.abs(lon-place.lon)<.25)return;
  place={lat,lon};
  try{storage.setItem(KEY,JSON.stringify({lat:Math.round(lat),lon:Math.round(lon)}))}catch{}
  check();
 }
 const start=()=>{apply();last=current();clock.every(check,60000)};
 return {current,apply,check,locate,start,place:()=>({...place})};
}
if(typeof module==='object')module.exports={createTheme};
if(typeof window!=='object'||document.documentElement.dataset.ui!=='2')return;
let storage;try{storage=root.localStorage}catch{}
const theme=createTheme({sun:root.LapanSun,storage,doc:document,now:()=>new Date(),mapAppearance:()=>root.LapanMapAppearance,clock:{every:(fn,ms)=>setInterval(fn,ms)}});
root.LapanTheme=theme;theme.apply();
document.addEventListener('DOMContentLoaded',()=>{
 theme.start();
 const auto=document.querySelector('#mapAppearance option[value="auto"]');if(auto)auto.textContent='Auto · Sunrise and sunset';
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)theme.check()});window.addEventListener('pageshow',theme.check);
 // Use a position only if permission was already granted, so the new look never asks for it by itself.
 if(auto)navigator.permissions?.query({name:'geolocation'}).then(state=>{if(state.state==='granted')navigator.geolocation.getCurrentPosition(p=>theme.locate(p.coords.latitude,p.coords.longitude),()=>{},{maximumAge:3600000,timeout:5000})}).catch(()=>{});
});
})(typeof window==='object'?window:globalThis);
