// SPDX-License-Identifier: Apache-2.0
// One bounded native entry. --self-test performs offline UNIT checks and never launches a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fingerprintFile, samePhysicalPath, ownerRelativePath, canonicalTextBytes } from './lib/file-identity.mjs';
import { CASES, CONTROLS, expectedPixels, comparePixels, verifyControl, expectedCounts, verifyCounts } from './webgpu-submission-reuse/oracle.mjs';
import { installNativeObservers } from './webgpu-submission-reuse/fixture.mjs';

const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const SELF = fileURLToPath(import.meta.url);
const TOOL_FILES = ['tools/verify-webgpu-submission-reuse.mjs', 'tools/webgpu-submission-reuse/fixture.mjs',
  'tools/webgpu-submission-reuse/oracle.mjs', 'tools/lib/file-identity.mjs', 'tools/browser-tool-matrix.json'];
const ALIASES = Object.freeze({ '@egret/engine': '/packages/engine/dist/index.js', '@egret/engine/webgpu': '/packages/engine/dist/web/webgpu.js',
  '@egret/engine/scene3d': '/packages/engine/dist/rendering/scene3d.js', '@egret/engine/webgpu/scene3d': '/packages/engine/dist/web/scene3d.js',
  '@egret/contracts': '/packages/contracts/dist/index.js', '@egret/runtime': '/packages/runtime/dist/index.js',
  '#egret-textured-frame-state': '/packages/engine/dist/internal/texturedFrameState.js',
  'robust-predicates': '/dependency/robust-predicates/index.js' });
const ENTRIES = ['packages/engine/dist/index.js', 'packages/engine/dist/web/webgpu.js',
  'packages/engine/dist/rendering/scene3d.js', 'packages/engine/dist/web/scene3d.js'];
const REGISTRY_ALIAS = '#egret-textured-frame-state';
const HOST = 'packages/engine/dist/web/WebGPUHost.js';
const REGISTRY = 'packages/engine/dist/internal/texturedFrameState.js';
const hash = body => createHash('sha256').update(body).digest('hex');
const fault = error => ({ name: error?.name ?? 'Unknown', message: String(error?.message ?? error).slice(0, 16000) });
function policy(value, reason, details = {}) { if (!value) { const error = Error('SUBMISSION_NATIVE:' + reason); error.details = details; throw error; } }
function inside(root, target) { try { ownerRelativePath(root, target); return true; } catch { return samePhysicalPath(root, target); } }
const allowedModules = new Set([
  ...['ImageData2D', 'index', 'TexturedGeometry2D', 'TexturedRenderFrame2D'].map(name => `packages/contracts/dist/${name}.js`),
  ...['assetGroup', 'closeHost', 'createEngine', 'createEngineForProfile', 'Engine', 'gameClock', 'index', 'mouseInput', 'startEngine', 'surfaceOwnership', 'tween'].map(name => `packages/engine/dist/${name}.js`),
  ...['mouseInputFactoryState', 'textFieldFactoryState', 'texturedFrameState'].map(name => `packages/engine/dist/internal/${name}.js`),
  ...['admitTexturedFrame2D', 'copyFrame2D', 'copyMixedFrame2D', 'imageFrameBudget', 'matrix4', 'meshGeometry3D', 'ownedPreparationFailure2D',
    'packedOrientation', 'packedPosition2D', 'packImageVertices2D', 'packMeshGeometry3D', 'packTexturedMesh2D', 'prepareImages2D', 'prepareMixedDraws2D',
    'prepareRectangles2D', 'prepareTexturedDraws2D', 'prepareTexturedMesh2D', 'projection3D', 'sceneFrame3D', 'scene3d', 'texturedPreparationBudget2D'].map(name => `packages/engine/dist/rendering/${name}.js`),
  ...['webgpu', 'b1', 'imageProjections2D', 'prepareTexturedSubmission2D', 'scene3d', 'texturedWebGPUOptions', 'WebGPUHost', 'webgpuImagePass', 'webgpuLifetime',
    'webgpuMeshPass', 'webgpuPass', 'webgpuTexturedPass', 'webgpuBufferPool', 'webgpuBindingCache'].map(name => `packages/engine/dist/web/${name}.js`),
  ...['AssetLease', 'AssetManager', 'assetManagerOwnerState', 'AssetRef', 'Bitmap', 'bitmapDisplayState', 'ByteReader', 'CancellationController',
    'coordinateInverse', 'diagnostics', 'displayBounds', 'displayCoordinates', 'displayHitState', 'displayHitTest', 'displayInputOperations', 'DisplayObject', 'DisplayObjectContainer',
    'displayTransform', 'displayTreeState', 'displayVisualState', 'EgretError', 'Event', 'EventDispatcher', 'frameCapture', 'Graphics', 'imageFrameBudget',
    'index', 'Mesh2D', 'meshCaptureSnapshot', 'meshDisplayState', 'ownership', 'Scope', 'sequenceClip', 'SequencePlayer', 'Sprite', 'Stage',
    'textDisplayState', 'Texture', 'texturedFrameBudget', 'texturedFrameCapture'].map(name => `packages/runtime/dist/${name}.js`),
  // Exact current public literal closure; no additional entries or resolver aliases.
  ...['bitmapResourceSlot', 'bitmapBindingTicket', 'bitmapButton', 'sequencePlayback'].map(name => `packages/engine/dist/${name}.js`),
  ...['atlasFrameLayout', 'bitmapAtlasPlacement', 'ByteWriter', 'NineSliceGeometry2D', 'NineSliceBitmap', 'spriteSheet'].map(name => `packages/runtime/dist/${name}.js`),
  'packages/engine/node_modules/robust-predicates/index.js',
  ...['incircle', 'insphere', 'orient2d', 'orient3d', 'util'].map(name => `packages/engine/node_modules/robust-predicates/esm/${name}.js`),
]);

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

function sourceCounterpart(name) {
  const match = /^packages\/(engine|runtime|contracts)\/dist\/(.+)\.js$/.exec(name);
  policy(match, 'SOURCE_COUNTERPART', { name });
  return `packages/${match[1]}/${match[1] === 'engine' && /^(web|rendering)\//.test(match[2]) ? '' : 'src/'}${match[2]}.ts`;
}
function captureInputs() {
  const inputs = new Map(), served = new Map(); let total = 0;
  function retain(owner, relative, maximum = 1048576) {
    const identity = fingerprintFile(owner, relative), key = owner + '/' + relative;
    policy(identity.bytes <= maximum && inputs.size < 8192, 'INPUT_LIMIT');
    const body = fs.readFileSync(path.join(owner, relative));
    policy(body.length === identity.bytes && hash(body) === identity.sha256, 'INPUT_CHANGED_DURING_READ');
    const row = { owner, ...identity };
    if (inputs.has(key)) assert.deepEqual(inputs.get(key), row); else inputs.set(key, row);
    return { identity: row, body };
  }
  const robustRoot = fs.realpathSync(path.join(ROOT, 'packages/engine/node_modules/robust-predicates'));
  const robust = JSON.parse(retain(robustRoot, 'package.json').body);
  policy(robust.name === 'robust-predicates' && robust.version === '3.0.3', 'ROBUST_PIN');
  function resolveImport(specifier, parent) {
    if (specifier === REGISTRY_ALIAS) { policy(parent === '/' + HOST, 'REGISTRY_OWNER'); return ALIASES[specifier]; }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const selected = new URL(specifier, 'http://fixture.invalid' + parent).pathname;
      policy(specifier.endsWith('.js') && !selected.includes('%') && selected.startsWith(parent.startsWith('/dependency/') ? '/dependency/robust-predicates/' : '/packages/'), 'IMPORT_ESCAPE');
      return selected;
    }
    policy(Object.hasOwn(ALIASES, specifier) && !specifier.startsWith('#'), 'IMPORT_ALIAS'); return ALIASES[specifier];
  }
  const dynamicEdges = [];
  function collect(url) {
    if (served.has(url)) return;
    const third = url.startsWith('/dependency/robust-predicates/');
    const relative = third ? url.slice('/dependency/robust-predicates/'.length) : url.slice(1);
    const allowedName = third ? 'packages/engine/node_modules/robust-predicates/' + relative : relative;
    policy(allowedModules.has(allowedName) && served.size < 128, 'FINITE_GRAPH', { url });
    const value = retain(third ? robustRoot : ROOT, relative); total += value.body.length; policy(total <= 4194304, 'GRAPH_BYTES');
    const row = { ...value, contentType: 'text/javascript', edges: [] };
    served.set(url, row);
    if (!third) row.source = retain(ROOT, sourceCounterpart(relative)).identity;
    for (const edge of literalImports(new TextDecoder('utf-8', { fatal: true }).decode(value.body))) {
      const selected = resolveImport(edge.specifier, url); row.edges.push({ ...edge, url: selected });
      if (edge.dynamic) {
        policy(url === '/' + HOST && edge.specifier === './b1.js', 'DYNAMIC_IMPORT'); dynamicEdges.push({ from: url, to: selected });
      }
      collect(selected);
    }
  }
  for (const entry of ENTRIES) collect('/' + entry);
  policy(dynamicEdges.length === 1, 'DYNAMIC_EDGE_COUNT');
  const engineEdge = served.get('/packages/engine/dist/Engine.js').edges.filter(row => row.url === '/' + REGISTRY);
  const hostEdge = served.get('/' + HOST).edges.filter(row => row.url === '/' + REGISTRY);
  policy(engineEdge.length === 1 && engineEdge[0].specifier === './internal/texturedFrameState.js'
    && hostEdge.length === 1 && hostEdge[0].specifier === REGISTRY_ALIAS, 'CANONICAL_SHARED_REGISTRY');
  for (const name of [...TOOL_FILES, 'package.json', 'pnpm-lock.yaml', 'tsconfig.json',
    ...['engine', 'runtime', 'contracts'].map(value => `packages/${value}/package.json`)]) retain(ROOT, name);
  for (const name of ['webgpuBufferPool', 'webgpuBindingCache', 'WebGPUHost']) retain(ROOT, `packages/engine/dist/web/${name}.d.ts`);
  const enginePackage = JSON.parse(retain(ROOT, 'packages/engine/package.json').body);
  for (const [name, entry] of [['.', ENTRIES[0]], ['./webgpu', ENTRIES[1]], ['./scene3d', ENTRIES[2]], ['./webgpu/scene3d', ENTRIES[3]]]) {
    policy(enginePackage.exports[name].import === './' + entry.slice('packages/engine/'.length), 'PUBLIC_ENTRY');
  }
  return { inputs, served, retain, total, robustRoot, dynamicEdges };
}
function parseOptions(argv) {
  policy(argv.length === 6, 'CLI_OPTIONS'); const result = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    policy(['--playwright', '--channel', '--output'].includes(key) && !Object.hasOwn(result, key)
      && typeof value === 'string' && value.length > 0, 'CLI_OPTIONS'); result[key] = value;
  }
  policy(result['--channel'] === 'msedge' && path.isAbsolute(result['--playwright']) && path.isAbsolute(result['--output']), 'CLI_PROFILE'); return result;
}
function directoryChain(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    policy(stat.isDirectory() && !stat.isSymbolicLink() && samePhysicalPath(current, fs.realpathSync(current)), 'DIRECTORY_ALIAS');
    if (path.dirname(current) === current) break;
  }
}
function admit(options) {
  const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/browser-tool-matrix.json'), 'utf8'));
  policy(matrix.node === '26.7.0' && matrix.playwright === '1.62.1' && matrix.channel === 'msedge'
    && matrix.platform === 'win32' && matrix.architecture === 'x64', 'MATRIX_PIN');
  policy(process.version === 'v' + matrix.node && process.platform === matrix.platform && process.arch === matrix.architecture
    && process.execArgv.length === 0 && !process.env.NODE_OPTIONS && !process.env.NODE_PATH, 'NODE_PROFILE');
  const modulePath = fs.realpathSync(options['--playwright']);
  policy(samePhysicalPath(modulePath, options['--playwright']), 'PLAYWRIGHT_ALIAS');
  const require = createRequire(path.join(modulePath, 'package.json'));
  const corePath = path.dirname(fs.realpathSync(require.resolve('playwright-core/package.json')));
  for (const [owner, name] of [[modulePath, 'playwright'], [corePath, 'playwright-core']]) {
    const metadata = JSON.parse(fs.readFileSync(path.join(owner, 'package.json'), 'utf8'));
    policy(metadata.name === name && metadata.version === matrix.playwright, 'INSTALLED_TOOL_PIN');
  }
  const toolRuntimeRoot = path.basename(path.dirname(modulePath)) === 'node_modules' ? path.dirname(path.dirname(modulePath)) : modulePath;
  const output = path.resolve(options['--output']);
  policy(samePhysicalPath(output, options['--output']) && !inside(ROOT, output) && !inside(modulePath, output)
    && !inside(corePath, output) && !inside(toolRuntimeRoot, output) && !inside(path.dirname(process.execPath), output) && !fs.existsSync(output), 'OUTPUT_OWNERSHIP');
  directoryChain(path.dirname(output));
  return { output, modulePath, corePath, matrix };
}
async function runChild(options, token) {
  const began = Date.now(), deadline = began + 180000, cleanupDeadline = began + 220000;
  const admission = admit(options), { output, modulePath, corePath } = admission;
  fs.mkdirSync(output); directoryChain(output);
  const report = { schema: 'egret.submission-reuse-native/1', ownerToken: token, status: 'INCOMPLETE',
    startedAtUTC: new Date(began).toISOString(), launch: { channel: 'msedge', headless: true, callerAddedFlags: [], freshContexts: 8, deviceScaleFactor: 1 },
    environment: { node: process.version, playwright: admission.matrix.playwright, playwrightCore: admission.matrix.playwright,
      platform: process.platform, architecture: process.arch,
      browserVersion: null, browserExecutableIdentity: 'UNBOUND by public channel API' }, windows: [], observations: [],
    primary: { frames: 0, channelComparisons: 0 }, controls: { frames: 0, detected: [] }, requests: [], browserEvents: [],
    failure: null, cleanupFailures: [], lifecycle: { browserClosed: false, contextsClosed: false, serverClosed: false,
      pendingOperations: null, identitiesStable: false, artifactsStable: false, cooperativeAPIClosure: false, osDescendantRetirement: 'UNBOUND' },
    limits: 'Native API/readback and allocation counts only; no timing speedup, physical VRAM, hardware acceleration, phone, production or OS descendant retirement claim.' };
  const artifactRows = [], pending = new Set(), acquisitions = [], contexts = new Set(), sockets = new Set();
  let browser, server, source, closeRequested = false;
  function save(name, body) {
    policy(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && body.length <= 8388608 && artifactRows.length < 96, 'ARTIFACT_LIMIT');
    fs.writeFileSync(path.join(output, name), body, { flag: 'wx' }); const row = { path: name, bytes: body.length, sha256: hash(body) }; artifactRows.push(row); return row;
  }
  const json = (name, value) => save(name, canonicalTextBytes(JSON.stringify(value, null, 2)));
  json('owner.json', { token, output });
  const observe = promise => { pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise)); return promise; };
  async function bounded(promise, until, label) {
    observe(promise); let timer; const remaining = Math.min(label.startsWith('run-') ? 45000 : 20000, until - Date.now());
    try { policy(remaining > 0, 'INCOMPLETE:' + label + ':deadline');
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('INCOMPLETE:' + label + ':timeout')), remaining); })]);
    } finally { clearTimeout(timer); }
  }
  function acquire(promise, label, assign) {
    const row = { label, settled: false, promise: null };
    row.promise = observe(promise.then(value => { assign(value); row.settled = true; return value; }, error => { row.settled = true; throw error; }));
    acquisitions.push(row); return row.promise;
  }
  const hardTimer = setTimeout(() => {
    report.status = 'INCOMPLETE'; report.failure ??= { name: 'HardDeadline', message: 'Cooperative cleanup could not be established' };
    report.lifecycle.pendingOperations = pending.size;
    try { json('hard-abort.json', report); } catch {} process.exit(1);
  }, 235000);
  try {
    source = captureInputs();
    const { retain, served } = source;
    const rootMetadata = JSON.parse(retain(ROOT, 'package.json').body);
    policy(rootMetadata.packageManager === 'pnpm@11.25.0' && rootMetadata.devDependencies.typescript === '7.0.2', 'REPOSITORY_PROFILE');
    const compilerRoot = fs.realpathSync(path.join(ROOT, 'node_modules/typescript'));
    policy(JSON.parse(retain(compilerRoot, 'package.json').body).version === '7.0.2', 'COMPILER_PIN');
    retain(path.dirname(process.execPath), path.basename(process.execPath), 134217728);
    for (const owner of [modulePath, corePath]) {
      let files = 0, bytes = 0;
      function tree(relative = '') {
        for (const entry of fs.readdirSync(path.join(owner, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          const name = relative ? relative + '/' + entry.name : entry.name;
          policy(!entry.isSymbolicLink(), 'INSTALLED_TREE_ALIAS');
          if (entry.isDirectory()) tree(name); else {
            policy(entry.isFile() && ++files <= 4096, 'INSTALLED_TREE_FILE'); const item = retain(owner, name, 134217728);
            bytes += item.identity.bytes; policy(bytes <= 536870912, 'INSTALLED_TREE_BYTES');
          }
        }
      }
      tree();
    }
    for (const name of TOOL_FILES.slice(1, 3)) {
      const value = retain(ROOT, name); served.set('/' + name, { ...value, contentType: 'text/javascript' });
    }
    const html = canonicalTextBytes('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">'
      + '<script type="importmap">' + JSON.stringify({ imports: ALIASES }) + '</script>'
      + '<script type="module">import { runWindow } from "/tools/webgpu-submission-reuse/fixture.mjs"; globalThis.runSubmissionWindow = runWindow;</script>');
    served.set('/index.html', { body: html, contentType: 'text/html', identity: { path: 'index.html', bytes: html.length, sha256: hash(html) } });
    report.inputs = [...source.inputs.values()]; report.graph = [...served].map(([url, value]) => ({ url, ...value.identity, source: value.source, edges: value.edges }));
    json('inputs.json', { identities: report.inputs, graph: report.graph, importMap: ALIASES, dynamicEdges: source.dynamicEdges });
    server = createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1').pathname, value = served.get(url);
      if (report.requests.length >= 2048) { report.requestOverflow = true; response.writeHead(429); response.end(); return; }
      const status = request.method === 'GET' && value ? 200 : 404;
      report.requests.push({ url, method: request.method, status, sha256: value?.identity.sha256 ?? null });
      response.writeHead(status, { 'content-type': value?.contentType ?? 'text/plain', 'cache-control': 'no-store' });
      response.end(status === 200 ? value.body : 'Unselected resource');
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    server.on('error', error => { report.serverFailure ??= fault(error); });
    await bounded(observe(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); })), deadline, 'server');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const playwright = await bounded(observe(import(pathToFileURL(path.join(modulePath, 'index.mjs')).href)), deadline, 'playwright-import');
    await bounded(acquire(playwright.chromium.launch({ channel: 'msedge', headless: true }), 'browser', value => {
      browser = value; browser.on('disconnected', () => { if (!closeRequested) report.unexpectedDisconnect = true; });
    }), deadline, 'browser');
    report.environment.browserVersion = browser.version();
    const windows = [...CASES.map(id => ({ id, control: null })), ...CONTROLS.map(control => ({ id: 'C1', control }))];
    for (const selection of windows) {
      const key = selection.control ?? selection.id; let context, page;
      const events = [], observations = [];
      try {
        await bounded(acquire(browser.newContext({ viewport: { width: 32, height: 32 }, deviceScaleFactor: 1 }), 'context-' + key,
          value => { context = value; contexts.add(value); }), deadline, 'context-' + key);
        await bounded(acquire(context.newPage(), 'page-' + key, value => { page = value; }), deadline, 'page-' + key);
        const event = row => { if (events.length < 128) events.push(row); else report.eventOverflow = true; };
        page.on('pageerror', error => event({ kind: 'pageerror', ...fault(error) }));
        page.on('console', value => { if (value.type() === 'error') event({ kind: 'console', message: value.text().slice(0, 12000) }); });
        page.on('requestfailed', request => event({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
        await bounded(observe(page.exposeFunction('retainSubmissionFrame', row => {
          policy(row.id === selection.id && row.control === selection.control && row.step === observations.length
            && row.readback.bytes.length === 1024 && row.readback.bytes.every(value => Number.isInteger(value) && value >= 0 && value <= 255), 'RETAINED_FRAME_IDENTITY');
          const raw = save(key + '-' + row.step + '.rgba', Buffer.from(row.readback.bytes));
          const result = { ...row, readback: { ...row.readback, bytes: undefined, raw }, checks: null, failure: null };
          observations.push(result); report.observations.push(result);
          try {
            policy(row.readback.serial === row.step + 1 && row.readback.frameId === row.frameId, 'READBACK_IDENTITY');
            if (selection.control && row.step === 1) result.checks = verifyControl(row.readback, selection.control);
            else { result.checks = comparePixels(row.readback, row.id, selection.control ? 0 : row.step); policy(result.checks.passed, 'PIXEL_MISMATCH'); }
            result.countChecks = verifyCounts(row.counts, row.id, row.step);
          } catch (error) { result.failure = fault(error); }
          json(key + '-' + row.step + '.json', result); return { retained: true };
        })), deadline, 'retention-binding');
        await bounded(observe(page.goto(origin + '/index.html', { waitUntil: 'load' })), deadline, 'navigate-' + key);
        await bounded(observe(page.waitForFunction(() => typeof globalThis.runSubmissionWindow === 'function')), deadline, 'fixture-ready');
        const native = await bounded(observe(page.evaluate(value => globalThis.runSubmissionWindow(value),
          { ...selection, deadline: Math.min(deadline, Date.now() + 35000) })), deadline, 'run-' + key);
        report.windows.push(native); json('window-' + key + '.json', native);
        if (native.status === 'UNSUPPORTED') { policy(report.windows.length === 1 && native.cleanup.failures.length === 0, 'CAPABILITY_CHANGED'); report.status = 'UNSUPPORTED'; break; }
        if (native.status === 'INCOMPLETE') throw Error('INCOMPLETE:NATIVE_WINDOW_OR_CLEANUP');
        policy(native.status === 'COMPLETED' && native.cleanup.hostSafe && native.cleanup.deviceDestroyed && native.cleanup.lossSettled
          && native.cleanup.observersRestored && native.cleanup.canvasRetired && native.cleanup.pendingOperations === 0
          && native.cleanup.acquisitionsSettled && native.cleanup.failures.length === 0, 'NATIVE_WINDOW_OR_CLEANUP');
        policy(native.buffers.every(value => value.destroys === 1 && (value.category !== 'staging' || value.size === 4096 && value.unmaps === 1))
          && native.textures.every(value => value.destroys === 1), 'NATIVE_ONCE_CLEANUP');
        policy(observations.length === (selection.control ? 3 : 4) && observations.every(value => !value.failure), 'OBSERVATION_ACCEPTANCE');
        if (selection.id === 'C5') policy(native.sourceIdentity?.distinctSources && native.sourceIdentity.equalBytes && native.freshCaptureRefusal?.code, 'CPU_LEASE_REPLAY_CONTROL');
        if (selection.control) { report.controls.frames += observations.length; report.controls.detected.push(selection.control); }
        else { report.primary.frames += observations.length; report.primary.channelComparisons += observations.reduce((sum, row) => sum + row.checks.comparisons, 0); }
      } finally {
        if (page && !page.isClosed()) {
          // A failed browser evaluate may still have created useful diagnostic ownership state.
          if (!report.windows.some(row => row.id === selection.id && row.control === selection.control)) {
            try { const partial = await bounded(observe(page.evaluate(() => globalThis.lastSubmissionReport ?? null)), cleanupDeadline, 'partial-' + key);
              if (partial) json('partial-' + key + '.json', partial); } catch {}
          }
        }
        if (context) {
          try { await bounded(observe(context.close().then(() => contexts.delete(context))), cleanupDeadline, 'context-close-' + key); }
          catch (error) { report.cleanupFailures.push(fault(error)); }
        }
        report.browserEvents.push(...events); if (events.length) report.unexpectedBrowserEvent = true;
      }
      policy(!report.unexpectedBrowserEvent && !report.eventOverflow && !report.requestOverflow, 'BROWSER_EVENTS');
    }
    if (report.status !== 'UNSUPPORTED') {
      policy(report.primary.frames === 24 && report.primary.channelComparisons === 24576 && report.controls.frames === 6
        && CONTROLS.every(value => report.controls.detected.includes(value)), 'FINITE_SCHEDULE'); report.status = 'PASS';
    }
  } catch (error) { report.failure = { ...fault(error), details: error.details ?? null }; report.status = /INCOMPLETE:|browserType.launch|Executable doesn't exist|Target .* closed/.test(error.message) ? 'INCOMPLETE' : 'FAIL'; }
  finally {
    const cleanup = async (label, operation) => { try { await operation(); } catch (error) { report.cleanupFailures.push({ label, ...fault(error) }); } };
    for (const row of acquisitions) if (!row.settled) await cleanup('late-' + row.label, () => bounded(row.promise, cleanupDeadline, 'late-' + row.label));
    for (const context of contexts) await cleanup('remaining-context', () => bounded(observe(context.close().then(() => contexts.delete(context))), cleanupDeadline, 'remaining-context'));
    report.lifecycle.contextsClosed = contexts.size === 0;
    if (browser) await cleanup('browser', async () => { closeRequested = true; await bounded(observe(browser.close()), cleanupDeadline, 'browser-close'); report.lifecycle.browserClosed = true; });
    if (server) await cleanup('server', async () => {
      for (const socket of sockets) socket.destroy(); server.closeAllConnections();
      await bounded(observe(new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))), cleanupDeadline, 'server-close');
      report.lifecycle.serverClosed = sockets.size === 0;
    });
    if (pending.size) await cleanup('pending', () => bounded(observe(Promise.allSettled([...pending])), cleanupDeadline, 'pending-drain'));
    if (source) await cleanup('identities', async () => {
      for (const row of source.inputs.values()) assert.deepEqual(fingerprintFile(row.owner, row.path), { path: row.path, bytes: row.bytes, sha256: row.sha256 });
      report.lifecycle.identitiesStable = true;
    });
    await cleanup('artifacts', async () => {
      for (const row of artifactRows) assert.deepEqual(fingerprintFile(output, row.path), row); report.lifecycle.artifactsStable = true;
    });
    report.lifecycle.pendingOperations = pending.size;
    report.lifecycle.acquisitionsSettled = acquisitions.every(value => value.settled);
    report.lifecycle.cooperativeAPIClosure = (!browser || report.lifecycle.browserClosed) && report.lifecycle.contextsClosed
      && (!server || report.lifecycle.serverClosed) && !pending.size && report.lifecycle.acquisitionsSettled;
    if (report.cleanupFailures.length || !report.lifecycle.cooperativeAPIClosure || !report.lifecycle.identitiesStable
      || !report.lifecycle.artifactsStable || report.serverFailure || report.unexpectedDisconnect || report.unexpectedBrowserEvent) report.status = 'INCOMPLETE';
    report.finishedAtUTC = new Date().toISOString(); report.artifacts = artifactRows.slice();
    json('report.json', report); clearTimeout(hardTimer);
  }
  console.log(JSON.stringify({ status: report.status, primary: report.primary, controls: report.controls, output }));
  return report.status === 'PASS' ? 0 : 1;
}
async function selfTest() {
  let checks = 0;
  const check = operation => { operation(); checks++; };
  const metadata = bytes => ({ width: 16, height: 16, format: 'rgba8unorm', sourceFormat: 'bgra8unorm',
    colorSpace: 'srgb', alphaMode: 'premultiplied', bytes });
  for (const id of CASES) for (let step = 0; step < 4; step++) {
    const pixels = expectedPixels(id, step);
    check(() => assert.equal(comparePixels(metadata(pixels), id, step).comparisons, 1024));
    check(() => assert.equal(comparePixels(metadata(pixels), id, step).passed, true));
    // Every position/channel is actually compared. Change one channel by far more than tolerance.
    for (let offset = 0; offset < 1024; offset++) {
      const changed = pixels.slice(); changed[offset] = changed[offset] < 128 ? 255 : 0;
      check(() => assert.equal(comparePixels(metadata(changed), id, step).failedChannels, 1));
    }
    const counts = { ...expectedCounts(id, step), unknownCreated: 0, failedCalls: 0 };
    check(() => assert.equal(verifyCounts(counts, id, step).passed, true));
    for (const key of Object.keys(counts)) check(() => assert.throws(() => verifyCounts({ ...counts, [key]: counts[key] + 1 }, id, step)));
  }
  const pixel = (id, step, x, y) => Array.from(expectedPixels(id, step).slice((16 * y + x) * 4, (16 * y + x) * 4 + 4));
  check(() => assert.deepEqual(pixel('C1', 0, 6, 6), [0, 255, 0, 255]));
  check(() => assert.deepEqual(pixel('C1', 2, 5, 5), [127, 128, 0, 255]));
  check(() => assert.deepEqual(pixel('C2', 2, 11, 11), [0, 128, 0, 255]));
  check(() => assert.deepEqual(pixel('C3', 2, 5, 5), [127, 128, 0, 255]));
  check(() => assert.deepEqual(pixel('C4', 2, 11, 11), [127, 128, 0, 255]));
  check(() => assert.deepEqual(pixel('C5', 1, 4, 4), [0, 0, 255, 255]));
  check(() => assert.deepEqual(pixel('C6', 3, 3, 4), [0, 0, 0, 255]));
  for (const control of CONTROLS) {
    check(() => assert.equal(verifyControl(metadata(expectedPixels('C1', 0, control)), control).detected, true));
    check(() => assert.throws(() => verifyControl(metadata(expectedPixels('C1', 0)), control)));
    const other = control === 'wrong-alpha' ? 'wrong-order' : 'wrong-alpha';
    check(() => assert.throws(() => verifyControl(metadata(expectedPixels('C1', 0, other)), control)));
  }
  check(() => assert.throws(() => comparePixels({ ...metadata(new Uint8Array(1024)), width: 15 }, 'C1', 0)));
  check(() => assert.throws(() => parseOptions(['--playwright', 'x', '--channel', 'msedge', '--output', 'relative'])));
  check(() => assert.throws(() => literalImports('import(value);')));
  check(() => assert.throws(() => literalImports('import("../bad?x.js");')));
  check(() => assert.deepEqual(literalImports('/* import("bad") */\nexport { value } from "./good.js";'), [{ specifier: './good.js', dynamic: false }]));
  const calls = [], nativeBuffers = [], nativeTextures = [];
  const queue = { writeBuffer(...args) { assert.equal(this, queue); calls.push(['writeBuffer', ...args]); },
    writeTexture(...args) { assert.equal(this, queue); calls.push(['writeTexture', ...args]); },
    submit(...args) { assert.equal(this, queue); calls.push(['submit', ...args]); } };
  const prototype = {
    createBuffer(descriptor) {
      assert.equal(this, device); calls.push(['createBuffer', descriptor]);
      if (descriptor.size === 0) throw Error('assigned-native-failure');
      const buffer = Object.create({ destroy() { assert.equal(this, buffer); calls.push(['destroy', buffer]); },
        unmap() { assert.equal(this, buffer); calls.push(['unmap', buffer]); } }); nativeBuffers.push(buffer); return buffer;
    },
    createTexture(descriptor) {
      assert.equal(this, device); const texture = { destroy() { assert.equal(this, texture); calls.push(['destroyTexture', texture]); } };
      nativeTextures.push(texture); return texture;
    }, createBindGroup(descriptor) { assert.equal(this, device); return { descriptor }; },
  };
  const device = Object.create(prototype); device.queue = queue;
  Object.defineProperty(device, 'createBindGroup', { value: prototype.createBindGroup, writable: false, enumerable: true, configurable: true });
  const descriptors = [Object.getOwnPropertyDescriptors(device), Object.getOwnPropertyDescriptors(queue)];
  const observer = installNativeObservers(device);
  const descriptor = { size: 16, usage: 72 }, eligible = device.createBuffer(descriptor), staging = device.createBuffer({ size: 4096, usage: 9 });
  const data = new Uint8Array([1, 2, 3, 4]); queue.writeBuffer(eligible, 0, data); queue.writeTexture({}, data, {}, {}); queue.submit([]);
  device.createBindGroup({ entries: [] }); device.createTexture({ format: 'depth32float', usage: 16 }).destroy();
  device.createTexture({ format: 'rgba8unorm', usage: 6 }).destroy(); eligible.destroy(); staging.unmap(); staging.destroy();
  check(() => assert.equal(calls.find(row => row[0] === 'createBuffer')[1], descriptor));
  check(() => assert.equal(calls.find(row => row[0] === 'writeBuffer')[3], data));
  check(() => assert.deepEqual(observer.writeIds, [1]));
  check(() => assert.throws(() => device.createBuffer({ size: 0, usage: 72 }), /assigned-native-failure/));
  check(() => assert.deepEqual(observer.snapshot(), { eligibleCreated: 1, eligibleDestroyed: 1, stagingCreated: 1, stagingDestroyed: 1,
    stagingUnmapped: 1, unknownCreated: 0, depthCreated: 1, depthDestroyed: 1, imageCreated: 1, imageDestroyed: 1,
    imageUploads: 1, bindingsCreated: 1, bufferWrites: 1, submits: 1, failedCalls: 1 }));
  observer.restore();
  check(() => assert.deepEqual(Object.getOwnPropertyDescriptors(device), descriptors[0]));
  check(() => assert.deepEqual(Object.getOwnPropertyDescriptors(queue), descriptors[1]));
  check(() => assert.ok(nativeBuffers.every(value => !Object.hasOwn(value, 'destroy') && !Object.hasOwn(value, 'unmap'))));
  check(() => assert.ok(nativeTextures.every(value => typeof Object.getOwnPropertyDescriptor(value, 'destroy').value === 'function')));
  const graph = captureInputs();
  check(() => assert.ok(graph.served.has('/packages/engine/dist/web/webgpuBufferPool.js') && graph.served.has('/packages/engine/dist/web/webgpuBindingCache.js')));
  check(() => assert.equal(graph.dynamicEdges.length, 1));
  for (const row of graph.inputs.values()) check(() => assert.deepEqual(fingerprintFile(row.owner, row.path), { path: row.path, bytes: row.bytes, sha256: row.sha256 }));
  console.log(JSON.stringify({ status: 'UNIT_PASS', checks, primaryOracleFrames: 24, channelSensitivityChecks: 24576,
    graphModules: graph.served.size, graphBytes: graph.total, browserStarted: false,
    scope: 'Offline oracle, native-observer forwarding/restoration and exact emitted/source closure checks; no native rendering evidence.' }));
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--self-test') { await selfTest(); return; }
  const options = parseOptions(process.argv.slice(2));
  if (process.env.EGRET_SUBMISSION_CHILD) {
    policy(/^[0-9a-f-]{36}$/.test(process.env.EGRET_SUBMISSION_CHILD), 'CHILD_TOKEN');
    process.exitCode = await runChild(options, process.env.EGRET_SUBMISSION_CHILD); return;
  }
  const { output } = admit(options), token = randomUUID();
  // The outer process bounds a stalled child. Timeout is never evidence of OS descendant retirement.
  const child = spawnSync(process.execPath, [SELF, ...process.argv.slice(2)], { cwd: ROOT, encoding: 'utf8', timeout: 250000,
    maxBuffer: 67108864, windowsHide: true, env: { ...process.env, EGRET_SUBMISSION_CHILD: token } });
  let report;
  if (fs.existsSync(output)) {
    directoryChain(output);
    const owner = JSON.parse(fs.readFileSync(path.join(output, 'owner.json'), 'utf8')); policy(owner.token === token, 'OUTPUT_TOKEN');
    fs.writeFileSync(path.join(output, 'stdout.log'), child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(output, 'stderr.log'), child.stderr ?? '', { flag: 'wx' });
    if (fs.existsSync(path.join(output, 'report.json'))) report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
    fs.writeFileSync(path.join(output, 'subprocess.json'), canonicalTextBytes(JSON.stringify({ status: child.status, signal: child.signal,
      error: child.error ? fault(child.error) : null, reportStatus: report?.status ?? 'INCOMPLETE', osDescendantRetirement: 'UNBOUND' }, null, 2)), { flag: 'wx' });
  }
  if (child.stdout) process.stdout.write(child.stdout); if (child.stderr) process.stderr.write(child.stderr);
  process.exitCode = !child.error && child.status === 0 && report?.ownerToken === token && report.status === 'PASS' ? 0 : 1;
}
main().catch(error => { console.error(JSON.stringify({ status: 'INCOMPLETE', failure: fault(error), details: error.details ?? null })); process.exitCode = 1; });
