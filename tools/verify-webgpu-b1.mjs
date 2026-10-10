// First-party bounded B1 browser verifier. Cooperative API cleanup is not OS retirement proof.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { POSITIVE_FRAMES, NEGATIVES } from './b1-webgpu/oracle.mjs';

const directory = dirname(fileURLToPath(import.meta.url)), companionDirectory = resolve(directory, 'b1-webgpu');
const sha256 = body => createHash('sha256').update(body).digest('hex');
class SetupRefusal extends Error {
  constructor(code, message) { super(message); this.name = 'SetupRefusal'; this.code = code; }
}
function samePath(first, second) {
  const comparable = value => process.platform === 'win32' ? value.replaceAll('\\', '/').toLowerCase() : value;
  return comparable(first) === comparable(second);
}
function inside(root, candidate) {
  const tail = relative(root, candidate);
  return tail === '' || (!isAbsolute(tail) && tail !== '..' && !tail.startsWith('..' + sep));
}
async function directoryChain(path) {
  // Realpath equality plus lstat rejects path aliases, symlinks and Windows junction ancestors.
  // This is finite admission in a cooperative filesystem, not an adversarial inode-race guarantee.
  for (let cursor = path; ; cursor = dirname(cursor)) {
    const info = await lstat(cursor);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(cursor), cursor)) {
      throw Error('Output ancestry is not canonical regular directories');
    }
    if (dirname(cursor) === cursor) break;
  }
}
async function outputAdmission(requested, repository) {
  const output = resolve(requested);
  if (!samePath(requested, output) || inside(repository, output)) throw Error('Output must be a canonical repository-external child');
  try { await lstat(output); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await directoryChain(dirname(output)); return output;
  }
  throw Error('Existing output is never reused');
}
async function admit(argv) {
  const options = Object.create(null), metadataInputs = new Map();
  if (argv.length !== 6) throw new SetupRefusal('CLI_OPTIONS_INVALID', 'Exactly three option/value pairs are required');
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!['--playwright', '--channel', '--output'].includes(key) || Object.hasOwn(options, key)
        || typeof value !== 'string' || !value.length || value.length > 32768) {
      throw new SetupRefusal('CLI_OPTIONS_INVALID', 'Missing, duplicate, unknown or invalid option/value');
    }
    options[key] = value;
  }
  if (!isAbsolute(options['--playwright']) || !isAbsolute(options['--output'])) {
    throw new SetupRefusal('CLI_OPTIONS_INVALID', 'Installed-tool and output paths must be absolute');
  }
  if (options['--channel'] !== 'msedge') throw new SetupRefusal('CHANNEL_UNSUPPORTED', 'Only the selected msedge channel is admitted');
  if (process.version !== 'v24.19.0' || process.execArgv.length !== 0) {
    throw new SetupRefusal('NODE_PROFILE_INVALID', 'Node.js v24.19.0 without added execution flags is required');
  }
  const repository = await realpath(resolve(directory, '..'));
  let output;
  try { output = await outputAdmission(options['--output'], repository); }
  catch { throw new SetupRefusal('OUTPUT_OWNERSHIP_INVALID', 'Output must be absent, canonical, nonsymlink and outside the repository'); }
  async function profileFile(path) {
    const physical = await realpath(path), info = await lstat(physical);
    if (!info.isFile() || info.size > 1024 * 1024) throw Error('Profile input is not a bounded regular file');
    const body = await readFile(physical);
    if (body.length !== info.size) throw Error('Profile input changed while reading');
    const receipt = { path: physical, bytes: body.length, sha256: sha256(body) };
    const previous = metadataInputs.get(physical);
    if (previous) assert.deepEqual(receipt, previous, 'Profile input changed during admission');
    metadataInputs.set(physical, receipt); return body;
  }
  const profileJSON = async path => JSON.parse((await profileFile(path)).toString('utf8'));
  let modulePath, playwrightMetadataPath, metadata, coreMetadataPath, coreMetadata;
  try {
    modulePath = await realpath(options['--playwright']); playwrightMetadataPath = resolve(modulePath, 'package.json');
    metadata = await profileJSON(playwrightMetadataPath);
    if (metadata.name !== 'playwright' || metadata.version !== '1.62.1') throw Error('Installed Playwright identity/version differs');
    // Resolve from the selected package: both nested and sibling node_modules layouts are valid.
    const require = createRequire(playwrightMetadataPath);
    coreMetadataPath = await realpath(require.resolve('playwright-core/package.json')); coreMetadata = await profileJSON(coreMetadataPath);
    if (coreMetadata.name !== 'playwright-core' || coreMetadata.version !== '1.62.1') throw Error('Installed playwright-core identity/version differs');
    await profileFile(resolve(modulePath, 'index.mjs'));
  } catch { throw new SetupRefusal('PLAYWRIGHT_METADATA_INVALID', 'Installed Playwright/core identity, version or entry metadata is invalid'); }
  let rootMetadata, compilerMetadataPath;
  try {
    rootMetadata = await profileJSON(resolve(repository, 'package.json'));
    compilerMetadataPath = resolve(repository, 'node_modules/typescript/package.json');
    if (rootMetadata.packageManager !== 'pnpm@11.25.0' || rootMetadata.devDependencies?.typescript !== '7.0.2'
        || (await profileJSON(compilerMetadataPath)).version !== '7.0.2') throw Error('Repository profile differs');
  } catch { throw new SetupRefusal('REPOSITORY_PROFILE_INVALID', 'Repository pnpm/TypeScript metadata differs from the selected profile'); }
  try {
    await outputAdmission(output, repository); // Recheck after metadata IO before exclusive ownership.
    await mkdir(output);
    await directoryChain(output);
  } catch { throw new SetupRefusal('OUTPUT_OWNERSHIP_INVALID', 'Exclusive canonical output creation failed; existing caller paths remain untouched'); }
  return { repository, output, modulePath, playwrightMetadataPath, metadata, coreMetadataPath, coreMetadata,
    rootMetadata, compilerMetadataPath, metadataInputs };
}
async function main() {
let admission;
try { admission = await admit(process.argv.slice(2)); }
catch (error) {
  const code = error instanceof SetupRefusal ? error.code : 'SETUP_INCOMPLETE';
  const message = error instanceof SetupRefusal ? error.message : 'Canonical repository or setup IO could not be admitted';
  console.error(`${code}: ${message.slice(0, 1024)}`); process.exitCode = 1; return;
}
const { repository, output, modulePath, playwrightMetadataPath, metadata, coreMetadataPath, coreMetadata,
  rootMetadata, compilerMetadataPath, metadataInputs } = admission;
const startedAt = Date.now(), operationDeadline = startedAt + 70000, closeDeadline = startedAt + 85000;
const report = { schemaVersion: 1, status: 'INCOMPLETE', startedAtUTC: new Date(startedAt).toISOString(), budgetMs: 90000,
  launch: { channel: 'msedge', headless: true, callerAddedFlags: [], freshContext: true, deviceScaleFactor: 1 },
  windows: [], patches: [], requests: [], browserEvents: [], cleanupFailures: [], failure: null,
  lifecycle: { browserClosed: false, contextClosed: false, serverClosed: false, identitiesStable: false,
    cleanupScope: 'standalone-cooperative-api', osDescendantRetirement: 'UNBOUND', pendingApiOperations: 0 },
  limits: 'Real desktop-browser compilation/readback only; no hardware acceleration, physical display, phone, SDK, font, DragonBones, performance or full texture acceptance.' };
const hash = sha256, pendingApiOperations = new Set();
function fault(error) { return { name: typeof error?.name === 'string' ? error.name : 'Unknown', message: typeof error?.message === 'string' ? error.message.slice(0, 16000) : 'Non-error rejection', stack: typeof error?.stack === 'string' ? error.stack.slice(0, 16000) : null }; }
function observe(promise) {
  // Settlement observation owns every started API promise; timeout does not cancel its work.
  if (!pendingApiOperations.has(promise)) {
    pendingApiOperations.add(promise);
    const settled = () => { pendingApiOperations.delete(promise); };
    promise.then(settled, settled);
  }
  return promise;
}
async function bounded(promise, deadline, label) {
  observe(promise); const remaining = Math.min(15000, deadline - Date.now()); if (remaining <= 0) throw Error(`INCOMPLETE:${label}:deadline`);
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`INCOMPLETE:${label}:timeout`)), remaining); })]); }
  finally { clearTimeout(timer); }
}
const save = (name, value) => writeFile(resolve(output, name), JSON.stringify(value, null, 2), { flag: 'wx' });
// Emergency direct exit records INCOMPLETE; it cannot prove browser-descendant retirement.
const hardTimer = setTimeout(() => {
  report.status = 'INCOMPLETE'; report.cleanupFailures.push({ name: 'HardDeadline', message: 'Selected verifier exceeded its fixed budget; cleanup is unproven' });
  report.lifecycle.pendingApiOperations = pendingApiOperations.size;
  try { writeFileSync(resolve(output, 'hard-abort.json'), JSON.stringify(report, null, 2), { flag: 'wx' }); } catch {}
  process.exit(1);
}, 89000);
let browser, server, context, browserCloseRequested = false;
const sockets = new Set(), identities = new Map(metadataInputs), served = new Map(), openPages = new Set(), acquisitions = [];
function acquire(promise, label, assign) {
  // Assign handles in the continuation even when the caller's bounded await has timed out.
  const record = { label, settled: false, promise: null };
  record.promise = observe(promise.then(value => { record.settled = true; assign(value); return value; },
    error => { record.settled = true; throw error; }));
  acquisitions.push(record); return record.promise;
}
const aliases = { '@egret/contracts': 'packages/contracts/dist/index.js', '@egret/runtime': 'packages/runtime/dist/index.js',
  '@egret/engine': 'packages/engine/dist/index.js', 'robust-predicates': 'packages/engine/node_modules/robust-predicates/index.js' };
const entryNames = ['packages/engine/dist/web/b1.js', 'packages/engine/dist/rendering/meshGeometry3D.js',
  'packages/engine/dist/rendering/matrix4.js', 'packages/engine/dist/web/webgpuMeshPass.js', 'packages/contracts/dist/ImageData2D.js'];
const descriptor = (path, body) => ({ path, bytes: body.length, sha256: hash(body) });
async function identity(path) {
  const absolute = await realpath(path); if (identities.has(absolute)) return identities.get(absolute);
  const body = await readFile(absolute); assert.ok(body.length <= 128 * 1024 * 1024); const value = descriptor(absolute, body);
  identities.set(absolute, value); return value;
}
function normalize(value) { return value.replaceAll('\\', '/'); }
function imported(source) {
  const names = [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\bfrom\s+)?['"]([^'"\r\n]+)['"]/g)].map(match => match[1]);
  names.push(...[...source.matchAll(/\bimport\s*\(\s*['"]([^'"\r\n]+)['"]\s*\)/g)].map(match => match[1])); return names;
}
function dependency(specifier, parent) {
  if (Object.hasOwn(aliases, specifier)) return aliases[specifier];
  assert.ok(specifier.startsWith('.'), `Unsupported emitted dependency ${specifier}`);
  const value = normalize(relative(repository, resolve(repository, dirname(parent), specifier)));
  assert.ok(!value.startsWith('../') && !isAbsolute(value) && value.endsWith('.js')); return value;
}
async function collect(name) {
  const url = '/' + name; if (served.has(url)) return;
  assert.ok(served.size < 128, 'Finite emitted closure exceeded');
  const path = resolve(repository, name), physical = await realpath(path);
  assert.ok(physical.startsWith(repository + sep), 'Selected dependency escaped repository');
  const body = await readFile(physical); assert.ok(body.length <= 1024 * 1024);
  served.set(url, { body, contentType: 'text/javascript', identity: descriptor(name, body) });
  const bound = await identity(physical); assert.equal(bound.bytes, body.length); assert.equal(bound.sha256, hash(body), 'Emitted bytes changed during capture');
  for (const child of imported(body.toString('utf8'))) await collect(dependency(child, name));
}
function shaderText(body) {
  const matches = [...body.toString('utf8').matchAll(/const MESH_SHADER = `([\s\S]*?)`;/g)]; assert.equal(matches.length, 1);
  assert.ok(!/[\\]|\$\{/.test(matches[0][1]), 'WGSL template escape requires a reviewed decoder');
  // JavaScript template values normalize line endings; no other decoding occurs.
  return matches[0][1].replace(/\r\n?/g, '\n');
}
function replaceOne(source, expression, alter) {
  const matches = [...source.matchAll(expression)]; assert.equal(matches.length, 1, 'Sensitivity patch must have exactly one target');
  const match = matches[0], changed = alter(match[0]); assert.notEqual(changed, match[0]);
  return { text: source.slice(0, match.index) + changed + source.slice(match.index + match[0].length), removed: match[0], inserted: changed };
}
async function prepareCopy(id) {
  const mesh = 'packages/engine/dist/web/webgpuMeshPass.js', host = 'packages/engine/dist/web/WebGPUHost.js';
  const target = ['N2', 'N3'].includes(id) ? host : mesh, original = served.get('/' + target).body;
  const source = original.toString('utf8'); let patch;
  if (id === 'N1') patch = replaceOne(source, /depthCompare: 'greater'/g, value => value.replace("'greater'", "'less'"));
  if (id === 'N2') patch = replaceOne(source, /const uniform = this\.ownedBuffer\(64, 64 \| 8, record, gate\);\r?\n\s*touchedQueue = true;\r?\n\s*this\.write\(uniform\.buffer, 0, draw\.uniform\);/g,
    value => value.replace('draw.uniform', 'p.scene.draws[0].uniform'));
  if (id === 'N3') patch = replaceOne(source, /for \(const draw of p\.draws\) \{\r?\n\s*if \(draw\.kind === 'rect'\)\r?\n\s*encodeWebGPURectangles/g,
    value => value.replace('of p.draws)', 'of [...p.draws].reverse())'));
  if (id === 'N4') patch = replaceOne(source, /const MESH_SHADER = `[\s\S]*?`;/g, value => value.slice(0, -2) + '\negret_b1_invalid_wgsl_token\n`;');
  if (id === 'N5') patch = replaceOne(source, /result\.clip = draw\.mvp \* vec4<f32>\(position, 1\.0\);/g,
    value => value + '\n    result.clip.w = abs(result.clip.w);');
  assert.ok(patch); const altered = Buffer.from(patch.text); const manifest = []; let changedFiles = 0;
  for (const [url, value] of [...served.entries()].filter(([url]) => url.startsWith('/packages/engine/')).sort()) {
    const name = url.slice(1), body = name === target ? altered : value.body;
    const file = resolve(output, 'copies', id, name); await mkdir(dirname(file), { recursive: true }); await writeFile(file, body, { flag: 'wx' });
    const current = descriptor(name, body); manifest.push({ ...current, originalSHA256: value.identity.sha256 });
    if (current.sha256 !== value.identity.sha256) { changedFiles++; assert.equal(name, target); }
    served.set(`/copy/${id}${url}`, { body, contentType: 'text/javascript', identity: current });
  }
  assert.equal(changedFiles, 1);
  const receipt = { id, scope: 'Actual bounded emitted-product mutation', target, original: descriptor(target, original), altered: descriptor(target, altered),
    patch: { removed: patch.removed, inserted: patch.inserted }, changedFiles, copiedFiles: manifest, originalsEdited: false,
    expectedShaderSHA256: hash(Buffer.from(shaderText(id === 'N2' || id === 'N3' ? served.get('/' + mesh).body : altered))) };
  report.patches.push(receipt); await save(`patch-${id}.json`, receipt); return receipt;
}
function expectedCompilerConsole(event, window) {
  if (event.kind !== 'console' || event.level !== 'error' || window.mode !== 'N4' || window.status !== 'EXPECTED_COMPILATION_FAILURE') return false;
  // Admit only explicitly recorded shader/pipeline validation diagnostics in N4.
  return /WGSL|CreateShaderModule|shader module.*invalid|ShaderModule.*invalid|CreateRenderPipeline/i.test(event.text)
    && /error|invalid|pars|compil|validation/i.test(event.text);
}
async function retainWindow(window) {
  for (const frame of window.frames) if (frame.readback) {
    const bytes = Buffer.from(frame.readback.bytes); assert.ok(bytes.length <= 1024 * 1024, 'Unexpected raw capture exceeded its finite cap');
    const file = `${window.mode}-${frame.name}.rgba`; await writeFile(resolve(output, file), bytes, { flag: 'wx' });
    frame.readback = { ...frame.readback, bytes: undefined, raw: descriptor(file, bytes) };
  }
  await save(`window-${window.mode}.json`, window);
}
try {
  for (const path of [process.execPath, fileURLToPath(import.meta.url), resolve(companionDirectory, 'fixture.mjs'), resolve(companionDirectory, 'oracle.mjs'),
    playwrightMetadataPath, resolve(modulePath, 'index.mjs'), coreMetadataPath, compilerMetadataPath,
    resolve(repository, 'package.json'), resolve(repository, 'pnpm-lock.yaml'), resolve(repository, 'tsconfig.json'),
    ...['engine', 'contracts', 'runtime'].map(name => resolve(repository, `packages/${name}/package.json`))]) await identity(path);
  for (const name of entryNames) await collect(name);
  const emitted = [...served.values()].reduce((sum, value) => sum + value.body.length, 0); assert.ok(emitted <= 4 * 1024 * 1024);
  // Bind matching first-party source files without scanning unrelated repository files.
  for (const url of served.keys()) {
    const name = url.slice(1); let source;
    if (name.startsWith('packages/engine/dist/')) {
      const tail = name.slice('packages/engine/dist/'.length).replace(/\.js$/, '.ts'); source = `packages/engine/${tail.includes('/') ? '' : 'src/'}${tail}`;
    } else if (/^packages\/(runtime|contracts)\/dist\//.test(name)) source = name.replace('/dist/', '/src/').replace(/\.js$/, '.ts');
    if (source) await identity(resolve(repository, source));
  }
  for (const name of ['packages/engine/node_modules/robust-predicates/package.json', 'packages/contracts/src/RenderFrame2D.ts']) await identity(resolve(repository, name));
  const meshSource = await readFile(resolve(repository, 'packages/engine/web/webgpuMeshPass.ts'));
  const baselineShader = shaderText(served.get('/packages/engine/dist/web/webgpuMeshPass.js').body);
  assert.equal(shaderText(meshSource), baselineShader, 'Source and emitted mesh shader differ');
  report.toolchain = { node: process.version, playwright: metadata.version, playwrightCore: coreMetadata.version,
    installedToolMetadata: { playwright: metadataInputs.get(await realpath(playwrightMetadataPath)),
      core: metadataInputs.get(await realpath(coreMetadataPath)) },
    typescript: '7.0.2', packageManagerPin: rootMetadata.packageManager, platform: process.platform, selectedChannel: 'msedge',
    browserExecutableIdentity: { status: 'UNBOUND', reason: 'No reliable exact channel-resolved executable identity was observed' },
    bundle: null, nativeModuleInput: 'exact frozen emitted ESM graph' };
  report.baselineShaderSHA256 = hash(Buffer.from(baselineShader));
  report.emittedModules = [...served.entries()].map(([url, value]) => ({ url, ...value.identity }));
  for (const value of NEGATIVES) await prepareCopy(value.id);
  for (const name of ['fixture.mjs', 'oracle.mjs']) {
    const body = await readFile(resolve(companionDirectory, name)); served.set('/' + name, { body, contentType: 'text/javascript', identity: descriptor(name, body) });
  }
  const html = Buffer.from(`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>B1 WebGPU verification</title><script type="importmap">${JSON.stringify({ imports: Object.fromEntries(Object.entries(aliases).map(([name, value]) => [name, '/' + value])) })}</script><script type="module">import * as fixture from '/fixture.mjs'; window.b1Fixture=fixture; window.fixtureReady=true;</script>`);
  served.set('/index.html', { body: html, contentType: 'text/html', identity: descriptor('index.html', html) });
  report.identitiesBefore = [...identities.values()]; await save('inputs.json', { original: report.identitiesBefore, emitted: report.emittedModules, html: descriptor('index.html', html) });
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname, value = served.get(pathname);
    const observed = { method: request.method, pathname, status: value && request.method === 'GET' ? 200 : 404, bytes: value?.body.length ?? 0, sha256: value?.identity.sha256 ?? null };
    if (report.requests.length >= 512) { report.requestOverflow = true; response.writeHead(429); response.end(); return; }
    report.requests.push(observed);
    if (!value || request.method !== 'GET') { response.writeHead(404); response.end('Unselected resource'); return; }
    response.writeHead(200, { 'content-type': value.contentType, 'cache-control': 'no-store' }); response.end(value.body);
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('error', error => { report.serverFailure ??= fault(error); });
  await bounded(observe(new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); })), operationDeadline, 'server-start');
  const origin = `http://127.0.0.1:${server.address().port}`; report.origin = origin;
  const playwright = await bounded(observe(import(pathToFileURL(resolve(modulePath, 'index.mjs')).href)), operationDeadline, 'tool-import');
  await bounded(acquire(playwright.chromium.launch({ channel: 'msedge', headless: true }), 'browser-launch', value => {
    browser = value;
    browser.on('disconnected', () => { if (!browserCloseRequested) report.unexpectedBrowserDisconnect = true; });
  }), operationDeadline, 'browser-launch');
  report.browserVersion = browser.version();
  await bounded(acquire(browser.newContext({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 }),
    'context-start', value => { context = value; }), operationDeadline, 'context-start');
  for (const mode of ['baseline', ...NEGATIVES.map(value => value.id)]) {
    const page = await bounded(acquire(context.newPage(), `page-start-${mode}`, value => { openPages.add(value); }),
      operationDeadline, `page-start-${mode}`); const events = [];
    const record = value => { if (events.length >= 128) { report.browserEventOverflow = true; return; } events.push({ mode, ...value }); };
    page.on('pageerror', error => record({ kind: 'pageerror', text: error.message.slice(0, 16000) }));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') record({ kind: 'console', level: message.type(), text: message.text().slice(0, 16000), location: message.location() }); });
    page.on('requestfailed', request => record({ kind: 'requestfailed', text: request.failure()?.errorText ?? 'unknown', url: request.url() }));
    page.on('response', response => { if (response.status() >= 400) record({ kind: 'HTTP', text: `HTTP ${response.status()}`, url: response.url() }); });
    let window;
    try {
      await bounded(observe(page.goto(origin + '/index.html')), operationDeadline, 'page-start');
      await bounded(observe(page.waitForFunction(() => window.fixtureReady === true)), operationDeadline, 'fixture-ready');
      window = await bounded(observe(page.evaluate(value => window.b1Fixture.runWindow(value), { mode, deadline: operationDeadline })), operationDeadline, `native-${mode}`);
      // Preserve delivered raw bytes and failure metadata before inspecting identity.
      await retainWindow(window); report.windows.push(window);
      const expectedShader = mode === 'baseline' ? report.baselineShaderSHA256 : report.patches.find(value => value.id === mode).expectedShaderSHA256;
      if (window.compilation) assert.equal(window.compilation.shaderSHA256, expectedShader, 'Native compiler shader identity differs from served bytes');
      for (const event of events) {
        event.expected = event.kind === 'console' && event.level === 'warning' ? false : expectedCompilerConsole(event, window);
        if (event.kind !== 'console' || event.level === 'error') assert.ok(event.expected, `Unexpected ${event.kind} in ${mode}: ${event.text}`);
      }
      if (window.status === 'UNSUPPORTED') {
        assert.equal(window.cleanup.failures.length, 0); assert.equal(window.uncaptured.length, 0);
        if (window.deviceAcquired) { assert.equal(window.cleanup.deviceDestroyed, true); assert.equal(window.cleanup.lossSettled, true); }
        if (mode !== 'baseline') throw Error('INCOMPLETE:capability changed after successful baseline');
        report.status = 'UNSUPPORTED'; break;
      }
      assert.ok(window.cleanup.failures.length === 0 && window.uncaptured.length === 0, 'Native API cleanup failed');
      assert.equal(window.cleanup.hostClosed, true); assert.equal(window.cleanup.hostSafe, true); assert.equal(window.cleanup.deviceDestroyed, true); assert.equal(window.cleanup.lossSettled, true);
      if (mode === 'baseline') { assert.equal(window.status, 'PASSED'); assert.equal(window.frames.length, 7); assert.equal(window.frames.reduce((sum, value) => sum + value.checks.comparisons, 0), 8214); }
      else { assert.equal(window.status, mode === 'N4' ? 'EXPECTED_COMPILATION_FAILURE' : 'EXPECTED_PIXEL_FAILURE'); assert.equal(window.frames.length, mode === 'N4' ? 0 : 1); }
    } finally {
      try { await bounded(observe(page.close().then(() => { openPages.delete(page); })), closeDeadline, `page-close-${mode}`); }
      catch (error) { report.cleanupFailures.push(fault(error)); }
      // Recheck after page closure so late error events cannot evade the gate.
      for (const event of events) {
        event.expected = window ? expectedCompilerConsole(event, window) : false;
        if ((event.kind !== 'console' || event.level === 'error') && !event.expected) report.unexpectedBrowserEvent = true;
      }
      report.browserEvents.push(...events);
    }
  }
  if (report.requestOverflow || report.browserEventOverflow) throw Error('INCOMPLETE:bounded observation quota exceeded');
  assert.equal(report.unexpectedBrowserEvent ?? false, false, 'Unexpected browser event after closure');
  if (report.status !== 'UNSUPPORTED') { assert.equal(report.windows.length, 6); report.status = 'PASS'; }
} catch (error) {
  report.failure = fault(error); report.status = /INCOMPLETE:|browserType\.launch|Executable doesn't exist|Target .* closed|page\.goto/.test(error.message ?? '') ? 'INCOMPLETE' : 'FAIL';
} finally {
  // Drain late acquisitions before deciding which handles this collector must close.
  for (const record of acquisitions) if (!record.settled) {
    try { await bounded(record.promise, closeDeadline, `late-${record.label}`); }
    catch (error) { report.cleanupFailures.push(fault(error)); }
  }
  for (const page of [...openPages]) {
    try { await bounded(observe(page.close().then(() => { openPages.delete(page); })), closeDeadline, 'remaining-page-close'); }
    catch (error) { report.cleanupFailures.push(fault(error)); }
  }
  try { if (context) await bounded(observe(context.close().then(() => {
    report.lifecycle.contextClosed = true; openPages.clear();
  })), closeDeadline, 'context-close'); } catch (error) { report.cleanupFailures.push(fault(error)); }
  try { if (browser) {
    browserCloseRequested = true;
    await bounded(observe(browser.close().then(() => { report.lifecycle.browserClosed = true; })), closeDeadline, 'browser-close');
  } } catch (error) { report.cleanupFailures.push(fault(error)); }
  try { if (server) { server.closeAllConnections(); for (const socket of sockets) socket.destroy(); await bounded(observe(new Promise((done, reject) => server.close(error => error ? reject(error) : done()))), closeDeadline, 'server-close'); report.lifecycle.serverClosed = sockets.size === 0; } } catch (error) { report.cleanupFailures.push(fault(error)); }
  try {
    const peers = [...pendingApiOperations];
    if (peers.length) await bounded(observe(Promise.allSettled(peers)), closeDeadline, 'collector-api-drain');
  } catch (error) { report.cleanupFailures.push(fault(error)); }
  if (report.serverFailure) report.cleanupFailures.push({ name: 'ServerFailure', message: report.serverFailure.message });
  if (report.unexpectedBrowserDisconnect) report.cleanupFailures.push({ name: 'BrowserDisconnected', message: 'Browser disconnected before collector-requested close' });
  report.lifecycle.pendingApiOperations = pendingApiOperations.size;
  report.lifecycle.unsettledAcquisitions = acquisitions.filter(value => !value.settled).map(value => value.label);
  report.lifecycle.standaloneCleanupObserved = pendingApiOperations.size === 0 && openPages.size === 0
    && report.lifecycle.unsettledAcquisitions.length === 0 && (!context || report.lifecycle.contextClosed)
    && (!browser || report.lifecycle.browserClosed) && (!server || report.lifecycle.serverClosed);
  const after = [];
  try { for (const [path, before] of identities) { const body = await readFile(path); const current = descriptor(path, body); after.push(current); assert.deepEqual(current, before, 'Original source/tool identity changed'); } report.lifecycle.identitiesStable = true; }
  catch (error) { report.cleanupFailures.push(fault(error)); }
  report.identitiesAfter = after;
  if (report.cleanupFailures.length || !report.lifecycle.identitiesStable || !report.lifecycle.standaloneCleanupObserved) report.status = 'INCOMPLETE';
  report.counts = { positiveFrames: report.windows.find(value => value.mode === 'baseline')?.frames.length ?? 0,
    counterexamples: report.windows.filter(value => value.mode !== 'baseline' && ['EXPECTED_PIXEL_FAILURE', 'EXPECTED_COMPILATION_FAILURE'].includes(value.status)).length,
    submittedFrames: report.windows.reduce((sum, value) => sum + value.frames.filter(frame => frame.rendered).length, 0), maximumSubmittedFrames: 11 };
  if (report.counts.submittedFrames > 11) { report.status = 'FAIL'; report.cleanupFailures.push({ message: 'Finite frame budget exceeded' }); }
  if (report.status === 'PASS' && (report.counts.positiveFrames !== 7 || report.counts.counterexamples !== 5 || report.counts.submittedFrames !== 11)) {
    report.status = 'FAIL'; report.cleanupFailures.push({ message: 'Complete seven-positive/five-counterexample receipt missing' });
  }
  report.elapsedMs = Date.now() - startedAt; report.exitCode = report.status === 'PASS' ? 0 : report.status === 'UNSUPPORTED' ? 2 : 1;
  try { await save('requests.json', report.requests); report.lifecycle.rawSaved = true; await save('result.json', report); }
  catch (error) { report.status = 'INCOMPLETE'; report.exitCode = 1; console.error(JSON.stringify({ evidenceSaveFailure: fault(error) })); }
  // Keep the emergency direct-exit timer if API cleanup remains unproven; never report PASS.
  if (report.lifecycle.standaloneCleanupObserved) clearTimeout(hardTimer);
  process.exitCode = report.exitCode;
  console.log(JSON.stringify({ status: report.status, exitCode: report.exitCode, counts: report.counts, lifecycle: report.lifecycle, failure: report.failure }));
}
}
await main();
