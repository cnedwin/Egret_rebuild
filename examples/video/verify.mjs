// SPDX-License-Identifier: Apache-2.0
// Checks the video example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/video/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/video/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'video-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backends: [], cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretVideoExample.readSnapshot());
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
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/video/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretVideoExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
// One stage unit is one canvas pixel and the canvas is shown at its own size, so a pixel of the element is a pixel of the frame.
async function pixels(page) {
  const shot = (await page.locator('#scene').screenshot()).toString('base64');
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob()), surface = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    surface.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, data: Array.from(surface.getImageData(0, 0, bitmap.width, bitmap.height).data) };
  }, shot);
}
const pixel = (image, x, y) => image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3);

const COLOURS = [0xd04040, 0x40c060, 0x4060d0, 0xe0c040].map(hex => [hex >> 16 & 255, hex >> 8 & 255, hex & 255]);
/** Which of the colours a pixel is, within what a video's colour conversion and compression change; -1 for none. */
const which = (rgb, tolerance) => COLOURS.findIndex(c => c.every((v, i) => Math.abs(v - rgb[i]) <= tolerance));
const until = async (page, test, label, ms = 8000) => { const end = Date.now() + ms; for (;;) { const now = await read(page); if (test(now)) return now; if (Date.now() > end) throw new Error('timed out waiting for ' + label + ': ' + JSON.stringify(now)); await page.waitForTimeout(100); } };

await scenario('webgl2: the live stream is shown as it changes, frame by frame', desktop, async page => {
  const now = await until(page, s => s.live.frames >= 10, 'ten live frames');
  assert.deepEqual([now.live.state, now.live.width, now.live.height], ['playing', 160, 90]);
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const image = await pixels(page), index = which(pixel(image, 120, 105), 6);
    assert.ok(index >= 0, 'a colour of the source: ' + pixel(image, 120, 105));
    seen.add(index); await page.waitForTimeout(110);
  }
  assert.ok(seen.size >= 3, 'the picture followed the source through ' + seen.size + ' colours');
  // Outside the video the frame around it is its own colour.
  const image = await pixels(page);
  assert.deepEqual(pixel(image, 37, 57), [0x2b, 0x35, 0x50]);
}, '?backend=webgl2');

await scenario('webgl2: four recorded seconds play when asked, pause, end once and loop when told', desktop, async page => {
  // The first picture is shown before it plays.
  let now = await until(page, s => s.recorded !== null && s.recorded.frames >= 1, 'the recording', 15000);
  assert.equal(now.recorded.state, 'ready');
  await page.click('#play');
  now = await until(page, s => s.recorded.state === 'playing' && s.recorded.frames >= 2, 'playing');
  await page.click('#pause');
  const image = await pixels(page);
  assert.ok(which(pixel(image, 360, 105), 24) >= 0, 'a colour of the recording: ' + pixel(image, 360, 105));
  await page.waitForTimeout(300);
  const paused = (await read(page)).recorded;
  await page.waitForTimeout(600);
  now = await read(page);
  assert.deepEqual([now.recorded.state, now.recorded.frames, now.recorded.currentTime], ['paused', paused.frames, paused.currentTime], JSON.stringify([paused, now.recorded]));
  assert.ok(now.recorded.currentTime < 3.5, 'paused before the end: ' + now.recorded.currentTime);
  await page.click('#play');
  now = await until(page, s => s.recorded.state === 'ended', 'the end', 10000);
  assert.equal(now.ended, 1);
  await page.waitForTimeout(300);
  assert.equal((await read(page)).ended, 1, 'told once');
  await page.click('#loop'); await page.click('#play');
  await page.waitForTimeout(5000);
  now = await read(page);
  assert.deepEqual([now.recorded.loop, now.recorded.state, now.ended], [true, 'playing', 1]);
}, '?backend=webgl2');

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
