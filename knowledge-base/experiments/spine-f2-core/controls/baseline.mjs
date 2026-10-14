// SPDX-License-Identifier: Apache-2.0
// Fresh-process complete CPU fixtures. This child never builds or changes inputs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const experiment = fileURLToPath(new URL('../', import.meta.url));
const helper = join(repository, 'tools/lib/file-identity.mjs');
const helperBytes = readFileSync(helper);
assert.equal(helperBytes.length, 5065);
assert.equal(createHash('sha256').update(helperBytes).digest('hex'), '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569');
const { canonicalTextBytes, fingerprintFile, ownerRelativePath, samePhysicalPath } = await import(pathToFileURL(helper).href);
fingerprintFile(repository, '.task4-owner.json');
const owner = JSON.parse(readFileSync(join(repository, '.task4-owner.json'), 'utf8'));
assert.match(owner.marker, /^[0-9a-f-]{36}$/); assert.ok(samePhysicalPath(join(owner.output, 'stage'), repository));
assert.equal(process.argv.length, 6);
assert.equal(process.argv[2], '--lane');
assert.ok(['original', 'mutant'].includes(process.argv[3]));
assert.equal(process.argv[4], '--output');
const output = resolve(process.argv[5]);
ownerRelativePath(owner.output, output);
assert.throws(() => ownerRelativePath(repository, output), 'child observations must leave stage');
assert.equal(existsSync(output), false);
mkdirSync(output);
const save = (key, value) => writeFileSync(join(output, key), canonicalTextBytes(JSON.stringify(value, null, 2)), { flag: 'wx' });
const errorEvidence = (error, seen = new Set()) => {
  if (error === null || typeof error !== 'object') return { value: String(error) };
  if (seen.has(error)) return { repeatedObject: true };
  seen.add(error);
  return { name: error.name, code: error.code, message: error.message, stack: error.stack,
    cause: 'cause' in error ? errorEvidence(error.cause, seen) : null,
    cleanupErrors: Array.isArray(error.cleanupErrors) ? error.cleanupErrors.map(value => errorEvidence(value, seen)) : [] };
};
const report = { lane: process.argv[3], status: 'NOT_ENTERED', prerequisite: null, namespace: 'not_entered',
  typeLanes: [], actualMainEntered: 0, mainCases: [], native: 'not_run', performance: 'not_accepted', rights: 'unverified' };
let failed = false;
try {
  const lanes = JSON.parse(readFileSync(join(experiment, 'type-tests/negative-lanes.json'), 'utf8'));
  for (const lane of [{ file: 'positive.ts' }, ...lanes.lanes]) {
    const args = [join(experiment, 'type-tests/check-lane.mjs'), lane.file];
    const environment = { ...process.env }; delete environment.NODE_OPTIONS; delete environment.NODE_PATH;
    const child = spawnSync(process.execPath, args, { cwd: repository, env: environment, windowsHide: true, timeout: 60000, maxBuffer: 16777216 });
    const stdout = child.stdout ?? Buffer.alloc(0), stderr = child.stderr ?? Buffer.alloc(0);
    const row = { file: lane.file, argv: [process.execPath, ...args], exitStatus: child.status, signal: child.signal,
      stdoutBase64: stdout.toString('base64'), stderrBase64: stderr.toString('base64'), error: child.error ? errorEvidence(child.error) : null };
    report.typeLanes.push(row);
    save('type-' + lane.file + '.child.json', row);
    writeFileSync(join(output, 'type-' + lane.file + '.stdout.bin'), stdout, { flag: 'wx' });
    writeFileSync(join(output, 'type-' + lane.file + '.stderr.bin'), stderr, { flag: 'wx' });
    assert.equal(child.error, undefined); assert.equal(child.signal, null); assert.equal(stderr.length, 0);
    const actual = JSON.parse(stdout.toString('utf8')); row.actual = actual;
    const positive = lane.file === 'positive.ts';
    assert.equal(actual.compilerVersion, '7.0.2'); assert.equal(actual.collectorFailure, null);
    assert.equal(actual.temporaryConfigCleanup, 'removed'); assert.equal(child.status, positive ? 0 : 1);
    assert.equal(actual.cli.exitStatus, positive ? 0 : 1); assert.equal(actual.diagnosticTuples.length === 0, positive);
    assert.ok(actual.diagnosticTuples.every(tuple => tuple.file === ownerRelativePath(repository, join(experiment, 'type-tests', lane.file))));
    save('type-' + lane.file + '.json', row);
  }
  const fixture = await import('../tests/fixture.mjs');
  report.prerequisite = await fixture.boundedWait(fixture.prerequisites(), 'control original F2C00', 25000);
  assert.equal(report.prerequisite.id, 'F2C00'); assert.equal(report.prerequisite.mainBehaviorCasesExecuted, 0);
  save('prerequisite.json', report.prerequisite);
  const entry = await import('../dist/index.js');
  const checker = await import('../tests/namespace.mjs'); checker.namespace(entry); report.namespace = 'PASS';
  const { cpuCases } = await import('../tests/cpu.mjs');
  assert.deepEqual(cpuCases.map(row => row.id), Array.from({ length: 10 }, (_, index) => 'F2C' + String(index + 1).padStart(2, '0')));
  for (const test of cpuCases) {
    const started = performance.now(); report.actualMainEntered++;
    save('entered-' + test.id + '.json', { id: test.id, actualMainEntered: report.actualMainEntered, started });
    let error, caseFailed = false;
    try { await fixture.boundedWait(Promise.resolve().then(() => test.run()), test.id + ' control main', 30000); }
    catch (caught) { caseFailed = true; error = caught; }
    const row = { id: test.id, status: caseFailed ? 'FAIL' : 'PASS', timedOut: fixture.isObservationTimeout(error),
      error: caseFailed ? errorEvidence(error) : null, started, finished: performance.now() };
    report.mainCases.push(row); save(test.id + '.json', row);
    if (row.timedOut) break;
  }
  report.status = report.mainCases.some(row => row.status === 'FAIL') ? 'ACTUAL_CPU_RED' : 'ACTUAL_CPU_GREEN';
} catch (error) { failed = true; report.status = 'PREREQUISITE_REFUSAL'; report.failure = errorEvidence(error); }
save('report.json', report);
console.log(JSON.stringify(report));
if (failed || report.status !== 'ACTUAL_CPU_GREEN') process.exitCode = 1;
