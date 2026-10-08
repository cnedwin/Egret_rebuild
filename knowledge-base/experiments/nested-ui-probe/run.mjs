import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NestedUI as SafeUI } from './model.mjs';

const unsafeIsolation = process.argv.includes('--unsafe-isolation');
// A test-only mutation of the invalidation strategy, not a production option.
// Reproduce the real broken cached model rather than merely editing expected output.
const NestedUI = unsafeIsolation ? class extends SafeUI {
  patch(id, fields) {
    super.patch(id, fields);
    if (id !== 'a1') return;
    const keep = new Set(['a', 'a1', 'a2']);
    for (const k of [...this.dirty]) if (!keep.has(k.slice(0, k.lastIndexOf(':')))) this.dirty.delete(k);
    for (const k of [...this.arrange]) if (!keep.has(k)) this.arrange.delete(k);
  }
} : SafeUI;

const dir = path.dirname(fileURLToPath(import.meta.url));
const leaf = (id, height, width = 20, extra = {}) => ({ id, width, height, ...extra });
const box = (id, children, extra = {}) => ({ id, width: 'content', height: 'content', children, ...extra });
const fixture = () => box('root', [
  box('a', [leaf('a1', 10), leaf('a2', 12)], { padding: 2, gap: 3 }),
  box('b', [leaf('b1', 8), leaf('b2', 9)], { padding: 1, gap: 2 }),
  leaf('tail', 5)
], { padding: 4, gap: 6 });

// Test-only full oracle: rebuild a flat source index, solve two complete dimension
// graphs, then flatten world rectangles. It never calls model measurement/layout/hit.
function oracle(tree) {
  const all = [], index = new Map(), parents = new Map();
  const flatten = (n, p = null) => {
    all.push(n); index.set(n.id, n); parents.set(n.id, p);
    for (const c of n.children ?? []) flatten(c, n);
  };
  flatten(tree);
  const sizes = new Map(all.map(n => [n.id, {}]));
  const fullWork = { dimensionEvaluations: 0, worldEvaluations: 0, childPlacementEvaluations: 0 };
  const textBox = n => {
    const lines = [0];
    for (const width of n.text.glyphWidths) {
      if (lines.at(-1) > 0 && lines.at(-1) + width > n.text.wrapWidth) lines.push(0);
      lines[lines.length - 1] += width;
    }
    return { width: Math.max(...lines), height: lines.length * n.text.lineHeight };
  };
  for (const axis of ['width', 'height']) {
    const pending = new Set(all.map(n => n.id));
    while (pending.size) {
      let progress = false;
      for (const id of [...pending]) {
        const n = index.get(id), spec = n[axis] ?? 'content', children = (n.children ?? []).filter(c => c.visible !== false);
        const deps = typeof spec === 'object' ? [spec.ref] : spec === 'content' ? children.map(c => c.id) : [];
        if (deps.some(d => pending.has(d))) continue;
        let size;
        if (typeof spec === 'number') size = spec;
        else if (typeof spec === 'object') size = sizes.get(spec.ref)[axis] * (spec.factor ?? 1);
        else if (n.text) size = textBox(n)[axis] + 2 * (n.padding ?? 0);
        else if (axis === 'width') size = Math.max(0, ...children.map(c => sizes.get(c.id).width)) + 2 * (n.padding ?? 0);
        else size = children.reduce((sum, c) => sum + sizes.get(c.id).height, 0) + Math.max(0, children.length - 1) * (n.gap ?? 0) + 2 * (n.padding ?? 0);
        sizes.get(id)[axis] = size; pending.delete(id); progress = true; fullWork.dimensionEvaluations++;
      }
      assert.ok(progress, 'oracle source dependencies must be acyclic');
    }
  }
  const nodes = [];
  const intersect = (a, b) => a === null ? b : {
    x: Math.max(a.x, b.x), y: Math.max(a.y, b.y),
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  };
  const place = (n, x, y, active, ancestorClip) => {
    const size = sizes.get(n.id), bounds = { x, y, ...size }, effectiveActive = active && n.visible !== false;
    const clip = n.clip ? intersect(ancestorClip, bounds) : ancestorClip;
    nodes.push({ id: n.id, parent: parents.get(n.id)?.id ?? null, ...bounds, active: effectiveActive, clip });
    fullWork.worldEvaluations++;
    let cy = y + (n.padding ?? 0);
    let placed = 0;
    for (const child of n.children ?? []) {
      if (child.visible !== false && placed++ > 0) cy += n.gap ?? 0;
      place(child, x + (n.padding ?? 0), cy, effectiveActive, clip);
      if (child.visible !== false) cy += sizes.get(child.id).height;
      fullWork.childPlacementEvaluations++;
    }
  };
  place(tree, 0, 0, true, null);
  return { nodes, work: fullWork };
}
function oracleHit(nodes, x, y) {
  for (const n of [...nodes].reverse()) {
    if (!n.active) continue;
    const r = n.clip ? {
      left: Math.max(n.x, n.clip.x), top: Math.max(n.y, n.clip.y),
      right: Math.min(n.x + n.width, n.clip.x + n.clip.width), bottom: Math.min(n.y + n.height, n.clip.y + n.clip.height)
    } : { left: n.x, top: n.y, right: n.x + n.width, bottom: n.y + n.height };
    if (x >= r.left && y >= r.top && x < r.right && y < r.bottom) return n.id;
  }
  return null;
}
const byId = (snapshot, id) => snapshot.nodes.find(n => n.id === id);
function compare(model) {
  const got = model.flush(), want = oracle(model.source());
  assert.deepEqual(got.nodes, want.nodes, 'cached incremental rectangles must match independent source oracle');
  let boundsChecks = 0;
  for (const p of [[0, 0], [6, 6], [12, 20], [31, 32], [80, 100], [-1, -1]]) {
    assert.equal(model.hit(...p), oracleHit(want.nodes, ...p), `hit ${p}`);
    boundsChecks += model.lastHitWork?.boundsChecks ?? 0;
  }
  return { incremental: got.work, fullOracle: want.work, sampledHitWork: { queries: 6, boundsChecks }, nodes: got.nodes.length, snapshot: got };
}

const tests = [];
const test = (name, catches, fn) => tests.push({ name, catches, fn });
test('nested intrinsic sizes and padded world coordinates', 'missing ancestor aggregation or incorrect coordinate composition', () => {
  const model = new NestedUI(fixture()), result = compare(model);
  assert.equal(byId(result.snapshot, 'root').height, 75);
  assert.equal(byId(result.snapshot, 'a').height, 29);
  assert.equal(byId(result.snapshot, 'a2').y, 19);
  assert.equal(byId(result.snapshot, 'tail').y, 66);
  return result;
});
test('static flush performs no dimension or world evaluation', 'unconditional full layout on unchanged source', () => {
  const m = new NestedUI(fixture()); compare(m); const result = compare(m);
  assert.equal(result.incremental.dimensionEvaluations, 0);
  assert.equal(result.incremental.worldEvaluations, 0);
  return result;
});
test('sparse leaf height propagates through ancestors and shifts following siblings', 'subtree-only invalidation loses ancestor and sibling effects', () => {
  const m = new NestedUI(fixture()); compare(m); m.patch('a1', { height: 20 }); const result = compare(m);
  assert.equal(byId(result.snapshot, 'root').height, 85);
  assert.equal(byId(result.snapshot, 'a2').y, 29);
  assert.equal(byId(result.snapshot, 'b').y, 49);
  assert.ok(result.incremental.dimensionEvaluations < result.fullOracle.dimensionEvaluations);
  return result;
});
test('fixed parent clips size propagation while later sibling placement still changes', 'fixed size incorrectly treated as isolating children and positions', () => {
  const tree = box('root', [box('fixed', [leaf('one', 10), leaf('two', 10)], { width: 40, height: 50 }), leaf('tail', 10)]);
  const m = new NestedUI(tree); compare(m); m.patch('one', { height: 20 }); const r = compare(m);
  assert.equal(byId(r.snapshot, 'root').height, 60); assert.equal(byId(r.snapshot, 'two').y, 20);
  return r;
});
test('hidden child leaves flow and disables descendant hit', 'visibility changes fail to invalidate ancestors or hit state', () => {
  const m = new NestedUI(fixture()); compare(m); m.patch('a', { visible: false }); const r = compare(m);
  assert.equal(byId(r.snapshot, 'root').height, 40); assert.equal(byId(r.snapshot, 'a1').active, false);
  m.patch('a', { visible: true }); const restored = compare(m);
  assert.equal(byId(restored.snapshot, 'root').height, 75);
  return { hidden: r.incremental, restored: restored.incremental };
});
test('insert and remove update flow and node identity', 'structure edits leave stale rectangles or cached aggregates', () => {
  const m = new NestedUI(fixture()); compare(m); m.insert('a', leaf('new', 7), 1); const added = compare(m);
  assert.equal(byId(added.snapshot, 'a').height, 39);
  m.remove('new'); const removed = compare(m);
  assert.equal(byId(removed.snapshot, 'a').height, 29); assert.equal(byId(removed.snapshot, 'new'), undefined);
  return { inserted: added.incremental, removed: removed.incremental };
});
test('reparent updates old and new ancestor chains plus world positions', 'reparent invalidates only destination or keeps old world transform', () => {
  const m = new NestedUI(fixture()); compare(m); m.reparent('a2', 'b', 0); const r = compare(m);
  assert.equal(byId(r.snapshot, 'a').height, 14); assert.equal(byId(r.snapshot, 'b').height, 35);
  assert.equal(byId(r.snapshot, 'a2').parent, 'b'); assert.equal(byId(r.snapshot, 'a2').y, 25);
  return r;
});
test('external glyph-width fixture changes text line count and ancestor height', 'measurement input change fails to propagate text height', () => {
  const text = box('text', [], { text: { glyphWidths: [6, 6, 6], wrapWidth: 12, lineHeight: 10 } });
  const m = new NestedUI(box('root', [text, leaf('tail', 5)], { gap: 2 })); compare(m);
  m.patch('text', { text: { glyphWidths: [6, 6, 6, 6, 6], wrapWidth: 12, lineHeight: 10 } }); const r = compare(m);
  assert.equal(byId(r.snapshot, 'text').height, 30); assert.equal(byId(r.snapshot, 'tail').y, 32);
  return { ...r, measurementScope: 'External synthetic advance widths; no font, shaping, CJK, emoji or IME execution.' };
});
test('acyclic explicit dimension reference invalidates dependent width', 'referenced dimension change keeps stale dependent cache', () => {
  const m = new NestedUI(box('root', [leaf('basis', 10, 30), leaf('dependent', 5, { ref: 'basis', factor: 2 })])); compare(m);
  m.patch('basis', { width: 40 }); const r = compare(m);
  assert.equal(byId(r.snapshot, 'dependent').width, 80); assert.equal(byId(r.snapshot, 'root').width, 80); return r;
});
test('illegal dimension dependency cycle is rejected without state change', 'cyclic reference commits before dependency validation', () => {
  const m = new NestedUI(fixture()); compare(m); const before = m.source(), snapshot = m.flush();
  assert.throws(() => m.patch('a1', { width: { ref: 'root' } }), /cycle/i);
  assert.deepEqual(m.source(), before); assert.deepEqual(m.flush().nodes, snapshot.nodes);
  return { rejection: 'a1.width -> root.width -> a.width -> a1.width', stateUnchanged: true };
});
test('reparent to descendant is rejected atomically', 'tree cycle edits source before checking ancestry', () => {
  const m = new NestedUI(fixture()); compare(m); const before = m.source(), snapshot = m.flush();
  assert.throws(() => m.reparent('a', 'a1', 0), /descendant|cycle/i);
  assert.deepEqual(m.source(), before); assert.deepEqual(m.flush().nodes, snapshot.nodes);
  return { stateUnchanged: true };
});
test('nested rectangular clipping preserves half-open hit edges', 'hit test ignores inherited clip or includes right and bottom boundaries', () => {
  const m = new NestedUI(box('root', [box('inner', [leaf('overflow', 30, 30)], { width: 15, height: 10, clip: true, padding: 2 })], { width: 20, height: 20, clip: true }));
  const r = compare(m);
  assert.equal(m.hit(3, 3), 'overflow'); assert.equal(m.hit(14, 9), 'overflow');
  assert.equal(m.hit(15, 9), 'root'); assert.equal(m.hit(3, 10), 'root'); assert.equal(m.hit(20, 1), null);
  m.patch('inner', { clip: false }); const changed = compare(m); assert.equal(m.hit(16, 12), 'overflow');
  return { clipped: r.incremental, unclipped: changed.incremental };
});
test('full invalidation records complete recomputation', 'full fallback undercounts work or skips dirty leaves', () => {
  const m = new NestedUI(fixture()); compare(m); m.invalidateAll(); const r = compare(m);
  assert.equal(r.incremental.dimensionEvaluations, r.fullOracle.dimensionEvaluations);
  assert.equal(r.incremental.worldEvaluations, r.nodes); return r;
});
test('invalid insert and invalid glyph widths preserve source state', 'invalid input partly commits source or dirty state', () => {
  const m = new NestedUI(fixture()); compare(m); const before = m.source();
  assert.throws(() => m.insert('a', leaf('a1', 10), 0), /duplicate/i);
  assert.throws(() => m.patch('a1', { text: { glyphWidths: [-1], wrapWidth: 10, lineHeight: 10 } }), /glyph|text/i);
  assert.deepEqual(m.source(), before); compare(m); return { stateUnchanged: true };
});
test('sparse glyph-width arrays are rejected atomically before NaN geometry', 'array hole bypasses glyph validation and contaminates measurements', () => {
  const m = new NestedUI(fixture()); compare(m); const before = m.source(), rectangles = m.flush().nodes;
  assert.throws(() => m.patch('a1', { text: { glyphWidths: new Array(1), wrapWidth: 12, lineHeight: 10 } }), /dense|glyph/i);
  assert.deepEqual(m.source(), before); assert.deepEqual(m.flush().nodes, rectangles);
  return { rejectedInput: 'glyphWidths = new Array(1)', stateUnchanged: true };
});
test('explicit numerical and node budgets reject overflow inputs atomically', 'finite operands overflow content size or an unchecked dependency bound', () => {
  assert.throws(() => new NestedUI(box('root', [leaf('a', 1e308), leaf('b', 1e308)])), /budget/i);
  const m = new NestedUI(fixture()); compare(m); const before = m.source(), rectangles = m.flush().nodes;
  assert.throws(() => m.patch('a1', { height: 1e308 }), /budget/i);
  assert.throws(() => m.patch('a1', { width: { ref: 'a2', factor: 9 } }), /budget/i);
  assert.throws(() => m.patch('a1', { text: { glyphWidths: [1], wrapWidth: 1e308, lineHeight: 10 } }), /budget/i);
  assert.throws(() => new NestedUI(box('root', Array.from({ length: 128 }, (_, i) => leaf(`n${i}`, 1)))), /budget/i);
  assert.deepEqual(m.source(), before); assert.deepEqual(m.flush().nodes, rectangles);
  return { rejectedOverflowPair: [1e308, 1e308], inputBudget: { maxNodes: 128, scalarMax: 1e6, referenceFactorMax: 8, glyphCountMax: 4096 }, stateUnchanged: true };
});
test('arbitrary subtree isolation has a demonstrated ancestor and sibling counterexample', 'negative control fails to expose missing upward propagation', () => {
  const tree = fixture(), before = oracle(tree), next = structuredClone(tree); next.children[0].children[0].height = 20;
  const correct = oracle(next), isolated = structuredClone(before.nodes);
  // Deliberately wrong: replacing only a subtree leaves root and later branches stale.
  for (const n of correct.nodes.filter(n => n.id === 'a' || n.parent === 'a')) isolated[isolated.findIndex(old => old.id === n.id)] = n;
  assert.notDeepEqual(isolated, correct.nodes);
  const stale = isolated.filter(n => JSON.stringify(n) !== JSON.stringify(correct.nodes.find(c => c.id === n.id))).map(n => ({ id: n.id, incorrect: n, correct: correct.nodes.find(c => c.id === n.id) }));
  assert.ok(stale.some(n => n.id === 'root')); assert.ok(stale.some(n => n.id === 'b'));
  return { wrongStrategyRejected: true, stale };
});
test('seeded sequence compares structure rectangles clip and hits after every edit', 'mixed edits leave caches inconsistent outside hand fixtures', () => {
  const m = new NestedUI(fixture()); compare(m); let seed = 20261008, checks = 0;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed; };
  const totalWork = { dimensionEvaluations: 0, worldEvaluations: 0, validationNodes: 0, childPlacementEvaluations: 0 };
  for (let i = 0; i < 100; i++) {
    const source = m.source(), ids = [];
    (function collect(n) { if (!n.children?.length) ids.push(n.id); for (const c of n.children ?? []) collect(c); })(source);
    const id = ids[random() % ids.length];
    if (i % 5 === 0) m.patch(id, { visible: random() % 2 === 0 });
    else if (i % 5 === 1) m.patch(id, { height: 1 + random() % 35 });
    else if (i % 5 === 2) m.patch(i % 2 ? 'a' : 'b', { padding: random() % 6, gap: random() % 5, clip: random() % 2 === 0 });
    else if (i % 5 === 3) m.reparent(id, i % 2 ? 'a' : 'b', 0);
    else { m.insert('a', leaf(`insert-${i}`, 1 + random() % 15), 0); m.remove(id); }
    const r = compare(m); for (const k of Object.keys(totalWork)) totalWork[k] += r.incremental[k];
    for (let p = 0; p < 12; p++) {
      const x = random() % 50, y = random() % 200;
      assert.equal(m.hit(x, y), oracleHit(r.snapshot.nodes, x, y)); checks++;
    }
  }
  return { seed: 20261008, editSteps: 100, extraHitComparisons: checks, work: totalWork };
});

const results = [];
for (const t of tests) {
  try { results.push({ name: t.name, status: 'passed', observations: { catches: t.catches, ...t.fn() } }); }
  catch (error) { results.push({ name: t.name, status: 'failed', error: { message: error.message, stack: error.stack }, observations: { catches: t.catches } }); }
}
const sourcePaths = ['model.mjs', 'run.mjs'];
const sourceHashes = sourcePaths.map(p => ({ path: `experiments/nested-ui-probe/${p}`, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, p))).digest('hex') }));
const report = {
  schemaVersion: 1, experiment: 'nested-ui-probe', checkedAtUtc: new Date().toISOString(),
  mode: unsafeIsolation ? 'deliberately-unsafe-subtree-isolation-negative-control' : 'production-research-model',
  environment: { node: process.version, platform: process.platform, arch: process.arch, execution: 'CPU-only deterministic research model; no external dependencies' },
  counts: { total: results.length, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length },
  results, sourceHashes,
  limitations: ['Finite vertical layout semantics only, not EUI compatibility.', 'Text widths are an external synthetic fixture, not real font/shaping/CJK/IME validation.', 'No timing, FPS, device, GPU, or performance-advantage claims.', 'Mutation validation traverses the entire source and dependency graphs; changed frames traverse all nodes for world state, with cached dimension recomputation.', 'Arbitrary subtree isolation is explicitly invalid when content-size ancestors or flow siblings depend on it.']
};
report.limitations.push('Supported input budget: <=128 nodes, scalar dimensions/padding/gap/text inputs <=1e6, reference factors <=8, <=4096 dense glyph advances. No general guarantee for arbitrary finite inputs, fractional rounding, or extreme recursion.');
const red = process.argv.includes('--red');
const auditRed = process.argv.includes('--audit-red');
if (red || auditRed || unsafeIsolation) report.sourceSnapshots = sourcePaths.map(p => ({ path: `experiments/nested-ui-probe/${p}`, source: fs.readFileSync(path.join(dir, p), 'utf8') }));
const output = path.resolve(dir, '../../evidence', unsafeIsolation ? 'nested-ui-probe-unsafe-isolation-results.json' : auditRed ? 'nested-ui-probe-audit-red-results.json' : red ? 'nested-ui-probe-red-results.json' : 'nested-ui-probe-results.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, counts: report.counts, failed: results.filter(r => r.status === 'failed').map(r => ({ name: r.name, message: r.error.message })) }, null, 2));
process.exitCode = report.counts.failed ? 1 : 0;
