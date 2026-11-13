const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {normalizeVoice,allowsVoice}=require('../web/preferences.js');
assert.equal(normalizeVoice({enabled:false}).mode,'off');assert.equal(normalizeVoice({voiceURI:'s'}).mode,'normal');assert.equal(normalizeVoice({mode:'invalid'}).mode,'normal');
for(const mode of ['normal','less','alerts','off']){assert.equal(allowsVoice(mode,'instruction',0),mode==='normal');assert.equal(allowsVoice(mode,'instruction',2),mode==='normal'||mode==='less');assert.equal(allowsVoice(mode,'alert'),mode!=='off');assert.equal(allowsVoice(mode,'manual'),mode!=='off')}
const storage=new Map();function harness(voicePack,AudioContext){let language='en',onLanguageChange;const nodes=new Map(),calls=[],events=[],radios=['normal','less','alerts','off'].map(value=>({value,checked:false}));let cancelled=0;const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',children:[],setAttribute(){},append(x){this.children.push(x)},replaceChildren(...children){this.children=children},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};const ctx={Date,Math,Number,Object,Option:class{constructor(text,value){this.text=text;this.value=value}},Event:class{constructor(type){this.type=type}},CustomEvent:class{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{body:{classList:{contains:()=>false}},getElementById:node,createElement:()=>({}),querySelectorAll:()=>radios,addEventListener(){}},LapanI18n:{lang:()=>language,deviceSpeechLang:()=>language,forSpeech:t=>t,onChange:fn=>{onLanguageChange=fn}},speechSynthesis:{getVoices:()=>[{voiceURI:'s',name:'Samantha',lang:'en-US'},{voiceURI:'amira',name:'Amira',lang:'ms-MY'}],addEventListener(){}},LapanSpeech:{createVoice:()=>({speak:(t,o)=>{calls.push({t,o});return true},cancel(){cancelled++},repeat(){},resume(){}})},dispatchEvent:e=>events.push(e.type),addEventListener(){}};ctx.LapanVoicePack=voicePack;ctx.AudioContext=AudioContext;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/preferences.js','utf8'),ctx);const choose=mode=>{radios.forEach(r=>r.checked=r.value===mode);radios.find(r=>r.value===mode).onchange()};return{ctx,node,choose,calls,events,language(next){language=next;onLanguageChange(next)},get cancelled(){return cancelled}}}
let h=harness();h.node('openVoice').onclick();assert.equal(h.node('voiceDialog').open,true);h.choose('less');h.ctx.LapanVoice.instruction('Far turn','a',0);assert.equal(h.calls.length,0);h.ctx.LapanVoice.instruction('Near turn','b',2);assert.equal(h.calls.length,1);h.choose('alerts');h.ctx.LapanVoice.instruction('Turn right','c',3);assert.equal(h.calls.length,1);h.ctx.LapanVoice.speak('Route updated');assert.equal(h.calls.length,2);h.ctx.LapanVoice.repeat();assert.equal(h.calls.length,3,'explicit repeat may speak even in alerts mode');h.choose('off');assert.equal(h.node('voice').value,'off');h.ctx.LapanVoice.speak('Arrived');h.ctx.LapanVoice.repeat();assert.equal(h.calls.length,3);assert.ok(h.cancelled>=3);h.node('voiceChoice').value='s';h.node('voiceChoice').onchange();h.node('doneVoice').onclick();assert.equal(h.node('voiceDialog').open,false);
h=harness();assert.equal(h.node('voiceModeLabel').textContent,'Off');assert.equal(h.node('voiceChoice').value,'s');h.node('navVoice').onclick();assert.equal(h.node('voiceDialog').open,true);h.choose('normal');assert.ok(h.events.includes('lapan-voice-enabled'));assert.equal(JSON.parse(storage.get('lapan-voice')).mode,'normal');h.ctx.localStorage.setItem=()=>{throw Error('blocked')};h.choose('less');assert.match(h.node('voiceStorage').textContent,/only for this visit/);
console.log('PASS: mode policy, legacy migration, filtering, explicit repeat, off cancellation, device-local persistence, reload, both entry points and storage failure');

storage.set('lapan-voice',JSON.stringify({mode:'less',voiceURI:'lapan-kokoro-emma'}));
h=harness({
 voicePacks:{'lapan-kokoro-heart':{label:'Kokoro Heart'}},
 createVoicePack:()=>({})
});
assert.equal(h.node('voiceChoice').value,'lapan-kokoro-heart');
assert.equal(h.ctx.LapanVoice.needsPreparation(),true);
assert.deepEqual(JSON.parse(storage.get('lapan-voice')),{mode:'less',enabled:true,voiceURI:'lapan-kokoro-heart'});

const prepared=[];
const heart={label:'Kokoro Heart',language:'en'};
const malay={label:'Bahasa Melayu',language:'ms',note:'Reads directions and alerts in Bahasa Melayu.'};
h=harness({
 voicePacks:{'lapan-kokoro-heart':heart,'lapan-malay':malay},
 createVoicePack:config=>({prepare(){prepared.push(config.language);return Promise.resolve(true)}})
}, class {});
assert.deepEqual(prepared,[],'loading settings does not prepare either pack');
const options=()=>h.node('voiceChoice').children.map(option=>option.value);
assert.deepEqual(options(),['','lapan-kokoro-heart','s']);
h.language('ms');
assert.deepEqual(options(),['','lapan-malay','amira']);
assert.equal(h.node('voiceChoice').value,'lapan-malay','saved Heart uses the bundled Malay counterpart');
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay);
h.language('en');
assert.equal(h.ctx.LapanVoice.selectedVoice(),heart);
h.ctx.LapanVoice.unlock();
h.language('ms');
assert.deepEqual(options(),['','lapan-malay','amira']);
assert.equal(h.ctx.LapanVoice.selectedVoice(),heart,'in-progress guidance keeps its voice');
h.ctx.LapanVoice.endTrip();
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay);
h.node('voiceChoice').value='lapan-malay';
h.node('voiceChoice').onchange();
assert.deepEqual(prepared,['ms'],'only the selected pack is prepared');
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay);
assert.match(h.node('voiceNote').textContent,/Bahasa Melayu/);
