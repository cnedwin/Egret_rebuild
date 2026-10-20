// SPDX-License-Identifier: Apache-2.0
// Finite full30 GL closure; preserves the shared catalog, scalar oracle and collector caps.
// The actual separate public GL scene entry is included for the four unchanged B1+UI cases.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fingerprintFile,logicalPath,samePhysicalPath} from '../lib/file-identity.mjs';
import {literalImports,sourceCounterpart} from '../textured-webgpu/native-files.mjs';

export const SHARED_NATIVE_ENTRIES=Object.freeze({
  '@egret/engine':'packages/engine/dist/index.js',
  '@egret/engine/webgl2':'packages/engine/dist/web/webgl2.js',
  '@egret/engine/scene3d':'packages/engine/dist/rendering/scene3d.js',
  '@egret/engine/webgl2/scene3d':'packages/engine/dist/web/webgl2Scene3d.js',
  '@egret/contracts':'packages/contracts/dist/index.js',
  '@egret/contracts/resources':'packages/contracts/dist/resources/index.js',
  '@egret/runtime':'packages/runtime/dist/index.js',
  '#egret-textured-frame-state':'packages/engine/dist/internal/texturedFrameState.js',
  'robust-predicates':'vendor/robust-predicates/index.js',
});
const TOOL_MODULE='tools/shared-rendering/gl-native-window.mjs';
const MANIFEST='tools/shared-rendering/native-cases.json';
const CONTROLS='tools/shared-rendering/native-controls.json';
const TOOL_INPUTS=['tools/verify-shared-webgpu.mjs','tools/shared-rendering/collector.mjs',
  'tools/shared-rendering/native-source.mjs','tools/shared-rendering/oracle.mjs','tools/shared-rendering/check-native-cases.mjs',
  'tools/lib/file-identity.mjs','tools/textured-webgpu/native-files.mjs',
  'tools/verify-shared-webgl2.mjs','tools/shared-rendering/gl-collector.mjs','tools/shared-rendering/gl-native-source.mjs'];
const hash=body=>createHash('sha256').update(body).digest('hex');
const exact=(a,b)=>assert.deepEqual(a,b);

/** Source, emitted modules and data are frozen before browser/device creation. */
export function collectSharedNativeInputs(repository){
  const root=fs.realpathSync(repository);
  assert.ok(samePhysicalPath(root,repository),'canonical repository owner required');
  const vendor=fs.realpathSync(path.join(root,'packages/engine/node_modules/robust-predicates'));
  const owners={repository:root,'robust-predicates':vendor};
  const inputs=new Map(),modules=new Map(),routes=new Map();
  let graphBytes=0;
  function retain(owner,file){
    logicalPath(file);
    const key=owner+':'+file;
    if(inputs.has(key))return inputs.get(key);
    const pin=fingerprintFile(owners[owner],file);
    assert.ok(pin.bytes<=4*1024*1024,'bounded native input');
    const body=fs.readFileSync(path.join(owners[owner],file));
    exact({bytes:body.length,sha256:hash(body)},{bytes:pin.bytes,sha256:pin.sha256});
    const row={owner,...pin,body};inputs.set(key,row);return row;
  }
  function visit(route){
    logicalPath(route);
    if(modules.has(route))return;
    assert.ok(modules.size<256,'bounded native module count');
    let owner='repository',file=route;
    if(route.startsWith('vendor/robust-predicates/')){owner='robust-predicates';file=route.slice('vendor/robust-predicates/'.length);}
    else assert.ok(route===TOOL_MODULE||/^packages\/(?:engine|runtime|contracts)\/dist\/.+\.js$/.test(route),'undeclared native module domain');
    const item=retain(owner,file);
    graphBytes+=item.bytes;assert.ok(graphBytes<=8*1024*1024,'bounded native module bytes');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(item.body);
    const module={route,owner,file,bytes:item.bytes,sha256:item.sha256,edges:[]};
    modules.set(route,module);routes.set('/'+route,item.body);
    if(owner==='repository'&&route!==TOOL_MODULE){
      const source=sourceCounterpart(route);assert.ok(source,'source counterpart required');retain(owner,source);
      retain(owner,route.slice(0,-3)+'.d.ts');
    }
    for(const specifier of literalImports(text)){
      let target;
      if(specifier.startsWith('.')){
        target=path.posix.normalize(path.posix.join(path.posix.dirname(route),specifier));logicalPath(target);
        if(owner==='robust-predicates')assert.ok(target.startsWith('vendor/robust-predicates/'),'vendor owner escape');
        else assert.ok(target.startsWith(route===TOOL_MODULE?'tools/shared-rendering/':'packages/'),'module owner escape');
      }else{
        assert.ok(Object.hasOwn(SHARED_NATIVE_ENTRIES,specifier),'unknown bare import: '+specifier);
        target=SHARED_NATIVE_ENTRIES[specifier];
        if(specifier==='#egret-textured-frame-state')assert.equal(route,'packages/engine/dist/web/WebGL2Host.js','private bridge consumer');
      }
      module.edges.push({specifier,target});visit(target);
    }
  }
  for(const name of ['contracts','runtime','engine']){
    assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret',name)),path.join(root,'packages',name)),'foreign SDK alias');
    const pkg=JSON.parse(retain('repository','packages/'+name+'/package.json').body);
    assert.equal(pkg.name,'@egret/'+name);
    for(const [specifier,route] of Object.entries(SHARED_NATIVE_ENTRIES)){
      if(!specifier.startsWith('@egret/'+name))continue;
      const entry=specifier==='@egret/'+name?'.':'.'+specifier.slice(('@egret/'+name).length);
      assert.equal(pkg.exports[entry].import,'./'+route.slice(('packages/'+name+'/').length));
    }
  }
  const engine=JSON.parse(retain('repository','packages/engine/package.json').body);
  assert.equal(engine.imports['#egret-textured-frame-state'].import,'./dist/internal/texturedFrameState.js');
  const dependency=JSON.parse(retain('robust-predicates','package.json').body);
  assert.equal(dependency.name,'robust-predicates');assert.equal(dependency.version,'3.0.3');
  for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.json',
    'packages/contracts/tsconfig.json','packages/runtime/tsconfig.json','packages/engine/tsconfig.json',
    'packages/engine/tsconfig.web.json','packages/engine/tsconfig.rendering.json','tools/build.mjs',...TOOL_INPUTS])retain('repository',file);
  visit(TOOL_MODULE);
  for(const specifier of ['@egret/engine','@egret/engine/webgl2','@egret/engine/scene3d','@egret/engine/webgl2/scene3d'])visit(SHARED_NATIVE_ENTRIES[specifier]);
  const manifestInput=retain('repository',MANIFEST);
  routes.set('/'+MANIFEST,manifestInput.body);
  const manifest=JSON.parse(manifestInput.body);
  assert.equal(manifestInput.sha256,'61199be5bf2e9a98e306ab659086e80288529d42b2128b5f4c029ece31a12953','unchanged frozen catalog');
  assert.equal(retain('repository','tools/shared-rendering/oracle.mjs').sha256,'ce8b09c836f548a3be7524d32e2d75f50eda53615b9658cd0ce47f75c5a8de31','unchanged scalar oracle');
  assert.equal(manifest.cases.length,30);
  assert.equal(manifest.cases.reduce((n,c)=>n+c.points.length,0),321);
  assert.equal(manifest.cases.reduce((n,c)=>n+c.points.reduce((m,p)=>m+p.channels.length,0),0),1236);
  assert.equal(manifest.cases.reduce((n,c)=>n+c.points.filter(p=>p.bleed).length,0),104);
  retain('repository',CONTROLS); // Preserve old GPU controls as provenance, never use their emitted pins for GL.
  const controls=JSON.parse(retain('repository','tools/shared-rendering/gl-native-controls.json').body);
  const mutants=new Map();
  for(const control of controls){
    assert.ok(!mutants.has(control.id),'one artifact per assigned control');
    assert.ok(modules.has(control.file),'control must alter one served emitted module');
    const original=routes.get('/'+control.file);
    exact({bytes:original.length,sha256:hash(original)},control.original);
    const text=new TextDecoder('utf-8',{fatal:true}).decode(original);
    assert.equal(text.split(control.from).length,2,'unique reviewed mutation anchor');
    const altered=Buffer.from(text.replace(control.from,control.to));
    exact({bytes:altered.length,sha256:hash(altered)},control.changed);
    exact(literalImports(altered.toString('utf8')),literalImports(text));
    mutants.set(control.id,altered);
  }
  const importMap={imports:Object.fromEntries(Object.entries(SHARED_NATIVE_ENTRIES).map(([name,file])=>[name,'/'+file]))};
  function verifyStable(){
    for(const row of inputs.values())exact(fingerprintFile(owners[row.owner],row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});
    for(const name of ['contracts','runtime','engine'])assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret',name)),path.join(root,'packages',name)),'SDK alias changed');
    assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'packages/engine/node_modules/robust-predicates')),vendor),'dependency owner changed');
    return true;
  }
  verifyStable();
  return {root,owners,manifest,controls,mutants,importMap,routes,modules,verifyStable,
    record:{inputs:[...inputs.values()].map(({body,...row})=>row),modules:[...modules.values()],graphBytes}};
}
