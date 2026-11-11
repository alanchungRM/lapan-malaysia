import assert from 'node:assert/strict';
import '../web/road-restrictions.js';
import {readFile} from 'node:fs/promises';

const restrictions=globalThis.LapanRoadRestrictions;
const south=[101.450868,2.9745],westTurn=[101.450868,2.974678];
const north=[101.450797,2.975061],eastTurn=[101.450799,2.974787];
const crossing=[south,north];
const left=[south,westTurn,[101.450454,2.974678],[101.446717,2.974665]];
const returning=[[101.446719,2.974771],[101.450452,2.974778],eastTurn,north];
assert.equal(restrictions.blocked(crossing),true,'sparse straight route crosses the physical divider');
assert.equal(restrictions.blocked(left),false,'left turn stays available');
assert.equal(restrictions.blocked(returning),false,'eastbound return and turn stay available');
assert.equal(restrictions.blocked([[101.4554673,2.9736695],[101.4554673,2.9756695]]),false,'nearby former restriction stays removed');
const entry=restrictions.list()[0];
entry.name='changed';
assert.notEqual(restrictions.list()[0].name,entry.name,'inventory is read-only');

const source=await readFile('worker/routing.js','utf8');
const {planLiveRoute}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const makeRoute=coords=>({summary:{travelTimeInSeconds:60,lengthInMeters:500},legs:[{points:coords.map(([longitude,latitude])=>({longitude,latitude}))}],guidance:{instructions:[0,coords.length-1].map((i,j)=>({point:{longitude:coords[i][0],latitude:coords[i][1]},pointIndex:i,routeOffsetInMeters:j*500,travelTimeInSeconds:j*60,maneuver:j?'ARRIVE':'DEPART'}))}});
const oldFetch=globalThis.fetch;
let raw=[makeRoute(crossing)];
globalThis.fetch=async(url,options)=>{
 assert.equal(options.method,'POST');
 assert.deepEqual(JSON.parse(options.body).avoidAreas,restrictions.avoidAreas());
 return Response.json({routes:raw});
};
const req=n=>new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:[south[0],south[1]-n*.00001],to:north,alternatives:true})});
try{
 let response=await planLiveRoute(req(0),{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,422);
 assert.equal((await response.json()).allowBasic,false,'provider cannot return a route across the divider');
 // Join the legal approaches via the west side of the intersection.
 const detour=[...left,[101.445,2.97468],[101.445,2.9748],...returning];
 raw=[makeRoute(crossing),makeRoute(detour)];
 response=await planLiveRoute(req(1),{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.routes.length,1);
 assert.deepEqual(result.routes[0].geometry.coordinates,detour);

 const methods=[];
 globalThis.fetch=async(url,options)=>{
  methods.push(options.method);
  assert.equal(new URL(url).searchParams.get('avoid'),'tollRoads');
  if(options.method==='POST')assert.deepEqual(JSON.parse(options.body).avoidAreas,restrictions.avoidAreas());
  return Response.json({routes:options.method==='GET'?[makeRoute(crossing)]:[makeRoute(detour)]});
 };
 const avoid=()=>new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:south,to:north,alternatives:true,avoidTolls:true})});
 response=await planLiveRoute(avoid(),{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).routes[0].geometry.coordinates,detour);
 assert.deepEqual(methods,['GET','POST'],'only a candidate blocked by the divider needs a second request');
}finally{globalThis.fetch=oldFetch}
console.log('PASS: blocked divider, legal turn lanes, provider avoidance and safe alternative selection');
