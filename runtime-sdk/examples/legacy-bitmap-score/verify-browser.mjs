// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { browserAdapterFiles } from '../../../tools/egret-migrate/browser-adapter-files.mjs';
const { values } = parseArgs({
  options: Object.fromEntries(['engine', 'playwright', 'out', 'channel'].map(name => [name, { type: 'string' }]))
});
if (!values.engine || !values.playwright || !values.out)
  throw new TypeError('Supply --engine <font-enabled egret2d.mjs> --playwright <module> --out <new directory>.');
fs.mkdirSync(values.out);
const root = fileURLToPath(new URL('../../../tools/egret-migrate/', import.meta.url));
const routes = new Map(browserAdapterFiles().map(key => ['/' + key, path.join(root, key)]));
for (const key of ['score.js', 'digits.png', 'score.fnt', 'profile.mjs'])
  routes.set('/' + key, path.join(import.meta.dirname, key));
routes.set('/engine.mjs', path.resolve(values.engine));
const server = http.createServer((req, res) => {
  if (req.url === '/')
    return res
      .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(`<style>*{margin:0}canvas{display:block;width:160px;height:90px}</style><canvas></canvas><script type="module">
import * as sdk from './engine.mjs'; import {scoreProfile} from './profile.mjs'; import {launchLegacyWeb} from './legacy-web.mjs';
window.game=await launchLegacyWeb(sdk,{...scoreProfile,canvas:document.querySelector('canvas'),async createMain(api){Object.assign(window,api);await import('./score.js');return window.board=new ScoreBoard();}});
await board.start();</script>`);
  const file = routes.get(req.url);
  if (!file) return res.writeHead(404).end();
  res.setHeader(
    'Content-Type',
    path.extname(file) === '.png' ? 'image/png' : path.extname(file) === '.fnt' ? 'application/json' : 'text/javascript'
  );
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  const { chromium } = await import(pathToFileURL(path.resolve(values.playwright)).href);
  browser = await chromium.launch({ channel: values.channel ?? 'msedge', headless: false });
  const page = await browser.newPage({ viewport: { width: 160, height: 90 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => {
    errors.push(String(error));
    console.error(String(error));
  });
  await page.goto('http://127.0.0.1:' + server.address().port);
  const states = [];
  for (const [index, phase] of [1, 2, 1].entries()) {
    if (index) await page.mouse.click(114, 65);
    await page.waitForFunction(wanted => window.scoreObservation?.phase === wanted, phase, { timeout: 5000 });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const row = await page.evaluate(() => window.scoreObservation);
    const im = PNG.sync.read(await page.screenshot({ path: path.join(values.out, index + '.png') }));
    const samples = [
      [16, 15],
      [28, 19],
      [35, 19],
      [22, 43],
      [72, 43]
    ].map(([x, y]) => [...im.data.subarray((y * im.width + x) * 4, (y * im.width + x) * 4 + 3)]);
    const bg = [24, 48, 72],
      red = [245, 45, 55],
      blue = [45, 100, 245],
      green = [48, 224, 144];
    assert.deepEqual(samples, phase === 1 ? [red, blue, bg, green, bg] : [bg, bg, bg, bg, green]);
    assert.deepEqual(row.measured, phase === 1 ? [8,5] : [0,0]);
    states.push({ ...row, samples });
  }
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
  });
  await page.evaluate(() => game.dispose());
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(values.out, 'receipt.json'),
    JSON.stringify({ states, browser: browser.version(), backend: 'webgl2', gpu }, null, 2)
  );
} finally {
  await browser?.close();
  server.close();
}
