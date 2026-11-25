// SPDX-License-Identifier: Apache-2.0
// The common parts of game screens in play, in a real browser: a red dot that adds up and is drawn red at a corner,
// a purchase a double click sends once while its button is busy, questions asked one at a time and answered by key
// and by click, a hint bar in the words of the keyboard, the mouse and a finger, and loading that counts. A gamepad
// is not tried: a page cannot be given one here.
import assert from 'node:assert/strict';

export async function verifyViewParts(page, colourAt) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 960, height: 540 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const semantics = createUiSemantics();
    const log = { calls: 0, answers: [] };
    let release, view, hints, buy, game;
    game = await play({
      width: 640,
      height: 360,
      backend: 'webgl2',
      semantics,
      setup(g) {
        buy = g.request(
          () =>
            new Promise(resolve => {
              log.calls++;
              release = resolve;
            })
        );
        view = g.show(
          {
            label: 'Menu',
            root: {
              type: 'panel',
              anchor: 'center',
              width: 360,
              height: 60,
              layout: 'row',
              gap: 20,
              children: [
                { type: 'button', name: 'mail', text: 'Mail', width: 'fill' },
                { type: 'button', name: 'buy', text: 'Buy', width: 'fill' }
              ]
            }
          },
          {
            bind: {
              mail: { badge: () => g.badges.count('mail') },
              buy: { text: () => (buy.busy ? 'Buying' : 'Buy'), disabled: () => buy.busy, tap: () => buy.run() }
            }
          }
        );
        hints = g.hints([
          { action: 'Jump', key: 'space', pad: 'a', touch: 'Tap' },
          { action: 'Pause', key: 'escape', pad: 'start' }
        ]);
      }
    });
    const tester = createUiTester({ semantics });
    return {
      log,
      tester,
      game,
      pageOf(x, y) {
        const box = game.canvas.getBoundingClientRect(),
          screen = game.screen;
        return {
          x: box.left + ((x - screen.x) / screen.width) * box.width,
          y: box.top + ((y - screen.y) / screen.height) * box.height
        };
      },
      rect: name => view.rect(name),
      badge: name => view.badge(name),
      hints: () => ({ shown: hints.shown, visible: hints.visible }),
      release: () => release('ok'),
      ask(question, options) {
        void game.confirm(question, options).then(answer => log.answers.push(answer));
      },
      async load() {
        const seen = new Set();
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const watch = setInterval(() => {
          const match = /Loading (\d) \/ 3/.exec(tester.outline());
          if (match) seen.add(match[1]);
        }, 20);
        try {
          const results = await game.loading(
            [1, 2, 3].map(n => async () => {
              await wait(250);
              return n * 10;
            }),
            { atOnce: 1 }
          );
          return { results, seen: [...seen].sort(), asking: game.asking };
        } finally {
          clearInterval(watch);
        }
      },
      close: () => game.dispose()
    };
  });
  const frames = (count = 3) =>
    page.evaluate(
      n =>
        new Promise(resolve => {
          const next = left => (left === 0 ? resolve() : requestAnimationFrame(() => next(left - 1)));
          next(n);
        }),
      count
    );
  const pointOf = (name, dx = 0.5, dy = 0.5) =>
    fixture.evaluate(
      (f, q) => {
        const r = f.rect(q.name);
        return f.pageOf(r.x + r.width * q.dx, r.y + r.height * q.dy);
      },
      { name, dx, dy }
    );
  const hex = n => '0x' + n.toString(16).padStart(6, '0');
  try {
    await frames();
    // The keyboard: the bar names keys.
    await page.keyboard.press('Shift');
    await frames();
    assert.equal(await fixture.evaluate(f => f.game.device), 'keyboard');
    assert.deepEqual((await fixture.evaluate(f => f.hints())).shown, ['Space Jump', 'Esc Pause']);

    // Three letters under mail: the button shows 3, red at its top right corner, and nothing before.
    assert.equal(await fixture.evaluate(f => f.badge('mail')), false);
    await fixture.evaluate(f => f.game.badges.set('mail/system', 3));
    await frames();
    assert.equal(await fixture.evaluate(f => f.badge('mail')), 3);
    const dot = await fixture.evaluate(f => {
      const r = f.rect('mail');
      // The dot of one figure is a circle 20 across whose middle is 12 in from the right and 3 above the top; the
      // figure is in its middle, so the red is read to its left.
      return f.pageOf(r.x + r.width - 12 - 7, r.y - 3);
    });
    const red = await colourAt(dot.x, dot.y);
    assert.equal(hex(red), '0xef4444', 'the dot is red where it is drawn');

    // A double click on Buy sends one request; the button is busy until it comes back.
    let at = await pointOf('buy');
    await page.mouse.dblclick(at.x, at.y);
    await frames();
    assert.equal(await fixture.evaluate(f => f.log.calls), 1);
    const busy = await fixture.evaluate(f => f.tester.state('button:Buying'));
    assert.equal(busy.disabled, true, 'the busy button is disabled and says so');
    await page.mouse.click(at.x, at.y);
    await fixture.evaluate(f => f.release());
    await frames();
    assert.equal(await fixture.evaluate(f => f.log.calls), 1, 'a click while it was out sent nothing');
    assert.equal(await fixture.evaluate(f => f.tester.state('Buy').disabled), false);
    assert.equal(await fixture.evaluate(f => f.game.device), 'mouse');
    assert.deepEqual(
      (await fixture.evaluate(f => f.hints())).shown,
      ['Space Jump', 'Esc Pause'],
      'a mouse player has keys'
    );

    // Two questions, one at a time: Escape answers the first no, a click on its button answers the second yes.
    await fixture.evaluate(f => {
      f.ask('Quit?', { yes: 'Quit', no: 'Stay' });
      f.ask('Really?');
    });
    await frames(4);
    assert.equal(await fixture.evaluate(f => f.tester.find('dialog').name), 'Quit?');
    assert.equal(await fixture.evaluate(f => f.game.asking), true);
    await page.keyboard.press('Escape');
    await frames(4);
    assert.deepEqual(await fixture.evaluate(f => f.log.answers), [false]);
    assert.equal(await fixture.evaluate(f => f.tester.find('dialog').name), 'Really?');
    const ok = await fixture.evaluate(f => {
      const node = f.tester.find('Really? / OK');
      return f.pageOf(
        f.game.screen.x + node.bounds.x + node.bounds.width / 2,
        f.game.screen.y + node.bounds.y + node.bounds.height / 2
      );
    });
    await page.mouse.click(ok.x, ok.y);
    await frames(4);
    assert.deepEqual(await fixture.evaluate(f => f.log.answers), [false, true]);
    assert.equal(await fixture.evaluate(f => f.game.asking), false);
    assert.equal(await fixture.evaluate(f => f.tester.exists('dialog')), false);

    // A finger: the bar says what a finger does, and leaves out what it cannot.
    at = await pointOf('mail');
    await page.touchscreen.tap(at.x, at.y + 80);
    await frames();
    assert.equal(await fixture.evaluate(f => f.game.device), 'touch');
    assert.deepEqual(await fixture.evaluate(f => f.hints()), { shown: ['Tap Jump'], visible: true });

    // Loading three, one at a time: it counts, then gives what they gave, in order, and is gone.
    const loaded = await fixture.evaluate(f => f.load());
    assert.deepEqual(loaded.results, [10, 20, 30]);
    assert.ok(loaded.seen.includes('1') && loaded.seen.includes('2'), 'it counted: ' + loaded.seen.join(', '));
    assert.equal(await fixture.evaluate(f => f.tester.exists('dialog')), false);
    return { red: hex(red), answers: [false, true], hints: ['Space Jump', 'Tap Jump'], loaded: loaded.seen };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}
