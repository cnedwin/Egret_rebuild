// First-party bounded native collector; it serves existing built bytes and never builds. Apache-2.0.
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { CONTROLS, CONTEXT_IDS, POINTS, EXAMPLE_IMPORTS, projectControl, restoreControlRoute, projectImportMap, classifyConsole, admitCollection } from './mouse-input-canvas-contract.mjs';

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const contained = (root, value) => { const a = path.resolve(root).toLowerCase(), b = path.resolve(value).toLowerCase(); return b === a || b.startsWith(a + path.sep); };
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!/^--(repository|application-root|playwright|channel|output)$/.test(key) || !value || args.has(key)) throw new Error('Unique named collector arguments required');
  args.set(key, value);
}
for (const key of ['--repository', '--playwright', '--output']) if (!args.has(key) || !path.isAbsolute(args.get(key))) throw new Error('Missing absolute ' + key);
if (args.has('--application-root') && !path.isAbsolute(args.get('--application-root'))) throw new Error('Absolute application root required');
if ((args.get('--channel') ?? 'msedge') !== 'msedge') throw new Error('Only the declared default msedge channel is admitted');
const repository = await realpath(args.get('--repository'));
const applicationRoot = await realpath(args.get('--application-root') ?? ownRoot);
const output = path.resolve(args.get('--output'));
if (contained(repository, output) || contained(applicationRoot, output)) throw new Error('Output must be outside SDK/application inputs');
await mkdir(path.dirname(output), { recursive: true });
const outputParent = await realpath(path.dirname(output));
if (contained(repository, outputParent) || contained(applicationRoot, outputParent)) throw new Error('Physical output parent is inside an input root');
await mkdir(output); // Exclusive evidence directory: no overwrites or reused results.

const pending = new Set(), owned = [], retirementFailures = [];
function failure(cause) { return { present: true, kind: cause === undefined ? 'undefined' : typeof cause, text: String(cause) }; }
async function bounded(promise, label, ms = 15000) {
  const task = Promise.resolve(promise); pending.add(task); task.then(() => pending.delete(task), () => pending.delete(task));
  let timer;
  try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Deadline: ' + label)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function acquire(label, create, close) {
  const record = { label, close, retired: false }; owned.push(record);
  record.promise = Promise.resolve().then(create).then(value => { record.value = value; return value; });
  return { record, value: await bounded(record.promise, label) };
}
async function retire(record) {
  if (!record) return true;
  record.cleanup ??= record.promise.then(value => record.close(value), () => {}).then(() => { record.retired = true; });
  try { await bounded(record.cleanup, 'retire ' + record.label, 10000); return true; }
  catch (cause) { retirementFailures.push({ label: record.label, failure: failure(cause) }); return false; }
}
async function pin(file, role) {
  const resolved = await realpath(file), info = await stat(resolved);
  if (!info.isFile() || info.size > 16777216) throw new Error('Input identity budget: ' + resolved);
  const bytes = await readFile(resolved);
  if (bytes.length !== info.size) throw new Error('Input changed during identity read');
  return { path: resolved, bytes: bytes.length, sha256: hash(bytes), role };
}
async function save(name, kind, bytes) {
  const body = Buffer.from(bytes); await writeFile(path.join(output, name), body, { flag: 'wx' });
  return { kind, path: name, bytes: body.length, sha256: hash(body) };
}

/** Transparent identity-preserving native observers, installed before trusted capture. */
function installPairObserver() {
  const nativePrototype = EventTarget.prototype;
  const nativeDescriptors = {
    add: Object.getOwnPropertyDescriptor(nativePrototype, 'addEventListener'),
    remove: Object.getOwnPropertyDescriptor(nativePrototype, 'removeEventListener'),
  };
  const pairs = [], scopedSignals = new WeakMap();
  let generation = 0, acquiring = false, signalPrototype, signalDescriptors, restoration, archived;
  let overflow = false, unmatchedRemoves = 0;
  const nativeKinds = new Set(['pointerdown', 'pointerup', 'pointercancel', 'blur', 'pagehide']);
  const captureOf = options => typeof options === 'boolean' ? options : options?.capture === true;
  function nativeSelected(target, type) {
    return nativeKinds.has(type) && (target === window || target === document.querySelector('#scene'));
  }
  function remember(kind, target, type, callback, options) {
    if (pairs.length >= 32) { overflow = true; return undefined; }
    const record = { kind, generation, target, type, callback, options, capture: kind === 'abort' ? null : captureOf(options),
      targetLabel: kind === 'abort' ? 'signal' : target === window ? 'window' : 'canvas',
      once: kind === 'abort' ? options?.once === true : false, frozenOptions: kind === 'abort' && Object.isFrozen(options),
      addAttempts: 1, addSucceeded: false, removeAttempts: 0, removeSucceeded: false, removeOptionsMatched: null };
    pairs.push(record); return record;
  }
  function find(kind, target, type, callback) { return pairs.find(record => record.kind === kind && record.target === target && record.type === type && record.callback === callback); }
  function nativeAdd(type, callback, options) {
    const selected = acquiring && nativeSelected(this, type) && callback != null;
    const record = selected ? remember('native', this, type, callback, options) : undefined;
    const result = Reflect.apply(nativeDescriptors.add.value, this, arguments);
    if (record) record.addSucceeded = true;
    return result;
  }
  function nativeRemove(type, callback, options) {
    // Known exact callbacks remain observed after acquisition; unrelated browser
    // or collector callbacks never acquire Egret ownership through removal.
    const record = find('native', this, type, callback);
    if (record) { record.removeAttempts++; record.removeOptionsMatched = options === record.options; }
    else if (pairs.some(owned => owned.kind === 'native' && owned.callback === callback)) unmatchedRemoves++;
    const result = Reflect.apply(nativeDescriptors.remove.value, this, arguments);
    if (record && record.removeOptionsMatched) record.removeSucceeded = true;
    return result;
  }
  function snapshot() {
    if (archived) return JSON.parse(JSON.stringify(archived));
    return { pairs: pairs.map(record => ({ generation: record.generation, kind: record.kind, target: record.targetLabel,
      type: record.type, capture: record.capture, once: record.once, frozenOptions: record.frozenOptions,
      addAttempts: record.addAttempts, addSucceeded: record.addSucceeded, removeAttempts: record.removeAttempts,
      removeSucceeded: record.removeSucceeded, removeOptionsMatched: record.removeOptionsMatched })), overflow, unmatchedRemoves };
  }
  const port = Object.freeze({
    beginGeneration(value, signal) {
      if (acquiring) throw new Error('Adapter acquisition already active');
      generation = value; scopedSignals.set(signal, value); acquiring = true;
    },
    endAcquisition() { acquiring = false; },
    installSignal(Controller) {
      if (signalPrototype) throw new Error('Signal observer installed twice');
      const inert = new Controller(); signalPrototype = Object.getPrototypeOf(inert.signal);
      signalDescriptors = { add: Object.getOwnPropertyDescriptor(signalPrototype, 'addEventListener'), remove: Object.getOwnPropertyDescriptor(signalPrototype, 'removeEventListener') };
      if (typeof signalDescriptors.add?.value !== 'function' || typeof signalDescriptors.remove?.value !== 'function') throw new Error('Genuine public Signal ports unavailable');
      function signalAdd(type, callback, options) {
        const selected = acquiring && type === 'abort' && scopedSignals.get(this) === generation && options?.once === true && Object.isFrozen(options);
        const record = selected ? remember('abort', this, type, callback, options) : undefined;
        const result = Reflect.apply(signalDescriptors.add.value, this, arguments);
        if (record) { record.generation = scopedSignals.get(this); record.addSucceeded = true; }
        return result;
      }
      function signalRemove(type, callback) {
        const record = find('abort', this, type, callback);
        if (record) { record.removeAttempts++; record.removeOptionsMatched = arguments.length === 2; }
        const result = Reflect.apply(signalDescriptors.remove.value, this, arguments);
        if (record && record.removeOptionsMatched) record.removeSucceeded = true;
        return result;
      }
      Object.defineProperty(signalPrototype, 'addEventListener', { ...signalDescriptors.add, value: signalAdd });
      Object.defineProperty(signalPrototype, 'removeEventListener', { ...signalDescriptors.remove, value: signalRemove });
    },
    snapshot,
    restoration: () => restoration ?? null,
    restore() {
      if (restoration) return JSON.parse(JSON.stringify(restoration));
      acquiring = false;
      const errors = [], recovery = { nativeAttempts: 0, nativeSucceeded: 0, abortAttempts: 0, abortSucceeded: 0 };
      // Save pre-recovery observations. Recovery is not a successful product removal.
      archived = snapshot();
      for (const record of pairs) if (record.addSucceeded && !record.removeSucceeded) {
        const kind = record.kind === 'native' ? 'native' : 'abort'; recovery[kind + 'Attempts']++;
        try {
          const operation = kind === 'native' ? nativeDescriptors.remove.value : signalDescriptors.remove.value;
          Reflect.apply(operation, record.target, kind === 'native' ? [record.type, record.callback, record.options] : [record.type, record.callback]);
          recovery[kind + 'Succeeded']++;
        } catch (cause) { errors.push({ kind, text: String(cause), valueKind: cause === undefined ? 'undefined' : typeof cause }); }
      }
      for (const [prototype, descriptors] of [[nativePrototype, nativeDescriptors], [signalPrototype, signalDescriptors]]) if (prototype && descriptors) {
        for (const [method, descriptor] of [['addEventListener', descriptors.add], ['removeEventListener', descriptors.remove]]) {
          try { Object.defineProperty(prototype, method, descriptor); } catch (cause) { errors.push({ method, text: String(cause), valueKind: cause === undefined ? 'undefined' : typeof cause }); }
        }
      }
      const equal = (actual, expected) => actual?.value === expected?.value && actual?.get === expected?.get && actual?.set === expected?.set && actual?.writable === expected?.writable && actual?.enumerable === expected?.enumerable && actual?.configurable === expected?.configurable;
      const nativeRestored = equal(Object.getOwnPropertyDescriptor(nativePrototype, 'addEventListener'), nativeDescriptors.add) && equal(Object.getOwnPropertyDescriptor(nativePrototype, 'removeEventListener'), nativeDescriptors.remove);
      const signalRestored = !signalPrototype || (equal(Object.getOwnPropertyDescriptor(signalPrototype, 'addEventListener'), signalDescriptors.add) && equal(Object.getOwnPropertyDescriptor(signalPrototype, 'removeEventListener'), signalDescriptors.remove));
      restoration = { restored: nativeRestored && signalRestored && errors.length === 0, nativeRestored, signalRestored, recovery, errors };
      pairs.length = 0;
      return JSON.parse(JSON.stringify(restoration));
    },
  });
  Object.defineProperty(window, '__egretMousePairs', { value: port, configurable: true });
  try {
    Object.defineProperty(nativePrototype, 'addEventListener', { ...nativeDescriptors.add, value: nativeAdd });
    Object.defineProperty(nativePrototype, 'removeEventListener', { ...nativeDescriptors.remove, value: nativeRemove });
  } catch (cause) { port.restore(); throw cause; }
}

// Exact existing Canvas/root closure plus the finite MI1 modules; no prefixes/wildcards.
const allowedModules = new Set([
  // M1 current root/Canvas closure: five exact CPU modules; GPU entries remain excluded.
  "packages/contracts/dist/SharedGeometry2D.js",
  "packages/contracts/dist/SharedMaterial2D.js",
  "packages/contracts/dist/SharedRenderFrame2D.js",
  "packages/runtime/dist/frameCaptureCache.js",
  "packages/runtime/dist/sharedFrameCapture.js",
  // M0 current public-root closure: reviewed exact additions, no wildcard or new public entry.
  "packages/runtime/dist/bitmapAtlasPlacement.js",
  "packages/runtime/dist/atlasFrameLayout.js",
  "packages/runtime/dist/ByteWriter.js",
  "packages/runtime/dist/NineSliceGeometry2D.js",
  "packages/runtime/dist/NineSliceBitmap.js",
  "packages/runtime/dist/spriteSheet.js",
  "packages/engine/dist/bitmapResourceSlot.js",
  "packages/engine/dist/bitmapBindingTicket.js",
  "packages/engine/dist/bitmapButton.js",
  "packages/engine/dist/sequencePlayback.js",
  ...['ImageData2D', 'index', 'TexturedGeometry2D', 'TexturedRenderFrame2D'].map(name => `packages/contracts/dist/${name}.js`),
  ...['assetGroup', 'closeHost', 'createEngine', 'createEngineForProfile', 'Engine', 'gameClock', 'index', 'mouseInput', 'startEngine', 'surfaceOwnership', 'tween'].map(name => `packages/engine/dist/${name}.js`),
  ...['mouseInputFactoryState', 'textFieldFactoryState', 'texturedFrameState'].map(name => `packages/engine/dist/internal/${name}.js`),
  'packages/engine/dist/rendering/ownedPreparationFailure2D.js',
  ...['canvasImageProjection', 'CanvasHost', 'copyCanvasFrame', 'imageProjections2D', 'index', 'input', 'MouseInput'].map(name => `packages/engine/dist/web/${name}.js`),
  ...['AssetLease', 'AssetManager', 'assetManagerOwnerState', 'AssetRef', 'Bitmap', 'bitmapDisplayState', 'ByteReader', 'CancellationController',
    'coordinateInverse', 'diagnostics', 'displayBounds', 'displayCoordinates', 'displayHitState', 'displayHitTest', 'displayInputOperations', 'DisplayObject', 'DisplayObjectContainer',
    'displayTransform', 'displayTreeState', 'displayVisualState', 'EgretError', 'Event', 'EventDispatcher', 'frameCapture', 'Graphics', 'imageFrameBudget',
    'index', 'Mesh2D', 'meshCaptureSnapshot', 'meshDisplayState', 'ownership', 'Scope', 'sequenceClip', 'SequencePlayer', 'Sprite', 'Stage', 'textDisplayState', 'Texture', 'texturedFrameBudget', 'texturedFrameCapture'].map(name => `packages/runtime/dist/${name}.js`),
]);
const artifactPaths = ['tools/verify-mouse-input-canvas.mjs', 'tools/mouse-input-canvas-contract.mjs', 'tests/mouse-input-canvas-verifier.test.mjs',
  ...['index.html', 'main.mjs', 'scene.mjs', 'README.md', 'README.zh-CN.md'].map(name => 'examples/mouse-input/' + name)];
const report = { schemaVersion: 1, runId: randomUUID(), startedAtUtc: new Date().toISOString(), inputs: { before: [], after: [] }, contexts: [], retirementFailures: [] };
const routes = new Map();
let graph, browser, browserRecord, serverRecord, origin;
try {
  const helperPath = path.join(repository, 'tools/sequence-player/file-graph.mjs');
  const helper = await import(pathToFileURL(helperPath).href);
  const entries = {
    '@egret/engine': path.join(repository, 'packages/engine/dist/index.js'), '@egret/engine/web': path.join(repository, 'packages/engine/dist/web/index.js'),
    '@egret/engine/web/input': path.join(repository, 'packages/engine/dist/web/input.js'), '@egret/runtime': path.join(repository, 'packages/runtime/dist/index.js'),
    '@egret/contracts': path.join(repository, 'packages/contracts/dist/index.js'), '#egret-textured-frame-state': path.join(repository, 'packages/engine/dist/internal/texturedFrameState.js'),
    '#egret-mouse-input': path.join(repository, 'packages/engine/dist/mouseInput.js'),
  };
  graph = await helper.sealGraph({ repositoryRoot: repository, entryPaths: { canvas: [entries['@egret/engine'], entries['@egret/engine/web'], entries['@egret/engine/web/input']] }, aliases: entries, maxModules: 128, maxBytes: 4194304 });
  for (const module of graph.modules) {
    const relative = path.relative(repository, module.path).replaceAll(path.sep, '/');
    if (!allowedModules.has(relative)) throw new Error('Exact MI1 module allowlist refuses: ' + relative);
  }
  report.inputs.before = [...graph.inventory, ...await Promise.all(artifactPaths.map(name => pin(path.join(applicationRoot, name), 'native-package'))),
    await pin(helperPath, 'shared-exact-graph-helper'), await pin(path.join(repository, 'packages/engine/package.json'), 'package-private-alias-contract')].sort((a, b) => a.path.localeCompare(b.path));
  if (report.inputs.before.length > 256) throw new Error('Finite input inventory exceeded');
  report.sdkGraph = { modules: graph.modules, closures: graph.closures, totalBytes: graph.totalBytes };
  const app = Object.fromEntries(await Promise.all(['index.html', 'main.mjs', 'scene.mjs'].map(async name => [name, await readFile(path.join(applicationRoot, 'examples/mouse-input', name), 'utf8')])));
  for (const [route, record] of graph.routes) routes.set(route, record);
  const imports = Object.fromEntries(Object.keys(EXAMPLE_IMPORTS).map(name => [name, graph.routeFor(entries[name])]));
  const adapted = projectImportMap(app['index.html'], imports); report.importMap = { original: adapted.original, served: adapted.served };
  for (const id of CONTEXT_IDS) for (const [name, text] of Object.entries({ ...app, 'index.html': adapted.html })) {
    routes.set('/' + id + '/' + name, { bytes: Buffer.from(text), contentType: name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
  }
  report.servedApplication = [...routes].filter(([route]) => !route.startsWith('/m/')).map(([route, record]) => ({ route, bytes: record.bytes.length, sha256: hash(record.bytes) }));
  const acquiredServer = await acquire('loopback server', () => new Promise((resolve, reject) => {
    const instance = createServer((request, response) => {
      const record = request.url?.length <= 2048 ? routes.get(request.url) : undefined;
      if (request.method !== 'GET' || !record) { response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Unselected route'); return; }
      response.writeHead(200, { 'content-type': record.contentType, 'cache-control': 'no-store' }); response.end(record.bytes);
    }); instance.once('error', reject); instance.listen(0, '127.0.0.1', () => resolve(instance));
  }), instance => new Promise((resolve, reject) => { instance.close(error => error ? reject(error) : resolve()); instance.closeAllConnections(); }));
  serverRecord = acquiredServer.record; origin = 'http://127.0.0.1:' + acquiredServer.value.address().port;
  const playwrightPath = await realpath(args.get('--playwright'));
  const playwrightPackage = JSON.parse(await readFile(path.join(playwrightPath, 'package.json'), 'utf8'));
  const playwright = await import(pathToFileURL(path.join(playwrightPath, 'index.mjs')).href);
  const acquiredBrowser = await acquire('browser', () => playwright.chromium.launch({ headless: true, channel: 'msedge' }), value => value.close());
  browser = acquiredBrowser.value; browserRecord = acquiredBrowser.record;
  report.environment = { node: process.version, browserVersion: browser.version(), channel: 'msedge', headless: true, viewport: { width: 900, height: 700 }, deviceScaleFactor: 2, playwrightPath, playwrightVersion: playwrightPackage.version, extraLaunchFlags: [] };
  for (const id of CONTEXT_IDS) {
    let route, original;
    const projectionRule = CONTROLS.find(control => control.id === id);
    let projection;
    try {
      if (projectionRule) {
        route = graph.routeFor(path.join(repository, projectionRule.emitted)); original = routes.get(route);
        if (!original) throw new Error('Control emitted route absent');
        const projected = projectControl(id, await readFile(path.join(repository, projectionRule.source), 'utf8'), await readFile(path.join(repository, projectionRule.emitted), 'utf8'), new TextDecoder('utf-8', { fatal: true }).decode(original.bytes));
        const summary = role => ({ originalSHA256: projected[role].originalSHA256, projectedSHA256: projected[role].projectedSHA256, restoredSHA256: projected[role].restoredSHA256 });
        projection = { id, sourcePath: projectionRule.source, emittedPath: projectionRule.emitted, logicReplacements: 1, source: summary('source'), emitted: summary('emitted'), served: summary('served'), servedCopyRestored: false };
        routes.set(route, { ...original, bytes: Buffer.from(projected.served.text), servedSHA256: projected.served.projectedSHA256 });
      }
      await collectContext(id, projection);
    } finally {
      restoreControlRoute(routes, route, original, projection);
    }
  }
} catch (cause) { report.runnerFailure = failure(cause); }
finally {
  for (const record of [...owned].reverse()) await retire(record);
  for (const before of report.inputs.before) {
    try { const after = await pin(before.path, before.role); report.inputs.after.push({ ...before, bytes: after.bytes, sha256: after.sha256 }); }
    catch (cause) { retirementFailures.push({ label: 'input readback', path: before.path, failure: failure(cause) }); }
  }
  report.retirement = { browserClosed: browserRecord?.retired === true, serverClosed: serverRecord?.retired === true, pendingActors: pending.size + owned.filter(record => !record.retired).length };
  report.retirementFailures = retirementFailures;
}
const result = await admitCollection(report, name => readFile(path.join(output, name)));
report.finishedAtUtc = new Date().toISOString();
await writeFile(path.join(output, 'collection.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, nativeInputAccepted: result.nativeInputAccepted, output, contexts: report.contexts.length }));
if (result.status !== 'PASS_DESKTOP_PRIMARY_MOUSE_CANVAS_SUBSET') process.exitCode = 1;

async function collectContext(id, projection) {
  const collected = { id, contextId: randomUUID(), rows: [], artifacts: [], errors: [], advisories: [], overflow: false, projection };
  report.contexts.push(collected);
  let context, page, contextRecord, pageRecord, beforeImage, afterImage, applicationClosed = false, observerRestored = false;
  const deadline = Date.now() + 90000, main = '/' + id + '/main.mjs';
  const action = (promise, label) => bounded(promise, id + '/' + label, Math.max(1, Math.min(15000, deadline - Date.now())));
  const recordError = (kind, cause) => { if (collected.errors.length + collected.advisories.length >= 64) { collected.overflow = true; return; } collected.errors.push({ kind, failure: failure(cause) }); };
  const invoke = (method, ...arguments_) => action(page.evaluate(async ({ main, method, arguments_ }) => { const app = await import(main); return app[method](...arguments_); }, { main, method, arguments_ }), method);
  const read = () => invoke('readSnapshot');
  const ledger = () => action(page.evaluate(() => window.__egretMousePairs.snapshot()), 'pair ledger');
  const samples = () => action(page.evaluate(points => { const context = document.querySelector('#scene').getContext('2d'); return points.map(point => ({ point, rgba: Array.from(context.getImageData(point[0], point[1], 1, 1).data) })); }, POINTS), 'literal Canvas RGBA');
  const geometry = () => action(page.evaluate(() => { const canvas = document.querySelector('#scene'), rect = canvas.getBoundingClientRect(); return { logical: [canvas.width, canvas.height], css: [rect.width, rect.height], viewport: [innerWidth, innerHeight], deviceScaleFactor: devicePixelRatio }; }), 'geometry');
  async function pointer(point, kind) {
    const box = await action(page.locator('#scene').boundingBox(), 'native Canvas box');
    if (!box || box.width !== 320 || box.height !== 200) throw new Error('Required Canvas CSS rectangle absent');
    const position = [box.x + point[0] * 2, box.y + point[1] * 2];
    await action(page.mouse.move(...position), 'native mouse position');
    await action(kind === 'down' ? page.mouse.down({ button: 'left' }) : page.mouse.up({ button: 'left' }), 'native mouse ' + kind);
    return { method: 'page.mouse.move+' + kind, logical: point, page: position, box, button: 'left' };
  }
  async function eventCase(rowId, downPoint, upPoint, arm = false) {
    await invoke('resetLog'); if (arm) await invoke('armCover');
    const row = { id: rowId, before: await read() }; collected.rows.push(row);
    const down = await pointer(downPoint, 'down'); row.down = { input: down, snapshot: await read() };
    const up = await pointer(upPoint, 'up'); row.up = { input: up, snapshot: await read() }; row.samples = await samples();
  }
  try {
    const acquiredContext = await acquire(id + '/context', () => browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 }), value => value.close());
    context = acquiredContext.value; contextRecord = acquiredContext.record;
    await action(context.addInitScript(installPairObserver), 'pre-capture observer');
    let requests = 0;
    await action(context.route('**/*', request => {
      requests++; let selected = false;
      try { const url = new URL(request.request().url()); selected = url.origin === origin && routes.has(url.pathname) && url.search === '' && url.hash === ''; } catch {}
      if (!selected || requests > 192) { recordError('UNSELECTED_REQUEST', request.request().url()); return request.abort(); }
      return request.continue();
    }), 'loopback-only requests');
    const acquiredPage = await acquire(id + '/page', () => context.newPage(), value => value.close()); page = acquiredPage.value; pageRecord = acquiredPage.record;
    page.on('pageerror', cause => recordError('PAGE_ERROR', cause));
    page.on('requestfailed', request => recordError('REQUEST_FAILED', request.url() + ': ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) recordError('HTTP_ERROR', response.url() + ': ' + response.status()); });
    page.on('console', message => { const classification = classifyConsole(message.type(), message.text()); if (classification) { if (classification.bucket === 'errors') recordError(classification.kind, classification.message); else if (collected.errors.length + collected.advisories.length < 64) collected.advisories.push(classification); else collected.overflow = true; } });
    await action(page.goto(origin + '/' + id + '/index.html', { waitUntil: 'load', timeout: 15000 }), 'public HTML entry');
    const ready = await action(page.evaluate(async main => (await import(main)).ready, main), 'genuine Engine ready');
    if (ready !== true) throw new Error('Genuine application setup failed: ' + JSON.stringify(await read()));
    collected.rows.push({ id: 'B01', snapshot: await read(), geometry: await geometry(), ledger: await ledger(), samples: await samples() });
    beforeImage = await action(page.screenshot({ type: 'png', fullPage: false }), 'initial supplemental screenshot');
    await eventCase('B02', [50, 40], [50, 40]);
    await eventCase('B03', [25, 25], [25, 25]);
    await eventCase('B04', [50, 40], [25, 25]);
    await eventCase('B05', [140, 90], [140, 90]);
    await eventCase('B06', [50, 40], [50, 40], true);
    await invoke('render'); collected.rows.push({ id: 'B07', snapshot: await read(), samples: await samples() });
    const disposed = await invoke('disposeInput'); await invoke('render'); const afterRender = await read();
    const down = await pointer([50, 40], 'down'), up = await pointer([50, 40], 'up');
    collected.rows.push({ id: 'B08', disposed, afterRender, afterProbe: await read(), probes: [down, up], ledger: await ledger(), samples: await samples() });
    await invoke('beginCssProbe'); collected.rows.push({ id: 'B09', snapshot: await read(), geometry: await geometry(), ledger: await ledger(), samples: await samples() });
    await invoke('setAncestorTransform');
    const css = { id: 'B10', before: await read(), transform: await action(page.evaluate(() => getComputedStyle(document.querySelector('#canvas-parent')).transform), 'ancestor computed style') }; collected.rows.push(css);
    css.down = { input: await pointer([50, 40], 'down'), snapshot: await read() };
    css.up = { input: await pointer([50, 40], 'up'), snapshot: await read() }; css.ledger = await ledger(); css.samples = await samples();
    await invoke('close'); applicationClosed = true;
    const closed = await read(); const closedDown = await pointer([50, 40], 'down'), closedUp = await pointer([50, 40], 'up');
    collected.rows.push({ id: 'B11', snapshot: closed, afterProbe: await read(), probes: [closedDown, closedUp], ledger: await ledger(), samples: await samples() });
    afterImage = await action(page.screenshot({ type: 'png', fullPage: false }), 'final supplemental screenshot');
    collected.requests = requests;
  } catch (cause) { recordError('COLLECTION_FAILURE', cause); }
  finally {
    if (page) {
      try { await bounded(page.evaluate(async main => { const app = await import(main); await app.close(); return true; }, main), id + '/application close', 10000); applicationClosed = true; } catch (cause) { recordError('APP_CLEANUP', cause); }
      try { collected.observerRestoration = await bounded(page.evaluate(() => window.__egretMousePairs.restore()), id + '/descriptor restoration', 10000); observerRestored = collected.observerRestoration.restored === true; } catch (cause) { recordError('OBSERVER_RESTORATION', cause); }
    }
    const pageClosed = await retire(pageRecord), contextClosed = await retire(contextRecord);
    collected.cleanup = { applicationClosed, pageClosed, contextClosed, observerRestored, pendingActors: pending.size + owned.filter(record => record.label.startsWith(id + '/') && !record.retired).length };
  }
  if (beforeImage && afterImage) {
    let offset = 0;
    for (const row of collected.rows) { row.raw = { artifact: id + '.rgba', offset, length: 12 }; offset += 12; }
    collected.artifacts = [await save(id + '.before.png', 'before', beforeImage), await save(id + '.after.png', 'after', afterImage),
      await save(id + '.rows.json', 'rows', JSON.stringify(collected.rows, null, 2) + '\n'), await save(id + '.rgba', 'rgba', collected.rows.flatMap(row => row.samples.flatMap(sample => sample.rgba)))];
  }
}
