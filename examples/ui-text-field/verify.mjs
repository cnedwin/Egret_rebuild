// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser. The composition of an input method is driven through the
// browser's own protocol: provisional pinyin, then the chosen characters, as a Chinese input method
// delivers them. Every other input is injected the same way; no person typed.
//
//   node examples/ui-text-field/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. Chromium only: the protocol that drives a
// composition is Chromium's. No screen reader or other assistive technology is run.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/ui-text-field/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-text-field-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

// Stage units: the name is 400 by 40 at (40, 78), the motto 400 by 84 at (40, 148), the button 120 by 36 at (40, 240).
const box = { name: [40, 78, 400, 40], motto: [40, 148, 400, 84], save: [40, 240, 120, 36] }, spot = { name: [240, 98], motto: [240, 190], save: [100, 258], empty: [300, 40] };
const read = page => page.evaluate(() => globalThis.__egretUiTextFieldExample.readSnapshot());
const drawn = page => page.evaluate(() => globalThis.__egretUiTextFieldExample.whenDrawn());
async function at(page, [x, y]) {
  const bounds = await page.evaluate(() => { const rect = document.querySelector('#scene').getBoundingClientRect(); return [rect.left, rect.top, rect.width, rect.height]; });
  return [bounds[0] + x * bounds[2] / 480, bounds[1] + y * bounds[3] / 300];
}
const settle = async page => { await page.waitForTimeout(60); await drawn(page); };
const click = async (page, name) => { await page.mouse.click(...await at(page, spot[name])); await settle(page); };
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
/** Where the platform field is, in stage units, and which element it is. */
const placed = page => page.evaluate(() => {
  const node = document.querySelector('[data-egret-text-input]'); if (!node) return null;
  const field = node.getBoundingClientRect(), scene = document.querySelector('#scene').getBoundingClientRect(), sx = 480 / scene.width, sy = 300 / scene.height;
  return { tag: node.tagName, focused: document.activeElement === node, label: node.getAttribute('aria-label'), rect: [(field.left - scene.left) * sx, (field.top - scene.top) * sy, field.width * sx, field.height * sy] };
});
/** The platform field covers the box the engine drew, to within a twentieth of a stage unit. */
async function covers(page, name, tag) {
  const actual = await placed(page);
  assert.ok(actual !== null && actual.rect.every((value, index) => Math.abs(value - box[name][index]) <= 0.05), name + ' field at ' + JSON.stringify(actual));
  assert.deepEqual([actual.tag, actual.focused], [tag, true]);
  return actual;
}
/** One composition: the pinyin as it grows, then the characters the player chose. */
async function compose(page, session, name, pinyin, chosen) {
  for (let length = 1; length <= pinyin.length; length++) await session.send('Input.imeSetComposition', { text: pinyin.slice(0, length), selectionStart: length, selectionEnd: length });
  const during = await read(page);
  assert.equal(during.fields[name].composing, true); assert.match(during.status, /组字中/);
  await session.send('Input.insertText', { text: chosen });
  assert.equal((await read(page)).fields[name].composing, false);
}
async function scenario(name, options, body) {
  const context = await browser.newContext(options), page = await context.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-text-field/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiTextFieldExample !== undefined); await drawn(page);
    await body(page, await context.newCDPSession(page));
    await drawn(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await context.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
const textbox = (page, name) => page.getByRole('textbox', { name, exact: true });

await scenario('a press opens the platform field over the box, and an input method types into it', desktop, async (page, session) => {
  await click(page, 'name');
  let now = await read(page);
  assert.deepEqual([now.fields.name.editing, now.editor.state], [true, 'open']);
  assert.equal((await covers(page, 'name', 'INPUT')).label, '门派名称 / Name');
  await compose(page, session, 'name', 'qingyunmen', '青云门');
  now = await read(page);
  assert.deepEqual([now.fields.name.draft, now.fields.name.value], ['青云门', ''], 'what is typed is a draft until it is committed');
  // Eight characters at most, counted as a reader counts them.
  await session.send('Input.insertText', { text: '第一大宗门派' });
  assert.equal((await read(page)).fields.name.draft, '青云门第一大宗门');
  await key(page, 'Enter');
  now = await read(page);
  assert.deepEqual([now.fields.name.value, now.fields.name.editing, now.editor.state, await placed(page)], ['青云门第一大宗门', false, 'idle', null]);
  assert.match(now.status, /已更改/);
  // Escape leaves the text as it was.
  await click(page, 'name'); await page.keyboard.press('Backspace'); await page.keyboard.type('X');
  assert.equal((await read(page)).fields.name.draft, '青云门第一大宗X');
  await key(page, 'Escape');
  now = await read(page);
  assert.deepEqual([now.fields.name.value, now.fields.name.draft, now.fields.name.editing], ['青云门第一大宗门', '青云门第一大宗门', false]);
});

await scenario('several lines, and one field handing the editor to the other', desktop, async (page, session) => {
  await click(page, 'motto');
  await covers(page, 'motto', 'TEXTAREA');
  await compose(page, session, 'motto', 'xiayi', '侠义为先');
  await page.keyboard.press('Enter');
  await compose(page, session, 'motto', 'tianxia', '天下为公');
  // Pressing the other field commits this one and opens that one.
  await click(page, 'name');
  let now = await read(page);
  assert.deepEqual([now.fields.motto.value, now.fields.motto.editing, now.fields.name.editing], ['侠义为先\n天下为公', false, true]);
  await covers(page, 'name', 'INPUT');
  await page.keyboard.type('Emei');
  // Pressing where there is no field commits, and the button then saves what the fields hold.
  await click(page, 'empty');
  assert.deepEqual([(await read(page)).fields.name.value, await placed(page)], ['Emei', null]);
  await click(page, 'save');
  now = await read(page);
  assert.deepEqual([now.saved, now.save.activations], [{ name: 'Emei', motto: '侠义为先\n天下为公' }, 1]);
});

await scenario('the keyboard opens a field, and the focus comes back to it', desktop, async (page) => {
  await page.focus('#scene');
  await key(page, 'Tab');
  assert.equal((await read(page)).focus, 'name');
  await key(page, 'Enter');
  let now = await read(page);
  assert.equal(now.fields.name.editing, true); await covers(page, 'name', 'INPUT');
  assert.equal((await read(page)).fields.name.draft, '', 'the Enter that opened the field typed nothing into it');
  await page.keyboard.type('Wudang'); await key(page, 'Enter');
  now = await read(page);
  assert.deepEqual([now.fields.name.value, now.fields.name.editing, now.focus, await page.evaluate(() => document.activeElement.id)], ['Wudang', false, 'name', 'scene']);
  // The next Tab goes on from the field. The motto takes Enter as a line break, so it is left by pressing elsewhere or Escape.
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'motto');
  await key(page, 'Space'); await covers(page, 'motto', 'TEXTAREA');
  await page.keyboard.type('one'); await page.keyboard.press('Enter'); await page.keyboard.type('two');
  assert.equal((await read(page)).fields.motto.draft, 'one\ntwo');
  await key(page, 'Escape');
  now = await read(page);
  assert.deepEqual([now.fields.motto.value, now.fields.motto.editing, now.focus], ['', false, 'motto']);
  await key(page, 'Tab'); await key(page, 'Enter');
  now = await read(page);
  assert.deepEqual([now.focus, now.saved], ['save', { name: 'Wudang', motto: '' }]);
  assert.equal(await page.evaluate(() => scrollY), 0);
});

await scenario('assistive technology is given the fields, and each is announced once', desktop, async (page) => {
  assert.equal(await page.locator('#surface').ariaSnapshot(), [
    '- application "Text fields / 文本框控件":',
    '  - group "门派登记 / Register a sect":',
    '    - textbox "门派名称 / Name"',
    '    - textbox "门派宣言 / Motto"',
    '    - button "保存 / Save"'].join('\n'));
  assert.equal(await textbox(page, '门派宣言 / Motto').getAttribute('aria-multiline'), 'true');
  // A request made of the element opens the same edit a press opens.
  await textbox(page, '门派名称 / Name').evaluate(element => element.click()); await settle(page);
  let now = await read(page);
  assert.equal(now.fields.name.editing, true); await covers(page, 'name', 'INPUT');
  // While it is edited the field is the platform's own element: the projected node is gone, and one textbox has the name.
  assert.deepEqual(now.semantics.nodes, ['form', 'motto', 'save']);
  assert.equal(await textbox(page, '门派名称 / Name').count(), 1);
  assert.equal(await textbox(page, '门派名称 / Name').evaluate(element => element.tagName), 'INPUT');
  await page.keyboard.type('Shaolin'); await key(page, 'Enter');
  now = await read(page);
  assert.deepEqual([now.fields.name.value, now.semantics.nodes], ['Shaolin', ['form', 'name', 'motto', 'save']]);
  assert.equal(await textbox(page, '门派名称 / Name').evaluate(element => element.tagName + ':' + element.textContent), 'DIV:Shaolin');
  // The focus of the application is named by the canvas.
  assert.equal(await page.evaluate(() => document.querySelector('#scene').getAttribute('aria-activedescendant')), await textbox(page, '门派名称 / Name').evaluate(element => element.id));
  // A disabled form says so and opens nothing.
  await page.click('#disable'); await settle(page);
  assert.equal(await textbox(page, '门派名称 / Name').getAttribute('aria-disabled'), 'true');
  await textbox(page, '门派名称 / Name').evaluate(element => element.click()); await click(page, 'motto'); await click(page, 'save');
  now = await read(page);
  assert.deepEqual([now.fields.name.editing, now.fields.motto.editing, now.save.activations, await placed(page)], [false, false, 0, null]);
});

await scenario('disabling the form cancels an open edit', desktop, async (page) => {
  await click(page, 'name'); await page.keyboard.type('half');
  await page.evaluate(() => document.querySelector('#disable').click()); await settle(page);
  let now = await read(page);
  assert.deepEqual([now.fields.name.value, now.fields.name.editing, now.fields.name.enabled, now.editor.state, await placed(page)], ['', false, false, 'idle', null]);
  await page.evaluate(() => document.querySelector('#disable').click()); await settle(page);
  await click(page, 'name'); await page.keyboard.type('whole'); await key(page, 'Enter');
  assert.equal((await read(page)).fields.name.value, 'whole');
});

await scenario('a phone: a scaled canvas and touch', { ...devices['Pixel 7'] }, async (page, session) => {
  assert.ok(await page.evaluate(() => document.querySelector('#scene').getBoundingClientRect().width / 480) < 1, 'the canvas is scaled down to the width of the phone');
  await page.touchscreen.tap(...await at(page, spot.name)); await page.waitForTimeout(400); await drawn(page);
  assert.equal((await read(page)).fields.name.editing, true);
  await covers(page, 'name', 'INPUT');
  await compose(page, session, 'name', 'emei', '峨眉');
  await page.touchscreen.tap(...await at(page, spot.empty)); await page.waitForTimeout(400); await drawn(page);
  const now = await read(page);
  assert.deepEqual([now.fields.name.value, now.fields.name.editing, now.editor.state], ['峨眉', false, 'idle']);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
