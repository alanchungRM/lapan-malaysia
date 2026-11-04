(function(root){
const STEP=25,GAP=150,DROP_MIN=10,DROP_AHEAD=400,SNAP=18,HEADING=40,CELL=.01;
// Mapped limits only. A road with no OSM maxspeed shows no limit rather than a guess.
function parseLimit(raw){const m=String(raw||'').trim().match(/^(\d{1,3})\s*(km\/h|mph)?$/);if(!m)return null;const v=Math.round(Number(m[1])*(m[2]==='mph'?1.609344:1));return v>=10&&v<=130?v:null}
const rad=Math.PI/180;
function bearing(a,b){return Math.atan2((b[0]-a[0])*Math.cos(a[1]*rad),b[1]-a[1])/rad}
function turn(a,b){const d=Math.abs(a-b)%180;return d>90?180-d:d}
function decode(data){
 const scale=data.scale||1e5,segments=[];
 for(const way of data.ways){const limit=way[0];let x=way[1],y=way[2];const pts=[[x/scale,y/scale]];for(let i=3;i+1<way.length;i+=2){x+=way[i];y+=way[i+1];pts.push([x/scale,y/scale])}if(pts.length>1&&limit>0)segments.push({limit,pts})}
 const cells=new Map();
 segments.forEach((s,id)=>{let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const p of s.pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}
  for(let cx=Math.floor(x0/CELL);cx<=Math.floor(x1/CELL);cx++)for(let cy=Math.floor(y0/CELL);cy<=Math.floor(y1/CELL);cy++){const k=cx+':'+cy;(cells.get(k)||cells.set(k,[]).get(k)).push(id)}});
 return {segments,cells};
}
function nearestOnSegment(point,s,routeBearing){
 let best=null;const cos=Math.cos(point[1]*rad);
 for(let i=1;i<s.pts.length;i++){const a=s.pts[i-1],b=s.pts[i],ax=(a[0]-point[0])*111320*cos,ay=(a[1]-point[1])*111320,dx=(b[0]-a[0])*111320*cos,dy=(b[1]-a[1])*111320,len2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len2)),d=Math.hypot(ax+t*dx,ay+t*dy);
  if(d<=SNAP&&(!best||d<best.d)&&turn(bearing(a,b),routeBearing)<=HEADING)best={d}}
 return best;
}
// Samples the route every STEP metres and snaps each sample to the nearest parallel mapped road.
function buildProfile(coords,index){
 const cos0=Math.cos(coords[0][1]*rad),samples=[];let carried=0,total=0;
 for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i],cos=Math.cos(a[1]*rad),len=Math.hypot((b[0]-a[0])*111320*cos,(b[1]-a[1])*111320);if(!len)continue;const brg=bearing(a,b);
  let at=STEP-carried;for(;at<=len;at+=STEP){const t=at/len;samples.push({point:[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],bearing:brg})}carried=len-(at-STEP);total+=len}
 const limits=new Uint8Array(samples.length+1);
 samples.forEach((sample,n)=>{const cx=Math.floor(sample.point[0]/CELL),cy=Math.floor(sample.point[1]/CELL);let best=null;
  for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const id of index.cells.get(x+':'+y)||[]){const hit=nearestOnSegment(sample.point,index.segments[id],sample.bearing);if(hit&&(!best||hit.d<best.d))best={d:hit.d,limit:index.segments[id].limit}}
  limits[n+1]=best?best.limit:0});
 limits[0]=limits[1]||0;
 // Isolated one-sample matches are crossings, not road changes.
 for(let i=1;i<limits.length-1;i++)if(limits[i]&&limits[i]!==limits[i-1]&&limits[i]!==limits[i+1]&&limits[i-1]&&limits[i-1]===limits[i+1])limits[i]=limits[i-1];
 // Fill short unmapped gaps between identical limits.
 const maxGap=Math.round(GAP/STEP);let i=0;
 while(i<limits.length){if(limits[i]){i++;continue}let j=i;while(j<limits.length&&!limits[j])j++;if(i>0&&j<limits.length&&limits[i-1]===limits[j]&&j-i<=maxGap)limits.fill(limits[j],i,j);i=j}
 return {step:STEP,limits,length:total};
}
function limitAt(profile,along){if(!profile||!(along>=0))return 0;return profile.limits[Math.min(profile.limits.length-1,Math.round(along/profile.step))]||0}
// First upcoming drop of at least DROP_MIN km/h within the horizon.
function nextDrop(profile,along,horizon=DROP_AHEAD){
 const now=limitAt(profile,along);if(!now)return null;const first=Math.round(along/profile.step),last=Math.min(profile.limits.length-1,Math.round((along+horizon)/profile.step));
 for(let i=first+1;i<=last;i++){const v=profile.limits[i];if(v&&v<=now-DROP_MIN)return {limit:v,distance:Math.max(0,i*profile.step-along),index:i,from:now}}
 return null;
}
// ok: at or under the limit. over: noticeably above it. fast: well above it.
function classify(speedKmh,limit){if(!limit||!Number.isFinite(speedKmh)||speedKmh<0)return 'unknown';const over=speedKmh-limit;return over>=10?'fast':over>=3?'over':'ok'}
if(typeof module==='object')module.exports={parseLimit,decode,buildProfile,limitAt,nextDrop,classify,STEP};
if(!root.document)return;
const $=id=>document.getElementById(id);
let index=null,loading=null,loadedAt=0,failedAt=0,route=null,profile=null,enabled=true,state='unknown',since=0,spoke=0,dropSpoken=-1;
try{enabled=localStorage.getItem('lapan-speed-limits')!=='off'}catch{}
async function load(force){if(index&&Date.now()-loadedAt<86400000)return;if(loading)return loading;if(!force&&failedAt&&Date.now()-failedAt<60000)return;loading=(async()=>{try{const r=await fetch('/speed-limits.json'),d=await r.json();if(!r.ok||!Array.isArray(d.ways))throw Error();index=decode(d);loadedAt=Date.now();failedAt=0;route=null;$('speedLimitInfo').textContent='Mapped speed limits © OpenStreetMap contributors · '+d.ways.length.toLocaleString('en')+' road sections · data '+String(d.dataThrough||'date unavailable').slice(0,10)+'. Many roads have no mapped limit, and mapped limits can be wrong or outdated. Always obey road signs.'}catch{failedAt=Date.now();$('speedLimitInfo').textContent='Speed-limit data could not load. Limits are unavailable; switch this off and on to retry.'}finally{loading=null}})();return loading}
function paint(limit,next){const sign=$('driveLimit'),chip=$('speedChip');if(!sign||!chip)return;sign.classList.toggle('hidden',!limit);if(limit)sign.firstElementChild.textContent=String(limit);sign.setAttribute('aria-label',limit?'Speed limit '+limit+' kilometres per hour':'Speed limit unknown');chip.classList.toggle('over',state==='over');chip.classList.toggle('fast',state==='fast');const el=$('limitWarning');if(next){el.textContent='Speed limit drops to '+next.limit+' km/h · '+Math.round(next.distance/10)*10+' m';el.classList.remove('hidden')}else el.classList.add('hidden')}
function stop(){route=null;profile=null;state='unknown';since=0;spoke=0;dropSpoken=-1;paint(0,null)}
root.LapanSpeed={
 stop,
 // Limit mapped at a distance along the current route, used to complete camera alerts.
 limitAtAlong(nextRoute,along){return nextRoute===route?limitAt(profile,along):0},
 update(fix,nextRoute){
  const coords=nextRoute?.geometry?.coordinates;
  if(!enabled||!coords?.length||fix.coords.accuracy>60)return paint(0,null);
  if(!index){load();return paint(0,null)}
  if(route!==nextRoute){route=nextRoute;profile=buildProfile(coords,index);dropSpoken=-1}
  const here=root.LapanCameras.project([fix.coords.longitude,fix.coords.latitude],coords);
  if(here.distance>45)return paint(0,null);
  const along=here.along,limit=limitAt(profile,along),speed=Number.isFinite(fix.coords.speed)?fix.coords.speed*3.6:NaN,next=nextDrop(profile,along),now=Date.now(),before=state;
  state=classify(speed,limit);
  if(state!==before)since=now;
  if(next&&dropSpoken!==next.index){dropSpoken=next.index;root.LapanVoice?.speak('Speed limit drops to '+next.limit+' in '+Math.round(next.distance/50)*50+' metres.')}
  if((state==='over'||state==='fast')&&now-since>=4000&&now-spoke>=45000){spoke=now;root.LapanVoice?.speak('Slow down. Speed limit '+limit+'.')}
  paint(limit,next);
 },
 // Called when navigation starts, so the data is only downloaded for people who drive.
 setEnabled(on){enabled=on;try{localStorage.setItem('lapan-speed-limits',on?'on':'off')}catch{}if(!on){stop()}else load(true)},
 preload(){if(enabled)load()}
};
document.addEventListener('DOMContentLoaded',()=>{const box=$('speedLimits');if(!box)return;box.checked=enabled;box.onchange=()=>root.LapanSpeed.setEnabled(box.checked);});
})(typeof window==='object'?window:globalThis);
