import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as gpu from '@egret/engine/webgpu';
import * as sceneCPU from '@egret/engine/scene3d';
import * as sceneGPU from '@egret/engine/webgpu/scene3d';
import { PROFILE, tick, exactCause, observe, watched, withFrames } from './textured-webgpu-host-fixtures.mjs';
import { triangleScene, emptyScene, emptyDrawScene, combinedFactory, withCombinedGPU,
  activeCombined, admitted, snapshot, unchanged, jointStatus, jointOverlay,
  emptyOverlay, orderedOverlay, noCombinedMethod, assertBorrowed, closedCapture, code,
} from './textured-scene-webgpu-host-fixtures.mjs';

// First-party Apache-2.0 tests. The built public SDK executes over controlled
// GPU boundaries. These observations do not establish native pixel correctness.
const count = (f,name) => f.calls.filter(call=>call[0]===name).length;
const zero = host => jointStatus(host,{serial:0,frames:0,upload:0,geometry:0,scene:0,uniform:0,depth:0});
const one = (host,extra={}) => jointStatus(host,{serial:1,frames:1,upload:404,geometry:204,scene:84,uniform:64,depth:256,...extra});

test('CH00 real legacy baselines complete before the named missing combined API assertion',async t=>{
  await withFrames(async a=>{
    a.clear(); a.addMesh(a.canonical);
    const textured = a.capture({width:8,height:8,clearAlpha:1}), scene = triangleScene();
    assert.equal(a.engine instanceof egret.Engine,true);
    assert.equal(a.lease instanceof egret.AssetLease,true);
    assert.equal(a.lease.value,a.texture);
    assert.equal(egret.isTexturedGeometry2D(a.canonical),true);
    assert.equal(sceneCPU.isSceneFrame3D(scene),true);
    assert.equal(textured.profile,PROFILE); assert.equal(textured.clearAlpha,1);
    await withCombinedGPU(async f=>{
      const old = f.keep(gpu.createTexturedWebGPUHost(f.options())); await f.ready(old);
      const proof = f.proof(()=>old.renderTexturedFrame(textured)); admitted(proof);
      assert.equal(count(f,'draw'),1); assert.equal(count(f,'submit'),1);
      assert.equal(old.getStatus().lastSerial,1); assert.equal(old.getTexturedStatus().pendingGeometryBytes,204);
      assert.deepEqual(f.pipelines.map(value=>value.kind),['rect','image','textured']);
      await proof.finish(); await old.whenIdle(); await f.close(old); assertBorrowed(f);
    });
    a.clear(); a.addRect();
    const ordinary = a.engine.captureFrame({width:8,height:8,clearAlpha:1});
    assert.deepEqual(ordinary.commands.map(value=>value.kind),['rect']);
    await withCombinedGPU(async f=>{
      const old = f.keep(sceneGPU.createSceneWebGPUHost(f.options())); await f.ready(old);
      const proof = f.proof(()=>old.renderSceneFrame(scene,ordinary)); admitted(proof);
      assert.deepEqual(f.pipelines.map(value=>value.kind),['rect','image','scene']);
      assert.equal(count(f,'drawIndexed'),1); assert.equal(count(f,'draw'),1);
      assert.equal(count(f,'pass'),2); assert.equal(count(f,'submit'),1);
      assert.equal(old.getSceneStatus().pendingSceneBytes,84);
      await proof.finish(); await old.whenIdle(); await f.close(old); assertBorrowed(f);
    });
  });
  // Both borrowed boundaries, genuine Engine resources and navigator restoration
  // have completed. Only this final missing export is the assigned initial RED.
  t.diagnostic('COMBINED_HOST_BASELINE_COMPLETE');
  assert.equal(typeof sceneGPU.createTexturedSceneWebGPUHost,'function','COMBINED_SCENE_TEXTURED_HOST_REQUIRED');
});

test('CH01 exact opt-in capability starts four independent roles and a genuine profile Engine',async()=>{
  await withCombinedGPU(async f=>{
    const host = f.keep(combinedFactory(f.options()));
    assert.deepEqual(f.calls,[]);
    assert.equal(host.surface,f.canvas);
    for (const name of ['texturedFrameProfile','renderTexturedFrame','getTexturedStatus','renderSceneFrame','getSceneStatus','renderSceneTexturedFrame']) {
      const descriptor = Object.getOwnPropertyDescriptor(host,name);
      assert.ok(descriptor,name); assert.equal(descriptor.writable,false); assert.equal(descriptor.configurable,false);
      assert.equal(Object.hasOwn(Object.getPrototypeOf(host),name),false);
    }
    assert.equal(host.texturedFrameProfile,egret.TEXTURED_FRAME_PROFILE_2D);
    const starting = observe(host.start()), state = watched(starting); await tick();
    assert.deepEqual(f.pipelines.map(value=>value.kind),['rect','image','scene','textured']);
    assert.equal(f.open,0); assert.equal(f.scopes.length,3);
    f.pipelines.filter(value=>value.kind!=='scene').forEach(value=>value.resolve(value.value));
    f.settleScopes(); await tick(); assert.equal(state.settled,false);
    assert.equal(count(f,'configure'),0);
    f.pipelines[2].resolve(f.pipelines[2].value); await f.pump(); await starting;
    assert.deepEqual(f.calls.filter(call=>call[0]==='layout').map(call=>call.slice(1)),[['image',0],['scene',0],['textured',0]]);
    const sceneRole = f.pipelines[2], meshRole = f.pipelines[3];
    assert.notEqual(sceneRole.value,meshRole.value); assert.notEqual(sceneRole.layout,meshRole.layout);
    assert.deepEqual([sceneRole.descriptor.vertex.buffers[0].arrayStride,meshRole.descriptor.vertex.buffers[0].arrayStride],[24,32]);
    assert.deepEqual([sceneRole.descriptor.depthStencil.format,sceneRole.descriptor.depthStencil.depthWriteEnabled,sceneRole.descriptor.depthStencil.depthCompare],['depth32float',true,'greater']);
    assert.equal(meshRole.descriptor.depthStencil,undefined);
    const engine = await egret.createEngineForProfile({host},egret.TEXTURED_FRAME_PROFILE_2D);
    try {
      const before = count(f,'submit'), overlay = engine.captureTexturedFrame({width:8,height:8,clearAlpha:1});
      assert.equal(count(f,'submit'),before,'capture is render inert');
      const proof = f.proof(()=>host.renderSceneTexturedFrame(emptyScene(),overlay)); admitted(proof);
      assert.equal(count(f,'pass'),2); assert.equal(count(f,'submit'),before+1);
      await proof.finish(); await host.whenIdle();
    } finally { const closing = observe(engine.dispose()); await f.pump(); await closing; }
    assertBorrowed(f);
  });
  await withCombinedGPU(async f=>{
    for (const factory of [gpu.createWebGPUHost,gpu.createTexturedWebGPUHost,sceneGPU.createSceneWebGPUHost]) noCombinedMethod(f.keep(factory(f.options())));
    assert.deepEqual(Object.keys(gpu).sort(),['createTexturedWebGPUHost','createWebGPUHost']);
    assert.equal(Object.hasOwn(egret,'createTexturedSceneWebGPUHost'),false);
    assert.deepEqual(f.calls,[]);
  });
});

test('CH02 same target two ordered passes one submit and final readback preserve captured painter order',async()=>{
  await withFrames(a=>withCombinedGPU(async f=>{
    const host = await activeCombined(f,{enableReadback:true}), scene = triangleScene();
    const authored = orderedOverlay(a), overlay = authored.frame;
    try {
      const ticket = observe(host.requestReadback()), pending = watched(ticket);
      const before = f.calls.length, proof = f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(proof);
      const calls = f.calls.slice(before), passes = calls.filter(call=>call[0]==='pass').map(call=>call[1]);
      assert.equal(passes.length,2);
      assert.equal(passes[0].colorAttachments[0].loadOp,'clear');
      assert.equal(passes[0].colorAttachments[0].clearValue.a,1);
      assert.equal(passes[1].colorAttachments[0].loadOp,'load');
      assert.equal(passes[0].colorAttachments[0].view,passes[1].colorAttachments[0].view);
      assert.equal(passes[0].depthStencilAttachment.view.texture.descriptor.format,'depth32float');
      assert.equal(passes[0].depthStencilAttachment.depthClearValue,0);
      assert.equal(passes[0].depthStencilAttachment.depthStoreOp,'store');
      assert.equal(passes[1].depthStencilAttachment,undefined);
      for (const name of ['target','targetView','encoder','finish','submit']) assert.equal(calls.filter(call=>call[0]===name).length,1,name);
      assert.deepEqual(calls.filter(call=>call[0]==='setPipeline').map(call=>call[1].kind),['scene','rect','textured','image','rect','textured']);
      assert.deepEqual(calls.filter(call=>call[0]==='draw'||call[0]==='drawIndexed').map(call=>call[0]),['drawIndexed','draw','draw','draw','draw','draw']);
      const ends = calls.flatMap((call,index)=>call[0]==='end'?[index]:[]);
      assert.equal(ends.length,2); assert.ok(calls.findIndex(call=>call[0]==='copy')>ends[1]);
      assert.ok(calls.some(call=>call[0]==='setScissorRect'),'real prepared UI draws reach the guarded encoder');
      const layouts = new Set(f.pipelines.map(value=>value.layout));
      for (const binding of calls.filter(call=>call[0]==='binding').map(call=>call[1])) assert.ok(layouts.has(binding.descriptor.layout));
      assert.ok(calls.some(call=>call[0]==='binding'&&call[1].descriptor.layout===f.pipelines[2].layout));
      assert.ok(calls.some(call=>call[0]==='binding'&&call[1].descriptor.layout===f.pipelines[3].layout));
      proof.resolveFences(); proof.resolveMaps(); await tick(); assert.equal(pending.settled,false,'error scopes remain independently owned');
      proof.settleScopes(); await f.pump();
      const result = await ticket; await host.whenIdle();
      assert.equal(Object.isFrozen(result),true);
      assert.deepEqual([result.frameId,result.serial,result.width,result.height,result.format,result.sourceFormat,result.colorSpace,result.alphaMode,result.bytes.byteLength],
        [overlay.frameId,1,8,8,'rgba8unorm','rgba8unorm','srgb','premultiplied',256]);
      // Mock buffer bytes are not a pixel oracle. The second ticket only checks
      // the public frameId/serial and one-owner final-copy contract.
      const replayTicket = observe(host.requestReadback());
      const replay = f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(replay);
      await replay.finish(); await f.pump(); const repeated = await replayTicket;
      assert.equal(repeated.frameId,overlay.frameId); assert.equal(repeated.serial,2);
      await host.whenIdle();
    } finally { authored.scope.dispose(); }
  }));
});

test('CH03 genuine identity state-before-busy and explicit opaque clearing gate all new work',async()=>{
  await withFrames(a=>withCombinedGPU(async f=>{
    const scene = triangleScene(), overlay = jointOverlay(a), host = f.keep(combinedFactory(f.options()));
    let reads = 0;
    const hostile = new Proxy({}, {get(){reads++;throw Error('foreign read');},ownKeys(){reads++;throw Error('foreign keys');},getPrototypeOf(){reads++;throw Error('foreign prototype');}});
    const revoked = Proxy.revocable({},{}); revoked.revoke();
    assert.throws(()=>host.renderSceneTexturedFrame(hostile,hostile),code('NOT_STARTED'));
    const starting = observe(host.start()); await tick();
    assert.throws(()=>host.renderSceneTexturedFrame(hostile,hostile),code('NOT_STARTED'));
    await f.pump(); await starting;
    for (const [left,right] of [[{...scene},overlay],[new Proxy(scene,{}),overlay],[hostile,hostile],[revoked.proxy,overlay],[scene,{...overlay}],[scene,new Proxy(overlay,{})],[scene,hostile],[scene,revoked.proxy]]) {
      const before = snapshot(f,host); assert.throws(()=>host.renderSceneTexturedFrame(left,right),code('FRAME_INVALID')); unchanged(f,host,before);
    }
    assert.equal(reads,0); zero(host);
    const transparent = a.capture({width:8,height:8,clearAlpha:0}), before = snapshot(f,host);
    assert.throws(()=>host.renderSceneTexturedFrame(scene,transparent),code('FRAME_INVALID')); unchanged(f,host,before);
    assert.throws(()=>host.renderSceneFrame(scene,overlay),code('FRAME_PROFILE_UNSUPPORTED')); unchanged(f,host,before);
    let nested;
    f.hooks.writeBuffer = () => {
      delete f.hooks.writeBuffer;
      try { host.renderSceneTexturedFrame(hostile,hostile); } catch(error) { nested=error; }
    };
    const accepted = f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(accepted);
    assert.ok(code('REENTRANT')(nested)); assert.equal(reads,0); await accepted.finish(); await host.whenIdle();
    host.stop(); assert.throws(()=>host.renderSceneTexturedFrame(hostile,hostile),code('STOPPED'));
    const closing = observe(host.close()); assert.equal(host.close(),closing);
    assert.throws(()=>host.renderSceneTexturedFrame(hostile,hostile),code('CLOSED'));
    await f.pump(); await closing; assert.throws(()=>host.renderSceneTexturedFrame(hostile,hostile),code('CLOSED')); assert.equal(reads,0);
  }));
  await withFrames(a=>withCombinedGPU(async f=>{
    const host = await activeCombined(f), cause = Object.freeze({fault:'scene draw'}), overlay = jointOverlay(a);
    f.hooks.drawIndexed = () => {throw cause;};
    assert.throws(()=>host.renderSceneTexturedFrame(triangleScene(),overlay),exactCause('RENDER_FAILED',cause));
    const before = f.calls.length;
    assert.throws(()=>host.renderSceneTexturedFrame({},{}),exactCause('FAILED',cause)); assert.equal(f.calls.length,before);
    delete f.hooks.drawIndexed; await f.pump();
  }));
});

test('CH04 independent 404 joint budget empty depth and empty-draw uniform charge precede mutation',async()=>{
  await withFrames(async a=>{
    const scene = triangleScene(), overlay = jointOverlay(a);
    // Hand-derived: scene vertices72 + indices12 + MVP64 + rect144 +
    // textured vertices96 + alpha16 = 404. G204/T4/D256/R2304 are distinct.
    for (const cap of [403,404]) await withCombinedGPU(async f=>{
      const host = await activeCombined(f,{maxUploadBytes:cap,enableReadback:true});
      const ticket = observe(host.requestReadback()), waiting = watched(ticket), before = snapshot(f,host);
      const NativeFloats = globalThis.Float32Array, NativeBytes = globalThis.Uint8Array;
      const payload = {mvp:0,scene:0,rect:0,textured:0,alpha:0,crop:0};
      // Observe render-time payload only: existing genuine inputs were built
      // before this boundary. Literal lengths follow72/144/96-byte vertices
      // and the separate T4 crop; mock byte views take buffers/arrays, not4.
      const witness = run => {
        try {
          globalThis.Float32Array = new Proxy(NativeFloats,{construct(target,args,newTarget) {
            const input=args[0];
            if (input===scene.draws[0].mvp) payload.mvp++;
            else if (input===18) payload.scene++;
            else if (input===36) payload.rect++;
            else if (input===24) payload.textured++;
            else if (Array.isArray(input)&&input.length===4) payload.alpha++;
            return Reflect.construct(target,args,newTarget);
          }});
          globalThis.Uint8Array = new Proxy(NativeBytes,{construct(target,args,newTarget) {
            if (args[0]===4) payload.crop++;
            return Reflect.construct(target,args,newTarget);
          }});
          return run();
        } finally { globalThis.Float32Array=NativeFloats; globalThis.Uint8Array=NativeBytes; }
      };
      if (cap===403) {
        witness(()=>assert.throws(()=>host.renderSceneTexturedFrame(scene,overlay),code('FRAME_BUDGET'))); unchanged(f,host,before); zero(host);
        assert.deepEqual(payload,{mvp:0,scene:0,rect:0,textured:0,alpha:0,crop:0},'joint refusal precedes every observed CPU payload boundary');
        await tick(); assert.equal(waiting.settled,false);
        const proof = f.proof(()=>host.renderSceneTexturedFrame(emptyScene(),overlay)); admitted(proof);
        jointStatus(host,{serial:1,frames:1,upload:256,geometry:204,scene:0,uniform:0,depth:256,readback:2304});
        await proof.finish(); await f.pump();
      } else {
        const proof = witness(()=>f.proof(()=>host.renderSceneTexturedFrame(scene,overlay))); admitted(proof); one(host,{readback:2304});
        for (const [kind,observed] of Object.entries(payload)) assert.ok(observed>0,'accepted404 proves a non-vacuous '+kind+' payload witness');
        await proof.finish(); await f.pump();
      }
      const pixels = await ticket; assert.equal(pixels.serial,1); assert.equal(pixels.frameId,overlay.frameId); await host.whenIdle();
    });
    const empty = emptyOverlay(a);
    for (const [value,uniform] of [[emptyScene(),0],[emptyDrawScene(),64]]) await withCombinedGPU(async f=>{
      const host = await activeCombined(f), proof = f.proof(()=>host.renderSceneTexturedFrame(value,empty)); admitted(proof);
      jointStatus(host,{serial:1,frames:1,upload:uniform,geometry:0,scene:0,uniform,depth:256});
      assert.equal(count(f,'pass'),2); assert.equal(count(f,'drawIndexed'),0);
      assert.equal(f.textures.filter(texture=>texture.descriptor.format==='depth32float').length,1);
      await proof.finish(); await host.whenIdle();
    });
    await withCombinedGPU(async f=>{
      f.limits.maxBufferSize=71;
      const host = await activeCombined(f,{maxUploadBytes:1}), before = snapshot(f,host);
      assert.throws(()=>host.renderSceneTexturedFrame(scene,overlay),code('DEVICE_LIMIT'),'earlier genuine scene hardware gate precedes later joint upload budget');
      unchanged(f,host,before); zero(host);
    });
  });
});

test('CH05 held joint records share capacities and leave refused readback tickets unbound',async()=>{
  await withFrames(async a=>{
    const scene = triangleScene(), overlay = jointOverlay(a);
    for (const [options,acceptsTwo] of [[{maxPendingUploadBytes:807},false],[{maxPendingUploadBytes:808},true],[{maxPendingGeometryBytes:407},false],[{maxPendingGeometryBytes:408},true]]) await withCombinedGPU(async f=>{
      const host = await activeCombined(f,{...options,enableReadback:true});
      // First record has no selected ticket. Its unresolved fence retains every
      // applicable facet while a new single ticket is armed for the second.
      const first = f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(first); first.settleScopes();
      one(host); assert.equal(first.maps.length,0); assert.equal(count(f,'copy'),0);
      assert.equal(f.calls.find(call=>call[0]==='writeTexture')[2].byteLength,4,'T4 is not added to U404');
      const ticket = observe(host.requestReadback()), pending = watched(ticket);
      let second;
      if (!acceptsTwo) {
        const before = snapshot(f,host);
        assert.throws(()=>host.renderSceneTexturedFrame(scene,overlay),code('BACKPRESSURE')); unchanged(f,host,before); one(host);
        await tick(); assert.equal(pending.settled,false);
        await first.finish(); await host.whenIdle();
        second = f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(second);
        jointStatus(host,{serial:2,frames:1,upload:404,geometry:204,scene:84,uniform:64,depth:256,readback:2304});
      } else {
        second = f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(second);
        jointStatus(host,{serial:2,frames:2,upload:808,geometry:408,scene:168,uniform:128,depth:512,readback:2304});
        await first.finish();
        jointStatus(host,{serial:2,frames:1,upload:404,geometry:204,scene:84,uniform:64,depth:256,readback:2304});
        assert.equal(pending.settled,false);
      }
      await second.finish(); await f.pump(); const pixels = await ticket;
      assert.equal(pixels.frameId,overlay.frameId); assert.equal(pixels.serial,2); await host.whenIdle();
      jointStatus(host,{serial:2,frames:0,upload:0,geometry:0,scene:0,uniform:0,depth:0});
    });
  });
});

test('CH06 genuine MVP allocation enforces the CPU barrier state priority and late-ticket selection',async()=>{
  await withFrames(async a=>{
    const scene = triangleScene(), overlay = jointOverlay(a);
    await withCombinedGPU(async f=>{
      const host = await activeCombined(f), before = snapshot(f,host), Native = globalThis.Float32Array;
      const fault = Object.freeze({fault:'owned preparation allocation'}); let calls=0,nested,closing;
      try {
        globalThis.Float32Array = new Proxy(Native,{construct(target,args,newTarget) {
          if (args[0]===scene.draws[0].mvp && ++calls===1) {
            try { host.renderSceneTexturedFrame({},{}); } catch(error) {nested=error;}
            closing=observe(host.close()); assert.equal(host.close(),closing);
            throw fault;
          }
          return Reflect.construct(target,args,newTarget);
        }});
        assert.throws(()=>host.renderSceneTexturedFrame(scene,overlay),code('CLOSED'));
        assert.equal(calls,1); assert.ok(code('REENTRANT')(nested)); zero(host);
        assert.equal(f.calls.length,before.calls); assert.equal(f.buffers.length,before.buffers); assert.equal(f.textures.length,before.textures);
      } finally { globalThis.Float32Array=Native; }
      assert.ok(closing); const pending = watched(closing); await tick(); assert.equal(pending.settled,false,'close still owns final completion proof');
      await f.pump(); await closing; assert.equal(host.getStatus().cleanupOutcome,'safe'); assertBorrowed(f);
    });
    await withCombinedGPU(async f=>{
      const host = await activeCombined(f,{enableReadback:true}), Native = globalThis.Float32Array;
      let ticket,calls=0,first;
      try {
        globalThis.Float32Array = new Proxy(Native,{construct(target,args,newTarget) {
          if (args[0]===scene.draws[0].mvp && ++calls===1) ticket=observe(host.requestReadback());
          return Reflect.construct(target,args,newTarget);
        }});
        first=f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(first);
      } finally { globalThis.Float32Array=Native; }
      assert.equal(calls,1); assert.ok(ticket); const pending = watched(ticket);
      one(host); assert.equal(count(f,'copy'),0); await first.finish(); await tick(); assert.equal(pending.settled,false);
      const second=f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(second);
      jointStatus(host,{serial:2,frames:1,upload:404,geometry:204,scene:84,uniform:64,depth:256,readback:2304});
      assert.equal(count(f,'copy'),1); await second.finish(); await f.pump();
      const pixels = await ticket; assert.equal(pixels.serial,2); assert.equal(pixels.frameId,overlay.frameId); await host.whenIdle();
    });
  });
});

test('CH07 attempted writes fence exact failures and unsafe terminal retirement releases accounting without safe return',async()=>{
  await withFrames(async a=>{
    const scene=triangleScene(), overlay=jointOverlay(a);
    await withCombinedGPU(async f=>{
      const host=await activeCombined(f), cause=Object.freeze({fault:'drawIndexed after attempted writes'});
      f.hooks.drawIndexed=()=>{throw cause;};
      const proof=f.proof(()=>host.renderSceneTexturedFrame(scene,overlay));
      assert.equal(proof.thrown,true); assert.ok(exactCause('RENDER_FAILED',cause)(proof.cause));
      assert.ok(count(f,'writeBuffer')>0); assert.equal(count(f,'finish'),0); assert.equal(count(f,'submit'),0);
      assert.equal(proof.fences.length,1); assert.equal(f.open,0); one(host);
      await assert.rejects(host.whenIdle(),exactCause('RENDER_FAILED',cause));
      proof.resolveFences(); await tick(); one(host);
      proof.settleScopes(); await tick();
      jointStatus(host,{serial:1,frames:0,upload:0,geometry:0,scene:0,uniform:0,depth:0});
      assert.equal(host.getStatus().firstFailure.cause,cause); delete f.hooks.drawIndexed;
      await f.close(host); assertBorrowed(f);
    });
    await withCombinedGPU(async f=>{
      const host=await activeCombined(f), first=Object.freeze({fault:'queue fence'}), cleanup=Object.freeze({fault:'terminal buffer cleanup'});
      f.allowUnsafe(host);
      const proof=f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(proof);
      proof.fences[0].reject(first); await tick(); await assert.rejects(host.whenIdle(),exactCause('QUEUE_FAILED',first));
      one(host); assert.ok(f.buffers.every(buffer=>buffer.destroyed===0)); assert.ok(f.textures.every(texture=>texture.destroyed===0));
      let cleanupAttempts=0; f.hooks.destroyBuffer=()=>{cleanupAttempts++;throw cleanup;};
      const closing=observe(host.close()), pending=watched(closing); assert.equal(host.close(),closing);
      await tick(); assert.equal(pending.settled,false,'started error-scope peers remain owned'); one(host);
      proof.settleScopes(); await f.pump(); await assert.rejects(closing,exactCause('CLOSE_UNSAFE',first));
      jointStatus(host,{serial:1,frames:0,upload:0,geometry:0,scene:0,uniform:0,depth:0});
      assert.equal(host.getStatus().cleanupOutcome,'unsafe'); assert.equal(host.getStatus().firstFailure.cause,first);
      assert.equal(cleanupAttempts,f.buffers.length);
      assert.ok(f.buffers.every(buffer=>buffer.destroyed===1)); assert.ok(f.textures.every(texture=>texture.destroyed===1));
      assert.equal(host.close(),closing); assertBorrowed(f);
      await assert.rejects(host.whenIdle(),exactCause('CLOSE_UNSAFE',first));
    });
  });
});

test('CH08 fourth-role peer drains startup refusal and cancellation with cached close ownership',async()=>{
  await withCombinedGPU(async f=>{
    const host=f.keep(combinedFactory(f.options())), cause=Object.freeze({fault:'scene role promise'});
    const starting=observe(host.start()), pending=watched(starting); await tick();
    assert.deepEqual(f.pipelines.map(value=>value.kind),['rect','image','scene','textured']); assert.equal(f.open,0);
    f.pipelines[2].reject(cause); f.pipelines.slice(0,2).forEach(value=>value.resolve(value.value)); f.settleScopes();
    await tick(); assert.equal(pending.settled,false,'already-started textured peer must drain before startup refusal');
    assert.equal(count(f,'configure'),0); assert.equal(count(f,'submit'),0);
    f.pipelines[3].resolve(f.pipelines[3].value); await f.pump(); await assert.rejects(starting,exactCause('START_FAILED',cause));
    const closing=observe(host.close()); assert.equal(host.close(),closing); await f.pump(); await closing;
    assert.equal(f.open,0); assertBorrowed(f);
  });
  await withCombinedGPU(async f=>{
    f.limits.maxUniformBufferBindingSize=63;
    const host=f.keep(combinedFactory(f.options())), starting=observe(host.start());
    await f.pump(); await assert.rejects(starting,code('DEVICE_LIMIT'));
    assert.equal(f.pipelines.length,0); assert.equal(count(f,'configure'),0); assert.equal(count(f,'submit'),0);
    await f.close(host); assertBorrowed(f);
  });
  await withCombinedGPU(async f=>{
    const host=f.keep(combinedFactory(f.options())); let closing;
    f.combinedHooks.pipeline=value=>{if(value.kind==='textured') {closing=observe(host.close()); assert.equal(host.close(),closing);}};
    const starting=observe(host.start()); await tick(); assert.ok(closing);
    const pending=watched(closing); assert.equal(f.pipelines.length,4); assert.equal(f.open,0);
    f.settleScopes(); f.pipelines.slice(0,3).forEach(value=>value.resolve(value.value)); await tick();
    assert.equal(pending.settled,false,'close retains the fourth returned pipeline promise');
    f.pipelines[3].reject(undefined); await f.pump(); await assert.rejects(starting,code('START_CANCELLED')); await closing;
    assert.equal(count(f,'configure'),0); assert.equal(count(f,'layout'),0); assertBorrowed(f);
  });
});

test('CH09 captured values survive genuine producer Scope closure and Engine closing precedes host closure',async()=>{
  await withFrames(async a=>{
    a.clear(); const producerScope=a.engine.createScope(); producerScope.use(a.lease);
    const node=producerScope.use(a.addMesh(a.canonical));
    const saved=a.capture({width:8,height:8,clearAlpha:1}); producerScope.dispose();
    assert.equal(producerScope.state,'closed'); assert.equal(node.isDisposed,true);
    assert.throws(()=>a.lease.value,error=>error instanceof egret.EgretError&&error.code==='ASSET_LEASE_RELEASED');
    a.engine.assets.invalidate(a.ref); await tick(); a.texture.dispose();
    let lateReads=0;
    for (const key of ['imageData','sourceRect']) Object.defineProperty(a.texture,key,{get(){lateReads++;throw Error('late disposed texture read');}});
    await withCombinedGPU(async f=>{
      const host=await activeCombined(f), other=await egret.createEngineForProfile({host},egret.TEXTURED_FRAME_PROFILE_2D);
      try {
        assert.notEqual(other,a.engine);
        for (let index=0;index<2;index++) {
          const proof=f.proof(()=>host.renderSceneTexturedFrame(triangleScene(),saved)); admitted(proof);
          await proof.finish(); await host.whenIdle();
        }
        assert.equal(lateReads,0); assert.equal(host.getStatus().lastSerial,2);
        assert.deepEqual([...f.calls.filter(call=>call[0]==='writeTexture').at(-1)[2]],[255,64,0,255]);
      } finally {const closing=observe(other.dispose()); await f.pump(); await closing;}
      assertBorrowed(f);
    });
  });
  await withCombinedGPU(async f=>{
    const host=await activeCombined(f), diagnostics=[];
    const engine=await egret.createEngineForProfile({host,onDiagnostic:value=>diagnostics.push(value)},egret.TEXTURED_FRAME_PROFILE_2D);
    const scope=engine.createScope(); let texture;
    try {
      texture=egret.createTexture(egret.createImageData2D({width:1,height:1,pixels:new Uint8Array([255,64,0,255])}));
      const type=egret.createAssetType('combined-closing-scope',egret.isTexture), ref=egret.createAssetRef(type,'one');
      engine.assets.register(type,{load:async()=>texture,dispose:value=>value.dispose()});
      const lease=scope.use(await engine.assets.acquire(ref));
      const geometry=egret.createTexturedGeometry2D({positions:new Float64Array([1,1,5,1,1,5]),uvs:new Float64Array([.5,.5,.5,.5,.5,.5]),lightColors:new Float64Array(12).fill(1),indices:new Uint32Array([0,1,2])});
      const node=scope.use(new egret.Mesh2D(lease,geometry)); engine.stage.addChild(node);
      const before=count(f,'submit'), saved=engine.captureTexturedFrame({width:8,height:8,clearAlpha:1});
      assert.equal(count(f,'submit'),before); let abortCalls=0,callbackError,callbackState,returnValue='unobserved';
      scope.signal.addEventListener('abort',()=>{
        try {
          abortCalls++; callbackState=host.getStatus().state;
          assert.throws(()=>engine.captureTexturedFrame({width:8,height:8,clearAlpha:1}),closedCapture);
          returnValue=host.renderSceneTexturedFrame(triangleScene(),saved);
        } catch(error) {callbackError=error;}
      },{once:true});
      const disposed=observe(engine.dispose()), pending=watched(disposed); assert.equal(engine.dispose(),disposed);
      await tick(); assert.equal(callbackError,undefined); assert.equal(abortCalls,1); assert.equal(callbackState,'active'); assert.equal(returnValue,undefined);
      assert.equal(scope.signal.aborted,true); assert.equal(scope.state,'closed'); assert.equal(node.isDisposed,true);
      assert.equal(host.getStatus().state,'closing'); assert.equal(pending.settled,false); assert.equal(count(f,'submit'),before+1);
      assert.throws(()=>host.renderSceneTexturedFrame(triangleScene(),saved),code('CLOSED'));
      await f.pump(); await disposed;
      assert.equal(engine.stage.isDisposed,true); assert.throws(()=>engine.captureTexturedFrame({width:8,height:8,clearAlpha:1}),closedCapture);
      assert.equal(host.getStatus().cleanupOutcome,'safe'); assert.deepEqual(diagnostics,[]); assertBorrowed(f);
    } finally {
      scope.dispose(); const closing=observe(engine.dispose()); await f.pump(); await closing; texture?.dispose();
    }
  });
});

// The constructor trap begins after real frame capture, Host startup and ticket
// creation, and ends synchronously before any retry/readback/final cleanup.
test('CH10 preflight allocation failure preserves its cause and an unbound readback ticket',async()=>{
  await withFrames(async a=>{
    const scene=triangleScene(), overlay=jointOverlay(a);
    await withCombinedGPU(async f=>{
      const host=await activeCombined(f,{enableReadback:true});
      const ticket=observe(host.requestReadback()), waiting=watched(ticket), before=snapshot(f,host);
      const Native=globalThis.WeakSet, cause=Object.freeze({fault:'current preflight WeakSet allocation'});
      let calls=0;
      try {
        globalThis.WeakSet=new Proxy(Native,{construct(target,args,newTarget) {
          if(args.length===0 && ++calls===1)throw cause;
          return Reflect.construct(target,args,newTarget);
        }});
        assert.throws(()=>host.renderSceneTexturedFrame(scene,overlay),exactCause('FRAME_INVALID',cause));
      } finally { globalThis.WeakSet=Native; }
      assert.equal(calls,1,'the current synchronous render reaches the injected constructor');
      unchanged(f,host,before); zero(host); assert.equal(count(f,'submit'),0);
      await tick(); assert.equal(waiting.settled,false,'preflight refusal leaves the genuine ticket unbound');
      const accepted=f.proof(()=>host.renderSceneTexturedFrame(scene,overlay)); admitted(accepted);
      one(host,{readback:2304}); assert.equal(count(f,'copy'),1);
      await accepted.finish(); await f.pump();
      const pixels=await ticket;
      assert.equal(pixels.serial,1); assert.equal(pixels.frameId,overlay.frameId);
      await host.whenIdle();
      jointStatus(host,{serial:1,frames:0,upload:0,geometry:0,scene:0,uniform:0,depth:0});
      await f.close(host); assertBorrowed(f);
    });
  });
});

test('CH11 closing during preflight allocation wins over the thrown cause and cancels its ticket',async()=>{
  await withFrames(async a=>{
    const scene=triangleScene(), overlay=jointOverlay(a);
    await withCombinedGPU(async f=>{
      const host=await activeCombined(f,{enableReadback:true});
      const ticket=observe(host.requestReadback()), before=snapshot(f,host);
      const Native=globalThis.WeakSet, cause=Object.freeze({fault:'closing preflight WeakSet allocation'});
      let calls=0,closing;
      try {
        globalThis.WeakSet=new Proxy(Native,{construct(target,args,newTarget) {
          if(args.length===0 && ++calls===1) {
            closing=observe(host.close());
            throw cause;
          }
          return Reflect.construct(target,args,newTarget);
        }});
        assert.throws(()=>host.renderSceneTexturedFrame(scene,overlay),code('CLOSED'));
      } finally { globalThis.WeakSet=Native; }
      assert.equal(calls,1); assert.ok(closing); assert.equal(host.close(),closing);
      assert.equal(host.getStatus().state,'closing'); zero(host);
      assert.equal(f.calls.length,before.calls); assert.equal(f.buffers.length,before.buffers); assert.equal(f.textures.length,before.textures);
      assert.equal(f.canvas.width,before.width); assert.equal(f.canvas.height,before.height);
      assert.equal(count(f,'submit'),0); assert.equal(count(f,'copy'),0);
      await assert.rejects(ticket,code('CLOSED'));
      await f.pump(); await closing;
      assert.equal(host.getStatus().state,'closed'); assert.equal(host.getStatus().cleanupOutcome,'safe'); zero(host);
      assertBorrowed(f);
    });
  });
});
