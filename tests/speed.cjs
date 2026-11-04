const assert=require('node:assert/strict'),{parseLimit,decode,buildProfile,limitAt,nextDrop,classify,STEP}=require('../web/speed.js');
const SCALE=100000;
const way=(limit,points)=>{const q=points.map(([x,y])=>[Math.round(x*SCALE),Math.round(y*SCALE)]);const row=[limit,q[0][0],q[0][1]];for(let i=1;i<q.length;i++)row.push(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]);return row};

assert.equal(parseLimit('90'),90);assert.equal(parseLimit('60 km/h'),60);assert.equal(parseLimit('50 mph'),80);
for(const bad of ['signals','none','90;60','5','200','','MY:urban',null,undefined])assert.equal(parseLimit(bad),null,String(bad));

// Route runs north along x=101 from y=3.000 to y=3.020 (about 2.2 km).
const route=[[101,3],[101,3.01],[101,3.02]];
const index=decode({scale:SCALE,ways:[
 way(90,[[101.00004,3],[101.00004,3.01]]),
 way(60,[[101.00004,3.01],[101.00004,3.02]]),
 way(30,[[100.999,3.005],[101.001,3.005]]),
 way(110,[[101.001,3],[101.001,3.02]])
]});
const profile=buildProfile(route,index);
assert.equal(profile.step,STEP);
assert.ok(profile.length>2200&&profile.length<2250,'route length '+profile.length);
assert.equal(limitAt(profile,100),90,'parallel mapped road gives the limit');
assert.equal(limitAt(profile,555),90,'perpendicular crossing road is ignored');
assert.equal(limitAt(profile,1500),60);
assert.notEqual(limitAt(profile,1000),110,'a road 100 m away is not matched');
assert.equal(limitAt(profile,-5),0);assert.equal(limitAt(null,10),0);assert.equal(limitAt(profile,99999),60,'past the end holds the last sample');

// Drops of at least 10 km/h within the horizon are reported once with distance.
const drop=nextDrop(profile,800);
assert.ok(drop&&drop.limit===60&&drop.from===90&&drop.distance>=300&&drop.distance<=340,JSON.stringify(drop));
assert.equal(nextDrop(profile,0),null,'drop beyond the 400 m horizon');
assert.equal(nextDrop(profile,1600),null,'no further drop');
assert.equal(nextDrop(profile,800,100),null,'horizon is respected');

// Short unmapped gaps between identical limits are filled, long gaps are not.
const gap=decode({scale:SCALE,ways:[way(70,[[101.00004,3],[101.00004,3.004]]),way(70,[[101.00004,3.0049],[101.00004,3.0099]]),way(70,[[101.00004,3.0145],[101.00004,3.02]])]});
const gapped=buildProfile(route,gap);
assert.equal(limitAt(gapped,495),70,'100 m gap inside one limit is filled');
assert.equal(limitAt(gapped,1350),0,'a 500 m unmapped stretch stays unknown');

// Opposite-direction travel still matches the same mapped road.
assert.equal(limitAt(buildProfile([...route].reverse(),index),100,),60,'reverse route starts on the 60 section');

// Over-limit states include a GPS-noise margin.
assert.equal(classify(92,90),'ok');assert.equal(classify(93,90),'over');assert.equal(classify(99,90),'over');assert.equal(classify(100,90),'fast');
assert.equal(classify(NaN,90),'unknown');assert.equal(classify(80,0),'unknown');assert.equal(classify(-1,90),'unknown');assert.equal(classify(0,90),'ok');
console.log('PASS: limit parsing, delta decoding, route profile snapping, crossing and distant-road rejection, gap filling, reverse travel, limit-drop lookahead and over-limit states');
