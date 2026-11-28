// SPDX-License-Identifier: Apache-2.0
// Actual WebKit screenshot regression; unlike a submission receipt, a screenshot proves the presented pixels.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { createExampleServer } from '../tools/serve-example.mjs';

const [playwright, out] = process.argv.slice(2);
if (!playwright || !out || !path.isAbsolute(playwright))
  throw new Error('Usage: node tests/webkit-on-demand-browser.mjs <absolute Playwright index.mjs> <receipt directory>');
const root = fileURLToPath(new URL('..', import.meta.url));
const example = await fs.readFile(path.join(root, 'examples/play/index.html'), 'utf8');
const imports = JSON.parse(example.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
imports.imports['@egret/engine/web/game'] = '/packages/engine/dist/web/game.js';
const overlayExample = await fs.readFile(path.join(root, 'examples/world3d/overlay.html'), 'utf8');
Object.assign(imports.imports, JSON.parse(overlayExample.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports);
const html =
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' +
  '<style>body{margin:0;background:#123456}#place{position:relative;width:120px;height:80px}canvas{display:block;width:120px;height:80px}</style>' +
  '<script type="importmap">' + JSON.stringify(imports) + '</script>' +
  '<div id="place"><canvas id="stage"></canvas></div>';
const { webkit, devices } = await import(pathToFileURL(playwright));
await fs.mkdir(out, { recursive: true });
const server = createExampleServer(root);
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port + '/fixture';
const receipt = [];
let browser;
try {
  browser = await webkit.launch({ headless: true });
  for (const mode of ['game', 'play', 'overlay']) {
    const page = await browser.newPage(devices['iPhone 15 Pro']);
    const errors = [], samples = [], record = { mode, samples, errors };
    receipt.push(record);
    try {
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(url);
      await page.evaluate(async mode => {
        const { createBrowserGame } = await import('@egret/engine/web/game');
        const { Sprite, Bitmap } = await import('@egret/engine');
        const { play } = await import('@egret/engine/play');
        const { createWorld3DOverlay } = await import('@egret/engine/webgl2/world3d');
        const canvas = document.querySelector('#stage'), timings = [], renderMode = 'on-demand';
        const options = {
          width: 120, height: 80, pixelRatio: 1, backend: 'webgl2', renderMode,
          onFrameTiming: sample => timings.push(sample)
        };
        let game, owner, presentedCanvas, rect;
        const paint = color => {
          rect.graphics.clear();
          rect.graphics.beginFill(color).drawRect(0, 0, 120, 80).endFill();
        };
        const make = browserGame => {
          rect = browserGame.stage.addChild(browserGame.scope.use(new Sprite()));
          paint(0xff0000);
        };
        if (mode === 'game') {
          owner = game = await createBrowserGame({ ...options, canvas, pointer: false, keyboard: false, autoStart: false });
          presentedCanvas = canvas;
          make(game);
          game.loop.start();
        } else if (mode === 'play') {
          owner = await play({ ...options, canvas, audio: false, setup: playGame => make(playGame.browser) });
          game = owner.browser;
          presentedCanvas = canvas;
        } else {
          owner = await createWorld3DOverlay(canvas, { ...options, fit: 'stretch' });
          game = owner.game;
          presentedCanvas = owner.canvas;
          make(game);
        }
        globalThis.fixture = {
          paint,
          async texture() {
            // A real awaited image lease modifies the display tree; no explicit invalidate or second submit.
            const pixels = new Uint8Array(16 * 4);
            for (let index = 0; index < 16; index++) pixels.set([0, 0, 255, 255], index * 4);
            const lease = await game.textureFromPixels(4, 4, pixels);
            const image = game.stage.addChild(game.scope.use(new Bitmap(lease)));
            image.scaleX = 30;
            image.scaleY = 20;
          },
          report() {
            const status = game.host.getStatus();
            return {
              submitted: timings.filter(sample => sample.outcome === 'submitted').length,
              retained: timings.filter(sample => sample.outcome === 'retained').length,
              serial: status.lastSerial, pending: status.pendingFrames,
              refused: game.getFrameUsage().refusedFrames,
              preserveDrawingBuffer: presentedCanvas.getContext('webgl2').getContextAttributes().preserveDrawingBuffer
            };
          },
          dispose: () => owner.dispose()
        };
      }, mode);
      async function shot(name, delay) {
        await page.waitForTimeout(delay);
        const status = await page.evaluate(() => globalThis.fixture.report());
        const bytes = await page.screenshot({ path: path.join(out, mode + '-' + name + '.png') });
        const image = PNG.sync.read(bytes), ratio = image.width / page.viewportSize().width;
        const at = (Math.round(40 * ratio) * image.width + Math.round(60 * ratio)) * 4;
        const sample = { name, pixel: Array.from(image.data.subarray(at, at + 4)), ...status };
        samples.push(sample);
        console.log(JSON.stringify({ mode, ...sample }));
        return sample;
      }
      const red = await shot('first-red', 500);
      await page.evaluate(() => globalThis.fixture.paint(0x00ff00));
      const green = await shot('new-green', 500);
      const greenIdle = await shot('idle-green', 900);
      await page.evaluate(() => globalThis.fixture.texture());
      const blue = await shot('late-blue', 500);
      const blueIdle = await shot('idle-blue', 900);
      // Leave complete receipts/screenshots even when an old engine fails the pixel oracle.
      await page.evaluate(() => globalThis.fixture.dispose());
      record.checks = [
        [red, [255, 0, 0, 255]], [green, [0, 255, 0, 255]], [greenIdle, [0, 255, 0, 255]],
        [blue, [0, 0, 255, 255]], [blueIdle, [0, 0, 255, 255]]
      ].map(([sample, expected]) => ({
        name: sample.name, expected, correct: sample.pixel.every((value, index) => value === expected[index])
      }));
      record.idleWithoutSubmit = green.serial === greenIdle.serial && green.submitted === greenIdle.submitted &&
        blue.serial === blueIdle.serial && blue.submitted === blueIdle.submitted;
      record.noRefusals = samples.every(sample => sample.pending === 0 && sample.refused === 0);
      record.bufferRetained = samples.every(sample => sample.preserveDrawingBuffer);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.closeAllConnections?.();
  await new Promise(done => server.close(done));
  await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}
assert.equal(receipt.length, 3);
for (const record of receipt) {
  assert.deepEqual(record.errors, [], record.mode + ': browser errors');
  assert.ok(record.checks.every(check => check.correct), record.mode + ': stale presented pixels');
  assert.ok(record.idleWithoutSubmit, record.mode + ': idle submitted another frame');
  assert.ok(record.noRefusals, record.mode + ': frame admission/refusal');
  assert.ok(record.bufferRetained, record.mode + ': native retained buffer not selected');
}
console.log('WebKit presented all three on-demand surfaces without repetitive submission.');
