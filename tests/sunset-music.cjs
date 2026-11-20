const assert=require('node:assert/strict');
const {createSunsetMusic}=require('../web/sunset-music.js');

async function checkMusic(){
 const sources=[];
 const contexts=[];
 const volumeChanges=[];
 const requests=[];
 let allowAudio;
 class AudioContext {
  constructor(){
   this.state='suspended';
   this.currentTime=0;
   this.destination={};
   this.resumed=new Promise(resolve=>{allowAudio=()=>{this.state='running';resolve()}});
   contexts.push(this);
  }
  resume(){return this.resumed}
  createGain(){
   this.gain={
    gain:{value:1,setTargetAtTime:level=>volumeChanges.push(level)},
    connect:destination=>assert.equal(destination,this.destination),
    disconnect(){}
   };
   return this.gain;
  }
  async decodeAudioData(){return {duration:146}}
  createBufferSource(){
   const source={
    connect:gain=>assert.equal(gain,this.gain),
    start(when,offset){this.offset=offset},
    stop(){this.stopped=true},
    disconnect(){}
   };
   sources.push(source);
   return source;
  }
  async close(){this.state='closed'}
 }
 const player=createSunsetMusic({
  AudioContext,
  fetchAudio:async(url,{signal})=>{
   assert.equal(url,'/sunset-music.m4a');
   requests.push(signal);
   return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};
  },
  url:'/sunset-music.m4a'
 });
 player.setVolume(.35);
 let waits=0;
 const waiting=()=>{waits++};
 const first=player.play(waiting);
 assert.equal(waits,1);
 assert.equal(contexts[0].gain.gain.value,.35);
 assert.equal(sources.length,0);
 const second=player.play(waiting);
 allowAudio();
 assert(await first);
 assert(await second);
 assert.equal(sources.length,1);
 assert.equal(requests.length,1);
 assert.equal(sources[0].loop,true);
 player.setVolume(.2);
 player.setVolume(0);
 assert.deepEqual(volumeChanges,[.2,0]);
 assert.equal(sources.length,1,'changing volume keeps the current loop playing');

 contexts[0].currentTime=16;
 player.pause();
 assert.equal(sources[0].stopped,true);
 assert(await player.play(waiting));
 assert.equal(sources[1].offset,16);
 assert.equal(requests.length,1);
 player.release();
 assert.equal(contexts[0].state,'closed');
 assert.equal(sources[1].stopped,true);
 assert.equal(requests[0].aborted,true);

 const hidden=player.play(waiting);
 player.pause();
 allowAudio();
 assert.equal(await hidden,false);
 assert.equal(sources.length,2,'pending playback stays stopped after backgrounding');
 player.release();
 console.log('PASS: volume controls the playing audio graph, looping, autoplay, preserving position, and close cleanup');
}
checkMusic().catch(error=>{console.error(error);process.exitCode=1});
