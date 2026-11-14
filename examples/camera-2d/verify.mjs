// SPDX-License-Identifier: Apache-2.0
// Checks the example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/camera-2d/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that
// Playwright bundles runs headless with software rendering. Input is injected through the browser's
// automation protocol; no person pressed a key. Colours are read from screenshots of the canvas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)), [playwrightPath, out, renderer] = process.argv.slice(2);
if (!playwrightPath || !out || !path.isAbsolute(playwrightPath) || !path.isAbsolute(out) || fs.existsSync(out) || ![undefined, 'software'].includes(renderer))
  throw new Error('Usage: node examples/camera-2d/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'camera-2d-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretCameraExample.readSnapshot());
const drawn = page => page.waitForTimeout(80);
async function at(page, [x, y]) {
  const box = await page.evaluate(() => { const bounds = document.querySelector('#scene').getBoundingClientRect(); return [bounds.left, bounds.top, bounds.width, bounds.height]; });
  return [box[0] + x * box[2] / 480, box[1] + y * box[3] / 270];
}
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
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' is not within ' + tolerance + ' of ' + expected);
async function scenario(name, context, body, query = '?backend=webgl2&manual') {
  const owned = await browser.newContext(context), page = await owned.newPage(), row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/camera-2d/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretCameraExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
const run = (page, seconds, keys = [], fps = 60) => page.evaluate(([s, k, f]) => globalThis.__egretCameraExample.run(s, k, f), [seconds, keys, fps]);
// The colours of the picture: the disciple, the dark gate, the red wall, the paving, the hills and the sky.
const HERO = 'f2f2f2', HERO_MIDDLE = '1f3a93', GATE = '2b2b2b', WALL = '7b2d26';

await scenario('the first frame shows the disciple in the middle of the view, on the paving', desktop, async page => {
  const now = await read(page);
  assert.deepEqual([Math.round(now.onScreen.x), Math.round(now.onScreen.y)], [240, 135]);
  assert.equal(await colour(page, [240, 135]), HERO_MIDDLE);
  assert.equal(await colour(page, [240 + 11, 135]), HERO);
  // Nothing of the gate or of a wall is in sight yet.
  for (const place of [[10, 10], [470, 10], [10, 260], [470, 260]]) assert.ok(![GATE, WALL].includes(await colour(page, place)), String(place));
});

await scenario('the camera follows the disciple, the same distance however many frames there are', desktop, async page => {
  await run(page, 1, ['ArrowRight'], 60);
  const sixty = await read(page);
  assert.ok(sixty.hero.x > 500, 'the disciple walked: ' + sixty.hero.x);
  // Ahead of the middle by half the dead zone (40) and by what a camera smoothed over 0.2 s trails at 220 units a second (44).
  assert.ok(sixty.onScreen.x > 240 + 40 && sixty.onScreen.x < 240 + 40 + 44 + 1, 'on screen: ' + sixty.onScreen.x);
  assert.equal(await colour(page, [Math.round(sixty.onScreen.x), Math.round(sixty.onScreen.y)]), HERO_MIDDLE);
  await page.reload(); await page.waitForFunction(() => globalThis.__egretCameraExample !== undefined);
  await run(page, 1, ['ArrowRight'], 20);
  const twenty = await read(page);
  near(twenty.hero.x, sixty.hero.x, 0.01, 'the same walk');
  // Exact for a target that stands still; one that moves is sampled at fewer places, so a few units apart.
  near(twenty.camera.center.x, sixty.camera.center.x, 5, 'the same camera at a third of the frames');
});

await scenario('at the walls the camera stops and the disciple walks to the edge of the view', desktop, async page => {
  await run(page, 4, ['ArrowUp', 'ArrowLeft']);
  const now = await read(page);
  // The left wall stops it; at the top it may look over the far wall, as far as its bounds reach.
  assert.equal(now.camera.view.x, 0);
  assert.ok(now.onScreen.x < 240 - 100, JSON.stringify(now.onScreen));
  assert.equal(await colour(page, [5, 200]), WALL);
  assert.equal(await colour(page, [Math.round(now.onScreen.x), Math.round(now.onScreen.y)]), HERO_MIDDLE);
});

await scenario('a zoom keeps the middle where it is, and the layers take their share of it', desktop, async page => {
  await page.click('#zoom-in'); await run(page, 0.5);
  let now = await read(page);
  near(now.camera.zoom, 1.5, 1e-9, 'zoomed in');
  assert.deepEqual([now.world.scale, now.leaves.scale], [1.5, 1.5]);
  near(now.hills.scale, 1 + 0.5 * 0.3, 1e-9, 'the hills take three tenths of the zoom');
  assert.equal(await colour(page, [240, 135]), HERO_MIDDLE);
  // The disciple's blue middle is sixteen units across: at one and a half it is twenty-four on the stage.
  assert.equal(await colour(page, [240 + 11, 135]), HERO_MIDDLE);
  await page.click('#zoom-out'); await page.click('#zoom-out'); await run(page, 0.5);
  now = await read(page);
  near(now.camera.zoom, 1 / 1.5, 1e-9, 'zoomed out');
  // The wheel zooms too.
  const [x, y] = await at(page, [240, 135]); await page.mouse.move(x, y); await page.mouse.wheel(0, -100); await run(page, 0.5);
  near((await read(page)).camera.zoom, 1 / 1.5 * 1.1, 1e-9, 'the wheel');
});

await scenario('far hills move less than the yard and near leaves more', desktop, async page => {
  const before = await read(page);
  await run(page, 2, ['ArrowRight']);
  const after = await read(page), moved = after.camera.center.x - before.camera.center.x;
  assert.ok(moved > 200, 'the camera moved ' + moved);
  near(after.hills.anchorX - before.hills.anchorX, moved * 0.3, 1e-6, 'the hills');
  near(after.leaves.anchorX - before.leaves.anchorX, moved * 1.4, 1e-6, 'the leaves');
  near(after.world.anchorX - before.world.anchorX, moved, 1e-6, 'the yard');
});

await scenario('a shake moves and turns the view, the same way each time, and settles where it was', desktop, async page => {
  const still = await read(page);
  const path = async () => { await page.click('#shake'); const seen = []; for (let i = 0; i < 20; i++) { await run(page, 1 / 60); const now = await read(page); seen.push([now.world.x, now.world.y, now.world.rotation]); } await run(page, 2); return seen; };
  const first = await path(), settled = await read(page), second = await path();
  assert.ok(first.some(([x, y]) => Math.hypot(x - still.world.x, y - still.world.y) > 1), 'the view moved');
  assert.ok(first.some(([, , r]) => Math.abs(r) > 0.05), 'the view turned');
  assert.deepEqual([settled.world.x, settled.world.y, settled.world.rotation, settled.camera.trauma], [still.world.x, still.world.y, 0, 0]);
  // The same seed and the same time give the same shake only at the same time; the second shake is at a later time, so it differs.
  assert.notDeepEqual(first, second);
  assert.equal(await colour(page, [240, 135]), HERO_MIDDLE);
});

await scenario('the camera looks at the gate, stops following, and is sent back', desktop, async page => {
  await page.click('#pan'); await run(page, 0.6);
  let now = await read(page);
  assert.equal(now.camera.following, false);
  await run(page, 0.8);
  now = await read(page);
  assert.deepEqual([now.camera.center.x, now.camera.center.y], [800, 40]);
  near(now.gateOnScreen.x, 240, 1e-6, 'the gate in the middle');
  assert.equal(await colour(page, [240, 135]), GATE);
  // Over the far wall: the sky and the hills behind it.
  assert.ok(['9fc4e8', '6f8fa8', '5d7c96'].includes(await colour(page, [240, 40])), 'above the wall');
  // Walking does not take the camera back; the button does.
  await run(page, 0.5, ['ArrowDown']);
  assert.equal((await read(page)).camera.center.x, 800);
  await page.click('#follow'); await run(page, 2);
  now = await read(page);
  assert.equal(now.camera.following, true);
  near(now.onScreen.x, 240, 41, 'back on the disciple');
});

await scenario('in real time the keyboard walks the disciple and the view goes with it', desktop, async page => {
  await page.focus('#scene');
  const before = await read(page);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD'); await page.waitForTimeout(500);
  const after = await read(page);
  assert.ok(after.hero.x - before.hero.x > 60, 'the disciple walked ' + (after.hero.x - before.hero.x));
  assert.ok(after.camera.center.x > before.camera.center.x, 'the camera went with it');
  assert.equal(await colour(page, [Math.round(after.onScreen.x), Math.round(after.onScreen.y)]), HERO_MIDDLE);
}, '?backend=webgl2');

await scenario('on a phone the buttons zoom, shake and look at the gate', { ...devices['Pixel 7'] }, async page => {
  await page.tap('#zoom-in'); await run(page, 0.5);
  near((await read(page)).camera.zoom, 1.5, 1e-9, 'zoomed');
  await page.tap('#pan'); await run(page, 1.5);
  assert.equal((await read(page)).camera.center.x, 800);
  await page.tap('#shake'); await run(page, 0.05);
  assert.ok((await read(page)).camera.trauma > 0.5);
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
