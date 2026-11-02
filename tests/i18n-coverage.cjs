const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createI18n,norm}=require('../web/i18n.js');
// Load the real Malay dictionary the way the browser does.
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
const i18n=createI18n({storage:{getItem:()=>null,setItem(){}},doc:{documentElement:{}},languages:[],voices:()=>[]});i18n.add(entries);
const names=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
const tags=s=>[...s.matchAll(/<\/?(\w+)/g)].map(m=>m[1]).sort();

// 1. Dictionary quality. Placeholders match, markup is kept, nothing is blank, and no translation is so long that it would overflow a button.
const sameOnPurpose=new Set(i18n.identity());
for(const [en,ms] of Object.entries(entries)){
 assert.ok(typeof ms==='string'&&ms.trim().length>0,'empty translation for: '+en);
 assert.equal(norm(en),en.trim().replace(/\s+/g,' '),'unnormalised key '+en);
 // The English ordinal ("2nd") is rebuilt as a plain number in Malay ("ke-2"), the only place a placeholder may differ.
 const inEn=names(en),inMs=names(ms),ordinal=inEn.includes('ordinal');
 assert.deepEqual(inMs.filter(n=>!inEn.includes(n)&&!(ordinal&&n==='n')),[],'placeholder in the Malay that is not in the English: '+en);
 assert.deepEqual(inEn.filter(n=>!inMs.includes(n)&&!(ordinal&&n==='ordinal')),[],'placeholder dropped from the Malay: '+en);
 assert.deepEqual(tags(ms),tags(en),'markup differs between English and Malay: '+en.slice(0,60));
 if(sameOnPurpose.has(norm(en)))continue;
 const limit=en.length<=60?2.3:1.8;
 assert.ok(ms.length<=Math.max(18,en.length*limit),`Malay is much longer than the English and may overflow (${en.length} to ${ms.length}): ${en.slice(0,60)}`);
}
// Words that must be translated the same way everywhere, so the app speaks with one voice.
const terms={'route':'laluan','speed limit':'had laju','toll':'tol'};
for(const [en,ms] of Object.entries(entries)){if(/\bspeed limit\b/i.test(en)&&!/had laju|had/i.test(ms)&&!sameOnPurpose.has(en))assert.fail('speed limit should be "had laju": '+en.slice(0,60))}
for(const bad of [/\brute\b/,/\bkelajuan had\b/,/\bkm\/h\b/,/\blatency\b/])for(const [en,ms] of Object.entries(entries))assert.ok(!bad.test(ms),`avoid ${bad} in: ${ms.slice(0,60)}`);

// 2. Coverage. Every piece of English text in the page has a Malay version, or is deliberately the same (names, symbols, units).
const html=fs.readFileSync('web/index.html','utf8').replace(/\{\{APP_VERSION\}\}/g,'1.0.34');
let body=html.slice(html.indexOf('<body'));
body=body.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[\s\S]*?-->/g,'');
const dec=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"');
const wanted=new Set();
// Whole-sentence blocks are looked up by their full text and markup.
body=body.replace(/<(li|p)\s+data-i18n-html>([\s\S]*?)<\/\1>/g,(m,t,inner)=>{wanted.add(norm(dec(inner)));return ''});
body=body.replace(/<[^>]+data-no-i18n[\s\S]*?<\/(div|span)>/g,'');
for(const m of body.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g))wanted.add(norm(dec(m[1])));
for(const m of body.matchAll(/>([^<>]+)</g))wanted.add(norm(dec(m[1])));
// Names the app shows as they are: brand, units, plaza and place names come from data.
const proper=/^(lapan|MALAYSIA|lapan-malaysia\.com|Safari|Chrome|TomTom|Photon|OSRM|PLUS|SOS|iPhone · Safari|Android · Chrome|MYR · RM|RM —|[^A-Za-z]*)$/;
const missing=[...wanted].filter(t=>/[A-Za-z]{2}/.test(t)&&!proper.test(t)&&i18n.lookup(t)==null);
assert.deepEqual(missing,[],'English text with no Bahasa Malaysia entry (add it to web/i18n-ms.js):\n  '+missing.join('\n  '));
// Every sentence block is really translated, never left identical.
for(const t of wanted)if(/<strong>|<a /.test(t)&&i18n.lookup(t)!=null)assert.notEqual(i18n.lookup(t),t,'untranslated block '+t.slice(0,50));
console.log('PASS: dictionary lint ('+Object.keys(entries).length+' entries: placeholders, markup, length, terminology) and every one of the '+wanted.size+' texts in the page has a Bahasa Malaysia version');
