// SPDX-License-Identifier: Apache-2.0
// Read-only admission data: this module never imports an SDK or starts an actor.
import path from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { fingerprintFile, logicalPath, ownerRelativePath, samePhysicalPath } from '../lib/file-identity.mjs';

const PACKAGES = Object.freeze(['contracts', 'runtime', 'engine', 'project']);
const LIMITS = Object.freeze({ files: 4096, fileBytes: 2097152, totalBytes: 33554432, tokens: 1048576 });
const COLLECTOR_ROUTES = Object.freeze({ fixture: '/fixture.mjs', 'native-observer': '/native-observer.mjs' });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function requireGraph(condition, code, details = {}) {
  if (!condition) {
    const error = new Error('BIP_GRAPH_' + code);
    Object.assign(error, { code: 'BIP_GRAPH_' + code, details });
    throw error;
  }
}
function freezeData(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeData(item);
    Object.freeze(value);
  }
  return value;
}
function jsonBody(record) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(record.bodyBase64, 'base64'));
  const parsed = JSON.parse(text);
  requireGraph(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'JSON_OBJECT', { path: record.path });
  return parsed;
}
function exactRoute(route) {
  requireGraph(typeof route === 'string' && route.startsWith('/') && !route.startsWith('//'), 'ROUTE');
  logicalPath(route.slice(1));
  requireGraph(!/[?#%]/.test(route), 'ROUTE_ENCODING', { route });
  return route;
}
function expectedPin(row) {
  requireGraph(row && typeof row === 'object' && typeof row.path === 'string'
    && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256), 'PIN_SHAPE');
}
function rawFileFingerprint(owner, relative, expected) {
  const identity = fingerprintFile(owner, relative);
  requireGraph(identity.bytes <= LIMITS.fileBytes, 'FILE_BYTES', { path: relative, bytes: identity.bytes });
  // The returned body has its own byte comparison; a second read cannot inherit
  // the earlier read's identity if the file changes between those operations.
  const body = readFileSync(path.join(owner, ...relative.split('/')));
  requireGraph(body.length === identity.bytes && sha256(body) === identity.sha256, 'READ_DRIFT', { path: relative });
  if (expected) requireGraph(identity.bytes === expected.bytes && identity.sha256 === expected.sha256,
    'PIN_DRIFT', { path: relative, expected, actual: identity });
  return { ...identity, bodyBase64: body.toString('base64') };
}
function externalPin(row) {
  expectedPin(row);
  requireGraph(path.isAbsolute(row.path), 'ABSOLUTE_ORIGINAL_PIN', { path: row.path });
  const owner = path.dirname(row.path);
  const relative = ownerRelativePath(owner, row.path);
  return { ...rawFileFingerprint(owner, relative, row), path: row.path };
}

// This deliberately restricted lexical reader accepts plain string specifiers.
// It is not a general JavaScript parser and never evaluates input text.
function tokens(text, filename) {
  const result = [];
  let cursor = 0;
  const emit = (kind, value) => {
    requireGraph(result.length < LIMITS.tokens, 'TOKEN_LIMIT', { path: filename });
    result.push({ kind, value });
  };
  function quoted(quote) {
    cursor++;
    let value = '', escaped = false;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === quote) { emit(escaped ? 'escaped-string' : 'string', value); return; }
      requireGraph(char !== '\n' && char !== '\r', 'STRING_LINE', { path: filename });
      if (char === '\\') { escaped = true; requireGraph(cursor < text.length, 'STRING_END'); value += char + text[cursor++]; }
      else value += char;
    }
    requireGraph(false, 'STRING_END', { path: filename });
  }
  function template() {
    cursor++;
    while (cursor < text.length) {
      if (text[cursor] === '\\') { cursor += 2; continue; }
      if (text[cursor] === '`') { cursor++; emit('template', 'template'); return; }
      if (text.startsWith('${', cursor)) { cursor += 2; emit('punctuation', '('); scan(true); emit('punctuation', ')'); }
      else cursor++;
    }
    requireGraph(false, 'TEMPLATE_END', { path: filename });
  }
  function regexAllowed() {
    const previous = result.at(-1);
    return previous === undefined || (previous.kind === 'word' && ['return', 'throw', 'case', 'typeof', 'void', 'delete', 'yield', 'await'].includes(previous.value))
      || (previous.kind === 'punctuation' && ['(', '[', '{', '=', ':', ',', ';', '!', '?', '&', '|', '>'].includes(previous.value));
  }
  function regularExpression() {
    cursor++;
    let bracket = false;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === '\\') { cursor++; continue; }
      requireGraph(char !== '\n' && char !== '\r', 'REGEX_LINE', { path: filename });
      if (char === '[') bracket = true;
      else if (char === ']') bracket = false;
      else if (char === '/' && !bracket) {
        while (cursor < text.length && /[A-Za-z]/.test(text[cursor])) cursor++;
        emit('regex', 'regex'); return;
      }
    }
    requireGraph(false, 'REGEX_END', { path: filename });
  }
  function scan(expression = false) {
    let braceDepth = 0;
    while (cursor < text.length) {
      const char = text[cursor];
      if (/\s/.test(char)) { cursor++; continue; }
      if (text.startsWith('//', cursor)) { const end = text.indexOf('\n', cursor + 2); cursor = end < 0 ? text.length : end + 1; continue; }
      if (text.startsWith('/*', cursor)) {
        const end = text.indexOf('*/', cursor + 2);
        requireGraph(end >= 0, 'COMMENT_END', { path: filename }); cursor = end + 2; continue;
      }
      if (char === '"' || char === "'") { quoted(char); continue; }
      if (char === '`') { template(); continue; }
      if (char === '/' && regexAllowed()) { regularExpression(); continue; }
      requireGraph(char !== '\\', 'ESCAPED_IDENTIFIER', { path: filename });
      if (/[A-Za-z_$]/.test(char)) {
        const start = cursor++;
        while (cursor < text.length && /[A-Za-z0-9_$]/.test(text[cursor])) cursor++;
        emit('word', text.slice(start, cursor)); continue;
      }
      cursor++;
      if (char === '{') braceDepth++;
      if (char === '}') {
        if (expression && braceDepth === 0) return;
        braceDepth--;
      }
      emit('punctuation', char);
    }
    requireGraph(!expression, 'TEMPLATE_EXPRESSION_END', { path: filename });
  }
  scan();
  return result;
}
function literalImports(text, filename, declaration = false) {
  const lexical = tokens(text, filename), imports = [];
  const admit = (token, kind) => {
    requireGraph(token?.kind === 'string' && token.value.length > 0 && !/[\\\s%?:\x00-\x1f]/.test(token.value),
      'IMPORT_STRING', { path: filename });
    imports.push({ specifier: token.value, kind });
  };
  function from(index, required) {
    let braces = 0;
    for (let at = index; at < lexical.length; at++) {
      const item = lexical[at];
      if (item.value === '{') braces++;
      if (item.value === '}') braces--;
      if (braces === 0 && item.kind === 'word' && item.value === 'from') { admit(lexical[at + 1], 'static'); return; }
      if (braces === 0 && item.value === ';') break;
    }
    requireGraph(!required, 'IMPORT_FROM', { path: filename });
  }
  for (let at = 0; at < lexical.length; at++) {
    const item = lexical[at];
    if (item.kind !== 'word' || lexical[at - 1]?.value === '.') continue;
    if (item.value === 'import') {
      const next = lexical[at + 1];
      requireGraph(next?.value !== '.', 'IMPORT_META', { path: filename });
      if (next?.value === '(') {
        requireGraph(lexical[at + 3]?.value === ')', 'COMPUTED_IMPORT', { path: filename });
        admit(lexical[at + 2], declaration ? 'declaration-literal' : 'dynamic-literal');
      } else if (next?.kind === 'string' || next?.kind === 'escaped-string') admit(next, 'static');
      else from(at + 1, true);
    } else if (item.value === 'export') {
      const next = lexical[at + 1], afterType = next?.value === 'type' ? lexical[at + 2] : next;
      if (afterType?.value === '{' || afterType?.value === '*') from(at + 1, false);
    }
  }
  return imports;
}

/** Freeze raw inputs and selected public import closures without evaluating them.
 * Paths in collectorFiles are exact repository-relative logical keys. Original
 * fixture/schedule pins use private absolute paths and stay metadata-separated.
 */
export function freezeBrowserPngGraph({ repositoryRoot, collectorFiles, fixturePins, schedulePin, profile = 'browser-png' }) {
  requireGraph(profile === 'browser-png' || profile === 'nine-slice-bitmap' || profile === 'display-container-remove-children' || profile === 'display-container-child-index' || profile === 'display-container-add-child-at', 'EXPLICIT_PROFILE');
  const nineSlice = profile === 'nine-slice-bitmap', removeChildren = profile === 'display-container-remove-children';
  const childIndex = profile === 'display-container-child-index';
  const addChildAt = profile === 'display-container-add-child-at';
  const literalScene = nineSlice || removeChildren || childIndex || addChildAt;
  requireGraph(typeof repositoryRoot === 'string' && path.isAbsolute(repositoryRoot), 'REPOSITORY_ROOT');
  const root = realpathSync(repositoryRoot);
  requireGraph(samePhysicalPath(root, repositoryRoot), 'REPOSITORY_ALIAS');
  requireGraph(Array.isArray(collectorFiles) && Array.isArray(fixturePins) && fixturePins.length === (literalScene ? 0 : 2), 'INPUT_ARRAYS');
  const files = new Map(), modules = new Map(), edges = [], declarationEdges = [], hostFilePins = [], entryAliases = [];
  const aliases = new Map(), packageRecords = new Map(), configurations = [], dependencyOwners = new Map();
  let totalBytes = 0;
  function retain(record, role, owner = 'repository') {
    const key = owner + ':' + record.path;
    if (files.has(key)) {
      const prior = files.get(key);
      requireGraph(prior.bytes === record.bytes && prior.sha256 === record.sha256, 'INVENTORY_DRIFT', { path: record.path });
      if (!prior.roles.includes(role)) prior.roles.push(role);
      return record;
    }
    requireGraph(files.size < LIMITS.files && totalBytes + record.bytes <= LIMITS.totalBytes, 'INVENTORY_LIMIT');
    totalBytes += record.bytes;
    files.set(key, { path: record.path, bytes: record.bytes, sha256: record.sha256, owner, roles: [role] });
    return record;
  }
  const read = (relative, role) => retain(rawFileFingerprint(root, logicalPath(relative)), role);
  const schedule = externalPin(schedulePin), scheduleData = jsonBody(schedule);
  requireGraph(JSON.stringify(scheduleData.backends) === JSON.stringify(nineSlice ? ['webgpu'] : ['canvas', 'webgpu']), 'BACKEND_SCHEDULE');
  requireGraph(!literalScene || scheduleData.profile === profile, 'NINE_SLICE_SCHEDULE_PROFILE');
  requireGraph(Array.isArray(scheduleData.fixtures) && scheduleData.fixtures.length === (literalScene ? 0 : 2), 'FIXTURE_SCHEDULE');
  retain(schedule, 'literal-schedule', 'private-original');
  const originals = fixturePins.map(row => {
    const actual = externalPin(row), route = exactRoute(row.route);
    const planned = scheduleData.fixtures.find(item => item.route === route);
    requireGraph(planned && planned.bytes === actual.bytes && planned.sha256 === actual.sha256, 'FIXTURE_SCHEDULE_PIN', { route });
    retain(actual, 'encoded-fixture', 'private-original');
    return { ...actual, route };
  });
  requireGraph(new Set(originals.map(row => row.route)).size === originals.length, 'FIXTURE_ROUTE_DUPLICATE');
  for (const relative of ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.base.json', 'tools/build.mjs', 'tools/lib/file-identity.mjs']) read(relative, 'configuration');
  for (const name of PACKAGES) {
    const owner = 'packages/' + name, manifest = read(owner + '/package.json', 'package-manifest'), data = jsonBody(manifest);
    requireGraph(data.name === '@egret/' + name && data.type === 'module', 'PACKAGE_IDENTITY', { path: manifest.path });
    packageRecords.set(data.name, { owner, manifest, data });
    for (const configName of name === 'engine' ? ['tsconfig.json', 'tsconfig.web.json', 'tsconfig.rendering.json'] : ['tsconfig.json']) {
      const record = read(owner + '/' + configName, 'configuration'), config = jsonBody(record), options = config.compilerOptions;
      requireGraph(options && typeof options.rootDir === 'string' && typeof options.outDir === 'string'
        && config.extends === '../../tsconfig.base.json', 'SOURCE_CONFIG', { path: record.path });
      configurations.push({ packageName: data.name, owner, path: record.path,
        sourcePrefix: logicalPath(owner + '/' + options.rootDir) + '/', emittedPrefix: logicalPath(owner + '/' + options.outDir) + '/' });
    }
  }
  function targetFromMapping(record, mapping, mode) {
    const target = typeof mapping === 'string' ? mapping : mapping?.[mode];
    requireGraph(typeof target === 'string' && target.startsWith('./') && !target.includes('*'), 'EXPORT_MAPPING', { package: record.data.name, mode });
    return logicalPath(record.owner + '/' + target.slice(2));
  }
  function publicTarget(specifier, mode) {
    const name = [...packageRecords.keys()].find(item => specifier === item || specifier.startsWith(item + '/'));
    requireGraph(name !== undefined, 'BARE_IMPORT_UNKNOWN', { specifier });
    const record = packageRecords.get(name), subpath = specifier === name ? '.' : '.' + specifier.slice(name.length);
    requireGraph(record.data.exports && Object.hasOwn(record.data.exports, subpath), 'PUBLIC_EXPORT_MISSING', { specifier });
    return targetFromMapping(record, record.data.exports[subpath], mode);
  }
  function sourceCounterpart(filename) {
    const selected = configurations.filter(row => filename.startsWith(row.emittedPrefix)).sort((a, b) => b.emittedPrefix.length - a.emittedPrefix.length)[0];
    requireGraph(selected && /\.(?:js|d\.ts)$/.test(filename), 'EMISSION_OWNER', { path: filename });
    const tail = filename.slice(selected.emittedPrefix.length).replace(/(?:\.d\.ts|\.js)$/, '.ts');
    return logicalPath(selected.sourcePrefix + tail);
  }
  const servedCollector = new Map();
  for (const row of collectorFiles) {
    requireGraph(row && typeof row === 'object' && ['fixture', 'native-observer', 'host-only'].includes(row.role), 'COLLECTOR_ROLE');
    const relative = logicalPath(row.path), record = read(relative, 'collector-' + row.role);
    if (row.role === 'host-only') { requireGraph(row.route === undefined, 'HOST_ONLY_ROUTE'); hostFilePins.push({ path: record.path, bytes: record.bytes, sha256: record.sha256 }); }
    else {
      requireGraph(row.route === COLLECTOR_ROUTES[row.role] && !servedCollector.has(row.route), 'COLLECTOR_ROUTE');
      servedCollector.set(row.route, { ...record, route: row.route, role: row.role });
    }
  }
  requireGraph(servedCollector.size === (literalScene ? 1 : 2) && (!literalScene || servedCollector.has('/fixture.mjs')), 'COLLECTOR_ROOTS');
  function alias(specifier, target) {
    const route = '/' + target;
    if (aliases.has(specifier)) requireGraph(aliases.get(specifier) === route, 'ALIAS_CONFLICT', { specifier });
    else aliases.set(specifier, route);
    return route;
  }
  function resolveProduct(specifier, filename, mode) {
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      requireGraph(specifier.endsWith('.js'), 'RELATIVE_EXTENSION', { path: filename, specifier });
      const target = logicalPath(path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier)));
      const owner = configurations.find(row => filename.startsWith(row.emittedPrefix))?.owner;
      requireGraph(owner && target.startsWith(owner + '/dist/'), 'RELATIVE_PACKAGE_ESCAPE', { path: filename, specifier });
      return mode === 'types' ? target.replace(/\.js$/, '.d.ts') : target;
    }
    if (specifier.startsWith('#')) {
      const record = [...packageRecords.values()].find(item => filename.startsWith(item.owner + '/dist/'));
      requireGraph(record?.data.imports && Object.hasOwn(record.data.imports, specifier), 'PACKAGE_IMPORT_MISSING', { path: filename, specifier });
      const target = targetFromMapping(record, record.data.imports[specifier], mode);
      if (mode === 'import') alias(specifier, target);
      return target;
    }
    if (specifier.startsWith('@egret/')) {
      const importer = [...packageRecords.values()].find(item => filename.startsWith(item.owner + '/dist/'));
      const dependencyName = [...packageRecords.keys()].find(item => specifier === item || specifier.startsWith(item + '/'));
      requireGraph(importer && dependencyName && (importer.data.name === dependencyName
        || Object.hasOwn(importer.data.dependencies ?? {}, dependencyName)), 'WORKSPACE_DEPENDENCY', { path: filename, specifier });
      const target = publicTarget(specifier, mode);
      if (mode === 'import') alias(specifier, target);
      return target;
    }
    requireGraph(specifier === 'robust-predicates' && filename.startsWith('packages/engine/dist/'), 'DEPENDENCY_UNLISTED', { path: filename, specifier });
    return resolveDependency(mode);
  }
  function resolveDependency(mode) {
    const name = 'robust-predicates';
    let dependency = dependencyOwners.get(name);
    if (!dependency) {
      const engine = packageRecords.get('@egret/engine');
      requireGraph(engine.data.dependencies?.[name] === '3.0.3', 'DEPENDENCY_VERSION');
      const linkPath = path.join(root, 'packages', 'engine', 'node_modules', name), dependencyRoot = realpathSync(linkPath);
      const contained = ownerRelativePath(root, dependencyRoot);
      requireGraph(literalScene ? contained === 'node_modules/' + name
        : contained.startsWith('node_modules/.pnpm/') && contained.endsWith('/node_modules/' + name), 'DEPENDENCY_OWNER', { path: dependencyRoot });
      const manifest = rawFileFingerprint(dependencyRoot, 'package.json'), data = jsonBody(manifest);
      requireGraph(data.name === name && data.version === engine.data.dependencies[name] && data.type === 'module'
        && data.exports === './index.js' && data.types === 'index.d.ts', 'DEPENDENCY_MANIFEST');
      dependency = { name, root: dependencyRoot, repositoryPath: contained, routePrefix: '/dependencies/' + name + '/', data };
      dependencyOwners.set(name, dependency);
      retain({ ...manifest, path: contained + '/package.json' }, 'dependency-manifest');
      for (const legal of ['LICENSE', 'index.d.ts']) {
        const record = rawFileFingerprint(dependencyRoot, legal);
        retain({ ...record, path: contained + '/' + legal }, legal === 'LICENSE' ? 'dependency-license' : 'declaration');
      }
    }
    const relative = mode === 'types' ? dependency.data.types : dependency.data.exports.slice(2);
    return { dependency: dependency.name, relative: logicalPath(relative) };
  }
  const declarations = new Set();
  function visitDeclaration(filename) {
    if (typeof filename === 'object') return; // Dependency root declaration was pinned above; it has no imports.
    if (declarations.has(filename)) return;
    declarations.add(filename);
    const record = read(filename, 'declaration'); read(sourceCounterpart(filename), 'source');
    // Declaration-only dependencies are pinned with their matching emission;
    // that does not add a module to the browser's route allowlist.
    read(filename.replace(/\.d\.ts$/, '.js'), 'declaration-counterpart-emission');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(record.bodyBase64, 'base64'));
    for (const imported of literalImports(text, filename, true)) {
      const target = resolveProduct(imported.specifier, filename, 'types');
      declarationEdges.push({ from: filename, ...imported, to: target });
      visitDeclaration(target);
    }
  }
  function visitProduct(filename) {
    const route = '/' + filename;
    if (modules.has(route)) return route;
    const record = read(filename, 'emitted-module'); read(sourceCounterpart(filename), 'source');
    visitDeclaration(filename.replace(/\.js$/, '.d.ts'));
    const module = { ...record, route, owner: 'repository', kind: 'product' };
    modules.set(route, module);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(record.bodyBase64, 'base64'));
    for (const imported of literalImports(text, filename)) {
      // This existing public host's single literal lazy B1 route is sealed even
      // when the native fixture never takes its owner-gated initialization arm.
      requireGraph(imported.kind === 'static' || (imported.kind === 'dynamic-literal'
        && filename === 'packages/engine/dist/web/WebGPUHost.js' && imported.specifier === './b1.js'),
      'DYNAMIC_IMPORT_UNADMITTED', { path: filename, specifier: imported.specifier });
      const target = resolveProduct(imported.specifier, filename, 'import');
      const to = typeof target === 'object' ? visitDependency(target) : visitProduct(target);
      edges.push({ from: route, ...imported, to });
    }
    return route;
  }
  function visitDependency(target) {
    const dependency = dependencyOwners.get(target.dependency), route = dependency.routePrefix + target.relative;
    if (modules.has(route)) return route;
    const original = rawFileFingerprint(dependency.root, target.relative), record = { ...original, path: dependency.repositoryPath + '/' + target.relative };
    retain(record, 'dependency-module');
    modules.set(route, { ...record, route, owner: 'repository-dependency', kind: 'dependency' });
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(record.bodyBase64, 'base64'));
    for (const imported of literalImports(text, record.path)) {
      requireGraph(imported.kind === 'static' && (imported.specifier.startsWith('./') || imported.specifier.startsWith('../'))
        && imported.specifier.endsWith('.js'), 'DEPENDENCY_EDGE', { path: record.path, specifier: imported.specifier });
      const relative = logicalPath(path.posix.normalize(path.posix.join(path.posix.dirname(target.relative), imported.specifier)));
      const to = visitDependency({ dependency: dependency.name, relative }); edges.push({ from: route, ...imported, to });
    }
    return route;
  }
  function visitCollector(route) {
    if (modules.has(route)) return route;
    const record = servedCollector.get(route);
    requireGraph(record !== undefined, 'COLLECTOR_PRIVATE_IMPORT', { route });
    modules.set(route, { ...record, owner: 'repository', kind: 'collector' });
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(record.bodyBase64, 'base64'));
    for (const imported of literalImports(text, record.path)) {
      requireGraph(imported.kind === 'static', 'COLLECTOR_DYNAMIC_IMPORT');
      let to;
      if (imported.specifier.startsWith('./') || imported.specifier.startsWith('../')) {
        requireGraph(!literalScene && route === '/fixture.mjs' && imported.specifier === './native-observer.mjs', 'COLLECTOR_RELATIVE_IMPORT', { specifier: imported.specifier });
        to = visitCollector('/native-observer.mjs');
      } else {
        requireGraph(route === '/fixture.mjs' && (removeChildren || childIndex || addChildAt ? ['@egret/engine'] : nineSlice ? ['@egret/engine', '@egret/engine/webgpu', '@egret/engine/web']
          : ['@egret/engine', '@egret/engine/web/image']).includes(imported.specifier), 'COLLECTOR_PUBLIC_IMPORT', { specifier: imported.specifier });
        const target = publicTarget(imported.specifier, 'import'); alias(imported.specifier, target); to = visitProduct(target);
      }
      edges.push({ from: route, ...imported, to });
    }
    return route;
  }
  const commonEntries = removeChildren || childIndex || addChildAt ? ['@egret/engine'] : nineSlice ? ['@egret/engine', '@egret/engine/web'] : ['@egret/engine', '@egret/engine/web/image'];
  const backendRoots = [];
  for (const backend of scheduleData.backends) {
    const specifiers = [...commonEntries, backend === 'canvas' ? '@egret/engine/web' : '@egret/engine/webgpu'], roots = [];
    for (const specifier of specifiers) {
      const target = publicTarget(specifier, 'import'), declaration = publicTarget(specifier, 'types');
      requireGraph(declaration === target.replace(/\.js$/, '.d.ts'), 'ENTRY_TYPES_RELATION', { specifier });
      alias(specifier, target); roots.push(visitProduct(target)); entryAliases.push({ backend, specifier, route: '/' + target, declaration });
    }
    roots.push(visitCollector('/fixture.mjs')); if (!literalScene) roots.push(visitCollector('/native-observer.mjs'));
    backendRoots.push({ backend, roots });
  }
  if (dependencyOwners.has('robust-predicates')) aliases.set('robust-predicates', dependencyOwners.get('robust-predicates').routePrefix + 'index.js');
  const backendClosures = backendRoots.map(({ backend, roots }) => {
    const selected = new Set(), pending = [...roots];
    while (pending.length) {
      const route = pending.pop(); if (selected.has(route)) continue;
      requireGraph(modules.has(route), 'CLOSURE_ROUTE'); selected.add(route);
      for (const edge of edges) if (edge.from === route) pending.push(edge.to);
    }
    return { backend, roots, moduleRoutes: [...selected].sort() };
  });
  const moduleRoutes = [...modules.values()].sort((a, b) => a.route.localeCompare(b.route, 'en'));
  requireGraph(moduleRoutes.every(row => row.path.endsWith('.js') || row.path.endsWith('.mjs')), 'SERVED_EXTENSION');
  return freezeData({ schemaVersion: 1, status: 'FROZEN_INPUTS_NOT_EXECUTED', repositoryRoot: root,
    ...(literalScene ? { profile } : {}),
    filePins: [...files.values()].sort((a, b) => (a.owner + ':' + a.path).localeCompare(b.owner + ':' + b.path, 'en')),
    moduleRoutes, importMap: { imports: Object.fromEntries([...aliases].sort(([a], [b]) => a.localeCompare(b, 'en'))) },
    entryAliases, importEdges: edges, declarationEdges, backendClosures, fixturePins: originals, schedulePin: schedule,
    hostFilePins, packageOwners: [...packageRecords.values()].map(row => ({ name: row.data.name, owner: row.owner })),
    dependencyOwners: [...dependencyOwners.values()].map(row => ({ name: row.name, root: row.root, repositoryPath: row.repositoryPath, routePrefix: row.routePrefix })),
    counts: { files: files.size, modules: modules.size, declarations: declarations.size, sourceFiles: [...files.values()].filter(row => row.roles.includes('source')).length, totalBytes } });
}
