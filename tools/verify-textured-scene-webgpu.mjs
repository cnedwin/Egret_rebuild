// First-party Apache-2.0 finite public native verifier. No compiler or dependency provisioning.
// Current source acceptance is a separate receipt; this tool records actual per-run observations.
import { readFile, writeFile, mkdir, realpath, lstat, readdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { FIXTURE, verifyPixels, verifySensitivity, CombinedPixelAssertion, CombinedMetadataAssertion } from './textured-scene-webgpu/oracle.mjs';

const repositoryCandidate = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_FILES = ['tools/verify-textured-scene-webgpu.mjs', 'tools/textured-scene-webgpu/index.html',
  'tools/textured-scene-webgpu/main.mjs', 'tools/textured-scene-webgpu/oracle.mjs'];
const REGISTRY = 'packages/engine/dist/internal/texturedFrameState.js';
const REGISTRY_ALIAS = '#egret-textured-frame-state';
const ENGINE = 'packages/engine/dist/Engine.js';
const HOST = 'packages/engine/dist/web/WebGPUHost.js';
const ALIASES = Object.freeze({
  '#egret-textured-frame-state': '/' + REGISTRY,
  '@egret/engine': '/packages/engine/dist/index.js',
  '@egret/engine/scene3d': '/packages/engine/dist/rendering/scene3d.js',
  '@egret/engine/webgpu/scene3d': '/packages/engine/dist/web/scene3d.js',
  '@egret/engine/webgpu': '/packages/engine/dist/web/webgpu.js',
  '@egret/runtime': '/packages/runtime/dist/index.js',
  '@egret/contracts': '/packages/contracts/dist/index.js',
  'robust-predicates': '/dependency/robust-predicates/index.js',
});
const ENTRIES = ['packages/engine/dist/index.js', 'packages/engine/dist/rendering/scene3d.js',
  'packages/engine/dist/web/scene3d.js', 'packages/engine/dist/web/webgpu.js'];
// Current source identities must be supplied explicitly; no implicit acceptance of drift.
const PRODUCT_PATHS = [
  "packages/engine/web/webgpuBufferPool.ts",
  "packages/engine/dist/web/webgpuBufferPool.js",
  "packages/engine/dist/web/webgpuBufferPool.d.ts",
  "packages/engine/web/webgpuBindingCache.ts",
  "packages/engine/dist/web/webgpuBindingCache.js",
  "packages/engine/dist/web/webgpuBindingCache.d.ts",
  "packages/engine/web/prepareTexturedSubmission2D.ts",
  "packages/engine/web/WebGPUHost.ts",
  "packages/engine/web/b1.ts",
  "packages/engine/web/scene3d.ts",
  "packages/engine/dist/web/prepareTexturedSubmission2D.js",
  "packages/engine/dist/web/prepareTexturedSubmission2D.d.ts",
  "packages/engine/dist/web/WebGPUHost.js",
  "packages/engine/dist/web/WebGPUHost.d.ts",
  "packages/engine/dist/web/b1.js",
  "packages/engine/dist/web/b1.d.ts",
  "packages/engine/dist/web/scene3d.js",
  "packages/engine/dist/web/scene3d.d.ts"
];const LIMITS = Object.freeze({ modules: 256, moduleBytes: 1048576, graphBytes: 8388608,
  identities: 8192, inputBytes: 805306368, artifactBytes: 4194304, totalArtifactBytes: 33554432,
  events: 128, requests: 512, installedFiles: 4096, installedTreeBytes: 536870912 });
const BUDGETS = Object.freeze({ operationMs: 210000, cleanupMs: 260000, hardMs: 280000, perOperationMs: 20000, nativeWindowMs: 170000 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const samePath = (a, b) => process.platform === 'win32' ? a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase() : a === b;
const inside = (root, file) => { const tail = path.relative(root, file); return tail === '' || (!path.isAbsolute(tail) && tail !== '..' && !tail.startsWith('..' + path.sep)); };
const fault = (cause, depth = 0) => ({ name: typeof cause?.name === 'string' ? cause.name : 'Unknown',
  code: typeof cause?.code === 'string' ? cause.code : null, message: String(cause?.message ?? cause).slice(0, 16000),
  reason: cause?.reason ?? null, assertion: cause?.assertion ?? null, x: cause?.x ?? null, y: cause?.y ?? null,
  expected: cause?.expected ?? null, actual: cause?.actual ?? null, channels: cause?.channels ?? null,
  cause: depth < 2 && cause?.cause !== undefined ? fault(cause.cause, depth + 1) : null });
function policy(condition, reason, details = {}) {
  if (!condition) { const error = new Error('COMBINED_VERIFIER:' + reason); error.reason = reason; error.details = details; throw error; }
}
function options(argv) {
  policy(argv.length === 10, 'CLI_OPTIONS');
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    policy(['--playwright', '--channel', '--output', '--snapshot', '--snapshot-sha256'].includes(key) && !Object.hasOwn(values, key)
      && typeof value === 'string' && value.length > 0, 'CLI_OPTIONS');
    values[key] = value;
  }
  policy(values['--channel'] === 'msedge' && path.isAbsolute(values['--playwright']) && path.isAbsolute(values['--output']) && path.isAbsolute(values['--snapshot']) && /^[a-f0-9]{64}$/.test(values['--snapshot-sha256']), 'CLI_PROFILE');
  return values;
}
async function readIdentity(file, maximum = LIMITS.moduleBytes) {
  const actual = await realpath(file), info = await lstat(actual);
  policy(info.isFile() && info.size <= maximum, 'FILE_BUDGET', { file, bytes: info.size, maximum });
  const body = await readFile(actual);
  policy(body.length === info.size, 'FILE_CHANGED_DURING_READ', { file });
  return { path: actual, bytes: body.length, sha256: hash(body), body };
}
const descriptor = item => ({ path: item.path, bytes: item.bytes, sha256: item.sha256 });
async function directoryChain(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    const info = await lstat(current);
    policy(info.isDirectory() && !info.isSymbolicLink() && samePath(await realpath(current), current), 'DIRECTORY_ALIAS', { path: current });
    if (path.dirname(current) === current) break;
  }
}
async function freshOutput(requested, repository) {
  const output = path.resolve(requested);
  policy(samePath(requested, output) && !inside(repository, output), 'OUTPUT_PATH');
  try { await lstat(output); policy(false, 'OUTPUT_EXISTS'); } catch (cause) { if (cause?.code !== 'ENOENT') throw cause; }
  await directoryChain(path.dirname(output));
  await mkdir(output);
  await directoryChain(output);
  return output;
}
function artifactStore(output) {
  let total = 0;
  const records = new Map();
  return { records, async save(name, body) {
    policy(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !records.has(name), 'ARTIFACT_NAME');
    policy(body.length <= LIMITS.artifactBytes && total + body.length <= LIMITS.totalArtifactBytes, 'ARTIFACT_BUDGET');
    const file = path.join(output, name);
    await writeFile(file, body, { flag: 'wx' });
    total += body.length;
    const item = { name, path: file, bytes: body.length, sha256: hash(body) };
    records.set(name, item);
    return item;
  }, async json(name, value) { return this.save(name, Buffer.from(JSON.stringify(value) + '\n')); } };
}
// The finite lexer follows the retained first-party collector idiom; it never evaluates modules.
function tokens(text) {
  const result = [];
  let index = 0;
  while (index < text.length) {
    const start = index, character = text[index];
    if (/\s/.test(character)) { index++; continue; }
    if (text.startsWith('//', index)) { index = text.indexOf('\n', index + 2); if (index < 0) break; continue; }
    if (text.startsWith('/*', index)) { const end = text.indexOf('*/', index + 2); policy(end >= 0, 'MODULE_COMMENT'); index = end + 2; continue; }
    if (character === '"' || character === "'") {
      index++;
      while (index < text.length && text[index] !== character) { if (text[index] === '\\') index++; index++; }
      policy(index < text.length, 'MODULE_STRING');
      index++;
      result.push({ kind: 'string', value: text.slice(start + 1, index - 1) });
      continue;
    }
    if (character === String.fromCharCode(96)) {
      index++;
      while (index < text.length && text[index] !== String.fromCharCode(96)) { if (text[index] === '\\') index++; index++; }
      policy(index < text.length, 'MODULE_TEMPLATE');
      const body = text.slice(start + 1, index++);
      policy(!/\bimport\b/.test(body), 'MODULE_TEMPLATE_IMPORT');
      continue;
    }
    if (/[A-Za-z_$]/.test(character)) {
      index++;
      while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index++;
      result.push({ kind: 'word', value: text.slice(start, index) });
      continue;
    }
    index++;
    result.push({ kind: 'punctuation', value: character });
  }
  return result;
}
function literalImports(text) {
  const lexical = tokens(text), imports = [];
  const admit = (token, dynamic) => {
    policy(token?.kind === 'string' && token.value.length > 0 && !/[\\\s?%:\0]/.test(token.value), 'MODULE_IMPORT_LITERAL');
    policy(!token.value.includes('#') || token.value === REGISTRY_ALIAS, 'MODULE_PRIVATE_ALIAS');
    imports.push({ specifier: token.value, dynamic });
  };
  for (let index = 0; index < lexical.length; index++) {
    const token = lexical[index];
    if (token.kind !== 'word') continue;
    if (token.value === 'import') {
      const next = lexical[index + 1];
      policy(next?.value !== '.', 'MODULE_IMPORT_META');
      if (next?.value === '(') { admit(lexical[index + 2], true); policy(lexical[index + 3]?.value === ')', 'MODULE_DYNAMIC_IMPORT'); }
      else if (next?.kind === 'string') admit(next, false);
      else {
        let cursor = index + 1;
        while (cursor < lexical.length && ![';', 'from'].includes(lexical[cursor].value)) cursor++;
        policy(lexical[cursor]?.value === 'from', 'MODULE_STATIC_IMPORT');
        admit(lexical[cursor + 1], false);
      }
    } else if (token.value === 'export' && ['{', '*'].includes(lexical[index + 1]?.value)) {
      let cursor = index + 1;
      while (cursor < lexical.length && ![';', 'from'].includes(lexical[cursor].value)) cursor++;
      if (lexical[cursor]?.value === 'from') admit(lexical[cursor + 1], false);
    }
  }
  return imports;
}
function sourceCounterpart(relative) {
  const matched = /^packages\/(engine|runtime|contracts)\/dist\/(.+)\.js$/.exec(relative);
  if (!matched) return null;
  const [, name, tail] = matched;
  return 'packages/' + name + '/' + (name === 'engine' && /^(web|rendering)\//.test(tail) ? '' : 'src/') + tail + '.ts';
}
function resolveModule(specifier, parent) {
  if (specifier === REGISTRY_ALIAS) {
    policy(parent === '/' + HOST, 'REGISTRY_ALIAS_PARENT', { parent });
    return ALIASES[specifier];
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    policy(specifier.endsWith('.js'), 'MODULE_EXTENSION', { specifier });
    const resolved = new URL(specifier, 'http://fixture.invalid' + parent).pathname;
    const prefix = parent.startsWith('/dependency/robust-predicates/') ? '/dependency/robust-predicates/' : '/packages/';
    policy(resolved.startsWith(prefix) && !resolved.includes('%'), 'MODULE_ESCAPE', { parent, specifier });
    return resolved;
  }
  policy(Object.hasOwn(ALIASES, specifier) && !specifier.startsWith('#'), 'MODULE_BARE_IMPORT', { parent, specifier });
  return ALIASES[specifier];
}
async function collectGraph(repository, robustRoot, retain) {
  const modules = new Map();
  let total = 0;
  const dynamicEdges = [];
  async function visit(url) {
    if (modules.has(url)) return;
    policy(modules.size < LIMITS.modules, 'GRAPH_MODULE_COUNT');
    let relative, logical, firstParty;
    if (url.startsWith('/dependency/robust-predicates/')) {
      relative = url.slice('/dependency/robust-predicates/'.length);
      logical = path.join(robustRoot, relative);
      firstParty = false;
    } else {
      relative = url.slice(1);
      policy(/^packages\/(engine|runtime|contracts)\/dist\/[A-Za-z0-9_./-]+\.js$/.test(relative), 'GRAPH_PUBLIC_CLOSURE', { url });
      logical = path.join(repository, relative);
      firstParty = true;
    }
    const actual = await realpath(logical);
    policy(inside(firstParty ? repository : robustRoot, actual), 'GRAPH_CONTAINMENT', { url, actual });
    if (firstParty) policy(samePath(logical, actual), 'EMISSION_EXACT_PATH', { relative, actual });
    policy(!/(?:^|\/)(?:CanvasHost|canvas)\.js$/.test(relative), 'NO_CANVAS_FALLBACK_MODULE');
    const item = await readIdentity(logical);
    total += item.bytes;
    policy(total <= LIMITS.graphBytes, 'GRAPH_BYTES');
    retain(item, firstParty ? 'public-emission' : 'canonical-robust-module');
    const code = new TextDecoder('utf-8', { fatal: true }).decode(item.body);
    const row = { url, relative, firstParty, ...descriptor(item), body: item.body, edges: [] };
    modules.set(url, row);
    if (firstParty) {
      const source = sourceCounterpart(relative), sourceFile = path.join(repository, source);
      const sourceIdentity = await readIdentity(sourceFile);
      policy(samePath(sourceIdentity.path, sourceFile), 'SOURCE_EXACT_PATH', { source });
      retain(sourceIdentity, 'public-source');
      row.source = { relative: source, ...descriptor(sourceIdentity) };
    }
    for (const imported of literalImports(code)) {
      const selectedURL = resolveModule(imported.specifier, url);
      const edge = { ...imported, url: selectedURL };
      row.edges.push(edge);
      if (edge.dynamic) {
        policy(relative === HOST && imported.specifier === './b1.js' && selectedURL === '/packages/engine/dist/web/b1.js', 'DYNAMIC_EDGE_BOUND', { parent: relative, ...edge });
        dynamicEdges.push({ parent: relative, ...edge });
      }
      await visit(selectedURL);
    }
  }
  for (const entry of ENTRIES) await visit('/' + entry);
  policy(dynamicEdges.length === 1 && modules.has('/' + ENGINE) && modules.has('/' + HOST) && modules.has('/' + REGISTRY), 'GRAPH_REQUIRED_IDENTITIES');
  const engine = modules.get('/' + ENGINE), host = modules.get('/' + HOST), registry = modules.get('/' + REGISTRY);
  const engineEdges = engine.edges.filter(edge => edge.url === '/' + REGISTRY), hostEdges = host.edges.filter(edge => edge.url === '/' + REGISTRY);
  policy(engineEdges.length === 1 && engineEdges[0].specifier === './internal/texturedFrameState.js'
    && hostEdges.length === 1 && hostEdges[0].specifier === REGISTRY_ALIAS, 'SHARED_REGISTRY_IDENTITY');
  return { modules, totalBytes: total, dynamicEdges, registry: { url: '/' + REGISTRY, ...descriptor(registry),
    source: registry.source, engineEdges, hostEdges, meaning: 'One canonical ESM URL joins Engine registration and Host admission; harness imports only public routes' } };
}
function numericFault(cause) { return { ...fault(cause), zeroTolerance: cause?.zeroTolerance ?? null }; }
function publicIdle(status) {
  return status?.host?.pendingFrames === 0 && status.host.pendingUploadBytes === 0 && status.host.pendingReadbackBytes === 0
    && status.textured?.pendingGeometryBytes === 0 && status.scene?.pendingSceneBytes === 0
    && status.scene.pendingUniformBytes === 0 && status.scene.pendingDepthBytes === 0 && status.host.firstFailure === null;
}
function nativeCleanup(report) {
  const cleanup = report?.cleanup;
  const retired = !report?.hostCreated || (cleanup?.host?.host?.pendingFrames === 0 && cleanup.host.host.pendingUploadBytes === 0
    && cleanup.host.host.pendingReadbackBytes === 0 && cleanup.host.textured?.pendingGeometryBytes === 0
    && cleanup.host.scene?.pendingSceneBytes === 0 && cleanup.host.scene.pendingUniformBytes === 0 && cleanup.host.scene.pendingDepthBytes === 0);
  // Early failures owe only actual created handles. A retained original render failure is not a cleanup failure.
  return Boolean(report && cleanup?.failures?.length === 0 && retired && cleanup.pendingOperations === 0
    && cleanup.acquisitionStates.every(row => row.settled === true)
    && (!report.scopeCreated || cleanup.scopeState === 'closed')
    && (!report.nodesCreatedCount || cleanup.nodesDisposed === true)
    && (!report.textureCreated || cleanup.textureDisposed === true)
    && (!report.leaseAcquired || cleanup.providerDisposeCalls === 1)
    && (!report.leaseAcquired || cleanup.leaseValueRevoked === true)
    && (!report.engineCreated || cleanup.engineDisposed)
    && (!report.hostCreated || (cleanup.hostSafeCloseObserved && cleanup.host?.host?.state === 'closed' && cleanup.host.host.cleanupOutcome === 'safe'))
    && (!report.deviceAcquired || (cleanup.deviceDestroyed && cleanup.deviceLossSettled)));
}

async function main(argv) {
  const began = Date.now(), operationDeadline = began + BUDGETS.operationMs, cleanupDeadline = began + BUDGETS.cleanupMs;
  const report = { schema: 'egret.combined-native-verification/1', status: 'INCOMPLETE', startedAtUTC: new Date(began).toISOString(),
    launch: { channel: 'msedge', headless: true, callerAddedFlags: [], deviceScaleFactor: 1, freshContext: true },
    environment: { node: process.version, platform: process.platform, architecture: process.arch, browserVersion: null,
      browserExecutableIdentity: 'UNBOUND by public channel API' }, limits: LIMITS, budgets: BUDGETS,
    source: { expectedProduct: PRODUCT_PATHS, actualProduct: [], importMap: { imports: ALIASES }, graph: null, tools: [] },
    installedTools: [], positives: [], sensitivity: { status: 'NOT_RUN', id: 'CHNC01', rendererMutation: 'none', newBrowserFrames: 0 },
    native: null, requests: [], browserEvents: [], failure: null, cleanupFailures: [],
    rawCheck: { status: 'NOT_RUN', expectedObservations: 2, expectedPixelsPerObservation: 12, observations: 0, checkedPixels: 0 },
    safeNative: { status: 'NOT_RUN' }, windowRun: { status: 'NOT_RUN' },
    lifecycle: { pageClosed: false, contextClosed: false, browserClosed: false, serverClosed: false,
      created: { page: false, context: false, browser: false, server: false }, serverStarted: false,
      identitiesStable: false, artifactsStable: false, pendingOperations: null, lateAcquisitionsSettled: false,
      cooperativeAPIClosure: false, osProcessRetirement: 'UNBOUND' },
    claims: { fixedPositiveFrames: 2, fixedPositiveSamples: 24, oracleSensitivitySamples: 1, wholeImageColorEquality: false,
      nativePassSubmitCounters: 'Separate accepted CPU/source evidence only', privateTextureCounter: 'No public counter claimed',
      performance: false, phone: false, fullSpine: false, R020: 'OPEN', V020: 'OPEN' } };
  const pending = new Set(), acquisitions = [], pages = new Set(), contexts = new Set(), sockets = new Set(), identities = new Map();
  const buffers = new Map();
  let inputBytes = 0, output, store, repository, browser, context, page, server, origin, closeRequested = false;
  let incomplete = false, setupFailure = false;
  const observe = promise => {
    if (!pending.has(promise)) {
      pending.add(promise);
      promise.then(() => pending.delete(promise), () => pending.delete(promise));
    }
    return promise;
  };
  async function bounded(promise, label, cleanup = false, perOperation = BUDGETS.perOperationMs) {
    observe(promise);
    const remaining = Math.min(perOperation, (cleanup ? cleanupDeadline : operationDeadline) - Date.now());
    policy(remaining > 0, 'DEADLINE', { label });
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => {
      const error = new Error('COMBINED_VERIFIER_TIMEOUT:' + label); error.reason = 'TIMEOUT'; reject(error);
    }, remaining); })]); } finally { clearTimeout(timer); }
  }
  function acquire(promise, label, assign) {
    const row = { label, settled: false, promise: null };
    row.promise = observe(promise.then(value => { row.settled = true; assign(value); return value; }, cause => { row.settled = true; throw cause; }));
    acquisitions.push(row);
    return row.promise;
  }
  function retain(item, role) {
    const key = process.platform === 'win32' ? item.path.toLowerCase() : item.path, before = identities.get(key);
    policy(!before || (before.bytes === item.bytes && before.sha256 === item.sha256), 'INPUT_CHANGED', { path: item.path });
    if (!before) { inputBytes += item.bytes; policy(identities.size < LIMITS.identities && inputBytes <= LIMITS.inputBytes, 'INPUT_BUDGET'); }
    identities.set(key, { ...descriptor(item), roles: [...new Set([...(before?.roles ?? []), role])] });
  }
  async function pin(file, role, maximum) {
    const item = await readIdentity(file, maximum);
    retain(item, role);
    return item;
  }
  const addEvent = event => {
    if (report.browserEvents.length >= LIMITS.events) { incomplete = true; report.eventOverflow = true; return; }
    report.browserEvents.push(event);
  };
  const cleanupFailure = (label, cause) => { incomplete = true; report.cleanupFailures.push({ label, ...fault(cause) }); };
  async function installedTree(root, role) {
    let count = 0, total = 0;
    async function visit(directory) {
      for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        policy(++count <= LIMITS.installedFiles && !entry.isSymbolicLink(), 'INSTALLED_TREE_KIND_OR_COUNT');
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(file);
        else {
          policy(entry.isFile(), 'INSTALLED_FILE_KIND');
          const item = await pin(file, role, 134217728);
          policy(inside(root, item.path), 'INSTALLED_TREE_CONTAINMENT');
          total += item.bytes;
          policy(total <= LIMITS.installedTreeBytes, 'INSTALLED_TREE_BYTES');
        }
      }
    }
    await visit(root);
    return { root, filesAndDirectories: count, fileBytes: total, identityScope: 'Existing installed tree only; no install or copy' };
  }
  const hardTimer = setTimeout(() => {
    report.status = 'INCOMPLETE';
    report.failure = { name: 'HardDeadline', message: 'Started operations and cooperative cleanup remain unproven' };
    report.lifecycle.pendingOperations = pending.size;
    if (output) try { writeFileSync(path.join(output, 'hard-abort.json'), JSON.stringify(report) + '\n', { flag: 'wx' }); } catch {}
    process.stderr.write('Combined native verifier INCOMPLETE: hard deadline\n');
    process.exit(1);
  }, BUDGETS.hardMs);
  try {
    const cli = options(argv);
    policy(process.version === 'v26.7.0', 'NODE_PROFILE');
    repository = await realpath(repositoryCandidate);
    output = await freshOutput(cli['--output'], repository);
    store = artifactStore(output);
    report.output = output;
    report.environment.nodeExecutable = descriptor(await pin(process.execPath, 'node-executable', 134217728));
    const installed = await realpath(cli['--playwright']);
    const playwrightMetadata = JSON.parse((await pin(path.join(installed, 'package.json'), 'playwright-metadata')).body.toString('utf8'));
    policy(playwrightMetadata.name === 'playwright' && playwrightMetadata.version === '1.62.1', 'PLAYWRIGHT_PROFILE');
    const require = createRequire(path.join(installed, 'package.json'));
    const coreMetadataPath = await realpath(require.resolve('playwright-core/package.json'));
    const coreMetadata = JSON.parse((await pin(coreMetadataPath, 'playwright-core-metadata')).body.toString('utf8'));
    policy(coreMetadata.name === 'playwright-core' && coreMetadata.version === '1.62.1', 'PLAYWRIGHT_CORE_PROFILE');
    report.installedTools = [await bounded(observe(installedTree(installed, 'installed-playwright-tree')), 'pin-playwright'),
      await bounded(observe(installedTree(path.dirname(coreMetadataPath), 'installed-playwright-core-tree')), 'pin-playwright-core')];
    for (const relative of ['packages/engine/package.json', 'packages/runtime/package.json', 'packages/contracts/package.json', 'package.json', 'pnpm-lock.yaml']) {
      await pin(path.join(repository, relative), 'repository-metadata');
    }
    const engineMetadata = JSON.parse((await pin(path.join(repository, 'packages/engine/package.json'), 'engine-routing')).body.toString('utf8'));
    policy(engineMetadata.exports?.['.']?.import === './dist/index.js'
      && engineMetadata.exports?.['./scene3d']?.import === './dist/rendering/scene3d.js'
      && engineMetadata.exports?.['./webgpu/scene3d']?.import === './dist/web/scene3d.js'
      && engineMetadata.exports?.['./webgpu']?.import === './dist/web/webgpu.js'
      && engineMetadata.imports?.[REGISTRY_ALIAS]?.import === './dist/internal/texturedFrameState.js'
      && engineMetadata.dependencies?.['robust-predicates'] === '3.0.3', 'PUBLIC_ROUTING_PROFILE');
    const snapshotRaw=await pin(cli['--snapshot'],'reviewed-current-snapshot');
    policy(snapshotRaw.sha256===cli['--snapshot-sha256'],'REVIEWED_SNAPSHOT_DIGEST');
    const snapshot=JSON.parse(snapshotRaw.body.toString('utf8'));
    policy(snapshot.suite==='textured-scene'&&samePath(snapshot.repository,repository)&&Array.isArray(snapshot.inputs),'REVIEWED_SNAPSHOT_OWNER');
    const expectedProducts=PRODUCT_PATHS.map(name=>{const row=snapshot.inputs.find(x=>samePath(x.path,path.join(repository,name)));policy(row,'REVIEWED_PRODUCT_MISSING');return {...row,path:name};});
    for (const expected of expectedProducts) {
      const item = await pin(path.join(repository, expected.path), 'accepted-product-cutoff');
      policy(samePath(item.path, path.join(repository, expected.path)) && item.bytes === expected.bytes && item.sha256 === expected.sha256, 'ACCEPTED_PRODUCT_IDENTITY', { expected, actual: descriptor(item) });
      report.source.actualProduct.push({ relative: expected.path, ...descriptor(item) });
    }
    const robustRoot = await realpath(path.join(repository, 'packages/engine/node_modules/robust-predicates'));
    const robustMetadata = JSON.parse((await pin(path.join(robustRoot, 'package.json'), 'canonical-robust-metadata')).body.toString('utf8'));
    policy(robustMetadata.name === 'robust-predicates' && robustMetadata.version === '3.0.3' && robustMetadata.type === 'module'
      && robustMetadata.exports === './index.js', 'ROBUST_PROFILE');
    const graph = await bounded(observe(collectGraph(repository, robustRoot, retain)), 'public-graph');
    const served = new Map([...graph.modules].map(([url, row]) => [url, { ...row, contentType: 'text/javascript; charset=utf-8' }]));
    for (const relative of TOOL_FILES) {
      const item = await pin(path.join(repository, relative), 'native-tool');
      policy(samePath(item.path, path.join(repository, relative)), 'TOOL_EXACT_PATH');
      report.source.tools.push({ relative, ...descriptor(item) });
      if (relative !== TOOL_FILES[0]) served.set('/' + relative, { ...item, contentType: relative.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
    }
    const html = served.get('/tools/textured-scene-webgpu/index.html').body.toString('utf8');
    const maps = [...html.matchAll(/<script\s+type="importmap">([\s\S]*?)<\/script>/g)];
    policy(maps.length === 1 && JSON.stringify(JSON.parse(maps[0][1])) === JSON.stringify({ imports: ALIASES }), 'HTML_IMPORTMAP_EXACT');
    report.source.graph = { entryURLs: ENTRIES.map(value => '/' + value), moduleCount: graph.modules.size, moduleBytes: graph.totalBytes,
      dynamicEdges: graph.dynamicEdges, registry: graph.registry, canonicalRobustRoot: robustRoot,
      modules: [...graph.modules.values()].map(({ body, ...row }) => row) };
    await bounded(observe(store.json('source-graph.json', report.source)), 'save-source-graph');
    await bounded(observe(store.json('identity-before.json', [...identities.values()])), 'save-identity-before');
    server = createServer((request, response) => {
      const rawURL = request.url ?? '';
      const selected = new URL(rawURL, origin ?? 'http://127.0.0.1').pathname;
      const row = served.get(selected);
      const favicon = selected === '/favicon.ico' && rawURL === '/favicon.ico';
      const admitted = ['GET', 'HEAD'].includes(request.method) && !rawURL.includes('%') && !rawURL.includes('?') && (Boolean(row) || favicon);
      if (report.requests.length >= LIMITS.requests) { incomplete = true; report.requestOverflow = true; response.writeHead(429); response.end(); return; }
      report.requests.push({ method: request.method, url: selected, admitted, bytes: row?.bytes ?? 0, sha256: row?.sha256 ?? null, favicon });
      if (!admitted) { incomplete = true; response.writeHead(404); response.end(); return; }
      if (favicon) { response.writeHead(204); response.end(); return; }
      response.writeHead(200, { 'Content-Type': row.contentType, 'Content-Length': row.bytes, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none';script-src 'self' 'unsafe-inline';style-src 'unsafe-inline';img-src 'self';connect-src 'none';base-uri 'none'" });
      response.end(request.method === 'HEAD' ? undefined : row.body);
    });
    report.lifecycle.created.server = true;
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    server.on('error', cause => { incomplete = true; report.serverFailure = fault(cause); });
    await bounded(acquire(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }),
      'server-listen', () => { report.lifecycle.serverStarted = true; }), 'server-listen');
    origin = 'http://127.0.0.1:' + server.address().port;
    const playwright = await import(pathToFileURL(path.join(installed, 'index.mjs')).href);
    browser = await bounded(acquire(playwright.chromium.launch({ channel: 'msedge', headless: true }), 'browser', value => {
      browser = value;
      report.lifecycle.created.browser = true;
      value.on('disconnected', () => { if (!closeRequested) { incomplete = true; report.unexpectedBrowserDisconnect = true; } });
    }), 'browser-launch');
    report.environment.browserVersion = browser.version();
    context = await bounded(acquire(browser.newContext({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 }), 'context', value => { context = value; contexts.add(value); report.lifecycle.created.context = true; }), 'context');
    page = await bounded(acquire(context.newPage(), 'page', value => { page = value; pages.add(value); report.lifecycle.created.page = true; }), 'page');
    page.on('pageerror', cause => addEvent({ kind: 'pageerror', ...fault(cause) }));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) addEvent({ kind: 'console', level: message.type(), text: message.text().slice(0, 16000), location: message.location() }); });
    page.on('requestfailed', request => addEvent({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText ?? 'unknown' }));
    page.on('response', response => { if (response.status() >= 400) addEvent({ kind: 'HTTP', url: response.url(), status: response.status() }); });
    await bounded(observe(page.exposeBinding('__retainCombinedObservation', (source, packet) => observe((async () => {
      const expected = FIXTURE.observations[report.positives.length];
      policy(source.page === page && expected && packet?.id === expected.id && Array.isArray(packet.readback?.bytes), 'OBSERVATION_IDENTITY');
      policy(packet.readback.bytes.length <= 65536 && packet.readback.bytes.every(value => Number.isInteger(value) && value >= 0 && value <= 255), 'DELIVERED_BYTES');
      const bytes = Buffer.from(packet.readback.bytes), readback = { ...packet.readback, bytes };
      // Persist authentic complete bytes and metadata before any pixel comparator.
      const raw = await bounded(observe(store.save(packet.id + '.rgba', bytes)), 'save-raw-' + packet.id);
      const metadata = { ...packet, readback: { ...packet.readback, bytes: undefined, byteLength: bytes.length, rawArtifact: raw } };
      const metadataArtifact = await bounded(observe(store.json(packet.id + '-metadata.json', metadata)), 'save-metadata-' + packet.id);
      const observation = { id: packet.id, raw, metadataArtifact, metadata, status: 'NOT_CHECKED', checks: [], failure: null };
      report.positives.push(observation);
      buffers.set(packet.id, readback);
      try {
        const result = verifyPixels(readback, packet.id);
        observation.status = 'PASS';
        observation.metadataCheck = result.metadata;
        observation.checks = result.checks;
      } catch (cause) {
        if (cause instanceof CombinedPixelAssertion) {
          observation.status = 'PIXEL_FAIL'; observation.checks = cause.checks ?? [];
        } else if (cause instanceof CombinedMetadataAssertion) observation.status = 'READBACK_FAIL';
        else throw cause;
        observation.failure = numericFault(cause);
      }
      const index = FIXTURE.observations.findIndex(value => value.id === packet.id);
      policy(packet.capture?.frameId === expected.expectedFrameId && packet.capture.width === 64 && packet.capture.height === 64
        && packet.capture.clearColor === 0 && packet.capture.clearAlpha === 1 && packet.capture.scopeState === 'open'
        && packet.capture.images === 1 && packet.capture.geometries === 1
        && JSON.stringify(packet.capture.commandKinds) === JSON.stringify(expected.expectedCommandKinds)
        && JSON.stringify(packet.capture.stageChildOrder) === JSON.stringify(expected.stageChildOrder)
        && packet.renderReturn === 'undefined' && packet.before?.host?.lastSerial === index
        && packet.after?.host?.lastSerial === index + 1 && publicIdle(packet.before) && publicIdle(packet.after), 'PUBLIC_OBSERVATION_METADATA');
      return { retained: true, numericStatus: observation.status };
    })()))), 'retention-binding');
    await bounded(observe(page.goto(origin + '/tools/textured-scene-webgpu/index.html')), 'page-load');
    await bounded(observe(page.waitForFunction(() => globalThis.combinedNativeReady === true)), 'public-modules-ready');
    report.native = await bounded(observe(page.evaluate(() => globalThis.runCombinedNative())), 'native-two-frame-window', false, BUDGETS.nativeWindowMs);
    await bounded(observe(store.json('native-window.json', report.native)), 'save-native-window');
    report.windowRun = { status: report.native.status, observedFrames: report.native.observations?.length ?? 0,
      failure: report.native.failure, browserEvents: report.browserEvents.length };
    report.safeNative = { status: report.native.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : nativeCleanup(report.native) ? 'PASS' : 'CLEANUP_FAILED',
      cleanup: report.native.cleanup, deviceLoss: report.native.deviceLoss, unexpectedDeviceLoss: report.native.unexpectedDeviceLoss };
    if (report.native.status === 'SCENE_COMPLETED') {
      policy(report.native.deviceAcquired && report.native.hostCreated && report.native.engineCreated && report.native.scopeCreated
        && report.native.textureCreated && report.native.providerRegistered && report.native.leaseAcquired && report.native.nodesCreatedCount === 5
        && report.native.devicePolicy === 'borrow', 'ACTUAL_CREATED_SCENE_RESOURCES');
      policy(report.native.observations?.length === 2 && report.positives.length === 2, 'EXACT_TWO_POSITIVES');
      const second = buffers.get('CHN02');
      try {
        verifySensitivity(second);
        report.sensitivity = { ...report.sensitivity, status: 'CONTROL_NOT_SENSITIVE', oracleFrom: 'CHN01', rawBufferFrom: 'CHN02',
          rawArtifact: report.positives[1].raw, failure: null };
      } catch (cause) {
        const assigned = cause instanceof CombinedPixelAssertion && cause.oracleId === 'CHN01' && cause.assertion === 'ui-order-overlap'
          && cause.x === 34 && cause.y === 32 && JSON.stringify(cause.expected) === JSON.stringify([0, 255, 0, 255])
          && JSON.stringify(cause.actual) === JSON.stringify([255, 255, 0, 255]) && JSON.stringify(cause.channels) === JSON.stringify([false, true, true, true]);
        report.sensitivity = { ...report.sensitivity, status: assigned ? 'EXPECTED_PIXEL_REJECTION' : 'UNASSIGNED_FAILURE',
          oracleFrom: 'CHN01', rawBufferFrom: 'CHN02', rawArtifact: report.positives[1].raw, assigned,
          failure: numericFault(cause), selectedPixels: 1 };
      }
    }
  } catch (cause) {
    report.failure = fault(cause);
    setupFailure = true;
    if (page) {
      try { report.native ??= await bounded(observe(page.evaluate(() => globalThis.lastCombinedNative?.() ?? null)), 'partial-native-report', true); }
      catch (partialCause) { cleanupFailure('partial-native-report', partialCause); }
    }
  } finally {
    // A deadline does not cancel started acquisitions. Observe and assign late API handles first.
    for (const row of acquisitions) if (!row.settled) {
      try { await bounded(row.promise, 'late-' + row.label, true); } catch (cause) { cleanupFailure('late-' + row.label, cause); }
    }
    for (const value of pages) {
      try { await bounded(observe(value.close()), 'page-close', true); pages.delete(value); report.lifecycle.pageClosed = true; }
      catch (cause) { cleanupFailure('page-close', cause); }
    }
    for (const value of contexts) {
      try { await bounded(observe(value.close()), 'context-close', true); contexts.delete(value); report.lifecycle.contextClosed = true; }
      catch (cause) { cleanupFailure('context-close', cause); }
    }
    if (browser) {
      closeRequested = true;
      try { await bounded(observe(browser.close()), 'browser-close', true); report.lifecycle.browserClosed = true; }
      catch (cause) { cleanupFailure('browser-close', cause); }
    }
    if (server && report.lifecycle.serverStarted) {
      try {
        const closing = observe(new Promise((resolve, reject) => server.close(cause => cause ? reject(cause) : resolve())));
        server.closeIdleConnections();
        await bounded(closing, 'server-close', true);
        report.lifecycle.serverClosed = true;
      } catch (cause) { cleanupFailure('server-close', cause); for (const socket of sockets) socket.destroy(); }
    } else if (server && acquisitions.every(row => row.label !== 'server-listen' || row.settled)) report.lifecycle.serverClosed = true;
    if (pending.size) {
      try { await bounded(observe(Promise.allSettled([...pending])), 'started-operation-drain', true); }
      catch (cause) { cleanupFailure('started-operation-drain', cause); }
    }
    report.lifecycle.pendingOperations = pending.size;
    report.lifecycle.lateAcquisitionsSettled = acquisitions.every(row => row.settled);
    report.lifecycle.acquisitions = acquisitions.map(row => ({ label: row.label, settled: row.settled }));
    const requested = new Set(report.requests.filter(row => row.admitted).map(row => row.url));
    report.source.requestEvidence = { expectedEngineRequested: requested.has('/' + ENGINE), expectedHostRequested: requested.has('/' + HOST),
      sharedRegistryRequested: requested.has('/' + REGISTRY), publicSceneRequested: requested.has(ALIASES['@egret/engine/scene3d']),
      publicCombinedHostRequested: requested.has(ALIASES['@egret/engine/webgpu/scene3d']),
      wrongRegistryURLs: [...requested].filter(url => url.endsWith('/internal/texturedFrameState.js') && url !== '/' + REGISTRY),
      canvasRequests: [...requested].filter(url => /CanvasHost\.js|\/canvas\.js/.test(url)),
      scope: 'Admitted served module URLs and exact one-map identity; no process or executable retirement claim' };
    if (report.native?.status !== 'UNSUPPORTED' && report.native) {
      const evidence = report.source.requestEvidence;
      if (!evidence.expectedEngineRequested || !evidence.expectedHostRequested || !evidence.sharedRegistryRequested
        || !evidence.publicSceneRequested || !evidence.publicCombinedHostRequested || evidence.wrongRegistryURLs.length || evidence.canvasRequests.length) incomplete = true;
    }
    if (store) {
      const reread = [];
      for (const before of identities.values()) {
        try {
          const after = descriptor(await bounded(observe(readIdentity(before.path, 134217728)), 'identity-reread', true));
          reread.push({ before, after, stable: samePath(before.path, after.path) && before.bytes === after.bytes && before.sha256 === after.sha256 });
        } catch (cause) { reread.push({ before, stable: false, failure: fault(cause) }); }
      }
      report.lifecycle.identitiesStable = reread.every(row => row.stable);
      try { await bounded(observe(store.json('identity-after.json', reread)), 'save-identity-after', true); }
      catch (cause) { cleanupFailure('identity-after', cause); }
      const artifacts = [];
      for (const before of store.records.values()) {
        try {
          const after = descriptor(await bounded(observe(readIdentity(before.path, LIMITS.artifactBytes)), 'artifact-reread', true));
          artifacts.push({ before, after, stable: before.bytes === after.bytes && before.sha256 === after.sha256 && samePath(before.path, after.path) });
        } catch (cause) { artifacts.push({ before, stable: false, failure: fault(cause) }); }
      }
      report.lifecycle.artifactsStable = artifacts.every(row => row.stable);
      try { await bounded(observe(store.json('artifact-reread.json', artifacts)), 'save-artifact-reread', true); }
      catch (cause) { cleanupFailure('artifact-reread', cause); }
    }
    const created = report.lifecycle.created;
    report.lifecycle.cooperativeAPIClosure = Boolean((!created.page || report.lifecycle.pageClosed)
      && (!created.context || report.lifecycle.contextClosed) && (!created.browser || report.lifecycle.browserClosed)
      && (!created.server || report.lifecycle.serverClosed) && report.lifecycle.lateAcquisitionsSettled && pending.size === 0 && !report.cleanupFailures.length);
    report.rawCheck.observations = report.positives.length;
    report.rawCheck.checkedPixels = report.positives.reduce((sum, row) => sum + row.checks.length, 0);
    report.rawCheck.status = report.positives.length !== 2 ? 'NOT_COMPLETED'
      : report.positives.some(row => row.status === 'READBACK_FAIL') ? 'READBACK_FAIL'
      : report.positives.some(row => row.status === 'PIXEL_FAIL') ? 'PIXEL_FAIL'
      : report.sensitivity.status !== 'EXPECTED_PIXEL_REJECTION' ? 'CONTROL_NOT_SENSITIVE' : 'PASS';
    if (report.native && report.safeNative.status === 'NOT_RUN') {
      report.safeNative = { status: report.native.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : nativeCleanup(report.native) ? 'PASS' : 'CLEANUP_FAILED', cleanup: report.native.cleanup };
      report.windowRun = { status: report.native.status, observedFrames: report.native.observations?.length ?? 0, failure: report.native.failure };
    }
    if (incomplete || !report.lifecycle.cooperativeAPIClosure || (store && (!report.lifecycle.identitiesStable || !report.lifecycle.artifactsStable))
      || report.browserEvents.length || report.eventOverflow || report.requestOverflow) report.status = 'INCOMPLETE';
    else if (report.native?.status === 'UNSUPPORTED') report.status = 'UNSUPPORTED';
    else if (report.native?.status === 'CLEANUP_FAILED' || (report.native && report.safeNative.status !== 'PASS')) report.status = 'CLEANUP_FAILED';
    else if (report.native?.status === 'SETUP_FAILED') report.status = 'SETUP_FAILED';
    else if (report.native?.status === 'RENDER_FAILED') report.status = 'RENDER_FAILED';
    else if (report.native?.status === 'READBACK_FAILED' || report.rawCheck.status === 'READBACK_FAIL') report.status = 'READBACK_FAILED';
    else if (setupFailure) report.status = 'SETUP_FAILED';
    else if (report.rawCheck.status === 'PIXEL_FAIL') report.status = 'PIXEL_FAIL';
    else if (report.rawCheck.status !== 'PASS') report.status = 'CONTROL_NOT_SENSITIVE';
    else report.status = 'PASS';
    report.finishedAtUTC = new Date().toISOString();
    report.exitCode = report.status === 'PASS' ? 0 : report.status === 'UNSUPPORTED' ? 2 : 1;
    report.artifacts = store ? [...store.records.values()] : [];
    if (store) {
      try {
        const result = await bounded(observe(store.json('result.json', report)), 'save-result', true);
        const actual = await bounded(observe(readIdentity(result.path, LIMITS.artifactBytes)), 'result-reread', true);
        policy(actual.bytes === result.bytes && actual.sha256 === result.sha256, 'RESULT_IDENTITY');
        await bounded(observe(store.json('result-seal.json', { status: report.status, exitCode: report.exitCode, result,
          actual: descriptor(actual), identityMatches: true, scope: 'Actual standalone cooperative API observation; no physical retirement/performance claim' })), 'save-result-seal', true);
      } catch (cause) { report.status = 'INCOMPLETE'; report.exitCode = 1; process.stderr.write('Result persistence failed: ' + cause.message + '\n'); }
    }
    clearTimeout(hardTimer);
    process.stdout.write('Combined scene/textured WebGPU verification: ' + report.status + '\n');
    process.exitCode = report.exitCode;
  }
}
await main(process.argv.slice(2));
