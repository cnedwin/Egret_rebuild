// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own mouse, touch and keyboard input.
//
//   node examples/ui-settings/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/ui-settings/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'ui-settings-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const settle = async page => { await page.evaluate(() => globalThis.__egretUiSettingsExample.settled()); await page.waitForTimeout(80); };
const read = page => page.evaluate(() => globalThis.__egretUiSettingsExample.readSnapshot());
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 320];
}
// Stage units: the centre of each control, a row of the list by its number from one, and a place where nothing is.
// `paint` is a corner of the first option where its caption is not.
const spot = { paint: [86, 111], sound: [195, 58], easy: [55, 122], normal: [130, 122], hard: [205, 122], name: [130, 184], dark: [195, 224], reset: [70, 282], empty: [130, 301], margin: [6, 6] };
// The track of the volume runs from 120 to 240: a place along it by the volume that is there.
const volumeSpot = value => [120 + value * 1.2, 252];
const rowSpot = number => [365, 40 + (number - 1) * 25 + 12];
const key = async (page, name) => { await page.keyboard.press(name); await settle(page); };
const click = async (page, place) => { await page.mouse.click(...await at(page, typeof place === 'string' ? spot[place] : place)); await settle(page); };
const move = async (page, place) => { await page.mouse.move(...await at(page, typeof place === 'string' ? spot[place] : place)); await settle(page); };
const profile = index => ({ sound: index % 2 === 0, level: ['easy', 'normal', 'hard'][index % 3], name: ['青锋', '白露', '玄霜', '赤霄', '紫电'][index % 5] + (index + 1), volume: index * 15 % 105 });
const optionName = index => '存档 ' + (index + 1) + ' ' + profile(index).name;
const DEFAULTS = { sound: true, level: 'normal', name: '侠客', volume: 60 };
/** The colour the page shows at a place of the stage, read from a screenshot the page decodes itself. */
async function colour(page, place) {
  const [x, y] = await at(page, typeof place === 'string' ? spot[place] : place);
  const shot = (await page.screenshot({ clip: { x: x - 2, y: y - 2, width: 4, height: 4 } })).toString('base64');
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob()), surface = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    surface.drawImage(bitmap, 0, 0);
    const [red, green, blue] = surface.getImageData(1, 1, 1, 1).data;
    return (red << 16) | (green << 8) | blue;
  }, shot);
}
const hex = value => value.toString(16).padStart(6, '0');
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
/** The element the canvas names as the one that holds the focus: its role and its name. */
const active = page => page.evaluate(() => {
  const id = document.querySelector('#scene').getAttribute('aria-activedescendant'), element = id === null ? null : document.getElementById(id);
  return element === null ? null : [element.getAttribute('role') ?? element.tagName.toLowerCase(), element.getAttribute('aria-label') ?? element.textContent];
});
async function scenario(name, context, body) {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/ui-settings/index.html?backend=webgl2');
    await page.waitForFunction(() => globalThis.__egretUiSettingsExample !== undefined);
    await settle(page);
    await body(page);
    const last = await read(page);
    assert.equal(last.failure, undefined); assert.equal(last.mixedFrames, 0, 'no frame mixed two themes'); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 1000 } };

await scenario('the browser computes one tree for the whole screen', desktop, async page => {
  assert.equal(await page.locator('#surface').ariaSnapshot(), ['- application "Settings / 设置":', '  - group "设置 / Settings":', '    - switch "声音 / Sound" [checked]', '    - radiogroup "难度 / Level":',
    '      - radio "易 Easy"', '      - radio "中 Normal" [checked]', '      - radio "难 Hard"', '    - textbox "名字 / Name"', '    - switch "深色 / Dark" [checked]', '    - slider "音量 / Volume"', '    - button "重置 / Reset"',
    '  - listbox "存档 / Profiles":', ...Array.from({ length: 10 }, (_, index) => '    - option "' + optionName(index) + '"')].join('\n'));
  const now = await read(page);
  assert.deepEqual([now.settings, now.loaded, now.theme, now.rows.length, now.confirm.open, now.semantics.projection], [DEFAULTS, undefined, 'dark', 10, false, 'active']);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[role=option]')].slice(0, 2).map(element => [element.getAttribute('aria-posinset'), element.getAttribute('aria-setsize')])), [['1', '200'], ['2', '200']]);
  // The text of the field is given as its value.
  assert.equal(await page.getByRole('textbox', { name: '名字 / Name', exact: true }).evaluate(element => element.value ?? element.textContent), '侠客');
});

await scenario('the keyboard alone changes every setting, types a name, and chooses a profile', desktop, async page => {
  await page.focus('#scene');
  // Tab visits the controls in the order they are laid out, and the list last, as one stop.
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['switch', '声音 / Sound']);
  await key(page, 'Space'); assert.equal((await read(page)).settings.sound, false);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['radio', '中 Normal']);
  await key(page, 'ArrowRight'); assert.deepEqual([(await read(page)).settings.level, await active(page)], ['hard', ['radio', '难 Hard']]);
  // A held arrow key repeats through the options, past the end and round again.
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowLeft'); await settle(page);
  assert.deepEqual([(await read(page)).settings.level, await active(page)], ['hard', ['radio', '难 Hard']]);
  await page.keyboard.up('ArrowLeft'); await settle(page);
  await key(page, 'ArrowLeft'); await key(page, 'ArrowLeft'); assert.equal((await read(page)).settings.level, 'easy');
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['textbox', '名字 / Name']);
  // Enter opens the platform field over the box; what is typed there becomes the name, and the focus comes back.
  await key(page, 'Enter'); let now = await read(page);
  assert.equal(now.editing, true); assert.equal(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
  await page.keyboard.press('Control+A'); await page.keyboard.type('Li Bai'); await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.editing, now.settings.name, now.focus, await page.evaluate(() => document.activeElement.id)], [false, 'Li Bai', 'name', 'scene']);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['switch', '深色 / Dark']);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['slider', '音量 / Volume']);
  await key(page, 'ArrowRight'); await key(page, 'ArrowUp'); assert.equal((await read(page)).settings.volume, 70);
  await key(page, 'Tab'); assert.deepEqual(await active(page), ['button', '重置 / Reset']);
  await key(page, 'Tab'); assert.deepEqual([await active(page), (await read(page)).row], [['option', optionName(0)], 'p0']);
  // The arrow keys move among the rows; the list scrolls under the focus.
  for (let index = 1; index <= 12; index++) await key(page, 'ArrowDown');
  now = await read(page);
  assert.deepEqual([now.row, await active(page), now.rows.at(-1).key], ['p12', ['option', optionName(12)], 'p12']);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.loaded, now.settings], ['p12', profile(12)]);
  assert.equal(await page.getByRole('option', { name: optionName(12), exact: true }).getAttribute('aria-selected'), 'true');
  assert.ok(now.realized <= 24, 'rows that left were let go');
  assert.equal(await page.evaluate(() => scrollY), 0, 'no key that was taken moved the page');
  // One more Tab leaves the canvas: the whole list was one stop. Shift+Tab twice is back on the same row.
  await key(page, 'Tab'); assert.notEqual(await page.evaluate(() => document.activeElement.id), 'scene');
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await settle(page);
  assert.deepEqual([await page.evaluate(() => document.activeElement.id), (await read(page)).row], ['scene', 'p12']);
  // And back through the controls in the other direction.
  await page.keyboard.press('Shift+Tab'); await settle(page); assert.deepEqual(await active(page), ['button', '重置 / Reset']);
});

await scenario('a press chooses a profile, and a setting changed by hand is no longer that profile', desktop, async page => {
  await click(page, rowSpot(2)); let now = await read(page);
  assert.deepEqual([now.loaded, now.settings], ['p1', profile(1)]);
  assert.equal(hex(await colour(page, [450, rowSpot(2)[1]])), '2f8f6b', 'the chosen row is painted as chosen');
  assert.equal(hex(await colour(page, 'sound')), '3d4a63', 'the switch is off, as the profile has it');
  await click(page, 'sound'); now = await read(page);
  assert.deepEqual([now.settings.sound, now.loaded], [true, undefined]);
  assert.equal(await page.getByRole('option', { name: optionName(1), exact: true }).getAttribute('aria-selected'), 'false');
  // Set back by hand, the settings are the profile's again only when it is chosen again.
  await click(page, 'hard'); await click(page, rowSpot(5)); now = await read(page);
  assert.deepEqual([now.loaded, now.settings], ['p4', profile(4)]);
  // Pointed at: a control that is set stays set, in the paint its own skin has for the pointer.
  await move(page, 'sound'); assert.equal(hex(await colour(page, 'sound')), '3fae84');
  await move(page, 'easy'); assert.equal(hex(await colour(page, 'paint')), '56689a');
  await move(page, 'empty'); assert.equal(hex(await colour(page, 'paint')), '3d4a63');
  // A profile is lit under the pointer and darker while it is held; the one that is chosen keeps its paint.
  const side = number => [450, rowSpot(number)[1]];
  await move(page, rowSpot(7)); now = await read(page);
  assert.deepEqual([now.hoveredRows, hex(await colour(page, side(7))), hex(await colour(page, side(6))), hex(await colour(page, side(5)))], [['p6'], '454c5e', '343a48', '2f8f6b']);
  await page.mouse.down(); await settle(page); assert.equal(hex(await colour(page, side(7))), '232730');
  await page.mouse.up(); await settle(page); now = await read(page);
  assert.deepEqual([now.loaded, hex(await colour(page, side(7))), hex(await colour(page, side(5)))], ['p6', '2f8f6b', '2b2f3a']);
});

await scenario('the name takes a composition of an input method', desktop, async page => {
  const session = await page.context().newCDPSession(page);
  await click(page, 'name'); assert.equal((await read(page)).editing, true);
  await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
  for (let length = 1; length <= 5; length++) await session.send('Input.imeSetComposition', { text: 'libai'.slice(0, length), selectionStart: length, selectionEnd: length });
  assert.equal((await read(page)).draft, 'libai'); assert.equal((await read(page)).settings.name, '侠客', 'nothing is committed while it is composed');
  await session.send('Input.insertText', { text: '李白' });
  await key(page, 'Enter'); const now = await read(page);
  assert.deepEqual([now.editing, now.settings.name], [false, '李白']);
  assert.equal(await page.getByRole('textbox', { name: '名字 / Name', exact: true }).evaluate(element => element.value ?? element.textContent), '李白');
  // Eight characters at most, each Chinese character counting once.
  await click(page, 'name'); await page.keyboard.press('Control+A'); await session.send('Input.insertText', { text: '一二三四五六七八九十' }); await key(page, 'Enter');
  assert.equal((await read(page)).settings.name, '一二三四五六七八');
});

await scenario('the volume follows a press, a drag and the keys of a slider', desktop, async page => {
  const slider = page.getByRole('slider', { name: '音量 / Volume', exact: true });
  const told = async () => Promise.all(['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-orientation'].map(name => slider.getAttribute(name)));
  assert.deepEqual([(await read(page)).settings.volume, await told()], [60, ['60', '0', '100', 'horizontal']]);
  // A press on the track puts the volume there: the nearest of its steps of five.
  await click(page, volumeSpot(25)); assert.deepEqual([(await read(page)).settings.volume, await told()], [25, ['25', '0', '100', 'horizontal']]);
  await click(page, volumeSpot(51)); assert.equal((await read(page)).settings.volume, 50);
  // Drawn as it is: filled up to the thumb, the thumb in the ink, and the track beyond it. The pointer is over the track.
  assert.deepEqual([hex(await colour(page, volumeSpot(15))), hex(await colour(page, [180, 258])), hex(await colour(page, volumeSpot(85)))], ['2f8f6b', 'f3e9d2', '56689a']);
  await move(page, 'empty'); assert.equal(hex(await colour(page, volumeSpot(85))), '3d4a63');
  // The button that pressed drags the thumb, also outside the track and past its ends.
  await page.mouse.move(...await at(page, volumeSpot(50))); await page.mouse.down(); await settle(page);
  assert.deepEqual([(await read(page)).dragging, hex(await colour(page, volumeSpot(85)))], [true, '27314a']);
  await page.mouse.move(...await at(page, [volumeSpot(80)[0], 200]), { steps: 4 }); await settle(page); assert.equal((await read(page)).settings.volume, 80);
  await page.mouse.move(...await at(page, [400, 300]), { steps: 4 }); await settle(page); assert.equal((await read(page)).settings.volume, 100);
  await page.mouse.move(...await at(page, [30, 252]), { steps: 4 }); await settle(page); assert.equal((await read(page)).settings.volume, 0);
  await page.mouse.move(...await at(page, volumeSpot(35)), { steps: 4 }); await page.mouse.up(); await settle(page);
  let now = await read(page);
  assert.deepEqual([now.settings.volume, now.dragging, await told()], [35, false, ['35', '0', '100', 'horizontal']]);
  await page.mouse.move(...await at(page, volumeSpot(90))); await settle(page); assert.equal((await read(page)).settings.volume, 35, 'a pointer that is not down drags nothing');
  // Asked to take the focus by assistive technology, the slider takes the keyboard, and the keys of a slider move it.
  await page.focus('#scene'); await slider.evaluate(element => element.focus()); await settle(page);
  assert.deepEqual([(await read(page)).focus, await active(page)], ['volume', ['slider', '音量 / Volume']]);
  await key(page, 'ArrowRight'); assert.equal((await read(page)).settings.volume, 40);
  await key(page, 'ArrowDown'); await key(page, 'ArrowLeft'); assert.equal((await read(page)).settings.volume, 30);
  await key(page, 'PageUp'); assert.equal((await read(page)).settings.volume, 50);
  await key(page, 'PageDown'); await key(page, 'PageDown'); assert.equal((await read(page)).settings.volume, 10);
  await key(page, 'PageDown'); assert.equal((await read(page)).settings.volume, 0, 'a page past the end stops at the end');
  await key(page, 'End'); assert.deepEqual([(await read(page)).settings.volume, await told()], [100, ['100', '0', '100', 'horizontal']]);
  // At its end the keys are still the slider's: nothing scrolls under it.
  await key(page, 'ArrowRight'); await key(page, 'PageUp'); await key(page, 'End'); assert.deepEqual([(await read(page)).settings.volume, await page.evaluate(() => scrollY)], [100, 0]);
  await key(page, 'Home'); assert.equal((await read(page)).settings.volume, 0);
  // A held key repeats.
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight'); await settle(page);
  assert.equal((await read(page)).settings.volume, 15);
  // A profile has a volume, and one moved by hand is no longer that profile.
  await click(page, rowSpot(3)); now = await read(page);
  assert.deepEqual([now.loaded, now.settings, await told()], ['p2', profile(2), ['30', '0', '100', 'horizontal']]);
  await click(page, volumeSpot(75)); now = await read(page);
  assert.deepEqual([now.loaded, now.settings.volume], [undefined, 75]);
});

await scenario('a theme is changed for the whole screen in one frame', desktop, async page => {
  const places = { page: 'margin', sound: 'sound', idle: 'paint', row: [450, rowSpot(1)[1]], rowAlt: [450, rowSpot(2)[1]], field: [230, 190] };
  const seen = async () => Object.fromEntries(await Promise.all(Object.entries(places).map(async ([name, place]) => [name, hex(await colour(page, place))])));
  await move(page, 'empty');
  assert.deepEqual(await seen(), { page: '161a22', sound: '2f8f6b', idle: '3d4a63', row: '2b2f3a', rowAlt: '343a48', field: '10141b' });
  const before = await read(page);
  await click(page, 'dark'); await move(page, 'empty');
  let now = await read(page);
  assert.deepEqual([now.theme, now.wanted, now.mixedFrames], ['light', 'light', 0]);
  assert.deepEqual(await seen(), { page: 'e9edf5', sound: '4cb58b', idle: 'c9d3e6', row: 'f0f2f7', rowAlt: 'e2e7f0', field: 'f4f6fa' });
  assert.deepEqual([now.settings, now.rows.map(row => row.key)], [before.settings, before.rows.map(row => row.key)], 'nothing but the paint changed');
  // The card is of the new theme too, though it was closed when the theme changed.
  await click(page, 'reset'); now = await read(page);
  assert.equal(now.confirm.open, true);
  assert.equal(hex(await colour(page, [now.confirm.yes.x + 200, now.confirm.yes.y + 15])), 'c9d3e6');
  await key(page, 'Escape');
  // And back, by the keyboard, with a row focused and the list scrolled.
  await click(page, rowSpot(3)); await page.focus('#scene');
  // The card left the focus on a control of the screen when it closed: Tab goes on from there to the switch.
  for (let press = 0; press < 8 && (await active(page))?.[1] !== '深色 / Dark'; press++) await key(page, 'Tab');
  assert.deepEqual(await active(page), ['switch', '深色 / Dark']);
  await key(page, 'Space'); now = await read(page);
  assert.deepEqual([now.theme, now.mixedFrames, now.loaded], ['dark', 0, 'p2']);
  assert.ok(now.realized <= 24, 'a theme binds the rows again and lets the old bindings go');
  await move(page, 'empty');
  assert.equal(hex(await colour(page, 'margin')), '161a22'); assert.equal(hex(await colour(page, [450, rowSpot(3)[1]])), '2f8f6b');
});

await scenario('a reset asks first, in a modal card that is all assistive technology is given', desktop, async page => {
  await click(page, rowSpot(4)); assert.equal((await read(page)).loaded, 'p3');
  await page.focus('#scene'); for (let press = 0; press < 6; press++) await key(page, 'Tab');
  assert.deepEqual(await active(page), ['button', '重置 / Reset']);
  await key(page, 'Enter'); let now = await read(page);
  assert.deepEqual([now.confirm.open, now.focus, now.settings], [true, 'confirm-yes', profile(3)]);
  assert.deepEqual(await accessible(page), [[0, 'dialog', '恢复默认设置？/ Restore the defaults?'], [1, 'button', '恢复 / Restore'], [1, 'button', '取消 / Cancel']]);
  assert.deepEqual((await page.evaluate(() => [...document.querySelectorAll('[inert]')].map(element => element.getAttribute('role')))).sort(), ['group', 'listbox']);
  // Tab stays inside, a press on a control behind the card reaches nothing, and Escape leaves the settings as they were.
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'confirm-no');
  await key(page, 'Tab'); assert.equal((await read(page)).focus, 'confirm-yes');
  await click(page, 'sound'); await click(page, rowSpot(9)); now = await read(page);
  assert.deepEqual([now.settings, now.loaded, now.confirm.open], [profile(3), 'p3', true]);
  await key(page, 'Escape'); now = await read(page);
  assert.deepEqual([now.confirm.open, now.settings, now.focus], [false, profile(3), 'reset']);
  assert.equal((await accessible(page)).filter(row => row[1] === 'option').length, 10);
  // Asked again and answered: the defaults are restored, and the settings are no profile.
  await key(page, 'Space'); assert.equal((await read(page)).confirm.open, true);
  await key(page, 'Enter'); now = await read(page);
  assert.deepEqual([now.confirm.open, now.settings, now.loaded, now.focus], [false, DEFAULTS, undefined, 'reset']);
  // The card answers a press as well.
  await click(page, 'sound'); await click(page, 'reset'); now = await read(page);
  await click(page, [now.confirm.no.x + 30, now.confirm.no.y + 15]); now = await read(page);
  assert.deepEqual([now.confirm.open, now.settings.sound], [false, false]);
  await click(page, 'reset'); now = await read(page);
  await click(page, [now.confirm.yes.x + 30, now.confirm.yes.y + 15]); now = await read(page);
  assert.deepEqual([now.confirm.open, now.settings], [false, DEFAULTS]);
});

await scenario('a request of assistive technology reaches each control', desktop, async page => {
  const ask = async (role, name, action) => { await page.getByRole(role, { name, exact: true }).evaluate((element, method) => element[method](), action); await settle(page); };
  await ask('switch', '声音 / Sound', 'click'); assert.equal((await read(page)).settings.sound, false);
  await ask('radio', '难 Hard', 'click'); assert.equal((await read(page)).settings.level, 'hard');
  await ask('option', optionName(6), 'click'); assert.deepEqual([(await read(page)).loaded, (await read(page)).settings], ['p6', profile(6)]);
  await page.focus('#scene'); await ask('option', optionName(8), 'focus');
  assert.deepEqual([(await read(page)).row, await page.evaluate(() => document.activeElement.id)], ['p8', 'scene']);
  await ask('switch', '深色 / Dark', 'click'); assert.equal((await read(page)).theme, 'light');
  await ask('button', '重置 / Reset', 'click'); assert.equal((await read(page)).confirm.open, true);
  await ask('button', '恢复 / Restore', 'click');
  const now = await read(page);
  assert.deepEqual([now.confirm.open, now.settings, now.theme], [false, DEFAULTS, 'light']);
  // The text box asks for the platform field, which is then the field's own element.
  await ask('textbox', '名字 / Name', 'click'); assert.equal((await read(page)).editing, true);
  assert.equal(await page.getByRole('textbox', { name: '名字 / Name', exact: true }).count(), 1, 'one text box, never two');
  await page.keyboard.press('Escape'); await settle(page); assert.equal((await read(page)).editing, false);
});

await scenario('on a phone a finger works every control', { ...devices['Pixel 7'] }, async page => {
  const tap = async place => { await page.touchscreen.tap(...await at(page, typeof place === 'string' ? spot[place] : place)); await settle(page); };
  await tap('sound'); await tap('hard'); let now = await read(page);
  assert.deepEqual([now.settings.sound, now.settings.level, now.hovered], [false, 'hard', []]);
  // A tap on the track, and a finger that drags along it.
  await tap(volumeSpot(20)); assert.equal((await read(page)).settings.volume, 20);
  const session = await page.context().newCDPSession(page), touch = async (type, place) => {
    const [x, y] = await at(page, place);
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }); await settle(page);
  };
  await touch('touchStart', volumeSpot(40)); assert.deepEqual([(await read(page)).settings.volume, (await read(page)).dragging], [40, true]);
  await touch('touchMove', volumeSpot(65)); await touch('touchMove', [volumeSpot(90)[0], 230]); assert.equal((await read(page)).settings.volume, 90);
  await touch('touchEnd', volumeSpot(90)); assert.deepEqual([(await read(page)).settings.volume, (await read(page)).dragging], [90, false]);
  await session.detach();
  await tap(rowSpot(3)); now = await read(page);
  assert.deepEqual([now.loaded, now.settings], ['p2', profile(2)]);
  await tap('dark'); assert.equal((await read(page)).theme, 'light');
  await tap('reset'); now = await read(page); assert.equal(now.confirm.open, true);
  await tap('sound'); assert.equal((await read(page)).settings.sound, true, 'the card keeps a finger from what is behind it');
  await tap([now.confirm.yes.x + 30, now.confirm.yes.y + 15]); now = await read(page);
  assert.deepEqual([now.confirm.open, now.settings], [false, DEFAULTS]);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
