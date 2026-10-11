import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('pre-push knowledge-base validation does not rewrite tracked evidence',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'egret-kb-readonly-test-'));
 try{
  await mkdir(path.join(root,'registry'));
  await writeFile(path.join(root,'README.md'),'# Fixture\n');
  const registries={requirements:'R',decisions:'D',hypotheses:'H',deliverables:'V',sources:'S'},paths={};
  for(const [kind,prefix] of Object.entries(registries)){
   const p=`registry/${kind}.json`;paths[kind]=p;
   const item={id:prefix+'001',title:'Fixture',doc:'README.md',status:kind==='requirements'?'confirmed':kind==='decisions'?'proposed':kind==='hypotheses'?'untested':'planned',statement:'A requirement',sourceIds:['S001'],deliveryIds:['V001'],proposal:'Candidate',risk:'Untested',gate:'Review',claim:'Hypothesis',measure:'Experiment',kind:'documentation',implementation:'not_started',acceptance:'not_run',acceptanceCriteria:['Review'],type:'fixture',scope:'Fixture',limit:'Test only',researchCheckedAt:'2026-10-08'};
   await writeFile(path.join(root,p),JSON.stringify({schemaVersion:1,updatedAt:'2026-10-08',authority:'Test fixture',items:[item]}));
  }
  await mkdir(path.join(root,'Cns'));
  await writeFile(path.join(root,'Cns/当前版本.json'),JSON.stringify({version:'fixture',entry:'README.md',roadmap:'README.md',maintenance:'README.md',contribution:'README.md',changelog:'README.md',validation:'核验记录.json',registries:paths}));
  await writeFile(path.join(root,'核验记录.json'),'preserved evidence bytes');
  const script=fileURLToPath(new URL('../../knowledge-base/tools/Validate-KnowledgeBase.ps1',import.meta.url));
  const result=spawnSync('pwsh',['-NoProfile','-File',script,'-Root',root,'-CheckOnly'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(await readFile(path.join(root,'核验记录.json'),'utf8'),'preserved evidence bytes');
 }finally{
  const resolved=path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(resolved).startsWith('egret-kb-readonly-test-'));
  await rm(resolved,{recursive:true,force:true});
 }
});


// These independent filesystem fixtures catch a blanket escape allowance,
// allowlist omission, or existence-check bypass without replacing the validator.
const canvasReadingFiles=[
 'examples/canvas-text/README.md',
 'examples/canvas-text/README.zh-CN.md',
 'examples/canvas-text/assets/Ahem-COPYING.txt',
 'examples/canvas-text/assets/Ahem-README.txt',
 'examples/canvas-text/assets/provenance.json',
];
const validationScript=fileURLToPath(new URL('../../knowledge-base/tools/Validate-KnowledgeBase.ps1',import.meta.url));
async function withRepositoryReadingFixture(run){
 const owned=await mkdtemp(path.join(tmpdir(),'egret-kb-reading-test-'));
 const repository=path.join(owned,'repo'),root=path.join(repository,'knowledge-base');
 try{
  await mkdir(path.join(root,'registry'),{recursive:true});
  await mkdir(path.join(root,'Cns'));
  await mkdir(path.join(root,'en/docs'),{recursive:true});
  await writeFile(path.join(root,'README.md'),'# Fixture\n');
  const registries={requirements:'R',decisions:'D',hypotheses:'H',deliverables:'V',sources:'S'},paths={};
  for(const [kind,prefix] of Object.entries(registries)){
   const p='registry/'+kind+'.json';paths[kind]=p;
   const item={id:prefix+'001',title:'Fixture',doc:'README.md',status:kind==='requirements'?'confirmed':kind==='decisions'?'proposed':kind==='hypotheses'?'untested':'planned',statement:'A requirement',sourceIds:['S001'],deliveryIds:['V001'],proposal:'Candidate',risk:'Untested',gate:'Review',claim:'Hypothesis',measure:'Experiment',kind:'documentation',implementation:'not_started',acceptance:'not_run',acceptanceCriteria:['Review'],type:'fixture',scope:'Fixture',limit:'Test only',researchCheckedAt:'2026-10-08'};
   await writeFile(path.join(root,p),JSON.stringify({schemaVersion:1,updatedAt:'2026-10-08',authority:'Test fixture',items:[item]}));
  }
  await writeFile(path.join(root,'Cns/当前版本.json'),JSON.stringify({version:'fixture',entry:'README.md',roadmap:'README.md',maintenance:'README.md',contribution:'README.md',changelog:'README.md',validation:'核验记录.json',registries:paths}));
  await writeFile(path.join(root,'核验记录.json'),'preserved evidence bytes');
  for(const relative of canvasReadingFiles){
   await mkdir(path.dirname(path.join(repository,relative)),{recursive:true});
   await writeFile(path.join(repository,relative),'owned reading fixture\n');
  }
  const validate=()=>spawnSync('pwsh',['-NoProfile','-File',validationScript,'-Root',root,'-CheckOnly'],{encoding:'utf8'});
  await run({owned,repository,root,validate});
  assert.equal(await readFile(path.join(root,'核验记录.json'),'utf8'),'preserved evidence bytes');
 }finally{
  const resolved=path.resolve(owned);
  assert.ok(resolved.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(resolved).startsWith('egret-kb-reading-test-'));
  await rm(resolved,{recursive:true,force:true});
 }
}

test('KB links accept only the five existing Canvas text repository reading files',async()=>{
 await withRepositoryReadingFixture(async({root,validate})=>{
  await writeFile(path.join(root,'README.md'),'# Fixture\n'+canvasReadingFiles.map(relative=>'[Reading](../'+relative+')').join('\n')+'\n');
  await writeFile(path.join(root,'en/docs/reading.md'),canvasReadingFiles.map(relative=>'[Reading](../../../'+relative+')').join('\n')+'\n');
  const registryPath=path.join(root,'registry/deliverables.json');
  const registry=JSON.parse(await readFile(registryPath,'utf8'));
  registry.items[0].artifacts=canvasReadingFiles.map(relative=>'../'+relative);
  await writeFile(registryPath,JSON.stringify(registry));
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/fixture: passed/);
 });
});

test('KB links deny existing unlisted example siblings and foreign traversal',async()=>{
 await withRepositoryReadingFixture(async({owned,repository,root,validate})=>{
  await writeFile(path.join(repository,'examples/canvas-text/unlisted.md'),'existing unlisted file\n');
  await mkdir(path.join(owned,'foreign'));
  await writeFile(path.join(owned,'foreign/README.md'),'existing foreign file\n');
  await writeFile(path.join(root,'README.md'),'# Fixture\n[Unlisted](../examples/canvas-text/unlisted.md)\n[Foreign](../../foreign/README.md)\n');
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/Local reference leaves knowledge base: README\.md -> \.\.\/examples\/canvas-text\/unlisted\.md/);
  assert.match(result.stdout,/Local reference leaves knowledge base: README\.md -> \.\.\/\.\.\/foreign\/README\.md/);
  assert.doesNotMatch(result.stdout,/Missing local target/);
 });
});

test('KB links reject a missing exact allowlisted Canvas text notice',async()=>{
 await withRepositoryReadingFixture(async({repository,root,validate})=>{
  await rm(path.join(repository,'examples/canvas-text/assets/Ahem-COPYING.txt'));
  await writeFile(path.join(root,'README.md'),'# Fixture\n[Notice](../examples/canvas-text/assets/Ahem-COPYING.txt)\n');
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/Missing local target: README\.md -> \.\.\/examples\/canvas-text\/assets\/Ahem-COPYING\.txt/);
  assert.doesNotMatch(result.stdout,/Local reference leaves knowledge base/);
 });
});

test('KB local artifact references keep rejecting absolute file URIs',async()=>{
 await withRepositoryReadingFixture(async({root,validate})=>{
  const registryPath=path.join(root,'registry/deliverables.json');
  const registry=JSON.parse(await readFile(registryPath,'utf8'));
  registry.items[0].artifacts=['file:///fixture/notice.txt'];
  await writeFile(registryPath,JSON.stringify(registry));
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/External or absolute path in local reference: V001/);
 });
});


// Exact named hit-test readings extend the finite reading set; nearby executable
// or HTML files remain outside it. The original five cases above are unchanged.
const hitTestReadingFiles=['examples/hit-test/README.md','examples/hit-test/README.zh-CN.md'];
async function writeHitTestReadings(repository){
 for(const relative of hitTestReadingFiles){
  await mkdir(path.dirname(path.join(repository,relative)),{recursive:true});
  await writeFile(path.join(repository,relative),'owned hit-test reading fixture\n');
 }
}

test('KB links accept exactly both existing hit-test README readings from root, nested docs and artifacts',async()=>{
 await withRepositoryReadingFixture(async({repository,root,validate})=>{
  await writeHitTestReadings(repository);
  await writeFile(path.join(root,'README.md'),'# Fixture\n'+hitTestReadingFiles.map(relative=>'[Reading](../'+relative+')').join('\n')+'\n');
  await writeFile(path.join(root,'en/docs/hit-test.md'),hitTestReadingFiles.map(relative=>'[Reading](../../../'+relative+')').join('\n')+'\n');
  const registryPath=path.join(root,'registry/deliverables.json');
  const registry=JSON.parse(await readFile(registryPath,'utf8'));
  registry.items[0].artifacts=hitTestReadingFiles.map(relative=>'../'+relative);
  await writeFile(registryPath,JSON.stringify(registry));
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/fixture: passed/);
 });
});

test('KB hit-test readings do not admit existing sibling documents, modules, HTML or foreign traversal',async()=>{
 await withRepositoryReadingFixture(async({owned,repository,root,validate})=>{
  await writeHitTestReadings(repository);
  const denied=['examples/hit-test/README-other.md','examples/hit-test/scene.mjs','examples/hit-test/index.html'];
  for(const relative of denied) await writeFile(path.join(repository,relative),'existing unlisted fixture\n');
  await mkdir(path.join(owned,'foreign'));
  await writeFile(path.join(owned,'foreign/README.md'),'existing foreign fixture\n');
  await writeFile(path.join(root,'README.md'),'# Fixture\n'+denied.map(relative=>'[Unlisted](../'+relative+')').join('\n')+'\n[Foreign](../../foreign/README.md)\n');
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,1,result.stdout+result.stderr);
  for(const relative of denied) assert.ok(result.stdout.includes('Local reference leaves knowledge base: README.md -> ../'+relative),result.stdout);
  assert.match(result.stdout,/Local reference leaves knowledge base: README\.md -> \.\.\/\.\.\/foreign\/README\.md/);
  assert.doesNotMatch(result.stdout,/Missing local target/);
 });
});

test('KB links reject either missing exact hit-test README as a missing local target',async()=>{
 await withRepositoryReadingFixture(async({repository,root,validate})=>{
  await writeHitTestReadings(repository);
  for(const relative of hitTestReadingFiles) await rm(path.join(repository,relative));
  await writeFile(path.join(root,'README.md'),'# Fixture\n'+hitTestReadingFiles.map(relative=>'[Missing](../'+relative+')').join('\n')+'\n');
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,1,result.stdout+result.stderr);
  for(const relative of hitTestReadingFiles) assert.ok(result.stdout.includes('Missing local target: README.md -> ../'+relative),result.stdout);
  assert.doesNotMatch(result.stdout,/Local reference leaves knowledge base/);
 });
});

test('KB hit-test artifact readings do not permit an absolute file URI with an allowed filename',async()=>{
 await withRepositoryReadingFixture(async({repository,root,validate})=>{
  await writeHitTestReadings(repository);
  const registryPath=path.join(root,'registry/deliverables.json');
  const registry=JSON.parse(await readFile(registryPath,'utf8'));
  registry.items[0].artifacts=['file:///fixture/examples/hit-test/README.md'];
  await writeFile(registryPath,JSON.stringify(registry));
  const result=validate();
  assert.equal(result.error,undefined,result.stderr);
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/External or absolute path in local reference: V001/);
 });
});
