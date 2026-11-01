const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../web/traffic-bar.js'),{createI18n}=require('../web/i18n.js');
// A straight 10 km route east along the equator-ish line, 11 points, 1 km apart.
const coords=Array.from({length:11},(_,i)=>[101+i*0.009,3]);
const route=(sections,extra={})=>({provider:'TomTom',geometry:{type:'LineString',coordinates:coords},trafficSections:sections,...extra});
const km=m=>Math.round(m/100)/10;

// No live traffic data means no claim at all.
assert.equal(T.analyze(null),null);assert.equal(T.analyze({geometry:{coordinates:coords}}),null,'route without trafficSections');
assert.equal(T.analyze(route([],{provider:'OSRM'})),null,'basic routing never shows a traffic bar');
assert.equal(T.analyze(route([],{geometry:{coordinates:[[101,3]]}})),null,'one point');
assert.equal(T.summary(null),'');

// All clear.
let a=T.analyze(route([]));assert.equal(a.parts.length,1);assert.equal(a.parts[0].level,0);assert.equal(a.congested,0);assert.equal(T.summary(a),'No traffic delays reported');
assert.ok(Math.abs(a.total-10*0.009*111320*11/11*1)<50||a.total>9900,'length is measured along the route');

// Mixed traffic: slow 2 to 4, heavy 4 to 7 (km), stop-and-go inside 5 to 6 overrides.
a=T.analyze(route([{startPointIndex:2,endPointIndex:4,magnitude:1,delay:60},{startPointIndex:4,endPointIndex:7,magnitude:2,delay:300},{startPointIndex:5,endPointIndex:6,magnitude:3,delay:240}]));
assert.deepEqual(a.parts.map(p=>p.level),[0,1,2,3,2,0],'worst level wins where sections overlap');
assert.deepEqual(a.parts.map(p=>[p.from,p.to]),[[0,2],[2,4],[4,5],[5,6],[6,7],[7,10]],'edges tile the whole route');
assert.equal(Math.round(a.parts.reduce((s,p)=>s+p.meters,0)),Math.round(a.total));
assert.equal(a.worst,3);assert.equal(a.delay,600);assert.equal(km(a.congested),5.0);
assert.equal(T.summary(a),'5.0 km affected · worst: stop-and-go · about 10 min extra');
// Bad sections are skipped, never thrown on.
a=T.analyze(route([null,{startPointIndex:-1,endPointIndex:3,magnitude:2},{startPointIndex:5,endPointIndex:5,magnitude:2},{startPointIndex:1,endPointIndex:99,magnitude:2},{startPointIndex:'1',endPointIndex:3,magnitude:2},{startPointIndex:1,endPointIndex:2,magnitude:2,delay:-5}]));
assert.equal(a.parts.filter(p=>p.level).length,1);assert.equal(a.delay,0);assert.equal(T.summary(a),'1.0 km affected · worst: heavy','no delay clause under a minute');
assert.equal(T.summary(T.analyze(route([{startPointIndex:0,endPointIndex:1,magnitude:1,delay:20}]))),'1.0 km affected · worst: slow');
assert.equal(T.analyze(route([{startPointIndex:0,endPointIndex:2,magnitude:9,delay:10}])).worst,3,'magnitude is capped');

// The bar: widths add up to 100 and every segment has a level class. It is hidden from screen readers; the sentence carries the meaning.
const doc={createElement(tag){const el={tag,className:'',children:[],style:{},attrs:{},append(...c){this.children.push(...c)},setAttribute(k,v){this.attrs[k]=v}};return el}};
const bar=T.bar(T.analyze(route([{startPointIndex:2,endPointIndex:4,magnitude:1},{startPointIndex:5,endPointIndex:6,magnitude:3}])),doc);
assert.equal(bar.attrs['aria-hidden'],'true');assert.deepEqual(bar.children.map(c=>c.className),['t-clear','t-slow','t-clear','t-jam','t-clear']);
assert.ok(Math.abs(bar.children.reduce((s,c)=>s+parseFloat(c.style.width),0)-100)<0.1);

// Every sentence has Bahasa Malaysia, with the numbers kept.
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
const ms=createI18n({storage:{getItem:()=>'ms',setItem(){}},doc:{documentElement:{}},languages:[],voices:()=>[]});ms.add(entries);ms.init();
for(const [secs,expect] of [[[],'Tiada kelewatan trafik dilaporkan'],[[{startPointIndex:0,endPointIndex:3,magnitude:1,delay:180}],'3.0 km terjejas · paling teruk: perlahan · kira-kira 3 min tambahan'],[[{startPointIndex:0,endPointIndex:3,magnitude:2}],'3.0 km terjejas · paling teruk: sesak'],[[{startPointIndex:0,endPointIndex:3,magnitude:3,delay:90}],'3.0 km terjejas · paling teruk: berhenti-henti · kira-kira 2 min tambahan']])
 assert.equal(ms.lookup(T.summary(T.analyze(route(secs)))),expect);

// Colour is never the only signal (a pattern and words back it up) and each colour is visible against its surface.
const css=fs.readFileSync('web/ui2.css','utf8'),base=fs.readFileSync('web/mobile.css','utf8');
assert.match(base,/\.t-jam\{background:repeating-linear-gradient/,'stop-and-go has a hatched pattern');assert.match(base,/path\.traffic-jam\{stroke-dasharray/,'and a dashed line on the map');
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]},ratio=(x,y)=>{const [p,q]=[lum(x),lum(y)].sort((m,n)=>n-m);return (p+.05)/(q+.05)};
const all=css.split('\n'),vars=l=>Object.fromEntries([...l.matchAll(/--([\w-]+):(#[0-9A-Fa-f]{6})/g)].map(m=>[m[1],m[2]])),starts=p=>all.filter(l=>l.startsWith(p));
const dayTokens=starts('html[data-ui="2"]{'),nightTokens=starts('html[data-ui="2"][data-theme="night"]{');
const dayV=Object.assign({},...dayTokens.map(vars)),nightV=Object.assign({},dayV,...nightTokens.map(vars));
dayV['traffic-clear']=dayV.brand;nightV['traffic-clear']=nightV.brand;
for(const [name,v] of [['day',dayV],['night',nightV]])for(const k of ['traffic-clear','traffic-slow','traffic-heavy'])assert.ok(ratio(v[k],v.surface)>=3,`${name}: ${k} ${v[k]} on surface is ${ratio(v[k],v.surface).toFixed(2)}:1, needs 3:1`);
// The page loads the module before app.js uses it.
const html=fs.readFileSync('web/index.html','utf8');assert.ok(html.indexOf('traffic-bar.js')>0&&html.indexOf('traffic-bar.js')<html.indexOf('src="app.js"'));
console.log('PASS: traffic levels, overlap and bad-data handling, no claim without live data, bar widths, Bahasa Malaysia sentences, patterns and contrast');
