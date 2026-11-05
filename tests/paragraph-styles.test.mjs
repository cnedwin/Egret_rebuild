// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, createImageData2D} from '@egret/engine';
import {createParagraph, createParagraphCache} from '@egret/engine/paragraph';
import {host, deferred, flush} from './helpers.mjs';
const request = (changes = {}) => ({text:'office á 中文',width:200,fontFamilies:['Unit'],fontSize:20,locale:'en',direction:'ltr',fillColor:0xffffff,density:1,...changes});
const code = name => error => error?.code === name;
const raster = input => ({metrics:{width:input.width,height:24,lines:[{start:0,end:input.text.length,baseline:18,ascent:18,descent:6,height:24,width:90}]},image:createImageData2D({width:1,height:1,pixels:new Uint8Array([255,0,0,255])}),offsetX:0,offsetY:0});
async function fixture(t, capabilities={styledRuns:true}) {
 const engine=await createEngine({host:host().adapter});t.after(()=>engine.dispose());
 const state={inputs:[],hook:undefined},provider={identity:'unit.styles',capabilities,async prepare(input,context){state.inputs.push(input);return state.hook?state.hook(input,context):raster(input);}};
 const cache=createParagraphCache(engine.assets,{provider});return {engine,cache,state,scope:engine.createScope(),provider};
}
test('styled requests snapshot deep arrays and separate colors while empty runs preserve the original cache key',async t=>{
 const {cache,state}=await fixture(t);const a=await cache.acquire(request()),b=await cache.acquire(request({runs:[]}));assert.equal(state.inputs.length,1);assert.equal(a.metrics,b.metrics);
 const runs=[{start:1,end:4,fontFamilies:['Unit'],fontSize:28,fillColor:0xff0000}];const pending=cache.acquire(request({runs}));runs[0].fontFamilies[0]='Mutated';runs[0].fillColor=0; runs.push({start:6,end:7,fillColor:1});
 const c=await pending;assert.equal(state.inputs.length,2);assert.deepEqual(state.inputs[1].runs,[{start:1,end:4,fontFamilies:['Unit'],fontSize:28,fillColor:0xff0000}]);
 assert.ok(Object.isFrozen(state.inputs[1].runs));assert.ok(Object.isFrozen(state.inputs[1].runs[0]));assert.ok(Object.isFrozen(state.inputs[1].runs[0].fontFamilies));
 const d=await cache.acquire(request({runs:[{start:1,end:4,fontFamilies:['Unit'],fontSize:28,fillColor:0x00ff00}]}));assert.equal(state.inputs.length,3);for(const v of [a,b,c,d])v.lease.release();
});
test('invalid runs refuse before changing paragraph revision or reserving provider work',async t=>{
 const {engine,scope,cache,state}=await fixture(t),node=createParagraph(engine,scope,cache);node.setRequest(request());await node.prepare();const before=node.getStatus();
 const bad=[null,{},[{start:0,end:0,fillColor:1}],[{start:0,end:99,fillColor:1}],[{start:.5,end:1,fillColor:1}],[{start:0,end:1}], [{start:0,end:1,fontFamilies:[]}],[{start:0,end:1,fontSize:0}],[{start:0,end:1,fillColor:0x1000000}], [{start:0,end:4,fillColor:1},{start:3,end:5,fillColor:2}], [{start:4,end:5,fillColor:1},{start:0,end:1,fillColor:2}], Array.from({length:257},()=>({start:0,end:1,fillColor:1}))];
 for(const runs of bad)assert.throws(()=>node.setRequest(request({runs})),code('PARAGRAPH_REQUEST_INVALID'));
 for(const text of ['A😀B','A\r\nB'])assert.throws(()=>node.setRequest(request({text,runs:[{start:0,end:2,fillColor:1}]})),code('PARAGRAPH_REQUEST_INVALID'));
 assert.deepEqual(node.getStatus(),before);assert.equal(state.inputs.length,1);
});
test('old providers refuse nonempty runs before slot reservation and capabilities remain captured',async t=>{
 const {cache,state,provider}=await fixture(t,{});const initial=await cache.acquire(request());await flush();const before=cache.getStatus();provider.capabilities.styledRuns=true;
 await assert.rejects(cache.acquire(request({runs:[{start:0,end:1,fillColor:1}]})),code('PARAGRAPH_FEATURE_UNSUPPORTED'));assert.deepEqual(cache.getStatus(),before);assert.equal(state.inputs.length,1);initial.lease.release();
});
test('style-only latest intent and failed replacements preserve the prior committed image and owned leases',async t=>{
 const {engine,scope,cache,state}=await fixture(t),node=createParagraph(engine,scope,cache),gate=deferred();node.setRequest(request());const original=await node.prepare(),image=node.getChildAt(0);
 state.hook=input=>input.runs?.[0].fillColor===1?gate.promise.then(()=>raster(input)):input.runs?.[0].fillColor===2?Promise.reject(Error('style preparation failed')):raster(input);
 node.setRequest(request({runs:[{start:0,end:1,fillColor:2}]}));await assert.rejects(node.prepare());assert.equal(node.getStatus().metrics,original);assert.equal(node.getChildAt(0),image);
 node.setRequest(request({runs:[{start:0,end:1,fillColor:1}]}));const pending=node.prepare(),rejected=assert.rejects(pending);assert.equal(node.getChildAt(0),image);
 node.setRequest(request({runs:[{start:0,end:1,fillColor:3}]}));await node.prepare();const committed=node.getChildAt(0);gate.resolve();await rejected;await flush();assert.equal(node.getChildAt(0),committed);assert.equal(cache.getStatus().callerLeases,1);
 scope.dispose();await flush();assert.equal(cache.getStatus().callerLeases,0);
});

test('run capacity is checked before element reads and the maximum accepted ranges are immutable',async t=>{
 const {cache,state}=await fixture(t);let touched=0;const oversized=new Array(257);Object.defineProperty(oversized,'0',{get(){touched++;throw Error('must not read');}});
 await assert.rejects(cache.acquire(request({runs:oversized})),code('PARAGRAPH_REQUEST_INVALID'));assert.equal(touched,0);assert.equal(state.inputs.length,0);
 const runs=Array.from({length:256},(_,i)=>({start:i,end:i+1,fillColor:i}));const prepared=await cache.acquire(request({text:'A'.repeat(256),runs}));assert.equal(state.inputs[0].runs.length,256);prepared.lease.release();
 const fonts=['Unit'];fonts[Symbol.iterator]=()=>{throw Error('caller iteration has no authority');};const p=await cache.acquire(request({runs:[{start:0,end:1,fontFamilies:fonts}]}));p.lease.release();assert.deepEqual(state.inputs.at(-1).runs[0].fontFamilies,['Unit']);
});
