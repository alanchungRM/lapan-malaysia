const assert=require('node:assert/strict'),{createTheme}=require('../web/theme.js'),sun=require('../web/sun.js');
function setup({mode,region,at}){
 const store={...(mode?{'lapan-map-appearance':mode}:{}),...(region?{'lapan-sun-region':JSON.stringify(region)}:{})};
 const meta={content:''},dataset={},refreshes=[];let time=new Date(at),timer;
 const env={sun,storage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},doc:{documentElement:{dataset},querySelector:s=>s.includes('theme-color')?meta:null},now:()=>time,
  clock:{every:(fn,ms)=>{timer={fn,ms}}},mapAppearance:()=>({refresh(){refreshes.push(t.current());t.apply()}})};
 const t=createTheme(env);return {t,store,meta,dataset,refreshes,timer:()=>timer,set:d=>{time=new Date(d)}};
}
// Auto follows the sun: night before sunrise and after sunset in KL, day in between.
let s=setup({at:'2026-11-02T05:00:00+08:00'});assert.equal(s.t.current(),'night');assert.equal(s.t.apply(),'night');assert.equal(s.dataset.theme,'night');assert.equal(s.meta.content,'#0B1411','status bar colour follows the theme');
s.set('2026-11-02T12:00:00+08:00');assert.equal(s.t.current(),'day');s.t.apply();assert.equal(s.meta.content,'#0F7B5F');
// An explicit choice always wins over the sun.
s=setup({mode:'night',at:'2026-11-02T12:00:00+08:00'});assert.equal(s.t.current(),'night');
s=setup({mode:'day',at:'2026-11-02T23:00:00+08:00'});assert.equal(s.t.current(),'day');
s=setup({mode:'auto',at:'2026-11-02T23:00:00+08:00'});assert.equal(s.t.current(),'night');
s=setup({mode:'junk',at:'2026-11-02T12:00:00+08:00'});assert.equal(s.t.current(),'day','an unknown value falls back to Auto');
// The map is only told to refresh when the answer changes, checked once a minute.
s=setup({at:'2026-11-02T18:50:00+08:00'});s.t.start();assert.equal(s.timer().ms,60000);assert.equal(s.refreshes.length,0);
s.timer().fn();assert.equal(s.refreshes.length,0,'no change, no refresh');
s.set('2026-11-02T19:10:00+08:00');s.timer().fn();assert.deepEqual(s.refreshes,['night'],'switches to night after sunset');
s.timer().fn();assert.equal(s.refreshes.length,1,'checked again, still night, no second refresh');
s.set('2026-11-03T07:20:00+08:00');s.timer().fn();assert.deepEqual(s.refreshes,['night','day'],'back to day after sunrise');
// Location matters: Sabah is already in daylight when Kuala Lumpur is still dark.
const dawn='2026-11-02T06:25:00+08:00';
s=setup({at:dawn});assert.equal(s.t.current(),'night','KL at 06:25');
s=setup({at:dawn,region:{lat:6,lon:116}});assert.equal(s.t.current(),'day','Sabah at 06:25');
s=setup({at:dawn});s.t.start();s.t.locate(5.98,116.07);assert.deepEqual(s.refreshes,['day'],'moving to Sabah refreshes once');
// Only a coarse region is remembered, and impossible or tiny moves are ignored.
assert.deepEqual(JSON.parse(s.store['lapan-sun-region']),{lat:6,lon:116});
s.t.locate(5.9,116.1);s.t.locate(NaN,1);s.t.locate(51.5,0);s.t.locate(5.98,130);assert.equal(s.refreshes.length,1);assert.deepEqual(JSON.parse(s.store['lapan-sun-region']),{lat:6,lon:116});
assert.ok(!/\d\.\d/.test(s.store['lapan-sun-region']),'no exact coordinates are stored');
// A saved region is used on the next visit before any position is known.
s=setup({at:dawn,region:{lat:6,lon:116}});assert.deepEqual(s.t.place(),{lat:6,lon:116});
console.log('PASS: auto follows the sun, explicit choices win, once-a-minute check refreshes only on change, location changes the answer, only a coarse region is stored');
