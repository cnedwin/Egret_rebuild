// SPDX-License-Identifier: Apache-2.0
// Checks the bitmap font example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/bitmap-font/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. Input is injected through the browser's
// automation protocol; no person pressed a key. Colours are read from screenshots of the canvas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/bitmap-font/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'bitmap-font-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretBitmapFontExample.readSnapshot());
const drawn = page => page.waitForTimeout(80);
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 270];
}
/** The colour the page shows at a place of the stage, read from a screenshot the page decodes itself. */
async function colour(page, place) {
  const [x, y] = await at(page, place);
  const shot = (await page.screenshot({ clip: { x: x - 2, y: y - 2, width: 4, height: 4 } })).toString('base64');
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob()), surface = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    surface.drawImage(bitmap, 0, 0);
    const [red, green, blue] = surface.getImageData(1, 1, 1, 1).data;
    return ((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0');
  }, shot);
}
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' is not within ' + tolerance + ' of ' + expected);
async function scenario(name, context, body, query = '?backend=webgl2&manual') {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/bitmap-font/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretBitmapFontExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
// The colours of the picture: the night behind, the white of the title, the dialog's two tints, and the face and shade of the gold digits.
const BACKGROUND = '1d2333', WHITE = 'ffffff', FACE = 'f2c14e', SHADE = 'b8862b';
const channels = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
/** A colour within two of another in each channel: a tint is a product the GPU rounds its own way. */
const close = (actual, expected, label) => assert.ok(channels(actual).every((v, i) => Math.abs(v - channels(expected)[i]) <= 2), label + ': ' + actual + ' is not ' + expected);
const first = (glyphs, char) => { const found = glyphs.find(g => g.char === char); assert.ok(found, 'no ' + char); return found; };
const right = score => score.x + score.line.x + score.line.width;

await scenario('the first frame: a white title, the score at the right of its box, and the dialog wrapped within its width', desktop, async page => {
  const now = await read(page);
  assert.deepEqual([now.formats, now.glyphs, now.meshes], [['xml', 'egret'], 45, 3]);
  // The first dot of the B is a square of four by four on the stage, the font's two pixels a dot doubled by the title's scale.
  const b = first(now.title.glyphs, 'B');
  assert.equal(await colour(page, [b.x + 2, b.y + 2]), WHITE);
  assert.equal(await colour(page, [240, 50]), BACKGROUND);
  assert.deepEqual([now.score.text, right(now.score)], ['0', 450]);
  const lines = now.dialog.lines;
  assert.ok(lines.length >= 4 && lines.every(line => line.width <= 280 && line.x === 0), JSON.stringify(lines));
  assert.equal(lines.map(line => line.text).join(' '), now.dialog.text);
  lines.forEach((line, i) => assert.equal(line.y, i * 22));
  const t = now.dialog.glyphs[0];
  assert.equal(t.char, 'T'); close(await colour(page, [t.x + 1, t.y + 1]), 'e8e0c8', 'the dialog');
});

await scenario('pressing +100 changes the score, which grows to the left of its right edge in gold', desktop, async page => {
  const before = (await read(page)).score.glyphs[0].x;
  for (let i = 0; i < 3; i++) await page.click('#add');
  await drawn(page);
  const now = await read(page);
  assert.deepEqual([now.score.text, right(now.score), now.score.glyphs.length], ['300', 450, 3]);
  assert.ok(now.score.glyphs[0].x < before, 'it grew to the left');
  const three = now.score.glyphs[0];
  assert.equal(await colour(page, [three.x + 1.5, three.y + 1]), FACE);
  assert.equal(await colour(page, [three.x + 1.5, three.y + 2.5]), SHADE);
});

await scenario('the dialog is aligned left, centre and right within its width, and its tint changes', desktop, async page => {
  await page.click('#align'); await drawn(page);
  let now = await read(page);
  assert.equal(now.dialog.align, 'center');
  for (const line of now.dialog.lines) assert.equal(line.x, Math.round((280 - line.width) / 2), line.text);
  await page.click('#align'); await drawn(page);
  now = await read(page);
  assert.equal(now.dialog.align, 'right');
  for (const line of now.dialog.lines) assert.equal(line.x, 280 - line.width, line.text);
  await page.click('#align'); await page.click('#tint'); await drawn(page);
  now = await read(page);
  assert.deepEqual([now.dialog.align, now.dialog.color], ['left', 0x8fd18f]);
  const t = now.dialog.glyphs[0];
  close(await colour(page, [t.x + 1, t.y + 1]), '8fd18f', 'tinted');
});

await scenario('a character the font lacks is drawn as its question mark, kerning brings A and V closer, and a short text is one line', desktop, async page => {
  await page.click('#next'); await drawn(page);
  let now = await read(page);
  assert.equal(now.dialog.missing, 1);
  const sign = first(now.dialog.glyphs, '~'), a = now.dialog.glyphs.findIndex((g, i, all) => g.char === 'A' && all[i + 1]?.char === 'V');
  assert.ok(sign.width > 0 && a >= 0, 'the sign is drawn, and the pair is there');
  // The A is ten pixels wide and moves the pen by twelve; with the pair's kerning the V starts ten after it.
  assert.equal(now.dialog.glyphs[a + 1].x - now.dialog.glyphs[a].x, 10);
  await page.click('#next'); await drawn(page);
  now = await read(page);
  assert.deepEqual([now.dialog.text, now.dialog.lines.length, now.dialog.height, now.dialog.missing], ['SHORT.', 1, 18, 0]);
});

await scenario('on a phone a tap on +100 adds to the score', { ...devices['Pixel 7'] }, async page => {
  await page.tap('#add'); await drawn(page);
  const now = await read(page);
  assert.deepEqual([now.score.text, right(now.score)], ['100', 450]);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
