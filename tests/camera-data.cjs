const assert=require('node:assert/strict'),fs=require('node:fs');
const d=JSON.parse(fs.readFileSync('web/speed-cameras.json','utf8'));
assert.equal(d.license,'ODbL-1.0');assert.match(d.source,/OpenStreetMap/);assert.match(String(d.dataThrough),/^\d{4}-\d{2}-\d{2}T/);
assert.ok(Array.isArray(d.cameras)&&d.cameras.length>=50,'Malaysia-only snapshot should retain at least 50 mapped cameras');
const ids=new Set();
for(const c of d.cameras){
 assert.ok(Number.isInteger(c.id)&&!ids.has(c.id),'unique integer id '+c.id);ids.add(c.id);
 assert.ok(Array.isArray(c.point)&&c.point.length===2&&c.point[0]>=99&&c.point[0]<=120&&c.point[1]>=.8&&c.point[1]<=7.6,'point inside the supported bounds '+c.id);
 assert.ok(['speed','redlight','average'].includes(c.kind),'known kind '+c.kind);
 assert.ok(c.maxspeed===null||(Number.isInteger(c.maxspeed)&&c.maxspeed>=10&&c.maxspeed<=130),'sane limit '+c.id);
 assert.ok(c.direction===null||(Number.isInteger(c.direction)&&c.direction>=0&&c.direction<360),'bearing or null '+c.id);
}
assert.ok(d.cameras.some(c=>c.kind==='speed')&&d.cameras.some(c=>c.kind==='redlight'));
console.log('PASS: camera data licence and freshness, unique ids, supported bounds, known kinds, sane limits and bearings, '+d.cameras.length+' cameras');
