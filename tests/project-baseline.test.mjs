import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneLive } from '../packages/project/dist/live-input.js';
import { validateSnapshot } from '../packages/project/dist/validate-snapshot.js';
import { resolveLimits } from '../packages/project/dist/limits.js';
const statePort = await import('../packages/project/dist/state.js').catch(() => ({}));
const historyPort = await import('../packages/project/dist/history-bytes.js').catch(() => ({}));
const workPort = await import('../packages/project/dist/replay-cost.js').catch(() => ({}));
const ledger = JSON.parse(readFileSync(new URL('./fixtures/project/work-ledger.json', import.meta.url), 'utf8'));
const snapshot = (extra = {}) => ({ ...JSON.parse(ledger.snapshot), ...extra });
function bounds(overrides) { const result = resolveLimits(overrides); assert.equal(result.ok, true); return result.value; }
function prepared(value) {
  const limits = bounds();
  const copied = cloneLive(value, 'snapshot', limits);
  assert.equal(copied.ok, true);
  const checked = validateSnapshot(copied.value, { limits, pointerPrefix: '' });
  assert.equal(checked.ok, true);
  return checked.value;
}
function create(value = snapshot(), overrides) {
  assert.equal(typeof statePort.createState, 'function', 'missing baseline admission port');
  return statePort.createState(prepared(value), bounds(overrides));
}
function rejected(result) { assert.equal(result.ok, false); assert.equal(Object.hasOwn(result,'value'),false); assert.equal(result.diagnostics[0].code, 'PROJECT_LIMIT_EXCEEDED'); }

test('handwritten empty bytes and independent node decomposition pin all three admission edges', () => {
  assert.equal(Buffer.byteLength(ledger.snapshot), 238);
  assert.equal(Buffer.byteLength(ledger.emptyHistory), 298);
  assert.equal(ledger.nodeDecomposition.baseline.reduce((a, b) => a + b, 0), 27);
  assert.equal(ledger.nodeDecomposition.metadataEdit.reduce((a, b) => a + b, 0), 48);
  assert.equal(ledger.nodeDecomposition.restore.reduce((a, b) => a + b, 0), 25);
  assert.equal(prepared(snapshot()).canonical, ledger.snapshot);
  assert.equal(prepared(snapshot()).nodeCount, 27);
  for (const [key, exact] of [['maxReplayWorkUnits',27],['maxHistoryUtf8Bytes',298],['maxSnapshotUtf8Bytes',238]]) {
    assert.equal(create(snapshot(), { [key]: exact }).ok, true, key);
    rejected(create(snapshot(), { [key]: exact - 1 }));
  }
});

test('baseline admission checks retained counts, local depth and strings under the actual new limits', () => {
  rejected(create(snapshot({ retiredEntityIds: ['e_a','e_b'] }), { maxEntities: 1 }));
  rejected(create(snapshot({ retiredFileIds: ['f_a','f_b'] }), { maxFiles: 1 }));
  assert.equal(create(snapshot(), { maxJsonDepth: 2 }).ok, true);
  rejected(create(snapshot(), { maxJsonDepth: 1 }));
  rejected(create(snapshot(), { maxStringUtf8Bytes: 10 }));
});

test('empty canonical history admits nonzero boundaries and isolated immutable baseline authority', () => {
  assert.equal(typeof historyPort.historyBytes, 'function', 'missing history byte port');
  const first = create(); const second = create();
  assert.equal(first.ok, true); assert.equal(second.ok, true);
  assert.equal(historyPort.historyBytes(first.value.baseline, []), ledger.emptyHistory);
  assert.equal(first.value.historyUtf8Bytes, 298);
  assert.deepEqual(first.value.prefixCosts, [27]);
  assert.equal(first.value.baseline, first.value.head);
  assert.notEqual(first.value.receipts, second.value.receipts);
  assert.notEqual(first.value.identities, second.value.identities);
  const input = snapshot({ revision: 4, retiredEntityIds: ['e_old'], retiredFileIds: ['f_old'] });
  const boundary = create(input); assert.equal(boundary.ok, true);
  input.retiredEntityIds.push('e_new');
  assert.equal(boundary.value.baseline.revision, 4);
  assert.deepEqual(boundary.value.head.retiredEntityIds, ['e_old']);
  assert.deepEqual(boundary.value.head.retiredFileIds, ['f_old']);
  assert.throws(() => boundary.value.head.versions.engineVersion = '2', TypeError);
  assert.throws(() => first.value.commands.push({}), TypeError);
});

test('prefix accounting charges the frozen metadata and restore totals and saturates before excess arithmetic', () => {
  assert.equal(typeof workPort.nextPrefixCost, 'function', 'missing prefix accounting port');
  assert.equal(workPort.nextPrefixCost(27,48,27,undefined,102),102);
  assert.equal(workPort.nextPrefixCost(102,25,27,27,181),181);
  assert.equal(workPort.nextPrefixCost(27,48,27,undefined,101),102);
  assert.equal(workPort.nextPrefixCost(102,25,27,27,180),181);
  assert.equal(workPort.nextPrefixCost(10,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,160000000),160000001);
});
