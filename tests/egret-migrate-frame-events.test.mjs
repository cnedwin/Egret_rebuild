// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import { createLegacyBindings } from '../tools/egret-migrate/legacy-web.mjs';

test('frame broadcasts include detached displays and lifecycle changes share one active state', async () => {
  const engine = await sdk.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
  });
  const scope = engine.createScope();
  const records = [];
  let visibility, context;
  const game = {
    scope,
    engine,
    stage: engine.stage,
    pointer: { events: { tap: sdk.createEventType('tap', { bubbles: true }) } }
  };
  try {
    const {
      api: { egret }
    } = createLegacyBindings(
      sdk,
      game,
      { width: 320, height: 180, projectId: 'frame_events' },
      {
        storage: () => ({}),
        now: () => 0,
        onVisibility(fn) {
          visibility = fn;
          return () => {
            visibility = undefined;
          };
        }
      }
    );
    const { Event, lifecycle } = egret;
    const stage = egret.MainContext.instance.stage;
    const detached = new egret.Sprite(),
      next = new egret.Sprite(),
      dispatcher = new egret.EventDispatcher();
    const onNext = e => {
      assert.equal(e.target, next);
      records.push('next');
    };
    function onFrame(e) {
      assert.equal(e.type, 'enterFrame');
      assert.equal(e.target, detached);
      assert.equal(e.bubbles, false);
      records.push('frame');
      detached.removeEventListener(Event.ENTER_FRAME, onFrame, null);
      next.addEventListener(Event.ENTER_FRAME, onNext, null);
    }
    detached.addEventListener(Event.ENTER_FRAME, onFrame, null);
    dispatcher.addEventListener(Event.ENTER_FRAME, () => records.push('dispatcher'), null);
    lifecycle.addLifecycleListener(value => {
      context = value;
      value.onUpdate = () => records.push('update');
    });
    for (const type of [Event.ACTIVATE, Event.DEACTIVATE])
      stage.addEventListener(type, e => records.push(e.type), null);
    lifecycle.onPause = () => records.push('pause');
    lifecycle.onResume = () => records.push('resume');
    engine.advanceTime(0);
    records.length = 0; // First advance anchors the new game clock.
    next.removeEventListener(Event.ENTER_FRAME, onNext, null);
    detached.addEventListener(Event.ENTER_FRAME, onFrame, null);
    engine.advanceTime(0.016);
    engine.advanceTime(0.032);
    assert.deepEqual(records, ['update', 'frame', 'update', 'next']);
    records.length = 0;
    context.pause();
    visibility(true);
    visibility(false);
    context.resume();
    assert.deepEqual(records, ['deactivate', 'pause', 'activate', 'resume']);
    const reverse = () => context.resume();
    stage.addEventListener(Event.DEACTIVATE, reverse, null);
    records.length = 0;
    context.pause();
    assert.deepEqual(records, ['deactivate', 'activate', 'resume']);
    stage.removeEventListener(Event.DEACTIVATE, reverse, null);
    stage.addEventListener(Event.DEACTIVATE, () => scope.dispose(), null);
    records.length = 0;
    context.pause();
    assert.equal(visibility, undefined);
    context.resume();
    engine.advanceTime(0.048);
    assert.deepEqual(records, ['deactivate']);
  } finally {
    await engine.dispose();
  }
});
