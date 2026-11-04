// Driving screen helpers: the trip line is split into parts (arrival time, duration, distance) so the look can give each its own size.
(function(root){
const TRIP=/^ETA (\d{1,2}:\d{2})([\s\u202f\u00a0]*[ap]\.?m\.?)? · (.+?) · (.+)$/i;
// "ETA 8:01 am · 44 min · 30 km" keeps exactly the same text; only the wrapping changes.
function parse(text){const m=String(text).match(TRIP);return m?{label:'ETA ',time:m[1],meridiem:m[2]||'',duration:m[3],distance:m[4]}:null}
function paintTrip(node,text){
 if(node.dataset&&node.dataset.trip===text)return;
 const doc=node.ownerDocument||root.document,t=parse(text);
 if(node.dataset)node.dataset.trip=text;
 if(!t){node.textContent=text;return}
 const span=(cls,value,tag='span')=>{const e=doc.createElement(tag);e.className=cls;e.textContent=value;return e};
 const time=span('eta-time','');time.append(span('','' + t.time,'b'));if(t.meridiem)time.append(span('eta-ampm',t.meridiem,'small'));
 node.replaceChildren(span('eta-label',t.label),time,span('eta-sep',' · '),span('eta-dur',t.duration),span('eta-sep',' · '),span('eta-dist',t.distance));
}
const api={parse,paintTrip};if(typeof module==='object')module.exports=api;root.LapanDriveUI=api;
})(typeof window==='object'?window:globalThis);
