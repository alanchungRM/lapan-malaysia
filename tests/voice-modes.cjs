const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {normalizeVoice,allowsVoice}=require('../web/preferences.js');
assert.equal(normalizeVoice({enabled:false}).mode,'off');assert.equal(normalizeVoice({voiceURI:'s'}).mode,'less');assert.equal(normalizeVoice({mode:'invalid'}).mode,'less');
for(const mode of ['normal','less','alerts','off']){assert.equal(allowsVoice(mode,'instruction',0),mode==='normal');assert.equal(allowsVoice(mode,'instruction',2),mode==='normal'||mode==='less');assert.equal(allowsVoice(mode,'alert'),mode!=='off');assert.equal(allowsVoice(mode,'manual'),mode!=='off')}
const storage=new Map();function harness(voicePack,AudioContext){let language='en',onLanguageChange;const nodes=new Map(),calls=[],events=[],radios=['normal','less','alerts','off'].map(value=>({value,checked:false}));let cancelled=0;const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',children:[],setAttribute(){},append(x){this.children.push(x)},replaceChildren(...children){this.children=children},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};const ctx={Date,Math,Number,Object,Option:class{constructor(text,value){this.text=text;this.value=value}},Event:class{constructor(type){this.type=type}},CustomEvent:class{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{body:{classList:{contains:()=>false}},getElementById:node,createElement:()=>({}),querySelectorAll:()=>radios,addEventListener(){}},LapanI18n:{lang:()=>language,deviceSpeechLang:()=>language,forSpeech:t=>t,onChange:fn=>{onLanguageChange=fn}},speechSynthesis:{getVoices:()=>[{voiceURI:'s',name:'Samantha',lang:'en-US'},{voiceURI:'amira',name:'Amira',lang:'ms-MY'}],addEventListener(){}},LapanSpeech:{createVoice:()=>({speak:(t,o)=>{calls.push({t,o});return true},cancel(){cancelled++},repeat(){},resume(){}})},dispatchEvent:e=>events.push(e.type),addEventListener(){}};ctx.LapanVoicePack=voicePack;ctx.AudioContext=AudioContext;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/preferences.js','utf8'),ctx);const choose=mode=>{radios.forEach(r=>r.checked=r.value===mode);radios.find(r=>r.value===mode).onchange()};return{ctx,node,choose,calls,events,language(next){language=next;onLanguageChange(next)},get cancelled(){return cancelled}}}
for(const saved of [{mode:'normal'},{mode:'less'},{mode:'alerts'},{mode:'off'},{enabled:false}]){
 storage.set('lapan-voice',JSON.stringify({...saved,voiceURI:'s'}));
 const existing=harness();
 assert.equal(existing.node('voiceModeLabel').textContent,'Less chatty');
 assert.equal(existing.node('voiceChoice').value,'s');
 assert.deepEqual(JSON.parse(storage.get('lapan-voice')),{mode:'less',enabled:true,voiceURI:'s',modeRevision:1});
 existing.choose('alerts');
 assert.equal(harness().node('voiceModeLabel').textContent,'Alerts only');
}
storage.clear();
let h=harness();assert.equal(h.node('voiceModeLabel').textContent,'Less chatty');h.node('openVoice').onclick();assert.equal(h.node('voiceDialog').open,true);h.choose('less');h.ctx.LapanVoice.instruction('Far turn','a',0);assert.equal(h.calls.length,0);h.ctx.LapanVoice.instruction('Near turn','b',2);assert.equal(h.calls.length,1);h.choose('alerts');h.ctx.LapanVoice.instruction('Turn right','c',3);assert.equal(h.calls.length,1);h.ctx.LapanVoice.speak('Route updated');assert.equal(h.calls.length,2);h.ctx.LapanVoice.repeat();assert.equal(h.calls.length,3,'explicit repeat may speak even in alerts mode');h.choose('off');assert.equal(h.node('voice').value,'off');h.ctx.LapanVoice.speak('Arrived');h.ctx.LapanVoice.repeat();assert.equal(h.calls.length,3);assert.ok(h.cancelled>=3);h.node('voiceChoice').value='s';h.node('voiceChoice').onchange();h.node('doneVoice').onclick();assert.equal(h.node('voiceDialog').open,false);
h=harness();assert.equal(h.node('voiceModeLabel').textContent,'Off');assert.equal(h.node('voiceChoice').value,'s');h.node('navVoice').onclick();assert.equal(h.node('voiceDialog').open,true);h.choose('normal');assert.ok(h.events.includes('lapan-voice-enabled'));assert.equal(JSON.parse(storage.get('lapan-voice')).mode,'normal');h.ctx.localStorage.setItem=()=>{throw Error('blocked')};h.choose('less');assert.match(h.node('voiceStorage').textContent,/only for this visit/);
console.log('PASS: mode policy, legacy migration, filtering, explicit repeat, off cancellation, device-local persistence, reload, both entry points and storage failure');

storage.set('lapan-voice',JSON.stringify({mode:'less',voiceURI:'lapan-kokoro-emma'}));
h=harness({
 voicePacks:{'lapan-kokoro-heart':{label:'Kokoro Heart'}},
 createVoicePack:()=>({})
});
assert.equal(h.node('voiceChoice').value,'lapan-kokoro-heart');
assert.equal(h.ctx.LapanVoice.needsPreparation(),true);
assert.deepEqual(JSON.parse(storage.get('lapan-voice')),{mode:'less',enabled:true,voiceURI:'lapan-kokoro-heart',modeRevision:1});

const prepared=[];
const heart={label:'Kokoro Heart',language:'en'};
const malay={label:'Yasmin · Bahasa Melayu',language:'ms',note:'Reads directions and alerts in Bahasa Melayu.'};
h=harness({
 voicePacks:{'lapan-kokoro-heart':heart,'lapan-yasmin':malay},
 createVoicePack:config=>({prepare(){prepared.push(config.language);return Promise.resolve(true)}})
}, class {});
assert.deepEqual(prepared,[],'loading settings does not prepare either pack');
const options=()=>h.node('voiceChoice').children.map(option=>option.value);
assert.deepEqual(options(),['','lapan-kokoro-heart','s']);
h.language('ms');
assert.deepEqual(options(),['','lapan-yasmin','amira']);
assert.equal(h.node('voiceChoice').value,'lapan-yasmin','saved Heart uses the bundled Malay counterpart');
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay);
h.language('en');
assert.equal(h.ctx.LapanVoice.selectedVoice(),heart);
h.ctx.LapanVoice.unlock();
h.language('ms');
assert.deepEqual(options(),['','lapan-yasmin','amira']);
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay,'in-progress guidance follows the language switch');
h.ctx.LapanVoice.endTrip();
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay);
h.node('voiceChoice').value='lapan-yasmin';
h.node('voiceChoice').onchange();
assert.deepEqual(prepared,['ms','ms'],'the Malay pack is prepared when switching and selecting');
assert.equal(h.ctx.LapanVoice.selectedVoice(),malay);
assert.match(h.node('voiceNote').textContent,/Bahasa Melayu/);


const englishPack={voicePacks:{'lapan-kokoro-heart':heart},createVoicePack:()=>({})};
storage.delete('lapan-voice');
h=harness(englishPack,class {});
assert.equal(h.node('voiceChoice').value,'lapan-kokoro-heart','English defaults to Heart');
assert.equal(h.ctx.LapanVoice.needsPreparation(),true);
h.language('ms');
assert.equal(h.node('voiceChoice').value,'','Malay keeps its automatic device voice');
h.language('en');
h.node('voiceChoice').value='';
h.node('voiceChoice').onchange();
assert.equal(harness(englishPack,class {}).node('voiceChoice').value,'','explicit Auto survives reload');

storage.set('lapan-voice',JSON.stringify({mode:'off',modeRevision:1}));
h=harness(englishPack,class {});
assert.equal(h.node('voiceChoice').value,'lapan-kokoro-heart');
assert.equal(h.ctx.LapanVoice.needsPreparation(),false,'the default never overrides Off');
assert.equal(harness(englishPack).node('voiceChoice').value,'','use the device default without Web Audio');

for(const [language,voiceURI] of [['en','lapan-kokoro-heart'],['ms','lapan-yasmin']]){
 storage.set('lapan-voice',JSON.stringify({mode:'less',voiceURI}));
 h=harness({voicePacks:{'lapan-kokoro-heart':heart,'lapan-yasmin':malay},createVoicePack:()=>({prepare:async()=>true})},class {});
 h.language(language);
 h.ctx.LapanVoice.unlock();
 assert.equal(h.ctx.LapanVoice.selectedVoice(),language==='en'?heart:malay);
 const turn={},nextTurn={};
 h.ctx.LapanVoice.instruction('Distant turn','1:1',1,undefined,turn);
 h.ctx.LapanVoice.instruction('Turn ahead','1:2',2,undefined,turn);
 h.ctx.LapanVoice.instruction('Turn now','1:3',3,undefined,turn);
 h.ctx.LapanVoice.cancel();
 h.ctx.LapanVoice.instruction('Turn now','1:3',3,undefined,turn);
 h.ctx.LapanVoice.speak('Road hazard');
 assert.deepEqual(h.calls.map(call=>call.t),['Turn ahead','Road hazard']);
 h.ctx.LapanVoice.instruction('Next turn now','2:3',3,undefined,nextTurn);
 assert.equal(h.calls.at(-1)?.t,'Next turn now');
}

for(const [language,voiceURI] of [['en','lapan-kokoro-heart'],['ms','lapan-yasmin']]){
 storage.set('lapan-voice',JSON.stringify({mode:'normal',voiceURI,modeRevision:1}));
 h=harness({voicePacks:{'lapan-kokoro-heart':heart,'lapan-yasmin':malay},createVoicePack:()=>({prepare:async()=>true})},class {});
 h.language(language);
 h.ctx.LapanVoice.unlock();
 const voice=h.ctx.LapanVoice, turn={},nextTurn={};
 voice.instruction('Advance prompt','1:0',0,undefined,turn);
 voice.instruction('Another advance prompt','1:1',1,undefined,turn);
 voice.instruction('Near prompt','1:2',2,undefined,turn);
 voice.cancel();
 voice.instruction('Turn now','1:3',3,undefined,turn);
 voice.instruction('Same phrase','2:1',1,undefined,nextTurn);
 voice.instruction('Same phrase','2:2',2,undefined,nextTurn);
 voice.instruction('Turn now','2:3',3,undefined,nextTurn);
 voice.instruction('Turn now','3:3',3,undefined,{});
 voice.speak('Road hazard');
 assert.deepEqual(h.calls.map(call=>call.t),['Advance prompt','Near prompt','Same phrase','Turn now','Road hazard']);
}


(async()=>{
 storage.clear();
 const heard=[], loads=[];
 h=harness({
  voicePacks:{'lapan-kokoro-heart':heart,'lapan-yasmin':malay},
  createVoicePack:config=>({
   prepare(){loads.push(config.language);return Promise.resolve(true)},
   supports:()=>true
  })
 },class {});
 const voice=h.ctx.LapanVoice, sameTurn={};
 voice.unlock();
 voice.instruction('Turn right.','1:2',2,undefined,sameTurn);
 heard.push(voice.selectedVoice().language);
 const before=h.cancelled;
 voice.prepareLanguageSwitch('ms');
 assert.deepEqual(loads,['ms'],'prime audio from the language-button gesture');
 h.language('ms');
 assert.ok(h.cancelled>before,'cancel English speech and its repeat buffer');
 assert.equal(voice.instruction('Turn right.','1:2',2,undefined,sameTurn),false,'wait for the incoming audio');
 await Promise.resolve();
 assert.equal(voice.instruction('Turn right.','1:2',2,undefined,sameTurn),true,'allow the current turn in the new voice');
 heard.push(voice.selectedVoice().language);
 voice.prepareLanguageSwitch('en');
 h.language('en');
 await Promise.resolve();
 assert.equal(voice.instruction('Turn right.','1:2',2,undefined,sameTurn),true);
 heard.push(voice.selectedVoice().language);
 assert.deepEqual(heard,['en','ms','en']);
 assert.deepEqual(loads,['ms','en']);
 h.choose('off');
 h.language('ms');
 assert.equal(h.node('voice').value,'off');
 assert.deepEqual(loads,['ms','en'],'a language switch respects Off');
 console.log('PASS: live EN/BM round trip, current-turn reset and muted mode');
})().catch(error=>{console.error(error);process.exitCode=1});
