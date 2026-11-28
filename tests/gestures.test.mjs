// SPDX-License-Identifier: Apache-2.0
// Gestures of @egret/engine/web/gestures on a genuine Engine, with contacts given to pointer input as a host gives
// them: a tap, a double tap, a long press, a drag, a swipe, a pinch, and drag and drop onto the innermost target.
// No page is used; a finger on a real screen is not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer, Sprite } from '@egret/engine';
import { createPointerInput } from '@egret/engine/input';
import { createDragAndDrop, createGestures } from '@egret/engine/web/gestures';
import { host } from './helpers.mjs';

async function fixture(run) {
  const h = host(),
    engine = await createEngine({ host: h.adapter });
  const scope = engine.createScope();
  const pad = scope.use(new DisplayObjectContainer());
  pad.hitArea = { x: 0, y: 0, width: 200, height: 200 };
  pad.touchEnabled = true;
  engine.stage.addChild(pad);
  const input = createPointerInput({ engine, scope, width: 400, height: 400 });
  // A finger: down at a time, moved, and lifted, with timestamps in milliseconds.
  const finger = (id, x, y, t) => {
    const session = input.begin({
      pointerId: id,
      pointerType: 'touch',
      globalX: x,
      globalY: y,
      buttons: 1,
      timestamp: t
    });
    return {
      move: (mx, my, mt) => input.move(session, { globalX: mx, globalY: my, buttons: 1, timestamp: mt }),
      up: (ux, uy, ut) => input.end(session, { globalX: ux, globalY: uy, buttons: 0, timestamp: ut })
    };
  };
  // A mouse press of the given buttons (1 primary, 2 secondary, 4 middle), moved and released.
  const mouse = (buttons, x, y, t) => {
    const session = input.begin({ pointerId: 1, pointerType: 'mouse', globalX: x, globalY: y, buttons, timestamp: t });
    return {
      move: (mx, my, mt) => input.move(session, { globalX: mx, globalY: my, buttons, timestamp: mt }),
      up: (ux, uy, ut) => input.end(session, { globalX: ux, globalY: uy, buttons: 0, timestamp: ut }),
      cancel: () => input.cancel(session, 'pointercancel')
    };
  };
  try {
    await run({ engine, scope, pad, input, finger, mouse });
  } finally {
    input.dispose();
    await engine.dispose();
  }
}

// Break caught: a tap told twice, a double tap from two taps far apart or long apart, or a tap after a drag.
test('GE01 taps, double taps, and a moved contact that is no tap', () =>
  fixture(({ engine, scope, pad, input, finger }) => {
    const seen = [];
    createGestures({
      engine,
      scope,
      input,
      target: pad,
      onTap: at => seen.push(['tap', at.x, at.y]),
      onDoubleTap: () => seen.push(['double'])
    });
    finger(1, 10, 10, 0).up(10, 10, 50);
    finger(1, 12, 11, 200).up(12, 11, 240);
    assert.deepEqual(seen, [['tap', 10, 10], ['tap', 12, 11], ['double']]);
    seen.length = 0;
    // Too long after the last: a tap, not a double.
    finger(1, 10, 10, 1000).up(10, 10, 1030);
    finger(1, 10, 10, 1500).up(10, 10, 1530);
    assert.deepEqual(seen, [
      ['tap', 10, 10],
      ['tap', 10, 10]
    ]);
    seen.length = 0;
    const moved = finger(1, 10, 10, 3000);
    moved.move(60, 10, 3100);
    moved.up(60, 10, 3200);
    assert.deepEqual(seen, [], 'a drag is no tap');
  }));

// Break caught: a long press told while the finger moves, or a tap told after the long press.
test('GE02 a still press becomes a long press on the clock, and is then no tap', () =>
  fixture(({ engine, scope, pad, input, finger }) => {
    const seen = [];
    createGestures({
      engine,
      scope,
      input,
      target: pad,
      onHold: at => seen.push(['hold', at.x]),
      onTap: () => seen.push(['tap'])
    });
    // The engine's clock is given the time of its source, in steps no longer than it takes; the first call starts it.
    let now = 0;
    const run = seconds => {
      for (const end = now + seconds; now < end - 1e-9; ) engine.advanceTime((now = Math.min(end, now + 0.1)));
    };
    engine.advanceTime(0);
    const press = finger(1, 20, 20, 0);
    run(0.3);
    assert.deepEqual(seen, []);
    run(0.3);
    assert.deepEqual(seen, [['hold', 20]]);
    press.up(20, 20, 700);
    assert.deepEqual(seen, [['hold', 20]], 'no tap after the long press');
    const moved = finger(1, 20, 20, 1000);
    moved.move(50, 20, 1050);
    run(1);
    moved.up(50, 20, 2000);
    assert.deepEqual(seen, [['hold', 20]], 'a moved contact never holds');
  }));

// Break caught: a drag that starts at once on a shaking finger, steps that do not add up, or a slow drag called a swipe.
test('GE03 a drag starts past the slop and reports its steps; a fast end is a swipe', () =>
  fixture(({ engine, scope, pad, input, finger }) => {
    const drags = [],
      swipes = [];
    createGestures({
      engine,
      scope,
      input,
      target: pad,
      onDrag: drag => drags.push([drag.phase, drag.dx, drag.totalX]),
      onSwipe: swipe => swipes.push([swipe.direction, Math.round(swipe.speed)])
    });
    const slow = finger(1, 10, 10, 0);
    slow.move(15, 10, 100);
    assert.deepEqual(drags, [], 'within the slop');
    slow.move(30, 10, 200);
    slow.move(40, 10, 400);
    slow.up(40, 10, 1400);
    assert.deepEqual(drags, [
      ['start', 20, 20],
      ['move', 10, 30],
      ['end', 0, 30]
    ]);
    assert.deepEqual(swipes, [], 'slow at the end: no swipe');
    drags.length = 0;
    const fast = finger(1, 100, 100, 5000);
    fast.move(100, 80, 5020);
    fast.move(100, 40, 5040);
    fast.up(100, 20, 5060);
    // 80 units in the last 60 ms.
    assert.deepEqual(swipes, [['up', 1333]]);
  }));

// Break caught: two fingers seen as two drags, or a pinch whose scale or turn is wrong.
test('GE04 two fingers are a pinch: how far apart against the start, and how far they turned', () =>
  fixture(({ engine, scope, pad, input, finger }) => {
    const pinches = [],
      drags = [];
    createGestures({
      engine,
      scope,
      input,
      target: pad,
      onPinch: pinch => pinches.push([pinch.phase, Number(pinch.scale.toFixed(3)), Number(pinch.rotation.toFixed(1))]),
      onDrag: drag => drags.push(drag.phase)
    });
    const a = finger(1, 50, 100, 0),
      b = finger(2, 150, 100, 10);
    b.move(250, 100, 20);
    a.move(150, 0, 30);
    b.up(250, 100, 40);
    a.up(150, 0, 50);
    assert.deepEqual(pinches, [
      ['start', 1, 0],
      ['move', 2, 0],
      ['move', 1.414, 45],
      ['end', 1.414, 45]
    ]);
    assert.deepEqual(drags, []);
  }));

// Break caught: a drop on the bag behind the slot, a drop of an empty slot, a ghost left behind, or a drop elsewhere
// that changes something.
test('GE05 drag and drop: a ghost follows, the innermost accepting target takes it, and elsewhere nothing happens', () =>
  fixture(({ engine, scope, input, finger }) => {
    const layer = scope.use(new DisplayObjectContainer());
    const box = (x, y, w, h, parent = engine.stage) => {
      const node = scope.use(new Sprite());
      node.graphics.beginFill(0xffffff).drawRect(0, 0, w, h).endFill();
      node.x = x;
      node.y = y;
      node.touchEnabled = true;
      parent.addChild(node);
      return node;
    };
    const item = box(300, 300, 40, 40),
      bag = box(0, 0, 200, 100),
      slot = box(20, 20, 40, 40, bag);
    engine.stage.addChild(layer);
    let carried = 'potion';
    const dropped = [],
      hovers = [];
    const dnd = createDragAndDrop({ engine, scope, input, layer });
    dnd.source({ node: item, data: () => carried, ghost: () => box(0, 0, 10, 10, layer) });
    dnd.target({ node: bag, drop: data => dropped.push(['bag', data]) });
    dnd.target({ node: slot, drop: data => dropped.push(['slot', data]), hover: (data, over) => hovers.push(over) });
    const drag = finger(1, 310, 310, 0);
    drag.move(200, 200, 50);
    assert.equal(dnd.dragging, 'potion');
    assert.equal(layer.numChildren, 1, 'the ghost follows');
    drag.move(40, 40, 100);
    assert.equal(layer.getChildAt(0).x, 40);
    drag.up(40, 40, 150);
    assert.deepEqual(dropped, [['slot', 'potion']], 'the slot, not the bag behind it');
    assert.deepEqual(hovers, [true, false]);
    assert.equal(layer.numChildren, 0, 'the ghost is gone');
    assert.equal(dnd.dragging, undefined);
    // Let go where no target is: nothing.
    const away = finger(1, 310, 310, 1000);
    away.move(390, 390, 1050);
    away.up(390, 390, 1100);
    assert.deepEqual(dropped, [['slot', 'potion']]);
    // Nothing to carry: no drag.
    carried = undefined;
    const empty = finger(1, 310, 310, 2000);
    empty.move(40, 40, 2050);
    assert.equal(dnd.dragging, undefined);
    empty.up(40, 40, 2100);
    assert.deepEqual(dropped, [['slot', 'potion']]);
  }));

// Break caught: options that cannot work accepted, or gestures still told after they were ended.
test('GE06 what is not a gesture is refused, and an ended one hears nothing', () =>
  fixture(({ engine, scope, pad, input, finger }) => {
    assert.throws(() => createGestures({ engine, scope, input, target: {} }), { code: 'GESTURE_OPTIONS_INVALID' });
    assert.throws(() => createGestures({ engine, scope, input, target: pad, slop: 0 }), {
      code: 'GESTURE_OPTIONS_INVALID'
    });
    assert.throws(() => createGestures({ engine, scope, input, target: pad, onTap: 'tap' }), {
      code: 'GESTURE_OPTIONS_INVALID'
    });
    const seen = [];
    const gestures = createGestures({ engine, scope, input, target: pad, onTap: () => seen.push('tap') });
    gestures.dispose();
    finger(1, 10, 10, 0).up(10, 10, 20);
    assert.deepEqual(seen, []);
  }));

// Break caught: a right click told as a tap, a drag or a long press; a moved or cancelled right press told as a
// secondary tap; the middle button making any gesture; the primary mouse button no longer tapping.
test('GE07 only the primary mouse button makes gestures; a still right press is a secondary tap', () =>
  fixture(({ engine, scope, pad, input, mouse }) => {
    const seen = [];
    createGestures({
      engine,
      scope,
      input,
      target: pad,
      onTap: at => seen.push(['tap', at.x]),
      onDoubleTap: () => seen.push(['double']),
      onHold: () => seen.push(['hold']),
      onDrag: drag => seen.push(['drag', drag.phase]),
      onSecondaryTap: at => seen.push(['secondary', at.x, at.y, at.localX])
    });
    let now = 0;
    const run = seconds => {
      for (const end = now + seconds; now < end - 1e-9; ) engine.advanceTime((now = Math.min(end, now + 0.1)));
    };
    engine.advanceTime(0);
    // A right press held past the long-press time and released where it began.
    const right = mouse(2, 30, 40, 0);
    run(0.8);
    right.up(31, 40, 800);
    assert.deepEqual(seen, [['secondary', 31, 40, 31]]);
    seen.length = 0;
    // Moved past the slop, or moved away and back, or cancelled: nothing at all.
    let press = mouse(2, 30, 40, 1000);
    press.move(80, 40, 1050);
    press.up(80, 40, 1100);
    press = mouse(2, 30, 40, 1200);
    press.move(80, 40, 1250);
    press.up(30, 40, 1300);
    mouse(2, 30, 40, 1400).cancel();
    // The middle button, still or dragged, is no gesture.
    mouse(4, 30, 40, 1500).up(30, 40, 1550);
    press = mouse(4, 30, 40, 1600);
    press.move(90, 40, 1650);
    press.up(90, 40, 1700);
    assert.deepEqual(seen, []);
    // Two right clicks close together are no double tap, and do not start one for a later left click.
    mouse(2, 30, 40, 2000).up(30, 40, 2040);
    mouse(1, 30, 40, 2100).up(30, 40, 2140);
    assert.deepEqual(seen, [
      ['secondary', 30, 40, 30],
      ['tap', 30]
    ]);
    seen.length = 0;
    // The primary button still taps and drags, also with the right button held as well.
    press = mouse(1, 30, 40, 3000);
    press.move(60, 40, 3050);
    press.up(60, 40, 3100);
    mouse(3, 30, 40, 3500).up(30, 40, 3540);
    assert.deepEqual(seen, [
      ['drag', 'start'],
      ['drag', 'end'],
      ['tap', 30]
    ]);
    assert.throws(
      () => createGestures({ engine, scope, input, target: pad, onSecondaryTap: 'erase' }),
      error => error?.code === 'GESTURE_OPTIONS_INVALID'
    );
  }));
