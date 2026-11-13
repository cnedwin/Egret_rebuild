// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-controls/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-controls-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

// Stage units: the switch and the button are 140 by 44 at (40, 40) and (40, 200); the options are 120 by 44 at y 120.
const spot = { sound: [110, 62], easy: [100, 142], normal: [240, 142], hard: [380, 142], apply: [110, 222], empty: [300, 60] };
const read = page => page.evaluate(() => globalThis.__egretUiControlsExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 300];
}
const settle = page => page.waitForTimeout(40);
const move = async (page, name) => { await page.mouse.move(...await at(page, spot[name])); await settle(page); };
const click = async (page, name) => { await page.mouse.click(...await at(page, spot[name])); await settle(page); };
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
async function scenario(name, options, body) {
  const context = await browser.newContext(options), page = await context.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-controls/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiControlsExample !== undefined);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await context.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };

await scenario('each control is hovered in turn', desktop, async page => {
  for (const name of ['sound', 'easy', 'normal', 'hard', 'apply']) { await move(page, name); assert.deepEqual((await read(page)).hovered, [name]); }
  await move(page, 'empty'); assert.deepEqual((await read(page)).hovered, []);
});

await scenario('a mouse toggles, selects and activates', desktop, async page => {
  let now = await read(page);
  assert.equal(now.sound.checked, true); assert.equal(now.level.selected, 'normal'); assert.equal(now.apply.activations, 0);
  await move(page, 'sound'); await page.mouse.down(); await settle(page); now = await read(page);
  // Held: pressed, not yet changed, and no longer hovered because the pointer is now a contact.
  assert.deepEqual(now.sound, { checked: true, pressed: true, enabled: true }); assert.deepEqual(now.hovered, []);
  await page.mouse.up(); await settle(page); now = await read(page);
  assert.deepEqual(now.sound, { checked: false, pressed: false, enabled: true }); assert.deepEqual(now.hovered, ['sound']);
  await click(page, 'sound'); assert.equal((await read(page)).sound.checked, true);
  await click(page, 'hard'); await click(page, 'hard'); await click(page, 'easy'); now = await read(page);
  assert.equal(now.level.selected, 'easy'); assert.deepEqual(now.level.changes, [['hard', 'normal'], ['easy', 'hard']]);
  await click(page, 'apply'); await click(page, 'apply'); assert.equal((await read(page)).apply.activations, 2);
  // A press with nothing under it changes nothing.
  await click(page, 'empty'); now = await read(page);
  assert.equal(now.sound.checked, true); assert.equal(now.level.selected, 'easy'); assert.equal(now.apply.activations, 2);
});

await scenario('the keyboard reaches the same controls', desktop, async page => {
  await page.focus('#scene');
  await key(page, 'Tab'); let now = await read(page);
  assert.equal(now.focus, 'sound');
  await key(page, 'Space'); assert.equal((await read(page)).sound.checked, false);
  await key(page, 'Enter'); assert.equal((await read(page)).sound.checked, true);
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'level');
  await key(page, 'ArrowRight'); now = await read(page);
  assert.equal(now.level.selected, 'hard'); assert.equal(now.focus, 'level');
  // Past the last option the selection continues at the first.
  await key(page, 'ArrowDown'); assert.equal((await read(page)).level.selected, 'easy');
  await key(page, 'ArrowLeft'); assert.equal((await read(page)).level.selected, 'hard');
  await key(page, 'Home'); assert.equal((await read(page)).level.selected, 'easy');
  await key(page, 'End'); assert.equal((await read(page)).level.selected, 'hard');
  await key(page, 'ArrowUp'); assert.equal((await read(page)).level.selected, 'normal');
  // Space is not a key of the group, and the page did not scroll for any key that was taken.
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'apply');
  await key(page, 'Space'); await key(page, 'Enter'); now = await read(page);
  assert.equal(now.apply.activations, 2); assert.equal(now.level.selected, 'normal');
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.keyboard.press('Shift+Tab'); await settle(page); assert.equal((await read(page)).focus, 'level');
});

await scenario('a disabled option and a disabled panel refuse every input', desktop, async page => {
  await page.click('#disable-hard'); await settle(page);
  let now = await read(page);
  assert.deepEqual(now.level.items, { easy: true, normal: true, hard: false });
  await click(page, 'hard'); assert.equal((await read(page)).level.selected, 'normal');
  // Movement skips it in both directions.
  await page.focus('#scene'); await key(page, 'Tab'); await key(page, 'Tab');
  await key(page, 'ArrowRight'); assert.equal((await read(page)).level.selected, 'easy');
  await key(page, 'ArrowLeft'); assert.equal((await read(page)).level.selected, 'normal');
  await key(page, 'End'); assert.equal((await read(page)).level.selected, 'normal');
  await page.click('#disable-hard'); await settle(page); await click(page, 'hard'); assert.equal((await read(page)).level.selected, 'hard');
  await page.click('#disable-all'); await settle(page);
  await click(page, 'sound'); await click(page, 'easy'); await click(page, 'apply'); await move(page, 'apply'); now = await read(page);
  assert.equal(now.sound.checked, true); assert.equal(now.level.selected, 'hard'); assert.equal(now.apply.activations, 0); assert.deepEqual(now.hovered, []);
  assert.equal(now.sound.enabled, false); assert.equal(now.level.enabled, false); assert.equal(now.apply.enabled, false);
  // Enabled again, everything answers as before.
  await page.click('#disable-all'); await settle(page);
  await move(page, 'apply'); await click(page, 'apply'); now = await read(page);
  assert.equal(now.apply.activations, 1); assert.deepEqual(now.hovered, ['apply']);
});

await scenario('a finger activates and hovers nothing', { ...devices['Pixel 7'] }, async page => {
  for (const name of ['sound', 'easy', 'apply']) { await page.touchscreen.tap(...await at(page, spot[name])); await page.waitForTimeout(80); }
  const now = await read(page);
  assert.equal(now.sound.checked, false); assert.equal(now.level.selected, 'easy'); assert.equal(now.apply.activations, 1); assert.deepEqual(now.hovered, []);
});

// The semantic projection. Rectangles are the stage units the controls are drawn at.
const drawn = { panel: [0, 0, 480, 300], sound: [40, 40, 140, 44], level: [40, 120, 400, 44], 'level-easy': [40, 120, 120, 44], 'level-normal': [180, 120, 120, 44], 'level-hard': [320, 120, 120, 44], apply: [40, 200, 140, 44] };
const labels = { sound: ['switch', 'Sound / 声音'], 'level-easy': ['radio', 'Easy / 简单'], 'level-normal': ['radio', 'Normal / 普通'], 'level-hard': ['radio', 'Hard / 困难'], apply: ['button', 'Apply / 应用'] };
const node = (page, id) => page.getByRole(labels[id][0], { name: labels[id][1], exact: true });
const state = (page, id, name) => node(page, id).getAttribute(name);
/** What assistive technology is given: the tree the browser computed, under the canvas. */
async function accessible(page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Accessibility.enable');
  const { nodes } = await session.send('Accessibility.getFullAXTree');
  await session.detach();
  const byId = new Map(nodes.map(found => [found.nodeId, found])), value = (found, name) => found.properties?.find(property => property.name === name)?.value;
  const application = nodes.find(found => found.role?.value === 'application'), rows = [];
  (function walk(found, depth) {
    for (const id of found.childIds ?? []) {
      const child = byId.get(id), shown = child !== undefined && !child.ignored && !['generic', 'none', 'StaticText', 'InlineTextBox'].includes(child.role?.value);
      if (shown) rows.push([depth, child.role.value, child.name?.value ?? '', value(child, 'checked')?.value, value(child, 'disabled')?.value === true]);
      if (child !== undefined) walk(child, depth + (shown ? 1 : 0));
    }
  })(application, 0);
  return { name: application.name?.value, focused: value(application, 'focused')?.value === true, active: value(application, 'activedescendant')?.relatedNodes?.[0]?.idref, rows };
}
const elementId = (page, id) => node(page, id).evaluate(element => element.id);
/** A request made of the element itself, the way an accessibility interface makes it: no pointer is involved. */
const request = async (page, id, action) => { await node(page, id).evaluate((element, name) => element[name](), action); await settle(page); };

await scenario('the browser computes a tree of the controls under the canvas', desktop, async page => {
  assert.equal(await page.locator('#surface').ariaSnapshot(), [
    '- application "Control states / 控件状态":',
    '  - group "Settings / 设置":',
    '    - switch "Sound / 声音" [checked]',
    '    - radiogroup "Level / 难度":',
    '      - radio "Easy / 简单"',
    '      - radio "Normal / 普通" [checked]',
    '      - radio "Hard / 困难"',
    '    - button "Apply / 应用"'].join('\n'));
  let tree = await accessible(page);
  assert.deepEqual(tree.rows, [[0, 'group', 'Settings / 设置', undefined, false], [1, 'switch', 'Sound / 声音', 'true', false], [1, 'radiogroup', 'Level / 难度', undefined, false],
    [2, 'radio', 'Easy / 简单', 'false', false], [2, 'radio', 'Normal / 普通', 'true', false], [2, 'radio', 'Hard / 困难', 'false', false], [1, 'button', 'Apply / 应用', undefined, false]]);
  assert.deepEqual([tree.name, tree.focused, tree.active], ['Control states / 控件状态', false, undefined]);
  assert.deepEqual([await state(page, 'level-hard', 'aria-posinset'), await state(page, 'level-hard', 'aria-setsize')], ['3', '3']);
  // The canvas keeps the keyboard and names the control that holds the focus.
  await page.focus('#scene'); await key(page, 'Tab'); tree = await accessible(page);
  assert.deepEqual([tree.focused, tree.active], [true, await elementId(page, 'sound')]); assert.equal((await read(page)).semantics.focused, 'sound');
  await key(page, 'Space'); assert.equal(await state(page, 'sound', 'aria-checked'), 'false'); assert.equal((await accessible(page)).rows[1][3], 'false');
  await key(page, 'Tab'); assert.equal((await accessible(page)).active, await elementId(page, 'level-normal'));
  // The focus follows the selection inside the group.
  await key(page, 'ArrowRight'); tree = await accessible(page);
  assert.equal(tree.active, await elementId(page, 'level-hard')); assert.deepEqual(tree.rows.slice(3, 6).map(row => row[3]), ['false', 'false', 'true']);
  await key(page, 'Tab'); assert.equal((await accessible(page)).active, await elementId(page, 'apply'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scene');
  const now = await read(page);
  assert.deepEqual([now.semantics.nodes, now.semantics.projection], [7, 'active']);
});

await scenario('each element lies over the control it describes, and a pointer goes through it', desktop, async page => {
  const over = async () => {
    for (const [id, [x, y, width, height]] of Object.entries(drawn).filter(([id]) => id in labels)) {
      const box = await node(page, id).boundingBox(), [left, top] = await at(page, [x, y]), [right, bottom] = await at(page, [x + width, y + height]);
      for (const [name, actual, expected] of [['left', box.x, left], ['top', box.y, top], ['right', box.x + box.width, right], ['bottom', box.y + box.height, bottom]])
        assert.ok(Math.abs(actual - expected) < 0.51, id + ' ' + name + ' ' + actual + ' ' + expected);
    }
  };
  await over();
  // The projection is not seen and is not what a pointer meets.
  const centre = async id => { const box = await node(page, id).boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
  assert.deepEqual(await page.evaluate(([x, y]) => { const style = getComputedStyle(document.querySelector('#scene').nextElementSibling); return [document.elementFromPoint(x, y).id, style.opacity, style.pointerEvents]; }, await centre('sound')), ['scene', '0', 'none']);
  await page.mouse.click(...await centre('sound')); await settle(page);
  assert.equal((await read(page)).sound.checked, false); assert.equal(await state(page, 'sound', 'aria-checked'), 'false');
  await page.mouse.click(...await centre('level-easy')); await settle(page); assert.equal(await state(page, 'level-easy', 'aria-checked'), 'true');
  // A narrower window makes the canvas smaller; the elements follow it. The page is then scrolled.
  await page.setViewportSize({ width: 520, height: 500 }); await settle(page); await over();
  await page.evaluate(() => scrollTo(0, 120)); await settle(page); await over();
  await page.mouse.click(...await centre('apply')); await settle(page); assert.equal((await read(page)).apply.activations, 1);
});

await scenario('a request made of an element reaches the control a press and a key reach', desktop, async page => {
  await request(page, 'sound', 'click');
  let now = await read(page);
  assert.equal(now.sound.checked, false); assert.equal(await state(page, 'sound', 'aria-checked'), 'false');
  await request(page, 'level-hard', 'click'); await request(page, 'apply', 'click'); now = await read(page);
  assert.deepEqual([now.level.selected, now.level.changes, now.apply.activations], ['hard', [['hard', 'normal']], 1]);
  assert.deepEqual([await state(page, 'level-hard', 'aria-checked'), await state(page, 'level-normal', 'aria-checked')], ['true', 'false']);
  // A request for the focus moves the focus of the application. The keyboard stays with the canvas, so a key follows.
  await page.focus('#scene'); await request(page, 'apply', 'focus'); now = await read(page);
  assert.deepEqual([now.focus, now.semantics.focused, await page.evaluate(() => document.activeElement.id)], ['apply', 'apply', 'scene']);
  await key(page, 'Space'); assert.equal((await read(page)).apply.activations, 2);
  await request(page, 'level-easy', 'focus'); now = await read(page);
  assert.deepEqual([now.focus, now.semantics.focused, now.level.selected], ['level', 'level-hard', 'hard']);
  assert.equal((await accessible(page)).active, await elementId(page, 'level-hard'));
  // Disabled controls are published as disabled, offer no focus, and refuse the request as they refuse the press.
  await page.click('#disable-hard'); await settle(page);
  assert.equal(await state(page, 'level-hard', 'aria-disabled'), 'true'); assert.equal(await state(page, 'level-easy', 'aria-disabled'), null);
  await page.click('#disable-all'); await settle(page);
  for (const id of Object.keys(labels)) { assert.equal(await state(page, id, 'aria-disabled'), 'true', id); assert.equal(await state(page, id, 'tabindex'), null, id); }
  assert.equal(await page.getByRole('radiogroup', { name: 'Level / 难度' }).getAttribute('aria-disabled'), 'true');
  assert.deepEqual((await accessible(page)).rows.map(row => row[4]), [false, true, true, true, true, true, true]);
  for (const id of ['sound', 'level-easy', 'apply']) await request(page, id, 'click');
  now = await read(page);
  assert.deepEqual([now.sound.checked, now.level.selected, now.apply.activations], [false, 'hard', 2]);
  await page.click('#disable-all'); await settle(page); await request(page, 'sound', 'click');
  assert.equal((await read(page)).sound.checked, true); assert.equal(await state(page, 'sound', 'aria-disabled'), null); assert.equal(await state(page, 'sound', 'tabindex'), '-1');
});

await scenario('on a phone the elements lie over the controls and a tap goes through them', { ...devices['Pixel 7'] }, async page => {
  for (const [id, [x, y, width, height]] of Object.entries(drawn).filter(([id]) => id in labels)) {
    const box = await node(page, id).boundingBox(), [left, top] = await at(page, [x, y]), [right, bottom] = await at(page, [x + width, y + height]);
    assert.ok(Math.abs(box.x - left) < 0.51 && Math.abs(box.y - top) < 0.51 && Math.abs(box.x + box.width - right) < 0.51 && Math.abs(box.y + box.height - bottom) < 0.51, id);
  }
  const box = await node(page, 'sound').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(80);
  assert.equal((await read(page)).sound.checked, false); assert.equal(await state(page, 'sound', 'aria-checked'), 'false');
  await request(page, 'level-hard', 'click'); assert.equal((await read(page)).level.selected, 'hard');
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
