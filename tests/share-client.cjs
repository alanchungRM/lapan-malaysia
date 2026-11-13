const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../web/share.js'),{createI18n}=require('../web/i18n.js');
// Links that carry the place.
for(const p of [{name:'Menara KL',lat:3.15283,lon:101.70379},{name:'Café Ñandú 咖啡 🚗',lat:1.4927,lon:103.7414},{name:'',lat:7.6,lon:99}]){const enc=S.encodeStateless(p);assert.match(enc,/^[A-Za-z0-9_-]+$/,'URL-safe');assert.ok(enc.length<=400);assert.deepEqual(S.decodeStateless(enc),{name:p.name,lat:Number(p.lat.toFixed(5)),lon:Number(p.lon.toFixed(5))})}
assert.equal(S.decodeStateless(S.encodeStateless({name:'Map pin 3.10000, 101.70000',lat:3.1,lon:101.7})).name,'','a dropped pin is shared without its placeholder name');
assert.ok(!Buffer.from(S.encodeStateless({name:'X',lat:3.1,lon:101.7}),'base64url').toString().match(/[a-z]{4,}/i),'nothing but the place is in the link');assert.equal(Buffer.from(S.encodeStateless({name:'X',lat:3.1,lon:101.7}),'base64url').toString(),'3.10000,101.70000,X');
for(const bad of ['','!!!','AAAA',Buffer.from('99.00000,101.00000,x').toString('base64url'),Buffer.from('3.1,101.7').toString('base64url'),null,undefined,42])assert.equal(S.decodeStateless(bad),null,String(bad));
// Messages.
const entries={};vm.runInNewContext(fs.readFileSync('web/i18n-ms.js','utf8'),{window:{LapanI18n:{add:e=>Object.assign(entries,e)}}});
const ms=createI18n({storage:{getItem:()=>'ms',setItem(){}},doc:{documentElement:{}},languages:[],voices:()=>[]});ms.add(entries);ms.init();const url='https://lapan.test/s/Ab3dEfG';
assert.equal(S.message('place','Menara KL',url,'',null),'Meet me at Menara KL. Open in Lapan: '+url);
assert.equal(S.message('drive','Menara KL',url,'8:32 am',null),"I'm on my way to Menara KL, arriving about 8:32 am. Open in Lapan: "+url);
assert.equal(S.message('drive','Menara KL',url,'',null),'Meet me at Menara KL. Open in Lapan: '+url,'no arrival time means the plain message');
assert.equal(S.message('place','Menara KL',url,'',ms),'Jumpa di Menara KL. Buka dalam Lapan: '+url);
assert.equal(S.message('drive','Menara KL',url,'8:32 am',ms),'Saya dalam perjalanan ke Menara KL, tiba lebih kurang 8:32 am. Buka dalam Lapan: '+url);
assert.equal(S.message('place','A {url} B',url,'',null),'Meet me at A {url} B. Open in Lapan: '+url,'placeholders in a name stay as written');
assert.equal(S.labelOf({name:'Map pin 3.1, 101.7',lat:3.1,lon:101.7}),'3.1000, 101.7000');assert.equal(S.labelOf({name:'KLCC',lat:3,lon:101}),'KLCC');assert.ok(S.unnamed('')&&S.unnamed('My location')&&S.unnamed('Map pin 1')&&!S.unnamed('Map pinang'));
// Reverse lookup text.
const feat=p=>({features:[{properties:p}]});
assert.equal(S.parseReverse(feat({name:'Balai Polis Kepong',district:'Kepong',city:'Kuala Lumpur'})),'Balai Polis Kepong, Kepong');assert.equal(S.parseReverse(feat({street:'Jalan Ampang',housenumber:'12',city:'Kuala Lumpur'})),'Jalan Ampang 12, Kuala Lumpur');
assert.equal(S.parseReverse(feat({name:'Ipoh',city:'Ipoh'})),'Ipoh','repeats are dropped');assert.equal(S.parseReverse(feat({})),null);assert.equal(S.parseReverse({features:[]}),null);assert.equal(S.parseReverse(null),null);assert.equal(S.parseReverse(feat({name:'a\u0007b\n'.repeat(60)})).length<=80,true);
// What a shared page carries.
const doc=metas=>({querySelector:sel=>{const m=sel.match(/name="([^"]+)"/)[1];return m in metas?{getAttribute:()=>metas[m]}:null}});
assert.equal(S.readShared(doc({})),null);assert.deepEqual(S.readShared(doc({'lapan-share':JSON.stringify({n:'KLCC',la:3.1579,lo:101.7116})})),{place:{name:'KLCC',lat:3.1579,lon:101.7116}});
assert.deepEqual(S.readShared(doc({'lapan-share':JSON.stringify({n:'',la:3,lo:101})})),{place:{name:'',lat:3,lon:101}});
for(const bad of ['{bad',JSON.stringify({n:'x',la:40,lo:101}),JSON.stringify({n:'x'}),'null'])assert.deepEqual(S.readShared(doc({'lapan-share':bad})),{error:'invalid'},bad);
assert.deepEqual(S.readShared(doc({'lapan-share-error':'expired'})),{error:'expired'});
// Making the link: short when the service answers properly, otherwise carrying the place.
(async()=>{
 const O='https://lapan.test',ok=url=>async()=>({ok:true,json:async()=>({url})}),p={name:'Menara KL',lat:3.15283,lon:101.70379};
 assert.deepEqual(await S.makeLink(p,ok(O+'/s/Ab3dEfG'),O),{url:O+'/s/Ab3dEfG',short:true});
 const stateless=await S.makeLink(p,async()=>({ok:false}),O);assert.equal(stateless.short,false);assert.equal(stateless.url,O+'/l/'+S.encodeStateless(p));assert.ok(stateless.url.length<90,'still short for a typical name: '+stateless.url.length);
 for(const [why,f] of [['rejects',async()=>{throw Error('offline')}],['other site',ok('https://evil.example/s/Ab3dEfG')],['wrong path',ok(O+'/x/Ab3dEfG')],['bad code',ok(O+'/s/../../x')],['short code',ok(O+'/s/Ab3')],['not text',async()=>({ok:true,json:async()=>({url:5})})],['bad json',async()=>({ok:true,json:async()=>{throw Error('x')}})]])assert.equal((await S.makeLink(p,f,O)).short,false,why);
 let sent;await S.makeLink({name:'Map pin 3.10000, 101.70000',lat:3.1,lon:101.7},async(u,o)=>{sent=JSON.parse(o.body);return {ok:false}},O);assert.deepEqual(sent,{name:'',lat:3.1,lon:101.7},'only the place is sent to the service');
 // Page wiring and strings.
 const html=fs.readFileSync('web/index.html','utf8');for(const id of ['sharePlace','navShare','placeCard','placeCardName','placeCardSub','placeCardSend','placeCardRoutes','placeCardClose','shareToast'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.indexOf('drive-ui.js')<html.indexOf('share.js')&&html.indexOf('share.js')<html.indexOf('src="app.js"'));assert.match(html,/<div id="driveShortcuts">(?:(?!<\/div>).)*id="navReport"(?:(?!<\/div>).)*id="navShare"/s,'report and share are grouped outside the tray');
 assert.match(html,/<button id="navReport" aria-label="Report on the road"[^>]*><svg[^>]*>.*?<\/svg><\/button>/s,'Report is an icon-only button with an accessible name');
 assert.match(html,/<button id="navShare" aria-label="Share location"[^>]*><svg[^>]*>.*?<\/svg><\/button>/s,'Share is an icon-only button with an accessible name');
 assert.match(html,/<button id="locate"[^>]*>[^<]*<\/button><div id="driveShortcuts">.*?<\/div><button id="navMore"/s,'the shortcuts sit below recenter and before More');
 assert.doesNotMatch(html,/<div id="driveMore"[^>]*>(?:(?!<\/div>).)*id="nav(?:Share|Report)"/s);
 assert.match(html,/<div class="plan-row"><button id="plan"[^>]*>(?:(?!<\/div>).)*id="sharePlace"[^>]*class="share-icon"/s,'Share is a small icon beside Find my route, not a block of its own');assert.ok(!html.includes('share-note'),'no extra paragraph in the planner');assert.match(html,/<p>Anyone with a share link can see the destination\..*?<\/p>/,'the promise lives in About and privacy');
 const mobile=fs.readFileSync('web/mobile.css','utf8');for(const [what,re,max] of [['place name',/#placeCard strong\{[^}]*font-size:(\d+)px/,17],['place detail',/#placeCard small\{[^}]*font-size:(\d+)px/,13],['toast',/#shareToast\{[^}]*font-size:(\d+)px/,14]])assert.ok(Number(mobile.match(re)[1])<=max,what+' stays small');assert.match(mobile,/\.place-card-actions button\{min-height:44px/,'buttons are 44 px');assert.match(mobile,/#placeCard strong\{[^}]*-webkit-line-clamp:2/,'long names are cut at two lines');
 const js=fs.readFileSync('web/share.js','utf8');for(const m of js.matchAll(/\b(?:tr|say)\('([^']+)'/g))assert.ok(entries[m[1]],'untranslated: '+m[1]);for(const m of js.matchAll(/\bt\("([^"]+)"|\bt\('([^']+)'/g)){const k=m[1]||m[2];assert.ok(entries[k],'untranslated: '+k)}
 for(const k of ['Meet me at {name}. Open in Lapan: {url}',"I'm on my way to {name}, arriving about {time}. Open in Lapan: {url}",'Send','Routes','Share this place','Share my drive','Share location','Share destination and ETA','Report on the road','Unnamed road','Looking up the place…'])assert.ok(entries[k]&&(entries[k]!==k||k==='Lapan: {name}'),'untranslated: '+k);
 assert.ok(!/innerHTML/.test(js),'names are shown as text only');
 const app=fs.readFileSync('web/app.js','utf8');assert.ok(app.includes('LapanShare?.bind'));const sw=fs.readFileSync('web/sw.js','utf8');assert.match(sw,/\^\\\/\[sl\]\\\//,'shared pages are not stored on the device');
 console.log('PASS: link format, messages in both languages, reverse-lookup names, shared-page parsing, short-link fallback and safety, markup and strings');
})().catch(e=>{console.error(e);process.exit(1)});

// Opening a saved pin only displays its card. Sharing sends the saved place, without ETA.
(async()=>{
 const nodes=new Map(),requests=[];
 const node=()=>({textContent:'',value:'',classList:{add(){},remove(){}},setAttribute(){},replaceChildren(...children){this.children=children},focus(){},select(){},showModal(){this.open=true}});
 const document={body:{classList:{contains:()=>false}},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:node,querySelectorAll:()=>[],addEventListener(){}};
 const window={document};
 vm.runInNewContext(fs.readFileSync('web/share.js','utf8'),{window,document,MutationObserver:class{observe(){}},location:{origin:'https://lapan.test'},navigator:{},AbortSignal,clearTimeout,setTimeout:()=>0,
  fetch:async(url,options)=>{requests.push([url,JSON.parse(options.body)]);return {ok:true,json:async()=>({url:'https://lapan.test/s/Ab3dEfG'})}}});
 window.LapanShare.showSaved('home',['Saved address',3.12345,101.65432]);
 assert.equal(requests.length,0);
 assert.equal(nodes.get('placeCardName').children[0].textContent,'Home');
 assert.equal(nodes.get('placeCardSend').textContent,'Share location');
 nodes.get('placeCardSend').onclick();
 await new Promise(setImmediate);
 assert.deepEqual(requests,[['/api/share',{name:'Saved address',lat:3.12345,lon:101.65432}]]);
 assert.equal(nodes.get('shareLinkDialog').open,true);
 assert.equal(nodes.get('shareLinkText').value,'Meet me at Saved address. Open in Lapan: https://lapan.test/s/Ab3dEfG');
})().catch(error=>{console.error(error);process.exitCode=1});
