// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { logicalPath, ownerRelativePath, samePhysicalPath } from '../lib/file-identity.mjs';
import { hash, json, readProjectFile, refuse } from './inspect.mjs';
import { compileExml } from './exml.mjs';
import { collectSdkSurface } from './sdk-surface.mjs';
import { collectLegacyUses } from './api-usage.mjs';
import { prepareThemeFactories } from './precompiled-themes.mjs';

const fileLimit = 16 << 20;
const totalLimit = 64 << 20;
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const orderKey = value => {
  if (typeof value !== 'string' || !value.startsWith('bin-debug/') || !value.endsWith('.js'))
    refuse('MIGRATE_SOURCE_ORDER', 'Expected an original bin-debug/*.js entry.');
  return logicalPath('src/' + value.slice(10, -3) + '.ts');
};

function inside(owner, location) {
  const relative = path.relative(owner, location);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

// A closed input index lets the compiler resolve triple-slash references and
// standard libraries without traversing application-configured external paths.
function projectIndex(owner) {
  const files = new Map();
  const entries = new Map();
  let count = 0;
  function visit(dir) {
    const names = { files: [], directories: [] };
    entries.set(dir, names);
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (++count > 100_000) refuse('MIGRATE_INVENTORY_LIMIT', 'Too many files in the project.');
      const file = path.join(dir, item.name);
      if (item.isDirectory()) {
        names.directories.push(item.name);
        visit(file);
      } else if (item.isFile()) {
        names.files.push(item.name);
        if (item.name.endsWith('.ts')) files.set(file, ownerRelativePath(owner, file));
      } else refuse('MIGRATE_INPUT_FILE', 'The compiler requires regular project inputs.');
    }
  }
  const roots = ['src', 'libs'].filter(name => fs.readdirSync(owner).includes(name));
  entries.set(owner, { files: [], directories: roots });
  for (const name of roots) {
    const dir = path.join(owner, name);
    if (!fs.lstatSync(dir).isDirectory()) refuse('MIGRATE_INPUT_FILE', 'Expected a regular compiler input directory.');
    visit(dir);
  }
  return { files, entries };
}

function diagnostics(ts, list, owner, compilerDir) {
  const normalized = list.map(item => {
    let file = null,
      line = null,
      column = null;
    if (item.file) {
      const absolute = path.resolve(item.file.fileName);
      file = inside(owner, absolute)
        ? ownerRelativePath(owner, absolute)
        : 'compiler/' + ownerRelativePath(compilerDir, absolute);
      const pos = item.file.getLineAndCharacterOfPosition(item.start ?? 0);
      line = pos.line + 1;
      column = pos.character + 1;
    }
    let message = ts.flattenDiagnosticMessageText(item.messageText, '\n');
    for (const [base, name] of [
      [owner, '<project>'],
      [compilerDir, '<compiler>']
    ]) {
      message = message.replaceAll(base, name).replaceAll(base.split(path.sep).join('/'), name);
    }
    return { code: item.code, category: item.category, file, line, column, message };
  });
  return normalized.sort((a, b) => {
    const x = JSON.stringify(a),
      y = JSON.stringify(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

export function loadCompiler(owner, moduleFile, expectedHash, otherGameRoots = []) {
  const file = fs.realpathSync(path.resolve(moduleFile));
  if ([owner, ...otherGameRoots].some(root => inside(fs.realpathSync(root), file)) || !fs.lstatSync(file).isFile())
    refuse('MIGRATE_COMPILER', 'Use a separately installed, trusted Egret TypeScript-Plus compiler.');
  const sha256 = hash(fs.readFileSync(file));
  if (expectedHash !== undefined && expectedHash !== sha256)
    refuse('MIGRATE_COMPILER', 'The compiler module digest differs from the supplied SHA-256.');
  const ts = createRequire(import.meta.url)(file);
  if (
    typeof ts.reorderSourceFiles !== 'function' ||
    typeof ts.matchFiles !== 'function' ||
    typeof ts.createProgram !== 'function' ||
    typeof ts.version !== 'string'
  )
    refuse('MIGRATE_COMPILER', 'Expected the original Egret TypeScript-Plus compiler with reflection support.');
  return { ts, directory: path.dirname(file), identity: { version: ts.version, sha256 } };
}

function sourceProgram({ ts, directory }, owner, read, order, mode, target) {
  const index = projectIndex(owner);
  const cache = new Map();
  const stdlib = new Map();
  const library = filename =>
    path.dirname(filename) === directory && /^lib(?:\.[A-Za-z0-9.-]+)?\.d\.ts$/.test(path.basename(filename));
  function contents(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    let text;
    if (index.files.has(absolute)) text = decode(read(index.files.get(absolute)).bytes);
    else if (library(absolute) && fs.existsSync(absolute)) {
      const { bytes, identity } = readProjectFile(directory, path.basename(absolute), fileLimit);
      stdlib.set(identity.path, identity);
      text = decode(bytes);
    }
    if (text !== undefined) cache.set(absolute, text);
    return text;
  }
  const config = ts.parseConfigFileTextToJson('tsconfig.json', decode(read('tsconfig.json').bytes));
  if (config.error || !config.config || config.config.extends !== undefined)
    refuse('MIGRATE_COMPILER_CONFIG', 'Supply a self-contained project-local tsconfig.json.');
  const empty = { files: [], directories: [] };
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    {
      useCaseSensitiveFileNames: true,
      fileExists: file => index.files.has(path.resolve(file)),
      readFile: contents,
      readDirectory: (base, ext, excludes, includes) =>
        ts.matchFiles(base, ext, excludes, includes, true, owner, dir => index.entries.get(path.resolve(dir)) ?? empty)
    },
    owner
  );
  const options = { ...parsed.options };
  if (target === 'es2015') options.target = ts.ScriptTarget.ES2015;
  if (
    options.outFile ||
    options.out ||
    options.allowJs ||
    options.noEmit ||
    options.isolatedModules ||
    (options.module !== undefined && options.module !== ts.ModuleKind.None)
  )
    refuse('MIGRATE_COMPILER_CONFIG', 'Expected independently emitted classic TypeScript scripts.');
  Object.assign(options, {
    module: ts.ModuleKind.None,
    emitReflection: true,
    outDir: path.join(owner, 'bin-debug'),
    declaration: false,
    sourceMap: false,
    inlineSourceMap: false,
    noEmitOnError: false,
    newLine: ts.NewLineKind.LineFeed,
    defines: { ...options.defines, DEBUG: mode === 'debug', RELEASE: mode === 'release' }
  });
  const roots = parsed.fileNames.map(file => path.resolve(file));
  if (roots.some(file => !index.files.has(file)))
    refuse('MIGRATE_COMPILER_CONFIG', 'Config includes files outside src or libs.');
  const admitted = new Set(roots);
  for (const key of order)
    if (!admitted.has(path.join(owner, key)))
      refuse('MIGRATE_SOURCE_ORDER', 'The original tsconfig omits a manifest source.', { path: key });
  const host = ts.createCompilerHost(options);
  host.getCurrentDirectory = () => owner;
  host.fileExists = file => index.files.has(path.resolve(file)) || (library(path.resolve(file)) && fs.existsSync(file));
  host.directoryExists = dir => index.entries.has(path.resolve(dir)) || samePhysicalPath(path.resolve(dir), directory);
  host.getDirectories = dir => index.entries.get(path.resolve(dir))?.directories ?? [];
  host.readFile = contents;
  host.getSourceFile = (file, version) => {
    const text = contents(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, version, true);
  };
  host.writeFile = () => {
    throw Error('Unexpected compiler write outside the build transaction');
  };
  const program = ts.createProgram(roots, options, host);
  const external = program.getSourceFiles().find(file => !file.isDeclarationFile && ts.isExternalModule(file));
  if (external)
    refuse('MIGRATE_COMPILER_CONFIG', 'A classic script manifest cannot load an ES module.', {
      path: ownerRelativePath(owner, path.resolve(external.fileName))
    });
  const listed = new Set(order);
  const unlisted = roots
    .filter(file => !file.endsWith('.d.ts') && !listed.has(index.files.get(file)))
    .map(file => index.files.get(file));
  const fatal = diagnostics(
    ts,
    [...parsed.errors, ...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics()],
    owner,
    directory
  );
  if (fatal.length) refuse('MIGRATE_COMPILER_DIAGNOSTICS', 'Configuration or syntax errors prevent emission.', fatal);
  return { program, stdlib, unlisted, semantic: diagnostics(ts, program.getSemanticDiagnostics(), owner, directory) };
}

// With ES2015, classes are lexical global bindings. Classic Egret skin lookups
// also resolve them as properties on the host global. Install each named class
// immediately after its declaration, before later statements can look it up.
function exposeClassNames(ts, javascript) {
  const file = ts.createSourceFile('classic.js', javascript, ts.ScriptTarget.ES2015, true, ts.ScriptKind.JS);
  let end = 0;
  const parts = [];
  for (const statement of file.statements) {
    if (statement.kind !== ts.SyntaxKind.ClassDeclaration || !statement.name) continue;
    const name = statement.name.getText(file);
    parts.push(
      javascript.slice(end, statement.end),
      '\nglobalThis[' + JSON.stringify(statement.name.text) + '] = ' + name + ';'
    );
    end = statement.end;
  }
  parts.push(javascript.slice(end));
  return parts.join('');
}

function scriptGroups(order, artifacts, config) {
  if (!Array.isArray(config))
    refuse('MIGRATE_SCRIPT_GROUPS', 'Expected an ordered array of deferred suffix boundaries.');
  const boundaries = new Map(),
    names = new Set();
  let previous = -1;
  for (const item of config) {
    const index = order.indexOf(item?.from);
    if (
      index <= previous ||
      typeof item?.name !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(item.name) ||
      names.has(item.name)
    )
      refuse('MIGRATE_SCRIPT_GROUPS', 'Each deferred group needs a unique name and an increasing source boundary.');
    boundaries.set(index, item.name);
    names.add(item.name);
    previous = index;
  }
  const startup = [],
    groups = Object.create(null);
  let group = startup;
  for (const [index, asset] of artifacts.entries()) {
    if (boundaries.has(index)) group = groups[boundaries.get(index)] = [];
    group.push(asset.file);
  }
  return { startup, groups };
}

function staticSkins(read, themeKey) {
  if (!themeKey) return undefined;
  const theme = JSON.parse(decode(read(logicalPath(themeKey)).bytes));
  if (!Array.isArray(theme.exmls) || !theme.skins || typeof theme.skins !== 'object' || Array.isArray(theme.skins))
    refuse('MIGRATE_THEME_UNSUPPORTED', 'Expected local theme exmls and skins.');
  const paths = new Set([
    ...theme.exmls,
    ...Object.values(theme.skins).filter(x => typeof x === 'string' && x.endsWith('.exml'))
  ]);
  if (paths.size > 4096) refuse('MIGRATE_THEME_UNSUPPORTED', 'Too many declared skin paths.');
  const exmls = [],
    gaps = [],
    classes = new Set();
  for (const name of paths) {
    if (typeof name !== 'string' || !name.endsWith('.exml')) {
      gaps.push({ reason: 'non-local-entry' });
      continue;
    }
    try {
      const skin = compileExml(decode(read(logicalPath(name)).bytes), { path: name });
      if (skin.className && classes.has(skin.className)) {
        gaps.push({ path: name, reason: 'duplicate-class' });
        continue;
      }
      if (skin.className) classes.add(skin.className);
      exmls.push(skin);
    } catch (error) {
      if (!['MIGRATE_EXML_UNSUPPORTED', 'MIGRATE_INPUT_FILE'].includes(error.code)) throw error;
      gaps.push({
        path: name,
        reason: error.code,
        message: error.message,
        ...(Number.isInteger(error.details?.offset) ? { offset: error.details.offset } : {})
      });
    }
  }
  const admittedPaths = new Set(exmls.map(skin => skin.sourcePath));
  const skins = Object.create(null),
    unresolvedMappings = [];
  for (const [control, target] of Object.entries(theme.skins)) {
    if (classes.has(target) || admittedPaths.has(target)) skins[control] = target;
    else unresolvedMappings.push({ control, target, themePath: themeKey });
  }
  return { themePath: themeKey, skins, exmls, gaps, unresolvedMappings };
}

export function compileClassic({
  source,
  compiler,
  compilerSha256,
  out,
  baseline,
  groups = [],
  theme,
  themeFactories,
  compiledTheme,
  mode = 'debug',
  target = 'config'
}) {
  const owner = fs.realpathSync(path.resolve(source));
  if (mode !== 'debug' && mode !== 'release') refuse('MIGRATE_ARGUMENTS', 'Expected --mode debug or release.');
  if (target !== 'config' && target !== 'es2015') refuse('MIGRATE_ARGUMENTS', 'Expected --target config or es2015.');
  const destination = path.resolve(out);
  const parent = fs.realpathSync(path.dirname(destination));
  if (!samePhysicalPath(path.dirname(destination), parent) || inside(owner, destination) || fs.existsSync(destination))
    refuse('MIGRATE_OUTPUT', 'Use a new output directory outside the original project.');
  const inputs = new Map();
  let inputBytes = 0;
  function read(key) {
    if (!inputs.has(key)) {
      const record = readProjectFile(owner, key, fileLimit);
      inputBytes += record.bytes.length;
      if (inputBytes > 256 << 20) refuse('MIGRATE_INVENTORY_LIMIT', 'Compiler inputs exceed 256 MiB.');
      inputs.set(key, record);
    }
    return inputs.get(key);
  }
  const properties = JSON.parse(decode(read('egretProperties.json').bytes));
  if (!/^5\.3\.\d+$/.test(properties.engineVersion) || properties.compilerVersion !== properties.engineVersion)
    refuse('MIGRATE_VERSION_UNSUPPORTED', 'Expected matching Egret 5.3.x engine and compiler declarations.');
  const manifest = JSON.parse(decode(read('manifest.json').bytes));
  if (
    !Array.isArray(manifest.initial) ||
    manifest.initial.length > 4096 ||
    !Array.isArray(manifest.game) ||
    !manifest.game.length ||
    manifest.game.length > 4095
  )
    refuse('MIGRATE_SOURCE_ORDER', 'Expected a bounded initial/game script manifest.');
  const order = manifest.game.map(orderKey);
  if (new Set(order.map(item => item.toLowerCase())).size !== order.length)
    refuse('MIGRATE_SOURCE_ORDER', 'Duplicate source identity.');
  const initial = manifest.initial.map(logicalPath);
  if (
    initial.some(key => !key.endsWith('.js')) ||
    new Set(initial.map(key => key.toLowerCase())).size !== initial.length
  )
    refuse('MIGRATE_SOURCE_ORDER', 'Expected unique classic scripts in the original initial manifest.');
  const dependencies = initial.map(key => {
    if (!fs.existsSync(path.join(owner, key))) return { path: key, action: 'missing-original-adapter' };
    return { ...read(key).identity, action: 'supply-compatible-adapter-before-game-scripts' };
  });
  const tool = loadCompiler(owner, compiler, compilerSha256);
  const { program, semantic, stdlib, unlisted } = sourceProgram(tool, owner, read, order, mode, target);
  if (
    baseline !== undefined &&
    (baseline.compiler?.sha256 !== tool.identity.sha256 ||
      baseline.engineVersion !== properties.engineVersion ||
      baseline.mode !== mode ||
      (baseline.target ?? 'config') !== target ||
      JSON.stringify(semantic) !== JSON.stringify(baseline.diagnostics))
  ) {
    refuse('MIGRATE_DIAGNOSTIC_BASELINE', 'The selected diagnostic baseline differs from this compile.', {
      diagnostics: semantic
    });
  }
  const skins = staticSkins(read, theme);
  if (themeFactories && compiledTheme) refuse('MIGRATE_ARGUMENTS', 'Select a single theme provider.');
  let factory;
  if (compiledTheme) {
    const generated = fs.realpathSync(path.resolve(compiledTheme));
    const readProvider = key => readProjectFile(generated, key, fileLimit);
    const profile = JSON.parse(decode(readProvider('profile.json').bytes));
    const themeBuild = readProvider('theme-build.json');
    if (profile.origin !== 'project-regenerated' || themeBuild.identity.sha256 !== profile.buildReportSha256)
      refuse('MIGRATE_THEME_FACTORIES', 'Expected the matching build report for a regenerated theme.');
    const receipt = JSON.parse(decode(themeBuild.bytes));
    if (!Array.isArray(receipt.bootstrapInputs)) refuse('MIGRATE_THEME_FACTORIES', 'Missing theme bootstrap inputs.');
    // Game classes and project metadata loaded by the original SDK influence its EUI output.
    for (const input of receipt.bootstrapInputs) {
      const key = logicalPath(input.path);
      if (
        !fs.existsSync(path.join(owner, key)) ||
        readProjectFile(owner, key, fileLimit).identity.sha256 !== input.sha256
      )
        refuse('MIGRATE_THEME_FACTORIES', 'A theme bootstrap dependency changed. Regenerate the theme.', { path: key });
    }
    for (const key of profile.unavailableSources ?? []) {
      if (fs.existsSync(path.join(owner, logicalPath(key))))
        refuse('MIGRATE_THEME_FACTORIES', 'A previously missing skin has arrived. Regenerate the theme.', {
          path: key
        });
    }
    for (const row of profile.unresolvedSources ?? []) {
      if (read(logicalPath(row.path)).identity.sha256 !== row.sha256)
        refuse('MIGRATE_THEME_FACTORIES', 'A previously failing skin changed. Regenerate the theme.', {
          path: row.path
        });
    }
    factory = prepareThemeFactories(read, theme, 'profile.json', readProvider);
  } else if (themeFactories) factory = prepareThemeFactories(read, theme, themeFactories);
  const temp = fs.mkdtempSync(path.join(parent, '.egret-classic-'));
  try {
    fs.mkdirSync(path.join(temp, 'classic'));
    const slots = new Map(order.map((key, ix) => [key, ix]));
    const artifacts = new Array(order.length);
    const apiUses = new Map();
    const projectDefinitions = [];
    let total = 0;
    // The callback is the compiler's only output sink. Each classic script keeps
    // its own top-level directive and declaration boundary, even when deferred.
    const result = program.emit(undefined, (filename, text, bom, _error, sources) => {
      if (!filename.endsWith('.js')) return;
      if (sources?.length !== 1)
        refuse('MIGRATE_COMPILER_EMIT', 'The compiler must identify one original source per script.');
      const key = ownerRelativePath(owner, path.resolve(sources[0].fileName));
      const ix = slots.get(key);
      if (ix === undefined) return;
      if (artifacts[ix]) refuse('MIGRATE_COMPILER_EMIT', 'More than one emit for a manifest script.', { path: key });
      if (target === 'es2015') text = exposeClassNames(tool.ts, text);
      const bytes = Buffer.from((bom ? '\uFEFF' : '') + text);
      total += bytes.length;
      if (bytes.length > fileLimit || total > totalLimit)
        refuse('MIGRATE_SCRIPT_BUDGET', 'Classic scripts exceed the V8 byte budget.');
      new Script(text, { filename: key }); // Parse only; the business code never runs here.
      const file = 'classic/' + String(ix).padStart(4, '0') + '.js';
      collectLegacyUses(tool.ts, apiUses, text, file, projectDefinitions);
      fs.writeFileSync(path.join(temp, file), bytes);
      artifacts[ix] = {
        source: key,
        sourceSha256: read(key).identity.sha256,
        file,
        bytes: bytes.length,
        sha256: hash(bytes)
      };
    });
    if (result.emitSkipped || result.diagnostics.length || artifacts.includes(undefined))
      refuse('MIGRATE_COMPILER_EMIT', 'The compiler did not emit every manifest script.');
    const plan = { v8Scripts: scriptGroups(order, artifacts, groups) };
    if (factory) {
      if (
        artifacts.length + 2 > 4096 ||
        factory.source.length > fileLimit ||
        factory.source.length + total > totalLimit
      )
        refuse('MIGRATE_SCRIPT_BUDGET', 'The selected theme exceeds the V8 script budget.');
      const { file, after } = factory.manifest;
      const placement = after && artifacts.find(item => item.source === after)?.file;
      if (after && !placement)
        refuse('MIGRATE_THEME_FACTORIES', 'Unknown original script for theme insertion.', { after });
      const group = placement
        ? [plan.v8Scripts.startup, ...Object.values(plan.v8Scripts.groups)].find(files => files.includes(placement))
        : plan.v8Scripts.startup;
      group.splice(placement ? group.indexOf(placement) + 1 : group.length, 0, file);
      fs.writeFileSync(path.join(temp, file), factory.source);
      fs.writeFileSync(path.join(temp, 'theme-factories.json'), json(factory.manifest));
    }
    if (Buffer.byteLength(json(plan)) > 65536)
      refuse('MIGRATE_SCRIPT_BUDGET', 'Generated V8 script manifest exceeds 64 KiB.');
    fs.writeFileSync(path.join(temp, 'v8-scripts.json'), json(plan));
    const usage = [...apiUses.values()].sort((a, b) => b.uses - a.uses || a.namespace.localeCompare(b.namespace));
    fs.writeFileSync(path.join(temp, 'api-usage.json'), json(usage));
    const declarations = collectSdkSurface(tool.ts, program, owner);
    fs.writeFileSync(path.join(temp, 'sdk-surface.json'), json(declarations));
    const declared = new Set(declarations.entries.map(entry => entry.name));
    const methods = new Map();
    for (const { namespace, name, ...location } of projectDefinitions) {
      const key = namespace + '.' + name;
      if (!methods.has(key)) methods.set(key, { namespace, name, definitions: [] });
      methods.get(key).definitions.push(location);
    }
    const candidates = [],
      conflicts = [];
    for (const method of methods.values()) {
      const safeName =
        /^[A-Za-z_$][\w$]*$/.test(method.name) && !['__proto__', 'constructor', 'prototype'].includes(method.name);
      if (!safeName || declared.has(method.namespace + '.' + method.name)) conflicts.push(method);
      else candidates.push(method);
    }
    const projectMethodReport = { schemaVersion: 1, candidates, conflicts };
    fs.writeFileSync(path.join(temp, 'project-methods.json'), json(projectMethodReport));
    if (skins) fs.writeFileSync(path.join(temp, 'static-skins.json'), json(skins));
    const report = {
      schemaVersion: 1,
      status: 'compiled-unlinked',
      engineVersion: properties.engineVersion,
      mode,
      target,
      compiler: tool.identity,
      originals: [...inputs.values()]
        .map(x => x.identity)
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      standardLibraries: [...stdlib.values()],
      artifacts,
      bytes: total,
      dependencies,
      unlistedConfigScripts: unlisted,
      diagnostics: semantic,
      diagnosticStatus: baseline !== undefined ? 'matched' : semantic.length ? 'needs-review' : 'clean',
      projectMethods: { candidates: candidates.length, conflicts: conflicts.length, details: 'project-methods.json' },
      namespaceReferences: { paths: usage.length, details: 'api-usage.json' },
      sdkDeclarations: {
        sources: declarations.sources.length,
        entries: declarations.entries.length,
        details: 'sdk-surface.json'
      },
      ...(factory
        ? {
            themeFactories: {
              entries: factory.manifest.entries.length,
              unresolved: factory.manifest.missingProviders.length,
              details: 'theme-factories.json',
              bytes: factory.source.length
            }
          }
        : {}),
      staticSkins: skins
        ? {
            accepted: skins.exmls.length,
            review: skins.gaps.length,
            unresolvedMappings: skins.unresolvedMappings.length,
            details: 'static-skins.json'
          }
        : null,
      remaining: ['link-engine-and-host-adapters', 'install-admitted-skins', 'verify-gameplay-and-host-services']
    };
    fs.writeFileSync(path.join(temp, 'classic-build.json'), json(report));
    fs.renameSync(temp, destination);
    return {
      status: report.status,
      scripts: artifacts.length,
      bytes: total,
      diagnostics: semantic.length,
      diagnosticStatus: report.diagnosticStatus,
      staticSkins: report.staticSkins,
      ...(factory ? { themeFactories: report.themeFactories } : {})
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
