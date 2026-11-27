// SPDX-License-Identifier: Apache-2.0
import path from 'node:path';
import { constants } from 'node:fs';
import { copyFile, mkdir, mkdtemp, lstat, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { inputFile } from './export-project.mjs';

import { original5NativeAbi } from './original5-abi.mjs';
export { original5NativeAbi };

/** Stage original published JS byte-for-byte for the normal Android exporter and its signed build. */
export async function prepareOriginal5(source, config, output) {
  source = await realpath(source);
  output = path.resolve(output);
  const {entryClass, width, height, frameRate = 30, clearColor = 0, images = [], assets = []} = config;
  if (![width,height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) ||
      typeof entryClass !== 'string' || !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(entryClass) ||
      entryClass.split('.').some(s => ['__proto__','constructor','prototype'].includes(s)) ||
      !Number.isFinite(frameRate) || frameRate <= 0 || frameRate > 120 ||
      !Number.isInteger(clearColor) || clearColor < 0 || clearColor > 0xffffffff ||
      !Array.isArray(assets) || !Array.isArray(images)) throw new Error('Invalid original game configuration');
  const manifest = JSON.parse(await readFile(await inputFile(source, config.manifest ?? 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.initial) || !Array.isArray(manifest.game) ||
      !manifest.initial.length || !manifest.game.length) throw new Error('Expected published initial and game script arrays');
  const core = config.coreScript ?? manifest.initial[0];
  if (manifest.initial[0] !== core || (!config.coreScript && !/(?:^|\/)egret(?:\.min)?\.js$/.test(core))) {
    throw new Error('The first original engine script must be identified in coreScript');
  }
  const coreSource = await readFile(await inputFile(source,core), 'utf8');
  const nativeAbi = original5NativeAbi(coreSource, config.nativeAbi);
  const originalScripts = [...manifest.initial, ...manifest.game];
  if (originalScripts.length > 4095 || new Set(originalScripts.map(name => name.toLowerCase())).size !== originalScripts.length ||
      originalScripts.some(name => !name.endsWith('.js'))) throw new Error('Duplicate, invalid or oversized original script plan');
  const webHost = config.webHostScript;
  if (webHost !== undefined && (webHost === core || !manifest.initial.includes(webHost))) {
    throw new Error('The specified browser host must appear after the core in the original manifest');
  }
  const modules = manifest.initial.slice(1).filter(name =>
    webHost === undefined ? !/(?:^|\/)egret\.web(?:\.min)?\.js$/.test(name) : name !== webHost);
  const resources = [...assets];
  for (const image of images) {
    if (!image || typeof image.path !== 'string' || ![image.width,image.height].every(n => Number.isInteger(n) && n > 0 && n <= 4096)) {
      throw new Error('Original images require their resource path and physical dimensions');
    }
    if (!resources.includes(image.path)) resources.push(image.path);
  }
  const adapter = config.hostAdapter;
  if (adapter !== undefined && (typeof adapter !== 'string' || !adapter.endsWith('.mjs'))) {
    throw new Error('hostAdapter must name a self-contained ES module under the published root');
  }
  const names = new Set(['main.mjs','index.html','project.json','game.js','original-host.mjs','original-script-map.json']);
  for (const name of resources) {
    const key = name.toLowerCase();
    if (names.has(key) || key === 'original' || key.startsWith('original/')) throw new Error('Conflicting original resource: ' + name);
    names.add(key);
  }
  try { await lstat(output); throw new Error('Original game output already exists'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(path.dirname(output), {recursive:true});
  const staging = await mkdtemp(path.join(path.dirname(output),'egret-original5-'));
  try {
    await mkdir(path.join(staging,'original'));
    const scriptMap = Object.create(null);
    let index = 0;
    async function copyScripts(list) {
      const result = [];
      for (const name of list) {
        const file = 'original/' + String(index++).padStart(4,'0') + '.js';
        await copyFile(await inputFile(source,name),path.join(staging,file),constants.COPYFILE_EXCL);
        scriptMap[file] = name;
        result.push(file);
      }
      return result;
    }
    const groups = {originalCore:await copyScripts([core])};
    if (modules.length) groups.originalModules = await copyScripts(modules);
    groups.originalGame = await copyScripts(manifest.game);
    for (const name of resources) {
      const original = await inputFile(source,name);
      const destination = path.join(staging,name);
      await mkdir(path.dirname(destination),{recursive:true});
      await copyFile(original,destination,constants.COPYFILE_EXCL);
    }
    const options = {width,height,entryClass,frameRate,clearColor,images,nativeAbi};
    if (!modules.length) options.moduleGroup = null;
    const setup = ["import { installOriginal5Project } from '@egret/android-original5';"];
    if (adapter !== undefined) {
      await copyFile(await inputFile(source,adapter), path.join(staging,'original-host.mjs'), constants.COPYFILE_EXCL);
      setup.push("import * as host from './original-host.mjs';");
    }
    setup.push('const options = ' + JSON.stringify(options,null,2) + ';');
    setup.push(adapter === undefined ? 'installOriginal5Project(options);' : 'installOriginal5Project({...options, installHost: host.installHost, remoteRequest: host.remoteRequest});');
    await writeFile(path.join(staging,'main.mjs'), setup.join('\n') + '\n');
    // Keep diagnostics usable with thousands of scripts without growing the on-device manifest.
    await writeFile(path.join(staging,'original-script-map.json'),JSON.stringify(scriptMap,null,2) + '\n');
    await writeFile(path.join(staging,'index.html'),'<!doctype html><meta charset="utf-8"><script src="game.js"></script>\n');
    await writeFile(path.join(staging,'project.json'), JSON.stringify({
      width,height,entry:'index.html',pages:[],assets:resources,v8ScriptMode:'classic',v8Scripts:{groups}
    },null,2) + '\n');
    await rename(staging,output);
  } finally { await rm(staging,{recursive:true,force:true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const {values} = parseArgs({options:{source:{type:'string'},config:{type:'string'},out:{type:'string'}}});
  if (!values.source || !values.config || !values.out) throw new Error('Supply --source, --config and a new --out directory');
  await prepareOriginal5(values.source,JSON.parse(await readFile(values.config,'utf8')),values.out);
}
