import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile('dist/server/index.js','utf8'),worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const r=await worker.fetch(new Request('https://test/hazards.json?rev=qa'),{});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/json/);const data=await r.json();assert.equal(data.bump.length,25121);assert.equal(data.license,'ODbL-1.0');
const sw=await(await worker.fetch(new Request('https://test/sw.js'),{})).text(),shell=JSON.parse(sw.match(/SHELL=(\[.*?\]),TIMEOUT/)[1]);assert.ok(!shell.includes('/hazards.json'),'hazard data is not eagerly precached');assert.ok(shell.includes('/hazards.js'));
const html=await(await worker.fetch(new Request('https://test/'),{TOMTOM_ROUTING_DISABLED:'true'})).text();assert.match(html,/OSRM ONLY · TomTom routing OFF/);assert.ok(!html.includes('Applied PRs:'));assert.match(html,/v1\.0\.38/);
assert.ok(source.length<67108864);console.log('PASS: bundled hazard endpoint, ODbL provenance, lazy data excluded from precache, OSRM-only staging indicator and worker size');
