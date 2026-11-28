// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer } from '@egret/engine';
import { host } from './helpers.mjs';
const inputApi = await import('@egret/engine/input').catch(error => ({ missing: error.message }));
const ui = await import('@egret/engine/ui').catch(error => ({ missing: error.message }));
async function fixture(run, options = {}) {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  const scope = engine.createScope();
  const pad = new DisplayObjectContainer(),
    button = new DisplayObjectContainer(),
    child = new DisplayObjectContainer();
  // The pad occupies x 0..40 and the button x 60..100, so one sample selects one surface.
  for (const [node, x] of [
    [pad, 0],
    [button, 60]
  ]) {
    scope.use(node);
    node.x = x;
    node.hitArea = { x: 0, y: 0, width: 40, height: 40 };
    node.touchEnabled = true;
    engine.stage.addChild(node);
  }
  // A touch-enabled descendant makes the container's end a genuine bubbled event.
  scope.use(child);
  child.x = 0;
  child.y = 0;
  child.hitArea = { x: 0, y: 0, width: 20, height: 40 };
  child.touchEnabled = true;
  button.addChild(child);
  assert.equal(
    typeof inputApi.createPointerInput,
    'function',
    'M3_POINTER_FACTORY_MISSING: ' + (inputApi.missing ?? '')
  );
  assert.equal(typeof ui.createMovementControl, 'function', 'UI_CONTROLS_MISSING: ' + (ui.missing ?? ''));
  const input = inputApi.createPointerInput({
    engine,
    scope,
    width: 100,
    height: 100,
    capacity: 5,
    ...(options.onContact ? { onContact: options.onContact } : {})
  });
  let clock = 0;
  // The router rejects a sample older than its observation time, so every event advances the clock.
  const begin = (id, x, y) =>
    input.begin({ pointerId: id, pointerType: 'touch', globalX: x, globalY: y, buttons: 1, timestamp: ++clock * 10 });
  const move = (session, x, y) => input.move(session, { globalX: x, globalY: y, buttons: 1, timestamp: ++clock * 10 });
  const end = (session, x, y) => input.end(session, { globalX: x, globalY: y, buttons: 1, timestamp: ++clock * 10 });
  try {
    await run({ engine, scope, pad, button, child, input, begin, move, end });
  } finally {
    input.dispose();
    await engine.dispose();
  }
}
test('M3.4 movement control reports a bounded direction with a dead zone', async () =>
  fixture(({ pad, input, begin, move, end }) => {
    const values = [];
    const control = ui.createMovementControl({
      input,
      target: pad,
      radius: 20,
      deadZone: 5,
      onMovement: value => values.push({ ...value })
    });
    const first = begin(1, 20, 20);
    move(first, 22, 20);
    assert.deepEqual(control.value, { x: 0, y: 0 }, 'inside the dead zone the control reports rest');
    move(first, 40, 20);
    assert.deepEqual(control.value, { x: 1, y: 0 });
    move(first, 20, 40);
    assert.ok(
      Math.abs(control.value.y - 1) < 1e-9 && Math.abs(control.value.x) < 1e-9,
      'full deflection clamps to one'
    );
    move(first, 120, 20);
    assert.deepEqual(control.value, { x: 1, y: 0 }, 'a distance beyond the radius stays clamped');
    end(first, 120, 20);
    assert.deepEqual(control.value, { x: 0, y: 0 }, 'release always ends at rest');
    assert.equal(control.active, false);
    assert.ok(values.length >= 4 && values.at(-1).x === 0);
    control.dispose();
  }));
test('M3.4 movement control refuses a second contact instead of stealing it', async () =>
  fixture(({ pad, input, begin, move }) => {
    const control = ui.createMovementControl({ input, target: pad, radius: 20 });
    const first = begin(1, 20, 20);
    move(first, 30, 20);
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    // The second contact may not take over the movement the first one owns.
    const second = begin(2, 30, 20);
    move(second, 35, 20);
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    assert.equal(control.active, true);
    control.dispose();
  }));
test('M3.4 movement control ends at rest on cancel, disable and dispose', async () =>
  fixture(({ pad, input, begin, move }) => {
    let zeroes = 0;
    const control = ui.createMovementControl({
      input,
      target: pad,
      radius: 20,
      onMovement: value => {
        if (value.x === 0 && value.y === 0) zeroes += 1;
      }
    });
    const first = begin(1, 20, 20);
    move(first, 40, 20);
    input.cancel(first, 'viewport');
    assert.deepEqual(control.value, { x: 0, y: 0 });
    const held = begin(3, 20, 20);
    move(held, 40, 20);
    control.setEnabled(false);
    assert.deepEqual(control.value, { x: 0, y: 0 }, 'disabling a held control releases it');
    assert.equal(control.active, false);
    control.setEnabled(true);
    const again = begin(4, 20, 20);
    move(again, 40, 20);
    control.dispose();
    assert.deepEqual(control.value, { x: 0, y: 0 });
    assert.equal(control.active, false);
    assert.ok(zeroes >= 3);
  }));
test('M3.4 action control activates once per contact and never on cancel', async () =>
  fixture(({ button, input, begin, end }) => {
    let activations = 0;
    const control = ui.createActionControl({
      input,
      target: button,
      onActivate: () => {
        activations += 1;
      }
    });
    const first = begin(1, 70, 10);
    assert.equal(control.pressed, true);
    end(first, 70, 10);
    assert.equal(activations, 1);
    assert.equal(control.pressed, false);
    // A late end for a closed session must not fire a second activation.
    end(first, 70, 10);
    assert.equal(activations, 1);
    const cancelled = begin(2, 70, 10);
    input.cancel(cancelled, 'viewport');
    assert.equal(activations, 1, 'a cancelled contact does not activate');
    assert.equal(control.pressed, false);
    control.dispose();
  }));
test('M3.4 action control honours disabled state and scripted press/release', async () =>
  fixture(({ button, input, begin, end }) => {
    const control = ui.createActionControl({ input, target: button });
    control.setEnabled(false);
    const blocked = begin(1, 70, 10);
    end(blocked, 70, 10);
    assert.equal(control.activationCount, 0, 'a disabled control takes no activation from a contact');
    control.setEnabled(true);
    control.press();
    assert.equal(control.pressed, true);
    control.release();
    assert.equal(control.activationCount, 1);
    // A release without an outstanding press cannot double-fire.
    control.release();
    assert.equal(control.activationCount, 1);
    control.dispose();
  }));
test('M3.4 movement and action run at the same time from independent contacts', async () =>
  fixture(({ pad, button, input, begin, move, end }) => {
    const movement = ui.createMovementControl({ input, target: pad, radius: 20 });
    const action = ui.createActionControl({ input, target: button });
    const moving = begin(1, 20, 20);
    const pressing = begin(2, 70, 10);
    move(moving, 40, 20);
    assert.deepEqual(movement.value, { x: 1, y: 0 });
    assert.equal(action.pressed, true);
    end(pressing, 70, 10);
    assert.equal(action.activationCount, 1);
    assert.deepEqual(movement.value, { x: 1, y: 0 }, 'the action release does not disturb movement');
    end(moving, 40, 20);
    assert.deepEqual(movement.value, { x: 0, y: 0 });
    movement.dispose();
    action.dispose();
  }));

test('M3.4 a refused second contact cannot end the owning movement', async () =>
  fixture(({ pad, input, begin, move, end }) => {
    const control = ui.createMovementControl({ input, target: pad, radius: 20 });
    const first = begin(1, 20, 20);
    move(first, 30, 20);
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    const second = begin(2, 32, 20);
    end(second, 32, 20);
    assert.deepEqual(control.value, { x: 0.5, y: 0 }, 'ending the refused contact must not release the owner');
    assert.equal(control.active, true);
    const third = begin(3, 31, 20);
    input.cancel(third, 'owner');
    assert.deepEqual(control.value, { x: 0.5, y: 0 }, 'cancelling the refused contact must not release the owner');
    assert.equal(control.active, true);
    end(first, 30, 20);
    assert.deepEqual(control.value, { x: 0, y: 0 });
    control.dispose();
  }));
test('M3.4 a refused second contact cannot cancel the owning action', async () =>
  fixture(({ button, input, begin, end }) => {
    const control = ui.createActionControl({ input, target: button });
    const first = begin(1, 70, 10);
    assert.equal(control.pressed, true);
    const second = begin(2, 72, 10);
    input.cancel(second, 'owner');
    assert.equal(control.pressed, true, 'the refused contact cancelling must not clear the first press');
    assert.equal(control.activationCount, 0);
    end(first, 70, 10);
    assert.equal(control.activationCount, 1);
    control.dispose();
  }));
test('M3.4 controls release when their target stops receiving routed events', async () =>
  fixture(({ pad, button, child, input, begin, move }) => {
    const movement = ui.createMovementControl({ input, target: pad, radius: 20 });
    const action = ui.createActionControl({ input, target: button });
    const held = begin(1, 20, 20);
    move(held, 40, 20);
    const pressing = begin(2, 70, 10);
    assert.deepEqual(movement.value, { x: 1, y: 0 });
    assert.equal(action.pressed, true);
    // The router cancels both sessions but dispatches nothing to an invalid target.
    pad.touchEnabled = false;
    button.touchEnabled = false;
    child.touchEnabled = false;
    input.sync();
    assert.deepEqual(movement.value, { x: 0, y: 0 }, 'the movement must not stay deflected without its target');
    assert.equal(movement.active, false);
    assert.equal(action.pressed, false, 'the action must not stay pressed without its target');
    movement.dispose();
    action.dispose();
  }));
test('M3.4 disposal completes every unsubscribe even when a callback throws', async () =>
  fixture(({ pad, input, begin, move }) => {
    const control = ui.createMovementControl({
      input,
      target: pad,
      radius: 20,
      onMovement: value => {
        if (value.x === 0 && value.y === 0) throw new Error('release observer failed');
      }
    });
    const held = begin(1, 20, 20);
    move(held, 40, 20);
    assert.throws(() => control.dispose(), /release observer failed/);
    // The control is terminal and its subscriptions are gone: no further callback can arrive.
    const after = begin(2, 20, 20);
    move(after, 40, 20);
    assert.deepEqual(control.value, { x: 0, y: 0 }, 'a closed control stays at rest and receives no further movement');
    assert.equal(control.active, false);
    control.dispose();
  }));

test('M3.4 a terminal event routed away from the target retires the control', async () =>
  fixture(({ pad, button, input, begin, move, end }) => {
    const movement = ui.createMovementControl({ input, target: pad, radius: 20 });
    const action = ui.createActionControl({ input, target: button });
    const held = begin(1, 20, 20);
    move(held, 30, 20);
    assert.deepEqual(movement.value, { x: 0.5, y: 0 });
    const pressing = begin(2, 70, 10);
    assert.equal(action.pressed, true);
    // Releasing capture makes the later end land outside the target, so no target handler runs.
    assert.equal(input.releaseCapture(held), true);
    assert.equal(input.releaseCapture(pressing), true);
    end(held, 150, 150);
    end(pressing, 150, 150);
    assert.deepEqual(movement.value, { x: 0, y: 0 }, 'an end outside the target must still release the movement');
    assert.equal(movement.active, false);
    assert.equal(action.pressed, false, 'an end outside the target must clear the press');
    assert.equal(action.activationCount, 0, 'a redirected end must not activate the action');
    movement.dispose();
    action.dispose();
  }));
test('M3.4 a throwing creation observer cannot starve the terminal subscribers', async () => {
  let armed = false;
  await fixture(
    async ({ pad, input, begin, move }) => {
      const movement = ui.createMovementControl({ input, target: pad, radius: 20 });
      const held = begin(1, 20, 20);
      move(held, 30, 20);
      assert.deepEqual(movement.value, { x: 0.5, y: 0 });
      armed = true;
      // The channel reports the callback failure as its own error; the control release is the point.
      assert.throws(() => input.cancel(held, 'owner'), /POINTER_INPUT_CALLBACK_FAILED/);
      assert.deepEqual(
        movement.value,
        { x: 0, y: 0 },
        'the control must still be released when the creation observer throws'
      );
      assert.equal(movement.active, false);
      movement.dispose();
    },
    {
      onContact: notification => {
        if (armed && notification.kind === 'cancel') throw new Error('creation observer failed');
      }
    }
  );
});

test('M3.4 a bubbled end from an interactive descendant still activates once', async () =>
  fixture(({ button, child, input, begin, end }) => {
    const action = ui.createActionControl({ input, target: button });
    let bubbled = 0;
    button.on(input.events.end, () => {
      bubbled += 1;
    });
    // The pick lands on the child; the end bubbles to the action container.
    const pressing = begin(1, 70, 10);
    assert.equal(action.pressed, true);
    end(pressing, 70, 10);
    assert.equal(bubbled, 1, 'the container must observe a genuine bubbled end');
    assert.equal(action.activationCount, 1, 'a descendant end must activate exactly once');
    assert.equal(action.pressed, false);
    action.dispose();
    child.dispose?.();
  }));
test('M3.4 a throwing creation observer on end still releases the controls', async () => {
  let armed = false;
  await fixture(
    async ({ pad, input, begin, move, end }) => {
      const movement = ui.createMovementControl({ input, target: pad, radius: 20 });
      const held = begin(1, 20, 20);
      move(held, 30, 20);
      armed = true;
      assert.throws(() => end(held, 30, 20), /POINTER_INPUT_CALLBACK_FAILED/);
      assert.deepEqual(movement.value, { x: 0, y: 0 }, 'an end whose observer threw must still release the movement');
      assert.equal(movement.active, false);
      movement.dispose();
    },
    {
      onContact: notification => {
        if (armed && notification.kind === 'end') throw new Error('end observer failed');
      }
    }
  );
});

test('M3.4 late observers see the complete contact stream', async () =>
  fixture(({ pad, input, begin, move, end }) => {
    const kinds = [];
    const stop = input.observe(notification => kinds.push(notification.kind));
    const control = ui.createMovementControl({ input, target: pad, radius: 20 });
    const held = begin(1, 20, 20);
    move(held, 30, 20);
    end(held, 30, 20);
    assert.deepEqual(kinds, ['begin', 'move', 'end'], 'a late subscriber must observe begin, move and end');
    stop();
    control.dispose();
  }));
test('M3.4 a thrown undefined still fails closed and never activates', async () => {
  let armed = false;
  await fixture(
    async ({ button, input, begin, end }) => {
      const action = ui.createActionControl({ input, target: button });
      const pressing = begin(1, 70, 10);
      armed = true;
      // `throw undefined` is a throw; treating it as "no error" would leave input active.
      assert.throws(() => end(pressing, 70, 10));
      assert.equal(input.state, 'closed', 'a thrown undefined must close the channel like any other value');
      assert.equal(action.activationCount, 0, 'a failed dispatch must not activate');
      assert.equal(action.pressed, false);
      action.dispose();
    },
    {
      onContact: notification => {
        if (armed && notification.kind === 'end') throw undefined;
      }
    }
  );
});
test('M3.4 a stopped propagation before the control handler still retires it', async () =>
  fixture(({ engine, button, input, begin, end }) => {
    const action = ui.createActionControl({ input, target: button });
    // A capture listener on the stage stops the end before it reaches the action container.
    const stop = engine.stage.on(input.events.end, event => event.stopImmediatePropagation(), { capture: true });
    const pressing = begin(1, 70, 10);
    assert.equal(action.pressed, true);
    end(pressing, 70, 10);
    assert.equal(action.activationCount, 0, 'a stopped end must not activate');
    assert.equal(action.pressed, false, 'a stopped end must still retire the press');
    stop();
    action.dispose();
  }));

test('fixed movement uses the transformed target-local center immediately and keeps contact ownership', async () =>
  fixture(({ pad, button, input, begin, move, end }) => {
    button.x = 200;
    pad.x = 8;
    pad.y = 12;
    pad.scaleX = 2;
    pad.scaleY = 0.5;
    const point = (x, y) => {
      const p = pad.localToGlobal(x, y);
      return [p.x, p.y];
    };
    const center = { x: 20, y: 20 };
    const control = ui.createMovementControl({ input, target: pad, radius: 20, deadZone: 2, center });
    center.x = 30; // geometry is a value, not a borrowed mutable object
    const first = begin(1, ...point(30, 20));
    assert.deepEqual(control.value, { x: 0.5, y: 0 }, 'an off-center down starts moving without waiting for a move');
    const second = begin(2, ...point(5, 5));
    end(second, ...point(5, 5));
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    move(first, ...point(22, 20));
    assert.deepEqual(control.value, { x: 0, y: 0 });
    move(first, ...point(20, 60));
    assert.deepEqual(control.value, { x: 0, y: 1 }, 'captured contact outside the surface is clamped in local units');
    input.cancel(first, 'viewport');
    assert.deepEqual(control.value, { x: 0, y: 0 });
    assert.equal(control.active, false);
    control.dispose();
  }));

test('changing movement geometry is atomic, retires the old owner and allows a fresh down', async () =>
  fixture(({ pad, input, begin, move, end }) => {
    const control = ui.createMovementControl({ input, target: pad, radius: 20, deadZone: 2, center: { x: 10, y: 10 } });
    const first = begin(1, 20, 10);
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    assert.throws(() => control.setGeometry({ radius: 0 }), /UI_CONTROL_RADIUS/);
    assert.throws(() => control.setGeometry({ radius: 20, center: { x: Infinity, y: 0 } }), /UI_CONTROL_OPTIONS/);
    assert.equal(control.active, true);
    control.setGeometry({ radius: 20, deadZone: 2, center: { x: 10, y: 10 } });
    assert.equal(control.active, true, 'unchanged geometry does not interrupt a held control');
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    control.setGeometry({ radius: 10, center: { x: 20, y: 20 } });
    assert.equal(control.active, false);
    assert.deepEqual(control.value, { x: 0, y: 0 });
    move(first, 30, 10);
    assert.deepEqual(control.value, { x: 0, y: 0 }, 'an old move cannot re-arm the stick');
    const second = begin(2, 25, 20);
    assert.deepEqual(control.value, { x: 0.5, y: 0 });
    end(first, 25, 20);
    assert.equal(control.active, true, 'an old terminal cannot release a new owner');
    control.setGeometry({ radius: 10 }); // no center means the original contact-relative mode
    assert.deepEqual(control.value, { x: 0, y: 0 });
    end(second, 25, 20);
    pad.scaleX = 2;
    const third = begin(3, 10, 20);
    assert.deepEqual(control.value, { x: 0, y: 0 });
    move(third, 15, 20);
    assert.deepEqual(control.value, { x: 0.5, y: 0 }, 'the original mode still uses stage units on a scaled target');
    end(third, 15, 20);
    control.dispose();
    assert.throws(() => control.setGeometry({ radius: 10 }), /UI_CONTROL_CLOSED/);
  }));

test('action releaseInside checks the target-local hit area without releasing captured ownership early', async () =>
  fixture(({ button, input, begin, move, end }) => {
    button.x = 50;
    button.scaleX = 0.5;
    const pressed = [];
    const action = ui.createActionControl({
      input,
      target: button,
      activation: 'releaseInside',
      onPressChange: value => pressed.push(value)
    });
    const first = begin(1, 55, 10);
    move(first, 95, 10);
    assert.equal(action.pressed, true);
    const second = begin(2, 60, 10);
    input.cancel(second, 'viewport');
    assert.equal(action.pressed, true);
    end(first, 70, 10); // local x 40 is the exclusive right edge
    assert.equal(action.activationCount, 0);
    assert.deepEqual(pressed, [true, false]);
    const third = begin(3, 60, 10);
    move(third, 95, 10);
    end(third, 50, 0); // inclusive left/top edge after re-entry
    assert.equal(action.activationCount, 1);
    const fourth = begin(4, 60, 10);
    button.hitArea = { x: 0, y: 0, width: 10, height: 40 };
    end(fourth, 60, 10);
    assert.equal(action.activationCount, 1, 'release checks the current authored hit area');
    action.press();
    action.release();
    assert.equal(action.activationCount, 2, 'scripted activation is independent of pointer geometry');
    action.dispose();
  }));

test('tap activation checks the largest excursion including the final sample and rejects swipes that return', async () =>
  fixture(({ button, input, begin, move, end }) => {
    const action = ui.createActionControl({ input, target: button, activation: 'tap', tapTolerance: 6 });
    let owner = begin(1, 75, 20);
    move(owner, 81, 20);
    move(owner, 75, 20);
    end(owner, 75, 20);
    assert.equal(action.activationCount, 1, 'the threshold is inclusive');
    owner = begin(1, 75, 20);
    move(owner, 82, 20);
    move(owner, 75, 20);
    end(owner, 75, 20);
    assert.equal(action.activationCount, 1, 'a swipe that returns does not become a tap again');
    owner = begin(1, 75, 20);
    end(owner, 82, 20);
    assert.equal(action.activationCount, 1, 'the terminal sample must also be inside the tolerance');
    owner = begin(1, 99, 20);
    end(owner, 100, 20);
    assert.equal(action.activationCount, 1, 'inside tolerance but outside target is not a tap');
    owner = begin(1, 75, 20);
    input.cancel(owner, 'viewport');
    assert.equal(action.pressed, false);
    assert.equal(action.activationCount, 1);
    action.dispose();
    const defaultTap = ui.createActionControl({ input, target: button, activation: 'tap' });
    owner = begin(2, 75, 20);
    end(owner, 87, 20);
    assert.equal(defaultTap.activationCount, 1, 'default tolerance is 12 stage units');
    owner = begin(2, 75, 20);
    end(owner, 88, 20);
    assert.equal(defaultTap.activationCount, 1);
    defaultTap.dispose();
  }));

test('capturedRelease remains the default, including a captured release beyond the surface', async () =>
  fixture(({ button, input, begin, move, end }) => {
    for (const options of [{}, { activation: 'capturedRelease' }]) {
      const action = ui.createActionControl({ input, target: button, ...options });
      const owner = begin(1, 75, 20);
      move(owner, 20, 90);
      end(owner, 20, 90);
      assert.equal(action.activationCount, 1);
      action.dispose();
    }
  }));

test('new control geometry and activation options reject invalid values at creation', async () =>
  fixture(({ pad, button, input, begin, end }) => {
    for (const center of [null, { x: NaN, y: 0 }, { x: 1 }]) {
      assert.throws(() => ui.createMovementControl({ input, target: pad, radius: 20, center }), /UI_CONTROL_OPTIONS/);
    }
    for (const options of [
      { activation: 'unknown' },
      { activation: null },
      { activation: 'tap', tapTolerance: -1 },
      { activation: 'tap', tapTolerance: Infinity },
      { tapTolerance: 10 }
    ]) {
      assert.throws(() => ui.createActionControl({ input, target: button, ...options }), /UI_CONTROL_OPTIONS/);
    }
    const action = ui.createActionControl({ input, target: button });
    const owner = begin(1, 75, 20);
    end(owner, 75, 20);
    assert.equal(action.activationCount, 1);
    action.dispose();
  }));

test('tap observes excursions even if a move does not reach the action target', async () =>
  fixture(({ engine, button, input, begin, move, end }) => {
    const action = ui.createActionControl({ input, target: button, activation: 'tap' });
    const owner = begin(1, 75, 20);
    const stop = engine.stage.on(input.events.move, event => event.stopImmediatePropagation(), { capture: true });
    move(owner, 20, 20);
    stop();
    end(owner, 75, 20);
    assert.equal(action.activationCount, 0);
    assert.equal(action.pressed, false);
    action.dispose();
  }));

test('local coordinate policies safely retire a singular target or refuse a missing hit area', async () =>
  fixture(({ pad, button, input, begin, move, end }) => {
    const control = ui.createMovementControl({ input, target: pad, radius: 20, center: { x: 20, y: 20 } });
    const held = begin(1, 30, 20);
    pad.scaleX = 0;
    move(held, 32, 20);
    assert.equal(control.active, false);
    assert.deepEqual(control.value, { x: 0, y: 0 });
    assert.notEqual(input.state, 'closed', 'a singular animated target does not close the input channel');
    end(held, 32, 20);
    control.dispose();
    const action = ui.createActionControl({ input, target: button, activation: 'releaseInside' });
    const heldAction = begin(2, 75, 20);
    button.scaleX = 0;
    end(heldAction, 75, 20);
    assert.equal(action.pressed, false);
    assert.equal(action.activationCount, 0);
    assert.notEqual(input.state, 'closed');
    button.scaleX = 1;
    button.hitArea = undefined;
    const childPress = begin(3, 65, 20);
    assert.equal(action.pressed, true, 'a descendant can still route a press to the container');
    end(childPress, 65, 20);
    assert.equal(action.pressed, false);
    assert.equal(action.activationCount, 0, 'inside policies require an authored target hit rectangle');
    action.dispose();
  }));
