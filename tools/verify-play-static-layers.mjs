// SPDX-License-Identifier: Apache-2.0
// Original public-SDK GPU layer fixture; the canvas is read only by the browser screenshot API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { createExampleServer } from './serve-example.mjs';

const [playwright, executablePath, output] = process.argv.slice(2);
assert.ok(
  playwright && executablePath && output,
  'node tools/verify-play-static-layers.mjs <playwright-root> <chrome> <new-output>'
);
const repo = path.resolve(import.meta.dirname, '..');
const { chromium } = await import(pathToFileURL(path.join(playwright, 'index.mjs')));
fs.mkdirSync(output);
const server = createExampleServer(repo);
await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const original = fs.readFileSync(path.join(repo, 'examples/play/index.html'), 'utf8');
const map = original.match(/<script type="importmap">[\s\S]*?<\/script>/)?.[0];
assert.ok(map);
const html =
  '<!doctype html><html><head><meta charset=utf-8>' +
  map +
  '</head><body style="margin:0;background:#000"><div id="fixture" style="width:128px;height:64px"></div></body></html>';
const report = {
  status: 'FAIL',
  scope: 'Headless Chromium software WebGL2 pixel equality; no device or performance claim',
  captures: {},
  faults: []
};
let browser;
const hash = data => createHash('sha256').update(data).digest('hex');
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 256, height: 128 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.faults.push(String(error)));
  await page.route(base + '/play-static-layer-fixture', route =>
    route.fulfill({ contentType: 'text/html', body: html })
  );
  await page.goto(base + '/play-static-layer-fixture');
  await page.evaluate(async () => {
    const { play } = await import('@egret/engine/play');
    let backdrop, actor;
    const errors = [];
    const paint = edited => {
      backdrop.graphics.clear();
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 8; x++)
          backdrop.graphics
            .beginFill(edited && x === 0 && y === 0 ? 0x22ccee : (x + y) % 2 ? 0x995530 : 0x704620)
            .drawRect(x * 8, y * 16, 8, 16)
            .endFill();
    };
    const game = await play({
      parent: document.querySelector('#fixture'),
      width: 128,
      height: 64,
      background: 0x20180f,
      backend: 'webgl2',
      pixelRatio: 1,
      staticLayers: true,
      renderMode: 'on-demand',
      audio: false,
      onError: error => errors.push(String(error)),
      setup(g) {
        backdrop = g.sprite();
        paint(false);
        actor = g.rect(28, 28, 8, 8, 0xffcc88);
      }
    });
    game.browser.loop.stop();
    await game.browser.host.whenIdle();
    const cache = game.browser.staticLayers;
    if (!cache) throw Error('Layer capability missing');
    actor.visible = false;
    const opts = { width: 64, height: 64, clearColor: 0, clearAlpha: 0, outputAlpha: 'premultiplied' };
    const original = game.engine.captureSharedFrame(opts);
    paint(true);
    const edited = game.engine.captureSharedFrame(opts);
    paint(false);
    actor.visible = true;
    const layer = cache.createLayer();
    await layer.update(original);
    const place = x => cache.setPlacements([{ layer, x, y: 0, width: 64, height: 64 }]);
    const direct = async (x, edit = false) => {
      cache.setPlacements([]);
      if (!backdrop.parent) game.world.addChildAt(backdrop, 0);
      backdrop.x = x;
      paint(edit);
      const frame = game.browser.drawFrame(game.browser.frame);
      await game.browser.host.whenIdle();
      return frame.commands.length;
    };
    const cached = async x => {
      backdrop.parent?.removeChild(backdrop);
      place(x);
      const frame = game.browser.drawFrame(game.browser.frame);
      await game.browser.host.whenIdle();
      return frame.commands.length;
    };
    window.fixture = { game, cache, layer, edited, direct, cached, place, errors };
  });
  const captures = new Map();
  async function capture(name) {
    // The native Host already proved completion. Give the browser a display turn
    // before taking its ordinary composited screenshot.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = await page.locator('canvas').screenshot();
    fs.writeFileSync(path.join(output, name + '.png'), bytes);
    const image = PNG.sync.read(bytes);
    assert.deepEqual([image.width, image.height], [128, 64]);
    captures.set(name, image);
    report.captures[name] = { sha256: hash(image.data) };
  }
  report.directCommands = await page.evaluate(() => fixture.direct(0));
  await capture('direct');
  report.cachedCommands = await page.evaluate(() => fixture.cached(0));
  await capture('cached');
  // No stage mutation: placement-only invalidation must wake an on-demand Play loop.
  const frames = await page.evaluate(async () => {
    fixture.game.browser.loop.start();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await fixture.game.browser.host.whenIdle();
    const f = fixture.game.browser.loop.snapshot().frames;
    fixture.place(32);
    return f;
  });
  await page.waitForFunction(f => fixture.game.browser.loop.snapshot().frames > f, frames);
  await page.evaluate(async () => {
    await fixture.game.browser.host.whenIdle();
    fixture.game.browser.loop.stop();
  });
  await capture('moved');
  report.placementFrames = {
    before: frames,
    after: await page.evaluate(() => fixture.game.browser.loop.snapshot().frames)
  };
  await page.evaluate(() => fixture.direct(32));
  await capture('moved-direct');
  await page.evaluate(() => fixture.cached(32));
  // Refresh the same placement after a completed bake, without modifying
  // the live stage: on-demand rendering must present the replacement.
  const beforeEdit = await page.evaluate(async () => {
    fixture.game.browser.loop.start();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await fixture.game.browser.host.whenIdle();
    const f = fixture.game.browser.loop.snapshot().frames;
    await fixture.layer.update(fixture.edited);
    fixture.place(32);
    return f;
  });
  await page.waitForFunction(f => fixture.game.browser.loop.snapshot().frames > f, beforeEdit);
  await page.evaluate(async () => {
    await fixture.game.browser.host.whenIdle();
    fixture.game.browser.loop.stop();
  });
  report.rebakeFrames = {
    before: beforeEdit,
    after: await page.evaluate(() => fixture.game.browser.loop.snapshot().frames)
  };
  await capture('edited');
  await page.evaluate(() => fixture.direct(32, true));
  await capture('edited-direct');
  report.statusBeforeDispose = await page.evaluate(() => fixture.cache.getStatus());
  await page.evaluate(async () => {
    await fixture.game.browser.dispose();
  });
  report.layerAfterDispose = await page.evaluate(() => fixture.layer.state);
  report.gameErrors = await page.evaluate(() => fixture.errors);
  function compare(a, b) {
    const first = captures.get(a).data,
      second = captures.get(b).data;
    let maxChannelError = 0;
    for (let i = 0; i < first.length; i++) maxChannelError = Math.max(maxChannelError, Math.abs(first[i] - second[i]));
    assert.ok(maxChannelError <= 2, a + ' vs ' + b + ' mismatch ' + maxChannelError);
    return maxChannelError;
  }
  report.comparisons = {
    initial: compare('direct', 'cached'),
    camera: compare('moved-direct', 'moved'),
    replacement: compare('edited-direct', 'edited')
  };
  const samples = [
    ['cached', 2, 2, [112, 70, 32, 255]],
    ['cached', 28, 28, [255, 204, 136, 255]],
    ['moved', 2, 2, [32, 24, 15, 255]],
    ['moved', 34, 2, [112, 70, 32, 255]],
    ['edited', 34, 2, [34, 204, 238, 255]],
    ['edited', 28, 28, [255, 204, 136, 255]]
  ];
  report.samples = samples.map(([name, x, y, expected]) => {
    const img = captures.get(name),
      i = 4 * (y * img.width + x),
      actual = [...img.data.subarray(i, i + 4)];
    assert.deepEqual(actual, expected);
    return { name, x, y, expected, actual };
  });
  assert.notEqual(report.captures.cached.sha256, report.captures.moved.sha256);
  assert.notEqual(report.captures.moved.sha256, report.captures.edited.sha256);
  assert.equal(report.directCommands, 33);
  assert.equal(report.cachedCommands, 1);
  assert.equal(report.statusBeforeDispose.residentBytes, 64 * 64 * 4);
  assert.equal(report.layerAfterDispose, 'disposed');
  assert.deepEqual(report.faults, []);
  assert.deepEqual(report.gameErrors, []);
  report.status = 'PASS';
} catch (error) {
  report.error = String(error.stack ?? error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
