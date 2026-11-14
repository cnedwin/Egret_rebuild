// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/tilemap/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/tilemap/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'tilemap-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => { const s = globalThis.__egretTileMapExample.readSnapshot(); delete s.toScreen; delete s.detail; return s; });
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
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/tilemap/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretTileMapExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
const run = (page, seconds, keys = [], fps = 60) => page.evaluate(([s, k, f]) => globalThis.__egretTileMapExample.run(s, k, f), [seconds, keys, fps]);
// The colours of the picture: the disciple, the dark gate, the red wall, the paving, the hills and the sky.
const cell = (page, column, row) => page.evaluate(([c, r]) => globalThis.__egretTileMapExample.cellCenter(c, r), [column, row]);
const detail = (page, column, row) => page.evaluate(([c, r]) => globalThis.__egretTileMapExample.readSnapshot().detail(c, r), [column, row]);
/** The colours the page paints its tiles in, as the canvas shows them: grass, path, water, wall, the hall's floor, flowers, a tree's leaves. */
const GRASS = ['5f8f4e', '6a9a56', '578746', '6f9f5c'], PATH = 'c8b07a', WATER = ['3f74a8', '36689a'], WALL = '7b2d26', FLOWERS = 'e46b8a', HERO = '1f3a93';

await scenario('the map is read from its Tiled JSON and the first frame shows the disciple on the path, among grass', desktop, async page => {
  const now = await read(page);
  assert.equal(now.title, 'The sect courtyard');
  assert.deepEqual([now.cell.column, now.cell.row, now.zoom], [31, 8, 2]);
  assert.equal(await colour(page, [Math.round(now.onScreen.x), Math.round(now.onScreen.y - 4)]), HERO);
  // A step to the left of the disciple is the path; further left, grass.
  const path = await cell(page, 30, 9), grass = await cell(page, 26, 9);
  assert.equal(await colour(page, [Math.round(path.x) - 4, Math.round(path.y) + 4]), PATH);
  assert.ok(GRASS.includes(await colour(page, [Math.round(grass.x), Math.round(grass.y) + 4])));
  // Only the chunks in view are drawn: a few of the 36 there are (three layers of four by three chunks).
  assert.ok(now.shown > 0 && now.shown < now.chunks, now.shown + ' of ' + now.chunks);
  assert.equal(now.chunks, 36);
});

await scenario('the wall and the river stop the disciple, who slides along them', desktop, async page => {
  // Away from the gate, which is open, to the left first.
  await run(page, 1.2, ['ArrowLeft']);
  await run(page, 3, ['ArrowUp']);
  let now = await read(page);
  // The wall runs along row 2: the disciple stops in the row below it.
  assert.equal(now.cell.row, 3);
  await run(page, 1, ['ArrowUp', 'ArrowLeft']);
  const slid = await read(page);
  assert.ok(slid.hero.x < now.hero.x - 50 && slid.cell.row === 3, JSON.stringify(slid.cell));
  // Beside the disciple, whose head reaches into the row of the wall.
  const wall = await cell(page, slid.cell.column + 2, 2);
  assert.equal(await colour(page, [Math.round(wall.x), Math.round(wall.y)]), WALL);
});

await scenario('the camera follows to the edge of the map, drawing other chunks as it goes', desktop, async page => {
  const before = await read(page);
  await run(page, 6, ['ArrowRight']);
  const after = await read(page);
  assert.ok(after.hero.x > before.hero.x + 300, 'walked ' + (after.hero.x - before.hero.x));
  assert.ok(after.view.x > before.view.x + 200);
  assert.ok(after.shown > 0 && after.shown < after.chunks);
  assert.equal(await colour(page, [Math.round(after.onScreen.x), Math.round(after.onScreen.y - 4)]), HERO);
});

await scenario('zoomed out the whole yard and its river are in view, and every chunk that shows is drawn', desktop, async page => {
  await page.click('#zoom-out'); await page.click('#zoom-out'); await run(page, 0.5);
  const now = await read(page);
  assert.equal(now.zoom, 0.5);
  assert.ok(now.shown > 6, String(now.shown));
  // The river at column 10 runs through rows 28 to 30.
  const river = await cell(page, 10, 29);
  assert.ok(WATER.includes(await colour(page, [Math.round(river.x), Math.round(river.y)])), 'the river');
});

await scenario('a press plants flowers on grass, a second takes them away, and the path is left alone', desktop, async page => {
  const grass = await cell(page, 27, 9), path = await cell(page, 31, 10);
  const press = async point => { const [x, y] = await at(page, [point.x, point.y]); await page.mouse.click(x, y); await drawn(page); };
  await press(grass);
  assert.equal(await detail(page, 27, 9), 13);
  assert.equal(await colour(page, [Math.round(grass.x) + 4, Math.round(grass.y) + 4]), FLOWERS);
  await press(grass);
  assert.equal(await detail(page, 27, 9), 0);
  assert.ok(GRASS.includes(await colour(page, [Math.round(grass.x) + 4, Math.round(grass.y) + 4])));
  await press(path);
  assert.deepEqual([await detail(page, 31, 10), (await read(page)).planted], [0, 2]);
});

await scenario('the trees are a layer of their own that can be hidden', desktop, async page => {
  await run(page, 0.1);
  const before = await read(page);
  await page.click('#trees');
  assert.equal(await page.getAttribute('#trees', 'aria-pressed'), 'false');
  await page.click('#trees');
  assert.equal(await page.getAttribute('#trees', 'aria-pressed'), 'true');
  assert.equal((await read(page)).shown, before.shown);
});

await scenario('in real time the keyboard walks the disciple', desktop, async page => {
  await page.focus('#scene');
  const before = await read(page);
  await page.keyboard.down('KeyS'); await page.waitForTimeout(600); await page.keyboard.up('KeyS'); await page.waitForTimeout(300);
  const after = await read(page);
  assert.ok(after.hero.y - before.hero.y > 30, 'walked ' + (after.hero.y - before.hero.y));
}, '?backend=webgl2');

await scenario('on a phone the page shows the map and a tap plants flowers', { ...devices['Pixel 7'] }, async page => {
  const grass = await cell(page, 27, 9), [x, y] = await at(page, [grass.x, grass.y]);
  await page.touchscreen.tap(x, y); await drawn(page);
  assert.equal(await detail(page, 27, 9), 13);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
