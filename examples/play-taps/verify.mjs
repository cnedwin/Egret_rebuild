// SPDX-License-Identifier: Apache-2.0
// Opens the tap probe in headless Chromium (SwiftShader) and clicks as a person would: on a sprite whose drawing is
// its child's, on one that draws itself, after the child moves and after the game sets an area; and reads a tap with
// a name in the semantic tree; and a title written top to bottom. No screen reader was run.
//
//   node examples/play-taps/verify.mjs <absolute Playwright index.mjs> [<report.json>]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [playwrightPath, reportPath] = process.argv.slice(2);
if (!playwrightPath)
  throw new Error('Usage: node examples/play-taps/verify.mjs <Playwright index.mjs> [<report.json>]');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json'
};
const server = http.createServer((request, response) => {
  const file = path.resolve(root, decodeURIComponent(new URL(request.url, 'http://x').pathname).slice(1));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const report = {};
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => message.type() === 'error' && problems.push(message.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/play-taps/index.html`);
  await page.waitForFunction(() => globalThis.__tapsReady === true, null, { timeout: 60_000 });
  const taps = () => page.evaluate(() => globalThis.__taps.taps());
  const click = async at => {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(150);
  };

  // A sprite drawn by its child is tapped where the child is; one that draws itself, as before; beside them, nothing.
  const made = await page.evaluate(() => globalThis.__taps.make());
  await click(made.button);
  report.childOnly = await taps();
  assert.equal(report.childOnly, 1, 'a tap on the face of a sprite that draws nothing itself');
  await click(made.plain);
  assert.equal(await taps(), 2, 'a sprite that draws itself');
  await click(made.beside);
  assert.equal(await taps(), 2, 'nothing beside them');
  // The face moves: its new place is the sprite's, and its old one no longer is.
  const moved = await page.evaluate(() => globalThis.__taps.moveFace());
  await click(moved.moved);
  assert.equal(await taps(), 3, 'the area followed the face');
  await click(moved.left);
  assert.equal(await taps(), 3, 'the old place of the face is not the sprite');
  // An area the game sets is kept.
  const own = await page.evaluate(() => globalThis.__taps.ownArea());
  await click(own.middle);
  assert.equal(await taps(), 3, "outside the game's own area");
  await click(own.corner);
  assert.equal(await taps(), 4, "inside the game's own area");
  // A named tap is a button of the semantic tree.
  report.named = await page.evaluate(() => globalThis.__taps.name());
  assert.equal(report.named.shown.role, 'button');
  assert.ok(
    report.named.shown.bounds.width > 200 && report.named.shown.bounds.height > 50,
    JSON.stringify(report.named.shown.bounds)
  );
  assert.deepEqual(report.named.shown.actions, ['activate']);
  assert.equal(report.named.activated, 1, 'activating it taps it');
  assert.equal(report.named.hidden, true, 'hidden while the sprite is');
  assert.equal(report.named.again, true, 'back when it is shown again');
  assert.equal(report.named.gone, true, 'gone with the sprite');
  // A vertical title: taller than wide, two columns of four.
  report.vertical = await page.evaluate(() => globalThis.__taps.vertical());
  assert.equal(report.vertical.text, '洗冤笔录，第一案', 'the words stay as given');
  assert.equal(report.vertical.shown, true);
  assert.ok(report.vertical.height > report.vertical.width * 1.5, JSON.stringify(report.vertical));
  assert.ok(
    report.vertical.width >= 70 && report.vertical.width <= 100,
    'two columns of a 40 size: ' + report.vertical.width
  );
  assert.deepEqual(await page.evaluate(() => globalThis.__taps.errors), []);
  assert.deepEqual(problems, []);
  report.taps = await taps();
  if (reportPath) fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log('ok');
} finally {
  await browser.close();
  server.close();
}
