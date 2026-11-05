import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const code=await readFile('worker/toll-rates.js','utf8'),{estimateFromRates,mergeRateTolls}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const real=JSON.parse(await readFile('worker/toll-rates.json','utf8')),curated=JSON.parse(await readFile('worker/toll-data.json','utf8'));

// ---- The shipped rate data ----
assert.equal(real.class,1);assert.match(real.builtAt,/^\d{4}-\d\d-\d\d$/);assert.equal(real.highways.length,33);
let withCoords=0,plazas=0;
for(const h of real.highways){assert.ok(['closed','open'].includes(h.system),h.id);assert.ok(['official-api','official-page','official-form','official-image','secondary'].includes(h.confidence),h.id+' '+h.confidence);
 const seen=new Set();for(const [i,j,v] of h.rates){assert.ok(Number.isInteger(i)&&Number.isInteger(j)&&i<h.plazas.length&&j<h.plazas.length,h.id+' index');assert.ok(v>0&&v<=200&&Math.round(v*100)/100===v,h.id+' rate '+v);assert.ok(h.system==='closed'?i!==j:i===j,h.id+' pair shape');assert.ok(!seen.has(i+','+j),h.id+' duplicate pair');seen.add(i+','+j)}
 for(const p of h.plazas){plazas++;if(p[1]!=null){withCoords++;assert.ok(p[1]>=99&&p[1]<=120&&p[2]>=0.8&&p[2]<=7.6,h.id+' '+p[0]+' coordinates')}else assert.equal(p[2],null)}}
assert.equal(plazas,227);assert.equal(withCoords,178,'178 of 227 plazas can be matched on a route; the rest are priced only when another plaza of the same highway pins the pair');
const hw=id=>real.highways.find(h=>h.id===id),rate=(h,a,b)=>{const ia=h.plazas.findIndex(p=>p[0]===a),ib=h.plazas.findIndex(p=>p[0]===b);return h.rates.find(r=>r[0]===ia&&r[1]===ib)?.[2]};
// Anchors published by the dataset's authors, and two independent sources that must agree.
assert.equal(rate(hw('1'),'SUNGAI BESI','SKUDAI'),33.21);assert.equal(hw('5').rates[0][2],5.74,'Penang Bridge is RM 5.74, not the stale RM 7.00');assert.equal(hw('31').rates[0][2],5.74);
for(const p of curated.plazas.filter(x=>x.operator==='LDP')){assert.equal(hw('4').rates.filter(r=>r[2]===p.amount).length>=1,true,'LDP fare agrees with the checked fare '+p.amount)}assert.ok(hw('4').rates.every(r=>r[2]===2.1),'LDP is RM 2.10 at every plaza in both sources');assert.ok(hw('2').rates.every(r=>r[2]===2),'KESAS is RM 2.00 at every plaza in both sources');
// PLUS fares in the two directions of one pair should not differ wildly; the known exceptions are listed so a data refresh that adds new ones is noticed.
{const plus=hw('1'),map=new Map(plus.rates.map(([i,j,v])=>[i+','+j,v]));const odd=[];for(const [i,j,v] of plus.rates){const back=map.get(j+','+i);if(back!=null&&i<j&&Math.abs(back-v)>0.011)odd.push(plus.plazas[i][0]+' <-> '+plus.plazas[j][0]+': '+v+' vs '+back)}
 assert.ok(odd.length<=10,'PLUS pairs whose two directions differ: '+odd.length+'\n'+odd.join('\n'))}

// ---- A small road to test the estimator on: a straight line along lat 3 with plazas at known metres ----
const M=1/111195,lon=m=>101+m*M;
function road(totalM,step=50,at=0){const pts=[];for(let m=0;m<=totalM;m+=step)pts.push({longitude:lon(m),latitude:3+at*M});return pts}
const plaza=(name,m,off=0)=>[name,lon(m),3+off*M];
function route(totalM,sections,extra={}){return {legs:[{points:road(totalM)}],sections:sections.map(([a,b])=>({sectionType:'TOLL',startPointIndex:Math.round(a/50),endPointIndex:Math.round(b/50)})),...extra}}
const closed={id:'c',short:'CLOSED',system:'closed',confidence:'official-api',plazas:[plaza('A',1000),plaza('B',5000),plaza('C',9000),['D',null,null]],rates:[[0,1,4],[0,2,9.5],[1,2,5.5],[0,3,12],[3,0,12]]};
const open={id:'o',short:'OPEN',system:'open',confidence:'official-page',plazas:[plaza('P',3000),plaza('Q',6000),plaza('R',8000,100)],rates:[[0,0,2.1],[1,1,2.5],[2,2,3]]};
const secondary={id:'s',short:'SEC',system:'open',confidence:'secondary',plazas:[plaza('S',2000)],rates:[[0,0,1.15]]};
const R=(highways)=>({builtAt:'2026-11-02',highways});
const none={status:'unavailable',items:[],amount:null,missingOperators:[]};
// Closed system: first and last matched plaza price the trip, across separate toll sections.
let r=mergeRateTolls(none,route(10000,[[500,3000],[3500,9500]]),R([closed]));
assert.equal(r.amount,9.5);assert.equal(r.status,'estimate');assert.equal(r.items[0].label,'A → C');assert.equal(r.items[0].operator,'CLOSED');assert.equal(r.uncoveredSections,0);
// Starting at the middle plaza prices B → C; a plaza without coordinates is simply not matched.
r=mergeRateTolls(none,route(10000,[[4000,9500]]),R([closed]));assert.equal(r.amount,5.5);assert.equal(r.items[0].label,'B → C');
// One plaza only cannot be priced, and the section is not covered, so the answer is partial or unavailable, never a guess.
r=mergeRateTolls(none,route(10000,[[500,2000]]),R([closed]));assert.equal(r.status,'unavailable');assert.equal(r.amount,null);assert.equal(r.unpriced[0].why,'one plaza only');
// A pair with no published fare falls back to a narrower published pair.
const gap={...closed,rates:[[0,1,4],[1,2,5.5]]};r=mergeRateTolls(none,route(10000,[[500,9500]]),R([gap]));assert.equal(r.items[0].label,'A → B');assert.equal(r.status,'partial','a narrower priced pair cannot cover the whole matched journey');
// Open system: each plaza once, summed; repeated passes of the same plaza are not double counted.
r=mergeRateTolls(none,route(10000,[[2500,7000]]),R([open]));assert.equal(r.amount,4.6);assert.deepEqual(r.items.map(i=>i.label),['P','Q']);
// Plazas away from the road or outside every toll section are ignored (a parallel road is not this road).
const near={...open,plazas:[plaza('P',3000,249),plaza('Q',6000,251)]};r=mergeRateTolls(none,route(10000,[[2500,7000]]),R([near]));assert.deepEqual(r.items.map(i=>i.label),['P'],'249 m counts, 251 m does not');
r=mergeRateTolls(none,route(10000,[[4000,5000]]),R([open]));assert.equal(r.items.length,0,'plazas outside the toll sections are ignored');assert.equal(r.status,'unavailable');
// Sections with nothing priced make the total partial ("at least"), and slivers under 300 m do not.
r=mergeRateTolls(none,route(10000,[[2500,3500],[7000,7200],[9500,9900]]),R([open]));assert.equal(r.amount,2.1);assert.equal(r.uncoveredSections,1,'only the 400 m stretch without a plaza counts');assert.equal(r.status,'partial');
r=mergeRateTolls(none,route(10000,[[2500,3500],[7000,7200]]),R([open]));assert.equal(r.status,'estimate','the 200 m sliver is ignored');
// A plaza on the route that has no published fare keeps the total partial, even when every section has some price.
{const unknown={id:'u',short:'UNK',system:'open',confidence:'official-page',plazas:[plaza('U',4000)],rates:[]},x=mergeRateTolls(none,route(10000,[[2500,7000]]),R([open,unknown]));assert.equal(x.amount,4.6);assert.equal(x.status,'partial');assert.deepEqual(x.unpriced.map(u=>u.label),['U'])}
// No toll road reported at all.
r=mergeRateTolls(none,route(10000,[]),R([open,closed]));assert.equal(r.status,'none');assert.equal(r.amount,0);assert.match(r.note,/Not every plaza is mapped/);
// Both operators on one route add up, and the weakest source decides the confidence.
r=mergeRateTolls(none,route(10000,[[500,9500]]),R([closed,open,secondary]));assert.equal(r.amount,Math.round((9.5+2.1+2.5+3+1.15)*100)/100);assert.equal(r.status,'estimate');assert.equal(r.confidence,'secondary');
// The careful per-operator estimate wins where it already priced a highway, so nothing is charged twice.
const base={status:'partial',items:[{operator:'LDP',label:'Penchala',amount:2.1,offset:3000}],amount:2.1,missingOperators:[]};
const ldp={id:'4',short:'LDP',system:'open',confidence:'official-page',plazas:[plaza('Penchala',3000),plaza('Extra',6000)],rates:[[0,0,2.1],[1,1,2.1]]};
r=mergeRateTolls(base,route(10000,[[2500,7000]]),R([ldp]));assert.equal(r.amount,2.1,'LDP is not priced a second time');assert.equal(r.items.length,1);
// A PLUS pair that was left unresolved is replaced by the priced one.
const plusBase={status:'unavailable',items:[{operator:'PLUS',label:'Entry–exit pair not resolved',amount:null,offset:0}],amount:null,missingOperators:['PLUS']};
const plusHw={...closed,id:'1',short:'PLUS'};r=mergeRateTolls(plusBase,route(10000,[[500,9500]]),R([plusHw]));assert.equal(r.amount,9.5);assert.deepEqual(r.missingOperators,[]);assert.equal(r.items.filter(i=>i.operator==='PLUS').length,1);
const plusDone={status:'partial',items:[{operator:'PLUS',label:'X → Y',amount:20,offset:900}],amount:20,missingOperators:[]};r=mergeRateTolls(plusDone,route(10000,[[500,9500]]),R([plusHw]));assert.equal(r.amount,20,'a PLUS fare already found from the official service stays');
// Broken input never throws and never invents a price.
for(const bad of [{legs:[]},{legs:[{points:[{longitude:101,latitude:3}]}]},{legs:[{points:[{longitude:NaN,latitude:3},{longitude:101,latitude:3}]}]}]){const x=mergeRateTolls(none,bad,R([open]));assert.equal(x,none,'unchanged')}
assert.equal(estimateFromRates({legs:[{points:road(200000,50)}],sections:[]},R([open])).sections,0);

// ---- Real data on real-shaped routes: a straight run through the plazas of one highway ----
function through(names,highway){const pts=names.map(n=>highway.plazas.find(p=>p[0]===n));const out=[];for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],steps=Math.ceil(Math.hypot((b[1]-a[1])*111195*0.9994,(b[2]-a[2])*111195)/100);for(let i=0;i<steps;i++)out.push({longitude:a[1]+(b[1]-a[1])*i/steps,latitude:a[2]+(b[2]-a[2])*i/steps})}const l=pts.at(-1);out.push({longitude:l[1],latitude:l[2]});return out}
const plus=hw('1'),pts=through(['SUNGAI BESI','SKUDAI'],plus);const jb={legs:[{points:pts}],sections:[{sectionType:'TOLL',startPointIndex:0,endPointIndex:pts.length-1}]};
r=mergeRateTolls(none,jb,real);assert.equal(r.items.find(i=>i.operator==='PLUS').amount,33.21,'Kuala Lumpur to Johor Bahru matches the published fare');
{const penang=[...through(['JALAN DUTA','JURU'],plus),...through(['JAMBATAN PULAU PINANG'],hw('5'))].filter(Boolean);const x=mergeRateTolls(none,{legs:[{points:penang}],sections:[{sectionType:'TOLL',startPointIndex:0,endPointIndex:penang.length-1}]},real);assert.equal(x.amount,41.24,'PLUS 35.50 plus the Penang Bridge 5.74');assert.deepEqual(x.items.map(i=>i.operator),['PLUS','JPP'])}

// ---- Through the whole Worker, as the app asks for it ----
const built=await readFile('dist/server/index.js','utf8'),worker=(await import('data:text/javascript;base64,'+Buffer.from(built).toString('base64'))).default;
function tomtom(points,sections){let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot((points[i].longitude-points[i-1].longitude)*111195*Math.cos(points[0].latitude*Math.PI/180),(points[i].latitude-points[i-1].latitude)*111195);length=Math.round(length);const ins=(i,m,off,t)=>({pointIndex:i,point:points[i],maneuver:m,routeOffsetInMeters:off,travelTimeInSeconds:t,street:'Highway'});
 return {summary:{travelTimeInSeconds:3600,lengthInMeters:length},legs:[{points}],sections,guidance:{instructions:[ins(0,'DEPART',0,0),ins(points.length-1,'ARRIVE',length,3600)]}}}
const original=globalThis.fetch;let ip=0;
async function ask(raw){globalThis.fetch=async()=>Response.json({routes:[raw]});const start=raw.legs[0].points[0],end=raw.legs[0].points.at(-1);const res=await worker.fetch(new Request('https://test/api/route',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.'+(++ip)},body:JSON.stringify({from:[start.longitude+ip*1e-5,start.latitude],to:[end.longitude,end.latitude],alternatives:false})}),{TOMTOM_API_KEY:'test-secret'});globalThis.fetch=original;assert.equal(res.status,200);return (await res.json()).routes[0]}
let out=await ask(tomtom(pts,[{sectionType:'TOLL',startPointIndex:0,endPointIndex:pts.length-1}]));assert.equal(out.tollEstimate.status,'estimate');assert.equal(out.tollEstimate.amount,33.21);assert.equal(out.tollEstimate.rates.builtAt,real.builtAt);
out=await ask(tomtom(pts,[]));assert.equal(out.tollEstimate.status,'none');assert.equal(out.tollEstimate.amount,0);
out=await ask(tomtom(pts.slice(0,Math.round(pts.length/3)),[{sectionType:'TOLL',startPointIndex:0,endPointIndex:Math.round(pts.length/3)-1}]));assert.ok(['partial','unavailable'].includes(out.tollEstimate.status),'half a trip with one plaza is never shown as a full estimate: '+out.tollEstimate.status);
assert.ok(!JSON.stringify(out).includes('test-secret'));
console.log('PASS: rate data integrity and cross-checks, closed and open pricing, tolerance, completeness, no double charging, bad input, real fares on real plaza positions, and the full Worker path');

assert.equal(mergeRateTolls(base,route(10000,[]),R([open])).status,'partial','a known charge must not become No toll');
assert.equal(mergeRateTolls(none,route(10000,[],{sections:[{sectionType:'TOLL',startPointIndex:-1,endPointIndex:9999}]}),R([open])).status,'unavailable','invalid toll sections must not become No toll');

{let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Staging must not call TomTom')};try{const res=await worker.fetch(new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:[101,3],to:[101.1,3],alternatives:false})}),{TOMTOM_API_KEY:'test-secret',TOMTOM_ROUTING_DISABLED:'true'});assert.equal(res.status,503);assert.equal(calls,0,'OSRM staging does not spend TomTom requests for tolls')}finally{globalThis.fetch=original}}
