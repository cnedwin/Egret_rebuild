// SPDX-License-Identifier: Apache-2.0
// What Egret 5 code that is moved over still finds: Timer and setTimeout on the Engine's clock, Shape, Point,
// Rectangle and Matrix, and a mask that is not drawn while it masks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

const hasCode = code => error => error?.code === code;
/** An Engine whose `advanceTime` is given the seconds of each frame; it is told the source's time, so they are summed. */
async function engine(body) {
  const value = await egret.createEngine({
      host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
    }),
    scope = value.createScope();
  let now = 0;
  value.advanceTime(0);
  const stepping = new Proxy(value, {
    get(target, key) {
      if (key === 'advanceTime')
        // The clock takes a tenth of a second at most in one step, as a frame loop gives it; longer is several.
        return seconds => {
          for (let left = seconds; left > 1e-12; left -= 0.1) target.advanceTime((now += Math.min(0.1, left)));
        };
      const found = Reflect.get(target, key, target);
      return typeof found === 'function' ? found.bind(target) : found;
    }
  });
  try {
    await body(stepping, scope);
  } finally {
    scope.dispose();
    await value.dispose();
  }
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' is not ' + expected);

// Break caught: call by frames rather than seconds, lose calls in a long frame, run past its count, or run while paused.
test('C01 a timer calls every delay of the clock, as many times as the seconds hold, up to its count', () =>
  engine(async (e, scope) => {
    const calls = [];
    let completed = 0;
    const timer = egret
      .createTimer(e, scope, 0.25, 3)
      .onTimer(n => calls.push(n))
      .onComplete(() => completed++);
    e.advanceTime(1);
    assert.deepEqual(calls, [], 'not before it starts');
    timer.start();
    assert.equal(timer.running, true);
    e.advanceTime(0.1);
    e.advanceTime(0.1);
    assert.deepEqual(calls, []);
    e.advanceTime(0.1);
    assert.deepEqual(calls, [1]);
    // At 0.7 seconds two calls are due; the third comes at 0.75, in the frame that reaches 0.8.
    e.advanceTime(0.1);
    e.advanceTime(0.1);
    e.advanceTime(0.1);
    e.advanceTime(0.1);
    assert.deepEqual(calls, [1, 2]);
    e.advanceTime(0.1);
    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(completed, 1);
    assert.equal(timer.running, false);
    e.advanceTime(1);
    assert.deepEqual(calls, [1, 2, 3]);
    timer.start();
    e.advanceTime(1);
    assert.equal(calls.length, 3, 'a finished timer does not start again until it is reset');
    timer.reset().start();
    e.clock.pause();
    e.advanceTime(1);
    assert.equal(calls.length, 3, 'a paused clock holds it');
    e.clock.resume();
    // The first frame after a resume only marks the time; three frames after it make a quarter second and more.
    for (let i = 0; i < 3; i++) e.advanceTime(0.1);
    assert.deepEqual(calls, [1, 2, 3]);
    e.advanceTime(0.1);
    assert.deepEqual(calls, [1, 2, 3, 1]);
  }));

// Break caught: let a callback that stops the timer be followed by more calls, or take a delay it cannot keep.
test('C02 a timer can be stopped, changed and reset from its own call, and refuses delays it cannot keep', () =>
  engine(async (e, scope) => {
    const calls = [];
    const timer = egret.createTimer(e, scope, 0.01).onTimer(n => {
      calls.push(n);
      if (n === 2) timer.stop();
    });
    timer.start();
    e.advanceTime(0.1);
    assert.deepEqual(calls, [1, 2]);
    assert.equal(timer.currentCount, 2);
    timer.delay = 0.05;
    timer.start();
    e.advanceTime(0.1);
    assert.deepEqual(calls, [1, 2, 3, 4]);
    for (const bad of [0, -1, NaN, '1', 0.0001])
      assert.throws(() => egret.createTimer(e, scope, bad), hasCode('TIMER_OPTIONS_INVALID'));
    assert.throws(() => egret.createTimer(e, scope, 1, 1.5), hasCode('TIMER_OPTIONS_INVALID'));
    assert.throws(() => (timer.delay = 0), hasCode('TIMER_OPTIONS_INVALID'));
    assert.throws(() => timer.onTimer('x'), hasCode('TIMER_OPTIONS_INVALID'));
    // It ends with its scope.
    const short = e.createScope();
    let late = 0;
    egret
      .createTimer(e, short, 0.05)
      .onTimer(() => late++)
      .start();
    short.dispose();
    e.advanceTime(0.1);
    assert.equal(late, 0);
  }));

// Break caught: call `after` early, twice, or after it was cancelled.
test('C03 after calls once when its seconds have passed, and not at all once cancelled', () =>
  engine(async (e, scope) => {
    let called = 0;
    const once = egret.after(e, scope, 0.15, () => called++);
    e.advanceTime(0.1);
    assert.deepEqual([called, once.done], [0, false]);
    e.advanceTime(0.1);
    assert.deepEqual([called, once.done], [1, true]);
    e.advanceTime(1);
    assert.equal(called, 1);
    const never = egret.after(e, scope, 0.05, () => called++);
    never.cancel();
    e.advanceTime(0.1);
    assert.deepEqual([called, never.done], [1, true]);
  }));

// Break caught: make Shape a class of its own that a Sprite is not, or one without graphics.
test('C04 Shape is the Sprite', () => {
  assert.equal(egret.Shape, egret.Sprite);
});

// Break caught: get Egret's interpolate backwards, a polar angle in degrees, or a length of a moved point wrong.
test('C05 Point does what Egret 5 code asks of one', () => {
  const p = new egret.Point(3, 4);
  assert.equal(p.length, 5);
  assert.deepEqual(p.add({ x: 1, y: 1 }), new egret.Point(4, 5));
  assert.deepEqual(p.subtract({ x: 1, y: 1 }), new egret.Point(2, 3));
  assert.equal(egret.Point.distance(p, { x: 0, y: 0 }), 5);
  assert.deepEqual(egret.Point.interpolate({ x: 10, y: 0 }, { x: 0, y: 0 }, 0.25), new egret.Point(2.5, 0));
  const polar = egret.Point.polar(2, Math.PI / 2);
  close(polar.x, 0);
  close(polar.y, 2);
  const q = p.clone();
  q.normalize(10);
  assert.deepEqual([q.x, q.y], [6, 8]);
  assert.equal(p.equals({ x: 3, y: 4 }), true);
  q.offset(1, -1);
  assert.deepEqual([q.x, q.y], [7, 7]);
  assert.equal(String(new egret.Point(1, 2)), '(x=1, y=2)');
});

// Break caught: count a right or bottom edge as inside, move the far side with a near one, or join empties.
test('C06 Rectangle does what Egret 5 code asks of one', () => {
  const r = new egret.Rectangle(10, 20, 100, 50);
  assert.deepEqual([r.left, r.right, r.top, r.bottom], [10, 110, 20, 70]);
  assert.equal(r.contains(10, 20), true);
  assert.equal(r.contains(110, 40), false);
  assert.equal(r.containsPoint({ x: 50, y: 69 }), true);
  assert.equal(r.containsRect({ x: 20, y: 30, width: 10, height: 10 }), true);
  assert.equal(r.containsRect({ x: 20, y: 30, width: 0, height: 10 }), false);
  assert.deepEqual(r.intersection({ x: 100, y: 60, width: 50, height: 50 }), new egret.Rectangle(100, 60, 10, 10));
  assert.equal(r.intersects({ x: 110, y: 20, width: 5, height: 5 }), false);
  assert.deepEqual(r.union({ x: 0, y: 0, width: 5, height: 5 }), new egret.Rectangle(0, 0, 110, 70));
  assert.deepEqual(new egret.Rectangle().union(r), r);
  const s = r.clone();
  s.left = 0;
  assert.deepEqual([s.x, s.width, s.right], [0, 110, 110]);
  s.top = 0;
  assert.deepEqual([s.y, s.height, s.bottom], [0, 70, 70]);
  s.inflate(5, 5);
  assert.deepEqual([s.x, s.y, s.width, s.height], [-5, -5, 120, 80]);
  assert.equal(new egret.Rectangle(0, 0, 0, 10).isEmpty(), true);
  s.setEmpty();
  assert.equal(s.isEmpty(), true);
});

// Break caught: concatenate in the wrong order, invert wrongly, or place a gradient box differently from beginGradientFill.
test('C07 Matrix changes in the order Egret 5 did and places a gradient box as beginGradientFill expects', () => {
  const m = new egret.Matrix();
  m.scale(2, 3);
  m.rotate(Math.PI / 2);
  m.translate(10, 20);
  // Scale first, then turn, then move: (1, 0) → (2, 0) → (0, 2) → (10, 22).
  const p = m.transformPoint(1, 0);
  close(p.x, 10);
  close(p.y, 22);
  const inverse = m.clone();
  inverse.invert();
  const back = inverse.transformPoint(p.x, p.y);
  close(back.x, 1);
  close(back.y, 0);
  const d = m.deltaTransformPoint({ x: 1, y: 0 });
  close(d.x, 0);
  close(d.y, 2);
  const flat = new egret.Matrix(0, 0, 0, 0, 5, 6);
  flat.invert();
  assert.deepEqual([flat.a, flat.d, flat.tx, flat.ty], [0, 0, -5, -6]);
  const box = new egret.Matrix();
  box.createGradientBox(200, 100, 0, 10, 20);
  assert.deepEqual({ ...box }, { a: 200 / 1638.4, b: 0, c: 0, d: 100 / 1638.4, tx: 110, ty: 70 });
  const before = new egret.Matrix(1, 0, 0, 1, 5, 0).prepend(2, 0, 0, 2, 0, 0);
  assert.deepEqual([before.a, before.tx], [2, 5]);
  // It is a plain matrix where one is asked for.
  const sprite = new egret.Sprite();
  sprite.graphics
    .beginGradientFill('linear', [0, 0xffffff], [1, 1], [0, 255], box)
    .drawRect(10, 20, 200, 100)
    .endFill();
});

// Break caught: draw a node while it is another's mask, keep it hidden once it is not, or count one mask twice.
test('C08 a node is not drawn while it is a shape mask, and is drawn again when it no longer is', () =>
  engine(async e => {
    const scope = e.createScope();
    const picture = e.stage.addChild(scope.use(new egret.DisplayObjectContainer()));
    picture.addChild(scope.use(new egret.Sprite())).graphics.beginFill(0xff0000).drawRect(0, 0, 50, 50).endFill();
    const mask = e.stage.addChild(scope.use(new egret.Shape()));
    mask.graphics.beginFill(0x00ff00).drawCircle(25, 25, 20).endFill();
    const drawn = () =>
      e.captureSharedFrame({ width: 64, height: 64 }).commands.filter(c => c.kind === 'mesh' || c.kind === 'rect')
        .length;
    const alone = drawn();
    picture.renderEffect = { shapeMask: mask };
    assert.equal(drawn(), alone - 1, 'the mask is not drawn while it masks');
    picture.renderEffect = { shapeMask: mask, blurRadius: 1 };
    assert.equal(drawn(), alone - 1, 'the same mask set again is still one use');
    picture.renderEffect = undefined;
    assert.equal(drawn(), alone, 'the mask is drawn again');
    scope.dispose();
  }));
