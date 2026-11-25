// SPDX-License-Identifier: Apache-2.0
// A shop described as data and shown by play with `game.show`, kept to the game's state by bindings and driven two
// ways: by the mouse at the places the plan gives, and by name through the semantic tree with the UI tester. It
// checks the skin's colours where the plan puts a button, a number that counts down, a button that greys and
// refuses, a modal dialog that closes the shop to the pointer and to the tester, and the portrait parts after a turn.
import assert from 'node:assert/strict';

export async function verifyViews(page, colourAt) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 960, height: 540 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const semantics = createUiSemantics();
    const state = { gold: 100, hp: 0.5, sound: true, bought: 0 };
    const seen = { golds: [], built: [] };
    const row = { type: 'panel', layout: 'row', gap: 12, height: 52, justify: 'center' };
    const shop = {
      label: 'Shop',
      root: {
        type: 'panel',
        name: 'shop',
        card: true,
        anchor: 'center',
        width: 420,
        height: 280,
        padding: 16,
        layout: 'column',
        gap: 12,
        children: [
          { type: 'text', name: 'gold', text: '' },
          { type: 'bar', name: 'hp', label: 'Health', height: 14 },
          { type: 'toggle', name: 'sound', text: 'Sound' },
          {
            ...row,
            children: [
              { type: 'button', name: 'buy', text: 'Buy 60', width: 140 },
              { type: 'button', name: 'sell', text: 'Sell all', width: 140 }
            ]
          }
        ]
      },
      // On a phone held upright: the same parts across the bottom of the screen, the buttons one above the other.
      portrait: {
        type: 'panel',
        name: 'shop',
        card: true,
        anchor: 'bottom',
        height: 340,
        padding: 16,
        layout: 'column',
        gap: 12,
        children: [
          { type: 'text', name: 'gold', text: '', align: 'center' },
          { type: 'bar', name: 'hp', label: 'Health', height: 14 },
          { type: 'toggle', name: 'sound', text: 'Sound', width: 'fill' },
          { type: 'button', name: 'buy', text: 'Buy 60', width: 'fill' },
          { type: 'button', name: 'sell', text: 'Sell all', width: 'fill' }
        ]
      }
    };
    let view, game;
    game = await play({
      width: 640,
      height: 360,
      portrait: { width: 360, height: 640 },
      backend: 'webgl2',
      semantics,
      setup(g) {
        view = g.show(shop, {
          state,
          bind: {
            gold: { pick: s => s.gold, roll: 0.5, format: n => 'Gold ' + n },
            hp: { value: s => s.hp },
            sound: { checked: s => s.sound, tap: s => (s.sound = !s.sound) },
            buy: {
              disabled: s => s.gold < 60,
              tap: s => {
                s.gold -= 60;
                s.bought++;
              }
            },
            sell: {
              tap: () => {
                const ask = g.show(
                  {
                    label: 'Sell everything?',
                    modal: true,
                    root: {
                      type: 'panel',
                      card: true,
                      anchor: 'center',
                      width: 300,
                      height: 150,
                      padding: 16,
                      layout: 'column',
                      gap: 12,
                      children: [
                        { type: 'text', text: 'Sell everything?', align: 'center' },
                        { type: 'button', name: 'yes', text: 'Yes', width: 'fill' }
                      ]
                    }
                  },
                  {
                    state,
                    bind: {
                      yes: {
                        tap: s => {
                          s.gold += 500;
                          ask.close();
                        }
                      }
                    }
                  }
                );
                globalThis.__ask = ask;
              }
            }
          },
          built: made => seen.built.push(made.variant)
        });
      },
      update() {
        const words = view.get('gold').getChildAt(0).text;
        if (seen.golds.at(-1) !== words) seen.golds.push(words);
      }
    });
    const tester = createUiTester({ semantics });
    return {
      state,
      seen,
      tester,
      // Where a point of the game is in the page, as the canvas is shown now.
      pageOf(x, y) {
        const box = game.canvas.getBoundingClientRect(),
          screen = game.screen;
        return {
          x: box.left + ((x - screen.x) / screen.width) * box.width,
          y: box.top + ((y - screen.y) / screen.height) * box.height
        };
      },
      rect: name => view.rect(name),
      variant: () => view.variant,
      askOpen: () => globalThis.__ask?.visible === true,
      close: () => game.dispose()
    };
  });
  const frames = (count = 2) =>
    page.evaluate(
      n =>
        new Promise(resolve => {
          const next = left => (left === 0 ? resolve() : requestAnimationFrame(() => next(left - 1)));
          next(n);
        }),
      count
    );
  const click = async (name, dx = 0.5, dy = 0.5) => {
    const at = await fixture.evaluate(
      (f, q) => {
        const r = f.rect(q.name);
        return f.pageOf(r.x + r.width * q.dx, r.y + r.height * q.dy);
      },
      { name, dx, dy }
    );
    await page.mouse.click(at.x, at.y);
    await frames();
  };
  const colourOf = async (name, dx, dy) => {
    const at = await fixture.evaluate(
      (f, q) => {
        const r = f.rect(q.name);
        return f.pageOf(r.x + q.dx, r.y + r.height * q.dy);
      },
      { name, dx, dy }
    );
    return colourAt(at.x, at.y);
  };
  const near = (a, b) => [16, 8, 0].every(shift => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)) <= 3);
  const hex = n => '0x' + n.toString(16).padStart(6, '0');
  try {
    await frames(4);
    // The tester reads the view by its names, as the semantic tree publishes them.
    let outline = await fixture.evaluate(f => f.tester.outline());
    assert.match(
      outline,
      /group "Shop"\n {2}group "shop"\n {4}text "Gold 100"\n {4}progressbar "Health" \[at 50 of 0–100\]\n {4}switch "Sound" \[checked\]\n {4}button "Buy 60"\n {4}button "Sell all"/
    );
    // The skin's blue at the left of the Buy button, where the plan put it.
    const blue = await colourOf('buy', 8, 0.5);
    assert.ok(near(blue, 0x3b82f6), 'an enabled button is the skin blue: ' + hex(blue));

    // A press by name: 60 spent, and the gold counts down to 40 over half a second rather than jumping.
    await fixture.evaluate(f => f.tester.press('Shop / Buy 60'));
    await page.waitForTimeout(900);
    await frames();
    const seen = await fixture.evaluate(f => f.seen.golds);
    assert.equal(seen.at(-1), 'Gold 40');
    assert.ok(
      seen.some(words => {
        const n = Number(words.slice(5));
        return n > 40 && n < 100;
      }),
      'the number counted down: ' + seen.join(', ')
    );
    // 40 is too little: the button greys, and neither the mouse nor the tester buys.
    const grey = await colourOf('buy', 8, 0.5);
    assert.ok(near(grey, 0x64748b), 'a disabled button is the skin grey: ' + hex(grey));
    await click('buy');
    assert.equal(await fixture.evaluate(f => f.state.bought), 1, 'a click on a disabled button buys nothing');
    const refused = await fixture.evaluate(f => {
      try {
        f.tester.press('Buy 60');
        return 'pressed';
      } catch (error) {
        return error.code;
      }
    });
    assert.equal(refused, 'UI_TESTER_REFUSED');

    // The mouse on the toggle turns the sound off, and the tree says so.
    await click('sound', 0.9);
    assert.equal(await fixture.evaluate(f => f.state.sound), false);
    assert.equal(await fixture.evaluate(f => f.tester.state('Sound').checked), false);

    // Sell all opens a modal: the shop under it takes neither a click nor a press by name, and Yes closes it.
    await click('sell');
    assert.equal(await fixture.evaluate(f => f.askOpen()), true);
    assert.equal(await fixture.evaluate(f => f.tester.find('dialog').name), 'Sell everything?');
    await click('sound', 0.9);
    assert.equal(await fixture.evaluate(f => f.state.sound), false, 'the dim behind the dialog took the click');
    const blocked = await fixture.evaluate(f => {
      try {
        f.tester.press('Sound');
        return 'pressed';
      } catch (error) {
        return error.code;
      }
    });
    assert.equal(blocked, 'UI_TESTER_REFUSED');
    await fixture.evaluate(f => f.tester.press('Sell everything? / Yes'));
    await frames();
    assert.equal(await fixture.evaluate(f => f.state.gold), 540);
    assert.equal(await fixture.evaluate(f => f.askOpen()), false);
    assert.equal(await fixture.evaluate(f => f.tester.exists('dialog')), false);

    // The phone turns: the portrait parts, built again, with the same bindings; a click at Buy's new place buys.
    await page.setViewportSize({ width: 540, height: 960 });
    await frames(4);
    assert.equal(await fixture.evaluate(f => f.variant()), 'portrait');
    assert.deepEqual(await fixture.evaluate(f => f.seen.built), ['landscape', 'portrait']);
    const buy = await fixture.evaluate(f => f.rect('buy'));
    assert.equal(buy.width, 360 - 32, 'the button fills the portrait card');
    await click('buy');
    assert.equal(await fixture.evaluate(f => f.state.gold), 480);
    outline = await fixture.evaluate(f => f.tester.outline());
    assert.match(
      outline,
      /switch "Sound" \[unchecked\]\n {4}button "Buy 60"\n {4}button "Sell all"/,
      'the same parts, by the same names'
    );
    return { blue: hex(blue), grey: hex(grey), golds: seen.length, variants: ['landscape', 'portrait'], gold: 480 };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}
