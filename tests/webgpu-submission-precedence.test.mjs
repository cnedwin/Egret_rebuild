// SPDX-License-Identifier: Apache-2.0
// Controlled allocation/counter UNIT over genuine built public SDK objects.
// Float32Array interception follows the existing textured Host H04 allocation
// seam. Uint8Array interception counts tight crop allocations only before the
// first native error scope; the source copy uses a captured intrinsic. Neither
// observation is physical OOM, total CPU allocation/copy bytes or native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, tick, code, watched, frame, image, view, triangleScene, withGpu,
  withAuthored, imagesOf, writesOf, admitted, submitSafe, snapshot } from './fixtures/gpu-image-residency.mjs';

function observePacking(f, run, fault) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Float32Array');
  let attempts = 0, record;
  try {
    Object.defineProperty(globalThis, 'Float32Array', { ...descriptor,
      value: new Proxy(descriptor.value, { construct(target, args, newTarget) {
        // One image quad is six four-component vertices in every selected route.
        if (args.length === 1 && args[0] === 24) { attempts++; if (fault !== undefined) throw fault; }
        return Reflect.construct(target, args, newTarget);
      } }),
    });
    record = f.capture(run);
  } finally { Object.defineProperty(globalThis, 'Float32Array', descriptor); }
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'Float32Array'), descriptor);
  return { attempts, record };
}

function observeCrops(f, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
  const previousPush = f.hooks.push, counts = [];
  let preparing = true, record; const start = f.calls.length;
  f.hooks.push = (...args) => { preparing = false; return previousPush?.(...args); };
  try {
    Object.defineProperty(globalThis, 'Uint8Array', { ...descriptor,
      value: new Proxy(descriptor.value, { construct(target, args, newTarget) {
        if (preparing && args.length === 1 && args[0] === 4) counts.push(4);
        return Reflect.construct(target, args, newTarget);
      } }),
    });
    record = f.capture(run);
  } finally {
    Object.defineProperty(globalThis, 'Uint8Array', descriptor);
    if (previousPush === undefined) delete f.hooks.push; else f.hooks.push = previousPush;
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array'), descriptor);
  admitted(record); return { record, counts, calls: f.calls.slice(start) };
}

const isTextured = kind => kind === 'textured' || kind === 'combined';
function inputFor(a, kind, dimensions = { width: 8, height: 8 }) {
  const options = { ...dimensions, clearAlpha: 1 };
  return isTextured(kind) ? a.engine.captureTexturedFrame(options) : a.engine.captureFrame(options);
}
function renderer(h, kind, scene) {
  return { ordinary: value => h.renderFrame(value), textured: value => h.renderTexturedFrame(value),
    scene: value => h.renderSceneFrame(scene, value), combined: value => h.renderSceneTexturedFrame(scene, value) }[kind];
}

for (const kind of ['ordinary', 'scene', 'textured', 'combined']) {
  for (const warm of [false, true]) {
    for (const refusal of ['pending', 'readback-budget', 'readback-device']) {
      test((refusal === 'pending' ? 'P03a' : 'P03b') + ' UNIT ' + kind + ' ' + (warm ? 'qualified-warm' : 'cold') + ' packing allocation versus ' + refusal, async () => {
        await withAuthored(a => withGpu(async f => {
          if (refusal === 'readback-device') f.limits.maxBufferSize = 2047;
          const options = { enableReadback: true, maxPendingFrames: 1,
            maxReadbackBytes: refusal === 'readback-budget' ? 2303 : 2304 };
          const scene = triangleScene(), input = inputFor(a, kind), smaller = inputFor(a, kind, { width: 8, height: 7 });
          assert.deepEqual(input.commands.map(command => command.kind), ['image']);
          // Every assigned fault has its own healthy forwarding baseline Host.
          // It closes before the target Host starts, so a cold target has no hits.
          const baseline = f.host(options, kind); await f.ready(baseline);
          const healthy = observePacking(f, () => renderer(baseline, kind, scene)(input));
          admitted(healthy.record); assert.equal(healthy.attempts, 1);
          await healthy.record.finish(); await baseline.whenIdle(); await f.close(baseline);
          const h = f.host(options, kind); await f.ready(h); const render = renderer(h, kind, scene);
          if (warm) {
            const ready = await submitSafe(f, h, input, render);
            assert.equal(ready.textures.filter(texture => texture.isImage).length, 1);
            assert.equal(ready.textures.find(texture => texture.isImage).destroyed, 0);
            const verifiedHit = observeCrops(f, () => render(input));
            assert.deepEqual(verifiedHit.counts, []); assert.equal(verifiedHit.record.textures.filter(texture => texture.isImage).length, 0);
            await verifiedHit.record.finish(); await h.whenIdle();
          }
          let held;
          if (refusal === 'pending') {
            // The ordinary clear-only call consumes the same Host ledger without
            // realizing the tested image or binding the later readback ticket.
            held = f.capture(() => h.renderFrame(frame([], { clearAlpha: 1 })));
            admitted(held); assert.equal(h.getStatus().pendingFrames, 1);
          }
          const ticket = h.requestReadback(); ticket.catch(() => {}); const ticketState = watched(ticket);
          const before = snapshot(f, h), serial = h.getStatus().lastSerial;
          const cause = new egret.EgretError('WEBGPU_FRAME_BUDGET', { cause: { controlledPackAllocation: true } });
          const failed = observePacking(f, () => render(input), cause);
          assert.equal(failed.record.threw, true); assert.ok(failed.record.error instanceof egret.EgretError);
          if (!isTextured(kind)) {
            assert.equal(failed.attempts, 1); assert.ok(code('FRAME_INVALID')(failed.record.error));
            assert.equal(failed.record.error.cause, cause, 'the exact original pack-allocation cause outranks the competing refusal');
          } else {
            assert.equal(failed.attempts, 0, 'storage refusal precedes the real two-dimensional pack allocation');
            const expected = refusal === 'pending' ? 'BACKPRESSURE' : refusal === 'readback-budget' ? 'FRAME_BUDGET' : 'DEVICE_LIMIT';
            assert.ok(code(expected)(failed.record.error)); assert.notEqual(failed.record.error.cause, cause);
            assert.equal(failed.record.error.cause.reason, refusal === 'pending' ? 'backpressure' : refusal === 'readback-budget' ? 'budget' : 'device');
            assert.equal(failed.record.error.cause.facet, refusal === 'pending' ? 'frames' : 'readback');
          }
          assert.deepEqual(snapshot(f, h), before, 'refusal preserves serial, charges, surface and every native call count');
          assert.equal(failed.record.scopes.length, 0); assert.equal(failed.record.fences.length, 0); assert.equal(failed.record.maps.length, 0);
          await tick(); assert.equal(ticketState.settled, false); assert.equal(h.getStatus().state, 'active');
          await assert.rejects(h.requestReadback(), code('READBACK_PENDING'));
          if (held) await held.finish();
          // Restored no-fault execution binds the original ticket to the next
          // accepted serial; smaller readback is 1792 staging + 224 output bytes.
          const accepted = observePacking(f, () => render(refusal === 'pending' ? input : smaller));
          admitted(accepted.record); assert.equal(accepted.attempts, 1); await accepted.record.finish();
          const output = await ticket; assert.equal(output.serial, serial + 1);
          assert.equal(output.width, 8); assert.equal(output.height, refusal === 'pending' ? 8 : 7);
          await h.whenIdle(); assert.equal(h.getStatus().lastSerial, serial + 1); await f.close(h);
          assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
        }));
      });
    }
  }
}

test('P02 UNIT ordinary mixed hit and miss copy only the cold projection while preserving full upload charges', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h);
    const a = view(image(1, 1, new Uint8Array([255, 0, 0, 255]))), b = view(image(1, 1, new Uint8Array([0, 255, 0, 255])));
    const cold = observeCrops(f, () => h.renderFrame(frame([a]))); assert.deepEqual(cold.counts, [4]);
    await cold.record.finish(); await h.whenIdle();
    const mixed = observeCrops(f, () => h.renderFrame(frame([a, b]))); assert.deepEqual(mixed.counts, [4]);
    assert.equal(h.getStatus().pendingUploadBytes, 224); assert.equal(mixed.record.textures.filter(t => t.isImage).length, 1);
    assert.deepEqual(mixed.calls.filter(call => call[0] === 'writeTexture').map(call => [...call[2]]), [[0, 255, 0, 255]]);
    await mixed.record.finish(); await h.whenIdle();
    const warm = observeCrops(f, () => h.renderFrame(frame([a, b]))); assert.deepEqual(warm.counts, []);
    assert.equal(h.getStatus().pendingUploadBytes, 224); await warm.record.finish(); await h.whenIdle();
    assert.equal(imagesOf(f).length, 2); assert.equal(writesOf(f).length, 2);
  });
});

let resourceSequence = 0;
async function addBitmap(a, source, crop) {
  const texture = egret.createTexture(source, crop), key = 'submission-copy-' + (++resourceSequence);
  const type = egret.createAssetType(key, egret.isTexture);
  a.engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
  const lease = await a.engine.assets.acquire(egret.createAssetRef(type, key));
  const bitmap = a.scope.use(new egret.Bitmap(lease)); a.engine.stage.addChild(bitmap);
  return { bitmap, close() { bitmap.dispose(); lease.release(); texture.dispose(); } };
}

for (const variant of ['different-image', 'equal-bytes-identity', 'different-crop']) test('P02 UNIT genuine textured mixed ' + variant + ' copies only its independent cold view', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h);
    const first = observeCrops(f, () => h.renderTexturedFrame(a.textured())); assert.deepEqual(first.counts, [4]);
    await first.record.finish(); await h.whenIdle();
    const source = variant === 'different-crop' ? a.source : variant === 'equal-bytes-identity'
      ? image(2, 1, egret.copyImageData2DPixels(a.source)) : image(1, 1, new Uint8Array([0, 255, 0, 255]));
    const extra = await addBitmap(a, source, { x: variant === 'different-crop' ? 1 : 0, y: 0, width: 1, height: 1 });
    try {
      const input = a.textured(); assert.equal(input.commands.length, 2);
      const mixed = observeCrops(f, () => h.renderTexturedFrame(input)); assert.deepEqual(mixed.counts, [4]);
      assert.equal(h.getStatus().pendingUploadBytes, 224); assert.equal(h.getTexturedStatus().pendingGeometryBytes, 0);
      assert.equal(mixed.record.textures.filter(texture => texture.isImage).length, 1);
      assert.equal(mixed.calls.filter(call => call[0] === 'writeTexture').length, 1);
      const expected = variant === 'different-crop' ? [0, 64, 128, 128] : variant === 'equal-bytes-identity' ? [255, 64, 0, 255] : [0, 255, 0, 255];
      assert.deepEqual([...mixed.calls.find(call => call[0] === 'writeTexture')[2]], expected);
      await mixed.record.finish(); await h.whenIdle();
      const bothWarm = observeCrops(f, () => h.renderTexturedFrame(input)); assert.deepEqual(bothWarm.counts, []);
      assert.equal(h.getStatus().pendingUploadBytes, 224); await bothWarm.record.finish(); await h.whenIdle();
      assert.equal(imagesOf(f).length, 2); assert.equal(writesOf(f).length, 2);
    } finally { extra.close(); }
  }));
});

for (const kind of ['ordinary', 'textured']) for (const warm of [false, true]) test('P02 P04 UNIT ' + kind + ' ' + (warm ? 'resident' : 'nonresident') + ' zero coverage keeps its projection copy', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, kind); await f.ready(h); const render = renderer(h, kind);
    if (warm) await submitSafe(f, h, inputFor(a, kind), render);
    a.bitmap.x = 16; const input = inputFor(a, kind); assert.equal(input.commands.length, 1);
    const noCoverage = observeCrops(f, () => render(input)); assert.deepEqual(noCoverage.counts, [4]);
    assert.equal(noCoverage.record.textures.length, 0); assert.equal(noCoverage.record.buffers.length, 0);
    assert.equal(h.getStatus().pendingUploadBytes, 0); await noCoverage.record.finish(); await h.whenIdle();
    const repeated = observeCrops(f, () => render(input)); assert.deepEqual(repeated.counts, [4]); await repeated.record.finish();
    assert.equal(imagesOf(f).length, warm ? 1 : 0); assert.equal(writesOf(f).length, warm ? 1 : 0);
  }));
});

for (const variant of ['empty', 'represented-collapse']) test('P02 P04 UNIT genuine ' + variant + ' Mesh keeps nonresident copy and original admission charges', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.removeChild(a.bitmap);
    const geometry = egret.createTexturedGeometry2D(variant === 'empty'
      ? { positions: new Float64Array(), uvs: new Float64Array(), lightColors: new Float64Array(), indices: new Uint32Array() }
      : { positions: new Float64Array([1, 1, 5, 1, 1, 1 + 2 ** -40]), uvs: new Float64Array(6).fill(.5),
        lightColors: new Float64Array(12).fill(1), indices: new Uint32Array([0, 1, 2]) });
    a.mesh.setContent(a.lease, geometry); a.engine.stage.addChild(a.mesh); const input = a.textured();
    assert.deepEqual(input.commands.map(command => command.kind), ['mesh']);
    for (let i = 0; i < 2; i++) {
      const run = observeCrops(f, () => h.renderTexturedFrame(input)); assert.deepEqual(run.counts, [4]);
      assert.equal(run.record.textures.length, 0); assert.equal(run.record.buffers.length, 0);
      assert.equal(h.getStatus().pendingUploadBytes, variant === 'empty' ? 0 : 112);
      assert.equal(h.getTexturedStatus().pendingGeometryBytes, variant === 'empty' ? 0 : 204);
      await run.record.finish(); await h.whenIdle();
    }
    assert.equal(imagesOf(f).length, 0); assert.equal(writesOf(f).length, 0);
  }));
});
