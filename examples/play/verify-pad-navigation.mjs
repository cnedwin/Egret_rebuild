// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { PNG } = createRequire(import.meta.url)('pngjs');

export async function verifyPadNavigation(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const semantics = createUiSemantics();
    const gameEdges = [];
    const actions = [];
    const index = { a: 0, b: 1, start: 9, up: 12, down: 13, left: 14, right: 15 };
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = {
      index: 0,
      id: 'Play UI standard test pad',
      connected: true,
      mapping: 'standard',
      buttons,
      axes: [0, 0, 0, 0]
    };
    const getGamepads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    let menu;
    let nested;
    let shell;
    let legacyModal;
    let round = 0;
    const id = name => name.replaceAll(' ', '');
    const view = (label, names, modal = false) => ({
      label,
      modal,
      root: {
        type: 'panel',
        x: 100,
        y: 100,
        width: 250,
        height: 164,
        layout: 'column',
        gap: 8,
        children: names.map(name => ({ type: 'button', name: id(name), text: name, height: 44 }))
      }
    });
    const game = await play({
      width: 540,
      height: 340,
      backend: 'webgl2',
      audio: false,
      semantics,
      setup(g) {
        round++;
        shell = g.show(view('Shell', ['Play button', 'Disabled button', 'Settings button']), {
          bind: {
            [id('Play button')]: { tap: () => actions.push('shell') },
            [id('Disabled button')]: { disabled: () => true, tap: () => actions.push('disabled') }
          }
        });
      },
      update(_dt, g) {
        for (const key of ['a', 'b', 'start', 'up', 'down', 'left', 'right'])
          if (g.keys.pressed('pad:' + key)) gameEdges.push(key);
        if (g.keys.pressed('pad:start')) openMenu(g);
        if (legacyModal !== undefined && g.keys.pressed('escape')) {
          legacyModal.close();
          legacyModal = undefined;
          actions.push('legacy-escape');
        }
      }
    });
    function openMenu(g) {
      if (g.paused) return;
      g.pause();
      function close(action) {
        actions.push(action);
        menu.close();
        g.resume();
      }
      menu = g.show(view('Paused', ['Resume button', 'Options button'], true), {
        dismiss: () => close('dismiss'),
        resume: () => close('start-resume'),
        bind: {
          [id('Resume button')]: { tap: () => close('focused-resume') },
          [id('Options button')]: { tap: () => actions.push('options') }
        }
      });
    }
    return {
      set(names) {
        for (const [key, at] of Object.entries(index)) {
          buttons[at].pressed = names.includes(key);
          buttons[at].value = buttons[at].pressed ? 1 : 0;
        }
      },
      focused() {
        const snapshot = semantics.publish();
        return snapshot.nodes.find(node => node.id === snapshot.focused)?.name;
      },
      outlineSample(name) {
        const rect = shell.rect(id(name));
        const screen = game.screen;
        return {
          x: (rect.x + rect.width / 2 - screen.x) / screen.width,
          y: (rect.y + 1 - screen.y) / screen.height
        };
      },
      inspect() {
        return { gameEdges, actions, paused: game.paused, round, device: game.device };
      },
      wake(keys) {
        game.browser.loop.stop();
        this.set(keys);
        game.browser.loop.start();
      },
      openMenu: () => openMenu(game),
      openNested() {
        nested = game.show(view('Nested', ['Nested button'], true), {
          bind: { [id('Nested button')]: { tap: () => actions.push('nested') } }
        });
      },
      closeNested: () => nested.close(),
      openLegacyModal() {
        legacyModal = game.show(view('Legacy dialog', ['Legacy action'], true));
      },
      confirm() {
        void game.confirm('Keep changes?').then(yes => actions.push('confirm:' + yes));
      },
      openLegacyMenu() {
        game.pause();
        void game.menu(['First', 'Second']).then(index => {
          actions.push('legacy:' + index);
          game.resume();
        });
      },
      optIn() {
        shell.close();
        shell = game.show(view('Opt-in', ['Pad button']), {
          gamepad: true,
          bind: { [id('Pad button')]: { tap: () => actions.push('opt-in') } }
        });
      },
      restart: () => game.restart(),
      async close() {
        try {
          await game.dispose();
        } finally {
          if (getGamepads === undefined) delete navigator.getGamepads;
          else Object.defineProperty(navigator, 'getGamepads', getGamepads);
        }
      }
    };
  });
  const frames = () =>
    page.evaluate(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    );
  const set = async (...keys) => {
    await fixture.evaluate((state, names) => state.set(names), keys);
    await frames();
  };
  const get = () => fixture.evaluate(f => f.inspect());
  const focused = () => fixture.evaluate(f => f.focused());
  const outlined = async name => {
    const target = await fixture.evaluate((f, label) => f.outlineSample(label), name);
    const image = PNG.sync.read(await page.locator('canvas').screenshot({ scale: 'css' }));
    const x = Math.floor(target.x * image.width);
    const y = Math.floor(target.y * image.height);
    for (let row = y - 1; row <= y + 1; row++)
      for (let column = x - 1; column <= x + 1; column++) {
        const at = (row * image.width + column) * 4;
        if ([34, 197, 94].every((value, channel) => Math.abs(image.data[at + channel] - value) <= 3))
          return true;
      }
    return false;
  };
  try {
    await page.keyboard.press('Tab');
    assert.equal(await focused(), 'Play button');
    assert.equal(await outlined('Play button'), true, 'the focused button paints the accent outline');
    await page.keyboard.press('Tab');
    assert.equal(await focused(), 'Settings button', 'Tab skips the disabled button');
    assert.equal(await outlined('Play button'), false, 'moving focus takes the old outline away');
    assert.equal(await outlined('Settings button'), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await focused(), 'Play button');
    await page.keyboard.press('Enter');
    assert.deepEqual((await get()).actions, ['shell']);
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    assert.deepEqual((await get()).actions, ['shell', 'shell'], 'Space activates once even when repeated');
    await set('a');
    assert.deepEqual((await get()).gameEdges, ['a'], 'a normal view preserves gameplay input');
    await set();
    await set('start');
    assert.equal((await get()).paused, true, 'the first Start reaches gameplay and opens the pause view');
    assert.equal(await focused(), 'Resume button');
    await set('start', 'down');
    assert.equal(await focused(), 'Options button', 'D-pad down moves focus inside the paused top view');
    await fixture.evaluate(f => f.wake(['start', 'a']));
    await frames();
    assert.deepEqual((await get()).actions, ['shell', 'shell', 'options'], 'the first sample after waking can activate a paused view');
    await frames();
    assert.deepEqual((await get()).actions, ['shell', 'shell', 'options'], 'held A does not reactivate and held Start does not resume');
    await set();
    await set('start');
    assert.equal((await get()).paused, false, 'the next Start resumes');
    assert.equal(await focused(), 'Play button', 'focus returns to the invoking view');
    await frames();
    assert.deepEqual((await get()).actions, ['shell', 'shell', 'options', 'start-resume']);
    assert.deepEqual((await get()).gameEdges, ['a', 'start'], 'resume and its held edge do not reopen the pause view');
    await set();

    await fixture.evaluate(f => f.openMenu());
    await fixture.evaluate(f => f.openNested());
    assert.equal(await focused(), 'Nested button');
    await set('a', 'b');
    assert.equal((await get()).paused, true, 'B cannot dismiss a covered modal');
    assert.equal((await get()).actions.at(-1), 'start-resume', 'simultaneous A cannot act after B claims the sample');
    await set();
    await set('a');
    assert.equal((await get()).actions.at(-1), 'nested');
    await set();
    await fixture.evaluate(f => f.closeNested());
    await page.keyboard.press('Escape');
    assert.equal((await get()).actions.at(-1), 'dismiss');
    assert.equal(await focused(), 'Play button');
    await fixture.evaluate(f => f.openMenu());
    await set('b');
    assert.equal((await get()).actions.at(-1), 'dismiss');
    assert.equal((await get()).paused, false);
    await set();

    await fixture.evaluate(f => f.openLegacyModal());
    assert.equal(await focused(), 'Legacy action');
    await page.keyboard.press('Escape');
    await frames();
    assert.equal((await get()).actions.at(-1), 'legacy-escape', 'a modal without dismiss leaves Escape to gameplay');
    assert.equal(await focused(), 'Play button');

    await fixture.evaluate(f => f.confirm());
    await frames();
    await set('left');
    assert.equal(await focused(), 'Cancel', 'D-pad changes the focused confirm action');
    await set('a');
    assert.equal((await get()).actions.at(-1), 'confirm:false', 'A activates the focused No action');
    await set();

    await fixture.evaluate(f => f.openLegacyMenu());
    await frames();
    await set('down');
    await set('a');
    assert.equal((await get()).actions.at(-1), 'legacy:1', 'the existing menu still reads its paused gamepad navigation');
    await set();

    await fixture.evaluate(f => f.optIn());
    await set('a');
    assert.equal((await get()).actions.at(-1), 'opt-in', 'an opted-in nonmodal view accepts the first A');
    await fixture.evaluate(f => f.restart());
    await frames();
    assert.deepEqual((await get()).gameEdges, ['a', 'start'], 'restart does not turn an already held UI key into a game edge');
    assert.equal((await get()).round, 2);
    await set();
    await set('a');
    assert.deepEqual((await get()).gameEdges, ['a', 'start', 'a']);
    return await get();
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}
