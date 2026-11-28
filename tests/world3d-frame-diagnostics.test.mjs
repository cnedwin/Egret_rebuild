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

function deferredView(options = {}) {
  const calls = [],
    samples = [],
    errors = [];
  const scene = {
      traverse() {
        calls.push('particles');
      }
    },
    camera = {};
  let accepted = true,
    renderFailure,
    updateFailure;
  const renderer = {
    canvas: { width: 320, height: 180 },
    resizeToDisplaySize() {
      calls.push('resize');
      return false;
    },
    render(scene, camera) {
      calls.push(['draw', scene, camera]);
      if (renderFailure) throw renderFailure;
      return accepted;
    }
  };
  let closed = false,
    tick;
  const clock = {
    onTick(_scope, fn) {
      tick = fn;
      return {
        dispose() {
          closed = true;
        }
      };
    }
  };
  const scope = { use() {} };
  const view = createWorld3DView({ clock }, scope, {
    renderer,
    scene,
    camera,
    deferRender: true,
    mixers: [
      {
        update(dt) {
          calls.push(['mixer', dt]);
        }
      }
    ],
    controls: {
      update(dt) {
        calls.push(['controls', dt]);
      }
    },
    onUpdate(dt, time) {
      calls.push(['update', dt, time]);
      if (updateFailure) throw updateFailure;
    },
    onFrameTiming: sample => samples.push(sample),
    onError: error => errors.push(error),
    ...options
  });
  return {
    view,
    renderer,
    scene,
    camera,
    calls,
    samples,
    errors,
    tick: (dt, time) => tick({ deltaSeconds: dt, elapsedSeconds: time }),
    accept(value) {
      accepted = value;
    },
    failRender(error) {
      renderFailure = error;
    },
    failUpdate(error) {
      updateFailure = error;
    },
    get closed() {
      return closed;
    }
  };
}

test('WDT03 a deferred World3D view updates every clock step but consumes one latest draw', () => {
  const f = deferredView();
  try {
    assert.equal(f.view.deferRender, true);
    f.tick(0.01, 0.01);
    f.tick(0.02, 0.03);
    assert.deepEqual(f.calls, [
      'resize',
      ['update', 0.01, 0.01],
      ['mixer', 0.01],
      ['controls', 0.01],
      'particles',
      'resize',
      ['update', 0.02, 0.03],
      ['mixer', 0.02],
      ['controls', 0.02],
      'particles'
    ]);
    assert.equal(f.samples.length, 0, 'no diagnostic acceptance before an actual draw');
    assert.equal(f.view.drawPending(), true);
    assert.deepEqual(f.calls.at(-1), ['draw', f.scene, f.camera]);
    assert.equal(f.view.drawPending(), false, 'a pending draw is single-use');
    assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'draw').length, 1);
    const sample = f.samples[0];
    assert.equal(sample.outcome, 'rendered');
    assert.equal(sample.elapsedSeconds, 0.03);
    assert.ok(Math.abs(sample.deltaSeconds - 0.03) < 1e-10);
    assert.ok(sample.updateMs >= 0 && sample.renderMs >= 0);
    assert.equal(f.samples.length, 1);
    assert(Object.isFrozen(sample));
  } finally {
    f.view.dispose();
  }
});

test('WDT04 pending World3D draws retire on pause, replacement, mode switch and scope disposal', () => {
  const f = deferredView();
  try {
    f.tick(0.01, 0.01);
    f.view.paused = true;
    f.view.paused = false;
    assert.equal(f.view.drawPending(), false);
    f.tick(0.01, 0.02);
    f.view.scene = { traverse() {} };
    f.view.scene = f.scene;
    assert.equal(f.view.drawPending(), false, 'replacing then restoring a scene invalidates pending work');
    f.tick(0.01, 0.03);
    f.view.camera = {};
    f.view.camera = f.camera;
    assert.equal(f.view.drawPending(), false);
    f.tick(0.01, 0.04);
    f.view.deferRender = false;
    assert.equal(f.view.drawPending(), false);
    f.tick(0.01, 0.05);
    assert.deepEqual(f.calls.at(-1), ['draw', f.scene, f.camera]);
    assert.equal(f.samples.length, 1, 'mode switch restores the normal immediate path');
    f.view.deferRender = true;
    f.tick(0.01, 0.06);
    f.view.dispose();
    assert.equal(f.closed, true);
    assert.equal(f.view.drawPending(), false);
    assert.equal(f.samples.length, 1);
  } finally {
    f.view.dispose();
  }
});

test('WDT05 a pending World3D draw cannot be carried into a later turn', async () => {
  const f = deferredView();
  try {
    f.tick(0.01, 0.01);
    await Promise.resolve();
    assert.equal(f.view.drawPending(), false);
    assert.equal(f.samples.length, 0);
    f.tick(0.01, 0.02);
    assert.equal(f.view.drawPending(), true);
    assert.equal(f.samples.length, 1);
    assert.equal(f.samples[0].elapsedSeconds, 0.02);
  } finally {
    f.view.dispose();
  }
});

test('WDT06 deferred World3D timing reports real refusals and errors, never stale success', () => {
  const f = deferredView();
  const renderError = Error('render failed'),
    updateError = Error('update failed');
  try {
    f.tick(0.01, 0.01);
    f.accept(false);
    assert.equal(f.view.drawPending(), false);
    assert.equal(f.samples.at(-1).outcome, 'refused');
    f.tick(0.01, 0.02);
    f.failRender(renderError);
    assert.equal(f.view.drawPending(), false);
    assert.equal(f.samples.at(-1).outcome, 'failed');
    assert.equal(f.errors.at(-1), renderError);
    f.failRender(undefined);
    f.accept(true);
    f.tick(0.01, 0.03);
    f.failUpdate(updateError);
    f.tick(0.01, 0.04);
    assert.equal(f.view.drawPending(), false, 'a failed update retires the earlier prepared view');
    assert.equal(f.samples.at(-1).outcome, 'failed');
    assert.equal(f.samples.at(-1).elapsedSeconds, 0.04);
    assert.equal(f.samples.at(-1).renderMs, 0);
    assert.equal(f.errors.at(-1), updateError);
    assert.deepEqual(
      f.samples.map(sample => sample.outcome),
      ['refused', 'failed', 'failed']
    );
  } finally {
    f.view.dispose();
  }
});

test('WDT07 deferRender is an opt-in boolean and views keep independent pending draws', () => {
  assert.throws(() => deferredView({ deferRender: 'late' }), { code: 'WORLD3D_INPUT_INVALID' });
  const a = deferredView(),
    b = deferredView();
  try {
    assert.throws(
      () => {
        a.view.deferRender = 1;
      },
      { code: 'WORLD3D_INPUT_INVALID' }
    );
    a.tick(0.01, 0.01);
    b.tick(0.01, 0.01);
    assert.equal(b.view.drawPending(), true);
    assert.equal(a.samples.length, 0);
    assert.equal(a.view.drawPending(), true);
    assert.equal(a.samples.length, 1);
    assert.equal(b.samples.length, 1);
  } finally {
    a.view.dispose();
    b.view.dispose();
  }
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
