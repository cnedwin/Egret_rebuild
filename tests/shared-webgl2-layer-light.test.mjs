// SPDX-License-Identifier: Apache-2.0
// Test-owned WebGL2 ports establish admission, submissions and ownership. Native pixels are tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, glPorts } from './fixtures/gl-shared-rendering.mjs';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';

const effectError = error => error instanceof egret.EgretError && error.code === 'WEBGL2_LAYER_EFFECT_INVALID';

async function fixture(run, enableEffects = true) {
  const engine = await egret.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } },
  });
  const scope = engine.createScope();
  const ports = glPorts();
  const host = createSharedWebGL2Host({ canvas: ports.canvas, pixelRatio: 2, enableEffects });
  try {
    const frame = engine.captureSharedFrame({ width: 8, height: 8 });
    const art = scope.use(new egret.Sprite());
    art.graphics.beginFill(0x808080, 0.5).drawRect(0, 0, 4, 4).endFill();
    engine.stage.addChild(art);
    const source = engine.captureSharedFrame({ width: 4, height: 4 });
    await host.start();
    const layer = host.createSharedLayer2D();
    await layer.update(source);
    await run({ host, ports, frame, layer });
  } finally {
    await host.close();
    scope.dispose();
    await engine.dispose();
  }
}

function placement(layer, effect) {
  return { layer, x: 1, y: 1, width: 4, height: 4, ...(effect === undefined ? {} : { effect }) };
}

function region() {
  return { x: 2.25, y: 1, width: 1.5, height: 2 };
}

test('cached light is opt-in and the unchanged cache path remains available', () => fixture(async ({ host, ports, frame, layer }) => {
  const before = ports.events.length;
  assert.throws(() => host.renderSharedFrameWithLayers(frame, [placement(layer, { bounds: region() })]), effectError);
  assert.equal(ports.events.length, before);
  host.renderSharedFrameWithLayers(frame, [placement(layer)]);
  await host.whenIdle();
  assert.equal(layer.state, 'ready');
}, false));

test('cached light refuses malformed bounds and channel tuples before native work', () => fixture(async ({ host, ports, frame, layer }) => {
  const invalid = [
    null,
    { bounds: undefined },
    { bounds: { ...region(), x: NaN } },
    { bounds: { ...region(), width: -1 } },
    { bounds: { ...region(), x: 2 ** 23 } },
    { bounds: region(), multiply: [0, 1] },
    { bounds: region(), multiply: [1, Infinity, 1] },
    { bounds: region(), multiply: [1, 4.25, 1] },
    { bounds: region(), add: [0, -0.1, 0] },
    { bounds: region(), add: [0, 1.25, 0] },
  ];
  const { lastSerial } = host.getStatus();
  const before = ports.events.length;
  for (const effect of invalid) assert.throws(() => host.renderSharedFrameWithLayers(frame, [placement(layer, effect)]), effectError);
  assert.equal(host.getStatus().lastSerial, lastSerial);
  assert.equal(ports.events.length, before);
  assert.deepEqual(host.getSharedLayerStatus(), { readyLayers: 1, pendingLayers: 0, residentBytes: 64 });
}));

test('changing a light reads one descriptor and keeps the original baked texture', () => fixture(async ({ host, ports, frame, layer }) => {
  const cache = ports.events.findLast(event => event[0] === 'framebufferTexture2D' && event[2] === ports.gl.COLOR_ATTACHMENT0 && event[4])?.[4];
  assert.ok(cache);
  host.renderSharedFrameWithLayers(frame, [placement(layer)]);
  await host.whenIdle();
  const before = ports.events.length;
  const reads = [];
  const effect = {
    get bounds() { reads.push('bounds'); return region(); },
    get multiply() { reads.push('multiply'); return [0.5, 1, 2]; },
    get add() { reads.push('add'); return [0.25, 0, 0]; },
    get unknown() { assert.fail('unrecognized properties are outside the descriptor'); },
  };
  host.renderSharedFrameWithLayers(frame, [placement(layer, effect)]);
  await host.whenIdle();
  assert.deepEqual(reads.sort(), ['add', 'bounds', 'multiply']);
  const events = ports.events.slice(before);
  assert.ok(events.some(event => event[0] === 'bindTexture' && event[1] === ports.gl.TEXTURE_2D && event[2] === cache));
  assert.equal(events.some(event => ['createTexture', 'texSubImage2D', 'readPixels'].includes(event[0])), false);
  assert.deepEqual(host.getSharedLayerStatus(), { readyLayers: 1, pendingLayers: 0, residentBytes: 64 });
}));
