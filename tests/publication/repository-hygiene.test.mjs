// SPDX-License-Identifier: Apache-2.0
// Tests the repository development gate, not Engine behavior or a text formatter.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync,
  realpathSync, rmSync, existsSync, unlinkSync,
} from 'node:fs';

const git = process.env.EGRET_TEST_GIT || 'git';
const baseMain = '863b29c90b92b62e37ce77cf32e02c4294135a16';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = Buffer.from('export const owned = true;\n');
const legacyBytes = Buffer.from('original legacy\r\n');
const binaryBytes = Buffer.from([0, 255, 13, 10, 128, 0, 10]);
const licenseBytes = Buffer.from('Original upstream license\r\n');

function put(root, relative, bytes) {
  assert.ok(relative && !relative.includes('\\') && !relative.includes(':'));
  assert.ok(relative.split('/').every(part => part && part !== '.' && part !== '..'));
  const destination = path.join(root, ...relative.split('/'));
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

function gitRead(root, args) {
  const result = spawnSync(git, args, {
    cwd: root, env: process.env, windowsHide: true, timeout: 60000, maxBuffer: 2000000,
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, 'FIXTURE_GIT_SIGNAL');
  assert.equal(result.status, 0,
    'FIXTURE_GIT_COMMAND_FAILED ' + JSON.stringify(args) + '\n'
    + result.stdout.toString('utf8') + result.stderr.toString('utf8'));
  return result.stdout;
}

function snapshot(root) {
  const rows = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      assert.equal(entry.isSymbolicLink(), false, 'FIXTURE_HAS_NO_SYMBOLIC_PAYLOAD');
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else {
        const bytes = readFileSync(file);
        rows.push({ path: path.relative(root, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  walk(root);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

/** Restore exact environment and remove only the freshly owned, verified temp tree. */
async function fixture(autocrlf, body) {
  const parent = path.join(tmpdir(), 'egret-repository-hygiene-regressions');
  mkdirSync(parent, { recursive: true });
  // Native resolution expands Windows 8.3 aliases, matching the asynchronous gate.
  // Ordinary realpathSync can preserve a short spelling of the same directory.
  const physicalParent = realpathSync.native(parent);
  const owner = realpathSync.native(mkdtempSync(path.join(physicalParent, 'case-')));
  const rootPath = path.join(owner, 'repo');
  const template = path.join(owner, 'empty-template');
  mkdirSync(rootPath); mkdirSync(template);
  const root = realpathSync.native(rootPath);
  const environment = {
    GIT_CONFIG_GLOBAL: path.join(owner, 'global.conf'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_COUNT: '0',
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_INDEX_FILE: undefined,
  };
  const previous = new Map(Object.keys(environment).map(name => [name, process.env[name]]));
  let primary, cleanup;
  try {
    writeFileSync(environment.GIT_CONFIG_GLOBAL, '[core]\n\tautocrlf = ' + autocrlf + '\n');
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    gitRead(root, ['init', '--initial-branch=main', '--template=' + template]);
    put(root, '.gitattributes', Buffer.from('* -text\n'));
    put(root, '.editorconfig', Buffer.from(
      'root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\n'
      + 'insert_final_newline = true\ntrim_trailing_whitespace = false\n',
    ));
    put(root, '.gitignore', Buffer.from('node_modules/\nwork/\npackages/*/dist/\n'));
    put(root, 'src/owned.ts', sourceBytes);
    put(root, 'legacy/original.txt', legacyBytes);
    put(root, 'assets/original.bin', binaryBytes);
    put(root, 'third-party/upstream.LICENSE', licenseBytes);
    const policy = {
      schemaVersion: 1, baseMain,
      legacyText: [{
        path: 'legacy/original.txt', bytes: legacyBytes.length,
        sha256: sha(legacyBytes), violations: ['CRLF'],
      }],
      preservedOriginals: [
        { path: 'assets/original.bin', bytes: binaryBytes.length, sha256: sha(binaryBytes) },
        { path: 'third-party/upstream.LICENSE', bytes: licenseBytes.length, sha256: sha(licenseBytes) },
      ],
    };
    put(root, 'verification/repository-hygiene-baseline.json', Buffer.from(JSON.stringify(policy, null, 2) + '\n'));
    gitRead(root, ['add', '--', '.']);
    gitRead(root, ['-c', 'user.name=Egret Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'owned fixture baseline']);
    // Recreate owned payloads through an actual Git checkout with the selected
    // global setting. Keep attributes present and never alter an external file.
    const checkoutPaths = [
      'src/owned.ts', 'legacy/original.txt',
      'assets/original.bin', 'third-party/upstream.LICENSE',
    ];
    for (const relative of checkoutPaths) unlinkSync(path.join(root, relative));
    gitRead(root, ['restore', '--worktree', '--', ...checkoutPaths]);
    // Independent setup proof runs before importing the new, possibly absent gate.
    assert.equal(gitRead(root, ['config', '--global', '--get', 'core.autocrlf']).toString('utf8').trim(), autocrlf);
    assert.equal(gitRead(root, ['config', '--get', 'core.autocrlf']).toString('utf8').trim(), autocrlf);
    assert.equal(gitRead(root, ['status', '--porcelain=v1', '-z', '-uall']).length, 0);
    for (const [relative, bytes] of [
      ['.gitattributes', Buffer.from('* -text\n')], ['src/owned.ts', sourceBytes],
      ['legacy/original.txt', legacyBytes], ['assets/original.bin', binaryBytes],
      ['third-party/upstream.LICENSE', licenseBytes],
    ]) {
      assert.deepEqual(readFileSync(path.join(root, relative)), bytes);
      assert.deepEqual(gitRead(root, ['show', 'HEAD:' + relative]), bytes);
    }
    console.log('HYGIENE_FIXTURE_NATIVE_BASELINE_PASS ' + JSON.stringify({ autocrlf, originalPayloads: 5, clean: true }));
    await body(root, policy);
  } catch (cause) { primary = { cause }; }
  try {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    const resolved = realpathSync.native(owner), relative = path.relative(physicalParent, resolved);
    assert.equal(resolved, owner);
    assert.equal(path.dirname(resolved), physicalParent);
    assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
    assert.ok(path.basename(resolved).startsWith('case-'));
    rmSync(resolved, { recursive: true, force: false });
    assert.equal(existsSync(resolved), false);
  } catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'HYGIENE_FIXTURE_AND_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}

async function loadGate() {
  // An absent module/export is a genuine intended pre-implementation RED.
  // Do not catch it or replace it with a passing assertion.
  const module = await import('../../tools/check-repository-hygiene.mjs');
  assert.equal(typeof module.checkRepositoryHygiene, 'function');
  return module.checkRepositoryHygiene;
}

async function inspect(gate, root, committed = false) {
  const before = snapshot(root);
  let value, primary, changed;
  try { value = await gate(root, { git, committed }); }
  catch (cause) { primary = { cause }; }
  try { assert.deepEqual(snapshot(root), before, 'READONLY_GATE_CHANGED_PAYLOAD'); }
  catch (cause) { changed = { cause }; }
  if (primary && changed) throw new AggregateError([primary.cause, changed.cause], 'HYGIENE_GATE_AND_PAYLOAD_MUTATION');
  if (changed) throw changed.cause;
  if (primary) throw primary.cause;
  for (const field of ['files', 'legacyPreserved', 'stagedCompared']) {
    assert.ok(Number.isSafeInteger(value[field]) && value[field] >= 0, 'COUNT_FIELD ' + field);
  }
  assert.ok(Array.isArray(value.issues));
  assert.ok(value.issues.every(issue => typeof issue === 'string'));
  return value;
}

function hasIssue(result, pattern) {
  assert.ok(result.issues.some(issue => pattern.test(issue)), JSON.stringify(result.issues));
}

for (const autocrlf of ['true', 'false']) {
  test('raw attributes preserve tracked bytes under isolated global autocrlf=' + autocrlf, { concurrency: false }, async () =>
    fixture(autocrlf, async root => {
      const gate = await loadGate();
      const normal = await inspect(gate, root);
      assert.deepEqual(normal.issues, []);
      assert.equal(normal.legacyPreserved, 1);
      const committed = await inspect(gate, root, true);
      assert.deepEqual(committed.issues, []);
      assert.ok(committed.stagedCompared >= 5);
      // Exercise the default only-staged-modified lane without checkout normalization.
      put(root, 'docs/new.md', Buffer.from('authored LF  \n'));
      gitRead(root, ['add', '--', 'docs/new.md']);
      assert.deepEqual(gitRead(root, ['show', ':docs/new.md']), Buffer.from('authored LF  \n'));
      const staged = await inspect(gate, root);
      assert.deepEqual(staged.issues, []);
      assert.ok(staged.stagedCompared >= 1);
    }));
}

for (const [name, bytes] of [
  ['CRLF', Buffer.from('new\r\n')],
  ['BOM', Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from('new\n')])],
  ['extra EOF blank line', Buffer.from('new\n\n')],
]) {
  test('visible untracked text rejects ' + name + ' after a legal baseline', { concurrency: false }, async () =>
    fixture('true', async root => {
      const gate = await loadGate();
      assert.deepEqual((await inspect(gate, root)).issues, []);
      put(root, 'docs/new.md', bytes);
      hasIssue(await inspect(gate, root), /docs\/new\.md/);
    }));
}

test('known source extensions cannot disguise NUL or malformed UTF8 as binary', { concurrency: false }, async () => {
  for (const bytes of [Buffer.from([101, 0, 10]), Buffer.from([255, 10])]) {
    await fixture('false', async root => {
      const gate = await loadGate();
      assert.deepEqual((await inspect(gate, root)).issues, []);
      put(root, 'src/new.ts', bytes);
      hasIssue(await inspect(gate, root), /src\/new\.ts/);
    });
  }
});

test('a legacy exception permits only its original complete bytes', { concurrency: false }, async () =>
  fixture('false', async root => {
    const gate = await loadGate();
    const baseline = await inspect(gate, root);
    assert.deepEqual(baseline.issues, []);
    assert.equal(baseline.legacyPreserved, 1);
    put(root, 'legacy/original.txt', Buffer.from('edited legacy\r\n'));
    hasIssue(await inspect(gate, root), /legacy\/original\.txt/);
    put(root, 'legacy/original.txt', legacyBytes);
    assert.deepEqual((await inspect(gate, root)).issues, []);
  }));

test('a matching basename never borrows another full-path legacy exception', { concurrency: false }, async () =>
  fixture('false', async root => {
    const gate = await loadGate();
    assert.deepEqual((await inspect(gate, root)).issues, []);
    put(root, 'docs/original.txt', legacyBytes);
    hasIssue(await inspect(gate, root), /docs\/original\.txt/);
  }));

test('a sealed binary original retains exact bytes independently of text rules', { concurrency: false }, async () =>
  fixture('true', async root => {
    const gate = await loadGate();
    assert.deepEqual((await inspect(gate, root)).issues, []);
    put(root, 'assets/original.bin', Buffer.from([0, 254, 13, 10, 128, 0, 10]));
    hasIssue(await inspect(gate, root), /assets\/original\.bin/);
    put(root, 'assets/original.bin', binaryBytes);
    assert.deepEqual((await inspect(gate, root)).issues, []);
  }));

test('staged bytes must equal current working bytes even when both texts are legal', { concurrency: false }, async () =>
  fixture('true', async root => {
    const gate = await loadGate();
    assert.deepEqual((await inspect(gate, root)).issues, []);
    const staged = Buffer.from('export const owned = 1;\n');
    put(root, 'src/owned.ts', staged);
    gitRead(root, ['add', '--', 'src/owned.ts']);
    assert.deepEqual((await inspect(gate, root)).issues, []);
    put(root, 'src/owned.ts', Buffer.from('export const owned = 2;\n'));
    const refused = await inspect(gate, root);
    hasIssue(refused, /src\/owned\.ts/);
    assert.deepEqual(gitRead(root, ['show', ':src/owned.ts']), staged);
  }));

test('committed mode requires a clean whole Git status, including legal untracked text', { concurrency: false }, async () => {
  for (const mutation of ['modified', 'untracked']) {
    await fixture('false', async root => {
      const gate = await loadGate();
      assert.deepEqual((await inspect(gate, root, true)).issues, []);
      put(root, mutation === 'modified' ? 'src/owned.ts' : 'docs/new.md', Buffer.from('legal changed text\n'));
      const status = gitRead(root, ['status', '--porcelain=v1', '-z', '-uall']);
      assert.ok(status.length > 0);
      assert.ok((await inspect(gate, root, true)).issues.length > 0);
    });
  }
});

test('fixed private and generated exclusions do not excuse visible invalid text', { concurrency: false }, async () =>
  fixture('false', async root => {
    const gate = await loadGate();
    assert.deepEqual((await inspect(gate, root)).issues, []);
    put(root, 'node_modules/ignored.ts', Buffer.from([255, 0, 13, 10]));
    put(root, 'work/ignored.md', Buffer.from('private\r\n'));
    put(root, 'packages/engine/dist/ignored.js', Buffer.from('generated\r\n'));
    assert.deepEqual((await inspect(gate, root)).issues, []);
    put(root, 'docs/visible.md', Buffer.from('visible\r\n'));
    hasIssue(await inspect(gate, root), /docs\/visible\.md/);
  }));
