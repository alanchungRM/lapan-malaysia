// Preserve the previous Adaptive default for browsers that have already used Lapan.
(function(){
 const key='lapan-ui',wanted=new URLSearchParams(location.search).get('ui');
 const looks=['1','2','sunset'];
 const returning=!!navigator.serviceWorker?.controller||navigator.standalone||
  window.matchMedia?.('(display-mode: standalone)').matches;
 let look=returning?'2':'sunset';
 try{
  const saved=localStorage.getItem(key);
  if(looks.includes(saved))look=saved;
  else if(Object.keys(localStorage).some(name=>name!==key&&name.startsWith('lapan-')))look='2';
 }catch{}
 if(looks.includes(wanted))look=wanted;
 try{if(localStorage.getItem(key)!==look)localStorage.setItem(key,look)}catch{}
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('#uiAppearance a[href="?ui='+look+'"]')?.setAttribute('aria-current','true');
 });
 if(look==='1')return;
 if(look==='sunset')document.documentElement.dataset.skin='sunset';
 document.documentElement.dataset.ui='2';
 const link=document.createElement('link');link.rel='stylesheet';link.href='/ui2.css';document.head.append(link);
})();
