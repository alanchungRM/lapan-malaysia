import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const code = await readFile('dist/server/index.js', 'utf8');
const {default: worker} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const query = (lat, lon, use) => worker.fetch(
 new Request('https://test/api/nearby?' + new URLSearchParams({kind:'rv', lat, lon, use})), {}
);

globalThis.fetch = () => { throw Error('RV stops should use bundled data'); };

const day = await query(3.16, 101.89, 'day');
assert.equal(day.status, 200);
assert.equal(day.headers.get('cache-control'), 'private, no-store');
const dayItems = (await day.json()).items;
assert.equal(dayItems[0].id, 'rv/sungai-lui');
assert.ok(dayItems.every(item => item.uses.includes('day')));

const overnight = await (await query(2.22, 102.18, 'overnight')).json();
assert.equal(overnight.items[0].id, 'rv/seafarer');
assert.ok(overnight.items.every(item => item.uses.includes('overnight')));
assert.match(overnight.items[0].sourceUrl, /^https:\/\//);
assert.match(overnight.items[0].phone, /^\+60\d+$/);
const kuchingOvernight = (await (await query(1.48, 110.28, 'overnight')).json()).items;
assert.equal(kuchingOvernight[0].id, 'rv/sumiran');
const all = (await (await query(1.48, 110.28, 'all')).json()).items;
assert.equal(all.length, 12);
assert.equal(all[0].id, 'rv/sumiran');
assert.equal(new Set(all.map(item => item.id)).size, all.length);
assert.ok(all.every((item, index) => index === 0 || all[index-1].distance <= item.distance));
assert.equal((await query(3.16, 101.89, 'invalid')).status, 400);

const html = await readFile('web/index.html', 'utf8');
assert.equal([...html.matchAll(/data-stop="rv"/g)].length, 2);
assert.match(html, /id="clearRecent"[^<]*>[^<]*<\/button><\/details><details class="quick-stops"><summary>Quick stops<\/summary>/);
const css = await readFile('web/mobile.css', 'utf8');
assert.match(css, /details:is\(\.recent-settings,\.quick-stops\)>summary\{[^}]*pointer-events:auto/);
assert.match(html, /data-rv-use="all"/);
assert.match(html, /data-rv-use="day"/);
assert.match(html, /data-rv-use="overnight"/);
console.log('PASS: bundled RV stops, filter isolation, nearby lookup, cross-region visibility and both Quick Stops entry points');

const script = await (await worker.fetch(new Request('https://test/places.js'), {})).text();
const {runInNewContext} = await import('node:vm');
const browser = {};
runInNewContext(script, browser);
const directory = JSON.parse(await readFile('data/rv-stops-my.json', 'utf8'));
const places = browser.LapanPlaces;
for(const {name,lat,lon} of directory){
 const exact = places.exact(name);
 assert.ok(exact.some(([,y,x])=>y===lat&&x===lon), 'Search and Quick Stops share the pin for '+name);
}
assert.ok(places.search("D'Sungai Lui").some(([name])=>name.startsWith('D’Sungai Lui')));
assert.equal(places.search('RV campsite').length,directory.length);
assert.equal(places.exact('RV campsite').length,0);
console.log('PASS: every RV campsite is available in the bundled location search with its Quick Stops pin');

const directoryResponse=await worker.fetch(new Request('https://test/api/nearby?kind=rv&use=overnight'),{});
assert.equal(directoryResponse.status,200);
const directoryResults=(await directoryResponse.json()).items;
assert.ok(directoryResults.length&&directoryResults.every(item=>item.distance===null&&item.uses.includes('overnight')));
assert.deepEqual(directoryResults.map(item=>item.name),directoryResults.map(item=>item.name).sort((a,b)=>a.localeCompare(b)));
assert.equal((await worker.fetch(new Request('https://test/api/nearby?kind=rv&lat=3.1'),{})).status,400);
console.log('PASS: browse RV campsites without GPS or a destination');

const ui = await readFile('web/stops.js', 'utf8');
const storage = new Map();
const node = () => ({
 children:[],classList:{add(){},remove(){}},
 append(...children){this.children.push(...children)},
 replaceChildren(){this.children=[]},
 addEventListener(){},setAttribute(){},showModal(){this.open=true},focus(){}
});
const elements = new Map();
const getElementById = id => {
 if(!elements.has(id)) elements.set(id,node());
 return elements.get(id);
};
let confirmClear=false;
const window = {
 confirm:()=>confirmClear,
 LapanStopsContext:{allowsRv:()=>true,location(){throw Error('GPS is unavailable')}},
 addEventListener(){}
};
const navigator = {onLine:true};
const offlineApp = {
 document:{getElementById,querySelectorAll:()=>[],createElement:node},window,navigator,
 localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
 fetch(){throw Error('Network is unavailable')}
};
runInNewContext(ui.trimEnd().slice(0,-5)+'window.renderStop=renderStop;})();',offlineApp);
const campsite = {...all[0],entranceLat:1.49,entranceLon:110.28,accessNotes:'Use the main gate'};
window.renderStop({name:'Ordinary stop',distance:100,address:'Malaysia'},{},false,null);
assert.equal(getElementById('stopsResults').children[0].children[1].textContent,'Route here');
assert.equal(storage.size,0);
window.renderStop(campsite,{},true,null);
const save = getElementById('stopsResults').children[1].children[1].children[1];
assert.equal(save.textContent,'Save campsite offline');
save.onclick();
save.onclick();
assert.equal(save.textContent,'Saved offline');
const saved = JSON.parse(storage.get('lapan-saved-campsites'));
assert.equal(saved.length,1);
assert.equal(saved[0].phone,campsite.phone);
assert.equal(saved[0].accessNotes,'Use the main gate');
assert.equal(saved[0].distance,undefined);
navigator.onLine=false;
getElementById('viewSavedCampsites').onclick();
assert.equal(getElementById('rvConnectionStatus').hidden,false);
assert.equal(getElementById('rvGpsStatus').hidden,true);
const row = getElementById('stopsResults').children[0];
assert.equal(row.children[0].children[3].textContent,'1.490000, 110.280000');
assert.equal(row.children[0].children[4].textContent,'Use the main gate');
assert.equal(row.children[0].children[5].children[0].href,'tel:'+campsite.phone);
row.children[1].onclick();
assert.equal(getElementById('stopsResults').children.length,0);
assert.deepEqual(JSON.parse(storage.get('lapan-saved-campsites')),[]);
console.log('PASS: only campsites can be saved and details can be read and removed without GPS or internet');

storage.set('lapan-saved-campsites',JSON.stringify([campsite,all[1]]));
storage.set('lapan-vehicle','car');
getElementById('viewSavedCampsites').onclick();
const clear=getElementById('clearSavedCampsites');
assert.equal(getElementById('savedCampsitesHelp').hidden,false);
assert.equal(clear.hidden,false);
clear.onclick();
assert.equal(JSON.parse(storage.get('lapan-saved-campsites')).length,2);
confirmClear=true;
clear.onclick();
assert.equal(storage.has('lapan-saved-campsites'),false);
assert.equal(storage.get('lapan-vehicle'),'car');
assert.equal(clear.hidden,true);
assert.equal(getElementById('stopsResults').children.length,0);
console.log('PASS: clear all confirms first and removes only saved campsite data while offline');
