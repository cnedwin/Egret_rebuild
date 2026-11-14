// SPDX-License-Identifier: Apache-2.0
// Checks the physics example in a real browser with the browser's own keyboard, mouse and touch input.
//
//   node examples/physics-2d/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
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
  throw new Error('Usage: node examples/physics-2d/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]');
fs.mkdirSync(out, { recursive: true });
const { chromium, devices } = await import(pathToFileURL(playwrightPath).href);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404, { connection: 'close' }); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', connection: 'close' }); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { profile: 'physics-2d-example/1', node: process.version, input: 'injected through the automation protocol',
  renderer: renderer === 'software' ? 'bundled Chromium, headless, software rendering' : 'installed Edge, headed, default launch', backend: 'webgl2', cases: [] };
const browser = await chromium.launch(renderer === 'software' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'msedge', headless: false });
report.browser = browser.version();

const read = page => page.evaluate(() => globalThis.__egretPhysicsExample.readSnapshot());
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
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/physics-2d/index.html' + query);
    await page.waitForFunction(() => globalThis.__egretPhysicsExample !== undefined);
    await drawn(page);
    await body(page);
    assert.equal((await read(page)).failure, undefined); assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, name.replace(/\W+/g, '-') + '.png') });
    row.status = 'PASS';
  } catch (error) { row.status = 'FAIL'; row.failure = String(error.stack ?? error); process.exitCode = 1; }
  await owned.close();
}
const desktop = { viewport: { width: 1000, height: 900 } };
const run = (page, seconds, keys = [], fps = 60) => page.evaluate(([s, k, f]) => globalThis.__egretPhysicsExample.run(s, k, f), [seconds, keys, fps]);
const drop = (page, x, y) => page.evaluate(([dx, dy]) => globalThis.__egretPhysicsExample.drop(dx, dy), [x, y]);
// The colours of the picture: the hall, its walls, the disciple, a stone, and the pond empty and with a stone in it.
const HALL = '1e2230', WALL = '6b4a33', HERO = '1f3a93', STONE = 'c9c3b8', POND = '2a4f7a', POND_LIT = '4fa3e0';
// The top face of the slope, a box of 160 by 10 at (330, 230) turned by -20 degrees: where its middle is, and its height at a place across it.
const TURN = 20 * Math.PI / 180, TOP = { x: 330 - 5 * Math.sin(TURN), y: 230 - 5 * Math.cos(TURN) };

await scenario('the hall is six boxes made from its grid, and the disciple stands where it starts', desktop, async page => {
  const now = await read(page);
  assert.equal(now.walls, 6); assert.equal(now.bodies, 6 + 2 + 1);
  assert.deepEqual(now.hero, { x: 60, y: 200 }); assert.equal(now.ray, null);
  assert.equal(await colour(page, [7, 100]), WALL); assert.equal(await colour(page, [180, 82]), WALL); assert.equal(await colour(page, [240, 120]), HALL);
  assert.equal(await colour(page, [60, 200]), HERO); assert.equal(await colour(page, [100, 240]), POND);
  // The first step casts the ray: right from the disciple, to the top face of the slope.
  await run(page, 1 / 60);
  const ray = (await read(page)).ray;
  assert.equal(ray.slope, true); near(ray.y, 200, 1e-9, 'level'); near(ray.x, TOP.x + (TOP.y - 200) / Math.tan(TURN), 0.01, 'on the slope');
});

await scenario('the keys move the disciple, which stops at walls, slides along the ledge, and the ray stops at the low wall', desktop, async page => {
  await run(page, 1, ['KeyD']);
  near((await read(page)).hero.x, 200, 1e-6, 'a second at its speed');
  await run(page, 1, ['KeyW']);
  let now = await read(page);
  near(now.hero.y, 98, 0.01, 'under the ledge'); near(now.hero.x, 200, 1e-6, 'not pushed aside');
  // Up and right together: it slides along the bottom of the ledge, then rises past its end.
  await run(page, 1, ['ArrowUp', 'ArrowRight']);
  now = await read(page);
  // Rising past the corner of the ledge it may be pushed aside by a little.
  near(now.hero.x, 200 + 140 / Math.SQRT2, 0.25, 'slid right'); assert.ok(now.hero.y < 75, 'risen past the ledge: ' + now.hero.y);
  await run(page, 4, ['ArrowLeft']);
  near((await read(page)).hero.x, 23, 0.01, 'at the left wall');
  await run(page, 2, ['KeyS']);
  near((await read(page)).hero.y, 247, 0.01, 'on the floor');
  // A step of one unit at a time, up to the height of the low wall: the ray stops at its face.
  await run(page, 82 / 140, ['KeyW'], 140);
  now = await read(page);
  near(now.hero.y, 165, 0.01, 'level with the low wall'); assert.equal(now.ray.wall, true); near(now.ray.x, 360, 1e-6, 'its face');
});

await scenario('a stone falls on the ledge and rests on it; one on the slope slides down it and on along the floor', desktop, async page => {
  await drop(page, 180, 30);
  await run(page, 2);
  let stone = (await read(page)).stones[0];
  near(stone.y, 75 - 7.5, 0.05, 'on the ledge'); near(stone.x, 180, 1e-6, 'where it fell'); near(stone.vy, 0, 1, 'still');
  assert.equal(await colour(page, [180, 67]), STONE);
  await drop(page, 385, 150);
  await run(page, 1);
  stone = (await read(page)).stones[1];
  assert.ok(stone.x < 380 && stone.vx < 0, 'sliding down: ' + JSON.stringify(stone));
  await run(page, 5);
  stone = (await read(page)).stones[1];
  assert.ok(stone.x < 255, 'off the slope: ' + stone.x); near(stone.y, 255 - 7.5, 0.05, 'on the floor');
});

await scenario('a stone in the pond bounces where it falls and lights the pond; clearing it puts the pond out', desktop, async page => {
  await drop(page, 100, 60);
  let rose = false, highest = Infinity;
  for (let i = 0; i < 40; i++) { await run(page, 1 / 20); const s = (await read(page)).stones[0]; if (s.vy < 0) rose = true; if (rose) highest = Math.min(highest, s.y); }
  assert.ok(rose && highest < 240, 'it bounced up to ' + highest);
  await run(page, 3);
  const now = await read(page);
  near(now.stones[0].y, 247.5, 0.05, 'at rest'); assert.equal(now.inPond, 1);
  assert.equal(await colour(page, [90, 235]), POND_LIT);
  await page.click('#clear'); await drawn(page);
  const after = await read(page);
  assert.deepEqual([after.stones.length, after.inPond, after.bodies], [0, 0, 9]);
  assert.equal(await colour(page, [90, 235]), POND);
});

await scenario('a click drops a stone where it is pressed; the button drops five, and eleven settle without passing into each other', desktop, async page => {
  const [x, y] = await at(page, [300, 40]);
  await page.mouse.click(x, y); await drawn(page);
  let now = await read(page);
  assert.equal(now.stones.length, 1); near(now.stones[0].x, 300, 0.75, 'at the press'); near(now.stones[0].y, 40, 0.75, 'at the press');
  await page.click('#drop'); await page.click('#drop');
  await run(page, 6);
  now = await read(page);
  assert.equal(now.stones.length, 11);
  for (const s of now.stones) assert.ok(s.x > 15 && s.x < 465 && s.y > 15 && s.y < 255, 'in the hall: ' + JSON.stringify(s));
  for (let i = 0; i < now.stones.length; i++) for (let j = i + 1; j < now.stones.length; j++) {
    const a = now.stones[i], b = now.stones[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 15 - 0.5, 'stones ' + i + ' and ' + j + ' are inside each other');
  }
});

await scenario('in real time the keyboard of the browser moves the disciple, and letting go stops it', desktop, async page => {
  await page.focus('#scene');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  const moved = (await read(page)).hero.x;
  assert.ok(moved > 90 && moved < 200, 'moved to ' + moved);
  await page.waitForTimeout(300);
  assert.equal((await read(page)).hero.x, moved);
}, '?backend=webgl2');

await scenario('on a phone a tap drops a stone', { ...devices['Pixel 7'] }, async page => {
  const [x, y] = await at(page, [240, 100]);
  await page.touchscreen.tap(x, y); await drawn(page);
  const now = await read(page);
  assert.equal(now.stones.length, 1); near(now.stones[0].x, 240, 1, 'at the tap');
});

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.cases.map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : '')).join('\n'));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
