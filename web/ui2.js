// An explicit look choice is stored on this browser. First visits use the new look.
(function(){
 const defaultLook='2';
 const key='lapan-ui',wanted=new URLSearchParams(location.search).get('ui');
 let look=defaultLook;
 try{
  const saved=localStorage.getItem(key);
  if(saved==='1'||saved==='2')look=saved;
 }catch{}
 if(wanted==='1'||wanted==='2'){
  look=wanted;
  try{localStorage.setItem(key,look)}catch{}
 }
 if(look!=='2')return;
 document.documentElement.dataset.ui='2';
 const link=document.createElement('link');link.rel='stylesheet';link.href='/ui2.css';document.head.append(link);
})();
