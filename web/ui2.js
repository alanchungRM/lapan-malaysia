// An explicit look choice is stored on this browser. First visits use the new look.
(function(){
 const defaultLook='2';
 const key='lapan-ui',wanted=new URLSearchParams(location.search).get('ui');
 const looks=['1','2','sunset'];
 let look=defaultLook;
 try{
  const saved=localStorage.getItem(key);
  if(looks.includes(saved))look=saved;
 }catch{}
 if(looks.includes(wanted)){
  look=wanted;
  try{localStorage.setItem(key,look)}catch{}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('#uiAppearance a[href="?ui='+look+'"]')?.setAttribute('aria-current','true');
 });
 if(look==='1')return;
 if(look==='sunset')document.documentElement.dataset.skin='sunset';
 document.documentElement.dataset.ui='2';
 const link=document.createElement('link');link.rel='stylesheet';link.href='/ui2.css';document.head.append(link);
})();
