const assert = require('node:assert/strict');
require('../web/road-restrictions.js');
const { request } = require('../web/routing.js');
const { compact, format, iconName, speech } = require('../web/directions.js');

const coords = offsets => offsets.map(([east, north]) => [101.42 + east / 111320, 2.98 + north / 111320]);
const step = (offsets, type, modifier, name = 'Lebuhraya Pulau Indah', ref = '181') => {
  const coordinates = coords(offsets);
  return {
    name, ref, geometry: { type: 'LineString', coordinates },
    maneuver: { type, modifier, location: coordinates[0] },
  };
};
const approach = step([[0, -150], [0, 0]], 'depart', 'straight');
const reversal = [[0, 0], [5, 6], [24, 6], [32, 1], [32, -120]];
const candidate = { ...step(reversal, 'fork', 'slight right'), instruction: 'Keep right' };
const through = step([[0, 0], [18, 30], [25, 130]], 'fork', 'slight right');
const right = step([[0, 0], [12, 8], [120, 8]], 'turn', 'right');
const distant = step([[0, 0], [4, 40], [30, 60], [65, 40], [65, -120]], 'fork', 'slight right');
const unrelated = step(reversal, 'turn', 'right', 'Jalan Lain', '3218');
const roundabout = step(reversal, 'roundabout', 'right');
const route = next => ({
  geometry: { type: 'LineString', coordinates: [...approach.geometry.coordinates, ...next.geometry.coordinates.slice(1)] },
  legs: [{ steps: [approach, next] }],
});

(async () => {
  const originalFetch = global.fetch;
  try {
    const routes = [candidate, through, right, distant, unrelated, roundabout].map(route);
    const from = [101.42, 2.978], to = [101.421, 2.977];
    global.fetch = async () => Response.json(structuredClone({ code: 'Ok', routes, source: 'TomTom' }));
    const result = await request(from, to, true, undefined, true, 'rerouting');
    const corrected = result.routes[0].legs[0].steps[1];
    assert.deepEqual(corrected.maneuver, { ...candidate.maneuver, type: 'turn', modifier: 'uturn' });
    assert.deepEqual(result.routes[0].geometry, routes[0].geometry);
    assert.deepEqual(corrected.geometry, candidate.geometry);
    assert.equal(compact(corrected).action, 'U-turn');
    assert.equal(iconName(corrected), 'uturn');
    assert.match(format(corrected), /^Make a U-turn/);
    assert.equal(speech(corrected), 'Make a U-turn, route 181');
    for (let i = 1; i < routes.length; i++) assert.deepEqual(result.routes[i].legs, routes[i].legs);

    global.fetch = async url => url === '/api/route'
      ? Response.json({ allowBasic: true }, { status: 503 })
      : Response.json({ code: 'Ok', routes: [routes[0]] });
    const fallback = await request(from, to, true, undefined, true, 'planning', true);
    assert.equal(fallback.routes[0].provider, 'OSRM');
    assert.equal(compact(fallback.routes[0].legs[0].steps[1]).action, 'U-turn');
    console.log('PASS: tight same-road reversal gets U-turn guidance while turns, forks and roundabouts retain theirs');
  } finally {
    global.fetch = originalFetch;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
