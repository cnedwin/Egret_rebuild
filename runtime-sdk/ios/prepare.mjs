// SPDX-License-Identifier: Apache-2.0
// Stage the selected customer entry and its distribution notices into a fresh bundle.
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {workspaceModules} from '../../tools/pack-single-file.mjs';
const {values} = parseArgs({options: {esbuild:{type:'string'}, out:{type:'string'}, entry:{type:'string'}}});
if (!values.esbuild || !values.out) throw Error('Supply --esbuild <module-directory> --out <new-directory>');
const root = fileURLToPath(new URL('../..', import.meta.url));
const target = path.resolve(values.out);
const gameEntry = values.entry ? path.resolve(values.entry) : path.join(root,'runtime-sdk/ios/fixture-game.mjs');
await mkdir(path.dirname(target), {recursive:true});
const stage = await mkdtemp(path.join(path.dirname(target), '.egret-ios-'));
try {
  const esbuild = createRequire(import.meta.url)(path.resolve(values.esbuild));
  if (esbuild.version !== '0.28.2') throw Error('Prepare requires esbuild 0.28.2.');
  const modules = workspaceModules(root);
  await esbuild.build({entryPoints:[path.join(root, 'runtime-sdk/ios/entry.mjs')], outfile:path.join(stage,'scene.js'),
    bundle:true, minify:true, target:'safari16.4', platform:'browser', format:'iife', legalComments:'eof',
    plugins:[{name:'built-egret-modules', setup(builder) {
      builder.onResolve({filter:/^egret-ios:game$/}, () => ({path:gameEntry}));
      builder.onResolve({filter:/^(@egret\/|#)/}, args => {
        const found = modules.get(args.path);
        if (!found) throw Error('Unknown workspace export ' + args.path);
        return {path:found};
      });
    }}]});
  // Package source as text so Xcode does not consume it as a compile phase input.
  await copyFile(path.join(root,'runtime-sdk/ios/app/Quad.metal'),path.join(stage,'Quad.metal.txt'));
  for (const [source,name] of [['LICENSE','LICENSE'],['NOTICE','NOTICE'],
      ['third-party/robust-predicates-3.0.3.LICENSE','robust-predicates.LICENSE']])
    await copyFile(path.join(root,source),path.join(stage,name));
  // Use the same AbortController contract as the bare Android V8 host. iOS supplies its timer callbacks.
  const bootstrap = await readFile(path.join(root,'runtime-sdk/android/player/v8/project-bootstrap.js'),'utf8');
  await writeFile(path.join(stage,'bootstrap.js'),bootstrap);
  await rename(stage,target);
} finally { await rm(stage,{recursive:true,force:true}); }
