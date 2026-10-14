// SPDX-License-Identifier: Apache-2.0
// Opt-in finite controller: physical copies only; all mutations stay in its stage.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const experimentKey = 'knowledge-base/experiments/spine-f2-core';
const helperKey = 'tools/lib/file-identity.mjs', helper = join(repository, helperKey);
const helperBytes = readFileSync(helper);
assert.equal(helperBytes.length, 5065);
assert.equal(createHash('sha256').update(helperBytes).digest('hex'), '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569');
const { canonicalTextBytes, fingerprintFile, logicalPath, ownerRelativePath, physicalPathKey, samePhysicalPath } = await import(pathToFileURL(helper).href);
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
assert.equal(args.length, 4, 'Usage: controls/run.mjs --spine-core <existing-package> --output <fresh-outside-repository>');
assert.equal(args[0], '--spine-core'); assert.equal(args[2], '--output');
const sdk = resolve(args[1]), output = resolve(args[3]);
physicalPathKey(sdk); physicalPathKey(output);

// All controls name fixed emitted blocks; no code generation or SDK patching.
const applyBlock = '    coreRead(owner, () => animation.apply(skeleton, -1, seconds, false, null, 1, MixFrom.setup, false, false, false));\n';
const rootBlock = '        coreRead(owner, () => APPLY(ROOT_ADD, root, [mesh]));\n';
const qualifyBlock = "        readyRead(owner, () => qualifyCore(profile, wrapper, atlas, data), 'F2C_CORE_COMPATIBILITY');\n";
const wrapperBlock = '            APPLY(WRAPPER_DISPOSE, wrapper, []);\n';
const auditAppend = '\n// Disposable-stage controlled-unit audit; never a published bridge API.\nexport const f2cTask4Audit = { token: Object.freeze(new Error("F2C_TASK4_PRIMARY_TOKEN")), secondary: Object.freeze(new Error("F2C_TASK4_SECONDARY_TOKEN")), events: [], applied: [], constructions: 0, primaryCount: 0, secondaryCount: 0, root: undefined, mesh: undefined };\n';
const controls = [
  { id: 'wrong-y', kind: 'mutant', file: 'geometry.js', blocks: [{
    before: '        positions[component + 1] = -y; // The sole Core-to-Egret Y inversion.\n',
    after: '        positions[component + 1] = y; // Controlled wrong-Y mutant.\n' }] },
  { id: 'omit-deform', kind: 'mutant', file: 'instance.js', blocks: [{ before: applyBlock,
    after: applyBlock + '    for (const slot of skeleton.slots) slot.pose.deform.length = 0; // Controlled omission after genuine apply.\n' }] },
  { id: 'post-apply', kind: 'unit', file: 'instance.js', blocks: [{ before: applyBlock,
    after: applyBlock + '    f2cTask4Audit.applied.push(seconds);\n    if (seconds === 0.75) coreRead(owner, () => { throw f2cTask4Audit.token; });\n' }] },
  { id: 'create-rollback', kind: 'unit', file: 'instance.js', blocks: [{ before: rootBlock,
    after: rootBlock + '        if (++f2cTask4Audit.constructions === 2) {\n            f2cTask4Audit.root = root; f2cTask4Audit.mesh = mesh;\n            coreRead(owner, () => { throw f2cTask4Audit.token; });\n        }\n' }] },
  { id: 'factory-cleanup', kind: 'unit', file: 'resources.js', blocks: [
    { before: qualifyBlock, after: "        readyRead(owner, () => {\n            qualifyCore(profile, wrapper, atlas, data);\n            if (++f2cTask4Audit.primaryCount === 1) { f2cTask4Audit.events.push('primary-after-qualification'); throw f2cTask4Audit.token; }\n        }, 'F2C_CORE_COMPATIBILITY');\n" },
    { before: wrapperBlock, after: wrapperBlock + "            if (++f2cTask4Audit.secondaryCount === 1) { f2cTask4Audit.events.push('wrapper-retired'); throw f2cTask4Audit.secondary; }\n" },
  ] },
];
const report = { kind: 'OPT_IN_F2C_CONTROL_RUN', status: 'NOT_ENTERED', laneCounts: { originalBaselines: 0, mutantChildren: 0, controlledUnits: 0 },
  lanes: [], controlSettlements: [], native: 'not_run', performance: 'not_accepted', rights: 'unverified', cleanup: 'not_created' };
let stage, marker, failed = false, outputOwned = false;
const recipes = [];
function errorEvidence(error, seen = new Set()) {
  if (error === null || typeof error !== 'object') return { value: String(error) };
  if (seen.has(error)) return { repeatedObject: true }; seen.add(error);
  return { name: error.name, code: error.code, message: error.message, stack: error.stack,
    cause: 'cause' in error ? errorEvidence(error.cause, seen) : null,
    cleanupErrors: Array.isArray(error.cleanupErrors) ? error.cleanupErrors.map(value => errorEvidence(value, seen)) : [] };
}
function contained(owner, target) {
  if (samePhysicalPath(owner, target)) return true;
  try { ownerRelativePath(owner, target); return true; } catch { return false; }
}
function regularOwner(owner) {
  assert.equal(lstatSync(owner).isSymbolicLink(), false); assert.equal(lstatSync(owner).isDirectory(), true);
  assert.equal(samePhysicalPath(owner, realpathSync(owner)), true, 'canonical physical directory required');
}
function inventory(owner, prefix = '') {
  regularOwner(owner); const rows = []; let bytes = 0;
  const visit = key => {
    const directory = key ? join(owner, key) : owner;
    assert.equal(lstatSync(directory).isSymbolicLink(), false); assert.ok(samePhysicalPath(directory, realpathSync(directory)));
    for (const name of readdirSync(directory).sort()) {
      const relative = logicalPath(key ? key + '/' + name : name), stat = lstatSync(join(owner, relative));
      assert.equal(stat.isSymbolicLink(), false, 'symbolic input refused');
      if (stat.isDirectory()) visit(relative);
      else {
        assert.ok(stat.isFile()); assert.equal(stat.nlink, 1, 'hard-linked input refused');
        const pin = fingerprintFile(owner, relative); rows.push(pin); bytes += pin.bytes;
        assert.ok(rows.length <= 8192 && bytes <= 536870912, 'bounded inventory');
      }
    }
  };
  if (prefix) {
    logicalPath(prefix); const stat = lstatSync(join(owner, prefix));
    if (stat.isFile()) { assert.equal(stat.nlink, 1); rows.push(fingerprintFile(owner, prefix)); }
    else { assert.equal(stat.isDirectory(), true); visit(prefix); }
  } else visit('');
  rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return rows;
}
function recipe(owner, prefix, destination, label) {
  const rows = inventory(owner, prefix); assert.ok(rows.length > 0); recipes.push({ owner, prefix, destination, label, rows });
}
function assertRawInputs() {
  for (const item of recipes) assert.deepEqual(inventory(item.owner, item.prefix), item.rows, 'original bytes drifted: ' + item.label);
}
function packageOwner(name, importer = import.meta.url) {
  const entry = realpathSync(createRequire(importer).resolve(name));
  let current = dirname(entry);
  for (let index = 0; index < 8; index++) {
    const metadata = join(current, 'package.json');
    if (existsSync(metadata) && JSON.parse(readFileSync(metadata, 'utf8')).name === name) return current;
    current = dirname(current);
  }
  throw new Error('EXISTING_PACKAGE_OWNER_REQUIRED: ' + name);
}
const save = (key, value) => writeFileSync(join(output, logicalPath(key)), canonicalTextBytes(JSON.stringify(value, null, 2)), { flag: 'wx' });
function child(id, file, childArgs) {
  const childCwd = stage, argv = [process.execPath, file, ...childArgs];
  const environment = { ...process.env }; delete environment.NODE_OPTIONS; delete environment.NODE_PATH;
  const result = spawnSync(process.execPath, argv.slice(1), { cwd: childCwd, env: environment, windowsHide: true, timeout: 180000, maxBuffer: 16777216 });
  const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
  const record = { id, argv, cwd: childCwd, deadlineMs: 180000, exitStatus: result.status, signal: result.signal,
    stdoutBase64: stdout.toString('base64'), stderrBase64: stderr.toString('base64'), error: result.error ? errorEvidence(result.error) : null };
  // Settlement and original streams precede every observation parse/assertion.
  report.lanes.push(record); save(id + '.child.json', record);
  writeFileSync(join(output, id + '.stdout.bin'), stdout, { flag: 'wx' }); writeFileSync(join(output, id + '.stderr.bin'), stderr, { flag: 'wx' });
  record.enteredRawFiles = []; record.observationParseFailures = [];
  if (file.endsWith('baseline.mjs') && existsSync(childArgs[3])) {
    record.enteredMainObservations = [];
    try {
      const names = readdirSync(childArgs[3]).filter(name => /^entered-F2C\d\d\.json$/.test(name)).sort();
      for (const name of names) {
        const rawKey = id + '.' + name + '.raw.bin';
        try {
          const raw = readFileSync(join(childArgs[3], name));
          writeFileSync(join(output, rawKey), raw, { flag: 'wx' }); record.enteredRawFiles.push(fingerprintFile(output, rawKey));
          record.enteredMainObservations.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)));
        } catch (error) { record.observationParseFailures.push({ sourceName: name, rawKey, failure: errorEvidence(error) }); }
      }
    } catch (error) { record.observationParseFailures.push({ phase: 'entered_directory_read', failure: errorEvidence(error) }); }
  }
  if (file.endsWith('fault.mjs') && existsSync(childArgs[3] + '.entered.json')) {
    const rawKey = id + '.entered.raw.bin';
    try {
      const raw = readFileSync(childArgs[3] + '.entered.json');
      writeFileSync(join(output, rawKey), raw, { flag: 'wx' }); record.enteredRawFiles.push(fingerprintFile(output, rawKey));
      record.enteredUnitObservation = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    } catch (error) { record.observationParseFailures.push({ rawKey, failure: errorEvidence(error) }); }
  }
  save(id + '.observations.json', { enteredRawFiles: record.enteredRawFiles, enteredMainObservations: record.enteredMainObservations,
    enteredUnitObservation: record.enteredUnitObservation, observationParseFailures: record.observationParseFailures });
  // Observation failure never replaces the original spawn error or settlement.
  if (result.error !== undefined) throw result.error;
  assert.equal(result.signal, null);
  record.actual = JSON.parse(stdout.toString('utf8')); save(id + '.actual.json', record.actual); assert.equal(stderr.length, 0);
  return record;
}
function completeBaseline(record, green) {
  const actual = record.actual;
  assert.equal(actual.typeLanes.length, 14); assert.equal(actual.prerequisite.id, 'F2C00');
  assert.equal(actual.namespace, 'PASS'); assert.equal(actual.actualMainEntered, 10); assert.equal(actual.mainCases.length, 10);
  assert.ok(actual.mainCases.every(row => row.timedOut === false));
  assert.equal(actual.status, green ? 'ACTUAL_CPU_GREEN' : 'ACTUAL_CPU_RED'); assert.equal(record.exitStatus, green ? 0 : 1);
  if (green) assert.ok(actual.mainCases.every(row => row.status === 'PASS'));
  else assert.equal(actual.mainCases.find(row => row.id === 'F2C03').status, 'FAIL', 'fixed literal oracle must kill mutant');
  assert.deepEqual(record.observationParseFailures, [], 'entered observation refusal is separate from child behavior');
}
function baseline(id, lane = 'original') {
  const record = child(id, join(stage, experimentKey, 'controls/baseline.mjs'), ['--lane', lane, '--output', join(output, id + '-observations')]);
  completeBaseline(record, lane === 'original');
  if (lane === 'original') report.laneCounts.originalBaselines++; else report.laneCounts.mutantChildren++;
  return record;
}
try {
  regularOwner(repository); regularOwner(sdk); assert.equal(existsSync(output), false); regularOwner(dirname(output));
  assert.equal(contained(repository, output), false); assert.equal(contained(sdk, output), false);
  mkdirSync(output); outputOwned = true; regularOwner(output);
  const manifest = JSON.parse(readFileSync(join(repository, experimentKey, 'manifest.json'), 'utf8'));
  for (const pin of manifest.sourceFiles) assert.deepEqual(fingerprintFile(join(repository, experimentKey), pin.path), pin);
  const sdkRows = inventory(sdk), sdkMetadata = JSON.parse(readFileSync(join(sdk, 'package.json'), 'utf8'));
  assert.equal(sdkMetadata.name, '@esotericsoftware/spine-core'); assert.equal(sdkMetadata.version, '4.3.13');
  assert.equal(sdkRows.length, 137);
  assert.equal(createHash('sha256').update(JSON.stringify(sdkRows.map(row => [row.path, row.bytes, row.sha256]))).digest('hex'), 'e3690c1f8fc3c2b8123bfcfe37d50d7f56878fbef8143fe5cd11d0cc97eaf0cf');
  report.existingCoreResolution = ownerRelativePath(sdk, realpathSync(require.resolve('@esotericsoftware/spine-core')));
  for (const key of ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.base.json', helperKey]) recipe(repository, key, key, key);
  for (const suffix of ['src', 'dist', 'assets', 'test', 'type-tests', 'tsconfig.json']) {
    const key = 'knowledge-base/experiments/spine-f2/' + suffix; recipe(repository, key, key, key);
  }
  // Existing opt-in node_modules aliases are resolved above, never traversed.
  for (const suffix of ['src', 'dist', 'assets', 'tests', 'type-tests', 'controls', 'tsconfig.json', 'manifest.json', 'case-ledger.json', 'run.mjs']) {
    const key = experimentKey + '/' + suffix; recipe(repository, key, key, key);
  }
  recipe(repository, 'knowledge-base/en/experiments/spine-f2-core/README.md', 'knowledge-base/en/experiments/spine-f2-core/README.md', 'knowledge-base/en/experiments/spine-f2-core/README.md');
  recipe(repository, 'knowledge-base/Cns/experiments/spine-f2-core/README.md', 'knowledge-base/Cns/experiments/spine-f2-core/README.md', 'knowledge-base/Cns/experiments/spine-f2-core/README.md');
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    const key = 'packages/' + name;
    for (const suffix of ['src', 'dist', 'package.json']) recipe(repository, key + '/' + suffix, key + '/' + suffix, key + '/' + suffix);
    recipe(repository, key + '/package.json', 'node_modules/@egret/' + name + '/package.json', '@egret/' + name + ' metadata');
    recipe(repository, key + '/dist', 'node_modules/@egret/' + name + '/dist', '@egret/' + name + ' public emission');
  }
  recipe(sdk, '', 'node_modules/@esotericsoftware/spine-core', 'supplied exact Core');
  for (const [name, version, importer] of [
    ['jsonc-parser', '3.3.1', pathToFileURL(join(repository, 'packages/project/package.json')).href],
    ['robust-predicates', '3.0.3', pathToFileURL(join(repository, 'packages/engine/package.json')).href],
    ['typescript', '7.0.2', import.meta.url],
  ]) {
    const owner = name === 'typescript' ? dirname(realpathSync(require.resolve('typescript/package.json'))) : packageOwner(name, importer);
    const metadata = JSON.parse(readFileSync(join(owner, 'package.json'), 'utf8'));
    assert.equal(metadata.name, name); assert.equal(metadata.version, version); assert.equal(contained(owner, output), false);
    recipe(owner, '', 'node_modules/' + name, name + ' fixed existing dependency');
  }
  const nativeName = '@typescript/typescript-win32-x64';
  const nativeOwner = dirname(realpathSync(require.resolve(nativeName + '/package.json')));
  const nativeMetadata = JSON.parse(readFileSync(join(nativeOwner, 'package.json'), 'utf8'));
  assert.equal(nativeMetadata.name, nativeName); assert.equal(nativeMetadata.version, '7.0.2');
  const nativeRows = inventory(nativeOwner);
  assert.equal(nativeRows.length, 113);
  assert.equal(createHash('sha256').update(JSON.stringify(nativeRows.map(row => [row.path, row.bytes, row.sha256]))).digest('hex'), '4d8aca01caac6c67f6ad0eebf2d828fe55cc960d2cbc72f8b8235046dd7b2b8b');
  assert.equal(contained(nativeOwner, output), false);
  recipe(nativeOwner, '', 'node_modules/' + nativeName, nativeName + ' fixed existing native compiler');
  save('original-inputs.before.json', recipes);
  stage = join(output, 'stage'); mkdirSync(stage); regularOwner(stage); marker = randomUUID();
  writeFileSync(join(stage, '.task4-owner.json'), canonicalTextBytes(JSON.stringify({ marker, output })), { flag: 'wx' });
  for (const item of recipes) for (const pin of item.rows) {
    assert.deepEqual(fingerprintFile(item.owner, pin.path), pin);
    const tail = item.prefix ? pin.path === item.prefix ? '' : pin.path.slice(item.prefix.length + 1) : pin.path;
    const targetKey = logicalPath(item.destination + (tail ? '/' + tail : '')), target = join(stage, targetKey);
    ownerRelativePath(stage, target); mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(item.owner, pin.path)), { flag: 'wx' });
    const copied = fingerprintFile(stage, targetKey); assert.equal(copied.bytes, pin.bytes); assert.equal(copied.sha256, pin.sha256);
    assert.equal(lstatSync(target).nlink, 1, 'copied stage regular file required');
  }
  const stageBefore = inventory(stage); save('stage.before.json', stageBefore); assertRawInputs();
  for (const control of controls) {
    const id = control.id; baseline(id + '-original-before'); assert.deepEqual(inventory(stage), stageBefore); assertRawInputs();
    const key = experimentKey + '/dist/' + control.file, file = join(stage, key), original = readFileSync(file);
    const originalText = new TextDecoder('utf-8', { fatal: true }).decode(original); let mutatedText = originalText;
    assert.ok(Buffer.from(originalText, 'utf8').equals(original), 'byte-exact emitted UTF-8 roundtrip');
    for (const block of control.blocks) {
      assert.equal(mutatedText.split(block.before).length, 2, 'one exact original block: ' + id);
      mutatedText = mutatedText.replace(block.before, block.after);
    }
    if (control.kind === 'unit') { assert.equal(mutatedText.includes('export const f2cTask4Audit'), false); mutatedText += auditAppend; }
    const mutated = Buffer.from(mutatedText, 'utf8');
    save(id + '-patch.json', { key, kind: control.kind, blocks: control.blocks, auditAppend: control.kind === 'unit' ? auditAppend : null,
      originalPin: fingerprintFile(stage, key), sourceChanged: false, thirdPartyChanged: false });
    writeFileSync(join(output, id + '-original.bin'), original, { flag: 'wx' });
    writeFileSync(join(output, id + '-mutated.bin'), mutated, { flag: 'wx' });
    let lanePrimary, laneFailed = false; const restorationErrors = [];
    try {
      ownerRelativePath(stage, file); writeFileSync(file, mutated);
      const expectedStage = stageBefore.map(pin => pin.path === key ? fingerprintFile(stage, key) : pin);
      assert.deepEqual(inventory(stage), expectedStage);
      if (control.kind === 'mutant') baseline(id + '-mutant', 'mutant');
      else {
        const record = child(id + '-unit', join(stage, experimentKey, 'controls/fault.mjs'), ['--fault', id, '--output', join(output, id + '-unit.json')]);
        assert.equal(record.exitStatus, 0); assert.equal(record.actual.status, 'ACTUAL_CONTROLLED_UNIT_GREEN');
        assert.deepEqual(record.observationParseFailures, [], 'entered observation refusal is separate from controlled unit');
        assert.equal(record.actual.actualControlledUnitsEntered, 1); assert.equal(record.actual.mainCasesEntered, 0); report.laneCounts.controlledUnits++;
      }
      assert.deepEqual(inventory(stage), expectedStage); assertRawInputs();
    } catch (error) { laneFailed = true; lanePrimary = error; }
    finally {
      const settlement = { id, primaryFailure: laneFailed ? errorEvidence(lanePrimary) : null, inverseVerified: false, restored: false, restoredBaseline: 'not_entered', restorationFailures: [] };
      try {
        let inverse = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
        if (control.kind === 'unit') { assert.ok(inverse.endsWith(auditAppend)); inverse = inverse.slice(0, -auditAppend.length); }
        for (const block of [...control.blocks].reverse()) {
          assert.equal(inverse.split(block.after).length, 2, 'one exact inverse block: ' + id); inverse = inverse.replace(block.after, block.before);
        }
        assert.ok(Buffer.from(inverse, 'utf8').equals(original), 'complete original byte inverse required'); settlement.inverseVerified = true;
      } catch (error) { restorationErrors.push(error); settlement.restorationFailures.push({ phase: 'inverse', failure: errorEvidence(error) }); }
      // Even an unexpected child/inverse failure must attempt the known original
      // restoration and its fresh fixture; primary and cleanup stay separate.
      try {
        fingerprintFile(stage, key); ownerRelativePath(stage, file); writeFileSync(file, original);
        assert.ok(readFileSync(file).equals(original)); assert.deepEqual(inventory(stage), stageBefore);
        settlement.restored = true; settlement.restoredPin = fingerprintFile(stage, key);
      } catch (error) { restorationErrors.push(error); settlement.restorationFailures.push({ phase: 'restore', failure: errorEvidence(error) }); }
      if (settlement.restored) try {
        baseline(id + '-original-after'); settlement.restoredBaseline = 'ACTUAL_COMPLETE_GREEN';
      } catch (error) { restorationErrors.push(error); settlement.restoredBaseline = 'FAILED'; settlement.restorationFailures.push({ phase: 'restored_baseline', failure: errorEvidence(error) }); }
      try { assertRawInputs(); }
      catch (error) { restorationErrors.push(error); settlement.restorationFailures.push({ phase: 'original_readback', failure: errorEvidence(error) }); }
      report.controlSettlements.push(settlement); save(id + '-restoration.json', settlement);
    }
    if (laneFailed || restorationErrors.length) {
      const failure = new Error('CONTROL_OR_RESTORATION_FAILED: ' + id, { cause: laneFailed ? lanePrimary : restorationErrors[0] });
      failure.cleanupErrors = laneFailed ? restorationErrors : restorationErrors.slice(1);
      throw failure;
    }
  }
  save('stage.after.json', inventory(stage)); assertRawInputs();
  report.status = 'ACTUAL_BOUNDED_CONTROLS_GREEN';
} catch (error) { failed = true; report.status = 'ACTUAL_BOUNDED_CONTROLS_RED'; report.failure = errorEvidence(error); }
finally {
  if (outputOwned && recipes.length) {
    try {
      const readback = recipes.map(item => ({ ...item, rows: inventory(item.owner, item.prefix) }));
      save('original-inputs.after.json', readback);
      assert.deepEqual(readback, recipes, 'all original source/emission/metadata/SDK bytes unchanged');
    } catch (error) { report.inputReadbackFailure = errorEvidence(error); failed = true; report.status = 'ACTUAL_BOUNDED_CONTROLS_RED'; }
  }
  if (stage && existsSync(stage)) {
    try {
      regularOwner(stage); assert.equal(dirname(stage), output); ownerRelativePath(output, stage);
      assert.equal(JSON.parse(readFileSync(join(stage, '.task4-owner.json'), 'utf8')).marker, marker);
      inventory(stage); assertRawInputs(); rmSync(stage, { recursive: true }); report.cleanup = 'owned_stage_removed';
    } catch (error) { report.cleanup = 'FAILED'; report.cleanupFailure = errorEvidence(error); failed = true; report.status = 'ACTUAL_BOUNDED_CONTROLS_RED'; }
  }
  if (outputOwned) save('report.json', report);
}
console.log(JSON.stringify({ status: report.status, laneCounts: report.laneCounts, output, cleanup: report.cleanup }));
if (failed) process.exitCode = 1;
