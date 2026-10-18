// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,lstatSync,realpathSync,cpSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
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
 assert.match(result.stdout,/^Atlas import Source boundary PASS: [0-9]+ exact source\/emission\/declaration files; two optional values, sixteen erased types, four local built aliases\. No product or browser execution\.\n$/);
}
function rejected(result,code){
 assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.stdout,'');
 assert.ok(result.stderr.includes(code+':'),result.stderr);
}
function isolated(action){
 const parentPath=path.join(tmpdir(),'egret-atlas-import-policy-controls');mkdirSync(parentPath,{recursive:true});
 const parent=realpathSync(parentPath),root=realpathSync(mkdtempSync(path.join(parent,'atlas-import-policy-')));
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
  const policy=JSON.parse(readFileSync(path.join(repository,'tests/types/atlas-import-diagnostic-expectations.json'),'utf8')).sourcePolicy;
  const files=new Set(['tools/atlas-import-boundary.mjs','tools/lib/file-identity.mjs','tests/types/atlas-import-diagnostic-expectations.json',...policy.configurationPins.map(pin=>pin.path)]);
  for(const file of files)if(!copied.some(row=>row.path===file))copy(path.join(repository,file),file);
  const resolver=createRequire(path.join(repository,'packages/project/package.json'));
  const jsonc=realpathSync(resolver.resolve('jsonc-parser'));
  copy(path.resolve(path.dirname(jsonc),'../..'),'node_modules/jsonc-parser');
  mkdirSync(path.join(root,'node_modules/@egret'),{recursive:true});
  for(const name of packages)symlinkSync(path.join(root,'packages',name),path.join(root,'node_modules/@egret',name),process.platform==='win32'?'junction':'dir');
  const baseline=inventory(root);
  assert.deepEqual(baseline,copied.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),'Every physical copied file retains its complete original bytes');
  const run=()=>spawnSync(process.execPath,[path.join(root,'tools/atlas-import-boundary.mjs')],{cwd:root,env:environment,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  accepted(run());action({root,run,baseline});
 }catch(cause){primary={cause};}
 finally{try{
  const resolved=realpathSync(root);assert.ok(same(resolved,root));assert.ok(inside(parent,resolved));assert.ok(same(path.dirname(resolved),parent));assert.ok(path.basename(resolved).startsWith('atlas-import-policy-'));
  for(const name of packages){const alias=path.join(resolved,'node_modules/@egret',name);if(existsSync(alias)){const target=realpathSync(alias);assert.ok(inside(resolved,target));assert.ok(same(target,realpathSync(path.join(resolved,'packages',name))));}}
  rmSync(resolved,{recursive:true,force:false,maxRetries:0});assert.equal(existsSync(resolved),false);
 }catch(cause){cleanup={cause};}}
 if(primary&&cleanup)throw new AggregateError([primary.cause,cleanup.cause],'Atlas source control and owned cleanup failed');
 if(cleanup)throw cleanup.cause;if(primary)throw primary.cause;
}

test('ATLAS-M11 full genuine owner copy satisfies source actor',()=>isolated(({root,run,baseline})=>{assert.deepEqual(inventory(root),baseline);accepted(run());}));
const controls=[
 ['M1.2 runtime source with unchanged emission','packages/runtime/src/frameCapture.ts','ATLAS_SOURCE_IDENTITY',raw=>Buffer.concat([raw,Buffer.from('// unaccepted incremental capture source\n')])],
 ['M1.2 equal-size new helper emission','packages/engine/dist/rendering/preparedFrameCache2D.js','ATLAS_SOURCE_IDENTITY',raw=>{const changed=Buffer.from(raw);changed[0]^=1;assert.equal(changed.length,raw.length);return changed;}],
 ...["packages/engine/dist/rendering/preparedBatches2D.d.ts","packages/engine/dist/rendering/preparedBatches2D.js","packages/engine/dist/rendering/preparedFrameCache2D.d.ts","packages/engine/dist/rendering/preparedFrameCache2D.js","packages/engine/rendering/preparedBatches2D.ts","packages/engine/rendering/preparedFrameCache2D.ts","packages/runtime/dist/frameCaptureCache.d.ts","packages/runtime/dist/frameCaptureCache.js","packages/runtime/src/frameCaptureCache.ts"].map(file=>['M1.2 missing exact new path '+file,file,'ATLAS_SOURCE_FILES',undefined]),
 ['source mutation mixed with unchanged emissions','packages/engine/web/webgpuBufferPool.ts','ATLAS_SOURCE_IDENTITY',raw=>Buffer.concat([raw,Buffer.from('// unaccepted warm submission source\n')])],
 ['equal-size helper emission hash','packages/engine/dist/web/webgpuBindingCache.js','ATLAS_SOURCE_IDENTITY',raw=>{const changed=Buffer.from(raw);changed[0]^=1;assert.equal(changed.length,raw.length);return changed;}],
 ['missing private declaration','packages/engine/dist/web/webgpuBufferPool.d.ts','ATLAS_SOURCE_FILES',undefined],
 ['extra unregistered module','packages/engine/web/warm-submission-unlisted.ts','ATLAS_SOURCE_FILES',()=>Buffer.from('export {};\n')],
];
for(const [name,relative,code,mutate]of controls)test('ATLAS-M11 '+name,()=>isolated(({root,run,baseline})=>{
 const file=path.join(root,relative),existed=existsSync(file),before=existed?readFileSync(file):undefined;
 try{
  if(mutate)writeFileSync(file,mutate(before));else rmSync(file);
  const current=inventory(root),prior=new Map(baseline.map(row=>[row.path,row]));
  const changed=current.filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path);
  const missing=baseline.filter(row=>!current.some(now=>now.path===row.path)).map(row=>row.path);
  assert.deepEqual([...changed,...missing],[relative],'Exactly one assigned source/emission unit changed');
  rejected(run(),code);
 }finally{
  if(existed)writeFileSync(file,before);else rmSync(file);
  assert.deepEqual(inventory(root),baseline,'Complete original snapshot restored');accepted(run());
 }
}));

// The current 62 rows cannot hide a changed historical predecessor row.
test('ATLAS-M12 tampered M1.1 predecessor is refused before current graph derivation',()=>isolated(({root,run,baseline})=>{
 const relative='tools/atlas-import-boundary.mjs',file=path.join(root,relative),before=readFileSync(file);
 const original='bf33f8aa63f14103ff947f79f77527a28dfd0cf15468cc84abda6c8cd15007e0';
 const text=before.toString('utf8');assert.equal(text.split(original).length,2);
 try{
  writeFileSync(file,text.replace(original,'af33f8aa63f14103ff947f79f77527a28dfd0cf15468cc84abda6c8cd15007e0'));
  const prior=new Map(baseline.map(row=>[row.path,row]));
  assert.deepEqual(inventory(root).filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),[relative]);
  const result=run();rejected(result,'ATLAS_SOURCE_IDENTITY');assert.match(result.stderr,/M1\.1 predecessor digest differs/);
 }finally{writeFileSync(file,before);assert.deepEqual(inventory(root),baseline);accepted(run());}
}));

for (const [relative, mode] of [["packages/contracts/src/SharedGeometry2D.ts","missing"],["packages/runtime/dist/sharedFrameCapture.js","missing"],["packages/engine/dist/web/webgpuRetentionPool.d.ts","missing"],["packages/engine/rendering/prepareSharedDraws2D.ts","mixed-source"],["packages/engine/dist/rendering/sharedColor2D.js","same-size-hash"]])
 test('ATLAS-M13 complete group refuses '+mode+' '+relative,()=>isolated(({root,run,baseline})=>{
  const file=path.join(root,relative),before=readFileSync(file);
  try{
   if(mode==='missing')rmSync(file);
   else if(mode==='mixed-source')writeFileSync(file,Buffer.concat([before,Buffer.from('\n// unaccepted shared source\n')]));
   else{const altered=Buffer.from(before);altered[0]^=1;assert.equal(altered.length,before.length);writeFileSync(file,altered);}
   const now=inventory(root),prior=new Map(baseline.map(row=>[row.path,row]));
   assert.deepEqual([...now.filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),...baseline.filter(row=>!now.some(current=>current.path===row.path)).map(row=>row.path)],[relative]);
   rejected(run(),mode==='missing'?'ATLAS_SOURCE_FILES':'ATLAS_SOURCE_IDENTITY');
  }finally{writeFileSync(file,before);assert.deepEqual(inventory(root),baseline);accepted(run());}
 }));
test('ATLAS-M13 tampered M1.2 predecessor cannot authorize the current graph',()=>isolated(({root,run,baseline})=>{
 const relative='tools/atlas-import-boundary.mjs',file=path.join(root,relative),before=readFileSync(file),text=before.toString('utf8');
 const match=/const m12IncrementalRenderingGraphSuccessor = (\[[^\n]+\]);/.exec(text);assert.ok(match);
 const original=match[1],rows=JSON.parse(original);rows[0].sha256=(rows[0].sha256[0]==='0'?'1':'0')+rows[0].sha256.slice(1);
 try{
  writeFileSync(file,text.replace(original,JSON.stringify(rows)));
  const prior=new Map(baseline.map(row=>[row.path,row]));
  assert.deepEqual(inventory(root).filter(row=>JSON.stringify(row)!==JSON.stringify(prior.get(row.path))).map(row=>row.path),[relative]);
  const result=run();rejected(result,'ATLAS_SOURCE_IDENTITY');assert.match(result.stderr,/M1\.2 predecessor digest differs/);
 }finally{writeFileSync(file,before);assert.deepEqual(inventory(root),baseline);accepted(run());}
}));
