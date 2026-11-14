// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-context-menu/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-context-menu/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-context-menu-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiContextMenuExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiContextMenuExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiContextMenuExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units. The roster begins at (20, 44) and is 290 wide; a row is 30 high. The menu is 170 wide with three items of 28.
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'], RANKS = ['外门 Outer', '内门 Inner', '真传 Core'], ACTIONS = ['promote', 'demote', 'rest'];
const ITEMS = { promote: '晋升 / Promote', demote: '降级 / Demote', rest: '休息 / Rest' };
const rowSpot = number => [100, 44 + (number - 1) * 30 + 14], buttonSpot = [403, 99], empty = [420, 290];
const itemSpot = (menu, action) => [menu.x + 140, menu.y + ACTIONS.indexOf(action) * 28 + 14];
const optionName = (index, rank = index % 3, resting = false) => '弟子 ' + (index + 1) + ' ' + HEROES[index % 5] + '，' + RANKS[rank] + (resting ? ' · 休息 Rest' : '');
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
const click = async (page, place, options) => { await page.mouse.click(...await at(page, place), options); await settle(page); };
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
/** The tree a state of the screen has: the names of the first eight members, who is selected, and the menu if it is open with the items that can act. */
const lines = ({ names = Array.from({ length: 8 }, (_, index) => optionName(index)), selected, menu }) => ['- application "Roster / 名册":', '  - listbox "名册 / Roster":',
  ...names.map((name, index) => '    - option "' + name + '"' + (index === selected ? ' [selected]' : '')), '  - scrollbar "名册滚动 / Roster scroll"',
  '  - button "操作 / Actions"' + (selected === undefined ? ' [disabled]' : menu === undefined ? '' : ' [expanded]'),
  ...(menu === undefined ? [] : ['  - menu "操作 / Actions":', ...ACTIONS.map(action => '    - menuitem "' + ITEMS[action] + '"' + (menu.includes(action) ? '' : ' [disabled]'))])].join('\n');
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-context-menu/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiContextMenuExample !== undefined);
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

await scenario('closed, the screen is a list box, its scroll bar and a button that has nothing to open', desktop, async page => {
  assert.equal(await tree(page), lines({}));
  const now = await read(page);
  assert.deepEqual([now.selected, now.open, now.menu, now.buttonEnabled, now.semantics.projection], [undefined, false, undefined, false, 'active']);
  assert.equal(await page.getByRole('button', { name: '操作 / Actions', exact: true }).getAttribute('aria-expanded'), 'false');
});

await scenario('the right button opens the menu of its row, and a press on an item acts for that member', desktop, async page => {
  // Whether the page kept its own menu away is read from the event itself.
  await page.evaluate(() => { globalThis.prevented = []; document.querySelector('#scene').addEventListener('contextmenu', event => queueMicrotask(() => globalThis.prevented.push(event.defaultPrevented))); });
  await click(page, rowSpot(2)); let now = await read(page);
  assert.deepEqual([now.selected, now.open], ['m1', false]);
  await click(page, rowSpot(4), { button: 'right' }); now = await read(page);
  // The member is selected, and the menu hangs from the end of its row.
  assert.deepEqual([now.selected, now.opened, now.open, now.menu, await page.evaluate(() => globalThis.prevented)], ['m3', 'm3', true, { x: 140, y: 164, width: 170, height: 84 }, [true]]);
  assert.equal(await tree(page), lines({ selected: 3, menu: ['promote', 'rest'] }));
  // A member of the outer rank cannot be demoted: the item is dimmed and a press on it does nothing.
  assert.deepEqual([await colour(page, itemSpot(now.menu, 'demote')), await colour(page, itemSpot(now.menu, 'rest'))], ['2a2d33', '3d4a63']);
  await click(page, itemSpot(now.menu, 'demote')); now = await read(page);
  assert.deepEqual([now.open, now.done], [true, []]);
  await click(page, itemSpot(now.menu, 'promote')); now = await read(page);
  assert.deepEqual([now.open, now.opened, now.done, now.ranks[3], now.selected], [false, undefined, ['promote m3'], 'inner', 'm3']);
  assert.equal(await tree(page), lines({ names: Array.from({ length: 8 }, (_, index) => optionName(index, index === 3 ? 1 : index % 3)), selected: 3 }));
  // Open again: now both ranks are within reach. A press elsewhere closes the menu and selects nothing behind it.
  await click(page, rowSpot(4), { button: 'right' }); now = await read(page);
  assert.equal(await tree(page), lines({ names: Array.from({ length: 8 }, (_, index) => optionName(index, index === 3 ? 1 : index % 3)), selected: 3, menu: ACTIONS }));
  await click(page, rowSpot(7)); now = await read(page);
  assert.deepEqual([now.open, now.selected], [false, 'm3']);
  // Near the bottom the menu stands above its row.
  await click(page, rowSpot(8), { button: 'right' }); now = await read(page);
  assert.deepEqual([now.opened, now.menu], ['m7', { x: 140, y: 254 - 84, width: 170, height: 84 }]);
});

await scenario('the keyboard alone opens the menu of the focused row, moves among its items and comes back', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown');
  assert.deepEqual([await active(page), (await read(page)).selected], [['option', optionName(2)], undefined]);
  // The Menu key opens the menu of the row. The member is of the top rank, so the focus is on the first item that can act.
  await key(page, 'ContextMenu'); let now = await read(page);
  assert.deepEqual([now.open, now.opened, now.selected, now.focus, await active(page)], [true, 'm2', 'm2', 'menu:demote', ['menuitem', ITEMS.demote]]);
  assert.equal(await tree(page), lines({ selected: 2, menu: ['demote', 'rest'] }));
  await key(page, 'ArrowDown'); assert.deepEqual(await active(page), ['menuitem', ITEMS.rest]);
  // Past the last item is the first. It cannot act for this member: Enter on it does nothing and the menu stays.
  await key(page, 'ArrowDown'); assert.deepEqual(await active(page), ['menuitem', ITEMS.promote]);
  await key(page, 'Enter'); now = await read(page); assert.deepEqual([now.open, now.done], [true, []]);
  await key(page, 'ArrowUp'); assert.deepEqual(await active(page), ['menuitem', ITEMS.rest]);
  await key(page, 'Home'); await key(page, 'End'); assert.deepEqual(await active(page), ['menuitem', ITEMS.rest]);
  // Enter acts, the menu closes, and the focus is on the row, which says what changed.
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.open, now.done, now.resting, now.focus, await active(page)], [false, ['rest m2'], ['m2'], 'roster:m2', ['option', optionName(2, 2, true)]]);
  // Shift with F10 opens it as the Menu key does, and Escape closes it with nothing done.
  await key(page, 'Shift+F10'); assert.deepEqual([(await read(page)).open, await active(page)], [true, ['menuitem', ITEMS.demote]]);
  await key(page, 'Escape'); now = await read(page);
  assert.deepEqual([now.open, now.done, now.focus], [false, ['rest m2'], 'roster:m2']);
  // The button opens the menu of the selected member, says that it is open, and has the focus again when it closes.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '操作 / Actions']);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.open, now.opened, await page.getByRole('button', { name: '操作 / Actions', exact: true }).getAttribute('aria-expanded')], [true, 'm2', 'true']);
  await key(page, 'Escape'); now = await read(page);
  assert.deepEqual([now.open, now.focus, await page.getByRole('button', { name: '操作 / Actions', exact: true }).getAttribute('aria-expanded')], [false, 'open', 'false']);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
});

await scenario('the button brings a selected row that scrolled away back into view, and the menu closes when its row leaves', desktop, async page => {
  await click(page, rowSpot(2));
  await page.mouse.move(...await at(page, rowSpot(5))); await page.mouse.wheel(0, 300); await settle(page); let now = await read(page);
  assert.ok(now.offset === 300 && !now.rows.some(row => row.key === 'm1'));
  await click(page, buttonSpot); now = await read(page);
  const row = now.rows.find(found => found.key === 'm1');
  assert.ok(row !== undefined && now.offset < 300, 'the row is shown again');
  assert.deepEqual([now.open, now.opened, now.menu], [true, 'm1', { x: 140, y: row.y + row.height, width: 170, height: 84 }]);
  assert.equal(await colour(page, [450, 108]), '56689a', 'the button is painted as open');
  await page.mouse.move(...await at(page, rowSpot(5))); await page.mouse.wheel(0, 400); await settle(page); now = await read(page);
  assert.deepEqual([now.open, now.opened, now.selected, (await tree(page)).includes('- menu')], [false, undefined, 'm1', false]);
  assert.equal(await page.evaluate(() => scrollY), 0);
});

await scenario('a request of assistive technology selects a member, opens the menu and acts', desktop, async page => {
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('option', optionName(4), 'click'); assert.equal((await read(page)).selected, 'm4');
  await ask('button', '操作 / Actions', 'click'); let now = await read(page);
  assert.deepEqual([now.open, now.opened], [true, 'm4']);
  assert.equal(await tree(page), lines({ selected: 4, menu: ACTIONS }));
  await ask('menuitem', ITEMS.demote, 'click'); now = await read(page);
  assert.deepEqual([now.open, now.done, now.ranks[4]], [false, ['demote m4'], 'outer']);
  // An item that cannot act refuses the request.
  await ask('button', '操作 / Actions', 'click'); await ask('menuitem', ITEMS.demote, 'click'); now = await read(page);
  assert.deepEqual([now.open, now.done], [true, ['demote m4']]);
  await ask('menuitem', ITEMS.rest, 'focus'); assert.deepEqual(await active(page), ['menuitem', ITEMS.rest]);
});

await scenario('on a phone a finger selects a member and uses the button', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(rowSpot(3)); assert.deepEqual([(await read(page)).selected, (await read(page)).open], ['m2', false]);
  await tap(buttonSpot); let now = await read(page);
  assert.deepEqual([now.open, now.opened], [true, 'm2']);
  await tap(itemSpot(now.menu, 'rest')); now = await read(page);
  assert.deepEqual([now.open, now.resting, now.done], [false, ['m2'], ['rest m2']]);
  await tap(buttonSpot); await tap(empty); assert.equal((await read(page)).open, false);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
