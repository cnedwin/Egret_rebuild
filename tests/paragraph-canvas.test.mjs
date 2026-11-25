// SPDX-License-Identifier: Apache-2.0
// The canvas paragraph provider of @egret/engine/web/paragraph, which needs no WebAssembly, run against a stand-in 2D
// context whose letters have known widths: a Chinese character a whole size, a Latin letter half, a space a quarter.
// Each case lays a paragraph out through a genuine paragraph cache and reads its lines, its geometry and what was
// drawn. Real fonts are compared with the CanvasKit provider in examples/paragraph-canvas/verify.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@egret/engine';
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { createCanvasParagraphProvider } from '@egret/engine/web/paragraph';
import { host } from './helpers.mjs';

const wide = point =>
  (point >= 0x2e80 && point <= 0x9fff) || (point >= 0xff00 && point <= 0xff60) || (point >= 0x3000 && point <= 0x303f);
/** A canvas whose 2D context measures by known widths and records what is filled. */
function standIn() {
  const drawn = [];
  let made = 0;
  const createCanvas = () => {
    made++;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context
    };
    const context = {
      font: '10px sans-serif',
      fillStyle: '#000000',
      textBaseline: 'alphabetic',
      textAlign: 'left',
      transform: [1, 0, 0, 1, 0, 0],
      measureText(text) {
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)[1]);
        let width = 0;
        for (const ch of text) width += ch === ' ' ? size / 4 : wide(ch.codePointAt(0)) ? size : size / 2;
        return {
          width,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: width,
          actualBoundingBoxAscent: size * 0.7,
          actualBoundingBoxDescent: size * 0.1,
          fontBoundingBoxAscent: size * 0.8,
          fontBoundingBoxDescent: size * 0.2
        };
      },
      fillText(text, x, y) {
        drawn.push({ text, x, y, font: this.font, color: this.fillStyle });
      },
      setTransform(...values) {
        this.transform = values;
      },
      clearRect() {},
      getImageData(x, y, w, h) {
        return { data: new Uint8ClampedArray(w * h * 4).fill(255) };
      }
    };
    return canvas;
  };
  return {
    createCanvas,
    drawn,
    get made() {
      return made;
    }
  };
}
const request = changes => ({
  text: '',
  width: 100,
  fontFamilies: ['sans-serif'],
  fontSize: 10,
  locale: 'zh',
  direction: 'ltr',
  fillColor: 0xffffff,
  density: 1,
  textGeometry: true,
  ...changes
});
async function lay(t, changes, options = {}) {
  const engine = await createEngine({ host: host().adapter });
  t.after(() => engine.dispose());
  const canvas = standIn();
  const provider = createCanvasParagraphProvider({ createCanvas: canvas.createCanvas, ...options });
  const cache = createParagraphCache(engine.assets, { provider });
  const paragraph = createParagraph(engine, engine.createScope(), cache);
  paragraph.setRequest(request(changes));
  const metrics = await paragraph.prepare();
  const lines = metrics.lines.map(line => text(changes).slice(line.start, line.end));
  return { metrics, lines, geometry: paragraph.getStatus().geometry, drawn: canvas.drawn, provider };
}
const text = changes => changes.text ?? '';

// Break caught: English cut inside a word, Chinese kept on one line past the width, or a comma that starts a line.
test('PC01 English wraps at spaces, Chinese between characters, and no line starts with a closing mark', async t => {
  // 100 wide at size 10: a Latin letter is 5, a space 2.5, a Chinese character 10.
  let laid = await lay(t, { text: 'Night falls on the river bank tonight' });
  assert.deepEqual(laid.lines, ['Night falls on the ', 'river bank tonight']);
  laid = await lay(t, { text: '一二三四五六七八九十甲乙丙' });
  assert.deepEqual(laid.lines, ['一二三四五六七八九十', '甲乙丙']);
  // The comma after 十 would start the next line, which it may not: 十 goes down with it.
  laid = await lay(t, { text: '一二三四五六七八九十，甲' });
  assert.deepEqual(laid.lines, ['一二三四五六七八九', '十，甲']);
  // An opening mark may not end a line: （ goes down with what it opens.
  laid = await lay(t, { text: '一二三四五六七八九（十）' });
  assert.deepEqual(laid.lines, ['一二三四五六七八九', '（十）']);
  // English and Chinese together: a break between a word and a character is allowed.
  laid = await lay(t, { text: '案卷 Inquest 第一案河边发现尸身' });
  assert.equal(laid.lines.join(''), '案卷 Inquest 第一案河边发现尸身');
  assert.ok(laid.lines.every(line => !/^[，。]/.test(line)));
  // A word longer than the line is cut between letters.
  laid = await lay(t, { text: 'Supercalifragilisticexpialidocious' });
  assert.deepEqual(laid.lines, ['Supercalifragilistic', 'expialidocious']);
});

// Break caught: a hard break lost, CRLF counted as two lines, or the empty line after a final break missing.
test('PC02 hard breaks end lines; CRLF is one; a final break leaves an empty line', async t => {
  let laid = await lay(t, { text: '甲\n\n乙\r\n丙\n' });
  assert.deepEqual(laid.lines, ['甲', '', '乙', '丙', '']);
  assert.deepEqual(
    laid.metrics.lines.map(line => [line.start, line.end]),
    [
      [0, 1],
      [2, 2],
      [3, 4],
      [6, 7],
      [8, 8]
    ]
  );
  laid = await lay(t, { text: '' });
  assert.equal(laid.metrics.lines.length, 1);
  assert.equal(laid.drawn.length, 0, 'nothing to draw');
});

// Break caught: runs drawn in the base colour, a larger run not making its line taller, or an unregistered family.
test('PC03 styled runs keep their colour, size and family; families outside the list are refused', async t => {
  const laid = await lay(t, {
    text: '证物：银簪 Silver',
    runs: [
      { start: 0, end: 3, fillColor: 0xc8a050 },
      { start: 3, end: 5, fontSize: 20, fontFamilies: ['serif'] }
    ]
  });
  const colours = new Map(laid.drawn.map(d => [d.text, d.color]));
  assert.equal(colours.get('证'), '#c8a050');
  assert.equal(colours.get('银'), '#ffffff');
  assert.ok(laid.drawn.find(d => d.text === '银').font.startsWith('20px serif'));
  // The line with the size-20 run is as tall as that font: ascent 16, descent 4.
  assert.equal(laid.metrics.lines[0].height, 20);
  await assert.rejects(
    lay(t, { text: 'x', fontFamilies: ['Noto Sans'] }, { families: ['Noto Serif'] }),
    error => error.code === 'ASSET_LOAD_FAILED' && error.cause?.code === 'PARAGRAPH_FONT_NOT_REGISTERED'
  );
});

// Break caught: alignment ignored, a justified last line stretched, a line lower than the requested height, or a cap
// that shows more lines than asked without an ellipsis.
test('PC04 alignment, justification, a minimum line height, and a line cap with an ellipsis', async t => {
  let laid = await lay(t, { text: '一二三', textAlign: 'center' });
  assert.equal(laid.geometry.lines[0].left, 35);
  laid = await lay(t, { text: '一二三', textAlign: 'right' });
  assert.equal(laid.geometry.lines[0].left, 70);
  laid = await lay(t, { text: 'aa bb cc dd ee ff gg hh ii jj kk', textAlign: 'justify' });
  assert.equal(laid.geometry.lines[0].right - laid.geometry.lines[0].left, 100, 'a full justified line');
  const last = laid.geometry.lines.at(-1);
  assert.ok(last.right - last.left < 100, 'the last line is not stretched');
  laid = await lay(t, { text: '一\n二', lineHeight: 30 });
  assert.deepEqual(
    laid.metrics.lines.map(line => [line.height, line.baseline]),
    [
      [30, 18],
      [30, 48]
    ]
  );
  laid = await lay(t, { text: '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅', maxLines: 2 });
  assert.equal(laid.metrics.truncated, true);
  assert.equal(laid.metrics.lines.length, 2);
  assert.equal(laid.drawn.at(-1).text, '…');
  assert.ok(laid.geometry.lines[1].right <= 100);
  laid = await lay(t, { text: '一二', maxLines: 2 });
  assert.equal(laid.metrics.truncated, false);
});

// Break caught: hits and selections that do not land on the characters drawn.
test('PC05 the geometry answers hits, carets and selections where the characters are drawn', async t => {
  const laid = await lay(t, { text: 'ab 甲乙\n丙' });
  const g = laid.geometry;
  assert.equal(g.lines.length, 2);
  // a 0–5, b 5–10, space 10–12.5, 甲 12.5–22.5, 乙 22.5–32.5; 丙 on the next line.
  assert.deepEqual(
    g.clusters.map(c => [c.start, c.left, c.right, c.lineIndex]),
    [
      [0, 0, 5, 0],
      [1, 5, 10, 0],
      [2, 10, 12.5, 0],
      [3, 12.5, 22.5, 0],
      [4, 22.5, 32.5, 0],
      [6, 0, 10, 1]
    ]
  );
  assert.equal(g.hitTest(14, 5).offset, 3);
  assert.equal(g.hitTest(21, 5).offset, 4);
  assert.equal(g.hitTest(3, 15).offset, 6);
  assert.deepEqual(
    g.getSelectionRects(3, 5).map(r => [r.left, r.right]),
    [[12.5, 32.5]]
  );
  assert.equal(g.getCaret(4).x, 22.5);
  // What was drawn is where the geometry says.
  const drawnAt = new Map(laid.drawn.map(d => [d.text, d.x]));
  assert.equal(drawnAt.get('甲'), 12.5);
});

// Break caught: right-to-left text drawn in the wrong order instead of refused, or a context with no 2D drawing taken.
test('PC06 what it cannot lay out is refused, not drawn wrong', async t => {
  await assert.rejects(
    lay(t, { text: 'abc', direction: 'rtl' }),
    error => error.cause?.code === 'PARAGRAPH_FEATURE_UNSUPPORTED'
  );
  await assert.rejects(lay(t, { text: 'abc שלום' }), error => error.cause?.code === 'PARAGRAPH_FEATURE_UNSUPPORTED');
  assert.throws(
    () => createCanvasParagraphProvider({ createCanvas: () => ({ width: 0, height: 0, getContext: () => null }) }),
    { code: 'PARAGRAPH_BACKEND_UNAVAILABLE' }
  );
  const provider = createCanvasParagraphProvider({ createCanvas: standIn().createCanvas, buildIdentity: 'fonts-v1' });
  assert.match(provider.identity, /^egret\.canvas-paragraph\.v1:/);
  assert.deepEqual(provider.capabilities, { styledRuns: true, textAlign: true, textGeometry: true, maxLines: true });
  provider.dispose();
});
