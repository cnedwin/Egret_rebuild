// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/pack-single-file.mjs --esbuild <installed esbuild module> --out <new directory> [--version <version>] [--with bitmapfont,text-input]
// Writes the engine as one file, and report.json saying what is in each file and how large it is, with llms.txt and the
// licences beside them:
//   egret2d.js    for <script src>; everything is on the global `Egret`, so a game is `Egret.play({ ... })`
//   egret2d.mjs   the same engine as a module, for `import { play } from './egret2d.mjs'`
//   egret3d.js    the same with World3D and `play3d` as well, for a 3D game; a page loads one of the two
//   egret3d.mjs
// Each holds the entries named in SINGLE_FILE_ENTRIES, or SINGLE_FILE_ENTRIES_3D, and everything those load, the
// WebGL2 and the WebGPU host included, so a page needs no import map and no other file. The bundler is not a
// dependency of the repository: the person packing names an installed copy, as the browser checks name an installed
// Playwright. Build first.
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
/** The entries of the file for a 3D game: those of the other, and World3D with its WebGL2 renderer and `play3d`. */
export const SINGLE_FILE_ENTRIES_3D = Object.freeze([
  ...SINGLE_FILE_ENTRIES,
  '@egret/engine/webgl2/world3d',
  '@egret/engine/world3d'
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
    if (!['--esbuild', '--out', '--version', '--with'].includes(args[i]) || args[i + 1] === undefined)
      throw new TypeError(
        'Usage: node tools/pack-single-file.mjs --esbuild <installed esbuild module> --out <new directory> [--version <version>] [--with bitmapfont,text-input]'
      );
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.esbuild || !options.out) throw new TypeError('--esbuild and --out are required');
  const optional = new Map([
    ['bitmapfont', '@egret/engine/bitmapfont'],
    ['text-input', '@egret/engine/web/text-input']
  ]);
  const selected = options.with === undefined ? [] : options.with.split(',');
  if (new Set(selected).size !== selected.length || selected.some(name => !optional.has(name)))
    throw new TypeError('--with accepts a comma-separated selection of bitmapfont and text-input.');
  const extraEntries = selected.map(name => optional.get(name));
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
  for (const entry of [...SINGLE_FILE_ENTRIES_3D, ...extraEntries])
    if (!fs.existsSync(modules.get(entry) ?? ''))
      throw refuse('SINGLE_FILE_NOT_BUILT', entry + ' is not built. Run the build first.');
  // The manifest of the third-party package is beside its entry; its own exports do not name it.
  const thirdParty = createRequire(path.join(root, 'packages', 'engine', 'package.json'));
  let beside = path.dirname(thirdParty.resolve('robust-predicates'));
  while (!fs.existsSync(path.join(beside, 'package.json'))) beside = path.dirname(beside);
  const predicates = JSON.parse(fs.readFileSync(path.join(beside, 'package.json'), 'utf8'));
  const bannerOf = what =>
    '/*! Egret engine ' +
    version +
    ', ' +
    what +
    ' in one file. https://github.com/cnedwin/Egret_rebuild | Apache-2.0. Includes robust-predicates ' +
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
  const report = { version, bundler: 'esbuild ' + esbuild.version, sets: {}, files: {} };
  const files = [],
    made = [];
  for (const [base, entries, what, works] of [
    ['egret2d', [...SINGLE_FILE_ENTRIES, ...extraEntries], 'the 2D engine', 'play'],
    ['egret3d', [...SINGLE_FILE_ENTRIES_3D, ...extraEntries], 'the 2D and the 3D engine', 'play3d']
  ]) {
    const namespaces = [];
    for (const entry of entries) namespaces.push([entry, await import(pathToFileURL(modules.get(entry)).href)]);
    const names = singleFileNames(namespaces),
      source = singleFileSource(names),
      banner = bannerOf(what);
    report.sets[base] = { entries: [...entries], names: [...names.keys()] };
    made.push([base, names, works]);
    for (const [file, format] of [
      [base + '.js', { format: 'iife', globalName: 'Egret' }],
      [base + '.mjs', { format: 'esm' }]
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
  }
  fs.mkdirSync(out, { recursive: true });
  for (const [file, bytes] of files) fs.writeFileSync(path.join(out, file), bytes);

  // Every file is loaded here before it is called written: each must give every name of its set, and work.
  for (const [base, names, works] of made) {
    const scope = new Function(fs.readFileSync(path.join(out, base + '.js'), 'utf8') + '\nreturn Egret;')();
    const module = await import(pathToFileURL(path.join(out, base + '.mjs')).href);
    for (const [label, given] of [
      [base + '.js', scope],
      [base + '.mjs', module]
    ]) {
      const got = Object.keys(given).sort(),
        wanted = report.sets[base].names;
      if (got.length !== names.size || got.some((name, index) => name !== wanted[index]))
        throw refuse('SINGLE_FILE_CHECK', label + ' does not give the names it was made from.');
      if (typeof given[works] !== 'function' || !(given.synthesizeSfx(given.SFX_PRESETS.coin) instanceof Float32Array))
        throw refuse('SINGLE_FILE_CHECK', label + ' does not work when loaded.');
    }
  }
  // What a release hands over with the files: the page an agent reads, and the licences of what is in them.
  const handed = [
    ['llms.txt', 'llms.txt'],
    ['LICENSE', 'LICENSE'],
    ['NOTICE', 'NOTICE'],
    ['third-party/robust-predicates-' + predicates.version + '.LICENSE', 'robust-predicates.LICENSE']
  ];
  for (const [from, to] of handed) fs.copyFileSync(path.join(root, from), path.join(out, to));
  report.alongside = handed.map(([, to]) => to);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const kib = bytes => (bytes / 1024).toFixed(1) + ' KiB';
  for (const [file, sizes] of Object.entries(report.files))
    console.log(file + ': ' + kib(sizes.bytes) + ', gzip ' + kib(sizes.gzip) + ', brotli ' + kib(sizes.brotli));
  for (const [base, names] of made) console.log(base + ': ' + names.size + ' names');
  console.log('in ' + out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message ?? error);
    process.exit(1);
  });
