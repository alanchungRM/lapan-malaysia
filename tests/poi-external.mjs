import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchRegionalPlaces} from '../worker/poi-search.js';
import {gzipSync} from 'node:zlib';
const pack=value=>gzipSync(JSON.stringify(value)).toString('base64');
const metadata={release:'external-test',count:1,blockSize:256,bucketCount:256,indexGroupSize:32,externalBase:'https://poi-fixture.pages.dev/dataset'};
const bucket=word=>{let hash=0;for(const char of word)hash=(hash*31+char.codePointAt(0))&255;return hash};
const groups={};for(const word of ['harbour','cafe']){const id=bucket(word),group=Math.floor(id/32);groups['index/'+group+'.json']??={};groups['index/'+group+'.json'][id]=pack({[word]:[0]})}
groups['blocks/0.json']={0:pack([['Harbour Cafe',5.98,116.07,'Jalan Pantai','Kota Kinabalu','88000']])};
let calls=0,fail=false;const previous=globalThis.fetch;
try{
 globalThis.fetch=async (input,options)=>{assert.equal(options.redirect,'manual','Cloudflare Workers supports manual redirect handling');calls++;const url=new URL(input);assert.equal(url.search,'');assert.equal(url.hostname,'poi-fixture.pages.dev');if(fail)return new Response('',{status:fail==='redirect'?302:503,headers:fail==='redirect'?{Location:'https://other.example/data'}:{}});const key=url.pathname.split('/').slice(-2).join('/');return Response.json(groups[key])};
 const results=await searchRegionalPlaces('Harbour Cafe',metadata);assert.equal(results[0][1],5.98);
 const at=calls;await searchRegionalPlaces('Harbour Cafe',metadata);assert.equal(calls,at,'immutable shards and decoded rows are cached');
 fail=true;const fresh={...metadata,externalBase:'https://poi-fixture.pages.dev/new-dataset'};await assert.rejects(()=>searchRegionalPlaces('Harbour Cafe',fresh),/storage unavailable/);
 fail=false;assert.equal((await searchRegionalPlaces('Harbour Cafe',fresh))[0][1],5.98,'failed requests are retryable');
 fail='redirect';await assert.rejects(()=>searchRegionalPlaces('Harbour Cafe',{...metadata,externalBase:'https://poi-fixture.pages.dev/redirect'}),/storage unavailable/,'redirect responses are rejected');
}finally{globalThis.fetch=previous}
console.log('PASS: external POI search, immutable requests, cache, retry and redirect rejection');
