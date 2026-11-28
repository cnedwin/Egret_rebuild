// SPDX-License-Identifier: Apache-2.0
// Compiler and check maintenance: the recorded owners, successors and inline policy, against the
// histories in tests/helpers/maintenance-history.mjs.
import nodeTest from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  baselineFixture,
  compilerFixture,
  compilerTool,
  fixture,
  maintenance
} from '../helpers/incremental-fixtures.mjs';
import {
  authoredSceneCompilerFixtureHistory,
  authoredSceneCompilerFixturePrevious,
  authoredSceneStrictCallerHistory,
  importedGlbAnimationCompilerFixturePrevious,
  importedGlbAnimationCompilerHistory,
  lambertGlbCompilerFixturePrevious,
  lambertGlbCompilerHistory,
  m12BootstrapAfter,
  m12BoundaryHistory,
  m15BootstrapAfter,
  m15BootstrapBefore,
  m15DeclarationFixtureInput,
  m15DeclarationPin,
  m15InlineGateHistory,
  m24CompatibleSequencePrevious,
  m24CompatibleSequenceSourceHistory,
  m24ResetPrevious,
  m24ResetSourceHistory,
  m24SpinePrevious,
  m24SpineSourceHistory,
  m31NavigationFixtureInsertion,
  m31NavigationFixturePrevious,
  m31NavigationFixtureSource,
  m31UiBoundaryHistory,
  m31UiStrictHistory,
  m33BoundaryFixtureInput,
  m33BoundaryHistory,
  m33KeyboardPrevious,
  m33KeyboardSourceHistory,
  m33StrictPredecessor,
  m34ThemePrevious,
  m34ThemeSelectionPrevious,
  m34ThemeSelectionSourceHistory,
  m34ThemeSourceHistory,
  m3KeyRevealPrevious,
  m3KeyRevealSourceHistory,
  m42ContainedClipPrevious,
  m42ContainedClipSourceHistory,
  m42GeometryCanonicalPrevious,
  m42GeometryCanonicalSourceHistory,
  sceneAnimationCompilerFixturePrevious,
  sceneAnimationCompilerHistory,
  texturedGlbCompilerFixturePrevious,
  texturedGlbCompilerHistory,
  uiControlsPrevious,
  uiControlsSourceHistory,
  worldCardCompilerFixturePrevious,
  worldCardCompilerHistory
} from '../helpers/maintenance-history.mjs';

// Cases that replay recorded tool or product bytes are evidence: they hold only for the bytes the
// maintenance tools were written against. This file registers every other case. Its sibling
// incremental-checks-evidence.test.mjs imports it with ?lane=evidence and registers only these.
const evidenceLane = new URL(import.meta.url).searchParams.get('lane') === 'evidence';
const evidenceCases = new Set([
  'inline policy mode is explicit on preparation and freshness checking',
  'sealed inline declarations preserve digest strength source spans and conditional review limits',
  'M1.4 compiler maintenance admits only the exact appended WebGL2 checker revision',
  'any registered gate byte change refuses opt-in extraction and invalidates default freshness',
  'condition disagreements remain observations and never silently replace history',
  'inline fixture drift and missing inputs preserve raw comparisons without diagnostic execution',
  'M1.2 compiler maintenance keeps both complete sequence source pairs and saved diagnostics',
  'M1.4 strict bootstrap preserves complete sequence history and refuses unrelated bytes',
  'M1.5 strict bootstrap admits nine exact revisions and preserves both predecessor stages',
  'M1.5 inline maintenance preserves delegate and scene revisions with exact historical inverses',
  'M1.2 strict bootstrap keeps nine exact current sources and reverses only its one helper literal',
  'M3.1 current compiler metadata proves exact UI source inverses and refuses unknown wrapper bytes',
  'M3.3 keyboard strict preparation authenticates nine current wrappers before retained extraction',
  'M3.1 key-navigation compiler successor restores exact history and refuses inserted or unrelated drift',
  'M3.4 theme compiler successor retains historical extraction and rejects exact-receipt drift',
  'M2.4 RESET compiler successor preserves theme history and rejects unrelated or duplicate drift',
  'authored scene type input keeps the previous compiler observation and rejects altered owners',
  'M1.2 NineSlice source mapping is exact to owner history and current bytes',
  'M1.2 capture source mapping keeps twelve original strict owners and exact raw identity',
  'M2.4 finite current source inverses retain complete originals and reject drift'
]);
const registered = new Set();
const test = (name, ...rest) => {
  if (registered.has(name)) throw Error('Duplicate case name: ' + name);
  registered.add(name);
  return evidenceCases.has(name) === evidenceLane ? nodeTest(name, ...rest) : undefined;
};
test('compiler preparation retains registered declaration owners and shared raw references without execution', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const p = m.prepareCompilerReview(f.root);
    assert.equal(p.status, 'review-required');
    assert.equal(p.acceptance, 'none');
    assert.equal(p.coverage.registered.length, 18);
    assert.deepEqual(p.coverage.unregistered, []);
    const row = p.references.find(x => x.owner === 'compiler' && x.path === 'index.js');
    assert.equal(row.references.length, 15);
    assert.equal(row.identity, 'same');
    assert.equal(p.dependencies.length, 3);
    assert.equal(m.verifyCompilerProposal(f.root, p).status, 'current-inputs');
  } finally {
    f.close();
  }
});
test('compiler input edits additions missing files and owner metadata invalidate prior proposals', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const p = m.prepareCompilerReview(f.root);
    f.put('node_modules/typescript/new.js', 'new');
    assert.throws(() => m.verifyCompilerProposal(f.root, p), /changed/);
    const fresh = m.prepareCompilerReview(f.root);
    assert.ok(fresh.dependencies.find(x => x.owner === 'compiler').inventory.some(x => x.path === 'new.js'));
    fs.unlinkSync(path.join(f.root, 'node_modules/typescript/index.js'));
    const missing = m.prepareCompilerReview(f.root);
    assert.equal(missing.references.find(x => x.owner === 'compiler' && x.path === 'index.js').identity, 'missing');
    f.put('node_modules/typescript/package.json', JSON.stringify({ name: 'foreign', version: '7.0.2' }));
    assert.throws(() => m.prepareCompilerReview(f.root), /package name/);
  } finally {
    f.close();
  }
});
test('compiler registry refuses duplicate keys paths unsupported owners and coerced raw pins', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'tests/types/linear-layout-diagnostic-expectations.json',
      raw = fs.readFileSync(path.join(f.root, file), 'utf8'),
      v = JSON.parse(raw);
    for (const value of [
      raw.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
      JSON.stringify({ ...v, inputPins: [v.inputPins[0], v.inputPins[0]] }),
      JSON.stringify({ ...v, inputPins: [{ ...v.inputPins[0], path: 'node_modules/foreign/index.js' }] }),
      JSON.stringify({ ...v, inputPins: [{ ...v.inputPins[0], sha256: [v.inputPins[0].sha256] }] })
    ]) {
      f.put(file, value);
      assert.throws(() => m.prepareCompilerReview(f.root));
    }
  } finally {
    f.close();
  }
});
test('compiler raw comparisons preserve independent historical expectations and reject tampering', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'tests/types/linear-layout-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file)));
    v.inputPins.find(x => x.path === 'node_modules/typescript/index.js').sha256 = '0'.repeat(64);
    f.put(file, JSON.stringify(v));
    const p = m.prepareCompilerReview(f.root),
      r = p.references.find(x => x.owner === 'compiler' && x.path === 'index.js');
    assert.equal(r.identity, 'different');
    assert.equal(r.references.filter(x => x.matches).length, 14);
    p.acceptance = 'PASS';
    assert.throws(() => m.verifyCompilerProposal(f.root, p), /changed/);
  } finally {
    f.close();
  }
});

test('compiler observations bind uninterpreted provenance fields and gate source bytes', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const p = m.prepareCompilerReview(f.root),
      file = 'tests/types/linear-layout-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file)));
    v.originalCompilerObservation.setupReceiptPin = { path: 'never-follow-this-historical-path' };
    f.put(file, JSON.stringify(v));
    assert.throws(() => m.verifyCompilerProposal(f.root, p), /changed/);
    const fresh = m.prepareCompilerReview(f.root);
    assert.equal(fresh.status, 'review-required');
    f.put('tools/linear-layout-types.mjs', 'throw Error("changed source is not executed");');
    assert.throws(() => m.verifyCompilerProposal(f.root, fresh), /changed/);
  } finally {
    f.close();
  }
});
test('compiler inventory rejects internal links and mismatched wrapper-native resolution', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const nested = path.join(f.root, 'node_modules/typescript/linked');
    fs.symlinkSync(path.join(f.root, 'packages'), nested, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => m.prepareCompilerReview(f.root), /Nonregular/);
    fs.unlinkSync(nested);
    const alternate = 'node_modules/typescript/node_modules/@typescript/typescript-win32-x64';
    f.put(alternate + '/package.json', JSON.stringify({ name: '@typescript/typescript-win32-x64', version: '7.0.2' }));
    assert.throws(() => m.prepareCompilerReview(f.root), /native owners differ|Nonregular/);
  } finally {
    f.close();
  }
});

test('compiler metadata reader refuses redirected or conditional native exports', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'node_modules/@typescript/typescript-win32-x64/package.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file)));
    for (const exports of [
      { './package.json': './alternate.json' },
      { './package.json': { default: './package.json' } }
    ]) {
      f.put(file, JSON.stringify({ ...v, exports }));
      assert.throws(() => m.prepareCompilerReview(f.root), /export mapping/);
    }
  } finally {
    f.close();
  }
});

test('native declarations retain explicit owners and historical expectations', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const p = m.prepareCompilerReview(f.root),
      row = p.references.find(x => x.owner === 'compiler-native' && x.path === 'lib/lib.es5.d.ts');
    assert.equal(row.references.length, 8);
    assert.equal(row.identity, 'same');
    f.put('node_modules/typescript/lib/lib.es5.d.ts', 'wrapper drift');
    const wrapper = m.prepareCompilerReview(f.root);
    assert.equal(
      wrapper.references.find(x => x.owner === 'compiler-native' && x.path === 'lib/lib.es5.d.ts').identity,
      'same'
    );
    assert.throws(() => m.verifyCompilerProposal(f.root, p), /changed/);
    f.put('node_modules/@typescript/typescript-win32-x64/lib/lib.es5.d.ts', 'native drift');
    const changed = m.prepareCompilerReview(f.root);
    assert.equal(
      changed.references.find(x => x.owner === 'compiler-native' && x.path === 'lib/lib.es5.d.ts').identity,
      'different'
    );
    fs.unlinkSync(path.join(f.root, 'node_modules/@typescript/typescript-win32-x64/lib/lib.es5.d.ts'));
    assert.equal(
      m
        .prepareCompilerReview(f.root)
        .references.find(x => x.owner === 'compiler-native' && x.path === 'lib/lib.es5.d.ts').identity,
      'missing'
    );
  } finally {
    f.close();
  }
});
test('native selectors fail closed on platform path duplicates and absent lists', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'tests/types/linear-layout-diagnostic-expectations.json',
      raw = fs.readFileSync(path.join(f.root, file));
    for (const mutate of [
      v => delete v.nativeLibraryPins,
      v => v.nativeLibraryPins.push(v.nativeLibraryPins[0]),
      v => (v.nativeLibraryPins[0].path = 'lib/lib.dom.d.ts'),
      v => (v.nativeLibraryPins[0].path = '../lib.es5.d.ts'),
      v => (v.originalCompilerObservation.platform = 'linux'),
      v => (v.originalCompilerObservation.nativePackage = 'foreign'),
      v => (v.originalCompilerObservation.nativeBinaryPin.path = 'index.js')
    ]) {
      f.put(file, raw);
      assert.equal(m.prepareCompilerReview(f.root).acceptance, 'none');
      const v = JSON.parse(raw);
      mutate(v);
      f.put(file, JSON.stringify(v));
      assert.throws(() => m.prepareCompilerReview(f.root));
    }
    f.put(file, raw);
    const ns = 'tests/types/nine-slice-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, ns)));
    v.compiler.nativePlatform.package.path = 'node_modules/@typescript/typescript-win32-x64/package.json';
    f.put(ns, JSON.stringify(v));
    assert.throws(() => m.prepareCompilerReview(f.root));
  } finally {
    f.close();
  }
});
test('legacy digest expectations never invent bytes or follow provenance paths', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'tests/types/scene3d-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file)));
    v.compiler.packageSHA256 = '0'.repeat(64);
    f.put(file, JSON.stringify(v));
    const legacy = 'tests/types/spritesheet-diagnostic-expectations.json',
      s = JSON.parse(fs.readFileSync(path.join(f.root, legacy)));
    s.observedProvenance = { physicalOwnerObservations: [{ path: 'C:/private/never-follow', sha256: 'untrusted' }] };
    f.put(legacy, JSON.stringify(s));
    const p = m.prepareCompilerReview(f.root),
      row = p.declarations.find(x => x.selector === 'compiler.packageSHA256').rows[0];
    assert.equal(row.comparison, 'sha256-only');
    assert.equal(row.identity, 'different');
    assert.equal(Object.hasOwn(row.expected, 'bytes'), false);
    assert(!p.inputs.some(x => x.path.includes('private')));
    v.fixtureSHA256['tests/types/foreign.ts'] = '0'.repeat(64);
    f.put(file, JSON.stringify(v));
    assert.throws(() => m.prepareCompilerReview(f.root), /fixture/i);
  } finally {
    f.close();
  }
});
test('registered coverage records new inventory names without reading or trusting their content', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const p = m.prepareCompilerReview(f.root);
    f.put('tests/types/future-diagnostic-expectations.json', 'not parsed');
    assert.throws(() => m.verifyCompilerProposal(f.root, p), /changed/);
    const next = m.prepareCompilerReview(f.root);
    assert.deepEqual(next.coverage.unregistered, ['tests/types/future-diagnostic-expectations.json']);
    assert.equal(next.acceptance, 'none');
    fs.unlinkSync(path.join(f.root, 'tests/types/atlas-frame-diagnostic-expectations.json'));
    assert.throws(() => m.prepareCompilerReview(f.root), /missing/i);
  } finally {
    f.close();
  }
});
test('registered successors stay separate from original raw expectations', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'tests/types/display-container-child-index-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file)));
    v.inputPins.find(x => x.path === 'packages/engine/dist/index.d.ts').sha256 = '0'.repeat(64);
    f.put(file, JSON.stringify(v));
    const p = m.prepareCompilerReview(f.root),
      groups = p.declarations.filter(x => x.owner === file);
    assert.equal(
      groups.find(x => x.selector === 'inputPins').rows.find(x => x.path === 'packages/engine/dist/index.d.ts')
        .identity,
      'different'
    );
    assert.equal(groups.find(x => x.selector === 'currentInputIdentitySuccessor.rows').rows[0].identity, 'same');
    assert.equal(p.acceptance, 'none');
  } finally {
    f.close();
  }
});
function inlineCompilerFixture({ m15 = false, m12 = false } = {}) {
  const f = compilerFixture();
  for (const name of [
    'check-types',
    'bitmap-resource-slot-types',
    'bitmap-binding-ticket-types',
    'linear-layout-types',
    'bitmap-button-types',
    'display-anchor-offsets-types',
    'display-container-add-child-at-types',
    'display-container-child-index-types',
    'display-container-remove-children-types',
    'sequence-playback-types'
  ]) {
    const file = 'tools/' + name + '.mjs',
      current = m33StrictPredecessor(file, fs.readFileSync(new URL('../../' + file, import.meta.url))),
      raw = Buffer.from(current.toString().replace(m12BootstrapAfter, m15BootstrapAfter));
    f.put(file, m12 ? current : m15 ? raw : Buffer.from(raw.toString().replace(m15BootstrapAfter, m15BootstrapBefore)));
  }
  for (const [family, lanes] of [
    ['mouse-input', ['positive', 'negative', 'import-negative', 'dom-free-negative']],
    ['spine-import-plan', ['positive', 'negative', 'import-negative']]
  ])
    for (const lane of lanes) {
      const file = 'tests/types/' + family + '-' + lane + '.ts';
      f.put(file, fs.readFileSync(new URL('../../' + file, import.meta.url)));
    }
  for (const name of [
    'display-container-add-child-at',
    'display-container-child-index',
    'display-container-remove-children',
    'sequence-playback'
  ]) {
    const file = 'tests/types/' + name + '-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file))),
      original = JSON.parse(fs.readFileSync(new URL('../../' + file, import.meta.url)));
    if (name === 'sequence-playback')
      v.currentDeclarationSuccessor.sourcePins = original.currentDeclarationSuccessor.sourcePins;
    else {
      v.currentInputIdentitySuccessor.rows = original.currentInputIdentitySuccessor.rows;
      v.inputPins.push(original.inputPins.find(x => x.path === 'packages/runtime/dist/DisplayObject.d.ts'));
    }
    f.put(file, JSON.stringify(v));
  }
  return f;
}
test('inline policy mode is explicit on preparation and freshness checking', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    assert.deepEqual(m.parseCompilerOptions(['--inline-policies']), { inlinePolicies: true });
    assert.deepEqual(m.parseCompilerOptions(['--check', path.resolve('review.json'), '--inline-policies']), {
      inlinePolicies: true,
      check: path.resolve('review.json')
    });
    for (const args of [
      ['--inline-policies', '--inline-policies'],
      ['--gate', 'evil.mjs'],
      ['--check', 'relative.json']
    ])
      assert.throws(() => m.parseCompilerOptions(args));
    for (const options of [{ inlinePolicies: 'true' }, { sourcePins: [] }, { inlinePolicies: true, extra: true }])
      assert.throws(() => m.prepareCompilerReview(f.root, options));
    const plain = m.prepareCompilerReview(f.root),
      p = m.prepareCompilerReview(f.root, { inlinePolicies: true });
    assert.equal(plain.inlinePolicies, null);
    assert.equal(p.acceptance, 'none');
    assert.equal(p.schemaVersion, 3);
    assert.equal(m.verifyCompilerProposal(f.root, p, { inlinePolicies: true }).status, 'current-inputs');
    assert.throws(() => m.verifyCompilerProposal(f.root, p), /mode/i);
    assert.throws(() => m.verifyCompilerProposal(f.root, plain, { inlinePolicies: true }), /mode/i);
  } finally {
    f.close();
  }
});
test('sealed inline declarations preserve digest strength source spans and conditional review limits', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    const p = m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      inline = p.inlinePolicies;
    assert.equal(inline.sources.length, 10);
    assert.equal(inline.literals.length, 10);
    assert.equal(inline.conditions.length, 13);
    assert.equal(inline.sourceRevisions.length, 10);
    for (const literal of [...inline.literals, ...inline.conditions.filter(x => x.branch).map(x => x.branch)]) {
      const raw = fs.readFileSync(path.join(f.root, literal.owner)),
        selected = raw.subarray(literal.startByte, literal.endByte);
      assert.equal(selected.length, literal.bytes);
      assert.equal(createHash('sha256').update(selected).digest('hex'), literal.sha256);
    }
    const rows = p.declarations.filter(x => x.owner === 'tools/check-types.mjs').flatMap(x => x.rows);
    assert.equal(rows.length, 11);
    assert(rows.every(x => x.comparison === 'sha256-only' && !Object.hasOwn(x.expected, 'bytes')));
    const native = inline.conditions.filter(x => x.kind === 'saved-native-host');
    assert.equal(native.length, 8);
    assert(
      native.every(
        x =>
          x.admission === 'not-evaluated' &&
          x.savedHost.platform === 'win32' &&
          x.readerHost.platform === process.platform
      )
    );
    assert(
      inline.conditions
        .filter(x => x.kind === 'container-successor')
        .every(x => x.historyAgreement && x.successorAgreement)
    );
    assert.equal(inline.conditions.find(x => x.kind === 'sequence-negative-successor').sourceAgreement, true);
  } finally {
    f.close();
  }
});

// UNIT: admit one appended checker import without moving or replacing inline history.
test('M1.4 compiler maintenance admits only the exact appended WebGL2 checker revision', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    f.put(
      'tools/check-types.mjs',
      m15InlineGateHistory(fs.readFileSync(path.join(f.root, 'tools/check-types.mjs'))).m14
    );
    const file = 'tools/check-types.mjs',
      raw = fs.readFileSync(path.join(f.root, file));
    const suffix = Buffer.from("await import('./shared-webgl2-types.mjs');\n"),
      prior = raw.subarray(0, raw.length - suffix.length);
    const identity = body => ({
      path: file,
      bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex')
    });
    const oldPin = {
      path: file,
      bytes: 121118,
      sha256: '64d5996ebf925b8b2eda7e04d20e939e399d50953da0023a48ffd02223985093'
    };
    const newPin = {
      path: file,
      bytes: 121161,
      sha256: 'c85407cbdc9c6222cbf240de21e82afd37725e6c8a68bed9ca0d098d7b6dc343'
    };
    assert.deepEqual(raw.subarray(raw.length - suffix.length), suffix);
    assert.deepEqual(identity(prior), oldPin);
    assert.deepEqual(identity(raw), newPin);
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      current = collect();
    const revision = current.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
    assert.equal(revision.base.bytes, 94916);
    assert.equal(revision.base.sha256, '13080da8e72418df9b8e8279d09b53e36839a5826953f84143c5787d1d1bff7a');
    assert.equal(revision.predecessor, null);
    assert.deepEqual(revision.successor, oldPin);
    assert.deepEqual(revision.m14Successor, newPin);
    assert.equal(revision.selection, 'm14-current');
    assert.equal(revision.admission, 'not-evaluated');
    f.put(file, prior);
    const previous = collect();
    assert.equal(previous.inlinePolicies.sourceRevisions.find(row => row.current.path === file).selection, 'current');
    assert.deepEqual(previous.inlinePolicies.literals, current.inlinePolicies.literals);
    assert.deepEqual(
      previous.declarations.filter(row => row.owner === file),
      current.declarations.filter(row => row.owner === file)
    );
    assert.throws(() => m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }), /changed/);
    f.put(file, raw);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
    const literal = current.inlinePolicies.literals.find(row => row.owner === file),
      changedLiteral = Buffer.from(raw);
    changedLiteral[literal.startByte] ^= 1;
    const variants = [
      Buffer.concat([raw, suffix]),
      Buffer.concat([suffix, prior]),
      Buffer.from(raw.toString().replace('./shared-webgl2-types.mjs', './shared-webgl2-typez.mjs')),
      changedLiteral,
      Buffer.concat([raw, Buffer.from('// unreviewed drift\n')])
    ];
    for (const altered of variants) {
      f.put(file, raw);
      const baseline = collect();
      assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
      f.put(file, altered);
      assert.throws(collect, /Unreviewed inline policy source: tools\/check-types\.mjs/);
      assert.throws(() => m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }));
    }
    f.put(file, raw);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

test('any registered gate byte change refuses opt-in extraction and invalidates default freshness', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    const paths = m.prepareCompilerReview(f.root, { inlinePolicies: true }).inlinePolicies.sources.map(x => x.path);
    for (const file of paths) {
      const raw = fs.readFileSync(path.join(f.root, file));
      const baseline = m.prepareCompilerReview(f.root, { inlinePolicies: true }),
        plain = m.prepareCompilerReview(f.root);
      try {
        f.put(file, Buffer.concat([raw, Buffer.from('\n// changed policy source\n')]));
        assert.throws(
          () => m.prepareCompilerReview(f.root, { inlinePolicies: true }),
          /reviewed.*source|source.*review/i
        );
        assert.throws(() => m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }));
        assert.throws(() => m.verifyCompilerProposal(f.root, plain), /changed/);
      } finally {
        f.put(file, raw);
      }
    }
    const file = 'tools/check-types.mjs',
      raw = fs.readFileSync(path.join(f.root, file));
    f.put(file, Buffer.concat([Buffer.from('/* fake declaration context\n'), raw, Buffer.from('\n*/')]));
    assert.throws(() => m.prepareCompilerReview(f.root, { inlinePolicies: true }), /source/i);
  } finally {
    f.close();
  }
});
test('condition disagreements remain observations and never silently replace history', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    const file = 'tests/types/display-container-child-index-diagnostic-expectations.json',
      raw = fs.readFileSync(path.join(f.root, file)),
      p = m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      v = JSON.parse(raw);
    v.currentInputIdentitySuccessor.rows[0].sha256 = '0'.repeat(64);
    f.put(file, JSON.stringify(v));
    assert.throws(() => m.verifyCompilerProposal(f.root, p, { inlinePolicies: true }), /changed/);
    const r = m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      condition = r.inlinePolicies.conditions.find(x => x.kind === 'container-successor' && x.inventory === file);
    assert.equal(condition.historyAgreement, true);
    assert.equal(condition.successorAgreement, false);
    assert.equal(condition.admission, 'not-evaluated');
    const declarations = r.declarations.filter(x => x.owner === 'tools/display-container-child-index-types.mjs');
    assert.equal(declarations.length, 2);
    assert.notEqual(declarations[0].rows[0].expected.sha256, declarations[1].rows[0].expected.sha256);
  } finally {
    f.close();
  }
});
test('inline fixture drift and missing inputs preserve raw comparisons without diagnostic execution', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    const file = 'tests/types/spine-import-plan-negative.ts',
      raw = fs.readFileSync(path.join(f.root, file));
    for (const missing of [false, true]) {
      f.put(file, raw);
      const p = m.prepareCompilerReview(f.root, { inlinePolicies: true });
      assert.equal(p.references.find(x => x.owner === 'repository' && x.path === file).identity, 'same');
      if (missing) fs.unlinkSync(path.join(f.root, file));
      else f.put(file, Buffer.concat([raw, Buffer.from('\n// drift')]));
      assert.throws(() => m.verifyCompilerProposal(f.root, p, { inlinePolicies: true }), /changed/);
      const fresh = m.prepareCompilerReview(f.root, { inlinePolicies: true });
      assert.equal(
        fresh.references.find(x => x.owner === 'repository' && x.path === file).identity,
        missing ? 'missing' : 'different'
      );
    }
  } finally {
    f.close();
  }
});

// UNIT: maintenance records raw declarations; it does not grant source admission.
test('M1.1 maintenance keeps three explicit successor owners and cross-owner graph coverage', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'packages/engine/web/webgpuBufferPool.ts';
    f.put(file, 'export {};\n');
    const pin = f.pin(file);
    const owners = [
      'tools/spritesheet-boundary.mjs',
      'tools/browser-png-boundary.mjs',
      'tools/atlas-import-boundary.mjs'
    ];
    for (const owner of owners) {
      const raw = fs.readFileSync(path.join(f.root, owner), 'utf8');
      f.put(
        owner,
        raw.replace(
          'const m11WarmSubmissionGraphSuccessor = [];',
          'const m11WarmSubmissionGraphSuccessor = ' + JSON.stringify([pin]) + ';'
        )
      );
    }
    const unlisted = 'packages/engine/web/unregistered.ts';
    f.put(unlisted, 'export {};\n');
    const p = m.prepareBaselineReview(f.root);
    assert.equal(p.declarations.length, 36);
    assert.equal(p.policyLinks.length, 3);
    assert.equal(p.successorPairs.length, 7);
    assert.deepEqual(
      p.declarations.filter(row => row.binding === 'm11WarmSubmissionGraphSuccessor').map(row => row.owner),
      owners
    );
    for (const [index, coverage] of p.graphCoverage.entries()) {
      assert.deepEqual(coverage.warmSuccessor, { owner: owners[index], binding: 'm11WarmSubmissionGraphSuccessor' });
      assert.equal(
        coverage.unlisted.some(row => row.path === file),
        false
      );
      assert.ok(coverage.unlisted.some(row => row.path === unlisted));
    }
    assert.deepEqual(
      p.references.find(row => row.path === file).references.map(row => [row.owner, row.binding, row.branch]),
      owners.map(owner => [owner, 'm11WarmSubmissionGraphSuccessor', 'expected'])
    );
    const historical = p.references.find(row => row.path === 'packages/engine/src/value.ts').references;
    assert.equal(
      historical.filter(row => row.binding === 'imageResidencySuccessors' && row.branch === 'base').length,
      2
    );
    assert.equal(
      historical.filter(row => row.binding === 'imageResidencySuccessors' && row.branch === 'current').length,
      2
    );
    assert.equal(m.verifyMaintenanceProposal(f.root, p), true);
    f.put(file, 'export const changed = 1;\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/);
    assert.ok(
      m
        .prepareBaselineReview(f.root)
        .declarations.filter(row => row.binding === 'm11WarmSubmissionGraphSuccessor')
        .every(row => row.rows[0].identity === 'different')
    );
  } finally {
    f.close();
  }
});

// UNIT: source succession is a raw relationship, never compiler acceptance.
test('M1.2 compiler maintenance keeps both complete sequence source pairs and saved diagnostics', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    const source = 'packages/runtime/src/DisplayObject.ts',
      declaration = 'packages/runtime/dist/DisplayObject.d.ts';
    for (const file of [source, declaration]) f.put(file, fs.readFileSync(new URL('../../' + file, import.meta.url)));
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true });
    const baseline = collect(),
      condition = baseline.inlinePolicies.conditions.find(row => row.kind === 'sequence-source-successor');
    assert.deepEqual(
      [
        condition.pathsAgreement,
        condition.unchangedDeclaration,
        condition.completeBaseMatch,
        condition.completeCurrentMatch
      ],
      [true, true, false, false]
    );
    assert.equal(condition.admission, 'not-evaluated');
    const revision = baseline.inlinePolicies.sourceRevisions.find(
      row => row.current.path === 'tools/sequence-playback-types.mjs'
    );
    assert.equal(revision.selection, 'm14-strict-current');
    assert.notDeepEqual(revision.base, revision.current);
    assert.equal(revision.base.bytes, 17296);
    assert.equal(revision.base.sha256, '8b2d266f7aacd680f7a1581afb2ea1a1381f02fc44cd70b340ee8961c7584222');
    const groups = baseline.declarations.filter(row => row.owner === 'tools/sequence-playback-types.mjs');
    assert.equal(groups.find(row => row.selector === 'expectedCurrentSourcePins').rows[0].identity, 'different');
    assert(
      groups.find(row => row.selector === 'm12IncrementalSourcePins').rows.every(row => row.identity === 'different')
    );
    assert.equal(revision.predecessor.bytes, 18474);
    assert.equal(revision.predecessor.sha256, 'e9388c73080d4db112b3260e17bdfc7d1ff1ca6130fa8cccdae7d3b60084ba6b');
    assert.equal(
      baseline.inlinePolicies.conditions.find(row => row.kind === 'sequence-negative-successor').sourceAgreement,
      true
    );
    for (const file of [source, declaration]) {
      const raw = fs.readFileSync(path.join(f.root, file));
      try {
        f.put(file, Buffer.concat([raw, Buffer.from('\n// unregistered source identity\n')]));
        assert.throws(() => m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }), /changed/);
        const changed = collect().inlinePolicies.conditions.find(row => row.kind === 'sequence-source-successor');
        assert.equal(changed.completeBaseMatch, false);
        assert.equal(changed.completeCurrentMatch, false);
      } finally {
        f.put(file, raw);
      }
    }
    assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

// UNIT: explicit M1.2 owners remain observations, never automatic gate authority.
test('M1.2 maintenance retains complete successor owners and historical cross-owner references', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'packages/runtime/src/frameCaptureCache.ts';
    f.put(file, 'export {};\n');
    const pin = f.pin(file);
    const owners = [
      'tools/spritesheet-boundary.mjs',
      'tools/browser-png-boundary.mjs',
      'tools/atlas-import-boundary.mjs'
    ];
    for (const owner of owners) {
      const raw = fs.readFileSync(path.join(f.root, owner), 'utf8');
      f.put(
        owner,
        raw.replace(
          'const m12IncrementalRenderingGraphSuccessor = [];',
          'const m12IncrementalRenderingGraphSuccessor = ' + JSON.stringify([pin]) + ';'
        )
      );
    }
    const bbt = 'tools/bitmap-binding-ticket-boundary.mjs',
      owned = f.pin('packages/engine/src/value.ts');
    f.put(
      bbt,
      fs
        .readFileSync(path.join(f.root, bbt), 'utf8')
        .replace(
          'const m12IncrementalOwnershipSuccessor = [];',
          'const m12IncrementalOwnershipSuccessor = ' + JSON.stringify([owned]) + ';'
        )
    );
    const extra = 'packages/runtime/src/unreviewed.ts';
    f.put(extra, 'export {};\n');
    const p = m.prepareBaselineReview(f.root);
    assert.equal(p.status, 'review-required');
    assert.equal(p.declarations.length, 36);
    assert.equal(p.policyLinks.length, 3);
    assert.equal(p.successorPairs.length, 7);
    assert.deepEqual(
      p.declarations.filter(row => row.binding === 'm12IncrementalRenderingGraphSuccessor').map(row => row.owner),
      owners
    );
    assert.deepEqual(
      p.declarations.filter(row => row.binding === 'm12IncrementalOwnershipSuccessor').map(row => row.owner),
      [bbt]
    );
    for (const [index, coverage] of p.graphCoverage.entries()) {
      assert.deepEqual(coverage.incrementalSuccessor, {
        owner: owners[index],
        binding: 'm12IncrementalRenderingGraphSuccessor'
      });
      assert.deepEqual(coverage.warmSuccessor, { owner: owners[index], binding: 'm11WarmSubmissionGraphSuccessor' });
      assert.equal(
        coverage.unlisted.some(row => row.path === file),
        false
      );
      assert.ok(coverage.unlisted.some(row => row.path === extra));
    }
    assert.deepEqual(
      p.references.find(row => row.path === file).references.map(row => [row.owner, row.binding]),
      owners.map(owner => [owner, 'm12IncrementalRenderingGraphSuccessor'])
    );
    const old = p.references.find(row => row.path === owned.path).references;
    assert.ok(
      old.some(row => row.owner === 'tools/bitmap-binding-ticket-policy.json' && row.binding === 'selectedProductPins')
    );
    assert.ok(old.some(row => row.owner === bbt && row.binding === 'm12IncrementalOwnershipSuccessor'));
    assert.equal(old.filter(row => row.binding === 'imageResidencySuccessors' && row.branch === 'base').length, 2);
    assert.equal(old.filter(row => row.binding === 'imageResidencySuccessors' && row.branch === 'current').length, 2);
    assert.equal(m.verifyMaintenanceProposal(f.root, p), true);
    f.put(file, 'export const changed = 1;\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/);
    assert.ok(
      m
        .prepareBaselineReview(f.root)
        .declarations.filter(row => row.binding === 'm12IncrementalRenderingGraphSuccessor')
        .every(row => row.rows[0].identity === 'different')
    );
  } finally {
    f.close();
  }
});

// UNIT: exact M1.3 registration is raw review data, not source/strict acceptance.
test('M1.3 maintenance retains complete graph groups and both interface pair arms', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'packages/contracts/src/SharedGeometry2D.ts';
    f.put(file, 'export {};\n');
    const current = f.pin(file),
      base = { ...current, bytes: 0, sha256: '0'.repeat(64) };
    const owners = [
      'tools/spritesheet-boundary.mjs',
      'tools/browser-png-boundary.mjs',
      'tools/atlas-import-boundary.mjs'
    ];
    for (const owner of owners)
      f.put(
        owner,
        fs
          .readFileSync(path.join(f.root, owner), 'utf8')
          .replace(
            'const m13SharedRenderingGraphSuccessor = [];',
            'const m13SharedRenderingGraphSuccessor = ' + JSON.stringify([current]) + ';'
          )
      );
    const interfaces = [
      ['tools/sequence-playback-boundary.mjs', 'm13SequenceInterfaceSuccessor'],
      ['tools/bitmap-resource-slot-boundary.mjs', 'm13InterfaceStableSuccessor'],
      ['tools/bitmap-binding-ticket-boundary.mjs', 'm13InterfaceProjectedSuccessor']
    ];
    for (const [owner, binding] of interfaces)
      f.put(
        owner,
        fs
          .readFileSync(path.join(f.root, owner), 'utf8')
          .replace(
            'const ' + binding + ' = [];',
            'const ' + binding + ' = ' + JSON.stringify([{ base, current }]) + ';'
          )
      );
    const p = m.prepareBaselineReview(f.root);
    assert.equal(p.declarations.length, 36);
    assert.equal(p.successorPairs.length, 7);
    for (const [i, coverage] of p.graphCoverage.entries()) {
      assert.deepEqual(coverage.sharedSuccessor, { owner: owners[i], binding: 'm13SharedRenderingGraphSuccessor' });
      assert.equal(
        coverage.unlisted.some(row => row.path === file),
        false
      );
    }
    const refs = p.references.find(row => row.path === file).references;
    assert.equal(refs.length, 9);
    assert.equal(refs.filter(row => row.branch === 'base').length, 3);
    assert.equal(refs.filter(row => row.branch === 'current').length, 3);
    assert.equal(
      p.successorPairs
        .filter(group => interfaces.some(([owner, binding]) => owner === group.owner && binding === group.binding))
        .every(group => group.rows[0].identity === 'current'),
      true
    );
    const [owner, binding] = interfaces[0],
      raw = fs.readFileSync(path.join(f.root, owner), 'utf8');
    f.put(owner, raw + 'const ' + binding + ' = [];\n');
    assert.throws(() => m.prepareBaselineReview(f.root), /ambiguous/);
    f.put(owner, raw);
    f.put(
      owner,
      raw.replace(
        JSON.stringify([{ base, current }]),
        JSON.stringify([{ base, current: { ...current, path: 'packages/contracts/src/Other.ts' } }])
      )
    );
    assert.throws(() => m.prepareBaselineReview(f.root), /path differs/);
    f.put(owner, raw);
    assert.equal(m.verifyMaintenanceProposal(f.root, p), true);
  } finally {
    f.close();
  }
});

test('shared compiler maintenance admits only its seven fixed raw input roles', async () => {
  const m = await compilerTool(),
    f = compilerFixture();
  try {
    const file = 'tests/types/shared-render-diagnostic-expectations.json',
      raw = fs.readFileSync(path.join(f.root, file), 'utf8'),
      value = JSON.parse(raw),
      p = m.prepareCompilerReview(f.root);
    const rows = p.declarations.find(row => row.owner === file && row.selector === 'inputPins').rows;
    assert.equal(rows.length, 7);
    assert(rows.every(row => row.identity === 'same'));
    f.put(
      file,
      JSON.stringify({
        ...value,
        inputPins: [...value.inputPins.slice(0, 6), { ...value.inputPins[6], path: 'tests/types/foreign.json' }]
      })
    );
    assert.throws(() => m.prepareCompilerReview(f.root), /shared strict inputs/);
    f.put(file, JSON.stringify({ ...value, tupleFormat: ['file', 'line', 'code'] }));
    assert.throws(() => m.prepareCompilerReview(f.root), /shared strict schema/);
    f.put(file, raw);
    assert.equal(m.verifyCompilerProposal(f.root, p).status, 'current-inputs');
  } finally {
    f.close();
  }
});

// UNIT: this finite inventory extension retains every older declaration and pair arm.
test('M1.4 maintenance records only the three named WebGL2 graph successors', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'packages/engine/web/webgl2.ts';
    f.put(file, 'export {};\n');
    const current = f.pin(file);
    const owners = [
        'tools/spritesheet-boundary.mjs',
        'tools/browser-png-boundary.mjs',
        'tools/atlas-import-boundary.mjs'
      ],
      binding = 'm14WebGL2GraphSuccessor';
    const historical = m.prepareBaselineReview(f.root);
    for (const owner of owners)
      f.put(
        owner,
        fs.readFileSync(path.join(f.root, owner), 'utf8') +
          'const ' +
          binding +
          ' = ' +
          JSON.stringify([current]) +
          ';\n'
      );
    const complete = m.prepareBaselineReview(f.root);
    assert.deepEqual(
      complete.declarations.filter(row => row.binding !== binding),
      historical.declarations
    );
    assert.deepEqual(complete.successorPairs, historical.successorPairs);
    assert.deepEqual(
      complete.declarations.filter(row => row.binding === binding).map(row => row.owner),
      owners
    );
    for (const [index, coverage] of complete.graphCoverage.entries()) {
      assert.deepEqual(coverage.webglSuccessor, { owner: owners[index], binding });
      assert.equal(
        coverage.unlisted.some(row => row.path === file),
        false
      );
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, complete), true);
    for (const owner of owners) {
      const raw = fs.readFileSync(path.join(f.root, owner));
      try {
        const baseline = m.prepareBaselineReview(f.root);
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
        f.put(owner, Buffer.concat([raw, Buffer.from('const ' + binding + ' = [];\n')]));
        assert.throws(() => m.prepareBaselineReview(f.root), /ambiguous/);
        assert.throws(() => m.verifyMaintenanceProposal(f.root, baseline));
      } finally {
        f.put(owner, raw);
        assert.equal(m.verifyMaintenanceProposal(f.root, complete), true);
      }
    }
  } finally {
    f.close();
  }
});

// UNIT: bootstrap succession never changes the retained inline compiler observations.
test('M1.4 strict bootstrap preserves complete sequence history and refuses unrelated bytes', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture();
  try {
    const file = 'tools/sequence-playback-types.mjs',
      raw = fs.readFileSync(path.join(f.root, file)),
      text = raw.toString();
    const before =
        "m13HelperPin.bytes !== 10785 || m13HelperPin.sha256 !== '61a14bb8be2162d861a26b822ded713c552b4032d755e291578b225cd13ef337'",
      after =
        "m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634'";
    assert.equal(text.split(after).length, 2);
    const prior = Buffer.from(text.replace(after, before));
    assert.equal(prior.length, 19255);
    assert.equal(
      createHash('sha256').update(prior).digest('hex'),
      '42a0bad83c5f68f74d2b1e26bd9c5183be9e94e1cb4c36a01a4b60c373e4a6ea'
    );
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      current = collect();
    assert.equal(
      current.inlinePolicies.sourceRevisions.find(row => row.current.path === file).selection,
      'm14-strict-current'
    );
    f.put(file, prior);
    const historical = collect();
    assert.equal(historical.inlinePolicies.sourceRevisions.find(row => row.current.path === file).selection, 'current');
    assert.deepEqual(historical.inlinePolicies.literals, current.inlinePolicies.literals);
    assert.deepEqual(historical.inlinePolicies.conditions, current.inlinePolicies.conditions);
    assert.throws(() => m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }), /changed/);
    f.put(file, raw);
    const baseline = collect();
    assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
    f.put(file, Buffer.concat([raw, Buffer.from('// unreviewed strict source\n')]));
    assert.throws(collect, /Unreviewed inline policy source/);
    assert.throws(() => m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }));
    f.put(file, raw);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

// UNIT: genuine current gate bytes and both exact historical inverses; no compiler execution.
test('M1.5 strict bootstrap admits nine exact revisions and preserves both predecessor stages', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m15: true });
  try {
    const expected = [
      {
        'path': 'tools/bitmap-resource-slot-types.mjs',
        'predecessor': { 'bytes': 11184, 'sha256': '2f1c767bc1701c5bcf087b7eb48857006334ffc36c205a82cf81d9fa2b857315' },
        'current': { 'bytes': 11184, 'sha256': 'c97f8b75d9103477c7f5e5932f0fb75e588d42eec31a73e6f66327fae9275eaf' }
      },
      {
        'path': 'tools/bitmap-binding-ticket-types.mjs',
        'predecessor': { 'bytes': 13887, 'sha256': '1e80a8a04ae0b35dd1084762172aed96e966fe3a3e9e47a86da383cd853bfb32' },
        'current': { 'bytes': 13887, 'sha256': 'b36874eaab10b6c275424584d062b599f8e14a215336a7722e9a3783190a8782' }
      },
      {
        'path': 'tools/linear-layout-types.mjs',
        'predecessor': { 'bytes': 11073, 'sha256': '1d9a07307a4725eb8234cbb062f23474c2c4ce28ef0a43706a041cecbe246085' },
        'current': { 'bytes': 11073, 'sha256': '89cf1e6e5fd099871ff0d7388df1b0b6e6accd36c78aef9aa33e1e5426fa71c3' }
      },
      {
        'path': 'tools/bitmap-button-types.mjs',
        'predecessor': { 'bytes': 17175, 'sha256': '74c55fbc100d49ed03278b2d8eb85d4833379a8219c932fce5325ec9cd448fe1' },
        'current': { 'bytes': 17175, 'sha256': '919546bc07a51a78d499ae070618d7000e2d87774ad4af3c8a540b395924bbb8' }
      },
      {
        'path': 'tools/display-anchor-offsets-types.mjs',
        'predecessor': { 'bytes': 16526, 'sha256': '04fcc94308c627433412348d9088fb98d032808d9029ef5e8fc154cf28868ae4' },
        'current': { 'bytes': 16526, 'sha256': '9d37f5989501d97094b25a0d9130f98c906cdc60bea4b1f9a042279b7279f90c' }
      },
      {
        'path': 'tools/display-container-add-child-at-types.mjs',
        'predecessor': { 'bytes': 18718, 'sha256': '64d67885a2c91e19beda887da12a44d09938d71afceff3c001a6cf51c4523563' },
        'current': { 'bytes': 18718, 'sha256': 'f25ded3a21e455bfc45d5181025d7fd6dcd43cd666a08bc246855fce4452ee91' }
      },
      {
        'path': 'tools/display-container-child-index-types.mjs',
        'predecessor': { 'bytes': 17112, 'sha256': 'eea91a2a74aaf1a7d210a923106afd305e0028bd29a24482f9669a368d2c689f' },
        'current': { 'bytes': 17112, 'sha256': 'fb2d518381df6f41795f198c5b353b03fc194361151bbdd5963fde78e7f38929' }
      },
      {
        'path': 'tools/display-container-remove-children-types.mjs',
        'predecessor': { 'bytes': 15268, 'sha256': 'df1dd4a369ac4d19f892aed8d684e5097f86935f470e6f02deed48c5c3f20159' },
        'current': { 'bytes': 15268, 'sha256': 'f03e8cfc77240d8ea40021333bf13e56cc15e0e0f469442fd6a72dee7e5bd31b' }
      },
      {
        'path': 'tools/sequence-playback-types.mjs',
        'predecessor': { 'bytes': 19255, 'sha256': '904cc980cc1ae6bc8542ea37cf5f876020c8ba5576fd6f3066536e35de33c6b6' },
        'current': { 'bytes': 19255, 'sha256': '6dffcc40c3654db9c9faa2f9983eafea7b6e91960aab20f279b0f5caba9a66be' }
      }
    ];
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      current = collect();
    for (const row of expected) {
      const file = row.path,
        raw = fs.readFileSync(path.join(f.root, file)),
        text = raw.toString();
      assert.deepEqual({ bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') }, row.current);
      assert.equal(text.split(m15BootstrapAfter).length, 2);
      const revision = current.inlinePolicies.sourceRevisions.find(value => value.current.path === file);
      assert.equal(revision.selection, 'm15-strict-current');
      assert.equal(revision.admission, 'not-evaluated');
      assert.deepEqual(revision.m14StrictSuccessor, { path: file, ...row.predecessor });
      assert.deepEqual(revision.m15StrictSuccessor, { path: file, ...row.current });
      const predecessor = Buffer.from(text.replace(m15BootstrapAfter, m15BootstrapBefore));
      assert.deepEqual(
        { bytes: predecessor.length, sha256: createHash('sha256').update(predecessor).digest('hex') },
        row.predecessor
      );
      f.put(file, predecessor);
      const historical = collect();
      assert.equal(
        historical.inlinePolicies.sourceRevisions.find(value => value.current.path === file).selection,
        'm14-strict-current'
      );
      assert.deepEqual(historical.inlinePolicies.literals, current.inlinePolicies.literals);
      assert.deepEqual(historical.inlinePolicies.conditions, current.inlinePolicies.conditions);
      assert.throws(() => m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }), /changed/);
      f.put(file, raw);
      assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
      for (const altered of [
        Buffer.from(text.replace(m15BootstrapAfter, m15BootstrapAfter.replace('12701', '12702'))),
        Buffer.concat([raw, Buffer.from('// unreviewed M1.5 drift\n')])
      ]) {
        f.put(file, raw);
        const baseline = collect();
        assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
        f.put(file, altered);
        assert.throws(collect, /Unreviewed inline policy source/);
        assert.throws(() => m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }));
        f.put(file, raw);
        assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
      }
    }
  } finally {
    f.close();
  }
});

// UNIT: fixed M1.5 roles reuse raw observations; no adapter or SDK is executed.
test('M1.5 maintenance keeps three graph groups and seventeen pair roles beside all history', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const owners = [
      'tools/spritesheet-boundary.mjs',
      'tools/browser-png-boundary.mjs',
      'tools/atlas-import-boundary.mjs'
    ];
    const roles = [
        ['tools/spritesheet-boundary.mjs', 'm15ResourcePackageSuccessors', 'raw-pair-observation-only'],
        ['tools/spritesheet-boundary.mjs', 'm15ResourceAtlasPackageSuccessor', 'raw-pair-observation-only'],
        ['tools/browser-png-boundary.mjs', 'm15ResourcePackageSuccessors', 'raw-pair-observation-only'],
        ['tools/browser-png-boundary.mjs', 'm15ResourceAtlasPackageSuccessor', 'raw-pair-observation-only'],
        ['tools/atlas-import-boundary.mjs', 'm15ResourcePackageSuccessors', 'raw-pair-observation-only'],
        ['tools/atlas-import-boundary.mjs', 'm15ResourceAtlasPackageSuccessor', 'raw-pair-observation-only'],
        ['tools/sequence-playback-boundary.mjs', 'm15ResourcePackageSuccessors', 'raw-pair-observation-only'],
        ['tools/sequence-playback-boundary.mjs', 'm15ResourceAtlasPackageSuccessor', 'raw-pair-observation-only'],
        ['tools/bitmap-resource-slot-boundary.mjs', 'm15ResourcePackageSuccessors', 'raw-pair-observation-only'],
        ['tools/bitmap-resource-slot-boundary.mjs', 'm15ResourceAtlasPackageSuccessor', 'raw-pair-observation-only'],
        ['tools/bitmap-binding-ticket-boundary.mjs', 'm15ResourcePackageSuccessors', 'raw-pair-observation-only'],
        ['tools/bitmap-binding-ticket-boundary.mjs', 'm15ResourceAtlasPackageSuccessor', 'raw-pair-observation-only'],
        ['tools/sequence-playback-boundary.mjs', 'm15SequenceInterfaceSuccessor', 'raw-pair-observation-only'],
        ['tools/bitmap-resource-slot-boundary.mjs', 'm15InterfaceRawSuccessor', 'raw-pair-observation-only'],
        [
          'tools/bitmap-resource-slot-boundary.mjs',
          'm15InterfaceProjectedSuccessor',
          'transformed-pair-raw-observation-only'
        ],
        ['tools/bitmap-binding-ticket-boundary.mjs', 'm15InterfaceRawSuccessor', 'raw-pair-observation-only'],
        [
          'tools/bitmap-binding-ticket-boundary.mjs',
          'm15InterfaceProjectedSuccessor',
          'transformed-pair-raw-observation-only'
        ]
      ],
      graphBinding = 'm15ResourceRecoveryGraphSuccessor';
    const file = 'packages/contracts/src/ResourceManifest.ts';
    f.put(file, 'export {};\n');
    const current = f.pin(file),
      base = { ...current, bytes: 0, sha256: '0'.repeat(64) },
      pair = { base, current };
    const historical = m.prepareBaselineReview(f.root);
    for (const owner of owners)
      f.put(
        owner,
        fs.readFileSync(path.join(f.root, owner), 'utf8') +
          'const ' +
          graphBinding +
          ' = ' +
          JSON.stringify([current]) +
          ';\n'
      );
    for (const [owner, binding] of roles)
      f.put(
        owner,
        fs.readFileSync(path.join(f.root, owner), 'utf8') + 'const ' + binding + ' = ' + JSON.stringify([pair]) + ';\n'
      );
    const collect = () => m.prepareBaselineReview(f.root),
      complete = collect();
    assert.equal(complete.status, 'review-required');
    assert.equal(complete.declarations.length, 39);
    assert.equal(complete.successorPairs.length, 24);
    assert.deepEqual(
      complete.declarations.filter(row => row.binding !== graphBinding),
      historical.declarations
    );
    assert.deepEqual(
      complete.successorPairs.filter(
        row => !roles.some(([owner, binding]) => row.owner === owner && row.binding === binding)
      ),
      historical.successorPairs
    );
    assert.deepEqual(
      complete.declarations.filter(row => row.binding === graphBinding).map(row => row.owner),
      owners
    );
    for (const [index, coverage] of complete.graphCoverage.entries()) {
      assert.deepEqual(coverage.resourceRecoverySuccessor, { owner: owners[index], binding: graphBinding });
      assert.equal(
        coverage.unlisted.some(row => row.path === file),
        false
      );
    }
    for (const [owner, binding, comparison] of roles) {
      const group = complete.successorPairs.find(row => row.owner === owner && row.binding === binding);
      assert.equal(group.comparison, comparison);
      assert.equal(group.rows.length, 1);
      assert.equal(group.rows[0].identity, 'current');
      assert.deepEqual(group.rows[0].base, base);
      assert.deepEqual(group.rows[0].successor, current);
    }
    const refs = complete.references.find(row => row.path === file).references;
    assert.equal(refs.length, 37);
    assert.equal(refs.filter(row => row.branch === 'base').length, 17);
    assert.equal(refs.filter(row => row.branch === 'current').length, 17);
    assert.equal(m.verifyMaintenanceProposal(f.root, complete), true);
    for (const [owner, binding] of roles) {
      const raw = fs.readFileSync(path.join(f.root, owner), 'utf8'),
        line = 'const ' + binding + ' = ' + JSON.stringify([pair]) + ';';
      assert.equal(raw.split(line).length, 2);
      const variants = [
        raw + '\nconst ' + binding + ' = [];\n',
        raw.replace(line, 'const ' + binding + ' = ' + JSON.stringify([pair, pair]) + ';'),
        raw.replace(
          line,
          'const ' +
            binding +
            ' = ' +
            JSON.stringify([{ base, current: { ...current, path: 'packages/contracts/src/Other.ts' } }]) +
            ';'
        ),
        raw.replace(line, 'const ' + binding + ' = ' + JSON.stringify([{ ...pair, extra: true }]) + ';'),
        raw.replace(
          line,
          'const ' + binding + ' = ' + JSON.stringify([{ base, current: { ...current, sha256: 'invalid' } }]) + ';'
        )
      ];
      for (const altered of variants) {
        f.put(owner, raw);
        const baseline = collect();
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
        f.put(owner, altered);
        assert.throws(collect);
        assert.throws(() => m.verifyMaintenanceProposal(f.root, baseline));
        f.put(owner, raw);
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
      }
    }
    for (const owner of owners) {
      const raw = fs.readFileSync(path.join(f.root, owner), 'utf8'),
        line = 'const ' + graphBinding + ' = ' + JSON.stringify([current]) + ';';
      for (const altered of [
        raw + '\nconst ' + graphBinding + ' = [];\n',
        raw.replace(line, 'const ' + graphBinding + ' = ' + JSON.stringify([current, current]) + ';')
      ]) {
        const baseline = collect();
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
        f.put(owner, altered);
        assert.throws(collect);
        assert.throws(() => m.verifyMaintenanceProposal(f.root, baseline));
        f.put(owner, raw);
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
      }
    }
    const extra = 'packages/contracts/src/unregistered-m15.ts';
    f.put(extra, 'export {};\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, complete), /changed/);
    assert(collect().graphCoverage.every(row => row.unlisted.some(pin => pin.path === extra)));
    fs.unlinkSync(path.join(f.root, extra));
    assert.equal(m.verifyMaintenanceProposal(f.root, complete), true);
  } finally {
    f.close();
  }
});

// UNIT: genuine adapter bytes authenticate exceptional JSON extraction, not gate acceptance.
test('M1.5 maintenance reads six exact source owners and refuses unreviewed post-preamble extraction', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const expected = [
      {
        'path': 'tools/spritesheet-boundary.mjs',
        'bytes': 185549,
        'sha256': 'bfb4fb02f29cd66442a6f5124c1e209d87b305550ec5a48978c104f09163fb3f'
      },
      {
        'path': 'tools/browser-png-boundary.mjs',
        'bytes': 191467,
        'sha256': 'ce40f1363774bec52a053a5a0b2001aab2f3e4701b49e822e1a61097c7a4299d'
      },
      {
        'path': 'tools/atlas-import-boundary.mjs',
        'bytes': 90249,
        'sha256': '4dee83aecfeb345647356ee3a8f5aef36e6b984333dcd8699ff40bfd7de6d581'
      },
      {
        'path': 'tools/sequence-playback-boundary.mjs',
        'bytes': 43012,
        'sha256': '2d95757ddd9c3a6d1762fd44ba02461ef92504690f2e1e4c342a5f6d71f10a62'
      },
      {
        'path': 'tools/bitmap-resource-slot-boundary.mjs',
        'bytes': 38244,
        'sha256': '1a4046d1bd5003714ca030ade053f412c98ca1f787d35357b823a12005e791a3'
      },
      {
        'path': 'tools/bitmap-binding-ticket-boundary.mjs',
        'bytes': 44823,
        'sha256': '690d56e1eb726d55990d6a8cd37b2215b1f3bb44430ca5c54abc67cdcffe8026'
      }
    ];
    for (const pin of expected) {
      const raw = m12BoundaryHistory(fs.readFileSync(new URL('../../' + pin.path, import.meta.url)), pin.path);
      assert.deepEqual(
        { path: pin.path, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') },
        pin
      );
      f.put(pin.path, raw);
    }
    for (const file of [
      'tools/bitmap-resource-slot-policy.json',
      'tools/bitmap-binding-ticket-policy.json',
      'tests/types/atlas-import-diagnostic-expectations.json',
      'packages/engine/dist/Engine.d.ts',
      'packages/contracts/package.json',
      'packages/engine/package.json',
      'packages/project/package.json'
    ])
      f.put(file, m33BoundaryFixtureInput(file));
    const collect = () => m.prepareBaselineReview(f.root),
      baseline = collect();
    assert.equal(baseline.status, 'review-required');
    const graphs = baseline.declarations.filter(row => row.binding === 'm15ResourceRecoveryGraphSuccessor');
    assert.equal(graphs.length, 3);
    assert(graphs.every(row => row.rows.length === 98));
    const newPairs = baseline.successorPairs.filter(row => row.binding.startsWith('m15'));
    assert.equal(newPairs.length, 17);
    assert.equal(
      newPairs.reduce((sum, row) => sum + row.rows.length, 0),
      52
    );
    assert(
      newPairs
        .filter(row => row.binding.startsWith('m15Resource'))
        .every(row => row.rows.every(value => value.identity === 'current'))
    );
    for (const row of newPairs.filter(row => row.binding === 'm15InterfaceProjectedSuccessor')) {
      assert.equal(row.comparison, 'transformed-pair-raw-observation-only');
      assert.equal(row.rows[0].identity, 'neither');
      assert.deepEqual(row.rows[0].current, m15DeclarationPin);
    }
    const unknownDeclaration = Buffer.from(fs.readFileSync(path.join(f.root, m15DeclarationPin.path)));
    unknownDeclaration[0] ^= 1;
    assert.throws(() => m15DeclarationFixtureInput(unknownDeclaration), /Exact on-demand Engine declaration differs/);
    assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
    for (const pin of expected) {
      const raw = fs.readFileSync(path.join(f.root, pin.path), 'utf8');
      // Ordinary preamble parsing remains allowed; any byte drift still invalidates the saved proposal.
      f.put(pin.path, raw + '\n// unreviewed source drift\n');
      assert.throws(() => m.verifyMaintenanceProposal(f.root, baseline));
      f.put(pin.path, raw);
      assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
      const binding = pin.path.includes('sequence-playback')
        ? 'm15SequenceInterfaceSuccessor'
        : pin.path.includes('bitmap-')
          ? 'm15InterfaceRawSuccessor'
          : 'm15ResourceRecoveryGraphSuccessor';
      const anchor = 'const ' + binding + ' = ';
      assert.equal(raw.split(anchor).length, 2);
      f.put(pin.path, raw.replace(anchor, 'const unreviewedPrefix = /m15/;\n' + anchor));
      assert.throws(collect, /Unsupported declaration preamble/);
      assert.throws(() => m.verifyMaintenanceProposal(f.root, baseline));
      f.put(pin.path, raw);
      assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
    }
  } finally {
    f.close();
  }
});

// UNIT: genuine complete source revisions; no strict gate or compiler is executed.
test('M1.5 inline maintenance preserves delegate and scene revisions with exact historical inverses', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m15: true });
  try {
    const file = 'tools/check-types.mjs',
      raw = fs.readFileSync(path.join(f.root, file)),
      history = m15InlineGateHistory(raw);
    assert(history.scene && history.delegate);
    assert.deepEqual(history.scene, raw);
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true });
    const stages = [
      ['m13', 'current'],
      ['m14', 'm14-current'],
      ['delegate', 'm15-delegate-current'],
      ['scene', 'm15-scene-current']
    ];
    let original = null;
    for (const [stage, selection] of stages) {
      f.put(file, history[stage]);
      const p = collect(),
        revision = p.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
      assert.equal(revision.selection, selection);
      assert.equal(revision.admission, 'not-evaluated');
      assert.deepEqual(revision.successor, { path: file, ...history.pins.m13 });
      assert.deepEqual(revision.m14Successor, { path: file, ...history.pins.m14 });
      assert.deepEqual(revision.m15DelegateSuccessor, { path: file, ...history.pins.delegate });
      assert.deepEqual(revision.m15SceneSuccessor, { path: file, ...history.pins.scene });
      const literals = p.inlinePolicies.literals
          .filter(row => row.owner === file)
          .map(({ binding, bytes, sha256 }) => ({ binding, bytes, sha256 })),
        declarations = p.declarations.filter(row => row.owner === file);
      if (original === null) original = { literals, declarations };
      else assert.deepEqual({ literals, declarations }, original);
      for (const row of p.inlinePolicies.literals.filter(row => row.owner === file)) {
        const value = history[stage].subarray(row.startByte, row.endByte);
        assert.equal(value.length, row.bytes);
        assert.equal(createHash('sha256').update(value).digest('hex'), row.sha256);
      }
      assert.equal(m.verifyCompilerProposal(f.root, p, { inlinePolicies: true }).status, 'current-inputs');
    }
    f.put(file, raw);
    const baseline = collect(),
      text = raw.toString();
    const variants = [
      Buffer.concat([raw, Buffer.from("await import('./resource-recovery-types.mjs');\n")]),
      Buffer.from(
        text.replace("await import('./resource-recovery-types.mjs');", "await import('./resource-recovery-typez.mjs');")
      ),
      Buffer.from(text.replace('"name":"m15-browser-dom-01"', '"name":"m15-browser-dom-XX"')),
      Buffer.from(text.replace('sharedFrameUpload.d.ts', 'sharedFrameUploaz.d.ts')),
      Buffer.concat([raw, Buffer.from('// unreviewed inline scene drift\n')])
    ];
    for (const altered of variants) {
      assert.notDeepEqual(altered, raw);
      f.put(file, raw);
      const before = collect(),
        plain = m.prepareCompilerReview(f.root);
      assert.equal(m.verifyCompilerProposal(f.root, before, { inlinePolicies: true }).status, 'current-inputs');
      try {
        f.put(file, altered);
        assert.throws(collect, /Unreviewed inline policy source: tools\/check-types\.mjs/);
        assert.throws(() => m.verifyCompilerProposal(f.root, before, { inlinePolicies: true }));
        assert.throws(() => m.verifyCompilerProposal(f.root, plain), /changed/);
      } finally {
        f.put(file, raw);
        assert.deepEqual(fs.readFileSync(path.join(f.root, file)), raw);
        assert.equal(m.verifyCompilerProposal(f.root, before, { inlinePolicies: true }).status, 'current-inputs');
        assert.deepEqual(collect(), before);
      }
    }
    assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

// UNIT: current metadata extraction and original history are distinct; no SDK or gate executes.
test('M1.2 hotpath metadata keeps three exact current graph owners beside immutable M1.5 sources', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const owners = [
      {
        'path': 'tools/spritesheet-boundary.mjs',
        'bytes': 192441,
        'sha256': 'ecab5b53ef95905ccc0d497d22ae21f0fdcdb722af9a131fcdc8f33a28322345'
      },
      {
        'path': 'tools/browser-png-boundary.mjs',
        'bytes': 198282,
        'sha256': '76ff8a040936e5eace5eff3c94f3da733d512328f0fde507b958c8d32012413e'
      },
      {
        'path': 'tools/atlas-import-boundary.mjs',
        'bytes': 97146,
        'sha256': '67b80c84cbfd35c511e739c6afb2d64c80ebe9abf03ecf54cdc68b3f3dc3c5f5'
      }
    ];
    for (const row of owners) {
      const raw = m33BoundaryHistory(fs.readFileSync(new URL('../../' + row.path, import.meta.url)), row.path);
      assert.deepEqual(
        { path: row.path, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') },
        row
      );
      f.put(row.path, raw);
    }
    for (const file of [
      'tests/types/atlas-import-diagnostic-expectations.json',
      'packages/engine/dist/Engine.d.ts',
      'packages/contracts/package.json',
      'packages/engine/package.json',
      'packages/project/package.json'
    ])
      f.put(file, m33BoundaryFixtureInput(file));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect(),
      groups = current.declarations.filter(row => row.binding === 'm12PreparationHotPathGraphSuccessor');
    assert.equal(current.status, 'review-required');
    assert.equal(groups.length, 3);
    assert(groups.every(row => row.rows.length === 22));
    for (const [index, coverage] of current.graphCoverage.entries())
      assert.deepEqual(coverage.preparationHotPathSuccessor, {
        owner: owners[index].path,
        binding: 'm12PreparationHotPathGraphSuccessor'
      });
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    for (const row of owners) {
      const raw = fs.readFileSync(path.join(f.root, row.path));
      f.put(row.path, Buffer.concat([raw, Buffer.from('// unreviewed hotpath source\n')]));
      assert.throws(collect, /Unsupported declaration preamble/);
      assert.throws(() => m.verifyMaintenanceProposal(f.root, current));
      f.put(row.path, raw);
      assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    }
    for (const row of owners)
      f.put(row.path, m12BoundaryHistory(fs.readFileSync(path.join(f.root, row.path)), row.path));
    const historical = collect();
    assert.equal(
      historical.declarations.some(row => row.binding === 'm12PreparationHotPathGraphSuccessor'),
      false
    );
    assert.deepEqual(
      historical.declarations,
      current.declarations.filter(row => row.binding !== 'm12PreparationHotPathGraphSuccessor')
    );
    assert.deepEqual(historical.successorPairs, current.successorPairs);
    assert.equal(m.verifyMaintenanceProposal(f.root, historical), true);
  } finally {
    f.close();
  }
});

// Execute only the exact tool-local metadata selector, with real retained JSON declarations.
test('M1.2 hotpath PNG selector admits a complete group and preserves assigned missing or drift paths', () => {
  const text = m33BoundaryHistory(
    fs.readFileSync(new URL('../../tools/browser-png-boundary.mjs', import.meta.url)),
    'tools/browser-png-boundary.mjs'
  ).toString();
  const literal = name => {
    const anchor = 'const ' + name + ' = ',
      lines = text.split('\n').filter(line => line.startsWith(anchor));
    assert.equal(lines.length, 1);
    return JSON.parse(lines[0].slice(anchor.length, -1));
  };
  let base = [...literal('acceptedSnapshot').graph, ...literal('atlasGraphSuccessor')];
  const pairs = literal('imageResidencySuccessors');
  base = base.map(row => {
    const pair = pairs.find(pair => pair.path === row.path);
    return pair && row.bytes === pair.base.bytes && row.sha256 === pair.base.sha256
      ? { path: row.path, ...pair.current }
      : row;
  });
  for (const prefix of [
    'm11WarmSubmission',
    'm12IncrementalRendering',
    'm13SharedRendering',
    'm14WebGL2',
    'm15ResourceRecovery'
  ]) {
    const rows = new Map(literal(prefix + 'GraphSuccessor').map(row => [row.path, row]));
    base = [
      ...base.map(row => rows.get(row.path) ?? row),
      ...literal(prefix + 'AdditionPaths').map(file => rows.get(file))
    ];
  }
  const digest = rows =>
    createHash('sha256')
      .update(
        JSON.stringify(
          [...rows]
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
            .map(row => [row.path, row.bytes, row.sha256])
        )
      )
      .digest('hex');
  assert.equal(base.length, 669);
  assert.equal(digest(base), '06427ebc44a664071cde2396f7c474fe074107aaa07dbe7d69192634a37accc5');
  const start = '// M12-PREPARATION-HOTPATH-BEGIN\n',
    end = '// M12-PREPARATION-HOTPATH-END\n';
  assert.equal(text.split(start).length, 2);
  assert.equal(text.split(end).length, 2);
  const block = text.slice(text.indexOf(start) + start.length, text.indexOf(end)),
    context = { createHash, issue: (code, path, message) => ({ code, path, message }) };
  vm.runInNewContext(block + '\nglobalThis.run=m12PreparationHotPathGraph;', context, {
    filename: 'browser-png-hotpath-selector.mjs'
  });
  const rows = literal('m12PreparationHotPathGraphSuccessor'),
    selected = new Map(rows.map(row => [row.path, row])),
    complete = base.map(row => selected.get(row.path) ?? row),
    clone = value => JSON.parse(JSON.stringify(value));
  assert.equal(context.run(base, base), undefined);
  assert.deepEqual(clone(context.run(base, complete).graph), complete);
  const target = rows[0].path,
    old = base.find(row => row.path === target);
  assert.equal(
    context.run(
      base,
      complete.filter(row => row.path !== target)
    ).failure.code,
    'BIP_BOUNDARY_SOURCE_INVENTORY'
  );
  assert.equal(
    context.run(
      base,
      complete.filter(row => row.path !== target)
    ).failure.path,
    target
  );
  for (const altered of [
    complete.map(row => (row.path === target ? old : row)),
    complete.map(row => (row.path === target ? { ...row, sha256: '0'.repeat(64) } : row))
  ]) {
    const result = context.run(base, altered);
    assert.equal(result.failure.code, 'BIP_BOUNDARY_FINGERPRINT');
    assert.equal(result.failure.path, target);
  }
  const changedBase = base.map((row, index) => (index === 0 ? { ...row, sha256: '0'.repeat(64) } : row));
  assert.equal(context.run(changedBase, complete).failure.path, 'tools/browser-png-boundary.mjs');
  assert.deepEqual(clone(context.run(base, complete).graph), complete);
});

test('M1.2 NineSlice source mapping is exact to owner history and current bytes', () => {
  const f = fixture();
  try {
    const text = fs.readFileSync(new URL('../../tools/lib/m13-strict-successor.mjs', import.meta.url), 'utf8'),
      start = '// M12-NINE-SLICE-SOURCE-BEGIN\n',
      end = '// M12-NINE-SLICE-SOURCE-END\n';
    assert.equal(text.split(start).length, 2);
    assert.equal(text.split(end).length, 2);
    const context = {
      root: f.root,
      M15_DATA: {},
      DATA: {},
      equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      fingerprintFile: (root, file) => {
        assert.equal(root, f.root);
        const raw = fs.readFileSync(path.join(root, file));
        return { path: file, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
      }
    };
    vm.runInNewContext(
      text.slice(text.indexOf(start) + start.length, text.indexOf(end)) +
        '\nglobalThis.pair=m12NineSliceHostSource;globalThis.run=(version,id,row)=>m12NineSliceHostPin(root,version===15?M15_DATA:DATA,id,row);',
      context,
      { filename: 'strict-source-pair.mjs' }
    );
    const pair = JSON.parse(JSON.stringify(context.pair)),
      file = pair.base.path,
      raw = m24SpinePrevious(fs.readFileSync(new URL('../../' + file, import.meta.url)), file);
    f.put(file, raw);
    assert.deepEqual(context.fingerprintFile(f.root, file), pair.current);
    assert.deepEqual(JSON.parse(JSON.stringify(context.run(15, 'nine-slice-bitmap', pair.base))), pair.current);
    assert.deepEqual(context.run(13, 'nine-slice-bitmap', pair.base), pair.base);
    assert.deepEqual(context.run(15, 'atlas-frame', pair.base), pair.base);
    const unknown = { ...pair.base, sha256: '0'.repeat(64) };
    assert.deepEqual(context.run(15, 'nine-slice-bitmap', unknown), unknown);
    f.put(file, Buffer.concat([raw, Buffer.from('// source drift\n')]));
    assert.deepEqual(context.run(15, 'nine-slice-bitmap', pair.base), pair.base);
    f.put(file, raw);
    assert.deepEqual(JSON.parse(JSON.stringify(context.run(15, 'nine-slice-bitmap', pair.base))), pair.current);
  } finally {
    f.close();
  }
});

test('M1.2 capture source mapping keeps twelve original strict owners and exact raw identity', () => {
  const f = fixture();
  try {
    const text = fs.readFileSync(new URL('../../tools/lib/m13-strict-successor.mjs', import.meta.url), 'utf8'),
      start = '// M12-CAPTURE-SOURCE-BEGIN\n',
      end = '// M12-CAPTURE-SOURCE-END\n';
    assert.equal(text.split(start).length, 2);
    assert.equal(text.split(end).length, 2);
    const data = JSON.parse(
      fs.readFileSync(new URL('../../tools/m15-strict-successors.json', import.meta.url), 'utf8')
    );
    const context = {
      root: f.root,
      M15_DATA: {},
      DATA: {},
      equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      fingerprintFile: (root, file) => {
        assert.equal(root, f.root);
        const raw = fs.readFileSync(path.join(root, file));
        return { path: file, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
      }
    };
    vm.runInNewContext(
      text.slice(text.indexOf(start) + start.length, text.indexOf(end)) +
        '\nglobalThis.pair=m12CaptureSource;globalThis.run=(version,row)=>m12CaptureSourcePin(root,version===15?M15_DATA:DATA,row);',
      context,
      { filename: 'strict-capture-source-pair.mjs' }
    );
    const pair = JSON.parse(JSON.stringify(context.pair)),
      file = pair.base.path,
      raw = m24SpinePrevious(fs.readFileSync(new URL('../../' + file, import.meta.url)), file);
    f.put(file, raw);
    assert.equal(data.owners.length, 12);
    assert(data.owners.every(owner => owner.sourcePaths.includes(file)));
    assert.deepEqual(
      data.inputs.find(row => row.path === file),
      pair.base
    );
    assert.deepEqual(context.fingerprintFile(f.root, file), pair.current);
    assert.deepEqual(JSON.parse(JSON.stringify(context.run(15, pair.base))), pair.current);
    assert.deepEqual(context.run(13, pair.base), pair.base);
    for (const unknown of [
      { ...pair.base, path: 'packages/runtime/src/unknown.ts' },
      { ...pair.base, bytes: pair.base.bytes + 1 },
      { ...pair.base, sha256: '0'.repeat(64) }
    ])
      assert.deepEqual(context.run(15, unknown), unknown);
    const altered = Buffer.from(raw);
    altered[0] ^= 1;
    f.put(file, altered);
    assert.deepEqual(context.run(15, pair.base), pair.base);
    f.put(file, Buffer.concat([raw, Buffer.from('\n')]));
    assert.deepEqual(context.run(15, pair.base), pair.base);
    f.put(file, raw);
    assert.deepEqual(JSON.parse(JSON.stringify(context.run(15, pair.base))), pair.current);
  } finally {
    f.close();
  }
});

test('M1.2 strict bootstrap keeps nine exact current sources and reverses only its one helper literal', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true });
  try {
    const expected = [
        {
          'path': 'tools/bitmap-resource-slot-types.mjs',
          'predecessor': {
            'bytes': 11184,
            'sha256': 'c97f8b75d9103477c7f5e5932f0fb75e588d42eec31a73e6f66327fae9275eaf'
          },
          'current': { 'bytes': 11184, 'sha256': 'e368d684d0fcaa7ad64539464110f8313cd8e17f2769421cd534953064317629' }
        },
        {
          'path': 'tools/bitmap-binding-ticket-types.mjs',
          'predecessor': {
            'bytes': 13887,
            'sha256': 'b36874eaab10b6c275424584d062b599f8e14a215336a7722e9a3783190a8782'
          },
          'current': { 'bytes': 13887, 'sha256': 'c59ec5a76da98fae8389671152ef38ae07653ce6b8680443b3a05c89061753f9' }
        },
        {
          'path': 'tools/linear-layout-types.mjs',
          'predecessor': {
            'bytes': 11073,
            'sha256': '89cf1e6e5fd099871ff0d7388df1b0b6e6accd36c78aef9aa33e1e5426fa71c3'
          },
          'current': { 'bytes': 11073, 'sha256': 'aecf36d5290b8691cb08b838a008767300f1d62793dfaf3a482ff349cf87f369' }
        },
        {
          'path': 'tools/bitmap-button-types.mjs',
          'predecessor': {
            'bytes': 17175,
            'sha256': '919546bc07a51a78d499ae070618d7000e2d87774ad4af3c8a540b395924bbb8'
          },
          'current': { 'bytes': 17175, 'sha256': '38049fb026e9602a5666709a6995a83d619e55f4ff69c777bd282fcc4f13a594' }
        },
        {
          'path': 'tools/display-anchor-offsets-types.mjs',
          'predecessor': {
            'bytes': 16526,
            'sha256': '9d37f5989501d97094b25a0d9130f98c906cdc60bea4b1f9a042279b7279f90c'
          },
          'current': { 'bytes': 16526, 'sha256': 'ec55c864f05220560e9bf1dec478bb4ec9654cdf643230d2fe029dcfc9e2633a' }
        },
        {
          'path': 'tools/display-container-add-child-at-types.mjs',
          'predecessor': {
            'bytes': 18718,
            'sha256': 'f25ded3a21e455bfc45d5181025d7fd6dcd43cd666a08bc246855fce4452ee91'
          },
          'current': { 'bytes': 18718, 'sha256': '39dbbc65ab64ddc2f9f4cf92333f689d8a8998e20277d9a327bf7ecd179e9fbe' }
        },
        {
          'path': 'tools/display-container-child-index-types.mjs',
          'predecessor': {
            'bytes': 17112,
            'sha256': 'fb2d518381df6f41795f198c5b353b03fc194361151bbdd5963fde78e7f38929'
          },
          'current': { 'bytes': 17112, 'sha256': '74c3722cb43b203b46e7aed2f442f34e220849be55a92dc165e48af29c156a0f' }
        },
        {
          'path': 'tools/display-container-remove-children-types.mjs',
          'predecessor': {
            'bytes': 15268,
            'sha256': 'f03e8cfc77240d8ea40021333bf13e56cc15e0e0f469442fd6a72dee7e5bd31b'
          },
          'current': { 'bytes': 15268, 'sha256': '08abd88096100f2dc45f0b197cdde72baf55bfff93e34c6f1e508c7ef0fa7514' }
        },
        {
          'path': 'tools/sequence-playback-types.mjs',
          'predecessor': {
            'bytes': 19255,
            'sha256': '6dffcc40c3654db9c9faa2f9983eafea7b6e91960aab20f279b0f5caba9a66be'
          },
          'current': { 'bytes': 19255, 'sha256': '4b0dccd9c27eeb4ae049a80048e978f821fde744c712530a6d342dcad8abaf35' }
        }
      ],
      collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      current = collect();
    assert.equal(expected.length, 9);
    for (const row of expected) {
      const raw = fs.readFileSync(path.join(f.root, row.path)),
        text = raw.toString(),
        identity = body => ({ bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      assert.deepEqual(identity(raw), row.current);
      assert.equal(text.split(m12BootstrapAfter).length, 2);
      const revision = current.inlinePolicies.sourceRevisions.find(value => value.current.path === row.path);
      assert.equal(revision.selection, 'm12-hotpath-strict-current');
      assert.equal(revision.admission, 'not-evaluated');
      assert.deepEqual(revision.m12HotPathStrictSuccessor, { path: row.path, ...row.current });
      const predecessor = Buffer.from(text.replace(m12BootstrapAfter, m15BootstrapAfter));
      assert.deepEqual(identity(predecessor), row.predecessor);
      f.put(row.path, predecessor);
      const historical = collect();
      assert.equal(
        historical.inlinePolicies.sourceRevisions.find(value => value.current.path === row.path).selection,
        'm15-strict-current'
      );
      assert.deepEqual(historical.inlinePolicies.literals, current.inlinePolicies.literals);
      assert.deepEqual(historical.inlinePolicies.conditions, current.inlinePolicies.conditions);
      f.put(row.path, raw);
      assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
      const altered = Buffer.concat([raw, Buffer.from('// unreviewed current strict source\n')]);
      f.put(row.path, altered);
      assert.throws(collect, /Unreviewed inline policy source/);
      assert.throws(() => m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }));
      f.put(row.path, raw);
      assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
    }
  } finally {
    f.close();
  }
});

// UNIT: current exact UI metadata is data; these readers never execute product code.
test('M3.1 current boundary metadata preserves current source pins and refuses unknown owner bytes', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    for (const row of m31UiBoundaryHistory)
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    assert.equal(current.declarations.filter(row => row.binding === 'm31UiAdditionPins').length, 3);
    assert(current.graphCoverage.every(row => row.uiSuccessor?.binding === 'm31UiAdditionPins'));
    assert.equal(current.successorPairs.filter(row => row.binding === 'm31UiPackagePairs').length, 6);
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    const file = m31UiBoundaryHistory[0].path,
      raw = fs.readFileSync(path.join(f.root, file));
    try {
      f.put(file, Buffer.concat([raw, Buffer.from('// unregistered UI owner\n')]));
      assert.throws(collect, /Unsupported declaration preamble/);
    } finally {
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});
test('M3.1 current compiler metadata proves exact UI source inverses and refuses unknown wrapper bytes', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true });
  try {
    for (const row of m31UiStrictHistory)
      if (fs.existsSync(path.join(f.root, row.path)))
        f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true }),
      current = collect();
    assert.equal(current.inlinePolicies.sourceRevisions.filter(row => row.selection === 'm31-ui-current').length, 10);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
    const file = 'tools/linear-layout-types.mjs',
      raw = fs.readFileSync(path.join(f.root, file));
    try {
      f.put(file, Buffer.concat([raw, Buffer.from('// unregistered UI wrapper\n')]));
      assert.throws(collect, /Unreviewed inline policy source/);
    } finally {
      f.put(file, raw);
    }
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

// UNIT: exact current keyboard owners add review data without rewriting history.
test('M3.3 keyboard maintenance preserves exact current pairs and three bounded graph groups', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const owners = m33KeyboardSourceHistory.filter(row => row.path.endsWith('-boundary.mjs'));
    for (const row of owners) f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    assert.equal(current.successorPairs.filter(row => row.binding === 'm33KeyboardPackagePairs').length, 6);
    const expandedOwners = new Set([
      'tools/spritesheet-boundary.mjs',
      'tools/browser-png-boundary.mjs',
      'tools/atlas-import-boundary.mjs'
    ]);
    const sourcePairs = current.successorPairs.filter(row => row.binding === 'm33KeyboardSourcePairs');
    assert.equal(sourcePairs.length, 6);
    assert.equal(sourcePairs.filter(row => expandedOwners.has(row.owner)).length, 3);
    for (const row of sourcePairs) assert.equal(row.rows.length, expandedOwners.has(row.owner) ? 22 : 6, row.owner);
    assert.equal(current.declarations.filter(row => row.binding === 'm33KeyboardAdditionPins').length, 3);
    assert(
      current.declarations
        .filter(row => row.binding === 'm33KeyboardAdditionPins')
        .every(row => expandedOwners.has(row.owner) && row.rows.length === 15)
    );
    assert(current.graphCoverage.every(row => row.keyboardSuccessor?.binding === 'm33KeyboardAdditionPins'));
    for (const row of owners) {
      const previous = m33KeyboardPrevious(fs.readFileSync(path.join(f.root, row.path)), row);
      assert.equal(previous.length, row.predecessor.bytes);
      assert.equal(createHash('sha256').update(previous).digest('hex'), row.predecessor.sha256);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    const file = owners[0].path,
      raw = fs.readFileSync(path.join(f.root, file));
    f.put(file, Buffer.concat([raw, Buffer.from('// unreviewed keyboard owner\n')]));
    assert.throws(collect, /Unsupported declaration preamble/);
  } finally {
    f.close();
  }
});
test('M3.3 keyboard strict preparation authenticates nine current wrappers before retained extraction', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true });
  try {
    for (const row of m33KeyboardSourceHistory.filter(row => row.path.endsWith('-types.mjs')))
      if (fs.existsSync(path.join(f.root, row.path)))
        f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const current = m.prepareCompilerReview(f.root, { inlinePolicies: true });
    assert.equal(current.inlinePolicies.sourceRevisions.filter(row => row.m33KeyboardSuccessor).length, 9);
    assert(
      current.inlinePolicies.sourceRevisions
        .filter(row => row.m33KeyboardSuccessor)
        .every(row => row.extractionRevision.sha256 !== row.current.sha256)
    );
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

test('M3.1 key-navigation compiler successor restores exact history and refuses inserted or unrelated drift', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true }),
    file = 'tools/check-types.mjs';
  try {
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true });
    const raw = fs.readFileSync(new URL('../../' + file, import.meta.url)),
      previous = m31NavigationFixturePrevious(file, raw);
    assert.equal(previous.length, m31NavigationFixtureSource.predecessor.bytes);
    assert.equal(createHash('sha256').update(previous).digest('hex'), m31NavigationFixtureSource.predecessor.sha256);
    f.put(file, previous);
    const historical = collect();
    f.put(file, raw);
    const current = collect(),
      row = current.inlinePolicies.sourceRevisions.find(row => row.base.path === file);
    assert.deepEqual(row.m31NavigationSuccessor, m31NavigationFixtureSource.current);
    assert.deepEqual(row.extractionRevision, m31NavigationFixtureSource.predecessor);
    assert.equal(row.selection, 'm31-ui-current');
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
    assert.deepEqual(current.inlinePolicies.literals, historical.inlinePolicies.literals);
    assert.deepEqual(current.inlinePolicies.conditions, historical.inlinePolicies.conditions);
    assert.deepEqual(current.inlinePolicies.observations, historical.inlinePolicies.observations);
    for (const altered of [
      Buffer.from(raw.toString().replace("name:'numeric-key',line:517", "name:'numeric-key',line:518")),
      Buffer.concat([raw, Buffer.from('// unreviewed navigation checker drift\n')]),
      Buffer.concat([raw, Buffer.from(m31NavigationFixtureInsertion)])
    ]) {
      // Each assigned mutation starts from a fresh complete accepted proposal.
      f.put(file, raw);
      const baseline = collect();
      assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
      assert.equal(altered.equals(raw), false);
      f.put(file, altered);
      assert.throws(collect, /Unreviewed inline policy source/);
    }
    f.put(file, raw);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
  } finally {
    f.close();
  }
});

// Each current group is exact; historical owners remain complete byte identities.
test('key-reveal source maintenance exposes nine exact pairs and retains historical owners', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    for (const row of m33KeyboardSourceHistory.filter(row => row.path.endsWith('-boundary.mjs')))
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect(),
      groups = current.successorPairs.filter(row => row.binding === 'm3KeyRevealSourcePairs');
    assert.equal(groups.length, 3);
    assert(groups.every(row => row.rows.length === 9));
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    for (const row of m3KeyRevealSourceHistory) {
      const raw = fs.readFileSync(path.join(f.root, row.path)),
        previous = m3KeyRevealPrevious(raw, row.path);
      assert.equal(previous.length, row.predecessor.bytes);
      assert.equal(createHash('sha256').update(previous).digest('hex'), row.predecessor.sha256);
      for (const change of [
        body => Buffer.concat([body, Buffer.from('// outside group drift\n')]),
        body =>
          Buffer.from(
            body
              .toString('utf8')
              .replace('Invalid finite key-reveal source group', 'Invalid finite key-reveal source drift')
          )
      ]) {
        const baseline = collect();
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
        try {
          f.put(row.path, change(raw));
          assert.throws(collect, /Unsupported declaration preamble/);
        } finally {
          f.put(row.path, raw);
        }
        assert.equal(m.verifyMaintenanceProposal(f.root, collect()), true);
      }
    }
  } finally {
    f.close();
  }
});

// Current integrated owners are exact; historical extraction is a separate observation.
test('M2.4 finite current source inverses retain complete originals and reject drift', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const owners = m24SpineSourceHistory.filter(row => row.path.endsWith('-boundary.mjs'));
    for (const row of owners) f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const current = m.prepareBaselineReview(f.root),
      groups = current.successorPairs.filter(row => row.binding === 'm24SpineSourcePairs');
    assert.equal(groups.length, 6);
    assert(groups.every(group => group.rows.length === 20));
    for (const row of m24SpineSourceHistory) {
      const raw = fs.readFileSync(new URL('../../' + row.path, import.meta.url)),
        previous = m24SpinePrevious(raw, row.path);
      assert.deepEqual(
        { path: row.path, bytes: previous.length, sha256: createHash('sha256').update(previous).digest('hex') },
        row.predecessor
      );
      const drift = Buffer.concat([raw, Buffer.from('// drift\n')]);
      assert.deepEqual(m24SpinePrevious(drift, row.path), drift);
    }
    for (const row of owners) {
      const raw = fs.readFileSync(path.join(f.root, row.path));
      f.put(row.path, Buffer.concat([raw, Buffer.from('// drift\n')]));
      assert.throws(() => m.prepareBaselineReview(f.root));
      f.put(row.path, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});

// Every mutation starts with a fresh complete accepted proposal.
test('M3.4 theme compiler successor retains historical extraction and rejects exact-receipt drift', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true }),
    file = 'tools/check-types.mjs',
    selected = m34ThemeSourceHistory.find(row => row.path === file);
  try {
    const raw = m24ResetPrevious(fs.readFileSync(new URL('../../' + file, import.meta.url)), file),
      previous = m34ThemePrevious(raw, file),
      identity = body => ({ path: file, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
    assert.deepEqual(identity(previous), selected.predecessor);
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true });
    f.put(file, previous);
    const historical = collect();
    f.put(file, raw);
    const current = collect(),
      row = current.inlinePolicies.sourceRevisions.find(row => row.base.path === file);
    assert.deepEqual(row.current, selected.current);
    assert.deepEqual(row.m34ThemeSuccessor, selected.current);
    assert.deepEqual(row.m34ThemePredecessor, selected.predecessor);
    for (const key of ['literals', 'conditions', 'observations'])
      assert.deepEqual(current.inlinePolicies[key], historical.inlinePolicies[key]);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
    for (const altered of [
      Buffer.from(
        raw.toString().replace('"name":"nonforgeable-theme","line":529', '"name":"nonforgeable-theme","line":530')
      ),
      Buffer.concat([raw, Buffer.from(selected.inverse[0].from)]),
      Buffer.concat([raw, Buffer.from('// theme checker drift\n')])
    ]) {
      f.put(file, raw);
      const baseline = collect();
      assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
      assert.equal(altered.equals(raw), false);
      assert.deepEqual(m34ThemePrevious(altered, file), altered);
      f.put(file, altered);
      assert.throws(collect, /Unreviewed inline policy source/);
    }
  } finally {
    f.close();
  }
});

test('M3.4 theme maintenance exposes ten exact pairs and three additions while refusing owner drift', async () => {
  const m = await maintenance(),
    f = baselineFixture(),
    owners = m34ThemeSourceHistory.filter(row => row.path.endsWith('-boundary.mjs'));
  try {
    for (const row of m24SpineSourceHistory.filter(row => row.path.endsWith('-boundary.mjs')))
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    const groups = current.successorPairs.filter(row => row.binding === 'uiThemeGraphPairs');
    assert.equal(groups.length, 3);
    assert(groups.every(row => row.rows.length === 10));
    const additions = current.declarations.filter(row => row.binding === 'uiThemeGraphAdditions');
    assert.equal(additions.length, 3);
    assert(additions.every(row => row.rows.length === 3));
    for (const selected of owners) {
      const file = selected.path,
        raw = fs.readFileSync(new URL('../../' + file, import.meta.url)),
        previous = m34ThemePrevious(raw, file);
      assert.deepEqual(
        { path: file, bytes: previous.length, sha256: createHash('sha256').update(previous).digest('hex') },
        selected.predecessor
      );
      f.put(file, previous);
      const historical = collect();
      assert.equal(m.verifyMaintenanceProposal(f.root, historical), true);
      assert.equal(
        historical.successorPairs.some(row => row.owner === file && row.binding === 'uiThemeGraphPairs'),
        false
      );
      f.put(file, raw);
      for (const altered of [
        Buffer.from(raw.toString().replace('Invalid finite UI theme graph', 'Invalid finite UI theme drift')),
        Buffer.concat([raw, Buffer.from(selected.inverse[0].from)]),
        Buffer.concat([raw, Buffer.from('// theme owner drift\n')])
      ]) {
        f.put(file, raw);
        const baseline = collect();
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
        assert.equal(altered.equals(raw), false);
        assert.deepEqual(m34ThemePrevious(altered, file), altered);
        f.put(file, altered);
        assert.throws(collect, /Unsupported declaration preamble/);
      }
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});

// Current proposals observe RESET bytes; extraction remains the exact theme predecessor.
test('M2.4 RESET compiler successor preserves theme history and rejects unrelated or duplicate drift', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true }),
    file = 'tools/check-types.mjs',
    selected = m24ResetSourceHistory.find(row => row.path === file);
  try {
    const raw = authoredSceneCompilerFixturePrevious(fs.readFileSync(new URL('../../' + file, import.meta.url)), file),
      previous = m24ResetPrevious(raw, file),
      identity = body => ({ path: file, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
    assert.deepEqual(identity(previous), selected.predecessor);
    const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true });
    f.put(file, previous);
    const historical = collect();
    f.put(file, raw);
    const current = collect(),
      row = current.inlinePolicies.sourceRevisions.find(row => row.base.path === file);
    assert.deepEqual(row.current, selected.current);
    assert.deepEqual(row.m24ResetSuccessor, selected.current);
    assert.deepEqual(row.m24ResetPredecessor, selected.predecessor);
    assert.deepEqual(row.m34ThemeSuccessor, selected.predecessor);
    for (const key of ['literals', 'conditions', 'observations'])
      assert.deepEqual(current.inlinePolicies[key], historical.inlinePolicies[key]);
    assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
    for (const altered of [
      Buffer.from(raw.toString().replace('./sequence-reset-types.mjs', './sequence-reset-other.mjs')),
      Buffer.concat([raw, Buffer.from(selected.inverse[0].from)]),
      Buffer.concat([raw, Buffer.from('// RESET checker drift\n')])
    ]) {
      f.put(file, raw);
      const baseline = collect();
      assert.equal(m.verifyCompilerProposal(f.root, baseline, { inlinePolicies: true }).status, 'current-inputs');
      assert.equal(altered.equals(raw), false);
      assert.deepEqual(m24ResetPrevious(altered, file), altered);
      f.put(file, altered);
      assert.throws(collect, /Unreviewed inline policy source/);
    }
  } finally {
    f.close();
  }
});
test('authored scene type input keeps the previous compiler observation and rejects altered owners', async () => {
  const m = await compilerTool(),
    f = inlineCompilerFixture({ m12: true });
  try {
    for (const selection of [
      authoredSceneCompilerFixtureHistory,
      authoredSceneStrictCallerHistory.find(row => row.path === 'tools/bitmap-resource-slot-types.mjs')
    ]) {
      const file = selection.path;
      const importedGlbAnimationRaw = fs.readFileSync(new URL('../../' + file, import.meta.url));
      const sceneAnimationRaw = importedGlbAnimationCompilerFixturePrevious(importedGlbAnimationRaw, file);
      const lambertRaw = sceneAnimationCompilerFixturePrevious(sceneAnimationRaw, file);
      const texturedRaw = lambertGlbCompilerFixturePrevious(lambertRaw, file);
      const worldRaw = texturedGlbCompilerFixturePrevious(texturedRaw, file);
      const raw = worldCardCompilerFixturePrevious(worldRaw, file),
        previous = authoredSceneCompilerFixturePrevious(raw, file);
      const collect = () => m.prepareCompilerReview(f.root, { inlinePolicies: true });
      f.put(file, previous);
      const prior = collect();
      f.put(file, raw);
      const current = collect();
      const row = current.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
      assert.deepEqual(row.current, selection.current);
      assert.deepEqual(row.authoredScenePredecessor, selection.predecessor);
      for (const key of ['literals', 'conditions', 'observations'])
        assert.deepEqual(current.inlinePolicies[key], prior.inlinePolicies[key]);
      assert.equal(m.verifyCompilerProposal(f.root, current, { inlinePolicies: true }).status, 'current-inputs');
      f.put(file, worldRaw);
      const world = collect();
      const worldRow = world.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
      assert.deepEqual(worldRow.worldCardPredecessor, selection.current);
      assert.deepEqual(worldRow.worldCardSuccessor, worldCardCompilerHistory.find(row => row.path === file).current);
      for (const key of ['literals', 'conditions', 'observations'])
        assert.deepEqual(world.inlinePolicies[key], prior.inlinePolicies[key]);
      assert.equal(m.verifyCompilerProposal(f.root, world, { inlinePolicies: true }).status, 'current-inputs');
      f.put(file, texturedRaw);
      const texturedGlb = collect();
      const texturedRow = texturedGlb.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
      const texturedHistory = texturedGlbCompilerHistory.find(row => row.path === file);
      assert.deepEqual(texturedRow.texturedGlbPredecessor, texturedHistory.predecessor);
      assert.deepEqual(texturedRow.texturedGlbSuccessor, texturedHistory.current);
      for (const key of ['literals', 'conditions', 'observations'])
        assert.deepEqual(texturedGlb.inlinePolicies[key], prior.inlinePolicies[key]);
      assert.equal(m.verifyCompilerProposal(f.root, texturedGlb, { inlinePolicies: true }).status, 'current-inputs');
      f.put(file, lambertRaw);
      const lambertGlb = collect();
      const lambertRow = lambertGlb.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
      const lambertHistory = lambertGlbCompilerHistory.find(row => row.path === file);
      assert.deepEqual(lambertRow.lambertGlbPredecessor, lambertHistory.predecessor);
      assert.deepEqual(lambertRow.lambertGlbSuccessor, lambertHistory.current);
      for (const key of ['literals', 'conditions', 'observations'])
        assert.deepEqual(lambertGlb.inlinePolicies[key], prior.inlinePolicies[key]);
      assert.equal(m.verifyCompilerProposal(f.root, lambertGlb, { inlinePolicies: true }).status, 'current-inputs');
      const sceneAnimationHistory = sceneAnimationCompilerHistory.find(row => row.path === file);
      if (sceneAnimationHistory) {
        f.put(file, sceneAnimationRaw);
        const animation = collect();
        const animationRow = animation.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
        assert.deepEqual(animationRow.sceneAnimationPredecessor, sceneAnimationHistory.predecessor);
        assert.deepEqual(animationRow.sceneAnimationSuccessor, sceneAnimationHistory.current);
        for (const key of ['literals', 'conditions', 'observations'])
          assert.deepEqual(animation.inlinePolicies[key], prior.inlinePolicies[key]);
        assert.equal(m.verifyCompilerProposal(f.root, animation, { inlinePolicies: true }).status, 'current-inputs');
      }
      const importedGlbAnimationHistory = importedGlbAnimationCompilerHistory.find(row => row.path === file);
      if (importedGlbAnimationHistory) {
        f.put(file, importedGlbAnimationRaw);
        const importedAnimation = collect();
        const importedRow = importedAnimation.inlinePolicies.sourceRevisions.find(row => row.current.path === file);
        assert.deepEqual(importedRow.importedGlbAnimationPredecessor, importedGlbAnimationHistory.predecessor);
        assert.deepEqual(importedRow.importedGlbAnimationSuccessor, importedGlbAnimationHistory.current);
        for (const key of ['literals', 'conditions', 'observations'])
          assert.deepEqual(importedAnimation.inlinePolicies[key], prior.inlinePolicies[key]);
        assert.equal(
          m.verifyCompilerProposal(f.root, importedAnimation, { inlinePolicies: true }).status,
          'current-inputs'
        );
      }
      const altered = Buffer.concat([importedGlbAnimationRaw, Buffer.from('// unreviewed authored scene type gate\n')]);
      f.put(file, altered);
      assert.throws(collect, /Unreviewed inline policy source/);
      f.put(file, previous);
    }
  } finally {
    f.close();
  }
});
test('M2.4 RESET source maintenance exposes fourteen exact pairs and six additions per owner and refuses drift', async () => {
  const m = await maintenance(),
    f = baselineFixture(),
    owners = m24ResetSourceHistory.filter(row => row.path.endsWith('-boundary.mjs'));
  try {
    assert.equal(owners.length, 3);
    for (const row of m24SpineSourceHistory.filter(row => row.path.endsWith('-boundary.mjs')))
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    const groups = current.successorPairs.filter(row => row.binding === 'sequenceResetGraphPairs');
    assert.equal(groups.length, 3);
    assert(groups.every(row => row.rows.length === 14));
    const additions = current.declarations.filter(row => row.binding === 'sequenceResetGraphAdditions');
    assert.equal(additions.length, 3);
    assert(additions.every(row => row.rows.length === 6));
    assert.deepEqual(groups.map(row => row.owner).sort(), owners.map(row => row.path).sort());
    assert.deepEqual(additions.map(row => row.owner).sort(), owners.map(row => row.path).sort());
    for (const selected of owners) {
      const file = selected.path,
        raw = fs.readFileSync(new URL('../../' + file, import.meta.url)),
        previous = m24ResetPrevious(raw, file);
      assert.deepEqual(
        { path: file, bytes: previous.length, sha256: createHash('sha256').update(previous).digest('hex') },
        selected.predecessor
      );
      f.put(file, previous);
      const historical = collect();
      assert.equal(m.verifyMaintenanceProposal(f.root, historical), true);
      assert.equal(
        historical.successorPairs.some(row => row.owner === file && row.binding === 'sequenceResetGraphPairs'),
        false
      );
      assert.equal(historical.successorPairs.filter(row => row.binding === 'sequenceResetGraphPairs').length, 2);
      f.put(file, raw);
      for (const altered of [
        Buffer.from(
          raw.toString().replace('Invalid finite sequence RESET graph', 'Invalid finite sequence RESET drift')
        ),
        Buffer.concat([raw, Buffer.from(selected.inverse[0].from)]),
        Buffer.concat([raw, Buffer.from('// RESET owner drift\n')])
      ]) {
        f.put(file, raw);
        const baseline = collect();
        assert.equal(m.verifyMaintenanceProposal(f.root, baseline), true);
        assert.equal(altered.equals(raw), false);
        assert.deepEqual(m24ResetPrevious(altered, file), altered);
        f.put(file, altered);
        assert.throws(collect, /Unsupported declaration preamble/);
      }
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});

// Selector repair adds a new complete source revision, never rewrites an earlier owner.
test('M3.4 theme selector repair preserves both reviewed source generations and exact inverses', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    for (const row of m24SpineSourceHistory.filter(row => row.path.endsWith('-boundary.mjs')))
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root);
    for (const selected of m34ThemeSelectionSourceHistory) {
      const file = selected.path,
        raw = m24ResetPrevious(fs.readFileSync(new URL('../../' + file, import.meta.url)), file),
        previous = m34ThemeSelectionPrevious(raw, file),
        identity = body => ({
          path: file,
          bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex')
        });
      assert.deepEqual(identity(raw), selected.current);
      assert.deepEqual(identity(previous), selected.predecessor);
      assert.deepEqual(selected.predecessor, m34ThemeSourceHistory.find(row => row.path === file).current);
      f.put(file, raw);
      const current = collect();
      assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
      f.put(file, previous);
      const historical = collect();
      assert.equal(m.verifyMaintenanceProposal(f.root, historical), true);
      for (const key of ['successorPairs', 'declarations']) assert.deepEqual(current[key], historical[key]);
      for (const altered of [
        Buffer.concat([raw, Buffer.from('// unreviewed selector repair\n')]),
        Buffer.from(
          raw
            .toString()
            .replace(
              'uiThemeGraphAdditions.some(row=>present.has(row.path))&&![selected,',
              'uiThemeGraphAdditions.every(row=>present.has(row.path))&&![selected,'
            )
        )
      ]) {
        f.put(file, raw);
        assert.equal(m.verifyMaintenanceProposal(f.root, collect()), true);
        assert.equal(altered.equals(raw), false);
        assert.deepEqual(m34ThemeSelectionPrevious(altered, file), altered);
        f.put(file, altered);
        assert.throws(collect, /Unsupported declaration preamble/);
      }
      f.put(file, raw);
    }
  } finally {
    f.close();
  }
});

// Current controls admission remains an observation of three fixed source owners.
test('controls maintenance exposes seven exact pairs and three additions per owner', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    for (const file of [
      'tools/spritesheet-boundary.mjs',
      'tools/browser-png-boundary.mjs',
      'tools/atlas-import-boundary.mjs'
    ])
      f.put(file, fs.readFileSync(new URL('../../' + file, import.meta.url)));
    const current = m.prepareBaselineReview(f.root);
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    const pairs = current.successorPairs.filter(row => row.binding === 'uiControlsGraphPairs'),
      additions = current.declarations.filter(row => row.binding === 'uiControlsGraphAdditions');
    assert.equal(pairs.length, 3);
    assert(pairs.every(row => row.rows.length === 7));
    assert.equal(additions.length, 3);
    assert(additions.every(row => row.rows.length === 3));
    assert.deepEqual(
      pairs.map(row => row.rows),
      [pairs[0].rows, pairs[0].rows, pairs[0].rows]
    );
    assert.deepEqual(
      additions.map(row => row.rows),
      [additions[0].rows, additions[0].rows, additions[0].rows]
    );
  } finally {
    f.close();
  }
});

test('controls source inverses preserve trusted predecessors and reject unknown or duplicate bytes', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    assert.equal(uiControlsSourceHistory.length, 3);
    for (const row of uiControlsSourceHistory)
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root);
    assert.equal(m.verifyMaintenanceProposal(f.root, collect()), true);
    for (const selected of uiControlsSourceHistory) {
      const file = selected.path,
        raw = m42ContainedClipPrevious(fs.readFileSync(new URL('../../' + file, import.meta.url)), file),
        previous = uiControlsPrevious(raw, file),
        identity = body => ({
          path: file,
          bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex')
        });
      assert.deepEqual(identity(raw), selected.current);
      assert.deepEqual(identity(previous), selected.predecessor);
      assert.deepEqual(selected.predecessor, m24ResetSourceHistory.find(row => row.path === file).current);
      f.put(file, previous);
      const historical = collect();
      assert.equal(m.verifyMaintenanceProposal(f.root, historical), true);
      assert.equal(
        historical.successorPairs.some(row => row.owner === file && row.binding === 'uiControlsGraphPairs'),
        false
      );
      assert.equal(
        historical.declarations.some(row => row.owner === file && row.binding === 'uiControlsGraphAdditions'),
        false
      );
      for (const altered of [
        Buffer.from(raw.toString().replace('Invalid finite UI controls graph', 'Invalid finite UI controls drift')),
        Buffer.concat([raw, Buffer.from(selected.inverse[0].from)]),
        Buffer.concat([raw, Buffer.from('// unreviewed controls owner\n')])
      ]) {
        f.put(file, raw);
        assert.equal(m.verifyMaintenanceProposal(f.root, collect()), true);
        assert.equal(altered.equals(raw), false);
        assert.deepEqual(uiControlsPrevious(altered, file), altered);
        f.put(file, altered);
        assert.throws(collect, /Unsupported declaration preamble/);
      }
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, collect()), true);
  } finally {
    f.close();
  }
});

test('contained clipping maintenance keeps exact current owners and complete predecessors', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const history = m42ContainedClipSourceHistory;
    for (const row of history) f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    const pairs = current.successorPairs.filter(row => row.binding === 'sharedContainedClipPairs');
    assert.deepEqual(
      pairs.map(row => row.owner),
      history.map(row => row.path)
    );
    assert.ok(pairs.every(row => row.rows.length === 2));
    assert.ok(pairs.every(row => JSON.stringify(row.rows) === JSON.stringify(pairs[0].rows)));
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    for (const { path: file, predecessor } of history) {
      const raw = fs.readFileSync(path.join(f.root, file)),
        previous = m42ContainedClipPrevious(raw, file);
      assert.deepEqual(
        { path: file, bytes: previous.length, sha256: createHash('sha256').update(previous).digest('hex') },
        predecessor
      );
      f.put(file, previous);
      assert.equal(
        collect().successorPairs.some(row => row.owner === file && row.binding === 'sharedContainedClipPairs'),
        false
      );
      const changed = Buffer.concat([raw, Buffer.from('// unreviewed contained clipping owner\n')]);
      assert.deepEqual(m42ContainedClipPrevious(changed, file), changed);
      f.put(file, changed);
      assert.throws(collect, /Unsupported declaration preamble/);
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});

test('compatible sequence graph owners retain the exact contained clipping predecessor and refuse drift', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const history = m24CompatibleSequenceSourceHistory;
    for (const row of m42ContainedClipSourceHistory)
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    const clipping = proposal => proposal.successorPairs.filter(row => row.binding === 'sharedContainedClipPairs');
    assert.deepEqual(
      clipping(current).map(row => row.owner),
      m42ContainedClipSourceHistory.map(row => row.path)
    );
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    for (const { path: file, predecessor } of history) {
      const raw = fs.readFileSync(path.join(f.root, file)),
        previous = m24CompatibleSequencePrevious(raw, file);
      assert.deepEqual(
        { path: file, bytes: previous.length, sha256: createHash('sha256').update(previous).digest('hex') },
        predecessor
      );
      assert.deepEqual(predecessor, m42ContainedClipSourceHistory.find(row => row.path === file).current);
      f.put(file, previous);
      const prior = collect();
      assert.deepEqual(clipping(prior), clipping(current));
      assert.equal(m.verifyMaintenanceProposal(f.root, prior), true);
      const changed = Buffer.concat([raw, Buffer.from('// unreviewed compatible sequence owner\n')]);
      assert.deepEqual(m24CompatibleSequencePrevious(changed, file), changed);
      f.put(file, changed);
      assert.throws(collect, /Unsupported declaration preamble/);
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});

test('canonical geometry graph owners retain the exact sequence predecessor and refuse drift', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    for (const row of m42ContainedClipSourceHistory)
      f.put(row.path, fs.readFileSync(new URL('../../' + row.path, import.meta.url)));
    const collect = () => m.prepareBaselineReview(f.root),
      current = collect();
    const clipping = proposal => proposal.successorPairs.filter(row => row.binding === 'sharedContainedClipPairs');
    assert.deepEqual(
      clipping(current).map(row => row.owner),
      m42ContainedClipSourceHistory.map(row => row.path)
    );
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
    for (const { path: file, predecessor } of m42GeometryCanonicalSourceHistory) {
      const raw = fs.readFileSync(path.join(f.root, file)),
        previous = m42GeometryCanonicalPrevious(raw, file);
      assert.deepEqual(
        { path: file, bytes: previous.length, sha256: createHash('sha256').update(previous).digest('hex') },
        predecessor
      );
      assert.deepEqual(predecessor, m24CompatibleSequenceSourceHistory.find(row => row.path === file).current);
      f.put(file, previous);
      const prior = collect();
      assert.deepEqual(clipping(prior), clipping(current));
      assert.equal(m.verifyMaintenanceProposal(f.root, prior), true);
      const changed = Buffer.concat([raw, Buffer.from('// unreviewed geometry owner\n')]);
      assert.deepEqual(m42GeometryCanonicalPrevious(changed, file), changed);
      f.put(file, changed);
      assert.throws(collect, /Unsupported declaration preamble/);
      f.put(file, raw);
    }
    assert.equal(m.verifyMaintenanceProposal(f.root, current), true);
  } finally {
    f.close();
  }
});

// A renamed evidence case would otherwise leave both lanes without notice.
if (evidenceLane)
  nodeTest('every evidence case of this file is registered exactly once', () => {
    assert.deepEqual(
      [...evidenceCases].filter(name => !registered.has(name)),
      []
    );
  });
