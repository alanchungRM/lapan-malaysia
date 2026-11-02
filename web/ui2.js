// Opt-in switch for the new look. ?ui=2 turns it on and remembers it on this device, ?ui=1 turns it off. Nothing loads when it is off.
(function(){
 let on=false;
 try{
  const wanted=new URLSearchParams(location.search).get('ui');
  if(wanted==='2')localStorage.setItem('lapan-ui','2');else if(wanted==='1')localStorage.removeItem('lapan-ui');
  on=localStorage.getItem('lapan-ui')==='2';
 }catch{on=/[?&]ui=2(&|$)/.test(location.search)}
 if(!on)return;
 document.documentElement.dataset.ui='2';
 const link=document.createElement('link');link.rel='stylesheet';link.href='/ui2.css';document.head.append(link);
 document.addEventListener('DOMContentLoaded',()=>{const toggle=document.getElementById('uiToggle');if(toggle){toggle.href='?ui=1';toggle.textContent='Back to the classic look'}});
})();
