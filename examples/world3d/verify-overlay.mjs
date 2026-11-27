// SPDX-License-Identifier: Apache-2.0
// Checks examples/world3d/overlay.html in headless Chromium: a 2D overlay of `fit: 'expand'` over a 3D canvas.
//   node examples/world3d/verify-overlay.mjs <absolute Playwright index.mjs>
// The overlay's stage follows the 3D canvas, wide and upright with the portrait size; the safe part keeps clear of
// the insets a tool stands in for (`__egretAgent.insets`); `onScreenChange` tells of each change, so the pause button
// stays at the safe part's top right; a press on the button stays with the interface, and a press on an empty part
// goes on to the scene.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [playwright] = process.argv.slice(2);
if (!playwright || !path.isAbsolute(playwright))
  throw new Error('Usage: node examples/world3d/verify-overlay.mjs <absolute Playwright index.mjs>');
const root = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json'
};
const server = http.createServer((request, response) => {
  let file;
  try {
    file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (path.relative(root, file).startsWith('..') || !fs.statSync(file).isFile()) throw new Error('no file');
  } catch {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = await import(pathToFileURL(playwright).href);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const INSETS = { top: 0, right: 59, bottom: 21, left: 59 };
try {
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error' && !/GPU stall|GL Driver/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(insets => {
    globalThis.__egretAgent = { insets };
  }, INSETS);
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/world3d/overlay.html`);
  await page.waitForFunction(() => globalThis.overlayCheck !== undefined, null, { timeout: 20000 });
  const frames = () =>
    page.evaluate(
      () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))
    );
  const read = () => page.evaluate(() => globalThis.overlayCheck.read());
  const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1, `${what}: ${a} is not ${b}`);
  await frames();

  // 852 × 393 with a notch at each side: the 1280 × 720 design at 393 / 720, the stage grown across to fill the canvas.
  let now = await read();
  const scale = 393 / 720;
  near(now.screen.scale, scale, 'the scale keeps the design whole');
  assert.equal(now.screen.height, 720);
  assert.equal(now.screen.width, Math.floor(852 / scale + 1e-6), 'the stage fills the canvas across');
  near(now.canvas.width, now.scene.width, 'the overlay covers the 3D canvas across');
  near(now.box.scale, scale, 'box gives the scale');
  // The safe part leaves out the insets, in stage units.
  near(now.screen.safe.x, INSETS.left / scale, 'the safe part starts after the left inset');
  near(now.screen.safe.width, (852 - INSETS.left - INSETS.right) / scale, 'and ends before the right one');
  near(now.pause.x + 120 + 16, now.screen.safe.x + now.screen.safe.width, 'the pause button is at the safe top right');

  // A press on the button stays with the interface; one on an empty part goes on to the scene.
  const pauseCss = { x: now.canvas.x + (now.pause.x + 60) * scale, y: now.canvas.y + (now.pause.y + 32) * scale };
  await page.touchscreen.tap(pauseCss.x, pauseCss.y);
  await frames();
  let check = await page.evaluate(() => ({ ...globalThis.overlayCheck.check }));
  assert.equal(check.presses, 1, 'the pause button took the tap');
  assert.equal(check.scene, 0, 'the scene did not');
  await page.touchscreen.tap(426, 196);
  await frames();
  check = await page.evaluate(() => ({ ...globalThis.overlayCheck.check }));
  assert.equal(check.scene, 1, 'a tap on an empty part of the interface reached the scene');
  assert.equal(check.presses, 1);
  // Nothing changes in the UI while the animated 3D scene continues to draw. Updates/clock must not stop.
  const idleA = await page.evaluate(() => globalThis.overlayCheck.loop());
  await frames();
  await frames();
  await frames();
  const idleB = await page.evaluate(() => globalThis.overlayCheck.loop());
  assert.equal(idleB.frames, idleA.frames, 'static overlay keeps the last native frame');
  assert.ok(idleB.steps > idleA.steps, 'on-demand does not stop the interface clock');
  await page.evaluate(() => globalThis.overlayCheck.move());
  await frames();
  const moved = await page.evaluate(() => globalThis.overlayCheck.loop());
  assert.equal(moved.frames, idleB.frames + 1, 'a projected-position-style mutation draws a new frame');
  await page.evaluate(() => globalThis.overlayCheck.invalidate());
  await frames();
  const redrawn = await page.evaluate(() => globalThis.overlayCheck.loop());
  assert.equal(redrawn.frames, moved.frames + 1, 'explicit invalidation requests exactly one draw');
  const timing = await page.evaluate(() => globalThis.overlayCheck.timings());
  assert.ok(timing.readyMs >= 0 && timing.game.readyMs >= 0 && timing.game.engineOpenMs >= 0);
  assert.ok(timing.game.firstSubmitMs >= timing.game.readyMs, 'first SDK submission time is separately reported');
  assert.equal(timing.game.webgl2.pagedMs, 0, 'single-page overlay never prepares the multi-page pipeline');
  const wide = now;

  // Turned upright: the portrait design, 720 × 1280, at 393 / 720 again, the stage grown downward; told once or more.
  // The notch moves with the phone; the engine reads the insets again each time it plans.
  await page.evaluate(() => {
    globalThis.__egretAgent.insets = { top: 59, right: 0, bottom: 34, left: 0 };
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await frames();
  await frames();
  now = await read();
  assert.equal(now.screen.width, 720, 'the portrait design across');
  assert.equal(now.screen.height, Math.floor(852 / scale + 1e-6), 'the stage fills the canvas down');
  near(now.canvas.height, now.scene.height, 'the overlay covers the 3D canvas down');
  assert.ok((await page.evaluate(() => globalThis.overlayCheck.check.screens)) >= 1, 'onScreenChange told of the turn');
  near(now.screen.safe.y, 59 / scale, 'the safe part starts below the notch');
  near(now.pause.y, now.screen.safe.y + 16, 'the pause button moved below the notch');
  // The low-startup mode must preserve genuine native pixels for alternating texture pages, including overlap.
  const parity = await page.evaluate(async () => {
    const sdk = await import('@egret/engine');
    const { createSharedWebGL2Host } = await import('/packages/engine/dist/web/webgl2.js');
    const engine = await sdk.createEngine({
      host: {
        surface: {},
        start() {},
        stop() {},
        async close() {},
        setTimeout() {
          return () => {};
        }
      }
    });
    const scope = engine.createScope();
    try {
      const type = sdk.createAssetType('overlay-single-page-pixels', sdk.isTexture);
      engine.assets.register(type, {
        async load(ref) {
          const pixel = ref.id === 'a' ? [240, 52, 70, 180] : [30, 220, 120, 190];
          return sdk.createTexture(
            sdk.createImageData2D({
              width: 2,
              height: 2,
              pixels: new Uint8Array([...pixel, ...pixel, ...pixel, ...pixel])
            })
          );
        },
        dispose(value) {
          value.dispose();
        }
      });
      const leases = [];
      for (const id of ['a', 'b'])
        leases.push(scope.use(await engine.assets.acquire(sdk.createAssetRef(type, id), { signal: scope.signal })));
      for (const [index, page] of [0, 0, 1, 0, 1].entries()) {
        const bitmap = scope.use(new sdk.Bitmap(leases[page]));
        bitmap.x = 2 * index;
        bitmap.y = index % 2;
        bitmap.width = 6;
        bitmap.height = 6;
        engine.stage.addChild(bitmap);
      }
      const frame = engine.captureSharedFrame({ width: 16, height: 12, clearColor: 0x243357, clearAlpha: 1 });
      const results = [];
      for (const pageBatching of ['multi-page', 'single-page']) {
        const canvas = document.createElement('canvas');
        const host = createSharedWebGL2Host({ canvas, pageBatching, enableReadback: true });
        try {
          await host.start();
          const read = host.requestReadback();
          void read.catch(() => {});
          host.renderSharedFrame(frame);
          const out = await read;
          await host.whenIdle();
          results.push({
            bytes: Array.from(out.bytes),
            draws: host.getFrameDrawCalls(),
            timing: host.getStartupTiming()
          });
        } finally {
          await host.close();
        }
      }
      const [multi, single] = results;
      return {
        diff: multi.bytes.filter((byte, i) => byte !== single.bytes[i]).length,
        bytes: multi.bytes.length,
        multiDraws: multi.draws,
        singleDraws: single.draws,
        pagedMs: single.timing.pagedMs
      };
    } finally {
      scope.dispose();
      await engine.dispose();
    }
  });
  assert.ok(parity.bytes > 0);
  assert.equal(parity.diff, 0, 'readback pixels match exactly across batching policies');
  assert.ok(parity.singleDraws >= parity.multiDraws);
  assert.equal(parity.pagedMs, 0);
  console.log(JSON.stringify({ singlePagePixelParity: parity }));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      wide: { stage: [wide.screen.width, wide.screen.height], safe: wide.screen.safe },
      upright: { stage: [now.screen.width, now.screen.height], safe: now.screen.safe },
      taps: check
    })
  );
  console.log(
    'world3d overlay: the stage follows the 3D canvas both ways, the safe part keeps clear of the insets, and taps go where they belong.'
  );
} finally {
  await browser.close();
  server.close();
}
