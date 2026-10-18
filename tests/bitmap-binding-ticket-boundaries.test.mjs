// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,lstatSync,realpathSync,cpSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Execute the genuine source actor in a complete, physical four-package owner.
// These controls prove source admission only, never SDK or browser behavior.
const repository=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const packages=['contracts','runtime','engine','project'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>path.relative(a,b)==='';
const inside=(parent,child)=>{const relative=path.relative(parent,child);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};
const environment={...process.env};
for(const key of Object.keys(environment))if(/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key))delete environment[key];
function inventory(root){
 const rows=[];
 function walk(relative){for(const entry of readdirSync(path.join(root,relative),{withFileTypes:true})){
  const file=relative?relative+'/'+entry.name:entry.name;
  if(entry.isSymbolicLink()){
   assert.ok(packages.some(name=>file==='node_modules/@egret/'+name));
   assert.ok(same(realpathSync(path.join(root,file)),realpathSync(path.join(root,'packages',entry.name))));
  }else if(entry.isDirectory())walk(file);else{
   assert.ok(entry.isFile());const raw=readFileSync(path.join(root,file));rows.push({path:file,bytes:raw.length,sha256:sha(raw)});
  }
 }}
 walk('');return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function accepted(result){
 assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');
 assert.ok(result.stdout.startsWith('BBT_BOUNDARY_PASS '));
 const receipt=JSON.parse(result.stdout.slice('BBT_BOUNDARY_PASS '.length));
 assert.equal(receipt.scope,'finite source/emission policy only');assert.equal(receipt.method,'Engine.captureBitmapBindings');assert.equal(receipt.productExecution,false);
}

function rejected(result,code){
 assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.stdout,'');
 assert.ok(result.stderr.includes(code+':'),result.stderr);
}
function isolated(action){
 const parentPath=path.join(tmpdir(),'egret-bitmap-binding-ticket-policy-controls');mkdirSync(parentPath,{recursive:true});
 const parent=realpathSync(parentPath),root=realpathSync(mkdtempSync(path.join(parent,'bitmap-binding-ticket-policy-')));
 assert.ok(inside(parent,root));assert.ok(same(path.dirname(root),parent));
 let primary,cleanup;
 try{
  const copied=[];
  function copy(source,relative){
   assert.equal(lstatSync(source).isSymbolicLink(),false);
   const target=path.join(root,relative);mkdirSync(path.dirname(target),{recursive:true});
   cpSync(source,target,{recursive:true,filter:file=>path.basename(file)!=='node_modules'});
   function record(from,to){
    const stat=lstatSync(from);assert.equal(stat.isSymbolicLink(),false);
    if(stat.isDirectory()){for(const name of readdirSync(from))if(name!=='node_modules')record(path.join(from,name),to+'/'+name);}
    else{assert.ok(stat.isFile());const raw=readFileSync(from);assert.deepEqual(readFileSync(path.join(root,to)),raw);copied.push({path:to,bytes:raw.length,sha256:sha(raw)});}
   }
   record(source,relative);
  }
  for(const name of packages)copy(path.join(repository,'packages',name),'packages/'+name);
  const policy=JSON.parse(readFileSync(path.join(repository,'tools/bitmap-binding-ticket-policy.json'),'utf8'));
  const retained=[...policy.packages,...policy.configurations,...policy.stableEntries,...policy.oldRootPins,policy.oldEngineDeclarationPin,...policy.workspacePins,...policy.selectedProductPins];
  const files=new Set(['tools/bitmap-resource-slot-boundary.mjs','tools/bitmap-resource-slot-policy.json','tools/bitmap-binding-ticket-boundary.mjs','tools/bitmap-binding-ticket-policy.json','tools/lib/file-identity.mjs',...retained.map(row=>row.path),...policy.entries.flatMap(entry=>[entry.source,entry.js,entry.declaration])]);
  for(const file of files)if(!copied.some(row=>row.path===file))copy(path.join(repository,file),file);
  mkdirSync(path.join(root,'node_modules/@egret'),{recursive:true});
  for(const name of packages)symlinkSync(path.join(root,'packages',name),path.join(root,'node_modules/@egret',name),process.platform==='win32'?'junction':'dir');
  const baseline=inventory(root);
  assert.deepEqual(baseline,copied.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),'Every physical copied file retains its complete original bytes');
  const run=()=>spawnSync(process.execPath,[path.join(root,'tools/bitmap-binding-ticket-boundary.mjs')],{cwd:root,env:environment,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  accepted(run());action({root,run,baseline});
 }catch(cause){primary={cause};}
 finally{try{
  const resolved=realpathSync(root);assert.ok(same(resolved,root));assert.ok(inside(parent,resolved));assert.ok(same(path.dirname(resolved),parent));assert.ok(path.basename(resolved).startsWith('bitmap-binding-ticket-policy-'));
  for(const name of packages){const alias=path.join(resolved,'node_modules/@egret',name);if(existsSync(alias)){const target=realpathSync(alias);assert.ok(inside(resolved,target));assert.ok(same(target,realpathSync(path.join(resolved,'packages',name))));}}
  rmSync(resolved,{recursive:true,force:false,maxRetries:0});assert.equal(existsSync(resolved),false);
 }catch(cause){cleanup={cause};}}
 if(primary&&cleanup)throw new AggregateError([primary.cause,cleanup.cause],'BBT source control and owned cleanup failed');
 if(cleanup)throw cleanup.cause;if(primary)throw primary.cause;
}

test('BBT-M12 genuine complete owner satisfies the finite interface actor',()=>isolated(({root,run,baseline})=>{assert.deepEqual(inventory(root),baseline);accepted(run());}));
const controls=[
 ['ownership source with unchanged emission','packages/runtime/src/ownership.ts','BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY',raw=>Buffer.concat([raw,Buffer.from('// unaccepted ownership source\n')])],
 ['ownership emission with unchanged source','packages/runtime/dist/ownership.js','BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY',raw=>Buffer.concat([raw,Buffer.from('// unaccepted ownership emission\n')])],
 ['equal-size wrong ownership identity','packages/runtime/src/ownership.ts','BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY',raw=>{const changed=Buffer.from(raw);changed[2]^=1;assert.equal(changed.length,raw.length);return changed;}],
 ['private capability exposure still precedes source identity','packages/engine/src/index.ts','BBT_BOUNDARY_PRIVATE_OWNER',raw=>Buffer.concat([raw,Buffer.from('export { createBitmapBindingOwner } from "./bitmapBindingTicket.js";\n')])],
];
for(const [name,relative,code,mutate]of controls)test('BBT-M12 '+name,()=>isolated(({root,run,baseline})=>{
 const file=path.join(root,relative),before=readFileSync(file);
 try{
  const changed=mutate(before);assert.notDeepEqual(changed,before);writeFileSync(file,changed);
  const prior=new Map(baseline.map(row=>[row.path,row]));
  assert.deepEqual(inventory(root).filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),[relative]);
  rejected(run(),code);
 }finally{writeFileSync(file,before);assert.deepEqual(inventory(root),baseline);accepted(run());}
}));

for(const [family,relative,code]of [
 ['bitmap-binding-ticket','packages/engine/src/Engine.ts','BBT_BOUNDARY_SELECTED_PRODUCT_IDENTITY'],
 ['bitmap-binding-ticket','packages/engine/dist/Engine.d.ts','BBT_BOUNDARY_ENGINE_PUBLIC_DECLARATION'],
 ['bitmap-resource-slot','packages/engine/src/Engine.ts','BRS_BOUNDARY_DEFAULT_ENTRY_IDENTITY'],
 ['bitmap-resource-slot','packages/engine/dist/Engine.d.ts','BRS_BOUNDARY_ENGINE_PUBLIC_DECLARATION'],
])test('M13 interface group preserves '+family+' refusal for '+relative,()=>isolated(({root,baseline})=>{
 const execute=()=>spawnSync(process.execPath,[path.join(root,'tools/'+family+'-boundary.mjs')],{cwd:root,env:environment,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
 const healthy=()=>{const result=execute();assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');assert.ok(result.stdout.startsWith(family==='bitmap-binding-ticket'?'BBT_BOUNDARY_PASS ':'BRS_BOUNDARY_PASS '));};
 healthy();const file=path.join(root,relative),before=readFileSync(file);
 try{
  writeFileSync(file,Buffer.concat([before,Buffer.from('\n// unregistered shared interface identity\n')]));
  const prior=new Map(baseline.map(row=>[row.path,row]));
  assert.deepEqual(inventory(root).filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),[relative]);
  rejected(execute(),code);
 }finally{writeFileSync(file,before);assert.deepEqual(inventory(root),baseline);healthy();}
}));
