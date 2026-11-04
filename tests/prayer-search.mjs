import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {prayerPlaceSearch}=await import('data:text/javascript;base64,'+Buffer.from(await readFile('worker/prayer-search.js','utf8')).toString('base64'));
const data=JSON.parse(await readFile('data/prayer-places-my.json','utf8')),req=q=>new Request('https://test/api/prayer-search',{method:'POST',body:JSON.stringify({query:q})});
const orig=globalThis.fetch;globalThis.fetch=()=>{throw Error('No paid/external lookup allowed')};
try{
 for(const q of ['Masjid Sultan Abdul Aziz Pulau Indah','masjid sultan abdul aziz','Sultan Abdul Aziz Mosque Pulau Indah','Masjid Sultan Abdul Aziz Pulau Ind']){const r=await prayerPlaceSearch(req(q),data),d=await r.json();assert.equal(r.status,200);assert.ok(d.items.some(p=>p[0].startsWith('Masjid Sultan Abdul Aziz Pulau Indah')&&p[1]===2.923981&&p[2]===101.30596),q)}
 assert.equal((await prayerPlaceSearch(req('unlisted-imaginary-prayer-place'),data)).status,200);assert.equal((await prayerPlaceSearch(req('a'),data)).status,400);assert.equal((await prayerPlaceSearch(new Request('https://test/api/prayer-search'),data)).status,405);
 assert.equal((await prayerPlaceSearch(new Request('https://test/api/prayer-search',{method:'POST',headers:{Origin:'https://elsewhere.test'},body:'{}'}),data)).status,403);
 const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(await readFile('dist/server/index.js','utf8')).toString('base64'));const r=await worker.fetch(req('Masjid Sultan Abdul Aziz Pulau Indah'),{});assert.equal(r.status,200);assert.ok((await r.json()).items.some(p=>p[1]===2.923981));
 const near=await(await worker.fetch(new Request('https://test/api/nearby?kind=prayer&lat=2.924&lon=101.306'),{})).json();assert.ok(near.items.some(p=>p.name==='Masjid Sultan Abdul Aziz Pulau Indah'),'Quick stops uses the same corrected record');
 const correction=JSON.parse(await readFile('data/prayer-place-overrides.json','utf8'))[0];assert.equal(correction.id,'node/6979400884');assert.match(correction.nameSource,/e-masjid.jais.gov.my/);assert.deepEqual(correction.expectedPoint,[2.923981,101.30596]);
}finally{globalThis.fetch=orig}
console.log('PASS: prayer search names/aliases/partial names, verified unchanged pin, shared Quick stops record, packaged endpoint and no external calls');
