// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-stepper/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-stepper/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-stepper-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiStepperExample.settled()); await page.waitForTimeout(80); await page.evaluate(() => globalThis.__egretUiStepperExample.settled()); };
const read = page => page.evaluate(() => globalThis.__egretUiStepperExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units. A hall is 44 below the one before; its buttons are 32 square on either side of the amount.
const HALLS = [['alchemy', '丹房', 'Alchemy'], ['forge', '器坊', 'Forge'], ['library', '藏经阁', 'Library'], ['yard', '演武场', 'Yard']], KEYS = HALLS.map(([key]) => key);
const nameOf = key => { const [, zh, en] = HALLS.find(hall => hall[0] === key); return zh + ' / ' + en; };
const top = key => 50 + KEYS.indexOf(key) * 44, less = key => [248, top(key) + 16], more = key => [356, top(key) + 16], corner = ([x, y]) => [x - 12, y - 12];
const even = [80, 291], reset = [210, 291], NOT_ENOUGH = '灵石不足 / Not enough stones';
const leftText = left => left === 0 ? '已分完 / All shared out' : '剩余 ' + left + ' / ' + left + ' left';
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
/** The value and the ends each spin button has for a reader. */
const values = page => page.evaluate(() => [...document.querySelectorAll('[role=spinbutton]')].map(element => ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'].map(name => Number(element.getAttribute(name)))));
/** The tree a state of the screen has: the buttons that cannot act, and the two messages. */
const lines = ({ amounts = [0, 0, 0, 0], fault = '' }) => {
  const left = 100 - amounts.reduce((sum, amount) => sum + amount, 0), split = amounts.every(amount => amount === 25);
  return ['- application "Stones / 灵石":', ...HALLS.flatMap(([, zh, en], index) => ['  - spinbutton "' + zh + ' / ' + en + '"',
    '  - button "减少' + zh + ' / Less ' + en + '"' + (amounts[index] === 0 ? ' [disabled]' : ''), '  - button "增加' + zh + ' / More ' + en + '"' + (amounts[index] === 100 ? ' [disabled]' : '')]),
  '  - status: ' + leftText(left), '  - alert' + (fault === '' ? '' : ': ' + fault), '  - button "均分 / Even"' + (split ? ' [disabled]' : ''), '  - button "重置 / Reset"' + (left === 100 ? ' [disabled]' : '')].join('\n');
};
const amountsOf = now => KEYS.map(name => now.amounts[name]);
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-stepper/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiStepperExample !== undefined);
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

await scenario('at the start four spin buttons at nothing, a status that says what is left and an alert that says nothing', desktop, async page => {
  assert.equal(await tree(page), lines({}));
  assert.deepEqual(await values(page), [[0, 0, 100], [0, 0, 100], [0, 0, 100], [0, 0, 100]]);
  const now = await read(page);
  assert.deepEqual([amountsOf(now), now.left, now.fault, now.enabled.reset, now.enabled.even, now.semantics.projection], [[0, 0, 0, 0], 100, '', false, true, 'active']);
  // The page has one status message and one alert, and they are elements that are there before they have anything new to say.
  assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('[role=status]').length, document.querySelectorAll('[role=alert]').length, document.querySelector('[role=alert]').textContent]), [1, 1, '']);
});

await scenario('a pointer steps an amount up and down, and is told why an amount does not go up', desktop, async page => {
  for (let count = 0; count < 3; count++) await click(page, more('alchemy'));
  let now = await read(page);
  // A press on a button of an amount gives that amount the focus, without a ring.
  assert.deepEqual([amountsOf(now), now.left, now.focus, now.focusVisible], [[15, 0, 0, 0], 85, 'amount-alchemy', false]);
  await click(page, less('alchemy')); now = await read(page);
  assert.deepEqual([amountsOf(now), now.left], [[10, 0, 0, 0], 90]);
  assert.equal(await tree(page), lines({ amounts: [10, 0, 0, 0] })); assert.deepEqual((await values(page))[0], [10, 0, 100]);
  // A button that has nothing to do is dimmed, and a press on it does nothing. The pointer rests on the one it pressed last.
  assert.deepEqual([await colour(page, corner(less('alchemy'))), await colour(page, corner(more('alchemy'))), await colour(page, corner(less('forge'))), await colour(page, corner(more('forge')))], ['56689a', '3d4a63', '2a2d33', '3d4a63']);
  await click(page, less('forge')); now = await read(page);
  assert.deepEqual([amountsOf(now), now.fault, now.focus], [[10, 0, 0, 0], '', 'amount-alchemy']);
  // Shared evenly nothing is left, and the button that did it has nothing more to do.
  await click(page, even); now = await read(page);
  assert.deepEqual([amountsOf(now), now.left, now.enabled.even, now.enabled.reset], [[25, 25, 25, 25], 0, false, true]);
  assert.equal(await tree(page), lines({ amounts: [25, 25, 25, 25] }));
  // With nothing left a step up is refused, and the alert says why. The next change that goes through takes the alert away.
  await click(page, more('yard')); now = await read(page);
  assert.deepEqual([amountsOf(now), now.fault], [[25, 25, 25, 25], NOT_ENOUGH]);
  assert.equal(await tree(page), lines({ amounts: [25, 25, 25, 25], fault: NOT_ENOUGH }));
  await click(page, less('yard')); now = await read(page);
  assert.deepEqual([amountsOf(now), now.fault, now.left], [[25, 25, 25, 20], '', 5]);
  await click(page, more('forge')); await click(page, more('forge')); now = await read(page);
  assert.deepEqual([amountsOf(now), now.fault, now.left], [[25, 30, 25, 20], NOT_ENOUGH, 0]);
  await click(page, reset); now = await read(page);
  assert.deepEqual([amountsOf(now), now.left, now.fault, now.enabled.reset], [[0, 0, 0, 0], 100, '', false]);
  assert.equal(await tree(page), lines({}));
});

await scenario('the keyboard alone moves an amount by a step, by four, and to its ends, and the page stays where it is', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['spinbutton', nameOf('alchemy')]);
  await key(page, 'ArrowUp'); await key(page, 'ArrowUp'); await key(page, 'ArrowDown'); assert.deepEqual(amountsOf(await read(page)), [5, 0, 0, 0]);
  await key(page, 'PageUp'); assert.deepEqual(amountsOf(await read(page)), [25, 0, 0, 0]);
  await key(page, 'PageDown'); assert.deepEqual(amountsOf(await read(page)), [5, 0, 0, 0]);
  // The far end of an amount is all that is left, which is no fault.
  await key(page, 'Tab'); await key(page, 'ArrowUp'); await key(page, 'Shift+Tab'); await key(page, 'End'); let now = await read(page);
  assert.deepEqual([amountsOf(now), now.left, now.fault, now.focus, now.focusVisible], [[95, 5, 0, 0], 0, '', 'amount-alchemy', true]);
  assert.deepEqual((await values(page))[0], [95, 0, 100]);
  // A key that would take more than is left is refused and says why; a key at the bottom does nothing and says nothing.
  await key(page, 'Tab'); await key(page, 'Tab'); assert.deepEqual(await active(page), ['spinbutton', nameOf('library')]);
  await key(page, 'ArrowUp'); now = await read(page); assert.deepEqual([amountsOf(now), now.fault], [[95, 5, 0, 0], NOT_ENOUGH]);
  assert.equal(await tree(page), lines({ amounts: [95, 5, 0, 0], fault: NOT_ENOUGH }));
  await key(page, 'ArrowDown'); now = await read(page); assert.deepEqual([amountsOf(now), now.fault], [[95, 5, 0, 0], '']);
  // A page of steps stops at what is left, and says that it did.
  await key(page, 'Shift+Tab'); await key(page, 'Shift+Tab'); await key(page, 'Home'); await key(page, 'Tab'); await key(page, 'Tab'); await key(page, 'Tab');
  assert.deepEqual(await active(page), ['spinbutton', nameOf('yard')]);
  for (let count = 0; count < 5; count++) await key(page, 'PageUp');
  now = await read(page); assert.deepEqual([amountsOf(now), now.left, now.fault], [[0, 5, 0, 95], 0, NOT_ENOUGH]);
  // Reset is the next stop. Pressed, it has nothing more to do: it leaves the Tab order and the focus goes to the first amount.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '均分 / Even']);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '重置 / Reset']);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([amountsOf(now), now.enabled.reset, now.focus, now.focusVisible, await active(page)], [[0, 0, 0, 0], false, 'amount-alchemy', true, ['spinbutton', nameOf('alchemy')]]);
  // Even is now the last stop: after it Tab leaves the canvas.
  for (let count = 0; count < 4; count++) await key(page, 'Tab');
  assert.deepEqual(await active(page), ['button', '均分 / Even']);
  await key(page, 'Space'); now = await read(page);
  assert.deepEqual([amountsOf(now), now.enabled.even, now.focus], [[25, 25, 25, 25], false, 'amount-alchemy']);
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
  // Past the last stop Tab leaves the canvas: the buttons beside the amounts are elements of the page, and none of them takes it on the way.
  for (let count = 0; count < 4; count++) await key(page, 'Tab');
  assert.deepEqual(await active(page), ['button', '重置 / Reset']);
  await key(page, 'Tab'); assert.equal(await page.evaluate(() => document.activeElement.id === 'scene'), false);
});

await scenario('a message is said by changing the text of an element that was already there', desktop, async page => {
  // What a reader listens for: a change inside an element with a live role that it already knows.
  await page.evaluate(() => {
    globalThis.said = [];
    for (const role of ['status', 'alert']) {
      const element = document.querySelector('[role=' + role + ']');
      new MutationObserver(() => globalThis.said.push([role, element.isConnected, element.textContent])).observe(element, { childList: true, characterData: true, subtree: true });
    }
  });
  const said = async () => { await settle(page); return page.evaluate(() => globalThis.said.splice(0)); };
  await click(page, more('alchemy')); assert.deepEqual(await said(), [['status', true, leftText(95)]]);
  await page.focus('#scene'); await key(page, 'Tab'); await key(page, 'End'); assert.deepEqual(await said(), [['status', true, leftText(0)]]);
  await key(page, 'ArrowUp'); assert.deepEqual(await said(), [['alert', true, NOT_ENOUGH]]);
  // The same refusal again changes nothing, so nothing is said twice; after it was taken away it is said again.
  await key(page, 'ArrowUp'); assert.deepEqual(await said(), []);
  await key(page, 'ArrowDown'); assert.deepEqual(await said(), [['status', true, leftText(5)], ['alert', true, '']]);
  await key(page, 'End'); await key(page, 'PageUp'); assert.deepEqual(await said(), [['status', true, leftText(0)], ['alert', true, NOT_ENOUGH]]);
});

await scenario('a request of assistive technology steps an amount through its buttons and gives an amount the focus', desktop, async page => {
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('button', '增加器坊 / More Forge', 'click'); await ask('button', '增加器坊 / More Forge', 'click'); let now = await read(page);
  assert.deepEqual([amountsOf(now), (await values(page))[1]], [[0, 10, 0, 0], [10, 0, 100]]);
  await ask('button', '减少器坊 / Less Forge', 'click'); assert.deepEqual(amountsOf(await read(page)), [0, 5, 0, 0]);
  // A button that cannot act refuses the request.
  await ask('button', '减少丹房 / Less Alchemy', 'click'); now = await read(page); assert.deepEqual([amountsOf(now), now.fault], [[0, 5, 0, 0], '']);
  await ask('spinbutton', nameOf('library'), 'focus'); now = await read(page);
  assert.deepEqual([now.focus, await active(page)], ['amount-library', ['spinbutton', nameOf('library')]]);
  await key(page, 'ArrowUp'); assert.deepEqual(amountsOf(await read(page)), [0, 5, 5, 0]);
  await ask('button', '均分 / Even', 'click'); await ask('button', '增加演武场 / More Yard', 'click'); now = await read(page);
  assert.deepEqual([amountsOf(now), now.fault], [[25, 25, 25, 25], NOT_ENOUGH]);
  assert.equal(await tree(page), lines({ amounts: [25, 25, 25, 25], fault: NOT_ENOUGH }));
  await ask('button', '重置 / Reset', 'click'); assert.equal(await tree(page), lines({}));
});

await scenario('on a phone a finger steps the amounts with the buttons', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, place)); await settle(page); };
  await tap(more('library')); await tap(more('library')); await tap(more('yard')); await tap(less('library')); let now = await read(page);
  assert.deepEqual([amountsOf(now), now.left], [[0, 0, 5, 5], 90]);
  await tap(even); await tap(more('alchemy')); now = await read(page);
  assert.deepEqual([amountsOf(now), now.fault], [[25, 25, 25, 25], NOT_ENOUGH]);
  await tap(reset); now = await read(page); assert.deepEqual([amountsOf(now), now.left, now.fault], [[0, 0, 0, 0], 100, '']);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
