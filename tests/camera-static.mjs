import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(await readFile('dist/server/index.js','utf8')).toString('base64'));
const orig=globalThis.fetch,descriptor=Object.getOwnPropertyDescriptor(globalThis,'caches');
globalThis.fetch=()=>{throw Error('No upstream camera lookup allowed')};Object.defineProperty(globalThis,'caches',{configurable:true,get(){throw Error('Cache API not permitted')}});
try{
 let expected;for(const path of ['/speed-cameras.json','/api/cameras']){const r=await worker.fetch(new Request('https://test'+path),{});assert.equal(r.status,200);const d=await r.json();assert.equal(d.cameras.length,83);if(expected)assert.deepEqual(d,expected);expected=d;assert.ok(r.headers.get('Content-Security-Policy'))}
 assert.equal(await(await worker.fetch(new Request('https://test/api/cameras',{method:'HEAD'}),{})).text(),'');assert.equal((await worker.fetch(new Request('https://test/api/cameras',{method:'POST'}),{})).status,405);
 const html=await(await worker.fetch(new Request('https://test/'),{})).text();assert.match(html,/STAGING · v1\.0\.36/);assert.match(html,/Applied PRs: #15 · #16 · #17 · #18 · #19 · #20 · #23 · #24 · #26/);assert.match(html,/data-stop="prayer"/);assert.match(html,/id="speedMargin"/);
 assert.match(await readFile('web/cameras.js','utf8'),/fetch\('\/speed-cameras.json'\)/);
}finally{globalThis.fetch=orig;if(descriptor)Object.defineProperty(globalThis,'caches',descriptor);else delete globalThis.caches}
console.log('PASS: static cameras and legacy endpoint with forbidden cache/API, camera kinds/data parity, method handling and staging PR/version indicator');
