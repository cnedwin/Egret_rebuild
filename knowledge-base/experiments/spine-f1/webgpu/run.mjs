// SPDX-License-Identifier: Apache-2.0
// Opt-in F1 WebGPU wrapper. No downloads, installs or dependency mutation.
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalized = value => process.platform === 'win32' ? path.resolve(value).replaceAll('\\', '/').toLowerCase() : path.resolve(value);
const samePath = (a, b) => normalized(a) === normalized(b);
const within = (base, file) => { const r = path.relative(normalized(base), normalized(file)); return r === '' || (!path.isAbsolute(r) && r !== '..' && !r.startsWith('..' + path.sep)); };
const fault = error => ({ name: String(error?.name ?? 'Unknown').slice(0, 16384), code: error?.code ?? null,
  message: String(error?.message ?? error).slice(0, 16384), details: error?.details ?? null });
const observe = promise => { promise.catch(() => {}); return promise; };
let manifest, manifestBytes, output, report, executionStarted, finishing = false;
let browser, launching, server, timer, currentMode = 'baseline';
const routes = new Map(), inputs = new Map(), inventories = new Map();
async function bounded(promise, label, ms = 15000) {
  let deadline;
  if (!finishing) ms = Math.max(1, Math.min(ms, 90000 - (Date.now() - executionStarted)));
  try { return await Promise.race([observe(promise), new Promise((_, reject) => {
    deadline = setTimeout(() => reject(Object.assign(new Error(`F1_GPU_TIMEOUT:${label}`), { code: 'F1_GPU_TIMEOUT' })), ms);
  })]); } finally { clearTimeout(deadline); }
}
function absolute(file) {
  assert.ok(typeof file === 'string' && path.isAbsolute(file), 'F1_ABSOLUTE_PATH');
  assert.ok(!file.slice(path.parse(file).root.length).split(/[\\/]/).some(part => part === '.' || part === '..' ||
    /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), 'F1_UNSAFE_PATH');
}
async function regular(file) { const stat = await fs.lstat(file); assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'F1_REGULAR_FILE'); }
async function noLinks(file) {
  absolute(file); file = path.resolve(file); const parsed = path.parse(file); let current = parsed.root;
  for (const part of file.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part); assert.equal((await fs.lstat(current)).isSymbolicLink(), false, 'F1_LINK_ANCESTRY');
  }
}
async function pinFile(file) { await regular(file); const bytes = await fs.readFile(file); return { path: file, bytes: bytes.length, sha256: hash(bytes) }; }
async function checkPin(pin) {
  absolute(pin.path); assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes >= 0 && /^[a-f0-9]{64}$/.test(pin.sha256), 'F1_PIN_FORMAT');
  await regular(pin.path); const bytes = await fs.readFile(pin.path);
  assert.equal(bytes.length, pin.bytes, `F1_INPUT_BYTES:${pin.path}`); assert.equal(hash(bytes), pin.sha256, `F1_INPUT_SHA:${pin.path}`);
  inputs.set(normalized(pin.path), pin); return bytes;
}
async function readJSON(pin) { return JSON.parse((await checkPin(pin)).toString('utf8')); }
async function inventory(root) {
  absolute(root); assert.ok(samePath(await fs.realpath(root), root), 'F1_CANONICAL_ROOT');
  const rows = [];
  async function visit(relative) {
    const file = path.join(root, relative), stat = await fs.lstat(file); assert.equal(stat.isSymbolicLink(), false, 'F1_INVENTORY_LINK');
    if (stat.isDirectory()) { for (const name of (await fs.readdir(file)).sort()) await visit(path.join(relative, name)); }
    else { assert.ok(stat.isFile(), 'F1_INVENTORY_FILE'); rows.push({ relative: relative.replaceAll('\\', '/'), ...await pinFile(file) }); }
  }
  await visit(''); rows.sort((a, b) => a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0);
  const digest = hash(Buffer.from(JSON.stringify(rows.map(row => [row.relative, row.bytes, row.sha256]))));
  inventories.set(normalized(root), { root, digest, rows });
  for (const row of rows) await checkPin(row);
  return { rows, digest };
}
async function save(name, bytes) {
  assert.ok(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) && !name.split('/').includes('..'));
  const file = path.join(output, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' });
  const pin = await pinFile(file); report.artifacts.push(pin); return pin;
}
const json = (name, value) => save(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
function addRoute(url, bytes, type, pin) { assert.ok(!routes.has(url), `F1_ROUTE_DUPLICATE:${url}`); routes.set(url, { bytes, type, pin }); }
async function exportEntry(root, key) {
  const metadata = await readJSON(await pinFile(path.join(root, 'package.json'))), value = metadata.exports?.[key];
  const entry = typeof value === 'string' ? value : value?.import;
  assert.ok(typeof entry === 'string' && entry.startsWith('./'), 'F1_PUBLIC_EXPORT');
  const file = path.resolve(root, entry); assert.ok(within(root, file), 'F1_PUBLIC_EXPORT_ESCAPE'); await regular(file); return file;
}
const summary = (text, key) => [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))].at(-1)?.[1];
const tapRows = text => [...text.matchAll(/^\s*(not )?ok \d+ - (.+)\s*$/gm)].map(match => ({ failed: match[1] !== undefined, name: match[2].trim() }));
async function childReceipt(pin, cpuRoot, expectedName, expectedCode) {
  assert.ok(within(cpuRoot, pin.path), 'F1_CPU_RECEIPT_OUTSIDE'); const row = await readJSON(pin);
  assert.equal(row.name, expectedName); assert.equal(row.exitCode, expectedCode); assert.equal(row.timeout, false);
  assert.equal(row.signal, null); assert.equal(row.launchError, undefined); assert.ok(samePath(row.executable, process.execPath), 'F1_CPU_NODE_IDENTITY');
  assert.ok(Date.parse(row.finishedAtUTC) >= Date.parse(row.startedAtUTC), 'F1_CPU_RECEIPT_TIME');
  for (const stream of [row.stdout, row.stderr]) assert.ok(within(cpuRoot, stream.path), 'F1_CPU_LOG_OUTSIDE');
  const stdout = (await checkPin(row.stdout)).toString('utf8'), stderr = (await checkPin(row.stderr)).toString('utf8');
  assert.equal(stderr, '', 'F1_CPU_STDERR'); return { row, stdout, stderr };
}
function baseline(stdout, source) {
  assert.equal(summary(stdout, 'tests'), '12'); assert.equal(summary(stdout, 'pass'), '12'); assert.equal(summary(stdout, 'fail'), '0');
  const rows = tapRows(stdout); for (const name of source.setupSubtests) assert.ok(rows.some(row => !row.failed && row.name === name), 'F1_CPU_GENUINE_SETUP');
  assert.ok(!/ERR_MODULE_NOT_FOUND|RENDERER_REQUIRED|INPUT_(?:BYTES|SHA256)_CHANGED/.test(stdout), 'F1_CPU_SETUP_FAILURE');
}
async function inputAdmission(inputPin, playwrightEntry) {
  const handoff = await readJSON(inputPin), cpuRoot = path.dirname(inputPin.path);
  assert.equal(handoff.schemaVersion, 1); assert.equal(handoff.kind, 'CURRENT_F1_CPU_COMPLETED_NATIVE_HANDOFF');
  assert.deepEqual(Object.keys(handoff).sort(), ['schemaVersion', 'kind', 'cpuCollection', 'canonicalQualification', 'currentSDKSnapshot', 'publicManifest', 'sdk', 'core', 'stage', 'stagedInputs', 'emittedInputs', 'oracle', 'playwright', 'stableNativeProfile', 'aliases', 'nativeAcceptance', 'licensingQualification'].sort(), 'F1_FINITE_HANDOFF_SCHEMA');
  assert.equal(handoff.nativeAcceptance, 'NOT_RUN'); assert.equal(handoff.licensingQualification, 'unverified');
  for (const name of ['cpuCollection', 'canonicalQualification', 'currentSDKSnapshot']) assert.ok(within(cpuRoot, handoff[name].path), 'F1_HANDOFF_RECEIPT_ROOT');
  assert.ok(samePath(handoff.cpuCollection.path, path.join(cpuRoot, 'cpu-collection.json')));
  const collection = await readJSON(handoff.cpuCollection), source = await readJSON(handoff.publicManifest), sdk = await readJSON(handoff.currentSDKSnapshot);
  assert.ok(samePath(handoff.publicManifest.path, path.join(here, '../manifest.json')), 'F1_CURRENT_PUBLIC_MANIFEST');
  assert.equal(source.schemaVersion, 1); assert.equal(source.root, 'knowledge-base/experiments/spine-f1');
  assert.equal(collection.status, 'PASS_F1_CPU_SUBSET'); assert.equal(collection.inputIdentitiesUnchanged, true);
  assert.equal(collection.historicalTreeAssignedToCurrentClone, false); assert.deepEqual(collection.before, collection.after);
  assert.deepEqual(collection.publicManifest, handoff.publicManifest); assert.deepEqual(collection.currentSDKSnapshot, handoff.currentSDKSnapshot);
  assert.deepEqual(collection.currentCanonicalQualification, handoff.canonicalQualification);
  assert.deepEqual(collection.originalTests.total, 12); assert.equal(collection.originalTests.passed, 12); assert.equal(collection.originalTests.childContracts, 11);
  assert.equal(collection.native, 'REQUESTED_PENDING_SEPARATE_ENTRY');
  assert.equal(collection.runtime.node, 'v24.19.0'); assert.ok(samePath(collection.runtime.executable, process.execPath));
  assert.ok(Number.isFinite(Date.parse(collection.generatedAtUTC)), 'F1_CPU_COMPLETED_CUTOFF');
  assert.equal(sdk.kind, 'CURRENT_CLONE_BUILT_PUBLIC_INPUTS'); assert.equal(sdk.historicalTreeBinding, false); assert.deepEqual(sdk, handoff.sdk);
  assert.ok(samePath(sdk.root, path.resolve(here, '../../../..')), 'F1_CURRENT_CHECKOUT');
  const publicFiles = new Map();
  for (const pin of source.files) {
    assert.ok(typeof pin.path === 'string' && pin.path.startsWith(source.root + '/') && !pin.path.split('/').includes('..'));
    const file = path.resolve(sdk.root, pin.path); assert.ok(within(sdk.root, file));
    const current = { ...pin, path: file }; await checkPin(current); publicFiles.set(pin.path.slice(source.root.length + 1), current);
  }
  assert.equal(publicFiles.size, 8);
  assert.equal(collection.before.publicFiles, 8);
  assert.equal(collection.before.sdkSourceAndDistFiles, sdk.rows.length);
  assert.equal(collection.before.dependenciesAndHelperFiles, sdk.files.length);
  assert.equal(collection.before.coreFiles, 137);
  assert.equal(collection.before.coreContentDigestSHA256, manifest.core.contentDigestSHA256);
  for (const [relative, expected] of Object.entries(manifest.originalInputs)) {
    const actual = publicFiles.get(relative); assert.ok(actual, 'F1_ORIGINAL_INPUT_REQUIRED');
    assert.equal(actual.bytes, expected.bytes); assert.equal(actual.sha256, expected.sha256);
  }
  const sdkFiles = new Map();
  for (const pin of sdk.rows) {
    assert.ok(/^packages\/(contracts|runtime|engine|project)\/(?:package\.json|(?:src|dist)\/.+)$/.test(pin.path) && !pin.path.split('/').includes('..'), 'F1_SDK_ROW_SCOPE');
    const actual = { ...pin, path: path.join(sdk.root, pin.path) }; await checkPin(actual); assert.ok(!sdkFiles.has(normalized(actual.path)));
    sdkFiles.set(normalized(actual.path), actual);
  }
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    const root = sdk.packageRoots[name]; assert.ok(samePath(root, path.join(sdk.root, 'packages', name)));
    const metadata = await readJSON(await pinFile(path.join(root, 'package.json'))); assert.equal(metadata.name, `@egret/${name}`);
    const observed = [await pinFile(path.join(root, 'package.json'))];
    for (const directory of ['src', 'dist']) observed.push(...(await inventory(path.join(root, directory))).rows);
    const expected = [...sdkFiles.values()].filter(row => within(root, row.path));
    const tuples = rows => rows.map(row => [normalized(row.path), row.bytes, row.sha256]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    assert.deepEqual(tuples(observed), tuples(expected), 'F1_SDK_COMPLETE_CURRENT_INVENTORY');
  }
  for (const pin of sdk.files) await checkPin(pin);
  assert.equal(sdk.dependencies.length, 2);
  for (const dependency of sdk.dependencies) {
    assert.ok((dependency.name === 'robust-predicates' && dependency.version === '3.0.3') || (dependency.name === 'jsonc-parser' && dependency.version === '3.3.1'));
    const metadata = await readJSON(await pinFile(path.join(dependency.root, 'package.json')));
    assert.equal(metadata.name, dependency.name); assert.equal(metadata.version, dependency.version);
    const current = await inventory(dependency.root); assert.equal(current.digest, dependency.contentDigestSHA256);
    for (const row of current.rows) assert.ok(sdk.files.some(pin => samePath(pin.path, row.path) && pin.bytes === row.bytes && pin.sha256 === row.sha256), 'F1_SDK_DEPENDENCY_CLOSURE');
  }
  assert.equal(new Set(sdk.dependencies.map(row => row.name)).size, 2);
  const core = handoff.core; assert.equal(core.regularFileCount, 137); assert.equal(core.contentDigestSHA256, manifest.core.contentDigestSHA256);
  assert.deepEqual(collection.currentCore, { root: core.root, files: 137, contentDigestSHA256: core.contentDigestSHA256 });
  assert.equal(source.core.contentDigestSHA256, core.contentDigestSHA256);
  assert.ok(!within(sdk.root, core.root) && !within(core.root, sdk.root), 'F1_CORE_EXTERNAL_ONLY');
  const corePackage = await readJSON(await pinFile(path.join(core.root, 'package.json')));
  assert.equal(corePackage.name, manifest.core.name); assert.equal(corePackage.version, manifest.core.version);
  const coreInventory = await inventory(core.root); assert.equal(coreInventory.rows.length, 137); assert.equal(coreInventory.digest, core.contentDigestSHA256);
  const compiler = collection.currentCompiler, compilerMetadata = await readJSON(await pinFile(path.join(compiler.root, 'package.json')));
  assert.equal(compilerMetadata.name, 'typescript'); assert.equal(compilerMetadata.version, '7.0.2');
  assert.equal((await inventory(compiler.root)).digest, compiler.contentDigestSHA256); for (const pin of compiler.files) await checkPin(pin);
  assert.ok(samePath(compiler.entry, path.join(compiler.root, 'bin/tsc')));
  assert.equal(collection.canonicalReceipts.length, 3);
  const typed = await childReceipt(collection.canonicalReceipts[0], cpuRoot, 'strict-types', 0);
  assert.deepEqual(typed.row.args, [compiler.entry, '--project', 'tsconfig.json', '--pretty', 'false']);
  assert.ok(samePath(typed.row.cwd, handoff.stage));
  const canonical = await childReceipt(collection.canonicalReceipts[1], cpuRoot, 'core-qualification', 0);
  const qualification = await readJSON(handoff.canonicalQualification); assert.deepEqual(JSON.parse(canonical.stdout.trim()), qualification);
  assert.equal(qualification.status, 'ACTUAL_CURRENT_F1_CANONICAL_QUALIFICATION'); assert.equal(qualification.upstreamFilesBeforeAfterUnchanged, true);
  assert.deepEqual(qualification.core, { version: '4.3.13', contentDigestSHA256: core.contentDigestSHA256, files: 137 });
  assert.equal(qualification.precision.tolerance, 2 ** -20);
  const premises = qualification.precision.hostPremises; assert.equal(premises.cosZero, 1); assert.equal(premises.sinZero, 0);
  assert.ok(Math.abs(premises.quarterCos) <= 2.4e-8 && Math.abs(premises.quarterSin - 1) <= 2 ** -48);
  for (const pin of qualification.currentInputPins) await checkPin(pin);
  const original = await childReceipt(collection.originalTests.receipt, cpuRoot, 'original-manual-behavior', 0); baseline(original.stdout, source);
  assert.deepEqual(collection.originalTests.receipt, collection.canonicalReceipts[2]);
  assert.equal(collection.controls.length, 6); assert.deepEqual(collection.controls.map(row => row.id), source.controls.map(row => row.id));
  for (let index = 0; index < 6; index++) {
    const control = collection.controls[index], definition = source.controls[index];
    assert.equal(control.status, 'ACTUAL_FINITE_ASSIGNED_CONTROL_PASS'); assert.equal(control.ownedCopyRestored, true);
    baseline((await childReceipt(control.canonicalBaseline, cpuRoot, 'canonical-baseline', 0)).stdout, source);
    const actor = await childReceipt(control.actor, cpuRoot, definition.kind === 'behavior-fault' ? 'assigned-fault' : 'supplement', definition.kind === 'behavior-fault' ? 1 : 0);
    if (definition.kind === 'behavior-fault') {
      assert.ok(actor.stdout.includes(definition.marker)); const rows = tapRows(actor.stdout);
      for (const name of source.setupSubtests) assert.ok(rows.some(row => !row.failed && row.name === name));
      const failed = rows.filter(row => row.failed && row.name !== source.parentTest);
      assert.ok(failed.length > 0 && failed.every(row => definition.allowedFailingSubtests.includes(row.name)) && failed.some(row => row.name === definition.assignedSubtest));
      assert.ok(!/ERR_MODULE_NOT_FOUND|RENDERER_REQUIRED|INPUT_(?:BYTES|SHA256)_CHANGED/.test(actor.stdout));
    } else {
      const observed = JSON.parse(actor.stdout.trim()); assert.equal(observed.status, definition.expectedStatus);
      assert.deepEqual(observed.hostTrace, ['start', 'stop', 'close']); assert.equal(observed.timers, 0);
      assert.deepEqual(observed.counters, { headerLoads: 2, headerDisposals: 2, pageLoads: 1, pageDisposals: 1 });
      if (control.id === 'unsupported-additive') { assert.equal(observed.wrapperCode, 'F1_RESOURCE_LOAD_FAILED'); assert.equal(observed.originalCauseCode, 'F1_NORMAL_LIGHT_TINT_REQUIRED'); assert.equal(observed.published, false); }
      else { assert.equal(control.id, 'injected-after-advance'); assert.equal(observed.namedFault, 'F1_INJECTED_AFTER_ADVANCE'); assert.equal(observed.AElapsedUnchanged, true); assert.equal(observed.AContinuation0125Refused, 'F1_INSTANCE_TERMINAL'); assert.equal(observed.BFour0125Steps, .5); assert.equal(observed.BOriginalLiteralGeometry, true); assert.equal(observed.sharedPageLiveUntilResourceClose, true); }
    }
  }
  assert.ok(samePath(handoff.stage, path.join(cpuRoot, 'canonical/copy'))); await noLinks(handoff.stage);
  assert.equal(handoff.stagedInputs.length, publicFiles.size);
  for (const pin of handoff.stagedInputs) {
    assert.ok(within(handoff.stage, pin.path)); const relative = path.relative(handoff.stage, pin.path).replaceAll('\\', '/');
    const originalPin = publicFiles.get(relative); assert.ok(originalPin && originalPin.bytes === pin.bytes && originalPin.sha256 === pin.sha256, 'F1_STAGE_SOURCE_IDENTITY'); await checkPin(pin);
  }
  assert.equal(new Set(handoff.stagedInputs.map(row => normalized(row.path))).size, publicFiles.size);
  const emitted = await inventory(path.join(handoff.stage, 'out'));
  const emissionTuples = rows => rows.map(row => [normalized(row.path), row.bytes, row.sha256]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  assert.deepEqual(emissionTuples(emitted.rows), emissionTuples(handoff.emittedInputs), 'F1_COMPLETE_EMISSION');
  for (const control of collection.controls) {
    const copy = path.join(cpuRoot, 'controls', control.id, 'copy'); await noLinks(copy);
    const canonical = await readJSON(control.canonicalBaseline), actor = await readJSON(control.actor);
    assert.ok(samePath(canonical.cwd, copy) && samePath(actor.cwd, copy), 'F1_OWNED_CONTROL_COPY');
    assert.ok(Date.parse(canonical.finishedAtUTC) <= Date.parse(actor.startedAtUTC) && Date.parse(actor.finishedAtUTC) <= Date.parse(collection.generatedAtUTC), 'F1_CONTROL_COMPLETED_BEFORE_HANDOFF');
    for (const pin of [...handoff.stagedInputs, ...handoff.emittedInputs]) await checkPin({ ...pin, path: path.join(copy, path.relative(handoff.stage, pin.path)) });
  }
  const config = await readJSON(await pinFile(path.join(handoff.stage, 'tsconfig.json')));
  assert.deepEqual(config, { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: [], strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: false, noEmitOnError: true, declaration: true, rootDir: 'src', outDir: 'out' }, include: ['src/**/*.ts'] });
  for (const [relative, target] of [['node_modules/@egret/engine', sdk.packageRoots.engine], ['node_modules/@esotericsoftware/spine-core', core.root]]) assert.ok(samePath(await fs.realpath(path.join(handoff.stage, relative)), target), 'F1_GENUINE_STAGE_DEPENDENCY');
  assert.ok(samePath(handoff.oracle.path, path.join(handoff.stage, 'fixtures/f1-oracle.json'))); const oracle = await readJSON(handoff.oracle);
  assert.equal(handoff.oracle.sha256, manifest.originalInputs['fixtures/f1-oracle.json'].sha256); assert.equal(oracle.nativeSuccessor.channelTolerance, 0);
  assert.equal(oracle.numericPolicy.position.absolute, 2 ** -20);
  const profile = source.nativeProfile; assert.deepEqual(profile, handoff.stableNativeProfile);
  for (const [key, value] of Object.entries(manifest.profile)) assert.equal(profile[key], value, 'F1_FIXED_NATIVE_PROFILE');
  assert.ok(samePath(playwrightEntry, handoff.playwright.entry)); assert.ok(samePath(path.dirname(playwrightEntry), handoff.playwright.root));
  for (const pin of handoff.playwright.files) { assert.ok(within(handoff.playwright.root, pin.path)); await checkPin(pin); }
  assert.equal(handoff.playwright.files.length, 2); assert.ok(handoff.playwright.files.some(pin => samePath(pin.path, playwrightEntry)));
  const playwrightMetadata = await readJSON(await pinFile(path.join(handoff.playwright.root, 'package.json')));
  assert.equal(playwrightMetadata.name, 'playwright'); assert.equal(playwrightMetadata.version, manifest.execution.playwrightVersion);
  assert.equal(playwrightMetadata.exports?.['.']?.import, './index.mjs'); await inventory(handoff.playwright.root);
  const require = createRequire(path.join(handoff.playwright.root, 'package.json'));
  const playwrightCore = path.dirname(require.resolve('playwright-core/package.json'));
  const playerCoreMetadata = await readJSON(await pinFile(path.join(playwrightCore, 'package.json')));
  assert.equal(playerCoreMetadata.name, 'playwright-core'); assert.equal(playerCoreMetadata.version, manifest.execution.playwrightVersion); await inventory(playwrightCore);
  const aliases = handoff.aliases;
  const expected = { engine: ['@egret/engine', await exportEntry(sdk.packageRoots.engine, '.'), 'Current clone public export'],
    webgpu: ['@egret/engine/webgpu', await exportEntry(sdk.packageRoots.engine, './webgpu'), 'Current clone public export'],
    spineCore: ['@esotericsoftware/spine-core', path.join(core.root, corePackage.main), 'Unmodified supplied official package'],
    bridge: ['#f1-manual-bridge', path.join(handoff.stage, 'out/f1-manual-bridge.js'), 'Compiled independently authored original bridge'],
    canonical: ['#f1-canonical', path.join(handoff.stage, 'out/canonical-baseline.js'), 'Compiled independently authored original probe'] };
  assert.deepEqual(Object.keys(aliases).sort(), Object.keys(expected).sort());
  for (const [key, [specifier, entry, provenance]] of Object.entries(expected)) { assert.equal(aliases[key].specifier, specifier); assert.equal(aliases[key].provenance, provenance); assert.ok(samePath(aliases[key].entry, entry), 'F1_PUBLIC_ALIAS_IDENTITY'); }
  assert.ok(samePath(sdk.engineEntry, aliases.engine.entry)); assert.ok(samePath(sdk.spinePlanningEntry, await exportEntry(sdk.packageRoots.project, './spine')));
  const engineMetadata = await readJSON(await pinFile(path.join(sdk.packageRoots.engine, 'package.json')));
  const registryEntry = engineMetadata.imports?.['#egret-textured-frame-state']?.import;
  assert.equal(registryEntry, './dist/internal/texturedFrameState.js');
  const robust = sdk.dependencies.find(row => row.name === 'robust-predicates');
  const bare = new Map([['@egret/engine', aliases.engine.entry], ['@egret/engine/webgpu', aliases.webgpu.entry],
    ['@egret/contracts', await exportEntry(sdk.packageRoots.contracts, '.')], ['@egret/runtime', await exportEntry(sdk.packageRoots.runtime, '.')],
    ['@esotericsoftware/spine-core', aliases.spineCore.entry], ['#f1-manual-bridge', aliases.bridge.entry],
    ['#egret-textured-frame-state', path.join(sdk.packageRoots.engine, registryEntry)], ['robust-predicates', path.join(robust.root, 'index.js')]]);
  assert.deepEqual([...bare.keys()].sort(), manifest.modulePolicy.bareSpecifiers.slice().sort());
  const official = new Map(coreInventory.rows.map(row => [normalized(row.path), row])), thirdParty = new Map((await inventory(robust.root)).rows.map(row => [normalized(row.path), row]));
  function admitted(file) {
    assert.ok(file.endsWith('.js'), 'F1_BROWSER_JS_ONLY');
    if (sdkFiles.has(normalized(file))) { assert.ok(/^packages\/(contracts|runtime|engine|project)\/dist\/.+\.js$/.test(path.relative(sdk.root, file).replaceAll('\\', '/'))); return { pin: sdkFiles.get(normalized(file)), url: '/sdk/' + path.relative(sdk.root, file).replaceAll('\\', '/') }; }
    if (official.has(normalized(file))) return { pin: official.get(normalized(file)), url: '/core/' + path.relative(core.root, file).replaceAll('\\', '/') };
    if (thirdParty.has(normalized(file))) return { pin: thirdParty.get(normalized(file)), url: '/dependency/robust-predicates/' + path.relative(robust.root, file).replaceAll('\\', '/') };
    assert.ok([aliases.bridge.entry, aliases.canonical.entry].some(entry => samePath(file, entry)), 'F1_BROWSER_MODULE_NOT_ADMITTED');
    const pin = handoff.emittedInputs.find(row => samePath(row.path, file)); assert.ok(pin); return { pin, url: '/manual/' + path.relative(handoff.stage, file).replaceAll('\\', '/') };
  }
  const modules = new Map(); let totalBytes = 0, edgeCount = 0;
  async function visit(file) {
    const key = normalized(file); if (modules.has(key)) return modules.get(key);
    const row = admitted(file), bytes = await checkPin(row.pin), text = bytes.toString('utf8'); totalBytes += bytes.length;
    assert.ok(modules.size < manifest.modulePolicy.maxModules && totalBytes <= manifest.modulePolicy.maxBytes, 'F1_MODULE_GRAPH_BUDGET');
    const record = { ...row.pin, url: row.url, edges: [] }; modules.set(key, record); addRoute(row.url, bytes, 'text/javascript; charset=utf-8', row.pin);
    const specifiers = new Set([...text.matchAll(/(?:import|export)\s+(?:[^;]*?\bfrom\s+)?(['"])([^'"\r\n]+)\1/g)].map(match => match[2]));
    for (const call of text.matchAll(/\bimport\s*\(([^)]*)\)/g)) {
      const literal = /^\s*(['"])([^'"\r\n]+)\1\s*$/.exec(call[1]); assert.ok(literal, 'F1_NONLITERAL_IMPORT_REFUSED'); specifiers.add(literal[2]);
    }
    for (const specifier of specifiers) {
      assert.ok(!specifier.includes('\\') && !specifier.includes('?') && !specifier.includes('#', 1), 'F1_IMPORT_LITERAL_FORMAT');
      const target = specifier.startsWith('./') || specifier.startsWith('../') ? path.resolve(path.dirname(file), specifier) : bare.get(specifier);
      assert.ok(target, `F1_BARE_IMPORT_NOT_ADMITTED:${specifier}`); const edge = await visit(target); record.edges.push({ specifier, url: edge.url });
      assert.ok(++edgeCount <= manifest.modulePolicy.maxEdges, 'F1_MODULE_EDGE_BUDGET');
    }
    return record;
  }
  for (const file of [aliases.engine.entry, aliases.webgpu.entry, aliases.bridge.entry]) await visit(file);
  const importMap = Object.fromEntries([...bare].map(([specifier, file]) => [specifier, admitted(file).url]));
  for (const record of modules.values()) for (const edge of record.edges) assert.ok(routes.has(edge.url), 'F1_LITERAL_GRAPH_CLOSED');
  await json('browser-module-graph.json', { schemaVersion: 1, entries: { engine: importMap['@egret/engine'], webgpu: importMap['@egret/engine/webgpu'], bridge: importMap['#f1-manual-bridge'] }, importMap, modules: [...modules.values()], totalBytes, edgeCount,
    registry: { alias: '#egret-textured-frame-state', url: importMap['#egret-textured-frame-state'], scope: 'Only genuine SDK transitive imports; harness does not import this private entry.' } });
  const fixtures = {};
  for (const [key, relative] of Object.entries(manifest.fixturePaths)) {
    const pin = handoff.stagedInputs.find(row => samePath(row.path, path.join(handoff.stage, relative))); assert.ok(pin);
    const type = key === 'page' ? 'application/octet-stream' : key === 'oracle' || key === 'skeleton' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
    fixtures[key] = { ...pin, url: '/manual/' + relative, type, maxBytes: pin.bytes };
    addRoute(fixtures[key].url, await checkPin(pin), type, pin);
  }
  const bridgeBytes = await checkPin(handoff.emittedInputs.find(row => samePath(row.path, aliases.bridge.entry)));
  assert.equal(hash(bridgeBytes), manifest.bridgeEmissionSHA256, 'F1_ORIGINAL_BRIDGE_EMISSION');
  const text = bridgeBytes.toString('utf8'); assert.equal(text.split(manifest.control.from).length - 1, 1, 'F1_NATIVE_DOUBLE_HUNK_UNIQUE');
  const changed = Buffer.from(text.replace(manifest.control.from, manifest.control.to)); assert.equal(hash(changed), manifest.control.changedSHA256);
  report.inputAdmission = { cpuCollection: handoff.cpuCollection, qualification: handoff.canonicalQualification, currentSDKSnapshot: handoff.currentSDKSnapshot,
    publicManifest: handoff.publicManifest, sdkFiles: sdk.rows.length, coreFiles: 137, controls: 6, originalTests: 12,
    compilerContentDigestSHA256: compiler.contentDigestSHA256, moduleCount: modules.size, edgeCount,
    inputPinCount: inputs.size, contentEnvelopes: [...inventories.values()].map(row => ({ root: row.root, files: row.rows.length, digestSHA256: row.digest })),
    originalSourceIdentityIsNotCurrentCloneTree: true, licensingQualification: 'unverified' };
  report.controlPlanned = { onlyAfterCleanPositive: true, originalSHA256: hash(bridgeBytes), changedSHA256: hash(changed), exactHunks: 1 };
  return { changed, oracle, importMap, bridgeURL: importMap['#f1-manual-bridge'], config: mode => Buffer.from(JSON.stringify({ mode, fixtures })) };
}

// Fixed raw/scene assertions are retained from the original experiment below.
function rawCheck(row, mode, oracle, seen) {
  const expectedIds = mode === 'baseline' ? manifest.observations.map(item => item.id) : ['F1D01'];
  assert.equal(row.id, expectedIds[seen.size], 'F1_READBACK_ORDER');
  assert.equal(row.width, 64); assert.equal(row.height, 48); assert.equal(row.bytes.length, 12288);
  assert.ok(row.bytes.every(value => Number.isInteger(value) && value >= 0 && value <= 255));
  assert.ok(Number.isSafeInteger(row.frameId) && row.frameId > 0 && Number.isSafeInteger(row.serial) && row.serial > 0);
  assert.equal(row.format, 'rgba8unorm'); assert.ok(['rgba8unorm', 'bgra8unorm'].includes(row.sourceFormat));
  assert.equal(row.colorSpace, 'srgb'); assert.equal(row.alphaMode, 'premultiplied');
  const planned = mode === 'baseline' ? manifest.observations[seen.size] : { time: .5 };
  assert.equal(row.time, planned.time);
  const bytes = Buffer.from(row.bytes), failures = [];
  for (const sample of oracle.frames.find(frame => frame.t === row.time).pixels) {
    const [x, y] = sample.xy, actual = [...bytes.subarray(4 * (64 * y + x), 4 * (64 * y + x) + 4)];
    if (!actual.every((value, channel) => value === sample.RGBA[channel])) failures.push({ id: row.id, time: row.time, x, y, expected: sample.RGBA, actual, tolerance: 0 });
  }
  if (planned.equalRawBytesTo) assert.deepEqual(bytes, seen.get(planned.equalRawBytesTo).bytes, 'F1_FULL_REPEAT_BYTES');
  seen.set(row.id, { bytes, failures }); return { bytes, failures };
}
function safeNative(window) {
  const host = window?.cleanup?.host, p = window?.cleanup?.provider;
  return host?.status?.state === 'closed' && host.status.cleanupOutcome === 'safe' &&
    host.status.pendingFrames === 0 && host.status.pendingUploadBytes === 0 && host.status.pendingReadbackBytes === 0 && host.texturedStatus.pendingGeometryBytes === 0 &&
    window.cleanup.deviceDestroyed === true && window.cleanup.deviceLoss?.destroyRequested === true && window.cleanup.failures.length === 0 &&
    window.diagnostics.length === 0 && window.uncaptured.length === 0 && !window.eventOverflow && !window.unexpectedDeviceLoss &&
    p?.headerLoads === 2 && p.headerDisposals === 2 && p.pageLoads === 1 && p.pageDisposals === 1 && p.pageDisposed === true && p.ADisposed === true && p.BDisposed === true;
}
async function windowRun(mode, origin, oracle) {
  currentMode = mode;
  const context = await bounded(browser.newContext({ deviceScaleFactor: 1, viewport: { width: 128, height: 96 } }), 'context');
  let page, closed = false;
  const seen = new Map(), events = [], requests = [];
  const result = { mode, status: 'INCOMPLETE', scene: null, events, requests, contextClosed: false };
  report.windows.push(result);
  const event = row => { if (events.length >= 32) result.eventOverflow = true; else events.push(row); };
  try {
    page = await bounded(context.newPage(), 'page');
    page.on('pageerror', error => event({ kind: 'pageerror', ...fault(error) }));
    page.on('requestfailed', request => event({ kind: 'requestfailed', url: request.url(), failure: request.failure() }));
    page.on('request', request => { if (requests.length >= 512) result.requestOverflow = true; else requests.push(request.url()); });
    await page.exposeBinding('__retainF1Readback', async (source, row) => {
      assert.equal(source.frame, page.mainFrame(), 'F1_MAIN_FRAME_BINDING');
      const checked = rawCheck(row, mode, oracle, seen);
      const rawPin = await save(`${mode}/${row.id}.rgba`, checked.bytes);
      await json(`${mode}/${row.id}.json`, { ...row, bytes: undefined, raw: rawPin, independentPixelFailures: checked.failures });
      return { retained: true, sha256: rawPin.sha256 };
    });
    await bounded(page.goto(origin + '/experiment/index.html'), 'page-start');
    await bounded(page.waitForFunction(() => globalThis.f1GPUReady === true), 'module-ready');
    result.scene = await bounded(page.evaluate(mode => globalThis.f1GPU.run(mode), mode), `native-${mode}`, 60000);
    await json(`${mode}/scene.json`, result.scene);
    if (result.scene.status === 'UNSUPPORTED_DEFAULT_ENVIRONMENT') result.status = 'UNSUPPORTED_DEFAULT_ENVIRONMENT';
    else if (mode === 'baseline') {
      if (result.scene.status === 'PIXEL_FAIL') {
        // Admit only the first exact original-oracle mismatch, retained before
        // the scene assertion, with independent raw provenance and safe return.
        assert.equal(result.scene.failure?.code, 'F1_PIXEL_MISMATCH');
        assert.ok(seen.size > 0 && seen.size <= 8, 'F1_PIXEL_FAILURE_RAW_REQUIRED');
        assert.deepEqual(result.scene.observations.map(row => row.id), [...seen.keys()], 'F1_PIXEL_FAILURE_OBSERVATION_BINDING');
        const retainedRows = [...seen.values()], last = retainedRows.at(-1);
        assert.ok(retainedRows.slice(0, -1).every(row => row.failures.length === 0), 'F1_PIXEL_FAILURE_FIRST_OBSERVATION');
        assert.ok(last.failures.length > 0, 'F1_PIXEL_FAILURE_INDEPENDENT_RAW_REQUIRED');
        assert.deepEqual(result.scene.failure.details, last.failures[0], 'F1_PIXEL_FAILURE_ORACLE_PROVENANCE');
        assert.ok(safeNative(result.scene), 'F1_PIXEL_FAILURE_SAFE_CLEANUP');
        result.independentPixelFailure = last.failures[0];
        result.status = 'PIXEL_FAIL';
      } else {
        assert.equal(result.scene.status, 'SCENE_COMPLETED', 'F1_NATIVE_POSITIVE_SCENE');
        assert.equal(seen.size, 8); assert.ok([...seen.values()].every(row => row.failures.length === 0), 'F1_NATIVE_EXACT_PIXELS');
        assert.ok(safeNative(result.scene), 'F1_NATIVE_SAFE_CLEANUP'); result.status = 'PASS_NATIVE_FIXED_F1';
      }
    } else {
      assert.equal(result.scene.status, 'PIXEL_FAIL'); assert.ok(safeNative(result.scene), 'F1_CONTROL_SAFE_CLEANUP');
      assert.equal(result.scene.failure?.code, 'F1_PIXEL_MISMATCH');
      assert.equal(seen.size, 1);
      const failures = seen.get('F1D01').failures;
      assert.ok(failures.some(row => row.time === .5 && row.x === 25 && row.y === 19 &&
        JSON.stringify(row.expected) === '[255,0,0,255]' && JSON.stringify(row.actual) === '[0,0,0,0]'), 'F1_DOUBLE_STEP_MIDPOINT_NOT_KILLED');
      assert.equal(result.scene.failure.details.x, 25); assert.equal(result.scene.failure.details.y, 19);
      result.status = 'PASS_ASSIGNED_NATIVE_DOUBLE_STEP_CONTROL';
    }
    assert.equal(events.length, 0, 'F1_NATIVE_BROWSER_ERRORS');
    assert.ok(!result.eventOverflow && !result.requestOverflow);
    assert.ok(requests.every(url => url.startsWith(origin + '/')), 'F1_NATIVE_OUTSIDE_ORIGIN');
  } catch (cause) {
    result.failure = fault(cause);
    if (page && !page.isClosed()) {
      try { result.scene ??= await bounded(page.evaluate(() => globalThis.f1GPU?.latest() ?? null), 'partial-report', 5000); } catch (partial) { result.partialFailure = fault(partial); }
    }
    result.status = 'INCOMPLETE';
  } finally {
    try { await bounded(context.close(), 'context-close', 20000); closed = true; }
    catch (cause) { result.closeFailure = fault(cause); result.status = 'INCOMPLETE'; }
    result.contextClosed = closed;
  }
  return result;
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Original F1 WebGPU experiment, optional completed-CPU successor.\n' +
      'node webgpu/run.mjs --input <absolute CPU-output/native-input.json> --playwright <absolute existing Playwright/index.mjs> --output <absolute CPU-output/native>\n' +
      'Requires Node 24.19.0, existing Playwright 1.62.1, current complete CPU receipts and default headless Edge. No install or download.\n' +
      'Fresh native output only; retries require a fresh CPU output. Exit 0 PASS; 1 PIXEL_FAIL; 2 INCOMPLETE; 3 UNSUPPORTED_DEFAULT_ENVIRONMENT.\n' +
      'Official runtime remains external; integration/distribution qualification is unverified.\n' +
      'https://esotericsoftware.com/spine-runtimes-license\nhttps://esotericsoftware.com/spine-editor-license#s2');
    return;
  }
  assert.equal(args.length, 6, 'F1_GPU_THREE_CLI_OPTIONS_REQUIRED'); const options = {};
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(['--input', '--playwright', '--output'].includes(args[index]) && !Object.hasOwn(options, args[index]));
    absolute(args[index + 1]); options[args[index]] = path.resolve(args[index + 1]);
  }
  assert.equal(process.version, 'v24.19.0', 'F1_GPU_NODE_VERSION'); assert.equal(process.execArgv.length, 0, 'F1_GPU_NO_NODE_FLAGS');
  assert.ok(!process.env.NODE_OPTIONS && !process.env.NODE_PATH, 'F1_GPU_NO_INHERITED_PRELOADS');
  assert.equal(path.basename(options['--input']), 'native-input.json', 'F1_NATIVE_HANDOFF_NAME'); await noLinks(options['--input']);
  const cpuRoot = path.dirname(options['--input']); output = options['--output'];
  assert.ok(samePath(output, path.join(cpuRoot, 'native')), 'F1_GPU_OUTPUT_FRESH_CPU_NATIVE_CHILD'); await noLinks(cpuRoot);
  const existing = await fs.lstat(output).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  assert.equal(existing, null, 'F1_GPU_OUTPUT_COLLISION_NO_REPLACEMENT');
  const handoff = JSON.parse(await fs.readFile(options['--input'], 'utf8'));
  for (const root of [here, handoff.sdk.root, handoff.core.root, handoff.playwright.root]) {
    absolute(root); assert.ok(!within(root, output) && !within(output, root), 'F1_GPU_OUTPUT_INTERSECTS_INPUT');
  }
  manifestBytes = await fs.readFile(path.join(here, 'manifest.json')); manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.root, 'knowledge-base/experiments/spine-f1/webgpu');
  await fs.mkdir(output); // Existing evidence is never removed or reused.
  executionStarted = Date.now();
  report = { schemaVersion: 1, status: 'INCOMPLETE', startedAtUTC: new Date().toISOString(), manifestSHA256: hash(manifestBytes),
    launch: { channel: 'msedge', headless: true, callerAddedFlags: [], deviceScaleFactor: 1 },
    runner: { pid: process.pid, executable: process.execPath, nodeVersion: process.version },
    edgeExecutableIdentity: 'UNOBSERVED_ACTUAL_CHANNEL_PATH_AND_PID_REQUIRE_SEPARATE_PROCESS_EVIDENCE',
    edgeProcessRetirement: 'UNOBSERVED_COOPERATIVE_API_IS_NOT_OS_PROOF', windows: [], artifacts: [], routes: [], failures: [],
    cleanup: { browserClosed: false, serverClosed: false }, licensingQualification: 'unverified',
    scope: 'Original shallow F1 WebGPU/readback subset only; no mobile/native-platform/fullSpine/physical acceleration/performance/distribution qualification.' };
  try {
    timer = setTimeout(() => {
      report.status = 'INCOMPLETE_HARD_DEADLINE'; report.forcedTerminationIsNotSafeCleanup = true;
      try { writeFileSync(path.join(output, 'hard-deadline.json'), JSON.stringify(report) + '\n', { flag: 'wx' }); } catch {}
      process.exit(2); // Outer process retirement remains separately unobserved.
    }, 120000);
    assert.deepEqual(manifest.authoredFiles.map(row => row.path).sort(), ['index.html', 'main.mjs', 'run.mjs']);
    for (const pin of manifest.authoredFiles) await checkPin({ ...pin, path: path.join(here, pin.path) });
    const staged = await inputAdmission(await pinFile(options['--input']), options['--playwright']);
    const html = (await fs.readFile(path.join(here, 'index.html'))).toString('utf8');
    assert.equal(html.split('__F1_IMPORT_MAP__').length - 1, 1);
    addRoute('/experiment/main.mjs', await fs.readFile(path.join(here, 'main.mjs')), 'text/javascript; charset=utf-8');
    const requestRows = [];
    server = createServer((request, response) => {
      const url = request.url;
      if (requestRows.length >= 512) { report.requestOverflow = true; response.writeHead(429).end(); return; }
      let row;
      if (url === '/experiment/index.html') {
        const map = { imports: { ...staged.importMap, '#f1-manual-bridge': currentMode === 'baseline' ? staged.bridgeURL : '/control/out/f1-manual-bridge.js' } };
        row = { bytes: Buffer.from(html.replace('__F1_IMPORT_MAP__', JSON.stringify(map))), type: 'text/html; charset=utf-8' };
      } else if (url === '/experiment/config.json') row = { bytes: staged.config(currentMode), type: 'application/json; charset=utf-8' };
      else row = routes.get(url);
      if (request.method !== 'GET' || !row) { report.unknownRoute = true; response.writeHead(404).end(); requestRows.push({ url, status: 404 }); return; }
      requestRows.push({ url, mode: currentMode, bytes: row.bytes.length, sha256: hash(row.bytes), source: row.pin?.path ?? 'authored/generated harness' });
      response.writeHead(200, { 'content-type': row.type, 'cache-control': 'no-store' }); response.end(row.bytes);
    });
    await bounded(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 'server-start');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const playwright = await import(pathToFileURL(options['--playwright']).href);
    launching = observe(playwright.chromium.launch({ channel: 'msedge', headless: true }).then(value => { browser = value; return value; }));
    browser = await bounded(launching, 'default-edge-launch');
    browser.on('disconnected', () => { if (!finishing) report.unexpectedBrowserDisconnect = true; });
    report.browserVersion = browser.version(); report.origin = origin;
    const positive = await windowRun('baseline', origin, staged.oracle);
    if (positive.status === 'PASS_NATIVE_FIXED_F1') {
      const copied = await save('generated/double-state-step/out/f1-manual-bridge.js', staged.changed);
      addRoute('/control/out/f1-manual-bridge.js', staged.changed, 'text/javascript; charset=utf-8', copied);
      const control = await windowRun('double-state-step', origin, staged.oracle);
      if (control.status === 'PASS_ASSIGNED_NATIVE_DOUBLE_STEP_CONTROL') report.status = 'PASS_F1_NATIVE_SUBSET';
    } else report.status = positive.status;
    report.routes = requestRows;
  } catch (cause) { report.failures.push(fault(cause)); report.status = 'INCOMPLETE'; }
  finally {
    finishing = true;
    if (launching && !browser) try { await bounded(launching, 'late-browser-acquire', 20000); } catch (cause) { report.failures.push(fault(cause)); }
    if (browser) try { await bounded(browser.close(), 'browser-close', 20000); report.cleanup.browserClosed = !browser.isConnected(); } catch (cause) { report.failures.push(fault(cause)); }
    if (server) try { await bounded(new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections?.(); }), 'server-close', 20000); report.cleanup.serverClosed = true; } catch (cause) { report.failures.push(fault(cause)); }
    try {
      for (const pin of inputs.values()) await checkPin(pin);
      report.beforeAfterContentEnvelopes = [];
      for (const snapshot of [...inventories.values()]) {
        const current = await inventory(snapshot.root); assert.equal(current.digest, snapshot.digest, 'F1_BEFORE_AFTER_CONTENT_ENVELOPE');
        report.beforeAfterContentEnvelopes.push({ root: snapshot.root, filesBefore: snapshot.rows.length, filesAfter: current.rows.length, beforeSHA256: snapshot.digest, afterSHA256: current.digest });
      }
      assert.equal(hash(await fs.readFile(path.join(here, 'manifest.json'))), hash(manifestBytes));
      for (const pin of report.artifacts) { const now = await pinFile(pin.path); assert.equal(now.bytes, pin.bytes); assert.equal(now.sha256, pin.sha256); }
      report.originalInputsAndArtifactsUnchanged = true;
    } catch (cause) { report.failures.push(fault(cause)); }
    if (report.failures.length || report.unknownRoute || report.requestOverflow || report.unexpectedBrowserDisconnect ||
      (browser && !report.cleanup.browserClosed) || (server && !report.cleanup.serverClosed) || !report.originalInputsAndArtifactsUnchanged) report.status = 'INCOMPLETE';
    report.cleanup.externalProcessBoundary = 'Cooperative browser/context/server APIs only; actual Edge executable, PID and OS retirement remain unobserved.';
    report.finishedAtUTC = new Date().toISOString(); await json('receipt.json', report); clearTimeout(timer);
  }
  const exitCode = { PASS_F1_NATIVE_SUBSET: 0, PIXEL_FAIL: 1, INCOMPLETE: 2, UNSUPPORTED_DEFAULT_ENVIRONMENT: 3 }[report.status] ?? 2;
  console.log(JSON.stringify({ status: report.status, exitCode, output, observations: report.windows.map(row => row.scene?.observations.length ?? 0), originalInputsAndArtifactsUnchanged: report.originalInputsAndArtifactsUnchanged }));
  process.exitCode = exitCode;
}
try { await main(process.argv.slice(2)); }
catch (cause) { clearTimeout(timer); console.error(JSON.stringify({ status: 'INCOMPLETE', failure: fault(cause), output: output ?? null })); process.exitCode = 2; }
