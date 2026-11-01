// Keeps Lapan opening when the network or server is struggling. Network first, so a healthy server always wins.
const VERSION='{{APP_VERSION}}',CACHE='lapan-shell-'+VERSION,SHELL=__SHELL__,TIMEOUT=4000;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lapan-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// Only Lapan's own files are cached. Live data (routes, traffic, search, counters) must be current or fail visibly.
function cacheable(request){
 if(request.method!=='GET')return false;
 const url=new URL(request.url);
 return url.origin===self.location.origin&&!url.pathname.startsWith('/api/')&&url.pathname!=='/sw.js';
}
function fromNetwork(request){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('timeout')),TIMEOUT);
  fetch(request).then(response=>{clearTimeout(timer);resolve(response)},error=>{clearTimeout(timer);reject(error)});
 });
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(!cacheable(request))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const saved=()=>cache.match(request,{ignoreSearch:request.mode==='navigate'}).then(hit=>hit||(request.mode==='navigate'?cache.match('/'):undefined));
  try{
   const response=await fromNetwork(request);
   if(response.ok&&(response.type==='basic'))cache.put(request,response.clone()).catch(()=>{});
   // An overloaded server often answers with a 5xx page instead of failing to connect. Prefer the saved copy over that page.
   if(response.status>=500){const hit=await saved();if(hit)return hit}
   return response;
  }catch(error){
   const hit=await saved();
   if(hit)return hit;
   throw error;
  }
 })());
});
if(typeof module==='object')module.exports={CACHE,cacheable};
