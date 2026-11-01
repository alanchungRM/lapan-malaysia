(function(root){
function chunks(text){const words=String(text).replace(/\s+/g,' ').trim().split(' '),result=[];let part='';for(const word of words){if(part&&(part.length+word.length>115)){result.push(part);part=''}part+=(part?' ':'')+word}if(part)result.push(part);return result}
function createVoice({synth,Utterance,voice=()=>null,requireVoice=false,onStatus=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}){
let active=null,pending=null,last=null,timer=null,delay=null,generation=0,blocked=false,readyAt=0;
const clear=()=>{clearTimer(timer);timer=null};
function status(value){blocked=value==='blocked';onStatus(value)}
function finish(job){if(active!==job)return;clear();active=null;status('ready');pump()}
function resetNative(){readyAt=now()+200;try{synth.cancel();synth.resume?.()}catch{}}
function retry(job,error){if(active!==job)return;clear();const denied=error==='not-allowed'||error==='language-unavailable'||error==='synthesis-unavailable';if(!denied&&job.attempt<1){job.attempt++;generation++;job.utterance=null;resetNative();const token=generation;delay=setTimer(()=>{delay=null;if(token===generation&&active===job)play(job)},200);return}active=null;status('blocked');if(pending)pump()}
function play(job){if(active!==job)return;const token=++generation;const v=job.voice||voice();if(v)job.voice=v;
if(requireVoice&&!v){status('loading');job.voiceWait=(job.voiceWait||0)+1;if(job.voiceWait>24){active=null;status('blocked');pump();return}clear();timer=setTimer(()=>{if(currentJob(job,token))play(job)},250);return}
const u=new Utterance(job.parts[job.index]);job.utterance=u;if(v){u.voice=v;u.lang=v.lang}else u.lang='en-GB';u.rate=.95;let started=false;
const current=()=>active===job&&token===generation&&job.utterance===u;
u.onstart=()=>{if(!current())return;started=true;status('speaking');clear();timer=setTimer(()=>{if(current())retry(job,'timeout')},Math.max(10000,Math.min(25000,u.text.split(' ').length*600+8000)))};
u.onend=()=>{if(!current())return;clear();job.utterance=null;job.index++;job.attempt=0;if(job.index<job.parts.length){delay=setTimer(()=>{delay=null;if(currentJob(job,token))play(job)},80)}else finish(job)};
u.onerror=e=>{if(current())retry(job,e.error||'synthesis-failed')};clear();timer=setTimer(()=>{if(current()&&!started)retry(job,'start-timeout')},6000);try{if(synth.paused)synth.resume();synth.speak(u)}catch{retry(job,'synthesis-failed')}
}
function currentJob(job,token){return active===job&&token===generation}
function pump(){if(active||!pending)return;if(now()<readyAt){if(delay===null)delay=setTimer(()=>{delay=null;pump()},Math.max(1,readyAt-now()));return}const job=pending;pending=null;if(now()-job.at>30000)return;active=job;play(job)}
function speak(text,{key=text}={}){if(!synth||!Utterance||!String(text).trim())return false;if(active?.key===key||pending?.key===key)return true;const job={text:String(text),key,parts:chunks(text),index:0,attempt:0,at:now(),utterance:null};last={text:job.text,key};pending=job;pump();return true}
function cancel(){const hadSpeech=!!active||!!pending||synth?.speaking||synth?.pending;generation++;clear();clearTimer(delay);delay=null;active=null;pending=null;last=null;if(hadSpeech)resetNative();status('ready')}
function repeat(){if(!last)return false;const copy={...last};cancel();return speak(copy.text,{key:copy.key})}
function resume(){if(synth?.paused)synth.resume();if(active?.utterance&&!synth.speaking&&!synth.pending)retry(active,'interrupted');else pump()}
return {speak,cancel,repeat,resume,get blocked(){return blocked}};
}
if(typeof module==='object')module.exports={chunks,createVoice};root.LapanSpeech={chunks,createVoice};
})(typeof window==='object'?window:globalThis);
