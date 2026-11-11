import '../web/road-restrictions.js';
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile('worker/routing.js','utf8'),{planLiveRoute}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));const point=(longitude,latitude)=>({longitude,latitude}),points=[point(101,3),point(101.005,3),point(101.01,3)],ins=(index,maneuver,offset,time,message)=>({pointIndex:index,point:points[index],maneuver,routeOffsetInMeters:offset,travelTimeInSeconds:time,message,street:'Jalan Test'}),fixture={sections:[{sectionType:'TRAFFIC',simpleCategory:'JAM',startPointIndex:0,endPointIndex:1,magnitudeOfDelay:2},{sectionType:'TRAFFIC',simpleCategory:'JAM',startPointIndex:1,endPointIndex:2,magnitudeOfDelay:3},{sectionType:'TRAFFIC',simpleCategory:'JAM',startPointIndex:-1,endPointIndex:100,magnitudeOfDelay:3}],summary:{travelTimeInSeconds:120,lengthInMeters:1000,trafficDelayInSeconds:20},legs:[{points}],guidance:{instructions:[ins(0,'DEPART',0,0,'Head onto Jalan Test'),ins(1,'TURN_RIGHT',500,60,'Turn right onto Jalan Test'),ins(2,'ARRIVE',1000,120,'You have arrived.')]}};const counted=[];globalThis.LapanTomTomUsage={record:async(_env,purpose)=>counted.push(purpose)};let calls=0;const original=globalThis.fetch;globalThis.fetch=async (u,options)=>{const avoidAreas = globalThis.LapanRoadRestrictions.avoidAreas();
  if (avoidAreas.rectangles.length) {
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { avoidAreas });
  } else {
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined, 'no empty POST body when no manual areas exist');
  }
  calls++;const url=new URL(u);assert.equal(url.searchParams.get('traffic'),'true');assert.equal(url.searchParams.get('departAt'),'now');assert.equal(url.searchParams.get('instructionsType'),'text');assert.equal(url.searchParams.has('supportingPoints'),false);return Response.json({routes:[fixture]})};
const request=(from=[101,3],alternatives=true)=>new Request('https://test/api/route',{method:'POST',headers:{Origin:'https://test'},body:JSON.stringify({from,to:[101.01,3],alternatives})}),env={TOMTOM_API_KEY:'test-private-key'};
assert.equal((await planLiveRoute(request(),{})).status,503);assert.equal((await planLiveRoute(request([999,3]),env)).status,400);assert.equal((await planLiveRoute(new Request('https://test/api/route',{method:'POST',headers:{Origin:'https://evil'},body:'{}'}),env)).status,403);const r=await planLiveRoute(request(),env),d=await r.json();assert.equal(r.status,200);assert.equal(d.routes[0].provider,'TomTom');assert.ok(!JSON.stringify(d).includes(env.TOMTOM_API_KEY));assert.equal(d.routes[0].legs[0].steps[1].instruction,'Turn right onto Jalan Test');assert.deepEqual(d.routes[0].legs[0].steps[0].geometry.coordinates,[[101,3],[101.005,3]]);assert.equal(d.routes[0].legs[0].steps.at(-1).maneuver.type,'arrive');assert.equal(d.routes[0].duration,120);assert.deepEqual(d.routes[0].trafficSections.map(s=>s.severity),['moderate','heavy']);assert.deepEqual(d.routes[0].trafficSections[0].geometry.coordinates,[[101,3],[101.005,3]]);await planLiveRoute(request(),env);assert.equal(calls,1,'short cache avoids duplicate provider request');assert.deepEqual(counted,['planning'],'only outgoing upstream calls counted, not invalid/disabled/cache requests');const repeat=new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:[101,3],to:[101.01,3],alternatives:true,purpose:'rerouting'})});await planLiveRoute(repeat,env);assert.equal(counted.length,1,'purpose does not defeat cache reuse');const reroute=new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:[101.006,3],to:[101.01,3],alternatives:false,purpose:'rerouting'})});await planLiveRoute(reroute,env);assert.equal(counted.at(-1),'rerouting');
globalThis.fetch=async()=>Response.json({routes:[{...fixture,sections:[{simpleCategory:'ROAD_CLOSURE'}]}]});let result=await planLiveRoute(request([101.001,3]),env);assert.equal(result.status,422);assert.equal((await result.json()).allowBasic,false);globalThis.fetch=async()=>Response.json({routes:[{...fixture,guidance:null}]});assert.equal((await planLiveRoute(request([101.002,3]),env)).status,422);let release;let sharedCalls=0;globalThis.fetch=async()=>{sharedCalls++;await new Promise(r=>release=r);return Response.json({routes:[fixture]})};const sharedA=planLiveRoute(request([101.004,3]),env),sharedB=planLiveRoute(request([101.004,3]),env);await new Promise(setImmediate);assert.equal(sharedCalls,1,'identical simultaneous route calls share upstream request');release();const shared=await Promise.all([sharedA,sharedB]);assert.ok(shared.every(r=>r.status===200));assert.deepEqual(await shared[0].json(),await shared[1].json(),'response bodies independently readable');
const avoidRequest=(avoidTolls,refresh=false)=>new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:[101,3],to:[101.01,3],alternatives:true,avoidTolls,refresh})});
const tolled={...fixture,sections:[{sectionType:'TOLL',startPointIndex:0,endPointIndex:2}]};
globalThis.fetch=async (url,options)=>{
 assert.equal(new URL(url).searchParams.get('avoid'),'tollRoads');
 assert.equal(options.method,'GET');
 assert.equal(options.body,undefined);
 return Response.json({routes:[tolled,fixture]});
};
result=await planLiveRoute(avoidRequest(true),env);
assert.equal(result.status,200);
assert.equal((await result.json()).routes.length,1,'reject a tolled alternative even when the provider returns it first');
assert.equal((await planLiveRoute(avoidRequest('yes'),env)).status,400);
globalThis.fetch=async()=>Response.json({routes:[tolled]});
result=await planLiveRoute(avoidRequest(true,true),env);
assert.equal(result.status,422);
assert.equal((await result.json()).allowBasic,false);
globalThis.fetch=async()=>new Response('rate limited',{status:429});result=await planLiveRoute(request([101.003,3]),env);assert.equal((await result.json()).allowBasic,true);globalThis.fetch=original;
console.log('PASS: live routing options, matching geometry/guidance, cache, input/origin checks, secret protection, closure and incomplete-guidance rejection, explicit fallback eligibility');
