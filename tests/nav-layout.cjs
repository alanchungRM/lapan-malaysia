const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const styles=new Map(), callbacks=[], attrs=new Set(), orientation={matches:false};
const root={clientHeight:820,style:{
 getPropertyValue:name=>styles.get(name),
 setProperty:(name,value)=>styles.set(name,value),
}};
const turn={getBoundingClientRect:()=>({left:12,right:399,bottom:232,width:387,height:168})};
const footer={getBoundingClientRect:()=>({left:12,right:399,top:702,width:387,height:102})};
const rail={
 getBoundingClientRect:()=>({left:12,right:69,width:57}),
 querySelector:()=>({}),
 hasAttribute:name=>attrs.has(name),
 toggleAttribute(name,on){if(on)attrs.add(name);else attrs.delete(name)},
};
const mapWrap={insertBefore(node,before){node.parentNode=this;assert.equal(before,node.nextSibling)}};
const controls={parentNode:mapWrap,nextSibling:{},getBoundingClientRect:()=>({left:810,width:44})};
controls.nextSibling.parentNode=mapWrap;
for(const node of [turn,rail]){node.parentNode=mapWrap;node.nextSibling={parentNode:mapWrap}}
const tray={getBoundingClientRect:()=>({width:0,height:0})};
let hudMounts=0;
const hud={
 showPopover(){assert.fail('the HUD must not enter the browser top layer')},
 insertBefore(node,before){assert.equal(before,null);node.parentNode=this;hudMounts++},
};
const elements={driveHud:hud,driveMore:tray,navBar:footer,navpanel:turn,routeRail:rail,driveControls:controls};
const events={};
let observer, guidance, guiding=false;
const body={classList:{contains:()=>guiding},insertBefore(node,before){node.parentNode=this;assert.equal(before,null)}};
footer.parentNode=body;
const document={documentElement:root,body,getElementById:id=>elements[id]};
const browser={ResizeObserver:true,addEventListener:(event,fn)=>{events[event]=fn}};
vm.runInNewContext(readFileSync('web/nav-layout.js','utf8'),{
 document,setTimeout:()=>1,clearTimeout(){},matchMedia:()=>orientation,requestAnimationFrame:fn=>callbacks.push(fn),
 window:browser,
 ResizeObserver:class{constructor(fn){observer=fn}observe(){}},
 MutationObserver:class{constructor(fn){this.fn=fn}observe(target){if(target===body)guidance=this.fn}},
});
function measure(){callbacks.shift()()}
guiding=true;
guidance();
measure();
assert.equal(controls.parentNode,hud,'driving controls are outside the map layer');
assert.equal(footer.parentNode,hud);
assert.equal(styles.get('--rail-card-top'),'252px');
assert.equal(styles.get('--rail-card-bottom'),'138px');
assert.equal(attrs.has('data-no-room'),false);
turn.getBoundingClientRect=()=>({left:12,right:399,bottom:648,width:387,height:580});
observer();
measure();
assert.equal(attrs.has('data-no-room'),true,'hide the rail if both cards occupy the available space');

const mapBox={left:0,right:900,width:900,height:400};
assert.equal(browser.LapanNavLayout.cameraOffset(mapBox),null,'portrait retains the existing camera');
orientation.matches=true;
root.clientHeight=400;
rail.getBoundingClientRect=()=>({left:710,right:767,width:57});
turn.getBoundingClientRect=()=>({left:12,right:390,bottom:210,width:378,height:146});
footer.getBoundingClientRect=()=>({left:12,right:390,top:270,width:378,height:102});
events.resize();
measure();
assert.equal(styles.get('--rail-card-top'),'0px');
assert.equal(styles.get('--rail-card-bottom'),'0px');
assert.equal(styles.get('--rail-label-width'),'57px');
const [x,y]=browser.LapanNavLayout.cameraOffset(mapBox);
assert.equal(x,96,'the pointer is centred between the cards and right-side rail');
assert.ok(y>0,'leave room to see the route ahead');
assert.equal(attrs.has('data-no-room'),false);
turn.getBoundingClientRect=()=>({left:12,right:739,bottom:210,width:727,height:146});
observer();
measure();
assert.equal(styles.get('--rail-card-top'),'230px','also clear a wide landscape turn card');
assert.equal(turn.parentNode,hud);assert.equal(rail.parentNode,body);
assert.equal(controls.parentNode,hud,'rotation keeps the same control nodes in the viewport');
const clickMore=()=>{tray.getBoundingClientRect=()=>({left:700,right:840,width:140,height:100});guidance();measure()};
clickMore();
assert.equal(attrs.has('data-no-room'),true,'an overlapping open tray keeps its tap area clear');
orientation.matches=false;root.clientHeight=820;
rail.getBoundingClientRect=()=>({left:12,right:69,width:57});
turn.getBoundingClientRect=()=>({left:12,right:399,bottom:232,width:387,height:168});
footer.getBoundingClientRect=()=>({left:12,right:399,top:702,width:387,height:102});
events.orientationchange();measure();
assert.equal(styles.get('--rail-card-top'),'252px');
assert.equal(attrs.has('data-no-room'),false);
assert.equal(hudMounts,3,'the same controls stay mounted across both rotations and the landscape action');
assert.equal(controls.parentNode,hud);
assert.equal(footer.parentNode,hud);
guiding=false;
guidance();
measure();
assert.equal(footer.parentNode,body);
assert.equal(controls.parentNode,mapWrap,'planning recenter returns to the map');
console.log('PASS: route bar spacing in portrait, landscape and after a card resizes');
const css=readFileSync('web/drive-ui.css','utf8');
assert.match(css,/#driveHud\{display:contents\}/,'the HUD does not add a viewport hit surface');
assert.doesNotMatch(css,/#driveHud:popover-open/);
const page=readFileSync('web/index.html','utf8');
assert.match(page,/id="driveHud"[\s\S]*src="nav-layout\.js"/,'the HUD exists when the layout script runs');
