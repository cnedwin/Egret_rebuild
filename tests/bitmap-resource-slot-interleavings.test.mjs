// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { sdk, scene, visible, commit, observe, rejected, fulfilled, code, causeIncludes, flush } from './bitmap-resource-slot-fixtures.mjs';

test('BRS06 different refs completing backward publish only the latest accepted request', async () => {
  const f = await scene();
  try {
    const obsolete = f.replace('B'), current = f.replace('C');
    await rejected(obsolete, 'BITMAP_RESOURCE_SUPERSEDED'); visible(f);
    f.job('C').resolve(f.values.get('C')); await fulfilled(current); visible(f, 'C');
    f.job('B').resolve(f.values.get('B')); await flush();
    visible(f, 'C'); assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.count(f.values.get('C')), 0);
  } finally { await f.close(); }
});

test('BRS07 guard supersession before manager delivery keeps manager cleanup ownership', async () => {
  const f = await scene(); let latest;
  try {
    f.hooks.guard = value => {
      if (value === f.values.get('B')) { f.trace.push('guard:B'); latest = f.replace('C'); }
      return sdk.isTexture(value);
    };
    const old = f.replace('B'); f.job('B').resolve(f.values.get('B'));
    await rejected(old, 'BITMAP_RESOURCE_SUPERSEDED');
    assert.ok(latest); assert.equal(latest.state, 'pending'); visible(f);
    assert.equal(f.count(f.values.get('B')), 1);
    f.job('C').resolve(f.values.get('C')); await fulfilled(latest); visible(f, 'C');
  } finally { await f.close(); }
});

test('BRS06 resolved provider result superseded before manager reaction cannot become visible', async () => {
  const f = await scene();
  try {
    const old = f.replace('B'); f.job('B').resolve(f.values.get('B'));
    const latest = f.replace('C');
    await rejected(old, 'BITMAP_RESOURCE_SUPERSEDED'); assert.equal(f.count(f.values.get('B')), 1); visible(f);
    f.job('C').resolve(f.values.get('C')); await fulfilled(latest); visible(f, 'C');
  } finally { await f.close(); }
});

test('BRS08 cached delivery before continuation retires stale exact lease after cancel/supersede', async t => {
  for (const operation of ['cancel', 'supersede']) await t.test(operation, async () => {
    const f = await scene();
    try {
      const take = f.engine.assets.acquire(f.ref('B')); f.job('B').resolve(f.values.get('B'));
      const external = await take;
      assert.equal(external.value, f.values.get('B')); assert.equal(f.count(f.values.get('B')), 0);
      // Ready-route acquire delivers synchronously; no microtask has run yet.
      const old = f.replace('B'); let latest;
      if (operation === 'cancel') f.slot.cancel(); else latest = f.replace('C');
      await rejected(old, operation === 'cancel' ? 'BITMAP_RESOURCE_CANCELLED' : 'BITMAP_RESOURCE_SUPERSEDED');
      assert.equal(f.bitmap.textureLease, f.initialLease); visible(f);
      assert.equal(external.value, f.values.get('B')); assert.equal(f.count(f.values.get('B')), 0);
      external.release(); assert.equal(f.count(f.values.get('B')), 1, 'No stale delivered slot lease may retain the shared value');
      if (latest !== undefined) { f.job('C').resolve(f.values.get('C')); await fulfilled(latest); visible(f, 'C'); }
    } finally { await f.close(); }
  });
});

test('BRS09 guard-queued cancel runs after delivery but before the fresh slot reaction', async () => {
  const f = await scene(); const reason = Object.freeze({ deliveredGap: true });
  try {
    f.hooks.guard = value => {
      if (value === f.values.get('B')) {
        f.trace.push('guard:B');
        queueMicrotask(() => { f.trace.push('queued-cancel'); f.slot.cancel(reason); });
      }
      return sdk.isTexture(value);
    };
    const old = f.replace('B'); f.job('B').resolve(f.values.get('B'));
    const error = await rejected(old, 'BITMAP_RESOURCE_CANCELLED');
    assert.equal(error.cause, reason); visible(f);
    assert.equal(f.count(f.values.get('B')), 1);
    assert.ok(f.trace.indexOf('guard:B') < f.trace.indexOf('queued-cancel'));
    assert.ok(f.trace.indexOf('queued-cancel') < f.trace.indexOf('dispose:B'));
    assert.equal(f.slot.state, 'idle');
  } finally { await f.close(); }
});

test('BRS10 abort reentry accepts C and prevents an obsolete outer B intent from starting', async () => {
  const f = await scene(); let newest;
  try {
    const first = f.replace('B');
    f.job('B').context.signal.addEventListener('abort', () => {
      f.trace.push('provider-abort:B'); newest = f.replace('C');
    }, { once: true });
    const middle = f.replace('D');
    await rejected(first, 'BITMAP_RESOURCE_SUPERSEDED'); await rejected(middle, 'BITMAP_RESOURCE_SUPERSEDED');
    assert.ok(newest); assert.equal(f.loads.some(row => row.id === 'D'), false);
    assert.equal(f.loads.filter(row => row.id === 'C').length, 1); visible(f);
    f.job('C').resolve(f.values.get('C')); await fulfilled(newest); visible(f, 'C');
    f.job('B').resolve(f.values.get('B')); await flush(); assert.equal(f.count(f.values.get('B')), 1); visible(f, 'C');
  } finally { await f.close(); }
});

test('BRS11 synchronous provider reentry observes every obsolete acquisition outcome', async t => {
  for (const ending of ['resolve', 'reject', 'throw-undefined', 'never']) await t.test(ending, async () => {
    const f = await scene(); let newest;
    try {
      f.hooks.load = (reference, context) => {
        if (reference.id === 'B') {
          f.trace.push('reenter-load:B'); newest = f.replace('C');
          if (ending === 'throw-undefined') throw undefined;
        }
        return f.deferLoad(reference, context).promise;
      };
      const old = f.replace('B'); await rejected(old, 'BITMAP_RESOURCE_SUPERSEDED');
      assert.ok(newest); assert.equal(newest.state, 'pending'); visible(f);
      f.job('C').resolve(f.values.get('C')); await fulfilled(newest); visible(f, 'C');
      if (ending === 'resolve') f.job('B').resolve(f.values.get('B'));
      if (ending === 'reject') f.job('B').reject(undefined);
      await flush(); visible(f, 'C');
      assert.equal(f.count(f.values.get('B')), ending === 'resolve' ? 1 : 0);
      assert.deepEqual(f.unhandled, []);
    } finally { await f.close(); }
  });
});

test('BRS12 real guard reentry cannot publish into revoked request/slot/Scope/Engine', async t => {
  for (const action of ['cancel', 'slot-dispose', 'scope-dispose', 'engine-dispose']) await t.test(action, async () => {
    const f = await scene(); let closing;
    try {
      f.hooks.guard = value => {
        if (value === f.values.get('B')) {
          if (action === 'cancel') f.slot.cancel();
          if (action === 'slot-dispose') f.slot.dispose();
          if (action === 'scope-dispose') f.slotScope.dispose();
          if (action === 'engine-dispose') closing = f.engine.dispose();
        }
        return sdk.isTexture(value);
      };
      const pending = f.replace('B'); f.job('B').resolve(f.values.get('B'));
      await rejected(pending, action === 'cancel' ? 'BITMAP_RESOURCE_CANCELLED' : 'BITMAP_RESOURCE_DISPOSED');
      assert.equal(f.count(f.values.get('B')), 1);
      if (closing !== undefined) { await closing; assert.equal(f.slot.state, 'disposed'); }
      else { assert.equal(f.bitmap.textureLease, f.initialLease); visible(f); }
    } finally { await f.close(); }
  });
});

test('BRS13 committed success survives previous-owner disposer reentry without outer overwrite', async t => {
  for (const action of ['replace', 'cancel', 'slot-dispose', 'target-dispose', 'engine-dispose']) await t.test(action, async () => {
    const f = await scene(); let newest, closing;
    try {
      await commit(f, 'B');
      f.hooks.dispose = value => {
        if (value !== f.values.get('B')) return;
        f.trace.push('old-cleanup-observes:' + f.slot.state);
        if (action === 'replace') newest = f.replace('D');
        if (action === 'cancel') f.slot.cancel();
        if (action === 'slot-dispose') f.slot.dispose();
        if (action === 'target-dispose') f.bitmap.dispose();
        if (action === 'engine-dispose') closing = f.engine.dispose();
      };
      const accepted = f.replace('C'); f.job('C').resolve(f.values.get('C')); await fulfilled(accepted);
      assert.ok(f.trace.includes('old-cleanup-observes:ready'));
      assert.equal(f.count(f.values.get('B')), 1);
      if (action === 'replace') {
        assert.equal(f.slot.state, 'pending'); assert.equal(newest.state, 'pending'); visible(f, 'C');
        const value = f.makeValue('D', 'B'); f.job('D').resolve(value); await fulfilled(newest); visible(f, 'B');
      } else if (action === 'cancel') { assert.equal(f.slot.state, 'ready'); visible(f, 'C'); }
      else if (action === 'slot-dispose') { assert.equal(f.slot.state, 'disposed'); assert.equal(f.bitmap.textureLease, undefined); }
      else if (action === 'target-dispose') { assert.equal(f.bitmap.isDisposed, true); assert.equal(f.bitmap.textureLease, undefined); }
      else { await closing; assert.equal(f.slot.state, 'disposed'); }
    } finally { await f.close(); }
  });
});

test('BRS14 manager cleanup diagnostics preserve throw undefined and cannot reverse visible success', async t => {
  for (const cause of [undefined, Object.freeze({ cleanup: 'old provider fault' })]) {
    for (const action of ['replace', 'engine-dispose']) await t.test(String(cause) + '/' + action, async () => {
      const f = await scene(); let newest, closing;
      try {
        await commit(f, 'B');
        f.hooks.dispose = value => { if (value === f.values.get('B')) throw cause; };
        f.hooks.diagnostic = diagnostic => {
          if (diagnostic.code !== 'ASSET_CLEANUP_FAILED') return;
          assert.equal(diagnostic.cause, cause);
          if (action === 'replace') newest = f.replace('D'); else closing = f.engine.dispose();
        };
        const accepted = f.replace('C'); f.job('C').resolve(f.values.get('C')); await fulfilled(accepted);
        const matching = f.diagnostics.filter(row => row.code === 'ASSET_CLEANUP_FAILED');
        assert.equal(matching.length, 1); assert.equal(matching[0].cause, cause); assert.equal(f.count(f.values.get('B')), 1);
        if (action === 'replace') {
          assert.equal(f.slot.state, 'pending'); visible(f, 'C');
          const value = f.makeValue('D', 'B'); f.job('D').resolve(value); await fulfilled(newest); visible(f, 'B');
        } else { await closing; assert.equal(f.slot.state, 'disposed'); }
      } finally { await f.close(); }
    });
  }
});
