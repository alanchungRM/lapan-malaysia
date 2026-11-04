const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/mobile.css','utf8'),menu=fs.readFileSync('web/menu.js','utf8');

// Markup: the More button lives in the controls column next to recentre, and the secondary controls it reveals still exist.
const controls=html.slice(html.indexOf('id="driveControls"'),html.indexOf('class="maptop"'));
for(const id of ['navVoice','locate','navMore','navLang','driveMode','navRepeat','navAwake','driveLimit','speedChip'])assert.ok(controls.includes('id="'+id+'"'),id+' in driving controls');
assert.match(controls,/id="navMore"[^>]*aria-expanded="false"[^>]*aria-label="More driving controls"/);

// Styles: four secondary controls hide until the body has drive-more, and a camera alert outranks the limit-drop banner.
for(const id of ['driveMode','navRepeat','navAwake','openStops','navLang'])assert.ok(css.includes('body.guiding:not(.drive-more) #'+id),id+' hidden by default while driving');
assert.match(css,/#cameraWarning:not\(\.hidden\)~#limitWarning\{display:none\}/);
assert.ok(html.indexOf('id="cameraWarning"')<html.indexOf('id="limitWarning"'),'sibling rule needs the camera banner first');

// Behaviour: More toggles drive-more and aria-expanded, and finishing navigation closes it again.
const classes=new Set(),handlers={};let observer,attrs={};
const el=()=>({setAttribute(k,v){attrs[k]=v},onclick:null,addEventListener(){},querySelector:()=>null});
const tray=el(),timers=[];const more=el(),button=el(),panel={open:false,addEventListener(){},querySelector:()=>null,scrollIntoView(){}};
const document={body:{classList:{toggle:(c,on)=>{on?classes.add(c):classes.delete(c);return on},contains:c=>classes.has(c)}},getElementById:id=>({navMore:more,driveMore:tray,openMenu:button,moreOptions:panel})[id]||null,addEventListener:(k,fn)=>handlers[k]=fn};
vm.runInNewContext(menu,{document,window:{matchMedia:()=>({matches:false})},MutationObserver:class{constructor(fn){observer=fn}observe(){}},setTimeout:(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length},clearTimeout:id=>{if(timers[id-1])timers[id-1].live=false}});
handlers.DOMContentLoaded();
classes.add('guiding');more.onclick();assert.ok(classes.has('drive-more'));assert.equal(attrs['aria-expanded'],'true');
more.onclick();assert.ok(!classes.has('drive-more'));assert.equal(attrs['aria-expanded'],'false');
more.onclick();classes.delete('guiding');observer();assert.ok(!classes.has('drive-more'),'ending navigation resets the extra controls');
// The extra controls form a tray that can always be closed: tap elsewhere, Escape, or 12 seconds of nothing. Taps inside it keep it open.
const outside={target:{closest:()=>null}},inside={target:{closest:sel=>sel.includes('#driveMore')?{}:null}};let focused=false;more.focus=()=>focused=true;
classes.add('guiding');more.onclick();assert.ok(classes.has('drive-more'));handlers.pointerdown(inside);assert.ok(classes.has('drive-more'),'a tap inside the tray keeps it open');handlers.pointerdown(outside);assert.ok(!classes.has('drive-more'),'a tap elsewhere closes it');
more.onclick();handlers.keydown({key:'a'});assert.ok(classes.has('drive-more'));handlers.keydown({key:'Escape'});assert.ok(!classes.has('drive-more'),'Escape closes it');assert.ok(focused,'focus returns to the toggle');
more.onclick();const live=timers.filter(t=>t.live).at(-1);assert.equal(live.ms,12000);live.fn();assert.ok(!classes.has('drive-more'),'it closes itself after 12 seconds');
more.onclick();more.onclick();assert.ok(timers.filter(t=>t.live).length===0||timers.filter(t=>t.live).every(t=>t.ms===12000),'closing cancels the timer');assert.ok(!classes.has('drive-more'));
assert.match(html,/<div id="driveMore" role="group"[^>]*>(?:(?!<\/div>).)*id="navVoice"(?:(?!<\/div>).)*id="navLang"/s,'the extra controls sit inside the tray');
assert.ok(html.indexOf('id="driveMore"')<html.indexOf('id="locate"')&&html.indexOf('id="locate"')<html.indexOf('id="navMore"'),'recentre and the toggle stay outside the tray');
console.log('PASS: driving controls markup, hidden-by-default rules, camera banner priority, More toggle and reset on navigation end');
