// SPDX-License-Identifier: Apache-2.0
// Checks the blend modes example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/blend-modes/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/blend-modes/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'blend-modes-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backends: [], cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretBlendExample.readSnapshot());
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
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/blend-modes/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretBlendExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined, await page.textContent('#status')); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
// Each blend, worked out here in linear premultiplied colour from its equation, then shown as the page shows it.
const decode = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const encode = c => c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
const linear = hex => [16, 8, 0].map(shift => decode(((hex >> shift) & 255) / 255));
const PANEL = linear(0x4a7bd0), SQUARE = linear(0xf0a030), A = 0.6, S = SQUARE.map(v => v * A), CLEAR = linear(0x1b1f2a), DOT = linear(0x803010);
// The page behind the canvas, which an erased place lets through.
const PAGE = [0xf4, 0xf6, 0xfa];
const opaque = rgb => rgb.map(v => Math.round(255 * encode(Math.min(1, v))));
const EXPECTED = {
  normal: opaque(S.map((s, i) => s + PANEL[i] * (1 - A))),
  add: opaque(S.map((s, i) => s + PANEL[i])),
  multiply: opaque(S.map((s, i) => s * PANEL[i] + PANEL[i] * (1 - A))),
  screen: opaque(S.map((s, i) => s + PANEL[i] * (1 - s))),
  // What is left has alpha 1 - A; the canvas holds it premultiplied and encoded, and the page shows through the rest.
  erase: PANEL.map((d, i) => Math.round((1 - A) * 255 * encode(d) + A * PAGE[i])),
};
const rgb = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
const within = (actual, expected, label, tolerance = 3) => assert.ok(rgb(actual).every((v, i) => Math.abs(v - expected[i]) <= tolerance), label + ': ' + actual + ' is not ' + expected.map(v => v.toString(16).padStart(2, '0')).join(''));

let offered = 0;
// Headless Chromium offers a SwiftShader WebGPU adapter but drops its instance while a frame is checked, for every example
// alike; with software rendering WebGL2 alone is checked, and in Edge both are.
for (const backend of renderer === 'software' ? ['webgl2'] : ['webgl2', 'webgpu']) {
  const query = '?backend=' + backend;
  // A browser without WebGPU is recorded as such, not failed.
  if (backend === 'webgpu') {
    const probe = await browser.newPage();
    await probe.goto('http://127.0.0.1:' + server.address().port + '/examples/blend-modes/README.md');
    const has = await probe.evaluate(async () => { try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch { return false; } });
    await probe.close();
    report.backends.push({ backend, offered: has });
    if (!has) continue;
  } else report.backends.push({ backend, offered: true });
  offered++;

  await scenario(backend + ': each mode meets the panel as its equation says', desktop, async page => {
    const now = await read(page);
    assert.deepEqual(now.modes.map(m => [m.mode, m.material]), [['normal', null], ['add', 'add-accumulate'], ['multiply', 'multiply-factor'], ['screen', 'screen'], ['erase', 'erase']]);
    for (const { mode, x } of now.modes) {
      within(await colour(page, [x + 40, 100]), EXPECTED[mode], mode);
      // Above the square the panel is the panel's own colour.
      within(await colour(page, [x + 40, 50]), opaque(PANEL), mode + ' panel', 1);
    }
  }, query);

  await scenario(backend + ': sparks in a container whose mode is add grow brighter where they overlap, and are flat when it is normal', desktop, async page => {
    const sum = n => opaque(CLEAR.map((c, i) => c + n * DOT[i]));
    within(await colour(page, [45, 200]), sum(1), 'one spark');
    within(await colour(page, [75, 200]), sum(2), 'two sparks');
    within(await colour(page, [75, 215]), sum(3), 'three sparks');
    await page.click('#toggle'); await drawn(page);
    assert.equal((await read(page)).sparks, 'normal');
    for (const place of [[45, 200], [75, 200], [75, 215]]) within(await colour(page, place), opaque(DOT), 'flat ' + place);
  }, query);
}
assert.ok(offered >= 1);

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.backends.map(b => b.backend + (b.offered ? '' : ' not offered by this browser')).join(', '));
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
