// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, pen, touch and wheel input.
//
//   node examples/pointer-hover/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. The report names which one ran.
// Input is injected through the browser's automation protocol; no person moved a mouse.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/pointer-hover/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const software = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const report = { profile: 'pointer-hover-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: software } : { channel: 'msedge', headless: false });
report.browser = browser.version();

// Stage units: the three buttons are 120 by 48 at y 40; the list is 400 by 140 at (40, 120) with rows of 28.
const spot = { north: [100, 64], east: [240, 64], south: [380, 64], gap: [170, 64], row1: [240, 133], row2: [240, 161], margin: [20, 20] };
const read = page => page.evaluate(() => globalThis.__egretPointerHoverExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 300];
}
const move = async (page, name) => { await page.mouse.move(...await at(page, spot[name])); await page.waitForTimeout(30); };
const hoveredButtons = snapshot => Object.entries(snapshot.buttons).filter(([, value]) => value.hovered).map(([name]) => name);
async function scenario(name, options, body) {
  const context = await browser.newContext(options), page = await context.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/pointer-hover/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretPointerHoverExample !== undefined);
    await body(page, await context.newCDPSession(page));
    const last = await read(page);
    assert.equal(last.failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await context.close();
}

await scenario('a mouse enters and leaves the buttons', { viewport: { width: 1000, height: 800 } }, async page => {
  await move(page, 'north');
  let now = await read(page);
  assert.deepEqual(hoveredButtons(now), ['north']); assert.equal(now.hovering, 'north'); assert.deepEqual(now.hovers, [{ pointerType: 'mouse', x: 100, y: 64, target: 'north' }]);
  await move(page, 'gap'); now = await read(page);
  assert.deepEqual(hoveredButtons(now), []); assert.equal(now.lastLeave, 'target'); assert.equal(now.hovers[0].target, undefined);
  await move(page, 'east'); await move(page, 'south'); now = await read(page);
  assert.deepEqual(hoveredButtons(now), ['south']); assert.equal(now.entered, 3); assert.equal(now.left, 2);
  // Off the canvas: nothing is hovered and the pointer is forgotten.
  await page.mouse.move(5, 5); await page.waitForTimeout(30); now = await read(page);
  assert.deepEqual(hoveredButtons(now), []); assert.equal(now.lastLeave, 'outside'); assert.deepEqual(now.hovers, []);
});

await scenario('a press ends the hover and a release restores it', { viewport: { width: 1000, height: 800 } }, async page => {
  await move(page, 'north'); await page.mouse.down(); await page.waitForTimeout(30);
  let now = await read(page);
  assert.equal(now.lastLeave, 'contact'); assert.deepEqual(now.buttons.north, { hovered: false, pressed: true, presses: 0 }); assert.equal(now.contacts, 1); assert.deepEqual(now.hovers, []);
  // Dragged over another button while pressed: that button is not hovered.
  await move(page, 'east'); now = await read(page);
  assert.deepEqual(hoveredButtons(now), []); assert.equal(now.contacts, 1);
  await page.mouse.up(); await page.waitForTimeout(30); now = await read(page);
  assert.deepEqual(hoveredButtons(now), ['east']); assert.equal(now.contacts, 0); assert.equal(now.buttons.north.pressed, false); assert.equal(now.buttons.north.presses, 1);
});

await scenario('the wheel scrolls the list first and the page after', { viewport: { width: 1000, height: 600 } }, async page => {
  await move(page, 'row1');
  let now = await read(page);
  assert.equal(now.hovers[0].target, 'row 1'); assert.equal(now.limit, 196);
  await page.mouse.wheel(0, 28); await page.waitForTimeout(80); now = await read(page);
  // The list took the wheel: it moved, the page did not, and the row under the resting pointer is the next one.
  assert.equal(now.offset, 28); assert.equal(now.consumed, 1); assert.equal(await page.evaluate(() => scrollY), 0);
  assert.equal(now.hovers[0].target, 'row 2'); assert.equal(now.lastLeave, 'target');
  await page.mouse.wheel(0, 1000); await page.waitForTimeout(80); now = await read(page);
  assert.equal(now.offset, 196); assert.equal(now.consumed, 2); assert.equal(await page.evaluate(() => scrollY), 0);
  // At its end the list leaves the wheel to the page.
  await page.mouse.wheel(0, 120); await page.waitForTimeout(200); now = await read(page);
  assert.equal(now.offset, 196); assert.equal(now.wheels, 3); assert.equal(now.consumed, 2);
  const scrolled = await page.evaluate(() => scrollY);
  assert.ok(scrolled > 0, 'the page scrolled');
  // The canvas moved on the page. The mapping follows it: the same button is found where it is now.
  assert.ok(now.viewportRevision >= 1);
  await move(page, 'south'); now = await read(page);
  assert.deepEqual(hoveredButtons(now), ['south']);
  // A wheel over a button is nobody's: the page keeps it.
  await page.mouse.wheel(0, -40); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => scrollY) < scrolled);
});

await scenario('a narrower window scales the canvas and the mapping with it', { viewport: { width: 1000, height: 800 } }, async page => {
  await move(page, 'north');
  await page.setViewportSize({ width: 420, height: 800 }); await page.waitForTimeout(150);
  let now = await read(page);
  assert.equal(now.lastLeave, 'viewport'); assert.ok(now.viewportRevision >= 1);
  assert.ok(await page.evaluate(() => document.querySelector('#scene').getBoundingClientRect().width) < 480);
  await move(page, 'south'); now = await read(page);
  assert.deepEqual(hoveredButtons(now), ['south']); assert.deepEqual(now.hovers, [{ pointerType: 'mouse', x: 380, y: 64, target: 'south' }]);
});

await scenario('a pen hovers as a pointer of its own', { viewport: { width: 1000, height: 800 } }, async (page, session) => {
  await move(page, 'north');
  const [x, y] = await at(page, spot.east);
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'pen' }); await page.waitForTimeout(50);
  const now = await read(page);
  assert.deepEqual(now.hovers.map(hover => [hover.pointerType, hover.target]).sort(), [['mouse', 'north'], ['pen', 'east']]);
  assert.deepEqual(hoveredButtons(now), ['north', 'east']);
});

await scenario('a finger presses and does not hover', { ...devices['Pixel 7'] }, async page => {
  await page.touchscreen.tap(...await at(page, spot.north)); await page.waitForTimeout(100);
  const now = await read(page);
  assert.equal(now.entered, 0); assert.deepEqual(now.hovers, []); assert.equal(now.buttons.north.presses, 1);
});

await scenario('suspending, resuming and disposing', { viewport: { width: 1000, height: 600 } }, async page => {
  await move(page, 'north');
  await page.evaluate(() => globalThis.__egretPointerHoverExample.suspend());
  let now = await read(page);
  assert.equal(now.state, 'suspended'); assert.equal(now.lastLeave, 'suspended'); assert.deepEqual(hoveredButtons(now), []);
  await move(page, 'east'); assert.equal((await read(page)).entered, 1);
  await page.evaluate(() => globalThis.__egretPointerHoverExample.resume());
  await move(page, 'south'); now = await read(page);
  assert.deepEqual(hoveredButtons(now), ['south']);
  // After disposal the page has its wheel back even over the list, and nothing is routed.
  await page.evaluate(() => globalThis.__egretPointerHoverExample.dispose());
  await move(page, 'row1'); await page.mouse.wheel(0, 60); await page.waitForTimeout(200);
  now = await read(page);
  assert.equal(now.state, 'closed'); assert.equal(now.lastLeave, 'dispose'); assert.equal(now.wheels, 0); assert.equal(now.offset, 0);
  assert.ok(await page.evaluate(() => scrollY) > 0);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
