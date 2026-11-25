// SPDX-License-Identifier: Apache-2.0
// Exports the probe of this folder as a WeChat mini game and runs it in the stand-in of tools/wechat/check-minigame.mjs,
// whose GameGlobal holds only wx, the console, timers and frames, and whose game sees no name a mini game lacks. Each
// step of the probe is called and what it reports is checked, with the screen read where the words should be.
//
//   node examples/minigame/verify.mjs <absolute Playwright index.mjs> <absolute esbuild folder> <new output folder>
//
// It is not WeChat: WeChat's own JavaScript engine, its canvas and its keyboard are met only on a phone or in WeChat
// DevTools, and neither is run here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exportWechat } from '../../tools/wechat/export-wechat.mjs';
import { standInPage } from '../../tools/wechat/check-minigame.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [playwrightPath, esbuildPath, outArg] = process.argv.slice(2);
if (!playwrightPath || !esbuildPath || !outArg)
  throw new Error(
    'Usage: node examples/minigame/verify.mjs <Playwright index.mjs> <esbuild folder> <new output folder>'
  );
const out = path.resolve(outArg),
  folder = path.join(out, 'package');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const esbuild = createRequire(path.join(path.resolve(esbuildPath), 'package.json'))(path.resolve(esbuildPath));
const { PNG } = createRequire(import.meta.url)('pngjs');

const exported = await exportWechat({ esbuild, gameDir: here, out: folder, minify: false });
const W = 390,
  H = 844,
  RATIO = 2;
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const url = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return response.end(standInPage({ width: W, height: H, ratio: RATIO }));
  }
  const file = path.resolve(folder, url.replace(/^\/pkg\//, ''));
  if (!url.startsWith('/pkg/') || !file.startsWith(folder) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
const report = { package: exported.report?.totalBytes ?? null, steps: {} };
const problems = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on(
    'console',
    message => message.type() === 'error' && problems.push('console: ' + message.text().slice(0, 400))
  );
  page.on('pageerror', error => problems.push('pageerror: ' + error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => GameGlobal.__probe?.ready === true || window.__failed, null, { timeout: 60_000 });
  assert.equal(await page.evaluate(() => window.__failed ?? null), null, 'the game started');
  const step = async (name, check) => {
    const seen = await page.evaluate(n => GameGlobal.__probe[n](), name);
    await page.waitForTimeout(300);
    report.steps[name] = await check(seen);
    assert.deepEqual(problems, [], name + ' said nothing on the console');
    assert.equal(await page.evaluate(() => window.__failed ?? null), null, name + ' did not stop the game');
  };
  // The screen as a picture: the colour at a point in CSS pixels of the screen.
  let shots = 0;
  const picture = async () => {
    const shot = await page.locator('#screen').screenshot({ scale: 'device' });
    fs.writeFileSync(path.join(out, 'screen-' + ++shots + '.png'), shot);
    return PNG.sync.read(shot);
  };
  // Bands of rows holding white: each a line of words.
  const lines = png => {
    const bands = [];
    let inBand = false;
    for (let y = 0; y < png.height; y++) {
      let count = 0;
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4;
        if (png.data[i] > 200 && png.data[i + 1] > 200 && png.data[i + 2] > 200) count++;
      }
      if (count > 3 && !inBand) bands.push({ top: y, bottom: y, most: count });
      else if (count > 3) {
        bands.at(-1).bottom = y;
        bands.at(-1).most = Math.max(bands.at(-1).most, count);
      }
      inBand = count > 3;
    }
    return bands.filter(band => band.bottom - band.top >= 4);
  };

  // Labels: the engine's words drawn on a canvas, with no CanvasRenderingContext2D among the game's names.
  await step('labels', async seen => {
    assert.equal(seen.made, 3);
    const bands = lines(await picture());
    assert.equal(bands.length, 3, 'three lines of white words: ' + JSON.stringify(bands));
    return { lines: bands.map(band => [band.top, band.bottom]) };
  });
  // A paragraph laid out with no WebAssembly: the canvas provider is chosen, its lines fill the screen where the
  // paragraph sits, and a hit inside a word of it finds that word's letter.
  await step('paragraph', async seen => {
    assert.equal(seen.backend, 'canvas');
    assert.equal(seen.reason, 'no-webassembly');
    assert.ok(seen.lines.length >= 3, 'the paragraph wraps: ' + JSON.stringify(seen.lines));
    assert.equal(
      seen.lines.join(''),
      '洗冤笔录·第一案：河边发现一具男尸，衣着整齐，袖口未湿。The ferryman saw a lantern at midnight.'
    );
    assert.equal(seen.word.hit, seen.word.expected, 'the hit finds the place before the letter under it');
    assert.equal(seen.word.rects.length, 1, 'the word is selected in one box');
    // Below the three labels of the first step, a band of white for each line of the paragraph.
    const png = await picture();
    const band = lines(png).slice(3);
    assert.equal(band.length, seen.lines.length, 'a band of white for each line: ' + JSON.stringify(band));
    return { backend: seen.backend, reason: seen.reason, lines: seen.lines, bands: band.map(b => [b.top, b.bottom]) };
  });
  // The page's text field shows no keyboard in a mini game: it is refused or opens with nothing to type into.
  await step('browserTextInput', async seen => {
    const calls = await page.evaluate(() => window.__wxCalls);
    assert.equal(calls.showKeyboard ?? 0, 0, 'no keyboard was asked for');
    return seen;
  });
  // Text input through the keyboard of the stand-in's wx: open, type, confirm; close; cancel. The words committed are
  // drawn by a label below the paragraph.
  const keyboard = (action, ...args) => page.evaluate(([a, rest]) => window.__keyboard[a](...rest), [action, args]);
  const typedSoFar = () => page.evaluate(() => GameGlobal.__probe.typed.slice());
  await step('textInput', async seen => {
    assert.equal(seen.state, 'open');
    const shown = await keyboard('state');
    assert.deepEqual(shown, { value: '', maxLength: 65536, multiple: false, confirmHold: true, confirmType: 'done' });
    await keyboard('type', '仵作');
    await keyboard('type', '验尸');
    await keyboard('confirm');
    await page.waitForTimeout(400);
    assert.deepEqual(await typedSoFar(), [
      ['change', '仵作'],
      ['change', '仵作验尸'],
      ['commit', '仵作验尸']
    ]);
    assert.equal(await keyboard('state'), null, 'the keyboard is closed after the confirm key');
    assert.equal((await page.evaluate(() => GameGlobal.__probe.textInputSnapshot())).state, 'idle');
    const png = await picture();
    const expected = 3 + report.steps.paragraph.lines.length + 1;
    assert.equal(lines(png).length, expected, 'the committed words drawn below the paragraph');
    return { typed: await typedSoFar() };
  });
  // A keyboard the player closes commits what was typed; a session the game cancels tells onCancel and closes it; the
  // limit is kept in characters.
  report.steps.textInputEnds = await (async () => {
    const before = (await typedSoFar()).length;
    await page.evaluate(() => GameGlobal.__probe.textInput({ maxLength: 3 }));
    await keyboard('type', '河边发现');
    await keyboard('close');
    await page.evaluate(() => GameGlobal.__probe.textInput({ value: '袖口', blur: 'cancel' }));
    assert.equal((await keyboard('state')).value, '袖口');
    const cancelled = await page.evaluate(() => GameGlobal.__probe.cancelTextInput());
    await page.waitForTimeout(300);
    const told = (await typedSoFar()).slice(before);
    assert.deepEqual(told, [['change', '河边发'], ['commit', '河边发'], ['cancel']]);
    assert.equal(cancelled.state, 'idle');
    assert.equal(await keyboard('state'), null);
    const calls = await page.evaluate(() => window.__wxCalls);
    assert.ok(calls.showKeyboard === 3 && calls.hideKeyboard === 2, JSON.stringify(calls));
    assert.deepEqual(problems, []);
    return { told, calls: { showKeyboard: calls.showKeyboard, hideKeyboard: calls.hideKeyboard } };
  })();
  report.ok = true;
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...report, problems }, null, 2));
}
console.log(JSON.stringify(report, null, 2));
