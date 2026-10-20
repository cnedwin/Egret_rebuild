// SPDX-License-Identifier: Apache-2.0
// Public built APIs, exact authorized controlled fetch, and existing PNG ports.
// These controls are not actual native/network or C acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { api, selection, context, transportFixture, bytes, egret, controlledFixture, until, pending, refused } from './manifest-browser-fixtures.mjs';
const SOURCE_FIELDS=['jobs','queuedNetwork','queuedDecode','retryWaiting','activeNetwork','activeDecode','encodedCreditBytes','ownedEncodedBytes','borrowedChunkBytes','quarantinedJobs'];
const PROVIDER_FIELDS=['jobs','encodedCreditBytes','ownedEncodedBytes','blobLogicalBytes','activeDecodes','bitmapLogicalBytes','rasterLogicalBytes','readbackCpuBytes','materializedCpuBytes','quarantinedJobs','unknownNativeObjects'];
const E=bytes.byteLength;
function capability(owner,kind){assert.equal(typeof owner.getStatus,'function',kind==='source'?'M15_SOURCE_DIAGNOSTICS_MISSING':'M15_PROVIDER_DIAGNOSTICS_MISSING');return owner;}
function snapshot(owner,kind){
  capability(owner,kind);const result=owner.getStatus(),fields=kind==='source'?SOURCE_FIELDS:PROVIDER_FIELDS;
  assert.equal(Object.getPrototypeOf(result),Object.prototype);assert.ok(Object.isFrozen(result));assert.deepEqual(Reflect.ownKeys(result).sort(),['current','highWater','saturated']);assert.equal(result.saturated,false);
  for(const key of ['current','highWater']){const row=result[key];assert.equal(Object.getPrototypeOf(row),Object.prototype);assert.ok(Object.isFrozen(row));assert.deepEqual(Reflect.ownKeys(row).sort(),fields.slice().sort());for(const field of fields){const descriptor=Object.getOwnPropertyDescriptor(row,field);assert.ok(Object.hasOwn(descriptor,'value'));assert.ok(Number.isSafeInteger(descriptor.value)&&descriptor.value>=0);}}
  for(const field of fields)assert.ok(result.highWater[field]>=result.current[field]);return result;
}
function zeroCurrent(owner,kind){const result=snapshot(owner,kind);for(const value of Object.values(result.current))assert.equal(value,0);return result;}
function effects(f,png){return {fetch:f.calls.length,responses:f.responses.length,read:f.responses.reduce((n,row)=>n+row.state.reads,0),cancel:f.responses.reduce((n,row)=>n+row.state.cancels,0),release:f.responses.reduce((n,row)=>n+row.state.releases,0),events:png?[...png.events]:[]};}
async function controlled(body){
  api();const original=Object.getOwnPropertyDescriptor(globalThis,'fetch');assert.ok(original&&Object.hasOwn(original,'value')&&typeof original.value==='function');const f=transportFixture();let primary,cleanup;
  Object.defineProperty(globalThis,'fetch',{...original,value:f.fetch});
  try{
    // Existing genuine byte and PNG baselines precede each missing-method check.
    // Their separate owners leave the tested fresh high-water values at zero.
    await f.baseline();const chosen=selection(),source=f.source(chosen),png=controlledFixture(),provider=f.provider(source,png),value=await f.load(provider,chosen.bindings[0].ref,context().value);
    assert.ok(egret.isTexture(value));provider.dispose(value);await provider.close();await source.close();
    await body(f);f.route=undefined;await f.baseline();
  }catch(cause){primary={cause};}
  finally{try{await f.cleanup();}catch(cause){cleanup={cause};}Object.defineProperty(globalThis,'fetch',original);assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'fetch'),original);}
  if(primary&&cleanup)throw new AggregateError([primary.cause,cleanup.cause],'RESOURCE_DIAGNOSTICS_PRIMARY_AND_CLEANUP');if(primary)throw primary.cause;if(cleanup)throw cleanup.cause;
}
function check(name,body){test(name,{concurrency:false,timeout:10000},()=>controlled(body));}
function make(f,options={}){const chosen=selection(),source=f.source(chosen,options),png=controlledFixture(),provider=f.provider(source,png);return {chosen,source,png,provider};}
const drainCpu=()=>new Promise(resolve=>setImmediate(resolve));

check('RD01 source snapshot is fresh frozen numeric data and exact receiver survives close',async f=>{
  const source=f.source(),first=zeroCurrent(source,'source'),copy=JSON.stringify(first),before=effects(f),second=snapshot(source,'source');
  assert.notEqual(first,second);assert.notEqual(first.current,second.current);assert.notEqual(first.highWater,second.highWater);assert.throws(()=>{first.current.jobs=100;},TypeError);const get=source.getStatus;
  for(const receiver of [undefined,{},Object.create(source),{...source}])assert.throws(()=>Reflect.apply(get,receiver,[]),{code:'WEB_RESOURCE_SOURCE_INVALID'});
  for(let index=0;index<64;index++)snapshot(source,'source');assert.deepEqual(effects(f),before);await source.close();zeroCurrent(source,'source');assert.equal(JSON.stringify(first),copy);assert.equal(source.isClosed,true);
});
check('RD02 manifest provider is additive and ordinary PNG has no diagnostic method',async f=>{
  const {provider}=make(f),first=zeroCurrent(provider,'provider'),before=effects(f),get=provider.getStatus;
  for(const receiver of [undefined,{},Object.create(provider),{...provider}])assert.throws(()=>Reflect.apply(get,receiver,[]),{code:'WEB_PNG_PROVIDER_INVALID'});
  const second=snapshot(provider,'provider');assert.notEqual(first,second);assert.notEqual(first.current,second.current);assert.notEqual(first.highWater,second.highWater);assert.throws(()=>{first.highWater.jobs=8;},TypeError);assert.deepEqual(effects(f),before);
  const fixture=controlledFixture(),ordinary=f.own(createBrowserTextureProvider(fixture.options));assert.equal('getStatus' in ordinary,false);const value=await f.load(ordinary,fixture.ref,fixture.context);assert.ok(egret.isTexture(value));ordinary.dispose(value);await ordinary.close();assert.equal('getStatus' in ordinary,false);await provider.close();zeroCurrent(provider,'provider');
});
check('RD03 deadline does not refund held fetch or reserve owned bytes before allocation',async f=>{
  const chosen=selection(),source=capability(f.source(chosen,{deadlineMs:80}),'source');let held;f.route=call=>{held=f.hold(f.response(call.url));return held.promise;};const result=f.watch(source.readBytes(chosen.bindings[0].ref,context().value));await until(()=>held!==undefined);
  const active=snapshot(source,'source');assert.equal(active.current.jobs,1);assert.equal(active.current.activeNetwork,1);assert.equal(active.current.encodedCreditBytes,2*E);assert.equal(active.current.ownedEncodedBytes,0);
  assert.equal((await result).cause.code,'WEB_RESOURCE_DEADLINE_EXCEEDED');assert.deepEqual(snapshot(source,'source').current,active.current);const closing=source.close();await pending(closing,'original fetch still owns close');held.resolve();await closing;const final=zeroCurrent(source,'source');assert.equal(final.highWater.jobs,1);assert.equal(final.highWater.encodedCreditBytes,2*E);assert.equal(final.highWater.ownedEncodedBytes,0);assert.equal(active.current.activeNetwork,1);
});
check('RD04 actual body and cancellation settlement retain allocated output separately from credit',async f=>{
  const chosen=selection(),source=capability(f.source(chosen),'source'),request=context(),read=f.hold({done:true,value:undefined}),cancel=f.hold();f.route=call=>Promise.resolve(f.response(call.url,{read:()=>read.promise,cancel:()=>cancel.promise}));const loading=f.watch(source.readBytes(chosen.bindings[0].ref,request.value));await until(()=>f.responses.at(-1).state.reads===1);
  const active=snapshot(source,'source');assert.equal(active.current.ownedEncodedBytes,E);assert.equal(active.current.encodedCreditBytes,2*E);assert.equal(active.current.borrowedChunkBytes,0);request.controller.abort('body remains owned');assert.equal((await loading).fulfilled,false);read.resolve();await drainCpu();assert.equal(snapshot(source,'source').current.activeNetwork,1);assert.equal(snapshot(source,'source').current.ownedEncodedBytes,E);
  const closing=source.close();await pending(closing,'actual cancellation remains held');cancel.resolve();await closing;const final=zeroCurrent(source,'source');assert.equal(final.highWater.ownedEncodedBytes,E);assert.equal(f.responses.at(-1).state.cancels,1);assert.equal(f.responses.at(-1).state.releases,1);
});
check('RD05 synchronous chunk peak counts view length and clean output transfers to caller',async f=>{
  const chosen=selection(),source=capability(f.source(chosen),'source'),half=Math.floor(E/2),large=new Uint8Array(E*32),part=large.subarray(7,7+half);part.set(bytes.subarray(0,half));let index=0;
  f.route=call=>Promise.resolve(f.response(call.url,{read:()=>Promise.resolve(index++===0?{done:false,value:part}:index===2?{done:false,value:bytes.subarray(half)}:{done:true,value:undefined})}));
  // No public reads during the synchronous copy intervals: high-water must retain them.
  const output=await source.readBytes(chosen.bindings[0].ref,context().value);assert.deepEqual([...output],[...bytes]);const final=zeroCurrent(source,'source');assert.equal(final.highWater.ownedEncodedBytes,E);assert.equal(final.highWater.borrowedChunkBytes,Math.max(half,E-half));assert.ok(final.highWater.borrowedChunkBytes<large.byteLength);assert.equal(final.highWater.encodedCreditBytes,2*E);await source.close();assert.deepEqual([...output],[...bytes]);zeroCurrent(source,'source');
});
check('RD06 queued cancellation removes waiters without refunding four held transports',async f=>{
  const chosen=selection(),source=capability(f.source(chosen),'source'),holds=[],active=[];f.route=call=>{const held=f.hold(f.response(call.url));holds.push(held);return held.promise;};for(let index=0;index<4;index++){const request=context();active.push({request,result:f.watch(source.readBytes(chosen.bindings[0].ref,request.value))});}await until(()=>holds.length===4);
  const queued=Array.from({length:3},()=>{const request=context();return {request,result:f.watch(source.readBytes(chosen.bindings[0].ref,request.value))};});const waiting=snapshot(source,'source');assert.equal(waiting.current.jobs,7);assert.equal(waiting.current.queuedNetwork,3);assert.equal(waiting.current.activeNetwork,4);assert.equal(waiting.current.encodedCreditBytes,8*E);
  for(const item of queued)item.request.controller.abort('queued');await Promise.all(queued.map(item=>item.result));await drainCpu();assert.equal(snapshot(source,'source').current.jobs,4);assert.equal(snapshot(source,'source').current.queuedNetwork,0);assert.equal(holds.length,4);for(const item of active)item.request.controller.abort('active');await Promise.all(active.map(item=>item.result));assert.equal(snapshot(source,'source').current.activeNetwork,4);const closing=source.close();for(const hold of holds)hold.resolve();await closing;const final=zeroCurrent(source,'source');assert.equal(final.highWater.jobs,7);assert.equal(final.highWater.queuedNetwork,3);assert.equal(final.highWater.activeNetwork,4);
});
check('RD07 finite real retry delay transfers its waiting gauge to the next transport',async f=>{
  const chosen=selection(),source=capability(f.source(chosen,{networkRetries:1}),'source');let attempts=0,held;f.route=call=>{if(++attempts===1)return Promise.reject(new TypeError('controlled transient'));held=f.hold(f.response(call.url));return held.promise;};const loading=f.watch(source.readBytes(chosen.bindings[0].ref,context().value));await until(()=>source.getStatus().current.retryWaiting===1);
  const delayed=snapshot(source,'source');assert.equal(delayed.current.activeNetwork,0);assert.equal(delayed.current.queuedNetwork,0);assert.equal(delayed.current.encodedCreditBytes,2*E);assert.equal(delayed.current.ownedEncodedBytes,0);await until(()=>held!==undefined);const second=snapshot(source,'source');assert.equal(second.current.retryWaiting,0);assert.equal(second.current.activeNetwork,1);assert.equal(second.current.encodedCreditBytes,2*E);held.resolve();assert.equal((await loading).fulfilled,true);await source.close();const final=zeroCurrent(source,'source');assert.equal(final.highWater.retryWaiting,1);assert.equal(final.highWater.jobs,1);assert.equal(attempts,2);
});
check('RD08 failed reader release stays quarantined and status reads never retry cleanup',async f=>{
  const chosen=selection(),source=capability(f.source(chosen),'source');let attempts=0;const cause=Error('owned release failed');f.owners.find(row=>row.owner===source).closeCode='WEB_RESOURCE_CLOSE_INCOMPLETE';
  f.route=call=>{const response=f.response(call.url);f.responses.at(-1).reader.releaseLock=()=>{attempts++;throw cause;};return Promise.resolve(response);};await refused(source.readBytes(chosen.bindings[0].ref,context().value),'WEB_RESOURCE_CLOSE_INCOMPLETE');await until(()=>source.getStatus().current.quarantinedJobs===1);await refused(source.close(),'WEB_RESOURCE_CLOSE_INCOMPLETE');
  const retained=snapshot(source,'source');assert.equal(retained.current.jobs,1);assert.equal(retained.current.activeNetwork,1);assert.equal(retained.current.encodedCreditBytes,2*E);assert.equal(retained.current.ownedEncodedBytes,E);for(let index=0;index<16;index++)assert.deepEqual(snapshot(source,'source'),retained);assert.equal(attempts,1);
});
check('RD09 providers share decode permits but retain separate source and private copies',async f=>{
  const {chosen,source,png,provider:first}=make(f);capability(source,'source');capability(first,'provider');const other=controlledFixture(),second=capability(f.provider(source,other),'provider'),holds=[],requests=[];png.controls.decode=()=>{const held=f.hold(png.makeBitmap());holds.push(held);return held.promise;};
  for(let index=0;index<2;index++){const request=context();requests.push(request);f.watch(f.load(first,chosen.bindings[0].ref,request.value));}await until(()=>holds.length===2);const third=context(),queued=f.watch(f.load(second,chosen.bindings[0].ref,third.value));await until(()=>source.getStatus().current.queuedDecode===1);
  const s=snapshot(source,'source'),a=snapshot(first,'provider'),b=snapshot(second,'provider');assert.equal(s.current.activeDecode,2);assert.equal(s.current.jobs,3);assert.equal(s.current.encodedCreditBytes,6*E);assert.equal(s.current.ownedEncodedBytes,3*E);assert.equal(a.current.ownedEncodedBytes,2*E);assert.equal(a.current.encodedCreditBytes,2*E);assert.equal(a.current.blobLogicalBytes,2*E);assert.equal(a.current.activeDecodes,2);assert.equal(b.current.ownedEncodedBytes,E);assert.equal(b.current.activeDecodes,0);assert.equal(other.decodeCalls.length,0);
  const before=effects(f,png);for(let index=0;index<32;index++){snapshot(source,'source');snapshot(first,'provider');snapshot(second,'provider');}assert.deepEqual(effects(f,png),before);third.controller.abort('cancel queued decode');assert.equal((await queued).fulfilled,false);await second.close();for(const request of requests)request.controller.abort('held original decoder');await drainCpu();assert.equal(snapshot(source,'source').current.activeDecode,2);assert.equal(snapshot(first,'provider').current.activeDecodes,2);const closing=first.close();await pending(closing,'original decoder promises remain held');
  for(const held of holds)held.resolve();await closing;zeroCurrent(first,'provider');zeroCurrent(second,'provider');zeroCurrent(source,'source');assert.equal(source.isClosed,false);for(const bitmap of png.bitmaps)assert.equal(bitmap.closed,1);
});
check('RD10 synchronous materialization peaks survive clean image ownership transfer',async f=>{
  const {chosen,source,png,provider}=make(f);capability(source,'source');capability(provider,'provider');const initial=zeroCurrent(provider,'provider'),initialText=JSON.stringify(initial),reentry=[];
  png.controls.decode=()=>{const bitmap=png.makeBitmap(),close=bitmap.close;Object.defineProperty(bitmap,'close',{configurable:true,value(){const before=[...png.events];reentry.push(snapshot(provider,'provider'));snapshot(source,'source');assert.deepEqual(png.events,before);return Reflect.apply(close,bitmap,[]);}});return Promise.resolve(bitmap);};
  const value=await f.load(provider,chosen.bindings[0].ref,context().value);assert.ok(egret.isTexture(value));await drainCpu();const done=zeroCurrent(provider,'provider');zeroCurrent(source,'source');assert.equal(value.imageData.byteLength,8);assert.equal(value.isDisposed,false);assert.equal(done.highWater.jobs,1);assert.equal(done.highWater.encodedCreditBytes,E);assert.equal(done.highWater.ownedEncodedBytes,E);assert.equal(done.highWater.blobLogicalBytes,E);assert.equal(done.highWater.activeDecodes,1);assert.equal(done.highWater.bitmapLogicalBytes,8);assert.equal(done.highWater.rasterLogicalBytes,8);assert.equal(done.highWater.readbackCpuBytes,8);assert.equal(done.highWater.materializedCpuBytes,8);assert.equal(done.current.unknownNativeObjects,0);assert.equal(done.highWater.unknownNativeObjects,0);assert.equal(reentry.length,1);assert.equal(reentry[0].current.materializedCpuBytes,8);assert.equal(reentry[0].current.bitmapLogicalBytes,8);assert.equal(JSON.stringify(initial),initialText);
  provider.dispose(value);await provider.close();assert.deepEqual(snapshot(provider,'provider').highWater,done.highWater);zeroCurrent(provider,'provider');
});
check('RD11 late unqualified bitmap cleanup failure remains visible after cancellation',async f=>{
  const {chosen,source,png,provider}=make(f);capability(source,'source');capability(provider,'provider');const request=context();let held,attempts=0,dimensionReads=0;
  png.controls.decode=()=>{const bitmap=png.makeBitmap();Object.defineProperties(bitmap,{width:{get(){dimensionReads++;throw Error('dimensions must not be read after cancellation');}},height:{get(){dimensionReads++;throw Error('dimensions must not be read after cancellation');}},close:{value(){attempts++;throw undefined;}}});held=f.hold(bitmap);return held.promise;};
  const loading=f.watch(f.load(provider,chosen.bindings[0].ref,request.value));await until(()=>held!==undefined);request.controller.abort('cancel before bitmap arrives');assert.equal((await loading).fulfilled,false);assert.equal(snapshot(provider,'provider').current.activeDecodes,1);f.owners.find(row=>row.owner===provider).closeCode='WEB_PNG_CLOSE_INCOMPLETE';const closing=provider.close();await pending(closing,'original decoder owns its late result');held.resolve();await refused(closing,'WEB_PNG_CLOSE_INCOMPLETE');
  const retained=snapshot(provider,'provider');assert.equal(retained.current.jobs,1);assert.equal(retained.current.quarantinedJobs,1);assert.equal(retained.current.activeDecodes,0);assert.equal(retained.current.encodedCreditBytes,E);assert.equal(retained.current.ownedEncodedBytes,E);assert.equal(retained.current.bitmapLogicalBytes,0);assert.equal(retained.current.unknownNativeObjects,1);assert.equal(dimensionReads,0);assert.equal(attempts,1);await source.close();zeroCurrent(source,'source');for(let index=0;index<16;index++)snapshot(provider,'provider');assert.equal(attempts,1);assert.equal(dimensionReads,0);
});
check('RD12 two failed raster resets retain one native object and its known dimensions',async f=>{
  const {chosen,source,png,provider}=make(f);capability(provider,'provider');capability(source,'source');let resets=0;const cause=Error('owned reset refused');
  png.controls.createCanvas=()=>{const canvas=png.makeCanvas();for(const key of ['width','height']){const original=Object.getOwnPropertyDescriptor(canvas,key);Object.defineProperty(canvas,key,{...original,set(value){if(value===0){resets++;throw cause;}Reflect.apply(original.set,canvas,[value]);}});}return canvas;};
  f.owners.find(row=>row.owner===provider).closeCode='WEB_PNG_CLOSE_INCOMPLETE';await refused(f.load(provider,chosen.bindings[0].ref,context().value),'WEB_PNG_CLEANUP_FAILED');await refused(provider.close(),'WEB_PNG_CLOSE_INCOMPLETE');const retained=snapshot(provider,'provider');assert.equal(retained.current.quarantinedJobs,1);assert.equal(retained.current.unknownNativeObjects,1);assert.equal(retained.current.bitmapLogicalBytes,0);assert.equal(retained.current.rasterLogicalBytes,8);assert.equal(retained.current.ownedEncodedBytes,E);assert.equal(retained.highWater.materializedCpuBytes,8);assert.equal(resets,2);for(let index=0;index<16;index++)snapshot(provider,'provider');assert.equal(resets,2);await source.close();zeroCurrent(source,'source');
});
check('RD13 unqualified surface reports unknown object without new dimension getter calls',async f=>{
  const {chosen,source,png,provider}=make(f);capability(provider,'provider');let sizes=0,connected=0;
  png.controls.createCanvas=()=>{const canvas=png.makeCanvas();Object.defineProperties(canvas,{isConnected:{get(){connected++;throw Error('attachment unknown');}},width:{get(){sizes++;throw Error('extra size read');}},height:{get(){sizes++;throw Error('extra size read');}}});return canvas;};
  f.owners.find(row=>row.owner===provider).closeCode='WEB_PNG_CLOSE_INCOMPLETE';await refused(f.load(provider,chosen.bindings[0].ref,context().value));await refused(provider.close(),'WEB_PNG_CLOSE_INCOMPLETE');const status=snapshot(provider,'provider');assert.equal(status.current.quarantinedJobs,1);assert.equal(status.current.unknownNativeObjects,1);assert.equal(status.current.rasterLogicalBytes,0);assert.equal(sizes,0);assert.equal(connected,1);snapshot(provider,'provider');assert.equal(sizes,0);assert.equal(connected,1);await source.close();
});
check('RD14 sequential jobs preserve high-water maxima instead of summing allocations',async f=>{
  const {chosen,source,png,provider}=make(f);capability(source,'source');capability(provider,'provider');let firstSource,firstProvider;
  for(let index=0;index<3;index++){const value=await f.load(provider,chosen.bindings[0].ref,context().value);await drainCpu();zeroCurrent(source,'source');zeroCurrent(provider,'provider');provider.dispose(value);const s=snapshot(source,'source'),p=snapshot(provider,'provider');if(index===0){firstSource=s.highWater;firstProvider=p.highWater;}else{assert.deepEqual(s.highWater,firstSource);assert.deepEqual(p.highWater,firstProvider);}}
  assert.equal(png.decodeCalls.length,3);await provider.close();await source.close();assert.deepEqual(snapshot(source,'source').highWater,firstSource);assert.deepEqual(snapshot(provider,'provider').highWater,firstProvider);
});
check('RD15 actual decoder invocation is active during reentry and synchronous throw retires it',async f=>{
  const {chosen,source,png,provider}=make(f);capability(source,'source');capability(provider,'provider');const cause=Error('owned synchronous decode failure');let calls=0,inside,sourceInside;
  png.controls.decode=()=>{calls++;inside=snapshot(provider,'provider');sourceInside=snapshot(source,'source');throw cause;};
  await refused(f.load(provider,chosen.bindings[0].ref,context().value),'WEB_PNG_DECODE_FAILED');await provider.close();await source.close();const final=zeroCurrent(provider,'provider');zeroCurrent(source,'source');assert.equal(calls,1);assert.equal(inside.current.activeDecodes,1);assert.equal(inside.current.jobs,1);assert.equal(inside.current.ownedEncodedBytes,E);assert.equal(inside.current.blobLogicalBytes,E);assert.equal(inside.current.unknownNativeObjects,0);assert.equal(sourceInside.current.activeDecode,1);assert.equal(final.highWater.activeDecodes,1);assert.equal(final.highWater.unknownNativeObjects,0);assert.equal(png.bitmaps.length,0);assert.equal(png.canvases.length,0);
});
