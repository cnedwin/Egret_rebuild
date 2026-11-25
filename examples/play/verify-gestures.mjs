// SPDX-License-Identifier: Apache-2.0
// Gestures of play in a real browser with the mouse: a double click, a long press, a slow drag that moves a card, a
// fast one that is a swipe, and a gem dragged from where it lies onto a slot. Two fingers are not tried here: a page
// mouse has one, and the pinch is checked in Node by tests/gestures.test.mjs.
import assert from 'node:assert/strict';

export async function verifyGestures(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const log = { double: 0, hold: 0, drags: [], swipes: [], dropped: [], hover: [], ghosts: 0 };
    let card, gem, slot, dnd;
    const game = await play({
      width: 640,
      height: 360,
      backend: 'webgl2',
      setup(g) {
        // A rectangle's middle is where it is put: the card covers 40 to 120 each way.
        card = g.rect(80, 80, 80, 80, 0xff8844);
        g.gestures(card, {
          doubleTap: () => log.double++,
          hold: at => {
            log.hold++;
            log.holdAt = { x: Math.round(at.x), y: Math.round(at.y), localX: Math.round(at.localX) };
          },
          drag: drag => {
            card.x += drag.dx;
            card.y += drag.dy;
            log.drags.push(drag.phase);
            if (drag.phase === 'end') log.dragTotal = Math.round(drag.totalX);
          },
          swipe: swipe => log.swipes.push(swipe.direction)
        });
        gem = g.rect(325, 225, 50, 50, 0x44ddff);
        slot = g.rect(545, 235, 90, 90, 0x335533);
        dnd = g.dragAndDrop();
        dnd.source(gem, {
          data: () => 'gem',
          ghost: () => {
            log.ghosts++;
            return g.rect(0, 0, 30, 30, 0xffffff);
          }
        });
        dnd.target(slot, { drop: data => log.dropped.push(data), hover: (data, over) => log.hover.push(over) });
      }
    });
    return {
      log,
      // Where a point of the game is in the page, as the canvas is shown now.
      pageOf(x, y) {
        const box = game.canvas.getBoundingClientRect(),
          screen = game.screen;
        return {
          x: box.left + ((x - screen.x) / screen.width) * box.width,
          y: box.top + ((y - screen.y) / screen.height) * box.height
        };
      },
      card: () => ({ x: card.x, y: card.y }),
      dragging: () => dnd.dragging,
      close: () => game.dispose()
    };
  });
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const at = (x, y) => fixture.evaluate((f, p) => f.pageOf(p.x, p.y), { x, y });
  const read = () => fixture.evaluate(f => f.log);
  try {
    // A double click on the card.
    let p = await at(80, 80);
    await page.mouse.dblclick(p.x, p.y);
    await frames();
    assert.equal((await read()).double, 1, 'a double click is a double tap');
    await page.waitForTimeout(400);

    // A still press of most of a second is a long press, told where it was.
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await frames();
    let log = await read();
    assert.equal(log.hold, 1, 'a long press');
    assert.deepEqual(log.holdAt, { x: 80, y: 80, localX: 0 });
    assert.equal(log.double, 1, 'the long press is no tap');

    // A slow drag of 100 units moves the card with it, and is no swipe.
    await page.mouse.down();
    for (let step = 1; step <= 10; step++) {
      const q = await at(80 + step * 10, 80);
      await page.mouse.move(q.x, q.y);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    await page.mouse.up();
    await frames();
    log = await read();
    assert.equal(log.drags[0], 'start');
    assert.equal(log.drags.at(-1), 'end');
    assert.equal(log.dragTotal, 100);
    const dragged = log.dragTotal;
    assert.deepEqual(await fixture.evaluate(f => f.card()), { x: 180, y: 80 }, 'the card followed the drag');
    assert.deepEqual(log.swipes, [], 'slow at the end: no swipe');

    // A fast flick down from the card's new place is a swipe.
    p = await at(180, 80);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    const end = await at(180, 260);
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
    await frames();
    log = await read();
    assert.deepEqual(log.swipes, ['down']);

    // The gem dragged onto the slot: a ghost follows it, the slot lights as it is crossed, and takes it.
    p = await at(325, 225);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (let step = 1; step <= 10; step++) {
      const q = await at(325 + step * 22, 225 + step * 1);
      await page.mouse.move(q.x, q.y);
      await page.waitForTimeout(20);
    }
    await frames();
    assert.equal(await fixture.evaluate(f => f.dragging()), 'gem');
    await page.mouse.up();
    await frames();
    log = await read();
    assert.equal(log.ghosts, 1);
    assert.deepEqual(log.dropped, ['gem']);
    assert.deepEqual(log.hover, [true, false]);
    assert.equal(await fixture.evaluate(f => f.dragging()), undefined);
    return { double: log.double, hold: log.hold, drag: dragged, swipes: log.swipes, dropped: log.dropped };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
  }
}
