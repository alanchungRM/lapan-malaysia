// Traffic along a planned route: a coloured bar for each route card, a plain-words summary, and coloured stretches on the map.
(function(root){
const NAMES=['clear','slow','heavy','jam'];
const rad=Math.PI/180;
function metres(a,b){const dy=(b[1]-a[1])*111320,dx=(b[0]-a[0])*111320*Math.cos((a[1]+b[1])/2*rad);return Math.hypot(dx,dy)}
// Splits the route into runs of equal traffic level. Returns null when the route carries no live traffic data (for example basic OSRM routing), so nothing is claimed.
function analyze(route){
 const coords=route&&route.geometry&&route.geometry.coordinates,sections=route&&route.trafficSections;
 if(!Array.isArray(coords)||coords.length<2||!Array.isArray(sections)||route.provider==='OSRM')return null;
 const edges=coords.length-1,level=new Array(edges).fill(0),length=new Array(edges);let total=0,delay=0;
 for(let i=0;i<edges;i++){length[i]=metres(coords[i],coords[i+1]);total+=length[i]}
 if(!(total>0))return null;
 for(const s of sections){if(!s||!Number.isInteger(s.startPointIndex)||!Number.isInteger(s.endPointIndex)||s.startPointIndex<0||s.endPointIndex>edges||s.startPointIndex>=s.endPointIndex)continue;const m=Math.max(1,Math.min(3,Math.round(s.magnitude)||1));for(let i=s.startPointIndex;i<s.endPointIndex;i++)if(m>level[i])level[i]=m;if(Number.isFinite(s.delay)&&s.delay>0)delay+=s.delay}
 const parts=[];for(let i=0;i<edges;i++){const last=parts[parts.length-1];if(last&&last.level===level[i]){last.meters+=length[i];last.to=i+1}else parts.push({level:level[i],meters:length[i],from:i,to:i+1})}
 const sum=l=>parts.filter(p=>p.level===l).reduce((a,p)=>a+p.meters,0);
 const worst=Math.max(0,...level);
 return {total,parts,delay,worst,slow:sum(1),heavy:sum(2),jam:sum(3),congested:sum(1)+sum(2)+sum(3)};
}
// English sentence for the card. The app's language engine translates it through the patterns in i18n-ms.js.
function summary(a){
 if(!a)return '';
 if(!a.congested)return 'No traffic delays reported';
 const km=Math.max(0.1,Math.round(a.congested/100)/10).toFixed(1),min=Math.round(a.delay/60),kind=['','light','heavy','stop-and-go'][a.worst];
 return (min>=1?'+'+min+' min · ':'')+km+' km delayed · '+kind;
}
function bar(a,doc){
 const el=doc.createElement('div');el.className='traffic-bar';el.setAttribute('aria-hidden','true');
 for(const p of a.parts){const seg=doc.createElement('i');seg.className='t-'+NAMES[p.level];seg.style.width=(p.meters/a.total*100).toFixed(2)+'%';el.append(seg)}
 return el;
}
const api={analyze,summary,bar,NAMES};
if(typeof module==='object')module.exports=api;
root.LapanTrafficBar=api;
})(typeof window!=='undefined'?window:globalThis);
