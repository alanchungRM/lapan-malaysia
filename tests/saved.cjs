const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {clean,createStore,coordinates,chipLabel,KEY,KINDS}=require('../web/saved.js');
const memory=(seed={})=>{const m=new Map(Object.entries(seed));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m}};

// Only real Malaysian places are accepted.
assert.deepEqual(clean(['  Menara KL ',3.1528,101.7038]),['Menara KL',3.1528,101.7038],'name is trimmed');
assert.equal(clean(['My location',3.1,101.7]),null,'a live GPS label is never a saved place');
for(const bad of [null,[],['',3,101],['x',NaN,101],['x',3,'a'],['Bangkok',13.7,100.5],['London',51.5,-0.1],['Pacific',3,125],['Equator',-1,101],['x',3.1],['x','3',101],['x',3,null],{0:'x'}])assert.equal(clean(bad),null,JSON.stringify(bad));
assert.equal(clean(['x'.repeat(500),3,101])[0].length,160,'names are capped');

// The store keeps both places apart and survives restarts.
const storage=memory();let store=createStore(storage);
assert.equal(store.get('home'),null);assert.equal(store.get('work'),null);assert.equal(store.get('other'),null);
assert.equal(store.set('home',['Taman Desa',3.1,101.68]),true);assert.equal(store.set('work',['KLCC',3.1579,101.7116]),true);
assert.equal(store.set('home',['Bad',99,0]),false,'invalid place is refused');assert.equal(store.set('gym',['Gym',3,101]),false,'unknown kind is refused');
assert.deepEqual(store.get('home'),['Taman Desa',3.1,101.68],'refused write leaves the old value');
store=createStore(storage);assert.deepEqual(store.get('work'),['KLCC',3.1579,101.7116],'persists across a reload');
assert.equal(store.clear('home'),true);assert.equal(createStore(storage).get('home'),null);assert.ok(createStore(storage).get('work'),'clearing Home keeps Work');
assert.deepEqual(KINDS,['home','work']);assert.equal(KEY,'lapan-saved');

// Bad or hostile stored data is ignored, one field at a time.
assert.equal(createStore(memory({[KEY]:'{not json'})).get('home'),null);
assert.equal(createStore(memory({[KEY]:'null'})).get('home'),null);
const mixed=createStore(memory({[KEY]:JSON.stringify({home:['<img src=x onerror=alert(1)>',3.1,101.6],work:['Far away',40,10],extra:1})}));
assert.equal(mixed.get('work'),null,'out-of-Malaysia entry dropped');assert.equal(mixed.get('home')[0],'<img src=x onerror=alert(1)>','text is kept as text (it is only ever shown with textContent)');

// Blocked storage never throws and reports failure.
const blocked=createStore({getItem(){throw Error('denied')},setItem(){throw Error('denied')}});
assert.equal(blocked.get('home'),null);assert.equal(blocked.set('home',['A',3,101]),false);assert.equal(blocked.get('home'),null,'failed persistence leaves the previous value intact');
assert.equal(coordinates(3.139003,101.686855),'3.1390, 101.6869');

// The markup and the code agree, and every string shown by saved.js has Bahasa Malaysia.
const html=fs.readFileSync('web/index.html','utf8'),js=fs.readFileSync('web/saved.js','utf8');
for(const id of ['savedDialog','savedTitle','savedCurrent','savedName','savedUseTo','savedToName','savedUseHere','savedRemove','savedStatus','closeSaved','doneSaved'])assert.ok(html.includes('id="'+id+'"'),'index.html lacks #'+id);
for(const k of KINDS)for(const attr of ['data-saved="'+k+'"','data-saved-edit="'+k+'"'])assert.ok(html.includes(attr),attr);
assert.match(html,/<script src="saved\.js"><\/script>/);assert.ok(html.indexOf('saved.js')<html.indexOf('src="app.js"'),'saved.js loads before app.js');
for(const name of ['savedName','savedToName'])assert.match(html,new RegExp('id="'+name+'" data-no-i18n'),name+' holds a place name and must not be translated');
assert.ok(!/innerHTML/.test(js),'place names are never written as HTML');
const dict={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:o=>Object.assign(dict,o)}}});
const labels={home:'Home',work:'Work'},needed=[];
for(const k of KINDS){const L=labels[k];needed.push(L,'Set '+L,'Change '+L,'Remove '+L,L+' saved.',L+' removed.',L+' selected. Tap Find my route.')}
needed.push('Tap to set','Saved places','Search for a place in the To box first.','This browser cannot save places right now.','Location is unavailable or permission was denied.','Finding your location…','Your location is outside Malaysia. Choose a Malaysian starting point.','This browser does not support location.');
for(const text of needed)assert.ok(dict[text]&&dict[text]!==text||text==='Home'&&dict[text],'no Bahasa Malaysia for: '+text);
for(const text of [...js.matchAll(/(?:dialogState|status\)?\.textContent=|status\()\s*['"]([^'"]+)['"]/g)].map(m=>m[1]))assert.ok(dict[text],'untranslated string in saved.js: '+text);
for(const m of js.matchAll(/'([A-Za-z ]+ )'\+LABEL\[kind\]|LABEL\[kind\]\+'([^']+)'/g))for(const L of Object.values(labels)){const text=m[1]?m[1]+L:L+m[2];assert.ok(dict[text],'untranslated composed string in saved.js: '+text)}
assert.equal(chipLabel('5.3582, 100.3190'),'5.358, 100.319','coordinates fit on a chip');assert.equal(chipLabel('Menara KL'),'Menara KL');assert.equal(chipLabel('Jalan 3.1234, 101.5678 Utara'),'Jalan 3.1234, 101.5678 Utara','only plain coordinates are shortened');
console.log('PASS: Home and Work validation, storage, bad data, blocked storage, markup and Bahasa Malaysia coverage');
