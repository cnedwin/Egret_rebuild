// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/particles/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/particles/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'particles-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretParticlesExample.readSnapshot());
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
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/particles/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretParticlesExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
const run = (page, seconds, fps = 60) => page.evaluate(([s, f]) => globalThis.__egretParticlesExample.run(s, f), [seconds, fps]);
// The colours of the picture: the disciple, the dark gate, the red wall, the paving, the hills and the sky.
/** How much warmer than the background a place is: the red channel against the night blue. */
const red = hex => parseInt(hex.slice(0, 2), 16);
const BACKGROUND = '14161f';

await scenario('the first frame is the night: nothing burns until time passes', desktop, async page => {
  const now = await read(page);
  assert.deepEqual([now.fire.alive, now.petals.alive, now.sparks.alive], [0, 0, 0]);
  assert.equal(await colour(page, [140, 150]), BACKGROUND);
});

await scenario('the brazier burns: flames rise above it, bright at the bottom and red as they fade', desktop, async page => {
  await run(page, 2);
  const now = await read(page);
  assert.ok(now.fire.alive > 60 && now.fire.alive < 120, String(now.fire.alive));
  // Above the brazier it is bright and warm; far to its right the night is untouched.
  const flame = await colour(page, [140, 165]);
  assert.ok(red(flame) > 150, 'the flame: ' + flame);
  assert.equal(await colour(page, [440, 150]), BACKGROUND);
  // The same seed and the same steps give the same picture.
  await page.reload(); await page.waitForFunction(() => globalThis.__egretParticlesExample !== undefined);
  await run(page, 2);
  assert.equal((await read(page)).fire.alive, now.fire.alive);
  assert.equal(await colour(page, [140, 165]), flame);
});

await scenario('the petals fall across the whole width and drift with the wind', desktop, async page => {
  await run(page, 6);
  const now = await read(page);
  assert.ok(now.petals.alive > 40, String(now.petals.alive));
  assert.ok(now.petalsLow > 5, 'some have fallen low: ' + now.petalsLow);
});

await scenario('a press makes sparks where it is pressed, which fall and die out', desktop, async page => {
  const [x, y] = await at(page, [300, 80]);
  await page.mouse.click(x, y); await drawn(page);
  let now = await read(page);
  assert.equal(now.sparks.alive, 80);
  near(now.sparkAt.x, 300, 4.01, 'born at the press'); near(now.sparkAt.y, 80, 4.01, 'born at the press');
  // Before they move they are all within four units of the press: it is bright there.
  assert.ok(red(await colour(page, [300, 80])) > 150, 'the burst is bright');
  await run(page, 1.1);
  now = await read(page);
  assert.equal(now.sparks.alive, 0);
  await page.click('#burst'); await page.click('#burst');
  assert.equal((await read(page)).sparks.alive, 160);
});

await scenario('the fire is put out by its button, and what burns burns out', desktop, async page => {
  await run(page, 1);
  await page.click('#fire');
  assert.equal(await page.getAttribute('#fire', 'aria-pressed'), 'false');
  let now = await read(page);
  assert.ok(now.fire.alive > 0 && now.fire.running === false);
  await run(page, 1.2);
  now = await read(page);
  assert.equal(now.fire.alive, 0);
  assert.equal(await colour(page, [140, 150]), BACKGROUND);
  await page.click('#fire'); await run(page, 0.5);
  assert.ok((await read(page)).fire.alive > 20);
});

await scenario('in real time the streams run by the clock of the page', desktop, async page => {
  await page.waitForTimeout(800);
  const now = await read(page);
  assert.ok(now.fire.alive > 20 && now.fire.time > 0.5, JSON.stringify(now.fire));
}, '?backend=webgl2');

await scenario('on a phone a tap makes sparks', { ...devices['Pixel 7'] }, async page => {
  const [x, y] = await at(page, [200, 100]);
  await page.touchscreen.tap(x, y); await drawn(page);
  assert.equal((await read(page)).sparks.alive, 80);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
