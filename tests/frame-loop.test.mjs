// SPDX-License-Identifier: Apache-2.0
// The frame loop of a page, driven here by a display the test owns: steps, clock, skipped frames, stops and failures.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createBrowserFrameLoop } from '@egret/engine/web/loop';
import { host } from './helpers.mjs';

const coded = code => error => error?.code === code;
/** A display whose frames the test presents one by one, at the milliseconds it names. */
function display() {
  let next,
    handles = 0;
  const cancelled = [];
  return {
    requestFrame(callback) {
      next = callback;
      return ++handles;
    },
    cancelFrame(handle) {
      cancelled.push(handle);
      next = undefined;
    },
    present(milliseconds) {
      const callback = next;
      next = undefined;
      assert.ok(callback, 'a frame was asked for');
      callback(milliseconds);
    },
    get waiting() {
      return next !== undefined;
    },
    cancelled
  };
}
/** An Engine stand-in that records what it is asked. */
function recorder(maxDeltaSeconds = 0.5) {
  const calls = [];
  return {
    calls,
    clock: { maxDeltaSeconds },
    advanceTime(seconds) {
      calls.push('time ' + seconds.toFixed(3));
    },
    renderSharedFrame(frame) {
      calls.push('draw ' + frame.width);
    }
  };
}
const FRAME = Object.freeze({ width: 320, height: 180 });

test('FL01 each frame advances the clock, steps the game and draws, in that order', () => {
  const screen = display(),
    engine = recorder(),
    steps = [];
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    update: delta => {
      engine.calls.push('step');
      steps.push(delta);
    },
    ...screen
  });
  assert.ok(Object.isFrozen(loop));
  assert.deepEqual([loop.state, screen.waiting], ['idle', false]);
  loop.start();
  loop.start();
  assert.deepEqual([loop.state, screen.waiting], ['running', true]);
  screen.present(1000);
  screen.present(1016);
  screen.present(1048);
  assert.deepEqual(engine.calls, [
    'time 0.000',
    'step',
    'draw 320',
    'time 0.016',
    'step',
    'draw 320',
    'time 0.048',
    'step',
    'draw 320'
  ]);
  assert.deepEqual(
    steps.map(s => +s.toFixed(3)),
    [0, 0.016, 0.032]
  );
  assert.deepEqual(loop.snapshot(), {
    state: 'running',
    steps: 3,
    frames: 3,
    skipped: 0,
    seconds: 0.048,
    failure: undefined
  });
});

test('FL02 a long gap is one step of the longest length, and time stopped is not played back', () => {
  const screen = display(),
    engine = recorder(0.05),
    steps = [];
  // The Engine's clock takes less than the step asked for, so the clock's limit is the longest step.
  const loop = createBrowserFrameLoop({
    engine,
    frame: () => FRAME,
    update: delta => steps.push(+delta.toFixed(3)),
    maxStepSeconds: 0.1,
    ...screen
  });
  loop.start();
  screen.present(0);
  screen.present(16);
  // The tab was hidden for a minute.
  screen.present(60016);
  assert.deepEqual(steps, [0, 0.016, 0.05]);
  loop.stop();
  assert.deepEqual([loop.state, screen.waiting, screen.cancelled.length], ['idle', false, 1]);
  loop.stop();
  loop.start();
  screen.present(120000);
  screen.present(120010);
  assert.deepEqual(steps, [0, 0.016, 0.05, 0, 0.01]);
  assert.equal(+loop.snapshot().seconds.toFixed(3), 0.076);
  // A display whose time goes back gives a step of zero, never a negative one.
  screen.present(119000);
  assert.equal(steps.at(-1), 0);
});

test('FL03 while the Host holds its frames a frame is skipped, the game still steps, and nothing fails', () => {
  const screen = display(),
    engine = recorder();
  let pending = 0,
    steps = 0;
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    host: { getStatus: () => ({ pendingFrames: pending }) },
    update: () => {
      steps++;
    },
    ...screen
  });
  loop.start();
  screen.present(0);
  pending = 2;
  screen.present(16);
  screen.present(32);
  pending = 1;
  screen.present(48);
  assert.deepEqual([steps, loop.snapshot().frames, loop.snapshot().skipped, loop.state], [4, 2, 2, 'running']);
  // A Host made to take more frames is drawn to until it holds that many.
  const other = display(),
    three = createBrowserFrameLoop({
      engine: recorder(),
      frame: FRAME,
      host: { getStatus: () => ({ pendingFrames: 2 }) },
      maxPendingFrames: 3,
      ...other
    });
  three.start();
  other.present(0);
  assert.equal(three.snapshot().frames, 1);
  // Without a Host, a frame the Engine reports as refused for backpressure is counted as skipped.
  const bare = display(),
    refusing = {
      clock: { maxDeltaSeconds: 1 },
      advanceTime() {},
      renderSharedFrame() {
        throw new egret.EgretError('FRAME_RENDER_FAILED', { cause: new egret.EgretError('WEBGL2_BACKPRESSURE') });
      }
    };
  const tolerant = createBrowserFrameLoop({ engine: refusing, frame: FRAME, ...bare });
  tolerant.start();
  bare.present(0);
  bare.present(16);
  assert.deepEqual([tolerant.state, tolerant.snapshot().skipped, tolerant.snapshot().frames], ['running', 2, 0]);
});

test('FL04 a failure stops the loop and is told once; started again, the loop runs', () => {
  const screen = display(),
    engine = recorder(),
    told = [];
  let fail = true;
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    update: () => {
      if (fail) throw new Error('rule');
    },
    onError: error => told.push(error.message),
    ...screen
  });
  loop.start();
  screen.present(0);
  assert.deepEqual(
    [loop.state, screen.waiting, told, loop.snapshot().failure.message],
    ['failed', false, ['rule'], 'rule']
  );
  fail = false;
  loop.start();
  screen.present(100);
  assert.deepEqual([loop.state, loop.snapshot().failure, loop.snapshot().frames], ['running', undefined, 1]);
  // Without a listener the failure leaves the display's callback, where a page's console shows it.
  const quiet = display(),
    silent = createBrowserFrameLoop({
      engine: {
        clock: { maxDeltaSeconds: 1 },
        advanceTime() {},
        renderSharedFrame() {
          throw new egret.EgretError('FRAME_RENDER_FAILED', { cause: new Error('lost') });
        }
      },
      frame: FRAME,
      ...quiet
    });
  silent.start();
  assert.throws(() => quiet.present(0), coded('FRAME_RENDER_FAILED'));
  assert.deepEqual([silent.state, quiet.waiting], ['failed', false]);
  // A refusal that is not backpressure fails even without a Host; with a Host, backpressure itself is a failure, since the Host said it was free.
  const strict = display(),
    busy = createBrowserFrameLoop({
      engine: {
        clock: { maxDeltaSeconds: 1 },
        advanceTime() {},
        renderSharedFrame() {
          throw new egret.EgretError('FRAME_RENDER_FAILED', { cause: new egret.EgretError('WEBGPU_BACKPRESSURE') });
        }
      },
      frame: FRAME,
      host: { getStatus: () => ({ pendingFrames: 0 }) },
      onError() {},
      ...strict
    });
  busy.start();
  strict.present(0);
  assert.equal(busy.state, 'failed');
});

test('FL05 an update may stop or dispose the loop; a disposed loop takes nothing more; bad options are refused', () => {
  const screen = display(),
    engine = recorder();
  let loop;
  loop = createBrowserFrameLoop({ engine, frame: FRAME, update: () => loop.stop(), ...screen });
  loop.start();
  screen.present(0);
  assert.deepEqual([loop.state, screen.waiting, loop.snapshot().frames, loop.snapshot().steps], ['idle', false, 0, 1]);
  loop.start();
  loop.dispose();
  loop.dispose();
  assert.deepEqual([loop.state, screen.waiting], ['closed', false]);
  assert.throws(() => loop.start(), coded('FRAME_LOOP_CLOSED'));
  loop.stop();
  assert.equal(loop.snapshot().state, 'closed');
  const good = { engine: recorder(), frame: FRAME, ...display() };
  for (const bad of [
    null,
    7,
    { ...good, engine: undefined },
    { ...good, engine: {} },
    { ...good, frame: undefined },
    { ...good, host: {} },
    { ...good, maxPendingFrames: 0 },
    { ...good, maxPendingFrames: 1.5 },
    { ...good, update: 'step' },
    { ...good, onError: 1 },
    { ...good, maxStepSeconds: 0 },
    { ...good, maxStepSeconds: NaN },
    { ...good, engine: { ...recorder(), clock: {} } },
    { ...good, requestFrame: 1 },
    { ...good, cancelFrame: 'x' }
  ])
    assert.throws(() => createBrowserFrameLoop(bad), coded('FRAME_LOOP_OPTIONS_INVALID'));
});

test('FL06 with a real Engine the loop moves its clock and a tween, through a gap the clock alone would refuse', async () => {
  const engine = await egret.createEngine({ host: host().adapter }),
    scope = engine.createScope(),
    screen = display();
  try {
    const sprite = scope.use(new egret.Sprite());
    engine.stage.addChild(sprite);
    const ticks = [];
    engine.clock.onTick(scope, tick => {
      ticks.push(+tick.deltaSeconds.toFixed(3));
    });
    let drawn = 0;
    const loop = createBrowserFrameLoop({
      engine: {
        clock: engine.clock,
        advanceTime: seconds => engine.advanceTime(seconds),
        renderSharedFrame: frame => {
          drawn++;
          return engine.captureSharedFrame(frame);
        }
      },
      frame: FRAME,
      ...screen
    });
    loop.start();
    screen.present(5000);
    screen.present(5020);
    // A gap longer than the clock takes: given to the clock raw it is refused; the loop gives one longest step.
    screen.present(5020 + 1000 * (engine.clock.maxDeltaSeconds + 5));
    assert.equal(loop.state, 'running');
    assert.deepEqual(ticks, [0.02, +Math.min(0.1, engine.clock.maxDeltaSeconds).toFixed(3)]);
    assert.equal(
      +engine.clock.elapsedSeconds.toFixed(3),
      +(0.02 + Math.min(0.1, engine.clock.maxDeltaSeconds)).toFixed(3)
    );
    assert.equal(drawn, 3);
    loop.dispose();
  } finally {
    scope.dispose();
    await engine.dispose();
  }
});

test('FL07 a strict consumer compiles against the entry, and four misuses are refused; the entry has its factory alone', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '--project', 'tests/types/loop.json', '--pretty', 'false'],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(Object.keys(await import('@egret/engine/web/loop')), ['createBrowserFrameLoop']);
  for (const entry of ['@egret/engine', '@egret/engine/webgl2', '@egret/runtime'])
    assert.equal('createBrowserFrameLoop' in (await import(entry)), false, entry);
});
