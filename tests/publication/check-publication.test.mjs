import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkPublication} from '../../tools/check-publication.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(run){
 const root=await mkdtemp(path.join(tmpdir(),'egret-publication-test-'));
 try{
  await mkdir(path.join(root,'registry'));await mkdir(path.join(root,'src'));
  const bodies={'README.md':'# 项目\n\n状态是提案。\n','README.en.md':'# Project\n\nEnglish | [简体中文](README.md)\n\nStatus is proposed.\n','registry/records.json':JSON.stringify({items:[{id:'D001',title:'候选方案',status:'proposed',samples:2}]}),'src/core.ts':'/** One shared close promise prevents reentrant duplication. */\nexport const closed = false;\n'};
  const en={items:[{id:'D001',title:'Candidate',status:'proposed',samples:2}],_localization:{canonicalSource:'records.json',canonicalSha256:sha(bodies['registry/records.json']),role:'read_only_translation',language:'en'}};bodies['registry/records.en.json']=JSON.stringify(en);
  for(const [p,b] of Object.entries(bodies))await writeFile(path.join(root,p),b);
  const manifest={schemaVersion:1,semanticReview:{status:'reviewed_with_scope',scope:'Translation meanings and public-content authorization require author review.'},documents:[{zh:'README.md',en:'README.en.md',zhSha256:sha(bodies['README.md']),enSha256:sha(bodies['README.en.md']),kind:'public_reading'}],registries:[{source:'registry/records.json',target:'registry/records.en.json',sourceSha256:sha(bodies['registry/records.json']),targetSha256:sha(bodies['registry/records.en.json'])}],criticalComments:[{path:'src/core.ts',sha256:sha(bodies['src/core.ts'])}]};
  await writeFile(path.join(root,'localization.json'),JSON.stringify(manifest));
  await run(root,manifest);
 }finally{
  const resolved=path.resolve(root),prefix=path.resolve(tmpdir())+path.sep;
  assert.ok(resolved.startsWith(prefix)&&path.basename(resolved).startsWith('egret-publication-test-'));
  await rm(resolved,{recursive:true,force:true});
 }
}
test('publication accepts complete reviewed pairs and canonical registry state',()=>fixture(async root=>assert.deepEqual((await checkPublication(root)).issues,[])));
test('publication rejects a missing English companion',()=>fixture(async root=>{await rm(path.join(root,'README.en.md'));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('missing')));}));
test('publication rejects a translation made stale by a Chinese edit',()=>fixture(async root=>{await writeFile(path.join(root,'README.md'),'# 项目\n新要求\n');assert.ok((await checkPublication(root)).issues.some(x=>x.includes('hash')));}));
test('publication rejects an unpaired newly added reading document',()=>fixture(async root=>{await writeFile(path.join(root,'new.md'),'# 新文档\n');assert.ok((await checkPublication(root)).issues.some(x=>x.includes('unlisted')));}));
test('publication rejects registry status drift even after hash refresh',()=>fixture(async(root,m)=>{const p=path.join(root,'registry/records.en.json'),v=JSON.parse(await readFile(p,'utf8'));v.items[0].status='accepted';const b=JSON.stringify(v);await writeFile(p,b);m.registries[0].targetSha256=sha(b);await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('parity')));}));
test('publication rejects a document link escaping the public root',()=>fixture(async(root,m)=>{const b='# Project\n[Outside](../private.md)\n';await writeFile(path.join(root,'README.en.md'),b);m.documents[0].enSha256=sha(b);await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('outside')));}));
test('publication rejects removal of reviewed English critical comments',()=>fixture(async(root,m)=>{const b='export const closed = false;\n';await writeFile(path.join(root,'src/core.ts'),b);m.criticalComments[0].sha256=sha(b);await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('English comment')));}));
test('publication does not mistake English code after a Chinese comment for English documentation',()=>fixture(async(root,m)=>{const b='/** 关闭合同。 */\nexport const closed = false;\n';await writeFile(path.join(root,'src/core.ts'),b);m.criticalComments[0].sha256=sha(b);await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('English comment')));}));
test('publication requires review of newly added core source files',()=>fixture(async root=>{await mkdir(path.join(root,'packages/new/src'),{recursive:true});await writeFile(path.join(root,'packages/new/src/NewOwner.ts'),'export class NewOwner {}\n');assert.ok((await checkPublication(root)).issues.some(x=>x.includes('unlisted critical source')));}));
test('publication requires exact approved web source registration and accepts its current English-comment hash',()=>fixture(async(root,m)=>{
 const relative='packages/engine/web/CanvasHost.ts';
 const body='/** Canvas execution preserves ordered frame commands. */\nexport const active = true;\n';
 await mkdir(path.join(root,'packages/engine/web'),{recursive:true});
 await writeFile(path.join(root,relative),body);
 assert.ok((await checkPublication(root)).issues.includes(`unlisted critical source: ${relative}`));
 m.criticalComments.push({path:relative,sha256:sha(body)});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,[]);
 await writeFile(path.join(root,relative),body+'// Changed source identity.\n');
 assert.ok((await checkPublication(root)).issues.includes(`hash stale: ${relative}`));
 const uncommented='export const active = true;\n';
 await writeFile(path.join(root,relative),uncommented);
 m.criticalComments.at(-1).sha256=sha(uncommented);
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.ok((await checkPublication(root)).issues.includes(`missing English comment: ${relative}`));
}));
test('publication preserves every execution identifier occurrence, including duplicates',()=>fixture(async(root,m)=>{const id='5e478aac-c48a-4c2b-85f0-cf0053255da7',zh=`# 运行记录\n${id}\n${id}\n`,en=`# Runs\n${id}\n5e 478aac-c 48a-4c 2b-85f0-cf 0053255da7\n`;await writeFile(path.join(root,'README.md'),zh);await writeFile(path.join(root,'README.en.md'),en);m.documents[0].zhSha256=sha(zh);m.documents[0].enSha256=sha(en);await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('opaque identifier')));}));

const privateNames=['.superpowers','.SUPERPOWERS','.agents','.AGENTS','.codex','.CODEX','.git','.GIT','work','WORK','node_modules','NODE_MODULES','dist','DIST','build','BUILD','pnpm-store','.pnpm-store','private','raw-logs','traces','screenshots','counterexample-trees'];
test('publication discovery excludes private execution and generated trees including Windows case aliases',()=>fixture(async root=>{
 for(const name of privateNames){await mkdir(path.join(root,name),{recursive:true});await writeFile(path.join(root,name,'private.md'),'# Private ledger\n');}
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));
test('publication inventory cannot override private path exclusions for documents, registries or comments',()=>fixture(async(root,m)=>{
 for(const name of privateNames){
  const body='/** Private execution must stay outside public inventory. */\n';
  await mkdir(path.join(root,name),{recursive:true});
  for(const ext of ['md','en.md','ts'])await writeFile(path.join(root,name,`private.${ext}`),body);
  const source=JSON.stringify({items:[]}),target=JSON.stringify({items:[],_localization:{canonicalSource:'private.json',canonicalSha256:sha(source),role:'read_only_translation',language:'en'}});
  await writeFile(path.join(root,name,'private.json'),source);await writeFile(path.join(root,name,'private.en.json'),target);
  const current=structuredClone(m);
  current.documents.push({zh:`${name}/private.md`,en:`${name}/private.en.md`,zhSha256:sha(body),enSha256:sha(body)});
  current.registries.push({source:`${name}/private.json`,target:`${name}/private.en.json`,sourceSha256:sha(source),targetSha256:sha(target)});
  current.criticalComments.push({path:`${name}/private.ts`,sha256:sha(body)});
  await writeFile(path.join(root,'localization.json'),JSON.stringify(current));
  const result=await checkPublication(root);
  assert.ok(result.issues.filter(x=>x.startsWith('excluded listed file:')).length===5,`${name}: ${JSON.stringify(result.issues)}`);
 }
}));
test('publication rejects alias and traversal spellings before referenced inventory access',()=>fixture(async(root,m)=>{
 for(const p of ['.SUPERPOWERS\\private.md','docs/../README.md','README.md.','README.md:stream']){
  const current=structuredClone(m);current.documents[0].zh=p;
  await writeFile(path.join(root,'localization.json'),JSON.stringify(current));
  assert.ok((await checkPublication(root)).issues.some(x=>x.startsWith('invalid listed path:')),p);
 }
}));
test('publication rejects public prose links into private trees even when target exists',()=>fixture(async(root,m)=>{
 await mkdir(path.join(root,'.SUPERPOWERS'));await writeFile(path.join(root,'.SUPERPOWERS','ledger.md'),'# Private\n');
 const body='# Project\n[Ledger](.SUPERPOWERS/ledger.md)\n';await writeFile(path.join(root,'README.en.md'),body);m.documents[0].enSha256=sha(body);
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.ok((await checkPublication(root)).issues.some(x=>x.startsWith('excluded link:')));
}));
test('publication preserves ordinary public AGENTS language pairs',()=>fixture(async(root,m)=>{
 const zh='# 协作\n',en='# Collaboration\n';await writeFile(path.join(root,'AGENTS.md'),zh);await writeFile(path.join(root,'AGENTS.en.md'),en);
 m.documents.push({zh:'AGENTS.md',en:'AGENTS.en.md',zhSha256:sha(zh),enSha256:sha(en)});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.deepEqual((await checkPublication(root)).issues,[]);
}));
test('publication retains only the two exact sealed Three vendor builds and detects altered bytes',()=>fixture(async(root,m)=>{
 const prefix='knowledge-base/experiments/asset-reference-probe/vendor/three/r186/build/';
 for(const name of ['three.core.js','three.module.js']){
  const p=prefix+name,body=await readFile(new URL('../../'+p,import.meta.url));await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),body);
 }
 assert.deepEqual((await checkPublication(root)).issues,[]);
 const p=prefix+'three.core.js';await writeFile(path.join(root,p),'altered historical build');
 assert.ok((await checkPublication(root)).issues.includes(`sealed vendor hash stale: ${p}`));
 const unknown=prefix+'new.md';await writeFile(path.join(root,unknown),'generated private output');
 m.documents.push({zh:unknown,en:unknown,zhSha256:sha('generated private output'),enSha256:sha('generated private output')});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.ok((await checkPublication(root)).issues.includes(`excluded listed file: ${unknown}`));
}));
