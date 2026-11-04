(function(root){
const clean=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
const signs=value=>[...new Set(clean(value).split(';').map(s=>s.trim()).filter(Boolean))].join(' / ');
function ordinal(n){const x=n%100;return n+(x>=11&&x<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th')}
// Text comes from one template per manoeuvre. English is unchanged. In Malay (display) or when a Malay voice speaks, the structured manoeuvre is
// used instead of TomTom's English sentence, so the words are consistent and need no translation service.
const fill=(text,vars)=>vars?text.replace(/\{(\w+)\}/g,(x,k)=>k in vars?vars[k]:x):text;
function words(speech){const i=root.LapanI18n,on=!i?false:speech?i.speechLang()==='ms':i.lang()==='ms';return {on,T:(key,vars)=>on?i.t(key,vars):fill(key,vars)}}
function format(step={},speech=false){const {on,T}=words(speech);if(!on&&clean(step.instruction))return clean(step.instruction);const m=step.maneuver||{},type=clean(m.type).replaceAll('_',' '),direction=clean(m.modifier),name=clean(step.name),ref=signs(step.ref),exit=signs(step.exits),toward=signs(step.destinations);let action='';
if(type==='arrive')return T('Arrive at your destination');
if(type==='depart')action=T('Head onto');
else if(type==='off ramp')action=exit?T('Take exit {n}',{n:exit}):T('Take the exit');
else if(type==='on ramp')action=T('Take the ramp');
else if(type==='merge')action=T('Merge');
else if(type==='fork')action=T('Keep');
else if(type==='roundabout'||type==='rotary')action=Number.isInteger(m.exit)&&m.exit>0?T('At the roundabout, take the {ordinal} exit',{ordinal:ordinal(m.exit),n:m.exit}):T('Enter the roundabout');
else if(type==='roundabout turn')action=T('At the roundabout, turn');
else if(type==='exit roundabout'||type==='exit rotary')action=T('Exit the roundabout');
else if(type==='turn'||type==='end of road')action=direction==='uturn'?T('Make a U-turn'):T('Turn');
else if(type==='continue'||type==='new name'||type==='notification'||!type)action=T('Continue');
else action=T('Turn');
if(direction&&direction!=='uturn'&&!(on&&type==='depart')&&!['roundabout','rotary','exit roundabout','exit rotary'].includes(type))action+=' '+T(direction);
if(exit&&type!=='off ramp'&&!['roundabout','rotary','roundabout turn','exit roundabout','exit rotary'].includes(type))action+=' · '+T('Exit {x}',{x:exit});
const road=[ref,name&&name.toLowerCase()!==ref.toLowerCase()?name:''].filter(Boolean).join(' · ');if(road)action+=' · '+road;if(toward&&toward.toLowerCase()!==name.toLowerCase())action+=' '+T('toward {x}',{x:toward});return action;
}
// Speech uses structured manoeuvres and signed numbers, never long street names or destinations.
function speech(step={}){const numbered=value=>clean(value).split(';').map(s=>s.trim()).filter(s=>/^(?:[A-Za-z]{0,3}\s*)?\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?$/.test(s)).slice(0,2).join(';');const ref=numbered(step.ref),exits=numbered(step.exits),short={...step,instruction:'',name:'',destinations:'',ref:'',exits};const {T}=words(true);let text=format(short,true);if(text===T('Head onto'))text=T('Continue');if(ref&&step.maneuver?.type!=='arrive')text+=', '+T('route {x}',{x:signs(ref)});return text.replaceAll(' · ', ', ')}
// Highlight only route/exit references supplied by the selected route step.
function badges(step={},message=format(step)){
 const type=clean(step.maneuver?.type).replaceAll('_',' ');
 if(type==='arrive')return [{text:message}];
 const numbers=value=>[...new Set(clean(value).split(';').map(v=>v.trim()).filter(v=>/^(?:[A-Za-z]{0,3}\s*)?\d{1,5}[A-Za-z]?(?:[-/]\d{1,5}[A-Za-z]?)?$/.test(v)))].slice(0,4);
 const refs=numbers(step.ref).map(text=>({text,kind:'road'}));
 const exits=/roundabout|rotary/.test(type)?[]:numbers(clean(step.exits).replace(/^(?:exit|keluar)\s+/i,'')).map(text=>({text:words(false).T('EXIT')+' '+text,number:text,kind:'exit'}));
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
// Turn arrows for the driving banner. Own artwork, drawn with strokes so they take the banner's text colour.
const svg=body=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
const ICONS={straight:svg('<path d="M12 21V4"/><path d="M5.5 10.5L12 4l6.5 6.5"/>'),right:svg('<path d="M6 21v-7a4 4 0 0 1 4-4h9"/><path d="M14.5 5.5L19 10l-4.5 4.5"/>'),left:svg('<path d="M18 21v-7a4 4 0 0 0-4-4H5"/><path d="M9.5 5.5L5 10l4.5 4.5"/>'),uturn:svg('<path d="M7 21V9.5a4.5 4.5 0 0 1 9 0V16"/><path d="M12.5 12.5L16 16.5l3.5-4"/>'),'fork-right':svg('<path d="M8 21v-5l8-8"/><path d="M10 6h6v6"/>'),'fork-left':svg('<path d="M16 21v-5L8 8"/><path d="M14 6H8v6"/>'),roundabout:svg('<circle cx="12" cy="14" r="4" stroke-width="2.2"/><path d="M12 22v-4" stroke-width="2.2"/><path d="M12 10V3.2" stroke-width="2.2"/><path d="M8.6 6.4L12 3l3.4 3.4" stroke-width="2.2"/>'),arrive:svg('<path d="M6 21V4"/><path d="M6 5h12l-3 4 3 4H6"/>')};
function iconName(step={}){
 const m=step.maneuver||{},type=clean(m.type).replaceAll('_',' '),mod=clean(m.modifier),side=/\bleft\b/.test(mod)?'left':/\bright\b/.test(mod)?'right':'';
 if(type==='arrive')return 'arrive';if(/roundabout|rotary/.test(type))return 'roundabout';if(mod==='uturn')return 'uturn';
 if(type==='fork'||/ramp/.test(type))return side==='left'?'fork-left':side==='right'?'fork-right':'straight';
 return side||'straight';
}
// Expressways and their ramps are signed green in Malaysia, other roads blue.
const expressway=(step={})=>/(^|;)\s*(?:E|AH)\s?\d/i.test(clean(step.ref))||/ramp/.test(clean(step.maneuver?.type).replaceAll('_',' '))||!!clean(step.exits);
function render(node,step,message){
 let parts=badges(step,message);
 const lead=step&&step.maneuver&&typeof message==='string'?parts[0]&&!parts[0].kind&&parts[0].text.match(/^(\d+(?:\.\d+)?\s*(?:m|km))(\s*·\s*)/):null;
 if(lead)parts=[{kind:'dist',text:lead[1]},{kind:'sep',text:lead[2]},...(parts[0].text.length>lead[0].length?[{text:parts[0].text.slice(lead[0].length)}]:[]),...parts.slice(1)];
 const icon=lead?iconName(step):'',text=parts.map(part=>part.text).join(''),key=JSON.stringify([parts,icon]);
 if(badgeRenders.get(node)===key&&node.textContent===text)return;
 const doc=node.ownerDocument||root.document;
 const panel=node.closest?.('.navpanel');if(panel&&panel.dataset)panel.dataset.road=lead&&expressway(step)?'expressway':'road';
 const lead_nodes=[];if(icon){const holder=doc.createElement('span');holder.className='turn-icon';holder.innerHTML=ICONS[icon];lead_nodes.push(holder)}
 node.replaceChildren(...lead_nodes,...parts.map(part=>{if(!part.kind)return doc.createTextNode(part.text);if(part.kind==='dist'||part.kind==='sep'){const piece=doc.createElement('span');piece.className='turn-'+part.kind;piece.textContent=part.text;return piece}const badge=doc.createElement('span');badge.className='nav-road-badge nav-road-badge--'+part.kind;badge.textContent=part.text;badge.title=words(false).T(part.kind==='exit'?'Signed exit number':'Signed road number');return badge}));badgeRenders.set(node,key);
}
root.LapanDirections={format,speech,badges,render,iconName,expressway};if(typeof module==='object')module.exports={format,speech,badges,render,iconName,expressway,ICONS};
})(typeof window==='object'?window:globalThis);
