const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');

const panelSource=readFileSync('web/statistics-panel.js','utf8');
const statisticsSource=readFileSync('web/statistics.js','utf8');

const mapRoot={dataset:{ui:'2',theme:'night',skin:'sunset'}};
const frameRoot={dataset:{},classList:{contains:name=>name==='statistics-page'}};
const iframeDocument={documentElement:frameRoot,getElementById:()=>null,addEventListener(){}};
let loadFrame,themeChanged;
const frame={contentDocument:iframeDocument,addEventListener(name,load){loadFrame=load}};
runInNewContext(panelSource,{
 document:{
  documentElement:mapRoot,
  getElementById:()=>({querySelector:()=>frame,addEventListener(){}}),
  querySelectorAll:()=>[],
  addEventListener(name,ready){ready()}
 },
 window:{addEventListener(){}},
 MutationObserver:class{
  constructor(sync){themeChanged=sync}
  observe(root,options){
   assert.equal(root,mapRoot);
   assert(options.attributeFilter.includes('data-skin'));
  }
 }
});
loadFrame();
assert.deepEqual(frameRoot.dataset,{ui:'2',theme:'night',skin:'sunset'});
mapRoot.dataset={ui:'2',theme:'day'};
themeChanged();
assert.deepEqual(frameRoot.dataset,{ui:'2',theme:'day'});
mapRoot.dataset={};
themeChanged();
assert.deepEqual(frameRoot.dataset,{});

const standaloneRoot={dataset:{}};
const meta={content:'#121b29'};
let look='sunset',storageChanged;
const window={addEventListener(name,listener){storageChanged=listener}};
window.parent=window;
runInNewContext(statisticsSource,{
 window,
 document:{
  documentElement:standaloneRoot,
  querySelector:()=>meta,
  getElementById:()=>({}),
  addEventListener(){},
  visibilityState:'hidden'
 },
 localStorage:{getItem:key=>key==='lapan-ui'?look:null},
 navigator:{},
 setInterval(){}
});
assert.deepEqual(standaloneRoot.dataset,{ui:'2',theme:'night',skin:'sunset'});
assert.equal(meta.content,'#25152C');
look='2';
storageChanged({key:'lapan-ui'});
assert.deepEqual(standaloneRoot.dataset,{});
assert.equal(meta.content,'#121b29');
console.log('PASS: GTA Sunset palette in the statistics dialog and standalone tab, and cleanup after a skin change');
