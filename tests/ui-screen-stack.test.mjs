// SPDX-License-Identifier: Apache-2.0
// The screen stack of @egret/engine/ui: pages that cover each other, popups and one modal at a time, the order screens
// are told things in, what a screen gives back, the back key, and what happens when a screen fails. It draws nothing,
// so these are the whole of its behaviour; screens that draw are checked with them in the screens' own tests.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createUiScreenStack } from '@egret/engine/ui';

/** A screen whose handle writes each call into `log` as "id:call". */
function screen(id, layer, extra = {}) {
  return {
    id,
    layer,
    ...extra,
    open(context) {
      const made = extra.make?.(context);
      const log = extra.log;
      const note = name => () => log?.push(id + ':' + name);
      return (
        made ?? {
          show: note('show'),
          hide: note('hide'),
          cover: note('cover'),
          reveal: note('reveal'),
          activate: note('activate'),
          deactivate: note('deactivate'),
          close: note('close')
        }
      );
    }
  };
}
const settled = () => new Promise(resolve => setTimeout(resolve, 0));

// Break caught: a page left drawn under a full-screen page, the wrong screen taking input, or the back key closing
// the page a game starts from.
test('SS01 pages cover the pages under them, and the back key closes the top one but not the first', async () => {
  const log = [];
  const stack = createUiScreenStack();
  const home = screen('home', 'page', { log }),
    shop = screen('shop', 'page', { log }),
    hint = screen('hint', 'page', { log, fullScreen: false });
  void stack.open(home);
  void stack.open(shop);
  await settled();
  assert.deepEqual(log, ['home:show', 'home:activate', 'shop:show', 'home:cover', 'home:deactivate', 'shop:activate']);
  assert.deepEqual(stack.snapshot(), {
    state: 'open',
    pages: ['home', 'shop'],
    popups: [],
    modal: undefined,
    waiting: [],
    active: 'shop',
    covered: ['home']
  });
  // A page that is not full-screen leaves the one under it drawn.
  void stack.open(hint);
  await settled();
  assert.deepEqual(stack.snapshot().covered, ['home']);
  log.length = 0;
  assert.equal(await stack.back(), true);
  assert.equal(await stack.back(), true);
  assert.deepEqual(log, [
    'hint:deactivate',
    'hint:hide',
    'hint:close',
    'shop:activate',
    'shop:deactivate',
    'shop:hide',
    'shop:close',
    'home:reveal',
    'home:activate'
  ]);
  assert.equal(await stack.back(), false, 'the first page stays');
  assert.equal(stack.active, home);
});

// Break caught: a dialog that cannot say which choice was made, or a request it started going on after it closed.
test('SS02 a screen gives back what it closes with, and its signal ends when it closes', async () => {
  const stack = createUiScreenStack();
  let context;
  const pick = screen('pick', 'popup', {
    make(given) {
      context = given;
      return {};
    }
  });
  void stack.open(screen('home', 'page'));
  const chosen = stack.open(pick, { slot: 'weapon' });
  await settled();
  assert.deepEqual(context.params, { slot: 'weapon' });
  assert.equal(context.active, true);
  assert.equal(context.signal.aborted, false);
  context.close('sword');
  assert.equal(await chosen, 'sword');
  assert.equal(context.signal.aborted, true);
  assert.equal(stack.isOpen(pick), false);
  // Closed by the back key, it gives back nothing.
  const again = stack.open(pick, { slot: 'ring' });
  await settled();
  await stack.back();
  assert.equal(await again, undefined);
  // Closed by name with a result.
  const third = stack.open(pick);
  await stack.close(pick, 'shield');
  assert.equal(await third, 'shield');
});

// Break caught: two dialogs over each other, or a dialog asked for later lost.
test('SS03 one modal is shown at a time; the others wait their turn', async () => {
  const log = [];
  const stack = createUiScreenStack();
  const first = screen('first', 'modal', { log }),
    second = screen('second', 'modal', { log }),
    third = screen('third', 'modal', { log });
  void stack.open(screen('home', 'page'));
  const a = stack.open(first),
    b = stack.open(second),
    c = stack.open(third);
  await settled();
  assert.equal(stack.snapshot().modal, 'first');
  assert.deepEqual(stack.snapshot().waiting, ['second', 'third']);
  // A waiting modal closed by name is never made.
  await stack.close(third, 'skipped');
  assert.equal(await c, 'skipped');
  await stack.close(first, 1);
  assert.equal(await a, 1);
  await settled();
  assert.equal(stack.snapshot().modal, 'second');
  assert.equal(stack.active, second);
  await stack.close(second, 2);
  assert.equal(await b, 2);
  assert.deepEqual(
    log.filter(entry => entry.startsWith('third')),
    []
  );
});

// Break caught: the same reward shown twice from a double tap, or a second open with other parameters lost in silence.
test('SS04 opening an open screen gives the same promise; with other parameters it is refused', async () => {
  const stack = createUiScreenStack();
  const reward = screen('reward', 'popup');
  const once = stack.open(reward, { gold: 10, items: ['a', 'b'] });
  assert.equal(stack.open(reward, { items: ['a', 'b'], gold: 10 }), once, 'equal parameters, whatever their order');
  assert.throws(() => stack.open(reward, { gold: 20 }), { code: 'UI_SCREENS_ALREADY_OPEN' });
  // Another definition with the same id is another screen of that name, also refused.
  assert.throws(() => stack.open(screen('reward', 'popup'), { gold: 10, items: ['a', 'b'] }), {
    code: 'UI_SCREENS_ALREADY_OPEN'
  });
  await stack.close(reward);
  assert.equal(await once, undefined);
});

// Break caught: a back key that closes a screen that asked to stay, popTo closing the screen it names, or replace
// leaving the old page under the new one.
test('SS05 back, popTo, replace and closeAll do what they say', async () => {
  const stack = createUiScreenStack();
  let asked = 0;
  const home = screen('home', 'page'),
    map = screen('map', 'page'),
    battle = screen('battle', 'page', { back: 'none' }),
    menu = screen('menu', 'popup', { back: () => asked++ }),
    tip = screen('tip', 'popup');
  void stack.open(home);
  void stack.open(map);
  void stack.open(battle);
  void stack.open(menu);
  await settled();
  assert.equal(await stack.back(), true);
  assert.equal(asked, 1, 'the popup asked to be told');
  assert.equal(stack.isOpen(menu), true);
  await stack.close(menu);
  assert.equal(await stack.back(), false, 'the battle asked to stay');
  await stack.popTo(map);
  assert.deepEqual(stack.snapshot().pages, ['home', 'map']);
  const shop = screen('shop', 'page');
  void stack.replace(shop);
  await settled();
  assert.deepEqual(stack.snapshot().pages, ['home', 'shop']);
  void stack.open(menu);
  void stack.open(tip);
  await settled();
  await stack.closeAll('popup');
  assert.deepEqual(stack.snapshot().popups, []);
  assert.equal(stack.active, shop);
  await stack.closeAll();
  assert.deepEqual(stack.snapshot().pages, []);
  assert.equal(stack.active, undefined);
});

// Break caught: a screen that failed to be made left half open, or a handle that threw leaving the stack stuck.
test('SS06 a screen that fails to be made is not kept; a handle that throws does not stop the stack', async () => {
  const told = [];
  const stack = createUiScreenStack({ onError: cause => told.push(cause.message) });
  const broken = screen('broken', 'popup', {
    make() {
      throw new Error('no art');
    }
  });
  void stack.open(screen('home', 'page'));
  await assert.rejects(stack.open(broken), /no art/);
  assert.equal(stack.isOpen(broken), false);
  assert.equal(stack.active?.id, 'home');
  const clumsy = screen('clumsy', 'popup', {
    make: () => ({
      hide() {
        throw new Error('hide failed');
      },
      close() {
        throw new Error('close failed');
      }
    })
  });
  const result = stack.open(clumsy);
  await settled();
  // The first failure goes to the caller, the rest to onError, and the screen is closed all the same.
  await assert.rejects(stack.close(clumsy, 'done'), /hide failed/);
  assert.deepEqual(told, ['close failed']);
  assert.equal(await result, 'done');
  assert.equal(stack.isOpen(clumsy), false);
  assert.equal(stack.active?.id, 'home');
});

// Break caught: a screen closed while it is still loading appearing afterwards, or two calls interleaving.
test('SS07 calls wait for the ones before; a screen closed while it is made closes once it is made', async () => {
  const log = [];
  const stack = createUiScreenStack();
  let finish;
  const slow = screen('slow', 'page', {
    make: () =>
      new Promise(resolve => {
        finish = () => resolve({ show: () => log.push('slow:show'), close: () => log.push('slow:close') });
      })
  });
  const result = stack.open(slow);
  await settled();
  const closing = stack.close(slow, 'early');
  const next = stack.open(screen('next', 'page', { log }));
  await settled();
  assert.deepEqual(log, [], 'nothing runs before the slow screen is made');
  finish();
  await closing;
  assert.equal(await result, 'early');
  await settled();
  assert.deepEqual(log.slice(0, 3), ['slow:show', 'slow:close', 'next:show']);
  void next;
});

// Break caught: a definition without a layer or open accepted, a stack that grows without bound, or calls after
// dispose doing anything.
test('SS08 what is not a screen is refused, a full stack refuses more, and a disposed stack refuses all', async () => {
  const stack = createUiScreenStack({ maxScreens: 2 });
  for (const bad of [
    null,
    { id: 'x', layer: 'page' },
    { id: '', layer: 'page', open() {} },
    { id: 'x', layer: 'hud', open() {} },
    { id: 'x', layer: 'page', back: 'maybe', open() {} }
  ])
    assert.throws(() => stack.open(bad), { code: 'UI_SCREENS_DEFINITION_INVALID' });
  assert.throws(() => createUiScreenStack({ maxScreens: 0 }), { code: 'UI_SCREENS_OPTIONS_INVALID' });
  void stack.open(screen('a', 'page'));
  void stack.open(screen('b', 'page'));
  assert.throws(() => stack.open(screen('c', 'page')), { code: 'UI_SCREENS_FULL' });
  const changes = [];
  stack.onChange(snapshot => changes.push(snapshot.pages.length));
  await stack.dispose();
  assert.equal(stack.snapshot().state, 'closed');
  assert.deepEqual(stack.snapshot().pages, []);
  assert.throws(() => stack.open(screen('d', 'page')), { code: 'UI_SCREENS_CLOSED' });
  assert.ok(changes.length > 0);
});
