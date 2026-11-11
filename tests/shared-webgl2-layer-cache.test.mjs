// SPDX-License-Identifier: Apache-2.0
// Controlled browser ports establish commands and ownership; real pixels require a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, glPorts, until } from './fixtures/gl-shared-rendering.mjs';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';

const isEgretError = error => error instanceof egret.EgretError;

async function fixture(run) {
  const engine = await egret.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } },
  });
  const ports = glPorts();
  const host = createSharedWebGL2Host({ canvas: ports.canvas });
  const scope = engine.createScope();
  const assetType = egret.createAssetType('cache-test-art', egret.isTexture);
  engine.assets.register(assetType, {
    async load(ref) {
      const pixel = ref.id === 'red' ? [255, 0, 0, 255] : [0, 0, 255, 128];
      const pixels = new Uint8Array([...pixel, ...pixel, ...pixel, ...pixel]);
      return egret.createTexture(egret.createImageData2D({ width: 2, height: 2, pixels }));
    },
    dispose(texture) { texture.dispose(); },
  });
  const empty = engine.captureSharedFrame({ width: 8, height: 8 });
  const sources = new Map();
  for (const id of ['red', 'blue']) {
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(assetType, id)));
    const bitmap = scope.use(new egret.Bitmap(lease));
    engine.stage.addChild(bitmap);
    sources.set(id, engine.captureSharedFrame({ width: 4, height: 4 }));
    engine.stage.removeChild(bitmap);
  }
  try {
    await host.start();
    await run({ ports, host, empty, red: sources.get('red'), blue: sources.get('blue') });
  } finally {
    ports.autoSignal = true;
    ports.signalAll();
    await host.close();
    scope.dispose();
    await engine.dispose();
  }
}

function place(layer, x = 0, y = 0) {
  return { layer, x, y, width: 4, height: 4 };
}

function status(host) {
  const { residentBytes, readyLayers, pendingLayers } = host.getSharedLayerStatus();
  return { residentBytes, readyLayers, pendingLayers };
}

function attachedTexture(events, gl) {
  return events.find(event => event[0] === 'framebufferTexture2D' && event[2] === gl.COLOR_ATTACHMENT0 && event[4])?.[4];
}

function usedTexture(events, gl, texture) {
  return events.some(event => event[0] === 'bindTexture' && event[1] === gl.TEXTURE_2D && event[2] === texture);
}

test('cached ground samples the same offscreen texture when the camera changes', () => fixture(async ({ ports, host, empty, red }) => {
  const layer = host.createSharedLayer2D();
  assert.equal(layer.state, 'empty');
  const start = ports.events.length;
  await layer.update(red);
  const bake = ports.events.slice(start);
  assert.equal(layer.state, 'ready');
  assert.deepEqual(status(host), { residentBytes: 64, readyLayers: 1, pendingLayers: 0 });
  assert.deepEqual([ports.canvas.width, ports.canvas.height], [8, 8]);
  assert.equal(bake.some(event => event[0] === 'readPixels'), false);
  const cached = attachedTexture(bake, ports.gl);
  assert.ok(cached, 'bake attaches an owned offscreen texture');
  for (const [x, y] of [[0, 0], [3, -1]]) {
    const before = ports.events.length;
    host.renderSharedFrameWithLayers(empty, [place(layer, x, y)]);
    await host.whenIdle();
    const frame = ports.events.slice(before);
    assert.ok(usedTexture(frame, ports.gl, cached), 'presentation binds the existing bake target');
    assert.equal(frame.some(event => event[0] === 'texSubImage2D'), false, 'camera translation has no pixel upload');
  }
  layer.dispose();
  layer.dispose();
  assert.equal(layer.state, 'disposed');
  assert.deepEqual(status(host), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
  assert.equal(cached.deleted, true);
}));

test('invalid or foreign cached-layer inputs are refused without disturbing a ready layer', () => fixture(async ({ ports, host, empty, red }) => {
  const layer = host.createSharedLayer2D();
  const foreignPorts = glPorts();
  const foreignHost = createSharedWebGL2Host({ canvas: foreignPorts.canvas });
  try {
    await foreignHost.start();
    const foreign = foreignHost.createSharedLayer2D();
    await foreign.update(red);
    await layer.update(red);
    const before = ports.events.length;
    await assert.rejects(layer.update({ ...red }), isEgretError);
    assert.throws(() => host.renderSharedFrameWithLayers(empty, [place(foreign)]), isEgretError);
    assert.throws(() => host.renderSharedFrameWithLayers(empty, [place(layer, NaN)]), isEgretError);
    assert.equal(ports.events.length, before);
    assert.equal(layer.state, 'ready');
    assert.deepEqual(status(host), { residentBytes: 64, readyLayers: 1, pendingLayers: 0 });
  } finally {
    await foreignHost.close();
    layer.dispose();
  }
}));

test('pending replacement keeps the old texture ready and disposal rejects the new bake', () => fixture(async ({ ports, host, red, blue }) => {
  const layer = host.createSharedLayer2D();
  await layer.update(red);
  ports.autoSignal = false;
  const before = ports.events.length;
  const replacement = layer.update(blue);
  void replacement.catch(() => {});
  await until(() => ports.events.slice(before).some(event => event[0] === 'fenceSync'), 'replacement enters native submission');
  assert.equal(layer.state, 'ready');
  assert.equal(status(host).readyLayers, 1);
  assert.equal(status(host).pendingLayers, 1);
  await assert.rejects(layer.update(red), isEgretError);
  layer.dispose();
  ports.signalAll();
  await assert.rejects(replacement, isEgretError);
  await host.whenIdle();
  assert.equal(layer.state, 'disposed');
  assert.deepEqual(status(host), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
}));

test('a submitted reader pins the prior cached texture through successful replacement', () => fixture(async ({ ports, host, empty, red, blue }) => {
  const layer = host.createSharedLayer2D();
  const first = ports.events.length;
  await layer.update(red);
  const oldTexture = attachedTexture(ports.events.slice(first), ports.gl);
  assert.ok(oldTexture);

  ports.autoSignal = false;
  const second = ports.events.length;
  const replacement = layer.update(blue);
  void replacement.catch(() => {});
  const replacementEvents = ports.events.slice(second);
  const newTexture = attachedTexture(replacementEvents, ports.gl);
  const replacementFence = ports.owners.filter(owner => owner.kind === 'Sync').at(-1);
  assert.ok(newTexture && replacementFence);
  assert.notEqual(newTexture, oldTexture);
  assert.equal(layer.state, 'ready');

  const reading = ports.events.length;
  host.renderSharedFrameWithLayers(empty, [place(layer)]);
  assert.ok(usedTexture(ports.events.slice(reading), ports.gl, oldTexture));
  replacementFence.signaled = true;
  await replacement;
  assert.equal(oldTexture.deleted, false, 'accepted reader still pins prior pixels');
  assert.equal(status(host).residentBytes, 128);

  ports.signalAll();
  await host.whenIdle();
  assert.equal(oldTexture.deleted, true);
  assert.equal(status(host).residentBytes, 64);
  ports.autoSignal = true;
  const latest = ports.events.length;
  host.renderSharedFrameWithLayers(empty, [place(layer)]);
  await host.whenIdle();
  assert.ok(usedTexture(ports.events.slice(latest), ports.gl, newTexture));
  layer.dispose();
}));

test('WebGL2 generation loss makes cached pages stale until an explicit rebuild', () => fixture(async ({ ports, host, empty, red }) => {
  const layer = host.createSharedLayer2D();
  await layer.update(red);
  ports.lose();
  assert.equal(layer.state, 'stale');
  assert.deepEqual(status(host), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
  const ready = host.whenReady();
  ports.restore();
  await ready;
  assert.equal(layer.state, 'stale');
  const before = ports.events.length;
  assert.throws(() => host.renderSharedFrameWithLayers(empty, [place(layer)]), isEgretError);
  assert.equal(ports.events.length, before);
  await layer.update(red);
  assert.equal(layer.state, 'ready');
  host.renderSharedFrameWithLayers(empty, [place(layer)]);
  await host.whenIdle();
  assert.deepEqual(status(host), { residentBytes: 64, readyLayers: 1, pendingLayers: 0 });
  layer.dispose();
}));
