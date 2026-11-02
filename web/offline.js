(function(){
if(!('serviceWorker' in navigator))return;
window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})});
})();
