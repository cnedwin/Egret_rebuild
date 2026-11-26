// SPDX-License-Identifier: Apache-2.0
// A transient empty noninteractive text must not stop semantic publication or game time.
import assert from 'node:assert/strict';

export async function verifyViewEmptyText(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const semantics = createUiSemantics();
    const tester = createUiTester({ semantics });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0';
    document.body.append(host);
    const state = { intent: 'Boss attacks in four turns', accessible: 'Combat status', taps: 0 };
    const errors = [];
    let view;
    const game = await play({
      parent: host,
      width: 640,
      height: 360,
      backend: 'webgl2',
      audio: false,
      semantics,
      onError: e => errors.push({ code: e?.code, detail: e?.cause?.message }),
      setup(g) {
        view = g.show(
          {
            label: 'Battle',
            root: {
              type: 'panel',
              name: 'battle',
              children: [
                {
                  type: 'text',
                  name: 'intent',
                  text: 'Boss attacks in four turns',
                  x: 10,
                  y: 10,
                  width: 400,
                  height: 32
                },
                { type: 'text', name: 'status', text: '', x: 10, y: 48, width: 400, height: 32 },
                { type: 'button', name: 'continue', text: 'Continue', x: 10, y: 100, width: 140, height: 44 }
              ]
            }
          },
          {
            state,
            bind: {
              intent: { text: s => s.intent },
              status: { text: () => '', label: s => s.accessible },
              continue: { tap: s => s.taps++ }
            }
          }
        );
      }
    });
    view.focus('continue');
    return {
      frame() {
        const snapshot = game.browser.loop.snapshot();
        return { state: snapshot.state, frames: snapshot.frames, steps: snapshot.steps, errors: [...errors] };
      },
      set(intent) {
        state.intent = intent;
        return game.browser.loop.snapshot().frames;
      },
      inspect() {
        return {
          frame: this.frame(),
          nodes: semantics.publish().nodes.map(({ role, name, focused }) => ({ role, name, focused })),
          rect: view.rect('intent'),
          focused: view.focused,
          taps: state.taps
        };
      },
      press() {
        tester.press('button: Continue');
      },
      async dispose() {
        await game.dispose();
        semantics.dispose();
        host.remove();
      }
    };
  });
  try {
    const initial = await fixture.evaluate(f => f.inspect());
    assert.ok(initial.nodes.some(n => n.name === 'Boss attacks in four turns'));
    assert.ok(initial.nodes.some(n => n.name === 'Combat status'));
    const transitions = [];
    for (const text of ['', ' \t\n\u3000', 'Victory — 结算', '', 'Next encounter']) {
      const before = await fixture.evaluate((f, text) => f.set(text), text);
      await page.waitForFunction(
        ({ fixture, before }) => {
          const f = fixture.frame();
          return f.state === 'failed' || f.frames >= before + 3;
        },
        { fixture, before }
      );
      const frame = await fixture.evaluate(f => f.frame());
      assert.equal(frame.state, 'running', JSON.stringify(frame));
      assert.ok(frame.frames >= before + 3);
      assert.deepEqual(frame.errors, []);
      const next = await fixture.evaluate(f => f.inspect());
      assert.deepEqual(next.rect, initial.rect);
      assert.equal(next.focused, 'continue');
      assert.ok(next.nodes.some(n => n.name === 'Combat status'));
      const textNodes = next.nodes.filter(n => n.role === 'text' && n.name !== 'Combat status');
      assert.deepEqual(
        textNodes.map(n => n.name),
        /\S/u.test(text) ? [text] : []
      );
      transitions.push({ text, frames: frame.frames, textNodes: textNodes.length });
    }
    await fixture.evaluate(f => f.press());
    assert.equal((await fixture.evaluate(f => f.inspect())).taps, 1);
    return { transitions, explicitLabelRetained: true, focusAndActionRetained: true };
  } finally {
    await fixture.evaluate(f => f.dispose());
    await fixture.dispose();
  }
}
