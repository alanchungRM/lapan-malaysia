import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(await readFile('drizzle/0006_routing_settings.sql','utf8'));
db.exec("INSERT INTO routing_settings VALUES (1,'HERE',7,'2026-11-12')");
db.exec(await readFile('drizzle/0010_valhalla_routing_settings.sql','utf8'));
assert.deepEqual({...db.prepare('SELECT * FROM routing_settings').get()},
  {id:1,provider:'HERE',revision:7,updated_at:'2026-11-12'});
db.exec("UPDATE routing_settings SET provider='Valhalla'");
assert.throws(() => db.exec("UPDATE routing_settings SET provider='Invalid'"));

const {default:worker} = await import('../dist/server/index.js');
const env = {LAPAN_ENVIRONMENT:'staging',DB:{prepare: sql => ({
  first:async () => sql.includes('routing_settings') ? {provider:'Valhalla',revision:8} : null,
})}};
const coordinates = [[101.5,3],[101.502,3.002],[101.503,3.004]];
function shape(points) {
  let encoded = '', last = [0,0];
  for (const [lon,lat] of points) {
    const next = [Math.round(lat*1e6),Math.round(lon*1e6)];
    for (let i=0;i<2;i++) {
      const delta = next[i]-last[i];
      let value = delta<0 ? -delta*2-1 : delta*2;
      while (value >= 32) {
        encoded += String.fromCharCode((value%32)+95);
        value = Math.floor(value/32);
      }
      encoded += String.fromCharCode(value+63);
    }
    last = next;
  }
  return encoded;
}
const trip = (vehicle,hasToll) => ({
  status:0,units:'kilometers',summary:{time:60,length:0.6,has_toll:hasToll,has_ferry:false},
  legs:[{shape:shape(coordinates),maneuvers:[
    {type:1,begin_shape_index:0,end_shape_index:1,length:0.3,time:30,travel_mode:'drive',travel_type:vehicle,toll:hasToll},
    {type:20,begin_shape_index:1,end_shape_index:2,length:0.3,time:30,travel_mode:'drive',travel_type:vehicle,
      sign:{exit_number_elements:[{text:'103B'}]}},
    {type:4,begin_shape_index:2,end_shape_index:2,length:0,time:0,travel_mode:'drive',travel_type:vehicle},
  ]}],
});
const request = (path, body, vars=env) => worker.fetch(new Request('https://test.example'+path,body ? {
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
} : undefined),vars);
const inputs = {from:coordinates[0],to:coordinates[2],alternatives:true};
const originalFetch = globalThis.fetch;
let calls = 0;
let mode = 'alternates';
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(url,'https://valhalla1.openstreetmap.de/route');
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'manual','Cloudflare-compatible without automatic redirects');
  assert.equal(options.headers['X-Client-Id'],'lapan-malaysia-staging.alanchungcl.chatgpt.site');
  const {costing,costing_options} = JSON.parse(options.body);
  if (mode==='redirect') return Response.redirect('https://other.example/route',307);
  if (costing==='motorcycle') assert.equal(costing_options.motorcycle.use_tolls,0);
  const vehicle = costing==='auto' ? 'car' : costing;
  return Response.json({
    trip:trip(vehicle,true),
    ...(mode==='alternates' ? {alternates:[{trip:trip(vehicle,false)}]} : {}),
  });
};
try {
  const config = await request('/api/routing-config');
  assert.equal((await config.json()).provider,'Valhalla');
  const production = await request('/api/routing-config',undefined,{...env,LAPAN_ENVIRONMENT:'production'});
  assert.equal((await production.json()).provider,'Valhalla');
  const automatic = await request('/api/route', {...inputs,refresh:true}, {LAPAN_ENVIRONMENT:'staging'});
  assert.equal(automatic.status,200);
  assert.equal((await automatic.json()).source,'Valhalla','TomTom unavailability falls back to Valhalla');
  calls=0;
  const normal = await request('/api/route',{...inputs,refresh:true});
  assert.equal(normal.status,200);
  const data = await normal.json();
  assert.equal(data.source,'Valhalla');
  assert.equal(data.routes.length,2);
  assert.deepEqual(data.routes[0].geometry.coordinates,coordinates);
  assert.equal(data.routes[0].legs[0].steps[1].exits,'103B');
  assert.equal(data.routes[0].trafficCheckedAt,null);
  assert.equal(data.routes[0].tollEstimate.amount,null);
  assert.equal((await request('/api/route',inputs)).status,200);
  assert.equal(calls,1,'a repeated plan reuses its response');

  const avoid = await request('/api/route',{...inputs,vehicle:'motorcycle',avoidTolls:true});
  assert.equal(avoid.status,200);
  const allowed = (await avoid.json()).routes;
  assert.equal(allowed.length,1);
  assert.equal(allowed[0].vehicle,'motorcycle');
  mode = 'toll-only';
  const denied = await request('/api/route',{...inputs,vehicle:'motorcycle',avoidTolls:true,refresh:true});
  assert.equal(denied.status,422);
  assert.equal((await denied.json()).allowBasic,false);
  assert.equal((await request('/api/traffic-eta',{})).status,503);
  assert.equal(calls,3,'Valhalla never requests a live traffic refresh');
  mode = 'alternates';
  const carAvoid = await request('/api/route',{...inputs,avoidTolls:true});
  assert.equal(carAvoid.status,200);
  assert.equal((await carAvoid.json()).routes.length,1);
  mode = 'redirect';
  const redirected = await request('/api/route',{...inputs,avoidTolls:true,refresh:true});
  assert.equal(redirected.status,502);
  assert.equal((await redirected.json()).allowBasic,false);
  assert.equal(calls,5,'Valhalla redirects are never followed');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('PASS: Valhalla staging dispatch, migration, geometry, navigation, cache, motorcycle, toll avoidance and no live traffic');
