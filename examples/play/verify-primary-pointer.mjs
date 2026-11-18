// SPDX-License-Identifier: Apache-2.0
// Drive overlapping contacts through Chromium's input protocol. Observe Play before the next update clears its edges.
import assert from 'node:assert/strict';

export async function verifyPrimaryPointer(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    let taps = 0;
    const game = await play({
      width: 200,
      height: 100,
      backend: 'webgl2',
      setup(g) {
        g.onTap(g.rect(150, 30, 45, 45, 0xff5533, g.ui), () => taps++);
      }
    });
    const box = game.canvas.getBoundingClientRect();
    const finger = (id, x, y) => ({ id, x: box.left + (x / 200) * box.width, y: box.top + (y / 100) * box.height });
    const events = [];
    const snapshot = event => {
      const { down, released, swipe, x } = game.pointer;
      events.push({ type: event.type, id: event.pointerId, down, released, swipe, x, taps });
    };
    const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
    for (const type of types) window.addEventListener(type, snapshot);
    return {
      points: { start: finger(11, 35, 65), drag: finger(11, 75, 65), button: finger(22, 160, 40) },
      events,
      async close() {
        for (const type of types) window.removeEventListener(type, snapshot);
        await game.dispose();
      }
    };
  });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, ...touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  try {
    const { start, drag, button } = await fixture.evaluate(f => f.points);
    let taps = 0;
    for (const firstUp of ['secondary', 'owner', 'cancel']) {
      await fixture.evaluate(f => {
        f.events.length = 0;
      });
      await touch('touchStart', start);
      await touch('touchStart', start, button);
      await touch('touchMove', drag, button);
      if (firstUp === 'cancel') await touch('touchCancel');
      else {
        await touch('touchEnd', firstUp === 'owner' ? drag : button);
        await touch('touchEnd');
        taps++;
      }
      const events = await fixture.evaluate(f => f.events);
      const [owner, secondary] = events.filter(e => e.type === 'pointerdown');
      assert.ok(owner.down && secondary.down && owner.id !== secondary.id);
      assert.equal(secondary.x, owner.x);
      const ends = events.filter(e => e.type === 'pointercancel' || e.type === 'pointerup');
      assert.equal(ends.length, 2);
      assert.equal(ends.at(-1).taps, taps);
      if (firstUp === 'cancel') {
        assert.ok(ends.every(e => !e.released && e.swipe === undefined));
        assert.ok(!ends.at(-1).down);
      } else {
        assert.equal(ends[0].id, firstUp === 'owner' ? owner.id : secondary.id);
        const ownEnd = ends.find(e => e.id === owner.id);
        const otherEnd = ends.find(e => e.id === secondary.id);
        assert.ok(ownEnd.released && !ownEnd.down && ownEnd.swipe === 'right');
        assert.equal(otherEnd.down, firstUp === 'secondary');
        assert.ok(Math.abs(otherEnd.x - 75) < 1);
      }
    }
    return { releaseOrders: 2, cancelled: true, secondaryTaps: taps };
  } finally {
    try {
      await cdp.detach();
    } finally {
      await fixture.evaluate(f => f.close());
      await fixture.dispose();
    }
  }
}
