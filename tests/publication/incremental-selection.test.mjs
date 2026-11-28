// SPDX-License-Identifier: Apache-2.0
// Real Git changes prove conservative selection across all contributor states.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as selector from '../../tools/check-incremental.mjs';
import { selectChecks } from '../../tools/check-incremental.mjs';
import { dependencyFixture, fixture } from '../helpers/incremental-fixtures.mjs';
test('existing reading edits alone select documentation feedback; no change still selects full', () => {
  const f = fixture();
  try {
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
    f.put('knowledge-base/en/docs/guide.md', '# Updated\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'documentation');
    f.git('add', '.');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'documentation');
    f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'docs');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'documentation');
    f.put('tools/example.mjs', 'throw Error("behavior changed");\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
  } finally {
    f.close();
  }
});
test('untracked inputs, metadata, policy, deletion and rename never reduce checks', () => {
  const f = fixture();
  try {
    f.put('README.md', '# Updated\n');
    for (const file of [
      'unknown.txt',
      'knowledge-base/en/docs/new.md',
      'source-origin.json',
      'AGENTS.md',
      'package.json',
      '.github/workflows/check.yml'
    ]) {
      f.put(file, 'changed\n');
      assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full', file);
      fs.unlinkSync(path.join(f.root, file));
    }
    f.git('mv', 'knowledge-base/en/docs/guide.md', 'knowledge-base/en/docs/renamed.md');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
  } finally {
    f.close();
  }
});
test('unrelated or malformed base cannot authorize reduced checks', () => {
  const f = fixture();
  try {
    assert.throws(() => selectChecks(f.root, { base: '--all' }));
    assert.throws(() => selectChecks(f.root, { base: 'missing' }));
    f.git('switch', '--orphan', 'foreign');
    f.put('foreign', 'x');
    f.git('add', '.');
    f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'foreign');
    assert.throws(() => selectChecks(f.root, { base: f.base }), /ancestor/);
  } finally {
    f.close();
  }
});

test('opposing index/worktree and commit/index edits cannot cancel a risky change', () => {
  const f = fixture();
  try {
    f.put('tools/example.mjs', 'throw Error("staged behavior");\n');
    f.git('add', 'tools/example.mjs');
    f.put('tools/example.mjs', 'export {};\n');
    f.put('README.md', '# Reading edit\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
    f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'staged change');
    f.git('add', 'tools/example.mjs');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
  } finally {
    f.close();
  }
});

test('package changes propagate to reverse dependents and retain shared tests', () => {
  const f = dependencyFixture();
  try {
    for (const [name, affected, wanted] of [
      ['engine', ['engine'], ['engine', 'shared']],
      ['runtime', ['engine', 'runtime'], ['engine', 'runtime', 'shared']],
      ['project', ['project'], ['project', 'shared']]
    ]) {
      const file = 'packages/' + name + '/src/value.ts',
        original = fs.readFileSync(path.join(f.root, file));
      f.put(file, 'export const value = 2;\n');
      const p = selectChecks(f.root, { base: f.base });
      assert.equal(p.profile, 'dependency');
      assert.deepEqual(p.affectedPackages, affected);
      assert.deepEqual(
        p.selectedTests,
        wanted.map(x => 'tests/' + x + '.test.mjs')
      );
      assert.ok(p.omittedTests.length > 0);
      fs.writeFileSync(path.join(f.root, file), original);
    }
    f.put('packages/contracts/src/value.ts', 'export const value = 2;\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full', 'shared contracts affect every package');
  } finally {
    f.close();
  }
});

test('dependency feedback refuses stale ownership, test bytes and incomplete membership', () => {
  const f = dependencyFixture();
  try {
    f.put('packages/project/src/value.ts', 'export const value = 2;\n');
    f.git('update-index', '--assume-unchanged', 'tests/engine.test.mjs');
    f.put('tests/engine.test.mjs', 'throw Error("changed omitted test");\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
    f.put('tests/engine.test.mjs', 'export {};\n');
    f.git('update-index', '--no-assume-unchanged', 'tests/engine.test.mjs');
    f.put('tests/new.test.mjs', 'export {};\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
    fs.unlinkSync(path.join(f.root, 'tests/new.test.mjs'));
    f.git('update-index', '--assume-unchanged', 'packages/engine/package.json');
    f.put(
      'packages/engine/package.json',
      JSON.stringify({ name: '@egret/engine', dependencies: { '@egret/project': 'workspace:*' } })
    );
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
  } finally {
    f.close();
  }
});

test('source selection includes all Git layers and rejects configuration and new source', () => {
  const f = dependencyFixture();
  try {
    f.put('packages/engine/src/value.ts', 'export const value = 2;\n');
    f.git('add', 'packages/engine/src/value.ts');
    f.put('packages/engine/src/value.ts', 'export const value = 3;\n');
    f.put('packages/project/src/value.ts', 'export const value = 2;\n');
    let p = selectChecks(f.root, { base: f.base });
    assert.equal(p.profile, 'dependency');
    assert.deepEqual(p.affectedPackages, ['engine', 'project']);
    assert.ok(p.changes.some(x => x.layer === 'staged'));
    assert.ok(p.changes.some(x => x.layer === 'working'));
    f.put('packages/project/src/new.ts', 'export {};\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
    fs.unlinkSync(path.join(f.root, 'packages/project/src/new.ts'));
    f.put('tsconfig.json', '{}\n');
    assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
  } finally {
    f.close();
  }
});

test('dependency feedback builds current code and checks boundaries before selected behavior', () => {
  const commands = selector.feedbackCommands({ profile: 'dependency', selectedTests: ['tests/project.test.mjs'] });
  const position = name => commands.findIndex(args => args.includes(name));
  for (const name of [
    'tools/doctor.mjs',
    'tools/check-repository-hygiene.mjs',
    'tools/build.mjs',
    'tools/check-boundaries.mjs',
    'tests/project.test.mjs'
  ])
    assert.notEqual(position(name), -1, name);
  assert.ok(position('tools/build.mjs') < position('tools/check-boundaries.mjs'));
  assert.ok(position('tools/check-boundaries.mjs') < position('tests/project.test.mjs'));
  assert.equal(position('tools/test.mjs'), -1);
  assert.equal(position('tools/prepush.mjs'), -1);
  assert.equal(position('tools/check-types.mjs'), -1, 'historical type admission belongs to merge checks');
});

test('hidden worktree and sparse-index flags cannot omit another changed package', () => {
  const f = dependencyFixture();
  try {
    f.put('packages/engine/src/value.ts', 'export const value = 2;\n');
    for (const [set, unset] of [
      ['--assume-unchanged', '--no-assume-unchanged'],
      ['--skip-worktree', '--no-skip-worktree']
    ]) {
      f.git('update-index', set, 'packages/project/src/value.ts');
      f.put('packages/project/src/value.ts', 'export const value = 3;\n');
      assert.equal(selectChecks(f.root, { base: f.base }).profile, 'full');
      f.git('update-index', unset, 'packages/project/src/value.ts');
    }
  } finally {
    f.close();
  }
});

test('feedback identity binds raw worktree bytes and opposing index content', () => {
  const f = dependencyFixture();
  try {
    const a = selector.feedbackIdentity(f.root);
    f.put('packages/engine/src/value.ts', 'export const value = 2;\n');
    const b = selector.feedbackIdentity(f.root);
    assert.notEqual(a, b);
    f.git('add', 'packages/engine/src/value.ts');
    const c = selector.feedbackIdentity(f.root);
    assert.notEqual(b, c);
    f.put('packages/engine/src/value.ts', 'export const value = 1;\n'.replace('\\n', '\n'));
    assert.notEqual(a, selector.feedbackIdentity(f.root));
  } finally {
    f.close();
  }
});

test('accepted runner schedule changes invalidate the earlier dependency catalog', () => {
  const f = dependencyFixture();
  try {
    f.put('tools/verify.mjs', 'throw Error("new mandatory lane");\n');
    f.git('add', 'tools/verify.mjs');
    f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'new gate');
    const base = f.git('rev-parse', 'HEAD');
    f.put('packages/project/src/value.ts', 'export const value = 2;\n');
    assert.equal(selectChecks(f.root, { base }).profile, 'full');
  } finally {
    f.close();
  }
});

test('unbound example-import test closures remain shared in the current catalog', () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/incremental-test-catalog.json', import.meta.url)));
  for (const name of [
    'prepared-outfit-coordinator-heldout',
    'resource-scene-session',
    'resource-scene-session-heldout'
  ]) {
    const row = catalog.tests.find(x => x.file.path === 'tests/' + name + '.test.mjs');
    assert.equal(row.packages, null, name);
  }
});

test('execution binding refuses a package change after initial selection', () => {
  const f = dependencyFixture();
  try {
    f.put('packages/project/src/value.ts', 'export const value = 2;\n');
    const plan = selectChecks(f.root, { base: f.base });
    assert.equal(typeof selector.bindFeedback, 'function');
    assert.equal(typeof selector.bindFeedback(f.root, plan), 'string');
    f.put('packages/engine/src/value.ts', 'export const value = 3;\n');
    assert.throws(() => selector.bindFeedback(f.root, plan), /selection changed/i);
  } finally {
    f.close();
  }
});

test('conservative fallback runs all behavior without recursively invoking merge admission', () => {
  const commands = selector.feedbackCommands({ profile: 'full' });
  assert.ok(commands.some(args => args.includes('tools/test.mjs')));
  for (const name of [
    'tools/prepush.mjs',
    'tools/verify.mjs',
    'tools/spritesheet-boundary.mjs',
    'tools/check-types.mjs'
  ])
    assert.ok(!commands.some(args => args.includes(name)), name);
  assert.throws(() => selector.feedbackCommands({ profile: 'unknown' }));
  assert.throws(() => selector.feedbackCommands({ profile: 'dependency', selectedTests: [] }));
});

test('documentation feedback keeps publication and read-only knowledge-base checks without compilation', () => {
  const commands = selector.feedbackCommands({ profile: 'documentation' });
  assert.ok(commands.some(args => args.includes('tools/check-publication.mjs') && args.includes('--contribution')));
  assert.ok(
    commands.some(
      args => args.includes('knowledge-base/tools/Validate-KnowledgeBase.ps1') && args.includes('-CheckOnly')
    )
  );
  assert.ok(!commands.some(args => args.includes('tools/build.mjs') || args.includes('tools/test.mjs')));
});
