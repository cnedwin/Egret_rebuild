// SPDX-License-Identifier: Apache-2.0
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { workspaceModules } from '../../../tools/pack-single-file.mjs';

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

export async function exportProject(project, output, esbuildModule) {
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
  const files = [desc.entry, ...desc.pages.map(page => page.src), ...(desc.assets ?? [])];
  const names = new Set(['project.json', 'game.js']);
  for (const file of files) {
    relativeName(file);
    if (names.has(file.toLowerCase())) throw new Error('Conflicting project asset: ' + file);
    names.add(file.toLowerCase());
  }
  const entry = await inputFile(project, desc.script ?? 'main.mjs');
  const sources = await Promise.all(files.map(file => inputFile(project, file)));
  const bundler = require(path.resolve(esbuildModule));
  if (bundler.version !== '0.28.2') throw new Error('Use esbuild 0.28.2');
  const workspace = workspaceModules(root);
  workspace.set('@egret/spine', path.join(root, 'packages/spine/dist/index.js'));
  workspace.set('@egret/android-player-world3d', path.join(root, 'runtime-sdk/project/world3d-player.mjs'));
  workspace.set('@egret/android-play3d-session', path.join(root, 'packages/engine/dist/web/world3d/BrowserPlay3D.js'));
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
    await writeFile(path.join(temp, 'project.json'), JSON.stringify(manifest, null, 2) + '\n');
    await rename(temp, output);
  } finally { await rm(temp, {recursive: true, force: true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const {values} = parseArgs({options: {project: {type: 'string'}, out: {type: 'string'}, esbuild: {type: 'string'}}});
  if (!values.project || !values.out || !values.esbuild) throw new Error('Supply --project, --esbuild and --out');
  await exportProject(values.project, values.out, values.esbuild);
}
