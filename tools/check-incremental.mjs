// SPDX-License-Identifier: Apache-2.0
// Local feedback only: actual pushes and merge CI always retain the complete gate.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {isolatedGitEnvironment} from './contribution-metadata.mjs';
import {samePhysicalPath,fingerprintFile} from './lib/file-identity.mjs';
const repository=fileURLToPath(new URL('..',import.meta.url));
const reading=p=>['README.md','README.zh-CN.md','CONTRIBUTING.md','CONTRIBUTING.zh-CN.md'].includes(p)||/^knowledge-base\/(en|Cns)\/docs\/[A-Za-z0-9_-]+\.md$/.test(p);
export function selectChecks(root,{base}={}){
 const git=(...args)=>{
  const r=spawnSync('git',args,{cwd:root,env:isolatedGitEnvironment(),encoding:'utf8',maxBuffer:16*1024*1024});
  if(r.error||r.status!==0)throw Error('Cannot establish incremental inputs: '+(r.error?.message??r.stderr));return r.stdout;
 };
 if(base!==undefined&&(typeof base!=='string'||!base||base.startsWith('-')||/[\s\0]/.test(base)))throw Error('Invalid base ref');
 const commit=base?git('rev-parse','--verify',base+'^{commit}').trim():git('merge-base','HEAD','origin/main').trim();
 const ancestor=spawnSync('git',['merge-base','--is-ancestor',commit,'HEAD'],{cwd:root,env:isolatedGitEnvironment()});
 if(ancestor.status!==0)throw Error('Incremental base must be an ancestor of HEAD');
 const changes=[];
 // Keep each Git layer: a staged edit can be cancelled in the worktree but still committed.
 for(const [layer,refs]of [['committed',[commit,'HEAD']],['staged',['--cached','HEAD']],['working',[]]]){
  const fields=git('diff','--no-ext-diff','--no-textconv','--no-renames','--name-status','-z',...refs,'--').split('\0').filter(Boolean);
  for(let i=0;i<fields.length;i+=2){if(!fields[i+1])throw Error('Malformed Git change record');changes.push({layer,status:fields[i],path:fields[i+1]});}
 }
 for(const file of git('ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean))changes.push({layer:'untracked',status:'?',path:file});
 const reasons=[];
 for(const row of changes){
  let regular=false;try{fingerprintFile(root,row.path);regular=true;}catch{}
  // Only existing modified reading files qualify; new names and deleted paths are full risk.
  if(row.status!=='M'||!reading(row.path)||!regular)reasons.push(row.path+': '+row.status+' requires full checks');
 }
 if(!changes.length)reasons.push('No changed reading files; no cached pass is assumed');
 return {schemaVersion:1,base:commit,profile:reasons.length?'full':'documentation',changes,reasons,mergeGate:'full prepush and protected CI remain mandatory'};
}
export function runIncremental(args){
 let base,explain=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--base'&&base===undefined&&args[i+1])base=args[++i];
  else if(args[i]==='--explain'&&!explain)explain=true;
  else throw Error('Expected unique --base <ancestor-ref> and/or --explain');
 }
 const plan=selectChecks(repository,{base});console.log(JSON.stringify(plan,null,2));if(explain)return plan;
 const commands=plan.profile==='documentation'
  ?[[process.execPath,['tools/doctor.mjs']],[process.execPath,['tools/check-repository-hygiene.mjs']],[process.execPath,['tools/check-publication.mjs','--contribution']],[process.execPath,['--test','tests/publication/incremental-checks.test.mjs']],[ 'pwsh',['-NoProfile','-File','knowledge-base/tools/Validate-KnowledgeBase.ps1','-CheckOnly']]]
  :[[process.execPath,['tools/prepush.mjs']]];
 for(const [command,argv]of commands){const r=spawnSync(command,argv,{cwd:repository,stdio:'inherit',env:{...process.env,EGRET_METADATA_BASE:plan.base}});if(r.error)throw r.error;if(r.status!==0)throw Error('Selected check failed: '+command+' '+argv.join(' '));}
 // This is feedback, never a reusable acceptance receipt; final gates re-read the tree.
 console.log('Selected local feedback PASS ('+plan.profile+'); complete pre-push and merge checks remain required.');return plan;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))runIncremental(process.argv.slice(2));
