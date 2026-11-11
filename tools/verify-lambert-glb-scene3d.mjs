// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fingerprintFile, ownerRelativePath, samePhysicalPath } from './lib/file-identity.mjs';
import { createExampleServer } from './serve-example.mjs';

const route = '/lambert-glb-scene3d-native';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const repo = path.resolve(import.meta.dirname, '..');

export function createLambertBrowserProbe() {
  const example = 'examples/textured-scene3d/index.html';
  const imports = readFileSync(path.join(repo, example), 'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)?.[0];
  assert(imports, 'The normal authored 3D package import map is required.');
  const html = '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' + imports +
    '<canvas width="192" height="128"></canvas>';
  const server = createExampleServer(repo);
  const serve = server.listeners('request')[0];
  const served = new Map(), faults = [];
  const inputs = ['tools/verify-lambert-glb-scene3d.mjs', 'tools/serve-example.mjs', example]
    .map(name => fingerprintFile(repo, name));
  server.removeListener('request', serve);
  server.on('request', (request, response) => {
    const name = new URL(request.url, 'http://127.0.0.1').pathname;
    if (name === route) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html);
      return;
    }
    response.on('finish', () => {
      try {
        assert.equal(response.statusCode, 200, 'HTTP ' + response.statusCode + ' ' + name);
        const alias = '/vendor/robust-predicates/';
        const file = name.startsWith(alias)
          ? 'packages/engine/node_modules/robust-predicates/' + name.slice(alias.length) : name.slice(1);
        const relative = ownerRelativePath(repo, realpathSync(path.join(repo, file)));
        const pin = fingerprintFile(repo, relative);
        if (served.has(relative)) assert.deepEqual(pin, served.get(relative));
        else served.set(relative, pin);
      } catch (error) { faults.push(String(error)); }
    });
    serve(request, response);
  });
  return { route, server, identity() {
    assert.deepEqual(faults, []);
    for (const pin of [...inputs, ...served.values()]) assert.deepEqual(fingerprintFile(repo, pin.path), pin);
    return { inputs, served: [...served.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')),
      htmlSha256: sha(html), observeSha256: sha(observeLambert.toString()), glbSha256: sha(createLambertGlb()) };
  } };
}

export function lambertBrowserObservation(backend) {
  return '(' + observeLambert + ')(' + JSON.stringify(backend) + ', (' + createLambertGlb + ')())';
}

// Build an original two-texel-color GLB with separate flat, sloped and unlit meshes.
function createLambertGlb() {
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8Dw//9/EAZSADzRCfc/XNCqAAAAAElFTkSuQmCC'), value => value.charCodeAt(0));
  const extension = 'KHR_materials_unlit', views = [], accessors = [], blocks = [];
  let size = 0;
  const append = (bytes, target) => {
    const index = views.length;
    views.push({ buffer: 0, byteOffset: size, byteLength: bytes.length, ...(target ? { target } : {}) });
    blocks.push({ offset: size, bytes });
    size = Math.ceil((size + bytes.length) / 4) * 4;
    return index;
  };
  const floats = (values, width, bounds) => {
    const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer);
    values.forEach((value, index) => view.setFloat32(4 * index, value, true));
    const bufferView = append(bytes, 34962), index = accessors.length;
    accessors.push({ bufferView, componentType: 5126, count: values.length / width, type: 'VEC' + width, ...bounds });
    return index;
  };
  const indices = new Uint8Array(12), indexView = new DataView(indices.buffer);
  [0, 1, 2, 2, 1, 3].forEach((value, index) => indexView.setUint16(2 * index, value, true));
  accessors.push({ bufferView: append(indices, 34963), componentType: 5123, count: 6, type: 'SCALAR' });
  const geometry = slope => floats(
    [-.32, .38, slope, -.32, -.38, slope, .32, .38, -slope, .32, -.38, -slope], 3,
    { min: [-.32, -.38, -slope], max: [.32, .38, slope] });
  const flat = geometry(0), sloped = geometry(.32);
  const uv = floats([.75, .25, .75, .25, .75, .25, .75, .25], 2);
  const flatNormal = floats([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3);
  const diagonal = [Math.SQRT1_2, 0, Math.SQRT1_2];
  const slopeNormal = floats([...diagonal, ...diagonal, ...diagonal, ...diagonal], 3);
  const imageView = append(png);
  const material = factors => ({ doubleSided: true, extensions: { [extension]: {} }, pbrMetallicRoughness: factors });
  const lit = (position, normal) => ({ primitives: [{ attributes: {
    POSITION: position, TEXCOORD_0: uv, NORMAL: normal,
  }, indices: 0, material: 0 }] });
  const gltf = {
    asset: { version: '2.0' }, extensionsUsed: [extension], extensionsRequired: [extension],
    buffers: [{ byteLength: size }], bufferViews: views, accessors,
    images: [{ bufferView: imageView, mimeType: 'image/png' }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    textures: [{ sampler: 0, source: 0 }],
    materials: [material({ baseColorTexture: { index: 0 } }), material({ baseColorFactor: [0, 1, 0, 1] })],
    meshes: [lit(flat, flatNormal), lit(sloped, slopeNormal),
      { primitives: [{ attributes: { POSITION: flat }, indices: 0, material: 1 }] }],
    nodes: [{ mesh: 0, translation: [-1.9, .8, 0] },
      { mesh: 0, translation: [-.6, .8, 0], scale: [-1, 1, 1] },
      { mesh: 1, translation: [.8, .8, 0], scale: [2, 1, .5] },
      { mesh: 2, translation: [2.1, .8, 0] }],
    scene: 0, scenes: [{ nodes: [0, 1, 2, 3] }],
  };
  const json = new TextEncoder().encode(JSON.stringify(gltf)), padded = Math.ceil(json.length / 4) * 4;
  const output = new Uint8Array(28 + padded + size), header = new DataView(output.buffer);
  [0x46546c67, 2, output.length, padded, 0x4e4f534a].forEach((value, index) => header.setUint32(index * 4, value, true));
  output.fill(32, 20, 20 + padded);
  output.set(json, 20);
  header.setUint32(20 + padded, size, true);
  header.setUint32(24 + padded, 0x004e4942, true);
  for (const block of blocks) output.set(block.bytes, 28 + padded + block.offset);
  return output;
}

async function observeLambert(backend, bytes) {
  const { Bitmap, createAssetRef, createAssetType, createEngineForProfile, isTexture } = await import('@egret/engine');
  const { createSceneCamera3D, createSceneWorldCard3D, prepareLambertStaticGlbScene3D } =
    await import('@egret/engine/scene3d/authoring');
  const { createBrowserTextureProvider } = await import('@egret/engine/web/image');
  const canvas = document.querySelector('canvas');
  const viewport = { width: 192, height: 128, clearAlpha: 1, outputAlpha: 'opaque' };
  const options = { canvas, pixelRatio: 1, outputAlpha: 'opaque', enableReadback: true };
  const observed = promise => { void promise.catch(() => {}); return promise; };
  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const light = { direction: [0, 0, 1], ambient: .25, intensity: .75 };
  const projection = { kind: 'orthographic', height: 4, aspect: 1.5, near: 1, far: 12 };
  const frontCamera = createSceneCamera3D({ eye: [0, 0, 5], target: [0, 0, 0], projection });
  const rearCamera = createSceneCamera3D({ eye: [0, 0, -5], target: [0, 0, 0], projection });
  const actor = z => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1.9, .8, z, 1];
  const adapter = backend === 'webgpu' ? await navigator.gpu?.requestAdapter() : undefined;
  if (backend === 'webgpu' && !adapter) throw Error('WebGPU adapter unavailable');
  let host, engine, scope, provider, device, gl, externalFrontFace;
  if (backend === 'webgl2') {
    // A caller-owned canvas can already hold a valid context with clockwise front faces.
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) throw Error('WebGL2 context unavailable');
    gl.frontFace(gl.CW);
    if (gl.getParameter(gl.FRONT_FACE) !== gl.CW) throw Error('Could not seed clockwise front faces');
    externalFrontFace = 'cw';
  }

  function state() {
    const { resources } = host.getSharedStatus();
    return { generation: host.getSessionStatus().generation, uploads: resources.totals.pageWriteCalls,
      pages: resources.current.images.readyEntries, bytes: resources.current.images.readyBytes };
  }

  async function draw(world, camera = frontCamera, staged = false) {
    const scene = world.capture(camera), overlay = engine.captureSharedFrame(viewport);
    let stage;
    try {
      if (staged) {
        stage = host.stageSceneSharedFrame(scene, overlay);
        await stage.ready;
      }
      const ticket = observed(host.requestReadback());
      if (stage) await stage.submit().completed;
      else host.renderSceneSharedFrame(scene, overlay);
      const { width, height, bytes: rgba } = await ticket;
      await host.whenIdle();
      return { width, height, bytes: Array.from(rgba) };
    } finally { stage?.dispose(); }
  }

  async function recover(gl) {
    if (backend === 'webgl2') {
      const extension = gl.getExtension('WEBGL_lose_context');
      if (!extension) throw Error('WEBGL_lose_context unavailable');
      const event = name => new Promise(resolve => canvas.addEventListener(name, resolve, { once: true }));
      const lost = event('webglcontextlost');
      extension.loseContext();
      const lostTrusted = (await lost).isTrusted;
      await delay(100);
      const restored = event('webglcontextrestored');
      extension.restoreContext();
      await host.whenReady();
      return { lostTrusted, restoredTrusted: (await restored).isTrusted };
    }
    const lost = observed(device.lost);
    device.destroy();
    const { reason } = await lost;
    const deadline = performance.now() + 3000;
    while (host.getSessionStatus().state !== 'lost') {
      if (performance.now() >= deadline) throw Error('Host did not observe actual GPU loss');
      await delay(10);
    }
    const nextAdapter = await navigator.gpu.requestAdapter();
    if (!nextAdapter) throw Error('WebGPU recovery adapter unavailable');
    device = await nextAdapter.requestDevice();
    await host.recover(device);
    await host.whenReady();
    return { reason };
  }

  try {
    if (backend === 'webgl2') {
      const { createSharedSceneWebGL2Host } = await import('@egret/engine/webgl2/scene3d');
      host = createSharedSceneWebGL2Host(options);
    } else {
      const { createSharedSceneWebGPUHost } = await import('@egret/engine/webgpu/scene3d');
      device = await adapter.requestDevice();
      host = createSharedSceneWebGPUHost({ ...options, device: { kind: 'borrow', device },
        recovery: { mode: 'manual', timeoutMs: 5000 } });
    }
    engine = await createEngineForProfile({ host }, 'egret.shared-frame2d/1');
    scope = engine.createScope();
    const plan = prepareLambertStaticGlbScene3D(bytes);
    const type = createAssetType('fixture-glb-png', isTexture);
    const request = plan.images[0];
    if (plan.images.length !== 1 || request.imageIndex !== 0) throw Error('Unexpected image plan');
    provider = createBrowserTextureProvider({ async readBytes(ref) {
      if (ref.id !== '0') throw Error('Unexpected image reference');
      return request.copyBytes();
    } });
    engine.assets.register(type, provider);
    const lease = scope.use(await engine.assets.acquire(createAssetRef(type, '0'), { signal: scope.signal }));
    const source = lease.value.imageData;
    const card = createSceneWorldCard3D({ source, width: .48, height: .48, pivotX: .5, pivotY: .5,
      region: { x: 0, y: 0, width: 1, height: 1 } });
    const world = plan.bindImages([{ imageIndex: 0, source }], light)
      .withNodes([{ id: 'actor', localMatrix: actor(-1), cards: [card] }]);
    const hud = engine.stage.addChild(scope.use(new Bitmap(lease)));
    hud.x = 2; hud.y = 2; hud.scaleX = 4; hud.scaleY = 4;

    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : undefined;
    const gpu = adapter?.info && { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
      isFallbackAdapter: adapter.info.isFallbackAdapter };
    const scene = world.capture(frontCamera);
    const frameShape = [scene.draws.length, scene.cards.length, scene.geometries.length,
      scene.cpuLogicalBytes, scene.sceneBytes, scene.uniformBytes];
    const samePage = scene.draws.filter(draw => draw.lambert)
      .every(draw => draw.texture.source === source) && scene.cards[0].source === source;

    const cold = state();
    const baseline = await draw(world);
    const warm = state();
    const moved = world.withNodeTransform('actor', actor(1));
    const actorFront = await draw(moved);
    const staged = await draw(moved, frontCamera, true);
    const reversed = world.withLighting({ ...light, direction: [0, 0, -1] });
    const direction = await draw(reversed);
    const back = await draw(moved, rearCamera);
    const backRelit = await draw(reversed.withNodeTransform('actor', actor(1)), rearCamera);
    const original = await draw(world);
    const beforeLoss = state();
    const loss = await recover(gl);
    const recovered = state();
    const restored = await draw(moved, frontCamera, true);
    const afterRestore = state();
    return { renderer, gpu, externalFrontFace, dpr: devicePixelRatio, frameShape, samePage, cold, warm, beforeLoss,
      loss, recovered, afterRestore, frames: { baseline, actorFront, staged, direction, back, backRelit, original, restored } };
  } finally {
    try {
      scope?.dispose();
      if (engine) await engine.dispose();
      else if (host) await host.close();
    } finally {
      try { await provider?.close(); } finally { device?.destroy(); }
    }
  }
}

const witnesses = { flat: [44, 38], actor: [35, 38], mirror: [77, 38], slope: [122, 38],
  unlit: [163, 38], rearFlat: [147, 38], rearUnlit: [29, 38], hud: [3, 3] };
const white = [255, 255, 255, 255], shade = [137, 137, 137, 255], sloped = [252, 252, 252, 255];
const red = [255, 0, 0, 255], green = [0, 255, 0, 255];

export function checkLambertBrowserResult(row, result, output) {
  const { frames, ...metadata } = result;
  Object.assign(row, metadata, { frames: {} });
  for (const [name, frame] of Object.entries(frames)) {
    const pixels = {};
    for (const [label, [x, y]] of Object.entries(witnesses)) {
      const offset = 4 * (y * frame.width + x);
      pixels[label] = frame.bytes.slice(offset, offset + 4);
    }
    const rgba = Buffer.from(frame.bytes);
    row.frames[name] = { shape: [frame.width, frame.height, frame.bytes.length], sha256: sha(rgba), pixels };
    if (output) writeFileSync(path.join(output, row.backend + '-' + name + '.rgba'), rgba);
  }

  assert.deepEqual(row.frameShape, [4, 1, 3, 1040, 520, 560]);
  assert.equal(row.samePage, true);
  const expect = (frame, label, color) => {
    const actual = row.frames[frame].pixels[label];
    assert(actual.length === 4 && actual.every((value, index) => Math.abs(value - color[index]) <= (index === 3 ? 0 : 1)),
      row.backend + ' ' + frame + ' ' + label + ' expected ' + color + ', got ' + actual);
  };
  for (const frame of Object.values(row.frames)) assert.deepEqual(frame.shape, [192, 128, 98304]);
  expect('baseline', 'flat', white);
  expect('baseline', 'actor', white);
  expect('baseline', 'mirror', white);
  expect('baseline', 'slope', sloped);
  expect('actorFront', 'actor', red);
  for (const name of ['baseline', 'actorFront', 'staged', 'direction', 'original', 'restored']) expect(name, 'unlit', green);
  for (const name of Object.keys(row.frames)) expect(name, 'hud', red);
  for (const name of ['flat', 'mirror', 'slope']) expect('direction', name, shade);
  expect('back', 'rearFlat', shade);
  expect('backRelit', 'rearFlat', white);
  expect('back', 'rearUnlit', green);
  expect('backRelit', 'rearUnlit', green);
  for (const name of ['staged', 'restored']) assert.equal(row.frames[name].sha256, row.frames.actorFront.sha256);
  assert.equal(row.frames.original.sha256, row.frames.baseline.sha256);
  assert.deepEqual(row.cold, { generation: 1, uploads: 0, pages: 0, bytes: 0 });
  assert.deepEqual(row.warm, { generation: 1, uploads: 1, pages: 1, bytes: 16 });
  assert.deepEqual(row.beforeLoss, row.warm);
  assert.deepEqual(row.recovered, { generation: 2, uploads: 1, pages: 0, bytes: 0 });
  assert.deepEqual(row.afterRestore, { generation: 2, uploads: 2, pages: 1, bytes: 16 });
  if (row.backend === 'webgl2') {
    assert.equal(row.externalFrontFace, 'cw');
    assert.deepEqual(row.loss, { lostTrusted: true, restoredTrusted: true });
  } else assert.equal(row.loss.reason, 'destroyed');
  row.status = 'PASS';
}

async function verifyDesktop(playwright, output) {
  assert(playwright && output && process.argv.length === 4,
    'Usage: node tools/verify-lambert-glb-scene3d.mjs <playwright-root> <new-output-directory>');
  const version = JSON.parse(readFileSync(path.join(playwright, 'package.json'), 'utf8')).version;
  assert.equal(version, '1.62.1');
  const { chromium } = await import(pathToFileURL(path.resolve(playwright, 'index.mjs')));
  mkdirSync(output);
  const probe = createLambertBrowserProbe(), report = { status: 'FAIL', playwright: version, backends: [], node: process.version };
  let browser;
  try {
    await new Promise((resolve, reject) => { probe.server.once('error', reject); probe.server.listen(0, '127.0.0.1', resolve); });
    const url = 'http://127.0.0.1:' + probe.server.address().port + probe.route;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    report.browser = browser.version();
    for (const backend of ['webgl2', 'webgpu']) {
      const row = { backend, status: 'FAIL', errors: [] };
      report.backends.push(row);
      const page = await browser.newPage();
      page.on('pageerror', error => row.errors.push(String(error)));
      page.on('console', event => { if (event.type() === 'error') row.errors.push(event.text()); });
      let timer;
      try {
        assert.equal((await page.goto(url, { timeout: 15000 }))?.status(), 200);
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Browser observation deadline exceeded')), 28000); });
        checkLambertBrowserResult(row, await Promise.race([page.evaluate(lambertBrowserObservation(backend)), timeout]), output);
        assert.deepEqual(row.errors, []);
      } catch (error) {
        row.status = 'FAIL';
        row.error = String(error.stack ?? error);
        console.error(row.error);
      } finally { clearTimeout(timer); await page.close(); }
    }
    Object.assign(report, probe.identity());
    if (report.backends.every(row => row.status === 'PASS')) report.status = 'PASS';
  } catch (error) {
    report.error = String(error.stack ?? error);
    console.error(report.error);
  } finally {
    try { await browser?.close(); } catch (error) { report.error = String(error); report.status = 'FAIL'; }
    await new Promise(resolve => probe.server.close(resolve));
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(report.status, report.backends.map(row => row.backend + ':' + row.status).join(' '));
    if (report.status !== 'PASS') process.exitCode = 1;
  }
}

if (process.argv[1] && samePhysicalPath(process.argv[1], import.meta.filename)) {
  await verifyDesktop(process.argv[2], process.argv[3]);
}
