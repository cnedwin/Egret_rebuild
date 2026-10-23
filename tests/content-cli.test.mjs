// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
const root=path.resolve(import.meta.dirname,'..'),cli=path.join(root,'tools/build-content.mjs');
function fixture(t){
 const owner=mkdtempSync(path.join(os.tmpdir(),'egret-cli-'));t.after(()=>rmSync(owner,{recursive:true,force:true}));
 for(const d of ['sources','cache','build'])mkdirSync(path.join(owner,d));
 const bytes=PNG.sync.write({width:1,height:1,data:Buffer.from([255,0,0,255])});
 writeFileSync(path.join(owner,'sources/red.png'),bytes);
 const snapshot={projectSchemaVersion:'1.0',projectId:'p_cli',revision:0,name:'CLI fixture',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files:[{id:'f_red',path:'sources/red.png',role:'source',mediaType:'image/png',sha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length}],retiredEntityIds:[],retiredFileIds:[]};
 const recipe={format:'egret.content-build-recipe/1',targetProfile:'web-shared/1',recipes:[{resourceId:'e_red',sourceFileId:'f_red',importer:{id:'egret.png',version:'1.0.0'},settings:{},artifactFormatVersion:'png/1',dependencies:[],provenance:{origin:'first-party synthetic fixture',license:'Apache-2.0',notice:'Authored test pixels.'}}]};
 writeFileSync(path.join(owner,'project.json'),JSON.stringify(snapshot));writeFileSync(path.join(owner,'recipe.json'),JSON.stringify(recipe));
 const flags=['--root',owner,'--project','project.json','--recipe','recipe.json','--cache',path.join(owner,'cache'),'--output',path.join(owner,'build'),'--snapshot-out','candidate.json','--receipt','receipt.json','--selector','e_generation','--transaction','t_cli'];
 return {owner,snapshot,recipe,flags,run(args=flags){return spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});}};
}
test('finite CLI creates new adopted candidate and receipt; warm repeat uses verified cache',t=>{
 const f=fixture(t),before=readFileSync(path.join(f.owner,'project.json')),cold=f.run();assert.equal(cold.status,0,cold.stderr);
 const receipt=JSON.parse(readFileSync(path.join(f.owner,'receipt.json')));assert.equal(receipt.status,'adopted');assert.equal(receipt.receipt.resources[0].cache,'miss');
 assert.equal(JSON.parse(readFileSync(path.join(f.owner,'candidate.json'))).revision,1);assert.deepEqual(readFileSync(path.join(f.owner,'project.json')),before);
 const flags=f.flags.map(x=>x==='candidate.json'?'candidate2.json':x==='receipt.json'?'receipt2.json':x==='t_cli'?'t_cli2':x),warm=f.run(flags);assert.equal(warm.status,0,warm.stderr);
 assert.equal(JSON.parse(readFileSync(path.join(f.owner,'receipt2.json'))).receipt.resources[0].cache,'hit');
});
test('finite CLI refuses duplicate, unknown, missing and relative-root flags before output',t=>{
 const f=fixture(t);for(const args of [[...f.flags,'--project','project.json'],[...f.flags,'--unknown','x'],f.flags.slice(0,-2),f.flags.map(x=>x===f.owner?'.':x)]){const r=f.run(args);assert.notEqual(r.status,0);assert.match(r.stderr,/CONTENT_CLI_ARGUMENT/);}
 assert.deepEqual(readdirSync(path.join(f.owner,'build')),[]);
});
test('finite CLI never overwrites existing candidate or receipt, including input alias',t=>{
 const f=fixture(t);writeFileSync(path.join(f.owner,'candidate.json'),'KEEP');const result=f.run();assert.notEqual(result.status,0);assert.equal(readFileSync(path.join(f.owner,'candidate.json'),'utf8'),'KEEP');assert.deepEqual(readdirSync(path.join(f.owner,'build')),[]);
 writeFileSync(path.join(f.owner,'receipt.json'),'RECEIPT KEEP');const receipt=f.run(f.flags.map(x=>x==='candidate.json'?'fresh-candidate.json':x));assert.notEqual(receipt.status,0);assert.match(receipt.stderr,/CONTENT_CLI_OUTPUT/);assert.equal(readFileSync(path.join(f.owner,'receipt.json'),'utf8'),'RECEIPT KEEP');assert.equal(existsSync(path.join(f.owner,'fresh-candidate.json')),false);
 const alias=f.run(f.flags.map(x=>x==='candidate.json'?'project.json':x));assert.notEqual(alias.status,0);assert.equal(JSON.parse(readFileSync(path.join(f.owner,'project.json'))).revision,0);
});
test('finite CLI rejects changed source pins and malformed snapshots',t=>{
 const f=fixture(t);writeFileSync(path.join(f.owner,'sources/red.png'),Buffer.alloc(f.snapshot.files[0].byteLength));const source=f.run();assert.notEqual(source.status,0);assert.match(source.stderr,/CONTENT_INPUT_INTEGRITY/);assert.equal(existsSync(path.join(f.owner,'candidate.json')),false);
 writeFileSync(path.join(f.owner,'project.json'),'{}');const snapshot=f.run();assert.notEqual(snapshot.status,0);assert.match(snapshot.stderr,/CONTENT_CLI_SNAPSHOT/);
});
test('finite CLI recipe reader refuses duplicate JSON keys, comments, excessive depth and invalid UTF8',t=>{
 const f=fixture(t);for(const bytes of [Buffer.from('{"format":"a","format":"b"}'),Buffer.from('{/* comment */"format":"a"}'),Buffer.from('['.repeat(34)+'0'+']'.repeat(34)),Buffer.from([123,255,125])]){writeFileSync(path.join(f.owner,'recipe.json'),bytes);const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/CONTENT_CLI_(JSON|UTF8)/);}
 assert.equal(existsSync(path.join(f.owner,'candidate.json')),false);
});

test('authored example helper creates a fresh run with four generated resources and a pinned browser configuration',async t=>{
 const f=fixture(t),result=spawnSync(process.execPath,[path.join(root,'tools/content/author-example.mjs'),'--parent',f.owner],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const row=JSON.parse(result.stdout),configuration=JSON.parse(readFileSync(row.configuration));assert.equal(configuration.manifest.sha256.length,64);assert.equal(configuration.snapshotPath,'candidate.json');assert.equal(configuration.selectorId,'e_generation');const candidateBytes=readFileSync(path.join(row.runRoot,configuration.snapshotPath));assert.equal(configuration.snapshot.byteLength,candidateBytes.length);assert.equal(configuration.snapshot.sha256,createHash('sha256').update(candidateBytes).digest('hex'));
 const report=JSON.parse(readFileSync(path.join(row.runRoot,'receipt.json')));assert.equal(report.status,'adopted');assert.equal(report.receipt.resources.length,4);
 const candidate=JSON.parse(candidateBytes);assert.equal(candidate.revision,1);
 const {selectExampleGeneration,matchExampleManifest}=await import('../examples/content-build/selection.mjs');const selection=selectExampleGeneration(candidate,configuration);assert.equal(selection.manifestFile.path,configuration.manifestPath);const manifest=JSON.parse(readFileSync(path.join(row.runRoot,selection.manifestFile.path)));assert.equal(matchExampleManifest(selection,manifest),manifest);const mismatched=JSON.parse(JSON.stringify(manifest));mismatched.entries[0].artifact.sha256='0'.repeat(64);assert.throws(()=>matchExampleManifest(selection,mismatched));
 for(const change of [copy=>{copy.entities.find(e=>e.id==='e_generation').data.generationId='0'.repeat(64);},copy=>{copy.entities.find(e=>e.id==='e_generation').data.resourceIds.pop();},copy=>{copy.entities.find(e=>e.id==='e_generation').references.find(r=>r.slot==='manifest').id='f_wrong';},copy=>{copy.files.find(f=>f.path===configuration.manifestPath).sha256='0'.repeat(64);},copy=>{copy.entities.find(e=>e.id==='e_atlas').data.targetProfile='wrong';}]){const copy=JSON.parse(JSON.stringify(candidate));change(copy);assert.throws(()=>selectExampleGeneration(copy,configuration));}
 assert.throws(()=>selectExampleGeneration(candidate,{...configuration,manifestPath:'different.json'}));
 const again=spawnSync(process.execPath,[path.join(root,'tools/content/author-example.mjs'),'--parent',f.owner],{cwd:root,encoding:'utf8'});assert.equal(again.status,0,again.stderr);assert.notEqual(JSON.parse(again.stdout).runRoot,row.runRoot);
});
