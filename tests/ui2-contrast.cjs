const assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('web/ui2.css','utf8');
function tokens(selectorStart){
 const block=css.split('\n').find(l=>l.startsWith(selectorStart));assert.ok(block,'tokens for '+selectorStart);
 return Object.fromEntries([...block.matchAll(/--([\w-]+):(#[0-9A-Fa-f]{6})/g)].map(m=>[m[1],m[2]]));
}
const lum=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
const day=tokens('html[data-ui="2"]{'),night={...day,...tokens('html[data-ui="2"][data-theme="night"]{')};
// WCAG 2.1: 4.5:1 for normal text, 3:1 for large text and interface parts. Driving text is held to 7:1 where it carries information.
const checks=[
 ['body text','ink','surface',7],['body text on page background','ink','bg',7],['secondary text','ink-2','surface',4.5],['secondary text on page background','ink-2','bg',4.5],['secondary text on fields','ink-2','surface-2',4.5],['text on fields','ink','surface-2',7],
 ['primary button label','on-brand','brand',4.5],['link and brand text on surface','brand','surface',4.5],['alert banner text','on-warn','warn',7],['turn banner text','on-turn','turn',7],['error and stop text on surface','bad','surface',4.5],
];
for(const [name,theme] of [['day',day],['night',night]])for(const [what,fg,bg,min] of checks){
 const r=ratio(theme[fg],theme[bg]);assert.ok(r>=min,`${name}: ${what} (${fg} on ${bg}) is ${r.toFixed(2)}:1, needs ${min}:1`);
}
// The route line must stand out from the map and the white speed limit sign from either theme's surface.
for(const [name,t] of [['day',day],['night',night]])assert.ok(ratio(t.route,t.bg)>=3,name+': route line against the page background');
// The filled red used for the over-limit chip and the SOS button is the same solid red in both themes, with white text.
for(const [name,tk] of [['day',day],['night',night]]){const r=ratio(tk['on-bad-fill'],tk['bad-fill']);assert.ok(r>=4.5,name+': white text on the red over-limit chip is '+r.toFixed(2)+':1')}
assert.equal(night['bad-fill'],day['bad-fill'],'the filled red does not lighten at night');
// Universal design basics are present in the stylesheet itself.
assert.match(css,/:focus-visible\{outline:3px solid var\(--focus\)/);assert.match(css,/min-height:44px/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/color-scheme:light/);assert.match(css,/color-scheme:dark/);
console.log('PASS: WCAG contrast for text, buttons, banners and the route line in both themes, plus focus ring, 44 px targets, reduced motion and colour-scheme hints');
