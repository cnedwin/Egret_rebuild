// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-tabs/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-tabs/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-tabs-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = page => page.waitForTimeout(60);
const read = page => page.evaluate(() => globalThis.__egretUiTabsExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units. A tab is 120 by 30 and the tabs begin at (20, 44), 126 apart; `corner` is a place on a tab where its caption is not.
// The bars begin at x 170 and are 250 long, at y 98, 134 and 170.
const KEYS = ['members', 'training', 'stores'], NAMES = { members: '弟子 Members', training: '修炼 Training', stores: '库房 Stores' };
const tabSpot = key => [80 + KEYS.indexOf(key) * 126, 59], corner = key => [132 + KEYS.indexOf(key) * 126, 70];
const barSpot = (index, percent) => [170 + percent * 2.5, 105 + index * 36], trainSpot = [100, 234], empty = [440, 20];
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
const click = async (page, place) => { await page.mouse.click(...await at(page, place)); await settle(page); };
const move = async (page, place) => { await page.mouse.move(...await at(page, place)); await settle(page); };
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
const tabLines = selected => ['- application "Sect / 门派":', '  - tablist "门派 / Sect":', ...KEYS.map(name => '    - tab "' + NAMES[name] + '"' + (name === selected ? ' [selected]' : ''))];
const TRAINING = ['  - tabpanel "修炼 Training":', '    - progressbar "内功 Inner"', '    - progressbar "外功 Outer"', '    - progressbar "轻功 Lightness"', '    - button "修炼 / Train"'];
const values = page => page.evaluate(() => [...document.querySelectorAll('[role=progressbar]')].map(element => [element.getAttribute('aria-valuenow'), element.getAttribute('aria-valuemin'), element.getAttribute('aria-valuemax')].join(' ')));
/** For each tab, whether it names a panel, and whether the panel it names is the one on the page. */
const relations = page => page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map(tab => {
  const id = tab.getAttribute('aria-controls'), panel = id === null ? null : document.getElementById(id);
  return panel === null ? null : panel.getAttribute('role') + ' ' + panel.getAttribute('aria-label');
}));
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-tabs/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiTabsExample !== undefined);
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

await scenario('the browser computes a row of tabs and the panel of the one that is selected', desktop, async page => {
  assert.equal(await tree(page), [...tabLines('members'), '  - tabpanel "弟子 Members": 青锋 · 守山 Guard 白露 · 采药 Herbs 玄霜 · 锻造 Forge'].join('\n'));
  assert.deepEqual(await relations(page), ['tabpanel 弟子 Members', null, null], 'the selected tab names its panel, and only it');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map(element => [element.tagName, element.getAttribute('aria-posinset'), element.getAttribute('aria-setsize')].join(' '))), ['BUTTON 1 3', 'BUTTON 2 3', 'BUTTON 3 3']);
  assert.equal(await page.getByRole('tablist').getAttribute('aria-orientation'), 'horizontal');
  const now = await read(page);
  assert.deepEqual([now.selected, now.semantics.nodes, now.semantics.projection], ['members', 8, 'active']);
});

await scenario('a press on a tab shows its panel, and the button advances the progress bars', desktop, async page => {
  await move(page, empty);
  assert.deepEqual([await colour(page, corner('members')), await colour(page, corner('training'))], ['1f2633', '2b2f3a']);
  await move(page, tabSpot('training')); assert.equal(await colour(page, corner('training')), '3d4a63', 'a tab that is pointed at');
  await click(page, tabSpot('training')); await move(page, empty);
  assert.deepEqual([(await read(page)).selected, await colour(page, corner('members')), await colour(page, corner('training'))], ['training', '2b2f3a', '1f2633']);
  assert.equal(await tree(page), [...tabLines('training'), ...TRAINING].join('\n'));
  assert.deepEqual([await relations(page), await values(page)], [[null, 'tabpanel 修炼 Training', null], ['20 0 100', '40 0 100', '55 0 100']]);
  // A bar is filled as far as its work has come.
  assert.deepEqual([await colour(page, barSpot(0, 15)), await colour(page, barSpot(0, 25)), await colour(page, barSpot(2, 50)), await colour(page, barSpot(2, 60))], ['2f8f6b', '10141b', '2f8f6b', '10141b']);
  await click(page, trainSpot); await move(page, empty);
  assert.deepEqual([(await read(page)).progress, await values(page)], [{ inner: 30, outer: 55, light: 80 }, ['30 0 100', '55 0 100', '80 0 100']]);
  assert.deepEqual([await colour(page, barSpot(0, 25)), await colour(page, barSpot(0, 35)), await colour(page, barSpot(2, 75))], ['2f8f6b', '10141b', '2f8f6b']);
  // A bar stops at its end. When every bar is there the button has nothing more to do.
  for (let session = 2; session <= 8; session++) await click(page, trainSpot);
  let now = await read(page);
  assert.deepEqual([now.progress, now.sessions, now.trainEnabled, await values(page)], [{ inner: 100, outer: 100, light: 100 }, 8, false, ['100 0 100', '100 0 100', '100 0 100']]);
  assert.equal((await tree(page)).includes('- button "修炼 / Train" [disabled]'), true);
  await click(page, trainSpot); assert.equal((await read(page)).sessions, 8);
  // The panel of another tab has none of this, and coming back finds it as it was left.
  await click(page, tabSpot('stores')); now = await read(page);
  assert.equal(await tree(page), [...tabLines('stores'), '  - tabpanel "库房 Stores": 灵草 Herbs × 12 精铁 Iron × 7 丹药 Pills × 3'].join('\n'));
  await click(page, trainSpot); assert.equal((await read(page)).sessions, 8, 'a button of a panel that does not show takes no press');
  await click(page, tabSpot('training')); assert.deepEqual(await values(page), ['100 0 100', '100 0 100', '100 0 100']);
});

await scenario('the keyboard alone moves through the tabs, and the panel follows the selection', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).focus], [['tab', NAMES.members], 'tabs']);
  await key(page, 'ArrowRight'); assert.deepEqual([(await read(page)).selected, await active(page)], ['training', ['tab', NAMES.training]]);
  assert.equal(await tree(page), [...tabLines('training'), ...TRAINING].join('\n'));
  await key(page, 'ArrowRight'); await key(page, 'ArrowRight'); assert.deepEqual([(await read(page)).selected, await active(page)], ['members', ['tab', NAMES.members]], 'past the last tab is the first');
  await key(page, 'ArrowLeft'); assert.equal((await read(page)).selected, 'stores');
  await key(page, 'Home'); assert.equal((await read(page)).selected, 'members'); await key(page, 'End'); assert.equal((await read(page)).selected, 'stores');
  // The arrows across the row are not the tabs': they are left to the page, which scrolls with them.
  await page.keyboard.press('ArrowDown'); await page.waitForFunction(() => scrollY > 0); assert.equal((await read(page)).selected, 'stores');
  await page.keyboard.press('ArrowUp'); await page.waitForFunction(() => scrollY === 0); assert.equal((await read(page)).selected, 'stores');
  // A held arrow key repeats.
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight'); await settle(page);
  assert.deepEqual([(await read(page)).selected, await active(page)], ['training', ['tab', NAMES.training]]);
  // Tab goes on into the panel that shows, to its button, whose keys train.
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).focus], [['button', '修炼 / Train'], 'train']);
  await key(page, 'Enter'); await key(page, 'Space'); assert.deepEqual([(await read(page)).sessions, (await read(page)).progress.inner], [2, 40]);
  await page.keyboard.press('Shift+Tab'); await settle(page); assert.deepEqual(await active(page), ['tab', NAMES.training]);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
  // A panel with nothing to stop at is passed: from the tabs of such a panel Tab leaves the canvas.
  await key(page, 'ArrowLeft'); assert.equal((await read(page)).selected, 'members');
  await key(page, 'Tab'); assert.notEqual(await page.evaluate(() => document.activeElement.id), 'scene');
  // Trained to the end with the keyboard, the button is disabled and the focus is on the tabs, not on nothing.
  // Back on the canvas, which is a stop of the page itself, and from there on the tabs again.
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await settle(page);
  assert.deepEqual([await page.evaluate(() => document.activeElement.id), await active(page)], ['scene', ['tab', NAMES.members]]);
  await key(page, 'ArrowRight'); await key(page, 'Tab');
  assert.deepEqual(await active(page), ['button', '修炼 / Train']);
  for (let session = 3; session <= 8; session++) await key(page, 'Enter');
  const now = await read(page);
  assert.deepEqual([now.sessions, now.trainEnabled, now.focus, now.focusVisible, await active(page)], [8, false, 'tabs', true, ['tab', NAMES.training]]);
});

await scenario('a request of assistive technology selects a tab, focuses one, and trains', desktop, async page => {
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('tab', NAMES.stores, 'click'); assert.equal((await read(page)).selected, 'stores');
  assert.equal(await page.getByRole('tab', { name: NAMES.stores, exact: true }).getAttribute('aria-selected'), 'true');
  // A tab that is asked to take the focus is selected with it, and the canvas keeps the keyboard.
  await page.focus('#scene'); await ask('tab', NAMES.training, 'focus');
  let now = await read(page);
  assert.deepEqual([now.selected, now.focus, await active(page), await page.evaluate(() => document.activeElement.id)], ['training', 'tabs', ['tab', NAMES.training], 'scene']);
  await ask('button', '修炼 / Train', 'click'); now = await read(page);
  assert.deepEqual([now.sessions, await values(page)], [1, ['30 0 100', '55 0 100', '80 0 100']]);
  await ask('button', '修炼 / Train', 'focus'); assert.deepEqual(await active(page), ['button', '修炼 / Train']);
});

await scenario('on a phone a finger selects a tab and trains', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(tabSpot('training')); let now = await read(page);
  assert.deepEqual([now.selected, now.hovered], ['training', []]);
  await tap(trainSpot); await tap(trainSpot); now = await read(page);
  assert.deepEqual([now.sessions, now.progress], [2, { inner: 40, outer: 70, light: 100 }]);
  await tap(tabSpot('stores')); assert.equal((await read(page)).selected, 'stores');
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
