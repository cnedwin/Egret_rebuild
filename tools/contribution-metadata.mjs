// SPDX-License-Identifier: Apache-2.0
// Generate current ledger fields from an explicit Git base; historical objects
// and raw evidence are never regenerated or treated as behavioral acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {logicalPath,fingerprintFile,canonicalTextBytes,samePhysicalPath} from './lib/file-identity.mjs';
const LEDGERS=['localization.json','knowledge-base/documentation-layout.json','source-origin.json'];
// Declarations cannot publish private/generated trees; legal originals use a separate review.
const excludedParts=new Set(['.superpowers','.agents','.codex','.git','work','node_modules','dist','build','pnpm-store','.pnpm-store','private','raw-logs','traces','screenshots','counterexample-trees']);
const excluded=p=>p.split('/').some(x=>excludedParts.has(x.toLowerCase())||/^\.env(?:\.|$)/i.test(x))||p.toLowerCase().endsWith('.tsbuildinfo');
const hash=b=>createHash('sha256').update(b).digest('hex');
const encode=v=>canonicalTextBytes(JSON.stringify(v,null,2)).toString('utf8');
const preserved=p=>/^(?:knowledge-base\/(?:evidence|experiments)\/|third-party\/|tests\/types\/.*(?:expectation|inventory))/.test(p)||/(?:^|\/)(?:LICENSE|NOTICE|COPYING)(?:[.-]|$)/i.test(p);
/** Resolve Git against the explicit cwd, never an inherited hook's owner/index. */
export function isolatedGitEnvironment(input=process.env){
 const env={...input};
 const local=new Set(['GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CONFIG','GIT_CONFIG_PARAMETERS','GIT_CONFIG_COUNT','GIT_OBJECT_DIRECTORY','GIT_DIR','GIT_WORK_TREE','GIT_IMPLICIT_WORK_TREE','GIT_GRAFT_FILE','GIT_INDEX_FILE','GIT_NO_REPLACE_OBJECTS','GIT_REPLACE_REF_BASE','GIT_PREFIX','GIT_SHALLOW_FILE','GIT_COMMON_DIR','GIT_NAMESPACE']);
 for(const key of Object.keys(env))if(local.has(key.toUpperCase())||/^GIT_CONFIG_(?:KEY|VALUE)_/i.test(key))delete env[key];
 return {...env,GIT_OPTIONAL_LOCKS:'0'};
}
function git(root,args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,env:isolatedGitEnvironment()});if(r.error||r.status!==0)throw Error('Git metadata input failed: '+(r.stderr??r.error));return r.stdout;}
function shape(name,value){
 const copy=structuredClone(value);
 if(name==='source-origin.json')for(const row of copy.files){delete row.bytes;delete row.sha256;}
 else if(name==='localization.json'){
  for(const row of copy.documents){delete row.enSha256;delete row.zhSha256;}
  for(const row of copy.criticalComments??[])delete row.sha256;
  for(const row of copy.registries??[]){delete row.sourceSha256;delete row.targetSha256;}
 }else for(const row of copy.documents){delete row.currentEnSha256;delete row.currentZhSha256;}
 return JSON.stringify(copy);
}
/** A plan is read-only and includes exact inputs for a later guarded write. */
export function planMetadata(root,{base}={}){
 root=path.resolve(root);
 base=base??git(root,['merge-base','HEAD','origin/main']).trim();
 if(!/^[A-Za-z0-9_./-]+$/.test(base)||base.startsWith('-'))throw Error('Invalid Git base');
 const commit=git(root,['rev-parse','--verify',base+'^{commit}']).trim();
 const baseline=Object.fromEntries(LEDGERS.map(f=>[f,JSON.parse(git(root,['show',commit+':'+f]))]));
 const current=Object.fromEntries(LEDGERS.map(f=>{fingerprintFile(root,f);return [f,JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))];}));
 const expected=structuredClone(baseline),inputs=new Map();
 const observe=f=>{const pin=fingerprintFile(root,logicalPath(f));inputs.set(f,pin);return pin;};
 for(const f of LEDGERS)observe(f);
 const changed=[...new Set((git(root,['diff','--name-only','--no-renames','-z',commit,'--'])+git(root,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean))].sort();
 const origin=expected['source-origin.json'],loc=expected['localization.json'],layout=expected['knowledge-base/documentation-layout.json'];
 const registered=new Map(origin.files.map(row=>[row.path,row]));
 if(registered.size!==origin.files.length)throw Error('Duplicate source declaration');
 const declarationPaths=git(root,['ls-files','--cached','--others','--exclude-standard','-z','--','contributions']).split('\0').filter(Boolean).sort();
 const declared=new Set(),frozen=new Set();
 const originalRows=new Map(baseline['source-origin.json'].files.map(row=>[row.path,row]));
 let originalCompilerPaths;
 for(const f of declarationPaths){
  if(!/^contributions\/[a-z0-9-]+\.json$/.test(f))throw Error('Invalid contribution declaration path');
  observe(f);const d=JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  if(d.schemaVersion!==1||!Array.isArray(d.files)||!Array.isArray(d.documents)||(d.frozenInputs!==undefined&&!Array.isArray(d.frozenInputs))||Object.keys(d).some(k=>!['schemaVersion','files','documents','frozenInputs'].includes(k)))throw Error('Invalid contribution declaration');
  for(const row of d.files){
   logicalPath(row.path);
   if(excluded(row.path))throw Error('An excluded input cannot be declared: '+row.path);
   if(preserved(row.path)||LEDGERS.includes(row.path)||row.path.startsWith('contributions/')||declared.has(row.path))throw Error('Duplicate or preserved declaration: '+row.path);
   if(typeof row.originRole!=='string'||row.originRole.length<12||Object.keys(row).some(k=>!['path','originRole','criticalComment'].includes(k))||row.criticalComment!==undefined&&typeof row.criticalComment!=='boolean')throw Error('Invalid source declaration');
   declared.add(row.path);observe(row.path);
   if(!registered.has(row.path)){const entry={path:row.path,originRole:row.originRole};origin.files.push(entry);registered.set(row.path,entry);}
   else if(registered.get(row.path).originRole!==row.originRole)throw Error('Existing source declaration differs: '+row.path);
   if(row.criticalComment&&!loc.criticalComments.some(x=>x.path===row.path))loc.criticalComments.push({path:row.path});
  }
  // New compiler observations have an explicit first-registration path. Their
  // reviewed raw tuple is immutable thereafter; old files cannot be relabelled.
  for(const row of d.frozenInputs??[]){
   if(!row||typeof row.path!=='string'||!/^tests\/types\/[a-z0-9-]+-diagnostic-expectations\.json$/.test(row.path))throw Error('Invalid frozen compiler path');
   logicalPath(row.path);
   if(declared.has(row.path))throw Error('Duplicate frozen compiler declaration: '+row.path);
   if(Object.keys(row).sort().join(',')!=='bytes,originRole,path,sha256'||!Number.isSafeInteger(row.bytes)||row.bytes<0||!/^[a-f0-9]{64}$/.test(row.sha256)||typeof row.originRole!=='string'||row.originRole.length<12)throw Error('Invalid frozen compiler declaration');
   const actual=observe(row.path);
   if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)throw Error('Frozen compiler identity differs: '+row.path);
   const previous=originalRows.get(row.path);
   if(previous){
    if(previous.bytes!==row.bytes||previous.sha256!==row.sha256||previous.originRole!==row.originRole)throw Error('Frozen compiler baseline differs: '+row.path);
   }else{
    originalCompilerPaths??=new Set(git(root,['ls-tree','-r','--name-only','-z',commit,'--','tests/types']).split('\0').filter(Boolean));
    if(originalCompilerPaths.has(row.path))throw Error('Frozen compiler input already exists at base: '+row.path);
    const entry={...row};origin.files.push(entry);registered.set(row.path,entry);
   }
   declared.add(row.path);frozen.add(row.path);
  }
  for(const pair of d.documents){
   if(Object.keys(pair).sort().join(',')!=='en,zh'||!declared.has(pair.en)||!declared.has(pair.zh))throw Error('Document pair requires declared sources');
   if(!loc.documents.some(x=>x.en===pair.en&&x.zh===pair.zh))loc.documents.push({...pair,kind:'public_reading'});
  }
  if(!registered.has(f)){const entry={path:f,originRole:'First-party contribution declarations; source and authorship statements are reviewed separately.'};origin.files.push(entry);registered.set(f,entry);}
 }
 const refresh=new Set([...changed,...declared,...declarationPaths]);
 for(const f of refresh){
  if(LEDGERS.includes(f))continue;
  if(preserved(f)&&!frozen.has(f))throw Error('Changed preserved input requires a separate reviewed process: '+f);
  if(!registered.has(f))throw Error('Missing source declaration: '+f);
  Object.assign(registered.get(f),observe(f));
 }
 for(const row of loc.documents)for(const [fileKey,hashKey] of [['en','enSha256'],['zh','zhSha256']])if(refresh.has(row[fileKey])||!row[hashKey])row[hashKey]=observe(row[fileKey]).sha256;
 for(const row of loc.criticalComments??[])if(refresh.has(row.path)||!row.sha256)row.sha256=observe(row.path).sha256;
 // Registry translation authority and frozen compiler inventories need their own
 // reviewed transformation. This command does not manufacture translations.
 for(const row of loc.registries??[])for(const [fileKey,hashKey] of [['source','sourceSha256'],['target','targetSha256']])if(refresh.has(row[fileKey]))row[hashKey]=observe(row[fileKey]).sha256;
 for(const row of layout.documents)for(const [fileKey,hashKey] of [['newEn','currentEnSha256'],['newZh','currentZhSha256']])if(refresh.has(row[fileKey]))row[hashKey]=observe(row[fileKey]).sha256;
 const outputs={};
 for(const f of LEDGERS){
  if(shape(f,current[f])!==shape(f,baseline[f])&&shape(f,current[f])!==shape(f,expected[f]))throw Error('Unapproved metadata structure change: '+f);
  outputs[f]=encode(expected[f]);
  if(f!=='source-origin.json'){
   const row=registered.get(f);if(!row)throw Error('Missing ledger source declaration');
   const bytes=Buffer.from(outputs[f]);Object.assign(row,{bytes:bytes.length,sha256:hash(bytes)});
  }
 }
 return {base:commit,changed,outputs,inputs:[...inputs.values()],risk:changed.every(f=>/\.md$/.test(f)||LEDGERS.includes(f))?'documentation':'code-or-tooling',scope:'Current metadata generation only; complete checks and human source/translation review remain required.'};
}
export function checkIntegrated(root,plan){
 for(const [f,text] of Object.entries(plan.outputs))if(!fs.readFileSync(path.join(root,f)).equals(Buffer.from(text)))throw Error('Current metadata not integrated: '+f);
}
export function writeMetadata(root,plan){
 // Validate every captured input before writing any ledger; never normalize
 // bytes when comparing identities. The output vocabulary is fixed here.
 if(Object.keys(plan.outputs).join('|')!==LEDGERS.join('|'))throw Error('Unexpected ledger output');
 for(const pin of plan.inputs)if(JSON.stringify(fingerprintFile(root,pin.path))!==JSON.stringify(pin))throw Error('Input changed after metadata planning: '+pin.path);
 for(const f of LEDGERS)fs.writeFileSync(path.join(root,f),canonicalTextBytes(plan.outputs[f]));
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2);let base,mode='plan';
 for(let i=0;i<args.length;i++){
  if(args[i]==='--base'&&base===undefined&&args[i+1])base=args[++i];
  else if(['--write','--check'].includes(args[i])&&mode==='plan')mode=args[i].slice(2);
  else throw Error('Usage: node tools/contribution-metadata.mjs [--base ref] [--write|--check]');
 }
 const root=fileURLToPath(new URL('..',import.meta.url)),plan=planMetadata(root,{base});
 if(mode==='write')writeMetadata(root,plan);if(mode==='check')checkIntegrated(root,plan);
 console.log(JSON.stringify({base:plan.base,changed:plan.changed,risk:plan.risk,mode,scope:plan.scope}));
}
