// SPDX-License-Identifier: Apache-2.0
import { Script } from 'node:vm';
import { logicalPath } from '../lib/file-identity.mjs';
import { hash, refuse } from './inspect.mjs';

const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const safeSegment = value =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);

function fail(message, details) {
  refuse('MIGRATE_THEME_FACTORIES', message, details);
}

function pathOf(value, suffix) {
  const key = logicalPath(value);
  if (!key.endsWith(suffix)) fail('Unexpected theme input extension.', { path: key });
  return key;
}

function className(value) {
  if (typeof value !== 'string' || !value || value.length > 512 || !value.split('.').every(safeSegment))
    fail('Expected a dotted EUI class name.');
  return value;
}

function ensureRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a theme manifest object.');
  return value;
}

function parse(read, key) {
  return ensureRecord(JSON.parse(decode(read(key).bytes)));
}

// Keep factory expressions unevaluated during migration. The application provides its authorised class environment.
function sourceForGjs(entries, namespaces, globalName) {
  const top = entries.map(row => row.className.split('.')[0]);
  const standalone = entries.filter(row => !row.className.includes('.')).map(row => row.className);
  const roots = [...new Set([...namespaces, ...top.filter(key => !standalone.includes(key))])];
  const reserved = new Set([
    'egret',
    'eui',
    '__extends',
    'runtime',
    'root',
    'definitions',
    'classes',
    'name',
    'globalThis',
    'Object',
    'Map',
    'Error',
    'expose',
    'space',
    'parts',
    'target',
    'Type'
  ]);
  if ([...roots, ...standalone].some(key => reserved.has(key)) || roots.some(key => standalone.includes(key)))
    fail('Factory namespaces conflict with the host environment.');
  const lines = [
    "'use strict';",
    '(function (root) {',
    '  if (Object.hasOwn(root, ' +
      JSON.stringify(globalName) +
      ')) throw new Error("Theme factory name is already occupied");',
    '  root[' + JSON.stringify(globalName) + '] = function createThemeFactories(runtime) {',
    '    const {egret, eui, __extends} = runtime;',
    ...roots.map(key => '    const ' + key + ' = Object.create(runtime[' + JSON.stringify(key) + '] ?? null);'),
    ...standalone.map(key => '    let ' + key + ';'),
    '    const space = {' + roots.join(',') + '};',
    '    function expose(name, Type) {',
    ...standalone.map(key => '      if (name === ' + JSON.stringify(key) + ') { ' + key + ' = Type; return; }'),
    '      const parts = name.split(".");',
    '      let target = space[parts[0]];',
    '      for (let i=1; i<parts.length-1; i++) {',
    '        if (!Object.hasOwn(target,parts[i])) target[parts[i]] = Object.create(target[parts[i]] ?? null);',
    '        target = target[parts[i]];',
    '      }',
    '      target[parts.at(-1)] = Type;',
    '    }',
    '    const definitions = new Map();',
    '    const classes = new Map();'
  ];
  for (const { className: name, gjs } of entries) {
    const expression = gjs.trim().replace(/;$/, '');
    // Verify exactly the expression form we will emit, without running constructor or project code.
    new Script('(' + expression + '\n)', { filename: name });
    lines.push('    definitions.set(' + JSON.stringify(name) + ', () => (\n' + expression + '\n));');
  }
  lines.push(
    '    return {',
    '      names() { return [...definitions.keys()]; },',
    '      get(name) {',
    '        if (!definitions.has(name)) throw Error("Missing theme constructor: " + name);',
    '        if (!classes.has(name)) { const Type=definitions.get(name)(); expose(name, Type); classes.set(name, Type); }',
    '        return classes.get(name);',
    '      }',
    '    };',
    '  };',
    '})(globalThis);',
    ''
  );
  const source = Buffer.from(lines.join('\n'));
  new Script(decode(source));
  return source;
}

/** Preserve a project-owned precompiled provider or the Egret 5 gjs release output. Static gaps remain in the build report. */
export function prepareThemeFactories(read, themePath, profilePath) {
  if (!themePath) fail('Select the original theme with --theme.');
  const profile = parse(read, pathOf(profilePath, '.json'));
  if (
    profile.schemaVersion !== 1 ||
    !['gjs', 'registry'].includes(profile.format) ||
    typeof profile.global !== 'string' ||
    !safeSegment(profile.global) ||
    !['project-owned', 'project-regenerated'].includes(profile.origin)
  ) {
    fail('Provide a named, project-owned or regenerated theme provider.');
  }
  const theme = parse(read, pathOf(themePath, '.json'));
  if (!Array.isArray(theme.exmls) || !theme.skins || typeof theme.skins !== 'object' || Array.isArray(theme.skins))
    fail('Expected the original theme with EXMLs and control mappings.');
  const declared = new Set();
  for (const value of [
    ...theme.exmls,
    ...Object.values(theme.skins).filter(name => typeof name === 'string' && name.endsWith('.exml'))
  ]) {
    declared.add(pathOf(value, '.exml'));
  }
  if (!declared.size || declared.size > 4096) fail('Expected 1 to 4096 original skin paths.');
  const providerPath = pathOf(profile.provider, profile.format === 'gjs' ? '.json' : '.js');
  const provider = read(providerPath);
  if (provider.identity.sha256 !== profile.sha256 || !/^[0-9a-f]{64}$/.test(profile.sha256))
    fail('The theme provider digest differs from the reviewed file.', { path: providerPath });
  let rows;
  if (profile.format === 'gjs') {
    rows = ensureRecord(JSON.parse(decode(provider.bytes))).exmls;
  } else {
    rows = profile.entries;
    try {
      new Script(decode(provider.bytes), { filename: providerPath });
    } catch (error) {
      fail('The reviewed provider cannot be parsed.', { path: providerPath, detail: error.message });
    }
  }
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 4096) fail('Expected 1 to 4096 factory entries.');
  const classes = new Set(),
    paths = new Set(),
    entries = [];
  for (const row of rows) {
    const key = pathOf(row?.path, '.exml');
    const name = className(row?.className);
    if (!declared.has(key) || paths.has(key) || classes.has(name))
      fail('Unknown or duplicate theme identity.', { path: key, className: name });
    if (profile.format === 'gjs' && (typeof row.gjs !== 'string' || !row.gjs.trim()))
      fail('Missing compiled expression.', { path: key });
    paths.add(key);
    classes.add(name);
    entries.push({
      path: key,
      className: name,
      ...(profile.format === 'gjs' ? { codeSha256: hash(Buffer.from(row.gjs)) } : {})
    });
  }
  const namespaces = profile.namespaces ?? [];
  const reserved = new Set([
    'egret',
    'eui',
    '__extends',
    'runtime',
    'root',
    'definitions',
    'classes',
    'name',
    'globalThis',
    'Object',
    'Map',
    'Error'
  ]);
  if (
    !Array.isArray(namespaces) ||
    namespaces.length > 64 ||
    new Set(namespaces).size !== namespaces.length ||
    namespaces.some(value => typeof value !== 'string' || !safeSegment(value) || reserved.has(value))
  )
    fail('Expected distinct JavaScript namespace names.');
  let source;
  try {
    source = profile.format === 'gjs' ? sourceForGjs(rows, namespaces, profile.global) : provider.bytes;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    fail('The reviewed theme contains invalid JavaScript.', { path: providerPath, detail: error.message });
  }
  const missingProviders = [...declared].filter(key => !paths.has(key));
  const unresolvedMappings = Object.entries(theme.skins)
    .filter(([, target]) => !paths.has(target) && !classes.has(target))
    .map(([control, target]) => ({ control, target }));
  return {
    source,
    manifest: {
      schemaVersion: 1,
      theme: themePath,
      format: profile.format,
      global: profile.global,
      ...(profile.after !== undefined ? { after: pathOf(profile.after, '.ts') } : {}),
      origin: profile.origin,
      provider: provider.identity,
      file: 'classic/theme-factories.js',
      bytes: source.length,
      sha256: hash(source),
      entries,
      skins: theme.skins,
      missingProviders,
      unresolvedMappings
    }
  };
}
