import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'))}catch{console.log('SKIP: this Node.js has no built-in SQLite (needs 22.5 or newer), so the reports database test did not run');process.exit(0)}
const source=await readFile('worker/reports.js','utf8'),{communityReports}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
// A D1-shaped wrapper over real SQLite, using the real migration file.
function d1(){const db=new DatabaseSync(':memory:');for(const part of (readFileSync('drizzle/0002_community_reports.sql','utf8')).split('--> statement-breakpoint'))db.exec(part);
 const stmt=sql=>{const q=db.prepare(sql);let args=[];const o={bind(...a){args=a;return o},async all(){return {results:q.all(...args)}},async first(){return q.get(...args)??null},async run(){q.run(...args);return {success:true}}};return o};
 return {prepare:stmt,raw:db}}
import {readFileSync} from 'node:fs';
let db=d1(),env={DB:db},clock=1_800_000_000_000;const realNow=Date.now;Date.now=()=>clock;
const ORIGIN='https://test',ids=[];let ipN=0;
const post=(path,body,headers={})=>communityReports(new Request(ORIGIN+path,{method:'POST',headers:{origin:ORIGIN,'cf-connecting-ip':headers.ip||'198.51.100.'+(++ipN),...headers},body:typeof body==='string'?body:JSON.stringify(body)}),env);
const get=(q,e=env)=>communityReports(new Request(ORIGIN+'/api/reports'+q),e);
const KL={lat:3.139,lon:101.6869};

// Not configured: every endpoint says so plainly and nothing throws.
assert.equal((await get('?lat=3&lon=101',{})).status,503);assert.equal((await communityReports(new Request(ORIGIN+'/api/reports',{method:'POST',headers:{origin:ORIGIN},body:'{}'}),{})).status,503);

// Create and read back. The response carries no identifier of the reporter.
let r=await post('/api/reports',{kind:'crash',...KL});assert.equal(r.status,201);let j=await r.json();assert.match(j.id,/^[0-9a-f]{24}$/);assert.equal(j.merged,false);ids.push(j.id);
r=await get('?lat=3.14&lon=101.69&r=2000');j=await r.json();assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(j.reports.length,1);
assert.deepEqual(Object.keys(j.reports[0]).sort(),['ageSeconds','confirms','denies','id','kind','lat','lon']);assert.equal(j.reports[0].kind,'crash');assert.equal(j.reports[0].ageSeconds,0);
// Privacy: the table has no column that could hold who sent it, and the row holds only the report.
const cols=db.raw.prepare('PRAGMA table_info(community_reports)').all().map(c=>c.name);assert.deepEqual(cols,['id','kind','lat','lon','created_at','expires_at','confirms','denies']);
assert.ok(!JSON.stringify(db.raw.prepare('SELECT * FROM community_reports').all()).match(/198\.51\.100/),'no network address stored');
// Coordinates are rounded to about a metre.
await post('/api/reports',{kind:'object',lat:3.1234567891,lon:101.7000000001});assert.equal(db.raw.prepare("SELECT lat FROM community_reports WHERE kind='object'").get().lat,3.12346);

// Same kind within 150 m is a confirmation, not a second pin. Another kind or a farther place is new.
r=await post('/api/reports',{kind:'crash',lat:KL.lat+0.0008,lon:KL.lon});j=await r.json();assert.equal(r.status,200);assert.equal(j.merged,true);assert.equal(j.id,ids[0]);
assert.equal((await post('/api/reports',{kind:'stopped',lat:KL.lat+0.0008,lon:KL.lon})).status,201);assert.equal((await post('/api/reports',{kind:'crash',lat:KL.lat+0.003,lon:KL.lon})).status,201);
assert.equal(db.raw.prepare('SELECT confirms FROM community_reports WHERE id=?').get(ids[0]).confirms,1);

// Search window: near returns it, far does not, and the radius is bounded.
assert.equal((await (await get('?lat=3.139&lon=101.6869&r=500')).json()).reports.length>=2,true);assert.equal((await (await get('?lat=5.4&lon=100.3&r=3000')).json()).reports.length,0);
assert.equal((await get('?lat=40&lon=101')).status,400);assert.equal((await get('?lat=abc&lon=101')).status,400);assert.equal((await get('')).status,400);
assert.equal((await (await get('?lat=3.139&lon=101.6869&r=999999999')).json()).reports.length>=3,true,'huge radius is capped, not rejected');

// The radius is capped at 20 km: a report 15 km away is found with a huge radius, one 33 km away is not.
{const t=Math.floor(clock/1000),ins=db.raw.prepare("INSERT INTO community_reports (id,kind,lat,lon,created_at,expires_at) VALUES (?,?,?,?,?,?)");ins.run('a'.repeat(24),'flood',5.135,100.5,t,t+3600);ins.run('b'.repeat(24),'flood',5.3,100.5,t,t+3600);
 const far=(await (await get('?lat=5&lon=100.5&r=999999999')).json()).reports.map(r=>r.id);assert.ok(far.includes('a'.repeat(24)),'15 km is inside the cap');assert.ok(!far.includes('b'.repeat(24)),'33 km is outside it');db.raw.exec("DELETE FROM community_reports WHERE id IN ('"+'a'.repeat(24)+"','"+'b'.repeat(24)+"')");}
// Validation. Free text and extra fields are refused, so nothing personal or abusive can be stored.
for(const bad of [{kind:'police',...KL},{kind:'crash',lat:40,lon:101},{kind:'crash',lat:3,lon:'x'},{kind:'crash',...KL,note:'hello'},{kind:'crash',lat:3},[],'null','{bad',{kind:'__proto__',...KL},{kind:'toString',...KL}]){const x=await post('/api/reports',bad);assert.equal(x.status,400,JSON.stringify(bad))}
assert.equal((await post('/api/reports',{kind:'crash',...KL},{origin:'https://evil.example'})).status,403);
assert.equal((await communityReports(new Request(ORIGIN+'/api/reports',{method:'POST',body:'{}'}),env)).status,403,'no origin header');
assert.equal((await post('/api/reports',{kind:'crash',...KL},{'content-length':'9999'})).status,413);
assert.equal((await communityReports(new Request(ORIGIN+'/api/reports',{method:'DELETE',headers:{origin:ORIGIN}}),env)).status,405);

// Expiry: each kind lasts its own time, and nothing is shown after it.
const row=k=>db.raw.prepare('SELECT * FROM community_reports WHERE kind=? ORDER BY created_at LIMIT 1').get(k);
assert.equal(row('crash').expires_at-row('crash').created_at,7200);assert.equal(row('stopped').expires_at-row('stopped').created_at,3600);
clock+=7201_000;assert.equal((await (await get('?lat=3.139&lon=101.6869&r=2000')).json()).reports.length,0,'all two-hour reports are gone');

// Votes. "Still there" extends within a cap; two "not there" votes from different people end it.
clock=1_800_100_000_000;j=await (await post('/api/reports',{kind:'object',lat:2.9,lon:101.6})).json();const oid=j.id;
const vote=(id,still)=>post('/api/reports/vote',{id,still});
clock+=3000_000;assert.equal((await vote(oid,true)).status,200);const afterYes=db.raw.prepare('SELECT * FROM community_reports WHERE id=?').get(oid);assert.ok(afterYes.expires_at>afterYes.created_at+3600,'extended');
for(let i=0;i<3;i++){clock+=1000_000;await vote(oid,true)}assert.ok(db.raw.prepare('SELECT expires_at,created_at FROM community_reports WHERE id=?').get(oid).expires_at<=db.raw.prepare('SELECT created_at FROM community_reports WHERE id=?').get(oid).created_at+7200,'never beyond twice the lifetime');
const open=(await (await get('?lat=2.9&lon=101.6&r=500')).json()).reports;assert.equal(open[0].confirms,4);
j=await (await post('/api/reports',{kind:'flood',lat:2.95,lon:101.62})).json();await vote(j.id,false);assert.equal((await (await get('?lat=2.95&lon=101.62&r=300')).json()).reports.length,1,'one "not there" is not enough');
await vote(j.id,false);assert.equal((await (await get('?lat=2.95&lon=101.62&r=300')).json()).reports.length,0,'two denials beat zero confirmations');
j=await (await post('/api/reports',{kind:'pothole',lat:2.97,lon:101.63})).json();await vote(j.id,true);await vote(j.id,true);await vote(j.id,false);await vote(j.id,false);assert.equal((await (await get('?lat=2.97&lon=101.63&r=300')).json()).reports.length,1,'confirmations outweigh denials');
{const t=Math.floor(clock/1000);db.raw.prepare("INSERT INTO community_reports (id,kind,lat,lon,created_at,expires_at,confirms) VALUES (?,?,?,?,?,?,?)").run('c'.repeat(24),'flood',2.8,101.5,t,t+3600,50);await vote('c'.repeat(24),true);assert.equal(db.raw.prepare('SELECT confirms FROM community_reports WHERE id=?').get('c'.repeat(24)).confirms,50,'counts stop at 50');db.raw.exec("DELETE FROM community_reports WHERE id='"+'c'.repeat(24)+"'")}
for(const bad of [{id:'zz',still:true},{id:oid},{id:oid,still:'yes'},{id:oid,still:true,x:1},{id:'../etc/passwd',still:true},{id:oid.toUpperCase(),still:true}])assert.equal((await post('/api/reports/vote',bad)).status,400,JSON.stringify(bad));
assert.equal((await vote('0'.repeat(24),true)).status,410,'unknown report');
clock+=999_999_000;assert.equal((await vote(oid,true)).status,410,'expired report cannot be revived');

// Abuse limits: six writes a minute from one address, fresh again after the minute.
const spam=await Promise.all(Array.from({length:8},(_,i)=>post('/api/reports',{kind:'stopped',lat:4+i*0.1,lon:100.5},{ip:'203.0.113.7'})));assert.deepEqual(spam.map(x=>x.status).filter(s=>s===429).length,2);
assert.equal((await post('/api/reports',{kind:'stopped',lat:6,lon:100.5},{ip:'203.0.113.7'})).status,429);clock+=61_000;assert.equal((await post('/api/reports',{kind:'stopped',lat:6,lon:100.5},{ip:'203.0.113.7'})).status,201);
// Global cap.
const ins=db.raw.prepare("INSERT INTO community_reports (id,kind,lat,lon,created_at,expires_at) VALUES (?,?,?,?,?,?)"),t=Math.floor(clock/1000);
db.raw.exec('DELETE FROM community_reports');db.raw.exec('BEGIN');for(let i=0;i<20000;i++)ins.run(i.toString(16).padStart(24,'0'),'crash',1+(i%50)*0.01,100+Math.floor(i/50)*0.01,t,t+3600);db.raw.exec('COMMIT');
assert.equal((await post('/api/reports',{kind:'crash',lat:7,lon:117})).status,503,'busy cap');
// A database failure is reported as unavailable, never as a crash or a stack trace.
const broken={DB:{prepare(){throw Error('d1 down: secret detail')}}};const failed=await communityReports(new Request(ORIGIN+'/api/reports?lat=3&lon=101'),broken);assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('secret'));
Date.now=realNow;
console.log('PASS: anonymous reports (create, merge, read, expire per kind), votes, validation, origin and size limits, rate limit, global cap, privacy of stored columns and database failure');
