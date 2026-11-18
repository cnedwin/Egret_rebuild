// SPDX-License-Identifier: Apache-2.0
// Run the workspace build first. The scene bundle consumes the same public package
// exports used by the H5 baseline, including their exact workspace implementations.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { workspaceModules } from '../../tools/pack-single-file.mjs';
import { createScene, WIDTH, HEIGHT, CYCLE, PAGE } from './scene.mjs';
import { encodeFrame } from './commands.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

function html(script, h5 = false) {
  return '<!doctype html>\n<html lang="en"><meta charset="utf-8"><meta name="viewport" ' +
    'content="width=device-width,initial-scale=1"><title>Egret Runtime SDK</title>' +
    (h5 ? '<style>html,body{margin:0;background:#000}body{height:100dvh;display:grid;place-items:center}canvas{display:block;width:min(100vw,166.666667dvh);height:auto}</style>' +
      '<canvas width="320" height="192"></canvas>' : '') +
    '<script src="./' + script + '"></script></html>\n';
}

export async function buildScene(esbuildModule, output) {
  const esbuild = require(require.resolve(path.resolve(esbuildModule)));
  if (esbuild.version !== '0.28.2') throw new Error('This scene uses esbuild 0.28.2');
  const modules = workspaceModules(root);
  const parent = path.dirname(output);
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(path.join(parent, 'egret-runtime-scene-'));
  try {
    const resolveWorkspace = {
      name: 'egret-runtime-fixture',
      setup(builder) {
        builder.onResolve({ filter: /^(@egret\/|#)/ }, wanted => {
          const resolved = modules.get(wanted.path);
          if (!resolved) throw new Error('Unknown workspace import ' + wanted.path);
          return { path: resolved };
        });
      }
    };
    for (const file of ['host', 'browser']) {
      await esbuild.build({
        entryPoints: [path.join(here, file + '.mjs')], outfile: path.join(temp, file + '.js'),
        bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2022',
        legalComments: 'eof', plugins: [resolveWorkspace]
      });
    }
    await writeFile(path.join(temp, 'host.html'), html('host.js'));
    await writeFile(path.join(temp, 'index.html'), html('browser.js', true));
    for (const [source, destination] of [
      ['LICENSE', 'LICENSE'], ['NOTICE', 'NOTICE'],
      ['third-party/robust-predicates-3.0.3.LICENSE', 'robust-predicates.LICENSE']
    ]) await copyFile(path.join(root, source), path.join(temp, destination));
    const scene = await createScene();
    let manifest;
    try {
      const frames = [];
      for (let slot = 0; slot < CYCLE; slot++) {
        const bytes = encodeFrame(scene.capture(slot), slot, scene.page, PAGE.id);
        if (slot && bytes.length !== frames[0].length) throw new Error('Variable fixture frame length');
        frames.push(bytes);
      }
      const cycle = Buffer.concat(frames);
      const atlas = scene.pageBytes();
      const sha = data => createHash('sha256').update(data).digest('hex');
      manifest = { width: WIDTH, height: HEIGHT, frameCount: CYCLE, frameBytes: frames[0].length,
        atlasWidth: PAGE.width, atlasHeight: PAGE.height, pageId: PAGE.id,
        framesSha256: sha(cycle), atlasSha256: sha(atlas) };
      await writeFile(path.join(temp, 'atlas.rgba'), atlas, { flag: 'wx' });
      await writeFile(path.join(temp, 'frames.bin'), cycle, { flag: 'wx' });
      await writeFile(path.join(temp, 'fixture.json'), JSON.stringify(manifest, null, 2) + '\n');
    } finally { await scene.close(); }
    // Publish the complete directory together. Its unique staging path is the
    // only directory owned and removed by this invocation.
    await rename(temp, output);
    return manifest;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [flag, bundler, outFlag, output, ...rest] = process.argv.slice(2);
  if (flag !== '--esbuild' || !bundler || outFlag !== '--out' || !output || rest.length)
    throw new Error('Usage: node runtime-sdk/scene/build.mjs --esbuild <module> --out <new-directory>');
  console.log(JSON.stringify(await buildScene(bundler, path.resolve(output))));
}
