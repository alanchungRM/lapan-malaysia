// Preserve the original map; never allow a second map to mount in this frame.
(()=>{document.addEventListener('DOMContentLoaded',()=>{
const panel=document.getElementById('statisticsPanel'),frame=panel.querySelector('iframe');
function close(){panel.close()}
const root=document.documentElement;
function syncTheme(){
 const doc=frame.contentDocument;
 if(!doc?.documentElement.classList.contains('statistics-page'))return;
 const target=doc.documentElement;
 if(root.dataset.ui==='2'){
  target.dataset.ui='2';
  target.dataset.theme=root.dataset.theme||'day';
 }else{
  delete target.dataset.ui;
  delete target.dataset.theme;
 }
}
new MutationObserver(syncTheme).observe(root,{attributes:true,attributeFilter:['data-ui','data-theme']});
frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;if(doc.getElementById('map')){close();frame.removeAttribute('src');return}syncTheme();doc.addEventListener('click',e=>{const link=e.target.closest('a');if(link&&new URL(link.href,location.href).pathname==='/'){e.preventDefault();e.stopImmediatePropagation();close()}},true)}catch{}});
document.querySelectorAll('a[href="/statistics"]').forEach(link=>link.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(!frame.getAttribute('src'))frame.src='/statistics';if(!panel.open)panel.showModal()}));
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data==='lapan-close-statistics')close()});panel.addEventListener('close',()=>window.dispatchEvent(new Event('resize')))
})})();
