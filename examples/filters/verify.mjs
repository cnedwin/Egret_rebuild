// SPDX-License-Identifier: Apache-2.0
// Checks the filters example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/filters/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/filters/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'filters-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backends: [], cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretFiltersExample.readSnapshot());
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
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/filters/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretFiltersExample !== undefined);
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

// The pipeline worked out here, independently: the group's alpha, the spread across stored in eight bits, the spread down,
// the glow or outline over the group, the colour matrix on colour as it is seen, and the group over the cleared frame.
const decode = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const encode = c => c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
const linear = hex => [16, 8, 0].map(s => decode(((hex >> s) & 255) / 255));
const shown = rgb => rgb.map(v => Math.round(255 * encode(Math.min(1, Math.max(0, v)))));
const q8 = v => Math.round(v * 255) / 255;
const CLEAR = linear(0x1b1f2a), TILE = 0x3fa7d6, T = linear(TILE), SIZE = 40;
function spread(x0, y0, x, y, r, kind, ox = 0, oy = 0) {
  const A = (px, py) => px >= x0 && px < x0 + SIZE && py >= y0 && py < y0 + SIZE ? 1 : 0;
  const across = (py) => { let g = 0; for (let i = -r; i <= r; i++) { const t = A(x - ox + i, py - oy); g = kind === 'outline' ? Math.max(g, t) : g + t; } return q8(kind === 'outline' ? g : g / (2 * r + 1)); };
  let g = 0; for (let j = -r; j <= r; j++) { const t = across(y + j); g = kind === 'outline' ? Math.max(g, t) : g + t; }
  return kind === 'outline' ? g : g / (2 * r + 1);
}
function expected(effect, x0, y0, x, y) {
  const inside = x >= x0 && x < x0 + SIZE && y >= y0 && y < y0 + SIZE;
  let c = inside ? [...T, 1] : [0, 0, 0, 0];
  if (effect.colorMatrix && inside) {
    const m = effect.colorMatrix, v = [(TILE >> 16 & 255) / 255, (TILE >> 8 & 255) / 255, (TILE & 255) / 255, 1];
    const o = [0, 1, 2, 3].map(row => Math.min(1, Math.max(0, m[row * 5] * v[0] + m[row * 5 + 1] * v[1] + m[row * 5 + 2] * v[2] + m[row * 5 + 3] * v[3] + m[row * 5 + 4] / 255)));
    c = [...o.slice(0, 3).map(decode).map(v2 => v2 * o[3]), o[3]];
  }
  const g = effect.glow ?? effect.outline;
  if (g) {
    const kind = effect.outline ? 'outline' : 'glow', r = kind === 'outline' ? g.width : Math.ceil(g.blur ?? 6), s = g.strength ?? 2, opacity = g.alpha ?? 1, color = linear(g.color);
    const a = spread(x0, y0, x, y, r, kind, g.offsetX ?? 0, g.offsetY ?? 0);
    if (g.inner) {
      const k = Math.min(1, (1 - a) * s) * opacity;
      c = g.knockout ? [...color.map(v => v * k * c[3]), k * c[3]] : [...c.slice(0, 3).map((v, i) => v * (1 - k) + color[i] * k * c[3]), c[3]];
    } else {
      const k = (kind === 'outline' ? a : Math.min(1, a * s)) * opacity, glow = [...color.map(v => v * k), k];
      c = g.knockout ? glow.map(v => v * (1 - c[3])) : c.map((v, i) => v + glow[i] * (1 - c[3]));
    }
  }
  return shown(c.slice(0, 3).map((v, i) => v + CLEAR[i] * (1 - c[3])));
}
const matches = (actual, wanted, label, tolerance = 2) => assert.ok(actual.every((v, i) => Math.abs(v - wanted[i]) <= tolerance), label + ': ' + actual + ' is not ' + wanted);
// The places each tile is checked at, from its top left: inside, on each side, at a corner and further out.
const PLACES = [[20, 20], [1, 20], [3, 20], [-1, 20], [-2, 20], [-3, 20], [-4, 20], [-6, 20], [20, -3], [-3, -3], [42, 20], [43, 43], [46, 46], [20, 44], [38, 38], [5, 5]];

await scenario('webgl2: each filter gives the pixels worked out from its equations', desktop, async page => {
  const now = await read(page), image = await pixels(page);
  assert.equal(image.width, 480);
  for (const t of now.tiles) for (const [dx, dy] of PLACES) matches(pixel(image, t.x + dx, t.y + dy), expected(t.effect, t.x, t.y, t.x + dx, t.y + dy), t.name + ' at ' + dx + ',' + dy);
  // The filters change what is seen: the glow reaches out, the outline is the outline's colour, the grey is grey.
  const [grey, glow, , outline] = now.tiles;
  const g = pixel(image, grey.x + 20, grey.y + 20);
  assert.ok(Math.abs(g[0] - g[1]) <= 1 && Math.abs(g[1] - g[2]) <= 1, 'grey: ' + g);
  assert.notDeepEqual(pixel(image, glow.x - 2, glow.y + 20), shown(CLEAR));
  matches(pixel(image, outline.x - 3, outline.y - 3), shown(linear(0xe04040)), 'outline corner', 1);
}, '?backend=webgl2');

await scenario('webgl2: without their effects the tiles are plain', desktop, async page => {
  await page.click('#toggle'); await drawn(page);
  const now = await read(page), image = await pixels(page);
  assert.equal(now.on, false);
  for (const t of now.tiles) for (const [dx, dy] of PLACES) matches(pixel(image, t.x + dx, t.y + dy), expected({}, t.x, t.y, t.x + dx, t.y + dy), 'plain ' + t.name + ' at ' + dx + ',' + dy, 1);
}, '?backend=webgl2');

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
