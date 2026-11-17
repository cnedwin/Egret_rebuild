// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/pack-single-file.mjs --esbuild <installed esbuild module> --out <new directory> [--version <version>]
// Writes the 2D engine as one file, twice, and report.json saying what is in them and how large they are:
//   egret.global.js  for <script src>; everything is on the global `Egret`, so a game is `Egret.play({ ... })`
//   egret.js         for `import { play } from './egret.js'`
// Both hold the entries named in SINGLE_FILE_ENTRIES and everything those load, the WebGL2 and the WebGPU host
// included, so a page needs no import map and no other file. The bundler is not a dependency of the repository: the
// person packing names an installed copy, as the browser checks name an installed Playwright. Build first.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
/** The entries one file holds, in the order their names are taken. */
export const SINGLE_FILE_ENTRIES = Object.freeze([
  '@egret/engine/play',
  '@egret/engine',
  '@egret/engine/kit',
  '@egret/engine/web/game'
]);
/** The packages whose entries and private imports the files are made from. */
const PACKAGES = Object.freeze(['contracts', 'runtime', 'engine']);
const refuse = (code, message) => Object.assign(new Error(code + ': ' + message), { code });

/** Where each import of a package of the workspace is, from the manifests: `@egret/engine/play` to its built file. */
export function workspaceModules(from = root) {
  const modules = new Map();
  for (const name of PACKAGES) {
    const directory = path.join(from, 'packages', name),
      manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    for (const [table, prefix] of [
      [manifest.exports, manifest.name],
      [manifest.imports, '']
    ])
      for (const [key, value] of Object.entries(table ?? {})) {
        const file = typeof value === 'string' ? value : value?.import;
        if (typeof file !== 'string') continue;
        modules.set(prefix === '' ? key : prefix + key.slice(1), path.join(directory, file));
      }
  }
  return modules;
}

/**
 * The names of the file and the entry each comes from. A name two entries give must be the same thing in both; two
 * different things under one name is refused, because the file could hold only one of them.
 */
export function singleFileNames(namespaces) {
  const names = new Map();
  for (const [entry, namespace] of namespaces)
    for (const name of Object.keys(namespace)) {
      if (name === 'default')
        throw refuse('SINGLE_FILE_NAME', entry + ' has a default export, which the file has no name for.');
      const taken = names.get(name);
      if (taken === undefined) names.set(name, { entry, value: namespace[name] });
      else if (taken.value !== namespace[name])
        throw refuse(
          'SINGLE_FILE_NAME',
          '`' + name + '` is one thing in ' + taken.entry + ' and another in ' + entry + '.'
        );
    }
  return new Map([...names].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([name, { entry }]) => [name, entry]));
}

/** The module the bundler starts from: every name, taken from the entry that gives it. */
export function singleFileSource(names) {
  const byEntry = new Map();
  for (const [name, entry] of names) byEntry.set(entry, [...(byEntry.get(entry) ?? []), name]);
  return [...byEntry].map(([entry, list]) => 'export { ' + list.join(', ') + " } from '" + entry + "';\n").join('');
}

/** The sizes of a file: as written, and as a server sends it. */
export function fileSizes(bytes) {
  return {
    bytes: bytes.length,
    gzip: zlib.gzipSync(bytes, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(bytes).length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

const GROUPS = Object.freeze([
  ['WebGPU host', /\/web\/(WebGPU|webgpu)/],
  ['WebGL2 host', /\/web\/(WebGL2|webgl2)/],
  ['Sentences of errors', /\/errorHelp/],
  ['Text', /\/text\/|[Tt]ext[A-Z]|BrowserText/],
  ['Play', /\/web\/(BrowserPlay|play)/],
  ['Sound', /[Aa]udio/],
  ['Preparing a frame', /\/rendering\/|sharedFrame|SharedFrame/],
  ['Runtime', /\/runtime\//],
  ['Third party', /node_modules/]
]);
/** Which part of the engine a module belongs to, for the table of the report. */
export function groupOf(file) {
  const normal = file.split(path.sep).join('/');
  for (const [name, pattern] of GROUPS) if (pattern.test(normal)) return name;
  return 'Engine';
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--esbuild', '--out', '--version'].includes(args[i]) || args[i + 1] === undefined)
      throw new TypeError(
        'Usage: node tools/pack-single-file.mjs --esbuild <installed esbuild module> --out <new directory> [--version <version>]'
      );
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.esbuild || !options.out) throw new TypeError('--esbuild and --out are required');
  const out = path.resolve(options.out);
  if (fs.existsSync(out)) throw refuse('SINGLE_FILE_OUT', 'The output directory must not exist yet: ' + out);
  const version = options.version ?? '0.0.0';
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(version))
    throw refuse('SINGLE_FILE_VERSION', 'Not a version: ' + version);
  const require = createRequire(import.meta.url),
    esbuild = require(path.resolve(options.esbuild));
  if (typeof esbuild?.build !== 'function' || typeof esbuild.version !== 'string')
    throw refuse('SINGLE_FILE_BUNDLER', 'Not an esbuild module: ' + options.esbuild);

  const modules = workspaceModules();
  for (const entry of SINGLE_FILE_ENTRIES)
    if (!fs.existsSync(modules.get(entry) ?? ''))
      throw refuse('SINGLE_FILE_NOT_BUILT', entry + ' is not built. Run the build first.');
  const namespaces = [];
  for (const entry of SINGLE_FILE_ENTRIES)
    namespaces.push([entry, await import(pathToFileURL(modules.get(entry)).href)]);
  const names = singleFileNames(namespaces),
    source = singleFileSource(names);
  // The manifest of the third-party package is beside its entry; its own exports do not name it.
  const thirdParty = createRequire(path.join(root, 'packages', 'engine', 'package.json'));
  let beside = path.dirname(thirdParty.resolve('robust-predicates'));
  while (!fs.existsSync(path.join(beside, 'package.json'))) beside = path.dirname(beside);
  const predicates = JSON.parse(fs.readFileSync(path.join(beside, 'package.json'), 'utf8'));
  const banner =
    '/*! Egret engine ' +
    version +
    ', the 2D engine in one file. https://github.com/cnedwin/Egret_rebuild | Apache-2.0. Includes robust-predicates ' +
    predicates.version +
    ' (Unlicense). */';
  // An import of the workspace is found from the manifests, as Node finds it; anything else is found the usual way.
  const resolve = {
    name: 'egret-workspace',
    setup(build) {
      build.onResolve({ filter: /^(@egret\/|#)/ }, wanted => {
        const file = modules.get(wanted.path);
        if (file === undefined) throw refuse('SINGLE_FILE_IMPORT', 'No package of the workspace gives ' + wanted.path);
        return { path: file };
      });
    }
  };
  const report = {
    version,
    bundler: 'esbuild ' + esbuild.version,
    entries: [...SINGLE_FILE_ENTRIES],
    names: [...names.keys()],
    files: {}
  };
  const files = [];
  for (const [file, format] of [
    ['egret.global.js', { format: 'iife', globalName: 'Egret' }],
    ['egret.js', { format: 'esm' }]
  ]) {
    const result = await esbuild.build({
      stdin: { contents: source, resolveDir: path.join(root, 'packages', 'engine'), sourcefile: 'single-file.js' },
      bundle: true,
      minify: true,
      write: false,
      target: 'es2022',
      platform: 'browser',
      legalComments: 'none',
      banner: { js: banner },
      metafile: true,
      logLevel: 'silent',
      plugins: [resolve],
      ...format
    });
    if (result.outputFiles.length !== 1) throw refuse('SINGLE_FILE_SPLIT', file + ' came out as more than one file.');
    const bytes = Buffer.from(result.outputFiles[0].contents);
    files.push([file, bytes]);
    const groups = {};
    let count = 0;
    for (const [input, { bytesInOutput }] of Object.entries(Object.values(result.metafile.outputs)[0].inputs)) {
      if (bytesInOutput === 0) continue;
      count++;
      const group = groupOf(path.resolve(root, 'packages', 'engine', input));
      groups[group] = (groups[group] ?? 0) + bytesInOutput;
    }
    report.files[file] = {
      ...fileSizes(bytes),
      modules: count,
      parts: Object.fromEntries(Object.entries(groups).sort(([, a], [, b]) => b - a))
    };
  }
  fs.mkdirSync(out, { recursive: true });
  for (const [file, bytes] of files) fs.writeFileSync(path.join(out, file), bytes);

  // Both files are loaded here before they are called written: each must give every name, and the same things.
  const scope = new Function(fs.readFileSync(path.join(out, 'egret.global.js'), 'utf8') + '\nreturn Egret;')();
  const module = await import(pathToFileURL(path.join(out, 'egret.js')).href);
  for (const [label, given] of [
    ['egret.global.js', scope],
    ['egret.js', module]
  ]) {
    const got = Object.keys(given).sort();
    if (got.length !== names.size || got.some((name, index) => name !== report.names[index]))
      throw refuse('SINGLE_FILE_CHECK', label + ' does not give the names it was made from.');
    if (typeof given.play !== 'function' || !(given.synthesizeSfx(given.SFX_PRESETS.coin) instanceof Float32Array))
      throw refuse('SINGLE_FILE_CHECK', label + ' does not work when loaded.');
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const kib = bytes => (bytes / 1024).toFixed(1) + ' KiB';
  for (const [file, sizes] of Object.entries(report.files))
    console.log(file + ': ' + kib(sizes.bytes) + ', gzip ' + kib(sizes.gzip) + ', brotli ' + kib(sizes.brotli));
  console.log(names.size + ' names from ' + SINGLE_FILE_ENTRIES.length + ' entries, in ' + out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message ?? error);
    process.exit(1);
  });
