const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../web/reports.js'),{createI18n}=require('../web/i18n.js');
const M=1/111320,route={geometry:{coordinates:[[101,3],...Array.from({length:100},(_,i)=>[101+(i+1)*20*M,3])]}}; // 2 km east
const at=(m,off=0)=>({lon:101+m*M,lat:3+off*M});
const rep=(id,kind,m,off=0,ageSeconds=0)=>({id,kind,...at(m,off),ageSeconds,confirms:0,denies:0});

// Placement on the route.
let items=R.placeOnRoute([rep('a','crash',900),rep('b','flood',500,30),rep('c','pothole',1200,60),rep('d','object',300,-39),{id:'e',kind:'police',...at(400)},{id:'f',kind:'crash',lat:'x',lon:1},null,rep('g','stopped',1500)],route);
assert.deepEqual(items.map(r=>r.id),['d','b','a','g'],'on-route reports in order; one 60 m off, an unknown kind and junk are dropped');assert.ok(Math.abs(items[2].along-900)<5);
assert.deepEqual(R.placeOnRoute(null,route),[]);assert.deepEqual(R.placeOnRoute([rep('a','crash',900)],null),[]);assert.deepEqual(R.placeOnRoute([rep('a','crash',900)],{geometry:{coordinates:[]}}),[]);

// What is announced next.
assert.equal(R.ahead(items,-250),null,'550 m ahead is out of range');assert.equal(R.ahead(items,100).id,'d','200 m ahead is in range');
assert.equal(R.ahead(items,350).id,'b','passed reports are skipped');assert.equal(R.ahead(items,501).id,'a');assert.equal(R.ahead(items,1450).id,'g');assert.equal(R.ahead(items,1600),null);
assert.equal(R.RANGE,500);assert.equal(R.ASK,120);

// Refresh policy.
const fix=(lat,lon)=>({latitude:lat,longitude:lon});
assert.equal(R.shouldRefresh(null,fix(3,101),0),true);assert.equal(R.shouldRefresh({at:0,lat:3,lon:101},fix(3,101),30000),false);assert.equal(R.shouldRefresh({at:0,lat:3,lon:101},fix(3,101),60000),true,'after a minute');
assert.equal(R.shouldRefresh({at:0,lat:3,lon:101},fix(3.005,101),1000),false,'550 m is not enough');assert.equal(R.shouldRefresh({at:0,lat:3,lon:101},fix(3.0095,101),1000),true,'a kilometre is');

// Wording, in both languages.
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
const ms=createI18n({storage:{getItem:()=>'ms',setItem(){}},doc:{documentElement:{}},languages:[],voices:()=>[{lang:'ms-MY'}]});ms.add(entries);ms.init();const bridge={t:(k,v)=>ms.t(k,v),s:(k,v)=>ms.t(k,v)};
const rows=[['crash',394,20,'Crash reported ahead · 390 m · just now','Crash reported ahead, in 390 metres.','Kemalangan dilaporkan di hadapan · 390 m · baru sahaja','Kemalangan dilaporkan di hadapan, dalam 390 meter.'],
 ['stopped',120,300,'Stopped vehicle reported ahead · 120 m · 5 min ago','Stopped vehicle reported ahead, in 120 metres.','Kenderaan berhenti dilaporkan di hadapan · 120 m · 5 min lalu','Kenderaan berhenti dilaporkan di hadapan, dalam 120 meter.'],
 ['object',4,59,'Object on the road reported ahead · 10 m · just now','Object on the road reported ahead, in 10 metres.','Objek di jalan dilaporkan di hadapan · 10 m · baru sahaja','Objek di jalan dilaporkan di hadapan, dalam 10 meter.'],
 ['flood',250,7200,'Flooding reported ahead · 250 m · 2 h ago','Flooding reported ahead, in 250 metres.','Banjir dilaporkan di hadapan · 250 m · 2 j lalu','Banjir dilaporkan di hadapan, dalam 250 meter.'],
 ['pothole',500,86400,'Pothole reported ahead · 500 m · 24 h ago','Pothole reported ahead, in 500 metres.','Lubang jalan dilaporkan di hadapan · 500 m · 24 j lalu','Lubang jalan dilaporkan di hadapan, dalam 500 meter.']];
for(const [kind,remaining,age,text,voice,msText,msVoice] of rows){const r={kind,remaining,ageSeconds:age},en=R.describe(r);assert.equal(en.text,text);assert.equal(en.voice,voice);const my=R.describe(r,bridge);assert.equal(my.text,msText);assert.equal(my.voice,msVoice)}

assert.equal(R.ageText(89*60),' · 89 min ago');assert.equal(R.ageText(90*60),' · 2 h ago','switches to hours at 90 minutes');assert.equal(R.ageText(59),' · just now');assert.equal(R.ageText(60),' · 1 min ago');assert.equal(R.ageText(-5),' · just now');
// Client and server agree on the kinds, and there is no way to report police.
const server=fs.readFileSync('worker/reports.js','utf8'),serverKinds=Object.keys(eval('('+server.match(/const reportKinds=(\{[^}]*\})/)[1]+')'));
assert.deepEqual([...R.KINDS].sort(),serverKinds.sort());assert.ok(!R.KINDS.some(k=>/police|roadblock|aes|saman/i.test(k)));
const html=fs.readFileSync('web/index.html','utf8');
assert.deepEqual([...html.matchAll(/data-report="(\w+)"/g)].map(m=>m[1]).sort(),[...R.KINDS].sort(),'the dialog offers exactly these kinds');
for(const id of ['navReport','reportDialog','reportStatus','reportWarning','reportAsk','reportYes','reportNo','closeReport','cancelReport'])assert.ok(html.includes('id="'+id+'"'),id);
assert.match(html,/id="navReport"[^>]*hidden/,'hidden until the service answers');
assert.ok(html.indexOf('cameras.js')<html.indexOf('reports.js')&&html.indexOf('reports.js')<html.indexOf('src="app.js"'));
// Every string the module can show has Bahasa Malaysia.
const js=fs.readFileSync('web/reports.js','utf8');for(const m of js.matchAll(/say\('([^']+)'\)/g))assert.ok(entries[m[1]],'untranslated: '+m[1]);
for(const key of ['Waiting for a GPS fix. Try again in a moment.','Sending…','Thank you. Your report helps drivers behind you.','Too many reports. Please wait a minute.','Reports are not available right now.','Could not send the report. Please try again.','Could not send. Check your connection and try again.','Still there?','Report on the road'])assert.ok(entries[key],'untranslated: '+key);
assert.ok(!/innerHTML/.test(js.replace(/\/\/.*$/gm,'')),'no HTML is built from server data');
// The question names what it asks about, using the same labels as the dialog.
assert.deepEqual(R.LABELS,Object.fromEntries([...html.matchAll(/data-report="(\w+)"[^>]*>.*?<span>([^<]+)<\/span>/g)].map(m=>[m[1],m[2]])));for(const label of Object.values(R.LABELS))assert.ok(entries[label],'untranslated label: '+label);assert.ok(html.includes('id="reportAskKind"'));
// The privacy text names the new data in both languages.
assert.match(html,/Community reports, when you choose to send one/);assert.ok(Object.keys(entries).some(k=>k.includes('Community reports, when you choose to send one')&&entries[k].includes('Laporan komuniti')));
console.log('PASS: placement on the route, order and range, refresh policy, wording in both languages, client and server agree, no police reports, markup and privacy text');
