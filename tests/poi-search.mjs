import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {searchRegionalPlaces} from '../worker/poi-search.js';
import {additionalPlaceSearch} from '../worker/place-search.js';
const pack=x=>gzipSync(JSON.stringify(x)).toString('base64');
const words=s=>s.toLowerCase().replace(/æ/g,'ae').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}]+/gu)||[];
const bucket=w=>{let h=0;for(const c of w)h=(h*31+c.codePointAt(0))&255;return h};
const rows=[['Café Example',3,101.5,'12 Jalan Satu','Shah Alam','40460'],['Æon Example',3.1,101.6,'Jalan Dua','Klang','41000']];
const shards={};for(let id=0;id<rows.length;id++)for(const word of new Set(words([rows[id][0],...rows[id].slice(3)].join(' '))))(shards[bucket(word)]??={})[word]=[...(shards[bucket(word)]?.[word]||[]),id];
const data={release:'fixture',count:2,blockSize:256,index:Object.fromEntries(Object.entries(shards).map(([k,v])=>[k,pack(v)])),blocks:{0:pack(rows)}};
assert.equal((await searchRegionalPlaces('CAFE Example Shah Alam',data))[0][0],'Café Example, 12 Jalan Satu, Shah Alam, 40460, Malaysia');
assert.equal((await searchRegionalPlaces('ÆON | Example',data))[0][1],3.1);
assert.deepEqual(await searchRegionalPlaces('no such business',data),[]);
assert.deepEqual(await searchRegionalPlaces('x'.repeat(181),data),[]);
assert.deepEqual(await searchRegionalPlaces('  ',data),[]);
const req=(q,ip='fixture')=>new Request('https://lapan.test/api/place-search',{method:'POST',headers:{Origin:'https://lapan.test','Content-Type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({query:q})});
let regionalCalls=0,providerCalls=0;const oldFetch=globalThis.fetch;
try{
 globalThis.fetch=async()=>{providerCalls++;throw Error('No paid provider expected')};
 let response=await additionalPlaceSearch(req('Cafe Example'),{},q=>{regionalCalls++;return searchRegionalPlaces(q,data)});
 assert.equal(response.status,200);assert.equal((await response.json()).source,'Overture Maps');assert.equal(providerCalls,0);
 await additionalPlaceSearch(req('cafe example'),{},()=>{throw Error('cached')});assert.equal(regionalCalls,1);
 response=await additionalPlaceSearch(req('Missing Example'),{},q=>searchRegionalPlaces(q,data));assert.equal(response.status,503);
 // The legacy secondary provider is called only after a local miss.
 globalThis.fetch=async()=>{providerCalls++;return Response.json({results:[]})};
 response=await additionalPlaceSearch(req('Another Missing Example'),{TOMTOM_API_KEY:'test-only'},async()=>[]);assert.equal(response.status,200);assert.equal(providerCalls,1);
 // A failed shard must not disable existing provider fallback.
 response=await additionalPlaceSearch(req('Broken shard example'),{TOMTOM_API_KEY:'test-only'},async()=>{throw Error('bad shard')});assert.equal(response.status,200);assert.equal(providerCalls,2);
 // Bound repeated free misses and prevent further downstream quota use.
 for(let i=0;i<30;i++)await additionalPlaceSearch(req('miss '+i,'rate-test'),{},async()=>[]);
 response=await additionalPlaceSearch(req('one more miss','rate-test'),{},async()=>[]);assert.equal(response.status,429);
 // Pause TomTom, then ensure free local hits still work.
 globalThis.fetch=async()=>new Response('provider unavailable',{status:429});
 await additionalPlaceSearch(req('Pause provider now','pause-test'),{TOMTOM_API_KEY:'test-only'},async()=>[]);
 response=await additionalPlaceSearch(req('Aeon Example','free-while-paused'),{},q=>searchRegionalPlaces(q,data));assert.equal(response.status,200);assert.equal((await response.json()).source,'Overture Maps');
}finally{globalThis.fetch=oldFetch}
console.log('PASS: regional index normalization, address matching, bounded input, cache, no-key lookup, provider fallback and free lookup during provider outage');
