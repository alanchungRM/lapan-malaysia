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
// East access: the reported TomTom route crosses the median to turn right.
const eastAccess=[101.45543,2.9756];
const invalidRight=[eastAccess,[101.45545,2.97482],[101.45545,2.97478],[101.45546,2.97467],[101.455,2.97467]];
const mappedLeft=[eastAccess,[101.4554089,2.9749662],[101.4554311,2.9749039],[101.4555095,2.9748229],[101.455576,2.974786],[101.4571331,2.9747818]];
const mappedEntry=[[101.4552831,2.9747897],[101.4553657,2.9748649],[101.4554089,2.9749662],eastAccess];
assert.equal(restrictions.blocked(invalidRight),true,'reject the reported right turn across the east access median');
assert.equal(restrictions.blocked(mappedLeft),false,'keep the mapped left exit available');
assert.equal(restrictions.blocked(mappedEntry),false,'keep the mapped entrance available');
assert.equal(restrictions.blocked([[101.4551,2.9746667],[101.4557,2.9746667]]),false,'keep through traffic on the opposite carriageway available');
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

 const otherDetour=[...left,[101.444,2.97468],[101.444,2.9748],...returning];
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  const params=new URL(url).searchParams;
  requests.push([options.method,params.get('maxAlternatives')]);
  assert.equal(params.get('routeType'),'fastest');
  assert.equal(params.get('traffic'),'true');
  if(options.method==='POST'){
   assert.deepEqual(JSON.parse(options.body).avoidAreas,restrictions.avoidAreas());
   return Response.json({routes:[makeRoute(detour)]});
  }
  return Response.json({routes:[
   makeRoute(detour),
   makeRoute(crossing),
   {...makeRoute(otherDetour),sections:[{simpleCategory:'ROAD_CLOSURE'}]},
   makeRoute(otherDetour),
  ]});
 };
 response=await planLiveRoute(req(2),{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,200);
 assert.deepEqual(requests,[['POST','2'],['GET','5']]);
 assert.deepEqual((await response.json()).routes.map(route=>route.geometry.coordinates),[detour,otherDetour],
  'keep the original route and add only distinct alternatives that pass the original divider and closure checks');
 globalThis.fetch=async(_url,options)=>{
  if(options.method==='GET')throw Error('extra search failed');
  return Response.json({routes:[makeRoute(detour)]});
 };
 response=await planLiveRoute(req(3),{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,200,'keep the primary route when the extra search fails');
 assert.equal((await response.json()).routes.length,1);
 const afterLimit=[];
 globalThis.fetch=async(_url,options)=>{
  afterLimit.push(options.method);
  if(options.method==='GET')return new Response('',{status:429,headers:{'Retry-After':'60'}});
  return Response.json({routes:[makeRoute(detour)]});
 };
 response=await planLiveRoute(req(4),{TOMTOM_API_KEY:'test'});
 assert.equal((await response.json()).source,'TomTom');
 response=await planLiveRoute(req(5),{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,200,'an optional request limit cannot block a new primary TomTom request');
 assert.equal((await response.json()).source,'TomTom');
 assert.deepEqual(afterLimit,['POST','GET','POST'],'only the optional search goes into cooldown');
 for(const rejectPrimary of [false,true]){
  const recoveryCalls=[];
  globalThis.fetch=async(_url,options)=>{
   recoveryCalls.push(options.method);
   if(options.method==='POST')return rejectPrimary?new Response('',{status:422}):
    Response.json({routes:[makeRoute(crossing)]});
   return Response.json({routes:[makeRoute(crossing),makeRoute(detour)]});
  };
  response=await planLiveRoute(req(rejectPrimary?7:6),{TOMTOM_API_KEY:'test'});
  assert.equal(response.status,200,'recover a legal TomTom route before falling back');
  const recovered=await response.json();
  assert.equal(recovered.source,'TomTom');
  assert.ok(Number.isFinite(Date.parse(recovered.checkedAt)));
  assert.deepEqual(recovered.routes.map(route=>route.geometry.coordinates),[detour]);
  assert.deepEqual(recoveryCalls,['POST','GET']);
 }
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
 globalThis.fetch=async()=>Response.json({routes:[makeRoute(invalidRight),makeRoute(mappedLeft)]});
 const eastRequest=new Request('https://test/api/route',{method:'POST',body:JSON.stringify({from:eastAccess,to:mappedLeft.at(-1),alternatives:true})});
 response=await planLiveRoute(eastRequest,{TOMTOM_API_KEY:'test'});
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).routes.map(route=>route.geometry.coordinates),[mappedLeft]);
}finally{globalThis.fetch=oldFetch}
console.log('PASS: blocked divider, legal turn lanes, provider avoidance and safe alternative selection');
