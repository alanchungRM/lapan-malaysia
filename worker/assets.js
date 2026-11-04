// Static asset serving: validators, cache policy and browser security headers.
const securityHeaders={
 'X-Robots-Tag':'noindex, nofollow, noarchive',
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
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "connect-src 'self' https://tiles.openfreemap.org https://photon.komoot.io https://router.project-osrm.org",
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
export function withSecurityHeaders(response){
 const out=new Response(response.body,response);
 for(const [name,value] of Object.entries(securityHeaders))if(!out.headers.has(name))out.headers.set(name,value);
 return out;
}
export function serveAsset(request,assets,env={}){
 const u=new URL(request.url);
 if(request.method!=='GET'&&request.method!=='HEAD')return withSecurityHeaders(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}));
 const path=u.pathname==='/'?'/index.html':u.pathname==='/changelog/'?'/changelog':u.pathname==='/statistics'||u.pathname==='/statistics/'?'/statistics.html':u.pathname;
 let file=Object.hasOwn(assets,path)?assets[path]:null;
 if(file&&path==='/index.html'&&env.TOMTOM_ROUTING_DISABLED==='true'){file={...file,body:file.body.replace('data-routing-provider="AUTO"','data-routing-provider="OSRM"').replace(/<!-- STAGING_STATUS v([^ ]+) -->/,'<div class="staging-build" data-no-i18n role="note">STAGING · v$1 · OSRM ONLY · TomTom routing OFF · Applied PRs: #15 · #16 · #17 · #18 · #19 · #20 · #21 · #23 · #24 · #26 · #31</div>'),etag:file.etag?.replace(/"$/,'-osrm"')}}
 if(!file)return withSecurityHeaders(new Response('Not found',{status:404}));
 const headers={'Content-Type':file.type+'; charset=utf-8','Cache-Control':longCached.test(path)?'public, max-age=3600, stale-while-revalidate=604800':'no-cache'};
 if(file.etag){headers.ETag=file.etag;if(etagMatches(request.headers.get('If-None-Match'),file.etag))return withSecurityHeaders(new Response(null,{status:304,headers}))}
 if(request.method==='HEAD')return withSecurityHeaders(new Response(null,{headers}));
 let body=file.body;
 if(file.binary){body=decodedBinary.get(path);if(!body){body=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));decodedBinary.set(path,body)}}
 return withSecurityHeaders(new Response(body,{headers}));
}
