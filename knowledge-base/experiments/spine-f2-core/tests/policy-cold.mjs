// SPDX-License-Identifier: Apache-2.0
// Read-only policy and fresh-process cold lanes; never build, install or create aliases.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const experiment = fileURLToPath(new URL('../', import.meta.url));
const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HELPER = { path: 'tools/lib/file-identity.mjs', bytes: 5065, sha256: '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569' };
const READER = { path: 'tools/browser-png/file-graph.mjs', bytes: 25486, sha256: '34583c4eca298370f82865ca65b92d736939af893d1ca1353c77d6b7980a0075' };
const privateAliases = Object.freeze({
  '#egret-textured-frame-state': { import: 'packages/engine/dist/internal/texturedFrameState.js', types: 'packages/engine/dist/internal/texturedFrameState.d.ts', parents: ['packages/engine/dist/web/CanvasHost.js', 'packages/engine/dist/web/WebGPUHost.js'] },
  '#egret-mouse-input': { import: 'packages/engine/dist/mouseInput.js', types: 'packages/engine/dist/mouseInput.d.ts', parents: ['packages/engine/dist/web/MouseInput.js', 'packages/engine/dist/web/MouseInput.d.ts', 'packages/engine/dist/web/input.d.ts'] },
});
const args = process.argv.slice(2);
assert.ok((args.length === 4 || args.length === 6) && args[0] === '--spine-core' && args[2] === '--output'
  && (args.length === 4 || args[4] === '--lane' && ['all', 'help', 'policy'].includes(args[5])),
  'Usage: node tests/policy-cold.mjs --spine-core <existing-package-owner> --output <fresh-outside-repository> [--lane all|help|policy]');
const sdk = realpathSync(path.resolve(args[1])), output = path.resolve(args[3]), lane = args[5] ?? 'all';
// Authenticate the shared raw-byte/path helper before its first import.
const helperRaw = readFileSync(path.join(repository, HELPER.path));
assert.equal(helperRaw.length, HELPER.bytes); assert.equal(sha256(helperRaw), HELPER.sha256);
const identity = await import(pathToFileURL(path.join(repository, HELPER.path)).href);
identity.physicalPathKey(output);
assert.equal(existsSync(output), false, 'fresh output required');
assert.equal(identity.samePhysicalPath(repository, output), false);
let contained = false; try { identity.ownerRelativePath(repository, output); contained = true; } catch {}
assert.equal(contained, false, 'output must be outside repository');
mkdirSync(output, { recursive: true }); assert.ok(identity.samePhysicalPath(output, realpathSync(output)));
const save = (name, value) => writeFileSync(path.join(output, identity.logicalPath(name)), identity.canonicalTextBytes(JSON.stringify(value, null, 2)), { flag: 'wx' });
function pin(owner, relative, expected) {
  const result = identity.fingerprintFile(owner, relative);
  if (expected) { assert.equal(result.bytes, expected.bytes, relative); assert.equal(result.sha256, expected.sha256, relative); }
  return result;
}
function inventory(owner) {
  const rows = []; let bytes = 0;
  function visit(relative = '') {
    for (const name of readdirSync(path.join(owner, relative)).sort()) {
      const key = identity.logicalPath(relative ? relative + '/' + name : name), stat = lstatSync(path.join(owner, key));
      assert.equal(stat.isSymbolicLink(), false, key);
      if (stat.isDirectory()) visit(key);
      else { assert.ok(stat.isFile(), key); const row = pin(owner, key); bytes += row.bytes; rows.push(row); assert.ok(rows.length <= 4096 && bytes <= 268435456, 'bounded inventory'); }
    }
  }
  visit(); rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { rows, files: rows.length, bytes, sha256TupleTree: sha256(Buffer.from(JSON.stringify(rows.map(row => [row.path, row.bytes, row.sha256])))) };
}
function failure(cause) {
  if (cause === undefined) return { type: 'undefined' };
  if (cause === null) return { type: 'null', value: null };
  const type = typeof cause;
  if (type !== 'object') return { type, value: type === 'string' || type === 'boolean' || type === 'number' && Number.isFinite(cause) ? cause : String(cause) };
  return { type, name: cause.name ?? null, code: cause.code ?? null, message: cause.message ?? null, stack: cause.stack ?? null };
}
const report = { kind: 'ACTUAL_F2C_POLICY_COLD', lane, status: 'NOT_RUN', policy: 'not_run', coldLanes: [],
  actualMainExecutedCases: 0, actualPoseCases: 0, actualNativeCases: 0, actualTypeLanes: 0,
  nodeVersion: process.version, executionArguments: [...process.execArgv],
  entitlement: 'unknown', redistributionClearance: 'unverified', performanceAcceptance: 'none' };
let primary, primaryCaught = false;
try {
  report.observerPins = ['tests/policy-cold.mjs', 'tests/cold-child.mjs'].map(relative => pin(experiment, relative));
  report.runnerPin = pin(experiment, 'run.mjs');
  const sdkTree = inventory(sdk), sdkPackage = JSON.parse(readFileSync(path.join(sdk, 'package.json'), 'utf8'));
  assert.equal(sdkPackage.name, '@esotericsoftware/spine-core'); assert.equal(sdkPackage.version, '4.3.13');
  assert.equal(sdkTree.files, 137); assert.equal(sdkTree.sha256TupleTree, 'e3690c1f8fc3c2b8123bfcfe37d50d7f56878fbef8143fe5cd11d0cc97eaf0cf');
  report.suppliedSDK = { owner: sdk, version: sdkPackage.version, ...sdkTree };
  if (lane !== 'help') {
    const readerPin = pin(repository, READER.path, READER), helperPin = pin(repository, HELPER.path, HELPER);
    const readerBytes = readFileSync(path.join(repository, READER.path));
    assert.equal(sha256(readerBytes), readerPin.sha256, 'reader second-read identity');
    const projection = path.join(output, 'owned-reader');
    mkdirSync(path.join(projection, 'tools/browser-png'), { recursive: true });
    mkdirSync(path.join(projection, 'tools/lib'), { recursive: true });
    const suffix = Buffer.from('export { literalImports };\n');
    const projected = Buffer.concat([readerBytes, suffix]);
    writeFileSync(path.join(projection, READER.path), projected, { flag: 'wx' });
    writeFileSync(path.join(projection, HELPER.path), helperRaw, { flag: 'wx' });
    assert.equal(lstatSync(path.join(projection, READER.path)).nlink, 1);
    assert.equal(lstatSync(path.join(projection, HELPER.path)).nlink, 1);
    assert.equal(projected.subarray(0, readerPin.bytes).equals(readerBytes), true);
    const reader = await import(pathToFileURL(path.join(projection, READER.path)).href);
    assert.equal(typeof reader.literalImports, 'function');
    report.readerProjection = { readerPin, helperPin, projectedPin: pin(projection, READER.path), copiedHelperPin: pin(projection, HELPER.path), onlyAppendedUTF8: suffix.toString(), fullRawInverseProved: true };
    const modules = new Map(), packages = new Map(), roots = [], relations = [];
    function add(owner, prefix, category) {
      const tree = inventory(owner);
      for (const row of tree.rows) if (row.path.endsWith('.js') || row.path.endsWith('.d.ts') || category === 'bridge-source' && row.path.endsWith('.ts')) {
        const key = identity.logicalPath(prefix + row.path); assert.equal(modules.has(key), false, key);
        modules.set(key, { owner, relative: row.path, pin: row, prefix, category });
      }
      return tree;
    }
    report.productInventories = [];
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      const metadataPin = pin(repository, 'packages/' + name + '/package.json');
      const pkg = JSON.parse(readFileSync(path.join(repository, metadataPin.path), 'utf8'));
      assert.equal(pkg.name, '@egret/' + name); assert.equal(pkg.type, 'module');
      assert.equal(pkg.exports['.'].import, './dist/index.js'); assert.equal(pkg.exports['.'].types, './dist/index.d.ts');
      packages.set(pkg.name, { pkg, owner: 'packages/' + name });
      const tree = add(path.join(repository, 'packages', name, 'dist'), 'packages/' + name + '/dist/', 'product');
      roots.push('packages/' + name + '/dist/index.js', 'packages/' + name + '/dist/index.d.ts');
      report.productInventories.push({ name: pkg.name, metadataPin, ...tree });
      assert.equal(Object.keys(pkg.dependencies ?? {}).some(key => key.startsWith('@esotericsoftware/')), false, 'no default SDK dependency');
    }
    report.retainedF2 = add(path.join(repository, 'knowledge-base/experiments/spine-f2/dist'), 'knowledge-base/experiments/spine-f2/dist/', 'retained-f2');
    report.bridgeSource = add(path.join(experiment, 'src'), 'knowledge-base/experiments/spine-f2-core/src/', 'bridge-source');
    report.bridgeEmission = add(path.join(experiment, 'dist'), 'knowledge-base/experiments/spine-f2-core/dist/', 'bridge-emitted');
    for (const row of sdkTree.rows) if (row.path.endsWith('.js') || row.path.endsWith('.d.ts')) modules.set('external-sdk/' + row.path, { owner: sdk, relative: row.path, pin: row, prefix: 'external-sdk/', category: 'sdk' });
    function publicTarget(specifier, mode) {
      const name = [...packages.keys()].find(value => specifier === value || specifier.startsWith(value + '/'));
      assert.ok(name, 'known public Egret package: ' + specifier);
      const record = packages.get(name), subpath = specifier === name ? '.' : '.' + specifier.slice(name.length);
      const mapping = record.pkg.exports?.[subpath], target = typeof mapping === 'string' ? mapping : mapping?.[mode];
      assert.ok(typeof target === 'string' && target.startsWith('./dist/') && !target.includes('*'), 'exact public route: ' + specifier);
      return identity.logicalPath(record.owner + '/' + target.slice(2));
    }
    for (const [from, row] of modules) {
      const types = from.endsWith('.d.ts'), mode = types ? 'types' : 'import';
      const bytes = readFileSync(path.join(row.owner, row.relative)); assert.equal(sha256(bytes), row.pin.sha256, 'relation read drift');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      for (const edge of reader.literalImports(text, from, types)) {
        const specifier = edge.specifier, bridge = row.category.startsWith('bridge-'); let target;
        assert.ok(edge.kind === 'static' || edge.kind === 'declaration-literal'
          || row.category === 'product' && from === 'packages/engine/dist/web/WebGPUHost.js' && specifier === './b1.js' && edge.kind === 'dynamic-literal', 'exact literal import kind: ' + from);
        if (row.category === 'product' || row.category === 'retained-f2') {
          assert.equal(specifier.startsWith('@esotericsoftware/spine-core'), false, 'default SDK relation: ' + from);
          assert.equal(/(?:^|\/)spine-f2-core(?:\/|$)/.test(specifier), false, 'default bridge relation: ' + from);
        }
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          assert.ok(specifier.endsWith('.js'), 'literal .js relation: ' + from);
          target = identity.logicalPath(path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)));
          if (types) target = target.replace(/\.js$/, '.d.ts');
          if (row.category === 'bridge-source') target = target.replace(/\.js$/, '.ts');
          const retained = bridge && specifier === '../../spine-f2/dist/index.js';
          assert.ok(target.startsWith(row.prefix) || retained, 'module owner escape: ' + from);
          if (retained && row.category === 'bridge-source') target = 'knowledge-base/experiments/spine-f2/dist/index.js';
        } else if (specifier.startsWith('@egret/')) {
          if (bridge) assert.ok(['@egret/engine', '@egret/project/spine'].includes(specifier), 'bridge uses exact public Egret routes');
          target = publicTarget(specifier, mode);
        } else if (specifier === '@esotericsoftware/spine-core') {
          assert.ok(bridge, 'SDK public route belongs to optional bridge only');
          target = 'external-sdk/' + (types ? sdkPackage.types : sdkPackage.main).replace(/^\.\//, '');
        } else if (specifier.startsWith('#')) {
          assert.equal(row.category, 'product', 'no private product alias in bridge');
          const approved = privateAliases[specifier], record = packages.get('@egret/engine');
          assert.ok(approved?.parents.includes(from), 'exact existing private product parent');
          assert.equal(record.pkg.imports?.[specifier]?.[mode], './' + approved[mode].slice('packages/engine/'.length));
          target = approved[mode];
        } else {
          assert.ok(specifier === 'robust-predicates' && row.category === 'product' && from.startsWith('packages/engine/dist/rendering/')
            || specifier === 'jsonc-parser' && ['packages/project/dist/json-foundation.js', 'packages/project/dist/json-foundation.d.ts', 'knowledge-base/experiments/spine-f2/dist/source-view.js'].includes(from), 'exact existing public external route: ' + from);
          target = 'separately-pinned-public-root:' + specifier;
        }
        if (!target.startsWith('separately-pinned-public-root:')) assert.ok(modules.has(target), 'actual relation target missing: ' + from + ' -> ' + target);
        relations.push({ from, category: row.category, ...edge, target });
      }
    }
    const reached = new Set();
    function walk(key, visited = reached) { if (visited.has(key)) return; assert.ok(modules.has(key), key); visited.add(key); for (const edge of relations.filter(row => row.from === key)) if (!edge.target.startsWith('separately-pinned-public-root:')) walk(edge.target, visited); }
    for (const key of roots) walk(key);
    assert.equal([...reached].some(key => key.startsWith('external-sdk/') || key.includes('/spine-f2-core/')), false);
    // Full unchanged package artifacts and reachable public roots are different scopes.
    const sdkRuntimeArtifacts = sdkTree.rows.filter(row => row.path.endsWith('.js')).map(row => 'external-sdk/' + row.path).sort();
    const sdkTypeArtifacts = sdkTree.rows.filter(row => row.path.endsWith('.d.ts')).map(row => 'external-sdk/' + row.path).sort();
    assert.equal(sdkRuntimeArtifacts.length, 66, 'full pinned SDK JS artifacts');
    assert.equal(sdkTypeArtifacts.length, 64, 'full pinned SDK declaration artifacts');
    const sdkRuntimeRoot = identity.logicalPath('external-sdk/' + sdkPackage.main.replace(/^\.\//, ''));
    const sdkTypeRoot = identity.logicalPath('external-sdk/' + sdkPackage.types.replace(/^\.\//, ''));
    const sdkRuntimeReach = new Set(), sdkTypeReach = new Set();
    walk(sdkRuntimeRoot, sdkRuntimeReach); walk(sdkTypeRoot, sdkTypeReach);
    const sdkRuntimeReachableKeys = Object.freeze([...sdkRuntimeReach].sort());
    const sdkTypeReachableKeys = Object.freeze([...sdkTypeReach].sort());
    assert.equal(sdkRuntimeReachableKeys.length, 64, 'public SDK runtime closure');
    assert.equal(sdkTypeReachableKeys.length, 63, 'public SDK declaration closure');
    assert.ok(sdkRuntimeReachableKeys.every(key => key.startsWith('external-sdk/') && key.endsWith('.js')));
    assert.ok(sdkTypeReachableKeys.every(key => key.startsWith('external-sdk/') && key.endsWith('.d.ts')));
    const unusedRuntimeArtifacts = sdkRuntimeArtifacts.filter(key => !sdkRuntimeReach.has(key));
    const unusedTypeArtifacts = sdkTypeArtifacts.filter(key => !sdkTypeReach.has(key));
    assert.deepEqual(unusedRuntimeArtifacts, ['external-sdk/dist/iife/spine-core.js', 'external-sdk/dist/iife/spine-core.min.js']);
    assert.deepEqual(unusedTypeArtifacts, ['external-sdk/dist/attachments/index.d.ts']);
    report.policy = { status: 'PASS_ACTUAL_STATIC_RELATIONS_ONLY', defaultRuntimeAndTypeRoots: roots, defaultReachableKeys: [...reached].sort(), allImportRelations: relations,
      sdkFullArtifactCounts: { files: sdkTree.files, runtimeJs: sdkRuntimeArtifacts.length, declarations: sdkTypeArtifacts.length },
      sdkPublicRuntimeClosure: { entry: sdkRuntimeRoot, count: sdkRuntimeReachableKeys.length, reachableKeys: sdkRuntimeReachableKeys, unusedFullArtifacts: unusedRuntimeArtifacts },
      sdkPublicDeclarationClosure: { entry: sdkTypeRoot, count: sdkTypeReachableKeys.length, reachableKeys: sdkTypeReachableKeys, unusedFullArtifacts: unusedTypeArtifacts },
      scope: 'Actual fixed literal static/re-export/declaration closure from the mature unchanged reader plus one explicit owned export append. Complete retained emitted and optional source modules; exact public Egret/SDK routes and existing private product aliases. No module evaluation or public API/type acceptance inferred.' };
    save('policy.json', report.policy);
  }
  if (lane !== 'policy') {
    const names = lane === 'help' ? ['help'] : ['root', 'bridge', 'help'];
    // Every audited lane has its own complete ordinary no-hook predecessor.
    for (const name of names) for (const suffix of ['baseline', 'audit']) runChild(name + '-' + suffix);
    if (lane === 'all') runChild('audit-control');
  }
  report.status = 'PASS_ACTUAL_EXECUTED_LANES_ONLY';
} catch (error) { primaryCaught = true; primary = error; report.status = 'FAIL'; report.failure = failure(error); }
report.primaryCaught = primaryCaught;
save('policy-cold-report.json', report);
console.log(JSON.stringify({ status: report.status, lane, actualColdLanes: report.coldLanes.length, output, mainCases: 0, nativeCases: 0 }));
if (primaryCaught) process.exitCode = 1;

function runChild(mode) {
  const child = path.join(experiment, 'tests/cold-child.mjs'), childPin = pin(experiment, 'tests/cold-child.mjs'), started = performance.now();
  const result = spawnSync(process.execPath, [child, mode, sdk], { cwd: repository, windowsHide: true, timeout: 30000, maxBuffer: 16777216 });
  const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
  const observation = { mode, status: result.status, signal: result.signal, timedOut: result.error?.code === 'ETIMEDOUT',
    error: result.error ? failure(result.error) : null, childPin,
    stdout: { bytes: stdout.length, sha256: sha256(stdout) }, stderr: { bytes: stderr.length, sha256: sha256(stderr) },
    observationMonotonicMs: { started, finished: performance.now() }, parsed: null };
  report.coldLanes.push(observation);
  writeFileSync(path.join(output, mode + '.stdout.log'), stdout, { flag: 'wx' });
  writeFileSync(path.join(output, mode + '.stderr.log'), stderr, { flag: 'wx' });
  save(mode + '.child.json', observation);
  pin(experiment, 'tests/cold-child.mjs', childPin);
  assert.equal(result.error ?? null, null, 'cold child settlement'); assert.equal(result.signal, null); assert.equal(result.status, 0, mode);
  const lines = stdout.toString('utf8').trimEnd().split(/\r?\n/), markers = lines.filter(line => line.startsWith('F2C_COLD_RESULT '));
  assert.equal(markers.length, 1, 'one complete child observation');
  observation.parsed = JSON.parse(markers[0].slice('F2C_COLD_RESULT '.length));
  assert.equal(observation.parsed.status, 'PASS'); assert.equal(observation.parsed.mode, mode);
  if (mode.startsWith('help-')) assert.ok(lines.some(line => line.includes('Usage: node knowledge-base/experiments/spine-f2-core/run.mjs --spine-core')), 'actual help text');
  save(mode + '.observation.json', observation);
}
