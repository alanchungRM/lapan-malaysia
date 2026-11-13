const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createVoicePack,createClipSelector}=require('../web/voice-pack.js');
const {createVoice}=require('../web/voice.js');
const {prompt}=require('../web/directions.js');
const index=require('../web/voice-pack-heart.json');
const bytes=fs.readFileSync('web/voice-pack-heart.bin');
const turn=prompt({maneuver:{type:'turn',modifier:'right'}},350);
assert.ok(index[turn]);
for(const [offset,length] of Object.values(index)) {
 assert.ok(offset>=0&&length>0&&offset+length<=bytes.length);
 assert.equal(bytes.subarray(offset,offset+3).toString(),'ID3');
}

const select=createClipSelector(index);
const dynamic=prompt({maneuver:{type:'turn',modifier:'right'},ref:'E11A'},350);
assert.deepEqual(select(dynamic),['In 350 metres, turn right.','route','#e','#11','#a']);

function checkDistances(selectClips) {
 const right={maneuver:{type:'turn',modifier:'right'},ref:'E11A'};
 for (const distance of [25,70,105,285,350,995,1200,3750,5000]) {
  const text=prompt(right,distance);
  const prefix=text.slice(0,text.indexOf(',')+1);
  assert.ok(selectClips(text)[0]?.startsWith(prefix),text);
 }
 assert.deepEqual(selectClips(prompt(right,12750)).slice(0,6),['In','#12','#point','#8','kilometres','Turn right.']);
}
checkDistances(select);

const {describe:camera}=require('../web/cameras.js');
const {describe:hazard}=require('../web/hazards.js');
const {describe:report,KINDS}=require('../web/reports.js');
const samples=[
 ...['redlight','average','speed'].flatMap(kind=>[camera(kind,178,80,true).voice,camera(kind,148,0,false).voice]),
 ...['toll','rail','curve','bump'].map(kind=>hazard({kind,side:'right',count:2},333).voice),
 ...KINDS.map(kind=>report({kind,remaining:148,ageSeconds:0}).voice),
 'Speed limit drops to 80 in 450 metres.', 'Slow down. Speed limit 90.',
 'Let’s get started.', 'You have arrived at your destination.', 'Route updated. Follow the highlighted route.'
];
for (const type of ['turn','end of road','continue','merge','fork','on ramp','off ramp','roundabout','roundabout turn','exit roundabout','arrive','depart']) {
 for (const modifier of ['left','right','slight left','sharp right','straight','uturn']) {
  const step={ref:'E13/4A',maneuver:{type,modifier,exit:12},exits:'205B'};
  for (const distance of [18,85,350,1250,12750]) samples.push(prompt(step,distance));
 }
}
for (const text of samples) assert.ok(select(text).length,text);
assert.deepEqual(select('Unknown prompt'),[]);

async function test(index,bytes,language){
 let downloads=0, decodes=0, devicePrompts=0;
 const sources=[];
 const samples=new Float32Array(500).fill(0.2,100,400);
 class Context {
  state='running';
  sampleRate=1000;
  destination={};
  async decodeAudioData(){decodes++;return {sampleRate:1000,getChannelData:()=>samples}}
  createBuffer(channels,length,sampleRate){
   const data=new Float32Array(length);
   return {duration:length/sampleRate,getChannelData:()=>data};
  }
  createBufferSource(){
   const source={connect(){},disconnect(){},start(){sources.push(this)},stop(){}};
   return source;
  }
 }
 const pack=createVoicePack({AudioContext:Context,index,language,fetchAudio:async()=>{
  downloads++;
  if(downloads===1)return {ok:false};
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 }});
 assert.equal(downloads,0,'constructing the voice must not download it');
 assert.equal(await pack.prepare(),false);
 assert.deepEqual(await Promise.all([pack.prepare(),pack.prepare()]),[true,true]);
 assert.equal(downloads,2);
 assert.equal(decodes,Object.keys(index).length);
 const engine=createVoice({
  synth:{speak(){devicePrompts++}},Utterance:class{},
  playClip:pack.play,useDeviceVoice:()=>false
 });
 engine.speak(dynamic);
 assert.equal(sources.length,1);
 const joined=sources[0].buffer.getChannelData(0);
 const partLength=316;
 assert.equal(joined.length,partLength*createClipSelector(index,language)(dynamic).length);
 assert.ok(joined[partLength-9]>0);
 assert.ok(joined[partLength+8]>0);
 sources[0].onended();
 engine.speak(turn);
 assert.equal(sources.length,2);
 assert.equal(sources[1].buffer.getChannelData(0).length,partLength);
 sources[1].onended();
 engine.speak('Unknown prompt');
 assert.equal(engine.blocked,true);
 assert.equal(devicePrompts,0);
 assert.equal(downloads,2);
 assert.equal(decodes,Object.keys(index).length);
}
test(index,bytes,'en')
 .catch(error=>{console.error(error);process.exitCode=1});
