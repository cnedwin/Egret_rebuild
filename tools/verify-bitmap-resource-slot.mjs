// SPDX-License-Identifier: Apache-2.0
// Original bounded collector candidate. It serves pinned bytes and never builds.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const args = new Map();
let snapshotOnly = false;
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (key === '--snapshot-only' && !snapshotOnly) { snapshotOnly = true; continue; }
  if (!['--repository', '--application-root', '--playwright', '--channel', '--snapshot', '--output'].includes(key)
    || args.has(key) || !process.argv[index + 1]) throw new Error('Unique named collector arguments required');
  args.set(key, process.argv[++index]);
}
for (const key of ['--repository', '--snapshot']) if (!path.isAbsolute(args.get(key) ?? '')) throw new Error('Absolute ' + key + ' required');
if ((args.get('--channel') ?? 'msedge') !== 'msedge') throw new Error('Only the declared default Edge channel is admitted');
const repository = fs.realpathSync(args.get('--repository'));
const applicationRoot = fs.realpathSync(args.get('--application-root') ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
// Existing builtin bootstrap: authenticate owner, spelling and raw bytes before
// evaluating the shared helper. A dependency alias has separate authority below.
const physicalAPI = process.platform === 'win32' ? path.win32 : path.posix;
const repositoryStat = fs.lstatSync(repository);
if (!repositoryStat.isDirectory() || repositoryStat.isSymbolicLink()
  || physicalAPI.relative(repository, fs.realpathSync(repository)) !== '') throw new Error('Canonical physical SDK owner required');
const helperRelative = 'tools/lib/file-identity.mjs';
let helperPath = repository;
for (const [index, part] of helperRelative.split('/').entries()) {
  if (!fs.readdirSync(helperPath).includes(part)) throw new Error('Helper owner-relative spelling mismatch');
  helperPath = physicalAPI.join(helperPath, part);
  const stat = fs.lstatSync(helperPath);
  if (stat.isSymbolicLink() || (index < 2 ? !stat.isDirectory() : !stat.isFile())) throw new Error('Helper owner component differs');
}
if (physicalAPI.relative(repository, fs.realpathSync(helperPath)).split(physicalAPI.sep).join('/') !== helperRelative) throw new Error('Helper has another physical owner');
const helperURL = pathToFileURL(helperPath);
if (physicalAPI.relative(helperPath, fileURLToPath(helperURL)) !== '') throw new Error('Helper URL does not round-trip');
const helperBytes = fs.readFileSync(helperPath);
const HELPER_SHA256 = '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569';
if (helperBytes.length !== 5065 || hash(helperBytes) !== HELPER_SHA256) throw new Error('File-identity bootstrap drift before dynamic import');
const helperBootstrap = { ownerRoot: repository, path: helperRelative, bytes: 5065, sha256: HELPER_SHA256, physicalOwnerVerified: true, urlRoundTripVerified: true, bootstrap: 'node-builtins-before-dynamic-import' };
const identity = await import(helperURL.href);
identity.fingerprintFile(repository, 'tools/lib/file-identity.mjs');

const within = (owner, file) => {
  if (identity.samePhysicalPath(owner, file)) return true;
  try { identity.ownerRelativePath(owner, file); return true; } catch { return false; }
};
function externalNewFile(file) {
  if (!path.isAbsolute(file)) throw new Error('Absolute output filename required');
  const parent = fs.realpathSync(path.dirname(file));
  const target = path.join(parent, path.basename(file));
  if ([repository, applicationRoot].some(owner => within(owner, target))) throw new Error('Output belongs to an input owner');
  if (fs.existsSync(target)) throw new Error('Output already exists: ' + target);
  return target;
}
const owners = new Map([['sdk', repository], ['application', applicationRoot]]);
const inventory = new Map();
function pinned(owner, relative, role) {
  const root = owners.get(owner);
  identity.logicalPath(relative);
  const pin = identity.fingerprintFile(root, relative);
  const bytes = fs.readFileSync(path.join(root, relative));
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw new Error('Input changed during read');
  const record = { owner, ...pin, role };
  inventory.set(owner + ':' + relative, record);
  return { pin: record, bytes };
}

// Restricted literal-module reader: comments, strings, regexes and templates are
// skipped independently. Unsupported dynamic imports fail before serving anything.
function moduleImports(source) {
  const tokens = [];
  let at = 0;
  while (at < source.length) {
    const char = source[at];
    if (/\s/.test(char)) { at++; continue; }
    if (source.slice(at, at + 2) === '//') { const end = source.indexOf('\n', at + 2); at = end < 0 ? source.length : end; continue; }
    if (source.slice(at, at + 2) === '/*') { const end = source.indexOf('*/', at + 2); if (end < 0) throw new Error('Unterminated comment'); at = end + 2; continue; }
    if (char === '"' || char === "'") {
      const quote = char, start = ++at;
      while (at < source.length && source[at] !== quote) { if (source[at] === '\\') at++; at++; }
      if (at >= source.length) throw new Error('Unterminated string');
      tokens.push({ kind: 'string', value: source.slice(start, at++) }); continue;
    }
    if (char === '`') {
      const start = ++at;
      while (at < source.length && source[at] !== '`') { if (source[at] === '\\') at++; at++; }
      if (at >= source.length || /\bimport\b/.test(source.slice(start, at))) throw new Error('Unsupported template import syntax');
      at++; tokens.push({ kind: 'template', value: '' }); continue;
    }
    if (char === '/' && ['(', '=', ':', ',', 'return', '[', '!', '?', '|', '&'].includes(tokens.at(-1)?.value)) {
      at++; let bracket = false, finished = false;
      while (at < source.length) {
        const next = source[at++];
        if (next === '\\') { at++; continue; }
        if (next === '[') bracket = true;
        if (next === ']') bracket = false;
        if (next === '/' && !bracket) { finished = true; break; }
      }
      if (!finished) throw new Error('Unterminated regular expression');
      while (/[A-Za-z]/.test(source[at] ?? '')) at++;
      tokens.push({ kind: 'regex', value: '' }); continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = at++;
      while (/[A-Za-z0-9_$]/.test(source[at] ?? '')) at++;
      tokens.push({ kind: 'word', value: source.slice(start, at) }); continue;
    }
    tokens.push({ kind: 'punctuation', value: char }); at++;
  }
  const result = [];
  function literal(token) {
    if (token?.kind !== 'string' || !token.value || /[\\\s%?:\0]/.test(token.value)) throw new Error('Only simple literal imports are admitted');
    result.push(token.value);
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind !== 'word') continue;
    if (token.value === 'import') {
      const next = tokens[index + 1];
      if (next?.value === '.') continue;
      if (next?.value === '(') {
        literal(tokens[index + 2]);
        if (tokens[index + 3]?.value !== ')') throw new Error('Nonliteral/options dynamic import refused');
      } else if (next?.kind === 'string') literal(next);
      else {
        let end = index + 1;
        while (end < tokens.length && !['from', ';'].includes(tokens[end].value)) end++;
        if (tokens[end]?.value !== 'from') throw new Error('Unresolved static import');
        literal(tokens[end + 1]);
      }
    } else if (token.value === 'export' && ['{', '*'].includes(tokens[index + 1]?.value)) {
      let end = index + 1;
      while (end < tokens.length && !['from', ';'].includes(tokens[end].value)) end++;
      if (tokens[end]?.value === 'from') literal(tokens[end + 1]);
    }
  }
  return result;
}

const applicationAliases = new Set(['@egret/engine', '@egret/engine/web', '@egret/engine/webgpu', '@egret/engine/web/input']);
const sdkAliases = new Map(Object.entries({
  '@egret/engine': ['sdk', 'packages/engine/dist/index.js'],
  '@egret/engine/web': ['sdk', 'packages/engine/dist/web/index.js'],
  '@egret/engine/webgpu': ['sdk', 'packages/engine/dist/web/webgpu.js'],
  '@egret/engine/web/input': ['sdk', 'packages/engine/dist/web/input.js'],
  '@egret/runtime': ['sdk', 'packages/runtime/dist/index.js'],
  '@egret/contracts': ['sdk', 'packages/contracts/dist/index.js'],
  '#egret-mouse-input': ['sdk', 'packages/engine/dist/mouseInput.js'],
  '#egret-textured-frame-state': ['sdk', 'packages/engine/dist/internal/texturedFrameState.js'],
}));
const enginePackage = pinned('sdk', 'packages/engine/package.json', 'declared-engine-dependency-contract');
const engineMetadata = JSON.parse(enginePackage.bytes);
if (engineMetadata.name !== '@egret/engine' || engineMetadata.dependencies?.['robust-predicates'] !== '3.0.3') throw new Error('Unselected Engine foundational dependency declaration');
const foundationAliasRelative = 'packages/engine/node_modules/robust-predicates';
let foundationAlias = repository;
for (const [index, part] of foundationAliasRelative.split('/').entries()) {
  if (!fs.readdirSync(foundationAlias).includes(part)) throw new Error('Declared dependency alias spelling differs');
  foundationAlias = physicalAPI.join(foundationAlias, part);
  const stat = fs.lstatSync(foundationAlias);
  // Only the final declared package alias may resolve to a separate physical owner.
  if (index < 3 && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('Dependency alias parent differs');
}
const foundationalRoot = fs.realpathSync(foundationAlias);
const foundationStat = fs.lstatSync(foundationalRoot);
if (!foundationStat.isDirectory() || foundationStat.isSymbolicLink()
  || physicalAPI.relative(foundationalRoot, fs.realpathSync(foundationalRoot)) !== '') throw new Error('Canonical physical foundational owner required');
owners.set('foundation', foundationalRoot);
const foundationPackage = pinned('foundation', 'package.json', 'declared-foundational-package');
const foundationMetadata = JSON.parse(foundationPackage.bytes);
if (foundationMetadata.name !== 'robust-predicates' || foundationMetadata.version !== '3.0.3') throw new Error('Unselected robust-predicates identity');
const foundationAdmission = { declaredBy: 'sdk:packages/engine/package.json', alias: foundationAliasRelative, physicalOwner: foundationalRoot, name: foundationMetadata.name, version: foundationMetadata.version };
pinned('foundation', 'LICENSE', 'original-dependency-license');
sdkAliases.set('robust-predicates', ['foundation', 'index.js']);
const modules = new Map(), routes = new Map();
let moduleBytes = 0;
function routeFor(owner, relative) { return '/m/' + owner + '/' + relative.split('/').map(encodeURIComponent).join('/'); }
function visit(owner, relative) {
  identity.logicalPath(relative);
  const key = owner + ':' + relative;
  if (modules.has(key)) return modules.get(key);
  if (modules.size >= 192 || !relative.endsWith('.js')) throw new Error('Emitted-module count/format refused');
  const input = pinned(owner, relative, 'original-browser-module'); moduleBytes += input.bytes.length;
  if (moduleBytes > 8_388_608) throw new Error('Browser module byte budget exceeded');
  const record = { owner, path: relative, route: routeFor(owner, relative), bytes: input.pin.bytes, sha256: input.pin.sha256, edges: [] };
  modules.set(key, record);
  if (owner === 'sdk') {
    const match = /^packages\/(engine|runtime|contracts)\/dist\/(.+)\.js$/.exec(relative);
    if (!match) throw new Error('Unselected first-party module location');
    const tail = match[1] === 'engine' && /^(web|rendering)\//.test(match[2]) ? match[2] : 'src/' + match[2];
    pinned('sdk', `packages/${match[1]}/${tail}.ts`, 'first-party-source-counterpart');
  }
  for (const specifier of moduleImports(new TextDecoder('utf-8', { fatal: true }).decode(input.bytes))) {
    let next;
    if (/^\.\.?\//.test(specifier)) {
      const file = path.resolve(owners.get(owner), path.dirname(relative), specifier);
      next = [owner, identity.ownerRelativePath(owners.get(owner), file)];
    } else next = sdkAliases.get(specifier);
    if (!next) throw new Error('Unselected bare import: ' + specifier);
    const dependency = visit(...next); record.edges.push({ specifier, target: next.join(':'), route: dependency.route });
  }
  routes.set(record.route, { bytes: input.bytes, contentType: 'text/javascript; charset=utf-8' });
  return record;
}
const seedNames = {
  canvas: ['@egret/engine', '@egret/engine/web', '@egret/engine/web/input'],
  webgpu: ['@egret/engine', '@egret/engine/webgpu', '@egret/engine/web/input'],
};
const closures = {};
for (const [backend, names] of Object.entries(seedNames)) {
  const found = new Set();
  function walk(record) { const key = record.owner + ':' + record.path; if (found.has(key)) return; found.add(key); for (const edge of record.edges) walk(modules.get(edge.target)); }
  names.forEach(name => walk(visit(...sdkAliases.get(name)))); closures[backend] = [...found].sort();
}
if (closures.canvas.some(key => /WebGPUHost|webgpu[^/]*\.js|\/b1\.js|foundation:/.test(key))) throw new Error('Canvas closure crossed a GPU/foundational boundary');
for (const name of ['packages/engine/package.json', 'packages/runtime/package.json', 'packages/contracts/package.json', 'tools/lib/file-identity.mjs']) pinned('sdk', name, 'package-or-bootstrap');
const exampleNames = ['index.html', 'main.mjs', 'README.md', 'README.zh-CN.md'];
const appInputs = new Map(exampleNames.map(name => [name, pinned('application', 'examples/bitmap-resource-slot/' + name, 'original-example')]));
pinned('application', 'tools/verify-bitmap-resource-slot.mjs', 'original-verifier');
const applicationImports = moduleImports(appInputs.get('main.mjs').bytes.toString('utf8'));
for (const specifier of applicationImports) if (!applicationAliases.has(specifier)) throw new Error('Unexpected nonpublic application import: ' + specifier);
const originalHTML = appInputs.get('index.html').bytes.toString('utf8');
const scripts = [...originalHTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
const importBlocks = scripts.filter(match => /\btype\s*=\s*(?:"importmap"|'importmap'|importmap)(?:\s|$)/i.test(match[1]));
if (importBlocks.length !== 1 || importBlocks[0][1] !== ' type="importmap"') throw new Error('Exactly one canonical authored import-map block required');
const expectedAuthoredImports = {
  '@egret/engine': '../../packages/engine/dist/index.js',
  '@egret/engine/web': '../../packages/engine/dist/web/index.js',
  '@egret/engine/webgpu': '../../packages/engine/dist/web/webgpu.js',
  '@egret/engine/web/input': '../../packages/engine/dist/web/input.js',
  '@egret/runtime': '../../packages/runtime/dist/index.js',
  '@egret/contracts': '../../packages/contracts/dist/index.js',
  '#egret-mouse-input': '../../packages/engine/dist/mouseInput.js',
  '#egret-textured-frame-state': '../../packages/engine/dist/internal/texturedFrameState.js',
  'robust-predicates': '../../packages/engine/node_modules/robust-predicates/index.js',
};
const authoredImportMap = JSON.parse(importBlocks[0][2]);
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
if (!exactKeys(authoredImportMap, ['imports']) || !exactKeys(authoredImportMap.imports, Object.keys(expectedAuthoredImports))) throw new Error('Authored import-map keys or scopes differ');
for (const [name, relative] of Object.entries(expectedAuthoredImports)) if (authoredImportMap.imports[name] !== relative) throw new Error('Authored import-map target differs: ' + name);
// Known keys/values contain no whitespace or escapes. This also refuses duplicate
// JSON keys and alternate escaped spellings before any mapping is projected.
if (importBlocks[0][2].replace(/\s/g, '') !== JSON.stringify(authoredImportMap)) throw new Error('Authored import-map JSON spelling or duplicate key differs');
const importMap = { imports: Object.fromEntries(Object.keys(authoredImportMap.imports).map(name => {
  const [owner, relative] = sdkAliases.get(name); return [name, routeFor(owner, relative)];
})) };
const servedHTML = originalHTML.replace(importBlocks[0][0], '<script type="importmap">' + JSON.stringify(importMap) + '</script>');
for (const backend of ['canvas', 'webgpu']) routes.set('/example/index.html?backend=' + backend, { bytes: Buffer.from(servedHTML), contentType: 'text/html; charset=utf-8' });
routes.set('/example/main.mjs', { bytes: appInputs.get('main.mjs').bytes, contentType: 'text/javascript; charset=utf-8' });
routes.set('/favicon.ico', { bytes: Buffer.alloc(0), contentType: 'image/x-icon' });
const currentSnapshot = { schemaVersion: 1, kind: 'BRS_NATIVE_INPUT_CLOSURE', owners: Object.fromEntries(owners), helperBootstrap, foundationAdmission, applicationImports, authoredImportMap, inventory: [...inventory.values()].sort((a, b) => (a.owner + ':' + a.path).localeCompare(b.owner + ':' + b.path)), modules: [...modules.values()], closures, servedImportMap: importMap, servedHTMLSHA256: hash(Buffer.from(servedHTML)), moduleBytes };
if (snapshotOnly) {
  const destination = externalNewFile(args.get('--snapshot'));
  fs.writeFileSync(destination, JSON.stringify(currentSnapshot, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'SOURCE_SNAPSHOT_ONLY_NO_BROWSER', path: destination, bytes: fs.statSync(destination).size, sha256: hash(fs.readFileSync(destination)), modules: modules.size }));
  process.exit(0);
}
const expectedSnapshot = fs.readFileSync(args.get('--snapshot'));
if (JSON.stringify(JSON.parse(expectedSnapshot)) !== JSON.stringify(currentSnapshot)) throw new Error('Reviewed standalone source snapshot does not match current native closure');
for (const key of ['--playwright', '--output']) if (!path.isAbsolute(args.get(key) ?? '')) throw new Error('Absolute ' + key + ' required');
const output = externalNewFile(args.get('--output')); fs.mkdirSync(output);
const playwrightRoot = fs.realpathSync(args.get('--playwright'));
const playwrightPackage = identity.fingerprintFile(playwrightRoot, 'package.json');
const playwrightMetadata = JSON.parse(fs.readFileSync(path.join(playwrightRoot, 'package.json')));
if (playwrightMetadata.name !== 'playwright' || playwrightMetadata.version !== '1.62.1') throw new Error('Pinned playwright package 1.62.1 required');
const playwrightEntry = identity.fingerprintFile(playwrightRoot, 'index.mjs');
const playwright = await import(pathToFileURL(path.join(playwrightRoot, 'index.mjs')).href);
const report = { schemaVersion: 1, runId: randomUUID(), status: 'RUNNING', snapshot: { path: args.get('--snapshot'), bytes: expectedSnapshot.length, sha256: hash(expectedSnapshot) }, environment: { node: process.version, channel: 'msedge', extraLaunchFlags: [], playwrightName: playwrightMetadata.name, playwrightVersion: '1.62.1', playwrightPackage, playwrightEntry, viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 }, pixelAcceptance: { points: 6, tolerance: 0, fullRGBAArtifactsRetained: true, allPixelCorrectnessClaim: false, screenshotsAncillary: true }, runs: [], failures: [], retirementFailures: [] };
const pending = new Set(), resources = [];
async function bounded(promise, label, milliseconds = 15000) {
  const task = Promise.resolve(promise); pending.add(task); void task.then(() => pending.delete(task), () => pending.delete(task));
  let timer;
  try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Deadline: ' + label)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function acquire(label, create, close) {
  const resource = { label, promise: Promise.resolve().then(create), close, retired: false }; resources.push(resource);
  return bounded(resource.promise, 'acquire ' + label);
}
async function retire(resource) {
  resource.retirement ??= resource.promise.then(value => resource.close(value), () => {}).then(() => { resource.retired = true; });
  try { await bounded(resource.retirement, 'retire ' + resource.label, 10000); }
  catch (cause) { report.retirementFailures.push({ label: resource.label, message: String(cause) }); }
}
const POINTS = [[10, 4], [12, 4], [10, 6], [14, 4], [10, 8], [4, 18]];
const RED = [255, 0, 0, 255], GREEN = [0, 255, 0, 255], BLUE = [0, 0, 255, 255], CLEAR = [0, 0, 0, 0], GRAY = [128, 128, 128, 255];
const COLORS = { A: [RED, CLEAR, RED, CLEAR, CLEAR, GRAY], B: [GREEN, GREEN, CLEAR, CLEAR, CLEAR, GRAY], C: [BLUE, CLEAR, BLUE, CLEAR, CLEAR, GRAY], empty: [CLEAR, CLEAR, CLEAR, CLEAR, CLEAR, GRAY] };
const GEOMETRY = {
  A: { dimensions: [1, 2], crop: { x: 1, y: 0, width: 1, height: 2 } },
  B: { dimensions: [3, 1], crop: { x: 0, y: 0, width: 3, height: 1 } },
  C: { dimensions: [1, 3], crop: { x: 0, y: 0, width: 1, height: 3 } },
  empty: { dimensions: [0, 0], crop: null },
};
let origin;
async function run(browser, backend, kind) {
  const context = await acquire(backend + '/' + kind, () => browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 }), value => value.close());
  const contextResource = resources.at(-1), page = await context.newPage();
  const result = { backend, kind, mainCaseCredit: kind === 'ordinary', rawReadbacks: [], checkpoints: [], console: [], pageErrors: [], requestedSDKRoutes: [], mismatches: [], completedSchedule: false };
  report.runs.push(result);
  page.on('pageerror', error => result.pageErrors.push(String(error)));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) result.console.push({ type: message.type(), text: message.text() }); });
  page.on('request', request => { const url = new URL(request.url()); if (url.origin === origin && url.pathname.slice(0, 3) === '/m/') result.requestedSDKRoutes.push(url.pathname); });
  const call = (method, ...values) => bounded(page.evaluate(({ method, values }) => window.bitmapResourceExample[method](...values), { method, values }), backend + '/' + kind + '/' + method);
  const click = async (x, y) => {
    const bounds = await page.locator('#scene').boundingBox(); if (!bounds) throw new Error('Canvas bounds unavailable');
    await bounded(page.mouse.click(bounds.x + (x + 0.5) * bounds.width / 32, bounds.y + (y + 0.5) * bounds.height / 24), 'native click');
  };
  const retainReadback = async (label, role) => {
    const readback = await call('readback');
    if (!readback || JSON.stringify(Object.keys(readback).sort()) !== '["bytes","height","label","width"]'
      || typeof readback.label !== 'string' || !Number.isSafeInteger(readback.width) || !Number.isSafeInteger(readback.height)
      || !Array.isArray(readback.bytes) || readback.bytes.length > 8_388_608
      || readback.bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Exact original RGBA readback required: ' + label);
    const bytes = Buffer.from(readback.bytes);
    const filename = backend + '-' + kind + '-' + String(result.rawReadbacks.length).padStart(2, '0') + '-' + label + '.rgba';
    // Retain every original byte before lifecycle, geometry or color assertions.
    fs.writeFileSync(path.join(output, filename), bytes, { flag: 'wx' });
    const artifact = { label: readback.label, requestedLabel: label, role, width: readback.width, height: readback.height, filename, bytes: bytes.length, sha256: hash(bytes) };
    result.rawReadbacks.push(artifact);
    if (readback.label !== label || readback.width !== 32 || readback.height !== 24 || bytes.length !== 32 * 24 * 4) throw new Error('Retained RGBA label/dimensions differ: ' + label);
    const saved = fs.readFileSync(path.join(output, filename));
    if (saved.length !== artifact.bytes || hash(saved) !== artifact.sha256) throw new Error('Saved original RGBA drift: ' + filename);
    // Derive offsets in Node from the saved original bytes, never app.samples().
    const samples = POINTS.map(([x, y]) => {
      const offset = (y * artifact.width + x) * 4;
      return { point: [x, y], rgba: Array.from(saved.subarray(offset, offset + 4)) };
    });
    return { raw: artifact, samples };
  };
  const checkpoint = async (label, color, slotState) => {
    const view = await call('checkpoint', label);
    const observed = await retainReadback(label, 'checkpoint');
    const controls = await bounded(page.evaluate(() => Object.fromEntries(['finish', 'fail', 'cancel', 'dispose', 'recreate', 'close'].map(id => [id, document.querySelector('#' + id).disabled]))), 'read application control states');
    result.checkpoints.push({ label, color, view, controls, ...observed });
    if (view.slotState !== slotState || view.pendingReadbacks !== 0 || view.errors.length || view.diagnostics.length) throw new Error('Invalid checkpoint lifecycle ' + label);
    if (JSON.stringify(view.dimensions) !== JSON.stringify(GEOMETRY[color].dimensions) || JSON.stringify(view.crop) !== JSON.stringify(GEOMETRY[color].crop)) throw new Error('Wrong committed geometry/crop ' + label);
    const expectedButtonState = ['conflicted', 'disposed'].includes(slotState) ? 'disabled' : 'up';
    if (view.buttonStates.length !== 2 || view.buttonStates.some(value => value !== expectedButtonState)) throw new Error('Independent Button admission state differs');
    const expectedControls = { finish: slotState !== 'pending', fail: slotState !== 'pending', cancel: slotState !== 'pending', dispose: slotState === 'disposed', recreate: !['conflicted', 'disposed'].includes(slotState), close: false };
    if (JSON.stringify(controls) !== JSON.stringify(expectedControls)) throw new Error('Application control admission differs: ' + label);
    if (view.selected !== (label === 'startup' ? null : 'outfit-target')) throw new Error('Selection lost at ' + label);
  };
  try {
    await bounded(page.goto(origin + '/example/index.html?backend=' + backend, { waitUntil: 'load' }), 'page startup');
    await bounded(page.waitForFunction(() => !!window.bitmapResourceExample), 'application published');
    result.startup = await bounded(page.evaluate(() => window.bitmapResourceExample.ready), 'healthy startup barrier');
    result.startupReadback = await retainReadback('healthy-startup', 'healthy-startup-barrier');
    if (result.startup.state !== 'ready' || result.startup.pendingReadbacks !== 0 || (backend === 'webgpu' && (result.startup.readbacks.length !== 1 || result.startup.readbacks[0].status !== 'fulfilled'))) throw new Error('Startup readback barrier failed');
    await checkpoint('startup', 'A', 'idle');
    await click(11, 5); await click(15, 5); await click(11, 8);
    if ((await call('inspect')).targetActivations !== 1) throw new Error('Clipped input reached target');
    await click(4, 18); await checkpoint('pending-B', 'A', 'pending');
    await click(11, 5);
    await call('settle', 1, 'reject'); await call('settled', 1); await checkpoint('failed-B', 'A', 'failed');
    await click(16, 18); await call('cancel'); await call('settled', 2); await checkpoint('cancelled-C', 'A', 'idle');
    await call('settle', 2); await call('providerIdle'); await checkpoint('late-cancelled-C', 'A', 'idle');
    await click(4, 18); await click(16, 18); await checkpoint('latest-pending', 'A', 'pending');
    await call('settle', 4); await call('settled', 4); await checkpoint('committed-C', 'C', 'ready');
    await click(11, 5);
    await call('settle', 3); await call('providerIdle'); await checkpoint('late-superseded-B', 'C', 'ready');
    await click(4, 18); await call('settle', 5); await call('settled', 5); await checkpoint('committed-B', 'B', 'ready');
    await click(11, 5);
    await call('disposeSlot'); await checkpoint('owned-disposed', 'empty', 'disposed');
    await call('recreate'); await checkpoint('recreated-A', 'A', 'idle');
    await click(4, 18); await call('manualBinding'); await call('settled', 6); await checkpoint('manual-conflict', 'A', 'conflicted');
    await call('disposeSlot'); await checkpoint('manual-disposed', 'A', 'disposed');
    await call('settle', 6); await call('providerIdle'); await checkpoint('late-manual-B', 'A', 'disposed');
    const final = await call('inspect');
    const expectedRequests = [[1, 'B', 'rejected', 'BITMAP_RESOURCE_REPLACE_FAILED'], [2, 'C', 'rejected', 'BITMAP_RESOURCE_CANCELLED'], [3, 'B', 'rejected', 'BITMAP_RESOURCE_SUPERSEDED'], [4, 'C', 'fulfilled', null], [5, 'B', 'fulfilled', null], [6, 'B', 'rejected', 'BITMAP_RESOURCE_BINDING_CHANGED']];
    if (JSON.stringify(final.requests.map(value => [value.id, value.color, value.outcome, value.code])) !== JSON.stringify(expectedRequests)) throw new Error('Request outcome/order mismatch');
    const targetEvents = final.events.filter(value => value.kind === 'target');
    if (final.targetActivations !== 4 || targetEvents.length !== 4 || targetEvents.some(value => !value.sameTarget || Math.abs(value.x - 11.5) > 0.001 || Math.abs(value.y - 5.5) > 0.001)) throw new Error('Native target identity/coordinates changed');
    const routesSeen = final.events.filter(value => value.kind === 'button-route');
    const callbacks = final.events.filter(value => value.kind === 'button-callback');
    if (routesSeen.length !== 6 || callbacks.length !== 6 || routesSeen.some(value => !value.sameTarget) || JSON.stringify(callbacks.map(value => value.color)) !== JSON.stringify(['B', 'C', 'B', 'C', 'B', 'B'])) throw new Error('Independent Button route/callback mismatch');
    const expectedEvents = ['target', 'button-route:B', 'button-callback:B', 'target', 'button-route:C', 'button-callback:C', 'button-route:B', 'button-callback:B', 'button-route:C', 'button-callback:C', 'target', 'button-route:B', 'button-callback:B', 'target', 'button-route:B', 'button-callback:B'];
    if (JSON.stringify(final.events.map(value => value.kind === 'target' ? 'target' : value.kind + ':' + value.color)) !== JSON.stringify(expectedEvents)) throw new Error('Native event route/callback order changed');
    result.final = final;
    for (const item of result.checkpoints) {
      const expected = COLORS[item.color].map(rgba => [...rgba]);
      if (kind === 'wrong-color-control' && item.label === 'startup') expected[0] = [255, 255, 0, 255];
      item.samples.forEach((sample, index) => { if (JSON.stringify(sample.point) !== JSON.stringify(POINTS[index]) || JSON.stringify(sample.rgba) !== JSON.stringify(expected[index])) result.mismatches.push({ label: item.label, point: POINTS[index], expected: expected[index], actual: sample.rgba }); });
    }
    if (kind === 'ordinary' && result.mismatches.length) throw new Error('Ordinary literal pixels mismatch');
    if (kind === 'wrong-color-control' && (result.mismatches.length !== 1 || result.mismatches[0].label !== 'startup' || JSON.stringify(result.mismatches[0].point) !== '[10,4]')) throw new Error('Wrong-color control was not uniquely detected');
    const rawLabels = ['healthy-startup', 'startup', 'pending-B', 'failed-B', 'cancelled-C', 'late-cancelled-C', 'latest-pending', 'committed-C', 'late-superseded-B', 'committed-B', 'owned-disposed', 'recreated-A', 'manual-conflict', 'manual-disposed', 'late-manual-B'];
    if (JSON.stringify(result.rawReadbacks.map(value => value.label)) !== JSON.stringify(rawLabels)) throw new Error('Original raw readback schedule incomplete');
    const expectedRoutes = new Set(closures[backend].map(key => modules.get(key).route));
    if (result.requestedSDKRoutes.some(route => !expectedRoutes.has(route))) throw new Error('Runtime crossed the selected backend module closure');
    if (result.pageErrors.length || result.console.some(value => value.type === 'error')) throw new Error('Unexpected browser error');
    await bounded(page.locator('#scene').screenshot({ path: path.join(output, backend + '-' + kind + '.png') }), 'scene screenshot');
    result.completedSchedule = true;
  } finally {
    try {
      result.closed = await call('close');
      const closed = result.closed;
      if (closed.state !== 'closed' || closed.scopeState !== 'closed' || closed.inputScopeState !== 'closed' || closed.inputState !== 'closed' || closed.pendingTimers || closed.pendingReadbacks || closed.pendingProviderJobs || closed.errors.length || closed.diagnostics.length) throw new Error('Application cleanup incomplete');
      if (closed.readbacks.some(value => value.status !== 'fulfilled')) throw new Error('GPU readback did not fulfill');
      if (backend === 'webgpu' && (closed.hostStatus.state !== 'closed' || closed.hostStatus.pendingFrames || closed.hostStatus.pendingUploadBytes || closed.hostStatus.pendingReadbackBytes || closed.hostStatus.firstFailure || closed.hostStatus.cleanupOutcome !== 'safe')) throw new Error('WebGPU retirement not safe');
      if (JSON.stringify([...closed.providerDisposals].sort()) !== JSON.stringify(['1x3', '1x3', '3x1', '3x1', '3x1', 'A', 'skins'].sort())) throw new Error('Provider value cleanup count mismatch');
    } catch (cause) { result.cleanupFailure = String(cause); report.retirementFailures.push({ label: backend + '/' + kind + '/application', message: String(cause) }); }
    await retire(contextResource);
  }
}

try {
  const server = await acquire('loopback server', () => new Promise((resolve, reject) => {
    const instance = createServer((request, response) => {
      // Exact preloaded route lookup is the only request authority. No request path
      // is resolved, decoded into, joined to or read from any filesystem root.
      const record = request.method === 'GET' && request.url?.length <= 2048 ? routes.get(request.url) : undefined;
      if (!record) { response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Unselected route'); return; }
      response.writeHead(200, { 'content-type': record.contentType, 'cache-control': 'no-store' }); response.end(record.bytes);
    });
    instance.once('error', reject); instance.listen(0, '127.0.0.1', () => resolve(instance));
  }), instance => new Promise((resolve, reject) => { instance.close(error => error ? reject(error) : resolve()); instance.closeAllConnections(); }));
  origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await acquire('browser', () => playwright.chromium.launch({ headless: true, channel: 'msedge' }), value => value.close());
  report.environment.browserVersion = browser.version();
  for (const backend of ['canvas', 'webgpu']) {
    await run(browser, backend, 'ordinary');
    await run(browser, backend, 'wrong-color-control');
  }
} catch (cause) { report.failures.push({ message: String(cause), stack: cause?.stack ?? null }); }
finally {
  for (const resource of [...resources].reverse()) await retire(resource);
  for (const before of currentSnapshot.inventory) {
    try { const after = identity.fingerprintFile(owners.get(before.owner), before.path); if (after.bytes !== before.bytes || after.sha256 !== before.sha256) report.failures.push({ message: 'Input drift: ' + before.owner + ':' + before.path }); }
    catch (cause) { report.failures.push({ message: String(cause) }); }
  }
  report.pendingOperations = pending.size;
  report.resourcesRetired = resources.every(resource => resource.retired);
  report.ordinaryReadbackCheckpoints = report.runs.filter(value => value.kind === 'ordinary').reduce((count, value) => count + value.checkpoints.length, 0);
  report.controlReadbackCheckpoints = report.runs.filter(value => value.kind === 'wrong-color-control').reduce((count, value) => count + value.checkpoints.length, 0);
  report.ordinaryRawFrames = report.runs.filter(value => value.kind === 'ordinary').reduce((count, value) => count + value.rawReadbacks.length, 0);
  report.controlRawFrames = report.runs.filter(value => value.kind === 'wrong-color-control').reduce((count, value) => count + value.rawReadbacks.length, 0);
  report.startupBarrierReads = report.runs.filter(value => value.startupReadback).length;
  report.startupBarrierComparisonScope = 'Fulfilled readiness/lifecycle barrier; retained six derived observations provide no extra ordinary checkpoint credit';
  report.remoteCIPassClaim = false; report.physicalDisplayOrDeviceClaim = false;
  report.accepted = report.failures.length === 0 && report.retirementFailures.length === 0 && pending.size === 0 && report.resourcesRetired && report.runs.length === 4 && report.runs.every(value => value.completedSchedule);
  report.status = report.accepted ? 'PASS_BOUNDED_RECORDED_BROWSER_COMPOSITION' : 'FAIL_OR_INCOMPLETE_BROWSER_COMPOSITION';
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, accepted: report.accepted, output, ordinaryCheckpoints: report.ordinaryReadbackCheckpoints, controlCheckpoints: report.controlReadbackCheckpoints, pending: report.pendingOperations }));
  if (!report.accepted) process.exitCode = 1;
}
