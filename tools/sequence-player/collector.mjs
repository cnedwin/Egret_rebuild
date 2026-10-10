// Public explicit-time SequencePlayer opaque verifier. Apache-2.0.
// Projected from the first-party opaque Bitmap collector; external process ownership remains separate.
import { readFile, writeFile, mkdir, realpath, readdir, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import os from 'node:os';
import { sha256, identity, contained, sealGraph } from './file-graph.mjs';
import { STEPS, expectationManifest, inspectCapture } from './oracle.mjs';
import { classifyConsoleMessage } from './console-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../..');
const began = Date.now(), operationDeadlineUTC = began + 240000, closeDeadlineUTC = began + 280000;
const events = [], requests = [], captures = [], attempts = [], artifacts = new Map(), inputs = new Map();
const retirement = { browser: 'not-created', server: 'not-created', contexts: [], fixtures: [] };
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
  requireValue(args.length === 6, 'Exactly --playwright, --channel, --output required');
  const result = {}, allowed = ['--playwright', '--channel', '--output'];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    requireValue(allowed.includes(key) && !Object.hasOwn(result, key) && typeof args[index + 1] === 'string' && args[index + 1].length > 0, 'Unknown/duplicate/missing option');
    result[key] = args[index + 1];
  }
  requireValue(result['--channel'] === 'msedge' && path.isAbsolute(result['--playwright']) && path.isAbsolute(result['--output']), 'Default msedge and explicit absolute paths only');
  return result;
}
function html(backend, graph, aliases) {
  const rootRoute = graph.routeFor(aliases['@egret/engine']), hostRoute = graph.routeFor(aliases[backend === 'canvas' ? '@egret/engine/web' : '@egret/engine/webgpu']);
  requireValue([rootRoute, hostRoute].every(value => typeof value === 'string'), 'Finite entry routes unresolved');
  return Buffer.from(`<!doctype html><meta charset="utf-8"><title>SequencePlayer opaque probe</title><link rel="icon" href="/favicon.ico"><style>html,body{margin:0;padding:0;background:transparent}canvas{display:block}</style><script type="module">
import * as egret from ${JSON.stringify(rootRoute)};
import {${backend === 'canvas' ? 'createCanvasHost' : 'createWebGPUHost'} as createHost} from ${JSON.stringify(hostRoute)};
import {createFixture} from '/fixture.mjs';
window.bitmapFixture=createFixture({backend:${JSON.stringify(backend)},egret,createHost});
window.bitmapModuleReady=true;
</script>`, 'utf8');
}
function requirePlayerProof(packet, retired = false) {
  const player = packet?.player, construction = player?.construction;
  const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  requireValue(player?.created === true && player.lastSampleIsLastAppliedSample === true
    && construction?.cropUnchanged === true && same(construction.naturalSize, [6, 2]) && construction.leaseIdentitySame === true
    && construction.initialLastSampleAbsent === true && construction.initiallyLive === true, 'Missing or invalid public player construction/cache proof');
  const index = retired ? 3 : STEPS.indexOf(packet.step);
  requireValue(index >= 0, 'Public player proof step invalid');
  const crops = [{ x: 0, y: 0, width: 2, height: 2 }, { x: 2, y: 0, width: 1, height: 2 }, { x: 3, y: 0, width: 3, height: 1 }];
  const sampleIndex = Math.min(index, 2), crop = crops[sampleIndex];
  requireValue(player.applyCalls === sampleIndex + 1 && same(player.lastSample, { frameIndex: sampleIndex,
    positionSeconds: [0, 0.125, 0.375][sampleIndex], atEnd: false, stopped: false, region: crop }), 'Public player literal cached sample differs');
  if (index < 3) {
    const proof = packet.playerApplication;
    requireValue(player.isDisposed === false && player.disposal === null && proof?.lastSampleIsReturnedSample === true
      && proof.sampleFrozen === true && proof.regionFrozen === true && same(proof.sourceRect, crop) && same(proof.region, crop), 'Public player literal applied Bitmap proof differs');
  } else {
    const proof = player.disposal;
    requireValue(player.isDisposed === true && proof?.isDisposed === true && proof.lastSampleIsCachedSample === true
      && proof.bitmapStillLive === true && proof.leaseIdentitySame === true && proof.liveLeaseReadEqualsOriginalTexture === true
      && proof.providerDisposalsBeforeBitmapDispose === 0 && same(proof.sourceRect, crops[2]) && same(proof.naturalSize, [3, 1]), 'Public player retirement proof invalid');
    if (!retired) requireValue(packet.playerApplication === null, 'Saved replay must not apply the player');
  }
}
function receipt(status) {
  return { schemaVersion: 'sequence-player-opaque-result/1', status, requestedStepsPerBackend: [...STEPS], completedCaptures: captures.length,
    comparedPixels: captures.reduce((sum, row) => sum + row.observation.pixelComparisons, 0),
    comparedChannels: captures.reduce((sum, row) => sum + row.observation.channelComparisons, 0),
    subsetOnly: '8x4 DPR1 public SequencePlayer explicit-time opaque atlas selection and saved-frame replay', fullA2: false, alphaCalibration: false, performance: false,
    firstError, overflow, identitiesStable, environment, retirement, attempts, captures,
    advisoryCount: events.filter(row => row.kind === 'console' && row.disposition === 'advisory').length,
    artifacts: [...artifacts.values()].filter(row => row.name !== 'result.json'),
    budgets: { perOperationMs: 20000, operationMs: 240000, closeMs: 280000, hardMs: 295000, requiredOuterJobWatchdogMs: 300000,
      events: 128, requests: 2048, fixtureEventsPerList: 128, selectedModules: 128, emittedBytes: 4194304, installedFiles: 4096, inputBytes: 536870912, outputBytes: 16777216 },
    processOwnership: 'Separate external Windows Job/process-retirement receipt required; collector closure does not attest OS process retirement' };
}
const hardTimer = setTimeout(() => {
  remember(Object.assign(new Error('Collector hard deadline'), { code: 'PROBE_DEADLINE' }));
  if (output) {
    try { writeFileSync(path.join(output, 'result.json'), JSON.stringify(receipt('INCOMPLETE'), null, 2) + '\n'); }
    catch { /* Missing fallback receipt must remain an outer-owner limitation. */ }
  }
  process.stderr.write('Bitmap opaque-region probe INCOMPLETE: hard deadline\n'); process.exit(2);
}, 295000);

try {
  const cli = options(process.argv.slice(2));
  requireValue(process.platform === 'win32' && process.arch === 'x64' && process.version === 'v24.19.0', 'Reviewed Windows x64 / Node24.19.0 runtime only');
  const pwPath = await bounded('Playwright realpath', () => realpath(cli['--playwright']));
  const corePath = await bounded('Playwright core realpath', () => realpath(path.join(pwPath, '../playwright-core')));
  const parent = await bounded('output parent realpath', () => realpath(path.dirname(cli['--output']))), candidate = path.join(parent, path.basename(cli['--output']));
  const repositoryRealRoot = await bounded('repository realpath', () => realpath(repositoryRoot));
  requireValue(![repositoryRealRoot, pwPath, corePath].some(root => contained(root, candidate)), 'Output must be fresh and outside repository/installed inputs');
  try { await lstat(candidate); throw new Error('Output exists; attempts cannot overwrite or reuse it'); }
  catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  await bounded('create fresh output', () => mkdir(candidate)); output = candidate;
  for (const name of ['collector.mjs', 'fixture.mjs', 'oracle.mjs', 'file-graph.mjs', 'console-policy.mjs', 'README.md', 'README.zh-CN.md']) {
    const row = await bounded('source identity ' + name, () => identity(path.join(here, name)));
    requireValue(contained(repositoryRealRoot, row.path), 'Public source/reading escaped repository'); pin(row, 'public-source-or-reading');
  }
  const pwRoot = await bounded('bind installed Playwright tree', () => bindTree(pwPath, 'installed-playwright'));
  const coreRoot = await bounded('bind installed Playwright core tree', () => bindTree(corePath, 'installed-playwright-core'));
  const pwMeta = JSON.parse(await readFile(path.join(pwRoot, 'package.json'), 'utf8')), coreMeta = JSON.parse(await readFile(path.join(coreRoot, 'package.json'), 'utf8'));
  requireValue(pwMeta.name === 'playwright' && pwMeta.version === '1.62.1' && coreMeta.name === 'playwright-core' && coreMeta.version === '1.62.1', 'Reviewed installed Playwright versions only');
  for (const file of [process.execPath, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ...['package.json', 'pnpm-lock.yaml', 'packages/engine/package.json', 'packages/runtime/package.json', 'packages/contracts/package.json',
      'node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates/package.json', 'node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates/LICENSE'].map(name => path.join(repositoryRoot, name))]) {
    pin(await bounded('selected source/runtime identity', () => identity(file)), 'selected-source-runtime-package');
  }
  const aliases = {
    '@egret/contracts': path.join(repositoryRoot, 'packages/contracts/dist/index.js'), '@egret/runtime': path.join(repositoryRoot, 'packages/runtime/dist/index.js'),
    '@egret/engine': path.join(repositoryRoot, 'packages/engine/dist/index.js'), '@egret/engine/web': path.join(repositoryRoot, 'packages/engine/dist/web/index.js'),
    '@egret/engine/webgpu': path.join(repositoryRoot, 'packages/engine/dist/web/webgpu.js'),
    'robust-predicates': path.join(repositoryRoot, 'node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates/index.js'),
  };
  const graph = await bounded('seal admitted emitted ESM/source graph', () => sealGraph({ repositoryRoot, aliases,
    entryPaths: { canvas: [aliases['@egret/engine'], aliases['@egret/engine/web']], webgpu: [aliases['@egret/engine'], aliases['@egret/engine/webgpu']] } }));
  graph.inventory.forEach(row => pin(row, row.role));
  requireValue([...inputs.values()].reduce((sum, row) => sum + row.bytes, 0) <= 536870912, 'Aggregate input byte budget');
  const before = [...inputs.values()].sort((left, right) => left.path.localeCompare(right.path));
  await saveJSON('identity-before.json', before); inputBaselineSaved = true;
  await saveJSON('oracle-manifest.json', expectationManifest()); // Written before any native browser launch.
  await saveJSON('module-graph.json', { modules: graph.modules, closures: graph.closures, sourceBuildAttestedHere: false });
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
      await bounded('actual module ready', () => page.waitForFunction(() => window.bitmapModuleReady === true, undefined, { timeout: 20000 }));
      const startup = await bounded('fixture actual startup', () => page.evaluate(async input => {
        try { return { ok: true, value: await window.bitmapFixture.start(input) }; }
        catch (cause) { return { ok: false, error: { name: String(cause?.name ?? 'Error'), code: cause?.code ?? null, message: String(cause?.message ?? cause) }, snapshot: window.bitmapFixture.snapshot() }; }
      }, { operationDeadlineUTC, closeDeadlineUTC }));
      attempt.startup = startup; await saveJSON(backend + '-startup.json', startup);
      if (!startup.ok) throw Object.assign(new Error(startup.error.message), { code: startup.error.code });
      for (const step of STEPS) {
        const packet = await bounded('literal ' + backend + ' ' + step + ' submission', () => page.evaluate(async id => {
          try { return { ok: true, value: await window.bitmapFixture.collectStep(id) }; }
          catch (cause) { return { ok: false, error: { name: String(cause?.name ?? 'Error'), code: cause?.code ?? null, message: String(cause?.message ?? cause) }, snapshot: window.bitmapFixture.snapshot() }; }
        }, step));
        if (!packet.ok) { attempt.stepFailures.push({ step, ...packet }); throw Object.assign(new Error(packet.error.message), { code: packet.error.code }); }
        const capture = packet.value;
        requireValue(Array.isArray(capture.raw) && capture.raw.length <= 128 && capture.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255), 'Original raw byte domain');
        const rawArtifact = await save(backend + '-' + step + '.rgba', Buffer.from(capture.raw)); // Preserve before oracle comparisons.
        const observation = inspectCapture(capture), saved = { ...capture, raw: undefined, rawArtifact, observation }; captures.push(saved);
        await saveJSON(backend + '-' + step + '.json', saved); await saveJSON('result.json', receipt('COLLECTING'));
        requirePlayerProof(capture); // Missing player proof prevents completion; original raw bytes are already preserved.
        if (capture.firstError || capture.events.length || capture.diagnostics.length) throw Object.assign(new Error('Native fixture reported unexpected fault'), { code: capture.firstError?.code ?? 'PROBE_NATIVE_FAULT' });
      }
    } finally {
      if (contextCreation && !context) {
        try { context = await bounded('observe late context', () => contextCreation, true); }
        catch (cause) { contextReceipt.state = 'unresolved'; contextReceipt.error = errorRecord(cause); }
      }
      if (page) {
        let closed;
        try { closed = await bounded('fixture host/device cleanup', () => page.evaluate(() => window.bitmapFixture?.close() ?? { moduleUnavailable: true }), true); }
        catch (cause) { closed = { error: errorRecord(cause), unresolved: true }; }
        retirement.fixtures.push({ backend, ...closed });
        try { requirePlayerProof(closed, true); }
        catch (cause) { remember(cause); }
        const safe = closed.nextStep === 4 && closed.ports?.length === 2 && closed.ports.every(port => port.close === 'fulfilled' && port.engineDisposeFulfilled && port.safeHostReturn && !port.quarantine && port.pendingStartup === 0 && port.pendingNative === 0
          && (backend === 'canvas' || port.deviceAcquiredByCollector && port.deviceDestroyedByCollector && port.deviceLoss === 'fulfilled' && port.deviceLossInfo?.reason === 'destroyed'
            && port.hostStatus?.firstFailure === null && port.hostStatus?.callbackFailureCount === 0 && port.hostStatus?.lastCallbackFailure === null));
        if (!safe || closed.ports[0].renderCalls !== 3 || closed.ports[1].renderCalls !== 1 || closed.firstError || closed.events?.length || closed.diagnostics?.length) remember(Object.assign(new Error('Incomplete or unsafe fixture cleanup'), { code: 'PROBE_CLOSE_UNSAFE' }));
      } else remember(Object.assign(new Error('No complete fixture ownership proof'), { code: 'PROBE_CLOSE_UNSAFE' }));
      if (context) {
        try { await bounded('context close', () => context.close(), true); contextReceipt.state = 'closed'; }
        catch (cause) { contextReceipt.state = 'unresolved'; contextReceipt.error = errorRecord(cause); }
      }
      await saveJSON('requests.json', requests, true); await saveJSON('browser-events.json', events, true); await saveJSON('result.json', receipt('COLLECTING'), true);
    }
    if (firstError) throw Object.assign(new Error(firstError.message), { code: firstError.code });
  }
  requireValue(captures.length === 8 && ['canvas', 'webgpu'].every(backend => captures.filter(row => row.backend === backend).map(row => row.step).join(',') === STEPS.join(',')), 'Exactly four ordered captures per backend');
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
      identitiesStable = inputBaselineSaved; await saveJSON('identity-after.json', after.sort((left, right) => left.path.localeCompare(right.path)), true);
      await saveJSON('requests.json', requests, true); await saveJSON('browser-events.json', events, true);
      const complete = collected && identitiesStable && !firstError && !overflow && retirement.browser === 'closed' && retirement.server === 'closed'
        && retirement.contexts.length === 2 && retirement.contexts.every(row => row.state === 'closed') && retirement.fixtures.length === 2;
      const status = complete ? captures.every(row => row.observation.pass) ? 'PASS_OPAQUE_REGION_SUBSET' : 'FAIL_OPAQUE_REGION_SUBSET' : 'INCOMPLETE';
      await saveJSON('result.json', receipt(status), true);
      process.stdout.write(JSON.stringify({ status, completedCaptures: captures.length, comparedChannels: receipt(status).comparedChannels, output, fullA2: false }) + '\n');
      process.exitCode = status === 'PASS_OPAQUE_REGION_SUBSET' ? 0 : status === 'FAIL_OPAQUE_REGION_SUBSET' ? 1 : 2;
    } catch (cause) {
      remember(cause); identitiesStable = false; process.exitCode = 2;
      try { writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...receipt('INCOMPLETE'), finalReceiptError: errorRecord(cause) }, null, 2) + '\n'); }
      catch { /* Root retains missing artifact as incomplete. */ }
      process.stderr.write(JSON.stringify({ status: 'INCOMPLETE', firstError, finalReceiptError: errorRecord(cause) }) + '\n');
    }
  } else { process.exitCode = 2; process.stderr.write(JSON.stringify({ status: 'INCOMPLETE', firstError }) + '\n'); }
  clearTimeout(hardTimer);
}
