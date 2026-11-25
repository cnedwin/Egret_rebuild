// SPDX-License-Identifier: Apache-2.0
// The UI tester of @egret/engine/ui/testing finds controls by name in the semantic tree and drives them with the
// actions assistive technology reaches. These cases build a small tree by hand, as a screen does, and check what a
// query finds, what a press reaches, and what a failure says.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createUiScreenStack } from '@egret/engine/ui';
import { createUiTester } from '@egret/engine/ui/testing';

const box = { x: 0, y: 0, width: 10, height: 10 };
/** A shop with gold, a sound switch, a volume slider, two Buy buttons in two rows and a dialog when asked. */
function shop() {
  const state = { gold: 100, sound: true, volume: 40, bought: [], dialog: false, confirmed: 0, sold: false };
  const semantics = createUiSemantics();
  semantics.add({ id: 'shop', role: 'group', describe: () => ({ name: 'Shop', bounds: box }) });
  semantics.add({
    id: 'gold',
    role: 'text',
    parent: 'shop',
    describe: () => ({ name: 'Gold ' + state.gold, bounds: box })
  });
  semantics.add({
    id: 'sound',
    role: 'switch',
    parent: 'shop',
    describe: () => ({ name: 'Sound', bounds: box, checked: state.sound }),
    onActivate: () => (state.sound = !state.sound)
  });
  semantics.add({
    id: 'volume',
    role: 'slider',
    parent: 'shop',
    describe: () => ({ name: 'Volume', bounds: box, range: { now: state.volume, min: 0, max: 100 } }),
    onFocus: () => {}
  });
  for (const [row, item, price] of [
    ['sword', 'Sword', 60],
    ['shield', 'Shield', 150]
  ]) {
    semantics.add({ id: row, role: 'group', parent: 'shop', describe: () => ({ name: item, bounds: box }) });
    semantics.add({
      id: row + '-buy',
      role: 'button',
      parent: row,
      describe: () => ({ name: 'Buy', bounds: box, disabled: state.gold < price }),
      onActivate: () => {
        state.gold -= price;
        state.bought.push(item);
      }
    });
  }
  semantics.add({
    id: 'sell',
    role: 'button',
    parent: 'shop',
    describe: () => ({ name: 'Sell all', bounds: box }),
    onActivate: () => (state.dialog = true)
  });
  let dialog;
  const sync = () => {
    if (state.dialog && dialog === undefined) {
      dialog = semantics.add({
        id: 'ask',
        role: 'dialog',
        describe: () => ({ name: 'Sell everything?', bounds: box, modal: true })
      });
      semantics.add({
        id: 'yes',
        role: 'button',
        parent: 'ask',
        describe: () => ({ name: 'Yes', bounds: box }),
        onActivate: () => {
          state.confirmed++;
          state.dialog = false;
        }
      });
    }
    if (!state.dialog && dialog !== undefined) {
      dialog.remove();
      dialog = undefined;
    }
    semantics.publish();
  };
  return { state, semantics, sync };
}

// Break caught: a press that does not reach the function a tap reaches, or a check that reads a stale tree.
test('UT01 a control is found by its name and pressed, and the tree is read again after', () => {
  const { state, semantics, sync } = shop();
  const t = createUiTester({ semantics, update: sync });
  assert.equal(t.text('text:Gold 100'), 'Gold 100');
  assert.deepEqual(t.state('Sound').checked, true);
  t.press('Sound');
  assert.equal(state.sound, false);
  assert.equal(t.state('switch:Sound').checked, false);
  assert.equal(t.state('Volume').now, 40);
  t.focus('Volume');
  t.press('Sword / Buy');
  assert.deepEqual(state.bought, ['Sword']);
  assert.equal(t.text('Gold 40'), 'Gold 40');
});

// Break caught: a press on one of several buttons of the same name going to the first, or a failure that does not
// say what was there.
test('UT02 a name that matches several needs more; one that matches none says what the screen holds', () => {
  const { semantics, sync } = shop();
  const t = createUiTester({ semantics, update: sync });
  assert.throws(
    () => t.find('Buy'),
    error => {
      assert.equal(error.code, 'UI_TESTER_AMBIGUOUS');
      assert.match(error.message, /Buy names 2/);
      return true;
    }
  );
  assert.equal(t.find('Buy#1').id, 'shield-buy');
  assert.equal(t.find('Shield / button:Buy').id, 'shield-buy');
  assert.equal(t.findAll('button').length, 3);
  assert.equal(t.exists('Buy'), false);
  assert.equal(t.exists('Sell all'), true);
  assert.throws(
    () => t.press('Inventory'),
    error => {
      assert.equal(error.code, 'UI_TESTER_NOT_FOUND');
      // The outline is in the message: what the screen holds, indented under what it is in.
      assert.match(error.message, /group "Shop"\n {2}text "Gold 100"\n {2}switch "Sound" \[checked\]/);
      assert.match(error.message, /button "Buy" \[disabled\]/);
      return true;
    }
  );
  assert.throws(() => t.find(''), { code: 'UI_TESTER_QUERY_INVALID' });
});

// Break caught: a test pressing a disabled button and passing, or pressing a control behind a dialog.
test('UT03 a disabled control and one behind a dialog are refused', () => {
  const { state, semantics, sync } = shop();
  const t = createUiTester({ semantics, update: sync });
  assert.throws(
    () => t.press('Shield / Buy'),
    error => {
      assert.equal(error.code, 'UI_TESTER_REFUSED');
      assert.match(error.message, /it is disabled/);
      return true;
    }
  );
  t.press('Sell all');
  assert.equal(t.find('dialog').name, 'Sell everything?');
  assert.throws(() => t.press('Sound'), /a dialog is over it/);
  assert.equal(state.sound, true);
  t.press('Sell everything? / Yes');
  assert.equal(state.confirmed, 1);
  assert.equal(t.exists('dialog'), false);
  assert.throws(() => t.press('Volume'), /it has no activate action/);
});

// Break caught: time that does not move in a test, or a tester that cannot tell which screen is in front.
test('UT04 wait moves time with the game, and the screen stack is read and driven', async () => {
  const { state, semantics, sync } = shop();
  let seconds = 0;
  const screens = createUiScreenStack();
  void screens.open({ id: 'map', layer: 'page', open: () => ({}) });
  void screens.open({ id: 'shop', layer: 'page', open: () => ({}) });
  await new Promise(resolve => setTimeout(resolve, 0));
  const t = createUiTester({
    semantics,
    update: sync,
    screens,
    advance: step => {
      seconds += step;
      state.gold += Math.floor(step) * 10;
    }
  });
  await t.wait(3);
  assert.equal(seconds, 3);
  assert.equal(t.text('text'), 'Gold 130');
  assert.equal(t.screen, 'shop');
  assert.equal(await t.back(), true);
  assert.equal(t.screen, 'map');
  await assert.rejects(createUiTester({ semantics }).wait(1), { code: 'UI_TESTER_OPTIONS_INVALID' });
  assert.throws(() => createUiTester({}), { code: 'UI_TESTER_OPTIONS_INVALID' });
  assert.match(t.outline(), /^group "Shop"/);
});
