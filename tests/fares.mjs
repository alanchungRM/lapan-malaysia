import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile('dist/server/index.js','utf8'),{default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));const original=globalThis.fetch;globalThis.fetch=async u=>{assert.match(u,/GetTollFare\/SBI\/AKH\/1$/);return new Response('12.87')};
let r=await worker.fetch(new Request('https://test/api/plus-fare?from=SBI&to=AKH'));assert.equal(r.status,200);assert.equal((await r.json()).amount,12.87);
r=await worker.fetch(new Request('https://test/api/plus-fare?from=INVALID&to=AKH'));assert.equal(r.status,400);
r=await worker.fetch(new Request('https://test/api/plus-fare?from=SBI&to=SBI'));assert.equal(r.status,400);
globalThis.fetch=async()=>{throw Error('offline')};r=await worker.fetch(new Request('https://test/api/plus-fare?from=SHA&to=AKH'));assert.equal(r.status,502);
r=await worker.fetch(new Request('https://test/'));assert.match(await r.text(),/PLUS toll estimate/);globalThis.fetch=original;
const context={document:{},Math};context.window=context;vm.createContext(context);vm.runInContext(await readFile('web/toll.js','utf8'),context);context.PLUS_POINTS=context.window.PLUS_POINTS;const points=context.PLUS_POINTS;const start=points.find(p=>p.code==='SBI').coords,end=points.find(p=>p.code==='AKH').coords;const matches=vm.runInContext('roadPlazas',context)({geometry:{coordinates:[start,end]}});assert.equal(matches[0].code,'SBI');assert.equal(matches.at(-1).code,'AKH');
console.log('PASS: validated fare amount, invalid plazas, identical plazas, upstream failure, app response, route plaza order');
