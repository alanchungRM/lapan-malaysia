(function(root){
if(!root.document)return;
const $=id=>document.getElementById(id);let enabled=false,active=false,lock=null,pending=false,epoch=0;
try{enabled=localStorage.getItem('lapan-awake')==='true'}catch{}
const supported=!!root.navigator.wakeLock;
function render(message){$('keepAwake').checked=enabled;$('keepAwake').disabled=!supported;$('awakeStatus').textContent=message||(!supported?'Screen wake lock is unavailable in this browser.':lock?'Screen will stay awake during navigation.':enabled?'Enabled for navigation. Keep this tab visible.':'Use your phone’s normal screen timeout.');$('navAwake').textContent=lock?'☀ On':'☀';$('navAwake').setAttribute('aria-pressed',String(enabled));$('navAwake').title=lock?'Screen awake · tap to turn off':'Keep screen awake';$('navAwake').disabled=!supported}
async function release(){epoch++;const old=lock;lock=null;if(old)try{await old.release()}catch{}render()}
async function acquire(){if(!supported||!enabled||!active||document.visibilityState!=='visible'||lock||pending)return;pending=true;const token=epoch;try{const next=await root.navigator.wakeLock.request('screen');if(token!==epoch||!enabled||!active||document.visibilityState!=='visible'){await next.release();return}lock=next;next.addEventListener('release',()=>{if(lock===next){lock=null;render('Screen awake paused by your phone. Tap the sun button to retry.')}});render()}catch{render('Could not keep the screen awake. Tap the sun button to retry.')}finally{pending=false;if(token!==epoch&&enabled&&active)acquire()}}
function set(value){enabled=value;try{localStorage.setItem('lapan-awake',String(enabled))}catch{}if(enabled){render();acquire()}else release()}
$('keepAwake').onchange=()=>set($('keepAwake').checked);$('navAwake').onclick=()=>{if(enabled&&!lock){acquire();return}set(!enabled)};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')acquire();else release()});root.addEventListener('pagehide',release);
root.LapanAwake={start(){active=true;acquire()},stop(){active=false;release()}};render();
})(typeof window==='object'?window:globalThis);
