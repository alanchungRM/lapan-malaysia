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
root.LapanDirections={format};if(typeof module==='object')module.exports={format};
})(typeof window==='object'?window:globalThis);
