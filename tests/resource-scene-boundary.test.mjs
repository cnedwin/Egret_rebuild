// SPDX-License-Identifier: Apache-2.0
// CPU/source refusal controls; no Engine/host execution, browser, pixel or font acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {collectResourceSceneSource} from '../tools/resource-scene-boundary.mjs';
import * as resourceSceneBoundary from '../tools/resource-scene-boundary.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const example='examples/resource-scene/';
// A projection contains application originals only. SDK files always come from repository.
const files=[
 ...['index.html','main.mjs','session.mjs','gpu-scene.mjs'].map(name=>example+name),
 ...['atlas-v1.png','atlas-v2.png','outfit-A.png','outfit-B.png','outfit-C.png','outfit-D.png',
   'NotoSansSC-fixed.woff2','NotoSansSC.source.css','NotoSansSC-OFL.txt','provenance.json'].map(name=>example+'assets/'+name),
 'tools/browser-png/assets/rgb-red-green.png',
 ...['ahem.ttf','Ahem-README.txt','Ahem-COPYING.txt'].map(name=>'examples/canvas-text/assets/'+name),
 'tools/resource-scene-boundary.mjs','tools/resource-scene/oracle.mjs','tools/resource-scene/author-assets.mjs',
 'tools/resource-scene/reference/left.rgba','tools/resource-scene/reference/right.rgba','tools/resource-scene/reference/manifest.json',
 'tests/resource-scene-boundary.test.mjs','tests/resource-scene-assets.test.mjs',
 'tests/resource-scene-session.test.mjs','tests/resource-scene-session-heldout.test.mjs',
 'tests/resource-scene-gpu.test.mjs','tests/resource-scene-browser-source.test.mjs',
];
const read=(root,key)=>fs.readFileSync(path.join(root,key));
function originalProjection(){
  const parent=fs.realpathSync(tmpdir()),root=fs.realpathSync(fs.mkdtempSync(path.join(parent,'egret-resource-scene-boundary-')));
  const projection={root,retire(){
    // A recursive removal is restricted to this freshly owned, checked temporary directory.
    assert.equal(path.dirname(fs.realpathSync(root)),parent);
    assert.match(path.basename(root),/^egret-resource-scene-boundary-/);
    fs.rmSync(root,{recursive:true,force:false});
  }};
  try{for(const key of files){const target=path.join(root,key);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repository,key),target);}}
  catch(cause){try{projection.retire();}catch(cleanup){throw new AggregateError([cause,cleanup],'Projection setup and cleanup failed');}throw cause;}
  return projection;
}
function assertHealthy(value,applicationRoot){
  assert.ok(value.routes instanceof Map);assert.equal(value.snapshot.kind,'RESOURCE_SCENE_SOURCE_SNAPSHOT_NO_BROWSER');
  assert.equal(value.snapshot.sourceOnly,true);assert.equal(value.snapshot.acceptance.browserExecuted,false);
  assert.equal(value.snapshot.acceptance.independentSourceReviewRequired,true);
  assert.deepEqual(value.routes.get('/'+example+'index.html').bytes,read(applicationRoot,example+'index.html'));
  assert.equal(value.snapshot.servedOriginalHTML.rewritten,false);
  const resourceTarget='sdk:packages/contracts/dist/resources/index.js';
  assert.equal(value.snapshot.authoredImportMap.imports['@egret/contracts/resources'],'../../packages/contracts/dist/resources/index.js');
  assert.equal(value.snapshot.modules.filter(row=>row.owner+':'+row.path===resourceTarget).length,1);
  const resourceEdges=value.snapshot.modules.flatMap(row=>row.edges.filter(edge=>edge.specifier==='@egret/contracts/resources'));
  assert.ok(resourceEdges.length>0);assert.ok(resourceEdges.every(edge=>edge.target===resourceTarget));
  assert.ok(value.snapshot.closures.canvas.includes(resourceTarget));
  assert.deepEqual(value.routes.get('/packages/contracts/dist/resources/index.js').bytes,read(repository,'packages/contracts/dist/resources/index.js'));
  assert.ok(value.snapshot.modules.length>20&&value.snapshot.modules.length<=192);
  assert.ok(value.snapshot.closures.canvas.includes('application:'+example+'main.mjs'));
  assert.ok(value.snapshot.closures.canvas.includes('application:'+example+'session.mjs'));
  assert.ok(!value.snapshot.closures.canvas.some(key=>/gpu-scene|WebGPU|webgpu|foundation:/.test(key)));
  assert.ok(value.snapshot.closures.gpu.includes('application:'+example+'gpu-scene.mjs'));
  assert.ok(value.snapshot.closures.gpu.includes('sdk:packages/engine/dist/web/scene3d.js'));
  const b1='sdk:packages/engine/dist/web/b1.js',sharedB1='sdk:packages/engine/dist/web/sharedB1.js';
  const host=value.snapshot.modules.find(row=>row.owner==='sdk'&&row.path==='packages/engine/dist/web/WebGPUHost.js');
  assert.ok(host,'the genuine emitted WebGPUHost is in the collected closure');
  assert.deepEqual(host.edges.filter(edge=>edge.dynamic),[
    {specifier:'./sharedB1.js',dynamic:true,target:sharedB1,route:'/packages/engine/dist/web/sharedB1.js'},
    {specifier:'./b1.js',dynamic:true,target:b1,route:'/packages/engine/dist/web/b1.js'},
  ]);
  for(const key of [b1,sharedB1]) {
    assert.ok(value.snapshot.closures.gpu.includes(key));assert.ok(value.snapshot.closures.webgpu.includes(key));
    assert.ok(!value.snapshot.closures.canvas.includes(key));
    assert.ok(value.routes.has('/'+key.slice('sdk:'.length)));
  }
  assert.equal(value.snapshot.foundationAdmission.name,'robust-predicates');assert.equal(value.snapshot.foundationAdmission.version,'3.0.3');
  assert.ok(value.routes.has('/packages/engine/node_modules/robust-predicates/index.js'));
  assert.ok([...value.routes.keys()].every(key=>!key.startsWith('/m/')));
  assert.ok(![...value.routes.keys()].some(key=>key.startsWith('/tools/resource-scene/reference/')));
  for(const key of ['sdk:tools/lib/file-identity.mjs','sdk:pnpm-lock.yaml','sdk:packages/engine/src/Engine.ts',
    'sdk:packages/engine/dist/Engine.d.ts','application:'+example+'assets/provenance.json']){
    assert.ok(value.snapshot.inventory.some(row=>row.owner+':'+row.path===key),key);
  }
  for(const key of ['assets/outfit-A.png','assets/atlas-v2.png','assets/NotoSansSC-fixed.woff2']){
    assert.deepEqual(value.routes.get('/'+example+key).bytes,read(applicationRoot,example+key));
  }
}
async function sourceControl(change,code,detail){
  const projection=originalProjection();
  try{
    // Every negative starts with its own complete healthy source/asset baseline.
    const healthy=await collectResourceSceneSource({repository,applicationRoot:projection.root});assertHealthy(healthy,projection.root);
    change(projection.root);
    await assert.rejects(collectResourceSceneSource({repository,applicationRoot:projection.root}),
      error=>error.code===code&&error.message.includes(detail));
    assert.deepEqual(read(repository,example+'index.html'),healthy.routes.get('/'+example+'index.html').bytes);
  }finally{projection.retire();}
}
const alter=(root,key,change)=>fs.writeFileSync(path.join(root,key),change(read(root,key).toString('utf8')));

test('source collector keeps original routes and separates the static Canvas and optional GPU closures',async()=>{
  const projection=originalProjection();try{
    const collected=await collectResourceSceneSource({repository,applicationRoot:projection.root});assertHealthy(collected,projection.root);
    // The served buffers are independent retained originals, not later filesystem reads.
    const bytes=Buffer.from(collected.routes.get('/'+example+'assets/outfit-A.png').bytes);
    fs.writeFileSync(path.join(projection.root,example+'assets/outfit-A.png'),Buffer.from([0]));
    assert.deepEqual(collected.routes.get('/'+example+'assets/outfit-A.png').bytes,bytes);
  }finally{projection.retire();}
});
test('wrong authored map target is refused without replacing or repairing HTML',()=>sourceControl(root=>{
  alter(root,example+'index.html',text=>text.replace('"@egret/engine": "../../packages/engine/dist/index.js"',
    '"@egret/engine": "../../packages/engine/dist/other.js"'));
},'RS_IMPORT_MAP','Authored import-map target differs: @egret/engine'));
test('duplicate import-map keys are refused before mapping',()=>sourceControl(root=>{
  alter(root,example+'index.html',text=>text.replace('"@egret/engine": "../../packages/engine/dist/index.js",',
    '"@egret/engine": "../../packages/engine/dist/index.js",\n      "@egret/engine": "../../packages/engine/dist/index.js",'));
},'RS_IMPORT_MAP','duplicate key'));
test('frozen original PNG byte drift is refused',()=>sourceControl(root=>{
  const key=example+'assets/outfit-A.png',bytes=read(root,key);bytes[bytes.length-1]^=1;fs.writeFileSync(path.join(root,key),bytes);
},'RS_FROZEN_INPUT','assets/outfit-A.png'));
test('missing original GPU module is refused',()=>sourceControl(root=>{
  fs.unlinkSync(path.join(root,example+'gpu-scene.mjs'));
},'RS_INPUT','application:'+example+'gpu-scene.mjs'));
test('application imports cannot broaden to a private SDK package',()=>sourceControl(root=>{
  alter(root,example+'main.mjs',text=>"import '@egret/runtime';\n"+text);
},'RS_IMPORT','application import: @egret/runtime'));
test('relative imports cannot escape the selected application modules',()=>sourceControl(root=>{
  alter(root,example+'main.mjs',text=>"import '../../packages/runtime/dist/index.js';\n"+text);
},'RS_IMPORT','Unselected module: application:packages/runtime/dist/index.js'));
test('a computed dynamic import is refused rather than guessed',()=>sourceControl(root=>{
  alter(root,example+'main.mjs',text=>text+'\nimport(globalThis.__unselectedModule);\n');
},'RS_IMPORT','Only simple literal imports'));
test('an additional literal Main dynamic import is refused',()=>sourceControl(root=>{
  alter(root,example+'main.mjs',text=>text+"\nimport('./session.mjs');\n");
},'RS_IMPORT','Unselected dynamic import: application:'+example+'main.mjs -> ./session.mjs'));
test('the GPU recipe cannot become a static Canvas dependency',()=>sourceControl(root=>{
  alter(root,example+'main.mjs',text=>"import './gpu-scene.mjs';\n"+text);
},'RS_IMPORT','Static Canvas closure crossed'));

test('selected resource public entry refuses wrong runtime/types targets without broad fallback',()=>{
  assert.equal(typeof resourceSceneBoundary.validateResourceSceneEntries,'function','M15_RESOURCE_SCENE_ENTRY_POLICY_MISSING');
  const actual=Object.fromEntries(['engine','runtime','contracts'].map(name=>
    [name,JSON.parse(read(repository,'packages/'+name+'/package.json'))]));
  const validate=resourceSceneBoundary.validateResourceSceneEntries;
  for(const mutate of [
    metadata=>{metadata.contracts.exports['./resources'].import='./dist/index.js';},
    metadata=>{metadata.contracts.exports['./resources'].types='./dist/index.d.ts';},
    metadata=>{delete metadata.contracts.exports['./resources'];},
    metadata=>{delete metadata.contracts.exports['./resources'];metadata.contracts.exports['./*']={import:'./dist/resources/index.js',types:'./dist/resources/index.d.ts'};},
  ]){
    assert.doesNotThrow(()=>validate(actual));
    const changed=structuredClone(actual);mutate(changed);
    assert.throws(()=>validate(changed),error=>error.code==='RS_PACKAGE'&&error.message.includes('@egret/contracts/resources'));
    assert.doesNotThrow(()=>validate(actual));
  }
});
