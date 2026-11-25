// SPDX-License-Identifier: Apache-2.0
// A game fitted to the window with fit 'expand', a portrait size and a notch: what the window shows, the safe part,
// a turn of the window and a tap on a button placed at a safe edge. The window is turned by resizing the page.
import assert from 'node:assert/strict';

export async function verifyScreenFit(page) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 960, height: 540 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const log = { arranged: [], taps: 0 };
    let button;
    const game = await play({
      width: 640,
      height: 360,
      portrait: { width: 360, height: 640 },
      fit: 'expand',
      // A notch on the left in landscape: 44 CSS pixels.
      insets: { top: 0, right: 0, bottom: 0, left: 44 },
      backend: 'webgl2',
      setup(g) {
        button = g.button('Menu', { x: 0, y: 0, width: 80, height: 40 }, () => log.taps++);
      },
      arrange(g) {
        // The button in the safe part's top right corner, whatever the window's shape.
        button.x = g.safe.x + g.safe.width - 50;
        button.y = g.safe.y + 30;
        log.arranged.push({
          orientation: g.orientation,
          width: g.width,
          height: g.height,
          screen: { ...g.screen },
          safe: { ...g.safe },
          button: { x: button.x, y: button.y }
        });
      }
    });
    const contain = await play({ width: 200, height: 100, backend: 'webgl2', parent: document.body });
    const plain = { width: contain.width, screen: { ...contain.screen }, safe: { ...contain.safe } };
    await contain.dispose();
    return {
      log,
      plain,
      // Where a point of the game is in the page, as the canvas is shown now.
      pageOf(x, y) {
        const box = game.canvas.getBoundingClientRect(),
          screen = game.screen;
        return {
          x: box.left + ((x - screen.x) / screen.width) * box.width,
          y: box.top + ((y - screen.y) / screen.height) * box.height
        };
      },
      canvas() {
        const box = game.canvas.getBoundingClientRect();
        return { width: box.width, height: box.height };
      },
      close: () => game.dispose()
    };
  });
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  try {
    const plain = await fixture.evaluate(f => f.plain);
    // 'contain' is as it was: the window shows the design and all of it is safe.
    assert.deepEqual(plain.screen, { x: 0, y: 0, width: 200, height: 100 });
    assert.deepEqual(plain.safe, { x: 0, y: 0, width: 200, height: 100 });

    // Landscape, 960 × 540: the design fits at 1.5, so the window shows exactly it; the notch covers 44 / 1.5 units.
    let log = await fixture.evaluate(f => f.log.arranged);
    assert.equal(log.length, 1, 'arranged once after setup');
    let now = log.at(-1);
    assert.equal(now.orientation, 'landscape');
    assert.deepEqual(now.screen, { x: 0, y: 0, width: 640, height: 360 });
    assert.ok(Math.abs(now.safe.x - 44 / 1.5) < 0.01 && Math.abs(now.safe.width - (640 - 44 / 1.5)) < 0.01);
    assert.deepEqual(await fixture.evaluate(f => f.canvas()), { width: 960, height: 540 });

    // Wider, 1200 × 540: the same scale, and the window shows 800 units across, 80 each side of the design.
    await page.setViewportSize({ width: 1200, height: 540 });
    await frames();
    log = await fixture.evaluate(f => f.log.arranged);
    now = log.at(-1);
    assert.equal(now.width, 640);
    assert.deepEqual(now.screen, { x: -80, y: 0, width: 800, height: 360 });
    assert.ok(Math.abs(now.safe.x - (-80 + 44 / 1.5)) < 0.01, 'the safe part starts past the notch');

    // The phone turns: 540 × 960 is taller than wide, so the portrait design applies, at 1.5 again.
    await page.setViewportSize({ width: 540, height: 960 });
    await frames();
    log = await fixture.evaluate(f => f.log.arranged);
    now = log.at(-1);
    assert.equal(now.orientation, 'portrait');
    assert.equal(now.width, 360);
    assert.equal(now.height, 640);
    assert.deepEqual(now.screen, { x: 0, y: 0, width: 360, height: 640 });
    assert.deepEqual(await fixture.evaluate(f => f.canvas()), { width: 540, height: 960 });

    // A tap on the button where arrange put it, in the page's pixels, reaches it.
    const at = await fixture.evaluate((f, b) => f.pageOf(b.x, b.y), now.button);
    await page.mouse.click(at.x, at.y);
    await frames();
    assert.equal(await fixture.evaluate(f => f.log.taps), 1, 'the button at the safe edge takes the tap');
    return { arranged: log.length, orientations: [...new Set(log.map(entry => entry.orientation))], taps: 1 };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}
