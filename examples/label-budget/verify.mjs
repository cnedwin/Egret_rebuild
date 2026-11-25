// SPDX-License-Identifier: Apache-2.0
// Opens the label probe in headless Chromium (SwiftShader) and checks two things a game met with many labels:
// - a board of 100 short labels on one screen is drawn, the game warned before a frame's images run short, and the
//   loop never stopped;
// - labels made with browser.createLabel whose parent is removed give back their place in the text cache.
//
//   node examples/label-budget/verify.mjs <absolute Playwright index.mjs> [<report.json>]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [playwrightPath, reportPath] = process.argv.slice(2);
if (!playwrightPath)
  throw new Error('Usage: node examples/label-budget/verify.mjs <Playwright index.mjs> [<report.json>]');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
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
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/label-budget/index.html`);
  await page.waitForFunction(() => globalThis.__labelsReady === true, null, { timeout: 60_000 });

  report.board = await page.evaluate(() => globalThis.__labels.board(100));
  console.log('board:', JSON.stringify(report.board));
  report.images = await page.evaluate(() => globalThis.__labels.images(70, 40));
  console.log('images:', JSON.stringify(report.images));
  report.gone = await page.evaluate(() => globalThis.__labels.gone(500));
  console.log('gone:', JSON.stringify(report.gone));
  if (reportPath) fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2));

  // 100 different short texts of game.text on one screen: every one drawn, on few of a frame's images.
  const board = report.board;
  assert.deepEqual(board.errors, [], 'no error');
  assert.equal(board.loop, 'running');
  assert.equal(board.shown, 100, 'every text drew its words');
  assert.ok(board.usage.pages <= 8, 'the words share a few pages: ' + JSON.stringify(board.usage));
  assert.ok(board.usage.regions >= 100);
  // 70 pictures of their own: the frame is told near its limit, then not drawn, and the loop goes on; with 40 left
  // the frames are drawn again.
  const images = report.images;
  assert.deepEqual(images.errors, [], 'the loop was not stopped');
  assert.equal(images.loop, 'running');
  assert.ok(images.warned.includes('FRAME_IMAGES_NEAR_LIMIT'), 'told before the limit: ' + images.warned);
  assert.ok(images.warned.includes('FRAME_IMAGE_BUDGET'), 'told of the frame not drawn: ' + images.warned);
  assert.ok(
    images.warned.indexOf('FRAME_IMAGES_NEAR_LIMIT') < images.warned.indexOf('FRAME_IMAGE_BUDGET'),
    'told near the limit first'
  );
  assert.ok(images.over.refusedFrames > 0);
  assert.equal(images.later.refusedFrames, images.after.refusedFrames, 'with 40 pictures every frame is drawn');
  assert.ok(images.after.pages <= 64 && images.after.pages >= 40, JSON.stringify(images.after));
  // 500 labels of createLabel under one parent, which is removed: the text cache holds no label's place after.
  const gone = report.gone;
  assert.deepEqual(gone.errors, []);
  assert.ok(gone.before.cache.activeCallerLeases > 0, 'the labels held places in the cache');
  assert.equal(gone.after.cache.activeCallerLeases, 0, 'every place given back: ' + JSON.stringify(gone.after.cache));
  assert.equal(gone.after.cache.callerLeaseSlots, 0);
  assert.equal(gone.after.cache.retiredGenerations, 0);
  assert.equal(gone.after.cache.liveImageBytes, gone.after.cache.residentBytes, 'only what the cache keeps for reuse');
  assert.equal(gone.after.queued + gone.after.drawing, 0);
  assert.ok(gone.warned.includes('LABEL_CACHE_NEAR_LIMIT') && gone.warned.includes('LABEL_NOT_DRAWN'), gone.warned);
  assert.deepEqual(problems, []);
  console.log('ok');
} finally {
  await browser.close();
  server.close();
}
