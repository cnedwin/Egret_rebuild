// SPDX-License-Identifier: Apache-2.0
// Public Play confirmation: a narrow viewport, full bilingual semantics, themed pixels, real keyboard/click,
// a resize with the original question still pending, and a vertically scrolling question with fixed actions.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

export async function verifyConfirm(page, out) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 360, height: 780 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const parent = document.createElement('div');
    parent.style.cssText = 'position:fixed;inset:0;z-index:10000';
    document.body.append(parent);
    const semantics = createUiSemantics(),
      answers = [];
    const game = await play({
      parent,
      width: 540,
      height: 960,
      fit: 'expand',
      uiScale: { min: 1, max: 1.15 },
      pixelRatio: 1,
      backend: 'webgl2',
      audio: false,
      semantics
    });
    // Keep an active, visible lower modal whose authored parent relationships change with orientation.
    const lowerPart = upright => ({
      type: 'panel',
      anchor: 'center',
      width: upright ? 300 : 560,
      height: upright ? 590 : 300,
      card: true,
      layout: 'column',
      padding: 12,
      gap: 12,
      children: ['landscapePane', 'portraitPane'].map(name => ({
        type: 'panel',
        name,
        height: 64,
        layout: 'column',
        children:
          name === (upright ? 'portraitPane' : 'landscapePane')
            ? [{ type: 'button', name: 'lowerAction', text: 'Lower action', height: 48 }]
            : []
      }))
    });
    const lower = game.show(
      { label: 'Lower active modal', modal: true, root: lowerPart(false), portrait: lowerPart(true) },
      { bind: { lowerAction: { tap: () => answers.push('wrong lower action') } } }
    );
    const tester = createUiTester({ semantics });
    const zh = {
      title: '\u786e\u8ba4\u51fa\u552e\u73cd\u8d35\u6cd5\u5b9d',
      text: '\u4f60\u771f\u7684\u8981\u51fa\u552e\u8fd9\u4ef6\u7a00\u6709\u7684\u6cd5\u5b9d\u5417\uff1f\u786e\u8ba4\u540e\u6cd5\u5b9d\u5c06\u79bb\u5f00\u4f60\u7684\u884c\u56ca\uff0c\u5e76\u83b7\u5f97\u4e8c\u5341\u516b\u9897\u73cd\u73e0\u3002',
      no: '\u4fdd\u7559\u8fd9\u4ef6\u73cd\u8d35\u6cd5\u5b9d\u5e76\u8fd4\u56de\u884c\u56ca',
      yes: '\u786e\u8ba4\u51fa\u552e\u8fd9\u4ef6\u6cd5\u5b9d\u5e76\u6536\u53d6\u4e8c\u5341\u516b\u9897\u73cd\u73e0'
    };
    const en = {
      title: 'Confirm your decision',
      text: 'Sell the extraordinary dragon treasure for twenty-eight pearls? Confirming permanently removes it from your inventory.',
      no: 'Keep the extraordinary treasure in my inventory',
      yes: 'Sell this rare treasure and collect twenty-eight pearls'
    };
    const skin = { panel: 0x153329, text: 0xffe8bd, button: 0x92352a, buttonText: 0xffe8bd, dim: 0.65, radius: 6 };
    const go = copy => {
      void game
        .confirm(copy.text, { title: copy.title, no: copy.no, yes: copy.yes, skin, noColor: 0x245b48 })
        .then(answer => answers.push(answer));
    };
    const pageBox = bounds => {
      const box = game.canvas.getBoundingClientRect(),
        plan = game.browser.screen;
      return {
        x: box.left + (bounds.x * box.width) / plan.width,
        y: box.top + (bounds.y * box.height) / plan.height,
        width: (bounds.width * box.width) / plan.width,
        height: (bounds.height * box.height) / plan.height
      };
    };
    const read = copy => {
      const control = label => {
        const key = 'button:' + label,
          found = tester.find(key);
        return { name: found.name, focused: tester.state(key).focused, box: pageBox(found.bounds) };
      };
      return {
        asking: game.asking,
        no: control(copy.no),
        yes: control(copy.yes),
        dialog: semantics.publish().nodes.find(node => node.role === 'dialog' && !node.inert && !node.hidden)?.name,
        text: tester.findAll('text').find(node => node.name === copy.text)?.name,
        answers: [...answers]
      };
    };
    return {
      zh,
      en,
      read,
      answers: () => [...answers],
      go,
      queue() {
        let error;
        try {
          game.confirm('Invalid theme', { skin: { button: -1 } });
        } catch (cause) {
          error = cause.code;
        }
        go(zh);
        go(en);
        return error;
      },
      long() {
        const copy = {
          title: 'Read every condition',
          text: Array.from(
            { length: 40 },
            (_, i) => 'Condition ' + (i + 1) + ': every condition remains visible if you scroll the question.'
          ).join('\n'),
          no: 'Cancel all these conditions',
          yes: 'Accept all these conditions'
        };
        go(copy);
        return copy;
      },
      asking: () => game.asking,
      lowerState() {
        const nodes = semantics.publish().nodes,
          root = nodes.find(node => node.name === 'Lower active modal'),
          action = nodes.find(node => node.name === 'Lower action');
        return { variant: lower.variant, id: root?.id, parent: action?.parent, inert: action?.inert };
      },
      close: async () => {
        await game.dispose();
        parent.remove();
      }
    };
  });
  const frames = async (count = 6) => {
    await page.evaluate(
      n =>
        new Promise(resolve => {
          const next = left => (left === 0 ? resolve() : requestAnimationFrame(() => next(left - 1)));
          next(n);
        }),
      count
    );
    // Text publication may finish one frame after the semantic box is available.
    await page.waitForTimeout(150);
  };
  const bounded = (entry, w, h) => {
    const a = entry.box;
    assert.ok(a.width >= 44 - 0.5 && a.height >= 44 - 0.5, JSON.stringify(entry));
    assert.ok(
      a.x >= -0.5 && a.y >= -0.5 && a.x + a.width <= w + 0.5 && a.y + a.height <= h + 0.5,
      JSON.stringify(entry)
    );
  };
  const theme = (bytes, control, color) => {
    const { PNG } = createRequire(import.meta.url)('pngjs'),
      png = PNG.sync.read(bytes);
    const r = color >> 16,
      g = (color >> 8) & 255,
      b = color & 255;
    let matched = 0;
    const rect = control.box;
    for (let y = Math.ceil(rect.y + 5); y < Math.floor(rect.y + rect.height - 5); y++)
      for (let x = Math.ceil(rect.x + 5); x < Math.floor(rect.x + rect.width - 5); x++) {
        if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
        const i = (y * png.width + x) * 4;
        if (Math.abs(png.data[i] - r) <= 1 && Math.abs(png.data[i + 1] - g) <= 1 && Math.abs(png.data[i + 2] - b) <= 1)
          matched++;
      }
    assert.ok(matched >= 30, 'themed pixels not present: ' + color.toString(16));
    return matched;
  };
  try {
    const zh = await fixture.evaluate(f => f.zh),
      en = await fixture.evaluate(f => f.en);
    assert.equal(await fixture.evaluate(f => f.queue()), 'UI_VIEW_BINDING_INVALID');
    await frames();
    let state = await fixture.evaluate((f, copy) => f.read(copy), zh);
    assert.deepEqual(state.answers, []);
    assert.equal(state.dialog, zh.title);
    assert.equal(state.text, zh.text);
    assert.equal(state.yes.name, zh.yes);
    assert.equal(state.no.name, zh.no);
    assert.equal(state.yes.focused, true);
    const originalLower = await fixture.evaluate(f => f.lowerState());
    assert.equal(originalLower.variant, 'portrait');
    assert.ok(originalLower.parent?.endsWith(':portraitPane') && originalLower.inert === true);
    bounded(state.no, 360, 780);
    bounded(state.yes, 360, 780);
    const zhShot = await page.screenshot({ path: path.join(out, 'confirm-zh-360x780.png') });
    const pixels = [theme(zhShot, state.no, 0x245b48), theme(zhShot, state.yes, 0x92352a)];
    // The question was queued by the fixture, not a user click; focus the embedded canvas by its modal backdrop.
    await page.mouse.click(4, 4);
    await frames();
    await page.keyboard.press('Shift+Tab');
    await frames();
    assert.equal((await fixture.evaluate((f, copy) => f.read(copy), zh)).no.focused, true);
    await page.setViewportSize({ width: 820, height: 390 });
    await frames();
    state = await fixture.evaluate((f, copy) => f.read(copy), zh);
    assert.equal(state.no.focused, true, 'focus and unresolved question survive native resize');
    const wideLower = await fixture.evaluate(f => f.lowerState());
    assert.equal(wideLower.variant, 'landscape');
    assert.equal(wideLower.id, originalLower.id);
    assert.ok(
      wideLower.parent?.endsWith(':landscapePane') && wideLower.inert === true,
      'lower variant is reparented but remains behind the confirmation'
    );
    assert.deepEqual(state.answers, []);
    bounded(state.no, 820, 390);
    bounded(state.yes, 820, 390);
    await page.screenshot({ path: path.join(out, 'confirm-zh-820x390.png') });
    await page.keyboard.press('Escape');
    await frames();
    assert.deepEqual(await fixture.evaluate(f => f.answers()), [false]);
    await page.setViewportSize({ width: 360, height: 780 });
    await frames();
    state = await fixture.evaluate((f, copy) => f.read(copy), en);
    assert.equal(state.dialog, en.title);
    assert.equal(state.text, en.text);
    assert.equal(state.yes.name, en.yes);
    assert.equal(state.no.name, en.no);
    assert.equal(state.yes.focused, true);
    bounded(state.no, 360, 780);
    bounded(state.yes, 360, 780);
    await page.screenshot({ path: path.join(out, 'confirm-en-360x780.png') });
    await page.mouse.click(state.yes.box.x + state.yes.box.width / 2, state.yes.box.y + state.yes.box.height / 2);
    await frames();
    assert.deepEqual(await fixture.evaluate(f => f.answers()), [false, true]);
    assert.equal(await fixture.evaluate(f => f.asking()), false);
    const returnedLower = await fixture.evaluate(f => f.lowerState());
    assert.equal(returnedLower.id, originalLower.id);
    assert.ok(
      returnedLower.parent?.endsWith(':portraitPane') && returnedLower.inert === false,
      'closing the questions restores the lower view'
    );
    const long = await fixture.evaluate(f => f.long());
    await frames();
    const last = await fixture.evaluate((f, copy) => f.read(copy), long);
    bounded(last.no, 360, 780);
    bounded(last.yes, 360, 780);
    const firstImage = await page.screenshot({ path: path.join(out, 'confirm-scroll-before.png') });
    await page.mouse.move(180, Math.max(44, last.no.box.y / 2));
    await page.mouse.wheel(0, 450);
    await frames();
    const secondImage = await page.screenshot({ path: path.join(out, 'confirm-scroll-after.png') });
    assert.notDeepEqual(firstImage, secondImage, 'wheel scroll changes the displayed question');
    const scrolled = await fixture.evaluate((f, copy) => f.read(copy), long);
    assert.deepEqual(scrolled.no.box, last.no.box);
    assert.deepEqual(scrolled.yes.box, last.yes.box);
    // Buttons use the real keyboard focus even when the body is scrolled.
    await page.keyboard.press('Escape');
    await frames();
    assert.deepEqual(await fixture.evaluate(f => f.answers()), [false, true, false]);
    return {
      answers: [false, true, false],
      themedPixels: pixels,
      bilingualLongLabels: true,
      resizedFocus: true,
      questionScroll: true,
      coveredVariantModalKeepsOrder: true
    };
  } finally {
    await fixture.evaluate(f => f.close());
    await fixture.dispose();
    if (before) await page.setViewportSize(before);
  }
}
