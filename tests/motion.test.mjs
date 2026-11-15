// SPDX-License-Identifier: Apache-2.0
// A motion moves several numbers of one object together, step after step, on the Engine's clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

const coded = code => error => error?.code === code;
async function withEngine(run) {
  const engine = await egret.createEngine({ host: host().adapter }),
    scope = engine.createScope();
  // The clock is moved a hundredth of a second at a time, as a display would move it. A step that ends between two
  // of these ends on the next one, so the tests leave a little room after each end.
  let ticks = 0;
  engine.advanceTime(0);
  const advance = seconds => {
    for (let i = Math.round(seconds * 100); i > 0; i--) engine.advanceTime(++ticks / 100);
  };
  try {
    await run({ engine, scope, advance });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, label + ': ' + actual + ' is not ' + expected);

test('MO01 several numbers move together, from what they are when the step begins', () =>
  withEngine(({ engine, scope, advance }) => {
    const sprite = scope.use(new egret.Sprite());
    sprite.x = 10;
    const motion = egret.animate(engine, scope, sprite).to({ x: 110, alpha: 0 }, 1);
    assert.equal(motion.state, 'idle');
    sprite.x = 20;
    assert.equal(motion.start(), motion);
    assert.equal(motion.state, 'running');
    advance(0.25);
    near(sprite.x, 42.5, 'x a quarter in');
    near(sprite.alpha, 0.75, 'alpha a quarter in');
    advance(0.25);
    near(sprite.x, 65, 'x halfway');
    advance(0.52);
    assert.deepEqual([sprite.x, sprite.alpha, motion.state], [110, 0, 'finished']);
    advance(1);
    assert.equal(sprite.x, 110);
  }));

test('MO02 steps follow one another: to, wait, call, and the whole chain again', () =>
  withEngine(({ engine, scope, advance }) => {
    const box = { x: 0, y: 0 },
      log = [];
    const motion = egret
      .animate(engine, scope, box)
      .to({ x: 10 }, 0.1)
      .call(() => log.push('there@' + box.x))
      .wait(0.1)
      .to({ x: 0, y: 5 }, 0.1)
      .call(() => log.push('back'))
      .loop(2)
      .onFinish(() => log.push('finished'))
      .start();
    advance(0.12);
    assert.deepEqual([box.x, log.splice(0)], [10, ['there@10']]);
    advance(0.05);
    assert.equal(box.x, 10, 'waiting');
    advance(0.1);
    assert.ok(box.x > 0 && box.x < 10 && box.y > 0 && box.y < 5, 'on the way back: ' + box.x + ', ' + box.y);
    near(box.y, (10 - box.x) / 2, 'x and y move together');
    advance(0.1);
    assert.deepEqual([box.y, log.splice(0)], [5, ['back']]);
    // The second run has begun by now, from the values the first one left.
    advance(0.5);
    assert.deepEqual([box.x, box.y, log.splice(0), motion.state], [0, 5, ['there@10', 'back', 'finished'], 'finished']);
    // A step of no length is taken at once, and calls run in order with it.
    const jump = egret
      .animate(engine, scope, box)
      .to({ x: 7 }, 0)
      .call(() => log.push('jumped@' + box.x))
      .start();
    assert.deepEqual([box.x, log.splice(0), jump.state], [7, ['jumped@7'], 'finished']);
  }));

test('MO03 a step eases by a name or by a function', () =>
  withEngine(({ engine, scope, advance }) => {
    const value = { n: 0 };
    egret.animate(engine, scope, value).to({ n: 100 }, 1, 'quadOut').start();
    advance(0.5);
    near(value.n, 75, 'quadOut halfway');
    advance(0.52);
    assert.equal(value.n, 100);
    value.n = 0;
    egret.animate(engine, scope, value).to({ n: 100 }, 1, 'quadInOut').start();
    advance(0.25);
    near(value.n, 12.5, 'quadInOut a quarter in');
    advance(0.77);
    value.n = 0;
    egret
      .animate(engine, scope, value)
      .to({ n: 100 }, 1, t => t * t * t)
      .start();
    advance(0.5);
    near(value.n, 12.5, 'a function');
    advance(0.52);
    assert.equal(value.n, 100);
    // backOut passes its end on the way and still ends on it.
    value.n = 0;
    egret.animate(engine, scope, value).to({ n: 100 }, 1, 'backOut').start();
    advance(0.5);
    assert.ok(value.n > 100, 'past the end: ' + value.n);
    advance(0.52);
    assert.equal(value.n, 100);
    for (const name of [
      'linear',
      'quadIn',
      'cubicIn',
      'cubicOut',
      'cubicInOut',
      'quartIn',
      'quartOut',
      'quartInOut',
      'sineIn',
      'sineOut',
      'sineInOut',
      'expoIn',
      'expoOut',
      'expoInOut',
      'backIn',
      'backInOut',
      'elasticOut',
      'bounceOut'
    ]) {
      value.n = 0;
      egret.animate(engine, scope, value).to({ n: 1 }, 0.5, name).start();
      advance(0.25);
      assert.ok(Number.isFinite(value.n), name);
      advance(0.27);
      assert.equal(value.n, 1, name);
    }
  }));

test('MO04 a motion pauses, resumes and stops, and ends with its scope', () =>
  withEngine(({ engine, scope, advance }) => {
    const value = { n: 0 },
      log = [];
    const motion = egret
      .animate(engine, scope, value)
      .to({ n: 10 }, 1)
      .onFinish(() => log.push('finished'))
      .start();
    advance(0.3);
    motion.pause();
    assert.equal(motion.state, 'paused');
    advance(5);
    near(value.n, 3, 'held while paused');
    motion.resume();
    advance(0.2);
    near(value.n, 5, 'after resume');
    motion.stop();
    assert.equal(motion.state, 'stopped');
    advance(1);
    near(value.n, 5, 'stopped where it was');
    assert.deepEqual(log, []);
    motion.stop();
    motion.pause();
    motion.resume();
    assert.equal(motion.state, 'stopped');
    // Without end, until stopped; a call inside the chain may stop it.
    let turns = 0;
    const forever = egret
      .animate(engine, scope, value)
      .to({ n: 1 }, 0.1)
      .call(() => {
        if (++turns === 3) forever.stop();
      })
      .loop()
      .start();
    advance(1);
    assert.deepEqual([turns, forever.state], [3, 'stopped']);
    // The scope's end is the motion's end.
    const other = engine.createScope(),
      held = { n: 0 };
    egret.animate(engine, other, held).to({ n: 10 }, 1).start();
    advance(0.5);
    other.dispose();
    advance(0.5);
    near(held.n, 5, 'ended with its scope');
  }));

test('MO05 what is not a motion is refused', () =>
  withEngine(({ engine, scope }) => {
    const value = { n: 0, label: 'x' };
    assert.throws(() => egret.animate(engine, scope, null), coded('MOTION_OPTIONS_INVALID'));
    const motion = egret.animate(engine, scope, value);
    for (const bad of [
      () => motion.to({}, 1),
      () => motion.to({ n: NaN }, 1),
      () => motion.to({ n: 1 }, -1),
      () => motion.to({ n: 1 }, '1'),
      () => motion.to({ n: 1 }, 1, 'fast'),
      () => motion.to(null, 1),
      () => motion.wait(-1),
      () => motion.call('x'),
      () => motion.loop(0),
      () => motion.loop(1.5),
      () => motion.onFinish(1)
    ])
      assert.throws(bad, coded('MOTION_OPTIONS_INVALID'));
    // A chain that takes no time cannot run without end, and a number that is not one cannot be moved.
    assert.throws(
      () =>
        egret
          .animate(engine, scope, value)
          .call(() => {})
          .loop()
          .start(),
      coded('MOTION_OPTIONS_INVALID')
    );
    assert.throws(
      () => egret.animate(engine, scope, value).to({ label: 1 }, 1).start(),
      coded('MOTION_OPTIONS_INVALID')
    );
    // Steps are added before the start.
    motion.to({ n: 1 }, 1).start();
    assert.throws(() => motion.to({ n: 2 }, 1), coded('MOTION_ALREADY_STARTED'));
    assert.throws(() => motion.start(), coded('MOTION_ALREADY_STARTED'));
    assert.match(String(new egret.EgretError('MOTION_ALREADY_STARTED').message), /^MOTION_ALREADY_STARTED: /);
  }));
