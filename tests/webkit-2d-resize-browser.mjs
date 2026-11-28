// SPDX-License-Identifier: Apache-2.0
// Real WebKit 2D/Play/overlay rotation probe. A submitted serial alone cannot prove screen presentation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { createExampleServer } from '../tools/serve-example.mjs';

const [playwright, out] = process.argv.slice(2);
if (!playwright || !out || !path.isAbsolute(playwright))
  throw new Error('Usage: node tests/webkit-2d-resize-browser.mjs <absolute Playwright index.mjs> <receipt directory>');
const root = fileURLToPath(new URL('..', import.meta.url));
const files = ['examples/play/index.html', 'examples/world3d/overlay.html'];
const imports = { imports: {} };
for (const file of files) {
  const html = await fs.readFile(path.join(root, file), 'utf8');
  Object.assign(imports.imports, JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports);
}
imports.imports['@egret/engine/web/game'] = '/packages/engine/dist/web/game.js';
const html =
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' +
  '<style>html,body{margin:0;height:100%;background:#123456;overflow:hidden}#place{position:fixed;inset:0}canvas{display:block;width:100%;height:100%}</style>' +
  '<script type="importmap">' + JSON.stringify(imports) + '</script><div id="place"><canvas id="stage"></canvas></div>';
const { webkit, devices } = await import(pathToFileURL(playwright));
await fs.mkdir(out, { recursive: true });
const server = createExampleServer(root);
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port + '/fixture';
const receipts = [];
let browser;
try {
  browser = await webkit.launch({ headless: true });
  for (const [mode, blendSpace, renderMode] of [
    ['game', 'linear', 'on-demand'],
    ['play', 'srgb', 'on-demand'],
    ['overlay', 'linear', 'continuous']
  ]) {
    const record = { mode, blendSpace, renderMode, samples: [], errors: [] };
    receipts.push(record);
    const page = await browser.newPage({ ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 } });
    try {
      page.on('pageerror', error => record.errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') record.errors.push(message.text()); });
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(url);
      await page.evaluate(async ({ mode, blendSpace, renderMode }) => {
        const { createBrowserGame } = await import('@egret/engine/web/game');
        const { play } = await import('@egret/engine/play');
        const { createWorld3DOverlay } = await import('@egret/engine/webgl2/world3d');
        const { DisplayObjectContainer, Sprite } = await import('@egret/engine');
        const stage = document.querySelector('#stage'), holder = document.querySelector('#place'), timings = [];
        const options = {
          width: 852, height: 393, portrait: { width: 393, height: 852 }, fit: 'expand',
          pixelRatio: 1, backend: 'webgl2', renderMode, blendSpace, effects: true,
          onFrameTiming: sample => timings.push(sample)
        };
        let game, owner, canvas, rect, effectTile, blend, effectHolder, color = 0xff0000;
        function layout() {
          const { width, height } = game.screen;
          rect.graphics.clear();
          rect.graphics.beginFill(color).drawRect(width * .05, height * .05, width * .4, height * .4).endFill();
          effectTile.graphics.clear();
          effectTile.graphics.beginFill(0xffffff).drawRect(width * .55, height * .05, width * .3, height * .4).endFill();
          blend.graphics.clear();
          blend.graphics.beginFill(0x0000ff).drawRect(width * .55, height * .55, width * .3, height * .2).endFill();
          blend.graphics.beginFill(0xff0000, .5).drawRect(width * .55, height * .55, width * .3, height * .2).endFill();
        }
        function make(browserGame) {
          game = browserGame;
          rect = game.stage.addChild(game.scope.use(new Sprite()));
          effectHolder = game.stage.addChild(game.scope.use(new DisplayObjectContainer()));
          effectTile = effectHolder.addChild(game.scope.use(new Sprite()));
          effectHolder.renderEffect = { colorMatrix: [
            1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0
          ] };
          blend = game.stage.addChild(game.scope.use(new Sprite()));
          game.onScreenChange(layout);
          layout();
        }
        if (mode === 'game') {
          owner = await createBrowserGame({
            ...options, fitTo: holder, canvas: stage, pointer: false, keyboard: false, clearAlpha: 0, autoStart: false
          });
          make(owner);
          canvas = stage;
          game.loop.start();
        } else if (mode === 'play') {
          stage.remove();
          owner = await play({
            ...options, parent: holder, audio: false, transparent: true, setup: p => make(p.browser)
          });
          canvas = owner.canvas;
        } else {
          owner = await createWorld3DOverlay(stage, options);
          canvas = owner.canvas;
          make(owner.game);
        }
        globalThis.probe = {
          paint(next) { color = next; layout(); },
          dispose: () => owner.dispose(),
          report() {
            const status = game.host.getStatus();
            return {
              backing: [canvas.width, canvas.height],
              css: [canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height],
              logical: [game.screen.width, game.screen.height],
              serial: status.lastSerial, pending: status.pendingFrames, refused: game.getFrameUsage().refusedFrames,
              submitted: timings.filter(sample => sample.outcome === 'submitted').length,
              calls: game.host.getFrameDrawCalls(),
              preserveDrawingBuffer: canvas.getContext('webgl2').getContextAttributes().preserveDrawingBuffer
            };
          }
        };
      }, { mode, blendSpace, renderMode });
      async function shot(name, expected, delay = 650) {
        await page.waitForTimeout(delay);
        const report = await page.evaluate(() => globalThis.probe.report());
        const bytes = await page.screenshot({ path: path.join(out, mode + '-' + name + '.png') });
        const img = PNG.sync.read(bytes);
        const pixel = (x, y) => {
          const offset = (Math.floor(y * img.height) * img.width + Math.floor(x * img.width)) * 4;
          return Array.from(img.data.subarray(offset, offset + 4));
        };
        const sample = {
          name, expected, main: pixel(.25, .25), effect: pixel(.7, .25), blended: pixel(.7, .65),
          background: pixel(.9, .9), viewport: page.viewportSize(), ...report
        };
        record.samples.push(sample);
        console.log(JSON.stringify({ mode, ...sample }));
      }
      await shot('portrait-red', [255, 0, 0, 255]);
      await page.setViewportSize({ width: 852, height: 393 });
      await shot('landscape-red', [255, 0, 0, 255], 1000);
      await page.evaluate(() => globalThis.probe.paint(0x00ff00));
      await shot('landscape-green', [0, 255, 0, 255]);
      await page.setViewportSize({ width: 393, height: 852 });
      await shot('portrait-green', [0, 255, 0, 255], 1000);
      await page.evaluate(() => globalThis.probe.paint(0x0000ff));
      await shot('portrait-blue', [0, 0, 255, 255]);
      await page.evaluate(() => globalThis.probe.dispose());
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.closeAllConnections?.();
  await new Promise(done => server.close(done));
  await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipts, null, 2) + '\n');
}
const near = (actual, expected) => actual.every((value, index) => Math.abs(value - expected[index]) <= 3);
assert.equal(receipts.length, 3);
for (const receipt of receipts) {
  assert.deepEqual(receipt.errors, [], receipt.mode + ': browser errors');
  assert.equal(receipt.samples.length, 5);
  for (const sample of receipt.samples) {
    const label = receipt.mode + '/' + sample.name;
    assert.deepEqual(sample.backing, [393, 852], label + ': backing changed');
    assert.deepEqual(sample.logical, [sample.viewport.width, sample.viewport.height], label + ': logical size');
    assert.deepEqual(sample.css, sample.logical, label + ': CSS size');
    assert.ok(near(sample.main, sample.expected), label + ': current frame color');
    assert.ok(near(sample.effect, [255, 255, 0, 255]), label + ': color matrix effect');
    assert.ok(near(sample.background, [18, 52, 86, 255]), label + ': transparent clear');
    assert.ok(near(sample.blended, receipt.blendSpace === 'linear' ? [188, 0, 188, 255] : [128, 0, 127, 255]),
      label + ': color blend space');
    assert.ok(sample.calls >= 4 && sample.refused === 0, label + ': effect/admission');
    assert.equal(sample.preserveDrawingBuffer, receipt.renderMode === 'on-demand', label + ': retention policy');
  }
}
console.log('WebKit stable presentation: 15 screenshots retain orientation-specific UI, color, effects and transparency.');
