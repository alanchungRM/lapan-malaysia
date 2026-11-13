// Staging uses the FOSSGIS demo for limited evaluation. A dedicated HTTPS
// service can be configured without changing the routing adapter.
const valhallaDemo = 'https://valhalla1.openstreetmap.de';
const valhallaCache = new Map();
const valhallaPending = new Map();
let valhallaPauseUntil = 0;

function valhallaEndpoint(env) {
  try {
    const url = new URL(env.VALHALLA_URL || valhallaDemo);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/$/, '') + '/route';
    return url;
  } catch {
    return null;
  }
}

function decodeValhallaShape(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 1000000) throw Error('Invalid route shape');
  let index = 0, lat = 0, lon = 0;
  const points = [];
  function delta() {
    let result = 0;
    for (let shift = 0; shift <= 25; shift += 5) {
      const value = encoded.charCodeAt(index++) - 63;
      if (!Number.isInteger(value) || value < 0 || value > 63) break;
      result += (value & 31) * 2 ** shift;
      if (value < 32) return result % 2 ? -(result + 1) / 2 : result / 2;
    }
    throw Error('Invalid route coordinate');
  }
  while (index < encoded.length) {
    lat += delta();
    lon += delta();
    const point = [lon / 1e6, lat / 1e6];
    if (!routePoint(point) || points.length >= 100000) throw Error('Unsupported route coordinate');
    points.push(point);
  }
  if (points.length < 2) throw Error('Incomplete route shape');
  return points;
}

const valhallaManeuvers = {
  1:['depart','straight'], 2:['depart','right'], 3:['depart','left'],
  4:['arrive','straight'], 5:['arrive','right'], 6:['arrive','left'],
  7:['continue','straight'], 8:['continue','straight'],
  9:['turn','slight right'], 10:['turn','right'], 11:['turn','sharp right'],
  12:['turn','uturn'], 13:['turn','uturn'],
  14:['turn','sharp left'], 15:['turn','left'], 16:['turn','slight left'],
  17:['on ramp','straight'], 18:['on ramp','right'], 19:['on ramp','left'],
  20:['off ramp','right'], 21:['off ramp','left'],
  22:['fork','straight'], 23:['fork','right'], 24:['fork','left'],
  25:['merge','straight'], 26:['roundabout','straight'], 27:['exit roundabout','straight'],
  37:['merge','right'], 38:['merge','left'],
};
const valhallaText = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) : '';
const valhallaMetric = value => Number.isFinite(value) && value >= 0;
const valhallaSign = entries => Array.isArray(entries) ? entries.map(entry => valhallaText(entry?.text)).filter(Boolean).slice(0, 4).join(';') : '';

function normalizeValhallaTrip(trip, vehicle) {
  const summary = trip?.summary;
  const leg = trip?.legs?.[0];
  if (trip?.status !== 0 || trip.units !== 'kilometers' || trip.legs?.length !== 1 ||
      !valhallaMetric(summary?.time) || summary.time <= 0 ||
      !valhallaMetric(summary?.length) || summary.length <= 0) throw Error('Invalid route summary');

  const coordinates = decodeValhallaShape(leg.shape);
  const maneuvers = leg.maneuvers;
  if (!Array.isArray(maneuvers) || maneuvers.length < 2 || maneuvers.length > 10000 ||
      maneuvers[0].begin_shape_index !== 0 || maneuvers.at(-1).end_shape_index !== coordinates.length - 1) {
    throw Error('Incomplete route guidance');
  }
  const sections = [];
  const steps = maneuvers.map((entry, index) => {
    const start = entry.begin_shape_index, end = entry.end_shape_index;
    const mapped = valhallaManeuvers[entry.type];
    if (!mapped || !Number.isInteger(start) || !Number.isInteger(end) ||
        start < 0 || end < start || end >= coordinates.length ||
        (index > 0 && start !== maneuvers[index - 1].end_shape_index) ||
        !valhallaMetric(entry.length) || !valhallaMetric(entry.time) ||
        entry.travel_mode !== 'drive' || entry.travel_type !== vehicle) throw Error('Invalid route maneuver');
    if (entry.toll === true && end > start) sections.push({sectionType:'TOLL',startPointIndex:start,endPointIndex:end});
    const [type, modifier] = mapped;
    const names = Array.isArray(entry.street_names) ? entry.street_names.map(valhallaText).filter(Boolean).slice(0, 6) : [];
    const refs = names.filter(name => /^(?:[A-Z]{1,3}\s*\d+[A-Z]?|\d+)$/i.test(name));
    return {
      name:names.find(name => !refs.includes(name)) || '',
      ref:refs.join(';'),
      exits:valhallaSign(entry.sign?.exit_number_elements),
      destinations:valhallaSign(entry.sign?.exit_toward_elements),
      distance:entry.length * 1000, duration:entry.time,
      instruction:'',
      geometry:{type:'LineString',coordinates:coordinates.slice(start, end + 1)},
      maneuver:{type,modifier,location:coordinates[start],
        ...(type==='roundabout' && Number.isInteger(entry.roundabout_exit_count) && entry.roundabout_exit_count>0
          ? {exit:entry.roundabout_exit_count} : {})},
    };
  });
  if (steps[0].maneuver.type !== 'depart' || steps.at(-1).maneuver.type !== 'arrive') throw Error('Missing route endpoints');
  const route = {
    provider:'Valhalla', vehicle, duration:summary.time, distance:summary.length * 1000,
    geometry:{type:'LineString',coordinates}, legs:[{steps}],
    trafficSections:[], trafficCheckedAt:null, closureCheckedAt:null, tollEstimate:null,
  };
  const tollInput = {
    provider:route.provider, sections,
    legs:[{points:coordinates.map(([longitude, latitude]) => ({longitude, latitude}))}],
    guidance:{instructions:steps.map((step,index) => ({
      pointIndex:maneuvers[index].begin_shape_index, street:step.name, roadNumbers:step.ref.split(';').filter(Boolean),
    }))},
  };
  return {route,tollInput};
}

async function valhallaLocalTolls(input, estimateTolls) {
  const unavailable = {status:'unavailable',currency:'MYR',vehicleClass:1,amount:null,items:[],
    basis:'local-fares',note:'Local Class 1 fares include published LLM and operator data. Missing fares do not mean toll-free.'};
  if (!input.sections.length) return unavailable;
  try {
    const estimate = await estimateTolls(input);
    return Number.isFinite(estimate?.amount) && estimate.amount > 0
      ? {...estimate,status:'partial',basis:unavailable.basis,note:unavailable.note}
      : unavailable;
  } catch {
    return unavailable;
  }
}

export async function planValhallaRoute(env, body, estimateTolls) {
  const endpoint = valhallaEndpoint(env);
  const vehicle = body.vehicle || 'car';
  const fallback = vehicle === 'car' && !body.avoidTolls;
  const json = (data, status=200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  const unavailable = (error, status=502) => json({error,allowBasic:fallback},status);
  if (!endpoint) return unavailable('Valhalla is unavailable on this site.',503);

  const costing = vehicle === 'motorcycle' ? 'motorcycle' : 'auto';
  const obstacles = globalThis.LapanRoadRestrictions.list();
  const payload = {
    locations:[body.from,body.to].map(([lon,lat]) => ({lat,lon})),
    costing, units:'kilometers', alternates:body.alternatives ? 2 : 0,
    costing_options:{[costing]:{use_ferry:0,...(body.avoidTolls ? {use_tolls:0} : {})}},
    ...(obstacles.length ? {exclude_polygons:obstacles.map(({west,east,south,north}) =>
      [[west,south],[east,south],[east,north],[west,north],[west,south]])} : {}),
  };
  const key = endpoint.href + JSON.stringify(payload);
  const now = Date.now();
  const cached = valhallaCache.get(key);
  if (!body.refresh && cached && now-cached.at < (body.purpose==='rerouting' ? 30000 : 120000)) return json(cached.data);
  if (valhallaPending.has(key)) return (await valhallaPending.get(key)).clone();
  if (now < valhallaPauseUntil || valhallaPending.size >= 2) return unavailable('Valhalla routing is busy. Try again shortly.',429);

  const work = (async () => {
    try {
      const upstream = await fetch(endpoint.href, {
        method:'POST', headers:{'Content-Type':'application/json','X-Client-Id':env.LAPAN_ENVIRONMENT==='staging'?'lapan-malaysia-staging.alanchungcl.chatgpt.site':'lapan-malaysia.com'},
        body:JSON.stringify(payload), signal:AbortSignal.timeout(9500), redirect:'manual',
      });
      // Workers do not implement redirect:'error'. Do not forward route coordinates.
      if (upstream.status >= 300 && upstream.status < 400) {
        console.warn('Valhalla upstream returned a redirect',upstream.status);
        return unavailable('Valhalla routing is temporarily unavailable.');
      }
      if (upstream.status === 429) {
        valhallaPauseUntil = Date.now() + Math.max(30, Math.min(300, Number(upstream.headers.get('Retry-After')) || 60))*1000;
        return unavailable('Valhalla is temporarily rate limited.',429);
      }
      if (upstream.status >= 500) {
        console.warn('Valhalla upstream returned HTTP',upstream.status);
        return unavailable('Valhalla routing is temporarily unavailable.');
      }
      const data = await upstream.json();
      if (!upstream.ok) {
        if (data.error_code === 442 || data.error_code === 443) return json({error:'Valhalla found no route between these points.',allowBasic:false},422);
        return unavailable('Valhalla could not process the route request.');
      }
      const trips = [data.trip,...(Array.isArray(data.alternates) ? data.alternates.slice(0,2).map(item => item?.trip) : [])];
      const routes = [];
      let rejected = false;
      for (const trip of trips) {
        const summary = trip?.summary;
        if (summary?.has_ferry === true || (body.avoidTolls && summary?.has_toll !== false)) {
          rejected = true;
          continue;
        }
        try {
          const {route,tollInput} = normalizeValhallaTrip(trip,vehicle);
          if (globalThis.LapanRoadRestrictions.blocked(route.geometry.coordinates) ||
              (body.avoidTolls && tollInput.sections.length)) {
            rejected = true;
            continue;
          }
          if (vehicle === 'car' && !body.avoidTolls) route.tollEstimate = await valhallaLocalTolls(tollInput,estimateTolls);
          routes.push(route);
        } catch {
          // A malformed alternate cannot invalidate another usable route.
        }
      }
      if (!routes.length && rejected) return json({error:body.avoidTolls
        ? 'Valhalla found no route that it could verify avoids mapped tolls. Try Faster or change the start or destination.'
        : 'Valhalla found no usable route avoiding ferries and reported restrictions.',allowBasic:false},422);
      if (!routes.length) return unavailable('Valhalla returned incomplete route guidance.');
      const result = {code:'Ok',source:'Valhalla',routes};
      valhallaCache.set(key,{at:Date.now(),data:result});
      if (valhallaCache.size > 16) valhallaCache.delete(valhallaCache.keys().next().value);
      return json(result);
    } catch (error) {
      const reason = ['AbortError','TimeoutError'].includes(error?.name) ? 'timeout'
        : error instanceof SyntaxError ? 'invalid JSON' : 'network failure';
      console.warn('Valhalla request failed:',reason);
      return unavailable('Valhalla routing is temporarily unavailable.');
    }
  })();
  valhallaPending.set(key,work);
  try {
    return (await work).clone();
  } finally {
    valhallaPending.delete(key);
  }
}
