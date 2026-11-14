// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-tree/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-tree/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-tree-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiTreeExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiTreeExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiTreeExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// The same sect the page has: four halls, two squads in each, five members in each squad.
const HALLS = [['丹房', 'Alchemy'], ['器坊', 'Forge'], ['藏经阁', 'Library'], ['演武场', 'Yard']], SQUADS = [['甲队', 'First squad'], ['乙队', 'Second squad']], HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
const items = new Map();
const item = (key, name, parent) => { items.set(key, { name, parent, level: parent === undefined ? 1 : items.get(parent).level + 1, children: [] }); if (parent !== undefined) items.get(parent).children.push(key); };
for (const [hall, [zh, en]] of HALLS.entries()) {
  item('h' + hall, zh + ' / ' + en, undefined);
  for (const [squad, [squadZh, squadEn]] of SQUADS.entries()) {
    item('h' + hall + 's' + squad, squadZh + ' / ' + squadEn, 'h' + hall);
    for (let at = 0; at < 5; at++) { const number = hall * 10 + squad * 5 + at; item('m' + number, '弟子 ' + (number + 1) + ' ' + HEROES[number % 5], 'h' + hall + 's' + squad); }
  }
}
const TOP = ['h0', 'h1', 'h2', 'h3'];
/** The items that show when these are open, from the top. */
const showing = (open, keys = TOP, into = []) => { for (const key of keys) { into.push(key); if (open.includes(key)) showing(open, items.get(key).children, into); } return into; };
// Stage units. The rows begin at y 44 and are 30 high; eight show.
const rowSpot = number => [200, 44 + (number - 1) * 30 + 14];
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
/** The tree a state has: the heading, and the eight items that show from the one at the top, each with what it says of itself. */
const lines = ({ open, selected, first = 0 }) => ['- application "Sect / 门派":', '  - heading "门派 / Sect" [level=1]', '  - tree "门派 / Sect":', ...showing(open).slice(first, first + 8).map(id => { const { name, level, children } = items.get(id);
  return '    - treeitem "' + name + '"' + (children.length > 0 && open.includes(id) ? ' [expanded]' : '') + ' [level=' + level + ']' + (id === selected ? ' [selected]' : ''); }), '  - scrollbar "门派滚动 / Sect scroll"'].join('\n');
/** What each item in the page says in attributes: how deep it is, whether it is open, and where it stands among its own. */
const facts = page => page.evaluate(() => [...document.querySelectorAll('[role=treeitem]')].map(element => [element.getAttribute('aria-level'), element.getAttribute('aria-expanded'), element.getAttribute('aria-posinset') + '/' + element.getAttribute('aria-setsize'), element.getAttribute('aria-selected')].map(String).join(' ')));
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-tree/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiTreeExample !== undefined);
    await settle(page);
    await body(page);
    const last = await read(page);
    assert.equal(last.failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 1000 } }, START = ['h0', 'h0s0'];

await scenario('at the start the browser computes a heading and a tree whose items say how deep they are', desktop, async page => {
  assert.equal(await tree(page), lines({ open: START }));
  const now = await read(page);
  assert.deepEqual([now.open, now.order, now.selected, now.rows.length, now.semantics.nodes, now.semantics.projection], [START, showing(START), undefined, 8, 11, 'active']);
  // A hall is one of four at the first depth, a squad one of two under its hall, a member one of five under its squad. A member has nothing under it and says nothing of being open.
  assert.deepEqual(await facts(page), ['1 true 1/4 false', '2 true 1/2 false', '3 null 1/5 false', '3 null 2/5 false', '3 null 3/5 false', '3 null 4/5 false', '3 null 5/5 false', '2 false 2/2 false']);
  assert.deepEqual(await page.evaluate(() => { const head = document.querySelector('[role=heading]'); return [head.getAttribute('aria-level'), head.textContent, document.querySelectorAll('[role=tree] > [role=treeitem]').length]; }), ['1', '门派 / Sect', 8]);
  // On the screen: a row, the mark of an open item, which is a bar, and of a closed one, which is a cross, and the page.
  assert.deepEqual([await colour(page, [400, 50]), await colour(page, [36, 58]), await colour(page, [36, 52]), await colour(page, [20 + 22 + 16, 44 + 7 * 30 + 10]), await colour(page, [6, 6]), await colour(page, [300, 305])], ['2b2f3a', 'f3e9d2', '2b2f3a', 'f3e9d2', '161a22', '161a22']);
});

await scenario('a press opens and closes a hall or a squad and selects what is pressed', desktop, async page => {
  // The eighth row is the second squad of the first hall.
  await click(page, rowSpot(8)); let now = await read(page), open = ['h0', 'h0s0', 'h0s1'];
  assert.deepEqual([now.open, now.order, now.selected], [open, showing(open), 'h0s1']);
  assert.equal(await tree(page), lines({ open, selected: 'h0s1' }));
  await click(page, rowSpot(8)); now = await read(page);
  assert.deepEqual([now.open, now.order.length, now.selected], [START, 11, 'h0s1']);
  // A member has nothing to open: it is selected.
  await click(page, rowSpot(4)); now = await read(page);
  assert.deepEqual([now.open, now.selected, await colour(page, [400, 44 + 3 * 30 + 6]), await colour(page, [400, 44 + 4 * 30 + 6])], [START, 'm1', '2f8f6b', '2b2f3a']);
  assert.equal(await tree(page), lines({ open: START, selected: 'm1' }));
  // A hall that closes hides everything under it, also what is open and what is selected there. Opened again, it is as it was.
  await click(page, rowSpot(1)); now = await read(page);
  assert.deepEqual([now.open, now.order, now.selected, now.rows.length], [['h0s0'], ['h0', 'h1', 'h2', 'h3'], 'h0', 4]);
  assert.equal(await tree(page), lines({ open: ['h0s0'], selected: 'h0' }));
  await click(page, rowSpot(1)); now = await read(page);
  assert.deepEqual([now.open, now.order], [START, showing(START)]);
});

await scenario('the keyboard alone moves through the items, into and out of them, opens, closes and selects', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).row], [['treeitem', '丹房 / Alchemy'], 'h0']);
  const step = async (name, row, open) => { await key(page, name); const now = await read(page); assert.deepEqual([now.row, now.open], [row, open], name); };
  // Right on an open item goes in, and on a member does nothing. Left on a member goes out, and on an open item closes it.
  await step('ArrowRight', 'h0s0', START); await step('ArrowRight', 'm0', START); await step('ArrowRight', 'm0', START);
  await step('ArrowDown', 'm1', START); await step('ArrowLeft', 'h0s0', START); await step('ArrowLeft', 'h0s0', ['h0']);
  assert.equal(await tree(page), lines({ open: ['h0'] }));
  // Left on a closed item goes out too; Right on it opens it and stays.
  await step('ArrowLeft', 'h0', ['h0']); await step('End', 'h3', ['h0']); await step('ArrowRight', 'h3', ['h0', 'h3']);
  await step('ArrowRight', 'h3s0', ['h0', 'h3']); await step('ArrowRight', 'h3s0', ['h0', 'h3', 'h3s0']); await step('ArrowDown', 'm30', ['h0', 'h3', 'h3s0']);
  await key(page, 'Space'); let now = await read(page);
  assert.deepEqual([now.selected, await active(page)], ['m30', ['treeitem', '弟子 31 青锋']]);
  await step('PageUp', 'h0', ['h0', 'h3', 'h3s0']); await step('PageDown', 'm30', ['h0', 'h3', 'h3s0']); await step('Home', 'h0', ['h0', 'h3', 'h3s0']); await step('ArrowUp', 'h0', ['h0', 'h3', 'h3s0']);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
  // The tree is the only stop: after it Tab leaves the canvas.
  await key(page, 'Tab'); assert.deepEqual([(await read(page)).focus, await page.evaluate(() => document.activeElement.id === 'scene')], [undefined, false]);
});

await scenario('an item that closes over the focus takes the focus, and the tree scrolls as it grows', desktop, async page => {
  await page.focus('#scene'); await key(page, 'Tab'); for (let count = 0; count < 4; count++) await key(page, 'ArrowDown');
  assert.deepEqual([(await read(page)).row, await active(page)], ['m2', ['treeitem', '弟子 3 玄霜']]);
  // The hall is closed with the pointer while a member under it holds the focus.
  await click(page, rowSpot(1)); let now = await read(page);
  assert.deepEqual([now.order, now.row, now.focusVisible, await active(page)], [['h0', 'h1', 'h2', 'h3'], 'h0', true, ['treeitem', '丹房 / Alchemy']]);
  // Four rows fit with room to spare. Opened hall by hall the tree is longer than its window and scrolls.
  for (const row of [4, 3, 2]) await click(page, rowSpot(row));
  now = await read(page); const open = ['h1', 'h2', 'h3'];
  assert.deepEqual([now.open.filter(id => id.length === 2), now.order.length, now.offset], [open, 10, 0]);
  await page.mouse.move(...await at(page, rowSpot(4))); await page.mouse.wheel(0, 300); await settle(page); now = await read(page);
  assert.deepEqual([now.offset, now.rows.map(row => row.key)], [60, showing(now.open).slice(2, 10)]);
  assert.equal(await tree(page), lines({ open: now.open, selected: 'h1', first: 2 }));
  assert.equal(await page.evaluate(() => scrollY), 0);
});

await scenario('a request of assistive technology opens an item, selects one and gives one the focus', desktop, async page => {
  const ask = async (name, action) => { await page.getByRole('treeitem', { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('乙队 / Second squad', 'click'); let now = await read(page);
  assert.deepEqual([now.open, now.selected], [['h0', 'h0s0', 'h0s1'], 'h0s1']);
  await ask('弟子 4 赤霄', 'click'); now = await read(page); assert.deepEqual([now.selected, now.open.length], ['m3', 3]);
  assert.equal((await facts(page))[5], '3 null 4/5 true');
  await ask('甲队 / First squad', 'focus'); now = await read(page);
  assert.deepEqual([now.row, now.focusVisible, await active(page)], ['h0s0', true, ['treeitem', '甲队 / First squad']]);
  await key(page, 'ArrowLeft'); now = await read(page); assert.deepEqual([now.open, now.row], [['h0', 'h0s1'], 'h0s0']);
  assert.equal(await tree(page), lines({ open: ['h0', 'h0s1'], selected: 'm3' }));
});

await scenario('on a phone a finger opens, closes and selects', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(rowSpot(8)); let now = await read(page); assert.deepEqual([now.open, now.selected], [['h0', 'h0s0', 'h0s1'], 'h0s1']);
  await tap(rowSpot(3)); assert.equal((await read(page)).selected, 'm0');
  await tap(rowSpot(2)); now = await read(page); assert.deepEqual([now.open, now.selected, now.order.slice(0, 4)], [['h0', 'h0s1'], 'h0s0', ['h0', 'h0s0', 'h0s1', 'm5']]);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
