const assert=require('node:assert/strict'),{sunTimes,themeAt}=require('../web/sun.js');
const KL=[3.139,101.687],KUCHING=[1.553,110.359],KK=[5.98,116.073],MYT=480;
const minutes=(date)=>{const l=new Date(date.getTime()+MYT*60000);return l.getUTCHours()*60+l.getUTCMinutes()};
const hhmm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');

// Kuala Lumpur sits close to the equator: about 12 hours of daylight all year, sunrise near 07:00 and sunset near 19:10.
for(const iso of ['2026-01-15','2026-03-20','2026-06-21','2026-09-22','2026-11-02','2026-12-21']){
 const t=sunTimes(new Date(iso+'T12:00:00+08:00'),...KL),len=(t.sunset-t.sunrise)/60000;
 assert.ok(len>11*60+40&&len<12*60+30,iso+' day length '+len+' min');
 assert.ok(minutes(t.sunrise)>6*60+45&&minutes(t.sunrise)<7*60+30,iso+' sunrise '+hhmm(minutes(t.sunrise)));
 assert.ok(minutes(t.sunset)>18*60+45&&minutes(t.sunset)<19*60+30,iso+' sunset '+hhmm(minutes(t.sunset)));
}
// Solar noon follows longitude: 12:00 minus 4 minutes per degree east of 120 degrees east, within the equation of time (about 16 minutes).
const noonKL=minutes(sunTimes(new Date('2026-11-02T12:00:00+08:00'),...KL).noon);
assert.ok(Math.abs(noonKL-(12*60+(120-KL[1])*4))<20,'solar noon at KL '+hhmm(noonKL));
// One time zone covers the whole country, so Sabah sees the sun earlier on the clock than the Peninsula. About 4 minutes per degree.
const day=new Date('2026-11-02T12:00:00+08:00'),kl=sunTimes(day,...KL),ku=sunTimes(day,...KUCHING),kk=sunTimes(day,...KK);
const gap=(a,b)=>(a.sunrise-b.sunrise)/60000;
assert.ok(Math.abs(gap(kl,ku)-(KUCHING[1]-KL[1])*4)<6,'KL vs Kuching sunrise gap '+gap(kl,ku));
assert.ok(Math.abs(gap(kl,kk)-(KK[1]-KL[1])*4)<6,'KL vs Kota Kinabalu sunrise gap '+gap(kl,kk));

// Theme switches exactly at sunrise and sunset, and the night wraps around midnight.
const t=sunTimes(day,...KL),at=ms=>new Date(t.sunrise.getTime()+ms);
assert.equal(themeAt(at(-1000),...KL),'night');assert.equal(themeAt(at(0),...KL),'day');
assert.equal(themeAt(new Date(t.sunset.getTime()-1000),...KL),'day');assert.equal(themeAt(t.sunset,...KL),'night');
assert.equal(themeAt(new Date('2026-11-02T00:30:00+08:00'),...KL),'night');assert.equal(themeAt(new Date('2026-11-02T13:00:00+08:00'),...KL),'day');
assert.equal(themeAt(new Date('2026-11-02T23:59:00+08:00'),...KL),'night');
// The same clock time can be day in Sabah and night in the Peninsula.
const instant=new Date(Math.min(kl.sunrise,kk.sunrise)+60000);assert.notEqual(themeAt(instant,...KL),themeAt(instant,...KK),'sunrise differs by location');
// Extreme latitudes never crash and report the polar case.
assert.equal(themeAt(new Date('2026-06-21T12:00:00Z'),80,0,0),'day');assert.equal(themeAt(new Date('2026-12-21T12:00:00Z'),80,0,0),'night');
console.log('PASS: sunrise and sunset for KL all year, solar noon, east-west sunrise gap across Malaysia, exact switch moments, midnight wrap, location dependence, polar cases');
