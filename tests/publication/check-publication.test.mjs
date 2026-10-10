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

async function layoutFixture(run){
 await fixture(async(root,m)=>{
  const zhIntroduction=await readFile(path.join(root,'README.md'),'utf8');
  const enIntroduction=(await readFile(path.join(root,'README.en.md'),'utf8')).replace('(README.md)','(README.zh-CN.md)');
  await writeFile(path.join(root,'README.zh-CN.md'),zhIntroduction);await writeFile(path.join(root,'README.md'),enIntroduction);await rm(path.join(root,'README.en.md'));
  Object.assign(m.documents[0],{zh:'README.zh-CN.md',en:'README.md',zhSha256:sha(zhIntroduction),enSha256:sha(enIntroduction)});
  m.documentationLayout={schemaVersion:1,englishRoot:'knowledge-base/en/',chineseRoot:'knowledge-base/Cns/',entryDocuments:['knowledge-base/README.md','knowledge-base/README.zh-CN.md']};
  const documents=[
   {zh:'knowledge-base/README.zh-CN.md',en:'knowledge-base/README.md',zhBody:'# 知识库\n',enBody:'# Knowledge base\n'},
   {zh:'knowledge-base/Cns/docs/guide.md',en:'knowledge-base/en/docs/guide.md',zhBody:'# 指南\n',enBody:'# Guide\n'}
  ];
  for(const {zh,en,zhBody,enBody} of documents){
   for(const [p,b] of [[zh,zhBody],[en,enBody]]){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),b);}
   m.documents.push({zh,en,zhSha256:sha(zhBody),enSha256:sha(enBody),kind:'public_reading'});
  }
  const source='knowledge-base/Cns/registry/records.json',target='knowledge-base/en/registry/records.json';
  const sourceBody=JSON.stringify({items:[{id:'D002',title:'候选记录',status:'proposed',samples:2,document:'Cns/docs/guide.md',fullDocument:'knowledge-base/Cns/docs/guide.md',registry:'Cns/registry/records.json',fullRegistry:source,historical:'knowledge-base-0.7.0/docs/历史.md'}]});
  const targetBody=JSON.stringify({items:[{id:'D002',title:'Candidate record',status:'proposed',samples:2,document:'en/docs/guide.md',fullDocument:'knowledge-base/en/docs/guide.md',registry:'en/registry/records.json',fullRegistry:target,historical:'knowledge-base-0.7.0/docs/历史.md'}],_localization:{canonicalSource:'records.json',canonicalSha256:sha(sourceBody),role:'read_only_translation',language:'en'}});
  for(const [p,b] of [[source,sourceBody],[target,targetBody]]){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),b);}
  m.registries.push({source,target,sourceSha256:sha(sourceBody),targetSha256:sha(targetBody)});
  await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
  await run(root,m);
 });
}

async function moveListedDocument(root,m,language,to){
 const item=m.documents.find(x=>x.zh==='knowledge-base/Cns/docs/guide.md'),from=item[language];
 const body=await readFile(path.join(root,from));
 await mkdir(path.dirname(path.join(root,to)),{recursive:true});await writeFile(path.join(root,to),body);await rm(path.join(root,from));
 item[language]=to;
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
}

async function updateRegistryTarget(root,m,edit){
 const item=m.registries.at(-1),target=JSON.parse(await readFile(path.join(root,item.target),'utf8'));
 edit(target.items[0]);const body=JSON.stringify(target);
 await writeFile(path.join(root,item.target),body);item.targetSha256=sha(body);
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
}

test('publication accepts the opt-in language trees, exact bridge pair and inventory-mapped registry paths',()=>layoutFixture(async root=>{
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));

for(const [language,to,label] of [
 ['zh','knowledge-base/docs/guide.md','Chinese'],
 ['zh','knowledge-base/en/docs/guide.zh-CN.md','Chinese'],
 ['zh','knowledge-base/cns/docs/guide.md','Chinese'],
 ['en','knowledge-base/Cns/docs/guide.en.md','English'],
 ['en','knowledge-base/EN/docs/guide.md','English']
])test(`publication rejects a ${label} document in the wrong or case-aliased language tree: ${to}`,()=>layoutFixture(async(root,m)=>{
 await moveListedDocument(root,m,language,to);
 assert.ok((await checkPublication(root)).issues.includes(`documentation ${label} root: ${to}`));
}));

for(const [language,to] of [
 ['en','knowledge-base/en/docs/指南.md'],
 ['en','knowledge-base/en/阅读/guide.md'],
 ['en','knowledge-base/en/docs/reading guide.md']
])test(`publication rejects non-ASCII or spaced reading path components: ${to}`,()=>layoutFixture(async(root,m)=>{
 await moveListedDocument(root,m,language,to);
 assert.ok((await checkPublication(root)).issues.includes(`documentation filename: ${to}`));
}));

test('publication accepts retained Chinese filenames in the Chinese reading tree',()=>layoutFixture(async(root,m)=>{
 await moveListedDocument(root,m,'zh','knowledge-base/Cns/docs/指南.md');
 const item=m.registries.at(-1),source=JSON.parse(await readFile(path.join(root,item.source),'utf8'));
 source.items[0].document='Cns/docs/指南.md';source.items[0].fullDocument='knowledge-base/Cns/docs/指南.md';
 const sourceBody=JSON.stringify(source);await writeFile(path.join(root,item.source),sourceBody);item.sourceSha256=sha(sourceBody);
 const target=JSON.parse(await readFile(path.join(root,item.target),'utf8'));target._localization.canonicalSha256=sha(sourceBody);
 const targetBody=JSON.stringify(target);await writeFile(path.join(root,item.target),targetBody);item.targetSha256=sha(targetBody);
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));

test('publication permits only the exact Chinese-to-English root bridge pairing',()=>layoutFixture(async(root,m)=>{
 const item=m.documents.find(x=>x.en==='knowledge-base/README.md');
 [item.zh,item.en]=[item.en,item.zh];[item.zhSha256,item.enSha256]=[item.enSha256,item.zhSha256];
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 const issues=(await checkPublication(root)).issues;
 assert.ok(issues.includes('documentation Chinese root: knowledge-base/README.md'));
 assert.ok(issues.includes('documentation English root: knowledge-base/README.zh-CN.md'));
}));

test('publication does not let the opt-in configuration grant a different language root or extra bridge exception',()=>layoutFixture(async(root,m)=>{
 m.documentationLayout.englishRoot='knowledge-base/EN/';m.documentationLayout.entryDocuments.push('knowledge-base/other.md');
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.ok((await checkPublication(root)).issues.includes('invalid documentation layout'));
}));

test('publication rejects an arbitrary outside-language LICENSE reading document',()=>layoutFixture(async root=>{
 const p='knowledge-base/vendor/LICENSE.md';await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),'# License\n');
 assert.ok((await checkPublication(root)).issues.includes(`documentation outside language roots: ${p}`));
}));

const originalLicense='knowledge-base/experiments/asset-reference-probe/assets/RiggedSimple/LICENSE.md';
test('publication retains the exact unlisted original asset license outside the language trees',()=>layoutFixture(async root=>{
 const body=await readFile(new URL('../../'+originalLicense,import.meta.url));
 await mkdir(path.dirname(path.join(root,originalLicense)),{recursive:true});await writeFile(path.join(root,originalLicense),body);
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));

test('publication rejects altered bytes at the sealed original license path',()=>layoutFixture(async root=>{
 await mkdir(path.dirname(path.join(root,originalLicense)),{recursive:true});await writeFile(path.join(root,originalLicense),'# Changed original license\n');
 assert.ok((await checkPublication(root)).issues.includes(`sealed original hash stale: ${originalLicense}`));
}));

test('publication inventory cannot list the sealed original as a language-tree exception',()=>layoutFixture(async(root,m)=>{
 const body=await readFile(new URL('../../'+originalLicense,import.meta.url));
 await mkdir(path.dirname(path.join(root,originalLicense)),{recursive:true});await writeFile(path.join(root,originalLicense),body);
 m.documents.push({zh:originalLicense,en:originalLicense,zhSha256:sha(body),enSha256:sha(body),kind:'informational_legal'});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 const issues=(await checkPublication(root)).issues;
 assert.ok(issues.includes(`documentation Chinese root: ${originalLicense}`));
 assert.ok(issues.includes(`documentation English root: ${originalLicense}`));
}));

for(const target of ['en/docs/other.md','knowledge-base/en/docs/guide.md'])test(`publication rejects registry path drift rather than allowlisting all translated paths: ${target}`,()=>layoutFixture(async(root,m)=>{
 await updateRegistryTarget(root,m,item=>{item.document=target;});
 assert.ok((await checkPublication(root)).issues.includes('parity value: knowledge-base/Cns/registry/records.json.items.0.document'));
}));

test('publication keeps historical path authority exact when no inventory pair maps it',()=>layoutFixture(async(root,m)=>{
 await updateRegistryTarget(root,m,item=>{item.historical='knowledge-base-0.7.0/docs/history.md';});
 assert.ok((await checkPublication(root)).issues.includes('parity value: knowledge-base/Cns/registry/records.json.items.0.historical'));
}));

test('publication retains exact registry status authority while permitting paired paths',()=>layoutFixture(async(root,m)=>{
 await updateRegistryTarget(root,m,item=>{item.status='accepted';});
 assert.ok((await checkPublication(root)).issues.includes('parity value: knowledge-base/Cns/registry/records.json.items.0.status'));
}));

async function moveListedRegistry(root,m,side,to){
 const item=m.registries.at(-1),from=item[side];
 const source=JSON.parse(await readFile(path.join(root,item.source),'utf8'));
 const target=JSON.parse(await readFile(path.join(root,item.target),'utf8'));
 item[side]=to;
 source.items[0].registry=item.source.slice('knowledge-base/'.length);source.items[0].fullRegistry=item.source;
 target.items[0].registry=item.target.slice('knowledge-base/'.length);target.items[0].fullRegistry=item.target;
 const sourceBody=JSON.stringify(source);
 target._localization.canonicalSource=path.basename(item.source);target._localization.canonicalSha256=sha(sourceBody);
 const targetBody=JSON.stringify(target);
 await rm(path.join(root,from));
 for(const [p,b] of [[item.source,sourceBody],[item.target,targetBody]]){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),b);}
 item.sourceSha256=sha(sourceBody);item.targetSha256=sha(targetBody);
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
}

test('publication requires a layout policy for discovered knowledge-base reading documents even without KB registries',()=>layoutFixture(async(root,m)=>{
 delete m.documentationLayout;
 const item=m.registries.pop();await rm(path.join(root,item.source));await rm(path.join(root,item.target));
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,['missing documentation layout']);
}));

test('publication requires a layout policy for a knowledge-base current-version registry without reading documents',()=>fixture(async(root,m)=>{
 const source='knowledge-base/Cns/当前版本.json',target='knowledge-base/en/current-version.json';
 const sourceBody=JSON.stringify({version:'0.19.0',status:'proposed'});
 const targetBody=JSON.stringify({version:'0.19.0',status:'proposed',_localization:{canonicalSource:'当前版本.json',canonicalSha256:sha(sourceBody),role:'read_only_translation',language:'en'}});
 for(const [p,b] of [[source,sourceBody],[target,targetBody]]){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),b);}
 m.registries.push({source,target,sourceSha256:sha(sourceBody),targetSha256:sha(targetBody)});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,['missing documentation layout']);
}));

for(const source of ['knowledge-base/当前版本.json','knowledge-base/en/registry/canonical.json'])test(`publication rejects a canonical KB registry outside the exact Chinese root: ${source}`,()=>layoutFixture(async(root,m)=>{
 await moveListedRegistry(root,m,'source',source);
 assert.ok((await checkPublication(root)).issues.includes(`documentation registry Chinese root: ${source}`));
}));

for(const target of ['knowledge-base/current-version.json','knowledge-base/Cns/registry/records.en.json'])test(`publication rejects an English KB registry outside the exact English root: ${target}`,()=>layoutFixture(async(root,m)=>{
 await moveListedRegistry(root,m,'target',target);
 assert.ok((await checkPublication(root)).issues.includes(`documentation registry English root: ${target}`));
}));

test('publication rejects a Han filename in the English JSON registry tree',()=>layoutFixture(async(root,m)=>{
 const target='knowledge-base/en/registry/记录.json';await moveListedRegistry(root,m,'target',target);
 assert.ok((await checkPublication(root)).issues.includes(`documentation filename: ${target}`));
}));

test('publication accepts a Chinese filename for the canonical current-version JSON inside Cns',()=>layoutFixture(async(root,m)=>{
 await moveListedRegistry(root,m,'source','knowledge-base/Cns/当前版本.json');
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));

test('publication does not require a reading layout for the exact retained original license alone',()=>fixture(async root=>{
 const body=await readFile(new URL('../../'+originalLicense,import.meta.url));
 await mkdir(path.dirname(path.join(root,originalLicense)),{recursive:true});await writeFile(path.join(root,originalLicense),body);
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));

test('publication rejects reversed root introduction language identities when the layout policy is active',()=>layoutFixture(async(root,m)=>{
 const item=m.documents.find(x=>x.en==='README.md');
 [item.zh,item.en]=[item.en,item.zh];[item.zhSha256,item.enSha256]=[item.enSha256,item.zhSha256];
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 const issues=(await checkPublication(root)).issues;
 assert.ok(issues.includes('documentation English default: README.zh-CN.md'));
 assert.ok(issues.includes('documentation Chinese companion: README.md'));
}));

test('publication rejects a reverted Chinese default README and English .en companion',()=>layoutFixture(async(root,m)=>{
 const item=m.documents.find(x=>x.en==='README.md');
 const zhBody=await readFile(path.join(root,item.zh),'utf8');
 const enBody=(await readFile(path.join(root,item.en),'utf8')).replace('(README.zh-CN.md)','(README.md)');
 await rm(path.join(root,item.zh));await writeFile(path.join(root,'README.md'),zhBody);await writeFile(path.join(root,'README.en.md'),enBody);
 Object.assign(item,{zh:'README.md',en:'README.en.md',zhSha256:sha(zhBody),enSha256:sha(enBody)});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 const issues=(await checkPublication(root)).issues;
 assert.ok(issues.includes('documentation English default: README.en.md'));
 assert.ok(issues.includes('documentation Chinese companion: README.md'));
}));

test('publication requires the exact .zh-CN companion for a non-KB English reading document',()=>layoutFixture(async(root,m)=>{
 const item=m.documents.find(x=>x.en==='README.md'),to='README.chinese.md';
 const zhBody=await readFile(path.join(root,item.zh),'utf8');
 const enBody=(await readFile(path.join(root,item.en),'utf8')).replace('(README.zh-CN.md)',`(${to})`);
 await rm(path.join(root,item.zh));await writeFile(path.join(root,to),zhBody);await writeFile(path.join(root,item.en),enBody);
 item.zh=to;item.enSha256=sha(enBody);
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,['documentation Chinese companion: README.chinese.md']);
}));

test('publication requires ASCII path components for English reading documents outside KB',()=>layoutFixture(async(root,m)=>{
 const zh='docs/指南.zh-CN.md',en='docs/指南.md',zhBody='# 指南\n',enBody='# Guide\n';
 await mkdir(path.join(root,'docs'));await writeFile(path.join(root,zh),zhBody);await writeFile(path.join(root,en),enBody);
 m.documents.push({zh,en,zhSha256:sha(zhBody),enSha256:sha(enBody),kind:'public_reading'});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,[`documentation filename: ${en}`]);
}));

test('publication preserves an informational original LICENSE pair outside KB under the layout policy',()=>layoutFixture(async(root,m)=>{
 const zh='LICENSE.zh-CN.md',en='LICENSE',zhBody='# 许可证说明\n',enBody='Original license text.\n';
 await writeFile(path.join(root,zh),zhBody);await writeFile(path.join(root,en),enBody);
 m.documents.push({zh,en,zhSha256:sha(zhBody),enSha256:sha(enBody),kind:'informational_legal'});
 await writeFile(path.join(root,'localization.json'),JSON.stringify(m));
 assert.deepEqual((await checkPublication(root)).issues,[]);
}));
