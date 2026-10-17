// SPDX-License-Identifier: Apache-2.0
// Public emitted SDK behavior over controlled GPU ports; no native or timing claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, frame, view, image, withGpu, withAuthored, imagesOf, writesOf, submitSafe,
  admitted, code, triangleScene } from './fixtures/gpu-image-residency.mjs';

const eligible = f => f.buffers.filter(b => [40, 24, 72].includes(b.descriptor.usage));
const creations = f => f.calls.filter(c => c[0] === 'binding').map(c => c[1]);
const vertices = calls => calls.filter(c => c[0] === 'setVertexBuffer').map(c => c[2]);
const bindings = calls => calls.filter(c => c[0] === 'setBindGroup').map(c => c[2]);
const writes = (calls, usage) => calls.filter(c => c[0] === 'writeBuffer' && c[1].descriptor.usage === usage);
const floats = call => [...new Float32Array(call[3].buffer, call[3].byteOffset, call[3].byteLength / 4)];
const sameRefs = (actual, expected) => {
  assert.ok(expected.length > 0, 'reuse comparison requires an observed selection');
  assert.equal(actual.length, expected.length);
  actual.forEach((item, index) => assert.equal(item, expected[index]));
};
async function observed(f, h, input, render) {
  const start = f.calls.length;
  await submitSafe(f, h, input, render);
  return f.calls.slice(start);
}

test('B01 G01 ten settled ordinary frames reuse actual vertex uniform and binding selections', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame(), submissions = [];
    for (let i = 0; i < 10; i++) submissions.push(await observed(f, h, input));
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    assert.equal(writes(f.calls, 40).length, 10); assert.equal(writes(f.calls, 72).length, 10);
    assert.equal(eligible(f).length, 2, 'settled image draws must stop creating vertex and uniform buffers');
    assert.equal(creations(f).length, 1, 'the same leased uniform and resident image must retain their binding');
    assert.equal(vertices(submissions[0]).length, 1); assert.equal(bindings(submissions[0]).length, 1);
    for (const calls of submissions) {
      sameRefs(vertices(calls), vertices(submissions[0]));
      sameRefs(bindings(calls), bindings(submissions[0]));
      assert.equal(writes(calls, 40)[0][1], vertices(calls)[0]);
      assert.deepEqual(floats(writes(calls, 72)[0]), [1, 0, 0, 0]);
    }
    assert.ok(eligible(f).every(b => b.destroyed === 0));
    await f.close(h); assert.ok(eligible(f).every(b => b.destroyed === 1));
  });
});

test('B01 G01 genuine textured capture reuses selections while rewriting changed alpha and geometry', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.addChild(a.mesh);
    const original = a.textured(), submissions = [];
    for (let i = 0; i < 8; i++) submissions.push(await observed(f, h, original, v => h.renderTexturedFrame(v)));
    a.bitmap.alpha = .25; a.bitmap.x = 1;
    a.mesh.alpha = .5; a.mesh.x = 1; a.mesh.setContent(a.lease, a.geometry(.25));
    const changed = await observed(f, h, a.textured(), v => h.renderTexturedFrame(v));
    const replay = await observed(f, h, original, v => h.renderTexturedFrame(v));
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    assert.equal(writes(f.calls, 40).length, 20); assert.equal(writes(f.calls, 72).length, 20);
    assert.deepEqual(writes(changed, 72).map(c => floats(c)[0]), [.25, .5]);
    assert.deepEqual(writes(replay, 72).map(c => floats(c)[0]), [1, 1]);
    assert.deepEqual(floats(writes(submissions[0], 40)[1]), [
      -.75, .75, .25, .5, 1, 1, 1, 1, .25, .75, .25, .5, 1, 1, 1, 1, -.75, -.25, .25, .5, 1, 1, 1, 1,
    ]);
    assert.deepEqual(floats(writes(changed, 40)[1]), [
      -.5, .75, .25, .5, .25, .25, .25, .25, .5, .75, .25, .5, .25, .25, .25, .25,
      -.5, -.25, .25, .5, .25, .25, .25, .25,
    ]);
    assert.notDeepEqual(floats(writes(changed, 40)[1]), floats(writes(submissions[0], 40)[1]));
    assert.deepEqual(floats(writes(replay, 40)[1]), floats(writes(submissions[0], 40)[1]));
    assert.equal(eligible(f).length, 4, 'safe image and Mesh draws must reuse both buffer pairs');
    assert.equal(creations(f).length, 2, 'simultaneous image and Mesh uniforms stay distinct and reuse their bindings');
    assert.equal(vertices(submissions[0]).length, 2); assert.equal(bindings(submissions[0]).length, 2);
    for (const calls of [...submissions, changed, replay]) {
      sameRefs(vertices(calls), vertices(submissions[0]));
      sameRefs(bindings(calls), bindings(submissions[0]));
      assert.notEqual(writes(calls, 72)[0][1], writes(calls, 72)[1][1]);
    }
    await f.close(h); assert.ok(eligible(f).every(b => b.destroyed === 1));
  }));
});

test('B01 G01 settled B1 scene and ordinary overlay reuse all actual selected buffers and bindings', async () => {
  await withGpu(async f => {
    const h = f.host({}, 'scene'); await f.ready(h); const scene = triangleScene(), overlay = frame(undefined, { clearAlpha: 1 });
    const submissions = [];
    for (let i = 0; i < 10; i++) submissions.push(await observed(f, h, overlay, v => h.renderSceneFrame(scene, v)));
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    assert.equal(eligible(f).length, 5, 'B1 vertex index MVP and overlay buffers must return for reuse');
    assert.equal(creations(f).length, 2, 'scene MVP and image layouts retain separate bindings');
    assert.equal(vertices(submissions[0]).length, 2); assert.equal(bindings(submissions[0]).length, 2);
    assert.equal(submissions[0].filter(c => c[0] === 'setIndexBuffer').length, 1);
    for (const calls of submissions) {
      sameRefs(vertices(calls), vertices(submissions[0]));
      sameRefs(bindings(calls), bindings(submissions[0]));
      sameRefs(calls.filter(c => c[0] === 'setIndexBuffer').map(c => c[1]),
        submissions[0].filter(c => c[0] === 'setIndexBuffer').map(c => c[1]));
    }
    const depth = f.textures.filter(t => t.descriptor.format === 'depth32float');
    assert.equal(depth.length, 10); assert.ok(depth.every(t => t.destroyed === 1));
    assert.ok(depth.every(t => t.descriptor.size.width === 8 && t.descriptor.size.height === 8));
    await f.close(h); assert.ok(eligible(f).every(b => b.destroyed === 1));
  });
});

test('G01 settled image alpha changes reuse the actual selected binding', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const original = frame();
    const first = await observed(f, h, original);
    const changed = { ...original, commands: original.commands.map(c => ({ ...c, alpha: .25 })) };
    const second = await observed(f, h, changed);
    assert.deepEqual(writes(first, 72).map(c => floats(c)[0]), [1]);
    assert.deepEqual(writes(second, 72).map(c => floats(c)[0]), [.25]);
    assert.equal(creations(f).length, 1, 'settled resident image and rewritten uniform must reuse a complete-key binding');
    assert.equal(vertices(first).length, 1); assert.equal(bindings(first).length, 1);
    sameRefs(bindings(second), bindings(first));
  });
});

test('B01 combined genuine textured scene reuses seven eligible buffers and three actual bindings', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'combined'); await f.ready(h); a.engine.stage.addChild(a.mesh);
    const scene = triangleScene(), original = a.textured();
    const first = await observed(f, h, original, v => h.renderSceneTexturedFrame(scene, v));
    assert.equal(vertices(first).length, 3); assert.equal(bindings(first).length, 3);
    assert.equal(first.filter(c => c[0] === 'setIndexBuffer').length, 1);
    for (let i = 0; i < 9; i++) {
      const next = await observed(f, h, original, v => h.renderSceneTexturedFrame(scene, v));
      sameRefs(vertices(next), vertices(first)); sameRefs(bindings(next), bindings(first));
    }
    assert.equal(eligible(f).length, 7); assert.equal(creations(f).length, 3);
    assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
    assert.equal(f.textures.filter(t => t.descriptor.format === 'depth32float').length, 10);
    await f.close(h); assert.ok(f.buffers.every(b => b.destroyed === 1));
  }));
});

test('B04 G03 2049 legal image draws retain at most 4096 eligible buffers and warm selections remain valid', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const one = view(image()), input = frame(Array(2049).fill(one));
    const first = await observed(f, h, input);
    assert.equal(vertices(first).length, 2049); assert.equal(bindings(first).length, 2049);
    assert.equal(eligible(f).length, 4098); assert.equal(eligible(f).filter(b => b.destroyed === 0).length, 4096);
    assert.equal(eligible(f).filter(b => b.destroyed === 1).length, 2);
    assert.equal(imagesOf(f).length, 1); assert.equal(creations(f).length, 2049);
    const next = await observed(f, h, frame([one]));
    assert.equal(vertices(next).length, 1); assert.equal(bindings(next).length, 1);
    assert.equal(eligible(f).length, 4098); assert.equal(creations(f).length, 2049);
    assert.equal(vertices(next)[0], vertices(first)[0]); assert.equal(bindings(next)[0], bindings(first)[0]);
    await f.close(h); assert.ok(f.buffers.every(b => b.destroyed === 1));
  });
});

test('B05 G03 Hosts on one borrowed device never share retained buffers or bindings', async () => {
  await withGpu(async f => {
    const a = f.host(), b = f.host({ canvas: { width: 8, height: 8, getContext: () => f.context } });
    await f.ready(a); await f.ready(b); const input = frame();
    const a1 = await observed(f, a, input), b1 = await observed(f, b, input);
    const a2 = await observed(f, a, input), b2 = await observed(f, b, input);
    assert.notEqual(vertices(a1)[0], vertices(b1)[0]); assert.notEqual(bindings(a1)[0], bindings(b1)[0]);
    sameRefs(vertices(a2), vertices(a1)); sameRefs(bindings(a2), bindings(a1));
    sameRefs(vertices(b2), vertices(b1)); sameRefs(bindings(b2), bindings(b1));
    assert.equal(eligible(f).length, 4); assert.equal(creations(f).length, 2);
    await f.close(a); assert.equal(vertices(a1)[0].destroyed, 1); assert.equal(vertices(b1)[0].destroyed, 0);
    await f.close(b); assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
  });
});

test('G02 texture eviction invalidates dependent bindings while the same uniform buffer stays reusable', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const source = image(257, 1);
    const input = index => frame([view(source, { x: index, y: 0, width: 1, height: 1 })]);
    const first = await observed(f, h, input(0)), old = imagesOf(f)[0];
    for (let i = 1; i <= 256; i++) await observed(f, h, input(i));
    assert.equal(old.destroyed, 1); assert.equal(eligible(f).length, 2);
    const replay = await observed(f, h, input(0));
    assert.equal(writes(replay, 72)[0][1], writes(first, 72)[0][1]);
    assert.notEqual(bindings(replay)[0], bindings(first)[0]);
    assert.notEqual(bindings(replay)[0].descriptor.entries[0].resource.texture, old);
    assert.equal(imagesOf(f).length, 258); assert.equal(creations(f).length, 258);
    await f.close(h); assert.ok(f.buffers.every(b => b.destroyed === 1));
  });
});

test('B05 B07 G02 buffer eviction invalidates old image binding and busy victim cleanup refuses reentry', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const a = view(image()), b = view(image());
    const first = await observed(f, h, frame([a])), originalUniform = writes(first, 72)[0][1], originalImage = imagesOf(f)[0];
    await observed(f, h, frame(Array(2048).fill(b)));
    assert.equal(eligible(f).length, 4096); assert.ok(eligible(f).every(buffer => buffer.destroyed === 0));
    const rect = { kind: 'rect', matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      rect: { x: 0, y: 0, width: 1, height: 1 }, color: 0xff0000, alpha: 1, clips: [] };
    let evictions = 0;
    f.hooks.destroyBuffer = () => {
      evictions++; assert.throws(() => h.renderFrame(frame([a])), code('REENTRANT'));
    };
    // Consecutive rectangles form one packed draw. Distinct safe submissions
    // request 144 and 288 bytes, forcing two different cold buffer sizes.
    const small = await observed(f, h, frame([], { commands: [rect] }));
    const large = await observed(f, h, frame([], { commands: [rect, rect] })); delete f.hooks.destroyBuffer;
    assert.equal(vertices(small)[0].descriptor.size, 144); assert.equal(vertices(large)[0].descriptor.size, 288);
    assert.equal(evictions, 2); assert.equal(vertices(first)[0].destroyed, 1); assert.equal(originalUniform.destroyed, 1);
    assert.equal(originalImage.destroyed, 0);
    const replay = await observed(f, h, frame([a]));
    assert.notEqual(writes(replay, 72)[0][1], originalUniform); assert.notEqual(bindings(replay)[0], bindings(first)[0]);
    assert.equal(bindings(replay)[0].descriptor.entries[0].resource.texture, originalImage);
    await f.close(h); assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
  });
});

test('G03 cold collision retains only winner texture dependent bindings when both buffer pairs return', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3 }); await f.ready(h); const input = frame();
    const startA = f.calls.length, a = f.capture(() => h.renderFrame(input)); admitted(a); const callsA = f.calls.slice(startA);
    const startB = f.calls.length, b = f.capture(() => h.renderFrame(input)); admitted(b); const callsB = f.calls.slice(startB);
    await b.finish(); await a.finish(); await h.whenIdle();
    assert.equal(a.textures[0].destroyed, 1); assert.equal(b.textures[0].destroyed, 0);
    const next = await observed(f, h, { ...input, commands: [input.commands[0], input.commands[0]] });
    sameRefs(vertices(next), [vertices(callsB)[0], vertices(callsA)[0]]);
    assert.equal(bindings(next)[0], bindings(callsB)[0]); assert.notEqual(bindings(next)[1], bindings(callsA)[0]);
    assert.ok(bindings(next).every(group => group.descriptor.entries[0].resource.texture === b.textures[0]));
    assert.equal(creations(f).length, 3); await f.close(h); assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
  });
});

test('P04 warm saved genuine capture survives CPU lease disposal with the same actual selection', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.addChild(a.mesh); const saved = a.textured();
    const first = await observed(f, h, saved, v => h.renderTexturedFrame(v));
    assert.equal(vertices(first).length, 2); assert.equal(bindings(first).length, 2);
    a.lease.release(); a.engine.assets.invalidate(a.ref); a.texture.dispose();
    assert.throws(() => a.textured(), error => error instanceof egret.EgretError);
    const replay = await observed(f, h, saved, v => h.renderTexturedFrame(v));
    sameRefs(vertices(replay), vertices(first)); sameRefs(bindings(replay), bindings(first));
    assert.equal(eligible(f).length, 4); assert.equal(imagesOf(f).length, 1); assert.equal(writesOf(f).length, 1);
  }));
});
