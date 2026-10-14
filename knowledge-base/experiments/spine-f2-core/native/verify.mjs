// SPDX-License-Identifier: Apache-2.0
// Explicit native collection, with source-only help and no SDK installation.
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { freezeNativeGraph } from './graph.mjs';
import { TIMES, inspectCaptures, requireNative } from './oracle.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const canonical = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const handled = value => { const promise = Promise.resolve(value); promise.catch(() => undefined); return promise; };
let fileIdentity;
const INPUT_KEYS = Object.freeze(['repositoryRoot', 'repositoryPins', 'sdkRoot', 'sdkPins', 'readerProjection',
  'reviewPins', 'runtimePins', 'nodeExecutable', 'playwrightEntry', 'edgeExecutable',
  'playwrightCorePackage', 'playwrightCoreBundle', 'evidencePins']);
const zeroOpenFindings = review => review.openFindings === 0
  || Array.isArray(review.openFindings) && review.openFindings.length === 0;
function exactKeys(value, keys, label) {
  requireNative(value !== null && typeof value === 'object' && !Array.isArray(value)
    && equal(Object.keys(value).sort(), [...keys].sort()), label + ' exact schema');
}
function errorData(cause, seen = new Set()) {
  if (cause === null || typeof cause !== 'object') return { occurrence: true, value: String(cause), undefined: cause === undefined };
  if (seen.has(cause)) return { cycle: true }; seen.add(cause);
  return { occurrence: true, name: cause.name, code: cause.code, message: cause.message, stack: cause.stack,
    ...('cause' in cause ? { cause: errorData(cause.cause, seen) } : {}),
    ...(Array.isArray(cause.cleanupErrors) ? { cleanupErrors: cause.cleanupErrors.map(value => errorData(value, seen)) } : {}) };
}
function rawAbsolute(pin, cap = 268435456) {
  requireNative(pin && path.isAbsolute(pin.path) && Number.isSafeInteger(pin.bytes) && pin.bytes >= 0
    && pin.bytes <= cap && /^[a-f0-9]{64}$/.test(pin.sha256), 'Explicit original raw pin');
  const info = lstatSync(pin.path); requireNative(info.isFile() && !info.isSymbolicLink(), 'Original regular pinned file');
  const owner = path.dirname(pin.path), relative = fileIdentity.ownerRelativePath(owner, pin.path);
  const actual = fileIdentity.fingerprintFile(owner, relative);
  requireNative(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, 'Full original owner-relative identity drift: ' + pin.path);
  const raw = readFileSync(pin.path); requireNative(raw.length === pin.bytes && hash(raw) === pin.sha256, 'Original input raw drift: ' + pin.path); return raw;
}
function admitExactBindings(admission) {
  const binding = JSON.parse(rawAbsolute(admission.inputBindingPin, 8388608));
  exactKeys(binding, ['schemaVersion', 'kind', 'status', 'inputs'], 'Independent input binding record');
  requireNative(binding.schemaVersion === 1 && binding.kind === 'F2C_NATIVE_EXACT_INPUT_BINDING_RECORD'
    && binding.status === 'ORIGINAL_INPUTS_BOUND_FOR_INDEPENDENT_REVIEW', 'Original input binding record role');
  exactKeys(binding.inputs, INPUT_KEYS, 'Bound current native inputs');
  for (const key of INPUT_KEYS) requireNative(equal(binding.inputs[key], admission[key]), 'Exact binding mismatch: ' + key);
  const review = JSON.parse(rawAbsolute(admission.inputBindingReviewPin, 2097152));
  exactKeys(review, ['schemaVersion', 'kind', 'verdict', 'openFindings', 'findings', 'bindingRecordPin',
    'checkedInputKeys', 'currentInputsMatch', 'reviewedEvidencePins'], 'Independent input binding review');
  requireNative(review.schemaVersion === 1 && review.kind === 'INDEPENDENT_F2C_NATIVE_INPUT_BINDING_REVIEW'
    && review.verdict === 'PASS_EXACT_F2C_NATIVE_INPUT_BINDING_ONLY' && zeroOpenFindings(review)
    && Array.isArray(review.findings) && review.findings.length === 0 && review.currentInputsMatch === true,
  'Exact independent zero-finding binding review');
  requireNative(equal(review.bindingRecordPin, admission.inputBindingPin)
    && equal(review.checkedInputKeys, [...INPUT_KEYS].sort())
    && equal(review.reviewedEvidencePins, admission.evidencePins), 'Independent review binds this full original record and evidence');
  requireNative(Array.isArray(admission.evidencePins) && admission.evidencePins.length >= 3
    && admission.evidencePins.length <= 512, 'Complete original source/Core/control evidence pins');
  for (const role of ['nativeSource', 'coreActual', 'controlsActual']) requireNative(admission.evidencePins.some(row => row.role === role), 'Actual original evidence role: ' + role);
  const evidenceKeys = new Set();
  for (const row of admission.evidencePins) {
    exactKeys(row, ['role', 'pin'], 'Original evidence row'); requireNative(['nativeSource', 'coreActual', 'controlsActual'].includes(row.role), 'Known original evidence role');
    const key = row.role + ':' + fileIdentity.physicalPathKey(row.pin.path); requireNative(!evidenceKeys.has(key), 'No duplicate original evidence row'); evidenceKeys.add(key);
    rawAbsolute(row.pin, 8388608);
  }
  for (const name of ['fixture.mjs', 'graph.mjs', 'oracle.mjs', 'verify.mjs']) requireNative(admission.repositoryPins.some(row => row.path === 'knowledge-base/experiments/spine-f2-core/native/' + name), 'Current reviewed native source row');
  return { recordPin: admission.inputBindingPin, independentReviewPin: admission.inputBindingReviewPin,
    exactInputKeys: INPUT_KEYS, originalEvidencePins: admission.evidencePins };
}
function resolveDefaultEdge(admission) {
  // This exact public package export is the installed Playwright 1.62.1 channel
  // registry used by its ordinary launch path. No browser, installer or SDK is started.
  const pkg = JSON.parse(rawAbsolute(admission.playwrightCorePackage, 2097152));
  requireNative(pkg.name === 'playwright-core' && pkg.version === '1.62.1'
    && pkg.exports?.['./lib/coreBundle'] === './lib/coreBundle.js', 'Pinned current public Playwright registry export');
  const owner = path.dirname(admission.playwrightCorePackage.path), file = path.join(owner, 'lib/coreBundle.js');
  requireNative(fileIdentity.samePhysicalPath(file, admission.playwrightCoreBundle.path), 'Registry export full physical owner');
  rawAbsolute(admission.playwrightCoreBundle);
  const require = createRequire(admission.playwrightEntry.path);
  requireNative(fileIdentity.samePhysicalPath(require.resolve('playwright-core/package.json'), admission.playwrightCorePackage.path)
    && fileIdentity.samePhysicalPath(require.resolve('playwright-core/lib/coreBundle'), file), 'Actual admitted Playwright entry resolves this exact core registry owner');
  const bundle = require(file);
  requireNative(bundle?.registry?.registry && typeof bundle.registry.registry.findExecutable === 'function', 'Actual installed default channel registry');
  const channel = bundle.registry.registry.findExecutable('msedge');
  requireNative(channel?.name === 'msedge' && channel.browserName === 'chromium' && typeof channel.executablePath === 'function', 'Exact default msedge registry channel');
  const resolved = channel.executablePath();
  requireNative(typeof resolved === 'string' && path.isAbsolute(resolved)
    && fileIdentity.samePhysicalPath(resolved, admission.edgeExecutable.path), 'Default selected Edge differs from admitted full physical executable');
  const resolvedPin = { path: resolved, bytes: admission.edgeExecutable.bytes, sha256: admission.edgeExecutable.sha256 }; rawAbsolute(resolvedPin);
  return { schemaVersion: 1, status: 'ACTUAL_DEFAULT_MSEDGE_CHANNEL_RESOLUTION_MATCHED',
    registryPackagePin: admission.playwrightCorePackage, registryBundlePin: admission.playwrightCoreBundle,
    channel: 'msedge', browserName: 'chromium', resolvedExecutablePin: resolvedPin,
    admittedExecutablePin: admission.edgeExecutable, extraLaunchFlags: [], customExecutablePath: false };
}
async function collect(admissionPath, output) {
  const admissionRaw = readFileSync(admissionPath), admissionPin = { path: admissionPath, bytes: admissionRaw.length, sha256: hash(admissionRaw) };
  const admission = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(admissionRaw));
  requireNative(admission.schemaVersion === 1 && admission.status === 'F2C_NATIVE_REVIEWED_INPUTS_ADMITTED', 'Explicit reviewed native input admission');
  const graph = await freezeNativeGraph(admission);
  const helperFile = path.join(admission.repositoryRoot, 'tools/lib/file-identity.mjs');
  const identity = await import(pathToFileURL(helperFile).href); fileIdentity = identity;
  rawAbsolute(admissionPin);
  requireNative(Array.isArray(admission.reviewPins) && equal(admission.reviewPins.map(row => row.role).sort(), ['controlsActual', 'coreActual', 'nativeSource']), 'Exact independent source/actual role list');
  for (const row of admission.reviewPins) {
    const review = JSON.parse(rawAbsolute(row.pin, 2097152));
    requireNative(typeof review.verdict === 'string' && review.verdict.startsWith('PASS')
      && zeroOpenFindings(review), 'Original independent review: ' + row.role);
  }
  requireNative(Array.isArray(admission.runtimePins) && admission.runtimePins.length >= 3 && admission.runtimePins.length <= 4096, 'Explicit installed native runtime inventory');
  let runtimeBytes = 0; for (const pin of admission.runtimePins) { runtimeBytes += pin.bytes; requireNative(runtimeBytes <= 2147483648, 'Installed runtime aggregate budget'); rawAbsolute(pin); }
  for (const pin of [admission.nodeExecutable, admission.playwrightEntry, admission.edgeExecutable,
    admission.playwrightCorePackage, admission.playwrightCoreBundle]) {
    requireNative(admission.runtimePins.some(row => equal(row, pin)), 'Original Node/Playwright/Edge runtime pin must occur in inventory'); rawAbsolute(pin);
  }
  const inputBinding = admitExactBindings(admission);
  requireNative(identity.samePhysicalPath(process.execPath, admission.nodeExecutable.path), 'Actor is the admitted installed Node');
  requireNative(path.isAbsolute(output) && !existsSync(output) && !identity.samePhysicalPath(output, admission.repositoryRoot), 'Fresh absolute external output');
  try { identity.ownerRelativePath(admission.repositoryRoot, output); throw new Error('Output inside repository'); }
  catch (cause) { requireNative(cause instanceof RangeError, 'Output must leave repository owner'); }
  const parent = path.dirname(output); requireNative(identity.samePhysicalPath(parent, realpathSync(parent)) && lstatSync(parent).isDirectory(), 'Canonical existing output parent');
  mkdirSync(output); const save = (name, value) => writeFileSync(path.join(output, identity.logicalPath(name)), canonical(value), { flag: 'wx' });
  save('admission-input.json', { admissionPin, reviewPins: admission.reviewPins, inputBinding }); save('module-graph-before.json', graph);
  const startedAt = Date.now(), operationDeadline = startedAt + 180_000, cleanupDeadline = startedAt + 220_000;
  let primaryOccurred = false, primary, closing = false, browser, server, context, page, browserVersion;
  let browserClosed = false, contextClosed = false, serverClosed = false, retirement, setup, canvasRefusal, comparison, channelResolution, mainEntered = false;
  const packets = [], requests = [], browserEvents = [], tickets = [], cleanupErrors = [];
  const fail = cause => { if (!primaryOccurred) { primaryOccurred = true; primary = cause; } };
  function track(value, label, register) {
    const promise = handled(value), row = { id: tickets.length + 1, label, settled: false }; tickets.push(row);
    handled(promise.then(result => { row.settled = true; row.fulfilled = true;
      try { register?.(result); } catch (cause) { fail(cause); }
    }, cause => { row.settled = true; row.fulfilled = false; row.error = errorData(cause); })); return promise;
  }
  async function bounded(value, label, cleanup = false) {
    const promise = handled(value), delay = Math.min(20_000, (cleanup ? cleanupDeadline : operationDeadline) - Date.now());
    requireNative(delay > 0, label + ' deadline expired', 'F2C_NATIVE_DEADLINE'); let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(label + ' pending'), { code: 'F2C_NATIVE_TIMEOUT' })), delay);
    })]); } finally { clearTimeout(timer); }
  }
  const routes = new Map();
  function route(name, bytes, mime) { requireNative(!routes.has(name), 'No duplicate sealed browser route'); routes.set(name, { bytes, mime, sha256: hash(bytes) }); }
  for (const row of graph.modules) route(row.route, Buffer.from(row.bodyBase64, 'base64'), 'text/javascript');
  for (const row of graph.extensionlessRoutes) {
    const original = graph.modules.find(module => module.route === row.originalModuleRoute);
    requireNative(original !== undefined, 'Exact original foundational route body');
    route(row.route, Buffer.from(original.bodyBase64, 'base64'), 'text/javascript');
  }
  for (const row of graph.assetRoutes) route(row.route, Buffer.from(row.bodyBase64, 'base64'), row.path.endsWith('.png') ? 'image/png' : row.path.endsWith('.rgba') ? 'application/octet-stream' : 'application/json');
  route('/favicon.ico', Buffer.alloc(0), 'image/x-icon');
  const entry = Buffer.from("import { createNativeFixture } from '/knowledge-base/experiments/spine-f2-core/native/fixture.mjs';\nwindow.__f2cNative=createNativeFixture();\nwindow.__f2cReady=true;\n");
  const imports = JSON.stringify(graph.importMap), importHash = createHash('sha256').update(imports).digest('base64');
  const html = Buffer.from('<!doctype html><meta charset="utf-8"><link rel="icon" href="/favicon.ico"><style>body{margin:0;background:transparent}</style><script type="importmap">' + imports + '</script><script type="module" src="/entry.mjs"></script>\n');
  route('/entry.mjs', entry, 'text/javascript'); route('/', html, 'text/html');
  writeFileSync(path.join(output, 'original-entry.mjs'), entry, { flag: 'wx' }); writeFileSync(path.join(output, 'original-entry.html'), html, { flag: 'wx' });
  let hostHeader, origin;
  try {
    // Authenticate the actual installed channel before exposing any loopback route.
    channelResolution = resolveDefaultEdge(admission); save('runtime-channel-resolution.json', channelResolution);
    server = createServer((request, response) => {
      const item = routes.get(request.url);
      if (request.method !== 'GET' || request.headers.host !== hostHeader || !item || requests.length >= 4096
        || request.headers['content-length'] || request.headers['transfer-encoding']) {
        fail(Object.assign(new Error('Unlisted loopback route/method/Host'), { code: 'F2C_NATIVE_ROUTE' })); response.writeHead(400); response.end(); return;
      }
      requests.push({ route: request.url, method: request.method, bytes: item.bytes.length, sha256: item.sha256 });
      response.writeHead(200, { 'Content-Type': item.mime, 'Content-Length': item.bytes.length, 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; script-src 'self' 'sha256-" + importHash + "'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'" }); response.end(item.bytes);
    }); server.on('error', fail);
    await bounded(track(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 'loopback listen'), 'loopback listen');
    hostHeader = '127.0.0.1:' + server.address().port; origin = 'http://' + hostHeader;
    const require = createRequire(import.meta.url), { chromium } = require(admission.playwrightEntry.path);
    const immediatelyBeforeLaunch = resolveDefaultEdge(admission);
    requireNative(equal(immediatelyBeforeLaunch, channelResolution), 'Default channel resolution changed before launch');
    await bounded(track(chromium.launch({ channel: 'msedge', headless: true, timeout: 20_000 }), 'default msedge launch', value => {
      browser = value; if (closing) track(value.close(), 'late browser retirement', () => { browserClosed = true; });
    }), 'default msedge launch'); browserVersion = browser.version();
    await bounded(track(browser.newContext({ viewport: { width: 800, height: 650 }, deviceScaleFactor: 1 }), 'native context', value => {
      context = value; if (closing) track(value.close(), 'late context retirement', () => { contextClosed = true; });
    }), 'native context');
    await bounded(track(context.route('**/*', async intercepted => {
      const url = new URL(intercepted.request().url());
      if (url.origin !== origin) { fail(Object.assign(new Error('Browser requested an external origin'), { code: 'F2C_NATIVE_ROUTE' })); await intercepted.abort(); }
      else await intercepted.continue();
    }), 'explicit same-origin browser route'), 'browser route');
    await bounded(track(context.newPage(), 'native page', value => { page = value; }), 'native page');
    page.on('pageerror', cause => { browserEvents.push({ kind: 'pageerror', error: errorData(cause) }); fail(cause); });
    page.on('console', event => { browserEvents.push({ kind: 'console', type: event.type(), text: event.text() }); if (event.type() === 'error') fail(new Error(event.text())); });
    await bounded(track(page.goto(origin + '/', { waitUntil: 'load', timeout: 20_000 }), 'native navigation'), 'native navigation');
    await bounded(track(page.waitForFunction(() => window.__f2cReady === true, undefined, { timeout: 20_000 }), 'native public entry'), 'native public entry');
    setup = await bounded(track(page.evaluate(limits => window.__f2cNative.start(limits), { operationDeadline, cleanupDeadline }), 'genuine native start'), 'genuine native start');
    save('native-setup.json', setup); writeFileSync(path.join(output, 'original-decoded-page.rgba'), Buffer.from(setup.pagePixels), { flag: 'wx' });
    requireNative(!primaryOccurred && !setup.setup.primaryOccurred && setup.setup.cleanupErrors.length === 0, 'Genuine native setup');
    mainEntered = true;
    for (const index of TIMES.keys()) {
      const packet = await bounded(track(page.evaluate(value => window.__f2cNative.collect(value), index), 'original sample ' + index), 'original sample ' + index);
      // Preserve complete original bytes before any assertion or oracle comparison.
      save('native-sample-' + index + '.json', packet); writeFileSync(path.join(output, 'native-sample-' + index + '.rgba'), Buffer.from(packet.raw), { flag: 'wx' }); packets.push(packet);
    }
    comparison = inspectCaptures(packets); save('native-comparison.json', comparison);
    canvasRefusal = await bounded(track(page.evaluate(() => window.__f2cNative.canvasRefusal()), 'Canvas explicit profile refusal'), 'Canvas explicit profile refusal'); save('canvas-refusal.json', canvasRefusal);
    requireNative(canvasRefusal.status === 'PASS_REFUSAL_ONLY' && canvasRefusal.renderedSubmissions === 0, 'Separate negative Canvas refusal');
    retirement = await bounded(track(page.evaluate(() => window.__f2cNative.close()), 'native caller retirement'), 'native caller retirement', true); save('native-retirement.json', retirement);
    requireNative(!retirement.primaryOccurred && retirement.cleanupErrors.length === 0 && retirement.pendingTickets === 0
      && retirement.resourceDisposed && retirement.instanceState === 'disposed' && retirement.resourceScopeState === 'closed'
      && retirement.instanceScopeState === 'closed' && retirement.textureRetired && retirement.providerRetirements === 1
      && retirement.destroyRequested && retirement.deviceLoss?.reason === 'destroyed', 'Complete genuine native retirement');
    requireNative(['@egret/engine', '@egret/engine/web/image', '@egret/engine/webgpu', '@egret/engine/web', '@esotericsoftware/spine-core']
      .every(specifier => requests.some(row => row.route === graph.importMap.imports[specifier])), 'Actual selected public roots requested');
  } catch (cause) { fail(cause); }
  finally {
    closing = true;
    if (page && !page.isClosed() && retirement === undefined) try {
      retirement = await bounded(track(page.evaluate(() => window.__f2cNative?.close()), 'failure native caller retirement'), 'failure native caller retirement', true);
      save('native-failure-retirement.json', retirement ?? { fixtureNotCreated: true });
      requireNative(retirement && retirement.pendingTickets === 0 && retirement.cleanupErrors.length === 0, 'Failure native quarantine', 'F2C_NATIVE_CLOSE_UNSAFE');
    } catch (cause) { cleanupErrors.push(cause); }
    if (context && !contextClosed) try { await bounded(track(context.close(), 'context retirement'), 'context retirement', true); contextClosed = true; } catch (cause) { cleanupErrors.push(cause); }
    if (browser && !browserClosed) try { await bounded(track(browser.close(), 'browser retirement'), 'browser retirement', true); browserClosed = true; } catch (cause) { cleanupErrors.push(cause); }
    if (server) try { await bounded(track(new Promise((resolve, reject) => server.close(cause => cause ? reject(cause) : resolve())), 'loopback retirement'), 'loopback retirement', true); serverClosed = true; } catch (cause) { cleanupErrors.push(cause); }
  }
  let stable = false;
  try {
    const after = await freezeNativeGraph(admission); stable = equal(after, graph); requireNative(stable, 'Original native graph drift'); save('module-graph-after.json', after);
    rawAbsolute(admissionPin); for (const row of admission.reviewPins) rawAbsolute(row.pin, 2097152); for (const pin of admission.runtimePins) rawAbsolute(pin);
    requireNative(equal(admitExactBindings(admission), inputBinding), 'Independent original input binding drift');
    requireNative(equal(resolveDefaultEdge(admission), channelResolution), 'Actual default channel resolution drift');
  } catch (cause) { cleanupErrors.push(cause); }
  const unsettled = tickets.filter(row => !row.settled), incomplete = unsettled.length || cleanupErrors.length || !stable
    || !contextClosed || !browserClosed || !serverClosed || ['F2C_NATIVE_UNAVAILABLE', 'F2C_NATIVE_TIMEOUT', 'F2C_NATIVE_DEADLINE', 'F2C_NATIVE_CLOSE_UNSAFE'].includes(primary?.code);
  const complete = comparison?.pass && packets.length === 7 && canvasRefusal?.status === 'PASS_REFUSAL_ONLY'
    && retirement?.submissions === 7 && retirement?.pendingTickets === 0;
  const result = { schemaVersion: 1, status: incomplete ? 'INCOMPLETE' : primaryOccurred || !complete ? 'FAIL' : 'PASS_BOUNDED_F2C11_NATIVE_ONLY',
    scope: 'Original unweighted mesh/deform PNG-to-textured-WebGPU default desktop browser only', admissionPin,
    startedAtUtc: new Date(startedAt).toISOString(), finishedAtUtc: new Date().toISOString(), browserVersion,
    launch: { channel: 'msedge', headless: true, extraLaunchFlags: [], deviceScaleFactor: 1 },
    node: { version: process.version, platform: process.platform, arch: process.arch, execPath: process.execPath },
    installedEdgeExecutablePin: admission.edgeExecutable, actualDefaultChannelResolution: channelResolution, inputBinding,
    primaryOccurred, primary: primaryOccurred ? errorData(primary) : null,
    cleanupErrors: cleanupErrors.map(value => errorData(value)), tickets, unsettledTicketIds: unsettled.map(row => row.id),
    sourceAndRuntimeStable: stable, browserClosed, contextClosed, serverClosed,
    actualNativeMainCases: mainEntered ? 1 : 0, actualNativeMainPasses: complete && !primaryOccurred && !incomplete ? 1 : 0,
    renderedSubmissions: retirement?.submissions ?? null, originalReadbacksSaved: packets.length,
    canvasRefusal, comparison, requests, browserEvents,
    requestedModuleRoutes: [...new Set(requests.filter(row => graph.modules.some(module => module.route === row.route)).map(row => row.route))],
    declaredButNotRequestedModuleRoutes: graph.modules.filter(module => !requests.some(row => row.route === module.route)).map(row => row.route),
    entitlement: 'unverified', redistributionClearance: 'unverified',
    observedLimits: ['No physical GPU, phone, mini-game host, Native SDK, power, FPS or GC acceptance', 'No full Spine, clock, migration or delivery acceptance'],
    observationDeadlinesMs: { eachOperation: 20000, operation: 180000, cooperativeCleanup: 220000, outerActorContainmentRequired: 240000 } };
  save('result.json', result); return result;
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  process.stdout.write('Usage: node knowledge-base/experiments/spine-f2-core/native/verify.mjs --admission <absolute reviewed input JSON> --output <fresh absolute external directory>\n');
} else {
  if (args.length !== 4 || args[0] !== '--admission' || args[2] !== '--output' || !path.isAbsolute(args[1]) || !path.isAbsolute(args[3])) throw new TypeError('Exact native admission/output options required');
  const result = await collect(args[1], args[3]); process.stdout.write(JSON.stringify({ status: result.status, originalReadbacksSaved: result.originalReadbacksSaved, output: args[3] }) + '\n');
  if (result.status !== 'PASS_BOUNDED_F2C11_NATIVE_ONLY') process.exitCode = 1;
}
