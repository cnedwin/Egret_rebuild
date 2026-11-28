// SPDX-License-Identifier: Apache-2.0
// Public BrowserGame conveniences; controlled canvas/GL ports establish API, measured
// layout, lifetime and reuse, not native font coverage or rendered pixel quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserGame } from '@egret/engine/web/game';
import { createBitmapText } from '@egret/engine/bitmapfont';
import { glPorts } from './fixtures/gl-shared-rendering.mjs';
import { realm } from './canvas-text-provider-double-helpers.mjs';

async function fixture(t) {
  const strokes = [];
  const double = realm(t, {
    measure(text, call) {
      const size = Number(/([\d.]+)px/.exec(call.state.font)?.[1] ?? 10);
      const width = Array.from(text).reduce(
        (sum, ch) => sum + size * (/[^\x00-\x7f]/.test(ch) ? 1 : ch === ' ' ? 0.25 : 0.5),
        0
      );
      return {
        width,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
        actualBoundingBoxAscent: size * 0.7,
        actualBoundingBoxDescent: size * 0.1,
        fontBoundingBoxAscent: size * 0.8,
        fontBoundingBoxDescent: size * 0.2
      };
    }
  });
  double.Context.prototype.strokeText = function (...args) {
    strokes.push(args);
  };
  for (const [key, value] of Object.entries({
    createImageBitmap() {},
    ImageBitmap: class {
      close() {}
    }
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    t.after(() => (old ? Object.defineProperty(globalThis, key, old) : Reflect.deleteProperty(globalThis, key)));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const { canvas } = glPorts();
  canvas.ownerDocument = double.document;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 180 });
  const game = await createBrowserGame({
    canvas,
    width: 320,
    height: 180,
    backend: 'webgl2',
    pixelRatio: 1,
    autoStart: false,
    pointer: false,
    keyboard: false
  });
  // Dispose before the controlled realm's globals are restored.
  return { game, double, strokes };
}

test('BrowserGame paragraph labels wrap, clamp, expose committed metrics and snapshot an ordered family list', async t => {
  const { game, double } = await fixture(t);
  try {
    const owner = game.engine.createScope();
    const families = ['A, B', 'sans-serif'];
    const pending = game.createParagraphLabel({
      scope: owner,
      text: '一二三四五六七八九十甲乙丙',
      width: 40,
      fontFamilies: families,
      fontSize: 10,
      locale: 'zh'
    });
    families[0] = 'unwanted';
    const label = await pending;
    game.stage.addChild(label.display);
    await label.ready;
    assert.equal(label.metrics.width, 40);
    assert.equal(label.metrics.lines.length, 4);
    assert.equal(label.bounds.height, label.metrics.height);
    assert.equal(label.bounds.width, 40);
    assert.ok(double.measurements.some(call => call.state.font === '10px "A, B", sans-serif'));
    assert.ok(double.measurements.every(call => !call.state.font.includes('unwanted')));

    label.set({ maxLines: 1 });
    const old = label.ready;
    label.set({ text: '甲乙丙丁戊己庚辛壬癸', width: 50, maxLines: 2 });
    await assert.rejects(old, { code: 'PARAGRAPH_STALE' });
    await label.ready;
    assert.equal(label.metrics.lines.length, 2);
    assert.equal(label.metrics.truncated, false);
    assert.equal(label.bounds.width, 50);
    label.set({ maxLines: 1 });
    await label.ready;
    assert.equal(label.metrics.truncated, true);
    assert.equal(label.metrics.lines.length, 1);
    assert.ok(double.fills.some(call => call.args[0] === '…'));
    assert.throws(() => label.set({ width: NaN }), { code: 'PARAGRAPH_REQUEST_INVALID' });
    assert.equal(label.text, '甲乙丙丁戊己庚辛壬癸');
    label.set({ maxLines: undefined });
    await label.ready;
    assert.equal(label.metrics.lines.length, 2);
    assert.equal(label.metrics.truncated, undefined);
    owner.dispose();
    assert.equal(label.display.isDisposed, true);
  } finally {
    await game.dispose();
  }
});

test('legacy one-family labels retain literal comma spelling rather than changing their cache contract', async t => {
  const { game, double } = await fixture(t);
  try {
    const label = await game.createLabel({ text: 'AB', fontFamily: 'A, B', fontSize: 10 });
    await label.ready;
    assert.ok(double.checks.some(([font]) => font === 'normal 400 10px "A, B"'));
  } finally {
    await game.dispose();
  }
});

test('one generated fixed-advance glyph atlas serves changing counters without new font rasterization', async t => {
  const { game, double, strokes } = await fixture(t);
  try {
    const owner = game.engine.createScope();
    const glyphs = await game.createGlyphFont({
      scope: owner,
      characters: '0123456789:/+-',
      fontFamilies: ['A, B', 'sans-serif'],
      fontSize: 20,
      fontWeight: 700,
      strokeWidth: 1,
      strokeColor: 0x241637
    });
    assert.equal(glyphs.pages.length, 1);
    assert.equal(glyphs.font.glyphs.length, 14);
    assert.equal(new Set(glyphs.font.glyphs.map(glyph => glyph.xAdvance)).size, 1);
    const page = glyphs.pages[0];
    const counters = [
      owner.use(createBitmapText({ ...glyphs, text: '00:00' })),
      owner.use(createBitmapText({ ...glyphs, text: '0/100', color: 0xaa7733 }))
    ];
    for (const counter of counters) game.stage.addChild(counter.display);
    assert.ok(double.reads.length > 0);
    assert.ok(double.fills.length >= 14);
    assert.ok(strokes.length >= 14);
    assert.ok(double.measurements.some(call => call.state.font.includes('"A, B", sans-serif')));
    const before = [double.reads.length, double.fills.length, double.measurements.length];
    const width = counters[0].width,
      firstMesh = counters[0].meshes[0];
    for (let i = 0; i < 120; i++) {
      counters[0].text = '00:' + String(i % 60).padStart(2, '0');
      counters[1].text = String(i) + '/100';
      assert.equal(counters[0].width, width);
      assert.equal(counters[0].meshes[0], firstMesh);
      assert.equal(counters[0].layout.missing, 0);
    }
    assert.deepEqual([double.reads.length, double.fills.length, double.measurements.length], before);
    assert.equal(glyphs.pages[0], page);
    assert.ok(page.value.width > 0);
    // Borrowers are retired before their owner releases the page.
    owner.dispose();
    assert.equal(counters[0].state, 'closed');
    assert.throws(() => page.value, { code: 'ASSET_LEASE_RELEASED' });
  } finally {
    await game.dispose();
  }
});

test('the public conveniences refuse ambiguous or unbounded requests before raster work', async t => {
  const { game, double } = await fixture(t);
  try {
    await assert.rejects(game.createParagraphLabel({ width: 100, fontFamily: 'Arial', fontFamilies: ['serif'] }));
    await assert.rejects(game.createGlyphFont({ characters: '00', fontSize: 20 }));
    await assert.rejects(game.createGlyphFont({ characters: '0\n1', fontSize: 20 }));
    await assert.rejects(game.createGlyphFont({ characters: '123', fontSize: 100000 }));
    assert.equal(double.reads.length, 0);
  } finally {
    await game.dispose();
  }
});
