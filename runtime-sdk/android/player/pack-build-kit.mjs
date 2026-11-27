// SPDX-License-Identifier: Apache-2.0
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
// Resolve from the package declaring the dependency for isolated and hoisted installs.
async function dependencyRoot(owner, name) {
  const localRequire = createRequire(path.join(root, 'packages', owner, 'package.json'));
  let directory = path.dirname(localRequire.resolve(name));
  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      if (manifest.name === name) return directory;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(directory);
    if (directory === parent) throw new Error('Cannot find package manifest for ' + name);
    directory = parent;
  }
}
const {values} = parseArgs({options: {legacy: {type: 'boolean'}, spine: {type: 'boolean'}, out: {type: 'string'}, aar: {type: 'string'}, esbuild: {type: 'string'}}});
if (!values.out || !values.aar || !values.esbuild) throw new Error('Supply --out, --aar and an esbuild 0.28.2 module directory');
const predicates = await dependencyRoot('engine', 'robust-predicates');
const spineCore = values.spine ? await dependencyRoot('spine', '@esotericsoftware/spine-core') : undefined;
const destination = path.resolve(values.out);
try { await lstat(destination); throw new Error('Use a new kit directory'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
// Avoid putting temporary output into anything recursively copied below, including a
// package reached through a workspace junction. Resolve the nearest existing parent.
async function physicalDestination(directory) {
  try { return await realpath(directory); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await physicalDestination(path.dirname(directory)), path.basename(directory));
  }
}
const physical = await physicalDestination(destination);
for (const input of ['packages', 'runtime-sdk', 'node_modules'].map(name => path.join(root, name)).concat(
    [path.resolve(values.esbuild), path.dirname(require.resolve('pngjs/package.json')),
      predicates, ...(values.spine ? [spineCore] : [])])) {
  const relative = path.relative(await realpath(input), physical);
  if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) {
    throw new Error('Build kit output is inside a package input');
  }
}
await mkdir(path.dirname(destination), {recursive: true});
const stage = await mkdtemp(path.join(path.dirname(destination), '.egret-kit-'));
const files = [];

async function copy(source, name) {
  const target = path.join(stage, name);
  if (!(await lstat(source)).isFile()) throw new Error('Expected a regular kit input: ' + name);
  await mkdir(path.dirname(target), {recursive: true});
  await copyFile(source, target);
  const hash = createHash('sha256');
  for await (const block of createReadStream(target)) hash.update(block);
  files.push({path: name, sha256: hash.digest('hex')});
}

// Copy only declared source groups and regular entries. Caches, APKs, game
// sources and signing material have no path into the SDK bundle.
async function tree(base, name, accept) {
  if (path.resolve(base) === path.resolve(stage)) throw new Error('Build kit output reached through an input');
  for (const item of await readdir(base, {withFileTypes: true})) {
    const rel = name + '/' + item.name;
    const source = path.join(base, item.name);
    if (item.isDirectory()) await tree(source, rel, accept);
    else if (item.isFile() && accept(item.name)) await copy(source, rel);
  }
}

async function installed(name, version, folder, paths) {
  const base = await realpath(folder);
  if (JSON.parse(await readFile(path.join(base, 'package.json'), 'utf8')).version !== version)
    throw new Error('Unexpected package version for ' + name);
  for (const entry of ['package.json', ...paths]) {
    const source = path.join(base, entry);
    const target = 'node_modules/' + name + '/' + entry;
    if ((await lstat(source)).isDirectory()) await tree(source, target, file => /\.(?:js|d\.ts)$/.test(file));
    else await copy(source, target);
  }
}

try {
  for (const pkg of ['contracts', 'runtime', 'engine', ...(values.spine ? ['spine'] : [])]) {
    const prefix = 'packages/' + pkg;
    await copy(path.join(root, prefix, 'package.json'), prefix + '/package.json');
    await tree(path.join(root, prefix, 'dist'), prefix + '/dist', name => /\.(?:js|d\.ts)$/.test(name));
  }
  const paths = {};
  for (const pkg of ['contracts', 'runtime', 'engine', ...(values.spine ? ['spine'] : [])]) {
    const base = 'packages/' + pkg;
    const manifest = JSON.parse(await readFile(path.join(stage, base, 'package.json'), 'utf8'));
    for (const [key, target] of Object.entries(manifest.exports ?? {})) {
      const types = typeof target === 'string' ? target.replace(/\.js$/, '.d.ts') : target.types;
      if (typeof types === 'string') paths[manifest.name + key.slice(1)] = ['./' + base + '/' + types.replace(/^\.\//, '')];
    }
  }
  if (values.legacy) {
    const base = 'tools/egret-migrate';
    const manifest = JSON.parse(await readFile(path.join(root, base, 'package.json'), 'utf8'));
    await copy(path.join(root, base, 'package.json'), base + '/package.json');
    // The package owns its public modules. New adapters must be copied along with their relative imports.
    for (const name of manifest.files) {
      if (name === 'LICENSE' || name === 'NOTICE') continue; // Included at the kit root.
      if (name === 'compat') {
        await tree(path.join(root, base, name), base + '/' + name, file => /\.(?:mjs|d\.mts|md)$/.test(file));
      } else if (name.endsWith('.mjs')) {
        await copy(path.join(root, base, name), base + '/' + name);
      }
    }
    for (const [key, target] of Object.entries(manifest.exports)) {
      if (typeof target.types === 'string') paths[manifest.name + key.slice(1)] = ['./' + base + '/' + target.types.slice(2)];
    }
  }
  const config = {
    compilerOptions: {strict: true, noEmit: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', paths},
    files: ['./runtime-sdk/project/android-player-project.d.ts', './runtime-sdk/project/android-player-network.d.ts', './runtime-sdk/project/android-original5.d.ts']
  };
  const typeConfig = JSON.stringify(config, null, 2) + '\n';
  await writeFile(path.join(stage, 'game-types.json'), typeConfig);
  files.push({path: 'game-types.json', sha256: createHash('sha256').update(typeConfig).digest('hex')});
  for (const group of ['runtime-sdk/scene', 'runtime-sdk/project']) {
    await tree(path.join(root, group), group, name => !name.endsWith('.test.mjs') && /\.(?:mjs|d\.ts)$/.test(name) && name !== 'build.mjs');
  }
  const network = 'runtime-sdk/android/network';
  await copy(path.join(root, network, 'install.mjs'), network + '/install.mjs');
  await tree(path.join(root, network, 'src'), network + '/src', name => name.endsWith('.java'));
  await tree(path.join(root, network, 'licenses'), network + '/licenses', name => name.endsWith('.LICENSE'));
  const player = 'runtime-sdk/android/player/';
  for (const file of ['handoff.mjs', 'stage-revision.mjs', 'sync-debug.mjs', 'prepare-original5.mjs', 'export-project.mjs', 'create-app.mjs', 'app-resources.mjs', 'channel-libraries.mjs']) {
    await copy(path.join(root, player, file), player + file);
  }
  await tree(path.join(root, player, 'consumers'), player + 'consumers', name => /\.(?:java|gradle)$/.test(name));
  for (const file of ['tools/pack-single-file.mjs', 'LICENSE', 'NOTICE', 'third-party/pngjs-7.0.0.LICENSE',
    'third-party/robust-predicates-3.0.3.LICENSE']) await copy(path.join(root, file), file);
  await installed('pngjs', '7.0.0', path.dirname(require.resolve('pngjs/package.json')), ['LICENSE', 'lib']);
  await installed('robust-predicates', '3.0.3', predicates, ['LICENSE', 'index.js', 'index.d.ts', 'esm']);
  if (values.spine) {
    await installed('@esotericsoftware/spine-core', '4.3.13', spineCore, ['LICENSE', 'dist']);
    await copy(path.join(root, 'third-party/spine-core-4.3.13.LICENSE'), 'third-party/spine-core-4.3.13.LICENSE');
  }
  const esbuild = await realpath(path.resolve(values.esbuild));
  await installed('esbuild', '0.28.2', esbuild, ['LICENSE.md', 'lib']);
  const name = '@esbuild/' + process.platform + '-' + process.arch;
  const native = createRequire(path.join(esbuild, 'package.json')).resolve(name + '/package.json');
  await installed(name, '0.28.2', path.dirname(native), [process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild', 'README.md']);
  await copy(path.resolve(values.aar), 'libs/egret-player.aar');
  await copy(path.join(root, player, 'verify-build-kit.mjs'), 'verify-build-kit.mjs');
  for (const [locale, label] of [['en', 'README.md'], ['Cns', 'README.zh-CN.md']]) {
    const markdown = (await readFile(path.join(root, 'knowledge-base', locale, 'docs/android-migration-build-kit.md'), 'utf8'))
      .replace('../../Cns/docs/android-migration-build-kit.md', 'README.zh-CN.md')
      .replace('../../en/docs/android-migration-build-kit.md', 'README.md')
      .replace('(android-project-player.md)', '(https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/' + locale + '/docs/android-project-player.md)');
    await writeFile(path.join(stage, label), markdown);
    files.push({path: label, sha256: createHash('sha256').update(markdown).digest('hex')});
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  await writeFile(path.join(stage, 'kit.json'), JSON.stringify({schemaVersion: 1, node: '26.7.0',
    platform: process.platform, arch: process.arch, files}, null, 2) + '\n');
  await rename(stage, destination);
  console.log(JSON.stringify({files: files.length, platform: process.platform, arch: process.arch}));
} finally { await rm(stage, {recursive: true, force: true}); }
