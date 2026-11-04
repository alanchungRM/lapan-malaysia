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
 const more=$('navMore');
 if(more){
  const set=open=>{document.body.classList.toggle('drive-more',open);more.setAttribute('aria-expanded',String(open));if(!open)clearTimeout(timer)};
  const tray=$('driveMore');let timer=0;
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(document.body.classList.contains('drive-more'))set(false)},12000)};
  more.onclick=()=>{const open=!document.body.classList.contains('drive-more');set(open);if(open)arm();else clearTimeout(timer)};
  // The tray closes itself: tap anywhere else, press Escape, use one of its buttons, or leave it alone for 12 seconds.
  if(tray){tray.addEventListener('click',e=>{if(e.target.closest('button,a')&&e.target.closest('#navLang')===null){arm()}});tray.addEventListener('pointerdown',arm)}
  document.addEventListener('pointerdown',e=>{if(document.body.classList.contains('drive-more')&&!e.target.closest?.('#driveMore,#navMore'))set(false)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('drive-more')){set(false);more.focus?.()}});
  new MutationObserver(()=>{if(!document.body.classList.contains('guiding')&&document.body.classList.contains('drive-more'))set(false)}).observe(document.body,{attributes:true,attributeFilter:['class']});
 }
});
})();
