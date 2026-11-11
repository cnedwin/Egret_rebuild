// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintFile, ownerRelativePath } from './lib/file-identity.mjs';
import { createExampleServer } from './serve-example.mjs';

const [playwright, output, ...extra] = process.argv.slice(2);
assert.ok(playwright && output && extra.length === 0, 'Usage: node tools/verify-webgl2-layer-light.mjs <playwright-root> <new-output-directory>');
const repository = path.resolve(import.meta.dirname, '..');
const { chromium } = await import(pathToFileURL(path.join(playwright, 'index.mjs')));
const playwrightVersion = JSON.parse(fs.readFileSync(path.join(playwright, 'package.json'), 'utf8')).version;
assert.equal(playwrightVersion, '1.62.1');
fs.mkdirSync(output);
const server = createExampleServer(repository);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = 'http://127.0.0.1:' + server.address().port;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const served = new Map();
const faults = [];
server.on('request', (request, response) => {
  response.on('finish', () => {
    if (response.statusCode !== 200) return;
    const logical = new URL(request.url, base).pathname.slice(1);
    const physical = logical.startsWith('vendor/robust-predicates/')
      ? 'packages/engine/node_modules/robust-predicates/' + logical.slice('vendor/robust-predicates/'.length)
      : logical;
    try {
      const relative = ownerRelativePath(repository, fs.realpathSync(path.join(repository, physical)));
      const pin = fingerprintFile(repository, relative);
      if (served.has(relative)) assert.deepEqual(pin, served.get(relative));
      else served.set(relative, pin);
    } catch (error) { faults.push(String(error)); }
  });
});

async function observe(ratio) {
  const egret = await import('@egret/engine');
  const { createSharedWebGL2Host } = await import('@egret/engine/webgl2');
  const canvas = document.querySelector('canvas');
  const host = createSharedWebGL2Host({ canvas, pixelRatio: ratio, enableReadback: true, enableEffects: true });
  const engine = await egret.createEngineForProfile({ host }, 'egret.shared-frame2d/1');
  const scope = engine.createScope();
  try {
    const type = egret.createAssetType('scene-light-procedural', egret.isTexture);
    engine.assets.register(type, {
      async load() {
        const pixels = new Uint8Array(3 * 3 * 4);
        for (let index = 0; index < 9; index++) {
          pixels.set([128, 128, 128, [255, 128, 0][Math.floor(index / 3)]], index * 4);
        }
        return egret.createTexture(egret.createImageData2D({ width: 3, height: 3, pixels }));
      },
      dispose(texture) { texture.dispose(); },
    });
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'tile')));
    const sprite = scope.use(new egret.Bitmap(lease));
    engine.stage.addChild(sprite);
    const source = engine.captureSharedFrame({ width: 3, height: 3 });
    engine.stage.removeChild(sprite);

    const overlay = scope.use(new egret.Sprite());
    overlay.graphics.beginFill(0x00ff00).drawRect(4, 2, 2, 1).endFill();
    engine.stage.addChild(overlay);
    const frame = engine.captureSharedFrame({ width: 12, height: 8 });
    const layers = [host.createSharedLayer2D(), host.createSharedLayer2D()];
    for (const layer of layers) await layer.update(source);

    const light = {
      bounds: { x: 3.25, y: 1.75, width: 3.5, height: 3.5 },
      multiply: [0, 1, 0],
      add: [0.25, 0, 1],
    };
    const stats = () => ({
      residentBytes: host.getSharedLayerStatus().residentBytes,
      uploads: host.getSharedStatus().resources.totals.pageWriteCalls,
    });
    function placements(variant, custom) {
      const moved = variant === 'moved';
      const shiftX = moved ? 1 : 0;
      const shiftY = moved ? -1 : 0;
      const effect = variant === 'unlit' ? undefined : custom ?? {
        ...light, bounds: { ...light.bounds, x: light.bounds.x + shiftX, y: light.bounds.y + shiftY },
      };
      return layers.map((layer, index) => ({
        layer, x: 2 + index * 3 + shiftX, y: 2 + shiftY, width: 3, height: 3,
        ...(effect ? { effect } : {}),
      }));
    }
    async function draw(variant, target = frame, custom) {
      const readback = host.requestReadback();
      void readback.catch(() => {});
      host.renderSharedFrameWithLayers(target, placements(variant, custom));
      const { width, height, bytes } = await readback;
      await host.whenIdle();
      return { width, height, bytes: [...bytes] };
    }

    const before = stats();
    const unlit = await draw('unlit');
    const lit = await draw('lit');
    const moved = await draw('moved');
    const reset = await draw('unlit');
    const fractional = engine.captureSharedFrame({ width: 7.1, height: 3.1 });
    const fractionalBase = await draw('unlit', fractional);
    const fractionalLit = await draw('lit', fractional, { ...light, bounds: { x: -1, y: -1, width: 13, height: 13 } });
    const after = stats();
    const rejections = [
      { ...light, bounds: { ...light.bounds, x: NaN } },
      { ...light, bounds: { ...light.bounds, width: -1 } },
      { ...light, multiply: [0, 1] },
      { ...light, add: [0, -0.1, 0] },
      { ...light, multiply: [Infinity, 1, 1] },
    ].map(effect => {
      const serial = host.getStatus().lastSerial;
      try { host.renderSharedFrameWithLayers(frame, placements('lit', effect)); }
      catch (error) { return { code: error.code, serialStable: host.getStatus().lastSerial === serial }; }
      return { code: null, serialStable: host.getStatus().lastSerial === serial };
    });
    await host.whenIdle();

    const generationBefore = host.getStatus().generation;
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw Error('WEBGL_lose_context unavailable');
    const loss = new Promise(resolve => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    extension.loseContext();
    await loss;
    const lost = layers.map(layer => layer.state);
    await new Promise(resolve => setTimeout(resolve, 100));
    extension.restoreContext();
    await host.whenReady();
    const generationAfter = host.getStatus().generation;
    for (const layer of layers) await layer.update(source);
    const rebuilt = await draw('lit');
    for (const layer of layers) layer.dispose();
    return {
      devicePixelRatio, before, after, unlit, lit, moved, reset, fractionalBase, fractionalLit, rejections, lost, rebuilt,
      generationBefore, generationAfter, disposed: stats(),
    };
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}

const html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Shared layer cache</title>'
  + '<script type="importmap">' + JSON.stringify({ imports: {
    '@egret/engine': '/packages/engine/dist/index.js',
    '@egret/engine/webgl2': '/packages/engine/dist/web/webgl2.js',
    '@egret/contracts': '/packages/contracts/dist/index.js',
    '@egret/contracts/resources': '/packages/contracts/dist/resources/index.js',
    '@egret/runtime': '/packages/runtime/dist/index.js',
    '@egret/runtime/text': '/packages/runtime/dist/text/index.js',
    '@egret/runtime/ui': '/packages/runtime/dist/ui/index.js',
    '@egret/runtime/input': '/packages/runtime/dist/input/index.js',
    '@egret/runtime/paragraph': '/packages/runtime/dist/paragraph/index.js',
    '#egret-textured-frame-state': '/packages/engine/dist/internal/texturedFrameState.js',
    '#egret-pointer-input': '/packages/engine/dist/pointerInput.js',
    'robust-predicates': '/vendor/robust-predicates/index.js',
  } }) + '</script><canvas width="24" height="20"></canvas></html>';
const report = {
  status: 'INCOMPLETE', started: new Date().toISOString(), node: process.version, playwrightVersion,
  channel: 'msedge', headless: true, extraFlags: [], executionInputs: ['tools/verify-webgl2-layer-light.mjs', 'tools/serve-example.mjs', 'tools/lib/file-identity.mjs']
    .map(file => fingerprintFile(repository, file)), ratios: [],
};
function near(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, message);
  assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance),
    message + ' expected ' + expected + ' actual ' + actual);
}
function srgb(value) {
  return Math.round(255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055));
}
function oracle(frame, original, ratio, moved) {
  const xShift = moved ? 1 : 0, yShift = moved ? -1 : 0;
  const values = { effectPixels: 0, unchangedPixels: 0, uiPixels: 0, transparentPixels: 0 };
  for (let pixelY = 0; pixelY < frame.height; pixelY++) for (let pixelX = 0; pixelX < frame.width; pixelX++) {
    const x = (pixelX + 0.5) / ratio, y = (pixelY + 0.5) / ratio;
    const offset = 4 * (pixelY * frame.width + pixelX);
    const pixel = frame.bytes.slice(offset, offset + 4);
    const inUi = x >= 4 && x < 6 && y >= 2 && y < 3;
    const ground = x >= 2 + xShift && x < 8 + xShift && y >= 2 + yShift && y < 5 + yShift;
    const inLight = x >= 3.25 + xShift && x < 6.75 + xShift && y >= 1.75 + yShift && y < 5.25 + yShift;
    const alpha = ground ? [255, 128, 0][Math.floor(y - 2 - yShift)] : 0;
    const label = 'DPR ' + ratio + ' at logical ' + x + ',' + y;
    if (inUi) {
      values.uiPixels++;
      near(pixel, [0, 255, 0, 255], 0, label + ' UI must be untouched');
    } else if (alpha === 0) {
      values.transparentPixels++;
      near(pixel, [0, 0, 0, 0], 0, label + ' additive light must not create opaque pixels');
    } else if (inLight) {
      values.effectPixels++;
      near(pixel, [Math.round(srgb(0.25) * alpha / 255), Math.round(128 * alpha / 255), alpha, alpha], 2, label + ' regional tint');
    } else {
      values.unchangedPixels++;
      const grey = Math.round(128 * alpha / 255);
      const expected = original?.bytes.slice(offset, offset + 4) ?? [grey, grey, grey, alpha];
      near(pixel, expected, original ? 0 : 2, label + ' outside rectangle');
    }
    assert.equal(pixel[3], inUi ? 255 : alpha, label + ' alpha is exact');
  }
  assert.ok(Object.values(values).every(value => value > 0));
  return values;
}
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = browser.version();
  for (const ratio of [1, 2]) {
    const page = await browser.newPage({ deviceScaleFactor: ratio });
    let timeout;
    try {
      page.on('pageerror', error => faults.push(String(error)));
      await page.route(base + '/native-layer-light-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(base + '/native-layer-light-fixture');
      const observation = await Promise.race([
        page.evaluate(observe, ratio),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('browser fixture timed out')), 25000); }),
      ]);
      const { unlit, lit, moved, reset, rebuilt, fractionalBase, fractionalLit, ...metadata } = observation;
      const row = { ratio, ...metadata, framePins: {} };
      report.ratios.push(row);
      for (const [label, frame] of Object.entries({ unlit, lit, moved, reset, rebuilt })) {
        assert.deepEqual([frame.width, frame.height], [12 * ratio, 8 * ratio]);
        const bytes = Buffer.from(frame.bytes), file = ratio + 'x-' + label + '.rgba';
        fs.writeFileSync(path.join(output, file), bytes);
        row.framePins[label] = { file, bytes: bytes.length, sha256: hash(bytes) };
      }
      row.litPixels = oracle(lit, unlit, ratio, false);
      assert.deepEqual([fractionalLit.width, fractionalLit.height], [Math.ceil(7.1 * ratio), Math.ceil(3.1 * ratio)]);
      function at(frame, x, y) {
        const offset = 4 * (y * frame.width + x);
        return frame.bytes.slice(offset, offset + 4);
      }
      const right = [fractionalLit.width - 1, 2 * ratio];
      const bottom = [2 * ratio, fractionalLit.height - 1];
      for (const [name, point] of [['right', right], ['bottom', bottom]]) {
        const unmodified = at(fractionalBase, ...point);
        assert.ok(unmodified[3] > 0, 'outer logical clip point still samples cached art');
        assert.deepEqual(at(fractionalLit, ...point), unmodified, 'the fractional frame clip excludes the outer ' + name + ' pixel center');
      }
      assert.notDeepEqual(at(fractionalLit, 2 * ratio, 2 * ratio), at(fractionalBase, 2 * ratio, 2 * ratio));
      for (const [label, frame] of Object.entries({ fractionalBase, fractionalLit })) {
        const bytes = Buffer.from(frame.bytes), file = ratio + 'x-' + label + '.rgba';
        fs.writeFileSync(path.join(output, file), bytes);
        row.framePins[label] = { file, bytes: bytes.length, sha256: hash(bytes) };
      }
      row.movedPixels = oracle(moved, undefined, ratio, true);
      assert.deepEqual(lit.bytes.map((value, index) => index % 4 === 3 ? value : null),
        unlit.bytes.map((value, index) => index % 4 === 3 ? value : null), 'effect preserves all scene alpha');
      assert.deepEqual(reset.bytes, unlit.bytes, 'unlit frame after movement has no previous uniforms');
      assert.deepEqual(metadata.before, metadata.after, 'effect mutation or camera never uploads or replaces a baked target');
      assert.equal(metadata.after.residentBytes, 72);
      assert.equal(metadata.disposed.residentBytes, 0);
      assert.ok(metadata.rejections.every(value => value.code === 'WEBGL2_LAYER_EFFECT_INVALID' && value.serialStable),
        'malformed effect rejected without starting a submission');
      assert.deepEqual(metadata.lost, ['stale', 'stale']);
      assert.equal(metadata.generationAfter, metadata.generationBefore + 1);
      assert.deepEqual(rebuilt.bytes, lit.bytes, 'restored target and shader reproduce the original pixels');
    } finally {
      clearTimeout(timeout);
      await page.close();
    }
  }
  assert.deepEqual(faults, []);
  for (const pin of [...report.executionInputs, ...served.values()]) assert.deepEqual(fingerprintFile(repository, pin.path), pin);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.finished = new Date().toISOString();
  report.source = [...served.values()];
  report.faults = faults;
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, browser: report.browser, output }));
}
