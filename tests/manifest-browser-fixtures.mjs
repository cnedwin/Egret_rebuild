// SPDX-License-Identifier: Apache-2.0
// Private draft destined for tests/manifest-browser-fixtures.mjs.
// Test-owned transport only; real Web Crypto and built public SDK objects remain.
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import * as egret from '@egret/engine';
import { description, entry } from './fixtures/resource-manifest.mjs';
import { controlledFixture, STRUCTURAL_RGBA, deferred, observe } from './browser-png-fixture.mjs';

export { egret, controlledFixture, STRUCTURAL_RGBA, deferred, observe };
export const baseUrl = 'https://resources.example.test/project/';
export const bytes = new Uint8Array(STRUCTURAL_RGBA);
export const sha = value => createHash('sha256').update(value).digest('hex');
const contracts = await import('@egret/contracts/resources').catch(error => ({ missing: error.message }));
const resources = await import('@egret/engine/resources').catch(error => ({ missing: error.message }));
const browser = await import('@egret/engine/web/resources').catch(error => ({ missing: error.message }));

export function api() {
  assert.equal(typeof contracts.buildResourceManifest, 'function', 'M1.5 manifest admission absent: ' + (contracts.missing ?? ''));
  assert.equal(typeof resources.createManifestAssetBinding, 'function', 'M1.5 binding authority absent: ' + (resources.missing ?? ''));
  assert.equal(typeof browser.createManifestByteSource, 'function', 'M1.5 byte source absent: ' + (browser.missing ?? ''));
  assert.equal(typeof browser.createManifestTextureProvider, 'function', 'M1.5 PNG assembly absent: ' + (browser.missing ?? ''));
  return { contracts, resources, browser };
}
export function selection({ count = 1, type = egret.createAssetType('manifest-test-texture', egret.isTexture), mutate, payload = bytes } = {}) {
  const { contracts, resources } = api();
  const entries = Array.from({ length: count }, (_, index) => {
    const item = entry('e_asset_' + index);
    item.resourceKind = 'image'; item.artifactFormatVersion = 'png/1';
    item.source = { ...item.source, id: 'f_source_' + index, path: 'sources/' + index + '.bin' };
    item.artifact = { ...item.artifact, id: 'f_artifact_' + index, path: 'assets/' + index + '.png', mediaType: 'image/png', byteLength: payload.byteLength, sha256: sha(payload) };
    return item;
  });
  const input = description(entries);
  if (mutate) mutate(input);
  const admitted = contracts.buildResourceManifest(input);
  assert.equal(admitted.ok, true, JSON.stringify(admitted.diagnostics));
  const manifest = admitted.value;
  const bindings = manifest.entries.map(item => resources.createManifestAssetBinding(manifest, item.id, type));
  return { manifest, bindings, type, input, payload };
}
export function context() {
  const controller = new egret.CancellationController();
  return { controller, value: Object.freeze({ signal: controller.signal, resourceGeneration: 1, taskId: 1 }) };
}
export async function until(predicate, message = 'controlled operation did not enter', timeout = 1000) {
  const end = performance.now() + timeout;
  while (!predicate()) {
    assert.ok(performance.now() < end, message);
    await new Promise(resolve => setImmediate(resolve));
  }
}
export async function pending(promise, label) {
  let settled = false;
  void observe(promise).then(() => { settled = true; });
  for (let index = 0; index < 12; index++) await Promise.resolve();
  assert.equal(settled, false, label);
}
export async function refused(promise, code) {
  const result = await observe(promise);
  assert.equal(result.fulfilled, false, 'expected refusal');
  if (code !== undefined) assert.equal(result.cause?.code, code);
  return result.cause;
}

// No global operation is replaced in this helper. Only the two named test files
// pass their exact saved fetch descriptor and install/restore their owned fetch.
export function transportFixture() {
  api();
  assert.equal(globalThis.crypto, webcrypto, 'the actual Node Web Crypto object must remain unchanged');
  assert.equal(typeof globalThis.crypto.subtle.digest, 'function');
  const fixture = { calls: [], responses: [], holds: [], owners: [], observed: [], issued: [], cleaning: false, route: undefined };
  fixture.hold = fallback => {
    const task = deferred(); let settled = false;
    const owned = { promise: task.promise, get settled() { return settled; },
      resolve(value = fallback) { if (!settled) { settled = true; task.resolve(value); } },
      reject(cause) { if (!settled) { settled = true; task.reject(cause); } },
    };
    fixture.holds.push(owned);
    if (fixture.cleaning) void Promise.resolve().then(() => owned.resolve());
    return owned;
  };
  fixture.response = (url, { payload = bytes, status = 200, read, cancel, finalUrl = url, redirected = false } = {}) => {
    let index = 0;
    const state = { reads: 0, cancels: 0, releases: 0, readers: 0 };
    const reader = {
      read() { assert.equal(this, reader); state.reads++; return read ? read(state) : Promise.resolve(index++ === 0 ? { done: false, value: new Uint8Array(payload) } : { done: true, value: undefined }); },
      cancel(reason) { assert.equal(this, reader); state.cancels++; return cancel ? cancel(reason, state) : Promise.resolve(); },
      releaseLock() { assert.equal(this, reader); state.releases++; },
    };
    const body = {
      getReader() { assert.equal(this, body); state.readers++; return reader; },
      cancel(reason) { assert.equal(this, body); state.cancels++; return cancel ? cancel(reason, state) : Promise.resolve(); },
    };
    const headers = { get(name) { assert.equal(this, headers); return name.toLowerCase() === 'content-length' ? String(payload.byteLength) : name.toLowerCase() === 'content-type' ? 'image/png' : null; } };
    const response = { status, ok: status >= 200 && status < 300, redirected, url: finalUrl, body, headers };
    fixture.responses.push({ response, body, reader, state }); return response;
  };
  fixture.fetch = function (url, options) {
    assert.equal(this, globalThis, 'captured fetch receiver');
    const call = { url: String(url), options, at: performance.now() };
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal, 'source owns a native AbortSignal');
    fixture.calls.push(call);
    return fixture.route ? fixture.route(call) : Promise.resolve(fixture.response(call.url));
  };
  fixture.own = (owner, closeCode) => { fixture.owners.push({ owner, closeCode }); return owner; };
  fixture.source = (chosen = selection(), options = {}) => fixture.own(api().browser.createManifestByteSource(chosen.manifest, chosen.bindings, { baseUrl, ...options }));
  fixture.provider = (source, png = controlledFixture()) => fixture.own(api().browser.createManifestTextureProvider(source, { ports: png.ports }));
  // Direct fixture callers own these issued values. Engine integration uses the
  // original provider.load directly, because the real manager owns those values.
  fixture.load = (provider, ref, loadContext) => provider.load(ref, loadContext).then(value => { fixture.issued.push({ provider, value }); return value; });
  fixture.watch = promise => { const result = observe(promise); fixture.observed.push(result); return result; };
  fixture.baseline = async () => {
    const previous = fixture.route; fixture.route = undefined;
    const chosen = selection(), source = fixture.source(chosen), request = context();
    try { const result = await source.readBytes(chosen.bindings[0].ref, request.value); assert.deepEqual([...result], [...bytes]); assert.ok(result.buffer instanceof ArrayBuffer); }
    finally { await source.close(); fixture.route = previous; }
  };
  fixture.cleanup = async () => {
    fixture.cleaning = true;
    const closes = [], failures = [];
    for (const { owner, closeCode } of fixture.owners) {
      try { closes.push({ result: observe(owner.close()), closeCode }); }
      catch (cause) { failures.push(cause); }
    }
    for (const hold of fixture.holds) hold.resolve();
    await Promise.all(fixture.observed);
    for (const { provider, value } of fixture.issued) {
      try { provider.dispose(value); } catch (cause) { failures.push(cause); }
    }
    for (const { result, closeCode } of closes) {
      const outcome = await result;
      if (closeCode === undefined && !outcome.fulfilled) failures.push(outcome.cause);
      if (closeCode !== undefined) {
        try { assert.equal(outcome.fulfilled, false); assert.equal(outcome.cause?.code, closeCode); }
        catch (cause) { failures.push(cause); }
      }
    }
    for (const hold of fixture.holds) {
      try { assert.equal(hold.settled, true, 'every owned deferred operation was settled'); }
      catch (cause) { failures.push(cause); }
    }
    if (failures.length) throw new AggregateError(failures, 'MANIFEST_FIXTURE_CLEANUP_FAILED');
  };
  return fixture;
}
