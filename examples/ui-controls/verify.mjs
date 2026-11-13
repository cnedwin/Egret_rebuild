// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. The report names which one ran.
// Input is injected through the browser's automation protocol; no person pressed a key.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-controls-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

// Stage units: the switch and the button are 140 by 44 at (40, 40) and (40, 200); the options are 120 by 44 at y 120.
const spot = { sound: [110, 62], easy: [100, 142], normal: [240, 142], hard: [380, 142], apply: [110, 222], empty: [300, 60] };
const read = page => page.evaluate(() => globalThis.__egretUiControlsExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 300];
}
const settle = page => page.waitForTimeout(40);
const move = async (page, name) => { await page.mouse.move(...await at(page, spot[name])); await settle(page); };
const click = async (page, name) => { await page.mouse.click(...await at(page, spot[name])); await settle(page); };
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
async function scenario(name, options, body) {
  const context = await browser.newContext(options), page = await context.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-controls/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiControlsExample !== undefined);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await context.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };

await scenario('each control is hovered in turn', desktop, async page => {
  for (const name of ['sound', 'easy', 'normal', 'hard', 'apply']) { await move(page, name); assert.deepEqual((await read(page)).hovered, [name]); }
  await move(page, 'empty'); assert.deepEqual((await read(page)).hovered, []);
});

await scenario('a mouse toggles, selects and activates', desktop, async page => {
  let now = await read(page);
  assert.equal(now.sound.checked, true); assert.equal(now.level.selected, 'normal'); assert.equal(now.apply.activations, 0);
  await move(page, 'sound'); await page.mouse.down(); await settle(page); now = await read(page);
  // Held: pressed, not yet changed, and no longer hovered because the pointer is now a contact.
  assert.deepEqual(now.sound, { checked: true, pressed: true, enabled: true }); assert.deepEqual(now.hovered, []);
  await page.mouse.up(); await settle(page); now = await read(page);
  assert.deepEqual(now.sound, { checked: false, pressed: false, enabled: true }); assert.deepEqual(now.hovered, ['sound']);
  await click(page, 'sound'); assert.equal((await read(page)).sound.checked, true);
  await click(page, 'hard'); await click(page, 'hard'); await click(page, 'easy'); now = await read(page);
  assert.equal(now.level.selected, 'easy'); assert.deepEqual(now.level.changes, [['hard', 'normal'], ['easy', 'hard']]);
  await click(page, 'apply'); await click(page, 'apply'); assert.equal((await read(page)).apply.activations, 2);
  // A press with nothing under it changes nothing.
  await click(page, 'empty'); now = await read(page);
  assert.equal(now.sound.checked, true); assert.equal(now.level.selected, 'easy'); assert.equal(now.apply.activations, 2);
});

await scenario('the keyboard reaches the same controls', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); let now = await read(page);
  assert.equal(now.focus, 'sound');
  await key(page, 'Space'); assert.equal((await read(page)).sound.checked, false);
  await key(page, 'Enter'); assert.equal((await read(page)).sound.checked, true);
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'level');
  await key(page, 'ArrowRight'); now = await read(page);
  assert.equal(now.level.selected, 'hard'); assert.equal(now.focus, 'level');
  // Past the last option the selection continues at the first.
  await key(page, 'ArrowDown'); assert.equal((await read(page)).level.selected, 'easy');
  await key(page, 'ArrowLeft'); assert.equal((await read(page)).level.selected, 'hard');
  await key(page, 'Home'); assert.equal((await read(page)).level.selected, 'easy');
  await key(page, 'End'); assert.equal((await read(page)).level.selected, 'hard');
  await key(page, 'ArrowUp'); assert.equal((await read(page)).level.selected, 'normal');
  // Space is not a key of the group, and the page did not scroll for any key that was taken.
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'apply');
  await key(page, 'Space'); await key(page, 'Enter'); now = await read(page);
  assert.equal(now.apply.activations, 2); assert.equal(now.level.selected, 'normal');
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.keyboard.press('Shift+Tab'); await settle(page); assert.equal((await read(page)).focus, 'level');
});

await scenario('a disabled option and a disabled panel refuse every input', desktop, async page => {
  await page.click('#disable-hard'); await settle(page);
  let now = await read(page);
  assert.deepEqual(now.level.items, { easy: true, normal: true, hard: false });
  await click(page, 'hard'); assert.equal((await read(page)).level.selected, 'normal');
  // Movement skips it in both directions.
  await page.focus('#scene'); await key(page, 'Tab'); await key(page, 'Tab');
  await key(page, 'ArrowRight'); assert.equal((await read(page)).level.selected, 'easy');
  await key(page, 'ArrowLeft'); assert.equal((await read(page)).level.selected, 'normal');
  await key(page, 'End'); assert.equal((await read(page)).level.selected, 'normal');
  await page.click('#disable-hard'); await settle(page); await click(page, 'hard'); assert.equal((await read(page)).level.selected, 'hard');
  await page.click('#disable-all'); await settle(page);
  await click(page, 'sound'); await click(page, 'easy'); await click(page, 'apply'); await move(page, 'apply'); now = await read(page);
  assert.equal(now.sound.checked, true); assert.equal(now.level.selected, 'hard'); assert.equal(now.apply.activations, 0); assert.deepEqual(now.hovered, []);
  assert.equal(now.sound.enabled, false); assert.equal(now.level.enabled, false); assert.equal(now.apply.enabled, false);
  // Enabled again, everything answers as before.
  await page.click('#disable-all'); await settle(page);
  await move(page, 'apply'); await click(page, 'apply'); now = await read(page);
  assert.equal(now.apply.activations, 1); assert.deepEqual(now.hovered, ['apply']);
});

await scenario('a finger activates and hovers nothing', { ...devices['Pixel 7'] }, async page => {
  for (const name of ['sound', 'easy', 'apply']) { await page.touchscreen.tap(...await at(page, spot[name])); await page.waitForTimeout(80); }
  const now = await read(page);
  assert.equal(now.sound.checked, false); assert.equal(now.level.selected, 'easy'); assert.equal(now.apply.activations, 1); assert.deepEqual(now.hovered, []);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
