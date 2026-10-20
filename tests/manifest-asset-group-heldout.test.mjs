// SPDX-License-Identifier: Apache-2.0
// Independent held-out public behavior controls. Root integrates and executes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createAssetType, EgretError } from '@egret/engine';
import { createManifestAssetBinding } from '@egret/engine/resources';
import { buildResourceManifest } from '@egret/contracts/resources';
import { deferred, flush, host } from './helpers.mjs';
import { description, entry } from './fixtures/resource-manifest.mjs';

function expectCode(action, code) {
  let observed;
  assert.throws(action, error => {
    observed = error;
    return error instanceof EgretError && error.code === code;
  }, code);
  return observed;
}

async function fixture(run) {
  const controlledHost = host();
  const engine = await createEngine({ host: controlledHost.adapter });
  const marker = {}, loads = [], disposals = [];
  let disposalObserver;
  const finish = () => { for (const row of loads) row.pending.resolve(row.value); };
  let primary, cleanup;
  try {
    const type = createAssetType('independent manifest group control', value => value !== null && typeof value === 'object' && value.marker === marker);
    engine.assets.register(type, {
      load(ref) {
        const pending = deferred();
        const value = Object.freeze({ marker, id: ref.id });
        loads.push({ ref, pending, value });
        return pending.promise;
      },
      dispose(value) {
        disposals.push(value);
        disposalObserver?.(value);
      },
    });
    const built = buildResourceManifest(description([entry('e_a'), entry('e_b')]));
    assert.equal(built.ok, true, JSON.stringify(built.diagnostics));
    const manifest = built.value;
    const a = createManifestAssetBinding(manifest, 'e_a', type);
    const b = createManifestAssetBinding(manifest, 'e_b', type);
    await run({ engine, manifest, a, b, loads, disposals, finish,
      onDispose(callback) { disposalObserver = callback; } });
  } catch (cause) { primary = { cause }; }
  try {
    const closing = engine.dispose();
    finish();
    await closing;
    await flush();
    assert.deepEqual(controlledHost.trace, ['start', 'stop', 'close']);
    assert.equal(controlledHost.timers.size, 0);
  } catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'M15_HELDOUT_BODY_AND_CLEANUP_FAILED');
  if (primary) throw primary.cause;
  if (cleanup) throw cleanup.cause;
}

// A throwing caller getter must not mask the Scope closure or start a provider.
test('M15-H01 roots callback closing Scope takes precedence over thrown undefined', async () => {
  await fixture(async ({ engine, manifest, a, loads, finish }) => {
    const scope = engine.createScope(), roots = ['e_a'];
    let reads = 0;
    Object.defineProperty(roots, 0, { enumerable: true, get() {
      reads++;
      scope.dispose();
      throw undefined;
    } });
    expectCode(() => engine.createManifestGroup(scope, manifest, roots, [a]), 'SCOPE_CLOSED');
    assert.equal(reads, 1);
    assert.equal(loads.length, 0);
    const later = engine.createManifestGroup(engine.createScope(), manifest, ['e_a'], [a]);
    assert.equal(loads.length, 1, 'failed admission clears its busy state and reserves no capacity');
    finish();
    await later.ready;
    assert.equal(later.get(a).value, loads[0].value);
  });
});

// A falsey original throw is still a failed read, not an absent binding value.
test('M15-H02 bindings callback throwing undefined retains its exact original cause', async () => {
  await fixture(async ({ engine, manifest, a, loads, finish }) => {
    const scope = engine.createScope(), bindings = [a];
    let reads = 0;
    Object.defineProperty(bindings, 0, { enumerable: true, get() {
      reads++;
      throw undefined;
    } });
    const error = expectCode(() => engine.createManifestGroup(scope, manifest, ['e_a'], bindings), 'MANIFEST_GROUP_BINDINGS_INVALID');
    assert.equal(Object.hasOwn(error, 'cause'), true);
    assert.equal(error.cause, undefined);
    assert.equal(reads, 1);
    assert.equal(loads.length, 0);
    const later = engine.createManifestGroup(scope, manifest, ['e_a'], [a]);
    finish();
    await later.ready;
    assert.equal(loads.length, 1);
  });
});

// Recursive argument admission must refuse before the inner call can acquire.
test('M15-H03 priority callback cannot recursively admit another group', async () => {
  await fixture(async ({ engine, manifest, a, loads, finish }) => {
    const scope = engine.createScope();
    let innerError, innerReturned = false, reads = 0;
    const options = { get priority() {
      reads++;
      try {
        engine.createManifestGroup(scope, manifest, ['e_a'], [a]);
        innerReturned = true;
      } catch (error) { innerError = error; }
      return 'interactive';
    } };
    const outer = engine.createManifestGroup(scope, manifest, ['e_a'], [a], options);
    assert.equal(reads, 1);
    assert.equal(innerReturned, false);
    assert.ok(innerError instanceof EgretError);
    assert.equal(innerError.code, 'MANIFEST_GROUP_REENTRANT');
    assert.equal(loads.length, 1);
    finish();
    await outer.ready;
    assert.equal(outer.get(a).value, loads[0].value);
  });
});

// A mere Engine-closed error would not prove B was revoked before A's cleanup.
test('M15-H04 every ready group is terminal before the first group cleanup callback', async () => {
  await fixture(async ({ engine, manifest, a, b, loads, disposals, finish, onDispose }) => {
    const scope = engine.createScope();
    const first = engine.createManifestGroup(scope, manifest, ['e_a'], [a]);
    const second = engine.createManifestGroup(scope, manifest, ['e_b'], [b]);
    finish();
    await Promise.all([first.ready, second.ready]);
    assert.equal(loads.length, 2);
    const observations = [];
    onDispose(value => {
      if (value.id !== a.ref.id) return;
      // Record outside assertions: provider cleanup catches callback failures.
      try { observations.push({ returned: second.get(b) }); }
      catch (error) { observations.push({ error }); }
    });
    await engine.dispose();
    assert.equal(observations.length, 1);
    assert.equal(Object.hasOwn(observations[0], 'returned'), false);
    assert.ok(observations[0].error instanceof EgretError);
    assert.equal(observations[0].error.code, 'MANIFEST_GROUP_BINDING_INVALID', 'B membership was already cleared, not merely rejected by Engine closing');
    assert.equal(disposals.length, 2);
    assert.equal(new Set(disposals).size, 2);
  });
});
