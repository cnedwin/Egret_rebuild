// SPDX-License-Identifier: Apache-2.0
// Actual browser pixels and readiness, with an isolated native UI (no game assets).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { createExampleServer } from '../../tools/serve-example.mjs';

const [playwrightFile, output, executablePath] = process.argv.slice(2);
assert.ok([playwrightFile, output, executablePath].every(value => value && path.isAbsolute(value)));
const { chromium } = await import(pathToFileURL(playwrightFile).href);
const imports = JSON.parse(
  fs
    .readFileSync(new URL('index.html', import.meta.url), 'utf8')
    .match(/<script type="importmap">([\s\S]*?)<\/script>/u)[1]
).imports;
const html =
  '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">' +
  '<script type="importmap">' +
  JSON.stringify({ imports }) +
  '</script>' +
  '<body style="margin:0"><canvas style="display:block;width:640px;height:360px"></canvas></body>';
fs.mkdirSync(output);
const report = { backend: 'SwiftShader WebGL2', ratios: [] };
const server = createExampleServer();
let browser;
function compareInk(image, a, b) {
  const width = Math.floor(Math.min(a.width, b.width));
  const height = Math.floor(Math.min(a.height, b.height));
  let aInk = 0,
    bInk = 0,
    differences = 0;
  const isInk = (x, y) => image.data[(y * image.width + x) * 4] < 200;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const left = isInk(Math.round(a.x) + x, Math.round(a.y) + y);
      const right = isInk(Math.round(b.x) + x, Math.round(b.y) + y);
      aInk += Number(left);
      bInk += Number(right);
      differences += Number(left !== right);
    }
  return { aInk, bInk, differences };
}
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    executablePath,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server']
  });
  report.browser = browser.version();
  for (const ratio of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const result = { ratio, errors, passed: false };
    report.ratios.push(result);
    try {
      await page.route(origin + '/native-text', route =>
        route.fulfill({ contentType: 'text/html; charset=utf-8', body: html })
      );
      await page.goto(origin + '/native-text');
      const data = await page.evaluate(async ratio => {
        const { play } = await import('@egret/engine/play');
        const game = await play({
          canvas: document.querySelector('canvas'),
          width: 640,
          height: 360,
          background: 0xf7f0eb,
          backend: 'webgl2',
          pixelRatio: ratio,
          audio: false,
          blendSpace: 'linear'
        });
        const rows = [
          ['odd16a', 'Tap inside the bright band to focus', 16, 23, 16],
          ['even16a', 'Tap inside the bright band to focus', 16, 24, 52],
          ['odd16b', 'Nobody you know is here right now.', 16, 23, 88],
          ['even16b', 'Nobody you know is here right now.', 16, 24, 124],
          ['even14', 'Fitness +3 · Energy −22', 14, 20, 160],
          ['odd14', 'Fitness +3 · Energy −22', 14, 21, 196],
          ['odd18zh', '山水江南 · 選修課', 18, 23, 232],
          ['even18zh', '山水江南 · 選修課', 18, 24, 268]
        ];
        const state = { words: 'one' };
        const view = game.show({
          root: {
            type: 'panel',
            width: 640,
            height: 360,
            children: rows.map(([name, words, size, height, y]) => ({
              type: 'text',
              name,
              text: words,
              size,
              height,
              x: 120,
              y,
              width: 500,
              color: 0x4d485b,
              align: 'left'
            }))
          }
        });
        const deadline = task =>
          Promise.race([
            task,
            new Promise((_, fail) => setTimeout(() => fail(new Error('Text readiness timed out')), 10000))
          ]);
        const nextFrame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const expectAbort = promise =>
          deadline(
            promise.then(
              () => 'resolved',
              error => error.name
            )
          );
        // Exposure through a declarative named text is per short label, not whole-view ready.
        await deadline(Promise.all(rows.map(([name]) => view.textReady(name))));
        await nextFrame();
        const position = text => {
          const label = text.getChildAt(0),
            bitmap = label.getChildAt(0);
          return { ...bitmap.localToGlobal(0, 0), width: bitmap.width, height: bitmap.height, visible: label.visible };
        };
        const aligned = Object.fromEntries(rows.map(([name]) => [name, position(view.get(name).getChildAt(0))]));
        const direct = game.text('one', {
          x: 16.5,
          y: 310.5,
          size: 16,
          baseline: 'middle',
          color: 0x4d485b,
          fontFamily: 'Arial',
          fontWeight: 650,
          italic: true
        });
        const one = direct.ready;
        direct.text = 'two';
        const two = direct.ready;
        direct.text = 'latest';
        const latest = direct.ready;
        const pendingOld = [one !== two, two !== latest, await expectAbort(one), await expectAbort(two)];
        await deadline(latest);
        const latestPosition = position(direct);
        direct.color = 0x335588;
        const recolored = direct.ready;
        direct.size = 18;
        const resized = direct.ready;
        const styled = [latest !== recolored, recolored !== resized, await expectAbort(recolored)];
        await deadline(resized);
        direct.visible = false;
        await nextFrame();
        const hidden = await expectAbort(direct.ready);
        direct.visible = true;
        await nextFrame();
        await deadline(direct.ready);
        const revealed = position(direct);
        const remove = game.text('dispose', { x: 300, y: 330 });
        const removed = remove.ready;
        remove.dispose();
        const disposed = await expectAbort(removed);
        const parent = game.sprite(undefined, game.ui);
        parent.x = 400.25;
        parent.y = 305.25;
        parent.scaleX = 1.25;
        parent.scaleY = 0.8;
        const translated = game.text('移动', { layer: parent, color: 0x4d485b, size: 16 });
        await deadline(translated.ready);
        const transformed = position(translated);
        parent.y -= 0.4;
        await nextFrame();
        const scrolled = position(translated);
        const world = game.text('world', { layer: 'world', x: 0.5, y: 0.5, size: 16, color: 0x4d485b });
        await deadline(world.ready);
        const worldPosition = position(world);
        world.visible = false;
        translated.visible = false;
        direct.visible = false;
        await nextFrame();
        return {
          ratio,
          canvas: { width: game.canvas.width, height: game.canvas.height },
          aligned,
          rects: rows.map(([name]) => [name, view.rect(name)]),
          pendingOld,
          latestPosition,
          styled,
          hidden,
          revealed,
          disposed,
          transformed,
          scrolled,
          worldPosition,
          atlas: game.browser.getLabelStatus()
        };
      }, ratio);
      const shot = await page.screenshot({ path: path.join(output, 'ratio-' + ratio + '.png') });
      const image = PNG.sync.read(shot);
      result.data = data;
      assert.equal(data.canvas.width, ratio * 640);
      assert.equal(data.canvas.height, ratio * 360);
      assert.deepEqual(data.pendingOld, [true, true, 'AbortError', 'AbortError']);
      assert.deepEqual(data.styled, [true, true, 'AbortError']);
      assert.equal(data.hidden, 'AbortError');
      assert.equal(data.disposed, 'AbortError');
      assert.equal(data.latestPosition.visible, true);
      assert.equal(data.revealed.visible, true);
      const onGrid = value => Math.abs(value * ratio - Math.round(value * ratio)) < 1e-6;
      for (const at of [...Object.values(data.aligned), data.transformed, data.scrolled, data.revealed]) {
        assert.ok(onGrid(at.x) && onGrid(at.y), JSON.stringify(at));
      }
      if (ratio === 1) assert.ok(!onGrid(data.worldPosition.x) || !onGrid(data.worldPosition.y));
      if (ratio === 1) {
        result.pixels = [
          compareInk(image, data.aligned.odd16a, data.aligned.even16a),
          compareInk(image, data.aligned.odd16b, data.aligned.even16b),
          compareInk(image, data.aligned.odd14, data.aligned.even14),
          compareInk(image, data.aligned.odd18zh, data.aligned.even18zh)
        ];
        for (const pair of result.pixels)
          assert.ok(pair.aInk > 50 && pair.bInk > 50 && pair.differences / pair.aInk < 0.08, JSON.stringify(pair));
      }
      assert.deepEqual(errors, []);
      result.passed = true;
    } catch (error) {
      result.failure = String(error);
      await page.screenshot({ path: path.join(output, 'failure-' + ratio + '.png') }).catch(() => {});
    } finally {
      await page.close();
    }
  }
  const failurePage = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const creation = { passed: false };
  report.creationFailure = creation;
  try {
    let blocked = 0;
    await failurePage.route('**/packages/engine/dist/web/text.js', route => {
      blocked++;
      return route.abort();
    });
    await failurePage.route(origin + '/native-text', route =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html })
    );
    await failurePage.goto(origin + '/native-text');
    creation.data = await failurePage.evaluate(async () => {
      const { play } = await import('@egret/engine/play');
      const game = await play({
        canvas: document.querySelector('canvas'),
        width: 640,
        height: 360,
        audio: false,
        backend: 'webgl2'
      });
      const text = game.text('first');
      const result = async ready =>
        Promise.race([
          ready.then(
            () => ({ resolved: true }),
            cause => ({ cause })
          ),
          new Promise(done => setTimeout(() => done({ timedOut: true }), 1000))
        ]);
      const first = await result(text.ready);
      text.text = 'next';
      const words = await result(text.ready);
      text.color = 0x445566;
      const color = await result(text.ready);
      text.size = 18;
      const size = await result(text.ready);
      return {
        firstRejected: !!first.cause,
        sameCause: [words.cause, color.cause, size.cause].map(cause => !!cause && cause === first.cause),
        timedOut: [words, color, size].some(value => value.timedOut === true)
      };
    });
    assert.equal(blocked, 1);
    assert.deepEqual(creation.data, { firstRejected: true, sameCause: [true, true, true], timedOut: false });
    creation.passed = true;
  } catch (error) {
    creation.failure = String(error);
  } finally {
    await failurePage.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
if (!report.ratios.length || report.ratios.some(entry => !entry.passed) || !report.creationFailure?.passed)
  process.exitCode = 1;
