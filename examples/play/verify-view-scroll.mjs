// SPDX-License-Identifier: Apache-2.0
// A declared building list scrolls and clips its own items on real browser input.
import assert from 'node:assert/strict';

export async function verifyViewScroll(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const { createBrowserHoverInput } = await import('/packages/engine/dist/web/hover.js');
    const semantics = createUiSemantics();
    const state = { showTail: true, rename: false, presses: [] };
    const rows = Array.from({ length: 4 }, (_, index) => ({
      type: 'panel',
      name: 'row' + index,
      layout: 'row',
      height: 44,
      gap: 12,
      children: [
        { type: 'button', name: 'house' + index, text: 'House ' + index, width: 'fill' },
        { type: 'button', name: 'workshop' + index, text: 'Workshop ' + index, width: 'fill' }
      ]
    }));
    let view,
      consumerHover,
      gameplayWheel = 0;
    const game = await play({
      width: 640,
      height: 360,
      audio: false,
      backend: 'webgl2',
      semantics,
      setup(g) {
        consumerHover = createBrowserHoverInput({
          engine: g.engine,
          scope: g.scope,
          canvas: g.canvas,
          width: 640,
          height: 360
        });
        const bind = {};
        for (const [index, row] of rows.entries()) {
          if (index >= 2) bind[row.name] = { visible: value => value.showTail };
          for (const button of row.children)
            bind[button.name] = {
              text: value => (value.rename && index === 1 ? button.text + ' ready' : button.text),
              tap: value => value.presses.push(button.name)
            };
        }
        view = g.show(
          {
            label: 'Build',
            root: {
              type: 'panel',
              name: 'buildings',
              scroll: 'vertical',
              x: 40,
              y: 40,
              width: 330,
              height: 104,
              card: true,
              padding: 4,
              gap: 8,
              layout: 'column',
              children: rows
            }
          },
          { state, bind }
        );
      },
      update(_dt, g) {
        gameplayWheel += g.pointer.wheel;
      }
    });
    const tester = createUiTester({ semantics });
    const scroll = view.scroll('buildings');
    let panelRefusal;
    try {
      view.scroll('house0');
    } catch (cause) {
      panelRefusal = cause.code;
    }
    return {
      inspect() {
        return { offset: scroll.offset, maximum: scroll.maximum, presses: state.presses, panelRefusal, gameplayWheel };
      },
      focused() {
        const { nodes, focused } = semantics.publish();
        return nodes.find(node => node.id === focused)?.name;
      },
      bounds(name) {
        return tester.findAll(name)[0]?.bounds;
      },
      refused(action, name) {
        try {
          tester[action](name);
          return false;
        } catch (cause) {
          return cause.code;
        }
      },
      scrollTo: value => scroll.scrollTo(value),
      refresh() {
        state.rename = true;
        view.refresh();
      },
      shrink() {
        state.showTail = false;
        view.refresh();
      },
      rotate() {
        game.ui.x = 360;
        game.ui.rotation = 90;
      },
      point(x, y) {
        const box = game.canvas.getBoundingClientRect(),
          screen = game.screen,
          stage = game.ui.localToGlobal(x, y);
        return {
          x: box.left + ((stage.x - screen.x) / screen.width) * box.width,
          y: box.top + ((stage.y - screen.y) / screen.height) * box.height
        };
      },
      close: () => {
        consumerHover.dispose();
        return game.dispose();
      }
    };
  });
  const frames = () =>
    page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const inspect = () => fixture.evaluate(f => f.inspect());
  const point = (x, y) => fixture.evaluate((f, hit) => f.point(hit.x, hit.y), { x, y });
  const refused = (action, name) => fixture.evaluate((f, args) => f.refused(...args), [action, name]);
  const cdp = await page.context().newCDPSession(page);
  const drag = async (start, end, fractions, release = 'touchEnd') => {
    const at = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(start.x, start.y) });
    try {
      for (const fraction of fractions)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: at(start.x + (end.x - start.x) * fraction, start.y + (end.y - start.y) * fraction)
        });
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: release, touchPoints: [] });
    }
    await frames();
  };
  try {
    await frames();
    const initial = await inspect();
    assert.equal(initial.offset, 0);
    assert.equal(initial.maximum, 104);
    assert.equal(initial.panelRefusal, 'UI_VIEW_BINDING_INVALID');
    for (const action of ['press', 'focus'])
      assert.match(await refused(action, 'House 2'), /^UI_TESTER_(NOT_FOUND|REFUSED)$/);
    const beyond = await point(80, 165);
    await page.mouse.click(beyond.x, beyond.y);
    await frames();
    assert.deepEqual((await inspect()).presses, [], 'a click beyond the viewport must not reach a clipped button');

    const over = await point(80, 112);
    await page.mouse.move(over.x, over.y);
    await page.mouse.wheel(0, 62);
    await frames();
    const wheel = (await inspect()).offset;
    assert.equal(wheel, 62);
    const gameplayWheelInside = (await inspect()).gameplayWheel;
    assert.equal(gameplayWheelInside, 0, 'scrolling a view must not also scroll gameplay');
    const outside = await point(520, 165);
    await page.mouse.move(outside.x, outside.y);
    await page.mouse.wheel(0, 36);
    await frames();
    const gameplayWheelOutside = (await inspect()).gameplayWheel;
    assert.equal(gameplayWheelOutside, 1, 'unclaimed gameplay wheel still reaches Play');
    await fixture.evaluate(f => f.refresh());
    assert.equal((await inspect()).offset, wheel);

    await fixture.evaluate(f => f.scrollTo(0));
    await frames();
    const start = await point(80, 126),
      end = await point(80, 72);
    await drag(start, end, [1 / 3, 2 / 3, 1]);
    const touch = (await inspect()).offset;
    assert.ok(Math.abs(touch - 54) < 2, 'the list follows the finger by 54 logical pixels');
    assert.deepEqual((await inspect()).presses, []);

    await fixture.evaluate(f => f.scrollTo(0));
    await drag(start, end, [1 / 2, 1, 0]);
    assert.deepEqual((await inspect()).presses, [], 'a completed drag back to its start must not become a tap');
    assert.ok(Math.abs((await inspect()).offset) < 2);

    for (const name of ['House 0', 'Workshop 0', 'House 1 ready', 'Workshop 1 ready', 'House 2']) {
      await page.keyboard.press('Tab');
      await frames();
      assert.equal(await fixture.evaluate(f => f.focused()), name);
    }
    const tab = (await inspect()).offset;
    assert.equal(tab, 48);
    const revealed = await fixture.evaluate(f => f.bounds('House 2'));
    assert.equal(revealed?.height, 44, 'the new focus target is fully inside the clip');
    await page.keyboard.press('Enter');
    await frames();
    const keyboard = (await inspect()).presses;
    assert.deepEqual(keyboard, ['house2']);

    await fixture.evaluate(f => {
      f.rotate();
      f.scrollTo(0);
    });
    await frames();
    const rotatedStart = await point(80, 126),
      rotatedEnd = await point(80, 24),
      crossAxis = await point(134, 126);
    await drag(rotatedStart, crossAxis, [1 / 3, 2 / 3, 1]);
    assert.equal((await inspect()).offset, 0, 'a viewport-local horizontal drag must not scroll the rotated list');
    await drag(rotatedStart, rotatedEnd, [1 / 3, 2 / 3, 1]);
    const rotatedTouch = (await inspect()).offset;
    assert.ok(Math.abs(rotatedTouch - 102) < 2, 'the rotated list must follow its local vertical drag beyond the clip');

    await fixture.evaluate(f => f.scrollTo(0));
    await drag(rotatedStart, rotatedEnd, [1 / 2, 1, 0]);
    assert.ok(Math.abs((await inspect()).offset) < 2);
    assert.deepEqual(
      (await inspect()).presses,
      ['house2'],
      'the rotated drag returning to its button must not press it'
    );

    await drag(rotatedStart, rotatedEnd, [1 / 2, 1], 'touchCancel');
    await fixture.evaluate(f => f.scrollTo(0));
    await drag(rotatedStart, rotatedEnd, [1 / 2, 1]);
    assert.ok(Math.abs((await inspect()).offset - 102) < 2, 'a fresh pan must acquire after cancellation');
    await fixture.evaluate(f => f.scrollTo(0));
    await page.touchscreen.tap(rotatedStart.x, rotatedStart.y);
    await frames();
    const afterCancel = (await inspect()).presses;
    assert.deepEqual(afterCancel, ['house2', 'house1'], 'a fresh touch must reach the row after cancellation');

    await fixture.evaluate(f => f.shrink());
    const shrunk = await inspect();
    assert.equal(shrunk.maximum, 0);
    assert.equal(shrunk.offset, 0);
    return {
      wheel,
      touch,
      rotatedTouch,
      afterCancel,
      tab,
      clampedOffset: shrunk.offset,
      keyboard,
      gameplayWheelInside,
      gameplayWheelOutside
    };
  } finally {
    await cdp.detach();
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}
