// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-inventory/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-inventory/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-inventory-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiInventoryExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiInventoryExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiInventoryExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units. The bag begins at (16, 44); a slot is 44 square and the next begins 48 further. The buttons are beside it.
const KINDS = { herb: ['灵草', 'Herb'], pill: ['丹药', 'Pill'], iron: ['精铁', 'Iron'], stone: ['灵石', 'Stone'], manual: ['功法', 'Manual'] };
const ABOUT = { herb: '服用后恢复气血 Restores vigour', pill: '服用后增长修为 Raises cultivation', iron: '锻造兵器的材料 Material for the forge', stone: '门派通用的货币 The coin of the sect', manual: '研读后领悟招式 Teaches a technique' };
const START = ['herb 12', 'pill 3', null, 'iron 7', null, null, 'stone 40', null, 'manual 1', null, null, null, null, 'herb 2', null, null, null, null, null, null, 'pill 1', null, null, null];
const spot = index => [16 + (index % 6) * 48 + 22, 44 + Math.floor(index / 6) * 48 + 22], edge = index => [16 + (index % 6) * 48 + 3, 44 + Math.floor(index / 6) * 48 + 3], frame = index => [16 + (index % 6) * 48 - 1, 44 + Math.floor(index / 6) * 48 + 22];
const BUTTONS = { use: ['使用 / Use', [390, 190]], drop: ['丢弃 / Drop', [390, 224]], sort: ['整理 / Sort', [390, 258]] }, buttonEdge = id => [BUTTONS[id][1][0] + 68, BUTTONS[id][1][1] - 10];
const nameOf = slot => { if (slot === null) return '空 / Empty'; const [kind, count] = slot.split(' '); return KINDS[kind][0] + ' / ' + KINDS[kind][1] + ' × ' + count; };
const used = kind => '用了一份' + KINDS[kind][0] + ' / Used one ' + KINDS[kind][1], dropped = kind => '丢弃了' + KINDS[kind][0] + ' / Dropped ' + KINDS[kind][1], refusedUse = kind => KINDS[kind][0] + '不能直接使用 / ' + KINDS[kind][1] + ' cannot be used as it is';
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
const click = async (page, place) => { await page.mouse.click(...await at(page, place)); await settle(page); };
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
/** The tree a state of the bag has. The browser names a row by the cells in it. */
const lines = ({ slots = START, cursor = 0, message = '' }) => {
  const names = slots.map(nameOf), held = slots[cursor], kind = held?.split(' ')[0], usable = kind === 'herb' || kind === 'pill' || kind === 'manual';
  const sorted = !slots.some((slot, index) => slot !== null && slots.slice(0, index).includes(null));
  return ['- application "Bag / 行囊":', '  - grid "行囊 / Bag":', ...[0, 1, 2, 3].flatMap(row => ['    - row "' + names.slice(row * 6, row * 6 + 6).join(' ') + '":',
    ...names.slice(row * 6, row * 6 + 6).map((name, column) => '      - gridcell "' + name + '"' + (row * 6 + column === cursor ? ' [selected]' : ''))]),
  '  - group "详情 / Details": ' + (held === null ? '空 / Empty' : names[cursor] + ' ' + ABOUT[kind]), '  - status' + (message === '' ? '' : ': ' + message),
  '  - button "使用 / Use"' + (usable ? '' : ' [disabled]'), '  - button "丢弃 / Drop"' + (held === null ? ' [disabled]' : ''), '  - button "整理 / Sort"' + (sorted ? ' [disabled]' : '')].join('\n');
};
const after = (slots, changes) => slots.map((slot, index) => Object.hasOwn(changes, index) ? changes[index] : slot);
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-inventory/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiInventoryExample !== undefined);
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

await scenario('at the start the browser computes a grid of four rows of six cells, and the screen shows the bag and nothing else', desktop, async page => {
  assert.equal(await tree(page), lines({}));
  const now = await read(page);
  assert.deepEqual([now.slots, now.cursor, now.message, now.enabled, now.semantics.nodes, now.semantics.projection], [START, 0, '', { use: true, drop: true, sort: true }, 37, 'active']);
  // The grid says how many rows and columns it has, each row which row it is, and each cell which column it is in.
  assert.deepEqual(await page.evaluate(() => { const grid = document.querySelector('[role=grid]'), rows = [...document.querySelectorAll('[role=row]')], cells = [...document.querySelectorAll('[role=gridcell]')];
    return [grid.getAttribute('aria-rowcount'), grid.getAttribute('aria-colcount'), rows.map(row => row.getAttribute('aria-rowindex')).join(''), rows.map(row => row.children.length).join(''),
      cells.slice(0, 7).map(cell => cell.getAttribute('aria-colindex')).join(''), cells.filter(cell => cell.getAttribute('aria-selected') === 'true').length, cells.every(cell => cell.tagName === 'BUTTON' && cell.getAttribute('tabindex') === '-1')]; }),
    ['4', '6', '1234', '6666', '1234561', 1, true]);
  // On the screen: a slot that holds something, an empty one, the quiet frame of the cursor, the page, and three buttons that can act.
  assert.deepEqual([await colour(page, edge(1)), await colour(page, edge(2)), await colour(page, frame(0)), await colour(page, [6, 6]), await colour(page, [300, 300])], ['3d4a63', '252b38', '9aa7c4', '161a22', '161a22']);
  assert.deepEqual([await colour(page, buttonEdge('use')), await colour(page, buttonEdge('drop')), await colour(page, buttonEdge('sort'))], ['3d4a63', '3d4a63', '3d4a63']);
});

await scenario('a press moves the cursor, and the buttons use, drop and close the gaps', desktop, async page => {
  await click(page, spot(3)); let now = await read(page);
  // Iron cannot be used: the button is dimmed. The press gave the bag the focus, without a ring.
  assert.deepEqual([now.cursor, now.focus, now.focusVisible, now.enabled, now.hovered], [3, 'bag', false, { use: false, drop: true, sort: true }, [3]]);
  assert.equal(await tree(page), lines({ cursor: 3 }));
  assert.deepEqual([await colour(page, edge(3)), await colour(page, frame(3)), await colour(page, buttonEdge('use')), await colour(page, buttonEdge('drop'))], ['56689a', '9aa7c4', '2a2d33', '3d4a63']);
  await click(page, BUTTONS.use[1]); now = await read(page); assert.deepEqual([now.slots, now.message], [START, '']);
  await click(page, BUTTONS.drop[1]); now = await read(page);
  let slots = after(START, { 3: null });
  assert.deepEqual([now.slots, now.message, now.enabled], [slots, dropped('iron'), { use: false, drop: false, sort: true }]);
  assert.equal(await tree(page), lines({ slots, cursor: 3, message: dropped('iron') }));
  // The last of a kind empties its slot.
  await click(page, spot(8)); assert.equal((await read(page)).message, '', 'a cursor that moves takes the message away');
  await click(page, BUTTONS.use[1]); now = await read(page);
  slots = after(slots, { 8: null });
  assert.deepEqual([now.slots, now.message, now.used, now.enabled], [slots, used('manual'), 1, { use: false, drop: false, sort: true }]);
  await click(page, spot(0)); await click(page, BUTTONS.use[1]); await click(page, BUTTONS.use[1]); now = await read(page);
  slots = after(slots, { 0: 'herb 10' });
  assert.deepEqual([now.slots, now.message, now.used], [slots, used('herb'), 3]);
  assert.equal(await tree(page), lines({ slots, message: used('herb') }));
  // Sorted, what the bag holds stands at the front in the order it was in, and the button has nothing more to do.
  await click(page, BUTTONS.sort[1]); now = await read(page);
  slots = ['herb 10', 'pill 3', 'stone 40', 'herb 2', 'pill 1', ...new Array(19).fill(null)];
  assert.deepEqual([now.slots, now.cursor, now.message, now.enabled], [slots, 0, '整理好了 / Sorted', { use: true, drop: true, sort: false }]);
  assert.equal(await tree(page), lines({ slots, message: '整理好了 / Sorted' }));
  assert.deepEqual([await colour(page, edge(2)), await colour(page, edge(5)), await colour(page, buttonEdge('sort'))], ['3d4a63', '252b38', '2a2d33']);
});

await scenario('the keyboard alone moves the cursor in two directions, uses an item, and the page stays where it is', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); let now = await read(page);
  assert.deepEqual([now.focus, now.focusVisible, await active(page), await colour(page, frame(0))], ['bag', true, ['gridcell', nameOf(START[0])], 'f2c14e']);
  const walk = async (keys, cursor) => { for (const name of keys) await key(page, name); assert.equal((await read(page)).cursor, cursor, keys.join(' ')); };
  await walk(['ArrowRight'], 1); await walk(['ArrowDown'], 7); await walk(['ArrowLeft'], 6);
  // At an edge the cursor stays, and the key is still the bag's.
  await walk(['ArrowLeft'], 6); await walk(['End'], 11); await walk(['ArrowRight'], 11); await walk(['Home'], 6);
  await walk(['PageDown'], 18); await walk(['ArrowDown'], 18); await walk(['PageUp'], 0); await walk(['ArrowUp'], 0);
  await walk(['Control+End'], 23); await walk(['Control+Home'], 0);
  assert.deepEqual(await active(page), ['gridcell', nameOf(START[0])]);
  // Enter and Space use what is under the cursor.
  await key(page, 'Enter'); await key(page, 'Space'); now = await read(page);
  assert.deepEqual([now.slots[0], now.message, now.used, await active(page)], ['herb 10', used('herb'), 2, ['gridcell', nameOf('herb 10')]]);
  // What cannot be used says so and stays. An empty slot says nothing.
  await walk(['ArrowRight', 'ArrowRight', 'ArrowRight'], 3); await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.slots[3], now.message, now.used], ['iron 7', refusedUse('iron'), 2]);
  await walk(['ArrowRight'], 4); await key(page, 'Enter'); now = await read(page); assert.deepEqual([now.message, now.used], ['', 2]);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
  // On an empty slot only Sort can act, so it is the stop after the bag. Pressed, it has nothing more to do and the focus is on the bag.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '整理 / Sort']);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.enabled, now.focus, now.focusVisible, now.cursor, await active(page)], [{ use: true, drop: true, sort: false }, 'bag', true, 4, ['gridcell', nameOf('manual 1')]]);
  // Use and Drop are stops again. Dropped under the focus, the button gives it to the bag.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '使用 / Use']);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '丢弃 / Drop']);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.slots[4], now.message, now.enabled, now.focus], [null, dropped('manual'), { use: false, drop: false, sort: true }, 'bag']);
  // The gap it left gives Sort something to do again. It is the last stop: after it Tab leaves the canvas, past the elements of the buttons that cannot act.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '整理 / Sort']);
  await key(page, 'Tab'); assert.deepEqual([(await read(page)).focus, await page.evaluate(() => document.activeElement.id === 'scene')], [undefined, false]);
});

await scenario('what happened is said by changing the text of an element that was already there', desktop, async page => {
  await page.evaluate(() => {
    globalThis.said = []; const element = document.querySelector('[role=status]');
    new MutationObserver(() => globalThis.said.push([element.isConnected, element.textContent])).observe(element, { childList: true, characterData: true, subtree: true });
  });
  const said = async () => { await settle(page); return page.evaluate(() => globalThis.said.splice(0)); };
  await click(page, BUTTONS.use[1]); assert.deepEqual(await said(), [[true, used('herb')]]);
  // The same thing again is the same text, which is no change. A cursor that moves takes the message away, and it is said again.
  await click(page, BUTTONS.use[1]); assert.deepEqual(await said(), []);
  await click(page, spot(3)); assert.deepEqual(await said(), [[true, '']]);
  await page.focus('#scene'); await key(page, 'Enter'); assert.deepEqual(await said(), [[true, refusedUse('iron')]]);
  await click(page, spot(0)); await click(page, BUTTONS.use[1]); assert.deepEqual(await said(), [[true, ''], [true, used('herb')]]);
});

await scenario('a request of assistive technology moves the cursor to a cell, gives it the focus, and uses the buttons', desktop, async page => {
  const ask = async (role, name, action, nth = 0) => { await page.getByRole(role, { name, exact: true }).nth(nth).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('gridcell', nameOf('manual 1'), 'click'); let now = await read(page);
  assert.deepEqual([now.cursor, now.focus], [8, undefined]);
  assert.equal(await tree(page), lines({ cursor: 8 }));
  await ask('button', '使用 / Use', 'click'); now = await read(page);
  assert.deepEqual([now.slots[8], now.message], [null, used('manual')]);
  // A button that cannot act refuses the request.
  await ask('button', '丢弃 / Drop', 'click'); assert.deepEqual((await read(page)).message, used('manual'));
  // The third empty cell is asked to take the focus: the bag has it, and the cursor is there.
  await ask('gridcell', '空 / Empty', 'focus', 2); now = await read(page);
  assert.deepEqual([now.cursor, now.focus, now.focusVisible, await active(page)], [5, 'bag', true, ['gridcell', '空 / Empty']]);
  await key(page, 'ArrowDown'); await key(page, 'Home'); await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.cursor, now.message], [6, refusedUse('stone')]);
  await ask('button', '整理 / Sort', 'click'); now = await read(page);
  assert.deepEqual([now.slots.slice(0, 7), now.message], [['herb 12', 'pill 3', 'iron 7', 'stone 40', 'herb 2', 'pill 1', null], '整理好了 / Sorted']);
});

await scenario('on a phone a finger moves the cursor and uses the buttons', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(spot(13)); let now = await read(page); assert.deepEqual([now.cursor, now.enabled.use], [13, true]);
  await tap(BUTTONS.use[1]); await tap(BUTTONS.use[1]); now = await read(page);
  assert.deepEqual([now.slots[13], now.message, now.enabled], [null, used('herb'), { use: false, drop: false, sort: true }]);
  await tap(spot(20)); await tap(BUTTONS.drop[1]); now = await read(page); assert.deepEqual([now.slots[20], now.message], [null, dropped('pill')]);
  await tap(BUTTONS.sort[1]); now = await read(page); assert.deepEqual([now.slots.filter(slot => slot !== null).length, now.enabled.sort], [5, false]);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
