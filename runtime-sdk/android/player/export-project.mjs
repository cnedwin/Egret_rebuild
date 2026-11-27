// SPDX-License-Identifier: Apache-2.0
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { workspaceModules } from '../../../tools/pack-single-file.mjs';

import { selectV8Profile } from './v8-profile.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const spineRequire = createRequire(path.join(root, 'packages/spine/package.json'));
const spineNotice = 'spine-core-4.3.13.LICENSE';

function relativeName(name) {
  if (typeof name !== 'string' || !name.split('/').every(part =>
    /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(part) && !part.endsWith('.') &&
    !/^(?:con|prn|aux|nul|(?:com|lpt)[1-9])(?:\.|$)/i.test(part))) {
    throw new Error('Expected a portable project-relative filename: ' + name);
  }
  return name;
}

// Validate each component, including its authored case, before following any path.
async function inputFile(project, name) {
  const parts = relativeName(name).split('/');
  let source = project;
  for (const [index, part] of parts.entries()) {
    if (!(await readdir(source)).includes(part)) throw new Error('Missing project file: ' + name);
    source = path.join(source, part);
    const stat = await lstat(source);
    if (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()) {
      throw new Error('Project path must contain regular directories and files: ' + name);
    }
  }
  return source;
}

// The bundled entry runs last. Additional files are already-compiled classic
// scripts: copying them verbatim preserves legacy globals and manifest order.
function classicScriptFiles(plan) {
  if (plan === undefined) return [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) ||
      Object.keys(plan).some(key => key !== 'startup' && key !== 'groups')) {
    throw new Error('Invalid v8Scripts manifest');
  }
  const startup = plan.startup === undefined ? [] : plan.startup;
  const groups = plan.groups === undefined ? {} : plan.groups;
  if (!Array.isArray(startup) || !groups || typeof groups !== 'object' || Array.isArray(groups)) {
    throw new Error('Invalid v8Scripts manifest');
  }
  const names = [];
  function append(files) {
    if (files.length > 4095 - names.length) throw new Error('V8 project exceeds 4096 scripts including game.js');
    for (const file of files) names.push(file);
  }
  append(startup);
  for (const [name, files] of Object.entries(groups)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name) || !Array.isArray(files) || !files.length) {
      throw new Error('Invalid V8 script group: ' + name);
    }
    append(files);
  }
  for (const file of names) {
    relativeName(file);
    if (file.length > 1024 || !file.endsWith('.js')) throw new Error('Expected a classic .js file: ' + file);
  }
  return names;
}

async function checkV8ScriptSizes(directory, scripts) {
  let total = 0;
  for (const file of ['game.js', ...scripts]) {
    const target = path.join(directory, file);
    const {size} = await lstat(target);
    if (size > (16 << 20)) throw new Error('V8 script exceeds 16 MiB: ' + file);
    total += size;
    if (total > (64 << 20)) throw new Error('V8 scripts exceed 64 MiB in total');
    const bytes = await readFile(target);
    try { new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch (error) { throw new Error('Invalid UTF-8 V8 script: ' + file, {cause: error}); }
  }
}

export async function exportProject(project, output, esbuildModule, { verifyDeliveryInputs = false } = {}) {
  project = path.resolve(project);
  output = path.resolve(output);
  const desc = JSON.parse(await readFile(await inputFile(project, 'project.json'), 'utf8'));
  for (const dim of [desc.width, desc.height]) {
    if (!Number.isInteger(dim) || dim <= 0 || dim > 4096) throw new Error('Invalid logical stage size');
  }
  if (!Array.isArray(desc.pages) || !Array.isArray(desc.assets ?? [])) throw new Error('Invalid project assets');
  const ids = new Set();
  for (const page of desc.pages) {
    if (!Number.isInteger(page.id) || page.id < 1 || page.id > 255 || ids.has(page.id) ||
        ![page.width, page.height].every(n => Number.isInteger(n) && n >= 1 && n <= 4096)) {
      throw new Error('Invalid or duplicate texture page');
    }
    ids.add(page.id);
  }
  if (desc.v8CodeCache !== undefined && typeof desc.v8CodeCache !== 'boolean') throw new Error('Expected v8CodeCache boolean');
  selectV8Profile(undefined, desc.requiredV8Features);
  const scripts = classicScriptFiles(desc.v8Scripts);
  const files = [desc.entry, ...desc.pages.map(page => page.src), ...(desc.assets ?? []), ...scripts];
  const names = new Set(['project.json', 'game.js']);
  for (const file of files) {
    relativeName(file);
    if (names.has(file.toLowerCase())) throw new Error('Conflicting project asset: ' + file);
    names.add(file.toLowerCase());
  }
  const entryName = desc.script ?? 'main.mjs';
  const entry = await inputFile(project, entryName);
  if (scripts.some(file => file.toLowerCase() === entryName.toLowerCase())) {
    throw new Error('Bundled entry cannot also be a classic V8 script: ' + entryName);
  }
  const sources = await Promise.all(files.map(file => inputFile(project, file)));
  const bundler = require(path.resolve(esbuildModule));
  if (bundler.version !== '0.28.2') throw new Error('Use esbuild 0.28.2');
  const workspace = workspaceModules(root);
  // These modules enter the application only through explicit imports by a migrated game.
  for (const [specifier, file] of [['@egret/legacy', 'protocol'], ['@egret/legacy/protocol', 'protocol'],
      ['@egret/legacy/scene', 'scene'], ['@egret/legacy/coverage', 'coverage'], ['@egret/legacy/theme-factories', 'theme-factories'], ['@egret/legacy/android', 'android']]) {
    workspace.set(specifier, path.join(root, 'tools/egret-migrate/compat', file + '.mjs'));
  }
  workspace.set('@egret/spine', path.join(root, 'packages/spine/dist/index.js'));
  workspace.set('@egret/android-player-world3d', path.join(root, 'runtime-sdk/project/world3d-player.mjs'));
  workspace.set('@egret/android-play3d-session', path.join(root, 'packages/engine/dist/web/world3d/BrowserPlay3D.js'));
  workspace.set('@egret/android-player-network', path.join(root, 'runtime-sdk/project/network.mjs'));
  workspace.set('@egret/android-player-project', path.join(root, 'runtime-sdk/project/player-project.mjs'));
  await mkdir(path.dirname(output), {recursive: true});
  // A new destination makes a failed export unable to replace a previously shipped project.
  try { await lstat(output); throw new Error('Export destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = await mkdtemp(path.join(path.dirname(output), 'egret-game-'));
  try {
    const result = await bundler.build({
      entryPoints: [entry], outfile: path.join(temp, 'game.js'), platform: 'browser', format: 'iife',
      bundle: true, minify: true, metafile: true, target: 'es2022', legalComments: 'eof',
      plugins: [{name: 'egret-runtime', setup(builder) {
        // Resolve game and adapter imports against the very same optional runtime.
        builder.onResolve({filter: /^@esotericsoftware\/spine-core$/}, () => ({
          path: spineRequire.resolve('@esotericsoftware/spine-core')
        }));
        builder.onResolve({filter: /^(@egret\/|#)/}, ({path: specifier}) => {
          const file = workspace.get(specifier);
          return file ? {path: file} : undefined;
        });
      }}]
    });
    if (verifyDeliveryInputs) {
      // A dependency accidentally found in a parent's node_modules cannot be rebuilt by the recipient.
      const owners = await Promise.all([realpath(project), realpath(root)]);
      for (const input of Object.keys(result.metafile.inputs)) {
        const physical = await realpath(path.resolve(input));
        if (!owners.some(owner => {
          const relative = path.relative(owner, physical);
          return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
        })) throw new Error('Bundled input is outside the handoff: ' + input);
      }
    }
    // Only a game that actually includes Spine code receives the upstream notice.
    const usesSpine = Object.values(result.metafile.outputs).some(output =>
      Object.entries(output.inputs).some(([file, use]) =>
        use.bytesInOutput > 0 && file.replaceAll('\\', '/').includes('/@esotericsoftware/spine-core/')));
    if (usesSpine) {
      if (names.has(spineNotice.toLowerCase())) throw new Error('Conflicting project asset and Spine notice: ' + spineNotice);
      await copyFile(path.join(root, 'third-party', spineNotice), path.join(temp, spineNotice));
    }
    for (const [index, name] of files.entries()) {
      const target = path.join(temp, name);
      await mkdir(path.dirname(target), {recursive: true});
      await copyFile(sources[index], target);
    }
    const {script, ...manifest} = desc;
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';
    if (desc.v8Scripts !== undefined) {
      if (Buffer.byteLength(manifestText) > 65536) throw new Error('Project manifest exceeds 64 KiB');
      await checkV8ScriptSizes(temp, scripts);
    }
    await writeFile(path.join(temp, 'project.json'), manifestText);
    await rename(temp, output);
  } finally { await rm(temp, {recursive: true, force: true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const {values} = parseArgs({options: {project: {type: 'string'}, out: {type: 'string'}, esbuild: {type: 'string'}}});
  if (!values.project || !values.out || !values.esbuild) throw new Error('Supply --project, --esbuild and --out');
  await exportProject(values.project, values.out, values.esbuild);
}
