const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {project} = require('../web/cameras.js');
const code = fs.readFileSync('web/reports.js', 'utf8');
const route = {geometry: {coordinates: [[101, 3], [101.02, 3]]}};
const tick = () => new Promise(setImmediate);

function setup() {
 let now = 100000, timerId = 0;
 const timers = new Map(), nodes = new Map(), requests = [];
 class Element {
  constructor() {
   this.textContent = ''; this.open = false; this.hidden = false;
   this.classList = {hidden: true, add() {this.hidden = true}, remove() {this.hidden = false}};
  }
  querySelector() {return new Element()}
  querySelectorAll() {return []}
  addEventListener() {}
  focus() {}
  append() {}
  setAttribute() {}
 }
 const get = id => {
  if (!nodes.has(id)) nodes.set(id, new Element());
  return nodes.get(id);
 };
 const reports = [{id: 'first', kind: 'crash', lon: 101.003, lat: 3, remainingSeconds: 3600, ageSeconds: 0}];
 const previewLayers=[];
 const L={
  divIcon:options=>options,
  layerGroup(){
   const layer={pins:new Set(),addTo(){return this},removeLayer(marker){this.pins.delete(marker)},remove(){this.pins.clear();this.removed=true}};
   previewLayers.push(layer);
   return layer;
  },
  marker(point,{icon}){
   return {point,icon,bindPopup(popup){this.popup=popup;return this},addTo(layer){layer.pins.add(this);return this},getElement:()=>new Element()};
  }
 };
 const context = {
  L,
  document: {getElementById: get,querySelector:()=>({cloneNode:()=>new Element()}),createElement:()=>new Element()}, crypto: webcrypto,
  localStorage: {getItem() {return null}, setItem() {}},
  LapanCameras: {project}, URLSearchParams, AbortController,
  Date: class extends Date {static now() {return now}},
  setTimeout(fn, delay) {timers.set(++timerId, {fn, at: now + delay}); return timerId},
  clearTimeout(id) {timers.delete(id)},
  setInterval(fn, delay) {timers.set(++timerId, {fn, at: now + delay, interval: delay}); return timerId},
  clearInterval(id) {timers.delete(id)},
  fetch: async (url, options) => {
   requests.push({url, options});
   return {status: 200, json: async () => options?.method === 'POST' ? {} : {reports}};
  }
 };
 context.window = context;
 vm.runInNewContext(code, context);
 function advance(ms) {
  const end = now + ms;
  while (true) {
   const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
   if (!next) break;
   const [id, timer] = next; now = timer.at;
   if (timer.interval) timer.at += timer.interval; else timers.delete(id);
   timer.fn();
  }
  now = end;
 }
 const update = lon => context.LapanReports.update({coords: {longitude: lon, latitude: 3, accuracy: 10}}, route);
 return {get, update, advance, reports, requests, previewLayers, preview:context.LapanReports.preview, stopPreview:context.LapanReports.stopPreview, stop: context.LapanReports.stop};
}

(async () => {
 const preview=setup(),bounds={getSouth:()=>3,getNorth:()=>3,getWest:()=>101,getEast:()=>101.02};
 preview.reports[0].remainingSeconds=2;
 preview.reports.push({id:'off',kind:'flood',lat:3.01,lon:101.01,remainingSeconds:60,ageSeconds:0});
 preview.preview(route,{},bounds);
 await tick();
 assert.match(preview.requests[0].url,/\?bbox=/);
 const layer=preview.previewLayers[0];
 assert.equal(layer.pins.size,1,'only the selected route has report pins');
 const pin=[...layer.pins][0];
 assert.match(pin.icon.html.className,/report-crash/);
 assert.match(pin.popup().textContent,/Crash.*just now/);
 preview.advance(2000);
 assert.equal(layer.pins.size,0,'expired pins disappear without a new fetch');
 const other={geometry:{coordinates:[[101,3.01],[101.02,3.01]]}};
 preview.preview(other,{},bounds);
 preview.stopPreview();
 assert.equal(preview.requests[1].options.signal.aborted,true);
 await tick();
 assert.equal(preview.previewLayers[1].pins.size,0,'late replies cannot repaint a cleared route');
 assert.equal(layer.removed,true);

 let h = setup();
 h.update(101); await tick();
 assert.equal(h.get('reportAsk').classList.hidden, true, 'outside 300 m');
 h.update(101.0005);
 assert.equal(h.get('reportAsk').classList.hidden, false);
 assert.equal(h.get('reportAskCountdown').textContent, 'Closes in 15 s');
 h.advance(5000); h.update(101.004);
 assert.equal(h.get('reportAsk').classList.hidden, false, 'passing keeps the original timer');
 assert.equal(h.get('reportAskDistance').textContent, 'Community report · just passed');
 assert.equal(h.get('reportAskCountdown').textContent, 'Closes in 10 s');
 h.advance(9999);
 assert.equal(h.get('reportAsk').classList.hidden, false);
 h.advance(1);
 assert.equal(h.get('reportAsk').classList.hidden, true, 'closes at 15 seconds without another GPS update');
 h.update(101.0005);
 assert.equal(h.get('reportAsk').classList.hidden, true, 'the same report does not reopen');
 h.stop();

 h = setup(); h.update(101.0005); await tick(); h.update(101.0005);
 h.advance(10000); h.update(101.0006); h.advance(5000);
 assert.equal(h.get('reportAsk').classList.hidden, true, 'stationary or repeated GPS fixes cannot extend the deadline');
 h.stop();

 for (const action of ['reportAskDismiss', 'reportYes', 'reportNo']) {
  h = setup(); h.update(101.0005); await tick(); h.update(101.0005);
  h.get(action).onclick(); await tick();
  assert.equal(h.get('reportAsk').classList.hidden, true, action + ' closes immediately');
  assert.equal(h.requests.filter(r => r.options?.method === 'POST').length, action === 'reportAskDismiss' ? 0 : 1);
  h.stop();
 }
 h = setup(); h.update(101.0005); await tick(); h.update(101.0005); h.advance(5000); h.stop();
 h.update(101.0005); await tick(); h.update(101.0005); h.advance(10000);
 assert.equal(h.get('reportAsk').classList.hidden, false, 'previous trip timer cannot close a new prompt');
 h.advance(5000); assert.equal(h.get('reportAsk').classList.hidden, true); h.stop();
 console.log('PASS: 300 m trigger, visible countdown, passing, stationary GPS, exact deadline, votes, dismiss, no repeat and timer cleanup');
})().catch(error => {console.error(error); process.exitCode = 1});
