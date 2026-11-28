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

test('FL10 a clean frame skips submission without skipping time, and backpressure keeps a requested frame pending', () => {
  const screen = display(),
    engine = recorder();
  let dirty = false,
    pendingFrames = 0,
    updates = 0;
  const draw = engine.renderSharedFrame;
  engine.renderSharedFrame = frame => {
    draw(frame);
    dirty = false;
  };
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    host: { getStatus: () => ({ pendingFrames }) },
    update() {
      if (++updates === 2) dirty = true;
    },
    shouldRender: () => dirty,
    ...screen
  });
  loop.start();
  screen.present(0);
  assert.deepEqual(engine.calls, ['time 0.000']);
  pendingFrames = 2;
  screen.present(16);
  assert.equal(loop.snapshot().skipped, 1);
  pendingFrames = 0;
  screen.present(32);
  screen.present(48);
  assert.deepEqual(engine.calls, ['time 0.000', 'time 0.016', 'time 0.032', 'draw 320', 'time 0.048']);
  assert.equal(loop.snapshot().frames, 1);
  assert.equal(updates, 4);
  loop.dispose();
});

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

test('FL07 a strict consumer compiles against the entry, and misuses are refused; the entry has its factory alone', async () => {
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

test('FL08 with catchUpSeconds a slow frame is played back as several steps before one draw', () => {
  const screen = display(),
    engine = recorder(0.05),
    steps = [];
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    update: delta => steps.push(+delta.toFixed(3)),
    maxStepSeconds: 0.04,
    catchUpSeconds: 0.25,
    ...screen
  });
  loop.start();
  screen.present(0);
  // A frame of 130 ms: four steps, the last one short, then one draw.
  screen.present(130);
  assert.deepEqual(steps, [0, 0.04, 0.04, 0.04, 0.01]);
  assert.deepEqual(engine.calls.slice(-2), ['time 0.130', 'draw 320']);
  assert.equal(engine.calls.filter(call => call.startsWith('draw')).length, 2);
  // A hidden minute is played back only up to catchUpSeconds.
  screen.present(60130);
  assert.equal(
    +steps
      .slice(5)
      .reduce((sum, step) => sum + step, 0)
      .toFixed(3),
    0.25
  );
  assert.ok(steps.slice(5).every(step => step <= 0.04));
  assert.equal(+loop.snapshot().seconds.toFixed(3), 0.38);
  // An ordinary frame is one step as before.
  screen.present(60146);
  assert.equal(steps.at(-1), 0.016);
  loop.dispose();
  for (const catchUpSeconds of [-1, NaN, Infinity, '1'])
    assert.throws(
      () => createBrowserFrameLoop({ engine, frame: FRAME, catchUpSeconds, ...display() }),
      coded('FRAME_LOOP_OPTIONS_INVALID')
    );
});

test('render preparation runs only for a wanted and provisionally admitted frame', () => {
  const screen = display(),
    engine = recorder();
  let pending = 2,
    wants = true;
  const loop = createBrowserFrameLoop({
    engine,
    frame: () => {
      engine.calls.push('frame');
      return FRAME;
    },
    host: { getStatus: () => ({ pendingFrames: pending }) },
    shouldRender: () => wants,
    update: () => engine.calls.push('update'),
    beforeRender: () => engine.calls.push('prepare'),
    ...screen
  });
  loop.start();
  screen.present(0);
  pending = 0;
  wants = false;
  screen.present(16);
  wants = true;
  screen.present(32);
  assert.deepEqual(engine.calls, [
    'time 0.000',
    'update',
    'time 0.016',
    'update',
    'time 0.032',
    'update',
    'prepare',
    'frame',
    'draw 320'
  ]);
  assert.equal(loop.snapshot().skipped, 1);
  loop.dispose();
});

test('explicit render retry skips only the failed submission, keeps simulation time, resets after success and stops at the bound', () => {
  const screen = display(),
    engine = recorder();
  const refusal = new egret.EgretError('FRAME_RENDER_FAILED', { cause: new egret.EgretError('WEBGL2_GEOMETRY_RANGE') });
  let fail = true,
    pending = 0,
    updates = 0;
  const accepted = [],
    fatal = [];
  const draw = engine.renderSharedFrame;
  engine.renderSharedFrame = function (frame) {
    if (fail) throw refusal;
    return draw.call(this, frame);
  };
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    host: { getStatus: () => ({ pendingFrames: pending }) },
    update: () => updates++,
    renderRetry: {
      maxConsecutive: 2,
      shouldRetry(error, attempt) {
        assert.equal(error, refusal);
        accepted.push(attempt);
        return true;
      }
    },
    onError: error => fatal.push(error),
    ...screen
  });
  loop.start();
  screen.present(0);
  pending = 2;
  screen.present(16);
  pending = 0;
  screen.present(32);
  fail = false;
  screen.present(48);
  fail = true;
  screen.present(64);
  screen.present(80);
  screen.present(96);
  assert.deepEqual(accepted, [1, 2, 1, 2]);
  assert.deepEqual(fatal, [refusal]);
  assert.equal(updates, 7);
  assert.equal(loop.snapshot().frames, 1);
  assert.equal(loop.snapshot().skipped, 1);
  assert.equal(loop.snapshot().recoveredRenderFailures, 4);
  assert.equal(loop.state, 'failed');
  assert.equal(screen.waiting, false);
  loop.dispose();
});

test('retry policy does not swallow update, frame-construction or preparation errors; decline and disposal stay terminal', () => {
  for (const stage of ['update', 'frame', 'prepare', 'render', 'dispose']) {
    const display_ = display(),
      engine = recorder(),
      fault = new Error(stage);
    let retries = 0,
      loop;
    const errors = [];
    loop = createBrowserFrameLoop({
      engine: {
        ...engine,
        renderSharedFrame: () => {
          throw fault;
        }
      },
      frame: () => {
        if (stage === 'frame') throw fault;
        return FRAME;
      },
      update: () => {
        if (stage === 'update') throw fault;
      },
      beforeRender: () => {
        if (stage === 'prepare') throw fault;
        if (stage === 'dispose') loop.dispose();
      },
      renderRetry: {
        maxConsecutive: 1,
        shouldRetry: () => {
          retries++;
          return false;
        }
      },
      onError: e => errors.push(e),
      ...display_
    });
    loop.start();
    display_.present(0);
    assert.equal(retries, stage === 'render' ? 1 : 0);
    assert.equal(loop.state, stage === 'dispose' ? 'closed' : 'failed');
    assert.deepEqual(errors, stage === 'dispose' ? [] : [fault]);
    assert.equal(display_.waiting, false);
    loop.dispose();
  }
});

test('render retry validates a small explicit limit and a callable decision', () => {
  for (const renderRetry of [
    null,
    { maxConsecutive: 0, shouldRetry: () => true },
    { maxConsecutive: 9, shouldRetry: () => true },
    { maxConsecutive: 1.2, shouldRetry: () => true },
    { maxConsecutive: 1, shouldRetry: true }
  ]) {
    assert.throws(
      () => createBrowserFrameLoop({ engine: recorder(), frame: FRAME, renderRetry, ...display() }),
      coded('FRAME_LOOP_OPTIONS_INVALID')
    );
  }
});

test('a presentation callback may restart or dispose without a second request or a resurrected loop', () => {
  const screen = display(),
    engine = recorder();
  let loop,
    restarted = false;
  loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    beforeRender() {
      if (!restarted) {
        restarted = true;
        loop.stop();
        loop.start();
      }
    },
    ...screen
  });
  loop.start();
  screen.present(0);
  assert.equal(loop.snapshot().frames, 0);
  assert.ok(screen.waiting);
  screen.present(16);
  assert.equal(loop.snapshot().frames, 1);
  loop.dispose();
  const next = display(),
    errors = [];
  const fault = new Error('render');
  loop = createBrowserFrameLoop({
    engine: {
      ...engine,
      renderSharedFrame() {
        throw fault;
      }
    },
    frame: FRAME,
    renderRetry: {
      maxConsecutive: 1,
      shouldRetry() {
        loop.dispose();
        return false;
      }
    },
    onError: e => errors.push(e),
    ...next
  });
  loop.start();
  next.present(0);
  assert.equal(loop.state, 'closed');
  assert.equal(next.waiting, false);
  assert.deepEqual(errors, []);
});
test('a throwing retry decision preserves both errors and stops the loop', () => {
  const screen = display(),
    engine = recorder(),
    fault = new Error('render'),
    decision = new Error('decision');
  const errors = [];
  const loop = createBrowserFrameLoop({
    engine: {
      ...engine,
      renderSharedFrame() {
        throw fault;
      }
    },
    frame: FRAME,
    renderRetry: {
      maxConsecutive: 1,
      shouldRetry() {
        throw decision;
      }
    },
    onError: e => errors.push(e),
    ...screen
  });
  loop.start();
  screen.present(0);
  assert.equal(loop.state, 'failed');
  assert.equal(screen.waiting, false);
  assert.equal(errors[0].code, 'FRAME_LOOP_RENDER_RETRY_FAILED');
  assert.deepEqual(errors[0].cause.errors, [fault, decision]);
});

test('throwing reentrant presentation callbacks cannot resurrect a disposed loop or leave a queued restart', () => {
  for (const stage of ['prepare', 'retry'])
    for (const operation of ['dispose', 'restart']) {
      const screen = display(),
        engine = recorder(),
        fault = new Error(stage),
        errors = [];
      let loop;
      const reentry = () => {
        if (operation === 'dispose') loop.dispose();
        else {
          loop.stop();
          loop.start();
        }
        throw fault;
      };
      loop = createBrowserFrameLoop({
        engine:
          stage === 'retry'
            ? {
                ...engine,
                renderSharedFrame() {
                  throw new Error('render');
                }
              }
            : engine,
        frame: FRAME,
        ...(stage === 'prepare'
          ? { beforeRender: reentry }
          : { renderRetry: { maxConsecutive: 1, shouldRetry: reentry } }),
        onError: error => errors.push(error),
        ...screen
      });
      loop.start();
      screen.present(0);
      assert.equal(loop.state, operation === 'dispose' ? 'closed' : 'failed', stage + ':' + operation);
      assert.equal(screen.waiting, false);
      assert.equal(errors.length, 1);
      if (stage === 'retry') {
        assert.equal(errors[0].code, 'FRAME_LOOP_RENDER_RETRY_FAILED');
        assert.equal(errors[0].cause.errors[1], fault);
      } else assert.equal(errors[0], fault);
      if (operation === 'dispose') assert.throws(() => loop.start(), coded('FRAME_LOOP_CLOSED'));
      loop.dispose();
    }
});

test('restart during clock, update, wanted-frame or Host admission does not run old presentation work', () => {
  for (const stage of ['clock', 'update', 'wanted', 'host']) {
    const screen = display(),
      engine = recorder();
    let loop,
      restarted = false,
      prepared = 0;
    const restart = where => {
      if (stage === where && !restarted) {
        restarted = true;
        loop.stop();
        loop.start();
      }
    };
    const advance = engine.advanceTime;
    engine.advanceTime = function (t) {
      advance.call(this, t);
      restart('clock');
    };
    loop = createBrowserFrameLoop({
      engine,
      frame: FRAME,
      update() {
        restart('update');
      },
      shouldRender() {
        restart('wanted');
        return true;
      },
      host: {
        getStatus() {
          restart('host');
          return { pendingFrames: 0 };
        }
      },
      beforeRender() {
        prepared++;
      },
      ...screen
    });
    loop.start();
    screen.present(0);
    assert.equal(prepared, 0, stage);
    assert.equal(loop.snapshot().frames, 0);
    assert.equal(screen.waiting, true);
    screen.present(16);
    assert.equal(prepared, 1);
    assert.equal(loop.snapshot().frames, 1);
    loop.dispose();
  }
});

test('FL11 opt-in timings distinguish retained frames, Host admission and render calls without changing steps', () => {
  const screen = display(),
    engine = recorder(),
    samples = [];
  let dirty = false,
    pending = 0,
    admissionChecks = 0;
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    ...screen,
    host: {
      getStatus() {
        admissionChecks++;
        return { pendingFrames: pending };
      }
    },
    shouldRender: () => dirty,
    onFrameTiming: sample => samples.push(sample)
  });
  loop.start();
  screen.present(1000);
  dirty = true;
  pending = 2;
  screen.present(1016);
  pending = 0;
  screen.present(1048);
  assert.deepEqual(
    samples.map(s => [s.id, s.rafTimestampMs, s.outcome, s.pendingFrames]),
    [
      [1, 1000, 'retained', undefined],
      [2, 1016, 'backpressure', 2],
      [3, 1048, 'rendered', 0]
    ]
  );
  for (const sample of samples) {
    assert.ok(Object.isFrozen(sample));
    assert.ok(sample.callbackEndMs >= sample.callbackStartMs);
    for (const k of ['updateMs', 'decisionMs', 'hostCheckMs', 'prepareMs', 'renderMs'])
      assert.ok(Number.isFinite(sample[k]) && sample[k] >= 0, k);
  }
  assert.equal(admissionChecks, 2);
  assert.equal(loop.snapshot().steps, 3);
  assert.equal(loop.snapshot().frames, 1);
  loop.dispose();
});

test('FL12 timing subscribers are observational and invalid options fail early', () => {
  const screen = display(),
    engine = recorder();
  assert.throws(() => createBrowserFrameLoop({ engine, frame: FRAME, onFrameTiming: true, ...screen }), {
    code: 'FRAME_LOOP_OPTIONS_INVALID'
  });
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    onFrameTiming() {
      throw Error('diagnostics');
    },
    ...screen
  });
  loop.start();
  screen.present(1000);
  screen.present(1016);
  assert.equal(loop.snapshot().frames, 2);
  assert.equal(loop.state, 'running');
  loop.dispose();
});

test('afterFrame runs once after each valid display turn, including retained, backpressure and explicit retry', () => {
  const screen = display(),
    engine = recorder(0.05),
    calls = [],
    samples = [];
  let mode = 'draw';
  engine.renderSharedFrame = () => {
    calls.push('draw');
    if (mode === 'retry') throw new Error('draw fault');
  };
  const loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    ...screen,
    maxStepSeconds: 0.05,
    catchUpSeconds: 0.15,
    update: () => calls.push('update'),
    shouldRender: () => mode !== 'retain',
    host: { getStatus: () => ({ pendingFrames: mode === 'busy' ? 2 : 0 }) },
    beforeRender: () => calls.push('prepare'),
    renderRetry: {
      maxConsecutive: 1,
      shouldRetry: () => {
        calls.push('retry');
        return true;
      }
    },
    afterFrame() {
      assert.equal(screen.waiting, false, 'the next frame is not requested before afterFrame');
      calls.push('after');
    },
    onFrameTiming: sample => samples.push(sample)
  });
  loop.start();
  for (const [at, next, expected] of [
    [0, 'draw', ['update', 'prepare', 'draw', 'after']],
    [150, 'retain', ['update', 'update', 'update', 'after']],
    [166, 'busy', ['update', 'after']],
    [182, 'retry', ['update', 'prepare', 'draw', 'retry', 'after']],
    [198, 'draw', ['update', 'prepare', 'draw', 'after']]
  ]) {
    mode = next;
    calls.length = 0;
    screen.present(at);
    assert.deepEqual(calls, expected, next);
    assert.equal(screen.waiting, true);
  }
  assert.deepEqual(
    samples.map(s => s.outcome),
    ['rendered', 'retained', 'backpressure', 'retry', 'rendered']
  );
  assert.ok(samples.every(s => Number.isFinite(s.afterFrameMs) && s.afterFrameMs >= 0));
  assert.equal(loop.snapshot().frames, 2);
  assert.equal(loop.snapshot().recoveredRenderFailures, 1);
  loop.dispose();
});

test('afterFrame never runs for interrupted or fatal frame paths, including render-time disposal or restart', () => {
  for (const where of ['clock', 'update', 'wanted', 'host', 'prepare', 'frame', 'render', 'retry']) {
    for (const operation of ['dispose', 'restart', 'throw']) {
      const screen = display(),
        engine = recorder(),
        fault = new Error('fault'),
        errors = [],
        samples = [];
      let loop,
        after = 0,
        fired = false;
      const interrupt = stage => {
        if (where !== stage || fired) return;
        fired = true;
        if (operation === 'dispose') loop.dispose();
        else if (operation === 'restart') {
          loop.stop();
          loop.start();
        } else throw fault;
      };
      engine.advanceTime = () => interrupt('clock');
      engine.renderSharedFrame = () => {
        interrupt('render');
        if (where === 'retry') throw new Error('retry me');
      };
      loop = createBrowserFrameLoop({
        engine,
        ...screen,
        frame: () => {
          interrupt('frame');
          return FRAME;
        },
        update: () => interrupt('update'),
        shouldRender: () => {
          interrupt('wanted');
          return true;
        },
        host: {
          getStatus() {
            interrupt('host');
            return { pendingFrames: 0 };
          }
        },
        beforeRender: () => interrupt('prepare'),
        renderRetry: {
          maxConsecutive: 1,
          shouldRetry: () => {
            interrupt('retry');
            return where === 'retry';
          }
        },
        afterFrame: () => {
          after++;
        },
        onError: e => errors.push(e),
        onFrameTiming: s => samples.push(s)
      });
      loop.start();
      screen.present(0);
      assert.equal(after, 0, where + ':' + operation);
      assert.equal(samples[0].afterFrameMs, 0);
      assert.equal(loop.state, operation === 'dispose' ? 'closed' : operation === 'restart' ? 'running' : 'failed');
      assert.equal(screen.waiting, operation === 'restart');
      assert.equal(errors.length, operation === 'throw' ? 1 : 0);
      loop.dispose();
    }
  }
});

test('afterFrame failures are normal loop failures and callback restart/disposal cannot leave duplicate requests', () => {
  for (const operation of ['stop', 'dispose', 'restart', 'throw', 'restart-throw', 'dispose-throw']) {
    const screen = display(),
      engine = recorder(),
      fault = new Error('afterFrame'),
      errors = [],
      samples = [];
    let loop,
      called = 0;
    loop = createBrowserFrameLoop({
      engine,
      frame: FRAME,
      ...screen,
      afterFrame() {
        called++;
        if (operation.startsWith('restart')) {
          loop.stop();
          loop.start();
        }
        if (operation.startsWith('dispose')) loop.dispose();
        if (operation === 'stop') loop.stop();
        if (operation.includes('throw')) throw fault;
      },
      onError: e => errors.push(e),
      onFrameTiming: s => samples.push(s)
    });
    loop.start();
    screen.present(0);
    assert.equal(called, 1);
    assert.equal(
      loop.state,
      operation.startsWith('dispose')
        ? 'closed'
        : operation.includes('throw')
          ? 'failed'
          : operation === 'restart'
            ? 'running'
            : 'idle'
    );
    assert.equal(screen.waiting, operation === 'restart');
    assert.equal(loop.snapshot().frames, 1, 'the preceding completed draw still counts');
    assert.deepEqual(errors, operation.includes('throw') ? [fault] : []);
    assert.equal(samples[0].outcome, operation.includes('throw') ? 'failed' : 'rendered');
    assert.ok(samples[0].afterFrameMs >= 0);
    loop.dispose();
  }
});

test('afterFrame also follows a direct backpressure refusal; invalid options and default timing stay strict', () => {
  const screen = display(),
    engine = recorder(),
    calls = [],
    samples = [];
  for (const afterFrame of [false, 1, null, {}])
    assert.throws(
      () => createBrowserFrameLoop({ engine, frame: FRAME, ...screen, afterFrame }),
      coded('FRAME_LOOP_OPTIONS_INVALID')
    );
  engine.renderSharedFrame = () => {
    throw new egret.EgretError('FRAME_RENDER_FAILED', { cause: new egret.EgretError('WEBGL2_BACKPRESSURE') });
  };
  let loop = createBrowserFrameLoop({
    engine,
    frame: FRAME,
    ...screen,
    afterFrame: () => calls.push('after'),
    onFrameTiming: s => samples.push(s)
  });
  loop.start();
  screen.present(0);
  assert.deepEqual(calls, ['after']);
  assert.equal(samples[0].outcome, 'backpressure');
  assert.ok(samples[0].afterFrameMs >= 0);
  loop.dispose();
  loop = createBrowserFrameLoop({ engine: recorder(), frame: FRAME, ...screen, onFrameTiming: s => samples.push(s) });
  loop.start();
  screen.present(16);
  assert.equal(Object.hasOwn(samples.at(-1), 'afterFrameMs'), false);
  loop.dispose();
});
