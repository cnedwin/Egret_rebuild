// SPDX-License-Identifier: Apache-2.0
// Bitmap fonts: a title and a dialog in a BMFont read from its XML form, and a score in Egret's own form of frames.
// Both fonts are drawn by the page from a small pixel alphabet below, so the repository carries no picture.
import { createAssetRef, createAssetType, createEngineForProfile, createImageData2D, createTexture, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createBitmapText, parseBitmapFont } from '@egret/engine/bitmapfont';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x1d2333, clearAlpha: 1 });
let failure;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };

// Five by seven pixels a character: '#' is drawn.
const ALPHABET = {
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.', '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.', '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...', '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..', 'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#', 'B': '####.|#...#|#...#|####.|#...#|#...#|####.',
  'C': '.###.|#...#|#....|#....|#....|#...#|.###.', 'D': '###..|#..#.|#...#|#...#|#...#|#..#.|###..', 'E': '#####|#....|#....|####.|#....|#....|#####',
  'F': '#####|#....|#....|####.|#....|#....|#....', 'G': '.###.|#...#|#....|#.###|#...#|#...#|.####', 'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  'I': '.###.|..#..|..#..|..#..|..#..|..#..|.###.', 'J': '..###|...#.|...#.|...#.|...#.|#..#.|.##..', 'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  'L': '#....|#....|#....|#....|#....|#....|#####', 'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', 'N': '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.', 'P': '####.|#...#|#...#|####.|#....|#....|#....', 'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#', 'S': '.####|#....|#....|.###.|....#|....#|####.', 'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.', 'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', 'W': '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#', 'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', 'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
  '.': '.....|.....|.....|.....|.....|.##..|.##..', ',': '.....|.....|.....|.....|.##..|..#..|.#...', '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', ':': '.....|.##..|.##..|.....|.##..|.##..|.....', '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....', "'": '..#..|..#..|.#...|.....|.....|.....|.....',
};
/** The columns and rows a character uses, so that each is as wide as it is drawn. */
function extent(rows) {
  let left = 5, right = -1, top = 7, bottom = -1;
  rows.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === '#') { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); } }));
  return { left, right, top, bottom };
}
/**
 * Paints the characters into one image, `scale` pixels to a dot, and says where each went. `paint` gives the colour of a dot,
 * and an optional shade below each dot makes the face of the score.
 */
function atlas(characters, scale, paint) {
  const across = 16, cell = 7 * scale + 2, width = 256, height = Math.ceil(characters.length / across) * cell, pixels = new Uint8Array(width * height * 4), placed = new Map();
  characters.forEach((character, index) => {
    const rows = ALPHABET[character].split('|'), e = extent(rows), x0 = (index % across) * cell, y0 = Math.floor(index / across) * cell;
    for (let y = e.top; y <= e.bottom; y++) for (let x = e.left; x <= e.right; x++) {
      if (rows[y][x] !== '#') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const at = ((y0 + (y - e.top) * scale + dy) * width + x0 + (x - e.left) * scale + dx) * 4;
        pixels.set(paint(dy, scale), at);
      }
    }
    placed.set(character, { x: x0, y: y0, width: (e.right - e.left + 1) * scale, height: (e.bottom - e.top + 1) * scale, left: e.left, top: e.top, right: e.right });
  });
  return { image: createTexture(createImageData2D({ width, height, pixels })), placed };
}
async function lease(name, texture) {
  const type = createAssetType('example-bitmap-font-' + name, value => value === texture);
  engine.assets.register(type, { load: async () => texture, dispose: () => texture.dispose() });
  return scope.use(await engine.assets.acquire(createAssetRef(type, name)));
}

// The first font: BMFont's XML, as a generator writes it, white so that a text tints it. Kerning brings a few pairs closer.
const letters = Object.keys(ALPHABET), plain = atlas(letters, 2, () => [255, 255, 255, 255]);
const attribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const xml = ['<?xml version="1.0"?>', '<font>', '  <info face="Hall Pixel" size="14"/>', '  <common lineHeight="18" base="14" scaleW="256" scaleH="' + plain.image.height + '" pages="1"/>',
  '  <pages><page id="0" file="hall-pixel.png"/></pages>', '  <chars count="' + (letters.length + 1) + '">', '    <char id="32" x="0" y="0" width="0" height="0" xoffset="0" yoffset="0" xadvance="6" page="0"/>',
  ...letters.map(c => { const p = plain.placed.get(c); return '    <char id="' + c.codePointAt(0) + '" x="' + p.x + '" y="' + p.y + '" width="' + p.width + '" height="' + p.height + '" xoffset="0" yoffset="' + (p.top * 2 + 2) + '" xadvance="' + (p.width + 2) + '" page="0" letter="' + attribute(c) + '"/>'; }),
  '  </chars>', '  <kernings count="3">', '    <kerning first="65" second="86" amount="-2"/>', '    <kerning first="84" second="65" amount="-2"/>', '    <kerning first="76" second="84" amount="-2"/>', '  </kernings>', '</font>'].join('\n');
const hallPixel = parseBitmapFont(xml), hallPage = await lease('hall-pixel', plain.image);

// The second font: Egret's own form of frames, gold with a darker lower half to each dot, three pixels to a dot.
const digits = [...'0123456789+'], gold = atlas(digits, 3, (dy, scale) => dy < scale - 1 ? [242, 193, 78, 255] : [184, 134, 43, 255]);
const frames = {};
for (const c of digits) { const p = gold.placed.get(c); frames[c] = { x: p.x, y: p.y, w: p.width, h: p.height, offX: 0, offY: p.top * 3, sourceW: p.width + 3, sourceH: 7 * 3 }; }
const scoreFont = parseBitmapFont(JSON.stringify({ file: 'score.png', frames })), scorePage = await lease('score', gold.image);

const panel = engine.stage.addChild(scope.use(new Sprite()));
panel.graphics.beginFill(0x2b3550).drawRect(20, 70, 300, 180).endFill();
panel.graphics.beginFill(0x3a466a).drawRect(340, 70, 120, 60).endFill();

const title = scope.use(createBitmapText({ font: hallPixel, pages: [hallPage], text: 'BITMAP FONTS' }));
title.display.x = 20; title.display.y = 16; title.display.scaleX = 2; title.display.scaleY = 2;
engine.stage.addChild(title.display);
// The score keeps its right edge where it is: a box as wide as the panel, its line aligned to the right of it.
const score = scope.use(createBitmapText({ font: scoreFont, pages: [scorePage], text: '0', maxWidth: 100, align: 'right' }));
score.display.x = 350; score.display.y = 90;
engine.stage.addChild(score.display);
const TEXTS = [
  "THE OLD MASTER SAYS: PRACTISE THE SWORD A THOUSAND TIMES, AND THE SWORD WILL PRACTISE YOU. COME BACK TOMORROW!",
  'A LETTER FROM THE VALLEY OF WAVES ~ THE SIGN IS NOT IN THIS FONT, AND IS SHOWN AS A QUESTION MARK.',
  'SHORT.',
];
let which = 0;
const dialog = scope.use(createBitmapText({ font: hallPixel, pages: [hallPage], text: TEXTS[0], maxWidth: 280, color: 0xe8e0c8, lineSpacing: 4 }));
dialog.display.x = 30; dialog.display.y = 82;
engine.stage.addChild(dialog.display);

let points = 0;
const ALIGNS = ['left', 'center', 'right'];
const act = run => () => { try { run(); show(); } catch (cause) { fail(cause); show(); } };
document.querySelector('#add').addEventListener('click', act(() => { points += 100; score.text = String(points); }));
document.querySelector('#align').addEventListener('click', act(() => { dialog.align = ALIGNS[(ALIGNS.indexOf(dialog.align) + 1) % 3]; }));
document.querySelector('#tint').addEventListener('click', act(() => { dialog.color = dialog.color === 0xe8e0c8 ? 0x8fd18f : 0xe8e0c8; }));
document.querySelector('#next').addEventListener('click', act(() => { which = (which + 1) % TEXTS.length; dialog.text = TEXTS[which]; }));

/** Where a text's characters are on the stage, for checks that read the picture. */
const placed = text => text.layout.glyphs.map(g => ({ char: String.fromCodePoint(g.codePoint), x: text.display.x + g.x * text.display.scaleX, y: text.display.y + g.y * text.display.scaleY,
  width: g.width * text.display.scaleX, height: g.height * text.display.scaleY }));
function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Score / 得分 ' + points + ' · align / 对齐 ' + dialog.align + ' · lines / 行数 ' + dialog.layout.lines.length + ' · missing / 缺字 ' + dialog.layout.missing;
  stateView.textContent = JSON.stringify({ fonts: [hallPixel.format, scoreFont.format], lines: dialog.layout.lines.map(line => line.text) }, null, 2);
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
function tick() { try { show(); } catch (cause) { fail(cause); } if (scope.state === 'open') requestAnimationFrame(tick); }
requestAnimationFrame(tick);

globalThis.__egretBitmapFontExample = {
  readSnapshot: () => ({
    formats: [hallPixel.format, scoreFont.format], glyphs: hallPixel.glyphs.length,
    title: { width: title.width, glyphs: placed(title) },
    score: { text: score.text, x: score.display.x, line: score.layout.lines[0], glyphs: placed(score) },
    dialog: { text: dialog.text, align: dialog.align, color: dialog.color, x: dialog.display.x, maxWidth: dialog.maxWidth, missing: dialog.layout.missing, height: dialog.height,
      lines: dialog.layout.lines.map(line => ({ text: line.text, x: line.x, width: line.width, y: line.y })), glyphs: placed(dialog) },
    meshes: title.meshes.length + score.meshes.length + dialog.meshes.length, failure,
  }),
};
show();
