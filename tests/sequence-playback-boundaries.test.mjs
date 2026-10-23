// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync,
  rmSync, realpathSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

// First-party successor of tests/tween-boundaries.test.mjs's actual-copy scaffold.
// These source/emission controls do not execute private product behavior.
const seqpcRepository = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const seqpcGate = path.join(seqpcRepository, 'tools/sequence-playback-boundary.mjs');
const seqpcHash = bytes => createHash('sha256').update(bytes).digest('hex');
const seqpcSame = (left, right) => path.relative(left, right) === '';
const seqpcContains = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
const seqpcEnvironment = { ...process.env };
for (const key of Object.keys(seqpcEnvironment)) if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key)) delete seqpcEnvironment[key];
function seqpcCheck(args) {
  return spawnSync(process.execPath, [seqpcGate, ...args], {
    cwd: seqpcRepository, encoding: 'utf8', windowsHide: true,
    timeout: 30000, maxBuffer: 8 * 1024 * 1024, env: seqpcEnvironment,
  });
}
function seqpcAccepted(result) {
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stdout + result.stderr); assert.equal(result.stderr, '');
  assert.match(result.stdout, /^SEQP_BOUNDARY_PASS \{[^\n]+\}\n$/);
}
function seqpcRejected(result, code) {
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.equal(result.stdout, '');
  assert.match(result.stderr, new RegExp('^' + code + ': [^\\r\\n]+\\n$'));
}
function seqpcInventory(root) {
  const files = [];
  const visit = relative => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) { assert.ok(file.startsWith('node_modules/@egret/')); continue; }
      if (entry.isDirectory()) visit(file);
      else {
        assert.ok(entry.isFile());
        if (file === '.sequence-playback-policy-copy.json') continue;
        const bytes = readFileSync(path.join(root, file));
        files.push({ path: file, bytes: bytes.length, sha256: seqpcHash(bytes) });
      }
    }
  };
  visit(''); return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function seqpcIsolated(action) {
  const parentPath = path.join(tmpdir(), 'egret-sequence-playback-policy-controls');
  mkdirSync(parentPath, { recursive: true });
  const parent = realpathSync(parentPath);
  const fixture = realpathSync(mkdtempSync(path.join(parent, 'sequence-playback-policy-')));
  assert.ok(seqpcContains(parent, fixture)); assert.ok(seqpcSame(path.dirname(fixture), parent));
  const token = randomUUID(), sourceFiles = [];
  const copy = (source, relative) => {
    const target = path.join(fixture, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, filter: file => path.basename(file) !== 'node_modules' });
    const record = (original, copied) => {
      const stat = lstatSync(original);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(original)) if (entry !== 'node_modules') record(path.join(original, entry), copied + '/' + entry);
      } else {
        assert.ok(stat.isFile(), 'Actual copied evidence must be physical files');
        const bytes = readFileSync(original), copiedBytes = readFileSync(path.join(fixture, copied));
        assert.deepEqual(copiedBytes, bytes, 'Complete original file bytes copied: ' + copied);
        sourceFiles.push({ path: copied, source: realpathSync(original), bytes: bytes.length, sha256: seqpcHash(bytes) });
      }
    };
    record(source, relative);
  };
  let primary, cleanup;
  try {
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      copy(path.join(seqpcRepository, 'packages', name), 'packages/' + name);
      mkdirSync(path.join(fixture, 'node_modules/@egret'), { recursive: true });
      const copied = path.join(fixture, 'packages', name), link = path.join(fixture, 'node_modules/@egret', name);
      symlinkSync(copied, link, process.platform === 'win32' ? 'junction' : 'dir');
      assert.ok(seqpcSame(realpathSync(link), realpathSync(copied)));
    }
    for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
      ...readdirSync(seqpcRepository).filter(name => /^tsconfig.*\.json$/.test(name))]) copy(path.join(seqpcRepository, file), file);
    for (const name of ['jsonc-parser', 'robust-predicates']) {
      const require = createRequire(path.join(seqpcRepository, 'packages', name === 'jsonc-parser' ? 'project' : 'engine', 'package.json'));
      const entry = realpathSync(require.resolve(name));
      const installed = name === 'jsonc-parser' ? path.resolve(path.dirname(entry), '../..') : path.dirname(entry);
      copy(installed, 'node_modules/' + name);
      const pkg = JSON.parse(readFileSync(path.join(fixture, 'node_modules', name, 'package.json'), 'utf8'));
      assert.equal(pkg.name, name); assert.equal(pkg.version, name === 'jsonc-parser' ? '3.3.1' : '3.0.3');
    }
    copy(path.join(seqpcRepository, 'node_modules/typescript/package.json'), 'dependency-evidence/typescript-package.json');
    copy(seqpcGate, 'tools/sequence-playback-boundary.mjs');
    copy(path.join(seqpcRepository, 'tools/check-boundaries.mjs'), 'tools/check-boundaries.mjs');
    const baseline = seqpcInventory(fixture);
    const marker = { kind: 'GENUINE_SEQUENCE_PLAYBACK_POLICY_COPY', token,
      root: fixture, parent, sourceRoot: seqpcRepository, pins: baseline, sourceFiles };
    writeFileSync(path.join(fixture, '.sequence-playback-policy-copy.json'), JSON.stringify(marker) + '\n', { flag: 'wx' });
    const args = ['--root', fixture, '--owned-parent', parent, '--owner-token', token];
    const check = () => seqpcCheck(args);
    // Fresh complete genuine baseline precedes the single assigned mutation.
    seqpcAccepted(check());
    action({ fixture, check, baseline });
  } catch (cause) { primary = { cause }; }
  finally {
    try {
      const resolved = realpathSync(fixture);
      assert.ok(seqpcSame(resolved, fixture)); assert.ok(seqpcContains(parent, resolved));
      assert.ok(seqpcSame(path.dirname(resolved), parent)); assert.ok(path.basename(resolved).startsWith('sequence-playback-policy-'));
      for (const name of ['contracts', 'runtime', 'engine', 'project']) {
        const link = path.join(resolved, 'node_modules/@egret', name);
        if (existsSync(link)) {
          const target = realpathSync(link);
          assert.ok(seqpcContains(resolved, target));
          assert.ok(seqpcSame(target, realpathSync(path.join(resolved, 'packages', name))));
        }
      }
      rmSync(resolved, { recursive: true, force: false, maxRetries: 0 });
      assert.equal(existsSync(resolved), false);
    } catch (cause) { cleanup = { cause }; }
  }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'Controlled policy failure and owned cleanup failure');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}

test('SQP-P00 current built root satisfies the named source/emission policy', () => {
  seqpcAccepted(seqpcCheck(['--root', seqpcRepository]));
});
const seqpcControls = [
  { name: 'SQP-M21 content lock rejects unreviewed bytes', code: 'SEQP_BOUNDARY_PACKAGE_DAG',
    files: ['pnpm-lock.yaml'], append: '\n# unreviewed content lock\n' },
  { name: 'SQP-P01 root private-owner type leak', code: 'SEQP_BOUNDARY_PRIVATE_OWNER',
    files: ['packages/engine/src/index.ts', 'packages/engine/dist/index.d.ts'],
    append: "\nexport type { SequencePlaybackOwner } from './sequencePlayback.js';\n" },
  { name: 'SQP-P02 erased type module gains a runtime value', code: 'SEQP_BOUNDARY_TYPES_RUNTIME_VALUE',
    files: ['packages/engine/src/sequencePlaybackTypes.ts', 'packages/engine/dist/sequencePlaybackTypes.js'],
    append: '\nexport const sequencePlaybackPolicyRuntime = 1;\n' },
  { name: 'SQP-P03 runtime default root gains an Engine-only type', code: 'SEQP_BOUNDARY_NONROOT_TYPES',
    files: ['packages/runtime/src/index.ts', 'packages/runtime/dist/index.d.ts'],
    append: '\nexport interface SequencePlayback {}\n' },
  { name: 'SQP-P04 private controller samples an automatic wall clock', code: 'SEQP_BOUNDARY_AUTOMATIC_TIME',
    files: ['packages/engine/src/sequencePlayback.ts', 'packages/engine/dist/sequencePlayback.js'],
    append: '\nconst sequencePlaybackAutomaticPolicyWitness = Date.now();\n' },
];
for (const control of seqpcControls) test(control.name, t => seqpcIsolated(({ fixture, check, baseline }) => {
  const before = control.files.map(file => ({ file, bytes: readFileSync(path.join(fixture, file)) }));
  try {
    for (const item of before) writeFileSync(path.join(fixture, item.file), Buffer.concat([item.bytes, Buffer.from(control.append)]));
    const changed = seqpcInventory(fixture).filter((pin, index) => JSON.stringify(pin) !== JSON.stringify(baseline[index])).map(pin => pin.path);
    assert.deepEqual(changed.sort(), [...control.files].sort(), 'Only the paired assigned source/emission hunks changed');
    seqpcRejected(check(), control.code);
    t.diagnostic(control.code + ' is a source/emission copy refusal; no SDK or runtime behavior acceptance is inferred.');
  } finally {
    for (const item of before) writeFileSync(path.join(fixture, item.file), item.bytes);
    for (const item of before) assert.deepEqual(readFileSync(path.join(fixture, item.file)), item.bytes, 'Whole original file inverse');
    assert.deepEqual(seqpcInventory(fixture), baseline, 'Complete genuine snapshot restored');
    seqpcAccepted(check());
  }
}));

for(const [relative,code]of [
 ['packages/contracts/dist/index.d.ts','SEQP_BOUNDARY_DEFAULT_ENTRY_IDENTITY'],
 ['packages/engine/dist/Engine.d.ts','SEQP_BOUNDARY_ENGINE_METHOD'],
])test('SQP-M13 exact interface identity rejects one changed '+relative,()=>seqpcIsolated(({fixture,check,baseline})=>{
 const file=path.join(fixture,relative),before=readFileSync(file);
 try{
  writeFileSync(file,Buffer.concat([before,Buffer.from('\n// unregistered shared interface identity\n')]));
  const prior=new Map(baseline.map(row=>[row.path,row]));
  assert.deepEqual(seqpcInventory(fixture).filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),[relative]);
  seqpcRejected(check(),code);
 }finally{writeFileSync(file,before);assert.deepEqual(seqpcInventory(fixture),baseline);seqpcAccepted(check());}
}));
