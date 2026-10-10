import assert from 'node:assert/strict';
import { createEngine, createImageData2D, EgretError } from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

export { deferred, flush };
export const REQUEST = Object.freeze({ text: 'A', fontFamily: 'Test', fontSize: 16,
  fontWeight: 400, fontStyle: 'normal', lineHeight: 10, locale: 'und', direction: 'ltr',
  density: 1, fillColor: 0xffffff });
export const ROW = Object.freeze({ advance: 8, hasInk: true,
  inkLeft: -1, inkTop: -4, inkRight: 7, inkBottom: 2 });
export const EMPTY_ROW = Object.freeze({ advance: 8, hasInk: false,
  inkLeft: 0, inkTop: 0, inkRight: 0, inkBottom: 0 });
export const OPTION_KEYS = Object.freeze(['provider', 'maxGenerations', 'maxPendingJobs',
  'maxWaiters', 'maxCallerLeases', 'maxResidentEntries', 'maxMetadataBytes',
  'maxLogicalImageBytes', 'maxPendingRasterBytes']);
export const PROVIDER_KEYS = Object.freeze(['identity', 'profile', 'measure', 'rasterize', 'release']);
export const REQUEST_KEYS = Object.freeze(Object.keys(REQUEST));
export const request = (overrides = {}) => ({ ...REQUEST, ...overrides });

// These bytes are a literal raster substitute, never a font or GPU pixel oracle.
export function image(width = 12, height = 10) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([17, 83, 149, 255], i);
  return createImageData2D({ width, height, pixels });
}
export function issue(requestValue, context, row = ROW, baselineOffset = 5) {
  return context.createPlan({ baselineOffset,
    lines: requestValue.sourceLines.map(() => ({ ...row })) });
}
export function literalProvider(hooks = {}) {
  const state = { measure: 0, raster: 0, release: 0, requests: [], plans: [],
    measureContexts: [], rasterContexts: [], images: [], released: [], events: [] };
  const provider = {
    identity: 'literal.t1', profile: 'canvas-explicit-lines-v1',
    async measure(value, context) {
      state.measure++; state.requests.push(value); state.measureContexts.push(context);
      state.events.push('measure');
      const plan = hooks.measure ? await hooks.measure(value, context, state)
        : issue(value, context, hooks.blank ? EMPTY_ROW : ROW);
      state.plans.push(plan); return plan;
    },
    async rasterize(plan, context) {
      state.raster++; state.rasterContexts.push(context); state.events.push('raster');
      const value = hooks.rasterize ? await hooks.rasterize(plan, context, state)
        : plan.metrics.raster === undefined ? undefined
          : image(plan.metrics.raster.width, plan.metrics.raster.height);
      state.images.push(value); return value;
    },
    release(plan) {
      state.release++; state.released.push(plan); state.events.push('release');
      if (hooks.release) hooks.release(plan, state);
    },
  };
  return { provider, state };
}
export async function entry() {
  const value = await import('@egret/engine/text');
  assert.equal(typeof value.createTextRasterCache, 'function');
  return value.createTextRasterCache;
}
export async function engineFixture(t, options = {}) {
  const diagnostics = [], adapter = host(options.hostOverrides);
  const engine = await createEngine({ host: adapter.adapter,
    onDiagnostic: (value) => diagnostics.push(value) });
  t.after(async () => { await engine.dispose(); });
  return { engine, diagnostics, adapter };
}
export async function fixture(t, hooks = {}, options = {}, engineOptions = {}) {
  const base = await engineFixture(t, engineOptions), literal = literalProvider(hooks);
  const create = await entry();
  const cache = create(base.engine.assets, { ...options, provider: literal.provider });
  t.after(() => cache.dispose());
  return { ...base, ...literal, cache, create };
}
export function errorIs(code, cause, checkCause = arguments.length > 1) {
  return (error) => {
    assert.ok(error instanceof EgretError);
    assert.equal(error.code, code);
    if (checkCause) assert.equal(error.cause, cause);
    return true;
  };
}
export async function rejected(promise, code, cause, checkCause = arguments.length > 2) {
  assert.ok(promise instanceof Promise, 'public rejection must use a Promise');
  let found;
  await assert.rejects(promise, (error) => { found = error; return errorIs(code, cause, checkCause)(error); });
  return found;
}
export function keep(promise) {
  let settled = false;
  const observed = promise.then((value) => { settled = true; return { value }; },
    (error) => { settled = true; return { error }; });
  return { observed, get settled() { return settled; } };
}
export async function fulfilled(held) {
  const outcome = await held.observed;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}
export async function rejectedKept(held, code, cause, checkCause = arguments.length > 2) {
  const outcome = await held.observed;
  assert.ok('error' in outcome, 'controlled operation must reject');
  errorIs(code, cause, checkCause)(outcome.error);
  return outcome.error;
}
export function release(value) { if (value?.kind === 'image') value.lease.release(); }
export function assertImage(value) {
  assert.equal(value.kind, 'image'); assert.equal(typeof value.lease.release, 'function');
  assert.equal(value.lease.value.imageData.width, value.metrics.raster.width);
  return value.lease.value;
}
// A structural CancellationSignal is allowed by the public contract. It is not
// an asset, lease, frame, issuer or simulated native renderer.
export function signal(hooks = {}) {
  let aborted = false, reason;
  const listeners = new Set(), events = [], counters = { add: 0, remove: 0 };
  const value = {
    get aborted() { return aborted; }, get reason() { return reason; },
    addEventListener(type, listener) {
      assert.equal(type, 'abort'); counters.add++; events.push('add-enter');
      listeners.add(listener); hooks.add?.(control, listener); events.push('add-exit');
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'abort'); counters.remove++; events.push('remove');
      listeners.delete(listener); hooks.remove?.(control, listener);
    },
  };
  const control = { value, counters, events,
    abort(why) {
      if (aborted) return;
      aborted = true; reason = why;
      for (const listener of [...listeners]) listener();
    },
    get listenerCount() { return listeners.size; } };
  return control;
}
export function poisonReads(keys, counter) {
  const result = {};
  for (const key of keys) Object.defineProperty(result, key, { get() {
    counter.reads++; throw new Error(`unexpected read: ${key}`);
  } });
  return result;
}
export function readLog(values, keys, log, prefix = '', hooks = {}) {
  const result = {};
  for (const key of keys) Object.defineProperty(result, key, { get() {
    log.push(prefix + key); hooks[key]?.(); return values[key];
  } });
  return result;
}
