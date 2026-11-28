// SPDX-License-Identifier: Apache-2.0
// Kept layers of the shared WebGPU Host in a real browser: placement at a pixel ratio of two, painter order,
// transparency, camera motion without uploads, an effect, device loss and an explicit rebuild. Pixels come from the
// Host's own readback, so the check does not depend on how the browser composites a WebGPU canvas.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintFile, ownerRelativePath } from './lib/file-identity.mjs';
import { createExampleServer } from './serve-example.mjs';

const [playwright, output, executablePath, ...extra] = process.argv.slice(2);
assert.ok(
  playwright && output && extra.length === 0,
  'Usage: node tools/verify-webgpu-layer-cache.mjs <playwright-root> <new-output-directory> [chromium-executable]'
);
const repository = path.resolve(import.meta.dirname, '..');
const { chromium } = await import(pathToFileURL(path.join(playwright, 'index.mjs')));
const playwrightVersion = JSON.parse(fs.readFileSync(path.join(playwright, 'package.json'), 'utf8')).version;
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
    } catch (error) {
      faults.push(String(error));
    }
  });
});

async function observe() {
  const egret = await import('@egret/engine');
  const { createSharedWebGPUHost } = await import('@egret/engine/webgpu');
  const canvas = document.querySelector('canvas');
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw Error('No WebGPU adapter');
  // The page owns the device, so it can lose it for real and hand the Host a new one.
  let device = await adapter.requestDevice();
  const host = createSharedWebGPUHost({
    canvas,
    device: { kind: 'borrow', device },
    recovery: { mode: 'manual' },
    pixelRatio: 2,
    outputAlpha: 'opaque',
    enableReadback: true,
    enableLayers: true,
    enableEffects: true
  });
  const engine = await egret.createEngineForProfile({ host }, 'egret.shared-frame2d/1');
  const scope = engine.createScope();
  try {
    const type = egret.createAssetType('webgpu-cache-native-procedural', egret.isTexture);
    engine.assets.register(type, {
      async load() {
        const rows = [
          [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 255, 0, 255],
            [255, 255, 0, 255]
          ],
          [
            [0, 0, 255, 128],
            [0, 0, 255, 128],
            [255, 0, 255, 128],
            [255, 0, 255, 128]
          ],
          [
            [0, 255, 0, 255],
            [0, 255, 0, 255],
            [0, 255, 255, 255],
            [0, 255, 255, 255]
          ],
          [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
          ]
        ];
        const image = egret.createImageData2D({ width: 4, height: 4, pixels: Uint8Array.from(rows.flat(2)) });
        return egret.createTexture(image);
      },
      dispose(texture) {
        texture.dispose();
      }
    });
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'tile')));
    const sprite = scope.use(new egret.Bitmap(lease));
    sprite.sharedMaterial = egret.createSharedMaterial2D({ filter: 'nearest' });
    engine.stage.addChild(sprite);
    const source = engine.captureSharedFrame({ width: 4, height: 4 });
    engine.stage.removeChild(sprite);

    const overlay = scope.use(new egret.Sprite());
    overlay.graphics.beginFill(0xff8000).drawRect(3, 4, 2, 2).endFill();
    engine.stage.addChild(overlay);
    const frameOptions = { width: 12, height: 10, outputAlpha: 'opaque' };
    const layer = host.createSharedLayer2D();
    await layer.update(source);
    const writtenAfterBake = host.getSharedStatus().resources.totals.pageWriteCalls;
    const placements = [
      [2, 3],
      [6, 4]
    ];
    const frames = [];
    const diagnostics = [];
    async function draw(x, y, cached, effect) {
      if (!cached) {
        sprite.x = x;
        sprite.y = y;
        engine.stage.addChildAt(sprite, 0);
      }
      const frame = engine.captureSharedFrame(frameOptions);
      const readback = host.requestReadback();
      void readback.catch(() => {});
      if (cached)
        host.renderSharedFrameWithLayers(frame, [{ layer, x, y, width: 4, height: 4, ...(effect ? { effect } : {}) }]);
      else host.renderSharedFrame(frame);
      const { width, height, bytes } = await readback;
      await host.whenIdle();
      if (!cached) engine.stage.removeChild(sprite);
      return { width, height, bytes: [...bytes] };
    }
    for (const [x, y] of placements) frames.push({ x, y, cached: await draw(x, y, true) });
    const writtenAfterMotion = host.getSharedStatus().resources.totals.pageWriteCalls;
    for (const row of frames) row.direct = await draw(row.x, row.y, false);
    // Red taken out of the layer's left half; the overlay is drawn after the layer and keeps its colour.
    const tinted = await draw(2, 3, true, { bounds: { x: 2, y: 3, width: 2, height: 4 }, multiply: [0, 1, 1] });

    const generationBefore = host.getSessionStatus().generation;
    const lost = device.lost;
    device.destroy();
    await lost;
    await new Promise(resolve => setTimeout(resolve, 50));
    const whenLost = { host: host.getSessionStatus().state, layer: layer.state, cache: host.getSharedLayerStatus() };
    // An adapter makes one device; the replacement comes from a new one.
    device = await (await navigator.gpu.requestAdapter()).requestDevice();
    await host.recover(device);
    await host.whenReady();
    const generationAfter = host.getSessionStatus().generation;
    const restoredLayerState = layer.state;
    try {
      host.renderSharedFrameWithLayers(engine.captureSharedFrame(frameOptions), [
        { layer, x: 2, y: 3, width: 4, height: 4 }
      ]);
    } catch (error) {
      diagnostics.push(error.code);
    }
    await layer.update(source);
    const rebuilt = await draw(2, 3, true);
    layer.dispose();
    return {
      devicePixelRatio,
      writtenAfterBake,
      writtenAfterMotion,
      frames,
      tinted,
      whenLost,
      restoredLayerState,
      generationBefore,
      generationAfter,
      diagnostics,
      rebuilt,
      disposed: layer.state,
      cache: host.getSharedLayerStatus()
    };
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}

const html =
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>Shared WebGPU layer cache</title>' +
  '<script type="importmap">' +
  JSON.stringify({
    imports: {
      '@egret/engine': '/packages/engine/dist/index.js',
      '@egret/engine/webgpu': '/packages/engine/dist/web/webgpu.js',
      '@egret/contracts': '/packages/contracts/dist/index.js',
      '@egret/contracts/resources': '/packages/contracts/dist/resources/index.js',
      '@egret/runtime': '/packages/runtime/dist/index.js',
      '@egret/runtime/text': '/packages/runtime/dist/text/index.js',
      '@egret/runtime/ui': '/packages/runtime/dist/ui/index.js',
      '@egret/runtime/input': '/packages/runtime/dist/input/index.js',
      '@egret/runtime/paragraph': '/packages/runtime/dist/paragraph/index.js',
      '#egret-textured-frame-state': '/packages/engine/dist/internal/texturedFrameState.js',
      '#egret-pointer-input': '/packages/engine/dist/pointerInput.js',
      'robust-predicates': '/vendor/robust-predicates/index.js'
    }
  }) +
  '</script><canvas width="24" height="20"></canvas></html>';
const executionInputs = [
  'tools/verify-webgpu-layer-cache.mjs',
  'tools/serve-example.mjs',
  'tools/lib/file-identity.mjs'
].map(file => fingerprintFile(repository, file));
// Headless Chromium offers WebGPU on its software adapter only behind these switches.
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader'];
const report = {
  started: new Date().toISOString(),
  node: process.version,
  playwrightVersion,
  headless: true,
  extraFlags: flags,
  executionInputs
};
let browser;
let timeout;
const pixel = (row, x, y) => {
  const index = 4 * ((2 * y + 1) * row.width + (2 * x + 1));
  return row.bytes.slice(index, index + 4);
};
const near = (actual, expected) => actual.every((value, index) => Math.abs(value - expected[index]) <= 2);
try {
  browser = await chromium.launch({ headless: true, args: flags, ...(executablePath ? { executablePath } : {}) });
  report.browser = browser.version();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  page.on('pageerror', error => faults.push(String(error)));
  await page.route(base + '/native-webgpu-layer-cache-fixture', route =>
    route.fulfill({ contentType: 'text/html', body: html })
  );
  await page.goto(base + '/native-webgpu-layer-cache-fixture');
  report.adapter = await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    return adapter ? { vendor: adapter.info?.vendor ?? '', architecture: adapter.info?.architecture ?? '' } : null;
  });
  const observation = await Promise.race([
    page.evaluate(observe),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(Error('browser fixture timed out')), 60000);
    })
  ]);
  const { frames: rows, rebuilt, tinted, ...metadata } = observation;
  Object.assign(report, metadata);
  report.frames = rows.map(({ x, y, cached, direct }, index) => {
    const cachedBytes = Buffer.from(cached.bytes);
    const directBytes = Buffer.from(direct.bytes);
    const cachedFile = 'cached-' + index + '.rgba';
    const directFile = 'direct-' + index + '.rgba';
    fs.writeFileSync(path.join(output, cachedFile), cachedBytes);
    fs.writeFileSync(path.join(output, directFile), directBytes);
    let maxChannelError = 0;
    for (let i = 0; i < cachedBytes.length; i++)
      maxChannelError = Math.max(maxChannelError, Math.abs(cachedBytes[i] - directBytes[i]));
    return {
      x,
      y,
      width: cached.width,
      height: cached.height,
      cachedFile,
      directFile,
      maxChannelError,
      cachedSha256: hash(cachedBytes),
      directSha256: hash(directBytes)
    };
  });
  fs.writeFileSync(path.join(output, 'tinted.rgba'), Buffer.from(tinted.bytes));
  fs.writeFileSync(path.join(output, 'rebuilt.rgba'), Buffer.from(rebuilt.bytes));
  report.rebuiltSha256 = hash(Buffer.from(rebuilt.bytes));

  // Independent RGBA expectations at logical pixels of the first placement, at (2, 3).
  const samples = [
    [2, 3, [255, 0, 0, 255]],
    [4, 3, [255, 255, 0, 255]],
    [2, 4, [0, 0, 188, 255]],
    [3, 4, [255, 128, 0, 255]],
    [2, 5, [0, 255, 0, 255]],
    [2, 6, [0, 0, 0, 255]]
  ];
  report.samples = samples.map(([x, y, expected]) => ({ x, y, expected, actual: pixel(rows[0].cached, x, y) }));
  for (const point of report.samples)
    assert.ok(near(point.actual, point.expected), 'independent RGBA sample mismatch at ' + point.x + ',' + point.y);
  // The effect takes red out where its bounds lie and leaves the rest of the layer and the overlay above it.
  const tintSamples = [
    [2, 3, [0, 0, 0, 255]],
    [4, 3, [255, 255, 0, 255]],
    [2, 5, [0, 255, 0, 255]],
    [3, 4, [255, 128, 0, 255]]
  ];
  report.tintSamples = tintSamples.map(([x, y, expected]) => ({ x, y, expected, actual: pixel(tinted, x, y) }));
  for (const point of report.tintSamples)
    assert.ok(near(point.actual, point.expected), 'effect sample mismatch at ' + point.x + ',' + point.y);
  assert.equal(report.devicePixelRatio, 2);
  for (const frame of report.frames) {
    assert.deepEqual([frame.width, frame.height], [24, 20]);
    assert.ok(frame.maxChannelError <= 2, 'cached/direct comparison mismatch: ' + frame.maxChannelError);
  }
  assert.equal(report.writtenAfterBake, report.writtenAfterMotion, 'moving a placement uploads no page');
  assert.equal(report.whenLost.layer, 'stale');
  assert.equal(report.whenLost.cache.readyLayers, 0);
  assert.equal(report.restoredLayerState, 'stale');
  assert.equal(report.generationAfter, report.generationBefore + 1);
  assert.deepEqual(report.diagnostics, ['WEBGPU_LAYER_NOT_READY']);
  assert.equal(report.rebuiltSha256, report.frames[0].cachedSha256);
  assert.equal(report.disposed, 'disposed');
  assert.equal(report.cache.residentBytes, 0);
  assert.deepEqual(faults, []);
  for (const pin of [...executionInputs, ...served.values()])
    assert.deepEqual(fingerprintFile(repository, pin.path), pin);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.finished = new Date().toISOString();
  report.source = [...served.values()];
  report.faults = faults;
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, browser: report.browser, output, frames: report.frames }));
}
