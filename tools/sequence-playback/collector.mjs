// Public clock-driven SequencePlayback opaque verifier. Apache-2.0.
// Projected from the first-party opaque Bitmap collector; external process ownership remains separate.
import { readFile, writeFile, mkdir, realpath, readdir, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import os from 'node:os';
import { sha256, identity, contained, sealGraph } from './file-graph.mjs';
import { STEPS, expectationManifest, inspectCapture, inspectPlaybackProof } from './oracle.mjs';
import { classifyConsoleMessage } from './console-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../..');
const began = Date.now(), operationDeadlineUTC = began + 240000, closeDeadlineUTC = began + 280000;
const events = [], requests = [], captures = [], attempts = [], artifacts = new Map(), inputs = new Map();
const retirement = { browser: 'not-created', server: 'not-created', contexts: [], fixtures: [] };
const compilerOwnership = { before: null, after: null, beforeSaved: false, stable: false };
let selectedCompilerMapping = null;
let output, browser, browserLaunch, server, origin, environment = null, firstError = null, overflow = false, collected = false, identitiesStable = false, inputBaselineSaved = false;
const errorRecord = cause => ({ name: String(cause?.name ?? 'Error'), code: typeof cause?.code === 'string' ? cause.code : null, message: String(cause?.message ?? cause) });
const requireValue = (condition, message) => { if (!condition) throw Object.assign(new Error(message), { code: 'PROBE_PROTOCOL' }); };
const remember = cause => { firstError ??= errorRecord(cause); return cause; };
const observed = value => { const promise = Promise.resolve(value); promise.catch(() => undefined); return promise; };
function record(target, value, maximum) {
  if (target.length >= maximum) { overflow = true; remember(Object.assign(new Error('Event/request budget exhausted'), { code: 'PROBE_BUDGET' })); return; }
  target.push({ atUTC: new Date().toISOString(), ...value });
}
async function bounded(label, action, cleanup = false) {
  const remaining = Math.min(20000, (cleanup ? closeDeadlineUTC : operationDeadlineUTC) - Date.now());
  if (remaining <= 0) throw remember(Object.assign(new Error(label + ' deadline expired'), { code: 'PROBE_DEADLINE' }));
  const promise = observed(Promise.resolve().then(action)); let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(label + ' did not settle'), { code: 'PROBE_TIMEOUT' })), remaining); })]); }
  catch (cause) { throw remember(cause); }
  finally { clearTimeout(timer); }
}
async function save(name, bytes, cleanup = false) {
  requireValue(/^[A-Za-z0-9][A-Za-z0-9.-]{0,95}$/.test(name), 'Flat artifact name required');
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const total = [...artifacts.values()].reduce((sum, row) => sum + row.bytes, 0) - (artifacts.get(name)?.bytes ?? 0) + data.length;
  requireValue(data.length <= 4194304 && total <= 16777216, 'Artifact byte budget');
  await bounded('save ' + name, () => writeFile(path.join(output, name), data, { flag: artifacts.has(name) ? 'w' : 'wx' }), cleanup);
  const row = { name, bytes: data.length, sha256: sha256(data) }; artifacts.set(name, row); return row;
}
const saveJSON = (name, value, cleanup = false) => save(name, JSON.stringify(value, null, 2) + '\n', cleanup);
function pin(row, role) {
  const key = path.resolve(row.path).toLowerCase(), previous = inputs.get(key);
  requireValue(!previous || previous.bytes === row.bytes && previous.sha256 === row.sha256, 'Conflicting selected input identity');
  inputs.set(key, { ...row, roles: [...new Set([...(previous?.roles ?? []), role])] });
}
async function bindTree(input, role) {
  const root = await realpath(input);
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      requireValue(inputs.size < 4096 && !entry.isSymbolicLink(), 'Installed input count/link admission');
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) {
        const row = await identity(file); requireValue(contained(root, row.path), 'Installed input realpath escaped'); pin(row, role);
      } else throw new Error('Unselected installed input kind');
    }
  }
  await visit(root); return root;
}
function options(args) {
  requireValue(args.length === 8, 'Exactly --playwright, --channel, --output, --admission required');
  const result = {}, allowed = ['--playwright', '--channel', '--output', '--admission'];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    requireValue(allowed.includes(key) && !Object.hasOwn(result, key) && typeof args[index + 1] === 'string' && args[index + 1].length > 0, 'Unknown/duplicate/missing option');
    result[key] = args[index + 1];
  }
  requireValue(result['--channel'] === 'msedge' && path.isAbsolute(result['--playwright']) && path.isAbsolute(result['--output']) && path.isAbsolute(result['--admission']), 'Default msedge and explicit absolute paths only');
  return result;
}
// Root supplies reviewed saved facts; this collector neither builds nor creates admission.
const PRODUCT_PATHS = Object.freeze(['packages/engine/src/sequencePlaybackTypes.ts',
  'packages/engine/src/sequencePlayback.ts', 'packages/engine/src/Engine.ts', 'packages/engine/src/index.ts']);
const CONFIG_PATHS = Object.freeze(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'tsconfig.json', 'tsconfig.base.json', 'tools/build.mjs', 'tools/generate-project-format.mjs',
  'packages/contracts/schema/project-format.schema.json',
  ...['contracts', 'runtime', 'engine', 'project'].flatMap(name => [
    'packages/' + name + '/package.json', 'packages/' + name + '/tsconfig.json']),
  'packages/engine/tsconfig.rendering.json', 'packages/engine/tsconfig.web.json',
  'node_modules/typescript/bin/tsc', 'node_modules/typescript/package.json']);
const canonicalPath = value => path.resolve(value).toLowerCase();
const tupleEqual = (left, right) => left && right && canonicalPath(left.path) === canonicalPath(right.path)
  && left.bytes === right.bytes && left.sha256 === right.sha256;
function pointerValue(value, pointer) {
  requireValue(typeof pointer === 'string' && /^\/[A-Za-z0-9_/-]+$/.test(pointer), 'Simple explicit evidence pointer required');
  for (const name of pointer.slice(1).split('/')) {
    requireValue(value !== null && typeof value === 'object' && Object.hasOwn(value, name), 'Evidence pointer absent');
    value = value[name];
  }
  return value;
}
async function verifiedPin(row, role) {
  requireValue(row && typeof row.path === 'string' && path.isAbsolute(row.path)
    && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256),
    'Plain absolute input identity required: ' + role);
  const actual = await identity(row.path);
  requireValue(tupleEqual(actual, row), 'Pinned input drift: ' + role); pin(actual, role);
  return actual;
}
async function pinnedJSON(row, role) {
  const actual = await verifiedPin(row, role);
  requireValue(actual.bytes <= 4194304, 'Evidence JSON byte budget');
  const bytes = await readFile(actual.path);
  requireValue(sha256(bytes) === actual.sha256, 'Pinned JSON changed while read');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function plainIdentity(row) {
  return row && typeof row.path === 'string' && row.path.length > 0
    && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256);
}
async function inventoryRows(rows, root, allowed, role, physicalPath = name => path.join(root, name)) {
  requireValue(Array.isArray(rows) && rows.length > 0 && rows.length <= 2048, 'Bounded nonempty inventory required');
  const result = new Map(), logicalNames = new Set();
  for (const row of rows) {
    // Keep saved root-relative spelling; never derive a logical owner from process.cwd.
    const relative = row?.path;
    requireValue(plainIdentity(row) && !path.isAbsolute(relative) && !relative.includes('\\')
      && relative.split('/').every(part => part.length > 0 && part !== '.' && part !== '..')
      && path.posix.normalize(relative) === relative && allowed(relative) && !logicalNames.has(relative),
      'Exact logical inventory path required: ' + role);
    logicalNames.add(relative);
    const expectedPath = physicalPath(relative), actual = await identity(path.join(root, relative));
    requireValue(contained(root, expectedPath) && canonicalPath(actual.path) === canonicalPath(expectedPath)
      && actual.bytes === row.bytes && actual.sha256 === row.sha256, 'Pinned logical input owner drift: ' + role);
    pin(actual, role);
    const key = canonicalPath(actual.path); requireValue(!result.has(key), 'Duplicate inventory identity');
    result.set(key, actual);
  }
  return result;
}
function equalInventories(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const keys = new Set();
  return left.every(row => {
    const key = plainIdentity(row) ? row.path : null;
    if (key === null || keys.has(key)) return false;
    keys.add(key); return right.some(other => plainIdentity(other) && other.path === key
      && row.bytes === other.bytes && row.sha256 === other.sha256);
  }) && keys.size === right.length;
}
async function installedCompilerMapping(root) {
  // The current setup has two exact hoisted owners; retain logical/physical rechecks.
  const typescriptAlias = path.join(root, 'node_modules/typescript');
  const typescriptRoot = path.join(root, 'node_modules/typescript');
  const nativeRoot = path.join(root,
    'node_modules/@typescript/typescript-win32-x64');
  const nativeAlias = path.join(root,
    'node_modules/@typescript/typescript-win32-x64');
  const directoryPaths = [[typescriptAlias, typescriptRoot], [typescriptRoot, typescriptRoot],
    [nativeAlias, nativeRoot], [nativeRoot, nativeRoot]];
  for (const [alias, expected] of directoryPaths)
    requireValue(contained(path.join(root, 'node_modules'), expected)
      && canonicalPath(await realpath(alias)) === canonicalPath(expected), 'Known installed compiler owner mapping required');
  const ownerPaths = new Map(), filePaths = [];
  for (const name of ['package.json', 'bin/tsc', 'lib/tsc.js', 'lib/getExePath.js'])
    filePaths.push([path.join(typescriptAlias, name), path.join(typescriptRoot, name)]);
  for (const name of ['package.json', 'lib/tsc.exe'])
    filePaths.push([path.join(nativeRoot, name), path.join(nativeRoot, name)]);
  for (const [logical, physical] of filePaths) ownerPaths.set(canonicalPath(logical), physical);
  return { typescriptRoot, nativeRoot, ownerPaths, directoryPaths, filePaths,
    configurationPath: name => ownerPaths.get(canonicalPath(path.join(root, name))) ?? path.join(root, name) };
}
async function observeCompilerOwnership(owners, expectedFiles) {
  // Observe both alias edges and the six assigned files; keep failed observations for INCOMPLETE.
  const directories = [], files = [];
  for (const [logicalPath, expectedPhysicalPath] of owners.directoryPaths) {
    const row = { logicalPath, expectedPhysicalPath, observedPhysicalPath: null, matchesExpected: false, error: null };
    try {
      row.observedPhysicalPath = await realpath(logicalPath);
      row.matchesExpected = canonicalPath(row.observedPhysicalPath) === canonicalPath(expectedPhysicalPath);
    } catch (cause) { row.error = errorRecord(cause); }
    directories.push(row);
  }
  for (const [logicalPath, expectedPhysicalPath] of owners.filePaths) {
    const expectedPin = expectedFiles.get(canonicalPath(expectedPhysicalPath));
    requireValue(plainIdentity(expectedPin), 'Assigned compiler file baseline required');
    const row = { logicalPath, expectedPhysicalPath, expectedPin, observedPin: null, matchesExpected: false, error: null };
    try {
      row.observedPin = await identity(logicalPath);
      row.matchesExpected = canonicalPath(row.observedPin.path) === canonicalPath(expectedPhysicalPath)
        && tupleEqual(row.observedPin, expectedPin);
    } catch (cause) { row.error = errorRecord(cause); }
    files.push(row);
  }
  return { directories, files, complete: directories.length === 4 && files.length === 6
    && directories.every(row => row.matchesExpected && row.error === null)
    && files.every(row => row.matchesExpected && row.error === null) };
}
async function compilerRows(rows, owners, nativeRuntime) {
  requireValue(Array.isArray(rows) && rows.length === 7, 'Exact seven runtime/compiler owner identities required');
  const result = new Map(), recordedPaths = new Set();
  for (const row of rows) {
    requireValue(plainIdentity(row) && path.isAbsolute(row.path), 'Absolute saved compiler owner identity required');
    const key = canonicalPath(row.path);
    requireValue(!recordedPaths.has(key), 'Duplicate saved compiler owner'); recordedPaths.add(key);
    // Only already verified build/collector Node may be outside the six installed compiler owners.
    if (key === canonicalPath(nativeRuntime.path)) {
      requireValue(tupleEqual(row, nativeRuntime), 'Exact external build runtime owner required');
      result.set(key, nativeRuntime); continue;
    }
    const expectedPath = owners.ownerPaths.get(key);
    requireValue(expectedPath !== undefined, 'Unassigned installed compiler owner refused');
    const actual = await identity(row.path);
    requireValue(canonicalPath(actual.path) === canonicalPath(expectedPath)
      && actual.bytes === row.bytes && actual.sha256 === row.sha256, 'Saved installed compiler physical owner drift');
    pin(actual, 'reviewed-installed-compiler');
    const physicalKey = canonicalPath(actual.path);
    requireValue(!result.has(physicalKey), 'Duplicate compiler physical owner'); result.set(physicalKey, actual);
  }
  requireValue(result.size === 7 && result.has(canonicalPath(nativeRuntime.path))
    && [...owners.ownerPaths.values()].every(file => result.has(canonicalPath(file))), 'Complete assigned compiler owners required');
  return result;
}
async function physicalFiles(root, kind) {
  const found = [];
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    const directories = kind === 'source' ? ['src', ...(name === 'engine' ? ['web', 'rendering'] : [])] : ['dist'];
    for (const directory of directories) {
      const base = path.join(root, 'packages', name, directory);
      async function visit(current) {
        for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
          requireValue(!entry.isSymbolicLink() && found.length < 2048, 'Source/emission traversal budget or link refused');
          const file = path.join(current, entry.name);
          if (entry.isDirectory()) await visit(file);
          else if (entry.isFile() && (kind === 'source' ? entry.name.endsWith('.ts') : /\.js$|\.d\.ts$/.test(entry.name))) found.push(file);
          else if (!entry.isFile()) throw new Error('Unexpected source/emission file kind');
        }
      }
      await visit(base);
    }
  }
  return found;
}
async function reviewed(record, role, actualRequired = false) {
  requireValue(record && record.pin, 'Explicit review identity required');
  const raw = await pinnedJSON(record.pin, 'accepted-' + role + '-review');
  requireValue(raw.openFindings === 0 && typeof raw.verdict === 'string'
    && (actualRequired ? /^PASS_ACTUAL(?:_|$)/ : /^PASS(?:_|$)/).test(raw.verdict),
    'Independent accepted review required: ' + role);
  return raw;
}
async function qualifyAdmission(file, root) {
  const admissionPin = await identity(file); pin(admissionPin, 'root-supplied-admission');
  requireValue(admissionPin.bytes <= 4194304, 'Admission byte budget');
  const bytes = await readFile(admissionPin.path);
  requireValue(sha256(bytes) === admissionPin.sha256, 'Admission changed while read');
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  requireValue(value?.schemaVersion === 'sequence-playback-native-admission/1'
    && value.status === 'ROOT_FROZEN_REVIEWED_CURRENT_BUILD' && path.isAbsolute(value.repositoryRoot)
    && canonicalPath(await realpath(value.repositoryRoot)) === canonicalPath(root)
    && /^[a-f0-9]{40}$/.test(value.sourceBase?.head) && /^[a-f0-9]{40}$/.test(value.sourceBase?.tree),
    'Explicit current checkout/build authority required');
  const source = await inventoryRows(value.sdkSourcePins, root,
    relative => /^packages\/(contracts|runtime|engine|project)\/(src|web|rendering)\/.+\.ts$/.test(relative),
    'reviewed-sdk-source');
  const emitted = await inventoryRows(value.sdkEmittedPins, root,
    relative => /^packages\/(contracts|runtime|engine|project)\/dist\/.+(?:\.js|\.d\.ts)$/.test(relative),
    'reviewed-sdk-emission');
  for (const [kind, inventory] of [['source', source], ['emitted', emitted]]) {
    const physical = await physicalFiles(root, kind);
    requireValue(physical.length === inventory.size && physical.every(file => inventory.has(canonicalPath(file))),
      'Complete current SDK ' + kind + ' inventory required');
  }
  const owners = await installedCompilerMapping(root);
  const configuration = await inventoryRows(value.configurationPins, root,
    relative => CONFIG_PATHS.includes(relative), 'reviewed-build-configuration', owners.configurationPath);
  requireValue(configuration.size === CONFIG_PATHS.length
    && CONFIG_PATHS.every(name => configuration.has(canonicalPath(owners.configurationPath(name)))), 'Exact twenty build configuration identities');
  const product = await inventoryRows(value.productSourcePins, root,
    relative => PRODUCT_PATHS.includes(relative), 'reviewed-playback-product-source');
  requireValue(product.size === PRODUCT_PATHS.length
    && PRODUCT_PATHS.every(name => tupleEqual(product.get(canonicalPath(path.join(root, name))),
      source.get(canonicalPath(path.join(root, name))))), 'Exact four current playback source identities required');
  await reviewed(value.reviews?.plan, 'native-plan');
  const productReview = await reviewed(value.reviews?.product, 'product-source');
  const reviewedRows = pointerValue(productReview, value.reviews.product.sourcePinsPointer);
  requireValue(Array.isArray(reviewedRows), 'Reviewed product inventory required');
  const reviewedProduct = await inventoryRows(reviewedRows.map(row => ({ ...row,
    path: path.isAbsolute(row.path) ? path.relative(root, row.path).replaceAll(path.sep, '/') : row.path })),
    root, relative => PRODUCT_PATHS.includes(relative), 'accepted-product-review-source');
  requireValue(reviewedProduct.size === product.size && [...product.entries()].every(([key, row]) =>
    tupleEqual(row, reviewedProduct.get(key))), 'Exact distinct product review identities required');
  const buildReview = await reviewed(value.reviews?.build, 'saved-build', true);
  const build = value.build;
  requireValue(build && typeof build.commandName === 'string' && build.commandName.length > 0
    && tupleEqual(pointerValue(buildReview, value.reviews.build.receiptPinPointer), build.receiptPin)
    && tupleEqual(pointerValue(buildReview, value.reviews.build.inventoryPinPointer), build.inventoryPin),
    'Actual independent build review must bind saved receipt and inventory');
  const inventory = await pinnedJSON(build.inventoryPin, 'actual-build-source-emission-inventory');
  const inventoryBuild = inventory?.build;
  requireValue(inventory?.schemaVersion === 'sequence-playback-sdk-build-inventory/1'
    && inventory.status === 'ROOT_FROZEN_ACTUAL_SDK_BUILD_INVENTORY'
    && typeof inventory.repositoryRoot === 'string' && path.isAbsolute(inventory.repositoryRoot)
    && canonicalPath(inventory.repositoryRoot) === canonicalPath(root)
    && canonicalPath(await realpath(inventory.repositoryRoot)) === canonicalPath(root)
    && inventoryBuild && tupleEqual(inventoryBuild.receiptPin, build.receiptPin)
    && tupleEqual(inventoryBuild.jobPin, build.jobPin)
    && tupleEqual(inventoryBuild.stdoutPin, build.stdoutPin) && tupleEqual(inventoryBuild.stderrPin, build.stderrPin)
    && tupleEqual(inventoryBuild.runtimePin, value.runtimePin), 'Saved inventory.build actor and explicit checkout association');
  for (const name of ['productSourcePins', 'sdkSourcePins', 'sdkEmittedPins', 'configurationPins', 'compilerOwnerPins'])
    requireValue(equalInventories(value[name], inventory[name]), 'Admission differs from actual reviewed build inventory: ' + name);
  const receipt = await pinnedJSON(build.receiptPin, 'actual-build-receipt');
  const job = await pinnedJSON(build.jobPin, 'actual-build-job');
  requireValue(Array.isArray(receipt) && Array.isArray(job.commands), 'Literal build ARRAY and commands job required');
  const rows = receipt.filter(row => row?.name === build.commandName), commands = job.commands.filter(row => row?.name === build.commandName);
  requireValue(rows.length === 1 && commands.length === 1, 'Exactly one assigned actual SDK build actor required');
  const row = rows[0], command = commands[0];
  requireValue(row.exitCode === 0 && row.timeout === false && Array.isArray(row.args)
    && JSON.stringify(row.args) === JSON.stringify(['tools/build.mjs'])
    && JSON.stringify(command.args) === JSON.stringify(row.args)
    && canonicalPath(await realpath(command.cwd)) === canonicalPath(root)
    && canonicalPath(await realpath(command.exe)) === canonicalPath(await realpath(process.execPath))
    && Number.isFinite(Date.parse(row.startedAtUtc)) && Number.isFinite(Date.parse(row.finishedAtUtc))
    && Date.parse(row.finishedAtUtc) >= Date.parse(row.startedAtUtc), 'Successful saved build exact actor relation required');
  const stdout = await verifiedPin(build.stdoutPin, 'actual-build-stdout'), stderr = await verifiedPin(build.stderrPin, 'actual-build-stderr');
  requireValue(canonicalPath(row.stdout) === canonicalPath(stdout.path) && row.stdoutSHA256 === stdout.sha256
    && canonicalPath(row.stderr) === canonicalPath(stderr.path) && row.stderrSHA256 === stderr.sha256, 'Saved build raw stream relation');
  const nativeRuntime = await verifiedPin(value.runtimePin, 'reviewed-build-native-runtime');
  requireValue(tupleEqual(nativeRuntime, await identity(process.execPath))
    && canonicalPath(await realpath(command.exe)) === canonicalPath(nativeRuntime.path), 'Build/native collector runtime differs');
  const compiler = await compilerRows(value.compilerOwnerPins, owners, nativeRuntime);
  for (const name of ['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc'])
    requireValue(tupleEqual(configuration.get(canonicalPath(owners.configurationPath(name))),
      compiler.get(canonicalPath(owners.configurationPath(name)))), 'Configuration/compiler owner identity differs');
  const compilerMeta = await pinnedJSON(compiler.get(canonicalPath(path.join(owners.typescriptRoot, 'package.json'))),
    'actual-typescript-package');
  const nativeMeta = await pinnedJSON(compiler.get(canonicalPath(path.join(owners.nativeRoot, 'package.json'))),
    'actual-typescript-platform-package');
  requireValue(compilerMeta.name === 'typescript' && compilerMeta.version === '7.0.2'
    && compilerMeta.bin?.tsc === './bin/tsc' && compilerMeta.imports?.['#getExePath'] === './lib/getExePath.js'
    && compilerMeta.optionalDependencies?.['@typescript/typescript-win32-x64'] === '7.0.2'
    && nativeMeta.name === '@typescript/typescript-win32-x64' && nativeMeta.version === '7.0.2'
    && JSON.stringify(nativeMeta.os) === JSON.stringify(['win32'])
    && JSON.stringify(nativeMeta.cpu) === JSON.stringify(['x64']), 'Reviewed installed compiler/platform rig only');
  // These are canonical package-declared entry routes, not synthetic workspace aliases.
  const engineMeta = JSON.parse(await readFile(path.join(root, 'packages/engine/package.json'), 'utf8'));
  requireValue(engineMeta.exports?.['.']?.import === './dist/index.js'
    && engineMeta.exports?.['./web']?.import === './dist/web/index.js'
    && engineMeta.exports?.['./webgpu']?.import === './dist/web/webgpu.js'
    && engineMeta.imports?.['#egret-textured-frame-state']?.import === './dist/internal/texturedFrameState.js'
    && engineMeta.imports?.['#egret-mouse-input']?.import === './dist/mouseInput.js'
    && engineMeta.dependencies?.['robust-predicates'] === '3.0.3', 'Canonical current package entry/import/dependency routes required');
  const ownerBefore = await observeCompilerOwnership(owners, compiler);
  requireValue(ownerBefore.complete, 'Complete initial fixed compiler owner relationships required');
  return { source, emitted, configuration, ownerBefore, ownerMapping: { owners, compiler }, summary: {
    schemaVersion: value.schemaVersion, admissionPin, sourceBase: value.sourceBase,
    productSourcePins: [...product.values()], sdkSourceCount: source.size, sdkEmissionCount: emitted.size,
    sourceBuildExecutedHere: false, actualSavedBuild: { receiptPin: build.receiptPin,
      jobPin: build.jobPin, inventoryPin: build.inventoryPin, commandName: build.commandName,
      stdoutPin: build.stdoutPin, stderrPin: build.stderrPin },
    reviewPins: Object.fromEntries(['plan', 'product', 'build'].map(role => [role, value.reviews[role].pin])),
    compilerOwnerRelationships: ownerBefore,
    qualificationScope: 'Readback of root-supplied accepted identities and saved build; not cryptographic or CI attestation' } };
}
async function bindAdmittedGraph(graph, admission) {
  for (const row of graph.inventory) {
    const key = canonicalPath(row.path);
    if (row.role === 'first-party-source-counterpart') requireValue(tupleEqual(row, admission.source.get(key)),
      'Graph source lacks frozen build authority');
    else if (/[/\\]packages[/\\](contracts|runtime|engine)[/\\]dist[/\\]/.test(row.path)) {
      requireValue(tupleEqual(row, admission.emitted.get(key)), 'Graph emitted module lacks frozen build authority');
      const declarationPin = admission.emitted.get(canonicalPath(row.path.replace(/\.js$/, '.d.ts')));
      requireValue(declarationPin !== undefined, 'Graph declaration lacks frozen build authority');
      await verifiedPin(declarationPin, 'selected-graph-declaration');
    }
  }
}

function html(backend, graph, aliases) {
  const rootRoute = graph.routeFor(aliases['@egret/engine']), hostRoute = graph.routeFor(aliases[backend === 'canvas' ? '@egret/engine/web' : '@egret/engine/webgpu']);
  requireValue([rootRoute, hostRoute].every(value => typeof value === 'string'), 'Finite entry routes unresolved');
  return Buffer.from(`<!doctype html><meta charset="utf-8"><title>SequencePlayback opaque probe</title><link rel="icon" href="/favicon.ico"><style>html,body{margin:0;padding:0;background:transparent}canvas{display:block}</style><script type="module">
import * as egret from ${JSON.stringify(rootRoute)};
import {${backend === 'canvas' ? 'createCanvasHost' : 'createWebGPUHost'} as createHost} from ${JSON.stringify(hostRoute)};
import {createFixture} from '/fixture.mjs';
window.sequencePlaybackFixture=createFixture({backend:${JSON.stringify(backend)},egret,createHost});
window.sequencePlaybackModuleReady=true;
</script>`, 'utf8');
}
function requirePlaybackProof(packet, retired = false) {
  const observation = inspectPlaybackProof(packet, retired);
  requireValue(observation.pass, 'Missing or invalid public playback proof: ' + observation.issues.join('; '));
}
function receipt(status) {
  return { schemaVersion: 'sequence-playback-opaque-result/1', status, requestedStepsPerBackend: [...STEPS], completedCaptures: captures.length,
    completedSubmissions: captures.length, completedNewCaptures: captures.filter(row => row.step !== 'saved-red').length,
    completedReplays: captures.filter(row => row.step === 'saved-red').length,
    captureCountMeaning: 'Raw submissions include original saved-frame replay',
    comparedPixels: captures.reduce((sum, row) => sum + row.observation.pixelComparisons, 0),
    comparedChannels: captures.reduce((sum, row) => sum + row.observation.channelComparisons, 0),
    subsetOnly: '8x4 DPR1 public SequencePlayback clock-driven once/loop/pause/resume and saved-frame replay', fullA2: false, alphaCalibration: false, performance: false,
    firstError, overflow, identitiesStable, compilerOwnership, environment, retirement, attempts, captures,
    advisoryCount: events.filter(row => row.kind === 'console' && row.disposition === 'advisory').length,
    artifacts: [...artifacts.values()].filter(row => row.name !== 'result.json'),
    budgets: { perOperationMs: 20000, operationMs: 240000, closeMs: 280000, hardMs: 295000, requiredOuterJobWatchdogMs: 300000,
      events: 128, requests: 2048, fixtureEventsPerList: 128, selectedModules: 256, emittedBytes: 4194304, installedFiles: 4096, inputBytes: 536870912, outputBytes: 16777216 },
    processOwnership: 'Separate external Windows Job/process-retirement receipt required; collector closure does not attest OS process retirement' };
}
const hardTimer = setTimeout(() => {
  remember(Object.assign(new Error('Collector hard deadline'), { code: 'PROBE_DEADLINE' }));
  if (output) {
    try { writeFileSync(path.join(output, 'result.json'), JSON.stringify(receipt('INCOMPLETE'), null, 2) + '\n'); }
    catch { /* Missing fallback receipt must remain an outer-owner limitation. */ }
  }
  process.stderr.write('SequencePlayback opaque probe INCOMPLETE: hard deadline\n'); process.exit(2);
}, 295000);

try {
  const cli = options(process.argv.slice(2));
  requireValue(process.platform === 'win32' && process.arch === 'x64' && process.version === 'v26.7.0', 'Reviewed Windows x64 / Node26.7.0 runtime only');
  const pwPath = await bounded('Playwright realpath', () => realpath(cli['--playwright']));
  const corePath = await bounded('Playwright core realpath', () => realpath(path.join(pwPath, '../playwright-core')));
  const parent = await bounded('output parent realpath', () => realpath(path.dirname(cli['--output']))), candidate = path.join(parent, path.basename(cli['--output']));
  const repositoryRealRoot = await bounded('repository realpath', () => realpath(repositoryRoot));
  requireValue(![repositoryRealRoot, pwPath, corePath].some(root => contained(root, candidate)), 'Output must be fresh and outside repository/installed inputs');
  try { await lstat(candidate); throw new Error('Output exists; attempts cannot overwrite or reuse it'); }
  catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  const admission = await bounded('qualify reviewed current source and saved build', () => qualifyAdmission(cli['--admission'], repositoryRealRoot));
  selectedCompilerMapping = admission.ownerMapping; compilerOwnership.before = admission.ownerBefore;
  await bounded('create fresh output', () => mkdir(candidate)); output = candidate;
  for (const name of ['collector.mjs', 'fixture.mjs', 'oracle.mjs', 'file-graph.mjs', 'console-policy.mjs', 'README.md', 'README.zh-CN.md']) {
    const row = await bounded('source identity ' + name, () => identity(path.join(here, name)));
    requireValue(contained(repositoryRealRoot, row.path), 'Public source/reading escaped repository'); pin(row, 'public-source-or-reading');
  }
  const pwRoot = await bounded('bind installed Playwright tree', () => bindTree(pwPath, 'installed-playwright'));
  const coreRoot = await bounded('bind installed Playwright core tree', () => bindTree(corePath, 'installed-playwright-core'));
  const pwMeta = JSON.parse(await readFile(path.join(pwRoot, 'package.json'), 'utf8')), coreMeta = JSON.parse(await readFile(path.join(coreRoot, 'package.json'), 'utf8'));
  requireValue(pwMeta.name === 'playwright' && pwMeta.version === '1.62.1' && coreMeta.name === 'playwright-core' && coreMeta.version === '1.62.1', 'Reviewed installed Playwright versions only');
  for (const file of [process.execPath, path.join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    ...['package.json', 'pnpm-lock.yaml', 'packages/engine/package.json', 'packages/runtime/package.json', 'packages/contracts/package.json',
      'node_modules/robust-predicates/package.json', 'node_modules/robust-predicates/LICENSE'].map(name => path.join(repositoryRoot, name))]) {
    pin(await bounded('selected source/runtime identity', () => identity(file)), 'selected-source-runtime-package');
  }
  const aliases = {
    '#egret-textured-frame-state': path.join(repositoryRoot, 'packages/engine/dist/internal/texturedFrameState.js'),
    '#egret-mouse-input': path.join(repositoryRoot, 'packages/engine/dist/mouseInput.js'),
    '@egret/contracts': path.join(repositoryRoot, 'packages/contracts/dist/index.js'), '@egret/runtime': path.join(repositoryRoot, 'packages/runtime/dist/index.js'),
    '@egret/engine': path.join(repositoryRoot, 'packages/engine/dist/index.js'), '@egret/engine/web': path.join(repositoryRoot, 'packages/engine/dist/web/index.js'),
    '@egret/engine/webgpu': path.join(repositoryRoot, 'packages/engine/dist/web/webgpu.js'),
    'robust-predicates': path.join(repositoryRoot, 'packages/engine/node_modules/robust-predicates/index.js'),
  };
  // Bound this complete dual-backend union without changing the helper's narrower default.
  const graph = await bounded('seal admitted emitted ESM/source graph', () => sealGraph({ repositoryRoot, aliases, maxModules: 256,
    entryPaths: { canvas: [aliases['@egret/engine'], aliases['@egret/engine/web']], webgpu: [aliases['@egret/engine'], aliases['@egret/engine/webgpu']] } }));
  await bounded('bind graph to admitted current source, JavaScript and declarations', () => bindAdmittedGraph(graph, admission));
  graph.inventory.forEach(row => pin(row, row.role));
  requireValue([...inputs.values()].reduce((sum, row) => sum + row.bytes, 0) <= 536870912, 'Aggregate input byte budget');
  const before = [...inputs.values()].sort((left, right) => left.path.localeCompare(right.path));
  await saveJSON('identity-before.json', before);
  await saveJSON('compiler-owner-before.json', compilerOwnership.before); compilerOwnership.beforeSaved = true;
  inputBaselineSaved = true;
  await saveJSON('oracle-manifest.json', expectationManifest()); // Written before any native browser launch.
  await saveJSON('module-graph.json', { modules: graph.modules, closures: graph.closures, sourceBuildExecutedHere: false, reviewedSavedBuildBound: true });
  await saveJSON('admission-binding.json', admission.summary);
  const routes = new Map(graph.routes), fixtureBytes = await readFile(path.join(here, 'fixture.mjs'));
  requireValue(sha256(fixtureBytes) === inputs.get(path.resolve(here, 'fixture.mjs').toLowerCase())?.sha256, 'Fixture changed before serving');
  routes.set('/fixture.mjs', { bytes: fixtureBytes, contentType: 'text/javascript; charset=utf-8' });
  for (const backend of ['canvas', 'webgpu']) routes.set('/' + backend + '.html', { bytes: html(backend, graph, aliases), contentType: 'text/html; charset=utf-8' });
  routes.set('/favicon.ico', { bytes: Buffer.alloc(0), contentType: 'image/x-icon', status: 204 });
  server = createServer((request, response) => {
    const route = routes.get(request.url), admitted = request.method === 'GET' && route && origin !== undefined && request.headers.host === new URL(origin).host;
    record(requests, { surface: 'server', method: request.method, url: request.url, admitted: Boolean(admitted) }, 2048);
    if (!admitted) { remember(new Error('Unselected loopback request')); response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end(); return; }
    response.writeHead(route.status ?? 200, { 'Content-Type': route.contentType, 'Content-Length': route.bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none';script-src 'self' 'unsafe-inline';style-src 'unsafe-inline';img-src 'self';connect-src 'none';base-uri 'none'" }); response.end(route.bytes);
  });
  server.on('error', cause => { remember(cause); record(events, { kind: 'server-error', error: errorRecord(cause) }, 128); });
  await bounded('listen loopback server', () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }));
  origin = 'http://127.0.0.1:' + server.address().port; retirement.server = 'active';
  const playwright = await bounded('load admitted installed Playwright', () => import(pathToFileURL(path.join(pwRoot, 'index.mjs')).href));
  retirement.browser = 'launch-pending';
  browser = await bounded('default installed msedge launch', () => {
    browserLaunch = observed(playwright.chromium.launch({ channel: 'msedge', headless: true }));
    browserLaunch.then(value => { browser = value; retirement.browser = 'active'; }, () => { retirement.browser = 'launch-rejected'; }); return browserLaunch;
  });
  environment = { browserVersion: browser.version(), channel: 'msedge', headless: true, addedFlags: [], browserEnvironmentOverride: false, userDataDirOverride: false,
    node: process.version, installedVersions: { playwright: pwMeta.version, playwrightCore: coreMeta.version }, os: { platform: process.platform, arch: process.arch, release: os.release() },
    scope: 'Reported runtime observations; hardware acceleration, physical scanout and performance unproved' };
  for (const backend of ['canvas', 'webgpu']) {
    let context, contextCreation, page;
    const attempt = { backend, startup: null, stepFailures: [] }; attempts.push(attempt);
    const contextReceipt = { backend, state: 'creation-pending' }; retirement.contexts.push(contextReceipt);
    try {
      context = await bounded('fresh ' + backend + ' context', () => {
        contextCreation = observed(browser.newContext({ viewport: { width: 8, height: 4 }, deviceScaleFactor: 1, serviceWorkers: 'block' }));
        contextCreation.then(value => { context = value; contextReceipt.state = 'active'; }, () => { contextReceipt.state = 'creation-rejected'; }); return contextCreation;
      });
      const allowed = new Set([...graph.closures[backend].map(file => graph.routeFor(file)), '/fixture.mjs', '/' + backend + '.html', '/favicon.ico']);
      await bounded('admit per-backend request closure', () => context.route('**/*', async route => {
        try {
          const request = route.request(), url = new URL(request.url());
          const admitted = url.origin === origin && !url.search && !url.hash && allowed.has(url.pathname) && request.method() === 'GET';
          record(requests, { surface: 'browser', backend, method: request.method(), url: request.url(), admitted }, 2048);
          if (admitted) await route.continue();
          else { remember(new Error('External/unselected browser request')); await route.abort('blockedbyclient'); }
        } catch (cause) { remember(cause); record(events, { kind: 'route-error', backend, error: errorRecord(cause) }, 128); }
      }));
      page = await bounded('fresh page', () => context.newPage()); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(20000);
      page.on('pageerror', cause => { remember(cause); record(events, { kind: 'pageerror', backend, error: errorRecord(cause) }, 128); });
      page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) {
          const text = message.text(); if (text.length > 8192) overflow = true;
          const level = message.type(), disposition = classifyConsoleMessage(backend, level, text);
          if (disposition === 'fatal') remember(new Error('Unexpected browser console ' + level));
          record(events, { kind: 'console', backend, level, text: text.slice(0, 8192), disposition, performanceEvidence: false }, 128);
        }
      });
      page.on('requestfailed', request => { remember(new Error('Browser request failed')); record(events, { kind: 'requestfailed', backend, url: request.url(), failure: request.failure() }, 128); });
      page.on('response', response => { if (response.status() >= 400) { remember(new Error('HTTP failure')); record(events, { kind: 'http-error', backend, status: response.status(), url: response.url() }, 128); } });
      await bounded('navigate admitted page', () => page.goto(origin + '/' + backend + '.html', { waitUntil: 'load', timeout: 20000 }));
      await bounded('actual module ready', () => page.waitForFunction(() => window.sequencePlaybackModuleReady === true, undefined, { timeout: 20000 }));
      const startup = await bounded('fixture actual startup', () => page.evaluate(async input => {
        try { return { ok: true, value: await window.sequencePlaybackFixture.start(input) }; }
        catch (cause) { return { ok: false, error: { name: String(cause?.name ?? 'Error'), code: cause?.code ?? null, message: String(cause?.message ?? cause) }, snapshot: window.sequencePlaybackFixture.snapshot() }; }
      }, { operationDeadlineUTC, closeDeadlineUTC }));
      attempt.startup = startup; await saveJSON(backend + '-startup.json', startup);
      if (!startup.ok) throw Object.assign(new Error(startup.error.message), { code: startup.error.code });
      for (const step of STEPS) {
        const packet = await bounded('literal ' + backend + ' ' + step + ' submission', () => page.evaluate(async id => {
          try { return { ok: true, value: await window.sequencePlaybackFixture.collectStep(id) }; }
          catch (cause) { return { ok: false, error: { name: String(cause?.name ?? 'Error'), code: cause?.code ?? null, message: String(cause?.message ?? cause) }, snapshot: window.sequencePlaybackFixture.snapshot() }; }
        }, step));
        if (!packet.ok) { attempt.stepFailures.push({ step, ...packet }); throw Object.assign(new Error(packet.error.message), { code: packet.error.code }); }
        const capture = packet.value;
        requireValue(Array.isArray(capture.raw) && capture.raw.length <= 128 && capture.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255), 'Original raw byte domain');
        const rawArtifact = await save(backend + '-' + step + '.rgba', Buffer.from(capture.raw)); // Preserve before oracle comparisons.
        const observation = inspectCapture(capture), saved = { ...capture, raw: undefined, rawArtifact, observation }; captures.push(saved);
        await saveJSON(backend + '-' + step + '.json', saved); await saveJSON('result.json', receipt('COLLECTING'));
        requirePlaybackProof(capture); // Missing playback proof prevents completion; original raw bytes are already preserved.
        if (capture.firstError || capture.events.length || capture.diagnostics.length) throw Object.assign(new Error('Native fixture reported unexpected fault'), { code: capture.firstError?.code ?? 'PROBE_NATIVE_FAULT' });
      }
    } finally {
      if (contextCreation && !context) {
        try { context = await bounded('observe late context', () => contextCreation, true); }
        catch (cause) { contextReceipt.state = 'unresolved'; contextReceipt.error = errorRecord(cause); }
      }
      if (page) {
        let closed;
        try { closed = await bounded('fixture host/device cleanup', () => page.evaluate(() => window.sequencePlaybackFixture?.close() ?? { moduleUnavailable: true }), true); }
        catch (cause) { closed = { error: errorRecord(cause), unresolved: true }; }
        retirement.fixtures.push({ backend, ...closed });
        try { requirePlaybackProof(closed, true); }
        catch (cause) { remember(cause); }
        const safe = closed.nextStep === 9 && closed.ports?.length === 2 && closed.ports.every(port => port.close === 'fulfilled' && port.engineDisposeFulfilled && port.safeHostReturn && !port.quarantine && port.pendingStartup === 0 && port.pendingNative === 0
          && (backend === 'canvas' || port.deviceAcquiredByCollector && port.deviceDestroyedByCollector && port.deviceLoss === 'fulfilled' && port.deviceLossInfo?.reason === 'destroyed'
            && port.hostStatus?.firstFailure === null && port.hostStatus?.callbackFailureCount === 0 && port.hostStatus?.lastCallbackFailure === null));
        if (!safe || closed.ports[0].renderCalls !== 8 || closed.ports[1].renderCalls !== 1 || closed.firstError || closed.events?.length || closed.diagnostics?.length) remember(Object.assign(new Error('Incomplete or unsafe fixture cleanup'), { code: 'PROBE_CLOSE_UNSAFE' }));
      } else remember(Object.assign(new Error('No complete fixture ownership proof'), { code: 'PROBE_CLOSE_UNSAFE' }));
      if (context) {
        try { await bounded('context close', () => context.close(), true); contextReceipt.state = 'closed'; }
        catch (cause) { contextReceipt.state = 'unresolved'; contextReceipt.error = errorRecord(cause); }
      }
      await saveJSON('requests.json', requests, true); await saveJSON('browser-events.json', events, true); await saveJSON('result.json', receipt('COLLECTING'), true);
    }
    if (firstError) throw Object.assign(new Error(firstError.message), { code: firstError.code });
  }
  requireValue(captures.length === 18 && ['canvas', 'webgpu'].every(backend => captures.filter(row => row.backend === backend).map(row => row.step).join(',') === STEPS.join(',')), 'Exactly nine ordered submissions per backend');
  requireValue(receipt('COLLECTING').comparedPixels === 576 && receipt('COLLECTING').comparedChannels === 2304, 'Full raw pixel/channel completeness differs');
  collected = true;
} catch (cause) { remember(cause); }
finally {
  if (browserLaunch && !browser) {
    try { browser = await bounded('observe late browser launch', () => browserLaunch, true); }
    catch (cause) { retirement.browser = 'unresolved'; retirement.browserError = errorRecord(cause); }
  }
  if (browser) {
    try { await bounded('browser close', () => browser.close(), true); retirement.browser = 'closed'; }
    catch (cause) { retirement.browser = 'unresolved'; retirement.browserError = errorRecord(cause); }
  }
  if (server) {
    try { await bounded('loopback server close', () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }), true); retirement.server = 'closed'; }
    catch (cause) { retirement.server = 'unresolved'; retirement.serverError = errorRecord(cause); }
  }
  if (output) {
    try {
      const after = [];
      for (const row of inputs.values()) {
        const actual = await bounded('rehash selected input', () => identity(row.path), true); after.push({ ...actual, roles: row.roles });
        requireValue(actual.bytes === row.bytes && actual.sha256 === row.sha256, 'Selected input changed during native attempt: ' + row.path);
      }
      // Re-resolve original logical relationships after retirement, before any stable/PASS assertion.
      requireValue(selectedCompilerMapping !== null && compilerOwnership.before !== null
        && compilerOwnership.beforeSaved && inputBaselineSaved, 'Observed compiler owner baseline must be saved');
      compilerOwnership.after = await bounded('recheck fixed compiler owner relationships',
        () => observeCompilerOwnership(selectedCompilerMapping.owners, selectedCompilerMapping.compiler), true);
      await saveJSON('compiler-owner-after.json', compilerOwnership.after, true);
      requireValue(compilerOwnership.after.complete
        && JSON.stringify(compilerOwnership.after) === JSON.stringify(compilerOwnership.before),
        'Fixed logical compiler owner relationships changed or were unobserved');
      compilerOwnership.stable = true;
      identitiesStable = inputBaselineSaved && compilerOwnership.stable;
      await saveJSON('identity-after.json', after.sort((left, right) => left.path.localeCompare(right.path)), true);
      await saveJSON('requests.json', requests, true); await saveJSON('browser-events.json', events, true);
      const complete = collected && identitiesStable && !firstError && !overflow && retirement.browser === 'closed' && retirement.server === 'closed'
        && retirement.contexts.length === 2 && retirement.contexts.every(row => row.state === 'closed') && retirement.fixtures.length === 2;
      const status = complete ? captures.every(row => row.observation.pass) ? 'PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET' : 'FAIL_SEQUENCE_PLAYBACK_OPAQUE_SUBSET' : 'INCOMPLETE';
      await saveJSON('result.json', receipt(status), true);
      process.stdout.write(JSON.stringify({ status, completedCaptures: captures.length, comparedChannels: receipt(status).comparedChannels, output, fullA2: false }) + '\n');
      process.exitCode = status === 'PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET' ? 0 : status === 'FAIL_SEQUENCE_PLAYBACK_OPAQUE_SUBSET' ? 1 : 2;
    } catch (cause) {
      remember(cause); identitiesStable = false; compilerOwnership.stable = false; process.exitCode = 2;
      try { writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...receipt('INCOMPLETE'), finalReceiptError: errorRecord(cause) }, null, 2) + '\n'); }
      catch { /* Root retains missing artifact as incomplete. */ }
      process.stderr.write(JSON.stringify({ status: 'INCOMPLETE', firstError, finalReceiptError: errorRecord(cause) }) + '\n');
    }
  } else { process.exitCode = 2; process.stderr.write(JSON.stringify({ status: 'INCOMPLETE', firstError }) + '\n'); }
  clearTimeout(hardTimer);
}
