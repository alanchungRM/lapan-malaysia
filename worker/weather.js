// MET Malaysia publishes a shared feed. Keep coordinates and itinerary matching in the browser.
const weatherFeedCache = new Map();

function malaysiaWeatherDate(now = Date.now()) {
 return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}

function getWeatherFeed(path, ttl) {
 const cached = weatherFeedCache.get(path);
 if (cached && cached.until > Date.now()) return cached.promise;
 const entry = {until: Date.now() + ttl};
 entry.promise = (async () => {
  try {
   const response = await fetch('https://api.data.gov.my/weather/' + path, {signal: AbortSignal.timeout(8000)});
   if (!response.ok) return null;
   const rows = await response.json();
   return Array.isArray(rows) ? rows : null;
  } catch {
   return null;
  }
 })().then(rows => {
  if (!rows) entry.until = Date.now() + 30000;
  return rows;
 });
 weatherFeedCache.set(path, entry);
 if (weatherFeedCache.size > 4) weatherFeedCache.delete(weatherFeedCache.keys().next().value);
 return entry.promise;
}

export async function routeWeather(request) {
 if (request.method !== 'GET') return new Response(null, {status: 405, headers: {Allow: 'GET'}});
 const date = malaysiaWeatherDate();
 const [forecasts, warnings] = await Promise.all([
  getWeatherFeed('forecast?' + new URLSearchParams({filter: date + '@date', limit: '500'}), 30 * 60000),
  getWeatherFeed('warning?limit=40&sort=-valid_from', 2 * 60000)
 ]);
 return Response.json({date, forecasts: forecasts?.filter(row => row?.date === date) ?? null, warnings}, {
  headers: {'Cache-Control': 'no-store'}
 });
}
