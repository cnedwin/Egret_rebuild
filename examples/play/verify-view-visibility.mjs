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
    // The modal background accepts pointer input, but it is not a choice in the modal's navigation.
    const focusTaps = { first: 0, second: 0, paper: 0, legacy: 0, nested: 0, deep: 0 };
    const makeFocusView = ({ initialFocus = 'second', unavailable, invalid, nonmodal = false } = {}) => {
      const description = {
        label: 'Focus picker',
        modal: !nonmodal,
        root: panel('picker', {
          width: 420,
          height: 245,
          anchor: 'center',
          children: [
            panel('paper', {
              label: 'Pointer paper',
              x: 0,
              y: 0,
              width: 420,
              height: 245,
              children: [
                button('first', 'First choice', { x: 30, y: 24, width: 145, height: 45 }),
                button('second', 'Second choice', {
                  x: unavailable === 'offscreen' ? 900 : 195,
                  y: 24,
                  width: 145,
                  height: 45
                }),
                panel('legacy', { label: 'Legacy action', x: 30, y: 100, width: 145, height: 45 }),
                { type: 'text', name: 'note', text: 'A note', x: 30, y: 162, width: 145, height: 30 }
              ]
            })
          ]
        })
      };
      const bind = {
        paper: { pointerOnly: true, tap: () => focusTaps.paper++ },
        first: { tap: () => focusTaps.first++ },
        second: {
          visible: () => unavailable !== 'hidden',
          disabled: () => unavailable === 'disabled',
          tap: () => focusTaps.second++
        },
        legacy: { tap: () => focusTaps.legacy++ }
      };
      if (invalid === 'button') bind.first.pointerOnly = true;
      if (invalid === 'without-tap') delete bind.paper.tap;
      if (invalid === 'nonboolean') bind.paper.pointerOnly = 'true';
      return game.show(description, { initialFocus, bind });
    };
    const refuse = perform => {
      try {
        perform();
        return undefined;
      } catch (error) {
        return error.code;
      }
    };
    const pagePoint = (x, y) => {
      const box = game.canvas.getBoundingClientRect(),
        screen = game.screen;
      return {
        x: box.left + ((x - screen.x) * box.width) / screen.width,
        y: box.top + ((y - screen.y) * box.height) / screen.height
      };
    };
    return {
      game,
      view,
      tester,
      semantics,
      host,
      taps,
      projection,
      widget,
      focusTaps,
      showFocus(options) {
        this.focusView = makeFocusView(options);
      },
      invalidFocus(options) {
        return refuse(() => makeFocusView(options).close());
      },
      refusedTest(action, name) {
        return refuse(() => tester[action](name));
      },
      unknownViewName() {
        return refuse(() => this.focusView.focus('unknown-name'));
      },
      focusSnapshot() {
        const node = tester.find('button: Second choice');
        semantics.publish();
        return {
          focus: this.focusView.focused,
          semanticFocus: node.focused,
          projected: game.canvas.getAttribute('aria-activedescendant') === projection.elementOf(node.id)?.id
        };
      },
      blankPaperPoint() {
        const rect = this.focusView.rect('paper');
        return pagePoint(rect.x + rect.width * 0.85, rect.y + rect.height * 0.86);
      },
      showNested() {
        this.nestedView = game.show(
          {
            label: 'Nested dialog',
            modal: true,
            root: panel('nested', {
              width: 330,
              height: 140,
              anchor: 'center',
              children: [
                button('nestedFirst', 'Stay', { x: 14, y: 14, width: 125, height: 45 }),
                button('nestedSecond', 'Return', { x: 160, y: 14, width: 125, height: 45 })
              ]
            })
          },
          {
            initialFocus: 'nestedSecond',
            bind: { nestedSecond: { tap: () => focusTaps.nested++ } }
          }
        );
      },
      showScroll() {
        this.scrollView = game.show(
          {
            label: 'Scroll and focus',
            modal: true,
            root: panel('list', {
              width: 225,
              height: 106,
              anchor: 'center',
              layout: 'column',
              scroll: 'vertical',
              gap: 8,
              children: [
                button('near', 'First in list', { height: 44 }),
                { type: 'space', height: 120 },
                button('deep', 'Last in list', { height: 44 })
              ]
            })
          },
          { initialFocus: 'deep', bind: { deep: { tap: () => focusTaps.deep++ } } }
        );
      },
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

    // Opening a modal with named initial focus must skip its pointer-only paper and other earlier choices.
    await fixture.evaluate(f => {
      f.tester.focus('button: Back');
      f.showFocus();
    });
    const initialFocus = await fixture.evaluate(f => f.focusSnapshot());
    assert.deepEqual(initialFocus, { focus: 'second', semanticFocus: true, projected: true });
    const pointerSemantics = await fixture.evaluate(f => {
      const paper = f.tester.find('group: Pointer paper');
      const choice = f.tester.find('button: Second choice');
      return {
        childRemains: choice.parent === paper.id,
        actions: paper.actions,
        press: f.refusedTest('press', 'group: Pointer paper'),
        focus: f.refusedTest('focus', 'group: Pointer paper'),
        programmatic: f.focusView.focus('paper'),
        unchanged: f.focusView.focused
      };
    });
    assert.deepEqual(pointerSemantics, {
      childRemains: true,
      actions: [],
      press: 'UI_TESTER_REFUSED',
      focus: 'UI_TESTER_REFUSED',
      programmatic: false,
      unchanged: 'second'
    });
    assert.equal(await fixture.evaluate(f => f.unknownViewName()), 'UI_VIEW_NAME_UNKNOWN');

    const frames = () =>
      page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    let point = await fixture.evaluate(f => f.blankPaperPoint());
    await page.mouse.click(point.x, point.y);
    await frames();
    assert.equal(await fixture.evaluate(f => f.focusTaps.paper), 1);
    assert.equal(await fixture.evaluate(f => f.focusView.focused), 'second');
    await page.keyboard.press('Enter');
    await frames();
    assert.deepEqual(await fixture.evaluate(f => f.focusTaps), {
      first: 0,
      second: 1,
      paper: 1,
      legacy: 0,
      nested: 0,
      deep: 0
    });

    // The legacy tappable panel remains keyboard accessible, while Tab passes over the pointer-only paper.
    assert.equal(await fixture.evaluate(f => f.focusView.focus('first')), true);
    await page.keyboard.press('Shift+Tab');
    await frames();
    assert.equal(await fixture.evaluate(f => f.focusView.focused), 'legacy');
    await page.keyboard.press('Enter');
    await frames();
    assert.equal(await fixture.evaluate(f => f.focusTaps.legacy), 1);
    await page.keyboard.press('Tab');
    await frames();
    assert.equal(await fixture.evaluate(f => f.focusView.focused), 'first');
    assert.equal(await fixture.evaluate(f => f.tester.find('group: Legacy action').actions.includes('activate')), true);

    // Resize into a new canvas fit and tap the panel with a touch through the browser's native input protocol.
    assert.equal(await fixture.evaluate(f => f.focusView.focus('second')), true);
    await page.setViewportSize({ width: 800, height: 450 });
    await frames();
    point = await fixture.evaluate(f => f.blankPaperPoint());
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await frames();
    } finally {
      await cdp.detach();
    }
    assert.equal(await fixture.evaluate(f => f.focusTaps.paper), 2);
    assert.deepEqual(await fixture.evaluate(f => f.focusSnapshot()), initialFocus);

    const nesting = await fixture.evaluate(f => {
      f.showNested();
      const above = f.nestedView.focused,
        covered = f.focusView.focused,
        refused = f.focusView.focus('first');
      f.nestedView.close();
      const restored = f.focusView.focused;
      f.focusView.close();
      return {
        above,
        covered,
        refused,
        restored,
        closed: f.focusView.focused,
        cannotFocusClosed: f.focusView.focus('second'),
        backRestored: f.tester.find('button: Back').focused
      };
    });
    assert.deepEqual(nesting, {
      above: 'nestedSecond',
      covered: undefined,
      refused: false,
      restored: 'second',
      closed: undefined,
      cannotFocusClosed: false,
      backRestored: true
    });

    const invalid = await fixture.evaluate(f => [
      f.invalidFocus({ initialFocus: 'unknown' }),
      f.invalidFocus({ initialFocus: 'note' }),
      f.invalidFocus({ initialFocus: 'paper' }),
      f.invalidFocus({ nonmodal: true }),
      f.invalidFocus({ invalid: 'button' }),
      f.invalidFocus({ invalid: 'without-tap' }),
      f.invalidFocus({ invalid: 'nonboolean' })
    ]);
    assert.deepEqual(
      invalid,
      Array.from({ length: 7 }, () => 'UI_VIEW_BINDING_INVALID')
    );
    assert.equal(
      await fixture.evaluate(f => f.tester.find('button: Back').focused),
      true,
      'refused views do not consume the previous focus'
    );

    const fallbacks = await fixture.evaluate(f =>
      ['hidden', 'disabled', 'offscreen'].map(unavailable => {
        f.showFocus({ unavailable });
        const result = { unavailable, focus: f.focusView.focused, secondFocus: f.focusView.focus('second') };
        f.focusView.close();
        return result;
      })
    );
    assert.deepEqual(
      fallbacks,
      ['hidden', 'disabled', 'offscreen'].map(unavailable => ({
        unavailable,
        focus: 'first',
        secondFocus: false
      }))
    );

    const scrollFocus = await fixture.evaluate(f => {
      f.showScroll();
      const initial = f.scrollView.focused;
      const revealed = f.scrollView.scroll('list').offset;
      const semantic = f.tester.find('button: Last in list').focused;
      const canReturn = f.scrollView.focus('near');
      const returned = f.scrollView.scroll('list').offset;
      const canRevealAgain = f.scrollView.focus('deep');
      return { initial, revealed, semantic, canReturn, returned, canRevealAgain, focused: f.scrollView.focused };
    });
    assert.equal(scrollFocus.initial, 'deep');
    assert.ok(scrollFocus.revealed > 0);
    assert.equal(scrollFocus.semantic, true);
    assert.equal(scrollFocus.canReturn, true);
    assert.equal(scrollFocus.returned, 0);
    assert.equal(scrollFocus.canRevealAgain, true);
    assert.equal(scrollFocus.focused, 'deep');
    await page.keyboard.press('Enter');
    await frames();
    assert.equal(await fixture.evaluate(f => f.focusTaps.deep), 1);
    await fixture.evaluate(f => f.scrollView.close());
    assert.equal(await fixture.evaluate(f => f.tester.find('button: Back').focused), true);

    return {
      backend,
      base,
      moved,
      partial,
      projected,
      announced,
      legacyMenu,
      modal,
      clipped,
      initialFocus,
      pointerSemantics,
      nesting,
      invalid,
      fallbacks,
      scrollFocus
    };
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
