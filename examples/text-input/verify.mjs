// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser, with the composition of an input method driven through the browser's
// own protocol: provisional pinyin, then the chosen characters, as a Chinese input method delivers them.
//
//   node examples/text-input/verify.mjs [directory from which "playwright" resolves] [directory for screenshots]
//
// Chromium only: the protocol that drives a composition is Chromium's.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..'), [from = process.cwd(), shots] = process.argv.slice(2);
const { chromium, devices } = createRequire(path.join(path.resolve(from), 'verify.cjs'))('playwright');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = 'http://127.0.0.1:' + server.address().port + '/examples/text-input/index.html?backend=webgl2';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];

/** The centre of a rectangle of the stage, in the coordinates of the page. */
async function at(page, x, y) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 300];
}
const snapshot = page => page.evaluate(() => globalThis.__egretTextInputExample.readSnapshot());
const drawn = page => page.evaluate(() => globalThis.__egretTextInputExample.whenDrawn());
/** Where the platform field is, in stage units. */
const placed = page => page.evaluate(() => {
  const node = document.querySelector('[data-egret-text-input]'); if (!node) return null;
  const field = node.getBoundingClientRect(), scene = document.querySelector('#scene').getBoundingClientRect(), sx = 480 / scene.width, sy = 300 / scene.height;
  return [(field.left - scene.left) * sx, (field.top - scene.top) * sy, field.width * sx, field.height * sy];
});
/** The field covers the rectangle to within a twentieth of a stage unit: the page lays out in fractions of a pixel. */
async function covers(page, expected) {
  const actual = await placed(page);
  assert.ok(actual !== null && actual.every((value, index) => Math.abs(value - expected[index]) <= 0.05), 'field at ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}
async function scenario(name, options, body) {
  const context = await browser.newContext(options), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(address); await page.waitForFunction(() => globalThis.__egretTextInputExample !== undefined); await drawn(page);
    // Shortcuts of a game listen on the window: nothing typed into a field may reach them.
    await page.evaluate(() => { globalThis.heard = []; for (const type of ['keydown', 'keyup']) window.addEventListener(type, event => globalThis.heard.push(type + ':' + event.key)); });
    await body(page, await context.newCDPSession(page));
    await drawn(page);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name.replace(/\W+/g, '-') + '.png') }); }
    assert.deepEqual(errors, []);
    results.push('ok    ' + name);
  } catch (error) { results.push('FAIL  ' + name + '\n' + String(error.stack ?? error)); process.exitCode = 1; }
  await context.close();
}
/** One composition: the pinyin as it grows, then the characters the player chose. */
async function compose(page, session, pinyin, chosen) {
  for (let length = 1; length <= pinyin.length; length++) await session.send('Input.imeSetComposition', { text: pinyin.slice(0, length), selectionStart: length, selectionEnd: length });
  const during = await snapshot(page);
  assert.equal(during.input.composing, true); assert.match(during.status, /组字中/);
  await session.send('Input.insertText', { text: chosen });
  assert.equal((await snapshot(page)).input.composing, false);
}

await scenario('a name entered with an input method', { viewport: { width: 1000, height: 800 } }, async (page, session) => {
  await page.mouse.click(...await at(page, 240, 114));
  await covers(page, [40, 94, 400, 40]);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
  await compose(page, session, 'qingyunmen', '青云门');
  assert.equal((await snapshot(page)).input.value, '青云门');
  // Enter while the input method holds text chooses a candidate. It does not commit the field.
  await session.send('Input.imeSetComposition', { text: 'di', selectionStart: 2, selectionEnd: 2 });
  await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 });
  assert.equal((await snapshot(page)).input.state, 'open');
  await session.send('Input.insertText', { text: '第一大宗门派' });
  // Eight characters at most: the excess of what was just entered is dropped.
  assert.equal((await snapshot(page)).input.value, '青云门第一大宗门');
  await page.keyboard.type('abc');
  assert.equal((await snapshot(page)).input.value, '青云门第一大宗门');
  await page.keyboard.press('Enter');
  const after = await snapshot(page);
  assert.deepEqual(after.values, { name: '青云门第一大宗门', motto: '' }); assert.equal(after.input.state, 'idle'); assert.equal(await placed(page), null);
  assert.deepEqual(await page.evaluate(() => globalThis.heard), []);
  await page.keyboard.press('F8');
  assert.deepEqual(await page.evaluate(() => globalThis.heard), ['keydown:F8', 'keyup:F8']);
});

await scenario('several lines, committed by pressing elsewhere', { viewport: { width: 1000, height: 800 } }, async (page, session) => {
  await page.mouse.click(...await at(page, 240, 216));
  await covers(page, [40, 168, 400, 96]);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA');
  await compose(page, session, 'xiayi', '侠义为先');
  await page.keyboard.press('Enter');
  await compose(page, session, 'tianxia', '天下为公');
  assert.equal((await snapshot(page)).input.value, '侠义为先\n天下为公');
  await page.mouse.click(...await at(page, 240, 40));
  let after = await snapshot(page);
  assert.deepEqual(after.values, { name: '', motto: '侠义为先\n天下为公' }); assert.equal(after.input.state, 'idle');
  // Escape leaves the committed value as it was.
  await page.mouse.click(...await at(page, 240, 216));
  await page.keyboard.type('!');
  assert.equal((await snapshot(page)).input.value, '侠义为先\n天下为公!');
  await page.keyboard.press('Escape');
  after = await snapshot(page);
  assert.equal(after.values.motto, '侠义为先\n天下为公'); assert.match(after.status, /已取消/);
  // Pressing the other field commits this one and opens that one.
  await page.mouse.click(...await at(page, 240, 216)); await page.keyboard.type('?');
  await page.mouse.click(...await at(page, 240, 114));
  after = await snapshot(page);
  assert.equal(after.values.motto, '侠义为先\n天下为公?'); assert.equal(after.input.state, 'open'); await covers(page, [40, 94, 400, 40]);
});

await scenario('a phone: a scaled canvas and touch', { ...devices['Pixel 7'] }, async (page, session) => {
  const scale = await page.evaluate(() => document.querySelector('#scene').getBoundingClientRect().width / 480);
  assert.ok(scale < 1, 'the canvas is scaled down to the width of the phone');
  await page.touchscreen.tap(...await at(page, 240, 114));
  await page.waitForTimeout(400);
  assert.equal((await snapshot(page)).input.state, 'open');
  await covers(page, [40, 94, 400, 40]);
  await compose(page, session, 'emei', '峨眉');
  await page.touchscreen.tap(...await at(page, 240, 40));
  await page.waitForTimeout(400);
  const after = await snapshot(page);
  assert.equal(after.values.name, '峨眉'); assert.equal(after.input.state, 'idle');
});

await scenario('the field follows the canvas when the window changes', { viewport: { width: 1000, height: 800 } }, async page => {
  await page.mouse.click(...await at(page, 240, 114));
  await page.setViewportSize({ width: 500, height: 700 });
  await page.waitForTimeout(200);
  await covers(page, [40, 94, 400, 40]);
  await page.evaluate(() => window.scrollTo(0, 120));
  await page.waitForTimeout(100);
  await covers(page, [40, 94, 400, 40]);
});

console.log(results.join('\n'));
await browser.close(); server.close();
