// SPDX-License-Identifier: Apache-2.0
// Opt-in original manual and Clock F1 evidence runner. Existing dependencies stay
// untouched; only fresh external first-party scratch files may be changed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
const here = path.dirname(self);
const checkout = path.resolve(here, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalized = file => {
  const value = path.resolve(file).replaceAll('\\', '/');
  return process.platform === 'win32' ? value.toLowerCase() : value;
};
const within = (parent, file) => {
  const relative = path.relative(normalized(parent), normalized(file));
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
};
const intersect = (a, b) => within(a, b) || within(b, a);
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const row = file => { const bytes = fs.readFileSync(file); return { path: file, bytes: bytes.length, sha256: hash(bytes) }; };
let publicManifestPin;
class Incomplete extends Error { constructor(message, options) { super(message, options); this.name = 'Incomplete'; } }
class SubsetFailure extends Error { constructor(message, options) { super(message, options); this.name = 'SubsetFailure'; } }
function need(condition, message) { if (!condition) throw new Incomplete(message); }
function checkPin(pin, base) {
  const file = base === undefined ? pin.path : path.resolve(base, pin.path);
  const actual = row(file);
  need(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, `Input identity changed: ${file}`);
}
function regular(file) { const stat = fs.lstatSync(file); need(stat.isFile() && !stat.isSymbolicLink(), `Regular file required: ${file}`); }
function walk(root, relative = '') {
  const file = path.join(root, relative), stat = fs.lstatSync(file);
  need(!stat.isSymbolicLink(), `Nested links are not admitted: ${file}`);
  if (stat.isDirectory()) return fs.readdirSync(file).sort().flatMap(name => walk(root, path.join(relative, name)));
  need(stat.isFile(), `Unsupported file type: ${file}`);
  return [{ relative: relative.replaceAll('\\', '/'), ...row(file) }];
}
function content(root) {
  const rows = walk(root).sort((a, b) => a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0);
  return { rows, digest: hash(Buffer.from(JSON.stringify(rows.map(item => [item.relative, item.bytes, item.sha256])))) };
}
function noLinksToExisting(file) {
  const absolute = path.resolve(file), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current)) need(!fs.lstatSync(current).isSymbolicLink(), `Output ancestry contains a link: ${current}`);
  }
}
function safeAbsolute(file) {
  need(typeof file === 'string' && path.isAbsolute(file), 'An absolute path is required.');
  const tail = file.slice(path.parse(file).root.length);
  need(!tail.split(/[\\/]/).some(part => part === '.' || part === '..' ||
    /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),
  'Unsafe path component.');
}
function freshOutput(file, excluded) {
  safeAbsolute(file); noLinksToExisting(path.dirname(file));
  need(fs.lstatSync(file, { throwIfNoEntry: false }) === undefined, 'Output must not already exist, including a broken link.');
  const parent = fs.realpathSync(path.dirname(file));
  need(fs.statSync(parent).isDirectory(), 'Output parent must be an existing directory.');
  const target = path.join(parent, path.basename(file));
  for (const input of excluded) need(!intersect(target, input), 'Output intersects an input directory.');
  return target;
}
function parseCLI(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    need(['--spine-core', '--output', '--webgpu', '--playwright'].includes(flag), `Unknown option: ${flag}`);
    const key = flag.slice(2); need(result[key] === undefined, `Duplicate option: ${flag}`);
    if (flag === '--webgpu') result[key] = true;
    else { const value = args[++index]; need(value !== undefined && !value.startsWith('--'), `Missing value: ${flag}`); result[key] = value; }
  }
  need(result['spine-core'] !== undefined && result.output !== undefined, '--spine-core and --output are required.');
  need(Boolean(result.webgpu) === Boolean(result.playwright), '--webgpu and --playwright must be supplied together.');
  return result;
}
function help() {
  console.log(`Original manual/Clock F1 opt-in experiment (no install or download)
Prerequisites: normal repository build; Node 24.19.0; clone TypeScript 7.0.2;
an already acquired official @esotericsoftware/spine-core@4.3.13 outside this clone.
node knowledge-base/experiments/spine-f1/run.mjs --spine-core <absolute package directory> --output <fresh absolute external directory>
Optional: --webgpu --playwright <absolute existing Playwright index.mjs import entry>
Every retry needs a fresh output. CPU: original manual12/six controls plus Clock10/three assigned controls.
Clock10 executes its own named owned fault; bootstrap9/pending is separately labeled.
Exit 0 PASS_F1_CPU_SUBSET; 1 FAIL_F1_CPU_SUBSET; 2 INCOMPLETE;
3 UNSUPPORTED_DEFAULT_ENVIRONMENT for an explicitly requested native successor.
CPU port execution is not GPU pixels, full Spine, devices or performance evidence.
Integration/distribution qualification remains unverified; external input is not an exemption.
https://esotericsoftware.com/spine-runtimes-license
https://esotericsoftware.com/spine-editor-license#s2
https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/README.md
https://esotericsoftware.com/spine-purchase`);
}
function packageExport(packageRoot, key) {
  const metadata = json(path.join(packageRoot, 'package.json'));
  const exported = metadata.exports?.[key];
  const entry = typeof exported === 'string' ? exported : exported?.import;
  const types = typeof exported === 'object' && exported !== null ? exported.types : metadata.types;
  need(typeof entry === 'string' && entry.startsWith('./') && typeof types === 'string', 'Built public export/declaration is missing.');
  const entryFile = path.resolve(packageRoot, entry), typesFile = path.resolve(packageRoot, types);
  need(within(packageRoot, entryFile) && within(packageRoot, typesFile), 'Public export escapes its package.');
  regular(entryFile); regular(typesFile);
  return entryFile;
}
function packageByName(from, name, version) {
  const require = createRequire(path.join(from, 'package.json'));
  let directory = path.dirname(require.resolve(name));
  for (;;) {
    const metadata = path.join(directory, 'package.json');
    if (fs.existsSync(metadata)) {
      const value = json(metadata);
      if (value.name === name) { need(value.version === version, `Wrong dependency version: ${name}`); return fs.realpathSync(directory); }
    }
    const next = path.dirname(directory); need(next !== directory, `Dependency package root missing: ${name}`); directory = next;
  }
}
function snapshotSDK(manifest) {
  const rows = [], roots = {};
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    const root = path.join(checkout, 'packages', name);
    need(normalized(fs.realpathSync(root)) === normalized(root), 'First-party package root must belong to this clone.');
    const metadata = json(path.join(root, 'package.json')); need(metadata.name === `@egret/${name}`, 'Genuine first-party package name required.');
    roots[name] = root;
    for (const item of [...walk(root, 'package.json'), ...walk(root, 'src'), ...walk(root, 'dist')]) {
      rows.push({ path: path.relative(checkout, item.path).replaceAll('\\', '/'), bytes: item.bytes, sha256: item.sha256 });
    }
  }
  for (const root of Object.values(roots)) {
    const metadata = json(path.join(root, 'package.json'));
    for (const name of Object.keys(metadata.dependencies ?? {}).filter(name => name.startsWith('@egret/'))) {
      const expected = roots[name.slice('@egret/'.length)];
      need(expected !== undefined, 'Unadmitted first-party dependency.');
      let directory = root, resolved;
      for (;;) {
        const candidate = path.join(directory, 'node_modules', name);
        if (fs.existsSync(candidate)) { resolved = fs.realpathSync(candidate); break; }
        const parent = path.dirname(directory); if (parent === directory) break; directory = parent;
      }
      need(resolved !== undefined && normalized(resolved) === normalized(expected), 'First-party transitive dependency belongs to another clone.');
      packageExport(expected, '.');
    }
  }
  const engineEntry = packageExport(roots.engine, '.'), spinePlanningEntry = packageExport(roots.project, './spine');
  const helperEntry = path.join(checkout, 'tests/helpers.mjs'); checkPin({ ...manifest.helper, path: helperEntry });
  const files = [row(helperEntry)], dependencies = [];
  for (const [owner, name, version] of [['engine', 'robust-predicates', '3.0.3'], ['project', 'jsonc-parser', '3.3.1']]) {
    const root = packageByName(roots[owner], name, version), inventory = content(root);
    files.push(...inventory.rows.map(({ relative, ...item }) => item));
    dependencies.push({ name, version, root, contentDigestSHA256: inventory.digest });
  }
  return { schemaVersion: 1, kind: 'CURRENT_CLONE_BUILT_PUBLIC_INPUTS', historicalTreeBinding: false,
    root: checkout, engineURL: pathToFileURL(engineEntry).href, projectSpineURL: pathToFileURL(spinePlanningEntry).href,
    engineEntry, spinePlanningEntry, helperEntry, rows, files, packageRoots: roots, dependencies,
    scope: 'Current source/dist/export/dependency identities; no Git tree binding or historical-result substitution.' };
}
function originalInputs(manifest, core, compiler, sdk) {
  if (publicManifestPin !== undefined) checkPin(publicManifestPin);
  for (const pin of manifest.files) checkPin(pin, checkout);
  for (const pin of [...compiler.files, ...sdk.files]) checkPin(pin);
  for (const pin of sdk.rows) checkPin(pin, checkout);
  need(hash(Buffer.from(JSON.stringify(snapshotSDK(manifest)))) === hash(Buffer.from(JSON.stringify(sdk))),
    'Current SDK/dependency source and dist inventory drifted.');
  need(content(compiler.root).digest === compiler.contentDigestSHA256, 'Compiler content inventory drifted.');
  const observedCore = content(core.root);
  need(observedCore.rows.length === manifest.core.regularFileCount && observedCore.digest === manifest.core.contentDigestSHA256,
    'Official core content envelope changed.');
  return { publicFiles: manifest.files.length, sdkSourceAndDistFiles: sdk.rows.length,
    dependenciesAndHelperFiles: sdk.files.length, coreFiles: observedCore.rows.length,
    coreContentDigestSHA256: observedCore.digest };
}
function owned(output, file) { need(within(output, file) && normalized(file) !== normalized(output), 'Generated path escapes output.'); noLinksToExisting(path.dirname(file)); }
function mkdirOwned(output, directory) { owned(output, directory); fs.mkdirSync(directory, { recursive: true }); }
function copyExclusive(source, destination, output) {
  owned(output, destination); mkdirOwned(output, path.dirname(destination));
  fs.writeFileSync(destination, fs.readFileSync(source), { flag: 'wx' });
  need(row(source).sha256 === row(destination).sha256, 'Owned copy identity mismatch.');
}
function links(stage, output, sdk, core) {
  for (const [relative, target] of [['node_modules/@egret/engine', sdk.packageRoots.engine],
    ['node_modules/@esotericsoftware/spine-core', core.root]]) {
    const link = path.join(stage, relative); owned(output, link); mkdirOwned(output, path.dirname(link));
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    need(normalized(fs.realpathSync(link)) === normalized(fs.realpathSync(target)), 'Scratch dependency target mismatch.');
  }
}
function stageSources(stage, output, manifest, sdk, core) {
  mkdirOwned(output, stage);
  for (const pin of manifest.files) {
    const relative = pin.path.slice(manifest.root.length + 1);
    copyExclusive(path.join(checkout, pin.path), path.join(stage, relative), output);
  }
  copyExclusive(path.join(here, 'manifest.json'), path.join(stage, 'source-manifest.json'), output);
  writeJSON(path.join(stage, 'package.json'), { private: true, type: 'module' });
  links(stage, output, sdk, core);
}
function runChild(output, directory, name, args, cwd, deadline, limit = 15000) {
  const folder = path.join(output, directory); mkdirOwned(output, folder);
  const remaining = deadline - Date.now(); need(remaining > 0, 'Finite phase deadline reached.');
  const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_PATH;
  const startedAtUTC = new Date().toISOString();
  const child = spawnSync(process.execPath, args, { cwd, env, timeout: Math.min(limit, remaining),
    encoding: 'utf8', maxBuffer: 2 ** 21, windowsHide: true });
  const stdout = child.stdout ?? '', stderr = child.stderr ?? '';
  const stdoutPath = path.join(folder, `${name}.stdout.log`), stderrPath = path.join(folder, `${name}.stderr.log`);
  fs.writeFileSync(stdoutPath, stdout, { flag: 'wx' }); fs.writeFileSync(stderrPath, stderr, { flag: 'wx' });
  const receipt = { name, startedAtUTC, finishedAtUTC: new Date().toISOString(), executable: process.execPath, cwd, args,
    exitCode: child.status, signal: child.signal, timeout: child.error?.code === 'ETIMEDOUT', launchError: child.error?.code,
    stdout: row(stdoutPath), stderr: row(stderrPath) };
  const receiptPath = path.join(folder, `${name}.receipt.json`); writeJSON(receiptPath, receipt);
  need(!receipt.timeout && receipt.launchError === undefined && receipt.signal === null, 'Child launch/timeout/signal is INCOMPLETE.');
  return { receipt, receiptPin: row(receiptPath), stdout, stderr };
}
const summary = (text, key) => [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))].at(-1)?.[1];
const tapRows = text => [...text.matchAll(/^\s*(not )?ok \d+ - (.+)\s*$/gm)].map(match => ({ failed: match[1] !== undefined, name: match[2].trim() }));
function canonicalTest(result, manifest, isControl = false) {
  const rows = tapRows(result.stdout);
  const setup = manifest.setupSubtests.every(name => rows.some(item => !item.failed && item.name === name));
  need(setup && result.stderr === '' && !/ERR_MODULE_NOT_FOUND|RENDERER_REQUIRED|INPUT_(?:BYTES|SHA256)_CHANGED/.test(result.stdout), 'Real test setup did not pass.');
  if (result.receipt.exitCode === 0 && summary(result.stdout, 'tests') === '12' && summary(result.stdout, 'pass') === '12' && summary(result.stdout, 'fail') === '0') return;
  if (!isControl && result.receipt.exitCode === 1 && summary(result.stdout, 'tests') === '12') throw new SubsetFailure('Admitted F1 behavior/oracle mismatch.');
  throw new Incomplete('Canonical 12/12 baseline is required.');
}
function assignedFault(result, control, manifest) {
  need(result.receipt.exitCode === 1 && result.stderr === '' && result.stdout.includes(control.marker), `Assigned fault witness missing: ${control.id}`);
  const rows = tapRows(result.stdout);
  need(manifest.setupSubtests.every(name => rows.some(item => !item.failed && item.name === name)), 'Control setup did not pass.');
  const failing = rows.filter(item => item.failed && item.name !== manifest.parentTest);
  need(failing.length > 0 && failing.every(item => control.allowedFailingSubtests.includes(item.name)) &&
    failing.some(item => item.name === control.assignedSubtest), 'Unrelated or absent assigned failed subtest.');
  need(!/ERR_MODULE_NOT_FOUND|RENDERER_REQUIRED|INPUT_(?:BYTES|SHA256)_CHANGED/.test(result.stdout), 'A setup failure is not control sensitivity.');
}
function oneHunk(text, control) {
  const first = text.indexOf(control.from);
  need(first >= 0 && text.indexOf(control.from, first + control.from.length) === -1, `Control hunk must occur exactly once: ${control.id}`);
  return text.slice(0, first) + control.to + text.slice(first + control.from.length);
}


const clockArgs = ['--test', '--test-reporter=tap', 'tests/manual-clock.test.mjs'];
const manualArgs = ['--test', '--test-reporter=tap', 'tests/manual-step.test.mjs'];
function object(value, label) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' must be an object.');
  return value;
}
function clockResult(result, expected) {
  need(result.stderr === '', 'Clock stderr is not empty.');
  need(!/ERR_MODULE_NOT_FOUND|RENDERER_REQUIRED|F1C_INPUT_(?:BYTES|SHA)_CHANGED/.test(result.stdout),
    'Clock setup/input error cannot certify behavior.');
  need(result.receipt.exitCode === (expected.exitCode ?? 0), 'Unexpected Clock child exit.');
  for (const [key, count] of [['tests', expected.passed + expected.failed + expected.skipped],
    ['pass', expected.passed], ['fail', expected.failed], ['skipped', expected.skipped], ['cancelled', 0], ['todo', 0]]) {
    need(summary(result.stdout, key) === String(count), 'Clock TAP ' + key + ' count mismatch.');
  }
  const rows = tapRows(result.stdout);
  need(rows.length === expected.ids.length, 'Clock case row count mismatch.');
  assert.deepEqual(rows.map(item => item.name.split(' ')[0]), expected.ids);
  if (expected.skipped === 1) {
    need(/^\s*ok \d+ - F1C09 .*# SKIP PENDING/m.test(result.stdout), 'Only bootstrap F1C09 may be pending.');
  } else need(!/# SKIP/.test(result.stdout), 'Accepted Clock cases cannot skip.');
  if (expected.marker) need(result.stdout.includes(expected.marker), 'Exact Clock diagnostic/marker missing.');
  if (expected.errorCode) need(new RegExp('code: [\\\'"]' + expected.errorCode + '[\\\'"]').test(result.stdout),
    'Assigned Clock failure must be ERR_ASSERTION.');
  if (expected.actual !== undefined) {
    need(new RegExp('^\\s*actual: ' + String(expected.actual).replaceAll('.', '\\.') + '\\s*$', 'm').test(result.stdout),
      'Assigned actual numeric witness missing.');
    need(new RegExp('^\\s*expected: ' + String(expected.expected).replaceAll('.', '\\.') + '\\s*$', 'm').test(result.stdout),
      'Assigned expected numeric witness missing.');
  }
  if (expected.failed === 0) need(rows.every(item => !item.failed), 'An accepted Clock case failed.');
  else need(rows.length === 1 && rows[0].failed, 'Only the single assigned Clock case may fail.');
}
function changedClockBytes(original, rule) {
  need(rule.occurrences === 1 && typeof rule.before === 'string' && rule.before.length > 0 &&
    typeof rule.after === 'string', 'Fixed Clock hunk contract is invalid.');
  const text = original.toString('utf8');
  need(text.split(rule.before).length - 1 === 1, 'Fixed Clock hunk must be unique.');
  const changed = Buffer.from(text.replace(rule.before, () => rule.after));
  need(changed.length === rule.recordedEditedPin.bytes && hash(changed) === rule.recordedEditedPin.sha256,
    'Actual Clock hunk does not produce fixed reviewed bytes.');
  need(changed.toString('utf8').split(rule.after).length - 1 === 1, 'Clock inverse hunk must be unique.');
  need(Buffer.from(changed.toString('utf8').replace(rule.after, () => rule.before)).equals(original),
    'Clock inverse does not restore exact original.');
  return changed;
}
function workingWrite(output, file, bytes) {
  owned(output, file); regular(file); fs.writeFileSync(file, bytes);
}
function restoreClockCopy(output, file, original, changed, rule) {
  owned(output, file); regular(file);
  need(fs.readFileSync(file).equals(changed), 'Working Clock actor changed before restoration.');
  const text = changed.toString('utf8');
  need(text.split(rule.after).length - 1 === 1, 'Clock inverse occurrence changed.');
  const restored = Buffer.from(text.replace(rule.after, () => rule.before));
  need(restored.equals(original), 'Clock inverse bytes changed.');
  workingWrite(output, file, restored); return row(file);
}
function checkStage(stage, current, emitted) {
  for (const pin of current.authoredFiles) checkPin(pin, stage);
  for (const pin of emitted) checkPin(pin, stage);
}
function stageClockCopy(stage, context) {
  const { output, manifest, sdk, core, emitted, originalStage, current } = context;
  stageSources(stage, output, manifest, sdk, core);
  for (const pin of emitted) copyExclusive(path.join(originalStage, pin.path), path.join(stage, pin.path), output);
  writeJSON(path.join(stage, 'manifest.json'), current);
  checkStage(stage, current, emitted);
}
function completedBefore(result, mutationStartedAtUTC) {
  need(Number.isFinite(Date.parse(result.receipt.finishedAtUTC)) && Number.isFinite(Date.parse(mutationStartedAtUTC)) &&
    Date.parse(result.receipt.finishedAtUTC) <= Date.parse(mutationStartedAtUTC), 'Fresh baseline must finish before mutation.');
}
/** Prepare this stage's own named fault; the later full suite executes the fault. */
function prepareClockFault(stage, prefix, context) {
  const { output, manifest, sdk, core, compiler, current, emitted, contract, contractPin, sourcePin, deadline } = context;
  checkStage(stage, current, emitted); originalInputs(manifest, core, compiler, sdk);
  const bootstrapManual = runChild(output, prefix + '/logs', 'manual-bootstrap-twelve', manualArgs, stage, deadline, 30000);
  canonicalTest(bootstrapManual, manifest, true);
  const bootstrapClock = runChild(output, prefix + '/logs', 'clock-bootstrap-nine-pending', clockArgs, stage, deadline, 30000);
  clockResult(bootstrapClock, { passed: 9, failed: 0, skipped: 1, ids: manifest.clockCaseIds });
  const baselinePath = path.join(output, prefix, 'baseline-receipt.json');
  // The consumer selects two actual uniquely named object rows, never display text.
  writeJSON(baselinePath, [bootstrapManual.receipt, bootstrapClock.receipt]);
  const actorRoot = path.join(output, prefix, 'actor');
  stageClockCopy(actorRoot, context);
  const actorEntry = path.join(actorRoot, current.emittedBridge);
  const original = fs.readFileSync(actorEntry), changed = changedClockBytes(original, contract.fault);
  const immutableFault = path.join(actorRoot, 'out/f1-owned-after-advance-fault.js');
  const mutationStartedAtUTC = new Date().toISOString();
  completedBefore(bootstrapManual, mutationStartedAtUTC); completedBefore(bootstrapClock, mutationStartedAtUTC);
  let restoredEmission;
  try {
    workingWrite(output, actorEntry, changed);
    owned(output, immutableFault); fs.writeFileSync(immutableFault, changed, { flag: 'wx' });
    writeJSON(path.join(output, prefix, 'owned-fault-hunk.json'), {
      id: 'F1C09', mutationStartedAtUTC, originalEmission: row(path.join(stage, current.emittedBridge)),
      actorEmission: row(immutableFault), hunk: { before: contract.fault.before, after: contract.fault.after, occurrences: 1 } });
  } finally {
    // Keep the executed fault module immutable; restore only its ordinary entry.
    if (fs.readFileSync(actorEntry).equals(changed)) restoredEmission = restoreClockCopy(output, actorEntry, original, changed, contract.fault);
    else need(fs.readFileSync(actorEntry).equals(original), 'Fault actor working entry is neither original nor exact mutant.');
    checkStage(actorRoot, current, emitted); originalInputs(manifest, core, compiler, sdk);
  }
  need(restoredEmission !== undefined, 'Owned named-fault mutation/restoration did not complete.');
  const restoredOriginalClock = runChild(output, prefix + '/logs', 'clock-restored-nine-pending',
    clockArgs, actorRoot, deadline, 30000);
  clockResult(restoredOriginalClock, { passed: 9, failed: 0, skipped: 1, ids: manifest.clockCaseIds });
  const actorReceiptPath = path.join(output, prefix, 'actor-receipt.json');
  const actorReceipt = {
    schemaVersion: 1, kind: 'CURRENT_RUN_OWNED_CLOCK_ACTOR', status: 'ACTUAL_OWNED_NAMED_FAULT_READY',
    actorId: prefix + '/F1C09', faultName: contract.fault.faultName, stage: contract.fault.stage,
    deltaSeconds: contract.fault.deltaSeconds, contract: contractPin, source: sourcePin,
    originalEmission: row(path.join(stage, current.emittedBridge)), actorEmission: row(immutableFault), actorRoot,
    hunk: { before: contract.fault.before, after: contract.fault.after, occurrences: 1 }, mutationStartedAtUTC,
    baselines: { manual: { receipt: row(baselinePath), command: bootstrapManual.receipt.name },
      clockOriginal: { receipt: row(baselinePath), command: bootstrapClock.receipt.name } },
    baselineAcceptance: { manualPassed: 12, manualFailed: 0, clockOriginalPassed: 9, clockOriginalFailed: 0, beforeMutation: true },
    restoration: { inverseUnique: true, restoredOriginalPin: restoredEmission, restoredOriginalClock: restoredOriginalClock.receiptPin }
  };
  writeJSON(actorReceiptPath, actorReceipt);
  const stageManifest = path.join(stage, 'manifest.json'), beforeAdmissionPath = path.join(output, prefix, 'manifest-before-admission.json');
  copyExclusive(stageManifest, beforeAdmissionPath, output);
  assert.deepEqual(json(stageManifest), current);
  const admitted = { ...current, clock: { ...current.clock,
    faultControl: { status: 'ACTUAL_OWNED_NAMED_FAULT_READY', receipt: row(actorReceiptPath) } } };
  workingWrite(output, stageManifest, Buffer.from(JSON.stringify(admitted, null, 2) + '\n'));
  checkPin(row(actorReceiptPath)); checkPin(row(immutableFault)); checkStage(stage, current, emitted);
  const fullSuite = runChild(output, prefix + '/logs', 'clock-full-ten', clockArgs, stage, deadline, 30000);
  clockResult(fullSuite, { passed: 10, failed: 0, skipped: 0, ids: manifest.clockCaseIds });
  checkStage(stage, current, emitted); originalInputs(manifest, core, compiler, sdk);
  return {
    status: 'ACTUAL_TEN_CLOCK_CASES_WITH_OWNED_NAMED_FAULT',
    bootstrapManual: bootstrapManual.receiptPin, bootstrapClock: bootstrapClock.receiptPin,
    actorReceipt: row(actorReceiptPath), manifestBeforeAdmission: row(beforeAdmissionPath),
    manifestAfterAdmission: row(stageManifest), fullSuite: fullSuite.receiptPin,
    preservedExecutedFaultModule: row(immutableFault), originalEmission: row(path.join(stage, current.emittedBridge)),
    restoredActorEmission: restoredEmission, restoredOriginalClock: restoredOriginalClock.receiptPin,
    mutationStartedAtUTC, originalInputsUnchanged: true
  };
}
function runClockControls(context) {
  const { output, manifest, sdk, core, compiler, current, emitted, contract, contractPin, deadline } = context;
  const controls = context.clockControls;
  for (const control of contract.controls) {
    originalInputs(manifest, core, compiler, sdk);
    const prefix = 'clock-controls/' + control.id, stage = path.join(output, prefix, 'copy');
    stageClockCopy(stage, context);
    const faultPrerequisite = prepareClockFault(stage, prefix, context);
    const baselineManual = runChild(output, prefix + '/logs', 'manual-full-baseline', manualArgs, stage, deadline, 30000);
    canonicalTest(baselineManual, manifest, true);
    const baselineClock = runChild(output, prefix + '/logs', 'clock-full-baseline', clockArgs, stage, deadline, 30000);
    clockResult(baselineClock, { passed: 10, failed: 0, skipped: 0, ids: manifest.clockCaseIds });
    const bridge = path.join(stage, current.emittedBridge), original = fs.readFileSync(bridge);
    const changed = changedClockBytes(original, control), immutableActor = path.join(output, prefix, 'actor-emission-at-mutation.js');
    const originalEmission = row(bridge), mutationStartedAtUTC = new Date().toISOString();
    completedBefore(baselineManual, mutationStartedAtUTC); completedBefore(baselineClock, mutationStartedAtUTC);
    let setup, actor, restoredEmission;
    try {
      workingWrite(output, bridge, changed);
      owned(output, immutableActor); fs.writeFileSync(immutableActor, changed, { flag: 'wx' });
      writeJSON(path.join(output, prefix, 'owned-copy-hunk.json'), { id: control.id, mutationStartedAtUTC,
        originalEmission, actorEmission: row(immutableActor), hunk: { before: control.before, after: control.after, occurrences: 1 } });
      setup = runChild(output, prefix + '/logs', 'clock-setup',
        ['--test', '--test-reporter=tap', '--test-name-pattern=^F1C00 ', 'tests/manual-clock.test.mjs'], stage, deadline, 30000);
      clockResult(setup, { passed: 1, failed: 0, skipped: 0, ids: ['F1C00'], marker: 'F1C_ACTUAL_SETUP_COMPLETE' });
      actor = runChild(output, prefix + '/logs', 'clock-assigned-fault',
        ['--test', '--test-reporter=tap', '--test-name-pattern=^' + control.assignedCase + ' ', 'tests/manual-clock.test.mjs'],
        stage, deadline, 30000);
      clockResult(actor, { exitCode: 1, passed: 0, failed: 1, skipped: 0, ids: [control.assignedCase],
        marker: control.marker, errorCode: control.expectedErrorCode, actual: control.actual, expected: control.expected });
    } finally {
      if (fs.readFileSync(bridge).equals(changed)) restoredEmission = restoreClockCopy(output, bridge, original, changed, control);
      else need(fs.readFileSync(bridge).equals(original), 'Control entry is neither original nor exact mutant.');
      checkStage(stage, current, emitted); originalInputs(manifest, core, compiler, sdk);
    }
    need(setup !== undefined && actor !== undefined && restoredEmission !== undefined, 'Assigned Clock sequence incomplete.');
    const restored = runChild(output, prefix + '/logs', 'clock-restored-assigned',
      ['--test', '--test-reporter=tap', '--test-name-pattern=^' + control.assignedCase + ' ', 'tests/manual-clock.test.mjs'],
      stage, deadline, 30000);
    clockResult(restored, { passed: 1, failed: 0, skipped: 0, ids: [control.assignedCase] });
    controls.push({ id: control.id, status: 'ACTUAL_FINITE_ASSIGNED_CONTROL_PASS', assignedCase: control.assignedCase,
      contract: contractPin, baselineManual: baselineManual.receiptPin, baselineClock: baselineClock.receiptPin,
      setup: setup.receiptPin, actor: actor.receiptPin, restored: restored.receiptPin, mutationStartedAtUTC,
      originalEmission, actorEmission: row(immutableActor), restoredEmission, ownedCopyRestored: true, faultPrerequisite });
  }
  need(controls.length === 3, 'Exactly three assigned Clock controls required.');
  return controls;
}

/** A generated child invokes this finite original-core probe in its own process. */
export async function runCanonical(stage, inputPath) {
  const input = json(inputPath), sourceManifest = json(path.join(stage, 'source-manifest.json'));
  const before = content(input.core.root);
  assert.equal(before.digest, sourceManifest.core.contentDigestSHA256); assert.equal(before.rows.length, 137);
  for (const pin of input.inputPins) checkPin(pin);
  const oracle = json(path.join(stage, 'fixtures/f1-oracle.json'));
  const angle = 90 * (3.1415927 / 180);
  const hostPremises = { cosZero: Math.cos(0), sinZero: Math.sin(0), quarterCos: Math.cos(angle), quarterSin: Math.sin(angle) };
  assert.equal(hostPremises.cosZero, 1); assert.equal(hostPremises.sinZero, 0);
  assert.ok(Math.abs(hostPremises.quarterCos) <= 2.4e-8, 'F1_HOST_QUARTER_COS_PREMISE');
  assert.ok(Math.abs(hostPremises.quarterSin - 1) <= 2 ** -48, 'F1_HOST_QUARTER_SIN_PREMISE');
  const tolerance = oracle.numericPolicy.position.absolute; assert.equal(tolerance, 2 ** -20);
  const { inspectCanonicalSpine } = await import(pathToFileURL(path.join(stage, 'out/canonical-baseline.js')).href);
  const result = inspectCanonicalSpine(fs.readFileSync(path.join(stage, 'fixtures/egret-original-slide.spine.json'), 'utf8'),
    fs.readFileSync(path.join(stage, 'fixtures/egret-original-slide.atlas'), 'utf8'));
  assert.equal(result.status, 'CANONICAL_CORE_PARSE_POSE_COMMANDS_OBSERVED'); assert.equal(result.frames.length, 5);
  for (let index = 0; index < 5; index++) {
    const frame = result.frames[index]; assert.equal(frame.time, index * 0.25);
    assert.equal(frame.commands.length, 2);
    for (let slot = 0; slot < 2; slot++) {
      const command = frame.commands[slot]; assert.equal(command.numVertices, 4); assert.equal(command.numIndices, 6);
      assert.equal(command.blendMode, 0); assert.deepEqual(command.indices, [0, 1, 2, 2, 3, 0]);
      assert.deepEqual(command.darkColors, [0, 0, 0, 0]);
      assert.deepEqual(command.colors, Array(4).fill(slot === 0 ? 4294967295 : 4286611711));
      const fixed = oracle.frames.find(item => item.t === frame.time);
      if (fixed !== undefined) {
        const quad = fixed.quads[slot], used = new Set();
        for (let vertex = 0; vertex < 4; vertex++) {
          const point = [command.positions[vertex * 2] + 24, 24 - command.positions[vertex * 2 + 1]];
          const matches = quad.corners.map(([x, y], corner) => Math.abs(point[0] - x) <= tolerance && Math.abs(point[1] - y) <= tolerance ? corner : -1).filter(corner => corner >= 0);
          assert.equal(matches.length, 1, 'F1_CANONICAL_CORNER_BIJECTION'); const corner = matches[0];
          assert.equal(used.has(corner), false, 'F1_CANONICAL_UNIQUE_CORNER'); used.add(corner);
          assert.deepEqual(command.uvs.slice(vertex * 2, vertex * 2 + 2), quad.cornerUVs[corner]);
        }
        assert.equal(used.size, 4);
      }
    }
  }
  assert.deepEqual(result.independentB.commands, result.frames[0].commands);
  assert.notDeepEqual(result.initialOwnedPositions, result.retainedPoolAfterAdvancement, 'F1_ACTUAL_POOL_OVERWRITE_REQUIRED');
  assert.deepEqual(content(input.core.root), before);
  for (const pin of input.inputPins) checkPin(pin);
  console.log(JSON.stringify({ ...result, status: 'ACTUAL_CURRENT_F1_CANONICAL_QUALIFICATION',
    upstreamFilesBeforeAfterUnchanged: true,
    precision: { tolerance, hostPremises, reviewSHA256: oracle.numericPolicy.position.reviewReceipt.sha256 },
    core: { version: sourceManifest.core.version, contentDigestSHA256: before.digest, files: before.rows.length },
    currentInputPins: input.inputPins, runtime: { node: process.version, versions: process.versions, executable: process.execPath },
    scope: 'Current CPU core/host qualification only; no adapter/GPU/device/full Spine or licensing qualification.' }));
}

export async function runSupplement(kind, stage) {
  const manifest = json(path.join(stage, 'manifest.json'));
  const sdk = await import(pathToFileURL(manifest.engineEntry).href);
  const helpers = await import(pathToFileURL(manifest.helperEntry).href);
  const { createF1ManualResources } = await import(pathToFileURL(path.join(stage, manifest.emittedBridge)).href);
  const skeletonText = fs.readFileSync(path.join(stage, 'fixtures/egret-original-slide.spine.json'), 'utf8');
  const atlasText = fs.readFileSync(path.join(stage, 'fixtures/egret-original-slide.atlas'), 'utf8');
  const rgba = fs.readFileSync(path.join(stage, 'fixtures/egret-original-page.rgba'));
  const oracle = json(path.join(stage, 'fixtures/f1-oracle.json'));
  let actualSkeleton = skeletonText;
  if (kind === 'unsupported-additive') {
    const variant = JSON.parse(skeletonText);
    assert.equal(variant.slots[1].name, 'front'); assert.equal(variant.slots[1].blend, 'normal');
    variant.slots[1].blend = 'additive'; actualSkeleton = JSON.stringify(variant);
    const { inspectCanonicalSpine } = await import(pathToFileURL(manifest.canonicalEntry).href);
    const coreObservation = inspectCanonicalSpine(actualSkeleton, atlasText);
    assert.equal(coreObservation.status, 'CANONICAL_CORE_PARSE_POSE_COMMANDS_OBSERVED');
    for (const frame of coreObservation.frames) {
      assert.equal(frame.commands.length, 2); assert.equal(frame.commands[0].blendMode, 0); assert.equal(frame.commands[1].blendMode, 1);
    }
  }
  const counters = { headerLoads: 0, headerDisposals: 0, pageLoads: 0, pageDisposals: 0 };
  const texturedFrames = [];
  const host = helpers.host({ texturedFrameProfile: sdk.TEXTURED_FRAME_PROFILE_2D, renderTexturedFrame(frame) { texturedFrames.push(frame); return undefined; } });
  const engine = await sdk.createEngineForProfile({ host: host.adapter }, sdk.TEXTURED_FRAME_PROFILE_2D);
  let page;
  const textType = sdk.createAssetType('F1 supplement original text', value => typeof value === 'string');
  const pageType = sdk.createAssetType('F1 supplement original page', sdk.isTexture);
  const refs = Object.freeze({ skeleton: sdk.createAssetRef(textType, 'original.json'), atlas: sdk.createAssetRef(textType, 'original.atlas'), page: sdk.createAssetRef(pageType, 'original.rgba') });
  engine.assets.register(textType, { load(ref) { counters.headerLoads++; return Promise.resolve(ref.id === refs.skeleton.id ? actualSkeleton : atlasText); }, dispose() { counters.headerDisposals++; } });
  engine.assets.register(pageType, { load() {
    counters.pageLoads++; assert.equal(rgba.length, 1024); const pixels = new Uint8Array(1024); pixels.set(rgba);
    page = sdk.createTexture(sdk.createImageData2D({ width: 16, height: 16, pixels, format: 'rgba8unorm', colorSpace: 'srgb', alphaMode: 'straight', origin: 'top-left' }));
    return Promise.resolve(page);
  }, dispose(texture) { counters.pageDisposals++; texture.dispose(); } });
  const retained = instance => [0, 1].map(index => { const mesh = instance.display.getChildAt(index); return { mesh, geometry: mesh.geometry, positions: [...mesh.geometry.positions] }; });
  const unchanged = saved => { for (const row of saved) { assert.equal(row.mesh.geometry, row.geometry); assert.deepEqual(row.geometry.positions, row.positions); } };
  let observation;
  try {
    const resourceScope = engine.createScope();
    if (kind === 'unsupported-additive') {
      let error, published;
      try { published = await createF1ManualResources(engine, resourceScope, refs); } catch (cause) { error = cause; }
      assert.equal(published, undefined, 'F1_UNSUPPORTED_PROFILE_NO_FACADE');
      assert.ok(error instanceof sdk.EgretError); assert.equal(error.code, 'F1_RESOURCE_LOAD_FAILED');
      assert.ok(error.cause instanceof sdk.EgretError); assert.equal(error.cause.code, manifest.unsupportedCause);
      assert.deepEqual(counters, { headerLoads: 2, headerDisposals: 2, pageLoads: 1, pageDisposals: 1 });
      assert.equal(page.isDisposed, true); resourceScope.dispose();
      observation = { status: 'ACTUAL_SUPPORTED_CORE_UNSUPPORTED_BRIDGE_PROFILE_REFUSED', wrapperCode: error.code, originalCauseCode: error.cause.code, published: false, counters: { ...counters } };
    } else {
      assert.equal(kind, 'injected-after-advance');
      const resources = await createF1ManualResources(engine, resourceScope, refs);
      const A = resources.createInstance(engine.createScope()), B = resources.createInstance(engine.createScope());
      const old = retained(A), elapsedBefore = A.elapsedSeconds;
      assert.throws(() => A.step(0.25), error => error instanceof Error && error.message === 'F1_INJECTED_AFTER_ADVANCE');
      assert.equal(A.elapsedSeconds, elapsedBefore); unchanged(old);
      assert.throws(() => A.step(0.125), error => error instanceof sdk.EgretError && error.code === 'F1_INSTANCE_TERMINAL');
      assert.equal(A.elapsedSeconds, elapsedBefore); unchanged(old);
      for (let index = 0; index < 4; index++) B.step(0.125);
      assert.equal(B.elapsedSeconds, 0.5); assert.equal(page.isDisposed, false); assert.equal(counters.pageDisposals, 0);
      const expected = oracle.frames.find(frame => frame.t === 0.5), tolerance = oracle.numericPolicy.position.absolute;
      assert.equal(tolerance, 2 ** -20);
      for (let slot = 0; slot < 2; slot++) {
        const mesh = B.display.getChildAt(slot), geometry = mesh.geometry, quad = expected.quads[slot], assigned = new Set();
        assert.ok(mesh instanceof sdk.Mesh2D && sdk.isTexturedGeometry2D(geometry)); assert.equal(mesh.textureLease.value, page);
        assert.equal(geometry.vertexCount, 4); assert.equal(geometry.indexCount, 6);
        for (let vertex = 0; vertex < 4; vertex++) {
          const point = mesh.localToGlobal(geometry.positions[vertex * 2], geometry.positions[vertex * 2 + 1]);
          const matches = quad.corners.map(([x, y], corner) => Math.abs(point.x - x) <= tolerance && Math.abs(point.y - y) <= tolerance ? corner : -1).filter(corner => corner >= 0);
          assert.equal(matches.length, 1); const corner = matches[0]; assert.equal(assigned.has(corner), false); assigned.add(corner);
          assert.deepEqual(geometry.uvs.slice(vertex * 2, vertex * 2 + 2), quad.cornerUVs[corner]);
          for (let channel = 0; channel < 4; channel++) assert.equal(geometry.lightColors[vertex * 4 + channel], quad.lightRGBA[channel][0] / quad.lightRGBA[channel][1]);
        }
        assert.equal(assigned.size, 4); assert.deepEqual(geometry.indices, [0, 1, 2, 2, 3, 0]);
      }
      resourceScope.dispose(); resources.dispose();
      assert.equal(A.display.isDisposed, true); assert.equal(B.display.isDisposed, true);
      assert.deepEqual(counters, { headerLoads: 2, headerDisposals: 2, pageLoads: 1, pageDisposals: 1 });
      observation = { status: 'ACTUAL_DELIBERATE_POST_ADVANCE_EXCEPTION_HANDLING', namedFault: 'F1_INJECTED_AFTER_ADVANCE', AElapsedUnchanged: true, AContinuation0125Refused: 'F1_INSTANCE_TERMINAL', BFour0125Steps: 0.5, BOriginalLiteralGeometry: true, sharedPageLiveUntilResourceClose: true, counters: { ...counters }, boundary: 'Deliberately injected first-party exception handling; no naturally reachable production fault or transaction claim.' };
    }
  } finally { await engine.dispose(); }
  assert.deepEqual(host.trace, ['start', 'stop', 'close']); assert.equal(host.timers.size, 0);
  observation.hostTrace = host.trace; observation.timers = host.timers.size;
  console.log(JSON.stringify(observation));
}


async function main(args) {
  const options = parseCLI(args); if (options.help) { help(); return; }
  const deadline = Date.now() + 180000;
  need(process.versions.node === '24.19.0' && process.execArgv.length === 0 && !process.env.NODE_OPTIONS && !process.env.NODE_PATH,
    'Use pinned Node 24.19.0 without inherited preloads or module paths.');
  const manifestPath = path.join(here, 'manifest.json'); regular(manifestPath);
  publicManifestPin = row(manifestPath);
  const manifest = object(json(manifestPath), 'Public manifest');
  need(manifest.schemaVersion === 2 && manifest.kind === 'PUBLIC_F1_MANUAL_CLOCK_EXPERIMENT' &&
    manifest.root === 'knowledge-base/experiments/spine-f1', 'Public manual/Clock manifest required.');
  need(Array.isArray(manifest.files) && manifest.files.length === 10 && Array.isArray(manifest.clockCaseIds) &&
    Array.isArray(manifest.controls) && manifest.controls.length === 6, 'Finite source/manual/Clock arrays required.');
  const contractPath = path.join(here, 'clock-acceptance-contract.json'), contractPin = row(contractPath);
  const contract = object(json(contractPath), 'Clock fixed contract');
  need(contract.schemaVersion === 1 && contract.kind === 'FIRST_PARTY_FIXED_CLOCK_ACCEPTANCE_CONTRACT' &&
    Array.isArray(contract.controls) && contract.controls.length === 3, 'Published fixed Clock contract required.');
  assert.deepEqual(contract.controls.map(item => item.id), ['F1CM01', 'F1CM02', 'F1CM03']);
  assert.deepEqual(manifest.clockCaseIds, ['F1C00','F1C01','F1C02','F1C03','F1C04','F1C05','F1C06','F1C07','F1C08','F1C09']);
  const sourcePin = row(path.join(here, 'src/f1-manual-bridge.ts'));
  need(sourcePin.bytes === contract.source.bytes && sourcePin.sha256 === contract.source.sha256,
    'Exact accepted Clock source required.');
  const clockTestPin = row(path.join(here, 'tests/manual-clock.test.mjs'));
  need(clockTestPin.bytes === contract.projectedClockTest.bytes && clockTestPin.sha256 === contract.projectedClockTest.sha256,
    'Exact admitted Clock metadata successor required.');
  const repository = json(path.join(checkout, 'package.json'));
  need(repository.engines?.node === '24.19.0' && repository.devDependencies?.typescript === '7.0.2', 'Existing repository Node/TypeScript profile required.');
  for (const pin of manifest.files) checkPin(pin, checkout);
  safeAbsolute(options['spine-core']); const coreRoot = fs.realpathSync(options['spine-core']);
  need(!intersect(checkout, coreRoot), 'Official core must be outside this checkout.');
  const coreMetadata = json(path.join(coreRoot, 'package.json'));
  need(coreMetadata.name === manifest.core.name && coreMetadata.version === manifest.core.version, 'Exact official core4.3.13 package root required.');
  const coreBefore = content(coreRoot);
  need(coreBefore.rows.length === manifest.core.regularFileCount && coreBefore.digest === manifest.core.contentDigestSHA256, 'Wrong official package content envelope.');
  for (const pin of manifest.core.files) checkPin(pin, coreRoot);
  const core = { root: coreRoot, contentDigestSHA256: coreBefore.digest, rows: coreBefore.rows };
  const compilerRoot = fs.realpathSync(path.join(checkout, 'node_modules/typescript'));
  need(json(path.join(compilerRoot, 'package.json')).version === '7.0.2', 'Clone TypeScript7.0.2 is required; follow the repository build guide.');
  const compilerContents = content(compilerRoot);
  const compiler = { root: compilerRoot, entry: path.join(compilerRoot, 'bin/tsc'),
    contentDigestSHA256: compilerContents.digest,
    files: [...compilerContents.rows.map(({ relative, ...item }) => item), row(process.execPath), row(path.join(checkout, 'package.json'))] };
  regular(compiler.entry);
  const sdk = snapshotSDK(manifest);
  let playwright;
  if (options.webgpu) {
    safeAbsolute(options.playwright); const entry = fs.realpathSync(options.playwright);
    regular(entry); need(path.basename(entry) === 'index.mjs', 'Existing Playwright index.mjs import entry required.');
    const root = path.dirname(entry);
    const playwrightMetadata = object(json(path.join(root, 'package.json')), 'Playwright package');
    need(playwrightMetadata.name === 'playwright' && playwrightMetadata.version === '1.62.1',
      'Existing official Playwright1.62.1 import entry required.');
    playwright = { root, entry, files: [row(entry), row(path.join(root, 'package.json'))] };
  }
  const output = freshOutput(options.output, [checkout, coreRoot, compilerRoot, ...(playwright ? [playwright.root] : [])]);
  const before = originalInputs(manifest, core, compiler, sdk);
  fs.mkdirSync(output, { recursive: false });
  const records = [], controls = [], clockControls = [];
  try {
    const currentGraph = path.join(output, 'current-sdk-snapshot.json'); writeJSON(currentGraph, sdk);
    const externalCorePath = path.join(output, 'external-core-before.json');
    writeJSON(externalCorePath, { schemaVersion: 1, kind: 'CURRENT_SUPPLIED_OFFICIAL_CORE_INPUTS',
      ...core, regularFileCount: 137 });
    const stage = path.join(output, 'canonical/copy'); stageSources(stage, output, manifest, sdk, core);
    const config = { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      types: [], strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: false,
      noEmitOnError: true, declaration: true, rootDir: 'src', outDir: 'out' }, include: ['src/**/*.ts'] };
    writeJSON(path.join(stage, 'tsconfig.json'), config);
    const compiled = runChild(output, 'canonical/logs', 'strict-types', [compiler.entry, '--project', 'tsconfig.json', '--pretty', 'false'], stage, deadline);
    records.push(compiled.receiptPin); need(compiled.receipt.exitCode === 0, 'Strict bridge/canonical compilation is INCOMPLETE.');
    const inputPins = [row(path.join(stage, 'src/canonical-baseline.ts')), row(path.join(stage, 'out/canonical-baseline.js')),
      ...compiler.files, ...manifest.files.map(pin => row(path.join(checkout, pin.path))), row(currentGraph)];
    const canonicalInput = path.join(output, 'canonical-input.json'); writeJSON(canonicalInput, { schemaVersion: 1, core, inputPins });
    const canonicalChild = path.join(output, 'canonical-child.mjs');
    fs.writeFileSync(canonicalChild, `import { runCanonical } from ${JSON.stringify(pathToFileURL(self).href)};\nawait runCanonical(${JSON.stringify(stage)}, ${JSON.stringify(canonicalInput)});\n`, { flag: 'wx' });
    const canonical = runChild(output, 'canonical/logs', 'core-qualification', [canonicalChild], stage, deadline);
    records.push(canonical.receiptPin); need(canonical.receipt.exitCode === 0 && canonical.stderr === '', 'Actual canonical core/host qualification is INCOMPLETE.');
    const qualification = JSON.parse(canonical.stdout.trim()); need(qualification.status === 'ACTUAL_CURRENT_F1_CANONICAL_QUALIFICATION', 'Canonical qualification status missing.');
    const qualificationPath = path.join(output, 'current-canonical-qualification.json'); writeJSON(qualificationPath, qualification);
    const current = { ...manifest, schemaVersion: 2, kind: 'CURRENT_F1_MANUAL_CLOCK_REPLAY_STAGE', base: manifest.historicalDeliveredBase,
      sdkGraph: { receipt: row(currentGraph), engineEntry: sdk.engineEntry, spinePlanningEntry: sdk.spinePlanningEntry, helperEntry: sdk.helperEntry, files: sdk.files },
      authoredFiles: manifest.files.map(pin => ({ ...pin, path: pin.path.slice(manifest.root.length + 1) })),
      numericQualification: row(qualificationPath), engineEntry: sdk.engineEntry, helperEntry: sdk.helperEntry,
      canonicalEntry: path.join(stage, 'out/canonical-baseline.js'), emittedBridge: 'out/f1-manual-bridge.js',
      clock: { ...manifest.clock, source: sourcePin, acceptanceContract: contractPin,
        inputPins: [...compiler.files, row(currentGraph), row(externalCorePath), row(qualificationPath), row(path.join(stage, 'out/f1-manual-bridge.js'))],
        externalCore: { receipt: row(externalCorePath), root: coreRoot, entry: path.join(coreRoot, coreMetadata.main) },
        faultControl: { status: 'PENDING_OWNED_NAMED_FAULT', receipt: null } } };
    const originalClockEmission = row(path.join(stage, current.emittedBridge));
    need(originalClockEmission.bytes === contract.expectedEmission.bytes &&
      originalClockEmission.sha256 === contract.expectedEmission.sha256, 'Strict current Clock emission differs from reviewed fixed source profile.');
    writeJSON(path.join(stage, 'manifest.json'), current);
    const baseline = runChild(output, 'canonical/logs', 'original-manual-behavior', ['--test', '--test-reporter=tap', 'tests/manual-step.test.mjs'], stage, deadline);
    records.push(baseline.receiptPin); canonicalTest(baseline, manifest);
    const emitted = [...walk(stage, 'out')].map(item => ({ path: item.relative, bytes: item.bytes, sha256: item.sha256 }));
    for (const control of manifest.controls) {
      originalInputs(manifest, core, compiler, sdk);
      const copied = path.join(output, 'controls', control.id, 'copy'); stageSources(copied, output, manifest, sdk, core);
      for (const pin of emitted) copyExclusive(path.join(stage, pin.path), path.join(copied, pin.path), output);
      writeJSON(path.join(copied, 'manifest.json'), current);
      const canonicalControl = runChild(output, `controls/${control.id}/logs`, 'canonical-baseline',
        ['--test', '--test-reporter=tap', 'tests/manual-step.test.mjs'], copied, deadline);
      canonicalTest(canonicalControl, manifest, true);
      const bridge = path.join(copied, current.emittedBridge); owned(output, bridge);
      const originalBytes = fs.readFileSync(bridge); let actor, changed;
      try {
        if (typeof control.from === 'string') {
          changed = Buffer.from(oneHunk(originalBytes.toString('utf8'), control));
          writeJSON(path.join(output, 'controls', control.id, 'owned-copy-hunk.json'), { id: control.id,
            beforeSHA256: hash(originalBytes), afterSHA256: hash(changed), from: control.from, to: control.to, exactHunks: 1 });
          workingWrite(output, bridge, changed);
          const retainedActor = path.join(output, 'controls', control.id, 'actor-emission-at-mutation.js');
          owned(output, retainedActor); fs.writeFileSync(retainedActor, changed, { flag: 'wx' });
        }
        if (control.kind === 'behavior-fault') {
          actor = runChild(output, `controls/${control.id}/logs`, 'assigned-fault',
            ['--test', '--test-reporter=tap', 'tests/manual-step.test.mjs'], copied, deadline);
          assignedFault(actor, control, manifest);
        } else {
          const actorFile = path.join(output, 'controls', control.id, 'supplement-child.mjs');
          fs.writeFileSync(actorFile, `import { runSupplement } from ${JSON.stringify(pathToFileURL(self).href)};\nawait runSupplement(${JSON.stringify(control.id)}, ${JSON.stringify(copied)});\n`, { flag: 'wx' });
          actor = runChild(output, `controls/${control.id}/logs`, 'supplement', [actorFile], copied, deadline);
          need(actor.receipt.exitCode === 0 && actor.stderr === '', 'Supplement witness is INCOMPLETE.');
          const observed = JSON.parse(actor.stdout.trim()); need(observed.status === control.expectedStatus, 'Supplement status mismatch.');
          writeJSON(path.join(output, 'controls', control.id, 'observed.json'), observed);
        }
      } finally {
        // Only this prevalidated owned emitted copy is restored. Failure logs and
        // the original source/core/fixtures remain intact; nothing is deleted.
        owned(output, bridge);
        if (changed !== undefined) {
          need(fs.readFileSync(bridge).equals(changed), 'Manual actor changed before inverse restoration.');
          const changedText = changed.toString('utf8');
          need(changedText.split(control.to).length - 1 === 1, 'Manual inverse hunk must be unique.');
          const restoredBytes = Buffer.from(changedText.replace(control.to, () => control.from));
          need(restoredBytes.equals(originalBytes), 'Manual inverse does not restore original bytes.');
          workingWrite(output, bridge, restoredBytes);
        } else need(fs.readFileSync(bridge).equals(originalBytes), 'Unmutated manual actor changed.');
        need(row(bridge).sha256 === hash(originalBytes), 'Owned emission restoration failed.');
        for (const pin of emitted) checkPin(pin, copied);
        for (const pin of current.authoredFiles) checkPin(pin, copied);
        originalInputs(manifest, core, compiler, sdk);
      }
      controls.push({ id: control.id, status: 'ACTUAL_FINITE_ASSIGNED_CONTROL_PASS', canonicalBaseline: canonicalControl.receiptPin,
        actor: actor.receiptPin, ownedCopyRestored: true });
    }
    need(controls.length === 6, 'Exactly six assigned controls are required.');
    const clockContext = { output, manifest, sdk, core, compiler, current, emitted, originalStage: stage,
      contract, contractPin, sourcePin, deadline, clockControls };
    const namedFault = prepareClockFault(stage, 'canonical/clock', clockContext);
    runClockControls(clockContext);
    const clock = { tests: { total: 10, passed: 10, failed: 0, skipped: 0, receipt: namedFault.fullSuite },
      source: sourcePin, emission: originalClockEmission, contract: contractPin, namedFault, controls: clockControls };
    for (const pin of emitted) checkPin(pin, stage);
    for (const pin of current.authoredFiles) checkPin(pin, stage);
    checkPin(current.sdkGraph.receipt); checkPin(current.numericQualification);
    const after = originalInputs(manifest, core, compiler, sdk); assert.deepEqual(after, before);
    writeJSON(path.join(output, 'external-core-after.json'), { root: coreRoot, ...content(coreRoot) });
    const collection = { schemaVersion: 2, kind: 'CURRENT_F1_MANUAL_CLOCK_CPU_COLLECTION', status: 'PASS_F1_CPU_SUBSET', generatedAtUTC: new Date().toISOString(),
      publicManifest: row(manifestPath), currentSDKSnapshot: row(currentGraph), currentCanonicalQualification: row(qualificationPath),
      historicalDeliveredBase: manifest.historicalDeliveredBase, historicalTreeAssignedToCurrentClone: false,
      currentCompiler: compiler, currentCore: { root: coreRoot, files: coreBefore.rows.length, contentDigestSHA256: coreBefore.digest },
      runtime: { node: process.version, executable: process.execPath, versions: process.versions }, before, after,
      inputIdentitiesUnchanged: true, originalTests: { total: 12, passed: 12, failed: 0, skipped: 0, childContracts: 11, receipt: baseline.receiptPin },
      canonicalReceipts: records, controls, clock, scope: manifest.boundary, native: options.webgpu ? 'REQUESTED_PENDING_SEPARATE_ENTRY' : 'NOT_REQUESTED' };
    const collectionPath = path.join(output, 'cpu-collection.json'); writeJSON(collectionPath, collection);
    if (options.webgpu) {
      // Native input is generated at the completed CPU cutoff; it cannot refer
      // to its own future receipt. The separate native harness owns its policy.
      const nativeDirectory = path.join(here, 'webgpu');
      for (const name of ['index.html', 'main.mjs', 'run.mjs', 'manifest.json']) {
        need(fs.existsSync(path.join(nativeDirectory, name)), 'Separate native projection has not been admitted.'); regular(path.join(nativeDirectory, name));
      }
      const nativeInput = path.join(output, 'native-input.json');
      writeJSON(nativeInput, { schemaVersion: 2, kind: 'CURRENT_F1_CLOCK_CPU_COMPLETED_NATIVE_HANDOFF',
        cpuCollection: row(collectionPath), canonicalQualification: row(qualificationPath), currentSDKSnapshot: row(currentGraph),
        publicManifest: row(manifestPath), sdk, core: { root: coreRoot, regularFileCount: 137, contentDigestSHA256: coreBefore.digest },
        stage, stagedInputs: current.authoredFiles.map(pin => row(path.join(stage, pin.path))), emittedInputs: emitted.map(pin => row(path.join(stage, pin.path))),
        oracle: row(path.join(stage, 'fixtures/f1-oracle.json')), clockContract: contractPin,
        clockProof: { tests: clock.tests, namedFault: clock.namedFault, controls: clock.controls,
          source: clock.source, emission: clock.emission, contract: clock.contract },
        playwright, stableNativeProfile: manifest.nativeProfile,
        aliases: {
          engine: { specifier: '@egret/engine', entry: sdk.engineEntry, provenance: 'Current clone public export' },
          webgpu: { specifier: '@egret/engine/webgpu', entry: packageExport(sdk.packageRoots.engine, './webgpu'), provenance: 'Current clone public export' },
          spineCore: { specifier: '@esotericsoftware/spine-core', entry: path.join(coreRoot, coreMetadata.main), provenance: 'Unmodified supplied official package' },
          bridge: { specifier: '#f1-manual-bridge', entry: path.join(stage, 'out/f1-manual-bridge.js'), provenance: 'Current compiled accepted first-party Clock bridge' },
          canonical: { specifier: '#f1-canonical', entry: path.join(stage, 'out/canonical-baseline.js'), provenance: 'Compiled independently authored original probe' },
        },
        nativeAcceptance: 'NOT_RUN', licensingQualification: 'unverified' });
      const native = runChild(output, 'native-wrapper', 'native', [path.join(nativeDirectory, 'run.mjs'),
        '--input', nativeInput, '--playwright', playwright.entry, '--output', path.join(output, 'native')], checkout, Date.now() + 120000, 120000);
      need([0, 1, 2, 3].includes(native.receipt.exitCode), 'Native successor has an invalid exit status.');
      writeJSON(path.join(output, 'native-wrapper-result.json'), { cpu: row(collectionPath), native: native.receiptPin,
        exitCode: native.receipt.exitCode, scope: 'Separate harness receipt required; outer execution alone proves no safe OS retirement.' });
      process.exitCode = native.receipt.exitCode;
    }
    console.log(JSON.stringify({ status: collection.status, output, originalTests: 12, controls: 6, ClockTests: 10, assignedClockControls: 3,
      inputIdentitiesUnchanged: true, native: collection.native, scope: collection.scope }));
  } catch (cause) {
    let unchanged = false, identityError;
    try { originalInputs(manifest, core, compiler, sdk); unchanged = true; } catch (failure) { identityError = failure.message; }
    const status = cause instanceof SubsetFailure && unchanged ? 'FAIL_F1_CPU_SUBSET' : 'INCOMPLETE';
    writeJSON(path.join(output, 'incomplete.json'), { schemaVersion: 2, status, completedControls: controls, completedClockControls: clockControls,
      receipts: records, originalInputsUnchanged: unchanged, identityError,
      cause: { name: cause.name, message: cause.message, code: cause.code },
      scope: 'Failure/timeout/setup or absent assigned witness cannot certify a control or full Spine acceptance.' });
    throw status === 'FAIL_F1_CPU_SUBSET' ? cause : new Incomplete(cause.message, { cause });
  }
}

if (process.argv[1] !== undefined && normalized(process.argv[1]) === normalized(self)) {
  try { await main(process.argv.slice(2)); }
  catch (cause) {
    process.exitCode = cause instanceof SubsetFailure ? 1 : 2;
    console.error(JSON.stringify({ status: process.exitCode === 1 ? 'FAIL_F1_CPU_SUBSET' : 'INCOMPLETE', cause: { name: cause.name, message: cause.message, code: cause.code },
      action: 'Preserve output and follow the existing repository dependency/build guide. Retry only with a fresh external output.' }));
  }
}
