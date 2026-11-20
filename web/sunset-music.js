(function(root){
function createSunsetMusic({AudioContext,Audio,fetchAudio,onError,url}){
 let session=null,level=1;

 function open(){
  if(AudioContext){
   let context;
   try{
    try{context=new AudioContext({sampleRate:24000})}catch{context=new AudioContext()}
    const gain=context.createGain();
    gain.gain.value=level;
    gain.connect(context.destination);
    return {context,gain,offset:0,requested:false,abort:new AbortController()};
   }catch{context?.close().catch(()=>{})}
  }
  const track=new Audio(url);
  track.loop=true;
  track.volume=level;
  track.muted=level===0;
  const native={track,requested:false};
  track.addEventListener('play',()=>{if(!native.requested)track.pause()});
  track.addEventListener('error',()=>{if(session===native&&native.requested)onError()});
  return native;
 }

 async function load(current){
  const response=await fetchAudio(url,{signal:current.abort.signal});
  if(!response.ok)throw new Error('Background music could not load');
  return current.context.decodeAudioData(await response.arrayBuffer());
 }

 async function play(onWaiting){
  const current=session??=open();
  current.requested=true;
  if(current.track){
   try{await current.track.play()}catch(error){if(session===current&&current.requested)throw error}
   return session===current&&current.requested;
  }
  const {context}=current;
  try{
   if(context.state!=='running'){
    onWaiting();
    await context.resume();
   }
   if(session!==current||!current.requested)return false;
   const buffer=await (current.loading??=load(current));
   if(session!==current||!current.requested)return false;
   if(!current.source){
    const source=context.createBufferSource();
    source.buffer=buffer;
    source.loop=true;
    source.connect(current.gain);
    source.start(0,current.offset);
    current.startedAt=context.currentTime;
    current.source=source;
   }
   return true;
  }catch(error){
   if(session!==current||!current.requested)return false;
   throw error;
  }
 }

 function pause(){
  if(!session)return;
  session.requested=false;
  if(session.track){session.track.pause();return}
  const {context,source}=session;
  if(!source)return;
  session.offset=(session.offset+context.currentTime-session.startedAt)%source.buffer.duration;
  source.stop();
  source.disconnect();
  session.source=null;
 }

 function release(){
  if(!session)return;
  pause();
  const current=session;
  session=null;
  if(current.track){
   current.track.removeAttribute('src');
   current.track.load();
  }else{
   current.abort.abort();
   current.gain.disconnect();
   current.context.close().catch(()=>{});
  }
 }

 function setVolume(value){
  level=value;
  if(session?.gain)session.gain.gain.setTargetAtTime(level,session.context.currentTime,.015);
  if(session?.track){
   session.track.volume=level;
   session.track.muted=level===0;
  }
 }

 return {play,pause,release,setVolume};
}
if(typeof module==='object')module.exports={createSunsetMusic};
root.LapanSunsetMusic={createSunsetMusic};
})(typeof window==='object'?window:globalThis);
