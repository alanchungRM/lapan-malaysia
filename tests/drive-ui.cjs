const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const U=require('../web/drive-ui.js'),D=require('../web/directions.js'),{createI18n}=require('../web/i18n.js');

// The trip line is split into parts without changing a single character of its text.
for(const [text,expect] of [['ETA 8:01 am · 44 min · 30 km',['8:01',' am','44 min','30 km']],['ETA 12:05 pm · 130 min · 142.3 km',['12:05',' pm','130 min','142.3 km']],['ETA 7:24 am · 3 min · 4.6 km',['7:24',' am','3 min','4.6 km']],['ETA 19:30 · 5 min · 1.0 km',['19:30','','5 min','1.0 km']]]){
 const t=U.parse(text);assert.deepEqual([t.time,t.meridiem,t.duration,t.distance],expect,text);assert.equal(t.label+t.time+t.meridiem+' · '+t.duration+' · '+t.distance,text,'nothing lost');}
for(const other of ['Route guidance','Updating arrival estimate…','Arrived 8:01 am','3 min · 4.6 km planned','ETA soon · x · y',''])assert.equal(U.parse(other),null,other);
// Painting: parts get their own classes, unchanged text is not rebuilt, other text stays plain.
function doc(){return {createElement(tag){return {tag,className:'',children:[],textContent:'',append(...c){this.children.push(...c)},replaceChildren(...c){this.children=c;this.rebuilt=(this.rebuilt||0)+1},dataset:{}}}}}
const node={ownerDocument:doc(),dataset:{},children:[],replaceChildren(...c){this.children=c;this.rebuilt=(this.rebuilt||0)+1},set textContent(v){this.plain=v}};
U.paintTrip(node,'ETA 8:01 am · 44 min · 30 km');assert.deepEqual(node.children.map(c=>c.className),['eta-label','eta-time','eta-sep','eta-dur','eta-sep','eta-dist']);
assert.deepEqual(node.children[1].children.map(c=>[c.tag,c.textContent]),[['b','8:01'],['small',' am']]);assert.equal(node.children[3].textContent,'44 min');assert.equal(node.children[5].textContent,'30 km');
U.paintTrip(node,'ETA 8:01 am · 44 min · 30 km');assert.equal(node.rebuilt,1,'same text is not rebuilt');U.paintTrip(node,'ETA 8:00 am · 45 min · 31 km');assert.equal(node.rebuilt,2);
U.paintTrip(node,'Route guidance');assert.equal(node.plain,'Route guidance');

// Turn arrows and sign colours.
const step=(type,modifier,extra={})=>({maneuver:{type,modifier},...extra});
for(const [s,icon] of [[step('turn','left'),'left'],[step('turn','right'),'right'],[step('turn','straight'),'straight'],[step('continue','straight'),'straight'],[step('turn','slight right'),'right'],[step('turn','sharp left'),'left'],[step('fork','slight right'),'fork-right'],[step('off ramp','slight left'),'fork-left'],[step('depart','straight'),'straight'],[step('turn','uturn'),'uturn'],[step('fork','left'),'fork-left'],[step('fork','right'),'fork-right'],[step('off ramp','right'),'fork-right'],[step('on ramp','left'),'fork-left'],[step('off ramp','straight'),'straight'],[step('roundabout','left'),'roundabout'],[step('arrive','straight'),'arrive'],[{},'straight']])assert.equal(D.iconName(s),icon,JSON.stringify(s));
for(const name of ['straight','left','right','uturn','fork-left','fork-right','roundabout','arrive']){assert.ok(D.ICONS[name].startsWith('<svg')&&D.ICONS[name].includes('aria-hidden="true"'),name);assert.ok(!/<script|on\w+=|href/i.test(D.ICONS[name]),'static artwork only')}
assert.equal(D.expressway({ref:'E33'}),true);assert.equal(D.expressway({ref:'AH2'}),true);assert.equal(D.expressway({ref:'E 1'}),true);assert.equal(D.expressway({ref:'3113'}),false);assert.equal(D.expressway({ref:'FT1'}),false);assert.equal(D.expressway({ref:'3113;E36'}),true);
assert.equal(D.expressway({maneuver:{type:'off ramp'}}),true);assert.equal(D.expressway({exits:'214'}),true);assert.equal(D.expressway({name:'Jalan Ampang'}),false);

// The banner keeps its text and gains parts: icon, distance, separator, then the road text.
function banner(){const made=[];const d={createElement:tag=>({tag,className:'',textContent:'',title:'',set innerHTML(v){this.html=v}}),createTextNode:text=>({text,textContent:text})};
 const panel={dataset:{}};const n={ownerDocument:d,closest:()=>panel,replaceChildren(...c){this.children=c},children:[],get textContent(){return this.children.map(c=>c.textContent??c.text).join('')}};return {n,panel}}
{const {n,panel}=banner(),s=step('turn','left',{name:'Jalan Trinity',ref:'',exits:''});D.render(n,s,'310 m · Turn left onto Jalan Trinity');
 assert.deepEqual(n.children.map(c=>c.className||'text'),['turn-icon','turn-dist','turn-sep','text']);assert.equal(n.children[0].html,D.ICONS.left);assert.equal(n.textContent,'310 m · Turn left onto Jalan Trinity','text is unchanged');assert.equal(panel.dataset.road,'road');
 const e=step('off ramp','right',{name:'Lebuhraya DUKE',ref:'E33',exits:'214'});D.render(n,e,'1.2 km · Take exit 214 · E33');assert.equal(panel.dataset.road,'expressway');assert.equal(n.children[0].html,D.ICONS['fork-right']);assert.equal(n.children[1].textContent,'1.2 km');
 D.render(n,{},'Checking your route…');assert.deepEqual(n.children.map(c=>c.className||'text'),['text'],'status messages have no icon or distance');assert.equal(panel.dataset.road,'road');
 D.render(n,step('arrive','straight'),'45 m · Arrive at your destination');assert.equal(n.children[0].html,D.ICONS.arrive);}

// Sign colours: white text on green and blue, black on warning yellow, all at 7:1 or better, and distinct from each other.
const css=fs.readFileSync('web/drive-ui.css','utf8'),vars=l=>Object.fromEntries([...l.matchAll(/--([\w-]+):(#[0-9A-Fa-f]{6})/g)].map(m=>[m[1],m[2]]));
const tokens=Object.assign({},...css.split('\n').filter(l=>l.startsWith('html{--bad-fill')).map(vars));
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]},ratio=(x,y)=>{const [p,q]=[lum(x),lum(y)].sort((m,n)=>n-m);return (p+.05)/(q+.05)};
for(const [fg,bg] of [['on-sign','sign-green'],['on-sign','sign-blue'],['on-warn-sign','warn-sign']])assert.ok(ratio(tokens[fg],tokens[bg])>=7,`${fg} on ${bg} is ${ratio(tokens[fg],tokens[bg]).toFixed(2)}:1`);
// Green and blue differ in hue, not brightness, so the road and exit badges and the arrow carry the meaning too; colour is only a cue.
assert.ok(ratio(tokens['warn-sign'],tokens['sign-blue'])>=4,'the yellow alert stands out on the blue banner');assert.ok(ratio(tokens['warn-sign'],tokens['sign-green'])>=4,'and on the green one');

// Look rules that keep the screen readable and closable.
assert.match(css,/#nextturn \.turn-dist\{[^}]*font-size:clamp\(26px/,'distance is the biggest text on the banner');assert.match(css,/#nextturn\{[^}]*font-size:clamp\(17px/,'road text is at least 17px');
assert.match(css,/#navTrip .eta-time b\{font-size:clamp\(24px/,'arrival time is the biggest trip text');assert.match(css,/#navTrip \.eta-time\{flex:0 0 100%/,'duration and distance sit on their own line');
assert.match(css,/#navMore\{--icon:var\(--i-chev-left\)\}[^\n]*#navMore\{--icon:var\(--i-chev-right\)\}/,'the toggle is an arrow that flips when open');
// Nothing on the driving screen is allowed to grow past a phone-friendly ceiling.
for(const [what,re,max] of [['turn distance',/#nextturn \.turn-dist\{[^}]*font-size:clamp\(\d+px,[\d.]+vw,(\d+)px\)/,32],['turn road text',/#nextturn\{[^}]*font-size:clamp\(\d+px,[\d.]+vw,(\d+)px\)/,24],['arrival time',/#navTrip \.eta-time b\{font-size:clamp\(\d+px,[\d.]+vw,(\d+)px\)/,30],['alert text',/#cameraWarning,[^{]*\{[^}]*font-size:clamp\(\d+px,[\d.]+vw,(\d+)px\)/,18]]){const m=css.match(re);assert.ok(m,what);assert.ok(Number(m[1])<=max,what+' ceiling '+m[1]+' > '+max)}
assert.match(css,/#cameraWarning::before[^{]*\{[^}]*mask:var\(--i-warn\)/,'alerts carry a warning-sign symbol');
assert.match(css,/#navBar #stop\{background:var\(--bad-fill\)/);assert.match(css,/max-width:340px/,'narrow phones get a tighter trip bar');
// The tray is closed by default and cannot be stuck open or hidden behind the trip bar.
const base=fs.readFileSync('web/mobile.css','utf8');assert.match(base,/body\.guiding:not\(\.drive-more\) #driveMore[^{]*\{display:none!important\}/);assert.match(base,/body\.guiding #driveControls\{overflow:visible!important\}/);

// Trip wording in Bahasa Malaysia is short: only the label changes, the numbers stay.
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
assert.equal(entries['ETA'],'Tiba');assert.ok(entries['ETA'].length<=5,'short label');
const html=fs.readFileSync('web/index.html','utf8');assert.ok(html.indexOf('drive-ui.js')<html.indexOf('eta.js')&&html.indexOf('eta.js')<html.indexOf('src="app.js"'),'the trip helper loads before the ETA code');
console.log('PASS: trip line parts, turn arrows, expressway and road sign colours, banner structure, sign contrast, readable sizes, closable tray and short Malay label');
