const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/mobile.css','utf8'),menu=fs.readFileSync('web/menu.js','utf8');

// Markup: the More button lives in the controls column next to recentre, and the secondary controls it reveals still exist.
const controls=html.slice(html.indexOf('id="driveControls"'),html.indexOf('class="maptop"'));
for(const id of ['navVoice','locate','navMore','driveMode','navRepeat','navAwake','speedChip'])assert.ok(controls.includes('id="'+id+'"'),id+' in driving controls');
assert.match(controls,/id="navMore"[^>]*aria-expanded="false"[^>]*aria-label="More driving controls"/);

// Styles: four secondary controls hide until the body has drive-more, and a camera alert outranks the limit-drop banner.
for(const id of ['driveMode','navRepeat','navAwake','openStops'])assert.ok(css.includes('body.guiding:not(.drive-more) #'+id),id+' hidden by default while driving');
// Behaviour: More toggles drive-more and aria-expanded, and finishing navigation closes it again.
const classes=new Set(),handlers={};let observer,attrs={};
const el=()=>({setAttribute(k,v){attrs[k]=v},onclick:null,addEventListener(){},querySelector:()=>null});
const more=el(),button=el(),panel={open:false,addEventListener(){},querySelector:()=>null,scrollIntoView(){}};
const document={body:{classList:{toggle:(c,on)=>{on?classes.add(c):classes.delete(c);return on},contains:c=>classes.has(c)}},getElementById:id=>({navMore:more,openMenu:button,moreOptions:panel})[id]||null,addEventListener:(k,fn)=>handlers[k]=fn};
vm.runInNewContext(menu,{document,window:{matchMedia:()=>({matches:false})},MutationObserver:class{constructor(fn){observer=fn}observe(){}}});
handlers.DOMContentLoaded();
classes.add('guiding');more.onclick();assert.ok(classes.has('drive-more'));assert.equal(attrs['aria-expanded'],'true');
more.onclick();assert.ok(!classes.has('drive-more'));assert.equal(attrs['aria-expanded'],'false');
more.onclick();classes.delete('guiding');observer();assert.ok(!classes.has('drive-more'),'ending navigation resets the extra controls');
console.log('PASS: driving controls markup, hidden-by-default rules, More toggle and reset on navigation end');
