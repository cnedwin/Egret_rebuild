// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createImageData2D, CancellationController } from '@egret/engine';
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { createTextField, createTextRasterCache } from '@egret/engine/text';
import { deferred, flush, host } from './helpers.mjs';
import { literalProvider } from './text-raster-public-helpers.mjs';
const request=(override={})=>({text:'A paragraph',width:80,fontFamilies:['Unit'],fontSize:16,locale:'und',direction:'ltr',fillColor:0xffffff,density:1,...override});
// Literal geometry/pixels exercise SDK ownership only; actual fonts/wrapping are browser evidence.
function literal() {
 const state={calls:0,hook:undefined,requests:[]};
 return {state,provider:{identity:'unit.paragraph.literal.v1',async prepare(input,context){
  state.calls++;state.requests.push(input);
  if(state.hook)return state.hook(input,context);
  return raster(input);
 }}};
}
function raster(input,height=24){return {metrics:{width:input.width,height,lines:[{start:0,end:input.text.length,baseline:18,ascent:18,descent:6,height,width:input.width}]},image:createImageData2D({width:2,height:2,pixels:new Uint8Array(16).fill(255)}),offsetX:-1,offsetY:2};}
async function setup(t,options={}) {
 const engine=await createEngine({host:host().adapter});t.after(()=>engine.dispose());
 const p=literal(),cache=createParagraphCache(engine.assets,{provider:p.provider,...options});
 return {engine,scope:engine.createScope(),cache,...p};
}
const code=expected=>error=>error?.code===expected;

test('SDK paragraph shares authentic manager with explicit text and keeps factory profiles distinct',async t=>{
 const {engine,scope,cache}=await setup(t);
 const explicit=createTextRasterCache(engine.assets,{provider:literalProvider().provider});
 assert.ok(createParagraph(engine,scope,cache));assert.ok(createTextField(engine,scope,explicit));
 assert.throws(()=>createParagraph(engine,scope,explicit),code('TEXT_FIELD_INVALID'));
 assert.throws(()=>createTextField(engine,scope,cache),code('TEXT_FIELD_INVALID'));
 assert.throws(()=>createParagraphCache(engine.assets,{provider:literal().provider}),code('PARAGRAPH_CACHE_ALREADY_CREATED'));
 assert.throws(()=>createParagraphCache({...engine.assets},{provider:literal().provider}),code('TEXT_ASSETS_INVALID'));
 const foreign=await createEngine({host:host().adapter});t.after(()=>foreign.dispose());
 assert.throws(()=>createParagraph(engine,foreign.createScope(),cache),code('TEXT_FIELD_INVALID'));
});
test('SDK paragraph snapshots source/fonts, publishes logical metrics, and reuses unchanged shape/raster',async t=>{
 const {engine,scope,cache,state}=await setup(t);const p=createParagraph(engine,scope,cache);
 const input=request(),fonts=input.fontFamilies;p.setRequest(input);input.text='mutated';fonts[0]='changed';
 const metrics=await p.prepare();assert.equal(metrics.height,24);assert.equal(state.requests[0].text,'A paragraph');assert.deepEqual(state.requests[0].fontFamilies,['Unit']);
 assert.equal(p.numChildren,1);assert.equal(p.getChildAt(0).x,-1);assert.equal(p.getChildAt(0).y,2);
 assert.equal(await p.prepare(),metrics);assert.equal(state.calls,1);
 p.setRequest(request());await p.prepare();assert.equal(state.calls,1);
 const other=createParagraph(engine,scope,cache);other.setRequest(request());await other.prepare();assert.equal(state.calls,1);
 assert.equal(cache.getStatus().callerLeases,2);scope.dispose();assert.equal(cache.getStatus().callerLeases,0);
});
test('SDK paragraph keeps prior committed image and metrics on failed replacement',async t=>{
 const {engine,scope,cache,state}=await setup(t),p=createParagraph(engine,scope,cache);p.setRequest(request());const previous=await p.prepare(),image=p.getChildAt(0);
 state.hook=async()=>{throw Error('font decode failed');};p.setRequest(request({text:'replacement'}));
 await assert.rejects(p.prepare());assert.equal(p.getStatus().metrics,previous);assert.equal(p.getChildAt(0),image);assert.equal(image.isDisposed,false);
 assert.equal(cache.getStatus().callerLeases,1);
});
test('SDK newer request cancels stale demand and late provider cannot publish over latest',async t=>{
 const {engine,scope,cache,state}=await setup(t),p=createParagraph(engine,scope,cache),gate=deferred();
 state.hook=(input)=>input.text==='slow'?gate.promise:raster(input,36);
 p.setRequest(request({text:'slow'}));const slow=p.prepare();const rejected=assert.rejects(slow);
 p.setRequest(request({text:'latest'}));await p.prepare();gate.resolve(raster(request({text:'slow'})));await rejected;await flush();
 assert.equal(p.getStatus().metrics.height,36);assert.equal(p.getStatus().committedRevision,2);assert.equal(p.numChildren,1);assert.equal(cache.getStatus().callerLeases,1);
});
test('SDK invalidation keeps pinned image alive and prepares a fresh generation',async t=>{
 const {engine,scope,cache,state}=await setup(t),p=createParagraph(engine,scope,cache);p.setRequest(request());await p.prepare();const image=p.getChildAt(0),texture=image.textureLease.value;
 cache.invalidate();assert.equal(texture.isDisposed,false);await p.prepare();assert.equal(state.calls,2);assert.equal(image.isDisposed,true);assert.equal(cache.getStatus().callerLeases,1);
});
test('SDK independent callers cancel without aborting shared successful demand',async t=>{
 const {cache,state}=await setup(t),gate=deferred(),cancel=new CancellationController();state.hook=input=>gate.promise.then(()=>raster(input));
 const one=cache.acquire(request(),{signal:cancel.signal}),two=cache.acquire(request());const rejected=assert.rejects(one);cancel.abort(Error('cancel one'));gate.resolve();await rejected;
 const prepared=await two;assert.equal(state.calls,1);assert.equal(prepared.metrics.height,24);prepared.lease.release();assert.equal(cache.getStatus().callerLeases,0);
});
test('SDK bounded cache refuses pinned overflow, reclaims released entries and reports zero on shutdown',async t=>{
 const {engine,cache}=await setup(t,{maxEntries:1,maxImageBytes:16});const one=await cache.acquire(request());await flush();
 await assert.rejects(cache.acquire(request({text:'other'})),code('PARAGRAPH_CACHE_BUDGET'));one.lease.release();
 const two=await cache.acquire(request({text:'other'}));assert.equal(cache.getStatus().imageBytes,16);two.lease.release();await engine.dispose();
 assert.equal(cache.getStatus().closed,true);assert.equal(cache.getStatus().imageBytes,0);assert.equal(cache.getStatus().callerLeases,0);
});
test('SDK close cancels pending work and late successful native result is not retained',async t=>{
 const {engine,scope,cache,state}=await setup(t),p=createParagraph(engine,scope,cache),gate=deferred();state.hook=input=>gate.promise.then(()=>raster(input));p.setRequest(request());
 const pending=p.prepare(),rejected=assert.rejects(pending);scope.dispose();gate.resolve();await rejected;await flush();assert.equal(p.isDisposed,true);assert.equal(cache.getStatus().callerLeases,0);assert.equal(cache.getStatus().imageBytes,0);
 await engine.dispose();assert.equal(cache.getStatus().closed,true);
});
test('SDK malformed UTF16/request and invalid provider metrics fail before replacing committed state',async t=>{
 const {engine,scope,cache,state}=await setup(t),p=createParagraph(engine,scope,cache);p.setRequest(request());await p.prepare();
 assert.throws(()=>p.setRequest(request({text:'\ud800'})),code('PARAGRAPH_REQUEST_INVALID'));
 assert.throws(()=>p.setRequest(request({width:0})),code('PARAGRAPH_REQUEST_INVALID'));
 assert.equal(p.getStatus().desiredRevision,1);
 state.hook=async input=>({...raster(input),metrics:{width:input.width,height:24,lines:[{start:0,end:99999,baseline:18,ascent:18,descent:6,height:24,width:1}]}});
 p.setRequest(request({text:'new'}));await assert.rejects(p.prepare(),error=>error?.code==='ASSET_LOAD_FAILED' && error.cause?.code==='PARAGRAPH_PROVIDER_RESULT_INVALID');
 assert.equal(p.getStatus().committedRevision,1);assert.equal(p.numChildren,1);
});

test('SDK demand is installed before synchronous provider replacement',async t=>{
 const {engine,scope,cache,state}=await setup(t),p=createParagraph(engine,scope,cache),gate=deferred();
 state.hook=input=>{if(input.text==='old'){p.setRequest(request({text:'new'}));return gate.promise;}return Promise.resolve(raster(input,48));};
 p.setRequest(request({text:'old'}));const old=p.prepare();await assert.rejects(old);await p.prepare();gate.resolve(raster(request({text:'old'})));await flush();
 assert.equal(p.getStatus().metrics.height,48);assert.equal(p.numChildren,1);assert.equal(cache.getStatus().callerLeases,1);
});
test('SDK private publication does not invoke overridable insertion hooks',async t=>{
 const {engine,scope,cache}=await setup(t),p=createParagraph(engine,scope,cache);p.setRequest(request());await p.prepare();const old=p.getChildAt(0),metrics=p.getStatus().metrics;
 // Scope/Engine hook is public and may be overridden by application code.
 let called=false;p.assertUsable=function(){called=true;throw Error('unexpected public hook');};
 p.setRequest(request({text:'candidate'}));await p.prepare();
 assert.equal(called,false);assert.notEqual(p.getChildAt(0),old);assert.notEqual(p.getStatus().metrics,metrics);assert.equal(old.isDisposed,true);
});

test('SDK actual paragraph subtree is admitted as ordinary UI leaf content',async t=>{
 const {createUiRoot}=await import('@egret/engine/ui');const {engine,scope,cache}=await setup(t);
 const ui=createUiRoot({engine,scope,id:'paragraph-in-ui',viewport:{width:100,height:100},density:1,tree:{kind:'leaf',id:'paragraph',content:{revision:1,async prepare(context){const node=createParagraph(engine,context.scope,cache);node.setRequest(request({width:context.width}));const metrics=await node.prepare();return {content:node,measuredHeight:metrics.height};}}}});
 const prepared=await ui.prepare();assert.equal(ui.commit(prepared).kind,'committed');assert.equal(ui.snapshot().boxes[0].height,24);
});
