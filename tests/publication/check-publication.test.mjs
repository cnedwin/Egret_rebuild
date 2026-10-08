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
test('publication preserves every execution identifier occurrence, including duplicates',()=>fixture(async(root,m)=>{const id='5e478aac-c48a-4c2b-85f0-cf0053255da7',zh=`# 运行记录\n${id}\n${id}\n`,en=`# Runs\n${id}\n5e 478aac-c 48a-4c 2b-85f0-cf 0053255da7\n`;await writeFile(path.join(root,'README.md'),zh);await writeFile(path.join(root,'README.en.md'),en);m.documents[0].zhSha256=sha(zh);m.documents[0].enSha256=sha(en);await writeFile(path.join(root,'localization.json'),JSON.stringify(m));assert.ok((await checkPublication(root)).issues.some(x=>x.includes('opaque identifier')));}));
