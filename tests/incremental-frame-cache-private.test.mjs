// SPDX-License-Identifier: Apache-2.0
// UNIT: optional derived-value accounting and revision invalidation only.
// Genuine public objects enter the two explicitly permitted emitted private modules.
// Ledger reads and near-overflow revision setup establish logical ownership, not
// physical memory, GC, public admission, native rendering or performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Sprite } from '@egret/engine';
import { host } from './helpers.mjs';
import {
  beginCaptureSession, beginCaptureNode, readCaptureDerived, rememberCaptureBase,
  rememberCaptureRectangle, rememberCaptureClips, completeCaptureNode,
  publishCaptureSession, abandonCaptureSession,
} from '../packages/runtime/dist/frameCaptureCache.js';
import {
  visualOf, recordVisualChange, VISUAL_STRUCTURE, VISUAL_TRANSFORM,
  VISUAL_APPEARANCE, VISUAL_CONTENT, VISUAL_BINDING,
} from '../packages/runtime/dist/displayVisualState.js';

const CAP = 16777216;
const MATRIX = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const RECT = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });
async function setup(t) {
  const engine = await createEngine({ host: host().adapter });
  t.after(() => engine.dispose());
  const scope = engine.createScope();
  const node = () => { const value = scope.use(new Sprite()); engine.stage.addChild(value); return value; };
  return { engine, node };
}
function session(stage, profile = 'ordinary') {
  const value = beginCaptureSession(stage, profile); assert.ok(value); return value;
}
function draft(current, node) {
  const value = beginCaptureNode(current, node, visualOf(node), MATRIX, 1, undefined, undefined);
  assert.ok(value); rememberCaptureBase(value, MATRIX, undefined, undefined); return value;
}
function read(current, node, parent = MATRIX, alpha = 1) {
  return readCaptureDerived(current, node, visualOf(node), parent, alpha, undefined, undefined);
}
function ready(current, node) {
  const value = draft(current, node); completeCaptureNode(value, visualOf(node));
  publishCaptureSession(current); return value;
}

test('UNIT pending, incomplete and changed-revision candidates retain and refund exact ownership', async t => {
  const { engine, node } = await setup(t), first = node(), second = node();
  const a = session(engine.stage), b = session(engine.stage, 'textured');
  const da = draft(a, first), db = draft(b, first);
  assert.equal(a.owner, b.owner); assert.equal(a.owner.entries, 2); assert.equal(a.owner.bytes, 1232);
  rememberCaptureRectangle(da, RECT); assert.equal(a.owner.bytes, 1304);
  completeCaptureNode(da, visualOf(first));
  const observer = session(engine.stage); assert.equal(read(observer, first), undefined);
  publishCaptureSession(a); const retained = read(observer, first);
  assert.ok(retained); assert.equal(retained.matrix, MATRIX); assert.deepEqual(retained.rectangles, [RECT]);
  assert.ok(Object.isFrozen(retained)); assert.ok(Object.isFrozen(retained.rectangles));
  abandonCaptureSession(b); assert.equal(db.data, undefined);
  assert.equal(a.owner.entries, 1); assert.equal(a.owner.bytes, 688);
  abandonCaptureSession(b); assert.equal(a.owner.bytes, 688);
  const incomplete = session(engine.stage), di = draft(incomplete, second);
  publishCaptureSession(incomplete); assert.equal(di.data, undefined); assert.equal(a.owner.bytes, 688);
  const changed = session(engine.stage), dc = draft(changed, second);
  second.x = 1; completeCaptureNode(dc, visualOf(second)); publishCaptureSession(changed);
  assert.equal(dc.data, undefined); assert.equal(a.owner.entries, 1); assert.equal(a.owner.bytes, 688);
  const replacement = session(engine.stage), dr = draft(replacement, first);
  assert.equal(da.data, undefined); assert.equal(read(observer, first), undefined);
  assert.equal(a.owner.entries, 1); assert.equal(a.owner.bytes, 616);
  abandonCaptureSession(replacement); assert.equal(dr.data, undefined);
  assert.equal(a.owner.entries, 0); assert.equal(a.owner.bytes, 0); abandonCaptureSession(observer);
});

test('UNIT both profiles share the exact 16MiB cap including pending entries and LRU eviction', async t => {
  const { engine, node } = await setup(t), a = session(engine.stage), b = session(engine.stage, 'textured');
  const nodes = [], entries = [];
  // 27,232 complete minimal entries at 616 bytes, plus 32 distinct 72-byte
  // rectangle records, equals exactly 16,777,216. No ledger is fabricated.
  // The byte cap binds before 65,536 entries; this cannot independently prove
  // that entry-count boundary and deliberately does not label it as reached.
  for (let i = 0; i < 27232; i++) {
    const value = node(), entry = draft(i % 2 === 0 ? a : b, value);
    nodes.push(value); entries.push(entry);
    if (i === 27231) for (let r = 0; r < 32; r++) {
      rememberCaptureRectangle(entry, Object.freeze({ x: r, y: 0, width: 1, height: 1 }));
    }
    completeCaptureNode(entry, visualOf(value));
  }
  assert.equal(a.owner, b.owner); assert.equal(a.owner.entries, 27232); assert.equal(a.owner.bytes, CAP);
  assert.equal(a.head.ready, false); assert.equal(b.head.ready, false);
  publishCaptureSession(a); assert.equal(a.owner.bytes, CAP);
  const observer = session(engine.stage); assert.ok(read(observer, nodes[0]));
  const overflow = session(engine.stage, 'textured'), extra = node(), extraEntry = draft(overflow, extra);
  assert.equal(entries[0].ready, true, 'the observed oldest ready value was moved to the newest position');
  assert.equal(entries[1].data, undefined, 'the oldest pending value is an eligible shared-quota victim');
  assert.equal(a.owner.entries, 27232); assert.equal(a.owner.bytes, CAP);
  assert.equal(read(observer, nodes[0]).matrix, MATRIX);
  completeCaptureNode(extraEntry, visualOf(extra)); publishCaptureSession(b);
  abandonCaptureSession(overflow); assert.equal(a.owner.entries, 27231); assert.equal(a.owner.bytes, CAP - 616);
  abandonCaptureSession(observer);
  await engine.dispose(); assert.equal(a.owner.closed, true); assert.equal(a.owner.entries, 0); assert.equal(a.owner.bytes, 0);
});

test('UNIT an individually oversized optional candidate falls back without rejecting public capture', async t => {
  const { engine, node } = await setup(t), value = node(), current = session(engine.stage), entry = draft(current, value);
  const clip = Object.freeze({ matrix: MATRIX, rect: RECT });
  // The real bounded array alone costs 16,777,240 logical bytes before clips.
  // Repeated immutable references are valid input; no allocation failure is simulated.
  const clips = Object.freeze(Array(2097152).fill(clip));
  rememberCaptureClips(entry, clips);
  assert.equal(entry.data, undefined); assert.equal(current.owner.entries, 0); assert.equal(current.owner.bytes, 0);
  publishCaptureSession(current); assert.equal(current.owner.bytes, 0);
  value.graphics.beginFill(0x123456).drawRect(0, 0, 2, 3);
  const frame = engine.captureFrame({ width: 8, height: 8 });
  assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].color, 0x123456);
  assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 2, height: 3 });
});

test('UNIT revision restart invalidates both profile slots before reusing small revision values', async t => {
  const { engine, node } = await setup(t), value = node();
  const a = session(engine.stage), da = ready(a, value);
  const b = session(engine.stage, 'textured'), db = ready(b, value);
  assert.equal(a.owner.entries, 2); assert.equal(a.owner.bytes, 1232);
  const state = visualOf(value), fields = ['structureRevision', 'transformRevision', 'appearanceRevision', 'contentRevision', 'bindingRevision'];
  // This sole private revision setup reaches a boundary that cannot be exercised
  // through quadrillions of public mutations. Publication uses the real writer.
  for (const field of fields) state[field] = 9007199254740990;
  recordVisualChange(value, VISUAL_STRUCTURE | VISUAL_TRANSFORM | VISUAL_APPEARANCE | VISUAL_CONTENT | VISUAL_BINDING);
  assert.deepEqual(fields.map(field => state[field]), [1, 1, 1, 1, 1]);
  assert.equal(da.data, undefined); assert.equal(db.data, undefined);
  assert.equal(a.owner.entries, 0); assert.equal(a.owner.bytes, 0);
  for (const profile of ['ordinary', 'textured']) {
    const current = session(engine.stage, profile); assert.equal(read(current, value), undefined); abandonCaptureSession(current);
  }
  value.x = 1; assert.equal(state.transformRevision, 2);
  const next = session(engine.stage), replacement = ready(next, value);
  assert.ok(replacement.ready); assert.equal(next.owner.entries, 1); assert.equal(next.owner.bytes, 616);
});

test('UNIT public setters preserve signed zero and validation before unchanged-value shortcuts', async t => {
  const { node } = await setup(t), value = node(), state = visualOf(value), before = state.transformRevision;
  value.x = 0; assert.equal(state.transformRevision, before);
  value.x = -0; assert.ok(Object.is(value.x, -0)); assert.equal(state.transformRevision, before + 1);
  value.x = -0; assert.equal(state.transformRevision, before + 1);
  value.anchorOffsetX = -0; assert.equal(state.transformRevision, before + 2);
  assert.throws(() => { value.x = NaN; }, { code: 'DISPLAY_VALUE_INVALID' });
  assert.equal(state.transformRevision, before + 2); assert.ok(Object.is(value.x, -0));
  value.dispose(); assert.throws(() => { value.x = -0; }, { code: 'OBJECT_DISPOSED' });
});

test('UNIT genuine node and Stage termination release ready and pending ownership once', async t => {
  const { engine, node } = await setup(t), first = node(), second = node();
  const a = session(engine.stage), da = ready(a, first);
  const b = session(engine.stage, 'textured'), db = ready(b, first);
  const pending = session(engine.stage), dp = draft(pending, second);
  assert.equal(a.owner.entries, 3); assert.equal(a.owner.bytes, 1848);
  first.dispose(); assert.equal(da.data, undefined); assert.equal(db.data, undefined);
  assert.equal(a.owner.entries, 1); assert.equal(a.owner.bytes, 616);
  engine.stage.dispose(); assert.equal(a.owner.closed, true); assert.equal(dp.data, undefined);
  assert.equal(a.owner.entries, 0); assert.equal(a.owner.bytes, 0);
  publishCaptureSession(pending); abandonCaptureSession(pending);
  assert.equal(beginCaptureSession(engine.stage, 'ordinary'), undefined);
  assert.equal(beginCaptureSession(engine.stage, 'textured'), undefined);
  assert.equal(a.owner.entries, 0); assert.equal(a.owner.bytes, 0);
});

// UNIT: deterministic admission probes do not authorize derived-value reuse.
for (const profile of ['ordinary', 'textured']) {
  test(`UNIT ${profile} repeated misses retain a bounded probe and recover only through cold publication`, async t => {
    const { engine, node } = await setup(t), value = node();
    const cold = session(engine.stage, profile), first = ready(cold, value);
    const warm = session(engine.stage, profile);
    assert.equal(read(warm, value), first.data, 'the first cold capture still supplies the second static hit');
    abandonCaptureSession(warm);
    value.x = 1;
    const changed = session(engine.stage, profile);
    assert.equal(read(changed, value), undefined);
    const replacement = ready(changed, value);
    assert.ok(replacement.data, 'the first replacement miss still publishes complete derived data');
    value.x = 2;
    const again = session(engine.stage, profile);
    assert.equal(read(again, value), undefined);
    const probe = ready(again, value);
    // Genuine RED on the pre-probe helper: it still retains a full replacement payload.
    assert.equal(probe.data, undefined, 'the second consecutive replacement miss must retain no derived payload');
    assert.equal(probe.seen, undefined);
    assert.equal(probe.key.ordinaryClips, undefined); assert.equal(probe.key.texturedClips, undefined);
    assert.equal(again.owner.entries, 1); assert.equal(again.owner.bytes, 408);
    const key = probe.key;
    for (const x of [3, 4, 5]) {
      value.x = x;
      const current = session(engine.stage, profile);
      assert.equal(read(current, value), undefined);
      const next = ready(current, value);
      assert.equal(next, probe); assert.equal(next.key, key, 'changing observations reuse fixed metadata');
      assert.equal(next.data, undefined); assert.equal(current.owner.bytes, 408);
    }
    const recovery = session(engine.stage, profile), observer = session(engine.stage, profile);
    assert.equal(read(recovery, value), undefined, 'a stable probe is not a cache hit');
    const rebuilt = draft(recovery, value);
    assert.ok(rebuilt.data); assert.equal(recovery.owner.bytes, 616);
    assert.equal(read(observer, value), undefined);
    completeCaptureNode(rebuilt, visualOf(value));
    assert.equal(read(observer, value), undefined, 'complete data stays unpublished until the collector boundary');
    publishCaptureSession(recovery);
    assert.equal(read(observer, value), rebuilt.data);
    assert.equal(rebuilt.data.matrix, MATRIX); assert.ok(Object.isFrozen(rebuilt.data));
    abandonCaptureSession(observer);
    // A real hit resets consecutive misses; an isolated change builds a full candidate again.
    value.x = 6;
    const isolated = session(engine.stage, profile), final = ready(isolated, value);
    assert.ok(final.data); assert.equal(isolated.owner.bytes, 616);
  });
}

test('UNIT probe hints never authorize a changed clip key and abandoned recovery refunds ownership', async t => {
  const { engine, node } = await setup(t), value = node();
  const clipsA = Object.freeze([Object.freeze({ matrix: MATRIX, rect: RECT })]);
  const clipsB = Object.freeze([Object.freeze({ matrix: MATRIX, rect: Object.freeze({ x: 0, y: 0, width: 2, height: 1 }) })]);
  const readClips = (current, clips) => readCaptureDerived(current, value, visualOf(value), MATRIX, 1, clips, undefined);
  const prepare = (current, clips) => {
    const entry = beginCaptureNode(current, value, visualOf(value), MATRIX, 1, clips, undefined);
    assert.ok(entry); rememberCaptureBase(entry, MATRIX, clips, undefined);
    completeCaptureNode(entry, visualOf(value)); return entry;
  };
  let entry;
  for (const x of [0, 1, 2]) {
    value.x = x; const current = session(engine.stage);
    assert.equal(readClips(current, clipsA), undefined);
    entry = prepare(current, clipsA); publishCaptureSession(current);
  }
  assert.equal(entry.data, undefined, 'continuous misses must enter the real no-payload probe state');
  assert.equal(entry.key.ordinaryClips, undefined, 'a probe retains no clip graph outside its fee');
  const changedClip = session(engine.stage), observer = session(engine.stage);
  assert.equal(readClips(changedClip, clipsB), undefined);
  const candidate = prepare(changedClip, clipsB);
  assert.ok(candidate.data, 'a stable numeric hint permits cold rebuilding, never a hit');
  assert.equal(readClips(observer, clipsB), undefined);
  abandonCaptureSession(changedClip);
  assert.equal(candidate.data, undefined); assert.equal(observer.owner.entries, 0); assert.equal(observer.owner.bytes, 0);
  assert.equal(readClips(observer, clipsA), undefined); assert.equal(readClips(observer, clipsB), undefined);
  const retry = session(engine.stage), complete = prepare(retry, clipsB); publishCaptureSession(retry);
  assert.equal(readClips(observer, clipsA), undefined, 'published reuse still requires the complete current clip values');
  assert.equal(readClips(observer, clipsB), complete.data);
  assert.equal(complete.data.ordinaryClips[0].rect.width, 2);
  abandonCaptureSession(observer);
});

test('UNIT overflow and Stage termination clear both ready and pending probes without resurrection', async t => {
  const { engine, node } = await setup(t), value = node(), state = visualOf(value), probes = [];
  for (const profile of ['ordinary', 'textured']) {
    let entry;
    for (let i = 0; i < 3; i++) {
      value.x = value.x + 1;
      const current = session(engine.stage, profile); entry = ready(current, value);
    }
    assert.equal(entry.data, undefined, 'the tested terminal state must be an actual probe');
    probes.push(entry);
  }
  const owner = probes[0].owner;
  assert.equal(owner.entries, 2); assert.equal(owner.bytes, 816);
  state.transformRevision = 9007199254740990;
  recordVisualChange(value, VISUAL_TRANSFORM);
  assert.equal(state.transformRevision, 1);
  assert.equal(owner.entries, 0); assert.equal(owner.bytes, 0);
  assert.ok(probes.every(entry => entry.key === undefined && entry.data === undefined));
  let pending, pendingProbe;
  for (let i = 0; i < 3; i++) {
    value.x = value.x + 1; pending = session(engine.stage); pendingProbe = draft(pending, value);
    completeCaptureNode(pendingProbe, state);
    if (i < 2) publishCaptureSession(pending);
  }
  assert.equal(pendingProbe.data, undefined); assert.equal(owner.bytes, 408); assert.equal(pendingProbe.ready, false);
  engine.stage.dispose();
  assert.equal(owner.closed, true); assert.equal(owner.entries, 0); assert.equal(owner.bytes, 0);
  assert.equal(pendingProbe.key, undefined);
  publishCaptureSession(pending); abandonCaptureSession(pending);
  assert.equal(beginCaptureSession(engine.stage, 'ordinary'), undefined);
  assert.equal(owner.entries, 0); assert.equal(owner.bytes, 0);
});
