// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';

export async function verifyViewVisibility(page, backend = 'webgl2') {
  await page.setViewportSize({ width: 960, height: 540 });
  const fixture = await page.evaluateHandle(async backend => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const { createBrowserSemantics } = await import('/packages/engine/dist/web/semantics.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:10';
    document.body.append(host);
    const semantics = createUiSemantics();
    const tester = createUiTester({ semantics });
    const panel = (name, fields) => ({ type: 'panel', name, ...fields });
    const button = (name, text, fields = {}) => ({ type: 'button', name, text, ...fields });
    let view;
    let modal;
    const taps = { action: 0, backup: 0 };
    const game = await play({
      width: 960,
      height: 540,
      parent: host,
      backend,
      audio: false,
      semantics,
      setup(g) {
        view = g.show(
          {
            label: 'Shop',
            root: panel('shop', {
              children: [
                button('backup', 'Back', { x: 15, y: 15, width: 120, height: 42 }),
                panel('moving', {
                  x: 600,
                  y: 400,
                  width: 240,
                  height: 120,
                  children: [button('action', 'Buy', { x: 20, y: 30, width: 120, height: 42 })]
                })
              ]
            })
          },
          { bind: { action: { tap: () => taps.action++ }, backup: { tap: () => taps.backup++ } } }
        );
      }
    });
    const projection = createBrowserSemantics({ semantics, canvas: game.canvas, width: 960, height: 540 });
    const widget = { choice: -1 };
    return {
      game,
      view,
      tester,
      semantics,
      host,
      taps,
      projection,
      widget,
      openMenu() {
        void game.menu(['Continue']).then(choice => (widget.choice = choice));
      },
      open() {
        modal = game.show(
          {
            label: 'Confirm purchase',
            modal: true,
            root: panel('confirm', {
              width: 240,
              height: 100,
              anchor: 'center',
              children: [button('dismiss', 'Close', { width: 130, height: 40 })]
            })
          },
          { bind: { dismiss: { tap: () => modal.close() } } }
        );
      }
    };
  }, backend);
  try {
    const { id, bounds: base } = await fixture.evaluate(f => f.tester.find('button: Buy'));
    assert.deepEqual(base, { x: 620, y: 430, width: 120, height: 42 });
    const moved = await fixture.evaluate(f => {
      f.view.get('moving').x -= 75;
      return f.tester.find('button: Buy').bounds;
    });
    assert.deepEqual(moved, { x: 545, y: 430, width: 120, height: 42 });
    const partial = await fixture.evaluate(f => {
      const panel = f.view.get('moving');
      panel.scaleX = 1.5;
      panel.scaleY = 0.5;
      panel.clipRect = { x: 0, y: 0, width: 85, height: 54 };
      return f.tester.find('button: Buy').bounds;
    });
    assert.deepEqual(partial, { x: 555, y: 415, width: 97.5, height: 12 });
    const projected = await fixture.evaluate((f, id) => {
      const { x, y, width, height } = f.projection.elementOf(id).getBoundingClientRect();
      return { x, y, width, height };
    }, id);
    assert.deepEqual(projected, partial);
    await page.mouse.click(663, 423); // In the transformed button, but on the clipped right side.
    assert.deepEqual(await fixture.evaluate(f => f.taps), { action: 0, backup: 0 });
    await page.mouse.click(570, 420);
    await page.waitForFunction(async f => f.taps.action === 1, fixture);
    const announced = await fixture.evaluate((f, id) => {
      f.tester.focus('button: Buy');
      f.semantics.publish();
      return f.game.canvas.getAttribute('aria-activedescendant') === f.projection.elementOf(id).id;
    }, id);
    assert.equal(announced, true);
    await page.keyboard.press('Enter');
    await page.waitForFunction(async f => f.taps.action === 2, fixture);
    await fixture.evaluate(f => f.openMenu());
    await page.keyboard.press('Enter');
    await page.waitForFunction(f => f.widget.choice === 0 || f.taps.action > 2, fixture, { timeout: 2500 });
    const legacyMenu = await fixture.evaluate(f => ({ ...f.widget, underlyingTaps: f.taps.action }));
    assert.deepEqual(legacyMenu, { choice: 0, underlyingTaps: 2 });
    const modal = await fixture.evaluate(f => {
      f.open();
      const modalFocused = f.tester.find('button: Close').focused;
      f.tester.press('button: Close');
      const previousRestored = f.tester.find('button: Buy').focused;
      f.open();
      return { modalFocused, previousRestored };
    });
    assert.deepEqual(modal, { modalFocused: true, previousRestored: true });
    const clipped = await fixture.evaluate(f => {
      const moving = f.view.get('moving');
      moving.clipRect = { x: 0, y: 0, width: 240, height: 20 };
      const action = type => {
        try {
          f.tester[type]('button: Buy');
          return undefined;
        } catch (error) {
          return error.code;
        }
      };
      const result = {
        press: action('press'),
        focus: action('focus'),
        published: f.tester.exists('button: Buy')
      };
      f.tester.press('button: Close');
      return { ...result, focusAfterModal: f.tester.find('button: Back').focused };
    });
    assert.deepEqual(clipped, {
      press: 'UI_TESTER_NOT_FOUND',
      focus: 'UI_TESTER_NOT_FOUND',
      published: false,
      focusAfterModal: true
    });
    assert.equal(await fixture.evaluate((f, id) => f.projection.elementOf(id) === undefined, id), true);
    await page.mouse.click(570, 420);
    await page.keyboard.press('Enter');
    assert.equal((await fixture.evaluate(f => f.taps)).action, 2);
    return { backend, base, moved, partial, projected, announced, legacyMenu, modal, clipped };
  } finally {
    await fixture.evaluate(async f => {
      await f.game.dispose();
      f.projection.dispose();
      f.semantics.dispose();
      f.host.remove();
    });
    await fixture.dispose();
  }
}
