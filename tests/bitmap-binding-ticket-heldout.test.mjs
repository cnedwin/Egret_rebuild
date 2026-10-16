// SPDX-License-Identifier: Apache-2.0
// Independently selected public-contract regression witnesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Bitmap, EgretError, createEngine, createAssetType, createAssetRef,
  createImageData2D, createTexture, copyImageData2DPixels, isTexture,
} from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

const ART = Object.freeze({
  'old-left': { width: 2, height: 2, color: [239, 17, 31, 255], view: { x: 0, y: 0, width: 2, height: 2 } },
  'old-right': { width: 3, height: 2, color: [19, 223, 47, 255], view: { x: 0, y: 0, width: 3, height: 2 } },
  'next-left': { width: 4, height: 3, color: [23, 61, 229, 255], view: { x: 1, y: 1, width: 2, height: 1 } },
  'next-right': { width: 3, height: 4, color: [241, 211, 29, 255], view: { x: 1, y: 1, width: 1, height: 2 } },
  spare: { width: 1, height: 1, color: [13, 197, 211, 255], view: { x: 0, y: 0, width: 1, height: 1 } },
  held: { width: 1, height: 1, color: [181, 37, 193, 255], view: { x: 0, y: 0, width: 1, height: 1 } },
  'slot-only': { width: 1, height: 1, color: [173, 71, 109, 255], view: { x: 0, y: 0, width: 1, height: 1 } },
});
function attempt(operation) {
  try { return { occurred: false, value: operation(), cause: undefined }; }
  catch (cause) { return { occurred: true, value: undefined, cause }; }
}
async function settlement(promise) {
  try { return { occurred: false, value: await promise, cause: undefined }; }
  catch (cause) { return { occurred: true, value: undefined, cause }; }
}
function errorCode(observation, expected) {
  assert.equal(observation.occurred, true, 'the operation must really refuse');
  assert.ok(observation.cause instanceof EgretError, 'a genuine SDK error reaches the caller');
  assert.equal(observation.cause.code, expected);
  return observation.cause;
}
function successful(observation) {
  assert.equal(observation.occurred, false, 'the recorded callback operation must complete');
  return observation.value;
}
function fields(bitmap) {
  return { lease: bitmap.textureLease, crop: bitmap.sourceRect,
    width: bitmap.naturalWidth, height: bitmap.naturalHeight };
}
function sameFields(bitmap, expected) {
  assert.equal(bitmap.textureLease, expected.lease);
  assert.equal(bitmap.sourceRect, expected.crop);
  assert.equal(bitmap.naturalWidth, expected.width);
  assert.equal(bitmap.naturalHeight, expected.height);
}
function unchanged(targets, before) {
  targets.forEach((target, index) => sameFields(target, before[index]));
}
function cleared(targets) {
  for (const target of targets) {
    assert.deepEqual(fields(target), { lease: undefined, crop: undefined, width: 0, height: 0 });
  }
}
function published(targets, members, ids = ['next-left', 'next-right']) {
  for (let index = 0; index < targets.length; index++) {
    assert.equal(targets[index].textureLease, members[index]);
    assert.deepEqual(targets[index].sourceRect, ART[ids[index]].view);
    assert.equal(targets[index].naturalWidth, ART[ids[index]].view.width);
    assert.equal(targets[index].naturalHeight, ART[ids[index]].view.height);
  }
}
function literalFrame(engine, ids) {
  const frame = engine.captureFrame({ width: 32, height: 16 });
  assert.equal(frame.commands.length, ids.length);
  assert.ok(frame.commands.every(command => command.kind === 'image'));
  assert.deepEqual(frame.images.map(image => [image.width, image.height]),
    ids.map(id => [ART[id].width, ART[id].height]));
  assert.deepEqual(frame.images.map(image => Array.from(copyImageData2DPixels(image).subarray(0, 4))),
    ids.map(id => ART[id].color));
  return frame;
}
function observerArray(members, firstRead) {
  const result = [members[0], members[1]];
  Object.defineProperty(result, '0', { enumerable: true, configurable: true, get: firstRead });
  return result;
}

async function fixture(label, body) {
  const adapter = host(), diagnostics = [];
  const engine = await createEngine({ host: adapter.adapter, onDiagnostic: value => diagnostics.push(value) });
  const initialScope = engine.createScope(), nodeScope = engine.createScope();
  const bindingScope = engine.createScope(), bindingScopes = [bindingScope], groupScopes = [];
  const type = createAssetType('P03 held-out literal Texture witness', isTexture);
  const refs = Object.fromEntries(Object.keys(ART).map(id => [id, createAssetRef(type, id)]));
  const loads = [], disposals = [], issued = [], hooks = { abort: undefined, dispose: undefined };
  let heldJob;
  function texture(id) {
    const art = ART[id], pixels = new Uint8Array(art.width * art.height * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(art.color, offset);
    const value = createTexture(createImageData2D({ width: art.width, height: art.height, pixels }), art.view);
    issued.push(value);
    return value;
  }
  const provider = {
    load(ref, context) {
      context.signal.addEventListener('abort', () => hooks.abort?.(ref, context));
      const original = ref.id === 'held' ? heldJob.original : Promise.resolve(texture(ref.id));
      loads.push({ ref, context, original, receiver: this });
      return original;
    },
    dispose(value) {
      disposals.push(value);
      try { hooks.dispose?.(value); }
      finally { value.dispose(); }
    },
  };
  engine.assets.register(type, provider);
  try {
    const oldGroup = engine.createAssetGroup(initialScope, [refs['old-left'], refs['old-right']]);
    const old = await oldGroup.ready;
    const addTargets = () => old.map((member, index) => {
      const target = nodeScope.use(new Bitmap(member));
      target.x = index * 9; engine.stage.addChild(target); return target;
    });
    const targets = addTargets();
    assert.equal(oldGroup.state, 'ready');
    assert.equal(Object.isFrozen(old), true); assert.notEqual(old[0], old[1]);
    assert.deepEqual(loads.map(row => row.ref.id), ['old-left', 'old-right']);
    assert.ok(loads.every(row => row.receiver === provider));
    published(targets, old, ['old-left', 'old-right']);
    errorCode(attempt(() => bindingScope.use(old[0])), 'OWNERSHIP_CONFLICT');
    const saved = literalFrame(engine, ['old-left', 'old-right']);
    assert.deepEqual(disposals, []);
    console.log('P03_HELD_OUT_GENUINE_BASELINE ' + label);
    const f = {
      engine, targets, old, oldGroup, bindingScope, initialScope, nodeScope, refs,
      disposals, loads, diagnostics, hooks, saved, adapter,
      capture(scope = bindingScope, selected = targets) {
        assert.equal(typeof engine.captureBitmapBindings, 'function', 'P03_MISSING_BITMAP_BINDING_FACTORY');
        return engine.captureBitmapBindings(scope, selected);
      },
      async group(ids = ['next-left', 'next-right']) {
        const scope = engine.createScope(); groupScopes.push(scope);
        const group = engine.createAssetGroup(scope, ids.map(id => refs[id]));
        return { scope, group, members: await group.ready, ids };
      },
      newBindingScope() { const scope = engine.createScope(); bindingScopes.push(scope); return scope; },
      addTargets,
      heldGroup() {
        assert.equal(heldJob, undefined, 'one selected deferred provider per fresh fixture');
        const source = deferred();
        heldJob = { original: source.promise, settled: false, value: undefined,
          resolve() { if (this.settled) return; this.settled = true; this.value = texture('held'); source.resolve(this.value); } };
        const scope = engine.createScope(); groupScopes.push(scope);
        const group = engine.createAssetGroup(scope, [refs.held]);
        return { group, job: heldJob };
      },
    };
    await body(f);
  } finally {
    hooks.abort = undefined; hooks.dispose = undefined;
    if (heldJob !== undefined) { heldJob.resolve(); await heldJob.original; await flush(); }
    for (const scope of [...bindingScopes].reverse()) scope.dispose();
    nodeScope.dispose();
    for (const scope of [...groupScopes].reverse()) scope.dispose();
    initialScope.dispose();
    await engine.dispose(); await flush();
    assert.deepEqual(diagnostics, [], 'unexpected SDK diagnostics cannot swallow fixture failures');
    assert.deepEqual(adapter.trace, ['start', 'stop', 'close']);
    assert.equal(adapter.timers.size, 0);
    for (const value of issued) assert.equal(disposals.filter(item => item === value).length, 1,
      'only actual provider ownership retires each delivered Texture once');
  }
}

test('PGB01 global exact-token pass beats earlier revoked old/candidate entitlement after full-view ABA', async () => {
  for (const mutation of ['same lease', 'full crop reset']) {
    for (const revoked of ['old target 0', 'candidate target 0', 'changed old target 1']) {
      await fixture('PGB01 ' + mutation + '/' + revoked, async f => {
        const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
        ticket.prepare(next.members);
        if (mutation === 'same lease') f.targets[1].textureLease = f.old[1];
        else f.targets[1].sourceRect = undefined;
        unchanged(f.targets, before);
        const lease = revoked === 'candidate target 0' ? next.members[0]
          : revoked === 'old target 0' ? f.old[0] : f.old[1];
        lease.release(); const retired = [...f.disposals];
        errorCode(attempt(() => ticket.commit()), 'BITMAP_RESOURCE_BINDING_CHANGED');
        unchanged(f.targets, before); assert.deepEqual(f.disposals, retired);
        errorCode(attempt(() => ticket.commit()), 'BITMAP_RESOURCE_BINDING_CHANGED');
        errorCode(attempt(() => ticket.prepare(next.members)), 'BITMAP_RESOURCE_BINDING_CHANGED');
        ticket.dispose(); unchanged(f.targets, before);
        errorCode(attempt(() => ticket.commit()), 'BITMAP_RESOURCE_BINDING_CHANGED');
        assert.deepEqual(Array.from(copyImageData2DPixels(f.saved.images[0]).subarray(0, 4)), ART['old-left'].color);
      });
    }
  }
});

test('PGB02 unchanged later old/candidate lease and Texture revocation refuse with no publication prefix', async () => {
  for (const owner of ['old', 'candidate']) for (const revocation of ['lease', 'Texture']) {
    await fixture('PGB02 ' + owner + '/' + revocation, async f => {
      const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
      ticket.prepare(next.members);
      const lease = owner === 'old' ? f.old[1] : next.members[1];
      if (revocation === 'lease') lease.release(); else lease.value.dispose();
      const retired = [...f.disposals], expected = revocation === 'lease' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED';
      errorCode(attempt(() => ticket.commit()), expected); unchanged(f.targets, before);
      errorCode(attempt(() => ticket.commit()), expected); unchanged(f.targets, before);
      let reads = 0;
      const replacement = observerArray(next.members, () => { reads++; return next.members[0]; });
      errorCode(attempt(() => ticket.prepare(replacement)), 'BITMAP_BINDING_STATE_INVALID');
      assert.equal(reads, 0); assert.deepEqual(f.disposals, retired);
      ticket.dispose(); unchanged(f.targets, before);
    });
  }
});

test('PGB03 ordinary prepare refusals preserve Captured and permit a genuine retry', async () => {
  for (const refusal of ['count', 'throw undefined', 'released member']) {
    await fixture('PGB03 ' + refusal, async f => {
      const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
      let input, reads = 0, expected;
      if (refusal === 'count') { input = [next.members[0]]; expected = 'BITMAP_BINDING_MEMBERS_INVALID'; }
      else if (refusal === 'throw undefined') {
        input = observerArray(next.members, () => { reads++; throw undefined; });
        expected = 'BITMAP_BINDING_MEMBERS_INVALID';
      } else {
        const spare = await f.group(['spare', 'spare']); spare.members[1].release();
        input = [next.members[0], spare.members[1]]; expected = 'ASSET_LEASE_RELEASED';
      }
      const result = attempt(() => ticket.prepare(input)), error = errorCode(result, expected);
      if (refusal === 'throw undefined') {
        assert.equal(reads, 1); assert.equal(Object.hasOwn(error, 'cause'), true); assert.equal(error.cause, undefined);
      }
      unchanged(f.targets, before);
      ticket.prepare(next.members); unchanged(f.targets, before);
      ticket.commit(); published(f.targets, next.members);
      literalFrame(f.engine, ['next-left', 'next-right']);
    });
  }
});

test('PGB04 prepare cannot replace a successful plan and successful commit is consumed exactly once', async () => {
  await fixture('PGB04', async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
    errorCode(attempt(() => ticket.commit()), 'BITMAP_BINDING_STATE_INVALID');
    unchanged(f.targets, before); ticket.prepare(next.members);
    let reads = 0;
    const poison = observerArray(next.members, () => { reads++; throw undefined; });
    errorCode(attempt(() => ticket.prepare(poison)), 'BITMAP_BINDING_STATE_INVALID');
    assert.equal(reads, 0); unchanged(f.targets, before);
    let frameCommit;
    f.engine.captureFrame({
      get width() { frameCommit = attempt(() => ticket.commit()); return 32; }, height: 16,
    });
    successful(frameCommit); published(f.targets, next.members); const committed = f.targets.map(fields);
    errorCode(attempt(() => ticket.commit()), 'BITMAP_BINDING_STATE_INVALID');
    errorCode(attempt(() => ticket.prepare(poison)), 'BITMAP_BINDING_STATE_INVALID');
    assert.equal(reads, 0); unchanged(f.targets, committed);
    ticket.dispose(); cleared(f.targets);
    errorCode(attempt(() => ticket.commit()), 'BITMAP_BINDING_DISPOSED');
  });
});

test('PGB05 genuine mutation refusal leaves a plan retryable when the outer crop setter writes nothing', async () => {
  await fixture('PGB05', async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group(); ticket.prepare(next.members);
    let inside, reads = 0;
    const outer = attempt(() => { f.targets[1].sourceRect = {
      get x() { reads++; inside = { refusal: attempt(() => ticket.commit()), fields: f.targets.map(fields) }; return 0; },
      y: 0, width: 0, height: 2,
    }; });
    errorCode(outer, 'BITMAP_REGION_INVALID'); assert.equal(reads, 1);
    errorCode(inside.refusal, 'BITMAP_MUTATION_REENTRANT');
    for (let index = 0; index < before.length; index++) {
      assert.equal(inside.fields[index].lease, before[index].lease);
      assert.equal(inside.fields[index].crop, before[index].crop);
      assert.equal(inside.fields[index].width, before[index].width);
      assert.equal(inside.fields[index].height, before[index].height);
    }
    unchanged(f.targets, before);
    ticket.commit(); published(f.targets, next.members);
  });
});

test('PGB06 successful outer crop write after mutation refusal makes the old prepared capture terminally conflicted', async () => {
  await fixture('PGB06', async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group(); ticket.prepare(next.members);
    let inside;
    f.targets[1].sourceRect = {
      get x() { inside = attempt(() => ticket.commit()); return 0; }, y: 0, width: 3, height: 2,
    };
    errorCode(inside, 'BITMAP_MUTATION_REENTRANT'); sameFields(f.targets[0], before[0]);
    const manual = fields(f.targets[1]); assert.equal(manual.lease, before[1].lease);
    assert.deepEqual(manual.crop, before[1].crop);
    errorCode(attempt(() => ticket.commit()), 'BITMAP_RESOURCE_BINDING_CHANGED');
    errorCode(attempt(() => ticket.prepare(next.members)), 'BITMAP_RESOURCE_BINDING_CHANGED');
    ticket.dispose(); sameFields(f.targets[0], before[0]); sameFields(f.targets[1], manual);
  });
});

test('PGB07 prepare getter disposal wins even when that same getter throws undefined', async () => {
  for (const throws of [false, true]) await fixture('PGB07 ' + throws, async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
    let reads = 0, disposed, nested;
    const input = observerArray(next.members, () => {
      reads++; disposed = attempt(() => ticket.dispose()); nested = attempt(() => ticket.commit());
      if (throws) throw undefined; return next.members[0];
    });
    errorCode(attempt(() => ticket.prepare(input)), 'BITMAP_BINDING_DISPOSED');
    assert.equal(reads, 1); successful(disposed); errorCode(nested, 'BITMAP_BINDING_DISPOSED');
    unchanged(f.targets, before); errorCode(attempt(() => ticket.commit()), 'BITMAP_BINDING_DISPOSED');
    assert.ok(next.members.every(member => !member.value.isDisposed));
  });
});

test('PGB08 same-ticket prepare-reader reentry refuses before phase while the outer stage stays valid', async () => {
  await fixture('PGB08', async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
    let reads = 0, iteratorReads = 0, nestedPrepare, nestedCommit;
    const input = observerArray(next.members, () => {
      reads++; nestedPrepare = attempt(() => ticket.prepare(next.members)); nestedCommit = attempt(() => ticket.commit());
      return next.members[0];
    });
    Object.defineProperty(input, Symbol.iterator, { get() { iteratorReads++; throw undefined; } });
    ticket.prepare(input);
    assert.equal(reads, 1); assert.equal(iteratorReads, 0);
    errorCode(nestedPrepare, 'BITMAP_BINDING_REENTRANT'); errorCode(nestedCommit, 'BITMAP_BINDING_REENTRANT');
    unchanged(f.targets, before); ticket.commit(); published(f.targets, next.members);
  });
});

test('PGB09 prepare getter Scope or Engine closing outranks its thrown undefined and cannot resurrect publication', async () => {
  for (const lifetime of ['Scope', 'Engine']) await fixture('PGB09 ' + lifetime, async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group();
    let reads = 0, close;
    const input = observerArray(next.members, () => {
      reads++; close = attempt(() => lifetime === 'Scope' ? f.bindingScope.dispose() : f.engine.dispose());
      throw undefined;
    });
    const expected = lifetime === 'Scope' ? 'SCOPE_CLOSED' : 'ENGINE_CLOSED';
    errorCode(attempt(() => ticket.prepare(input)), expected); assert.equal(reads, 1); successful(close);
    errorCode(attempt(() => ticket.commit()), expected);
    if (lifetime === 'Scope') unchanged(f.targets, before);
    else { await close.value; assert.ok(f.targets.every(target => target.textureLease !== next.members[0] && target.textureLease !== next.members[1])); }
  });
});

test('PGB10 a later target disposed by a prepare getter terminates without changing or restoring another target', async () => {
  await fixture('PGB10', async f => {
    const before = f.targets.map(fields), ticket = f.capture(), next = await f.group(); let disposal;
    const input = observerArray(next.members, () => { disposal = attempt(() => f.targets[1].dispose()); return next.members[0]; });
    errorCode(attempt(() => ticket.prepare(input)), 'OBJECT_DISPOSED'); successful(disposal);
    sameFields(f.targets[0], before[0]); cleared([f.targets[1]]);
    errorCode(attempt(() => ticket.commit()), 'BITMAP_BINDING_DISPOSED');
    ticket.dispose(); sameFields(f.targets[0], before[0]); cleared([f.targets[1]]);
    assert.ok(next.members.every(member => !member.value.isDisposed));
  });
});

test('PGB11 committed disposal preserves same-group manual full-view ABA but grants no survival after group revocation', async () => {
  for (const mutation of ['same lease', 'full crop reset']) await fixture('PGB11 ' + mutation, async f => {
    const ticket = f.capture(), next = await f.group(); ticket.prepare(next.members); ticket.commit();
    const original = fields(f.targets[1]);
    if (mutation === 'same lease') f.targets[1].textureLease = next.members[1]; else f.targets[1].sourceRect = undefined;
    sameFields(f.targets[1], original); const manual = fields(f.targets[1]);
    ticket.dispose(); ticket.dispose(); cleared([f.targets[0]]); sameFields(f.targets[1], manual);
    assert.ok(next.members.every(member => !member.value.isDisposed)); assert.deepEqual(f.disposals, []);
    next.scope.dispose(); sameFields(f.targets[1], manual);
    errorCode(attempt(() => next.members[1].value), 'ASSET_LEASE_RELEASED');
  });
});

test('PGB12 independently owned manual survivor remains live after the published group retires', async () => {
  await fixture('PGB12', async f => {
    const ticket = f.capture(), next = await f.group(); ticket.prepare(next.members); ticket.commit();
    const survivor = await f.group(['next-right']);
    assert.notEqual(survivor.members[0], next.members[1]);
    assert.equal(survivor.members[0].value, next.members[1].value);
    f.targets[1].textureLease = survivor.members[0]; const manual = fields(f.targets[1]);
    ticket.dispose(); cleared([f.targets[0]]); sameFields(f.targets[1], manual);
    next.scope.dispose(); sameFields(f.targets[1], manual);
    assert.equal(survivor.members[0].value.isDisposed, false);
    literalFrame(f.engine, ['next-right']);
    survivor.scope.dispose(); sameFields(f.targets[1], manual);
    errorCode(attempt(() => survivor.members[0].value), 'ASSET_LEASE_RELEASED');
  });
});

test('PGB13 disposing an older ticket cannot clear a successor publication of the exact same group members', async () => {
  await fixture('PGB13', async f => {
    const first = f.capture(), next = await f.group(); first.prepare(next.members); first.commit();
    const second = f.capture(f.newBindingScope()); second.prepare(next.members); second.commit();
    const current = f.targets.map(fields); first.dispose(); first.dispose(); unchanged(f.targets, current);
    assert.ok(next.members.every(member => !member.value.isDisposed)); assert.deepEqual(f.disposals, []);
    second.dispose(); cleared(f.targets); assert.ok(next.members.every(member => !member.value.isDisposed));
  });
});

test('PGB14 intrinsic Scope closing refuses methods before abort/reverse cleanup reaches the committed ticket', async () => {
  await fixture('PGB14', async f => {
    const next = await f.group(), observations = []; let ticket, reads = 0;
    const poison = observerArray(next.members, () => { reads++; throw undefined; });
    const record = phase => observations.push({ phase, snapshot: attempt(() => f.targets.map(fields)),
      prepare: attempt(() => ticket.prepare(poison)), commit: attempt(() => ticket.commit()) });
    f.bindingScope.signal.addEventListener('abort', () => record('abort'));
    ticket = f.capture(); ticket.prepare(next.members); ticket.commit(); const current = f.targets.map(fields);
    f.bindingScope.use({ dispose() { record('later cleanup'); } });
    Object.defineProperty(f.bindingScope, 'state', { value: 'open', configurable: true });
    f.bindingScope.dispose();
    assert.deepEqual(observations.map(row => row.phase), ['abort', 'later cleanup']);
    for (const row of observations) {
      assert.deepEqual(successful(row.snapshot), current);
      errorCode(row.prepare, 'SCOPE_CLOSED'); errorCode(row.commit, 'SCOPE_CLOSED');
    }
    assert.equal(reads, 0); cleared(f.targets); assert.ok(next.members.every(member => !member.value.isDisposed));
    errorCode(attempt(() => ticket.commit()), 'SCOPE_CLOSED');
  });
});

test('PGB15 Engine closing clears every publication before group callbacks and the active-frame idle barrier', async () => {
  await fixture('PGB15', async f => {
    const next = await f.group(), other = f.addTargets(), stagedTargets = f.addTargets(), capturedTargets = f.addTargets();
    const first = f.capture(), second = f.capture(f.newBindingScope(), other);
    const staged = f.capture(f.newBindingScope(), stagedTargets), captured = f.capture(f.newBindingScope(), capturedTargets);
    first.prepare(next.members); first.commit(); second.prepare(next.members); second.commit(); staged.prepare(next.members);
    // Existing P01 owns a separate ready replacement. Its first cleanup callback
    // must already observe every new ticket retired, before group-owner cleanup.
    const slotTarget = f.addTargets()[0];
    const slot = f.engine.createBitmapResourceSlot(f.newBindingScope(), slotTarget);
    await slot.replace(f.refs['slot-only']); assert.equal(slot.state, 'ready');
    const pending = f.heldGroup(), observations = [], tickets = [first, second, staged, captured];
    let closing, widthObservation, reads = 0;
    const poison = observerArray(next.members, () => { reads++; throw undefined; });
    function observe(phase) {
      observations.push({ phase, snapshot: attempt(() => [...f.targets, ...other].map(fields)),
        methods: tickets.map(ticket => ({ prepare: attempt(() => ticket.prepare(poison)), commit: attempt(() => ticket.commit()) })),
        close: attempt(() => f.engine.dispose()) });
    }
    f.hooks.abort = () => observe('provider abort'); f.hooks.dispose = () => observe('provider dispose');
    const frame = attempt(() => f.engine.captureFrame({
      get width() { closing = f.engine.dispose(); widthObservation = attempt(() => [...f.targets, ...other].map(fields)); return 32; },
      height: 16,
    }));
    errorCode(frame, 'ENGINE_CLOSED');
    assert.ok(observations.length > 0, 'a real group/provider callback must witness early closing');
    const empty = Array.from({ length: 4 }, () => ({ lease: undefined, crop: undefined, width: 0, height: 0 }));
    assert.deepEqual(successful(widthObservation), empty);
    for (const row of observations) {
      assert.deepEqual(successful(row.snapshot), empty);
      for (const method of row.methods) { errorCode(method.prepare, 'ENGINE_CLOSED'); errorCode(method.commit, 'ENGINE_CLOSED'); }
      assert.equal(successful(row.close), closing);
    }
    assert.equal(reads, 0); assert.equal(pending.job.settled, false);
    const readiness = errorCode(await settlement(pending.group.ready), 'ASSET_GROUP_DISPOSED');
    assert.ok(readiness.cause instanceof EgretError); assert.equal(readiness.cause.code, 'ENGINE_CLOSED');
    await closing; assert.equal(pending.job.settled, false, 'logical Engine closing did not settle the original provider');
    pending.job.resolve(); await pending.job.original; await flush();
    assert.equal(pending.job.value.isDisposed, true, 'late original value follows its genuine manager cleanup');
  });
});
