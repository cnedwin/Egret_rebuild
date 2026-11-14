// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-roster-table/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-roster-table/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-roster-table-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiRosterTableExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiRosterTableExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiRosterTableExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// The same members the page has: their rank, their job and their level are worked out from their number.
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'], RANKS = ['外门 Outer', '内门 Inner', '真传 Core'], JOBS = ['待命 Idle', '采药 Herbs', '锻造 Forge', '守山 Guard', '修习 Study'], COUNT = 40;
const member = index => ({ name: '弟子 ' + (index + 1) + ' ' + HEROES[index % 5], rank: index * 7 % 3, job: index * 3 % 5, level: index * 37 % 89 + 1 });
const cellsOf = index => { const who = member(index); return [who.name, RANKS[who.rank], JOBS[who.job], String(who.level)]; };
const COLUMNS = [['name', '姓名 / Name', 70, index => index], ['rank', '品阶 / Rank', 187, index => member(index).rank], ['job', '职务 / Job', 282, index => member(index).job], ['level', '修为 / Level', 395, index => member(index).level]];
const ordered = (column, way) => { const by = COLUMNS.find(found => found[0] === column)[3], turn = way === 'ascending' ? 1 : -1; return Array.from({ length: COUNT }, (_, index) => index).sort((a, b) => (by(a) - by(b)) * turn || a - b); };
const keys = order => order.map(index => 'm' + index);
// Stage units. The headers are at y 44 to 70, the rows begin at 74 and are 30 high.
const headSpot = column => [COLUMNS.find(found => found[0] === column)[2], 57], headTop = column => [headSpot(column)[0], 45], headBottom = column => [headSpot(column)[0], 68];
const rowSpot = number => [100, 74 + (number - 1) * 30 + 14];
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
/** The element the canvas names as the one that holds the focus: its role, and its name or what it holds. */
const active = page => page.evaluate(() => {
  const id = document.querySelector('#scene').getAttribute('aria-activedescendant'), element = id === null ? null : document.getElementById(id);
  return element === null ? null : [element.getAttribute('role') ?? element.tagName.toLowerCase(), element.getAttribute('aria-label') ?? [...element.children].map(child => child.getAttribute('aria-label')).join(' ')];
});
const tree = page => page.locator('#surface').ariaSnapshot();
/** The tree a state of the table has: the row of headers, the seven rows that show, and how it is sorted. The browser names a row by what is in it. */
const lines = ({ order, first = 0, selected, said = '按姓名升序 / By name, ascending' }) => ['- application "Roster / 名册":', '  - grid "名册 / Roster":', '    - row "' + COLUMNS.map(column => column[1]).join(' ') + '":',
  ...COLUMNS.map(column => '      - columnheader "' + column[1] + '"'), ...order.slice(first, first + 7).flatMap(index => ['    - row "' + cellsOf(index).join(' ') + '"' + (index === selected ? ' [selected]' : '') + ':',
    ...cellsOf(index).map(cell => '      - gridcell "' + cell + '"')]), '  - scrollbar "名册滚动 / Roster scroll"', '  - status: ' + said].join('\n');
/** What the page says of the grid in attributes: its counts, how each header says it is sorted, and the index and selection of each row that shows. */
const facts = page => page.evaluate(() => { const grid = document.querySelector('[role=grid]'), rows = [...grid.querySelectorAll('[role=row]')];
  return { counts: [grid.getAttribute('aria-rowcount'), grid.getAttribute('aria-colcount')], sorts: [...grid.querySelectorAll('[role=columnheader]')].map(head => head.getAttribute('aria-sort')),
    rows: rows.map(row => [Number(row.getAttribute('aria-rowindex')), row.getAttribute('aria-selected')]), columns: [...rows[1].children].map(cell => cell.getAttribute('aria-colindex')).join('') }; });
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-roster-table/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiRosterTableExample !== undefined);
    await settle(page);
    await body(page);
    const last = await read(page);
    assert.equal(last.failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 1000 } }, byName = ordered('name', 'ascending');

await scenario('at the start the browser computes a grid of forty-one rows, of which the headers and seven members show', desktop, async page => {
  assert.equal(await tree(page), lines({ order: byName }));
  const now = await read(page);
  assert.deepEqual([now.sorted, now.order, now.selected, now.rows.map(row => row.key), now.semantics.nodes, now.semantics.projection], [{ column: 'name', way: 'ascending' }, keys(byName), undefined, keys(byName).slice(0, 7), 43, 'active']);
  // The first row of the grid is the headers, so the first member is its second row. No row says that it is selected or that it is not: nothing was selected yet.
  assert.deepEqual(await facts(page), { counts: ['41', '4'], sorts: ['ascending', 'none', 'none', 'none'], rows: [[1, null], [2, 'false'], [3, 'false'], [4, 'false'], [5, 'false'], [6, 'false'], [7, 'false'], [8, 'false']], columns: '1234' });
  // On the screen: the bar along the top of the header the rows are sorted by, a header without one, a row, and the page.
  assert.deepEqual([await colour(page, headTop('name')), await colour(page, headTop('rank')), await colour(page, headBottom('name')), await colour(page, [30, 80]), await colour(page, [6, 6]), await colour(page, [300, 305])], ['f3e9d2', '3d4a63', '3d4a63', '2b2f3a', '161a22', '161a22']);
});

await scenario('a press on a header sorts by its column and again turns the order round, and a press on a row selects its member', desktop, async page => {
  await click(page, headSpot('rank')); let now = await read(page), order = ordered('rank', 'ascending');
  assert.deepEqual([now.sorted, now.order, now.rows.map(row => row.key)], [{ column: 'rank', way: 'ascending' }, keys(order), keys(order).slice(0, 7)]);
  assert.equal(await tree(page), lines({ order, said: '按品阶升序 / By rank, ascending' }));
  assert.deepEqual([(await facts(page)).sorts, await colour(page, headTop('rank')), await colour(page, headTop('name'))], [['none', 'ascending', 'none', 'none'], 'f3e9d2', '3d4a63']);
  // The pointer rests on the header it pressed: the header is lit, and its bar is along the bottom when the rows descend.
  await click(page, headSpot('rank')); now = await read(page); order = ordered('rank', 'descending');
  assert.deepEqual([now.sorted, now.order.slice(0, 3), (await facts(page)).sorts], [{ column: 'rank', way: 'descending' }, keys(order).slice(0, 3), ['none', 'descending', 'none', 'none']]);
  assert.deepEqual([await colour(page, headBottom('rank')), await colour(page, headTop('rank'))], ['f3e9d2', '56689a']);
  assert.equal(await tree(page), lines({ order, said: '按品阶降序 / By rank, descending' }));
  // Another column begins ascending. The levels are all different, so the order is that of the levels alone.
  await click(page, headSpot('level')); now = await read(page); order = ordered('level', 'ascending');
  assert.deepEqual([now.sorted, now.order, member(order[0]).level, member(order[39]).level], [{ column: 'level', way: 'ascending' }, keys(order), 1, 89]);
  // A press on a row selects the member who stands there now.
  await click(page, rowSpot(3)); now = await read(page);
  assert.deepEqual([now.selected, await colour(page, [30, 74 + 2 * 30 + 4]), await colour(page, [30, 74 + 3 * 30 + 4])], ['m' + order[2], '2f8f6b', '2b2f3a']);
  assert.equal(await tree(page), lines({ order, selected: order[2], said: '按修为升序 / By level, ascending' }));
  assert.deepEqual((await facts(page)).rows.slice(1, 5), [[2, 'false'], [3, 'false'], [4, 'true'], [5, 'false']]);
  // Sorted another way, the member is still the one selected, wherever the row now is, and the table shows its top.
  await page.mouse.move(...await at(page, rowSpot(4))); await page.mouse.wheel(0, 300); await settle(page); assert.equal((await read(page)).offset, 300);
  await click(page, headSpot('name')); now = await read(page);
  assert.deepEqual([now.sorted, now.offset, now.selected, now.order], [{ column: 'name', way: 'ascending' }, 0, 'm' + order[2], keys(byName)]);
});

await scenario('the wheel scrolls the rows, and each row that shows says where it is in the whole table', desktop, async page => {
  await page.mouse.move(...await at(page, rowSpot(4))); await page.mouse.wheel(0, 450); await settle(page); let now = await read(page);
  assert.deepEqual([now.offset, now.rows.map(row => row.key)], [450, keys(byName).slice(15, 22)]);
  assert.equal(await tree(page), lines({ order: byName, first: 15 }));
  assert.deepEqual((await facts(page)).rows.map(row => row[0]), [1, 17, 18, 19, 20, 21, 22, 23]);
  await page.mouse.wheel(0, 9000); await settle(page); now = await read(page);
  assert.deepEqual([now.offset, (await facts(page)).rows.map(row => row[0]).at(-1), await page.evaluate(() => scrollY)], [990, 41, 0]);
});

await scenario('the keyboard alone goes through the headers into the rows, sorts, moves and selects', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).focus], [['columnheader', '姓名 / Name'], 'head-name']);
  // Enter on the header the rows are sorted by turns the order round.
  await key(page, 'Enter'); let now = await read(page), order = ordered('name', 'descending');
  assert.deepEqual([now.sorted, now.order.slice(0, 2), now.focus], [{ column: 'name', way: 'descending' }, ['m39', 'm38'], 'head-name']);
  await key(page, 'Tab'); await key(page, 'Tab'); await key(page, 'Tab'); assert.deepEqual(await active(page), ['columnheader', '修为 / Level']);
  await key(page, 'Space'); now = await read(page); order = ordered('level', 'ascending');
  assert.deepEqual([now.sorted, now.order, (await facts(page)).sorts], [{ column: 'level', way: 'ascending' }, keys(order), ['none', 'none', 'none', 'ascending']]);
  // The rows are the stop after the headers: the first row, which is the focused node as a row.
  await key(page, 'Tab'); now = await read(page);
  assert.deepEqual([now.row, now.focusVisible, await active(page)], ['m' + order[0], true, ['row', cellsOf(order[0]).join(' ')]]);
  await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); await key(page, 'Space'); now = await read(page);
  assert.deepEqual([now.row, now.selected, await active(page)], ['m' + order[2], 'm' + order[2], ['row', cellsOf(order[2]).join(' ')]]);
  // The arrow keys follow the order the rows have now. The last row is the forty-first of the grid.
  await key(page, 'PageDown'); assert.equal((await read(page)).row, 'm' + order[9]);
  await key(page, 'End'); now = await read(page);
  assert.deepEqual([now.row, now.rows.at(-1).key, (await facts(page)).rows.at(-1)], ['m' + order[39], 'm' + order[39], [41, 'false']]);
  await key(page, 'Home'); await key(page, 'ArrowUp'); now = await read(page);
  assert.deepEqual([now.row, now.offset, now.selected, (await facts(page)).rows[3]], ['m' + order[0], 0, 'm' + order[2], [4, 'true']]);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
  // The rows are the last stop: after them Tab leaves the canvas, past the cells, which are elements of the page that take no focus.
  await key(page, 'Tab'); assert.deepEqual([(await read(page)).focus, await page.evaluate(() => document.activeElement.id === 'scene')], [undefined, false]);
});

await scenario('a request of assistive technology sorts by a header, selects a row and gives a row the focus, and the sort is said', desktop, async page => {
  await page.evaluate(() => {
    globalThis.said = []; const element = document.querySelector('[role=status]');
    new MutationObserver(() => globalThis.said.push([element.isConnected, element.textContent])).observe(element, { childList: true, characterData: true, subtree: true });
  });
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('columnheader', '职务 / Job', 'click'); let now = await read(page), order = ordered('job', 'ascending');
  assert.deepEqual([now.sorted, now.order, await page.evaluate(() => globalThis.said.splice(0))], [{ column: 'job', way: 'ascending' }, keys(order), [[true, '按职务升序 / By job, ascending']]]);
  await ask('row', cellsOf(order[4]).join(' '), 'click'); now = await read(page);
  assert.deepEqual([now.selected, (await facts(page)).rows[5]], ['m' + order[4], [6, 'true']]);
  await ask('row', cellsOf(order[1]).join(' '), 'focus'); now = await read(page);
  assert.deepEqual([now.row, now.focusVisible, await active(page)], ['m' + order[1], true, ['row', cellsOf(order[1]).join(' ')]]);
  await ask('columnheader', '职务 / Job', 'focus'); assert.deepEqual([(await read(page)).focus, await active(page)], ['head-job', ['columnheader', '职务 / Job']]);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.sorted, await page.evaluate(() => globalThis.said.splice(0))], [{ column: 'job', way: 'descending' }, [[true, '按职务降序 / By job, descending']]]);
});

await scenario('on a phone a finger sorts, selects, and drags the scroll bar', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(headSpot('level')); await tap(headSpot('level')); let now = await read(page); const order = ordered('level', 'descending');
  assert.deepEqual([now.sorted, now.order.slice(0, 3)], [{ column: 'level', way: 'descending' }, keys(order).slice(0, 3)]);
  await tap(rowSpot(2)); assert.equal((await read(page)).selected, 'm' + order[1]);
  // The thumb is dragged by an injected touch through the protocol of the browser, in the units of the page.
  const client = await page.context().newCDPSession(page), [x, top] = await at(page, [453, 84]), [, bottom] = await at(page, [453, 204]);
  const touch = (type, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', top); for (let step = 1; step <= 6; step++) await touch('touchMove', top + (bottom - top) * step / 6); await touch('touchEnd', bottom); await settle(page);
  now = await read(page);
  assert.ok(now.offset > 300 && now.selected === 'm' + order[1] && !now.rows.some(row => row.key === 'm' + order[1]), JSON.stringify([now.offset, now.rows.map(row => row.key)]));
  assert.equal((await facts(page)).rows[1][0], Math.round(now.rows[0].index) + 2);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
