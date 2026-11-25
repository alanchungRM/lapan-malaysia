// Static asset serving: validators, cache policy and browser security headers.
const securityHeaders={
 'Strict-Transport-Security':'max-age=31536000',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'SAMEORIGIN',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Cross-Origin-Opener-Policy':'same-origin',
 'Permissions-Policy':'screen-wake-lock=(self), geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
 'Content-Security-Policy':[
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://tiles.maps.eox.at",
  "connect-src 'self' https://tiles.openfreemap.org https://tiles.maps.eox.at https://photon.komoot.io https://router.project-osrm.org",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "media-src 'self' blob: data:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
 ].join('; ')
};
// Versioned third-party bundles and icons change rarely; everything else revalidates through its ETag.
const longCached=/^\/((?:maplibre|leaflet)\.(js|css)|signals\.json|map-night-gray\.json|lapan-icon\.svg|lapan-192\.png|lapan-512\.png|apple-touch-icon\.png)$/;
const decodedBinary=new Map();
function etagMatches(header,etag){return !!header&&header.split(',').some(v=>{v=v.trim();return v==='*'||v.replace(/^W\//,'')===etag})}
function serveMedia(request,body,headers,etag){
 const size=body.byteLength;
 headers['Accept-Ranges']='bytes';
 headers['Content-Length']=String(size);
 if(request.method==='HEAD')return new Response(null,{headers});
 const ifRange=request.headers.get('If-Range');
 const range=/^bytes=(\d*)-(\d*)$/i.exec(request.headers.get('Range')||'');
 if(!range||(!range[1]&&!range[2])||(ifRange&&ifRange!==etag))return new Response(body,{headers});
 const start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
 const end=range[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
 if(start>end||start>=size){
  headers['Content-Range']='bytes */'+size;
  headers['Content-Length']='0';
  return new Response(null,{status:416,headers});
 }
 headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
 headers['Content-Length']=String(end-start+1);
 return new Response(body.subarray(start,end+1),{status:206,headers});
}
const productionOrigin='https://lapan-malaysia.com';
const noIndex='noindex, nofollow, noarchive';
export function withSecurityHeaders(response,{indexable=false}={}){
 const out=new Response(response.body,response);
 for(const [name,value] of Object.entries(securityHeaders))if(!out.headers.has(name))out.headers.set(name,value);
 if(!indexable&&!out.headers.has('X-Robots-Tag'))out.headers.set('X-Robots-Tag',noIndex);
 return out;
}
// Relay only World Imagery tiles and keep the ArcGIS key in the Worker.
async function serveEsriImagery(request,url,env){
 const headers={'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'};
 const fail=(status,reason)=>withSecurityHeaders(new Response(null,{status,headers:reason?{...headers,'X-Imagery-Status':reason}:headers}));
 const tile=url.pathname.match(/^\/satellite\/esri\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.jpg$/);
 if(request.method!=='GET'||!tile||url.search)return fail(404);
 const [,z,y,x]=tile.map(Number);
 if(z>19||x>=2**z||y>=2**z)return fail(404);
 const referrer=request.headers.get('referer');
 try{
  if(!referrer||new URL(referrer).origin!==url.origin)return fail(403);
 }catch{return fail(403)}
 const site=request.headers.get('sec-fetch-site');
 if(site&&site!=='same-origin')return fail(403);
 const key=env.ARCGIS_PUBLIC_API_KEY;
 if(!key)return fail(503);
 try{
  const upstream=new URL('https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/'+z+'/'+y+'/'+x);
  upstream.searchParams.set('token',key);
  const tileResponse=await fetch(upstream.toString(),{
   headers:{Referer:url.origin+'/',Accept:'image/jpeg,image/png','User-Agent':'Lapan/1.0'},redirect:'manual',signal:AbortSignal.timeout(8000)
  });
  const type=tileResponse.headers.get('content-type')?.split(';')[0];
  if(!tileResponse.ok||!['image/jpeg','image/png'].includes(type)||!tileResponse.body){
   return fail(tileResponse.status===429?429:502,'upstream-'+tileResponse.status);
  }
  return withSecurityHeaders(new Response(tileResponse.body,{headers:{...headers,'Content-Type':type}}));
 }catch(error){
  const reason=String(error?.message??'').toLowerCase();
  const kind=/denied|forbidden|blocked|policy|allowlist/.test(reason)?'policy':/tls|ssl|cert/.test(reason)?'tls':/dns|resolve/.test(reason)?'dns':/network|connect|socket/.test(reason)?'connection':error instanceof TypeError?'type-error':'transport';
  return fail(error?.name==='TimeoutError'?504:502,kind);
 }
}

export function serveAsset(request,assets,env={}){
 const u=new URL(request.url);
 if(request.method!=='GET'&&request.method!=='HEAD')return withSecurityHeaders(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}));
 if(u.pathname.startsWith('/satellite/esri/'))return serveEsriImagery(request,u,env);
 const path=u.pathname==='/'?'/index.html':u.pathname==='/changelog/'?'/changelog':u.pathname==='/statistics'||u.pathname==='/statistics/'?'/statistics.html':u.pathname;
 let file=Object.hasOwn(assets,path)?assets[path]:null;
 // Allow indexing for canonical public pages and the declared favicon on production.
 const production=u.origin===productionOrigin&&env.LAPAN_ENVIRONMENT!=='staging';
 if(path==='/robots.txt'||(production&&path==='/sitemap.xml')){
  const robots=path==='/robots.txt';
  const body=robots
   ? 'User-agent: *\n'+(production?'Allow: /\nSitemap: '+productionOrigin+'/sitemap.xml\n':'Disallow: /\n')
   : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+productionOrigin+'/</loc></url><url><loc>'+productionOrigin+'/changelog</loc></url></urlset>\n';
  return withSecurityHeaders(new Response(request.method==='HEAD'?null:body,{
   headers:{'Content-Type':(robots?'text/plain':'application/xml')+'; charset=utf-8','Cache-Control':'no-cache'}
  }));
 }
 const canonicalPage=production&&(path==='/index.html'||path==='/changelog');
 const indexableFavicon=production&&path==='/lapan-192.png';
 const indexable=canonicalPage||indexableFavicon;
 if(file&&canonicalPage){
  const canonical=productionOrigin+(path==='/index.html'?'/':'/changelog');
  file={...file,body:file.body.replace('</head>','<link rel="canonical" href="'+canonical+'"></head>'),
   etag:file.etag?.replace(/"$/,'-indexable"')};
 }

 if(file&&indexableFavicon)file={...file,etag:file.etag?.replace(/"$/,'-indexable"')};

 if(file&&path==='/index.html'){
  const provider=env.LAPAN_SELECTED_PROVIDER||(env.TOMTOM_ROUTING_DISABLED==='true'?'OSRM':'TomTom');
  const staging=env.LAPAN_ENVIRONMENT==='staging'||env.TOMTOM_ROUTING_DISABLED==='true';
  const baseline=env.LAPAN_ENVIRONMENT==='staging'?' · Production live baseline':'';
  const status=provider==='Valhalla'?'VALHALLA PRIMARY · OSRM car fallback · no live traffic':provider==='OSRM'?'OSRM ONLY · TomTom routing OFF · HERE routing OFF':provider==='HERE'?'HERE PRIMARY · OSRM fallback · TomTom routing OFF':'TomTom PRIMARY · Valhalla fallback · HERE routing OFF';
  file={...file,body:file.body.replace('data-routing-provider="AUTO"','data-routing-provider="'+(provider==='TomTom'?'AUTO':provider)+'"').replace(/<!-- STAGING_STATUS v([^ ]+) -->/,staging?'<div class="staging-build" data-no-i18n role="note">STAGING · v$1'+baseline+' · '+status+'</div>':'<!-- STAGING_STATUS v$1 -->'),etag:file.etag?.replace(/"$/,'-'+provider+(staging?(baseline?'-production-baseline':'-staging'):'')+'"')};
 }

 if(!file)return withSecurityHeaders(new Response('Not found',{status:404}));
 const headers={'Content-Type':file.byteRanges?file.type:file.type+'; charset=utf-8','Cache-Control':/^\/voice-pack-[a-f0-9]{16}\.bin$/.test(path)?'private, max-age=31536000, immutable':longCached.test(path)?'public, max-age=3600, stale-while-revalidate=604800':'no-cache'};
 if(file.etag){headers.ETag=file.etag;if(etagMatches(request.headers.get('If-None-Match'),file.etag))return withSecurityHeaders(new Response(null,{status:304,headers}),{indexable})}
 if(request.method==='HEAD'&&!file.byteRanges)return withSecurityHeaders(new Response(null,{headers}),{indexable});
 let body=file.body;
 if(file.binary){body=decodedBinary.get(path);if(!body){body=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));decodedBinary.set(path,body)}}
 if(file.byteRanges)return withSecurityHeaders(serveMedia(request,body,headers,file.etag),{indexable});
 return withSecurityHeaders(new Response(body,{headers}),{indexable});
}
