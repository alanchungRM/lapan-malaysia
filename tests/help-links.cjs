const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/mobile.css','utf8');
const attr=(id,name)=>(html.match(new RegExp('<a id="'+id+'"[^>]*'+name+'="([^"]*)"'))||[])[1];

// Emergency shortcuts only open the dialler with 999, in Malaysia's emergency number, and never carry data.
for(const id of ['openSos','navSos'])assert.equal(attr(id,'href'),'tel:999',id+' dials 999');
assert.match(attr('openSos','aria-label'),/Emergency/);assert.match(attr('navSos','aria-label'),/Emergency/);

// The driving SOS sits in the controls column and is hidden until More is opened, like the other secondary controls.
const controls=html.slice(html.indexOf('id="driveControls"'),html.indexOf('class="maptop"'));
assert.ok(controls.includes('id="navSos"')&&controls.indexOf('id="navSos"')<controls.indexOf('id="navMore"'));
assert.ok(css.includes('body.guiding:not(.drive-more) #navSos'));

// Report a problem goes to the public GitHub issue form with only the app version in the template.
const report=attr('reportProblem','href').replace(/&amp;/g,'&');
const url=new URL(report.replace('{{APP_VERSION}}','1.2.3'));
assert.equal(url.origin+url.pathname,'https://github.com/alanchungRM/lapan-malaysia/issues/new');
assert.deepEqual([...url.searchParams.keys()].sort(),['body','title']);
assert.match(url.searchParams.get('body'),/Lapan v1\.2\.3/);
assert.doesNotMatch(url.searchParams.get('body').replace(/Please do not include[^.]*\./,''),/\b(lat|lon|coord|route|gps)/i,'issue template carries no location data');
assert.match(html.slice(html.indexOf('<body')),/id="reportProblem"[^>]*target="_blank"[^>]*rel="noopener"/);

// Both help links live in More options, and About & privacy describes what they do.
const more=html.slice(html.indexOf('id="moreOptions"'),html.indexOf('</aside>'));
assert.ok(more.includes('id="openSos"')&&more.includes('id="reportProblem"'));
assert.match(more,/Report a problem opens a public GitHub issue form[^<]*no location or route is attached/);
console.log('PASS: emergency links dial 999 only, driving SOS hidden until More, report link carries version only, both documented in About');
