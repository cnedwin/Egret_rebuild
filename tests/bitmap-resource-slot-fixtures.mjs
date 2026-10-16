// SPDX-License-Identifier: Apache-2.0
// Original slot witnesses. Reuse only the existing injected host/Promise helpers.
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

export { sdk, deferred, flush };
export const FRAME = Object.freeze({ width: 32, height: 32, clearColor: 0, clearAlpha: 0 });
export const CROP_A = Object.freeze({ x: 1, y: 0, width: 1, height: 2 });
export const FULL = Object.freeze({
  A: Object.freeze({ x: 0, y: 0, width: 2, height: 2 }),
  B: Object.freeze({ x: 0, y: 0, width: 3, height: 1 }),
  C: Object.freeze({ x: 0, y: 0, width: 1, height: 3 }),
});
export const PIXELS = Object.freeze({
  A: Object.freeze([255,0,0,255, 255,0,0,255, 255,0,0,255, 255,0,0,255]),
  B: Object.freeze([0,255,0,255, 0,255,0,255, 0,255,0,255]),
  C: Object.freeze([0,0,255,255, 0,0,255,255, 0,0,255,255]),
});

export function code(run, expected) {
  let result;
  assert.throws(run, error => { result = error; assert.equal(error?.code, expected); return true; });
  return result;
}
// Callback probes retain failure presence separately from its possibly undefined
// cause, then rethrow unchanged so original SDK diagnostics remain observable.
// Call assertCallback outside the SDK boundary even when the SDK catches it.
export function captureCall(run) {
  try { return { threw: false, value: run() }; }
  catch (cause) { return { threw: true, cause }; }
}
export function callbackWitness(run) {
  const calls = [];
  return { calls, callback(...args) {
    const outcome = captureCall(() => run(...args)); calls.push(outcome);
    if (outcome.threw) throw outcome.cause;
    return outcome.value;
  } };
}
export function assertCallback(witness, expectedCalls = 1) {
  assert.equal(witness.calls.length, expectedCalls, 'Every assigned callback must complete or retain its failure');
  for (const outcome of witness.calls) assert.equal(outcome.threw, false,
    'Callback failure retained outside SDK catch: ' + String(outcome.cause));
}
export function causeIncludes(error, wanted) {
  const visited = new Set();
  let current = error;
  for (let depth = 0; depth < 12; depth++) {
    if (Object.is(current, wanted)) return;
    if (current === null || (typeof current !== 'object' && typeof current !== 'function')
      || visited.has(current) || !Object.hasOwn(current, 'cause')) break;
    visited.add(current); current = current.cause;
  }
  assert.fail('Original cause missing from the observed public error chain');
}
export function observe(promise) {
  const observation = { state: 'pending', value: undefined, error: undefined, result: undefined };
  observation.result = promise.then(value => {
    observation.state = 'fulfilled'; observation.value = value;
    return { value };
  }, error => {
    observation.state = 'rejected'; observation.error = error;
    return { error };
  });
  return observation;
}
export async function rejected(observation, expected) {
  await flush();
  assert.equal(observation.state, 'rejected', 'Logical outcome must settle without awaiting provider work');
  assert.equal(observation.error?.code, expected);
  return observation.error;
}
export async function fulfilled(observation) {
  await flush();
  assert.equal(observation.state, 'fulfilled');
  assert.equal(observation.value, undefined);
}
export function literalTexture(template) {
  const area = FULL[template];
  return sdk.createTexture(sdk.createImageData2D({ width: area.width, height: area.height, pixels: new Uint8Array(PIXELS[template]) }));
}

export async function scene({ hostOverrides = {}, groupInitial = false } = {}) {
  const port = host(hostOverrides), diagnostics = [], trace = [], loads = [], jobs = [], disposals = [];
  const values = new Map(), templates = new Map(), hooks = { load: undefined, guard: undefined, dispose: undefined, diagnostic: undefined };
  for (const name of ['A', 'B', 'C']) { values.set(name, literalTexture(name)); templates.set(values.get(name), name); }
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  let f;
  const engine = await sdk.createEngine({ host: port.adapter, onDiagnostic(diagnostic) {
    diagnostics.push(diagnostic); hooks.diagnostic?.(diagnostic, f);
  } });
  const initialScope = engine.createScope(), slotScope = engine.createScope();
  const type = sdk.createAssetType('original-bitmap-slot-texture', value => {
    if (hooks.guard !== undefined) return hooks.guard(value, f);
    return sdk.isTexture(value);
  });
  const refs = new Map();
  const ref = id => {
    if (!refs.has(id)) refs.set(id, sdk.createAssetRef(type, id));
    return refs.get(id);
  };
  function deferLoad(reference, context) {
    const pending = deferred();
    const job = { id: reference.id, context, settled: false, promise: pending.promise,
      resolve(value) { assert.equal(job.settled, false); job.settled = true; pending.resolve(value); },
      reject(cause) { assert.equal(job.settled, false); job.settled = true; pending.reject(cause); },
    };
    jobs.push(job); return job;
  }
  engine.assets.register(type, {
    load(reference, context) {
      loads.push({ id: reference.id, context }); trace.push('load:' + reference.id);
      if (hooks.load !== undefined) return hooks.load(reference, context, f);
      return reference.id === 'A' ? Promise.resolve(values.get('A')) : deferLoad(reference, context).promise;
    },
    dispose(value) {
      disposals.push(value); trace.push('dispose:' + (templates.get(value) ?? 'other'));
      hooks.dispose?.(value, f);
      if (sdk.isTexture(value)) value.dispose();
    },
  });
  let initialGroup, initialLease;
  try {
    if (groupInitial) {
      initialGroup = engine.createAssetGroup(initialScope, [ref('A')]);
      [initialLease] = await initialGroup.ready;
    } else initialLease = initialScope.use(await engine.assets.acquire(ref('A')));
    const bitmap = new sdk.Bitmap(initialLease);
    bitmap.sourceRect = CROP_A;
    engine.stage.addChild(bitmap);
    const slot = engine.createBitmapResourceSlot(slotScope, bitmap);
    f = { sdk, engine, port, diagnostics, trace, loads, jobs, disposals, values, templates, hooks,
      type, ref, initialScope, slotScope, initialGroup, initialLease, bitmap, slot, unhandled, deferLoad,
      job(id, index) {
        const matching = jobs.filter(item => item.id === id);
        const selected = index === undefined ? matching.at(-1) : matching[index];
        assert.ok(selected, 'Expected genuine provider job for ' + id); return selected;
      },
      count(value) { return disposals.filter(item => item === value).length; },
      makeValue(label, template = 'B') {
        const value = literalTexture(template); values.set(label, value); templates.set(value, template); return value;
      },
      replace(id) { return observe(slot.replace(ref(id))); },
      async close() {
        try { await engine.dispose(); await flush(); assert.deepEqual(unhandled, []); }
        finally { process.removeListener('unhandledRejection', onUnhandled); }
        assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0);
      },
    };
    return f;
  } catch (cause) {
    try { await engine.dispose(); }
    finally { process.removeListener('unhandledRejection', onUnhandled); }
    throw cause;
  }
}
export function visible(f, template = 'A', crop = template === 'A' ? CROP_A : FULL[template]) {
  const frame = f.engine.captureFrame(FRAME), command = frame.commands[0];
  assert.equal(command?.kind, 'image');
  assert.deepEqual(command.sourceRect, crop);
  assert.deepEqual(command.rect, { x: 0, y: 0, width: crop.width, height: crop.height });
  assert.deepEqual(Array.from(sdk.copyImageData2DPixels(frame.images[command.imageIndex])), PIXELS[template]);
  assert.deepEqual([f.bitmap.naturalWidth, f.bitmap.naturalHeight], [crop.width, crop.height]);
  return frame;
}
export async function commit(f, name) {
  const outcome = f.replace(name); f.job(name).resolve(f.values.get(name));
  await fulfilled(outcome); assert.equal(f.slot.state, 'ready'); visible(f, name);
  return outcome;
}
