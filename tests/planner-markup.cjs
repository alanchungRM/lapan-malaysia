const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync('web/index.html','utf8'),body=html.slice(html.indexOf('<body'));
const ids=[...body.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);

// Every id is unique, so moving blocks can never leave two elements answering to one script lookup.
const seen=new Set(),dupes=ids.filter(id=>seen.has(id)||!seen.add(id));
assert.deepEqual(dupes,[],'duplicate ids: '+dupes.join(', '));

// Every id the browser scripts look up by literal name still exists in the page. Ids the scripts create themselves are listed.
const created=new Set(['mapDialog','pickerMap','pickerConfirm','pickerCancel','pickerTitle','pickerHint','stopsDialog','voiceDialog','installDialog']);
const used=new Set();
for(const file of fs.readdirSync('web').filter(f=>/\.js$/.test(f)&&!/^(maplibre|leaflet-maplibre|statistics|statistics-panel|analytics)\.js$/.test(f))){
 const src=fs.readFileSync(path.join('web',file),'utf8');
 for(const m of src.matchAll(/(?:getElementById\(|\$\()'([A-Za-z][\w-]*)'\)/g))used.add(m[1]);
}
const missing=[...used].filter(id=>!ids.includes(id)&&!created.has(id));
assert.deepEqual(missing,[],'ids used by scripts but absent from index.html: '+missing.join(', '));

// The first task is up front. Header carries a menu button, not the tool list.
const header=body.slice(body.indexOf('<header>'),body.indexOf('</header>'));
assert.match(header,/id="openMenu"/);assert.doesNotMatch(header,/id="openToll"|history-link|class="tag"/);
assert.match(header,/class="app-version"/,'version badge stays reachable per AGENTS.md');
const destination=body.match(/<input id="destination"[^>]*>/)[0];
assert.doesNotMatch(destination,/value="[^"]+"/,'no pre-filled destination');
assert.match(destination,/placeholder="/);
const at=id=>body.indexOf('id="'+id+'"');
assert.ok(at('destination')<at('plan')&&at('plan')<body.indexOf('class="quick-stops"'),'Find my route comes right after the fields, before secondary blocks');
assert.ok(at('plan')<at('moreOptions'));

// Secondary tools live inside the single More options group.
const more=body.slice(body.indexOf('id="moreOptions"'),body.indexOf('</aside>'));
for(const marker of ['id="openToll"','history-link','id="vehicle"','id="openVoice"','class="awake-settings"','class="signal-settings"','statistics-link','id="openInstall"','class="about-app"'])assert.ok(more.includes(marker),marker+' belongs in More options');
const before=body.slice(0,body.indexOf('id="moreOptions"'));
for(const marker of ['id="openToll"','class="awake-settings"','class="signal-settings"','id="openInstall"'])assert.ok(!before.includes(marker),marker+' must not also appear above More options');
assert.match(body,/class="privacy-line"/);

// The app starts with no chosen destination and the code never reads a missing one unguarded at startup.
const app=fs.readFileSync('web/app.js','utf8');
assert.match(app,/let chosen=\{origin:null,destination:null\}/);assert.doesNotMatch(app,/places\[1\]/);
console.log('PASS: unique ids, script id lookups present, header menu, no default destination, primary action first, tools grouped in More options');
