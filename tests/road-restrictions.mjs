import assert from 'node:assert/strict';
import '../web/road-restrictions.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const live=globalThis.LapanRoadRestrictions,x=101.4554673,y=2.9746695;
assert.deepEqual(live.list(),[]);assert.deepEqual(live.avoidAreas(),{rectangles:[]});
assert.equal(live.blocked([[x,y-.001],[x,y+.001]]),false,'first removed obstacle is no longer blocked');
assert.equal(live.blocked([[101.4498,2.9748112],[101.452,2.9748112]]),false,'second removed obstacle is no longer blocked');
const source=await readFile('worker/routing.js','utf8'),{planLiveRoute}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const makeRoute=coords=>({summary:{travelTimeInSeconds:60,lengthInMeters:500},legs:[{points:coords.map(([longitude,latitude])=>({longitude,latitude}))}],guidance:{instructions:coords.map(([longitude,latitude],i)=>({point:{longitude,latitude},pointIndex:i,routeOffsetInMeters:i*500,travelTimeInSeconds:i*60,maneuver:i?'ARRIVE':'DEPART'}))}});
let raw=[makeRoute([[x,y-.001],[x,y+.001]])],expected=false;
const old=globalThis.fetch;globalThis.fetch=async(url,options)=>{assert.equal(options.method,expected?'POST':'GET');const body=options.body?JSON.parse(options.body):{};assert.equal('avoidAreas' in body,expected,'omit empty avoidAreas from provider request');return Response.json({routes:raw})};
const req=n=>new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:[x-.001-n*.00001,y-.001],to:[x-.001,y+.001],alternatives:true})});
let response=await planLiveRoute(req(0),{TOMTOM_API_KEY:'test'});assert.equal(response.status,200,'provider-approved route through removed obstacle is accepted');
// Synthetic future entry verifies that the mechanism remains available without a live restriction.
const code=(await readFile('web/road-restrictions.js','utf8')).replace('const areas=[]',`const areas=[{id:'test',name:'Test area',west:${x-.0002},south:${y-.0002},east:${x+.0002},north:${y+.0002}}]`),ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);globalThis.LapanRoadRestrictions=ctx.LapanRoadRestrictions;expected=true;
assert.equal(ctx.LapanRoadRestrictions.blocked([[x,y-.001],[x,y+.001]]),true,'future sparse crossing detection retained');const copy=ctx.LapanRoadRestrictions.list();copy[0].name='changed';assert.equal(ctx.LapanRoadRestrictions.list()[0].name,'Test area','read-only snapshot cannot mutate configuration');
response=await planLiveRoute(req(1),{TOMTOM_API_KEY:'test'});assert.equal(response.status,422);assert.equal((await response.json()).allowBasic,false,'future manual restriction cannot be silently bypassed');
globalThis.LapanRoadRestrictions=live;globalThis.fetch=old;console.log('PASS: both manual obstacles removed, empty provider avoidance omitted, read-only inventory and future restriction safeguards retained');
