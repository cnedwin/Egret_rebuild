// SPDX-License-Identifier: Apache-2.0
// Reuse the sealed first-party lexical reader through an explicit owned projection.
// The projection is supplied and reviewed by input preparation; no parser is copied here.
import path from 'node:path';
import { readFileSync, realpathSync, lstatSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const HELPER = { bytes: 5065, sha256: '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569' };
const READER = { bytes: 25486, sha256: '34583c4eca298370f82865ca65b92d736939af893d1ca1353c77d6b7980a0075' };
const APPEND = Buffer.from('\nexport { literalImports };\n');
const PREFIX = 'knowledge-base/experiments/spine-f2-core/';
const F2 = 'knowledge-base/experiments/spine-f2/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireGraph = (condition, message) => { if (!condition) throw Object.assign(new Error(message), { code: 'F2C_NATIVE_GRAPH_REFUSAL' }); };
const decode = raw => new TextDecoder('utf-8', { fatal: true }).decode(raw);

/** Authenticate raw bytes before importing even first-party verification helpers. */
export async function freezeNativeGraph(admission) {
  const root = admission.repositoryRoot, helperFile = path.join(root, 'tools/lib/file-identity.mjs');
  requireGraph(path.isAbsolute(root) && lstatSync(root).isDirectory(), 'Explicit repository owner required');
  const helperRaw = readFileSync(helperFile);
  requireGraph(helperRaw.length === HELPER.bytes && hash(helperRaw) === HELPER.sha256, 'Shared helper raw identity');
  const identity = await import(pathToFileURL(helperFile).href);
  const { logicalPath, fingerprintFile, ownerRelativePath, samePhysicalPath } = identity;
  requireGraph(samePhysicalPath(root, realpathSync(root)), 'Canonical repository owner');
  const helperPin = fingerprintFile(root, 'tools/lib/file-identity.mjs');
  requireGraph(helperPin.bytes === HELPER.bytes && helperPin.sha256 === HELPER.sha256, 'Shared helper physical authority');
  requireGraph(Array.isArray(admission.repositoryPins) && admission.repositoryPins.length > 0 && admission.repositoryPins.length <= 4096, 'Explicit repository source/emission inventory');
  const repositoryPins = new Map();
  for (const pin of admission.repositoryPins) {
    logicalPath(pin.path); requireGraph(!repositoryPins.has(pin.path), 'Duplicate full repository identity');
    const actual = fingerprintFile(root, pin.path);
    requireGraph(actual.bytes === pin.bytes && actual.sha256 === pin.sha256, 'Reviewed repository identity changed: ' + pin.path);
    repositoryPins.set(pin.path, actual);
  }
  const files = new Map(), modules = new Map(), aliases = new Map(), edges = [], declarations = new Set(), extensionlessRoutes = new Map(); let total = 0;
  function retain(owner, relative, expected, role) {
    logicalPath(relative); const actual = fingerprintFile(owner, relative), raw = readFileSync(path.join(owner, ...relative.split('/')));
    requireGraph(raw.length === actual.bytes && hash(raw) === actual.sha256, 'Second raw read drift');
    requireGraph(!expected || actual.bytes === expected.bytes && actual.sha256 === expected.sha256, 'Raw pinned input mismatch');
    const key = owner + ':' + relative;
    if (!files.has(key)) { total += raw.length; requireGraph(files.size < 4096 && raw.length <= 2097152 && total <= 33554432, 'Finite graph inventory budget');
      files.set(key, { owner, ...actual, role }); }
    return { ...actual, raw, owner };
  }
  function repository(relative, role) {
    const expected = repositoryPins.get(relative); requireGraph(expected !== undefined, 'Discovered file absent from actual input inventory: ' + relative);
    return retain(root, relative, expected, role);
  }
  // Input preparation creates an owned copy: complete original bytes plus exactly
  // one audit export, beside an unchanged copy of its original relative helper.
  const projection = admission.readerProjection;
  requireGraph(projection && path.isAbsolute(projection.owner) && !samePhysicalPath(projection.owner, root), 'Explicit external projection owner');
  requireGraph(samePhysicalPath(projection.owner, realpathSync(projection.owner)), 'Canonical projection owner');
  try { ownerRelativePath(root, projection.owner); throw new Error('Projection inside repository'); }
  catch (cause) { requireGraph(cause instanceof RangeError, 'Projection must be outside repository'); }
  const original = repository('tools/browser-png/file-graph.mjs', 'original-first-party-reader');
  requireGraph(original.bytes === READER.bytes && original.sha256 === READER.sha256, 'Mature reader original raw identity');
  const projected = retain(projection.owner, 'browser-png/file-graph.mjs', projection.reader, 'one-export-owned-projection');
  const projectedHelper = retain(projection.owner, 'lib/file-identity.mjs', HELPER, 'unchanged-owned-projection-helper');
  requireGraph(projected.raw.equals(Buffer.concat([original.raw, APPEND])) && projectedHelper.raw.equals(helperRaw), 'Exact projection and inverse originals');
  const { literalImports } = await import(pathToFileURL(path.join(projection.owner, 'browser-png/file-graph.mjs')).href);
  requireGraph(typeof literalImports === 'function', 'Mature literal reader audit export');

  const sdkRoot = admission.sdkRoot;
  requireGraph(path.isAbsolute(sdkRoot) && samePhysicalPath(sdkRoot, realpathSync(sdkRoot)), 'Canonical supplied SDK owner');
  requireGraph(Array.isArray(admission.sdkPins) && admission.sdkPins.length === 137, 'Exact supplied SDK inventory');
  const sdkPins = new Map();
  for (const pin of admission.sdkPins) { logicalPath(pin.path); requireGraph(!sdkPins.has(pin.path), 'Duplicate full SDK identity');
    sdkPins.set(pin.path, retain(sdkRoot, pin.path, pin, 'unchanged-external-sdk')); }
  const listed = [];
  function sdkTree(relative = '') {
    for (const name of readdirSync(path.join(sdkRoot, relative)).sort()) {
      const key = relative ? relative + '/' + name : name; logicalPath(key);
      const item = lstatSync(path.join(sdkRoot, key)); requireGraph(!item.isSymbolicLink(), 'SDK symbolic path');
      if (item.isDirectory()) sdkTree(key); else { requireGraph(item.isFile(), 'SDK nonregular path'); listed.push(key); }
    }
  } sdkTree(); listed.sort();
  requireGraph(equal(listed, [...sdkPins.keys()].sort()), 'Supplied SDK has another file inventory');
  const tuples = [...sdkPins.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(row => [row.path, row.bytes, row.sha256]);
  requireGraph(hash(Buffer.from(JSON.stringify(tuples))) === 'e3690c1f8fc3c2b8123bfcfe37d50d7f56878fbef8143fe5cd11d0cc97eaf0cf', 'Supplied SDK fixed tuple tree');
  const sdkPackage = JSON.parse(decode(sdkPins.get('package.json').raw));
  requireGraph(sdkPackage.name === '@esotericsoftware/spine-core' && sdkPackage.version === '4.3.13', 'Official public SDK package identity');
  const sdkEntry = sdkPackage.module ?? sdkPackage.main;
  requireGraph(sdkEntry === 'dist/index.js', 'Exact official public SDK root');
  aliases.set('@esotericsoftware/spine-core', '/external/spine-core/' + sdkEntry);
  const packages = new Map(), configurations = [];
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    const owner = 'packages/' + name, pkg = JSON.parse(decode(repository(owner + '/package.json', 'public-package-manifest').raw));
    requireGraph(pkg.name === '@egret/' + name && pkg.type === 'module', 'Public package identity'); packages.set(pkg.name, { owner, pkg });
    for (const filename of name === 'engine' ? ['tsconfig.json', 'tsconfig.web.json', 'tsconfig.rendering.json'] : ['tsconfig.json']) {
      const config = JSON.parse(decode(repository(owner + '/' + filename, 'compiler-configuration').raw));
      configurations.push({ source: owner + '/' + config.compilerOptions.rootDir + '/', emitted: owner + '/' + config.compilerOptions.outDir + '/', owner });
    }
  }
  for (const owner of [PREFIX.slice(0, -1), F2.slice(0, -1)]) {
    const config = JSON.parse(decode(repository(owner + '/tsconfig.json', 'experiment-configuration').raw));
    configurations.push({ source: owner + '/' + config.compilerOptions.rootDir + '/', emitted: owner + '/' + config.compilerOptions.outDir + '/', owner });
  }
  for (const relative of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.base.json']) repository(relative, 'root-configuration');
  function sourceFor(relative) {
    const config = configurations.filter(row => relative.startsWith(row.emitted)).sort((a, b) => b.emitted.length - a.emitted.length)[0];
    requireGraph(config && /(?:\.js|\.d\.ts)$/.test(relative), 'Known first-party emission owner');
    return logicalPath(config.source + relative.slice(config.emitted.length).replace(/(?:\.d\.ts|\.js)$/, '.ts'));
  }
  function publicTarget(specifier, type = false) {
    const name = [...packages.keys()].find(key => specifier === key || specifier.startsWith(key + '/'));
    requireGraph(name !== undefined, 'Known public package root'); const row = packages.get(name), subpath = specifier === name ? '.' : '.' + specifier.slice(name.length);
    const selected = row.pkg.exports?.[subpath], target = typeof selected === 'string' ? selected : selected?.[type ? 'types' : 'import'];
    requireGraph(typeof target === 'string' && target.startsWith('./') && !target.includes('*'), 'Exact public entry mapping');
    return logicalPath(row.owner + '/' + target.slice(2));
  }
  const externalDependencies = new Map();
  function dependency(specifier, type) {
    requireGraph(['robust-predicates', 'jsonc-parser'].includes(specifier), 'Only declared existing first-party foundational dependencies');
    if (!externalDependencies.has(specifier)) {
      const owner = realpathSync(path.join(root, 'node_modules', specifier)), logicalOwner = ownerRelativePath(root, owner);
      const pkg = JSON.parse(decode(repository(logicalOwner + '/package.json', 'foundation-package').raw));
      requireGraph(pkg.name === specifier && pkg.version === (specifier === 'robust-predicates' ? '3.0.3' : '3.3.1'), 'Existing foundational version');
      repository(logicalOwner + '/' + (specifier === 'robust-predicates' ? 'LICENSE' : 'LICENSE.md'), 'foundation-license');
      externalDependencies.set(specifier, { owner, logicalOwner, pkg });
    }
    const row = externalDependencies.get(specifier), entry = type ? row.pkg.types ?? row.pkg.typings : specifier === 'robust-predicates' ? row.pkg.exports : row.pkg.module;
    requireGraph(typeof entry === 'string', 'Existing foundational public entry');
    const relative = logicalPath(row.logicalOwner + '/' + entry.replace(/^\.\//, ''));
    if (!type) { aliases.set(specifier, '/' + relative); declaration(dependency(specifier, true)); } return relative;
  }
  function resolve(specifier, from, type) {
    const sdk = from.startsWith('/external/spine-core/'), relative = sdk ? from.slice('/external/spine-core/'.length) : from;
    if (sdk) {
      requireGraph((specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js'), 'SDK static package-local closure only');
      const target = logicalPath(path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier)));
      return '/external/spine-core/' + (type ? target.replace(/\.js$/, '.d.ts') : target);
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      let target = logicalPath(path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier)));
      // jsonc-parser 3.3.1 deliberately emits these nine extensionless edges.
      // Preserve its original bytes and serve only the corresponding five exact
      // original .js module bodies at their original extensionless request URLs.
      const jsonc = externalDependencies.get('jsonc-parser');
      if (!type && jsonc && relative.startsWith(jsonc.logicalOwner + '/lib/esm/')) {
        const fromKey = relative.slice((jsonc.logicalOwner + '/lib/esm/').length);
        const admitted = { 'main.js': ['./impl/format', './impl/edit', './impl/scanner', './impl/parser'],
          'impl/parser.js': ['./scanner'], 'impl/format.js': ['./scanner', './string-intern'],
          'impl/edit.js': ['./format', './parser'], 'impl/scanner.js': [], 'impl/string-intern.js': [] };
        requireGraph(Object.hasOwn(admitted, fromKey) && admitted[fromKey].includes(specifier), 'Exact jsonc-parser 3.3.1 original extensionless relation');
        const requestRoute = '/' + target; target = logicalPath(target + '.js');
        requireGraph(['format', 'edit', 'scanner', 'parser', 'string-intern'].some(name => target === jsonc.logicalOwner + '/lib/esm/impl/' + name + '.js'), 'Five exact foundational .js bodies');
        extensionlessRoutes.set(requestRoute, '/' + target);
      }
      const config = configurations.find(row => relative.startsWith(row.emitted));
      const collector = relative.startsWith(PREFIX + 'native/');
      requireGraph(collector ? [PREFIX + 'dist/index.js', PREFIX + 'native/oracle.mjs'].includes(target)
        : relative.startsWith(PREFIX + 'dist/') && target === F2 + 'dist/index.js'
          || relative.startsWith(F2 + 'dist/') && target.startsWith('packages/project/dist/spine/')
          || config && target.startsWith(config.owner + '/dist/')
          || relative.startsWith('node_modules/') && target.startsWith(relative.split('/').slice(0, 2).join('/') + '/'), 'Exact relative ownership relation');
      return type && target.endsWith('.js') ? target.replace(/\.js$/, '.d.ts') : target;
    }
    if (specifier.startsWith('@egret/')) { const target = publicTarget(specifier, type); if (!type) aliases.set(specifier, '/' + target); return target; }
    if (specifier.startsWith('#')) {
      const row = [...packages.values()].find(row => relative.startsWith(row.owner + '/dist/'));
      requireGraph(row && ['#egret-textured-frame-state', '#egret-mouse-input'].includes(specifier), 'Existing exact internal alias');
      const mapping = row.pkg.imports?.[specifier], target = typeof mapping === 'string' ? mapping : mapping?.[type ? 'types' : 'import'];
      requireGraph(typeof target === 'string' && target.startsWith('./'), 'Actual package internal alias relation');
      const result = logicalPath(row.owner + '/' + target.slice(2)); if (!type) aliases.set(specifier, '/' + result); return result;
    }
    if (specifier === '@esotericsoftware/spine-core') {
      requireGraph(relative.startsWith(PREFIX + 'dist/'), 'SDK public root belongs only to opt-in bridge');
      return '/external/spine-core/' + (type ? 'dist/index.d.ts' : sdkEntry);
    }
    requireGraph(specifier === 'robust-predicates' && relative.startsWith('packages/engine/dist/rendering/')
      || specifier === 'jsonc-parser' && (relative.startsWith('packages/project/dist/') || relative.startsWith(F2 + 'dist/')), 'Exact foundational relation');
    return dependency(specifier, type);
  }
  function readModule(relative, type = false) {
    if (relative.startsWith('/external/spine-core/')) {
      const key = logicalPath(relative.slice('/external/spine-core/'.length)), row = sdkPins.get(key); requireGraph(row !== undefined, 'SDK module in fixed original inventory'); return row;
    }
    return repository(relative, type ? 'declaration' : 'emitted-browser-module');
  }
  function declaration(relative) {
    if (declarations.has(relative)) return; declarations.add(relative);
    const row = readModule(relative, true);
    if (!relative.startsWith('/external/') && !relative.startsWith('node_modules/')) { repository(sourceFor(relative), 'matching-first-party-source'); repository(relative.replace(/\.d\.ts$/, '.js'), 'declaration-counterpart'); }
    for (const edge of literalImports(decode(row.raw), relative, true)) declaration(resolve(edge.specifier, relative, true));
  }
  function visit(relative) {
    const route = relative.startsWith('/external/') ? relative : '/' + relative;
    if (modules.has(route)) return route; requireGraph(modules.size < 1024, 'Finite browser module count');
    const row = readModule(relative), sdk = relative.startsWith('/external/'), collector = relative.startsWith(PREFIX + 'native/');
    if (!sdk && !collector && !relative.startsWith('node_modules/')) repository(sourceFor(relative), 'matching-first-party-source');
    if (!collector && !relative.startsWith('node_modules/')) declaration(relative.replace(/\.js$/, '.d.ts'));
    modules.set(route, { route, path: row.path, owner: row.owner, bytes: row.bytes, sha256: row.sha256, bodyBase64: row.raw.toString('base64') });
    for (const edge of literalImports(decode(row.raw), relative)) {
      requireGraph(edge.kind === 'static' || edge.kind === 'dynamic-literal'
        && relative === 'packages/engine/dist/web/WebGPUHost.js' && edge.specifier === './b1.js', 'Exact admitted static/lazy module relation');
      const target = resolve(edge.specifier, relative, false), to = visit(target); edges.push({ from: route, ...edge, to });
    } return route;
  }
  for (const name of ['@egret/engine', '@egret/engine/web/image', '@egret/engine/webgpu', '@egret/engine/web']) {
    const entry = publicTarget(name); aliases.set(name, '/' + entry); visit(entry);
  }
  visit(PREFIX + 'native/fixture.mjs');
  const sdkModules = [...modules.keys()].filter(route => route.startsWith('/external/spine-core/'));
  requireGraph(sdkModules.length === 64, 'Fixed 64-JS official public root closure');
  const assetRoutes = [];
  for (const name of ['origin.json', 'literal-oracle.json', 'original-f2c.spine.json', 'original-f2c.atlas', 'original-f2c-page.png', 'original-f2c-page.rgba']) {
    const row = repository(PREFIX + 'assets/' + name, 'original-asset'); assetRoutes.push({ route: '/assets/' + name, path: row.path, bytes: row.bytes, sha256: row.sha256, bodyBase64: row.raw.toString('base64') });
  }
  return { schemaVersion: 1, status: 'FROZEN_SOURCE_INPUTS_NOT_EXECUTED', repositoryRoot: root, sdkRoot,
    files: [...files.values()], modules: [...modules.values()], edges, declarationFiles: [...declarations].sort(), assetRoutes,
    extensionlessRoutes: [...extensionlessRoutes].map(([route, originalModuleRoute]) => ({ route, originalModuleRoute })),
    importMap: { imports: Object.fromEntries([...aliases].sort(([a], [b]) => a.localeCompare(b, 'en'))) },
    counts: { files: files.size, modules: modules.size, sdkModules: sdkModules.length, bytes: total },
    projection: { original: { path: original.path, bytes: original.bytes, sha256: original.sha256 },
      supplied: projection.reader, appendedBytes: APPEND.length, inverseRestoresOriginalExactly: true },
    legalBoundary: { entitlement: 'unverified', redistributionClearance: 'unverified', SDKServedOnlyOnExplicitLoopback: true } };
}
