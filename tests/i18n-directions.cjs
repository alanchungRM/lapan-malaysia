const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createI18n}=require('../web/i18n.js');
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
function boot({lang,voices=[{lang:'ms-MY'}]}){
 const i=createI18n({storage:{getItem:()=>lang,setItem(){}},doc:{documentElement:{}},languages:[],voices:()=>voices});i.add(entries);i.init();globalThis.LapanI18n=i;
 delete require.cache[require.resolve('../web/directions.js')];delete require.cache[require.resolve('../web/cameras.js')];
 return {i,D:require('../web/directions.js'),C:require('../web/cameras.js')};
}
const step=(type,modifier,extra={})=>({maneuver:{type,modifier,...(extra.exit?{exit:extra.exit}:{})},name:extra.name||'',ref:extra.ref||'',exits:extra.exits||'',destinations:extra.to||'',instruction:extra.sentence||''});

// English is exactly what it was: TomTom's own sentence wins, and the structured text is unchanged.
let {D,C}=boot({lang:'en'});
assert.equal(D.format(step('turn','left',{sentence:'Turn left onto Jalan Duta'})),'Turn left onto Jalan Duta');
assert.equal(D.format(step('off ramp','right',{exits:'214',name:'Jalan Duta'})),'Take exit 214 right · Jalan Duta');
assert.equal(D.speech(step('roundabout','right',{exit:2})),'At the roundabout, take the 2nd exit');
assert.equal(C.describe('speed',434,80,true).text,'Speed camera ahead · 434 m · mapped limit 80 km/h · Slow down');

// Bahasa Malaysia on screen: built from the structured manoeuvre, so TomTom's English sentence is not shown.
({D,C}=boot({lang:'ms'}));
assert.equal(D.format(step('turn','left',{sentence:'Turn left onto Jalan Duta',name:'Jalan Duta'})),'Belok kiri · Jalan Duta');
assert.equal(D.format(step('turn','right')),'Belok kanan');
assert.equal(D.format(step('turn','uturn')),'Buat pusingan U');
assert.equal(D.format(step('continue','straight')),'Teruskan lurus');
assert.equal(D.format(step('fork','left')),'Kekal ke kiri');
assert.equal(D.format(step('merge','right')),'Bergabung kanan');
assert.equal(D.format(step('off ramp','right',{exits:'214',name:'Jalan Duta'})),'Ambil keluar 214 kanan · Jalan Duta');
assert.equal(D.format(step('on ramp','left')),'Ambil susur kiri');
assert.equal(D.format(step('roundabout','right',{exit:2})),'Di bulatan, ambil jalan keluar ke-2');
assert.equal(D.format(step('exit roundabout','left')),'Keluar dari bulatan');
assert.equal(D.format(step('depart','straight',{name:'Jalan Tun Razak'})),'Menuju ke · Jalan Tun Razak');
assert.equal(D.format(step('arrive','')),'Tiba di destinasi anda');
assert.equal(D.format(step('turn','left',{to:'Ipoh',name:'Lebuhraya Utara-Selatan'})),'Belok kiri · Lebuhraya Utara-Selatan menuju Ipoh');
// Signed numbers still become badges: the exit badge reads KELUAR, and the titles are Malay.
const parts=D.badges(step('off ramp','right',{exits:'214'}),D.format(step('off ramp','right',{exits:'214'})));
assert.ok(parts.some(p=>p.kind==='exit'&&p.text==='KELUAR 214'),JSON.stringify(parts));

// Spoken directions follow the voice, not the page: Malay only if a Malay voice is installed.
({D,C}=boot({lang:'ms'}));assert.equal(D.speech(step('off ramp','right',{exits:'214',ref:'E1'})),'Ambil keluar 214 kanan, laluan E1');
assert.equal(D.speech(step('roundabout','left',{exit:3})),'Di bulatan, ambil jalan keluar ke-3');assert.equal(D.speech(step('depart','straight')),'Teruskan');
({D,C}=boot({lang:'ms',voices:[{lang:'en-GB'}]}));assert.equal(D.speech(step('off ramp','right',{exits:'214',ref:'E1'})),'Take exit 214 right, route E1','no Malay voice, so the voice reads English');
assert.equal(D.format(step('turn','left')),'Belok kiri','the screen is still Malay');

// Camera alerts: the banner follows the page language, the spoken line follows the voice.
({D,C}=boot({lang:'ms'}));let I=globalThis.LapanI18n,pair={t:(k,v)=>I.t(k,v),s:(k,v)=>I.speechLang()==='ms'?I.t(k,v):k.replace(/\{(\w+)\}/g,(x,n)=>n in(v||{})?v[n]:x)};
let a=C.describe('speed',434,80,true,pair);assert.equal(a.text,'Kamera kelajuan di hadapan · 434 m · had laju dipetakan 80 km/j · Perlahankan');assert.equal(a.voice,'Kamera kelajuan di hadapan, dalam 434 meter. Had dipetakan 80 kilometer sejam. Perlahankan.');
a=C.describe('redlight',320,60,true,pair);assert.equal(a.text,'Kamera lampu merah di hadapan · 320 m');assert.equal(a.voice,'Kamera lampu merah di hadapan, dalam 320 meter.');
a=C.describe('speed',250,0,false,pair);assert.equal(a.text,'Kamera kelajuan di hadapan · 250 m · semak had laju yang tertera');
({D,C}=boot({lang:'ms',voices:[]}));I=globalThis.LapanI18n;pair={t:(k,v)=>I.t(k,v),s:(k,v)=>I.speechLang()==='ms'?I.t(k,v):k.replace(/\{(\w+)\}/g,(x,n)=>n in(v||{})?v[n]:x)};
a=C.describe('speed',434,80,true,pair);assert.match(a.text,/^Kamera kelajuan/);assert.equal(a.voice,'Speed camera ahead, in 434 metres. Mapped limit 80 kilometres per hour. Slow down.','no Malay voice: spoken in English');
// Spoken one-liners
({D,C}=boot({lang:'ms'}));assert.equal(globalThis.LapanI18n.forSpeech('Slow down. Speed limit 80.'),'Perlahankan. Had laju 80.');assert.equal(globalThis.LapanI18n.forSpeech('Speed limit drops to 60 in 400 metres.'),'Had laju turun kepada 60 dalam 400 meter.');assert.equal(globalThis.LapanI18n.forSpeech('You have arrived at your destination.'),'Anda telah tiba di destinasi anda.');
console.log('PASS: English directions and alerts unchanged, Malay directions for every manoeuvre, KELUAR badges, speech follows the installed voice, camera alerts and spoken lines in Malay');
