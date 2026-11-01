(function(){
const $=id=>document.getElementById(id);
document.addEventListener('DOMContentLoaded',()=>{
 const button=$('openMenu'),panel=$('moreOptions');
 if(!button||!panel)return;
 const sync=()=>button.setAttribute('aria-expanded',String(panel.open));
 panel.addEventListener('toggle',sync);sync();
 button.onclick=()=>{
  panel.open=!panel.open;
  if(panel.open){
   const calm=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   panel.scrollIntoView({behavior:calm?'auto':'smooth',block:'start'});
   panel.querySelector('summary')?.focus({preventScroll:true});
  }
 };
});
})();
