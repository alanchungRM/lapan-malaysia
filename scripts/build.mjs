import {loadPoiBuild} from './poi-config.mjs';
import {createHash} from 'node:crypto';
import {renderChangelog} from './changelog.mjs';
import {readFile,mkdir,writeFile,rm,rename} from 'node:fs/promises';
const {version}=JSON.parse(await readFile('package.json','utf8'));if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid application version');
const files={};for(const [name,type] of [['index.html','text/html'],['statistics.html','text/html'],['statistics.css','text/css'],['statistics.js','text/javascript'],['analytics.js','text/javascript'],['navigation-region.js','text/javascript'],['install.js','text/javascript'],['offline.js','text/javascript'],['sw.js','text/javascript'],['manifest.webmanifest','application/manifest+json'],['lapan-icon.svg','image/svg+xml'],['leaflet.js','text/javascript'],['leaflet.css','text/css'],['app.js','text/javascript'],['route-weather.js','text/javascript'],['i18n.js','text/javascript'],['i18n-ms.js','text/javascript'],['menu.js','text/javascript'],['search.js','text/javascript'],['places.js','text/javascript'],['nav-layout.js','text/javascript'],['road-restrictions.js','text/javascript'],['routing.js','text/javascript'],['directions.js','text/javascript'],['route-tolls.js','text/javascript'],['toll.js','text/javascript'],['traffic-colors.js','text/javascript'],['drive.js','text/javascript'],['vehicle-pointer.js','text/javascript'],['awake.js','text/javascript'],['wake-media.js','text/javascript'],['stops.js','text/javascript'],['preferences.js','text/javascript'],['saved.js','text/javascript'],['voice.js','text/javascript'],['eta.js','text/javascript'],['drive-ui.js','text/javascript'],['drive-ui.css','text/css'],['hazards.js','text/javascript'],['hazards.json','application/json'],['cameras.js','text/javascript'],['reports.js','text/javascript'],['share.js','text/javascript'],['speed.js','text/javascript'],['speed-limits.json','application/json'],['speed-cameras.json','application/json'],['statistics-panel.js','text/javascript'],['signals.js','text/javascript'],['signals.json','application/json'],['leaflet-maplibre.js','text/javascript'],['map-night-gray.json','application/json'],['map-appearance.js','text/javascript'],['ui2.js','text/javascript'],['sun.js','text/javascript'],['theme.js','text/javascript'],['ui2.css','text/css'],['maplibre.js','text/javascript'],['maplibre.css','text/css'],['mobile.css','text/css']])files['/'+name]={body:await readFile('web/'+name,'utf8'),type};
// Reuse the night basemap's sources and layer definitions for the Sunset Drive palette.
const sunsetPalette={
 '#343a40':'#21172b', '#384f60':'#293b65', '#393f45':'#30243c',
 '#3d4943':'#313d3a', '#405767':'#3f5680', '#454d55':'#3d2b4c',
 '#484f56':'#483654', '#58616a':'#594366', '#646e78':'#725781',
 '#7a8490':'#9d81a9', '#dce3e8':'#f7ebf5'
};
const sunsetMap=JSON.parse(files['/map-night-gray.json'].body);
sunsetMap.name='Lapan Sunset Drive';
files['/map-sunset.json']={
 type:'application/json',
 body:JSON.stringify(sunsetMap).replace(/#[0-9a-f]{6}/gi,color=>sunsetPalette[color]??color)
};
// Use the original logo geometry with a gradient for the optional GTA Sunset header.
const sunsetLogoGradient='<defs><linearGradient id="sunset" x1="0%" y1="0%" x2="100%" y2="100%"><stop stop-color="#ffc094"/><stop offset=".5" stop-color="#c74175"/><stop offset="1" stop-color="#7956ad"/></linearGradient></defs>';
files['/lapan-icon-sunset.svg']={
 ...files['/lapan-icon.svg'],
 body:files['/lapan-icon.svg'].body.replace('<rect',sunsetLogoGradient+'<rect').replace('fill="#17bf68"','fill="url(#sunset)"')
};
files['/weather-areas.json']={body:await readFile('data/weather-areas.json','utf8'),type:'application/json'};
for(const name of ['makakami-light.svg','makakami-dark.svg'])files['/'+name]={body:await readFile('web/'+name,'utf8'),type:'image/svg+xml'};
const voicePacks={};
const voiceAssets=new Set();
for(const [id,label,language,file,note] of [
 ['lapan-kokoro-heart','Kokoro Heart · English (US)','en','heart','Reads directions and alerts in English. Downloads once before guidance.'],
]){
 const bundle=await readFile('web/voice-pack-'+file+'.bin');
 const index=JSON.parse(await readFile('web/voice-pack-'+file+'.json','utf8'));
 const url='/voice-pack-'+createHash('sha256').update(bundle).digest('hex').slice(0,16)+'.bin';
 voicePacks[id]={label,language,note,index,url};
 voiceAssets.add(url);
 files[url]={body:bundle.toString('base64'),type:'application/octet-stream',binary:true};
}
const sunsetAudio=await readFile('web/sunset-music.m4a').catch(error=>{
 if(error.code==='ENOENT')return null;
 throw error;
});
const sunsetMusicCode=sunsetAudio?(await readFile('web/sunset-music.js','utf8'))+';\n':'';
if(sunsetAudio)files['/sunset-music.m4a']={body:sunsetAudio.toString('base64'),type:'audio/mp4',binary:true,byteRanges:true};
const voicePackCode=await readFile('web/voice-pack.js','utf8');
files['/preferences.js'].body=voicePackCode.replace('/* VOICE_PACKS */ {}',JSON.stringify(voicePacks))+';\n'+sunsetMusicCode+files['/preferences.js'].body;
files['/hazards.js'].body=files['/hazards.js'].body.replace('__HAZARD_REV__',createHash('sha256').update(files['/hazards.json'].body).digest('hex').slice(0,16));
for(const name of ['apple-touch-icon.png','lapan-192.png','lapan-512.png'])files['/'+name]={body:(await readFile('web/'+name)).toString('base64'),type:'image/png',binary:true};
for(const name of ['marker-icon.png','marker-icon-2x.png','marker-shadow.png','layers.png','layers-2x.png'])files['/images/'+name]={body:(await readFile('web/images/'+name)).toString('base64'),type:'image/png',binary:true};
files['/images/sunset-palms.webp']={body:(await readFile('web/images/sunset-palms.webp')).toString('base64'),type:'image/webp',binary:true};
files['/changelog']={body:renderChangelog(JSON.parse(await readFile('web/changelog.json','utf8')),version),type:'text/html'};files['/changelog.css']={body:await readFile('web/changelog.css','utf8'),type:'text/css'};
for(const name of ['/index.html','/statistics.html'])files[name].body=files[name].body.replaceAll('{{APP_VERSION}}',version);
files['/hot-fm-pointer.png']={body:(await readFile('web/hot-fm-pointer.png')).toString('base64'),type:'image/png',binary:true};
files['/prayer-data-notices']={body:await readFile('data/PRAYER_NOTICES.txt','utf8'),type:'text/plain'};
files['/place-data-notices']={body:await readFile('data/POI_NOTICES.txt','utf8'),type:'text/plain'};
// Content revision updates offline caches even when the visible release version is unchanged.
{const skip=new Set(['/sunset-music.m4a','/images/sunset-palms.webp','/weather-areas.json','/ui2.css','/hazards.json','/index.html','/sw.js','/maplibre.js','/signals.json','/speed-limits.json','/speed-cameras.json','/hot-fm-pointer.png','/statistics.html','/statistics.css','/statistics.js','/analytics.js','/navigation-region.js','/changelog','/changelog.css','/malay-voice-notice']);const shell=['/',...Object.keys(files).filter(n=>!voiceAssets.has(n)&&!skip.has(n))];const revision=createHash('sha256').update(shell.map(n=>n+':'+(files[n==='/'?'/index.html':n]?.body||'')).join('\n')).digest('hex').slice(0,16);files['/sw.js'].body=files['/sw.js'].body.replace('{{APP_VERSION}}',version+'-'+revision).replace('__SHELL__',JSON.stringify(shell))}
for(const f of Object.values(files))f.etag='\"'+createHash('sha256').update(f.body).digest('base64url').slice(0,22)+'\"';
const assetsCode=(await readFile('worker/assets.js','utf8')).replaceAll('export function','function');
const guardCode=(await readFile('worker/guard.js','utf8')).replace('export async function','async function');
const api=(await readFile('worker/api.js','utf8')).replace('export async function','async function')+'\n'+(await readFile('worker/nearby.js','utf8')).replace('export async function','async function');
const weatherCode=(await readFile('worker/weather.js','utf8')).replace('export async function','async function');
const traffic=(await readFile('worker/traffic.js','utf8')).replace('export async function','async function');
const prayerPlacesData=JSON.parse(await readFile('data/prayer-places-my.json','utf8'));
const plazas=JSON.parse(await readFile('web/plus-plazas.json','utf8'));
const shareCodeSource=(await readFile('worker/share.js','utf8')).replaceAll('export async function','async function');
const reportsCode=(await readFile('worker/reports.js','utf8')).replaceAll(/export (?=(async )?function)/g,'');
const analyticsCode=(await readFile('worker/analytics.js','utf8')).replace('export async function','async function');
const routingCode=(await readFile('worker/routing.js','utf8')).replace('export async function','async function');
const prayerSearchCode=(await readFile('worker/prayer-search.js','utf8')).replace('export async function','async function');
const camerasCode=(await readFile('worker/cameras.js','utf8')).replace('export async function','async function');
const {regionalPoiData}=await loadPoiBuild();
const regionalPoiCode=(await readFile('worker/poi-search.js','utf8')).replace('export async function','async function');
const placeSearchCode=(await readFile('worker/place-search.js','utf8')).replace('export async function','async function');
const tollCode=(await readFile('worker/route-tolls.js','utf8')).replace('export async function','async function');
const tollData=JSON.parse(await readFile('worker/toll-data.json','utf8'));
const tollRates=JSON.parse(await readFile('worker/toll-rates.json','utf8'));const tollRatesCode=(await readFile('worker/toll-rates.js','utf8')).replaceAll('export function','function');
const restrictionsCode=await readFile('web/road-restrictions.js','utf8');
const providerCode=(await readFile('worker/providers.js','utf8')).replaceAll('export async function','async function');
const hereCode=(await readFile('worker/here.js','utf8')).replaceAll('export async function','async function');
const valhallaCode=(await readFile('worker/valhalla.js','utf8')).replaceAll('export async function','async function');
const worker=providerCode+'\n'+hereCode+'\n'+valhallaCode+'\n'+'const prayerPlacesData='+JSON.stringify(prayerPlacesData)+';\n'+assetsCode+'\n'+guardCode+'\n'+restrictionsCode+'\n'+tollRatesCode+'\nconst routeTollRates='+JSON.stringify(tollRates)+';\n'+tollCode+'\nconst routeTollData='+JSON.stringify(tollData)+';\n'+'const regionalPoiData='+JSON.stringify(regionalPoiData)+';\n'+regionalPoiCode+'\n'+prayerSearchCode+'\n'+placeSearchCode+'\n'+camerasCode+'\n'+routingCode+'\n'+analyticsCode+'\n'+reportsCode+'\n'+shareCodeSource+'\n'+api+'\n'+traffic+'\n'+weatherCode+'\nconst assets='+JSON.stringify(files)+';\nconst plazas='+JSON.stringify(plazas)+';\nasync function routeApi(request,env,u){if(u.pathname==="/api/route-weather")return routeWeather(request);if(u.pathname==="/api/share")return sharedPlaces(request,env);if(u.pathname.startsWith("/s/")||u.pathname.startsWith("/l/"))return sharedPlacePage(request,env,assets["/index.html"]);if(u.pathname==="/api/reports"||u.pathname==="/api/reports/vote"||u.pathname==="/api/reports/cleanup")return communityReports(request,env);if(u.pathname==="/api/routing-config")return routingConfiguration(request,env);if(u.pathname==="/api/prayer-search")return prayerPlaceSearch(request,prayerPlacesData);if(u.pathname==="/prayer-places.json"){if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405,headers:{Allow:"GET, HEAD"}});return new Response(request.method==="HEAD"?null:JSON.stringify(prayerPlacesData),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=3600"}})}if(u.pathname==="/api/place-search")return additionalPlaceSearch(request,env,query=>searchRegionalPlaces(query,regionalPoiData),regionalPoiData);if(u.pathname==="/api/cameras")return speedCameras(request,JSON.parse(assets["/speed-cameras.json"].body));if(u.pathname==="/api/route")return dispatchRoute(request,env,async route=>mergeRateTolls(await estimateRouteTolls(route,routeTollData,(a,b)=>["HERE","Valhalla"].includes(route.provider)?Promise.resolve({amount:null}):getPlusFare(a,b,6000)),route,routeTollRates));if(u.pathname==="/api/visit"||u.pathname==="/api/statistics")return analytics(request,env);if(u.pathname==="/api/traffic-eta")return dispatchTraffic(request,env);if(u.pathname==="/api/nearby")return nearbyStops(request,prayerPlacesData);if(u.pathname==="/api/plus-fare")return plusFare(request,plazas);return null}\nexport default {async fetch(request,env,ctx){const limited=await edgeLimited(request,env);if(limited)return withSecurityHeaders(limited);if(ctx&&env.DB&&new URL(request.url).pathname==="/")ctx.waitUntil(sweepCommunityReports(env).catch(()=>{}));const api=await routeApi(request,env,new URL(request.url));if(api)return withSecurityHeaders(api);const pagePath=new URL(request.url).pathname;const selected=pagePath==="/"||pagePath==="/index.html"?(await routingSetting(env)).provider:undefined;return serveAsset(request,assets,{...env,LAPAN_SELECTED_PROVIDER:selected})}};';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/index.js.tmp',worker);
await rename('dist/server/index.js.tmp','dist/server/index.js');
