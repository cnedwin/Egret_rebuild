// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintFile, ownerRelativePath } from './lib/file-identity.mjs';
import { createExampleServer } from './serve-example.mjs';

const [playwright, output, ...extra] = process.argv.slice(2);
assert(playwright && output && !extra.length, 'Usage: node tools/verify-world-depth-cards.mjs <playwright-root> <new-output-directory>');
const repo = path.resolve(import.meta.dirname, '..');
const { chromium } = await import(pathToFileURL(path.join(playwright, 'index.mjs')));
const playwrightVersion = JSON.parse(readFileSync(path.join(playwright, 'package.json'), 'utf8')).version;
assert.equal(playwrightVersion, '1.62.1');
mkdirSync(output);
const imports = {
  '@egret/engine': '/packages/engine/dist/index.js',
  '@egret/engine/scene3d/authoring': '/packages/engine/dist/rendering/scene3dAuthoring.js',
  '@egret/engine/webgl2/scene3d': '/packages/engine/dist/web/webgl2Scene3d.js',
  '@egret/engine/webgpu/scene3d': '/packages/engine/dist/web/scene3d.js',
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
};
const server = createExampleServer(repo);
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = 'http://127.0.0.1:' + server.address().port;
const url = base + '/world-depth-cards-native';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const served = new Map(), faults = [];
server.on('request', (request, response) => response.on('finish', () => {
  if (response.statusCode !== 200) return;
  const name = new URL(request.url, base).pathname.slice(1);
  const actual = name.startsWith('vendor/robust-predicates/')
    ? 'packages/engine/node_modules/robust-predicates/' + name.slice('vendor/robust-predicates/'.length) : name;
  try {
    const logical = ownerRelativePath(repo, realpathSync(path.join(repo, actual)));
    const pin = fingerprintFile(repo, logical);
    if (served.has(logical)) assert.deepEqual(pin, served.get(logical));
    else served.set(logical, pin);
  } catch (error) { faults.push(String(error)); }
}));

async function observe(backend) {
  const engineApi = await import('@egret/engine');
  const author = await import('@egret/engine/scene3d/authoring');
  const canvas = document.querySelector('canvas');
  const viewport = { width: 160, height: 96, clearAlpha: 1, outputAlpha: 'opaque' };
  const options = { canvas, pixelRatio: 1, outputAlpha: 'opaque', enableReadback: true };
  const observed = promise => { void promise.catch(() => {}); return promise; };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const devices = [];
  const adapter = backend === 'webgpu' ? await navigator.gpu?.requestAdapter() : undefined;
  if (backend === 'webgpu' && !adapter) return { unavailable: true };
  async function device() {
    // A fresh real adapter is required for each borrowed native device.
    const owner = devices.length ? await navigator.gpu.requestAdapter() : adapter;
    if (!owner) throw Error('WebGPU recovery adapter unavailable');
    const value = await owner.requestDevice();
    devices.push(value);
    return value;
  }

  let host, engine, scope;
  try {
    if (backend === 'webgl2') {
      const { createSharedSceneWebGL2Host } = await import('@egret/engine/webgl2/scene3d');
      host = createSharedSceneWebGL2Host(options);
    } else {
      const { createSharedSceneWebGPUHost } = await import('@egret/engine/webgpu/scene3d');
      host = createSharedSceneWebGPUHost({ ...options, device: { kind: 'borrow', device: await device() },
        recovery: { mode: 'manual', timeoutMs: 5000 } });
    }
    engine = await engineApi.createEngineForProfile({ host }, 'egret.shared-frame2d/1');
    scope = engine.createScope();

    function buildingGlb() {
      // Original closed unlit cuboid, packed into a self-contained GLB in memory.
      const positions = [-.5, 0, -.5, .5, 0, -.5, .5, 1.25, -.5, -.5, 1.25, -.5,
        -.5, 0, .5, .5, 0, .5, .5, 1.25, .5, -.5, 1.25, .5];
      const indices = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3,
        1, 2, 6, 1, 6, 5, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4];
      const vertexBytes = positions.length * 4, indexBytes = indices.length * 2;
      const extension = 'KHR_materials_unlit';
      const model = { asset: { version: '2.0' }, extensionsUsed: [extension], extensionsRequired: [extension],
        scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
        materials: [{ doubleSided: true, extensions: { [extension]: {} }, pbrMetallicRoughness: { baseColorFactor: [0, 0, 1, 1] } }],
        buffers: [{ byteLength: vertexBytes + indexBytes }],
        bufferViews: [{ buffer: 0, byteLength: vertexBytes }, { buffer: 0, byteOffset: vertexBytes, byteLength: indexBytes }],
        accessors: [{ bufferView: 0, count: 8, componentType: 5126, type: 'VEC3', min: [-.5, 0, -.5], max: [.5, 1.25, .5] },
          { bufferView: 1, count: indices.length, componentType: 5123, type: 'SCALAR' }] };
      const json = new TextEncoder().encode(JSON.stringify(model)), padded = Math.ceil(json.byteLength / 4) * 4;
      const bytes = new Uint8Array(28 + padded + vertexBytes + indexBytes), view = new DataView(bytes.buffer);
      const u32 = (offset, value) => view.setUint32(offset, value, true);
      u32(0, 0x46546c67); u32(4, 2); u32(8, bytes.byteLength); u32(12, padded); u32(16, 0x4e4f534a);
      bytes.fill(32, 20, 20 + padded); bytes.set(json, 20); u32(20 + padded, vertexBytes + indexBytes); u32(24 + padded, 0x004e4942);
      const offset = 28 + padded;
      positions.forEach((value, index) => view.setFloat32(offset + index * 4, value, true));
      indices.forEach((value, index) => view.setUint16(offset + vertexBytes + index * 2, value, true));
      return bytes;
    }

    const region = { x: 2, y: 1, width: 20, height: 52 };
    const atlas = new Uint8Array(24 * 54 * 4).fill(255);
    for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
      const index = 4 * ((y + region.y) * 24 + x + region.x);
      const alpha = x === 11 ? 0 : x === 12 ? 127 : x === 13 ? 128 : 255;
      atlas.set([255, 0, y >= 26 ? 255 : 0, alpha], index);
    }
    const witness = new Uint8Array(20 * 52 * 4);
    for (let index = 0; index < witness.length; index += 4) witness.set([0, 255, 0, 255], index);
    const type = engineApi.createAssetType('world-card-native', engineApi.isTexture);
    engine.assets.register(type, {
      async load(ref) {
        const actor = ref.id === 'actor';
        const source = engineApi.createImageData2D({ width: actor ? 24 : 20, height: actor ? 54 : 52, pixels: actor ? atlas : witness });
        return engineApi.createTexture(source, actor ? region : undefined);
      },
      dispose(texture) { texture.dispose(); },
    });
    const actorLease = scope.use(await engine.assets.acquire(engineApi.createAssetRef(type, 'actor')));
    const witnessLease = scope.use(await engine.assets.acquire(engineApi.createAssetRef(type, 'witness')));

    // The 2D bitmap deliberately shares the actor image, while the second card is a card-only page.
    const sprite = engine.stage.addChild(scope.use(new engineApi.Bitmap(actorLease)));
    sprite.x = 2; sprite.y = 40;
    const hud = engine.stage.addChild(scope.use(new engineApi.Sprite()));
    hud.graphics.beginFill(0xffffff).drawRect(79, 25, 3, 3).endFill();

    const ppu = 18 * Math.SQRT2, right = [Math.SQRT1_2, 0, -Math.SQRT1_2];
    const vertical = [-Math.SQRT1_2 / 2, Math.sqrt(3) / 2, -Math.SQRT1_2 / 2];
    const back = [Math.sqrt(3 / 8), .5, Math.sqrt(3 / 8)];
    const camera = author.createSceneCamera3D({ eye: back.map(value => value * 6), target: [0, 0, 0],
      projection: { kind: 'orthographic', height: 96 / ppu, aspect: 160 / 96, near: 1, far: 12 } });
    const cardOptions = { width: 20 / ppu, height: 52 / ppu, pivotX: 9, pivotY: 55, alphaCutoff: 128 };
    const actor = author.createSceneWorldCard3D({ ...cardOptions, region, source: actorLease.value.imageData });
    const greenCard = author.createSceneWorldCard3D({ ...cardOptions, source: witnessLease.value.imageData });
    const building = author.loadStaticGlbScene3D(buildingGlb());
    const node = (id, asset, x, z, away = 0) => ({ id, localMatrix: [
      ...right, 0, ...vertical, 0, ...back, 0, x - away * back[0], -away * back[1], z - away * back[2], 1,
    ], cards: [asset] });
    const rear = building.withNodes([node('actor', actor, -.75, -.75)]).capture(camera);
    const side = building.withNodes([node('actor', actor, .9, -.75)]).capture(camera);
    const nearNodes = [node('actor', actor, .75, .75), node('witness', greenCard, .75, .75, .06)];
    const front = building.withNodes(nearNodes).capture(camera);
    const reversed = building.withNodes(nearNodes.slice().reverse()).capture(camera);

    function status() {
      const { resources } = host.getSharedStatus();
      return { generation: host.getSessionStatus().generation, uploads: resources.totals.pageWriteCalls,
        readyEntries: resources.current.images.readyEntries, readyBytes: resources.current.images.readyBytes };
    }

    async function draw(scene, stage) {
      const frame = engine.captureSharedFrame(viewport);
      if (stage) {
        const pending = host.stageSceneSharedFrame(scene, frame);
        try {
          await pending.ready;
          const ticket = observed(host.requestReadback());
          const result = pending.submit();
          await result.completed;
          const { width, height, bytes } = await ticket;
          await host.whenIdle();
          return { width, height, bytes: [...bytes] };
        } finally { pending.dispose(); }
      }
      const ticket = observed(host.requestReadback());
      host.renderSceneSharedFrame(scene, frame);
      const { width, height, bytes } = await ticket;
      await host.whenIdle();
      return { width, height, bytes: [...bytes] };
    }

    const start = status();
    const staged = await draw(front, true);
    const afterStage = status();
    const immediate = await draw(front, false);
    const afterImmediate = status();
    const reordered = await draw(reversed, false);
    const behind = await draw(rear, false);
    const around = await draw(side, false);
    const beforeLoss = status();
    let nativeLoss;
    if (backend === 'webgl2') {
      const gl = canvas.getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context');
      if (!extension) throw Error('WEBGL_lose_context unavailable');
      const event = name => new Promise(resolve => canvas.addEventListener(name, resolve, { once: true }));
      const lost = event('webglcontextlost');
      extension.loseContext();
      const lostTrusted = (await lost).isTrusted;
      await sleep(100);
      const restored = event('webglcontextrestored');
      extension.restoreContext();
      await host.whenReady();
      nativeLoss = { lostTrusted, restoredTrusted: (await restored).isTrusted };
    } else {
      const first = devices[0], lost = observed(first.lost);
      first.destroy();
      const reason = (await lost).reason;
      const deadline = performance.now() + 3000;
      while (host.getSessionStatus().state !== 'lost') {
        if (performance.now() >= deadline) throw Error('Host did not observe actual WebGPU device loss');
        await sleep(10);
      }
      await host.recover(await device());
      await host.whenReady();
      nativeLoss = { reason };
    }
    const restoredBeforeDraw = status();
    const rebuilt = await draw(front, true);
    const restoredAfterDraw = status();
    return { start, afterStage, afterImmediate, beforeLoss, restoredBeforeDraw, restoredAfterDraw,
      nativeLoss, frameShape: [front.draws.length, front.cards.length, front.uniformBytes],
      frontCardOrder: front.cards[0].source === actorLease.value.imageData,
      reversedCardOrder: reversed.cards[0].source === witnessLease.value.imageData,
      frames: { staged, immediate, reordered, behind, around, rebuilt } };
  } finally {
    scope?.dispose();
    if (engine) await engine.dispose();
    else if (host) await host.close();
    for (const value of devices) value.destroy();
  }
}

const report = { status: 'INCOMPLETE', browser: null, playwrightVersion, node: process.version, backends: [],
  inputs: ['tools/verify-world-depth-cards.mjs', 'tools/serve-example.mjs', 'tools/lib/file-identity.mjs'].map(file => fingerprintFile(repo, file)) };
const blue = [0, 0, 255, 255], red = [255, 0, 0, 255], green = [0, 255, 0, 255];
const magenta = [255, 0, 255, 255], white = [255, 255, 255, 255], black = [0, 0, 0, 255];
function expectPixel(frame, x, y, expected, tolerance = 0) {
  const offset = 4 * (frame.width * y + x), pixel = frame.bytes.slice(offset, offset + 4);
  assert(pixel.length === 4 && pixel.every((value, index) => Math.abs(value - expected[index]) <= tolerance),
    'Pixel (' + x + ',' + y + ') ' + pixel + ' expected ' + expected + ' tolerance ' + tolerance);
  return pixel;
}

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = browser.version();
  for (const backend of ['webgl2', 'webgpu']) {
    const row = { backend, status: 'INCOMPLETE' };
    report.backends.push(row);
    const page = await browser.newPage();
    let timeout;
    try {
      page.on('pageerror', error => faults.push(backend + ' ' + error.message));
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body:
        '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script type="importmap">' +
        JSON.stringify({ imports }) + '</script><canvas width="160" height="96"></canvas>' }));
      await page.goto(url);
      const observation = await Promise.race([page.evaluate(observe, backend),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Native card fixture timed out')), 30000); })]);
      if (observation.unavailable) { row.status = 'UNAVAILABLE'; continue; }
      const { frames, ...metadata } = observation;
      Object.assign(row, metadata, { frames: {} });
      for (const [label, frame] of Object.entries(frames)) {
        assert.deepEqual([frame.width, frame.height, frame.bytes.length], [160, 96, 61440]);
        const bytes = Buffer.from(frame.bytes), filename = backend + '-' + label + '.rgba';
        writeFileSync(path.join(output, filename), bytes);
        row.frames[label] = { filename, sha256: hash(bytes), hud: expectPixel(frame, 80, 26, white) };
      }
      assert.deepEqual(row.frameShape, [1, 2, 288]);
      assert(row.frontCardOrder && row.reversedCardOrder);
      const { staged, immediate, reordered, behind, around, rebuilt } = frames;
      row.witnesses = {
        occluded: expectPixel(behind, 80, 22, blue),
        outside: expectPixel(behind, 80, 3, red),
        side: expectPixel(around, 110, 30, magenta),
        front: expectPixel(staged, 80, 22, red),
        hole: expectPixel(staged, 82, 22, green),
        underCutoff: expectPixel(staged, 83, 22, green),
        atCutoff: expectPixel(staged, 84, 22, red, 2),
        lowerRow: expectPixel(staged, 80, 55, magenta),
        belowCrop: expectPixel(staged, 80, 60, black),
      };
      assert.deepEqual(immediate.bytes, staged.bytes);
      assert.deepEqual(reordered.bytes, staged.bytes);
      assert.deepEqual(rebuilt.bytes, staged.bytes);
      assert.equal(row.start.uploads, 0);
      assert.equal(row.afterStage.uploads, 2);
      assert.equal(row.afterStage.readyEntries, 2);
      assert.deepEqual(row.afterImmediate, row.afterStage);
      assert.deepEqual(row.beforeLoss, row.afterStage);
      assert.equal(row.restoredBeforeDraw.generation, row.beforeLoss.generation + 1);
      assert.equal(row.restoredBeforeDraw.readyEntries, 0);
      assert.equal(row.restoredAfterDraw.uploads - row.restoredBeforeDraw.uploads, 2);
      if (backend === 'webgl2') assert.deepEqual(row.nativeLoss, { lostTrusted: true, restoredTrusted: true });
      else assert.equal(row.nativeLoss.reason, 'destroyed');
      row.status = 'PASS';
    } catch (error) {
      row.status = 'FAIL';
      row.error = String(error.stack ?? error);
      console.error(row.error);
    } finally { clearTimeout(timeout); await page.close(); }
  }
  assert.deepEqual(faults, []);
  for (const pin of [...report.inputs, ...served.values()]) assert.deepEqual(fingerprintFile(repo, pin.path), pin);
  report.status = report.backends.every(row => row.status === 'PASS') ? 'PASS' : 'INCOMPLETE';
  if (report.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.served = [...served.values()];
  report.faults = faults;
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.backends.map(row => row.backend + ':' + row.status).join(' '));
}
