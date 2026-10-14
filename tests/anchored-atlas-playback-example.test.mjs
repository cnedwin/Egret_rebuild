// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createAnchoredAtlasSession } from '../examples/anchored-atlas-playback/session.mjs';

const RED=Object.freeze({x:0,y:0,width:8,height:6});
const BLUE=Object.freeze({x:8,y:0,width:8,height:6});
// Literal original pixel rows are independent of the provider and its scheduler.
const ROW=Object.freeze([
  255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,
  255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,
  0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,255,
  0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,255,
]);
const ATLAS=Object.freeze([...ROW,...ROW,...ROW,...ROW,...ROW,...ROW]);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
// The only controlled execution boundary is an ordinary public HostAdapter.
function recordingHost(options={}){
  const calls=[],renders=[],timers=new Set();
  const adapter={surface:{},start(){calls.push('start');return options.start?.();},
    stop(){calls.push('stop');return options.stop?.();},
    close(){calls.push('close');return options.close?options.close():Promise.resolve();},
    renderFrame(frame){renders.push(frame);options.render?.(frame,renders.length);return undefined;},
    setTimeout(callback,delayMs){const entry={callback,delayMs};timers.add(entry);return()=>timers.delete(entry);}};
  return{adapter,calls,renders,timers};
}
const outcome=promise=>promise.then(value=>({value}),error=>({error}));
function code(action,expected){let observed;assert.throws(action,error=>{observed=error;assert.equal(error.code,expected);return true;});return observed;}
function causedBy(error,marker){const pending=[error],seen=new Set();while(pending.length){const value=pending.pop();if(value===marker)return true;if(value===null||typeof value!=='object'||seen.has(value))continue;seen.add(value);pending.push(value.cause,...(Array.isArray(value.cleanupErrors)?value.cleanupErrors:[]),...(Array.isArray(value.errors)?value.errors:[]));}return false;}
function frozenSnapshot(snapshot){assert.ok(Object.isFrozen(snapshot));assert.ok(Object.isFrozen(snapshot.cleanupErrors));assert.ok(Number.isInteger(snapshot.pendingTasks)&&snapshot.pendingTasks>=0);}
function noActions(session,expected){for(const name of ['step','pause','resume','replayBaseline','showLive'])code(()=>session[name](),expected);}
function genuine(scene){assert.ok(Object.isFrozen(scene));assert.ok(scene.engine instanceof egret.Engine);assert.ok(scene.resourceScope instanceof egret.Scope);assert.ok(scene.animationScope instanceof egret.Scope);assert.notEqual(scene.resourceScope,scene.animationScope);assert.ok(scene.lease instanceof egret.AssetLease);assert.ok(scene.bitmap instanceof egret.Bitmap);assert.ok(egret.isTexture(scene.texture));assert.equal(scene.lease.value,scene.texture);assert.equal(scene.bitmap.textureLease,scene.lease);assert.equal(scene.bitmap.parent,scene.engine.stage);assert.equal(scene.sheet.isDisposed,false);assert.equal(scene.playback.isDisposed,false);}
function retired(scene){assert.equal(scene.resourceScope.state,'closed');assert.equal(scene.animationScope.state,'closed');assert.equal(scene.bitmap.isDisposed,true);assert.equal(scene.sheet.isDisposed,true);assert.equal(scene.playback.isDisposed,true);assert.equal(scene.texture.isDisposed,true);assert.equal(scene.engine.clock.state,'closed');code(()=>scene.lease.value,'ASSET_LEASE_RELEASED');}
function view(session,source,elapsed,index,color,state='running'){
  const snapshot=session.inspect(),scene=session.scene;frozenSnapshot(snapshot);
  assert.equal(snapshot.state,'ready');assert.equal(snapshot.sourceSeconds,source);assert.equal(snapshot.clockElapsedSeconds,source);assert.equal(scene.engine.clock.elapsedSeconds,source);
  assert.equal(snapshot.playbackState,state);assert.equal(scene.playback.state,state);assert.equal(scene.playback.elapsedSeconds,elapsed);assert.equal(snapshot.frameIndex,index);assert.equal(scene.playback.lastSample.frameIndex,index);assert.equal(snapshot.liveColor,color);assert.deepEqual(scene.bitmap.sourceRect,color==='red'?RED:BLUE);return snapshot;
}
async function readySession(options={}){const port=recordingHost(options.host);const session=createAnchoredAtlasSession({host:port.adapter,preset:'verification',...options.session});try{await session.ready;return{port,session};}catch(error){await session.close().catch(()=>{});throw error;}}

// A synchronous handle makes Close available while genuine host startup is pending.
test('AAP00 frozen session guards startup and stable Close awaits original start',async()=>{
  const entered=deferred(),start=deferred();const port=recordingHost({start(){entered.resolve();return start.promise;}});
  const session=createAnchoredAtlasSession({host:port.adapter,preset:'verification'}),ready=outcome(session.ready);
  try{assert.ok(Object.isFrozen(session));assert.ok(session.ready instanceof Promise);frozenSnapshot(session.inspect());noActions(session,'EXAMPLE_NOT_READY');await entered.promise;
    const closing=session.close();assert.equal(session.close(),closing);assert.equal(session.inspect().state,'closing');noActions(session,'EXAMPLE_CLOSED');let settled=false;void closing.then(()=>{settled=true;},()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);start.resolve();await closing;
    const result=await ready;assert.equal(result.error.code,'EXAMPLE_CLOSED');assert.equal(session.inspect().primaryOccurred,false);assert.equal(session.inspect().state,'closed');assert.equal(session.inspect().pendingTasks,0);assert.equal(port.renders.length,0);assert.deepEqual(port.calls,['start','stop','close']);assert.equal(port.timers.size,0);
  }finally{start.resolve();await session.close().catch(()=>{});await ready;}
});

test('AAP01 ready composes genuine public identities and the sole original lease',async()=>{
  const {port,session}=await readySession();try{
    const s=session.scene;genuine(s);const ready=await session.ready;frozenSnapshot(ready);assert.equal(ready.state,'ready');assert.deepEqual(ready,session.inspect());
    for(const name of ['anchorOffsetX','anchorOffsetY']){const descriptor=Object.getOwnPropertyDescriptor(egret.DisplayObject.prototype,name);assert.equal(typeof descriptor?.get,'function');assert.equal(typeof descriptor?.set,'function');assert.equal(Object.hasOwn(s.bitmap,name),false);}
    assert.deepEqual([s.bitmap.anchorOffsetX,s.bitmap.anchorOffsetY],[4,3]);assert.deepEqual(s.sheet.names,['red','blue']);assert.deepEqual(s.sheet.getRegion('red'),RED);assert.deepEqual(s.sheet.getRegion('blue'),BLUE);assert.equal(s.sheet.frameCount,2);assert.deepEqual([s.sheet.atlasWidth,s.sheet.atlasHeight],[16,6]);
    assert.equal(s.resourceScope.state,'open');assert.equal(s.animationScope.state,'open');assert.equal(session.inspect().loads,1);assert.equal(session.inspect().disposals,0);assert.equal(session.inspect().primaryOccurred,false);assert.equal(session.inspect().pendingTasks,0);assert.deepEqual(session.inspect().cleanupErrors,[]);assert.equal(port.renders[0],s.savedFrame);view(session,0,0,0,'red');
  }finally{await session.close();}
});

test('AAP02 exact first-party atlas and saved immutable image outlive wrapper disposal',async()=>{
  const {session}=await readySession();const scene=session.scene,saved=scene.savedFrame,image=scene.texture.imageData;
  try{assert.equal(saved.images[0],image);assert.deepEqual([image.width,image.height],[16,6]);const copy=egret.copyImageData2DPixels(image);assert.deepEqual([...copy],ATLAS);copy.fill(7);assert.deepEqual([...egret.copyImageData2DPixels(image)],ATLAS);assert.ok(Object.isFrozen(saved));assert.ok(Object.isFrozen(saved.commands));assert.ok(Object.isFrozen(saved.commands[0]));}
  finally{await session.close();}
  retired(scene);assert.equal(scene.savedFrame,saved);assert.equal(saved.images[0],image);assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])],ATLAS);assert.deepEqual(saved.commands[0].sourceRect,RED);assert.equal(session.inspect().loads,1);assert.equal(session.inspect().disposals,1);
});

// Expected rectangles are hand-calculated, without a second transform/capture path.
test('AAP03 verification and default preview retain the authored pivot geometry',async t=>{
  for(const preset of ['verification','preview'])await t.test(preset,async()=>{
    const port=recordingHost(),session=createAnchoredAtlasSession({host:port.adapter,...(preset==='verification'?{preset}:{})});try{await session.ready;const s=session.scene,f=s.savedFrame,c=f.commands[0],verification=preset==='verification',scale=verification?1:8,tx=verification?8:64,ty=verification?9:72;
      assert.deepEqual([f.width,f.height],verification?[24,24]:[192,192]);if(verification)assert.deepEqual([f.clearColor,f.clearAlpha],[0,0]);assert.equal(f.commands.length,1);assert.equal(c.kind,'image');assert.equal(c.imageIndex,0);assert.deepEqual(c.rect,{x:0,y:0,width:8,height:6});assert.deepEqual(c.sourceRect,RED);assert.equal(c.matrix.a,scale);assert.equal(c.matrix.d,scale);assert.ok(c.matrix.b===0&&c.matrix.c===0);assert.deepEqual([c.matrix.tx,c.matrix.ty],[tx,ty]);assert.deepEqual(s.bitmap.getBounds(),{x:0,y:0,width:8,height:6});assert.deepEqual(s.engine.stage.getBounds(),{x:tx,y:ty,width:8*scale,height:6*scale});assert.deepEqual([s.bitmap.x,s.bitmap.y],verification?[12,12]:[96,96]);assert.deepEqual([s.bitmap.scaleX,s.bitmap.scaleY,s.bitmap.rotation],[scale,scale,0]);
    }finally{await session.close();}
  });
});

test('AAP04 complete literal N1-N7 clock, pause-gap, crops and exact saved replay',async()=>{
  const {port,session}=await readySession();try{const saved=session.scene.savedFrame,image=saved.images[0];view(session,0,0,0,'red');assert.equal(port.renders.length,1);
    session.step();view(session,0.125,0.125,1,'blue');assert.equal(port.renders.length,2);const tick2=session.scene.engine.clock.tickId;
    const paused=session.pause();assert.equal(paused.playbackState,'paused');assert.equal(port.renders.length,2);assert.equal(session.scene.engine.clock.tickId,tick2);
    session.step();view(session,0.25,0.125,1,'blue','paused');assert.equal(port.renders.length,3);const tick3=session.scene.engine.clock.tickId;
    session.resume();assert.equal(port.renders.length,3);assert.equal(session.scene.engine.clock.tickId,tick3);
    session.step();view(session,0.375,0.25,0,'red');session.step();view(session,0.5,0.375,1,'blue');assert.equal(port.renders.length,5);
    const liveSample=session.scene.playback.lastSample,tick5=session.scene.engine.clock.tickId;
    const replay=session.replayBaseline();view(session,0.5,0.375,1,'blue');assert.equal(replay.presentedColor,'red');assert.equal(port.renders[5],saved);assert.equal(session.scene.playback.lastSample,liveSample);assert.equal(session.scene.engine.clock.tickId,tick5);
    const live=session.showLive();view(session,0.5,0.375,1,'blue');assert.equal(live.presentedColor,'blue');assert.equal(port.renders.length,7);assert.notEqual(port.renders[6],saved);assert.deepEqual(port.renders[6].commands[0].sourceRect,BLUE);assert.equal(new Set(port.renders).size,6);assert.equal(session.scene.playback.lastSample,liveSample);assert.equal(session.scene.engine.clock.tickId,tick5);assert.ok(port.renders.every(f=>f.images[0]===image));assert.deepEqual(port.renders.map(f=>f.commands[0].sourceRect),[RED,BLUE,BLUE,RED,BLUE,RED,BLUE]);
  }finally{await session.close();}
});

// A pending successful close is not safe return until the real host Promise settles.
test('AAP05 pending host close gates operations and retains surface ownership',async()=>{
  const entered=deferred(),barrier=deferred();const {port,session}=await readySession({host:{close(){entered.resolve();return barrier.promise;}}});let reused;
  try{const pending=session.close();assert.equal(session.close(),pending);await entered.promise;assert.equal(session.inspect().state,'closing');noActions(session,'EXAMPLE_CLOSED');let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);assert.equal(session.inspect().disposals,1);
    await assert.rejects(egret.createEngine({host:port.adapter}),error=>error.code==='SURFACE_IN_USE');barrier.resolve();await pending;assert.equal(session.inspect().state,'closed');assert.equal(session.inspect().pendingTasks,0);assert.equal(port.timers.size,0);
    reused=await egret.createEngine({host:port.adapter});await reused.dispose();
  }finally{barrier.resolve();await session.close().catch(()=>{});if(reused)await reused.dispose();}
});

test('AAP06 animation retires before the sole resource owner and repeated Close is inert',async()=>{
  const {port,session}=await readySession();const s=session.scene,order=[];let resourceAbort;
  try{s.animationScope.signal.addEventListener('abort',()=>order.push('animation'),{once:true});s.resourceScope.signal.addEventListener('abort',()=>{order.push('resources');resourceAbort={playbackDisposed:s.playback.isDisposed,leaseValue:s.lease.value,textureDisposed:s.texture.isDisposed};},{once:true});
    const pending=session.close();assert.equal(session.close(),pending);noActions(session,'EXAMPLE_CLOSED');await pending;retired(s);assert.deepEqual(order,['animation','resources']);assert.deepEqual(resourceAbort,{playbackDisposed:true,leaseValue:s.texture,textureDisposed:false});assert.equal(session.close(),pending);assert.equal(session.inspect().state,'closed');assert.equal(session.inspect().loads,1);assert.equal(session.inspect().disposals,1);assert.equal(session.inspect().pendingTasks,0);assert.equal(session.inspect().primaryOccurred,false);assert.deepEqual(session.inspect().cleanupErrors,[]);assert.deepEqual(port.calls,['start','stop','close']);assert.equal(port.timers.size,0);const terminal=session.inspect();noActions(session,'EXAMPLE_CLOSED');assert.deepEqual(session.inspect(),terminal);assert.equal(session.scene.savedFrame,s.savedFrame);
  }finally{await session.close();}
});

test('AAP07 Close during genuine provider preparation waits without creating a cancelled Texture',async()=>{
  const entered=deferred(),barrier=deferred(),port=recordingHost();const session=createAnchoredAtlasSession({host:port.adapter,preset:'verification',prepareAtlas:async()=>{entered.resolve();await barrier.promise;}}),ready=outcome(session.ready);
  try{await entered.promise;assert.equal(session.inspect().loads,1);assert.equal(session.scene.texture,undefined);const pending=session.close();assert.equal(session.close(),pending);assert.equal(session.inspect().state,'closing');noActions(session,'EXAMPLE_CLOSED');assert.ok(session.inspect().pendingTasks>=1);assert.equal(session.scene.resourceScope.state,'closed');assert.equal(session.scene.animationScope.state,'closed');let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
    barrier.resolve();await pending;const result=await ready;assert.equal(result.error.code,'EXAMPLE_CLOSED');const state=session.inspect();assert.equal(state.primaryOccurred,false);assert.notEqual(state.initializationCause,undefined);assert.equal(state.state,'closed');assert.equal(state.pendingTasks,0);assert.deepEqual([state.loads,state.disposals],[1,0]);assert.equal(session.scene.texture,undefined);assert.equal(session.scene.lease,undefined);assert.equal(port.renders.length,0);assert.deepEqual(port.calls,['start','stop','close']);assert.equal(port.timers.size,0);
  }finally{barrier.resolve();await session.close().catch(()=>{});await ready;}
});

test('AAP08 genuine preparation refusal preserves its original error chain after cleanup',async()=>{
  const marker=new Error('original preparation refusal'),port=recordingHost();const session=createAnchoredAtlasSession({host:port.adapter,preset:'verification',prepareAtlas:async()=>{throw marker;}}),ready=outcome(session.ready);
  try{const result=await ready;assert.ok(result.error);assert.ok(causedBy(result.error,marker));const state=session.inspect();assert.equal(state.primaryOccurred,true);assert.equal(state.primaryCause,result.error);assert.equal(state.initializationCause,result.error);assert.equal(state.state,'closed');assert.equal(state.pendingTasks,0);assert.deepEqual([state.loads,state.disposals],[1,0]);assert.equal(session.scene.texture,undefined);assert.equal(port.renders.length,0);assert.deepEqual(port.calls,['start','stop','close']);assert.deepEqual(state.cleanupErrors,[]);const pending=session.close();assert.equal(session.close(),pending);await pending;assert.equal(port.timers.size,0);
  }finally{await session.close().catch(()=>{});await ready;}
});

test('AAP09 failed original host startup keeps the genuine Engine error and cleanup',async()=>{
  const marker=new Error('original host startup refusal'),port=recordingHost({start:()=>Promise.reject(marker)}),session=createAnchoredAtlasSession({host:port.adapter,preset:'verification'}),ready=outcome(session.ready);
  try{const result=await ready;assert.ok(causedBy(result.error,marker));const state=session.inspect();assert.equal(state.primaryOccurred,true);assert.equal(state.primaryCause,result.error);assert.equal(state.initializationCause,result.error);assert.equal(state.state,'closed');assert.equal(state.pendingTasks,0);assert.deepEqual([state.loads,state.disposals],[0,0]);assert.equal(port.renders.length,0);assert.deepEqual(port.calls,['start','stop','close']);noActions(session,'EXAMPLE_CLOSED');await session.close();assert.equal(port.timers.size,0);
  }finally{await session.close().catch(()=>{});await ready;}
});

// Port failures preserve actual outer errors; expected wrappers are not invented.
test('AAP10 original render refusal preserves initialization or committed operation state',async t=>{
  for(const refuseAt of [1,2])await t.test('presentation '+refuseAt,async()=>{
    const marker=new Error('original render refusal '+refuseAt),port=recordingHost({render(_frame,n){if(n===refuseAt)throw marker;}}),session=createAnchoredAtlasSession({host:port.adapter,preset:'verification'}),ready=outcome(session.ready);let observed;
    try{if(refuseAt===1){const result=await ready;observed=result.error;assert.equal(session.inspect().initializationCause,observed);}else{await session.ready;assert.throws(()=>session.step(),error=>{observed=error;return true;});assert.deepEqual(session.scene.bitmap.sourceRect,BLUE);assert.equal(session.scene.engine.clock.elapsedSeconds,0.125);}
      assert.ok(causedBy(observed,marker));assert.equal(session.inspect().primaryOccurred,true);assert.equal(session.inspect().primaryCause,observed);assert.equal(session.inspect().sourceSeconds,refuseAt===1?0:0.125);assert.equal(port.renders.length,refuseAt);const pending=session.close();assert.equal(session.close(),pending);noActions(session,'EXAMPLE_CLOSED');await pending;retired(session.scene);assert.equal(session.inspect().state,'closed');assert.equal(session.inspect().pendingTasks,0);assert.deepEqual([session.inspect().loads,session.inspect().disposals],[1,1]);assert.deepEqual(session.inspect().cleanupErrors,[]);assert.deepEqual(port.calls,['start','stop','close']);assert.equal(port.timers.size,0);
    }finally{await session.close().catch(()=>{});await ready;}
  });
});

test('AAP11 secondary host-close refusal neither replaces primary nor returns the surface',async()=>{
  const primary=new Error('original later presentation refusal'),secondary=new Error('original host safe-close refusal');
  const {port,session}=await readySession({host:{render(_frame,n){if(n===2)throw primary;},close:()=>Promise.reject(secondary)}});let operation;
  try{assert.throws(()=>session.step(),error=>{operation=error;return true;});assert.ok(causedBy(operation,primary));const pending=session.close();assert.equal(session.close(),pending);const result=await outcome(pending);assert.ok(result.error);assert.ok(causedBy(result.error,secondary));const state=session.inspect();frozenSnapshot(state);assert.equal(state.state,'closed');assert.equal(state.pendingTasks,0);assert.equal(state.primaryOccurred,true);assert.equal(state.primaryCause,operation);assert.equal(state.cleanupErrors.length,1);assert.equal(state.cleanupErrors[0],result.error);assert.deepEqual([state.loads,state.disposals],[1,1]);retired(session.scene);assert.deepEqual(port.calls,['start','stop','close']);assert.equal(port.timers.size,0);noActions(session,'EXAMPLE_CLOSED');await assert.rejects(egret.createEngine({host:port.adapter}),error=>error.code==='SURFACE_IN_USE');assert.equal(session.close(),pending);
  }finally{await session.close().catch(()=>{});}
});
