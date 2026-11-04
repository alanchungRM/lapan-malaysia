const assert=require('node:assert/strict'),{createI18n,norm}=require('../web/i18n.js');
// A tiny fake page: elements with attributes and children, text nodes, closest() and innerHTML for whole-sentence blocks.
const text=data=>({nodeType:3,data,parentNode:null,isConnected:true});
function el(name,attrs={},kids=[]){
 const e={nodeType:1,nodeName:name.toUpperCase(),attrs:{...attrs},childNodes:[],parentNode:null,isConnected:true,
  hasAttribute(a){return a in this.attrs},getAttribute(a){return this.attrs[a]},setAttribute(a,v){this.attrs[a]=v},
  closest(sel){const want=sel.slice(1,-1);for(let n=this;n&&n.nodeType===1;n=n.parentNode)if(want in n.attrs)return n;return null},
  get innerHTML(){return this.childNodes.map(c=>c.data).join('')},set innerHTML(v){this.childNodes=[text(v)];this.childNodes[0].parentNode=this}};
 for(const k of kids){k.parentNode=e;e.childNodes.push(k)}return e;
}
function setup({stored,languages=['en-US'],voices=[{lang:'ms-MY'}]}={}){
 const store={...(stored?{'lapan-lang':stored}:{})},body=el('body'),html={lang:'en'};
 const i=createI18n({storage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},doc:{body,documentElement:html},languages,voices:()=>voices});
 return {i,store,body,html};
}
const DICT={'Find my route':'Cari laluan saya','Where to?':'Ke mana?','Speed limit drops to {n} km/h':'Had laju turun kepada {n} km/j','Take exit {n}':'Ambil keluar {n}','Open <strong>Safari</strong> now.':'Buka <strong>Safari</strong> sekarang.','Lapan':'Lapan','Cancel':'Batal'};

// Lookup: exact, whitespace-insensitive, and placeholders.
let {i}=setup();i.add(DICT);
assert.equal(i.lookup('Find my route'),'Cari laluan saya');assert.equal(i.lookup('  Find\n  my   route '),'Cari laluan saya');
assert.equal(i.lookup('Speed limit drops to 80 km/h'),'Had laju turun kepada 80 km/j');assert.equal(i.lookup('Speed limit drops to 80 km/h now'),null,'a pattern matches the whole string only');
assert.equal(i.lookup('Something new'),null);assert.equal(norm(' a\n b  '),'a b');
// t(): English output is exactly the English text, so the classic app is unchanged. Malay only when selected and known.
assert.equal(i.t('Take exit {n}',{n:214}),'Take exit 214');assert.equal(i.t('Unknown thing'),'Unknown thing');
i.set('ms');assert.equal(i.t('Take exit {n}',{n:214}),'Ambil keluar 214');assert.equal(i.t('Unknown thing {n}',{n:1}),'Unknown thing 1','missing entries fall back to English');

// Apply: text nodes keep their surrounding spaces, attributes and whole-sentence blocks translate, scripts and opted-out areas do not.
let s=setup();s.i.add(DICT);
const btn=el('button',{'aria-label':'Where to?',title:'Cancel'},[text('  Find my route  '),el('span',{},[text('↗')])]);
const sentence=el('p',{'data-i18n-html':''},[]);sentence.innerHTML='Open <strong>Safari</strong> now.';
const script=el('script',{},[text('Find my route')]),skip=el('div',{'data-no-i18n':''},[text('Find my route')]),num=el('b',{},[text('12:35')]);
for(const k of [btn,sentence,script,skip,num]){k.parentNode=s.body;s.body.childNodes.push(k)}
s.i.set('ms');
assert.equal(btn.childNodes[0].data,'  Cari laluan saya  ');assert.equal(btn.attrs['aria-label'],'Ke mana?');assert.equal(btn.attrs.title,'Batal');
assert.equal(sentence.innerHTML,'Buka <strong>Safari</strong> sekarang.');assert.equal(script.childNodes[0].data,'Find my route');assert.equal(skip.childNodes[0].data,'Find my route');assert.equal(num.childNodes[0].data,'12:35');
assert.equal(s.html.lang,'ms');assert.equal(s.store['lapan-lang'],'ms');
// Switching back restores the English exactly, and forth again works.
s.i.set('en');assert.equal(btn.childNodes[0].data,'  Find my route  ');assert.equal(btn.attrs['aria-label'],'Where to?');assert.equal(sentence.innerHTML,'Open <strong>Safari</strong> now.');assert.equal(s.html.lang,'en');
s.i.set('ms');assert.equal(btn.childNodes[0].data,'  Cari laluan saya  ');
// Text the app changes later is translated, our own writes are not translated twice, and a new English message is picked up.
btn.childNodes[0].data='Cancel';s.i.apply(btn);assert.equal(btn.childNodes[0].data,'Batal');s.i.apply(btn);assert.equal(btn.childNodes[0].data,'Batal','idempotent');
btn.childNodes[0].data='Find my route';s.i.apply(btn.childNodes[0].parentNode);s.i.set('en');assert.equal(btn.childNodes[0].data,'Find my route');

// Missing-translation report: unknown English is listed, but identity entries, numbers, and text the app itself produced in Malay are not.
s=setup();s.i.add(DICT);s.i.trackMissing(true);const probe=el('div',{},[text('Brand new message'),text('Lapan'),text('Hello 123'),text(' · ')]);probe.parentNode=s.body;s.body.childNodes.push(probe);
s.i.set('ms');assert.deepEqual(s.i.missing().sort(),['Brand new message','Hello 123'].sort());
s.i.add({'Turn left':'Belok kiri'});const made=text(s.i.t('Turn left'));made.parentNode=probe;probe.childNodes.push(made);s.i.apply(probe);assert.equal(made.data,'Belok kiri');assert.ok(!s.i.missing().includes('Belok kiri'),'our own Malay output is not flagged');

// Language choice: first supported language in the person's list, a saved choice wins, bad values are ignored, and a failed Malay load stays English.
assert.equal(setup({languages:['ms-MY','en']}).i.init(),'ms');assert.equal(setup({languages:['en-GB','ms']}).i.init(),'en');assert.equal(setup({languages:['fr','ms']}).i.init(),'ms');assert.equal(setup({languages:['fr','de']}).i.init(),'en');
assert.equal(setup({stored:'en',languages:['ms-MY']}).i.init(),'en','a saved choice beats the phone language');assert.equal(setup({stored:'junk',languages:['ms']}).i.init(),'ms');
// By default nothing is recorded, so a long drive cannot grow memory with changing texts such as arrival times.
s=setup();s.i.add(DICT);const quiet=el('div',{},[text('Arrive 12:35 am'),text('Arrive 12:36 am')]);quiet.parentNode=s.body;s.body.childNodes.push(quiet);s.i.set('ms');assert.deepEqual(s.i.missing(),[]);s.i.trackMissing(true);s.i.apply(quiet);assert.equal(s.i.missing().length,2);s.i.trackMissing(false);assert.deepEqual(s.i.missing(),[]);
s=setup();s.i.set('xx');assert.equal(s.i.lang(),'en');s.i.set('ms',{persist:false});assert.equal(s.store['lapan-lang'],undefined,'auto-detected language is not saved as a choice');

// Spoken text is only translated when a Malay voice exists. Otherwise English is spoken, so the voice stays understandable.
s=setup();s.i.add(DICT);assert.equal(s.i.speechLang(),'en');s.i.set('ms');assert.equal(s.i.speechLang(),'ms');assert.equal(s.i.forSpeech('Find my route'),'Cari laluan saya');assert.equal(s.i.forSpeech('Not in the list'),'Not in the list');
s=setup({voices:[{lang:'en-GB'}]});s.i.add(DICT);s.i.set('ms');assert.equal(s.i.speechLang(),'en');assert.equal(s.i.forSpeech('Find my route'),'Find my route','no Malay voice, English is spoken');
s=setup();s.i.set('ms');assert.equal(s.i.speechLang(),'en','an empty dictionary never claims Malay speech');
console.log('PASS: exact, spaced and placeholder lookup, English passthrough, text/attribute/sentence translation, exact restore, later changes, idempotence, missing report without false alarms, language detection and persistence, speech language rules');
