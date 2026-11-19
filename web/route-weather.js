(() => {
 const floodUrl = 'https://publicinfobanjir.water.gov.my/';
 const metUrl = 'https://www.met.gov.my/';
 const timezone = 'Asia/Kuala_Lumpur';
 const alias = {
  'wp kuala lumpur':'kuala lumpur', 'wp putrajaya':'putrajaya', 'wp labuan':'labuan',
  'w p kuala lumpur':'kuala lumpur', 'w p putrajaya':'putrajaya', 'w p labuan':'labuan',
  'pulau pinang':'penang', melaka:'malacca', 'n sembilan':'negeri sembilan',
  'hulu selangor':'ulu selangor', 'hulu langat':'ulu langat', kulai:'kulaijaya',
  tangkak:'ledang', 'larut matang dan selama':'larut dan matang'
 };
 const key = text => {
  const clean = String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return alias[clean] || clean;
 };
 const inside = ([x,y], ring) => {
  let match = false;
  for (let i=1; i<ring.length; i++) {
   const [ax,ay] = ring[i-1], [bx,by] = ring[i];
   if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) match=!match;
  }
  return match;
 };
 const contains = (polygons, point) => polygons.some(([outer,...holes]) =>
  inside(point,outer) && !holes.some(ring => inside(point,ring)));
 const bounds = polygons => polygons.flatMap(([ring]) => ring).reduce(([w,s,e,n],[x,y]) =>
  [Math.min(w,x),Math.min(s,y),Math.max(e,x),Math.max(n,y)], [Infinity,Infinity,-Infinity,-Infinity]);
 const inBounds = ([w,s,e,n],[x,y]) => x>=w && x<=e && y>=s && y<=n;

 // Sample along the selected geometry at roughly 500 m or less, even for sparse fallback routes.
 function routeSamples(geometry) {
  const paths = geometry?.type==='MultiLineString' ? geometry.coordinates : [geometry?.coordinates ?? []];
  const samples = [];
  for (const path of paths) {
   if (path.length) samples.push(path[0]);
   for (let i=1;i<path.length;i++) {
    const [x,y]=path[i-1], [endX,endY]=path[i];
    const count=Math.ceil(Math.hypot(endX-x,endY-y)/.004);
    for (let step=1;step<=count;step++) samples.push([x+(endX-x)*step/count,y+(endY-y)*step/count]);
   }
  }
  return samples;
 }

 function warningAreas(row) {
  // The feed gives areas in the Malay bulletin as state groups, with districts in parentheses.
  const match = row.text_bm?.match(/\b(?:di seluruh|di negeri(?:-negeri)?|di kawasan|di)\s+(.+?)(?:\s+sehingga\b|[.!?]$|$)/is);
  if (!match) return [];
  return match[1].split(/[•●\n]/).flatMap(group => {
   const districts = group.match(/\(([^)]+)\)/);
   if (districts) return districts[1].split(/,|\s+dan\s+/i).map(name => ['ADM2',key(name)]);
   return group.split(/,|\s+dan\s+/i).map(name => ['ADM1',key(name)]);
  });
 }

 function malaysiaTime(value) {
  if (!value) return NaN;
  return Date.parse(/[Zz]$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ','T')+'+08:00');
 }

 function latestWarnings(rows, now) {
  const seen = new Set();
  return [...rows].sort((a,b) => malaysiaTime(b.warning_issue?.issued)-malaysiaTime(a.warning_issue?.issued)).filter(row => {
   const title = row.warning_issue?.title_en || '';
   const type = /thunderstorm/i.test(title) ? 'storm' : /rain/i.test(title) ? 'rain' : '';
   if (!type || /seas|waters|marine/i.test(title)) return false;
   const issued=malaysiaTime(row.warning_issue?.issued);
   const identity=type+'|'+(row.heading_en || title).toLowerCase();
   if (seen.has(identity) || !(issued<=now)) return false;
   seen.add(identity);
   return malaysiaTime(row.valid_from)<=now && malaysiaTime(row.valid_to)>now;
  });
 }

 let current, layer, interval, dataPromise, dataUntil=0, areasPromise;
 function clear() {
  if (current) current.panel.remove();
  if (layer && current) current.map.removeLayer(layer);
  clearInterval(interval);
  current=layer=interval=null;
 }

 async function json(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(11000)});
  if (!response.ok) throw Error('Weather data unavailable');
  return response.json();
 }
 function feeds() {
  if (!dataPromise || dataUntil<=Date.now()) {
   dataUntil=Date.now()+120000;
   dataPromise=json('/api/route-weather').catch(() => {
    dataUntil=0;
    return null;
   });
  }
  return dataPromise;
 }
 function boundaries() {
  areasPromise ??= json('/weather-areas.json').catch(() => {
   areasPromise=null;
   return null;
  });
  return areasPromise;
 }
 function link(label, url) {
  const element=document.createElement('a');
  element.textContent=label;
  element.href=url;
  element.target='_blank';
  element.rel='noopener noreferrer';
  element.addEventListener('click',event=>event.stopPropagation());
  element.addEventListener('keydown',event=>event.stopPropagation());
  return element;
 }
 function note(panel, text, className='') {
  const element=document.createElement('div');
  element.className=className;
  element.textContent=text;
  panel.append(element);
  return element;
 }
 const bilingual = (en,ms) => document.documentElement.lang==='ms' ? ms : en;
 function englishForecast(text) {
  const words=key(text);
  if (words==='tiada hujan') return 'No rain';
  if (words==='berjerebu') return 'Hazy';
  const weather=words.startsWith('ribut petir')?'thunderstorms':words.startsWith('hujan')?'rain':'';
  if (!weather) return text;
  const coverage=words.includes('di satu dua tempat')?'Isolated ':words.includes('di beberapa tempat')?'Scattered ':'';
  const area=words.includes('pantai')?' over coastal areas':words.includes('pedalaman')?' over inland areas':words.includes('kebanyakan tempat')?' in most areas':'';
  const result=coverage+weather+area;
  return result[0].toUpperCase()+result.slice(1);
 }

 function render(view) {
  const {panel,destination,route,map,areas,data}=view;
  panel.replaceChildren();
  if (layer) map.removeLayer(layer);
  layer=null;
  const now=Date.now();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const destinationPoint=[destination[2],destination[1]];
  const layers=Object.fromEntries(['ADM1','ADM2'].map(level => [level,new Map(
   Object.entries(areas?.[level]?.areas ?? {}).map(([name,polygons]) => [key(name),{name,polygons,box:bounds(polygons)}])
  )]));
  const locations=destination[0].split(',').map(key);
  for (const level of ['ADM2','ADM1']) {
   for (const [name,area] of layers[level]) {
    if (inBounds(area.box,destinationPoint) && contains(area.polygons,destinationPoint)) locations.push(name);
   }
  }
  const forecast = data?.date===date && locations.map(name => data.forecasts?.find(row =>
   /^(Ds|St|Tn|Dv|Rc)/.test(row.location?.location_id ?? '') && key(row.location?.location_name)===name
  )).find(Boolean);
  const samples = routeSamples(route.geometry);
  const overlays = new Set();
  for (const row of latestWarnings(data?.warnings ?? [],now)) {
   const matches=warningAreas(row).map(([level,name]) => layers[level].get(name)).filter(area =>
    area && samples.some(point=>inBounds(area.box,point) && contains(area.polygons,point)));
   if (!matches.length) continue;
   matches.forEach(area=>overlays.add(area));
   const title=bilingual(row.warning_issue.title_en,row.warning_issue.title_bm || row.warning_issue.title_en);
   const warning=document.createElement('div');
   warning.className='route-weather-warning';
   note(warning,'⚠ '+title+' · '+bilingual('Along your route','Sepanjang laluan anda'),'route-weather-warning-title');
   const expiry=new Intl.DateTimeFormat(bilingual('en-MY','ms-MY'),{timeZone:timezone,day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(malaysiaTime(row.valid_to));
   note(warning,matches.map(area=>area.name).join(', ')+' · '+bilingual('Until ','Sehingga ')+expiry+' · MET Malaysia');
   panel.append(warning);
  }
  if (overlays.size) {
   layer=L.geoJSON({type:'FeatureCollection',features:[...overlays].map(area=>({
    type:'Feature',geometry:{type:'MultiPolygon',coordinates:area.polygons},properties:{}
   }))},{interactive:false,style:{className:'route-weather-area',color:'#d38312',weight:2,fillOpacity:.12,dashArray:'5 5'}}).addTo(map);
   layer.bringToBack();
  }
  if (forecast?.summary_forecast) {
   const temp=Number.isFinite(forecast.min_temp)&&Number.isFinite(forecast.max_temp)
    ? ' · '+forecast.min_temp+'–'+forecast.max_temp+' °C':'';
   note(panel,bilingual('Today near ','Hari ini berhampiran ')+forecast.location.location_name+
    ' · '+bilingual(englishForecast(forecast.summary_forecast),forecast.summary_forecast)+temp);
  } else {
   note(panel,bilingual('Destination forecast unavailable','Ramalan destinasi tidak tersedia'));
  }
  if (!data?.warnings || !areas) note(panel,bilingual('Route weather warnings unavailable','Amaran cuaca laluan tidak tersedia'));
  const sources=document.createElement('div');
  sources.className='route-weather-links';
  sources.append(
   link('MET Malaysia',metUrl),
   link('CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'),
   link(bilingual('Flood information · JPS','Maklumat banjir · JPS'),floodUrl),
   link('geoBoundaries', 'https://www.geoboundaries.org/')
  );
  panel.append(sources);
 }

 async function refresh(view) {
  const [data,areas]=await Promise.all([feeds(),boundaries()]);
  if (current!==view || !view.panel.isConnected) return;
  view.data=data;
  view.areas=areas;
  render(view);
 }
 function show(card,route,destination,map) {
  if (!card) return;
  if (current?.route===route && current.panel.parentElement===card) return;
  clear();
  const panel=document.createElement('div');
  panel.className='route-weather';
  panel.setAttribute('data-no-i18n','');
  panel.setAttribute('aria-live','polite');
  note(panel,bilingual('Checking weather…','Menyemak cuaca…'));
  card.append(panel);
  const view=current={panel,route,destination,map};
  void refresh(view);
  interval=setInterval(()=>void refresh(view),60000);
 }
 new MutationObserver(() => {
  if (current?.data || current?.areas) render(current);
 }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.LapanRouteWeather={show,clear};
})();
