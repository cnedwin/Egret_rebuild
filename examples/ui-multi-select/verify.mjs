// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-multi-select/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. The report names which one ran.
// Input is injected through the browser's automation protocol; no person pressed a key. The
// accessibility checks read the tree the browser computes; no screen reader or other assistive
// technology was run.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/ui-multi-select/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-multi-select-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiMultiSelectExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiMultiSelectExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiMultiSelectExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units. The roster begins at (20, 44) and is 290 wide; a row is 30 high. `rowPaint` is a place on a row past its text.
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
const rowSpot = number => [150, 44 + (number - 1) * 30 + 14], rowPaint = number => [296, 44 + (number - 1) * 30 + 14], empty = [400, 290];
const spot = { all: [403, 99], clear: [403, 137], send: [403, 194] }, corner = { all: [452, 108], clear: [452, 146], send: [452, 206] };
const optionName = (index, gone = false) => '弟子 ' + (index + 1) + ' ' + HEROES[index % 5] + (gone ? '，外出 Away' : '');
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
const click = async (page, place) => { await page.mouse.click(...await at(page, typeof place === 'string' ? spot[place] : place)); await settle(page); };
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
/** The element the canvas names as the one that holds the focus: its role and its name. */
const active = page => page.evaluate(() => {
  const id = document.querySelector('#scene').getAttribute('aria-activedescendant'), element = id === null ? null : document.getElementById(id);
  return element === null ? null : [element.getAttribute('role') ?? element.tagName.toLowerCase(), element.getAttribute('aria-label') ?? element.textContent];
});
const tree = page => page.locator('#surface').ariaSnapshot();
/** The tree a state of the screen has: which of the first eight are selected or away, the count, and which buttons can act. */
const lines = ({ selected = [], gone = [], count = selected.length, off = [] }) => ['- application "Send members / 派遣弟子":', '  - listbox "名册 / Roster":',
  ...Array.from({ length: 8 }, (_, index) => '    - option "' + optionName(index, gone.includes(index)) + '"' + (gone.includes(index) ? ' [disabled]' : '') + (selected.includes(index) ? ' [selected]' : '')),
  '  - scrollbar "名册滚动 / Roster scroll"', '  - text: 已选 ' + count + ' / ' + count + ' chosen',
  ...[['all', '全选 / All'], ['clear', '清除 / Clear'], ['send', '派遣 / Send']].map(([id, name]) => '  - button "' + name + '"' + (off.includes(id) ? ' [disabled]' : ''))].join('\n');
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-multi-select/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiMultiSelectExample !== undefined);
    await settle(page);
    await body(page);
    const last = await read(page);
    assert.equal(last.failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 1000 } };

await scenario('the browser computes a list box in which several options may be selected', desktop, async page => {
  assert.equal(await tree(page), lines({ off: ['clear', 'send'] }));
  assert.deepEqual(await page.evaluate(() => { const box = document.querySelector('[role=listbox]'), first = document.querySelector('[role=option]');
    return [box.getAttribute('aria-multiselectable'), first.getAttribute('aria-selected'), first.getAttribute('aria-posinset'), first.getAttribute('aria-setsize')]; }), ['true', 'false', '1', '40']);
  const now = await read(page);
  assert.deepEqual([now.chosen, now.away, now.enabled, now.semantics.projection], [[], [], { all: true, clear: false, send: false }, 'active']);
  assert.deepEqual([await colour(page, corner.all), await colour(page, corner.clear), await colour(page, corner.send)], ['3d4a63', '2a2d33', '2a2d33']);
});

await scenario('presses choose several members and let one go, and the chosen are sent', desktop, async page => {
  await click(page, rowSpot(2)); await click(page, rowSpot(4)); await click(page, rowSpot(5)); let now = await read(page);
  assert.deepEqual([now.chosen, now.enabled], [['m1', 'm3', 'm4'], { all: true, clear: true, send: true }]);
  assert.equal(await tree(page), lines({ selected: [1, 3, 4] }));
  // A chosen row, the one the pointer rests on, and a row that is not chosen.
  assert.deepEqual([await colour(page, rowPaint(2)), await colour(page, rowPaint(5)), await colour(page, rowPaint(3))], ['2f8f6b', '3fae84', '2b2f3a']);
  // A second press lets a member go, and the others stay.
  await click(page, rowSpot(4)); now = await read(page);
  assert.deepEqual(now.chosen, ['m1', 'm4']); assert.equal(await tree(page), lines({ selected: [1, 4] }));
  // Sent, they are away: their rows say so, cannot be chosen, and nobody is chosen.
  await click(page, 'send'); now = await read(page);
  assert.deepEqual([now.chosen, now.away, now.sent, now.enabled], [[], ['m1', 'm4'], 2, { all: true, clear: false, send: false }]);
  assert.equal(await tree(page), lines({ gone: [1, 4], off: ['clear', 'send'] }));
  await page.mouse.move(...await at(page, rowSpot(2))); await settle(page);
  assert.deepEqual([(await read(page)).hovered, await colour(page, rowPaint(2))], [[], '22252d'], 'a row that is away is not lit');
  await click(page, rowSpot(2)); assert.deepEqual((await read(page)).chosen, []);
  // Everyone who is here, and then nobody.
  await click(page, 'all'); now = await read(page);
  assert.deepEqual([now.chosen.length, now.chosen.includes('m1'), now.enabled], [38, false, { all: false, clear: true, send: true }]);
  assert.equal(await tree(page), lines({ selected: [0, 2, 3, 5, 6, 7], gone: [1, 4], count: 38, off: ['all'] }));
  await click(page, 'clear'); now = await read(page);
  assert.deepEqual([now.chosen, now.enabled], [[], { all: true, clear: false, send: false }]);
  await click(page, 'send'); assert.equal((await read(page)).sent, 2, 'a button with nothing to do does nothing');
});

await scenario('the keyboard alone chooses rows that are apart, and sends them', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).row], [['option', optionName(0)], 'm0']);
  await key(page, 'Space'); assert.deepEqual((await read(page)).chosen, ['m0']);
  // The arrow keys move the focus and leave the choice alone.
  await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); let now = await read(page);
  assert.deepEqual([now.row, now.chosen, await active(page)], ['m2', ['m0'], ['option', optionName(2)]]);
  await key(page, 'Enter'); assert.deepEqual((await read(page)).chosen, ['m0', 'm2']);
  await key(page, 'End'); await key(page, 'Space'); now = await read(page);
  assert.deepEqual([now.row, now.chosen, now.rows.at(-1).key], ['m39', ['m0', 'm2', 'm39'], 'm39']);
  await key(page, 'Space'); assert.deepEqual((await read(page)).chosen, ['m0', 'm2'], 'the same key lets the row go');
  assert.equal(await page.getByRole('option', { name: optionName(39), exact: true }).getAttribute('aria-selected'), 'false');
  // Tab goes on to the buttons, in their order.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '全选 / All']);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '清除 / Clear']);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '派遣 / Send']);
  // Sent, the button has nothing more to do: it is disabled, and the focus is on a button that can act.
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.away, now.chosen, now.enabled.send, now.focus, now.focusVisible, await active(page)], [['m0', 'm2'], [], false, 'all', true, ['button', '全选 / All']]);
  // A row that is away takes the focus. Its key changes nothing, and is not left to the page either.
  await page.keyboard.press('Shift+Tab'); await settle(page); await key(page, 'Home'); await key(page, 'Space'); now = await read(page);
  assert.deepEqual([now.row, now.chosen], ['m0', []]);
  assert.equal(await page.getByRole('option', { name: optionName(0, true), exact: true }).getAttribute('aria-disabled'), 'true');
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
});

await scenario('the keyboard chooses a run of rows with Shift, and everyone with Control and A', desktop, async page => {
  const run = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => 'm' + (from + index));
  await page.focus('#scene'); await key(page, 'Tab');
  // Shift with a movement key chooses from the row it leaves to the row it reaches.
  await key(page, 'Shift+ArrowDown'); await key(page, 'Shift+ArrowDown'); let now = await read(page);
  assert.deepEqual([now.chosen, now.row, await active(page)], [run(0, 2), 'm2', ['option', optionName(2)]]);
  await key(page, 'Shift+PageDown'); now = await read(page);
  assert.deepEqual([now.chosen, now.row], [run(0, 9), 'm9']);
  // Going back over chosen rows lets nobody go, and without Shift the keys only move.
  await key(page, 'Shift+ArrowUp'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); now = await read(page);
  assert.deepEqual([now.chosen, now.row], [run(0, 9), 'm11']);
  await key(page, 'Shift+ArrowDown'); now = await read(page);
  assert.deepEqual([now.chosen, now.row], [[...run(0, 9), 'm11', 'm12'], 'm12']);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[role=option][aria-selected=true]')].map(element => element.getAttribute('aria-posinset'))), ['6', '7', '8', '9', '10', '12', '13'], 'of the eight rows that show, all but the eleventh');
  // They are sent. A run through rows that are away chooses none of them.
  await key(page, 'Tab'); await key(page, 'Tab'); await key(page, 'Tab'); await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.away.length, now.chosen, now.focus], [12, [], 'all']);
  await page.keyboard.press('Shift+Tab'); await settle(page); assert.equal((await read(page)).row, 'm12');
  await key(page, 'Shift+ArrowUp'); now = await read(page);
  assert.deepEqual([now.chosen, now.row], [[], 'm11']);
  await key(page, 'Shift+ArrowUp'); now = await read(page);
  assert.deepEqual([now.chosen, now.row], [['m10'], 'm10'], 'the one member of the run who is here');
  // Control and A chooses everyone who is here, and the page selects nothing of its own.
  await key(page, 'Control+a'); now = await read(page);
  assert.deepEqual([now.chosen.length, now.chosen.some(member => now.away.includes(member)), now.enabled.all], [28, false, false]);
  assert.deepEqual(await page.evaluate(() => [String(getSelection()), scrollY]), ['', 0]);
});

await scenario('a request of assistive technology selects options one by one and sends them', desktop, async page => {
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('option', optionName(1), 'click'); await ask('option', optionName(6), 'click');
  assert.deepEqual((await read(page)).chosen, ['m1', 'm6']);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[role=option][aria-selected=true]')].map(element => element.getAttribute('aria-posinset'))), ['2', '7']);
  await ask('option', optionName(1), 'click'); assert.deepEqual((await read(page)).chosen, ['m6']);
  await ask('button', '派遣 / Send', 'click'); let now = await read(page);
  assert.deepEqual([now.away, now.chosen], [['m6'], []]);
  // An option that is away refuses the request.
  await ask('option', optionName(6, true), 'click'); assert.deepEqual((await read(page)).chosen, []);
  await page.focus('#scene'); await ask('option', optionName(3), 'focus');
  assert.deepEqual([(await read(page)).row, await active(page)], ['m3', ['option', optionName(3)]]);
  await ask('button', '全选 / All', 'click'); now = await read(page);
  assert.deepEqual([now.chosen.length, now.enabled.all], [39, false]);
});

await scenario('on a phone a finger chooses members, drags the scroll bar to reach more, and sends them', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, typeof place === 'string' ? spot[place] : place)); await settle(page); };
  await tap(rowSpot(1)); await tap(rowSpot(3)); let now = await read(page);
  assert.deepEqual([now.chosen, now.hovered], [['m0', 'm2'], []]);
  const session = await page.context().newCDPSession(page), touch = async (type, place) => {
    const [x, y] = await at(page, place);
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }); await settle(page);
  };
  await touch('touchStart', [323, 68]); await touch('touchMove', [323, 100]); await touch('touchMove', [323, 164]); await touch('touchEnd', [323, 164]);
  now = await read(page); assert.deepEqual([Math.round(now.offset), now.rows[0].key, now.dragging], [480, 'm16', false]);
  await session.detach();
  // The members chosen before are still chosen, though their rows are gone.
  await tap(rowSpot(2)); assert.deepEqual((await read(page)).chosen, ['m0', 'm2', 'm17']);
  await tap('send'); now = await read(page);
  assert.deepEqual([now.away, now.chosen, now.sent], [['m0', 'm2', 'm17'], [], 3]);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
