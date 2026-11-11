const assert = require('node:assert/strict');
require('../web/road-restrictions.js');
const { request } = require('../web/routing.js');
const { prompt } = require('../web/directions.js');

const from = [101.450792, 2.9759];
const turnStart = [101.450784, 2.977353];
const turnEnd = [101.450899, 2.977354];
const via = [101.4509, 2.97715];
const to = [101.450904, 2.9754];
const line = coordinates => ({ type: 'LineString', coordinates });
const step = (type, coordinates, distance, modifier) => ({
  maneuver: { type, location: coordinates[0], modifier },
  geometry: line(coordinates), distance, duration: distance / 10,
});
const detour = {
  provider: 'TomTom', distance: 788,
  geometry: line([from, [101.45075, 2.97878], [101.45089, 2.97878], to]),
  legs: [{ steps: [] }],
};
const closer = {
  distance: 389.5, duration: 39.8,
  geometry: line([from, turnStart, turnEnd, via, to]),
  legs: [
    { steps: [step('depart', [from, turnStart], 161), step('continue', [turnStart, turnEnd, via], 35, 'uturn'), step('arrive', [via], 0)] },
    { steps: [step('depart', [via, to], 194), step('arrive', [to], 0)] },
  ],
};

(async () => {
  const nativeFetch = global.fetch;
  let calls = [];
  try {
    global.fetch = async url => {
      calls.push(String(url));
      return Response.json(String(url) === '/api/route'
        ? { code: 'Ok', source: 'TomTom', routes: [structuredClone(detour)] }
        : { code: 'Ok', routes: [structuredClone(closer)] });
    };
    const result = await request(from, to, true, undefined, false, 'planning', true);
    assert.equal(result.routes[0].provider, 'OSRM');
    assert.equal(result.routes[1].provider, 'TomTom');
    assert.match(calls[1], /101\.4509,2\.97715;.*continue_straight=true/);
    const steps = result.routes[0].legs[0].steps;
    assert.deepEqual(steps.map(s => s.maneuver.type), ['depart', 'turn', 'arrive']);
    assert.deepEqual(steps[1].maneuver.location, turnStart);
    assert.deepEqual(steps[1].geometry.coordinates, [turnStart, turnEnd, via, to]);
    assert.equal(prompt(steps[1], 150), 'In 150 metres, make a U-turn.');

    calls = [];
    assert.equal((await request(from, to, true, undefined, false, 'planning', true, 'car', true)).routes[0].provider, 'TomTom');
    assert.equal((await request(from, to, true, undefined, false, 'planning', true, 'motorcycle')).routes[0].provider, 'TomTom');
    assert.deepEqual(calls, ['/api/route', '/api/route']);
    console.log('PASS: nearer mapped U-turn, no artificial waypoint arrival, and paid routing retained for Avoid Tolls and motorcycles');
  } finally {
    global.fetch = nativeFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
