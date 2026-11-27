// SPDX-License-Identifier: Apache-2.0
// CPU UNIT: private layout helper only; public game.confirm is exercised in the browser example.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareConfirmCopy, planConfirmLayout } from '../packages/engine/dist/web/playConfirm.js';
import { planView } from '@egret/engine/web/view';

// A deterministic measure with wide and narrow glyphs, not a replacement for browser raster evidence.
const measure = (word, size, bold) =>
  [...word].reduce((w, c) => w + size * (/[^\u0000-\u007f]|[MW]/u.test(c) ? 0.95 : 0.53) * (bold ? 1.03 : 1), 0);
const field = (w, h) => ({ x: 0, y: 0, width: w, height: h });
const plan = (copy, w, h, cssScale = 1) =>
  planView(planConfirmLayout(copy, { width: w, height: h, cssScale }, measure), {
    safe: field(w, h),
    screen: field(w, h),
    orientation: w >= h ? 'landscape' : 'portrait'
  });
const part = (p, name) => p.parts[p.names.get(name)];
const coded = code => error => error?.code === code;

test('PC01 short default confirmation retains its legacy width, height, labels and button geometry', () => {
  const p = plan(prepareConfirmCopy('Sell?', {}), 800, 600);
  assert.deepEqual(p.parts[0].rect, { x: 180, y: 216, width: 440, height: 168 });
  assert.equal(part(p, 'question').part.text, 'Sell?');
  assert.equal(part(p, 'no').part.text, 'Cancel');
  assert.equal(part(p, 'yes').part.text, 'OK');
  assert.deepEqual([part(p, 'no').rect.height, part(p, 'yes').rect.height], [48, 48]);
  assert.equal(part(p, 'no').part.color, 0x475569);
});

test('PC02 narrow long title, question and labels wrap with original semantics and a custom skin', () => {
  const source =
    'Sell the extraordinary dragon treasure for twenty-eight pearls? Confirming will remove it permanently.';
  const no = 'Keep the treasure in the inventory';
  const yes = 'Sell this rare treasure for twenty-eight pearls';
  const copy = prepareConfirmCopy(source, {
    title: '\u4f60\u771f\u7684\u8981\u51fa\u552e\u8fd9\u4e2a\u73cd\u8d35\u7684\u6cd5\u5b9d\u5417',
    yes,
    no,
    skin: { panel: 0x123456, button: 0x996633, text: 0xffe080 },
    noColor: 0x225544
  });
  const p = plan(copy, 280, 550);
  assert.equal(p.skin.panel, 0x123456);
  assert.equal(p.skin.button, 0x996633);
  assert.equal(part(p, 'no').part.color, 0x225544);
  for (const [name, raw] of [
    ['question', source],
    ['no', no],
    ['yes', yes]
  ]) {
    const item = part(p, name);
    assert.ok(item.part.text.includes('\n'), name);
    assert.equal(raw, name === 'question' ? copy.message : copy[name]);
    const size = item.part.size ?? p.skin.size;
    const width = item.rect.width - (name === 'question' ? 0 : 16);
    for (const line of item.part.text.split('\n'))
      assert.ok(measure(line, size, name !== 'question') <= width + 1, line);
  }
  for (const name of ['yes', 'no']) {
    const box = part(p, name).rect;
    assert.ok(box.width >= 44 && box.height >= 44);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 280 && box.y + box.height <= 550);
  }
});

test('PC03 a long question scrolls in its own native panel while both actions remain inside a short safe area', () => {
  const source = Array.from(
    { length: 90 },
    (_, i) => 'Very long line ' + i + ' explaining an important condition.'
  ).join('\n');
  const copy = prepareConfirmCopy(source, {
    title: 'Important notice',
    yes: 'Continue with this decision',
    no: 'Cancel the decision'
  });
  const p = plan(copy, 420, 320, 1);
  const body = part(p, 'confirmCopy');
  assert.equal(body.part.scroll, 'vertical');
  assert.equal(copy.message, source);
  assert.ok(part(p, 'question').part.text.startsWith('Very long line 0'));
  for (const name of ['yes', 'no']) {
    const box = part(p, name).rect;
    assert.ok(box.y >= body.rect.y + body.rect.height);
    assert.ok(box.height >= 44 && box.y + box.height <= 320);
  }
  assert.ok(
    p.parts.some(item => item.parent === body.index && item.rect.y + item.rect.height > body.rect.y + body.rect.height)
  );
});

test('PC04 options are validated and snapshotted before queued dialogs can mutate their theme', () => {
  for (const bad of [
    { yes: 3 },
    { skin: null },
    { skin: [] },
    { skin: { button: -1 } },
    { skin: { fake: 1 } },
    { noColor: Infinity },
    { noColor: null }
  ])
    assert.throws(() => prepareConfirmCopy('question', bad), coded('UI_VIEW_BINDING_INVALID'));
  const options = { yes: 'Original', skin: { button: 0x996633 } };
  const copy = prepareConfirmCopy('question', options);
  options.yes = 'changed';
  options.skin.button = 0x010101;
  assert.equal(copy.yes, 'Original');
  assert.equal(copy.skin.button, 0x996633);
});

test('PC05 the physically tiny safe area keeps its action boxes contained without pretending they are touch-sized', () => {
  for (const [w, h] of [
    [40, 50],
    [1, 1],
    [0, 0]
  ]) {
    const p = plan(prepareConfirmCopy('This text would not fit', {}), w, h);
    for (const name of ['no', 'yes']) {
      const r = part(p, name).rect;
      assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.width <= w + 1e-9 && r.y + r.height <= h + 1e-9);
    }
  }
});
