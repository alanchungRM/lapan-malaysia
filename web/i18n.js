(function(root){
// English and Bahasa Malaysia. The English text in the page is the key, so screens need no markup changes: a Malay dictionary
// (i18n-ms.js, loaded only for Malay) maps each English string to its Malay one. Entries may hold {name} placeholders.
const KEY='lapan-lang',ATTRS=['placeholder','aria-label','title','alt'],SKIP=/^(SCRIPT|STYLE|TEXTAREA|CODE)$/;
const norm=s=>String(s).replace(/\s+/g,' ').trim();
const fill=(text,vars)=>vars?text.replace(/\{(\w+)\}/g,(m,k)=>k in vars?vars[k]:m):text;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function createI18n(env){
 const {storage,doc,languages,voices}=env;
 const dict={},patterns=[],listeners=new Set(),seenMissing=new Set(),produced=new Set(),originals=new Map();
 let lang='en',identity=new Set(),track=false;
 const stored=()=>{try{const v=storage.getItem(KEY);return v==='ms'||v==='en'?v:null}catch{return null}};
 // The first language in the person's own list that Lapan offers decides; a Malay phone with English as a second language gets Malay.
 const detect=()=>(languages||[]).map(l=>String(l).slice(0,2).toLowerCase()).find(l=>l==='en'||l==='ms')||'en';
 function add(entries){
  for(const [en,ms] of Object.entries(entries)){
   const key=norm(en);dict[key]=ms;if(ms===en)identity.add(key);
   if(/\{\w+\}/.test(key)){const names=[];const src='^'+key.split(/(\{\w+\})/).map(p=>{const m=p.match(/^\{(\w+)\}$/);if(m){names.push(m[1]);return '(.+?)'}return esc(p)}).join('')+'$';patterns.push({re:new RegExp(src),names,ms})}
  }
 }
 // Translate one string. Returns the Malay text, or null if there is none.
 function lookup(text){
  const key=norm(text);if(!key)return null;
  if(Object.hasOwn(dict,key))return dict[key];
  for(const p of patterns){const m=key.match(p.re);if(m)return fill(p.ms,Object.fromEntries(p.names.map((n,i)=>[n,lookup(m[i+1])??m[i+1]])))}
  return null;
 }
 // t('Take exit {n}',{n:5}): programmatic text. English when the language is English or the entry is missing.
 function t(en,vars){
  if(lang==='ms'){const key=norm(en);if(Object.hasOwn(dict,key)){const out=fill(dict[key],vars);produced.add(norm(out));return out}}
  return fill(en,vars);
 }
 const speechLang=()=>lang==='ms'&&Object.keys(dict).length>0&&(voices()||[]).some(v=>/^ms(-|_|$)/i.test(v.lang))?'ms':'en';
 // Spoken text is translated only when a Malay voice exists, otherwise English is spoken so the device voice stays understandable.
 const forSpeech=text=>speechLang()==='ms'?(lookup(text)??text):text;
 function visit(node,fn){
  if(node.nodeType===3){fn.text(node);return}
  if(node.nodeType!==1||SKIP.test(node.nodeName)||node.closest?.('[data-no-i18n]'))return;
  for(const a of ATTRS)if(node.hasAttribute?.(a))fn.attr(node,a);
  if(node.hasAttribute?.('data-i18n-html')){fn.html(node);return}
  for(const child of [...node.childNodes])visit(child,fn);
 }
 const applyFns={
  text(node){
   const raw=node.data,core=norm(raw);if(!/[A-Za-z]{2}/.test(core))return;
   const rec=originals.get(node);if(rec&&raw===rec.shown)return;
   if(produced.has(core))return;
   const ms=lookup(core);if(ms==null){if(track&&!identityHas(core))seenMissing.add(core);return}
   const lead=raw.match(/^\s*/)[0],trail=raw.match(/\s*$/)[0],shown=lead+ms+trail;
   originals.set(node,{en:raw,shown});node.data=shown;
  },
  attr(el,a){
   const raw=el.getAttribute(a),core=norm(raw);if(!/[A-Za-z]{2}/.test(core))return;
   const rec=originals.get(el)?.[a];if(rec&&raw===rec.shown)return;
   if(produced.has(core))return;
   const ms=lookup(core);if(ms==null){if(track&&!identityHas(core))seenMissing.add(core);return}
   const all=originals.get(el)||{};all[a]={en:raw,shown:ms};originals.set(el,all);el.setAttribute(a,ms);
  },
  html(el){
   const raw=el.innerHTML,core=norm(raw.replace(/&amp;/g,'&').replace(/&nbsp;/g,' '));
   const rec=originals.get(el)?.html;if(rec&&raw===rec.shown)return;
   const ms=lookup(core);if(ms==null){if(track)seenMissing.add(core);return}
   const all=originals.get(el)||{};el.innerHTML=ms;all.html={en:raw,shown:el.innerHTML};originals.set(el,all);
  },
 };
 const identityHas=core=>identity.has(core);
 const restoreFns={
  text(node,rec){if(node.data===rec.shown)node.data=rec.en},
  attr(el,a,rec){if(el.getAttribute(a)===rec.shown)el.setAttribute(a,rec.en)},
  html(el,rec){if(el.innerHTML===rec.shown)el.innerHTML=rec.en},
 };
 // Sentences marked data-i18n-html are translated whole, so anything inside one is handled through its container.
 function apply(node=doc.body){
  if(lang!=='ms'||!node)return;
  const host=(node.nodeType===1?node:node.parentNode)?.closest?.('[data-i18n-html]');
  visit(host||node,applyFns);
 }
 function restore(){
  for(const [node,rec] of originals){
   if(!node.isConnected){originals.delete(node);continue}
   if(node.nodeType===3)restoreFns.text(node,rec);
   else for(const [k,r] of Object.entries(rec))k==='html'?restoreFns.html(node,r):restoreFns.attr(node,k,r);
  }
  originals.clear();
 }
 function set(next,{persist=true}={}){
  if(next!=='ms'&&next!=='en')return lang;
  if(lang==='ms'&&next==='en')restore();
  lang=next;doc.documentElement.lang=lang==='ms'?'ms':'en';
  if(persist){try{storage.setItem(KEY,lang)}catch{}}
  if(lang==='ms')apply();
  for(const fn of listeners)fn(lang);
  return lang;
 }
 const init=()=>{lang=stored()||detect();return lang};
 return {add,lookup,t,set,init,apply,restore,forSpeech,speechLang,lang:()=>lang,onChange:fn=>listeners.add(fn),// Listing English left over in Malay is for tests only. It stays off in the real app because texts such as arrival times change every minute.
  trackMissing:on=>{track=!!on;if(!track)seenMissing.clear()},missing:()=>[...seenMissing],clearMissing:()=>seenMissing.clear(),identity:()=>[...identity],entries:()=>({...dict}),detect,stored};
}
if(typeof module==='object')module.exports={createI18n,norm};
if(typeof window!=='object')return;
// Browser wiring: choose the language before first paint, load the Malay dictionary only if needed, keep new text translated.
const i18n=createI18n({storage:localStorage,doc:document,languages:navigator.languages||[navigator.language],voices:()=>root.speechSynthesis?.getVoices?.()});
root.LapanI18n=i18n;
const want=i18n.init(),html=document.documentElement;
html.lang=want==='ms'?'ms':'en';
let observer=null,dictionaryLoaded=false,loading=null;
function watch(){
 if(observer||!document.body)return;
 observer=new MutationObserver(records=>{
  if(i18n.lang()!=='ms')return;
  for(const r of records){
   if(r.type==='characterData')i18n.apply(r.target.parentNode);
   else if(r.type==='attributes')i18n.apply(r.target);
   else for(const n of r.addedNodes)i18n.apply(n.nodeType===3?n.parentNode:n);
  }
 });
 observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt']});
}
function loadDictionary(){
 if(dictionaryLoaded)return Promise.resolve();
 loading??=new Promise(resolve=>{const s=document.createElement('script');s.src='/i18n-ms.js';s.onload=()=>{dictionaryLoaded=true;resolve()};s.onerror=()=>resolve();document.head.append(s)});
 return loading;
}
const mark=()=>{for(const b of document.querySelectorAll('[data-lang]'))b.setAttribute('aria-pressed',String(b.dataset.lang===i18n.lang()));
 // The driving button shows the language it will switch to.
 for(const b of document.querySelectorAll('[data-lang-toggle]')){const other=i18n.lang()==='ms'?'en':'ms';b.textContent=other==='ms'?'BM':'EN';b.lang=other;b.setAttribute('aria-label',other==='ms'?'Tukar ke Bahasa Malaysia / Switch to Bahasa Malaysia':'Switch to English / Tukar ke Bahasa Inggeris')}};
// A language choice is only applied once its dictionary is in. If Malay cannot load (offline), the page stays English and the toggle shows it.
async function go(next,persist=true){
 if(next==='ms'){await loadDictionary();if(!dictionaryLoaded){i18n.set('en',{persist:false});mark();html.classList.remove('i18n-wait');return}}
 i18n.set(next,{persist});watch();mark();html.classList.remove('i18n-wait');
}
root.LapanLanguage={set:go};
if(want==='ms')html.classList.add('i18n-wait');
setTimeout(()=>html.classList.remove('i18n-wait'),1500);
document.addEventListener('DOMContentLoaded',async()=>{
 for(const b of document.querySelectorAll('[data-lang]'))b.addEventListener('click',()=>go(b.dataset.lang));
 for(const b of document.querySelectorAll('[data-lang-toggle]'))b.addEventListener('click',()=>go(i18n.lang()==='ms'?'en':'ms'));
 if(want==='ms')await go('ms',false);else{mark();watch();html.classList.remove('i18n-wait')}
});
})(typeof window==='object'?window:globalThis);
