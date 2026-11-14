// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-dropdown/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-dropdown/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-dropdown-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiDropdownExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiDropdownExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiDropdownExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units. The roster begins at (20, 44) and is 420 wide; a row is 30 high, and its chip is the last 160 of it.
// A popup is as wide as the chip, with five options of 26.
const JOBS = ['idle', 'herbs', 'forge', 'guard', 'study'], JOB_NAMES = { idle: '待命 Idle', herbs: '采药 Herbs', forge: '锻造 Forge', guard: '守山 Guard', study: '修习 Study' };
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
const rowSpot = number => [120, 44 + (number - 1) * 30 + 14], chipSpot = number => [300, 44 + (number - 1) * 30 + 8], empty = [460, 300];
const optionSpot = (popup, job) => [popup.x + 130, popup.y + JOBS.indexOf(job) * 26 + 13];
// A place on a row between the name and the chip, where the paint of the row itself shows.
const rowPaint = number => [240, 44 + (number - 1) * 30 + 14];
const itemName = (index, job = JOBS[index % 5]) => '弟子 ' + (index + 1) + ' ' + HEROES[index % 5] + '，' + JOB_NAMES[job];
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
const rosterLines = (names) => ['- application "Roster / 名册":', '  - list "名册 / Roster":', ...names.map(name => '    - listitem "' + name + '"'), '  - scrollbar "名册滚动 / Roster scroll"'];
const jobLines = chosen => ['  - listbox "职务 / Job":', ...JOBS.map(job => '    - option "' + JOB_NAMES[job] + '"' + (job === chosen ? ' [selected]' : ''))];
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-dropdown/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiDropdownExample !== undefined);
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
const first = Array.from({ length: 8 }, (_, index) => itemName(index));

await scenario('closed, the screen is a list of members and nothing else', desktop, async page => {
  assert.equal(await tree(page), rosterLines(first).join('\n'));
  const now = await read(page);
  assert.deepEqual([now.open, now.opened, now.popup, now.rows.length, now.semantics.nodes, now.semantics.projection], [false, undefined, undefined, 8, 10, 'active']);
  // The scroll bar says where the roster is, and names the list as what it scrolls.
  assert.deepEqual(await page.evaluate(() => { const bar = document.querySelector('[role=scrollbar]'), list = document.getElementById(bar.getAttribute('aria-controls'));
    return [bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemin'), bar.getAttribute('aria-valuemax'), bar.getAttribute('aria-orientation'), list.getAttribute('role'), list.getAttribute('aria-label')]; }),
    ['0', '0', '960', 'vertical', 'list', '名册 / Roster']);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[role=listitem]')].slice(0, 2).map(element => [element.getAttribute('aria-posinset'), element.getAttribute('aria-setsize')])), [['1', '40'], ['2', '40']]);
  // The jobs were never opened: they are not drawn anywhere, and their options are not stops of the keyboard.
  assert.deepEqual([await colour(page, [6, 6]), await colour(page, [100, 36])], ['161a22', '161a22']);
  await page.focus('#scene'); const stops = [];
  for (let count = 0; count < 3; count++) { await key(page, 'Tab'); stops.push(String((await read(page)).focus)); }
  assert.equal(stops.some(stop => stop.startsWith('jobs:')), false, stops.join(' '));
  assert.equal((await read(page)).failure, undefined);
});

await scenario('a press opens the jobs under the chip of its row, and a press on a job gives it to the member', desktop, async page => {
  await click(page, rowSpot(2)); let now = await read(page);
  // The end of the popup meets the end of the row, straight under it.
  assert.deepEqual([now.open, now.opened, now.popup], [true, 'm1', { x: 280, y: 104, width: 160, height: 130 }]);
  assert.equal(await tree(page), [...rosterLines(first), ...jobLines('herbs')].join('\n'));
  // The chip of the open row, the job the member has, and another job, as they are painted.
  assert.deepEqual([await colour(page, chipSpot(2)), await colour(page, chipSpot(1)), await colour(page, optionSpot(now.popup, 'herbs')), await colour(page, optionSpot(now.popup, 'guard'))], ['56689a', '3d4a63', '2f8f6b', '3d4a63']);
  await click(page, optionSpot(now.popup, 'guard')); now = await read(page);
  assert.deepEqual([now.open, now.opened, now.popup, now.jobs.slice(0, 4)], [false, undefined, undefined, ['idle', 'guard', 'forge', 'guard']]);
  assert.equal(await tree(page), rosterLines(first.map((name, index) => index === 1 ? itemName(1, 'guard') : name)).join('\n'));
  assert.equal(await colour(page, chipSpot(2)), '3d4a63');
  // A row that is pointed at is lit, and darker while it is held; the rows beside it are as they were.
  await page.mouse.move(...await at(page, rowSpot(4))); await settle(page); now = await read(page);
  assert.deepEqual([now.hovered, await colour(page, rowPaint(4)), await colour(page, rowPaint(3)), await colour(page, rowPaint(5))], [['m3'], '454c5e', '2b2f3a', '2b2f3a']);
  await page.mouse.down(); await settle(page); assert.equal(await colour(page, rowPaint(4)), '232730');
  // The release is the activation. With the pointer away again the row is as it was.
  await page.mouse.up(); await settle(page); assert.deepEqual([(await read(page)).open, (await read(page)).opened], [true, 'm3']);
  await click(page, empty); now = await read(page);
  assert.deepEqual([now.open, now.hovered, await colour(page, rowPaint(4))], [false, [], '343a48']);
  // The jobs are pointed at and held in the same way.
  await click(page, rowSpot(1)); now = await read(page);
  await page.mouse.move(...await at(page, optionSpot(now.popup, 'forge'))); await settle(page);
  assert.deepEqual([(await read(page)).hoveredOption, await colour(page, optionSpot(now.popup, 'forge')), await colour(page, optionSpot(now.popup, 'idle'))], [['forge'], '56689a', '2f8f6b']);
  await page.mouse.down(); await settle(page); assert.equal(await colour(page, optionSpot(now.popup, 'forge')), '27314a');
  await page.mouse.up(); await settle(page); now = await read(page);
  assert.deepEqual([now.open, now.jobs[0]], [false, 'forge']);
  // The job it has now is the one marked when the jobs open again; choosing the same job changes nothing.
  await click(page, rowSpot(2)); now = await read(page);
  assert.equal(await colour(page, optionSpot(now.popup, 'guard')), '2f8f6b');
  await click(page, optionSpot(now.popup, 'guard')); now = await read(page);
  assert.deepEqual([now.open, now.jobs[1]], [false, 'guard']);
});

await scenario('the popup leaves the clip of the roster, turns above a row near the bottom, and covers what is behind it', desktop, async page => {
  await click(page, rowSpot(8)); let now = await read(page);
  // Under the last row there is no room on the stage: the jobs stand above it.
  assert.deepEqual([now.opened, now.popup], ['m7', { x: 280, y: 124, width: 160, height: 130 }]);
  // The option lies over the chips of other rows. A press on it reaches the option, never the row behind.
  await click(page, optionSpot(now.popup, 'idle')); now = await read(page);
  assert.deepEqual([now.open, now.opened, now.jobs[7], now.jobs[2]], [false, undefined, 'idle', 'forge']);
  // Under a row in the middle the jobs reach below the roster, which ends at 284: they are not cut to its clip.
  const below = [410, 291]; assert.equal(await colour(page, below), '161a22');
  await click(page, rowSpot(4)); now = await read(page);
  assert.deepEqual(now.popup, { x: 280, y: 164, width: 160, height: 130 });
  assert.equal(await colour(page, below), '3d4a63');
  // And above a row a little lower they begin above the roster, which begins at 44.
  await click(page, empty); await click(page, rowSpot(5)); now = await read(page);
  assert.deepEqual(now.popup, { x: 280, y: 34, width: 160, height: 130 });
  assert.equal(await colour(page, [410, 38]), '3d4a63');
});

await scenario('a press elsewhere closes the jobs and reaches nothing behind them', desktop, async page => {
  await click(page, rowSpot(1)); assert.equal((await read(page)).opened, 'm0');
  await click(page, rowSpot(7)); let now = await read(page);
  assert.deepEqual([now.open, now.opened, now.jobs.slice(0, 8)], [false, undefined, JOBS.concat(JOBS).slice(0, 8)], 'the press that dismissed opened nothing');
  await click(page, rowSpot(7)); assert.equal((await read(page)).opened, 'm6');
  await click(page, empty); now = await read(page);
  assert.deepEqual([now.open, now.opened], [false, undefined]);
  assert.equal(await tree(page), rosterLines(first).join('\n'));
});

await scenario('the keyboard alone opens the jobs, moves among them, chooses, and comes back to the row', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).row], [['listitem', itemName(0)], 'm0']);
  await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); assert.deepEqual(await active(page), ['listitem', itemName(2)]);
  // Enter opens the jobs with the focus on the one the member has.
  await key(page, 'Enter'); let now = await read(page);
  assert.deepEqual([now.open, now.opened, now.focus, now.option, await active(page)], [true, 'm2', 'jobs:forge', 'forge', ['option', JOB_NAMES.forge]]);
  assert.equal(await page.getByRole('option', { name: JOB_NAMES.forge, exact: true }).getAttribute('aria-selected'), 'true');
  await key(page, 'ArrowDown'); assert.deepEqual(await active(page), ['option', JOB_NAMES.guard]);
  await key(page, 'End'); await key(page, 'ArrowDown'); assert.deepEqual(await active(page), ['option', JOB_NAMES.study]);
  await key(page, 'Home'); await key(page, 'ArrowUp'); assert.deepEqual(await active(page), ['option', JOB_NAMES.idle]);
  // Tab stays among the jobs while they are open.
  await key(page, 'Tab'); assert.match((await read(page)).focus, /^jobs:/);
  await key(page, 'Shift+Tab'); assert.deepEqual(await active(page), ['option', JOB_NAMES.idle]);
  // Escape closes them, changes nothing, and the focus is on the row again.
  await key(page, 'Escape'); now = await read(page);
  assert.deepEqual([now.open, now.jobs[2], now.focus, now.row, await active(page)], [false, 'forge', 'roster:m2', 'm2', ['listitem', itemName(2)]]);
  // Space opens as Enter does; a job chosen with Enter is the member's, and the row that was bound again holds the focus.
  await key(page, 'Space'); await key(page, 'ArrowUp'); assert.deepEqual(await active(page), ['option', JOB_NAMES.herbs]);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.open, now.jobs[2], now.focus, now.focusVisible, await active(page)], [false, 'herbs', 'roster:m2', true, ['listitem', itemName(2, 'herbs')]]);
  // The roster scrolls under the focus, and the jobs of its last row stand above it.
  await key(page, 'End'); now = await read(page);
  assert.deepEqual([now.row, now.offset, now.rows.at(-1).key], ['m39', 40 * 30 - 240, 'm39']);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.opened, now.popup.y, await active(page)], ['m39', 254 - 130, ['option', JOB_NAMES.study]]);
  await key(page, 'Escape'); assert.deepEqual(await active(page), ['listitem', itemName(39)]);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
});

await scenario('the wheel scrolls the roster, the jobs follow their row, and close when the row is gone', desktop, async page => {
  await click(page, rowSpot(3)); let now = await read(page);
  assert.deepEqual([now.opened, now.popup.y, now.offset], ['m2', 134, 0]);
  await page.mouse.move(...await at(page, rowSpot(5))); await page.mouse.wheel(0, 40); await settle(page); now = await read(page);
  assert.deepEqual([now.offset, now.open, now.opened, now.popup.y], [40, true, 'm2', 94], 'the jobs moved with their row');
  // Scrolled until the row has left the roster, the jobs are closed and gone from the tree.
  await page.mouse.wheel(0, 100); await settle(page); now = await read(page);
  assert.ok(now.offset === 140 && !now.rows.some(row => row.key === 'm2'));
  // The pointer has not moved, and the row that came under it is the one that is lit.
  const under = now.rows.find(row => row.y <= rowSpot(5)[1] && rowSpot(5)[1] < row.y + row.height).key;
  assert.deepEqual([now.hovered, await colour(page, rowPaint(5))], [[under], '454c5e']);
  assert.deepEqual([now.open, now.opened, now.popup], [false, undefined, undefined]);
  assert.equal((await tree(page)).includes('listbox'), false);
  assert.equal(await page.evaluate(() => scrollY), 0, 'the wheel that scrolled the roster did not scroll the page');
  // The rows that show now open their own jobs.
  await click(page, rowSpot(1)); now = await read(page);
  assert.equal(now.opened, now.rows.find(row => row.y <= rowSpot(1)[1] && rowSpot(1)[1] < row.y + row.height).key);
});

await scenario('the thumb of the scroll bar is dragged, and the jobs of a row that was out of reach open', desktop, async page => {
  let now = await read(page);
  // The roster shows a fifth of its length, so the thumb is a fifth of the track: 48 of 240, with 192 to travel for 960.
  assert.deepEqual([now.thumb, now.offset], [{ x: 446, y: 44, width: 14, height: 48 }, 0]);
  const grip = [453, 68];
  await page.mouse.move(...await at(page, grip)); await settle(page); assert.equal(await colour(page, grip), '7385b8', 'the thumb is pointed at');
  await page.mouse.down(); await settle(page); assert.deepEqual([(await read(page)).dragging, await colour(page, grip)], [true, '9aa7c4']);
  // Sixty along the track is three hundred of the roster: ten rows.
  await page.mouse.move(...await at(page, [453, 128]), { steps: 6 }); await settle(page); now = await read(page);
  assert.deepEqual([now.offset, now.thumb.y, now.rows[0].key, now.rows.length], [300, 104, 'm10', 8]);
  assert.equal(await page.getByRole('scrollbar').getAttribute('aria-valuenow'), '300');
  // The drag goes on beside the track and stops at its ends.
  await page.mouse.move(...await at(page, [300, 400]), { steps: 6 }); await settle(page); now = await read(page);
  assert.deepEqual([now.offset, now.thumb.y, now.rows.at(-1).key], [960, 236, 'm39']);
  await page.mouse.move(...await at(page, [453, 20]), { steps: 6 }); await settle(page); assert.equal((await read(page)).offset, 0);
  await page.mouse.move(...await at(page, [453, 116]), { steps: 6 }); await page.mouse.up(); await settle(page); now = await read(page);
  assert.deepEqual([now.dragging, now.offset, now.rows[0].key], [false, 240, 'm8']);
  await page.mouse.move(...await at(page, [453, 200])); await settle(page); assert.equal((await read(page)).offset, 240, 'a pointer that is not down drags nothing');
  // A row that could not be reached before opens its jobs.
  await click(page, rowSpot(2)); now = await read(page);
  assert.deepEqual([now.open, now.opened], [true, 'm9']);
  // With the jobs open, a press on the thumb is a press outside them: it closes them and drags nothing.
  const drag = async () => { const from = (await read(page)).thumb.y + 10;
    await page.mouse.move(...await at(page, [453, from])); await page.mouse.down(); await page.mouse.move(...await at(page, [453, from + 110]), { steps: 6 }); await page.mouse.up(); await settle(page); };
  await drag(); now = await read(page);
  assert.deepEqual([now.open, now.opened, now.offset], [false, undefined, 240]);
  await drag(); now = await read(page);
  assert.ok(now.offset > 240 && !now.rows.some(row => row.key === 'm9'));
  assert.equal(await page.evaluate(() => scrollY), 0);
});

await scenario('a request of assistive technology opens the jobs and chooses one', desktop, async page => {
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('listitem', itemName(4), 'click'); let now = await read(page);
  assert.deepEqual([now.open, now.opened], [true, 'm4']);
  assert.equal(await tree(page), [...rosterLines(first), ...jobLines('study')].join('\n'));
  await ask('option', JOB_NAMES.idle, 'click'); now = await read(page);
  assert.deepEqual([now.open, now.jobs[4]], [false, 'idle']);
  assert.equal(await page.getByRole('listitem', { name: itemName(4, 'idle'), exact: true }).count(), 1);
  // Asked for the row that is open, the jobs close.
  await ask('listitem', itemName(0), 'click'); assert.equal((await read(page)).opened, 'm0');
  await ask('listitem', itemName(0), 'click'); assert.deepEqual([(await read(page)).open, (await read(page)).opened], [false, undefined]);
  // A row can be asked to take the focus.
  await page.focus('#scene'); await ask('listitem', itemName(5), 'focus');
  assert.deepEqual([(await read(page)).row, await active(page)], ['m5', ['listitem', itemName(5)]]);
});

await scenario('on a phone a finger opens the jobs and chooses', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(rowSpot(4)); let now = await read(page);
  assert.deepEqual([now.open, now.opened], [true, 'm3']);
  await tap(optionSpot(now.popup, 'study')); now = await read(page);
  assert.deepEqual([now.open, now.jobs[3]], [false, 'study']);
  await tap(rowSpot(4)); await tap(empty); assert.equal((await read(page)).open, false);
  // A finger does not pan the rows, but it drags the thumb, which is how the rest of the roster is reached on a phone.
  const session = await page.context().newCDPSession(page), touch = async (type, place) => {
    const [x, y] = await at(page, place);
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }); await settle(page);
  };
  await touch('touchStart', [453, 68]); assert.equal((await read(page)).dragging, true);
  await touch('touchMove', [453, 100]); await touch('touchMove', [440, 164]); now = await read(page);
  assert.deepEqual([Math.round(now.offset), now.rows[0].key], [480, 'm16']);
  await touch('touchEnd', [440, 164]); assert.equal((await read(page)).dragging, false);
  await session.detach();
  await tap(rowSpot(3)); now = await read(page);
  assert.deepEqual([now.open, now.opened], [true, 'm18']);
  await tap(optionSpot(now.popup, 'guard')); assert.equal((await read(page)).jobs[18], 'guard');
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
