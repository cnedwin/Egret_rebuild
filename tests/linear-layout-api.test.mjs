// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import * as input from '@egret/engine/web/input';
import {controlledBrowser} from './mouse-input.test.mjs';
import {withScene, UP, AREA, FRAME} from './bitmap-button-api.test.mjs';

test('LL00 genuine shipped Button/resource/input/capture and full cleanup before layout entry', async () => {
  let button, display, saved, image;
  let activations = 0;
  await withScene(f => {
    assert.equal(typeof input.createBitmapButton, 'function');
    button = f.addButton({onActivate(payload) {
      assert.equal(Object.isFrozen(payload), true);
      activations++;
    }});
    f.attach(button);
    display = button.display;
    assert.ok(f.engine instanceof sdk.Engine);
    assert.ok(f.scope instanceof sdk.Scope);
    assert.ok(f.lease instanceof sdk.AssetLease);
    assert.ok(display instanceof sdk.Bitmap);
    assert.equal(display.textureLease, f.lease);
    assert.deepEqual(display.getBounds(), AREA);
    assert.deepEqual(f.stage.getBounds(), {x:8, y:9, width:8, height:6});
    assert.equal(f.stage.hitTest(12, 12), display);
    f.down();
    assert.equal(button.state, 'pressed');
    f.up();
    assert.equal(button.state, 'up');
    assert.equal(activations, 1);
    saved = f.engine.captureFrame(FRAME);
    image = f.texture.imageData;
    assert.equal(saved.commands.length, 1);
    assert.deepEqual(saved.commands[0].sourceRect, UP);
    assert.equal(Object.isFrozen(saved), true);
    f.engine.renderFrame(FRAME);
    assert.equal(f.renders.length, 1);
    assert.deepEqual(f.diagnostics, []);
  });
  // The existing helper has finished and checked this genuine normal retirement.
  assert.equal(button.state, 'disposed');
  assert.equal(button.display, display);
  assert.equal(display.isDisposed, true);
  assert.deepEqual(saved.commands[0].sourceRect, UP);
  assert.equal(sdk.copyImageData2DPixels(image)[0], 255);

  let layout;
  try {
    layout = await import('@egret/engine/layout');
  } catch (cause) {
    // Only this selected missing package subpath is the assigned old-version RED.
    assert.equal(cause?.code, 'ERR_PACKAGE_PATH_NOT_EXPORTED');
    assert.match(cause.message, /Package subpath '\.\/layout'/);
    assert.fail('LINEAR_LAYOUT_REQUIRED');
  }
  assert.equal(typeof layout.planLinearLayout, 'function', 'LINEAR_LAYOUT_REQUIRED');
  assert.deepEqual(Object.keys(layout), ['planLinearLayout']);
  assert.equal(Object.hasOwn(sdk, 'planLinearLayout'), false);
  assert.equal(Object.hasOwn(input, 'planLinearLayout'), false);
  const web=await import('@egret/engine/web');
  const webgpu=await import('@egret/engine/webgpu');
  assert.equal(Object.hasOwn(web,'planLinearLayout'),false);
  assert.equal(Object.hasOwn(webgpu,'planLinearLayout'),false);
  await genuineComposition();
  await deferredStartupComposition();
});

async function genuineComposition() {
  const {createLinearLayoutSession}=await import('../examples/linear-layout/session.mjs');
  const browser=controlledBrowser(),renders=[],trace=[],timers=new Set();
  browser.setRect({left:10,top:20,width:192,height:192});
  const host={surface:browser.canvas,start(){trace.push('start');},stop(){trace.push('stop');},async close(){trace.push('close');},renderFrame(frame){renders.push(frame);},setTimeout(callback,delay){const timer={callback,delay};timers.add(timer);return()=>timers.delete(timer);}};
  let session,primary,primaryOccurred=false;
  browser.install();
  try {
    session=createLinearLayoutSession({host,preset:'verification'});
    await session.ready;
    const {engine,input:firstInput,first,second,lease,texture,outer,inner}=session.scene;
    assert.ok(engine instanceof sdk.Engine);assert.ok(first.display instanceof sdk.Bitmap);
    assert.equal(first.display.textureLease,lease);assert.equal(second.display.textureLease,lease);
    assert.equal(first.display.parent,inner);assert.equal(inner.parent,outer);assert.equal(outer.parent,engine.stage);
    assert.deepEqual(first.display.hitArea,{x:0,y:0,width:8,height:6});
    assert.deepEqual(session.inspect().currentPlan,{width:22,height:10,placements:[
      {index:0,x:2,y:2,width:8,height:6},{index:1,x:12,y:2,width:8,height:6},
    ]});
    assert.equal(engine.stage.hitTest(6,7),first.display);
    assert.equal(engine.stage.hitTest(20,7),second.display);
    assert.equal(engine.stage.hitTest(22,7),undefined);
    const pointer=(target,type,x,y)=>browser.emit(target,type,{clientX:10+x*8,clientY:20+y*8});
    const down=async(x,y)=>{pointer(browser.canvas,'pointerdown',x,y);await Promise.resolve();};
    const up=async(x,y)=>{pointer(browser.window,'pointerup',x,y);await Promise.resolve();};
    const click=async(x,y)=>{await down(x,y);await up(x,y);};
    await down(6,7);assert.equal(first.state,'pressed');
    await up(6,7);assert.equal(first.state,'up');assert.deepEqual(session.inspect().buttons.activations,[1,0]);
    await click(22,7);assert.deepEqual(session.inspect().buttons.activations,[1,0]);
    const saved=session.scene.savedHorizontalFrame;
    assert.equal(renders[1],saved);assert.equal(Object.isFrozen(saved),true);
    session.vertical();
    assert.deepEqual(session.inspect().currentPlan,{width:12,height:18,placements:[
      {index:0,x:2,y:2,width:8,height:6},{index:1,x:2,y:10,width:8,height:6},
    ]});
    assert.equal(engine.stage.hitTest(20,7),undefined);
    assert.equal(engine.stage.hitTest(6,15),second.display);
    await click(20,7);assert.deepEqual(session.inspect().buttons.activations,[1,0]);
    await down(6,15);assert.equal(second.state,'pressed');await up(6,15);
    assert.deepEqual(session.inspect().buttons.activations,[1,1]);
    session.filterFirst();assert.equal(first.display.visible,false);
    assert.equal(engine.stage.hitTest(6,7),second.display);assert.equal(engine.stage.hitTest(6,15),undefined);
    session.replaySavedHorizontal();assert.equal(renders.at(-1),saved);
    assert.equal(first.display.visible,false);assert.equal(engine.stage.hitTest(6,7),second.display);
    session.showLive();assert.notEqual(renders.at(-1),saved);assert.equal(renders.at(-1).commands.length,1);
    session.horizontal();session.reinsertFirst();
    assert.equal(inner.getChildAt(0),second.display);assert.equal(inner.getChildAt(1),first.display);
    assert.equal(engine.stage.hitTest(6,7),second.display);assert.equal(engine.stage.hitTest(20,7),first.display);
    await click(6,7);await click(20,7);assert.deepEqual(session.inspect().buttons.activations,[2,2]);
    session.disableFirst();assert.equal(first.state,'disabled');assert.equal(engine.stage.hitTest(20,7),undefined);
    await click(20,7);assert.deepEqual(session.inspect().buttons.activations,[2,2]);
    const before=session.inspect(),renderCount=renders.length;
    const rejected=session.rejectInvalidPlan();
    assert.equal(rejected.lastRejectedCode,'LAYOUT_OPTIONS_INVALID');
    assert.equal(rejected.currentPlan,before.currentPlan);assert.deepEqual(rejected.positions,before.positions);
    assert.equal(renders.length,renderCount);assert.equal(rejected.primaryOccurred,false);
    session.enableFirst();await click(20,7);assert.deepEqual(session.inspect().buttons.activations,[3,2]);
    assert.equal(firstInput,session.scene.input);assert.equal(session.scene.lease,lease);assert.equal(lease.value,texture);
    const closed=session.close();assert.equal(session.close(),closed);await closed;
    const done=session.inspect();assert.equal(done.state,'closed');
    assert.deepEqual(done.buttons.buttonStates,['disposed','disposed']);
    assert.deepEqual(done.buttons.controlScopeStates,['closed','closed']);
    assert.equal(done.buttons.inputState,'closed');assert.equal(done.buttons.loads,1);assert.equal(done.buttons.disposals,1);
    assert.equal(done.buttons.pendingTasks,0);assert.deepEqual(done.buttons.cleanupErrors,[]);
    assert.equal(done.outerDisposed,true);assert.equal(done.innerDisposed,true);assert.equal(done.layoutScopeState,'closed');
    assert.equal(texture.isDisposed,true);assert.equal(engine.stage.isDisposed,true);
    assert.equal(browser.active().length,0);assert.equal(timers.size,0);assert.deepEqual(trace,['start','stop','close']);
    assert.deepEqual(saved.commands.map(command=>command.sourceRect),[UP,UP]);
  } catch(cause) {primaryOccurred=true;primary=cause;}
  finally {
    const cleanup=[];
    try {await session?.close();} catch(cause){cleanup.push(cause);}
    browser.recover();browser.restore();
    if(cleanup.length)throw new AggregateError(primaryOccurred?[primary,...cleanup]:cleanup,'Layout composition cleanup failed',{cause:primaryOccurred?primary:cleanup[0]});
  }
  if(primaryOccurred)throw primary;
}


async function deferredStartupComposition() {
  const {createLinearLayoutSession} = await import('../examples/linear-layout/session.mjs');
  // These deferred application hooks exercise ordering with genuine Engine,
  // resource/input/Button owners and a synchronous recording Host, not a GPU.
  for (const mode of ['success', 'close', 'engine-close', 'resource-close',
    'reject', 'reject-after-close', 'reject-cleanup']) {
    const browser = controlledBrowser(), renders = [], trace = [], timers = new Set();
    let resolveBarrier, rejectBarrier, reachedBarrier, session, expectedCleanup;
    let hookCalls = 0, primaryOccurred = false, primary;
    const barrier = new Promise((resolve, reject) => { resolveBarrier = resolve; rejectBarrier = reject; });
    const reached = new Promise(resolve => { reachedBarrier = resolve; });
    const originalFailure = Symbol('original startup readback failure');
    const cleanupFailure = Symbol('original host cleanup failure');
    const host = {
      surface: browser.canvas,
      start() { trace.push('start'); }, stop() { trace.push('stop'); },
      async close() { trace.push('close'); if (mode === 'reject-cleanup') throw cleanupFailure; },
      renderFrame(frame) { renders.push(frame); },
      setTimeout(callback, delay) { const timer = {callback, delay}; timers.add(timer); return () => timers.delete(timer); },
    };
    browser.install();
    try {
      assert.throws(() => createLinearLayoutSession({host, waitForStartupIdle: 0}),
        error => error.code === 'EXAMPLE_OPTIONS_INVALID');
      assert.deepEqual(trace, []);
      session = createLinearLayoutSession({host, preset: 'verification', waitForStartupIdle() {
        hookCalls++; reachedBarrier(); return barrier;
      }});
      // A missing hook or unrelated startup failure must fail, never hang here.
      await Promise.race([reached, session.ready.then(
        () => { throw new Error('Deferred startup hook was bypassed'); },
        cause => { throw cause; },
      )]);
      assert.equal(hookCalls, 1);
      assert.equal(renders.length, 1, 'only genuine ancillary submission before barrier');
      assert.equal(session.inspect().state, 'starting');
      assert.equal(session.inspect().currentPlan, undefined);
      assert.equal(session.scene.layoutScope, undefined);
      assert.equal(session.scene.outer, undefined); assert.equal(session.scene.inner, undefined);
      assert.ok(session.scene.engine instanceof sdk.Engine);
      assert.ok(session.scene.lease instanceof sdk.AssetLease);
      assert.equal(session.scene.lease.value, session.scene.texture);
      assert.equal(session.scene.first.display.parent, session.scene.engine.stage);
      assert.equal(session.scene.second.display.parent, session.scene.engine.stage);
      if (mode === 'success') {
        resolveBarrier(); await session.ready;
        assert.equal(renders.length, 2);
        assert.equal(renders[1], session.scene.savedHorizontalFrame);
        assert.ok(session.scene.layoutScope instanceof sdk.Scope);
        assert.equal(session.inspect().state, 'ready');
        await session.close();
      } else {
        if (mode === 'close' || mode === 'reject-after-close') {
          const closing = session.close(); assert.equal(session.close(), closing);
          await closing;
        } else if (mode === 'engine-close') await session.scene.engine.dispose();
        else if (mode === 'resource-close') session.scene.resourceScope.dispose();
        const rejecting = mode.startsWith('reject');
        if (rejecting) rejectBarrier(originalFailure); else resolveBarrier();
        let refused = false, observed;
        try { await session.ready; } catch (cause) { refused = true; observed = cause; }
        assert.equal(refused, true);
        if (rejecting) {
          assert.equal(observed, originalFailure);
          assert.equal(session.inspect().primaryOccurred, true);
          assert.equal(session.inspect().primaryCause, originalFailure);
        } else {
          assert.equal(observed.code, 'EXAMPLE_CLOSED');
          if (mode === 'close') assert.equal(session.inspect().primaryOccurred, false);
        }
        assert.equal(renders.length, 1, 'no layout submission after failed/closed barrier');
        assert.equal(session.scene.layoutScope, undefined);
        assert.equal(session.scene.outer, undefined); assert.equal(session.scene.inner, undefined);
        if (mode === 'reject-cleanup') {
          let refusedClose = false;
          try { await session.close(); } catch (cause) { refusedClose = true; expectedCleanup = cause; }
          assert.equal(refusedClose, true);
          assert.ok(expectedCleanup instanceof sdk.EgretError);
          assert.equal(expectedCleanup.code, 'ENGINE_CLOSE_FAILED');
          assert.equal(expectedCleanup.cause, cleanupFailure);
          assert.deepEqual(session.inspect().cleanupErrors, [expectedCleanup]);
          assert.deepEqual(session.inspect().buttons.cleanupErrors, [expectedCleanup]);
          assert.equal(session.inspect().primaryCause, originalFailure);
        } else await session.close();
      }
      const done = session.inspect();
      assert.equal(done.state, 'closed');
      assert.deepEqual(done.buttons.buttonStates, ['disposed', 'disposed']);
      assert.deepEqual(done.buttons.controlScopeStates, ['closed', 'closed']);
      assert.equal(done.buttons.inputState, 'closed');
      assert.equal(done.buttons.loads, 1); assert.equal(done.buttons.disposals, 1);
      assert.equal(done.buttons.pendingTasks, 0);
      if (mode !== 'reject-cleanup') assert.deepEqual(done.cleanupErrors, []);
      assert.equal(session.scene.texture.isDisposed, true);
      assert.equal(session.scene.engine.stage.isDisposed, true);
      assert.equal(browser.active().length, 0); assert.equal(timers.size, 0);
      assert.deepEqual(trace, ['start', 'stop', 'close']);
    } catch (cause) { primaryOccurred = true; primary = cause; }
    finally {
      // Release an unresolved test-owned barrier even after an assertion fails.
      resolveBarrier();
      const cleanup = [];
      try { await session?.ready; } catch { /* Its expected rejection is asserted above. */ }
      try { await session?.close(); } catch (cause) { if (cause !== expectedCleanup) cleanup.push(cause); }
      browser.recover(); browser.restore();
      if (cleanup.length) throw new AggregateError(primaryOccurred ? [primary, ...cleanup] : cleanup,
        'Deferred layout startup cleanup failed', {cause: primaryOccurred ? primary : cleanup[0]});
    }
    if (primaryOccurred) throw primary;
  }
}
