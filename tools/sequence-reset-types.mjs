// SPDX-License-Identifier: Apache-2.0
// One finite current public RESET consumer pair; historical inventories stay unchanged.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
import {fingerprintFile,ownerRelativePath,samePhysicalPath} from './lib/file-identity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),inventoryPin={"path":"tests/types/sequence-reset-diagnostic-expectations.json","bytes":43863,"sha256":"ad21adbf614cc162976023b5db951055253b1cf1486208cec461f013a85bab51"};
assert.deepEqual(fingerprintFile(root,inventoryPin.path),inventoryPin);
const inventory=JSON.parse(fs.readFileSync(path.join(root,inventoryPin.path),'utf8'));assert.equal(inventory.format,'egret.sequence-reset-strict/1');assert.deepEqual(inventory.groups.map(g=>g.lane),['positive','negative']);
const wrapper=fs.realpathSync(path.join(root,'node_modules/typescript')),name='@typescript/typescript-'+process.platform+'-'+process.arch;
const native=fs.realpathSync(path.dirname(createRequire(path.join(wrapper,'package.json')).resolve(name+'/package.json')));
const wrapperMeta=JSON.parse(fs.readFileSync(path.join(wrapper,'package.json'),'utf8')),nativeMeta=JSON.parse(fs.readFileSync(path.join(native,'package.json'),'utf8'));
assert.equal(wrapperMeta.version,inventory.compiler.version);assert.equal(nativeMeta.name,name);assert.equal(nativeMeta.version,inventory.compiler.version);assert.equal(wrapperMeta.optionalDependencies[name],inventory.compiler.version);assert.deepEqual(nativeMeta.os,[process.platform]);assert.deepEqual(nativeMeta.cpu,[process.arch]);
const selectedNative=['package.json','lib/tsc'+(process.platform==='win32'?'.exe':'')].map(p=>fingerprintFile(native,p));
if(process.platform===inventory.compiler.platform&&process.arch===inventory.compiler.arch)assert.deepEqual(selectedNative,inventory.compiler.native);
const toolPin=fingerprintFile(root,'tools/sequence-reset-types.mjs');
function verify(){assert.deepEqual(fingerprintFile(root,inventoryPin.path),inventoryPin);assert.deepEqual(fingerprintFile(root,toolPin.path),toolPin);for(const row of inventory.inputs)assert.deepEqual(fingerprintFile(root,row.path),row);for(const row of inventory.compiler.wrapper)assert.deepEqual(fingerprintFile(wrapper,row.path),row);for(const row of [...selectedNative,...inventory.nativeLibraries])assert.deepEqual(fingerprintFile(native,row.path),row);for(const pkg of ['engine','runtime','contracts'])assert.ok(samePhysicalPath(fs.realpathSync(path.join(root,'node_modules/@egret',pkg)),path.join(root,'packages',pkg)));}
const env={...process.env};for(const key of Object.keys(env))if(/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key))delete env[key];
for(const group of inventory.groups){verify();const args=['node_modules/typescript/bin/tsc','-p',group.config,'--pretty','false'],options={cwd:root,encoding:'utf8',env,windowsHide:true,timeout:30000,maxBuffer:4194304};
 const result=spawnSync(process.execPath,args,options);assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,group.exit);assert.equal(result.stderr,'');assert.equal(result.stdout.replaceAll('\r\n','\n').replaceAll('\\','/'),group.stdout);
 const listed=spawnSync(process.execPath,[...args,'--listFilesOnly'],options);assert.ifError(listed.error);assert.equal(listed.signal,null);assert.equal(listed.status,0);assert.equal(listed.stderr,'');
 const repository=[],libraries=[];for(const file of listed.stdout.trim().split(/\r?\n/)){const actual=fs.realpathSync(file);let library;try{library=ownerRelativePath(native,actual);}catch(error){if(!(error instanceof RangeError))throw error;}if(library!==undefined)libraries.push(library);else repository.push(ownerRelativePath(root,actual));}assert.deepEqual(repository.sort(),group.repository);assert.deepEqual(libraries.sort(),group.libraries);verify();
}
console.log('Sequence RESET strict PASS: complete positive/negative compiler closures and four exact unsuppressed diagnostics.');
