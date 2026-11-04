const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {project}=require('../web/cameras.js');let now=100000,calls=0;class Clock extends Date{static now(){return now}}
const elements={},events={},saved={'lapan-speed-margin':'5'},spoken=[];const el=id=>elements[id]??=( {textContent:'',value:'',firstElementChild:{textContent:''},classList:{flags:new Set(),toggle(k,v){v?this.flags.add(k):this.flags.delete(k)},add(k){this.flags.add(k)},remove(k){this.flags.delete(k)}},setAttribute(k,v){this[k]=v}});
const ctx={Date:Clock,Map,Uint8Array,Number,Math,localStorage:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v},document:{getElementById:el,addEventListener:(k,f)=>events[k]=f},LapanCameras:{project},LapanVoice:{speak:s=>spoken.push(s)},LapanI18n:{t:(k,v={})=>k.replace(/\{(\w+)\}/g,(m,k)=>v[k]??m),speechLang:()=> 'en'},fetch:async()=>{calls++;return {ok:true,json:async()=>({scale:100000,ways:[[90,10100000,300000,0,2000]],dataThrough:'2026-11-03'})}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/speed.js','utf8'),ctx);events.DOMContentLoaded();
const api=ctx.LapanSpeed,route={geometry:{coordinates:[[101,3],[101,3.02]]}},fix=(speed=95,accuracy=10)=>({coords:{longitude:101,latitude:3.005,accuracy,speed:speed/3.6}});
(async()=>{
 assert.equal(calls,0,'data loads only for navigation');api.preload();await new Promise(setImmediate);assert.equal(calls,1);assert.equal(el('speedMargin').value,'5');
 api.update(fix(94),route);assert.equal(el('driveLimit').firstElementChild.textContent,'90');assert.equal(el('speedChip').classList.flags.has('over'),false);
 api.update(fix(),route);assert.equal(el('speedChip').classList.flags.has('over'),true);now+=4001;api.update(fix(),route);assert.equal(spoken.filter(x=>x.includes('Slow down')).length,1);
 api.update(fix(95,90),route);assert.equal(el('driveLimit').classList.flags.has('hidden'),true);assert.equal(el('speedChip').classList.flags.has('over'),false);
 api.setMargin(10);assert.equal(saved['lapan-speed-margin'],'10');api.setMargin(99);assert.equal(saved['lapan-speed-margin'],'10');api.update(fix(99),route);assert.equal(api.isOver(99,90),false);assert.equal(api.isOver(100,90),true);
 const off=fix();off.coords.longitude=101.01;api.update(off,route);assert.equal(el('driveLimit').classList.flags.has('hidden'),true);
 api.setEnabled(false);api.update(fix(120),route);assert.equal(el('speedChip').classList.flags.has('fast'),false);api.stop();assert.equal(el('driveLimit').classList.flags.has('hidden'),true);
 console.log('PASS: lazy data, saved margin, displayed limits, sustained warning, weak/off-route GPS reset, shared margin, disabled state and navigation cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
