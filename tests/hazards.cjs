const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const H=require('../web/hazards.js'),{createI18n}=require('../web/i18n.js');
const DEG=1/111320; // one metre in degrees of latitude
// A route going east 600 m, then turning (left = north, right = south) and continuing 600 m, with a vertex every 20 m.
const line=(from,dx,dy,n)=>Array.from({length:n},(_,i)=>[from[0]+dx*DEG*(i+1)*20,from[1]+dy*DEG*(i+1)*20]);
function corner(turn,sharp=true){const a=[[101,3],...line([101,3],1,0,30)],end=a.at(-1);return {geometry:{coordinates:[...a,...line(end,sharp?0:Math.cos(0.35),turn==='left'?(sharp?1:Math.sin(0.35)):(sharp?-1:-Math.sin(0.35)),30)]},legs:[{steps:[]}]}}
// Sharp curves.
let c=H.curves(corner('left'));assert.equal(c.length,1,'one 90 degree corner');assert.equal(c[0].side,'left');assert.ok(Math.abs(c[0].along-600)<25,'at 600 m, got '+c[0].along);assert.ok(c[0].angle>=85);
c=H.curves(corner('right'));assert.equal(c[0].side,'right');
assert.deepEqual(H.curves(corner('left',false)),[],'a 20 degree bend is not sharp');
assert.equal(H.curves({geometry:{coordinates:[[101,3],[101.01,3]]}}).length,0,'too short to bend');assert.deepEqual(H.curves(null),[]);
// A turn that is already announced as a manoeuvre is not repeated as a curve; a real curve elsewhere still is.
const turn=corner('left');turn.legs[0].steps=[{distance:600,maneuver:{type:'depart',location:[101,3]}},{distance:600,maneuver:{type:'turn',location:turn.geometry.coordinates[30]}},{distance:0,maneuver:{type:'arrive',location:turn.geometry.coordinates.at(-1)}}];
assert.deepEqual(H.curves(turn),[],'junction turn is not a curve');
// A zigzag gives two alerts, and wobble inside one bend is merged.
const [sx,sy]=[101,3],p1=line([sx,sy],1,0,40),p2=line(p1.at(-1),0,1,40),p3=line(p2.at(-1),1,0,40);
const zig={geometry:{coordinates:[[sx,sy],...p1,...p2,...p3]},legs:[{steps:[]}]};c=H.curves(zig);assert.equal(c.length,2);assert.equal(c[0].side,'left');assert.equal(c[1].side,'right');
// One bend drawn with several vertices is one alert, not several.
{const a=[[101,3],...line([101,3],1,0,30)],b=line(a.at(-1),0.7071,0.7071,2),d=line(b.at(-1),0,1,30),rounded={geometry:{coordinates:[...a,...b,...d]},legs:[]};
 assert.ok(H.curves(rounded,30).length===1,'rounded bend merges');}
// A roundabout silences curves along its whole length, a plain turn only near its start.
{const base=corner('left'),step=type=>({...base,legs:[{steps:[{distance:500,maneuver:{type:'depart',location:[101,3]}},{distance:150,maneuver:{type,location:base.geometry.coordinates[25]}},{distance:0,maneuver:{type:'arrive',location:base.geometry.coordinates.at(-1)}}]}]});
 assert.deepEqual(H.curves(step('roundabout')),[],'bend inside a roundabout');assert.equal(H.curves(step('turn')).length,1,'bend 100 m after an unrelated turn still counts');}
// Bends in the first and last 60 m are ignored (they are the start and the arrival).
assert.deepEqual(H.curves({geometry:{coordinates:[[101,3],[101.0002,3],[101.0002,3.0002],[101.0002,3.0004]]},legs:[]}),[]);

// Mapped points on the route.
const road={geometry:{coordinates:[[101,3],...line([101,3],1,0,100)]}},at=m=>[101+m*DEG,3],off=(m,side)=>[101+m*DEG,3+side*DEG];
const data={toll:[at(1000),off(1500,50)],rail:[off(500,10),off(700,40)],bump:[off(300,3),off(330,2),off(900,5),'junk',[200,3],[101.001]],extra:1};
const hits=H.pointsOnRoute(data,road);
assert.deepEqual(hits.map(h=>[h.kind,Math.round(h.along/10)*10,h.count]),[['bump',300,2],['rail',500,1],['bump',900,1],['toll',1000,1]],'on-route points in order; far ones dropped; two near bumps merged');
assert.deepEqual(H.pointsOnRoute(null,road),[]);assert.deepEqual(H.pointsOnRoute({toll:'x',rail:null},road),[]);assert.deepEqual(H.pointsOnRoute(data,{geometry:{coordinates:[]}}),[]);
assert.equal(H.pointsOnRoute({toll:[off(500,28)],rail:[],bump:[]},road).length,1,'tolls allow for a gantry beside the lane');assert.equal(H.pointsOnRoute({toll:[],rail:[off(500,28)],bump:[]},road).length,0,'but a crossing 28 m off the road is another road');

// What is announced next, and when.
const list=[{kind:'bump',along:300,count:1},{kind:'rail',along:500,count:1},{kind:'toll',along:1000,count:1}];
assert.equal(H.upcoming(list,-50),null,'nothing within range yet');assert.equal(H.upcoming(list,60).kind,'bump','250 m for a bump');assert.equal(H.upcoming(list,310).kind,'rail','passed hazards are skipped');
assert.equal(H.upcoming(list,420).kind,'rail');assert.equal(H.upcoming(list,500.5).kind,'toll');assert.equal(H.upcoming(list,1001),null);assert.equal(H.upcoming(list,410).remaining,90);
assert.deepEqual(H.RANGE,{toll:600,rail:500,curve:300,bump:250});

// Wording, in both languages.
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
const ms=createI18n({storage:{getItem:()=>'ms',setItem(){}},doc:{documentElement:{}},languages:[],voices:()=>[{lang:'ms-MY'}]});ms.add(entries);ms.init();
const bridge={t:(k,v)=>ms.t(k,v),s:(k,v)=>ms.t(k,v)};
const cases=[[{kind:'toll'},394,'Toll plaza ahead · 390 m','Toll plaza ahead, in 390 metres.','Plaza tol di hadapan · 390 m','Plaza tol di hadapan, dalam 390 meter.'],
 [{kind:'rail'},120,'Railway crossing ahead · 120 m','Railway crossing ahead, in 120 metres. Slow down.','Lintasan keretapi di hadapan · 120 m','Lintasan keretapi di hadapan, dalam 120 meter. Perlahankan.'],
 [{kind:'bump',count:1},4,'Speed bump ahead · 10 m','Speed bump ahead, in 10 metres.','Bonggol jalan di hadapan · 10 m','Bonggol jalan di hadapan, dalam 10 meter.'],
 [{kind:'bump',count:3},200,'Speed bumps ahead · 200 m','Speed bumps ahead, in 200 metres.','Beberapa bonggol jalan di hadapan · 200 m','Beberapa bonggol jalan di hadapan, dalam 200 meter.'],
 [{kind:'curve',side:'left'},250,'Sharp curve to the left · 250 m','Sharp curve to the left, in 250 metres.','Selekoh tajam ke kiri · 250 m','Selekoh tajam ke kiri, dalam 250 meter.'],
 [{kind:'curve',side:'right'},90,'Sharp curve to the right · 90 m','Sharp curve to the right, in 90 metres.','Selekoh tajam ke kanan · 90 m','Selekoh tajam ke kanan, dalam 90 meter.']];
for(const [h,m,text,voice,msText,msVoice] of cases){const en=H.describe(h,m);assert.equal(en.text,text);assert.equal(en.voice,voice);const my=H.describe(h,m,bridge);assert.equal(my.text,msText);assert.equal(my.voice,msVoice)}

// The shipped data.
const d=JSON.parse(fs.readFileSync('web/hazards.json','utf8'));
assert.equal(d.license,'ODbL-1.0');assert.match(d.dataThrough,/^\d{4}-\d\d-\d\dT/);
for(const k of ['toll','rail','bump']){assert.ok(d[k].length>100,k+' has data');for(const p of d[k]){assert.ok(p[0]>=99&&p[0]<=120&&p[1]>=0.8&&p[1]<=7.6,k+' point outside Malaysia '+p);}assert.equal(new Set(d[k].map(String)).size,d[k].length,k+' has duplicates')}
// Page wiring: banner, switch, info text, and the script loads after cameras.js (it borrows its projection) and before app.js.
const html=fs.readFileSync('web/index.html','utf8');for(const id of ['hazardWarning','hazardAlerts','hazardInfo'])assert.ok(html.includes('id="'+id+'"'),id);
assert.ok(html.indexOf('cameras.js')<html.indexOf('hazards.js')&&html.indexOf('hazards.js')<html.indexOf('src="app.js"'));
const css=fs.readFileSync('web/mobile.css','utf8');assert.match(css,/#hazardWarning:not\(\.hidden\)~#limitWarning/);
console.log('PASS: sharp-curve detection, junction turns excluded, mapped points on the route, merging, range and order, wording in English and Bahasa Malaysia, shipped data and page wiring');
