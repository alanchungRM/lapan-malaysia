(function(root){
 const googleHosts=new Set(['www.google.com','google.com','maps.google.com','www.google.com.my','google.com.my','maps.google.com.my']);
 const wazeHosts=new Set(['www.waze.com','waze.com','ul.waze.com']);
 const number='[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
 const pairPattern=new RegExp('^\\s*('+number+')\\s*,\\s*('+number+')\\s*$');
 function decode(value){try{return decodeURIComponent(value)}catch{return ''}}
 function parse(text){
  if(typeof text!=='string'||text.length>4096)return null;
  const coordinates=text.match(pairPattern);
  if(coordinates)return {point:[Number(coordinates[1]),Number(coordinates[2])]};
  const link=text.match(/https:\/\/[^\s<>"']+/gi)?.map(link=>link.replace(/[).,]+$/,''));
  for(const str of link||[]){
   let url;
   try{url=new URL(str)}catch{continue}
   if(url.protocol!=='https:'||url.username||url.password||url.port)continue;
   const host=url.hostname,path=decode(url.pathname),q=url.searchParams;
   if(host==='maps.app.goo.gl'&&/^\/[\w-]+\/?$/.test(path)||
      host==='goo.gl'&&/^\/maps\/[\w-]+\/?$/.test(path)){
    return {short:url.origin+path,provider:'Google Maps'};
   }
   if(googleHosts.has(host)&&(path==='/maps'||path.startsWith('/maps/')||host.startsWith('maps.')&&path==='/')){
    const isDirections=path==='/maps/dir'||path.startsWith('/maps/dir/');
    const value=q.get('destination')||q.get('daddr')||(!isDirections&&(q.get('query')||q.get('q')));
    // An @lat,lon segment usually sets the viewport. Prefer explicit pin data.
    const marker=!isDirections&&path.startsWith('/maps/place/')&&path.match(new RegExp('!3d('+number+')!4d('+number+')'));
    return location(value,marker,'Google Maps',!isDirections&&path.startsWith('/maps/place/')?path.split('/')[3]?.replace(/\+/g,' '):'');
   }
   if(wazeHosts.has(host)&&(/^(?:\/ul\/?|\/live-map(?:\/directions)?\/?)$/.test(path)||host==='ul.waze.com'&&path==='/')){
    return location(q.get('ll')||q.get('to')?.replace(/^ll\./,'')||q.get('q'),null,'Waze');
   }
  }
  return null;
 }
 function location(value,marker,provider,placeName=''){
  const explicit=typeof value==='string'&&value.match(pairPattern);
  const point=explicit||marker;
  if(point)return {point:[Number(point[1]),Number(point[2])],provider};
  const query=(value||placeName||'').trim();
  return {provider,query:query.length<=160&&/\p{L}/u.test(query)&&!/[<>:\/!]/.test(query)?query:''};
 }
 const api={parse};
 root.LapanMapLinks=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
