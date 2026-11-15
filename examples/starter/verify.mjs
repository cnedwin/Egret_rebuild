// SPDX-License-Identifier: Apache-2.0
// Checks the starter example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/starter/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/starter/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'starter-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backends: [], cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretStarterExample.readSnapshot());
const drawn = page => page.waitForTimeout(80);
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 270];
}
const clickAt = async (page, place) => { const [x, y] = await at(page, place); await page.mouse.click(x, y); };
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
async function scenario(name, context, body, query = '?backend=webgl2&manual', before) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    if (before) await page.addInitScript(before);
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/starter/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretStarterExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined, await page.textContent('#status')); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } }, phone = { ...devices['Pixel 7'] };
const until = async (page, test, label, ms = 8000) => { const end = Date.now() + ms; for (;;) { const now = await read(page); if (test(now)) return now; if (Date.now() > end) throw new Error('timed out waiting for ' + label + ': ' + JSON.stringify(now)); await page.waitForTimeout(50); } };
const HERO = '4a7bd0', COIN = 'f0c030', CLEAR = '1b1f2a';

await scenario('webgl2: the stage shows the square and five coins, each in its own colour', desktop, async page => {
  const now = await until(page, s => s.frames >= 2, 'two frames');
  assert.deepEqual([now.backend, now.score, now.coins.length, now.hero], ['webgl2', 0, 5, { x: 40, y: 135 }]);
  assert.equal(await colour(page, [40, 135]), HERO);
  for (const place of now.coins) assert.equal(await colour(page, place), COIN, 'coin at ' + place);
  assert.equal(await colour(page, [240, 30]), CLEAR);
}, '?backend=webgl2');

await scenario('webgl2: a click sends the square to that place, where it picks up the coin and stops', desktop, async page => {
  await until(page, s => s.frames >= 2, 'two frames');
  const [x, y] = await at(page, [240, 135]);
  await page.mouse.click(x, y);
  const now = await until(page, s => s.score === 1 && s.hero.x === 240 && s.hero.y === 135, 'the square at the middle coin');
  assert.equal(now.coins.length, 4);
  await drawn(page);
  // The coin is gone and the square stands where it was.
  assert.equal(await colour(page, [240, 135]), HERO);
  assert.equal(await colour(page, [40, 135]), CLEAR);
  // The score on the stage follows: new words were drawn after the first ones.
  const later = await until(page, s => s.label === '金币 1 / 5' && s.labelShown >= 2, 'the new score drawn');
  assert.equal(later.failure, undefined);
}, '?backend=webgl2');

await scenario('webgl2: the arrow keys walk the square, the walls stop it, and the button starts again', desktop, async page => {
  await until(page, s => s.frames >= 2, 'two frames');
  await page.focus('#scene');
  await page.keyboard.down('ArrowLeft');
  const stopped = await until(page, s => s.hero.x === 12, 'the left wall');
  await page.keyboard.up('ArrowLeft');
  assert.equal(stopped.hero.y, 135);
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight');
  const picked = await until(page, s => s.score >= 1, 'the upper left coin');
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
  assert.ok(picked.coins.every(place => place[0] !== 80 || place[1] !== 60), JSON.stringify(picked.coins));
  await page.click('#reset');
  const again = await until(page, s => s.score === 0 && s.coins.length === 5, 'a new start');
  assert.deepEqual(again.hero, { x: 40, y: 135 });
}, '?backend=webgl2');

await scenario('webgl2: with ?stats a panel over the canvas counts the frames and what one holds', desktop, async page => {
  const now = await until(page, s => s.frames >= 2 && s.stats?.fps > 0 && s.stats.commands === 7, 'a refreshed panel');
  // The square and five coins are six rectangles, and the score is an image on a page of its own: two triangles each.
  assert.deepEqual([now.stats.commands, now.stats.triangles, now.stats.geometries, now.stats.pages], [7, 14, 0, 1]);
  assert.ok(now.stats.frames >= 2 && now.stats.pendingFrames <= 2);
  const text = await page.evaluate(() => document.body.lastElementChild.textContent);
  assert.match(text, /^webgl2\nfps \d+\.\d  longest \d+\.\d ms\ncommands 7  triangles 14\n/);
}, '?backend=webgl2&stats');

// Left to choose, the page asks the browser for a WebGPU adapter before it touches the canvas. The two ways of having
// none are checked here. The way of having one is not: this browser's software WebGPU adapter loses its device or never
// finishes a frame, with ?backend=webgpu as well, so a page that chose it here says nothing about the choice.
for (const [label, before] of [
  ['a browser without WebGPU', () => { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }); }],
  ['a browser whose WebGPU gives no adapter', () => { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: async () => null }), configurable: true }); }],
]) await scenario('without ?backend, ' + label + ' is given WebGL2 and draws', desktop, async page => {
  const now = await until(page, s => s.frames >= 2, 'two frames');
  assert.equal(now.backend, 'webgl2');
  assert.equal(now.stats, undefined);
}, '', before);

await scenario('webgl2: an image is loaded by its address and counts the taps on it; a coin fades when it is picked up', desktop, async page => {
  let now = await until(page, s => s.frames >= 2, 'two frames');
  assert.equal(now.taps, 0);
  // The image is 32 by 16 at the right of the top, two small figures on nothing: one of them is drawn at (445, 14),
  // and a click anywhere on the image's rectangle is a tap, on a figure or between them.
  assert.notEqual(await colour(page, [445, 14]), CLEAR, 'the image is drawn');
  await clickAt(page, [456, 16]);
  now = await until(page, s => s.taps === 1, 'one tap');
  // The score is text on the stage, in Chinese: it was drawn once at the start.
  assert.equal(now.label, '金币 0 / 5'); assert.ok(now.labelShown >= 1, 'the label was drawn');
  // A click beside it is no tap on it.
  await clickAt(page, [420, 40]);
  await until(page, s => s.frames > now.frames + 2, 'frames after the second click');
  assert.equal((await read(page)).taps, 1);
}, '?backend=webgl2&image=/examples/resource-scene/assets/atlas-v1.png');

for (const [fit, expected] of [['contain', [400, 225, 0, 37.5]], ['cover', [533.33, 300, -66.67, 0]], ['stretch', [400, 300, 0, 0]]])
  await scenario('webgl2: with ?fit=' + fit + ' the canvas fills its element that way, and a click still lands where it is seen', desktop, async page => {
    await until(page, s => s.frames >= 2, 'two frames');
    const box = await page.evaluate(() => { const canvas = document.querySelector('#scene').getBoundingClientRect(), holder = document.querySelector('#scene').parentElement.getBoundingClientRect(); return [canvas.width, canvas.height, canvas.left - holder.left, canvas.top - holder.top]; });
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(box[i] - expected[i]) < 0.6, fit + ': ' + box + ' is not ' + expected);
    // An off-center point exposes projection errors that a centered tap would miss. The browser
    // can round coordinates when it dispatches the pointer event, especially with fractional CSS sizes.
    const target = [246, 142], xTolerance = 480 / box[0], yTolerance = 270 / box[1];
    await clickAt(page, target);
    await until(page, s => s.score === 1 && Math.abs(s.hero.x - target[0]) < xTolerance
      && Math.abs(s.hero.y - target[1]) < yTolerance, 'the square near the off-center input');
  }, '?backend=webgl2&fit=' + fit);

await scenario('on a phone a tap sends the square to a coin', phone, async page => {
  await until(page, s => s.frames >= 2, 'two frames');
  const [x, y] = await at(page, [80, 210]);
  await page.touchscreen.tap(x, y);
  // A finger lands within a unit of the place asked for, and the square stops where it landed.
  const now = await until(page, s => s.score === 1 && Math.abs(s.hero.x - 80) < 1.5 && Math.abs(s.hero.y - 210) < 1.5, 'the square on the lower left coin');
  assert.equal(now.coins.length, 4);
}, '?backend=webgl2');

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
