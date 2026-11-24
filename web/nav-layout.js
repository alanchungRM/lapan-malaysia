(()=>{
 const root=document.documentElement,footer=document.getElementById('navBar'),turn=document.getElementById('navpanel');
 const rail=document.getElementById('routeRail'),distance=rail.querySelector('.rail-distance');
 const controls=document.getElementById('driveControls');
 const overlays=[controls,turn,rail].map(node=>({node,home:node.parentNode,next:node.nextSibling}));
 const tray=document.getElementById('driveMore');
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
  const trayBox=tray?.getBoundingClientRect();
  const trayInLane=trayBox&&intersectsX(trayBox)&&trayBox.height>0;
  const freeHeight=height-Math.max(top,landscape.matches?48:0)-Math.max(bottom,landscape.matches?84:0);
  rail.toggleAttribute('data-no-room',freeHeight<56||trayInLane);
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
 function settle(){
  schedule();
  clearTimeout(settle.timer);
  settle.timer=setTimeout(schedule,250);
 }
 landscape.addEventListener?.('change',settle);
 window.addEventListener('orientationchange',settle);
 window.addEventListener('resize',settle);
 window.visualViewport?.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('scroll',schedule);
 // Keep taps in the driving HUD outside the map's compositor layer during rotation.
 const guidance=new MutationObserver(()=>{
  const guiding=document.body.classList.contains('guiding');
  for(const {node,home,next} of overlays){
   const parent=guiding?document.body:home;
   if(node.parentNode!==parent)parent.insertBefore(node,!guiding&&next?.parentNode===home?next:null);
  }
  schedule();
 });
 guidance.observe(document.body,{attributes:true,attributeFilter:['class']});
 const visibility=new MutationObserver(schedule);
 visibility.observe(rail,{attributes:true,attributeFilter:['hidden']});
 schedule();
})();
