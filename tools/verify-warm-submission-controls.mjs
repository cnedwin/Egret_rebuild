// SPDX-License-Identifier: Apache-2.0
// Finite genuine-copy controls, following the owned package graph pattern in
// tests/asset-group-boundaries.test.mjs. No build, loader hook or product edit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {logicalPath, ownerRelativePath, samePhysicalPath, fingerprintFile, canonicalTextBytes} from './lib/file-identity.mjs';

const repository = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const packages = ['contracts', 'runtime', 'engine'];
const tests = [
  'tests/webgpu-submission-controls.test.mjs',
  'tests/webgpu-submission-reuse.test.mjs',
  'tests/webgpu-submission-reuse-lifecycle.test.mjs',
  'tests/webgpu-submission-precedence.test.mjs',
  'tests/webgpu-submission-preparation.test.mjs',
  'tests/webgpu-submission-buffer-private.test.mjs',
  'tests/webgpu-submission-binding-private.test.mjs',
  'tests/webgpu-submission-return-order.test.mjs',
];
const host = 'packages/engine/dist/web/WebGPUHost.js';
const binding = 'packages/engine/dist/web/webgpuBindingCache.js';
const controls = [
  {id: 'M1N1-cold-projection', file: 'packages/engine/dist/web/prepareTexturedSubmission2D.js',
    before: 'const pixels = residentViews.has(index) ? undefined : operations.copy(request.projectionPlan.views[index]);',
    after: 'const pixels = (residentViews.has(index) || index === 0) ? undefined : operations.copy(request.projectionPlan.views[index]);',
    test: tests[0], witness: '[M1N1] cold projection must materialize before submission',
    domain: 'Public SDK: a cold genuine textured frame must upload its projection.'},
  {id: 'M1N2-fence-alone', file: host,
    before: "outcomes.push(observed(this.fence()).catch(cause => { record.unsafe = true; throw this.fail('WEBGPU_QUEUE_FAILED', cause, 'frame', serial, true); }));",
    after: "outcomes.push(observed(this.fence()).then(() => { this.retire(record); }).catch(cause => { record.unsafe = true; throw this.fail('WEBGPU_QUEUE_FAILED', cause, 'frame', serial, true); }));",
    test: tests[0], witness: '[M1N2] unresolved scopes forbid reuse of the selected vertex buffer',
    domain: 'Public SDK: the same selected native vertex buffer reappears while original scopes remain unresolved.'},
  {id: 'M1N3-buffer-invalidation', file: binding,
    before: 'invalidateBuffer(identity) { invalidateDependents(buffers, identity); },',
    after: 'invalidateBuffer(identity) { void identity; },',
    test: tests[0], witness: '[M1N3] invalidation must remove the old complete-key searchable reference',
    domain: 'Private UNIT only: disabling the helper leaves an old complete-key binding searchable. Does not detect a missing Host call.'},
  {id: 'M1N4-texture-invalidation', file: binding,
    before: 'invalidateTexture(identity) { invalidateDependents(textures, identity); },',
    after: 'invalidateTexture(identity) { void identity; },',
    test: tests[0], witness: '[M1N4] invalidation must remove the old complete-key searchable reference',
    domain: 'Private UNIT only: disabling the helper leaves an old complete-key binding searchable. Does not detect a missing Host call.'},
  {id: 'M1N5-retiring-charge', file: host,
    before: 'record.retiring = true;',
    after: 'record.retiring = true;\n        this.pendingUploadBytes -= record.upload;\n        record.upload = 0;',
    test: tests[0], witness: '[M1N5] retiring upload charge must remain until cleanup returns',
    domain: 'Public SDK: cleanup reentry observes an illegally refunded pending upload charge.'},
  {id: 'M1N6-mixed-return-order', file: host,
    before: 'const leases = record.bufferLeases.filter((lease) => lease !== undefined);',
    after: 'const leases = record.bufferLeases.filter((lease) => lease !== undefined).sort((a, b) => Number(record.bufferPlan.matches.has(b.requestId)) - Number(record.bufferPlan.matches.has(a.requestId)));',
    test: tests[7], witness: 'request-order return makes earlier cold rectangle the oldest unmatched victim',
    domain: 'Public SDK: hits-first mixed lease return changes the actual FIFO native destruction victim.'},
];

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, canonicalTextBytes(JSON.stringify(value, null, 2)));
function collect(owner, relative) {
  logicalPath(relative);
  const physical = path.join(owner, relative), stat = fs.lstatSync(physical);
  assert.ok(!stat.isSymbolicLink(), 'snapshot inputs cannot be symbolic: ' + relative);
  if (stat.isFile()) return [relative];
  assert.ok(stat.isDirectory());
  return fs.readdirSync(physical).sort().flatMap(name => collect(owner, relative + '/' + name));
}
function isWithin(owner, target) {
  if (samePhysicalPath(owner, target)) return true;
  try { ownerRelativePath(owner, target); return true; } catch { return false; }
}
function makeOutput() {
  assert.equal(process.version, 'v26.7.0', 'use the repository pinned Node runtime');
  assert.deepEqual(process.argv.slice(2, 3), ['--output']);
  assert.equal(process.argv.length, 4, 'usage: node tools/verify-warm-submission-controls.mjs --output <new external directory>');
  const output = process.argv[3];
  // samePhysicalPath validates absolute Windows/POSIX spelling before resolve.
  assert.ok(samePhysicalPath(output, path.resolve(output)));
  const parent = path.dirname(output);
  assert.ok(fs.lstatSync(parent).isDirectory() && !fs.lstatSync(parent).isSymbolicLink());
  assert.ok(samePhysicalPath(parent, fs.realpathSync(parent)), 'output parent must have its own physical identity');
  assert.ok(!isWithin(repository, output), 'evidence must be outside the product checkout');
  assert.ok(!fs.existsSync(output), 'never overwrite an earlier result');
  fs.mkdirSync(output); return fs.realpathSync(output);
}


// No ambient loader or module-resolution path may change the observed SDK.
function verifiedEnvironment(execArgv, inherited) {
  assert.deepEqual(execArgv, [], 'CONTROL_NODE_PROFILE: added Node execution flags are forbidden');
  const environment = {...inherited};
  for (const key of Object.keys(environment)) if (/^(?:NODE_OPTIONS|NODE_PATH)$/i.test(key)) {
    assert.ok(environment[key] === undefined || environment[key] === '', 'CONTROL_NODE_PROFILE: nonempty ' + key + ' is forbidden');
    delete environment[key];
  }
  return environment;
}
function selfTestEnvironment() {
  let checks = 0;
  const check = action => { action(); checks++; };
  check(() => assert.deepEqual(verifiedEnvironment([], {KEEP: 'value'}), {KEEP: 'value'}));
  check(() => assert.throws(() => verifiedEnvironment(['--trace-warnings'], {}), /CONTROL_NODE_PROFILE/));
  for (const key of ['NODE_OPTIONS', 'node_options', 'Node_Options', 'NODE_PATH', 'node_path', 'Node_Path']) {
    check(() => assert.throws(() => verifiedEnvironment([], {[key]: 'unapproved'}), /CONTROL_NODE_PROFILE/));
    check(() => assert.deepEqual(verifiedEnvironment([], {[key]: '', KEEP: 'value'}), {KEEP: 'value'}));
    check(() => assert.deepEqual(verifiedEnvironment([], {[key]: undefined}), {}));
  }
  // Real entry refusals use benign Node options, never a preload or test hook.
  for (const selection of [
    {flags: ['--trace-warnings'], values: {}},
    {flags: [], values: {NODE_OPTIONS: '--stack-trace-limit=15'}},
    {flags: [], values: {NODE_PATH: repository}},
  ]) {
    const result = spawnSync(process.execPath, [...selection.flags, fileURLToPath(import.meta.url), '--self-test'], {
      cwd: repository, env: {...environment, ...selection.values}, encoding: 'utf8', windowsHide: true, timeout: 10000,
    });
    check(() => { assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, 1);
      assert.equal(result.stdout, ''); assert.match(result.stderr, /CONTROL_NODE_PROFILE/); });
  }
  console.log(JSON.stringify({status: 'UNIT_PASS', checks, controlsRun: false, outputCreated: false,
    scope: 'Finite outer-entry rejection and validated child-environment checks only.'}));
}
assert.equal(process.version, 'v26.7.0', 'use the repository pinned Node runtime');
const environment = verifiedEnvironment(process.execArgv, process.env);
if (process.argv.length === 3 && process.argv[2] === '--self-test') { selfTestEnvironment(); process.exit(0); }

const output = makeOutput();
const required = ['package.json', 'pnpm-lock.yaml', 'AGENTS.md', 'AGENTS.zh-CN.md',
  'tools/verify-warm-submission-controls.mjs', 'tools/lib/file-identity.mjs',
  'tests/fixtures/gpu-image-residency.mjs', ...tests];
for (const name of packages) {
  const entries = ['package.json', 'tsconfig.json', 'src', 'dist',
    ...(name === 'engine' ? ['web', 'rendering', 'tsconfig.web.json', 'tsconfig.rendering.json'] : [])];
  for (const entry of entries) required.push(...collect(repository, 'packages/' + name + '/' + entry));
}
const require = createRequire(path.join(repository, 'packages/engine/package.json'));
const dependency = fs.realpathSync(path.dirname(require.resolve('robust-predicates')));
assert.equal(JSON.parse(fs.readFileSync(path.join(dependency, 'package.json'), 'utf8')).version, '3.0.3');
const rows = [...new Set(required)].sort().map(relative => ({owner: repository, path: relative, target: relative}));
for (const name of fs.readdirSync(dependency).sort()) {
  for (const relative of collect(dependency, name)) rows.push({owner: dependency, path: relative, target: 'node_modules/robust-predicates/' + relative});
}
const snapshot = rows.map(row => ({...row, ...fingerprintFile(row.owner, row.path),
  raw: fs.readFileSync(path.join(row.owner, row.path))}));
for (const row of snapshot) assert.equal(sha(row.raw), row.sha256);
const manifest = snapshot.map(({raw, ...row}) => row);
writeJson(path.join(output, 'inputs.json'), {node: process.version, executable: process.execPath,
  executableSha256: sha(fs.readFileSync(process.execPath)), tests, files: manifest});
const report = {kind: 'bounded-emitted-sdk-controls', status: 'RUNNING', tests,
  limits: ['Controlled GPU ports are not native rendering or speed evidence.',
    'N3/N4 prove private helper searchable retention only; they cannot detect an omitted Host invalidation call.',
    'Sources and emissions are snapshotted, but this runner performs no build or source-to-emission equivalence proof.'],
  cases: []};
writeJson(path.join(output, 'result.json'), report);

function checkOriginals() {
  for (const row of snapshot) assert.deepEqual(fingerprintFile(row.owner, row.path),
    {path: row.path, bytes: row.bytes, sha256: row.sha256}, 'an original input changed: ' + row.path);
}
function checkLinks(copy) {
  for (const name of packages) {
    const alias = path.join(copy, 'node_modules/@egret', name), target = path.join(copy, 'packages', name);
    assert.ok(fs.lstatSync(alias).isSymbolicLink());
    assert.ok(samePhysicalPath(fs.realpathSync(alias), fs.realpathSync(target)), 'package alias must stay clone-owned');
    ownerRelativePath(copy, fs.realpathSync(alias));
  }
}
function checkCopy(copy, changed) {
  checkLinks(copy);
  for (const row of snapshot) {
    const current = fingerprintFile(copy, row.target);
    assert.equal(current.sha256, changed?.file === row.target ? changed.sha256 : row.sha256,
      'unexpected copied input change: ' + row.target);
  }
}
function createCopy(directory) {
  const copy = path.join(directory, 'copy'); fs.mkdirSync(copy);
  for (const row of snapshot) {
    const file = path.join(copy, logicalPath(row.target));
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, row.raw);
  }
  fs.mkdirSync(path.join(copy, 'node_modules/@egret'), {recursive: true});
  for (const name of packages) fs.symlinkSync(path.join(copy, 'packages', name), path.join(copy, 'node_modules/@egret', name), 'junction');
  return copy;
}
function run(copy, directory, phase, selected, changed) {
  checkOriginals(); checkCopy(copy, changed);
  const args = ['--test', '--test-reporter=tap', ...selected];
  const result = spawnSync(process.execPath, args, {cwd: copy, timeout: 30000,
    maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: environment});
  // Preserve raw child bytes, including every unsuccessful attempt.
  fs.writeFileSync(path.join(directory, phase + '.stdout.log'), result.stdout ?? Buffer.alloc(0));
  fs.writeFileSync(path.join(directory, phase + '.stderr.log'), result.stderr ?? Buffer.alloc(0));
  const text = (result.stdout ?? Buffer.alloc(0)).toString('utf8') + (result.stderr ?? Buffer.alloc(0)).toString('utf8');
  const summary = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => {
    const match = text.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'));
    return [key, match ? Number(match[1]) : null];
  }));
  const execution = {phase, args, status: result.status, signal: result.signal,
    error: result.error?.message, ...summary, stdoutSha256: sha(result.stdout ?? Buffer.alloc(0)),
    stderrSha256: sha(result.stderr ?? Buffer.alloc(0))};
  writeJson(path.join(directory, phase + '.json'), execution);
  checkOriginals(); checkCopy(copy, changed);
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.ok(summary.tests > 0); assert.equal(summary.cancelled, 0); assert.equal(summary.skipped, 0); assert.equal(summary.todo, 0);
  return {execution, text};
}
function healthy(result) {
  assert.equal(result.execution.status, 0, result.text);
  assert.equal(result.execution.fail, 0, result.text);
  assert.equal(result.execution.pass, result.execution.tests);
}

try {
  for (const control of controls) {
    const directory = path.join(output, control.id); fs.mkdirSync(directory);
    const copy = createCopy(directory), row = snapshot.find(value => value.target === control.file);
    const original = row.raw, source = original.toString('utf8');
    assert.equal(source.split(control.before).length - 1, 1, 'assigned control needs exactly one original anchor: ' + control.id);
    const mutant = Buffer.from(source.replace(control.before, control.after), 'utf8');
    assert.notEqual(sha(mutant), sha(original));
    const item = {...control, status: 'RUNNING', originalSha256: sha(original), mutantSha256: sha(mutant),
      replacements: 1, phases: []}; report.cases.push(item);
    writeJson(path.join(directory, 'mutation.json'), item);
    console.log(control.id + ': fresh complete healthy baseline');
    const baseline = run(copy, directory, 'baseline', tests); item.phases.push(baseline.execution); healthy(baseline);
    let mutationResult;
    try {
      fs.writeFileSync(path.join(copy, control.file), mutant);
      console.log(control.id + ': one assigned emitted mutation');
      mutationResult = run(copy, directory, 'mutant', [control.test], {file: control.file, sha256: sha(mutant)});
      item.phases.push(mutationResult.execution);
    } finally {
      fs.writeFileSync(path.join(copy, control.file), original);
      console.log(control.id + ': restored complete healthy run');
      const restored = run(copy, directory, 'restored', tests); item.phases.push(restored.execution); healthy(restored);
      assert.equal(restored.execution.tests, baseline.execution.tests);
    }
    assert.equal(mutationResult.execution.status, 1, mutationResult.text);
    assert.ok(mutationResult.execution.fail > 0, mutationResult.text);
    const failedBlocks = mutationResult.text.split('# Subtest:').filter(block =>
      /^not ok /m.test(block) && block.includes(control.witness));
    assert.equal(failedBlocks.length, 1, 'exactly the assigned semantic witness must fail: ' + control.id);
    assert.match(failedBlocks[0], /failureType: 'testCodeFailure'/);
    // Node may serialize native-object identity assertions as ERR_TEST_FAILURE.
    // The unique assertion message must still occur in its failed TAP block.
    assert.match(failedBlocks[0], /code: 'ERR_(?:ASSERTION|TEST_FAILURE)'/);
    item.semanticFailure = failedBlocks[0];
    assert.doesNotMatch(mutationResult.text, /ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNKNOWN_FILE_EXTENSION|SyntaxError:|ReferenceError:/,
      'import, syntax and reference failures never establish detection');
    item.status = 'DETECTED_AND_RESTORED'; writeJson(path.join(directory, 'result.json'), item);
    writeJson(path.join(output, 'result.json'), report);
  }
  checkOriginals(); report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = {message: error.message, stack: error.stack};
  throw error;
} finally { writeJson(path.join(output, 'result.json'), report); }
console.log('Warm submission controls PASS: ' + report.cases.length + ' separately baselined, detected and restored controls.');
