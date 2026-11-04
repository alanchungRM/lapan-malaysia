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
  const set=open=>{document.body.classList.toggle('drive-more',open);more.setAttribute('aria-expanded',String(open))};
  more.onclick=()=>set(!document.body.classList.contains('drive-more'));
  new MutationObserver(()=>{if(!document.body.classList.contains('guiding')&&document.body.classList.contains('drive-more'))set(false)}).observe(document.body,{attributes:true,attributeFilter:['class']});
 }
});
})();
