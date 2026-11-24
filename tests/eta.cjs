const assert=require('node:assert/strict'),{segments,remaining,time}=require('../web/eta.js'),fs=require('node:fs');
const route={duration:1800,legs:[{steps:[{duration:600,geometry:{coordinates:[[101,3],[101.01,3]]}},{duration:1200,geometry:{coordinates:[[101.01,3],[101.02,3]]}}]}]};const model=segments(route);let r=remaining(model,[101.005,3]);assert.ok(Math.abs(r.seconds-1500)<1);r=remaining(model,[101.015,3]);assert.ok(Math.abs(r.seconds-600)<1);assert.ok(r.distance<600);assert.ok(r.gap<1);r=remaining(model,[101.02,3]);assert.equal(r.seconds,0);r=remaining(model,[102,4]);assert.ok(r.gap>1000);assert.match(time(120,new Date('2026-10-24T15:59:00Z').getTime()),/12:01/);const fallback=segments({duration:60,geometry:{coordinates:[[101,3],[101.01,3]]}});assert.equal(fallback.edges[0].seconds,60);
const d=JSON.parse(fs.readFileSync('web/signals.json','utf8'));assert.ok(d.points.length>10000);assert.ok(d.points.every(p=>p.length===2&&p.every(Number.isFinite)));assert.ok(d.points.some(p=>Math.abs(p[0]-101.69)<.02&&Math.abs(p[1]-3.14)<.02),'KL signal coverage present');assert.equal(d.license,'ODbL-1.0');console.log('PASS: weighted remaining travel time, segment projection, off-route detection, arrival, Malaysia midnight rollover, geometry fallback and real signal dataset');

const vm=require('node:vm');
const etaSource=fs.readFileSync('web/eta.js','utf8');
function routeBarPreference(storage=new Map()){
 const toggle={};
 const context={
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  document:{readyState:'complete',getElementById:id=>id==='showRouteRail'?toggle:null},
 };
 vm.runInNewContext(etaSource,context);
 return toggle;
}
const storage=new Map();
let bar=routeBarPreference(storage);
assert.equal(bar.checked,false,'the route bar is off for new users');
bar.checked=false;
bar.onchange();
bar=routeBarPreference(storage);
assert.equal(bar.checked,false,'an explicit off choice survives reload');
bar.checked=true;
bar.onchange();
assert.equal(routeBarPreference(storage).checked,true);
console.log('PASS: optional route bar defaults off and preserves explicit choices');

const bands={style:{},replaceChildren(){}},label={},style={};
const rail={style:{setProperty:(k,v)=>style[k]=v},setAttribute(){},querySelector:s=>s==='.rail-bands'?bands:label};
const dashboard={localStorage:{getItem:()=>'on'},document:{documentElement:{lang:'en'},body:{classList:{contains:()=>true}},getElementById:id=>id==='routeRail'?rail:null,querySelector:()=>null}};
vm.runInNewContext(etaSource,dashboard);
const api=dashboard.LapanETA;
const path=(a,b)=>({duration:600,distance:(b-a)*111320,geometry:{coordinates:[[a,0],[b,0]]}});
const move=(lon,route)=>api.update({coords:{latitude:0,longitude:lon,accuracy:5}},route);
const first=path(100,100.02), detour=path(100.01,100.04), shortcut=path(100.02,100.03);
api.start(first);move(100.01,first);
assert.equal(style['--rail-progress'],'50.00%');
api.suspend();api.setRoute(detour,{rerouting:true});
assert.equal(style['--rail-progress'],'25.00%');
assert.ok(Math.abs(parseFloat(bands.style.bottom)-25)<0.001);
move(100.02,detour);api.setRoute(shortcut,{rerouting:true});
assert.equal(style['--rail-progress'],'66.67%');
move(100.03,shortcut);
assert.equal(style['--rail-progress'],'100.00%');
api.stop();api.start(first);move(100,first);
assert.equal(style['--rail-progress'],'0.00%');
