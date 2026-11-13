const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
require('../web/road-restrictions.js');
const { prompt } = require('../web/directions.js');

const approach = [101.450784, 2.97730]; // Already past the old detection gate.
const west = [101.4507836, 2.9773533];
const east = [101.4508994, 2.9773543];
const farWest = [101.450775, 2.9788254];
const farEast = [101.4508959, 2.9788284];
const destination = [101.450904, 2.9754];
const coords = [approach, [101.450781, 2.9776], farWest, farEast, [101.450898, 2.9776], destination];
const point = ([longitude, latitude]) => ({ longitude, latitude });
const instruction = (pointIndex, maneuver, routeOffsetInMeters, travelTimeInSeconds) => ({
  pointIndex, point: point(coords[pointIndex]), maneuver, routeOffsetInMeters, travelTimeInSeconds,
});
const detour = {
  summary: { lengthInMeters: 570, travelTimeInSeconds: 80, trafficDelayInSeconds: 5 },
  legs: [{ points: coords.map(point) }],
  guidance: { instructions: [instruction(0, 'DEPART', 0, 0), instruction(2, 'MAKE_UTURN', 170, 20), instruction(5, 'ARRIVE', 570, 80)] },
  sections: [{ sectionType: 'TRAFFIC', simpleCategory: 'JAM', startPointIndex: 2, endPointIndex: 4, magnitudeOfDelay: 3 }],
};

(async () => {
  const source = await readFile('worker/routing.js', 'utf8');
  const { planLiveRoute } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const nativeFetch = global.fetch;
  let calls = 0;
  let fixture = detour;
  try {
    global.fetch = async url => {
      calls++;
      assert.equal(new URL(url).hostname, 'api.tomtom.com');
      return Response.json({ routes: [fixture] });
    };
    const plan = async (vehicle = 'car', avoidTolls = false, purpose = 'planning') => {
      const request = new Request('https://lapan.test/api/route', {
        method: 'POST',
        body: JSON.stringify({ from: approach, to: destination, alternatives: true, vehicle, avoidTolls, purpose, refresh: true }),
      });
      const response = await planLiveRoute(request, { TOMTOM_API_KEY: 'test' });
      assert.equal(response.status, 200);
      return (await response.json()).routes[0];
    };
    for (const [vehicle, avoidTolls, purpose] of [['car', false, 'planning'], ['car', true, 'planning'], ['car', false, 'rerouting']]) {
      const result = await plan(vehicle, avoidTolls, purpose);
      assert.equal(result.provider, 'TomTom');
      assert.equal(result.bayuCrossover, true);
      assert.deepEqual(result.geometry.coordinates, [approach, west, east, destination]);
      assert.ok(result.distance < detour.summary.lengthInMeters);
      assert.ok(result.duration < detour.summary.travelTimeInSeconds);
      assert.deepEqual(result.trafficSections, []);
      const steps = result.legs[0].steps;
      assert.deepEqual(steps.map(step => step.maneuver.type), ['depart', 'turn', 'arrive']);
      assert.deepEqual(steps[1].maneuver.location, west);
      assert.deepEqual(steps[1].geometry.coordinates, [west, east, destination]);
      assert.equal(prompt(steps[1], 150), 'In 150 metres, make a U-turn.');
      assert.equal(steps.reduce((sum, step) => sum + step.distance, 0), result.distance);
      assert.equal(steps.reduce((sum, step) => sum + step.duration, 0), result.duration);
    }
    assert.deepEqual((await plan('motorcycle')).geometry.coordinates, coords);
    fixture = structuredClone(detour);
    fixture.guidance.instructions[1].maneuver = 'TURN_RIGHT';
    assert.deepEqual((await plan()).geometry.coordinates, coords);
    fixture = structuredClone(detour);
    fixture.sections = [{ sectionType: 'TOLL', startPointIndex: 2, endPointIndex: 4 }];
    assert.deepEqual((await plan()).geometry.coordinates, coords);
    // A live sample from public road points looped east through local streets.
    const streetLoop = [[101.45075, 2.9773], [101.45075, 2.97734], [101.45089, 2.97735],
      [101.45189, 2.97735], [101.45189, 2.9775], [101.4519, 2.97779], [101.45189, 2.97813],
      [101.45139, 2.97813], [101.45111, 2.97815], [101.45089, 2.97814], [101.45089, 2.97735],
      [101.45087, 2.97616], [101.45086, 2.9754]];
    fixture = {
      summary: { lengthInMeters: 633, travelTimeInSeconds: 100 },
      legs: [{ points: streetLoop.map(point) }],
      guidance: { instructions: [
        [0, 'DEPART', 0, 0], [1, 'TURN_RIGHT', 4, 2], [3, 'TURN_LEFT', 131, 25],
        [6, 'TURN_LEFT', 219, 40], [9, 'TURN_LEFT', 330, 60], [12, 'ARRIVE_LEFT', 633, 100],
      ].map(([pointIndex, maneuver, routeOffsetInMeters, travelTimeInSeconds]) => ({
        pointIndex, point: point(streetLoop[pointIndex]), maneuver, routeOffsetInMeters, travelTimeInSeconds,
      })) },
    };
    const shortcut = await plan();
    assert.equal(shortcut.bayuCrossover, true);
    assert.deepEqual(shortcut.geometry.coordinates, [streetLoop[0], west, east, ...streetLoop.slice(-2)]);
    assert.equal(shortcut.legs[0].steps[1].maneuver.modifier, 'uturn');
    assert.equal(calls, 7);
    console.log('PASS: Bayu Impian crossover for car planning and rerouting, including Avoid Tolls, with scoped exclusions');
  } finally {
    global.fetch = nativeFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
