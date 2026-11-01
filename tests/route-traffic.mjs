import '../web/road-restrictions.js';
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile('worker/routing.js','utf8'),{planLiveRoute}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));const point=(longitude,latitude)=>({longitude,latitude}),points=[point(101,3),point(101.005,3),point(101.01,3)],ins=(index,maneuver,offset,time,message)=>({pointIndex:index,point:points[index],maneuver,routeOffsetInMeters:offset,travelTimeInSeconds:time,message,street:'Jalan Test'}),fixture={summary:{travelTimeInSeconds:120,lengthInMeters:1000,trafficDelayInSeconds:20},legs:[{points}],guidance:{instructions:[ins(0,'DEPART',0,0,'Head onto Jalan Test'),ins(1,'TURN_RIGHT',500,60,'Turn right onto Jalan Test'),ins(2,'ARRIVE',1000,120,'You have arrived.')]}};
const request=(from)=>new Request('https://test/api/route',{method:'POST',headers:{Origin:'https://test'},body:JSON.stringify({from,to:[101.01,3],alternatives:false})}),env={TOMTOM_API_KEY:'test-private-key'},original=globalThis.fetch;
const section=(extra)=>({sectionType:'TRAFFIC',simpleCategory:'JAM',startPointIndex:0,endPointIndex:1,magnitudeOfDelay:2,delayInSeconds:90,effectiveSpeedInKmh:12,...extra});
let n=0;const plan=async sections=>{globalThis.fetch=async()=>Response.json({routes:[{...fixture,sections}]});const r=await planLiveRoute(request([101+(++n)*0.0001,3]),env);assert.equal(r.status,200);return (await r.json()).routes[0]};
// TomTom congestion is passed through, trimmed to what the traffic bar needs.
let route=await plan([section(),section({startPointIndex:1,endPointIndex:2,magnitudeOfDelay:4,delayInSeconds:30.4})]);
assert.deepEqual(route.trafficSections,[{startPointIndex:0,endPointIndex:1,magnitude:2,delay:90},{startPointIndex:1,endPointIndex:2,magnitude:3,delay:30}],'magnitude is capped at 3 and delay rounded');
assert.ok(!JSON.stringify(route.trafficSections).includes('effectiveSpeed'),'no extra provider fields');
// Roadworks, other section kinds and malformed sections are ignored, and a clean route has an empty list.
route=await plan([section({simpleCategory:'ROAD_WORK'}),{sectionType:'TOLL',startPointIndex:0,endPointIndex:1},section({startPointIndex:2,endPointIndex:1}),section({startPointIndex:0,endPointIndex:9}),section({magnitudeOfDelay:0}),section({magnitudeOfDelay:'2'}),section({startPointIndex:'0'}),section({delayInSeconds:-4,magnitudeOfDelay:1})]);
assert.deepEqual(route.trafficSections,[{startPointIndex:0,endPointIndex:1,magnitude:1,delay:0}]);
assert.deepEqual((await plan([])).trafficSections,[],'no congestion is an empty list, not missing');
route=await plan(Array.from({length:500},()=>section()));assert.equal(route.trafficSections.length,300,'bounded response size');
// A closed road still fails the whole route.
globalThis.fetch=async()=>Response.json({routes:[{...fixture,sections:[section({simpleCategory:'ROAD_CLOSURE'})]}]});assert.equal((await planLiveRoute(request([101.5,3]),env)).status,422);
globalThis.fetch=original;
console.log('PASS: traffic sections are passed through, capped, bounded and validated; roadworks and closures are not shown as traffic');
