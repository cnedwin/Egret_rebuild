// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-list-semantics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-list-semantics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-list-semantics-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const COUNT = 50000, label = index => 'Server ' + (index + 1) + ' / 服务器 ' + (index + 1);
/** Waits for the commits the page has begun, then for the frame after them. */
const settle = async page => { await page.evaluate(() => globalThis.__egretUiListSemanticsExample.settled()); await page.waitForTimeout(60); };
const read = page => page.evaluate(() => globalThis.__egretUiListSemanticsExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 300];
}
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
const option = (page, index) => page.getByRole('option', { name: label(index), exact: true });
/** The options the page has, as assistive technology is given them: name, place, size of the set, selection. */
const options = page => page.evaluate(() => [...document.querySelectorAll('[role=option]')].map(element =>
  [element.getAttribute('aria-label') ?? element.textContent, Number(element.getAttribute('aria-posinset')), Number(element.getAttribute('aria-setsize')), element.getAttribute('aria-selected')]));
/** The element the canvas names as the one that holds the focus, if it names one, and whether that element exists. */
const active = page => page.evaluate(() => {
  const id = document.querySelector('#scene').getAttribute('aria-activedescendant'), element = id === null ? null : document.getElementById(id);
  return element === null ? { id, exists: false } : { id, exists: true, place: Number(element.getAttribute('aria-posinset')), role: element.getAttribute('role') };
});
/** A request made of the element itself, the way an accessibility interface makes it: no pointer is involved. */
const request = async (page, index, action) => { await option(page, index).evaluate((element, name) => element[name](), action); await settle(page); };
/** Every option lies over the row it describes. */
async function over(page) {
  const now = await read(page);
  for (const row of now.rows) {
    const box = await option(page, row.index).boundingBox(), [left, top] = await at(page, [row.x, Math.max(row.y, 30)]), [right, bottom] = await at(page, [row.x + row.width, Math.min(row.y + row.height, 270)]);
    for (const [name, actual, expected] of [['left', box.x, left], ['top', box.y, top], ['right', box.x + box.width, right], ['bottom', box.y + box.height, bottom]])
      assert.ok(Math.abs(actual - expected) < 0.51, row.key + ' ' + name + ' ' + actual + ' ' + expected);
  }
  return now;
}
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-list-semantics/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiListSemanticsExample !== undefined);
    await settle(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };

await scenario('the browser computes a list box of the rows that show, each with its place among fifty thousand', desktop, async page => {
  assert.equal(await page.locator('#surface').ariaSnapshot(), ['- application "Server list / 服务器列表":', '  - listbox "Servers / 服务器":',
    ...Array.from({ length: 8 }, (_, index) => '    - option "' + label(index) + '"' + (index === 2 ? ' [selected]' : ''))].join('\n'));
  assert.deepEqual(await options(page), Array.from({ length: 8 }, (_, index) => [label(index), index + 1, COUNT, String(index === 2)]));
  const now = await over(page);
  // Nine rows are realized, one of them beyond the edge; the tree publishes the eight that show and the list.
  // It holds three nodes more, for the dialog that is closed.
  assert.deepEqual([now.rows.length, now.records, now.semantics.nodes, now.semantics.held, now.semantics.layoutRevision], [8, COUNT, 9, 12, now.committed]);
  assert.ok(now.realized >= 8 && now.realized <= 24);
  assert.deepEqual(await active(page), { id: null, exists: false });
  // The projection is not seen and is not what a pointer meets: a press reaches the row under it.
  const box = await option(page, 5).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await settle(page);
  assert.equal((await read(page)).selected, 'k5');
  assert.deepEqual((await options(page)).map(row => row[3]), ['false', 'false', 'false', 'false', 'false', 'true', 'false', 'false']);
});

await scenario('the keyboard moves through the list, and the element the canvas names always exists', desktop, async page => {
  await page.focus('#scene'); await key(page, 'Tab');
  let now = await read(page);
  assert.deepEqual([now.focus, now.semantics.focused], ['k0', 'servers/list/k0']);
  assert.deepEqual(await active(page), { id: await option(page, 0).evaluate(element => element.id), exists: true, place: 1, role: 'option' });
  // Twelve rows down: the list scrolls under the focus, rows are recycled, and at every step the focus is a real element.
  for (let index = 1; index <= 12; index++) {
    await key(page, 'ArrowDown');
    assert.deepEqual(await active(page), { id: await option(page, index).evaluate(element => element.id), exists: true, place: index + 1, role: 'option' }, 'row ' + index);
  }
  now = await over(page);
  assert.deepEqual([now.focus, now.rows.at(-1).key, now.scrollOffset, now.semantics.nodes], ['k12', 'k12', 150, 9]);
  assert.equal(await page.getByRole('option', { name: label(0), exact: true }).count(), 0, 'a row that was recycled has no element');
  // Space chooses the row with the focus when it is released.
  await page.keyboard.down('Space'); await settle(page); assert.equal((await read(page)).selected, 'k2');
  await page.keyboard.up('Space'); await settle(page); assert.equal((await read(page)).selected, 'k12');
  assert.equal(await option(page, 12).getAttribute('aria-selected'), 'true');
  await key(page, 'PageDown'); assert.equal((await active(page)).place, 20);
  await key(page, 'PageUp'); await key(page, 'ArrowUp'); assert.equal((await active(page)).place, 12);
  await key(page, 'End'); now = await read(page);
  assert.deepEqual([now.focus, (await active(page)).place, now.rows.at(-1).index], ['k49999', COUNT, COUNT - 1]);
  await key(page, 'Home'); assert.deepEqual([(await read(page)).focus, (await active(page)).place], ['k0', 1]);
  // The page did not scroll for any of the keys, and the keyboard never left the canvas.
  assert.equal(await page.evaluate(() => scrollY), 0); assert.equal(await page.evaluate(() => document.activeElement.id), 'scene');
});

await scenario('a jump to row forty thousand publishes the rows there and none of those it left', desktop, async page => {
  await page.click('#jump'); await settle(page);
  let now = await over(page);
  assert.equal(now.focus, 'k39999'); assert.ok(now.rows.some(row => row.index === 39999));
  assert.deepEqual(await active(page), { id: await option(page, 39999).evaluate(element => element.id), exists: true, place: 40000, role: 'option' });
  const listed = await options(page);
  assert.equal(listed.length, 8); assert.ok(listed.every(row => row[2] === COUNT && row[1] >= 39993 && row[1] <= 40007));
  assert.deepEqual(listed.map(row => row[1]), Array.from({ length: 8 }, (_, index) => listed[0][1] + index), 'the options are in the order of the list');
  assert.deepEqual([now.semantics.nodes, now.semantics.held], [9, 12]); assert.ok(now.realized <= 24);
  // Scrolling away without moving the focus: the row that held it leaves, and the canvas names nothing.
  await page.click('#top'); await settle(page);
  now = await over(page);
  assert.deepEqual([now.rows[0].key, now.focus, now.semantics.focused], ['k0', undefined, undefined]);
  assert.deepEqual(await active(page), { id: null, exists: false });
  assert.deepEqual((await options(page)).map(row => row[1]), [1, 2, 3, 4, 5, 6, 7, 8]);
});

await scenario('a request made of an option chooses the row or gives it the focus', desktop, async page => {
  await request(page, 6, 'click');
  assert.equal((await read(page)).selected, 'k6'); assert.equal(await option(page, 6).getAttribute('aria-selected'), 'true');
  // A request for the focus moves the focus of the application. The keyboard stays with the canvas, so a key follows.
  await page.focus('#scene'); await request(page, 4, 'focus');
  let now = await read(page);
  assert.deepEqual([now.focus, now.semantics.focused, await page.evaluate(() => document.activeElement.id)], ['k4', 'servers/list/k4', 'scene']);
  assert.equal((await active(page)).place, 5);
  await key(page, 'ArrowDown'); await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.focus, now.selected], ['k5', 'k5']);
});

await scenario('a narrower window and a scrolled page keep each option over its row', desktop, async page => {
  await page.setViewportSize({ width: 520, height: 500 }); await settle(page); await over(page);
  await page.evaluate(() => scrollTo(0, 140)); await settle(page); await over(page);
  await page.click('#jump'); await settle(page); await over(page);
});

await scenario('on a phone the options lie over the rows and a tap goes through them', { ...devices['Pixel 7'] }, async page => {
  await over(page);
  const box = await option(page, 3).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await settle(page);
  assert.equal((await read(page)).selected, 'k3'); assert.equal(await option(page, 3).getAttribute('aria-selected'), 'true');
});

/** What assistive technology is given: the tree the browser computed under the canvas, without what it ignores. */
async function accessible(page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Accessibility.enable');
  const { nodes } = await session.send('Accessibility.getFullAXTree');
  await session.detach();
  const byId = new Map(nodes.map(found => [found.nodeId, found])), application = nodes.find(found => found.role?.value === 'application'), rows = [];
  (function walk(found, depth) {
    for (const id of found.childIds ?? []) {
      const child = byId.get(id), shown = child !== undefined && !child.ignored && !['generic', 'none', 'StaticText', 'InlineTextBox'].includes(child.role?.value);
      if (shown) rows.push([depth, child.role.value, child.name?.value ?? '']);
      if (child !== undefined) walk(child, depth + (shown ? 1 : 0));
    }
  })(application, 0);
  return rows;
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const CHOOSE = 'Choose this server / 选择这台服务器', CLOSE = 'Close / 关闭';

await scenario('a modal layer is a dialog, and while it is open nothing outside it is given to assistive technology', desktop, async page => {
  assert.equal((await accessible(page)).some(row => row[1] === 'dialog'), false, 'a closed layer is not in the tree');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.click('#details'); await settle(page);
  let now = await read(page);
  assert.deepEqual([now.details.open, now.details.of, now.details.stack, now.keyboard, now.semantics.focused], [true, 'k2', ['details'], 'details-choose', 'details/choose']);
  // The tree the browser computes has the dialog and its two buttons, and not one option of the list behind it.
  assert.deepEqual(await accessible(page), [[0, 'dialog', label(2)], [1, 'button', CHOOSE], [1, 'button', CLOSE]]);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[inert]')].map(element => element.getAttribute('role'))), ['listbox']);
  assert.equal(await page.getByRole('dialog', { name: label(2), exact: true }).getAttribute('aria-modal'), 'true');
  // The dialog and its buttons lie over the card the layer manager centred.
  for (const [element, drawn] of [[page.getByRole('dialog'), now.details.card], [button(page, CHOOSE), now.details.choose], [button(page, CLOSE), now.details.close]]) {
    const box = await element.boundingBox(), [left, top] = await at(page, [drawn.x, drawn.y]), [right, bottom] = await at(page, [drawn.x + drawn.width, drawn.y + drawn.height]);
    for (const [name, actual, expected] of [['left', box.x, left], ['top', box.y, top], ['right', box.x + box.width, right], ['bottom', box.y + box.height, bottom]])
      assert.ok(Math.abs(actual - expected) < 0.51, name + ' ' + actual + ' ' + expected);
  }
  assert.deepEqual([now.details.card.x, now.details.card.y], [110, 75], 'centred in 480 by 300');
  assert.deepEqual(await active(page), { id: await button(page, CHOOSE).evaluate(element => element.id), exists: true, place: 0, role: null });
  // Tab stays inside the dialog.
  await key(page, 'Tab'); assert.equal((await read(page)).keyboard, 'details-close');
  await key(page, 'Tab'); assert.equal((await read(page)).keyboard, 'details-choose');
  // A press on a row beside the card reaches nothing, and the dialog stays.
  await page.mouse.click(...await at(page, [60, 255])); await settle(page); now = await read(page);
  assert.deepEqual([now.selected, now.details.open], ['k2', true]);
  // Escape closes it: the list is given again, and the dialog is gone from the tree.
  await key(page, 'Escape'); now = await read(page);
  assert.deepEqual([now.details.open, now.details.stack], [false, []]);
  assert.equal((await accessible(page)).filter(row => row[1] === 'option').length, 8); assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual(await page.evaluate(() => document.querySelectorAll('[inert]').length), 0);
});

await scenario('the keyboard opens the details of a row, chooses from them, and the focus returns to the row', desktop, async page => {
  await page.focus('#scene'); await key(page, 'Tab'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown');
  assert.equal((await read(page)).focus, 'k4');
  await key(page, 'ArrowRight');
  let now = await read(page);
  assert.deepEqual([now.details.open, now.details.of, now.keyboard], [true, 'k4', 'details-choose']);
  assert.equal(await page.getByRole('dialog', { name: label(4), exact: true }).count(), 1);
  // Space on the first button, held and released: the row is chosen, the card closes, and the row has the focus again.
  await page.keyboard.down('Space'); await settle(page); assert.deepEqual([(await read(page)).selected, (await read(page)).details.open], ['k2', true]);
  await page.keyboard.up('Space'); await settle(page); now = await read(page);
  assert.deepEqual([now.selected, now.details.open, now.focus, now.semantics.focused], ['k4', false, 'k4', 'servers/list/k4']);
  assert.deepEqual(await active(page), { id: await option(page, 4).evaluate(element => element.id), exists: true, place: 5, role: 'option' });
  assert.equal(await option(page, 4).getAttribute('aria-selected'), 'true');
  // A request made of the button itself closes the card as a press does.
  await key(page, 'ArrowRight'); assert.equal((await read(page)).details.open, true);
  await button(page, CLOSE).evaluate(element => element.click()); await settle(page);
  assert.deepEqual([(await read(page)).details.open, (await read(page)).focus], [false, 'k4']);
  // A press on the button with a mouse.
  await key(page, 'ArrowDown'); await key(page, 'ArrowRight'); now = await read(page);
  assert.equal(now.details.of, 'k5');
  await page.mouse.click(...await at(page, [now.details.choose.x + 20, now.details.choose.y + 15])); await settle(page);
  assert.deepEqual([(await read(page)).selected, (await read(page)).details.open], ['k5', false]);
  assert.equal(await page.evaluate(() => scrollY), 0); assert.equal(await page.evaluate(() => document.activeElement.id), 'scene');
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
