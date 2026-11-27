// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { browserAdapterFiles } from '../../../tools/egret-migrate/browser-adapter-files.mjs';

const { values } = parseArgs({
  options: Object.fromEntries(['engine', 'playwright', 'out', 'channel'].map(name => [name, { type: 'string' }]))
});
if (!values.engine || !values.playwright || !values.out)
  throw new Error('Supply --engine <egret2d.mjs> --playwright <module> --out <new directory> [--channel msedge]');
fs.mkdirSync(values.out);
const root = fileURLToPath(new URL('../../../tools/egret-migrate/', import.meta.url));
const files = new Map(browserAdapterFiles().map(name => ['/' + name, path.join(root, name)]));
for (const name of ['board.js', 'host-bindings.mjs', 'pin.png', 'caption.txt', 'palette.bin'])
  files.set('/' + name, path.join(import.meta.dirname, name));
files.set('/engine.mjs', path.resolve(values.engine));
const server = http.createServer((request, response) => {
  if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.end(`<meta charset="utf-8"><style>*{margin:0}canvas{display:block;width:320px;height:180px}</style><canvas></canvas><script type="module">
import * as sdk from './engine.mjs';
import {launchLegacyWeb} from './legacy-web.mjs';
import {provideBindings} from './host-bindings.mjs';
globalThis.game = await launchLegacyWeb(sdk, {
  canvas: document.querySelector('canvas'), width:320,height:180,projectId:'p_layout_demo',provideBindings,theme:{skins:{},exmls:[]},
  async createMain(api) {
    Object.assign(globalThis,api);
    await import('./board.js');
    return globalThis.board = new LayoutBoard();
  }
});
await board.loadResources();
globalThis.started = true;
</script>`);
  }
  const file = files.get(request.url);
  if (!file) return response.writeHead(404).end();
  response.setHeader(
    'Content-Type',
    { '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.bin': 'application/octet-stream' }[
      path.extname(file)
    ] ?? 'text/javascript'
  );
  fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const { chromium } = await import(pathToFileURL(path.resolve(values.playwright)).href);
  browser = await chromium.launch({ channel: values.channel ?? 'msedge', headless: false });
  const page = await browser.newPage({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => globalThis.started);
  const host = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return { backend: game.backend, renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : undefined };
  });
  assert.equal(host.backend, 'webgl2');
  const report = { browser: browser.version(), ...host, states: [] };
  for (const [mode, expected, tiles] of [
    [
      0,
      [255, 0, 255],
      [
        [0, 0],
        [32, 0],
        [64, 0]
      ]
    ],
    [
      1,
      [255, 0, 0],
      [
        [0, 0],
        [0, 19],
        [0, 38]
      ]
    ],
    [
      2,
      [255, 0, 255],
      [
        [0, 0],
        [32, 0],
        [0, 19]
      ]
    ]
  ]) {
    if (mode) await page.mouse.click(220, 130);
    await page.waitForFunction(value => globalThis.layoutObservation.mode === value, mode);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const snapshot = await page.evaluate(() => globalThis.layoutObservation);
    assert.deepEqual(snapshot.tiles, tiles);
    assert.equal(snapshot.boardName, 'north-gate-board');
    assert.deepEqual(snapshot.resources, { width: 2, height: 2, caption: '北门驿站', bytes: [0, 252, 17, 128, 55] });
    if (mode)
      assert.deepEqual(snapshot.trace, [
        [1, 10, 7, true],
        [2, 10, 7, true],
        [3, 10, 7, true]
      ]);
    const png = PNG.sync.read(await page.screenshot({ path: path.join(values.out, 'mode-' + mode + '.png') }));
    const offset = (20 * png.width + 70) * 4;
    const pixel = [...png.data.subarray(offset, offset + 3)];
    assert.deepEqual(pixel, expected);
    if (mode === 0) {
      const ink = { green: 0, orange: 0 };
      for (let y = 67; y < 94; y++)
        for (let x = 11; x < 108; x++) {
          const i = (y * png.width + x) * 4,
            [r, g, b] = png.data.subarray(i, i + 3);
          if (g > 150 && r < 95 && b < 145 && g > r * 1.7) ink.green++;
          if (r > 150 && g > 70 && g < 200 && b < 105 && r > 1.4 * g) ink.orange++;
        }
      assert(ink.green > 15 && ink.orange > 15, JSON.stringify(ink));
      report.glyphPixels = ink;
      await page.mouse.click(66, 78);
      await page.mouse.click(25, 78);
      await page.waitForFunction(() => globalThis.layoutObservation.linkClicks.length === 1);
      report.links = await page.evaluate(() => globalThis.layoutObservation.linkClicks);
      assert.deepEqual(report.links, ['open:gate']);
      assert.equal(snapshot.host.sameStage, true);
      assert.deepEqual([snapshot.host.width, snapshot.host.height], [320, 180]);
    }
    report.states.push({ ...snapshot, pixel });
  }
  await page.mouse.move(105, 125);
  await page.mouse.down();
  await page.mouse.move(27, 105, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(
    () => globalThis.layoutObservation.scrollH > 40 && globalThis.layoutObservation.scrollV === 0
  );
  report.scroll = await page.evaluate(() => globalThis.layoutObservation.scrollH);
  await page.mouse.move(137, 150);
  await page.mouse.down();
  await page.mouse.move(77, 150, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(previous => globalThis.layoutObservation.scrollH > previous + 35, report.scroll);
  report.fromBlank = await page.evaluate(() => globalThis.layoutObservation.scrollH);
  await page.evaluate(() => game.dispose());
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(values.out, 'receipt.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  server.close();
}
