(()=>{
 const root=document.documentElement,footer=document.getElementById('navBar'),turn=document.getElementById('navpanel');
 const rail=document.getElementById('routeRail'),distance=rail.querySelector('.rail-distance');
 const controls=document.getElementById('driveControls');
 const controlsHome=controls.parentNode,controlsNext=controls.nextSibling;
 const landscape=matchMedia('(orientation: landscape)');
 let queued=false;

 function setSize(name,value){
  const px=Math.ceil(value)+'px';
  if(root.style.getPropertyValue(name)!==px)root.style.setProperty(name,px);
 }

 function measure(){
  queued=false;
  const f=footer.getBoundingClientRect(),t=turn.getBoundingClientRect(),r=rail.getBoundingClientRect();
  if(f.height>0)setSize('--nav-footer-height',f.height);
  if(t.height>0)setSize('--nav-turn-bottom',t.bottom);
  if(!r.width)return;
  const intersectsX=card=>card.width>0&&card.left<r.right+12&&card.right>r.left-12;
  const touchesTurn=intersectsX(t),touchesTrip=intersectsX(f);
  const height=root.clientHeight;
  const top=touchesTurn?Math.max(0,t.bottom+20):0;
  const bottom=touchesTrip?Math.max(0,height-f.top+20):0;
  setSize('--rail-card-top',top);
  setSize('--rail-card-bottom',bottom);
  setSize('--rail-label-width',r.width);
  const freeHeight=height-Math.max(top,landscape.matches?48:0)-Math.max(bottom,landscape.matches?84:0);
  rail.toggleAttribute('data-no-room',freeHeight<56);
 }

 function schedule(){
  if(!queued){queued=true;requestAnimationFrame(measure)}
 }

 if('ResizeObserver'in window){
  const observer=new ResizeObserver(schedule);
  for(const node of [footer,turn,distance])observer.observe(node);
 }else{
  const observer=new MutationObserver(schedule);
  for(const node of [footer,turn,distance])observer.observe(node,{childList:true,subtree:true,characterData:true});
 }
 window.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('scroll',schedule);
 // Keep taps in the driving HUD outside the map's compositor layer during rotation.
 const guidance=new MutationObserver(()=>{
  const parent=document.body.classList.contains('guiding')?document.body:controlsHome;
  if(controls.parentNode!==parent)parent.insertBefore(controls,parent===controlsHome?controlsNext:null);
  schedule();
 });
 guidance.observe(document.body,{attributes:true,attributeFilter:['class']});
 const visibility=new MutationObserver(schedule);
 visibility.observe(rail,{attributes:true,attributeFilter:['hidden']});
 schedule();
})();
