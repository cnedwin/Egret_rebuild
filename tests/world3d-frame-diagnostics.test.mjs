// SPDX-License-Identifier: Apache-2.0
// Controlled clock/renderer ports: CPU phase and RAF observations, not GPU timings.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld3DView, startWorld3DLoop } from '@egret/engine/webgl2/world3d';

test('WDT01 World3D view separates update and render and preserves a refused draw', () => {
  const samples = [],
    calls = [];
  const clock = { onTick: () => ({ dispose() {} }) };
  const scope = { use() {} };
  let accepted = true;
  const view = createWorld3DView({ clock }, scope, {
    renderer: {
      canvas: { width: 320, height: 180 },
      render() {
        calls.push('render');
        return accepted;
      }
    },
    scene: {},
    camera: {},
    autoResize: false,
    updateParticles: false,
    onUpdate() {
      calls.push('update');
    },
    onFrameTiming: sample => samples.push(sample)
  });
  view.tick(0.016, 0.016);
  accepted = false;
  view.tick(0.016, 0.032);
  view.paused = true;
  view.tick(0.016, 0.048);
  assert.deepEqual(calls, ['update', 'render', 'update', 'render']);
  assert.deepEqual(
    samples.map(s => [s.id, s.elapsedSeconds, s.outcome]),
    [
      [1, 0.016, 'rendered'],
      [2, 0.032, 'refused']
    ]
  );
  for (const sample of samples) {
    assert.ok(Object.isFrozen(sample));
    assert.ok(sample.callbackEndMs >= sample.callbackStartMs);
    assert.ok(sample.updateMs >= 0 && sample.renderMs >= 0);
  }
  view.dispose();
});

test('WDT02 World3D loop correlates actual callback timestamp, clock advance and reanchor', () => {
  const saved = ['requestAnimationFrame', 'cancelAnimationFrame'].map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]);
  let next,
    handle = 0;
  const samples = [],
    calls = [];
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: callback => {
      next = callback;
      return ++handle;
    }
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: () => {
      next = undefined;
    }
  });
  let loop;
  try {
    const engine = {
      advanceTime(s) {
        calls.push(s);
      },
      clock: {
        maxDeltaSeconds: 0.1,
        pause() {
          calls.push('pause');
        },
        resume() {
          calls.push('resume');
        }
      }
    };
    loop = startWorld3DLoop(engine, undefined, { onFrameTiming: sample => samples.push(sample) });
    next(1000);
    next(1016);
    next(2000);
    assert.deepEqual(calls, [1, 1.016, 'pause', 'resume', 2]);
    assert.deepEqual(
      samples.map(s => [s.id, s.rafTimestampMs, s.reanchored]),
      [
        [1, 1000, false],
        [2, 1016, false],
        [3, 2000, true]
      ]
    );
    assert.ok(samples.every(s => s.callbackEndMs >= s.callbackStartMs && s.advanceMs >= 0));
  } finally {
    loop?.dispose();
    for (const [key, d] of saved)
      if (d) Object.defineProperty(globalThis, key, d);
      else delete globalThis[key];
  }
});
