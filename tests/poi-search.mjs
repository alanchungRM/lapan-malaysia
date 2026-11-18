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
 response=await additionalPlaceSearch(req('Missing Example'),{},q=>searchRegionalPlaces(q,data));assert.equal(response.status,200);assert.equal((await response.json()).items.length,0);
 // The legacy secondary provider is called only after a local miss.
 globalThis.fetch=async()=>{providerCalls++;return Response.json({results:[]})};
 response=await additionalPlaceSearch(req('Another Missing Example'),{TOMTOM_API_KEY:'test-only',TOMTOM_SEARCH_ENABLED:'true'},async()=>[]);assert.equal(response.status,200);assert.equal(providerCalls,1);
 // A failed shard must not disable existing provider fallback.
 response=await additionalPlaceSearch(req('Broken shard example'),{TOMTOM_API_KEY:'test-only',TOMTOM_SEARCH_ENABLED:'true'},async()=>{throw Error('bad shard')});assert.equal(response.status,200);assert.equal(providerCalls,2);
 // Bound repeated free misses and prevent further downstream quota use.
 for(let i=0;i<30;i++)await additionalPlaceSearch(req('miss '+i,'rate-test'),{},async()=>[]);
 response=await additionalPlaceSearch(req('one more miss','rate-test'),{},async()=>[]);assert.equal(response.status,429);
 // Pause TomTom, then ensure free local hits still work.
 globalThis.fetch=async()=>new Response('provider unavailable',{status:429});
 await additionalPlaceSearch(req('Pause provider now','pause-test'),{TOMTOM_API_KEY:'test-only',TOMTOM_SEARCH_ENABLED:'true'},async()=>[]);
 response=await additionalPlaceSearch(req('Aeon Example','free-while-paused'),{},q=>searchRegionalPlaces(q,data));assert.equal(response.status,200);assert.equal((await response.json()).source,'Overture Maps');
}finally{globalThis.fetch=oldFetch}
console.log('PASS: regional index normalization, address matching, bounded input, cache, no-key lookup, provider fallback and free lookup during provider outage');

// Nationwide shards preserve address intersections and regional compatibility.
const nationalRows=[['Harbour Cafe',5.98,116.07,'Jalan Pantai','Kota Kinabalu','88000'],['Harbour Cafe',1.55,110.35,'Jalan Song','Kuching','93350']];
const nationalShards={};
const nationalBucket=word=>{let hash=0;for(const char of word)hash=(hash*31+char.codePointAt(0))&4095;return hash};
for(let id=0;id<nationalRows.length;id++)for(const word of new Set(words([nationalRows[id][0],...nationalRows[id].slice(3)].join(' ')))){
 const shard=nationalShards[nationalBucket(word)]??={};
 shard[word]=[...(shard[word]||[]),id];
}
const nationalData={release:'national-fixture',count:2,bucketCount:4096,blockSize:256,coverage:'Malaysia, including Sabah, Sarawak and Labuan',index:Object.fromEntries(Object.entries(nationalShards).map(([key,value])=>[key,pack(value)])),blocks:{0:pack(nationalRows)}};
assert.equal((await searchRegionalPlaces('Harbour Cafe Jalan Pantai',nationalData))[0][1],5.98);
assert.equal((await searchRegionalPlaces('Harbour Cafe Jalan Song',nationalData))[0][1],1.55);
assert.equal((await searchRegionalPlaces('Jalan',nationalData)).length,2);
assert.deepEqual(await searchRegionalPlaces('Harbour Cafe Jalan Missing',nationalData),[]);
const nationalResponse=await additionalPlaceSearch(req('Harbour Cafe Jalan Pantai','national-test'),{},query=>searchRegionalPlaces(query,nationalData),nationalData);
assert.equal((await nationalResponse.json()).coverage,nationalData.coverage);
console.log('PASS: nationwide hash shards, address intersections, Sabah/Sarawak matching and coverage metadata');
const packIds=ids=>{
 const bytes=[];let previous=0;
 for(const id of ids){let value=id-previous;previous=id;while(value>=128){bytes.push((value&127)|128);value>>=7}bytes.push(value)}
 return Buffer.from(bytes).toString('base64');
};
const compactShards=Object.fromEntries(Object.entries(nationalShards).map(([key,shard])=>[key,pack(Object.fromEntries(Object.entries(shard).map(([word,ids])=>[word,packIds(ids.map(id=>id+3))])))]));
const compactData={...nationalData,release:'compact-fixture',count:5,postingEncoding:'varint',index:compactShards,blocks:{0:pack([null,null,null,...nationalRows])}};
assert.equal((await searchRegionalPlaces('Harbour Cafe Jalan Song',compactData))[0][1],1.55,'compact ids reconstruct the later row');
assert.equal((await searchRegionalPlaces('Harbour Cafe Jalan Song',compactData))[0][1],1.55,'cached ids are decoded once');
assert.equal((await searchRegionalPlaces('Harbour Cafe Jalan Pantai',compactData))[0][1],5.98);
const farIds={...compactData,release:'multibyte-fixture',count:879000,index:{[nationalBucket('distant')]:pack({distant:packIds([127,128,16384,878678])})},blocks:{}};
const farBlocks={};for(const id of [127,128,16384,878678]){const block=Math.floor(id/256),rows=farBlocks[block]??=Array(256).fill(null);rows[id%256]=['Distant '+id,3+id/10000000,101]}farIds.blocks=Object.fromEntries(Object.entries(farBlocks).map(([key,rows])=>[key,pack(rows)]));
assert.equal((await searchRegionalPlaces('distant',farIds)).length,4,'multi-byte deltas preserve row ids and blocks');
console.log('PASS: compact postings preserve nonzero first ids, gaps, multi-byte ids, cached lookups and legacy plain indexes');

// Common individual words must still find a narrow multiword intersection.
const commonIds=[...Array.from({length:6000},(_,i)=>i),20000,21000];
const broadTerms={central:commonIds,city:[...Array.from({length:6000},(_,i)=>i+6000),20000,21000],mall:[...Array.from({length:6000},(_,i)=>i+12000),20000,21000]};
function broadFixture(terms,release,compact=false){
 const shards={};for(const [word,ids]of Object.entries(terms))(shards[bucket(word)]??={})[word]=compact?packIds(ids):ids;
 const blocks={};for(const [id,name,lat]of [[20000,'Central City Mall',3],[21000,'Central City Mall Annex',3.1]]){
  const block=Math.floor(id/256),rows=blocks[block]??=Array(256).fill(null);rows[id%256]=[name,lat,101,'Jalan Example','Example Town'];
 }
 return {release,count:22000,blockSize:256,...(compact?{postingEncoding:'varint'}:{}),index:Object.fromEntries(Object.entries(shards).map(([key,value])=>[key,pack(value)])),blocks:Object.fromEntries(Object.entries(blocks).map(([key,rows])=>[key,pack(rows)]))};
}
for(const compact of [false,true]){
 const fixture=broadFixture(broadTerms,'common-words-'+compact,compact);
 const found=await searchRegionalPlaces('Central City Mall',fixture);
 assert.equal(found.length,2,'all individual terms exceed 5000 but combined matches are narrow');
 assert.equal(found[0][0],'Central City Mall, Jalan Example, Example Town, Malaysia');
 assert.equal((await searchRegionalPlaces('mall city central',fixture)).length,2,'word order does not affect intersection');
 assert.deepEqual(await searchRegionalPlaces('central',{...fixture,blocks:new Proxy({},{get(){throw Error('Broad searches must not fetch records')}})}),[],'single common word stays bounded');
 const late=broadFixture({...broadTerms,city:commonIds,mall:[...Array.from({length:12000},(_,i)=>i+6000),20000,21000]},'late-narrowing-'+compact,compact);
 assert.equal((await searchRegionalPlaces('Central City Mall',late)).length,2,'a later word narrows an intermediate intersection over 5000');
 const broad=broadFixture({central:commonIds,city:commonIds},'broad-combination-'+compact,compact);
 assert.deepEqual(await searchRegionalPlaces('Central City',{...broad,blocks:new Proxy({},{get(){throw Error('Broad combinations must not fetch records')}})}),[],'combined matches over 5000 still fall back');
}
console.log('PASS: common-word intersections, late narrowing, nontruncated row ids, compact/plain indexes and broad-search record-fetch guards');
