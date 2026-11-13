(function(root){
const voicePacks = /* VOICE_PACKS */ {};

function words(text) {
 return text.toLowerCase().replace(/[’']/g,'').match(/[a-z]+(?:-[a-z]+)*|\d+(?:\.\d+)?(?:st|nd|rd|th)?|[-/]/g)||[];
}
function numberClips(token,index) {
 if (token.length>12) return [];
 const exact='#'+token;
 if (Object.hasOwn(index,exact)) return [exact];
 const ordinal=token.match(/^(\d+)(st|nd|rd|th)$/);
 if (ordinal) {
  const n=Number(ordinal[1]),ones=n%10;
  if (n>20&&n<100&&ones) return ['#'+(n-ones),'#'+ones+ordinal[2]];
  return [];
 }
 if (token.includes('.')) {
  const [whole,fraction]=token.split('.');
  const integer=numberClips(whole,index);
  return integer.length?[...integer,'#point',...Array.from(fraction,digit=>'#'+digit)]:[];
 }
 if (/^0\d/.test(token)) return Array.from(token,digit=>'#'+digit);
 const n=Number(token);
 if (n<20) return [];
 if (n<100) return ['#'+(n-n%10),'#'+(n%10)];
 const unit=n>=1000?1000:100;
 const multiple='#'+(n-n%unit);
 const prefix=Object.hasOwn(index,multiple)?[multiple]:
  [...numberClips(String(Math.floor(n/unit)),index),unit===1000?'#thousand':'#hundred'];
 return [...prefix,...(n%unit?numberClips(String(n%unit),index):[])];
}

function createClipSelector(index,language) {
 const phrases=new Map();
 for (const key of Object.keys(index)) {
  if (!key.startsWith('#')) phrases.set(words(key).join(' '),key);
 }
 const longest=Math.max(0,...Array.from(phrases.keys(),key=>key.split(' ').length));
 return text=>{
  if (Object.hasOwn(index,text)) return [text];
  const phrase=language==='ms'?text.replace(/take the (\d+)(?:st|nd|rd|th) exit/gi,'take exit $1'):text;
  const tokens=words(phrase), result=[];
  for (let at=0;at<tokens.length;) {
   let end=Math.min(at+longest,tokens.length), key;
   for (;end>at;end--) {
    key=phrases.get(tokens.slice(at,end).join(' '));
    if (key) break;
   }
   if (key) {
    result.push(key);
    at=end;
    continue;
   }
   const token=tokens[at++];
   if (/^\d/.test(token)) {
    const numbers=numberClips(token,index);
    if (!numbers.length) return [];
    result.push(...numbers);
   }
   else if (token==='-'||token==='/') result.push(token==='-'?'#dash':'#slash');
   else if (/^[a-z]{1,3}$/.test(token)&&(/\d/.test(tokens[at]||'')||/\d/.test(tokens[at-2]||''))) {
    result.push(...Array.from(token,letter=>'#'+letter));
   } else return [];
  }
  return result.every(key=>Object.hasOwn(index,key))?result:[];
 };
}

function clipSamples(buffer) {
 const samples=buffer.getChannelData(0), margin=Math.ceil(buffer.sampleRate*0.008);
 let first=0, last=samples.length-1;
 while (first<=last && Math.abs(samples[first])<0.002) first++;
 if (first>last) return samples;
 while (last>first && Math.abs(samples[last])<0.002) last--;
 return samples.subarray(Math.max(0,first-margin),Math.min(samples.length,last+1+margin));
}

function createVoicePack({AudioContext, fetchAudio, url, index={}, language}) {
 let context, preparation, clips;
 const select=createClipSelector(index,language);

 function prepare() {
  if (!AudioContext) return Promise.resolve(false);
  try {
   context ||= new AudioContext();
  } catch {
   return Promise.resolve(false);
  }
  // Start resume inside the user gesture, before waiting on the network.
  let resume;
  try {
   resume=context.state==='running'?Promise.resolve():context.resume();
  } catch {
   return Promise.resolve(false);
  }
  if (!preparation) {
   preparation=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    let bytes;
    try {
     const response=await fetchAudio(url,{signal:controller.signal});
     if (!response.ok) throw Error('Voice download failed');
     bytes=await response.arrayBuffer();
    } finally {
     clearTimeout(timeout);
    }
    const entries=Object.entries(index);
    const decoded=new Map();
    for (let at=0;at<entries.length;at+=8) {
     await Promise.all(entries.slice(at,at+8).map(async ([key,[offset,length]])=>{
      const audio=await context.decodeAudioData(bytes.slice(offset,offset+length));
      decoded.set(key,clipSamples(audio));
     }));
    }
    clips=decoded;
    return true;
   })().catch(()=>{preparation=null;return false});
  }
  return new Promise(resolve=>{
   const timer=setTimeout(()=>resolve(false),25000);
   Promise.all([preparation,resume]).then(
    ([ready])=>{clearTimeout(timer);resolve(ready&&context.state==='running')},
    ()=>{clearTimeout(timer);resolve(false)}
   );
  });
 }

 function play(text,{onStart,onEnd}) {
  const keys=select(text);
  if (!clips||context.state!=='running'||!keys.length) return null;
  const parts=keys.map(key=>clips.get(key));
  const buffer=context.createBuffer(1,parts.reduce((size,part)=>size+part.length,0),context.sampleRate);
  const samples=buffer.getChannelData(0);
  let offset=0;
  for (const part of parts) {
   samples.set(part,offset);
   offset+=part.length;
  }
  const source=context.createBufferSource();
  source.buffer=buffer;
  source.connect(context.destination);
  source.onended=()=>{source.disconnect();onEnd()};
  try {
   source.start();
  } catch {
   source.disconnect();
   return null;
  }
  onStart(buffer.duration);
  return ()=>{
   source.onended=null;
   try {source.stop()} catch {}
   source.disconnect();
  };
 }

 return {play,prepare,supports:text=>select(text).length>0};
}

if(typeof module==='object')module.exports={createVoicePack,createClipSelector};
root.LapanVoicePack={createVoicePack,voicePacks};
})(typeof window==='object'?window:globalThis);
