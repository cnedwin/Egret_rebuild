// SPDX-License-Identifier: Apache-2.0
// The blend space of a frame: `linear` light, the engine's default, or the stored `srgb` codes, as a 2D canvas mixes
// them. The frame records its space; a Host is made for one space and draws only frames of it; a Host of `srgb`
// keeps its working targets as RGBA8 codes, clears them to codes, and has every draw write its colour encoded.
// The ports are controlled: they prove formats, sources and calls. examples/blend-space/verify.mjs draws the pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';
import { glPorts } from './fixtures/gl-shared-rendering.mjs';
import { withPorts, capture, admitted, passes } from './fixtures/gpu-shared-rendering.mjs';
import { prepareEffects2D } from '../packages/engine/dist/rendering/sharedEffects2D.js';
import { sharedBlendSpace2D, sharedTargetChannel2D } from '../packages/engine/dist/rendering/sharedColor2D.js';
import { blendChecks } from '../examples/blend-space/verify.mjs';

const decode = code => (code / 255 <= 0.04045 ? code / 255 / 12.92 : ((code / 255 + 0.055) / 1.055) ** 2.4);
const GL_LINEAR = 9729;
const hasCode = code => error => error?.code === code;

/** An Engine whose stage holds one translucent white square, optionally inside a glow. */
async function staged(run, { glow = false } = {}) {
  const engine = await egret.createEngine({
      host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
    }),
    scope = engine.createScope();
  try {
    const holder = engine.stage.addChild(scope.use(new egret.DisplayObjectContainer()));
    const square = holder.addChild(scope.use(new egret.Sprite()));
    square.graphics.beginFill(0xffffff, 0.1).drawRect(0, 0, 4, 4).endFill();
    if (glow) holder.renderEffect = { glow: { color: 0x336699, blur: 2, strength: 1 } };
    await run((options = {}) =>
      engine.captureSharedFrame({ width: 8, height: 8, clearColor: 0x1c2433, clearAlpha: 1, ...options })
    );
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}

// Break caught: record one recipe for both spaces, pair a recipe with the other space's target, or take any word.
test('BLD01 a frame records its blend space as a recipe and a target, linear unless given', async () => {
  await staged(async frame => {
    const linear = frame(),
      srgb = frame({ blendSpace: 'srgb' });
    assert.equal(linear.colorRecipe, 'egret.linear-srgb-pma/1');
    assert.equal(linear.targetRepresentation, 'egret.srgb-pma8-target/1');
    assert.equal(srgb.colorRecipe, 'egret.srgb-pma/1');
    assert.equal(srgb.targetRepresentation, 'egret.encoded-srgb-pma8-target/1');
    assert.equal(sharedBlendSpace2D(linear), 'linear');
    assert.equal(sharedBlendSpace2D(srgb), 'srgb');
    assert.equal(
      sharedBlendSpace2D({ colorRecipe: 'egret.srgb-pma/1', targetRepresentation: 'egret.srgb-pma8-target/1' }),
      undefined
    );
    for (const blendSpace of ['gamma', 'SRGB', 1, null])
      assert.throws(() => frame({ blendSpace }), hasCode('INVALID_FRAME_OPTIONS'));
  });
});

// Break caught: clear a target of codes to light, or give a glow of an srgb frame its colour in linear light.
test('BLD02 a colour is held as light in a linear target and as its code in an srgb one', async () => {
  assert.equal(sharedTargetChannel2D('srgb', 0x80), 128 / 255);
  assert.equal(sharedTargetChannel2D('linear', 0x80), decode(128));
  assert.equal(sharedTargetChannel2D('srgb', 0x1c2433 >>> 16), 28 / 255);
  await staged(
    async frame => {
      const glowColour = space => [
        ...prepareEffects2D(frame({ blendSpace: space }), 1, true).groups[0].uniform.subarray(116, 119)
      ];
      assert.deepEqual(
        glowColour('srgb'),
        [0x33, 0x66, 0x99].map(code => Math.fround(code / 255))
      );
      assert.deepEqual(
        glowColour('linear'),
        [0x33, 0x66, 0x99].map(code => Math.fround(decode(code)))
      );
    },
    { glow: true }
  );
});

// Break caught: let an srgb Host keep SRGB8_ALPHA8 targets, clear them to light, write light, or draw a frame of the
// other space; or let a linear Host change at all.
test('BLD03 a WebGL2 Host of srgb keeps RGBA8 targets of codes and writes every draw encoded', async () => {
  assert.throws(
    () => createSharedWebGL2Host({ canvas: glPorts().canvas, blendSpace: 'gamma' }),
    hasCode('WEBGL2_OPTIONS_INVALID')
  );
  for (const space of ['linear', 'srgb']) {
    const f = glPorts(space === 'srgb' ? { workingEncoding: GL_LINEAR } : {}),
      gl = f.gl,
      host = createSharedWebGL2Host({ canvas: f.canvas, blendSpace: space });
    await host.start();
    await staged(async frame => {
      host.renderSharedFrame(frame({ blendSpace: space }));
      await host.whenIdle();
      const other = space === 'srgb' ? 'linear' : 'srgb';
      assert.throws(
        () => host.renderSharedFrame(frame({ blendSpace: other })),
        hasCode('WEBGL2_FRAME_PROFILE_UNSUPPORTED')
      );
    });
    const storage = f.events.filter(row => row[0] === 'texStorage2D').map(row => row[3]);
    assert.ok(storage.length > 0);
    // Pages are RGBA8 in both; working targets are SRGB8_ALPHA8 only in linear.
    assert.equal(storage.includes(gl.SRGB8_ALPHA8), space === 'linear');
    const clear = f.events
      .filter(row => row[0] === 'clearColor')
      .at(-1)
      .slice(1);
    const ground = space === 'srgb' ? [28, 36, 51].map(code => code / 255) : [28, 36, 51].map(decode);
    assert.deepEqual(clear, [...ground, 1]);
    const sources = f.events.filter(row => row[0] === 'shaderSource').map(row => row[2]);
    const drawing = sources.filter(source => source.includes('vec4 finished(vec4 c)'));
    // The solid draw and the draws of one and of several pages.
    assert.equal(drawing.length, 3);
    for (const source of drawing) {
      assert.equal(source.includes('pow(u, vec3(1.0 / 2.4))'), space === 'srgb');
      assert.match(source, /fragmentColor = finished\(tinted\(/);
    }
    const resolve = sources.find(source => source.includes('uniform highp sampler2D workingTexture'));
    assert.equal(resolve.includes('vec4(a * encoded(c / a), a)'), space === 'linear');
    await host.close();
    assert.equal(f.live().length, 0);
  }
});

// Break caught: give an srgb WebGPU Host targets or pipelines of rgba8unorm-srgb, clear to light, or draw the other space.
test('BLD04 a WebGPU Host of srgb makes rgba8unorm targets and pipelines, and clears to codes', async () => {
  await withPorts(async f => {
    assert.throws(() => f.sharedHost({ blendSpace: 'gamma' }), hasCode('WEBGPU_OPTIONS_INVALID'));
    const host = f.sharedHost({ blendSpace: 'srgb' });
    await f.ready(host);
    await staged(async frame => {
      const record = capture(f, () => host.renderSharedFrame(frame({ blendSpace: 'srgb' })));
      admitted(record);
      const formats = new Set(
        f.pipelines.filter(p => p.descriptor.vertex.buffers?.length).map(p => p.descriptor.fragment.targets[0].format)
      );
      assert.deepEqual([...formats], ['rgba8unorm']);
      const targets = record.textures.filter(t => t.descriptor.usage === 20);
      assert.ok(targets.length > 0);
      assert.ok(targets.every(t => t.descriptor.format === 'rgba8unorm'));
      // Every draw's shader writes its colour encoded: the solid draw and the draws of one and of several pages.
      const drawing = f.calls.filter(c => c[0] === 'shader' && c[1].code.includes('fn finished('));
      assert.equal(drawing.length, 3 * 6);
      assert.ok(drawing.every(c => c[1].code.includes('pow(u, vec3<f32>(1.0 / 2.4))')));
      const resolving = f.calls.filter(c => c[0] === 'shader' && c[1].code.includes('var workingTexture'));
      assert.equal(resolving.length, 1);
      assert.ok(!resolving[0][1].code.includes('a * encoded(c / a)'));
      const clear = passes(record.events)[0].descriptor.colorAttachments[0].clearValue;
      assert.deepEqual([clear.r, clear.g, clear.b, clear.a], [28 / 255, 36 / 255, 51 / 255, 1]);
      await record.finish();
      await host.whenIdle();
      assert.throws(() => host.renderSharedFrame(frame()), hasCode('WEBGPU_FRAME_PROFILE_UNSUPPORTED'));
    });
  });
});

// Break caught: make Play mix light by default, or take a blend space Play does not know.
test('BLD05 Play mixes as a 2D canvas does unless asked, and refuses a space it does not know', async () => {
  const { play } = await import('@egret/engine/play');
  await assert.rejects(play({ width: 10, height: 10, blendSpace: 'gamma' }), hasCode('PLAY_OPTIONS_INVALID'));
});

// Break caught: pass an srgb picture that is off from the 2D canvas, or a linear one whose faint white is not stronger.
test('BLD06 the browser check calls srgb right only when every square is the 2D canvas colour', () => {
  const canvas = { faintWhite: [51, 58, 71], opaque: [128, 128, 128], halfRedOverBlue: [128, 0, 127] };
  const same = { faintWhite: [50, 57, 71], opaque: [128, 128, 128], halfRedOverBlue: [127, 0, 127] };
  assert.ok(Object.values(blendChecks('srgb', same, canvas)).every(Boolean));
  const light = { faintWhite: [93, 96, 101], opaque: [128, 128, 128], halfRedOverBlue: [187, 0, 187] };
  assert.ok(!Object.values(blendChecks('srgb', light, canvas)).every(Boolean));
  assert.ok(Object.values(blendChecks('linear', light, canvas)).every(Boolean));
  assert.ok(!Object.values(blendChecks('linear', same, canvas)).every(Boolean));
});
