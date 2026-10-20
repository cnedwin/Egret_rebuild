// SPDX-License-Identifier: Apache-2.0
// One exact C closure. Preserve the existing lifetime collector and its limits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fingerprintFile, logicalPath, samePhysicalPath } from '../lib/file-identity.mjs';
import { literalImports, sourceCounterpart } from '../textured-webgpu/native-files.mjs';
const hash=body=>createHash('sha256').update(body).digest('hex');
const ASSETS='tools/shared-rendering/resource-recovery-assets';
const WINDOW='tools/shared-rendering/resource-recovery-window.mjs';
const OBSERVER='tools/shared-rendering/resource-recovery-observations.mjs';
export const RECOVERY_NATIVE_ENTRIES=Object.freeze({
  '@egret/engine':'packages/engine/dist/index.js',
  '@egret/engine/resources':'packages/engine/dist/resources.js',
  '@egret/engine/web/resources':'packages/engine/dist/web/resources.js',
  '@egret/engine/text':'packages/engine/dist/text.js',
  '@egret/engine/web/text':'packages/engine/dist/web/text.js',
  '@egret/engine/scene3d':'packages/engine/dist/rendering/scene3d.js',
  '@egret/engine/webgl2/scene3d':'packages/engine/dist/web/webgl2Scene3d.js',
  '@egret/engine/webgpu/scene3d':'packages/engine/dist/web/scene3d.js',
  '@egret/contracts':'packages/contracts/dist/index.js',
  '@egret/contracts/resources':'packages/contracts/dist/resources/index.js',
  '@egret/runtime':'packages/runtime/dist/index.js',
  '@egret/runtime/text':'packages/runtime/dist/text/index.js',
  '#egret-textured-frame-state':'packages/engine/dist/internal/texturedFrameState.js',
  '#egret-manifest-resources':'packages/engine/dist/manifestResourceState.js',
  'robust-predicates':'vendor/robust-predicates/index.js',
});
const TOOL_INPUTS=['tools/verify-resource-recovery.mjs','tools/shared-rendering/resource-recovery-collector.mjs',
  'tools/shared-rendering/resource-recovery-source.mjs','tools/shared-rendering/resource-recovery-oracle.mjs',
  'tools/shared-rendering/author-resource-recovery-assets.mjs','tools/build-resource-manifest.mjs',
  'tools/browser-verify.mjs','tools/browser-tool-matrix.json','tools/lib/file-identity.mjs','tools/textured-webgpu/native-files.mjs',
  'tools/shared-rendering/gl-lifetime-collector.mjs','tools/shared-rendering/gl-lifetime-source.mjs',
  'tools/shared-rendering/gl-lifetime-window.mjs','tools/shared-rendering/gl-lifetime-cases.json',
  'tools/shared-rendering/oracle.mjs','tools/shared-rendering/native-cases.json','AGENTS.md','AGENTS.zh-CN.md'];
export function collectRecoveryNativeInputs(repository){
  const root=fs.realpathSync(repository);assert.ok(samePhysicalPath(root,repository));
  const vendor=fs.realpathSync(path.join(root,'packages/engine/node_modules/robust-predicates'));
  const parser=fs.realpathSync(path.join(root,'node_modules/jsonc-parser'));
  const owners={repository:root,'robust-predicates':vendor,'jsonc-parser':parser},inputs=new Map(),modules=new Map(),routes=new Map();let graphBytes=0;
  function retain(owner,file){logicalPath(file);const key=owner+':'+file;if(inputs.has(key))return inputs.get(key);const pin=fingerprintFile(owners[owner],file);assert.ok(pin.bytes<=4*1024*1024,'C single input limit');const body=fs.readFileSync(path.join(owners[owner],file));assert.deepEqual({bytes:body.length,sha256:hash(body)},{bytes:pin.bytes,sha256:pin.sha256});const row={owner,...pin,body};inputs.set(key,row);return row;}
  function visit(route){logicalPath(route);if(modules.has(route))return;assert.ok(modules.size<256,'C 256-module limit');let owner='repository',file=route;
    if(route.startsWith('vendor/robust-predicates/')){owner='robust-predicates';file=route.slice('vendor/robust-predicates/'.length);}
    else assert.ok(route===WINDOW||route===OBSERVER||/^packages\/(?:engine|runtime|contracts)\/dist\/.+\.js$/.test(route),'C module owner');
    const item=retain(owner,file);graphBytes+=item.bytes;assert.ok(graphBytes<=8*1024*1024,'C 8 MiB graph');const text=new TextDecoder('utf-8',{fatal:true}).decode(item.body),row={route,owner,file,bytes:item.bytes,sha256:item.sha256,edges:[]};modules.set(route,row);routes.set('/'+route,item.body);
    if(owner==='repository'&&route!==WINDOW&&route!==OBSERVER){const source=sourceCounterpart(route);assert.ok(source,'C source counterpart');retain(owner,source);retain(owner,route.slice(0,-3)+'.d.ts');}
    for(const specifier of literalImports(text)){let target;if(specifier.startsWith('.')){target=path.posix.normalize(path.posix.join(path.posix.dirname(route),specifier));logicalPath(target);
        if(owner==='robust-predicates')assert.ok(target.startsWith('vendor/robust-predicates/'));
        else if(route===WINDOW||route===OBSERVER)assert.ok(target===WINDOW||target===OBSERVER,'C exact fixture module edge');
        else assert.ok(target.startsWith('packages/'+route.split('/')[1]+'/dist/'),'C relative package escape');
      }else{assert.ok(Object.hasOwn(RECOVERY_NATIVE_ENTRIES,specifier),'C unknown bare import: '+specifier);target=RECOVERY_NATIVE_ENTRIES[specifier];
        if(specifier==='#egret-manifest-resources')assert.equal(route,'packages/engine/dist/web/ManifestByteSource.js','C exact manifest private consumer');
        if(specifier==='#egret-textured-frame-state')assert.ok(['packages/engine/dist/web/WebGL2Host.js','packages/engine/dist/web/WebGPUHost.js'].includes(route),'C existing exact frame consumer');}
      row.edges.push({specifier,target});visit(target);}
  }
  for(const name of ['contracts','runtime','engine']){assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret',name)),path.join(root,'packages',name)));const pkg=JSON.parse(retain('repository','packages/'+name+'/package.json').body);assert.equal(pkg.name,'@egret/'+name);
    for(const [specifier,route]of Object.entries(RECOVERY_NATIVE_ENTRIES)){if(specifier!=='@egret/'+name&&!specifier.startsWith('@egret/'+name+'/'))continue;const entry=specifier==='@egret/'+name?'.':'.'+specifier.slice(('@egret/'+name).length);assert.equal(pkg.exports[entry].import,'./'+route.slice(('packages/'+name+'/').length));}}
  const engine=JSON.parse(retain('repository','packages/engine/package.json').body);assert.equal(engine.imports['#egret-manifest-resources'].import,'./dist/manifestResourceState.js');assert.equal(engine.imports['#egret-textured-frame-state'].import,'./dist/internal/texturedFrameState.js');
  const dependency=JSON.parse(retain('robust-predicates','package.json').body);assert.equal(dependency.name,'robust-predicates');assert.equal(dependency.version,'3.0.3');
  for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json','packages/contracts/tsconfig.json','packages/runtime/tsconfig.json','packages/engine/tsconfig.json','packages/engine/tsconfig.web.json','packages/engine/tsconfig.rendering.json','tools/build.mjs',...TOOL_INPUTS])retain('repository',file);
  visit(WINDOW);
  // Builder inputs are recorded independently and are never served or mapped.
  const builderModules=new Map();let builderBytes=0;
  const builderEntries={'@egret/project':'packages/project/dist/index.js','@egret/project/resources':'packages/project/dist/resources/index.js','@egret/contracts':'packages/contracts/dist/index.js','@egret/contracts/resources':'packages/contracts/dist/resources/index.js'};
  assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret/project')),path.join(root,'packages/project')));
  const projectPackage=JSON.parse(retain('repository','packages/project/package.json').body);
  for(const [specifier,file]of Object.entries(builderEntries)){if(!specifier.startsWith('@egret/project'))continue;const entry=specifier==='@egret/project'?'.':'./resources';assert.equal(projectPackage.exports[entry].import,'./'+file.slice('packages/project/'.length));}
  retain('repository','packages/project/tsconfig.json');
  const parserPackage=JSON.parse(retain('jsonc-parser','package.json').body);assert.equal(parserPackage.name,'jsonc-parser');assert.equal(parserPackage.version,'3.3.1');assert.equal(parserPackage.main,'./lib/umd/main.js');
  const projectRequire=createRequire(path.join(root,'packages/project/package.json'));assert.ok(samePhysicalPath(projectRequire.resolve('jsonc-parser'),path.join(parser,'lib/umd/main.js')));
  const parserEdges={'lib/umd/main.js':['./impl/format','./impl/edit','./impl/scanner','./impl/parser'],'lib/umd/impl/format.js':['./scanner','./string-intern'],'lib/umd/impl/edit.js':['./format','./parser'],'lib/umd/impl/parser.js':['./scanner'],'lib/umd/impl/scanner.js':[],'lib/umd/impl/string-intern.js':[]};
  for(const [file,expected]of Object.entries(parserEdges)){const item=retain('jsonc-parser',file),text=new TextDecoder('utf-8',{fatal:true}).decode(item.body);const calls=[...text.matchAll(/\brequire\(([^)]*)\)/g)].map(match=>{assert.match(match[1],/^"[./a-z-]+"$/);return JSON.parse(match[1]);});assert.deepEqual(calls,expected);builderModules.set('jsonc-parser:'+file,{owner:'jsonc-parser',file,bytes:item.bytes,sha256:item.sha256,edges:expected.map(specifier=>({specifier,target:path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier+'.js'))}))});builderBytes+=item.bytes;}
  retain('jsonc-parser','lib/umd/main.d.ts');retain('jsonc-parser','LICENSE.md');
  function visitBuilder(file){logicalPath(file);if(builderModules.has(file))return;assert.ok(builderModules.size<256);assert.match(file,/^packages\/(?:project|contracts)\/dist\/.+\.js$/);const item=retain('repository',file);builderBytes+=item.bytes;assert.ok(builderBytes<=8*1024*1024);const module={owner:'repository',file,bytes:item.bytes,sha256:item.sha256,edges:[]};builderModules.set(file,module);retain('repository',file.replace('/dist/','/src/').replace(/\.js$/,'.ts'));retain('repository',file.slice(0,-3)+'.d.ts');
    for(const specifier of literalImports(new TextDecoder('utf-8',{fatal:true}).decode(item.body))){let target;if(specifier==='jsonc-parser'){assert.equal(file,'packages/project/dist/json-foundation.js');target='jsonc-parser:lib/umd/main.js';}
      else if(specifier.startsWith('.')){target=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));assert.ok(target.startsWith('packages/'+file.split('/')[1]+'/dist/'));}
      else{assert.ok(Object.hasOwn(builderEntries,specifier));target=builderEntries[specifier];}module.edges.push({specifier,target});if(!target.startsWith('jsonc-parser:'))visitBuilder(target);}}
  for(const file of Object.values(builderEntries))visitBuilder(file);
  const assetPins=JSON.parse(retain('repository',ASSETS+'/asset-pins.json').body);assert.equal(assetPins.inputs.length,92);
  assert.equal(new Set(assetPins.inputs.map(pin=>pin.path)).size,92);
  for(const pin of assetPins.inputs){logicalPath(pin.path);assert.ok(/^(?:sources|assets)\/(?:[ab][01]|atlas|white|p[0-3][0-9])\.png$/.test(pin.path));const file=retain('repository',ASSETS+'/'+pin.path);assert.deepEqual({path:pin.path,bytes:file.bytes,sha256:file.sha256},pin);if(pin.path.startsWith('assets/'))routes.set('/'+ASSETS+'/'+pin.path,file.body);}
  for(const name of ['project.json','catalog.json','manifest.json','builder-receipt.json']){const item=retain('repository',ASSETS+'/'+name);if(name==='catalog.json'||name==='manifest.json')routes.set('/'+ASSETS+'/'+name,item.body);}
  for(const file of ['examples/canvas-text/assets/ahem.ttf','examples/canvas-text/assets/Ahem-COPYING.txt','examples/canvas-text/assets/Ahem-README.txt','examples/canvas-text/assets/provenance.json']){const item=retain('repository',file);if(file.endsWith('.ttf'))routes.set('/'+file,item.body);}
  const catalog=JSON.parse(inputs.get('repository:'+ASSETS+'/catalog.json').body),manifest=JSON.parse(inputs.get('repository:'+ASSETS+'/manifest.json').body);
  assert.equal(catalog.pressure.length,40);assert.equal(manifest.entries.length,46);
  assert.deepEqual(catalog.inputs,assetPins.inputs);
  const receipt=JSON.parse(inputs.get('repository:'+ASSETS+'/builder-receipt.json').body),project=inputs.get('repository:'+ASSETS+'/project.json'),manifestPin=inputs.get('repository:'+ASSETS+'/manifest.json');
  assert.equal(receipt.format,'egret.resource-build-receipt/1');assert.equal(receipt.targetProfile,'web-shared/1');assert.deepEqual(receipt.project,{path:'project.json',sha256:project.sha256,byteLength:project.bytes});assert.deepEqual(receipt.manifest,{sha256:manifestPin.sha256,byteLength:manifestPin.bytes});
  assert.equal(receipt.files.length,92);assert.equal(new Set(receipt.files.map(value=>value.id)).size,92);assert.deepEqual(receipt.files.map(({path,byteLength,sha256})=>({path,bytes:byteLength,sha256})).sort((a,b)=>a.path.localeCompare(b.path)),assetPins.inputs.slice().sort((a,b)=>a.path.localeCompare(b.path)));
  assert.equal(new Set(manifest.entries.map(value=>value.id)).size,46);for(const entry of manifest.entries){assert.equal(entry.dependencies.length,0);assert.equal(entry.resourceKind,'image');assert.equal(entry.targetProfile,'web-shared/1');assert.equal(entry.artifactFormatVersion,'png/1');for(const artifact of [entry.source,entry.artifact]){const pin=assetPins.inputs.find(value=>value.path===artifact.path);assert.ok(pin);assert.equal(artifact.sha256,pin.sha256);assert.equal(artifact.byteLength,pin.bytes);}}
  assert.equal(retain('repository','tools/shared-rendering/native-cases.json').sha256,'61199be5bf2e9a98e306ab659086e80288529d42b2128b5f4c029ece31a12953');assert.equal(retain('repository','tools/shared-rendering/oracle.mjs').sha256,'ce8b09c836f548a3be7524d32e2d75f50eda53615b9658cd0ce47f75c5a8de31');
  function verifyStable(){for(const row of inputs.values())assert.deepEqual(fingerprintFile(owners[row.owner],row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});for(const name of ['contracts','runtime','engine','project'])assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret',name)),path.join(root,'packages',name)));assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'packages/engine/node_modules/robust-predicates')),vendor));assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/jsonc-parser')),parser));assert.ok(samePhysicalPath(projectRequire.resolve('jsonc-parser'),path.join(parser,'lib/umd/main.js')));return true;}
  verifyStable();return {root,owners,routes,modules,catalog,manifest,verifyStable,importMap:{imports:Object.fromEntries(Object.entries(RECOVERY_NATIVE_ENTRIES).map(([name,file])=>[name,'/'+file]))},record:{inputs:[...inputs.values()].map(({body,...row})=>row),modules:[...modules.values()],graphBytes,builder:{modules:[...builderModules.values()],bytes:builderBytes,served:false}}};
}
