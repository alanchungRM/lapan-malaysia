(()=>{
 const root=document.documentElement,footer=document.getElementById('navBar'),turn=document.getElementById('navpanel');
 const rail=document.getElementById('routeRail'),distance=rail.querySelector('.rail-distance');
 const controls=document.getElementById('driveControls');
 const hud=document.getElementById('driveHud');
 const topLayer=typeof hud?.showPopover==='function'&&typeof hud.hidePopover==='function';
 const actions=['reportAsk','awakeWarning'].map(id=>document.getElementById(id));
 const overlays=[controls,turn,footer,rail,...actions].filter(Boolean).map(node=>({node,home:node.parentNode,next:node.nextSibling}));
 const tray=document.getElementById('driveMore');
 const landscape=matchMedia('(orientation: landscape)');
 let queued=false;

 window.LapanNavLayout={cameraOffset(mapBox){
  if(!landscape.matches||!document.body.classList.contains('guiding'))return null;
  const left=Math.max(footer.getBoundingClientRect().right,turn.getBoundingClientRect().right,mapBox.left);
  const railBox=rail.getBoundingClientRect(),controlsBox=controls.getBoundingClientRect();
  const right=Math.min(mapBox.right,controlsBox.width?controlsBox.left-8:mapBox.right-16,
   railBox.width&&!rail.hasAttribute('data-no-room')?railBox.left-8:mapBox.right);
  if(right<=left)return null;
  return [(left+right)/2-mapBox.left-mapBox.width/2,mapBox.height*.14];
 }};

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
 // A manual popover makes the native touch targets independent of the map's compositor.
 let guidingBefore=false, hudOpen=false;
 const guidance=new MutationObserver(()=>{
  const guiding=document.body.classList.contains('guiding');
  if(guiding!==guidingBefore){
   guidingBefore=guiding;
   if(guiding&&topLayer){
    hud.setAttribute('popover','manual');
    try{hud.showPopover();hudOpen=true}catch{hud.removeAttribute('popover')}
   }
   for(const {node,home,next} of guiding?overlays:overlays.slice().reverse()){
    const parent=guiding?(hudOpen&&node!==rail?hud:actions.includes(node)?home:document.body):home;
    if(node.parentNode!==parent)parent.insertBefore(node,!guiding&&next?.parentNode===home?next:null);
   }
   if(!guiding&&hudOpen){hud.hidePopover();hudOpen=false}
  }
  schedule();
 });
 guidance.observe(document.body,{attributes:true,attributeFilter:['class']});
 const visibility=new MutationObserver(schedule);
 visibility.observe(rail,{attributes:true,attributeFilter:['hidden']});
 schedule();
})();
