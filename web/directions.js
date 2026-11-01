(function(root){
const clean=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
const signs=value=>[...new Set(clean(value).split(';').map(s=>s.trim()).filter(Boolean))].join(' / ');
function ordinal(n){const x=n%100;return n+(x>=11&&x<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th')}
function format(step={}){if(clean(step.instruction))return clean(step.instruction);const m=step.maneuver||{},type=clean(m.type).replaceAll('_',' '),direction=clean(m.modifier),name=clean(step.name),ref=signs(step.ref),exit=signs(step.exits),toward=signs(step.destinations);let action='';
if(type==='arrive')return 'Arrive at your destination';
if(type==='depart')action='Head onto';
else if(type==='off ramp')action=exit?'Take exit '+exit:'Take the exit';
else if(type==='on ramp')action='Take the ramp';
else if(type==='merge')action='Merge';
else if(type==='fork')action='Keep';
else if(type==='roundabout'||type==='rotary')action=Number.isInteger(m.exit)&&m.exit>0?'At the roundabout, take the '+ordinal(m.exit)+' exit':'Enter the roundabout';
else if(type==='roundabout turn')action='At the roundabout, turn';
else if(type==='exit roundabout'||type==='exit rotary')action='Exit the roundabout';
else if(type==='turn'||type==='end of road')action=direction==='uturn'?'Make a U-turn':'Turn';
else if(type==='continue'||type==='new name'||type==='notification'||!type)action='Continue';
else action='Turn';
if(direction&&direction!=='uturn'&&!['roundabout','rotary','exit roundabout','exit rotary'].includes(type))action+=' '+direction;
if(exit&&type!=='off ramp'&&!['roundabout','rotary','roundabout turn','exit roundabout','exit rotary'].includes(type))action+=' · Exit '+exit;
const road=[ref,name&&name.toLowerCase()!==ref.toLowerCase()?name:''].filter(Boolean).join(' · ');if(road)action+=' · '+road;if(toward&&toward.toLowerCase()!==name.toLowerCase())action+=' toward '+toward;return action;
}
// Speech uses structured manoeuvres and signed numbers, never long street names or destinations.
function speech(step={}){const numbered=value=>clean(value).split(';').map(s=>s.trim()).filter(s=>/^(?:[A-Za-z]{0,3}\s*)?\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?$/.test(s)).slice(0,2).join(';');const ref=numbered(step.ref),exits=numbered(step.exits),short={...step,instruction:'',name:'',destinations:'',ref:'',exits};let text=format(short);if(text==='Head onto')text='Continue';if(ref&&step.maneuver?.type!=='arrive')text+=', route '+signs(ref);return text.replaceAll(' · ', ', ')}
// Highlight only route/exit references supplied by the selected route step.
function badges(step={},message=format(step)){
 const type=clean(step.maneuver?.type).replaceAll('_',' ');
 if(type==='arrive')return [{text:message}];
 const numbers=value=>[...new Set(clean(value).split(';').map(v=>v.trim()).filter(v=>/^(?:[A-Za-z]{0,3}\s*)?\d{1,5}[A-Za-z]?(?:[-/]\d{1,5}[A-Za-z]?)?$/.test(v)))].slice(0,4);
 const refs=numbers(step.ref).map(text=>({text,kind:'road'}));
 const exits=/roundabout|rotary/.test(type)?[]:numbers(clean(step.exits).replace(/^(?:exit|keluar)\s+/i,'')).map(text=>({text:'EXIT '+text,number:text,kind:'exit'}));
 if(!refs.length&&!exits.length)return [{text:message}];
 // The distance at the beginning of the banner is never a signed road number.
 const prefix=message.match(/^\d+(?:\.\d+)?\s*(?:m|km)\s*·\s*/)?.[0]||'',body=message.slice(prefix.length),hits=[];
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const sign of [...exits,...refs]){
  const value=sign.number||sign.text,numberPattern=escape(value).replace(/\s+/g,'\\s*');
  const pattern=sign.kind==='exit'?'(?:exit|keluar)\\s+'+numberPattern:numberPattern;
  const re=new RegExp('(^|[^\\p{L}\\p{N}/-])('+pattern+')(?=$|[^\\p{L}\\p{N}/-])','giu');let match;
  while((match=re.exec(body))){const start=match.index+match[1].length,end=start+match[2].length;
   if(!hits.some(hit=>start<hit.end&&end>hit.start))hits.push({start,end,...sign});
  }
 }
 hits.sort((a,b)=>a.start-b.start);const parts=prefix?[{text:prefix}]:[],used=new Set();let at=0;
 for(const hit of hits){if(hit.start>at)parts.push({text:body.slice(at,hit.start)});const key=hit.kind+':'+hit.text.toUpperCase();parts.push(used.has(key)?{text:body.slice(hit.start,hit.end)}:{text:hit.text,kind:hit.kind});used.add(key);at=hit.end}
 if(at<body.length)parts.push({text:body.slice(at)});
 for(const sign of [...exits,...refs]){const key=sign.kind+':'+sign.text.toUpperCase();if(!used.has(key)){parts.push({text:' '},{text:sign.text,kind:sign.kind});used.add(key)}}
 return parts;
}
const badgeRenders=new WeakMap();
function render(node,step,message){
 const parts=badges(step,message),text=parts.map(part=>part.text).join(''),key=JSON.stringify(parts);
 if(badgeRenders.get(node)===key&&node.textContent===text)return;
 const doc=node.ownerDocument||root.document;
 node.replaceChildren(...parts.map(part=>{if(!part.kind)return doc.createTextNode(part.text);const badge=doc.createElement('span');badge.className='nav-road-badge nav-road-badge--'+part.kind;badge.textContent=part.text;badge.title=part.kind==='exit'?'Signed exit number':'Signed road number';return badge}));badgeRenders.set(node,key);
}
root.LapanDirections={format,speech,badges,render};if(typeof module==='object')module.exports={format,speech,badges,render};
})(typeof window==='object'?window:globalThis);
