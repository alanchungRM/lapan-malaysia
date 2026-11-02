const assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('web/ui2.css','utf8');
// Route options are rows, not three squeezed columns, and nothing in them is allowed to grow back to the old sizes.
for(const [what,re] of [['rows stack',/#routes\{display:flex!important;flex-direction:column/],['grid areas',/grid-template-areas:"dur meta" "badge arr"/],['top group flattened',/\.route \.top\{display:contents\}/],['badge sits under the duration',/\.badge\{grid-area:badge/],['arrival is one line',/\.route-arrival\{grid-area:arr[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/],['extra lines span the row',/\.route>:not\(\.top\):not\(p\):not\(\.route-arrival\)\{grid-column:1\/-1\}/]])assert.match(css,re,what);
const size=re=>Number(css.match(re)[1]);
assert.ok(size(/#routes \.route strong\{grid-area:dur;font-size:(\d+)px/)<=24,'duration is at most 24 px');assert.ok(size(/#routes \.route p\{grid-area:meta;[^}]*font-size:(\d+)px/)<=15);assert.ok(size(/#routes \.route \.route-arrival\{[^}]*font-size:(\d+)px/)<=13);
// The old thirty-pixel duration is gone from the new look.
assert.ok(!/\.route strong\{font-size:30px/.test(css),'no 30 px duration');
// The classic look keeps its three columns.
assert.match(fs.readFileSync('web/mobile.css','utf8'),/#routes\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(105px,1fr\)\)/);
// Every rule is scoped to the new look so the classic look is untouched.
const block=css.slice(css.indexOf('/* Route options as rows'),css.indexOf('/* Route options as rows')+2400).split('\n').filter(l=>l.startsWith('html'));assert.ok(block.length>=9&&block.every(l=>l.startsWith('html[data-ui="2"]')));
console.log('PASS: route options are compact rows in the new look, with size ceilings, and the classic look is unchanged');
