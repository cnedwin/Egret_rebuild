// SPDX-License-Identifier: Apache-2.0
// Maintenance proposals are review inputs, never gate acceptance or writable baselines.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { baselineFixture, maintenance, maintenanceFixture } from '../helpers/incremental-fixtures.mjs';
test('baseline proposals retain distinct declaration references and never edit source', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const original = fs.readFileSync(path.join(f.root, 'tools/spritesheet-boundary.mjs'));
    f.put('packages/project/src/value.ts', 'export const value = 2;\n');
    const p = m.prepareBaselineReview(f.root);
    assert.equal(p.status, 'review-required');
    const rows = p.declarations.flatMap(x => x.rows).filter(x => x.expected.path === 'packages/project/src/value.ts');
    assert.equal(rows.length, 3);
    assert.ok(rows.every(x => x.identity === 'different' && x.current.sha256 !== x.expected.sha256));
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'tools/spritesheet-boundary.mjs')), original);
    assert.equal(m.verifyMaintenanceProposal(f.root, p), true);
  } finally {
    f.close();
  }
});
test('baseline proposal recheck rejects new ignored output and changed owner bytes', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const p = m.prepareBaselineReview(f.root);
    f.put('packages/project/dist/new.js', 'export {};\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/i);
    fs.unlinkSync(path.join(f.root, 'packages/project/dist/new.js'));
    f.put(
      'tools/spritesheet-boundary.mjs',
      fs.readFileSync(path.join(f.root, 'tools/spritesheet-boundary.mjs'), 'utf8') + '// changed owner\n'
    );
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/i);
  } finally {
    f.close();
  }
});
test('baseline parser refuses duplicate or executable declarations without evaluating them', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'tools/spritesheet-boundary.mjs',
      original = fs.readFileSync(path.join(f.root, file), 'utf8');
    f.put(file, original + 'const graphPins = [];\n');
    assert.throws(() => m.prepareBaselineReview(f.root), /declaration/i);
    f.put(file, original.replace(/const graphPins = .*;/, 'const graphPins = (()=>{throw Error("EXECUTED");})();'));
    assert.throws(
      () => m.prepareBaselineReview(f.root),
      e => !/EXECUTED$/.test(e.message) && /JSON|declaration/i.test(e.message)
    );
  } finally {
    f.close();
  }
});
test('baseline missing paths are distinct from wrong spelling and malformed pins', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    fs.unlinkSync(path.join(f.root, 'packages/project/src/value.ts'));
    assert.ok(
      m
        .prepareBaselineReview(f.root)
        .declarations.flatMap(x => x.rows)
        .some(x => x.identity === 'missing')
    );
    f.put('packages/project/src/Value.ts', 'export {};\n');
    assert.throws(() => m.prepareBaselineReview(f.root), /spelling/i);
    fs.unlinkSync(path.join(f.root, 'packages/project/src/Value.ts'));
    f.put(
      'tools/spritesheet-boundary.mjs',
      'const graphPins = [{"path":"../foreign","bytes":0,"sha256":"' +
        '0'.repeat(64) +
        '"}];\nconst configurationPins = [];\nconst ss1AtlasGraphSuccessor = [];\n'
    );
    assert.throws(() => m.prepareBaselineReview(f.root), /path|identity/i);
  } finally {
    f.close();
  }
});
test('unchanged catalog proposal preserves reviewed ownership and cannot approve itself', async () => {
  const m = await maintenance(),
    f = maintenanceFixture();
  try {
    const p = m.prepareCatalogReview(f.root);
    assert.equal(p.status, 'review-required');
    assert.deepEqual(p.catalog, f.catalog);
    assert.equal(m.verifyMaintenanceProposal(f.root, p), true);
    p.status = 'accepted';
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed|proposal/i);
  } finally {
    f.close();
  }
});
test('changed and new tests become shared while unrelated ownership survives', async () => {
  const m = await maintenance(),
    f = maintenanceFixture();
  try {
    f.put('tests/engine.test.mjs', '// changed\n');
    f.put('tests/new.test.mjs', '// new\n');
    const p = m.prepareCatalogReview(f.root);
    assert.equal(p.catalog.tests.find(x => x.file.path === 'tests/engine.test.mjs').packages, null);
    assert.equal(p.catalog.tests.find(x => x.file.path === 'tests/new.test.mjs').packages, null);
    assert.deepEqual(p.catalog.tests.find(x => x.file.path === 'tests/project.test.mjs').packages, ['project']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, 'tools/incremental-test-catalog.json'))), f.catalog);
    fs.unlinkSync(path.join(f.root, 'tests/shared.test.mjs'));
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/i);
  } finally {
    f.close();
  }
});
test('support drift or absence demotes its owner and stays visible in proposal inputs', async () => {
  const m = await maintenance(),
    f = maintenanceFixture();
  try {
    const helper = 'tests/helpers.mjs';
    f.put(helper, 'export {};\n');
    f.catalog.tests.find(x => x.file.path === 'tests/engine.test.mjs').support = [f.pin(helper)];
    f.put('tools/incremental-test-catalog.json', JSON.stringify(f.catalog));
    f.put(helper, '// changed\n');
    let p = m.prepareCatalogReview(f.root);
    assert.equal(p.catalog.tests.find(x => x.file.path === 'tests/engine.test.mjs').packages, null);
    fs.unlinkSync(path.join(f.root, helper));
    p = m.prepareCatalogReview(f.root);
    assert.ok(p.unavailable.includes(helper));
    assert.equal(p.catalog.tests.find(x => x.file.path === 'tests/engine.test.mjs').packages, null);
    f.put(helper, '// returned\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/i);
  } finally {
    f.close();
  }
});
test('manifest and full-runner changes conservatively clear all package ownership', async () => {
  const m = await maintenance(),
    f = maintenanceFixture();
  try {
    f.put('tools/verify.mjs', '// changed schedule\n');
    let p = m.prepareCatalogReview(f.root);
    assert.ok(p.catalog.tests.every(x => x.packages === null));
    f.put('tools/verify.mjs', 'export {};\n');
    const file = 'packages/project/package.json';
    f.put(file, fs.readFileSync(path.join(f.root, file), 'utf8') + '\n');
    p = m.prepareCatalogReview(f.root);
    assert.ok(p.catalog.tests.every(x => x.packages === null));
  } finally {
    f.close();
  }
});

test('maintenance proposals bind the generator and raw identity helper', async () => {
  const m = await maintenance(),
    f = maintenanceFixture();
  try {
    const p = m.prepareCatalogReview(f.root);
    f.put('tools/lib/file-identity.mjs', '// changed helper\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/i);
  } finally {
    f.close();
  }
});

test('baseline reader refuses comment and template decoys and accepts indented real JSON', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'tools/spritesheet-boundary.mjs',
      original = fs.readFileSync(path.join(f.root, file), 'utf8');
    f.put(file, original.replace('const graphPins', '  const graphPins'));
    assert.equal(m.prepareBaselineReview(f.root).declarations[0].rows.length, 1);
    for (const decoy of [
      '/*\nconst graphPins = [];\n*/\n',
      'const decoy = ' + String.fromCharCode(96) + '\nconst graphPins = [];\n' + String.fromCharCode(96) + ';\n'
    ]) {
      f.put(file, decoy + original.replace(/const graphPins = .*;/, '  const graphPins = dangerous();'));
      assert.throws(() => m.prepareBaselineReview(f.root), /declaration/i);
      f.put(file, decoy + original.replace(/const graphPins = .*;\n/, ''));
      assert.throws(() => m.prepareBaselineReview(f.root), /declaration/i);
    }
    f.put(file, 'const literal = ' + JSON.stringify('escaped " and /* comment */ // { }') + ';\n' + original);
    assert.equal(m.prepareBaselineReview(f.root).declarations[0].rows.length, 1);
    for (const prefix of [
      '}\n',
      '(]\n',
      '/* unfinished\n',
      "'unfinished\\\n",
      'const ratio = 2 / 1;\n',
      'const regex = /x/;\n'
    ]) {
      f.put(file, prefix + original);
      assert.throws(() => m.prepareBaselineReview(f.root), /declaration/i);
    }
    f.put(file, 'function nested(){\n' + original + '}\n');
    assert.throws(() => m.prepareBaselineReview(f.root), /declaration/i);
  } finally {
    f.close();
  }
});

test('raw pin field order does not imply baseline drift or catalog demotion', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const reorder = pin => ({ sha256: pin.sha256, bytes: pin.bytes, path: pin.path });
    const file = 'tools/spritesheet-boundary.mjs',
      original = fs.readFileSync(path.join(f.root, file), 'utf8');
    f.put(
      file,
      original.replace(
        /const graphPins = .*;/,
        'const graphPins = ' + JSON.stringify([reorder(f.pin('packages/project/src/value.ts'))]) + ';'
      )
    );
    assert.equal(m.prepareBaselineReview(f.root).declarations[0].rows[0].identity, 'same');
    for (const item of Object.values(f.catalog.packages)) item.manifest = reorder(item.manifest);
    f.catalog.policy = f.catalog.policy.map(reorder);
    for (const row of f.catalog.tests) {
      row.file = reorder(row.file);
      row.support = row.support.map(reorder);
    }
    f.put('tools/incremental-test-catalog.json', JSON.stringify(f.catalog));
    assert.deepEqual(
      m.prepareCatalogReview(f.root).catalog.tests.map(x => x.packages),
      f.catalog.tests.map(x => x.packages)
    );
  } finally {
    f.close();
  }
});

test('complete graph proposals expose unlisted code separately from named successor rows', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'packages/project/dist/new.js';
    f.put(file, 'export {};\n');
    const p = m.prepareBaselineReview(f.root);
    assert.equal(p.graphCoverage.length, 3);
    for (const group of p.graphCoverage) {
      assert.ok(group.unlisted.some(pin => pin.path === file));
      assert.ok(group.baseBinding);
    }
    const successors = p.declarations.filter(x => x.binding.includes('Successor')).map(x => [x.owner, x.binding]);
    const historical = [
      ['tools/spritesheet-boundary.mjs', 'ss1AtlasGraphSuccessor'],
      ['tools/browser-png-boundary.mjs', 'atlasGraphSuccessor'],
      ...['tools/spritesheet-boundary.mjs', 'tools/browser-png-boundary.mjs', 'tools/atlas-import-boundary.mjs'].map(
        owner => [owner, 'm11WarmSubmissionGraphSuccessor']
      ),
      ...['tools/spritesheet-boundary.mjs', 'tools/browser-png-boundary.mjs', 'tools/atlas-import-boundary.mjs'].map(
        owner => [owner, 'm12IncrementalRenderingGraphSuccessor']
      ),
      ['tools/bitmap-binding-ticket-boundary.mjs', 'm12IncrementalOwnershipSuccessor']
    ];
    const shared = [
      ...['tools/spritesheet-boundary.mjs', 'tools/browser-png-boundary.mjs', 'tools/atlas-import-boundary.mjs'].map(
        owner => [owner, 'm13SharedRenderingGraphSuccessor']
      ),
      ...['tools/bitmap-resource-slot-boundary.mjs', 'tools/bitmap-binding-ticket-boundary.mjs'].map(owner => [
        owner,
        'm13InterfaceRawSuccessor'
      ])
    ];
    assert.deepEqual(
      successors.filter(([, binding]) => !binding.startsWith('m13')),
      historical
    );
    assert.deepEqual(
      successors.filter(([, binding]) => binding.startsWith('m13')),
      shared
    );
  } finally {
    f.close();
  }
});

test('additional JSON baselines retain boundary links, selectors and transformed history', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const p = m.prepareBaselineReview(f.root);
    assert.equal(p.policyLinks.length, 3);
    assert.ok(p.policyLinks.every(x => x.row.identity === 'same'));
    const rows = p.declarations.filter(x => x.owner === 'tools/bitmap-binding-ticket-policy.json');
    assert.equal(rows.length, 7);
    assert.equal(
      rows.find(x => x.binding === 'oldEngineDeclarationPin').comparison,
      'transformed-baseline-raw-observation'
    );
    assert.equal(p.declarations.find(x => x.binding === 'sourcePolicy.modules').rows.length, 1);
    assert.equal(m.verifyMaintenanceProposal(f.root, p), true);
  } finally {
    f.close();
  }
});

test('policy replacement is exposed as a link difference and invalidates old proposals', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const p = m.prepareBaselineReview(f.root),
      file = 'tools/bitmap-resource-slot-policy.json';
    f.put(file, fs.readFileSync(path.join(f.root, file), 'utf8') + '\n');
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/);
    assert.equal(
      m.prepareBaselineReview(f.root).policyLinks.find(x => x.owner === 'tools/bitmap-resource-slot-boundary.mjs').row
        .identity,
      'different'
    );
    const owner = 'tools/bitmap-resource-slot-boundary.mjs',
      ownerSource = fs.readFileSync(path.join(f.root, owner), 'utf8');
    f.put(
      owner,
      ownerSource.replace(
        /^const policyPin = .*;$/m,
        'const policyPin = ' + JSON.stringify(f.pin('tools/bitmap-binding-ticket-policy.json')) + ';'
      )
    );
    assert.throws(() => m.prepareBaselineReview(f.root), /policy.*path/i);
  } finally {
    f.close();
  }
});

test('policy schemas, duplicate JSON keys, duplicate paths and foreign owners fail closed', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'tools/bitmap-resource-slot-policy.json',
      raw = fs.readFileSync(path.join(f.root, file), 'utf8'),
      v = JSON.parse(raw);
    for (const changed of [
      raw.replace('"schemaVersion":1', '"schemaVersion":2'),
      raw.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
      JSON.stringify({ ...v, stableEntries: [...v.stableEntries, ...v.stableEntries] }),
      JSON.stringify({ ...v, stableEntries: [{ ...v.stableEntries[0], path: 'node_modules/external/index.js' }] })
    ]) {
      f.put(file, changed);
      assert.throws(() => m.prepareBaselineReview(f.root), /schema|Duplicate|owner/i);
    }
  } finally {
    f.close();
  }
});

test('Host pair observations distinguish base, current, neither and missing without admission', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const target = 'packages/engine/src/value.ts',
      original = fs.readFileSync(path.join(f.root, target));
    const historicalPairs = proposal => {
      const pairs = proposal.successorPairs.filter(row => row.binding === 'imageResidencySuccessors');
      assert.deepEqual(
        pairs.map(row => row.owner),
        ['tools/spritesheet-boundary.mjs', 'tools/browser-png-boundary.mjs']
      );
      assert.ok(pairs.every(row => row.rows.length === 1));
      return pairs;
    };
    let p = m.prepareBaselineReview(f.root);
    assert.equal(p.successorPairs.length, 7);
    assert.ok(historicalPairs(p).every(x => x.rows[0].identity === 'current'));
    f.put(target, '');
    p = m.prepareBaselineReview(f.root);
    assert.ok(historicalPairs(p).every(x => x.rows[0].identity === 'neither'));
    for (const owner of ['tools/spritesheet-boundary.mjs', 'tools/browser-png-boundary.mjs'])
      f.put(
        owner,
        fs
          .readFileSync(path.join(f.root, owner), 'utf8')
          .replace(
            '"base":{"bytes":0,"sha256":"' + '0'.repeat(64) + '"}',
            '"base":{"bytes":0,"sha256":"' + f.pin(target).sha256 + '"}'
          )
      );
    p = m.prepareBaselineReview(f.root);
    assert.ok(historicalPairs(p).every(x => x.rows[0].identity === 'base'));
    fs.unlinkSync(path.join(f.root, target));
    p = m.prepareBaselineReview(f.root);
    assert.ok(historicalPairs(p).every(x => x.rows[0].identity === 'missing'));
    f.put(target, original);
  } finally {
    f.close();
  }
});

test('raw reference index preserves every duplicate-owner declaration and pair branch', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const p = m.prepareBaselineReview(f.root),
      row = p.references.find(x => x.path === 'packages/engine/src/value.ts');
    assert.ok(
      row.references.some(
        x => x.owner === 'tools/bitmap-resource-slot-policy.json' && x.binding === 'oldEngineDeclarationPin'
      )
    );
    assert.ok(
      row.references.some(
        x => x.owner === 'tools/bitmap-binding-ticket-policy.json' && x.binding === 'selectedProductPins'
      )
    );
    assert.equal(row.references.filter(x => x.branch === 'base').length, 2);
    assert.equal(row.references.filter(x => x.branch === 'current').length, 2);
    assert.equal(
      row.references.find(x => x.binding === 'oldEngineDeclarationPin').comparison,
      'transformed-baseline-raw-observation'
    );
  } finally {
    f.close();
  }
});

test('excluded dependency payloads stay bound but are not read as repository pins', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'tests/types/atlas-import-diagnostic-expectations.json',
      v = JSON.parse(fs.readFileSync(path.join(f.root, file)));
    v.inputPins = [{ path: 'node_modules/not-installed/compiler', bytes: 0, sha256: '0'.repeat(64) }];
    v.sourcePolicy.jsoncPins = v.inputPins;
    f.put(file, JSON.stringify(v));
    const p = m.prepareBaselineReview(f.root);
    assert.ok(!p.inputs.some(x => x.path.includes('node_modules')));
    v.inputPins[0].bytes = 1;
    f.put(file, JSON.stringify(v));
    assert.throws(() => m.verifyMaintenanceProposal(f.root, p), /changed/);
  } finally {
    f.close();
  }
});

test('Host pairs refuse hidden path overrides, malformed arms and duplicate paths', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'tools/spritesheet-boundary.mjs',
      raw = fs.readFileSync(path.join(f.root, file), 'utf8'),
      pin = f.pin('packages/engine/src/value.ts'),
      arm = { bytes: pin.bytes, sha256: pin.sha256 },
      pair = { path: pin.path, base: arm, current: arm };
    const install = pairs =>
      f.put(
        file,
        raw.replace(
          /const imageResidencySuccessors = .*;/,
          'const imageResidencySuccessors = ' + JSON.stringify(pairs) + ';'
        )
      );
    for (const pairs of [
      [{ ...pair, base: { ...arm, path: pin.path } }],
      [{ ...pair, current: { bytes: -1, sha256: pin.sha256 } }],
      [pair, pair],
      [{ ...pair, path: 'work/private.ts' }]
    ]) {
      install(pairs);
      assert.throws(() => m.prepareBaselineReview(f.root), /arm|identity|Duplicate|owner/i);
    }
    install([pair]);
    assert.equal(m.prepareBaselineReview(f.root).successorPairs[0].rows[0].identity, 'both');
  } finally {
    f.close();
  }
});

test('JSON selectors fail closed and decode duplicate keys without losing literal content', async () => {
  const m = await maintenance(),
    f = baselineFixture();
  try {
    const file = 'tools/bitmap-binding-ticket-policy.json',
      raw = fs.readFileSync(path.join(f.root, file), 'utf8'),
      v = JSON.parse(raw);
    delete v.selectedProductPins;
    f.put(file, JSON.stringify(v));
    assert.throws(() => m.prepareBaselineReview(f.root), /selector/i);
    f.put(file, raw.replace('"schemaVersion":1', '"schemaVersion":1,"schema\\u0056ersion":1'));
    assert.ok(fs.readFileSync(path.join(f.root, file), 'utf8').includes('schema\\u0056ersion'));
    assert.throws(() => m.prepareBaselineReview(f.root), /Duplicate/i);
    const valid = JSON.parse(raw);
    valid.uninterpreted = {
      literal: 'escaped " \\ and { [ ] }',
      numeric: 1.5e-12,
      nested: [null, true, false, { unicode: '汉字' }]
    };
    f.put(file, JSON.stringify(valid));
    assert.equal(m.prepareBaselineReview(f.root).policyLinks.length, 3);
  } finally {
    f.close();
  }
});
