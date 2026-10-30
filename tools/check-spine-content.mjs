// SPDX-License-Identifier: Apache-2.0
// One optional leaf check; the unchanged four-core checks remain authoritative.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {localPackage} from './lib/local-package.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const base=path.join(root,'packages/spine'),json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const pkg=json(path.join(base,'package.json'));
assert.deepEqual(pkg.dependencies,{'@egret/contracts':'workspace:*','@egret/engine':'workspace:*','@esotericsoftware/spine-core':'4.3.13'});
assert.deepEqual(pkg.exports,{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./web':{types:'./dist/web.d.ts',import:'./dist/web.js'}});
const config=json(path.join(base,'tsconfig.json'));
assert.equal(config.extends,'../../tsconfig.base.json');assert.deepEqual(config.references,[{path:'../contracts'},{path:'../engine'}]);
const require=createRequire(path.join(base,'package.json'));
const owner=localPackage(root,path.resolve(path.dirname(require.resolve('@esotericsoftware/spine-core')),'..'),'@esotericsoftware/spine-core','4.3.13');
const legal=fs.readFileSync(path.join(root,'third-party/spine-core-4.3.13.LICENSE'));
assert.equal(legal.length,1468);assert.equal(createHash('sha256').update(legal).digest('hex'),'435774fb793b0f67892899fc934f98009e64fd90ad3ab964117274e279a0f50e');
assert.ok(legal.equals(fs.readFileSync(path.join(owner,'LICENSE'))));
const allowed=new Set(['@egret/engine','@egret/engine/resources','@egret/engine/web/resources','@egret/contracts/resources']);
let inspected=0;
for(const folder of ['src','dist'])for(const file of fs.readdirSync(path.join(base,folder))){
 if(!/\.(?:ts|js)$/.test(file))continue;
 const raw=fs.readFileSync(path.join(base,folder,file),'utf8'),code=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const isWeb=file.startsWith('web.'),isParser=file.startsWith('parse.');
 assert.ok(!/\b(?:require|process|Buffer|eval)\b|["']node:|\bimport\s*\(/.test(code),folder+'/'+file+': forbidden host/dynamic import');
 if(!isWeb)assert.ok(!/\b(?:window|document|HTML\w*Element|GPUDevice|ImageBitmap|TextDecoder)\b/.test(code),folder+'/'+file+': core host access');
 for(const m of code.matchAll(/\b(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g)){
  const target=m[1];
  if(target.startsWith('.'))assert.match(target,/^\.\/[A-Za-z][A-Za-z0-9]*\.js$/);
  else if(target==='@esotericsoftware/spine-core')assert.ok(isParser,'Core is private to the format adapter');
  else {assert.ok(allowed.has(target),'unreviewed import '+target);assert.ok(isWeb||target!=='@egret/engine/web/resources');}
 }
 inspected++;
}
assert.deepEqual(Object.keys(await import(new URL('../packages/spine/dist/index.js',import.meta.url))),['createSpineContentLoader']);
assert.deepEqual(Object.keys(await import(new URL('../packages/spine/dist/web.js',import.meta.url))),['createManifestSpineContentLoader']);
for(const name of ['contracts','runtime','engine','project'])assert.ok(!Object.hasOwn(json(path.join(root,'packages',name,'package.json')).dependencies??{},'@esotericsoftware/spine-core'));
console.log('Optional Spine dependency, exact original notice and public/source boundaries PASS: '+inspected+' source/emission files.');
