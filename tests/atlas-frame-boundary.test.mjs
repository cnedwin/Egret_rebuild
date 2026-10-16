// SPDX-License-Identifier: Apache-2.0
// Bounded verifier policy tests execute no SDK, compiler, browser or product module.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { moduleImports, assignedMutation, strictJSON, HASH, parseCollectorArguments, validateConfig,
  authenticateIdentity, readPinned, verifyAssignedDiff, BUILD_PACKAGES, WORKSPACE_ALIASES, IMPORTS, validateBuildPackage } from '../tools/atlas-frame/boundary.mjs';
import * as identity from '../tools/lib/file-identity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('direct source boundary CLI refuses extra arguments before collecting SDK/browser inputs',()=>{
  const entry=path.join(root,'tools/atlas-frame/boundary.mjs');
  for(const args of [['--unknown'],['--repository',root],['--snapshot-only']]){
    const result=spawnSync(process.execPath,[entry,...args],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,1);assert.equal(result.error,undefined);assert.match(result.stderr,/Source boundary CLI accepts no arguments/);
    assert.equal(result.stdout,'');assert.doesNotMatch(result.stderr,/Playwright|SOURCE_BOUNDARY_PASS/);
  }
});
test('actual root build dependencies admit only exact jsonc and Windows x64 native compiler owners',()=>{
  const selected=BUILD_PACKAGES.find(row=>row.owner==='project-json');
  const json={name:'jsonc-parser',version:'3.3.1',main:'./lib/umd/main.js',typings:'./lib/umd/main.d.ts'};
  const native=BUILD_PACKAGES.find(row=>row.owner==='compiler-native');
  const binary={name:'@typescript/typescript-win32-x64',version:'7.0.2',os:['win32'],cpu:['x64']};
  const baseline=()=>{assert.doesNotThrow(()=>validateBuildPackage(selected,json));assert.doesNotThrow(()=>validateBuildPackage(native,binary));};
  for(const [owner,metadata] of [[selected,{...json,version:'3.3.2'}],[selected,{...json,typings:'other.d.ts'}],
    [selected,{...json,dependencies:{other:'1'}}],[native,{...binary,name:'@typescript/typescript-linux-x64'}],
    [native,{...binary,cpu:['arm64']}],[native,{...binary,dependencies:{other:'1'}}]]){
    baseline();assert.throws(()=>validateBuildPackage(owner,metadata));baseline();
  }
  assert.deepEqual(WORKSPACE_ALIASES.map(row=>row.alias),['node_modules/@egret/contracts','node_modules/@egret/runtime','node_modules/@egret/engine','node_modules/@egret/project']);
  assert.ok(!Object.keys(IMPORTS).some(key=>/jsonc-parser|typescript/.test(key)),'Build-only packages have no browser aliases');
  assert.throws(()=>validateBuildPackage({...selected},json),'A forged selector cannot extend the selected build owner table');
});
test('raw config transport refuses ambiguous flags, hashes and unknown schema',()=>{
  const configPath=path.resolve('config.json'),sha='a'.repeat(64);
  assert.deepEqual(parseCollectorArguments(['--config',configPath,'--config-sha256',sha,'--snapshot-only']),{configPath,configSha256:sha,snapshotOnly:true});
  for(const args of [[],['--config','relative','--config-sha256',sha],['--config',configPath,'--config-sha256',sha.toUpperCase()],
    ['--config',configPath,'--config',configPath,'--config-sha256',sha],['--config',configPath,'--config-sha256',sha,'--snapshot-only','--snapshot-only'],
    ['--config',configPath,'--config-sha256',sha,'--channel','msedge']])assert.throws(()=>parseCollectorArguments(args));
  assert.throws(()=>validateConfig({schemaVersion:1,arbitraryModule:'private.js'}));
  assert.notEqual(HASH(Buffer.from('{"a":1}\n')),HASH(Buffer.from('{ "a": 1 }\n')));
});
test('strict UTF8 JSON rejects duplicate escaped keys and malformed bytes',()=>{
  assert.deepEqual(strictJSON(Buffer.from('{"a":[1,true,null,"x\\\"y"],"b":{}}')),{a:[1,true,null,'x"y'],b:{}});
  for(const raw of ['{"a":1,"\\u0061":2}','{"nested":{"x":1,"x":2}}','{"a":1}false','[1,]'])assert.throws(()=>strictJSON(Buffer.from(raw)));
  assert.throws(()=>strictJSON(Uint8Array.of(0xc3,0x28)));
});
test('bounded module scanner handles comments and literal re-exports, refuses dynamic escapes',()=>{
  assert.deepEqual(moduleImports("// import('bad')\nexport {x} from './a.js'; import './b.js'; const x='import(no)'; import.meta.url;"),
    [{specifier:'./a.js',dynamic:false},{specifier:'./b.js',dynamic:false}]);
  for(const source of ["import(value)","import('./a.js',{})","import(`./${value}.js`)","import './%61.js'","import './a.js?x'",
    "eval('import(value)')","new Function('return 1')","new Worker('./other.js')","require('fs')"]){
    assert.deepEqual(moduleImports("import './healthy.js';"),[{specifier:'./healthy.js',dynamic:false}]);
    assert.throws(()=>moduleImports(source));
    assert.deepEqual(moduleImports("import './healthy.js';"),[{specifier:'./healthy.js',dynamic:false}]);
  }
  assert.deepEqual(moduleImports("const x=import('./b1.js');"),[{specifier:'./b1.js',dynamic:true}]);
});
test('source mutation changes one unique literal expression only',()=>{
  const source='const local={a:0,b: -1,c:1,d:0,ty: layout.trimY + width};\n';
  assert.equal(assignedMutation(source,'rotation-sign'),'const local={a:0,b: 1,c:1,d:0,ty: layout.trimY + width};\n');
  assert.equal(assignedMutation(source,'trim-y-constant'),'const local={a:0,b: -1,c:1,d:0,ty: 1 + width};\n');
  assert.throws(()=>assignedMutation(source+source,'rotation-sign'));assert.throws(()=>assignedMutation(source,'other'));
});
test('full diff refuses declaration, fixture, map or extra product drift',()=>{
  const source='const local={b: -1,ty: layout.trimY + width};\n';
  const files=['packages/runtime/dist/bitmapAtlasPlacement.js','packages/runtime/src/bitmapAtlasPlacement.ts'];
  const healthy={inventory:files.map(path=>({owner:'repository',path,bytes:source.length,sha256:HASH(source)}))};
  const changed=assignedMutation(source,'rotation-sign');
  const assigned={inventory:files.map(path=>({owner:'repository',path,bytes:changed.length,sha256:HASH(changed)}))};
  assert.equal(verifyAssignedDiff(healthy,assigned,'rotation-sign',role=>role==='healthy'?source:changed).differences.length,2);
  assert.throws(()=>verifyAssignedDiff(healthy,{inventory:[...assigned.inventory,{owner:'repository',path:'extra.js',bytes:1,sha256:'a'}]},'rotation-sign',()=>source));
});
function metadataPair(){
  // Synthetic policy input using the real pinned compiler's observed Windows spelling;
  // these bytes are never represented as actual compiler output or a native closure.
  const original='const local={b: -1,ty: layout.trimY + width};\n',changed=assignedMutation(original,'rotation-sign');
  const source='packages/runtime/src/bitmapAtlasPlacement.ts',emitted='packages/runtime/dist/bitmapAtlasPlacement.js';
  const info='packages/runtime/tsconfig.tsbuildinfo',declaration='packages/runtime/dist/bitmapAtlasPlacement.d.ts';
  const metadata={fileNames:['./src/bitmapatlasplacement.ts'],fileInfos:[{version:HASH(original),signature:'unchanged-declaration'}],version:'7.0.2'};
  const assignedMetadata=structuredClone(metadata);assignedMetadata.fileInfos[0].version=HASH(changed);
  const texts={healthy:{[source]:original,[emitted]:original,[info]:JSON.stringify(metadata),[declaration]:'declare const unchanged: unknown;\n'},
    assigned:{[source]:changed,[emitted]:changed,[info]:JSON.stringify(assignedMetadata),[declaration]:'declare const unchanged: unknown;\n'}};
  const snapshots=()=>Object.fromEntries(['healthy','assigned'].map(role=>[role,{owners:{repository:path.win32.join('C:\\atlas-policy-owners',role)},
    inventory:Object.entries(texts[role]).map(([path,text])=>({owner:'repository',path,bytes:Buffer.byteLength(text),sha256:HASH(text)})).sort((a,b)=>a.path.localeCompare(b.path))}]));
  const verify=()=>{const pair=snapshots();return verifyAssignedDiff(pair.healthy,pair.assigned,'rotation-sign',(role,key)=>texts[role][key],identity);};
  const update=(role,modify)=>{const value=JSON.parse(texts[role][info]);modify(value);texts[role][info]=JSON.stringify(value);};
  return {texts,verify,update,source,info,declaration};
}
test('Windows metadata physical spelling binds the unique complete authored source pin',()=>{
  const pair=metadataPair();assert.doesNotThrow(()=>pair.verify());
  const result=pair.verify();assert.equal(result.buildMetadata[0].entries[0].pointer,'/fileInfos/0/version');
  assert.equal(result.buildMetadata[0].sourceIdentity.authoredLogicalPath,'packages/runtime/src/bitmapAtlasPlacement.ts');
  assert.equal(result.buildMetadata[0].sourceIdentity.healthy.serializedReference,'./src/bitmapatlasplacement.ts');
  assert.notEqual(pair.texts.healthy[pair.info],pair.texts.assigned[pair.info]);
});
test('metadata owner escapes, foreign basename, duplicate physical references and existing declaration drift refuse',()=>{
  for(const mutate of [
    pair=>{for(const role of ['healthy','assigned'])pair.update(role,value=>{value.fileNames[0]='C:/foreign-owner/packages/runtime/src/bitmapAtlasPlacement.ts';});},
    pair=>{for(const role of ['healthy','assigned'])pair.update(role,value=>{value.fileNames[0]='../../../../foreign/src/bitmapAtlasPlacement.ts';});},
    pair=>{for(const role of ['healthy','assigned'])pair.update(role,value=>{value.fileNames[0]='./unrelated/bitmapAtlasPlacement.ts';});},
    pair=>{for(const role of ['healthy','assigned'])pair.update(role,value=>{value.fileNames.push('./src/bitmapAtlasPlacement.ts');value.fileInfos.push({...value.fileInfos[0]});});},
    pair=>{pair.texts.assigned[pair.declaration]='declare const changed: string;\n';},
    pair=>{pair.update('assigned',value=>{value.fileInfos[0].signature='extra-declaration-drift';});},
  ]){
    const baseline=metadataPair();assert.doesNotThrow(()=>baseline.verify());
    const assigned=metadataPair();mutate(assigned);assert.throws(()=>assigned.verify());
    assert.doesNotThrow(()=>metadataPair().verify());
  }
});
test('authenticated identity preserves complete authored path and raw bytes',async()=>{
  const identity=await authenticateIdentity(root),pin=readPinned(identity,root,'tools/atlas-frame/boundary.mjs').pin;
  assert.equal(pin.path,'tools/atlas-frame/boundary.mjs');
  assert.throws(()=>readPinned(identity,root,'tools/atlas-frame/../atlas-frame/boundary.mjs'));
  assert.throws(()=>readPinned(identity,root,'tools/atlas-frame/Boundary.mjs'));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-boundary-'));
  try{fs.mkdirSync(path.join(temp,'nested'));fs.writeFileSync(path.join(temp,'nested','same.mjs'),'a\r\n');
    const actual=readPinned(identity,temp,'nested/same.mjs').pin;
    fs.writeFileSync(path.join(temp,'nested','same.mjs'),'a\n');assert.throws(()=>readPinned(identity,temp,'nested/same.mjs',actual));
    assert.throws(()=>identity.ownerRelativePath(temp,path.join(path.dirname(temp),'same.mjs')));
  }finally{fs.rmSync(temp,{recursive:true});}
});
