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
  await writeFile(path.join(root,'当前版本.json'),JSON.stringify({version:'fixture',entry:'README.md',roadmap:'README.md',maintenance:'README.md',contribution:'README.md',changelog:'README.md',validation:'核验记录.json',registries:paths}));
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
