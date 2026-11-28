// SPDX-License-Identifier: Apache-2.0
// Kept layers of the shared WebGPU Host, through controlled GPU ports and genuine Engine captures.
// The ports prove what is made, bound, written, drawn and destroyed; they do not rasterize. Real pixels are checked by
// tools/verify-webgpu-layer-cache.mjs in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, withPorts, capture, admitted, passes } from './fixtures/gpu-shared-rendering.mjs';

const code = name => error => error instanceof egret.EgretError && error.code === 'WEBGPU_' + name;

/** Shader modules carry their code, so a test can tell a layer pipeline from the others. */
function labelShaders(f) {
  const make = f.device.createShaderModule;
  f.device.createShaderModule = function (descriptor) {
    const module = make.call(this, descriptor);
    module.code = descriptor.code;
    return module;
  };
}
const layerPipelines = f =>
  f.pipelines.filter(p => p.descriptor.fragment?.module.code?.includes('layerTexture')).map(p => p.value);

async function scene(body) {
  const engine = await egret.createEngine({
    host: {
      surface: {},
      start() {},
      stop() {},
      async close() {},
      setTimeout() {
        return () => {};
      }
    }
  });
  const scope = engine.createScope();
  const rect = (color, x, y, width, height) => {
    const sprite = scope.use(new egret.Sprite());
    sprite.graphics.beginFill(color).drawRect(x, y, width, height).endFill();
    engine.stage.addChild(sprite);
    return sprite;
  };
  // Two transparent chunks and a frame with nothing in it.
  const red = rect(0xff0000, 0, 0, 4, 4);
  const chunkRed = engine.captureSharedFrame({ width: 4, height: 4 });
  engine.stage.removeChild(red);
  const blue = rect(0x0000ff, 1, 1, 2, 2);
  const chunkBlue = engine.captureSharedFrame({ width: 4, height: 4 });
  engine.stage.removeChild(blue);
  const empty = engine.captureSharedFrame({ width: 8, height: 8 });
  try {
    await body({ engine, scope, rect, chunkRed, chunkBlue, empty });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
async function layered(body, options = {}) {
  await scene(a =>
    withPorts(async f => {
      labelShaders(f);
      const h = f.sharedHost({ enableLayers: true, ...options });
      await f.ready(h);
      await body(f, h, a);
    })
  );
}
async function bake(f, layer, frame) {
  const record = capture(f, () => layer.update(frame));
  assert.equal(record.threw, false);
  await record.finish();
  await record.value;
  return record;
}
async function place(f, h, frame, placements) {
  const record = capture(f, () => h.renderSharedFrameWithLayers(frame, placements));
  admitted(record);
  await record.finish();
  await h.whenIdle();
  return record;
}
const at = (layer, x = 0, y = 0, extra = {}) => ({ layer, x, y, width: 4, height: 4, ...extra });
const status = h => ({ ...h.getSharedLayerStatus() });
const layerTargets = textures => textures.filter(t => t.descriptor.usage === 20);
/** The bind groups a frame gave its layer draws, in painter order, with the floats of each block. */
function layerDraws(f, record) {
  const pipelines = layerPipelines(f);
  const draws = passes(record.events).flatMap(pass => pass.draws.filter(draw => pipelines.includes(draw.pipeline)));
  return draws.map(draw => {
    const entries = draw.binding.descriptor.entries,
      buffer = entries[0].resource.buffer;
    const written = record.events.filter(c => c[0] === 'writeBuffer' && c[1] === buffer).at(-1)[3];
    return {
      pipeline: draw.pipeline,
      args: draw.args,
      texture: entries[1].resource.texture,
      sampler: entries[2].resource,
      block: Array.from(new Float32Array(written.buffer, written.byteOffset, written.byteLength / 4))
    };
  });
}

// Break caught: give an ordinary Host layers, or make their pipelines at every startup.
test('LYR01 layers are an option of the Host; without it there are none and no layer pipeline', () =>
  scene(a =>
    withPorts(async f => {
      labelShaders(f);
      const h = f.sharedHost();
      await f.ready(h);
      assert.equal(layerPipelines(f).length, 0);
      assert.throws(() => h.createSharedLayer2D(), code('LAYER_DISABLED'));
      const before = f.calls.length;
      assert.throws(() => h.renderSharedFrameWithLayers(a.empty, []), code('LAYER_DISABLED'));
      assert.equal(f.calls.length, before);
      assert.deepEqual(status(h), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
      assert.throws(
        () => f.sharedHost({ enableLayers: 'yes' }),
        e => code('OPTIONS_INVALID')(e)
      );
    })
  ));

// Break caught: bake through the canvas or a pooled target, sample linearly, upload on a camera move, or keep a
// disposed layer's target.
test('LYR02 a bake draws into a target of its own, and placements sample it nearest without uploads', () =>
  layered(async (f, h, a) => {
    assert.equal(layerPipelines(f).length, 1);
    const layer = h.createSharedLayer2D();
    assert.equal(layer.state, 'empty');
    const baked = await bake(f, layer, a.chunkRed);
    assert.equal(layer.state, 'ready');
    assert.deepEqual(status(h), { residentBytes: 64, readyLayers: 1, pendingLayers: 0 });
    const [target] = layerTargets(baked.textures);
    assert.ok(target);
    assert.equal(layerTargets(baked.textures).length, 1, 'a bake makes no working target besides its own');
    assert.deepEqual(
      [target.descriptor.size.width, target.descriptor.size.height, target.descriptor.format],
      [4, 4, 'rgba8unorm-srgb']
    );
    const names = baked.events.map(c => c[0]);
    assert.equal(names.includes('target'), false, 'a bake never takes the canvas texture');
    assert.equal(names.includes('width') || names.includes('height'), false, 'a bake leaves the canvas as it is');
    assert.equal(passes(baked.events).length, 1, 'a bake has no copy to the canvas');
    assert.equal(passes(baked.events)[0].descriptor.colorAttachments[0].view.texture, target);
    assert.equal(target.destroyed, 0, 'the completed bake keeps its target');

    for (const [x, y] of [
      [0, 0],
      [3, -1]
    ]) {
      const drawn = await place(f, h, a.empty, [at(layer, x, y)]);
      const [draw] = layerDraws(f, drawn);
      assert.equal(draw.texture, target, 'a placement samples the baked target');
      assert.equal(draw.sampler.descriptor.minFilter, 'nearest');
      assert.equal(draw.sampler.descriptor.magFilter, 'nearest');
      assert.deepEqual(draw.args, [6]);
      assert.deepEqual(draw.block.slice(0, 6), [x, y, 4, 4, 8, 8]);
      assert.equal(
        drawn.events.some(c => c[0] === 'writeTexture'),
        false,
        'moving a placement uploads no pixels'
      );
    }
    layer.dispose();
    layer.dispose();
    assert.equal(layer.state, 'disposed');
    assert.equal(target.destroyed, 1);
    assert.deepEqual(status(h), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
  }));

// Break caught: draw a layer after the frame, out of order, or only at the frame's pixel ratio of one.
test('LYR03 layers lie over the clear in painter order, under the frame, and scale with the pixel ratio', () =>
  layered(
    async (f, h, a) => {
      const first = h.createSharedLayer2D(),
        second = h.createSharedLayer2D();
      const one = layerTargets((await bake(f, first, a.chunkRed)).textures)[0];
      const two = layerTargets((await bake(f, second, a.chunkBlue)).textures)[0];
      a.rect(0x00ff00, 5, 5, 1, 1);
      const frame = a.engine.captureSharedFrame({ width: 8, height: 8 });
      const drawn = await place(f, h, frame, [at(first, 1, 2), at(second, 2, 1)]);
      const draws = passes(drawn.events)[0].draws;
      const pipelines = layerPipelines(f);
      assert.deepEqual(
        draws.map(draw => pipelines.includes(draw.pipeline)),
        [true, true, false],
        'two layers, then the frame'
      );
      const layered = layerDraws(f, drawn);
      assert.deepEqual(
        layered.map(draw => draw.texture),
        [one, two]
      );
      assert.deepEqual(layered[0].block.slice(0, 6), [2, 4, 8, 8, 16, 16]);
      assert.deepEqual(layered[1].block.slice(0, 6), [4, 2, 8, 8, 16, 16]);
      assert.equal(h.getFrameDrawCalls(), 4, 'two layers, one batch and the copy to the canvas');
      first.dispose();
      second.dispose();
    },
    { pixelRatio: 2 }
  ));

// Break caught: let a refused bake or placement reach the device, or disturb a ready layer.
test('LYR04 frames a layer cannot keep and placements it cannot take are refused before native work', () =>
  layered(async (f, h, a) => {
    const layer = h.createSharedLayer2D(),
      empty = h.createSharedLayer2D();
    await bake(f, layer, a.chunkRed);
    const before = f.calls.length;
    await assert.rejects(
      layer.update(a.engine.captureSharedFrame({ width: 4, height: 4, clearAlpha: 1 })),
      code('LAYER_INVALID')
    );
    await assert.rejects(layer.update(a.engine.captureSharedFrame({ width: 2049, height: 1 })), code('LAYER_BUDGET'));
    await assert.rejects(layer.update({ ...a.chunkRed }), code('FRAME_PROFILE_UNSUPPORTED'));
    assert.throws(() => h.renderSharedFrameWithLayers(a.empty, [at(empty)]), code('LAYER_NOT_READY'));
    assert.throws(() => h.renderSharedFrameWithLayers(a.empty, [at(layer, Number.NaN)]), code('LAYER_INVALID'));
    assert.throws(() => h.renderSharedFrameWithLayers(a.empty, [at({ state: 'ready' })]), code('LAYER_INVALID'));
    assert.throws(() => h.renderSharedFrameWithLayers(a.empty, {}), code('LAYER_INVALID'));
    assert.throws(
      () =>
        h.renderSharedFrameWithLayers(
          a.empty,
          Array.from({ length: 513 }, () => at(layer))
        ),
      code('LAYER_BUDGET')
    );
    assert.throws(
      () =>
        h.renderSharedFrameWithLayers(a.empty, [
          at(layer, 0, 0, { effect: { bounds: { x: 0, y: 0, width: 1, height: 1 }, add: [1, 0, 0] } })
        ]),
      code('LAYER_EFFECT_INVALID'),
      'an effect needs a Host with effects'
    );
    // A later placement's getter disposes the layer of an earlier one: nothing is drawn.
    const other = h.createSharedLayer2D();
    await bake(f, other, a.chunkBlue);
    const disposing = {
      layer: other,
      x: 0,
      y: 0,
      width: 4,
      get height() {
        layer.dispose();
        return 4;
      }
    };
    const reading = f.calls.length;
    assert.throws(() => h.renderSharedFrameWithLayers(a.empty, [at(layer), disposing]), code('LAYER_NOT_READY'));
    assert.equal(
      f.calls.slice(reading).some(c => c[0] === 'pass'),
      false
    );
    assert.equal(
      f.calls.slice(before, reading).some(c => c[0] === 'pass' || c[0] === 'texture'),
      true,
      'only the second bake reached the device'
    );
    assert.equal(other.state, 'ready');
    await assert.rejects(layer.update(a.chunkRed), code('LAYER_DISPOSED'));
    other.dispose();
    empty.dispose();
  }));

// Break caught: admit more handles or bytes than the cache holds.
test('LYR05 the cache holds 512 handles and 32 MiB of targets', () =>
  layered(async (f, h, a) => {
    const handles = Array.from({ length: 512 }, () => h.createSharedLayer2D());
    assert.throws(() => h.createSharedLayer2D(), code('LAYER_BUDGET'));
    handles.pop().dispose();
    const large = a.engine.captureSharedFrame({ width: 2048, height: 2048 });
    await bake(f, handles[0], large);
    await bake(f, handles[1], large);
    assert.equal(status(h).residentBytes, 32 * 1024 * 1024);
    await assert.rejects(handles[2].update(a.chunkRed), code('LAYER_BUDGET'));
    handles[1].dispose();
    await bake(f, handles[2], a.chunkRed);
    assert.equal(status(h).residentBytes, 16 * 1024 * 1024 + 64);
    for (const layer of handles) layer.dispose();
    assert.deepEqual(status(h), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
  }));

// Break caught: drop the ready revision while its replacement is pending, or free a target a submitted frame samples.
test('LYR06 a replacement keeps the old revision ready, and a reader pins it until it retires', () =>
  layered(async (f, h, a) => {
    const layer = h.createSharedLayer2D();
    const old = layerTargets((await bake(f, layer, a.chunkRed)).textures)[0];
    const replacing = capture(f, () => layer.update(a.chunkBlue));
    assert.equal(replacing.threw, false);
    const fresh = layerTargets(replacing.textures)[0];
    assert.ok(fresh && fresh !== old);
    assert.equal(layer.state, 'ready');
    assert.deepEqual(status(h), { residentBytes: 128, readyLayers: 1, pendingLayers: 1 });
    await assert.rejects(layer.update(a.chunkRed), code('LAYER_PENDING'));
    const reader = capture(f, () => h.renderSharedFrameWithLayers(a.empty, [at(layer)]));
    admitted(reader);
    assert.equal(layerDraws(f, reader)[0].texture, old, 'a frame placed during the replacement samples the old pixels');
    await replacing.finish();
    await replacing.value;
    assert.equal(old.destroyed, 0, 'the submitted reader still pins the old revision');
    assert.equal(status(h).residentBytes, 128);
    await reader.finish();
    await h.whenIdle();
    assert.equal(old.destroyed, 1);
    assert.deepEqual(status(h), { residentBytes: 64, readyLayers: 1, pendingLayers: 0 });
    const latest = await place(f, h, a.empty, [at(layer)]);
    assert.equal(layerDraws(f, latest)[0].texture, fresh);
    layer.dispose();
  }));

// Break caught: publish a bake into a disposed layer, or keep its target.
test('LYR07 disposing a layer during its bake rejects the bake and releases its target', () =>
  layered(async (f, h, a) => {
    const layer = h.createSharedLayer2D();
    const pending = capture(f, () => layer.update(a.chunkRed));
    const target = layerTargets(pending.textures)[0];
    layer.dispose();
    await assert.rejects(pending.value, code('LAYER_DISPOSED'));
    assert.equal(status(h).pendingLayers, 0);
    await pending.finish();
    await h.whenIdle();
    assert.equal(target.destroyed, 1);
    assert.deepEqual(status(h), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
  }));

// Break caught: tint the wrong pixels, drop the effect's colour, or use the effect pipeline where nothing changes.
test('LYR08 an effect tints its bounds in backing pixels, and a placement it misses is drawn plainly', () =>
  layered(
    async (f, h, a) => {
      assert.equal(layerPipelines(f).length, 2);
      const layer = h.createSharedLayer2D();
      await bake(f, layer, a.chunkRed);
      const effect = { bounds: { x: 1, y: 0.5, width: 2, height: 9 }, multiply: [0.5, 1, 2], add: [0, 0.25, 0] };
      const drawn = await place(f, h, a.empty, [at(layer, 0, 0, { effect }), at(layer, 4, 4, { effect })]);
      const [lit, plain] = layerDraws(f, drawn);
      assert.notEqual(lit.pipeline, plain.pipeline);
      // Bounds at a pixel ratio of two, clipped to the 16 by 16 backing.
      assert.deepEqual(lit.block, [0, 0, 8, 8, 16, 16, 2, 1, 6, 16, 0, 0, 0.5, 1, 2, 0, 0, 0.25, 0, 0]);
      assert.deepEqual(plain.block.slice(6), new Array(14).fill(0));
      const quiet = await place(f, h, a.empty, [
        at(layer, 0, 0, { effect: { ...effect, multiply: [1, 1, 1], add: [0, 0, 0] } })
      ]);
      assert.equal(layerDraws(f, quiet)[0].pipeline, plain.pipeline, 'an effect that changes nothing is not drawn');
      layer.dispose();
    },
    { enableEffects: true, pixelRatio: 2 }
  ));

// Break caught: leave handles live after close, or a generation's layers ready after its device is lost.
test('LYR09 close disposes every layer, and a lost device leaves them stale', () =>
  layered(async (f, h, a) => {
    const layer = h.createSharedLayer2D();
    const target = layerTargets((await bake(f, layer, a.chunkRed)).textures)[0];
    await f.close(h);
    assert.equal(layer.state, 'disposed');
    assert.equal(target.destroyed, 1);
    assert.deepEqual(status(h), { residentBytes: 0, readyLayers: 0, pendingLayers: 0 });
  }).then(() =>
    layered(async (f, h, a) => {
      const layer = h.createSharedLayer2D();
      await bake(f, layer, a.chunkRed);
      const cause = Object.freeze({ reason: 'test loss' });
      f.lost.resolve(cause);
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(layer.state, 'stale');
      assert.equal(status(h).readyLayers, 0);
      f.allowUnsafe(h);
      await f.close(h, true, cause);
      assert.equal(layer.state, 'disposed');
    })
  ));
