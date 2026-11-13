// SPDX-License-Identifier: Apache-2.0
// A clean consumer of the preview distribution. The three packages of the default engine are packed
// with the pinned package manager, installed into a new project outside this checkout, and used
// there: the unmodified public examples run, every declared entry resolves and loads from the
// installed copy, the minimal route stays free of the optional parts, and a strict consumer compiles.
//
//   pnpm exec node tools/verify-clean-consumer.mjs <new absolute directory outside the checkout> [--offline]
//
//   --offline  take the one third-party dependency from the installed copy of this checkout, and
//              install without the registry. Without it the registry supplies that dependency.
//
// Build first (node tools/build.mjs): the archives carry the built modules of this checkout.
// The report is printed and written to <directory>/report.json. Rows it does not establish are
// listed under "open"; a pass here is not a publication, a browser run or a human walkthrough.
// tools/verify-clean-consumer-page.mjs goes on from here and opens a page of the consumer in a browser.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
/** Packed in dependency order. Only the last is a dependency the consumer declares. */
export const PACKAGES = ['contracts', 'runtime', 'engine'];
export const THIRD_PARTY = { name: 'robust-predicates', version: '3.0.3', owner: 'packages/engine' };
/** Public examples that need no browser, with the entries each one imports. */
export const EXAMPLES = [
  { file: 'examples/headless.mjs', entries: ['@egret/engine'] },
  { file: 'examples/layout-headless.mjs', entries: ['@egret/engine', '@egret/engine/layout'] },
];
/** Packages of this repository and of its optional features that the default engine must not bring in. */
export const OPTIONAL_PACKAGES = ['@egret/spine', '@egret/project', '@esotericsoftware/spine-core', 'jsonc-parser'];
// Variables that would load other code into a child process or change what it resolves.
const FOREIGN = /^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i;
// An argument cmd.exe passes on unchanged.
const PLAIN = /^[A-Za-z0-9_.:\\/@=~+-]+$/;

function refuse(code, message) { return Object.assign(new Error(code + ': ' + message), { code }); }
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const within = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

/**
 * The files of a packed archive, in the order stored. Long names arrive as a POSIX extended
 * header or as a GNU long-name record before the file they name.
 */
export function readArchive(bytes) {
  const tar = zlib.gunzipSync(bytes), files = [];
  const text = (offset, length) => { const field = tar.subarray(offset, offset + length), end = field.indexOf(0); return field.subarray(0, end < 0 ? length : end).toString('utf8'); };
  let offset = 0, named = null;
  while (offset + 512 <= tar.length) {
    if (tar.subarray(offset, offset + 512).every(byte => byte === 0)) break;
    const size = parseInt(text(offset + 124, 12).trim() || '0', 8), type = text(offset + 156, 1) || '0';
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw refuse('CLEAN_CONSUMER_ARCHIVE_INVALID', 'a record of the archive is cut short');
    const body = tar.subarray(offset + 512, offset + 512 + size);
    if (type === 'x') {
      // "<length> <key>=<value>\n", the length counting the whole record.
      for (let at = 0; at < body.length;) {
        const space = body.indexOf(0x20, at), length = Number(body.subarray(at, space).toString('latin1'));
        if (space < 0 || !Number.isSafeInteger(length) || length <= 0) throw refuse('CLEAN_CONSUMER_ARCHIVE_INVALID', 'an extended header of the archive is malformed');
        const record = body.subarray(space + 1, at + length - 1).toString('utf8'), equals = record.indexOf('=');
        if (record.slice(0, equals) === 'path') named = record.slice(equals + 1);
        at += length;
      }
    } else if (type === 'L') named = body.subarray(0, body.indexOf(0) < 0 ? body.length : body.indexOf(0)).toString('utf8');
    else {
      const prefix = text(offset + 345, 155), name = named ?? (prefix ? prefix + '/' : '') + text(offset, 100);
      named = null;
      if (type === '0' || type === '\0') files.push({ path: name, bytes: size, sha256: sha256(body), content: body });
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * The directory the run may write: absolute, new or empty, outside the checkout, and under no
 * directory from which this project's packages or a workspace would be found.
 */
export function admitOutput(checkout, directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw refuse('CLEAN_CONSUMER_OUTPUT_RELATIVE', 'name the output directory by an absolute path');
  const target = path.resolve(directory);
  if (within(checkout, target) || within(target, checkout)) throw refuse('CLEAN_CONSUMER_OUTPUT_INSIDE', 'the output directory and the checkout must be apart');
  if (fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length > 0)) throw refuse('CLEAN_CONSUMER_OUTPUT_USED', 'the output directory must be new or empty');
  for (let parent = path.dirname(target); ; parent = path.dirname(parent)) {
    for (const found of ['node_modules/@egret', 'pnpm-workspace.yaml']) if (fs.existsSync(path.join(parent, found))) throw refuse('CLEAN_CONSUMER_OUTPUT_SHADOWED', path.join(parent, found) + ' would be found from the consumer');
    if (parent === path.dirname(parent)) break;
  }
  return target;
}

/**
 * What an entry loaded, judged against the separation the distribution declares: an entry that is
 * not a web entry loads no web module, an entry that is not a 3D entry loads no 3D module, the
 * entries that draw nothing do not load the geometry dependency, and nothing comes from outside the consumer.
 */
export function separationFaults(entry, loaded, { draws }) {
  const faults = [], web = entry.split('/').some(part => part === 'web' || part === 'webgl2' || part === 'webgpu'), world = entry.includes('world3d');
  for (const file of loaded) {
    if (file.outside) faults.push(entry + ' loads ' + file.path + ' from outside the consumer');
    if (!web && file.package === '@egret/engine' && file.path.startsWith('dist/web/')) faults.push(entry + ' loads the web module ' + file.path);
    if (!world && /world3d/i.test(file.path)) faults.push(entry + ' loads the 3D module ' + file.path);
    if (!draws && file.package === THIRD_PARTY.name) faults.push(entry + ' loads ' + THIRD_PARTY.name);
    if (OPTIONAL_PACKAGES.includes(file.package)) faults.push(entry + ' loads the optional package ' + file.package);
  }
  return faults;
}

function childEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (FOREIGN.test(key)) delete env[key];
  return env;
}
function node(args, cwd) { return spawnSync(process.execPath, args, { cwd, env: childEnvironment(), encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }); }

/** The pinned package manager: the one that invoked this tool, or the one on the path. */
function packageManager(pinned) {
  const env = childEnvironment(), cli = process.env.npm_execpath;
  let run;
  if (cli && path.isAbsolute(cli) && fs.existsSync(cli)) {
    let metadata = null; try { metadata = JSON.parse(fs.readFileSync(path.resolve(path.dirname(cli), '../package.json'), 'utf8')); } catch { /* another manager */ }
    if (metadata?.name === 'pnpm') run = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8', windowsHide: true });
  }
  run ??= process.platform === 'win32'
    ? (args, cwd) => {
      // cmd.exe starts the command file of the manager. Only arguments it passes on unchanged are sent.
      const odd = args.find(argument => !PLAIN.test(argument));
      if (odd !== undefined) throw refuse('CLEAN_CONSUMER_ARGUMENT', JSON.stringify(odd) + ' cannot be passed through cmd.exe; invoke this tool with "pnpm exec node"');
      return spawnSync('cmd.exe', ['/d', '/c', 'pnpm', ...args], { cwd, env, encoding: 'utf8', windowsHide: true });
    }
    : (args, cwd) => spawnSync('pnpm', args, { cwd, env, encoding: 'utf8' });
  const version = run(['--version'], repository);
  if (version.error || version.status !== 0 || 'pnpm@' + version.stdout.trim() !== pinned) throw refuse('CLEAN_CONSUMER_MANAGER', 'the pinned ' + pinned + ' is required; found ' + JSON.stringify(version.stdout?.trim() ?? String(version.error)));
  return (args, cwd) => {
    const result = run(args, cwd);
    if (result.error || result.status !== 0) throw refuse('CLEAN_CONSUMER_COMMAND', 'pnpm ' + args[0] + ' failed in ' + cwd + '\n' + (result.stdout ?? '') + (result.stderr ?? '') + (result.error ?? ''));
    return result;
  };
}

/** Packs one directory and returns the archive it added to the destination. */
function pack(pnpm, source, destination) {
  const before = new Set(fs.readdirSync(destination));
  pnpm(['pack', '--pack-destination', destination], source);
  const added = fs.readdirSync(destination).filter(name => !before.has(name) && name.endsWith('.tgz'));
  if (added.length !== 1) throw refuse('CLEAN_CONSUMER_PACK', 'packing ' + source + ' added ' + JSON.stringify(added));
  return added[0];
}

// Runs inside the consumer. It names what one entry resolves to and every module its import loads.
const PROBE = `import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
const loaded = [];
registerHooks({ load(url, context, next) { if (url.startsWith('file:')) loaded.push(fs.realpathSync(fileURLToPath(url))); return next(url, context); } });
const entry = process.argv[2], result = { entry, resolved: null, loaded, error: null };
try { result.resolved = fs.realpathSync(fileURLToPath(import.meta.resolve(entry))); await import(entry); } catch (error) { result.error = String(error?.stack ?? error); }
process.stdout.write(JSON.stringify(result));
`;
// A strict consumer of the default entry and of the optional entry. The last statement must be an
// error: types that silently became "any" would accept it, and the unused directive would then fail.
const STRICT = `import { DisplayObjectContainer, createEngine, type Engine } from '@egret/engine';
import { planLinearLayout, type LinearLayoutPlan } from '@egret/engine/layout';
export async function attach(engine: Engine): Promise<number> {
  const panel = new DisplayObjectContainer();
  engine.stage.addChild(panel);
  return panel.numChildren;
}
export type Plan = LinearLayoutPlan;
export const start: typeof createEngine = createEngine;
// @ts-expect-error a plan needs its options
planLinearLayout();
`;
const STRICT_CONFIG = { compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', lib: ['ES2023', 'DOM'], types: [], skipLibCheck: false }, files: ['strict.ts'] };

/**
 * Runs the whole check. Returns the report; "ok" is true when every row passed.
 */
export function verifyCleanConsumer({ output, offline = false }) {
  const root = admitOutput(repository, output), manifest = JSON.parse(fs.readFileSync(path.join(repository, 'package.json'), 'utf8'));
  if (process.versions.node !== manifest.engines.node) throw refuse('CLEAN_CONSUMER_NODE', 'Node ' + manifest.engines.node + ' is required; this is ' + process.versions.node);
  const packages = PACKAGES.map(name => ({ directory: path.join(repository, 'packages', name), manifest: JSON.parse(fs.readFileSync(path.join(repository, 'packages', name, 'package.json'), 'utf8')) }));
  for (const item of packages) {
    // A script that runs while packing would make the archive something other than the built tree.
    const scripts = Object.keys(item.manifest.scripts ?? {}).filter(name => /^(?:pre|post)?(?:pack|publish|prepare)/.test(name) || name === 'prepare');
    if (scripts.length > 0) throw refuse('CLEAN_CONSUMER_SCRIPTS', item.manifest.name + ' declares ' + scripts.join(', '));
    for (const [entry, target] of Object.entries(item.manifest.exports)) for (const file of [target.import, target.types]) if (!fs.existsSync(path.join(item.directory, file))) throw refuse('CLEAN_CONSUMER_NOT_BUILT', item.manifest.name + ' ' + entry + ' has no ' + file + '; run node tools/build.mjs');
  }
  const pnpm = packageManager(manifest.packageManager);
  fs.mkdirSync(root, { recursive: true });
  const real = fs.realpathSync(root), archives = path.join(real, 'archives'), consumer = path.join(real, 'consumer'), checkout = fs.realpathSync(repository);
  fs.mkdirSync(archives); fs.mkdirSync(consumer);
  const rows = [], row = (name, faults, detail = {}) => rows.push({ name, ok: faults.length === 0, faults, ...detail });

  // 1. The distribution: one archive for each package, as the package manager packs it.
  const packed = [], archiveFaults = [];
  for (const item of packages) {
    const file = pack(pnpm, item.directory, archives), bytes = fs.readFileSync(path.join(archives, file)), files = readArchive(bytes);
    const names = new Set(files.map(entry => entry.path)), stored = files.find(entry => entry.path === 'package/package.json');
    if (!stored) archiveFaults.push(file + ' has no package.json');
    // The manager writes the version of each workspace dependency. A reference left as it was would not install anywhere else.
    else for (const [name, range] of Object.entries(JSON.parse(stored.content.toString('utf8')).dependencies ?? {})) if (!/^\d+\.\d+\.\d+$/.test(range)) archiveFaults.push(file + ' depends on ' + name + ' at ' + range);
    for (const [entry, target] of Object.entries(item.manifest.exports)) for (const part of [target.import, target.types]) if (!names.has('package/' + part.replace(/^\.\//, ''))) archiveFaults.push(file + ' lacks ' + part + ' of ' + entry);
    const licences = files.filter(entry => /^package\/(?:LICEN[CS]E|NOTICE)[^/]*$/i.test(entry.path)).map(entry => entry.path.slice('package/'.length));
    if (!licences.includes('LICENSE')) archiveFaults.push(file + ' carries no LICENSE');
    const kinds = {};
    for (const entry of files) { const top = entry.path.split('/')[1]; kinds[top] = (kinds[top] ?? 0) + 1; }
    packed.push({ package: item.manifest.name, version: item.manifest.version, file, bytes: bytes.length, sha256: sha256(bytes), files: files.length, contents: kinds, licences });
  }
  let thirdParty;
  if (offline) {
    const installed = path.join(repository, THIRD_PARTY.owner, 'node_modules', THIRD_PARTY.name), found = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    if (found.name !== THIRD_PARTY.name || found.version !== THIRD_PARTY.version) throw refuse('CLEAN_CONSUMER_THIRD_PARTY', 'the installed ' + THIRD_PARTY.name + ' is ' + found.version);
    const file = pack(pnpm, fs.realpathSync(installed), archives), bytes = fs.readFileSync(path.join(archives, file));
    thirdParty = { ...THIRD_PARTY, source: 'the installed copy of this checkout, packed again', file, bytes: bytes.length, sha256: sha256(bytes) };
  } else thirdParty = { ...THIRD_PARTY, source: 'the registry' };
  delete thirdParty.owner;
  row('archives', archiveFaults, { archives: packed, thirdParty });

  // 2. The consumer: a project of its own that declares the engine and nothing else.
  const local = file => 'file:../archives/' + file, engine = packed.at(-1);
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'egret-clean-consumer', version: '0.0.0', private: true, type: 'module', dependencies: { [engine.package]: local(engine.file) } }, null, 2) + '\n');
  // The packages are not published. The archive of each one stands in for the version the engine asks for.
  const overrides = packed.slice(0, -1).map(item => [item.package, local(item.file)]);
  if (offline) overrides.push([thirdParty.name, local(thirdParty.file)]);
  fs.writeFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'packages: []\noverrides:\n' + overrides.map(([name, target]) => "  '" + name + "': " + target + '\n').join(''));
  for (const example of EXAMPLES) fs.copyFileSync(path.join(repository, example.file), path.join(consumer, path.basename(example.file)));
  fs.writeFileSync(path.join(consumer, 'probe.mjs'), PROBE);
  fs.writeFileSync(path.join(consumer, 'strict.ts'), STRICT);
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify(STRICT_CONFIG, null, 2) + '\n');
  // A continuous-integration machine would otherwise demand a lock file that a new project cannot have.
  pnpm(['install', '--ignore-scripts', '--no-frozen-lockfile', ...(offline ? ['--offline'] : [])], consumer);
  const store = path.join(consumer, 'node_modules', '.pnpm'), installed = fs.existsSync(store) ? fs.readdirSync(store).filter(name => !name.startsWith('.') && name !== 'node_modules' && name !== 'lock.yaml') : [];
  const installFaults = [];
  if (!fs.existsSync(path.join(consumer, 'pnpm-lock.yaml'))) installFaults.push('the install wrote no lock file');
  for (const name of OPTIONAL_PACKAGES) if (installed.some(directory => directory.startsWith(name.replace('/', '+') + '@'))) installFaults.push('the optional package ' + name + ' was installed');
  if (installed.length !== PACKAGES.length + 1) installFaults.push('expected ' + (PACKAGES.length + 1) + ' installed packages, found ' + installed.length);
  row('install', installFaults, { mode: offline ? 'offline' : 'registry', installed: installed.length, declared: [engine.package] });

  // 3. Every declared entry of the engine, resolved and loaded from the installed copy.
  const describe = file => {
    if (!within(consumer, file)) return { outside: true, package: null, path: file };
    const parts = file.split(path.sep), at = parts.lastIndexOf('node_modules'), scoped = parts[at + 1].startsWith('@');
    return { outside: false, package: parts.slice(at + 1, at + (scoped ? 3 : 2)).join('/'), path: parts.slice(at + (scoped ? 3 : 2)).join('/') };
  };
  const entries = [], entryFaults = [], separation = [];
  for (const [subpath, target] of Object.entries(packages.at(-1).manifest.exports)) {
    const entry = engine.package + subpath.slice(1), probe = node(['probe.mjs', entry], consumer);
    let result = null; try { result = JSON.parse(probe.stdout); } catch { /* reported below */ }
    if (probe.status !== 0 || result === null) { entryFaults.push(entry + ' could not be probed: ' + probe.stderr); continue; }
    if (result.error !== null) { entryFaults.push(entry + ' does not load: ' + result.error.split('\n')[0]); continue; }
    const resolved = describe(result.resolved), loaded = result.loaded.filter(file => file !== path.join(consumer, 'probe.mjs')).map(describe);
    if (resolved.outside || within(checkout, result.resolved)) entryFaults.push(entry + ' resolves to ' + result.resolved);
    else if (resolved.package !== engine.package || './' + resolved.path !== target.import) entryFaults.push(entry + ' resolves to ' + resolved.path + ', declared ' + target.import);
    const types = path.join(path.dirname(result.resolved), path.relative(path.dirname(target.import), target.types));
    if (!fs.existsSync(types)) entryFaults.push(entry + ' has no installed ' + target.types);
    // Only the two 2D back ends tessellate, so only they may load the geometry dependency.
    separation.push(...separationFaults(entry, loaded, { draws: /\/(?:webgl2|webgpu)$/.test(entry) }));
    let raw = 0, gzip = 0;
    for (const file of result.loaded) if (file !== path.join(consumer, 'probe.mjs')) { const bytes = fs.readFileSync(file); raw += bytes.length; gzip += zlib.gzipSync(bytes, { level: 9 }).length; }
    entries.push({ entry, module: target.import, types: target.types, modules: loaded.length, bytes: raw, gzipBytes: gzip, packages: [...new Set(loaded.map(file => file.package))].sort() });
  }
  row('entries', entryFaults, { count: entries.length, measure: 'the modules one import loads in Node, unbundled; gzip is each file at level 9, summed', entries });
  row('separation', separation, { optionalPackagesAbsent: OPTIONAL_PACKAGES });

  // 4. The public examples, byte for byte, here and in the checkout.
  const examples = [], exampleFaults = [];
  for (const example of EXAMPLES) {
    const name = path.basename(example.file), source = fs.readFileSync(path.join(repository, example.file));
    if (sha256(fs.readFileSync(path.join(consumer, name))) !== sha256(source)) exampleFaults.push(name + ' differs from ' + example.file);
    const there = node([name], consumer), here = node([example.file], repository);
    if (there.status !== 0) exampleFaults.push(name + ' failed in the consumer: ' + there.stderr.split('\n')[0]);
    if (here.status !== 0) exampleFaults.push(example.file + ' failed in the checkout: ' + here.stderr.split('\n')[0]);
    if (there.stdout !== here.stdout) exampleFaults.push(name + ' prints something else in the consumer');
    if (there.stdout.trim() === '') exampleFaults.push(name + ' prints nothing');
    examples.push({ file: example.file, sha256: sha256(source), entries: example.entries, outputSha256: sha256(there.stdout), outputBytes: Buffer.byteLength(there.stdout) });
  }
  row('examples', exampleFaults, { examples });

  // 5. A strict consumer, compiled by the pinned compiler of the checkout against the installed types.
  const compiler = path.join(repository, 'node_modules', 'typescript', 'bin', 'tsc'), compiled = node([compiler, '--project', 'tsconfig.json', '--pretty', 'false'], consumer);
  row('types', compiled.status === 0 ? [] : ['the strict consumer does not compile: ' + (compiled.stdout + compiled.stderr).trim()], { compiler: 'typescript ' + JSON.parse(fs.readFileSync(path.join(repository, 'node_modules', 'typescript', 'package.json'), 'utf8')).version + ' of the checkout', options: STRICT_CONFIG.compilerOptions });

  // 6. What each installed package says about its licence, as the consumer receives it.
  const notices = [], noticeFaults = [];
  for (const name of [...packed.map(item => item.package), THIRD_PARTY.name]) {
    const directory = fs.realpathSync(name === engine.package ? path.join(consumer, 'node_modules', name) : path.join(path.dirname(path.dirname(fs.realpathSync(path.join(consumer, 'node_modules', engine.package)))), name));
    const files = fs.readdirSync(directory).filter(file => /^(?:LICEN[CS]E|NOTICE|UNLICENSE)/i.test(file)), declared = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).license ?? null;
    if (files.length === 0) noticeFaults.push(name + ' is installed without a licence file');
    notices.push({ package: name, licenceField: declared, files });
  }
  row('notices', noticeFaults, { notices });

  const open = [
    'The packages are private at version 0.0.0 and are not published. The consumer names the archives; no registry install of the engine was run.',
    'The manifests of the three packages carry no "license" field. Each archive carries the Apache-2.0 text.',
    'No "files" list narrows the archives: sources, package tests and compiler configuration travel with the built modules.',
    'This check opens no page: the web entries are loaded in Node only. tools/verify-clean-consumer-page.mjs opens a page of the consumer in a browser and has a back end draw from the installed copy.',
    'First interaction is not measured here; the page check observes one press. The sizes above are unbundled module sets, not a transfer over a network.',
    'A person new to the project has not walked through this. This is an automated rehearsal.',
    ...(offline ? ['The registry was not used. ' + THIRD_PARTY.name + ' came from the installed copy of this checkout.'] : []),
  ];
  const report = { schemaVersion: 1, ok: rows.every(item => item.ok), node: process.versions.node, packageManager: manifest.packageManager, platform: process.platform + ' ' + process.arch, mode: offline ? 'offline' : 'registry', rows, open };
  fs.writeFileSync(path.join(real, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flags = args.filter(argument => argument.startsWith('--')), rest = args.filter(argument => !argument.startsWith('--'));
  if (rest.length !== 1 || flags.some(flag => flag !== '--offline') || flags.length > 1) { console.error('Usage: pnpm exec node tools/verify-clean-consumer.mjs <new absolute directory outside the checkout> [--offline]'); process.exit(2); }
  try {
    const report = verifyCleanConsumer({ output: rest[0], offline: flags.length === 1 });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) { console.error(error.code ? error.message : error); process.exitCode = 1; }
}
