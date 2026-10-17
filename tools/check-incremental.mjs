// SPDX-License-Identifier: Apache-2.0
// Local feedback only: actual pushes and merge CI always retain the complete gate.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourcePackage,dependencySelection} from './incremental-dependencies.mjs';
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
 // Git may deliberately hide modified files under assume-unchanged or sparse flags.
 if(git('ls-files','-v','-z').split('\0').filter(Boolean).some(row=>!row.startsWith('H ')))reasons.push('Hidden or sparse index entries require complete checks');
 const changedPackages=[];
 for(const row of changes){
  let regular=false;try{fingerprintFile(root,row.path);regular=true;}catch{}
  // Only existing reading/source edits qualify; new names and deleted paths are full risk.
  const owner=sourcePackage(row.path);
  if(row.status!=='M'||(!reading(row.path)&&!owner)||!regular)reasons.push(row.path+': '+row.status+' requires full checks');
  if(owner)changedPackages.push(owner);
 }
 if(!changes.length)reasons.push('No changed eligible files; no cached pass is assumed');
 let dependency;
 if(!reasons.length&&changedPackages.length){try{dependency=dependencySelection(root,changedPackages);}catch(error){reasons.push('Dependency selection unavailable: '+error.message);}}
 return {schemaVersion:2,base:commit,profile:reasons.length?'full':dependency?'dependency':'documentation',changes,reasons,...dependency,mergeGate:'full prepush and protected CI remain mandatory'};
}
export function runIncremental(args){
 let base,explain=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--base'&&base===undefined&&args[i+1])base=args[++i];
  else if(args[i]==='--explain'&&!explain)explain=true;
  else throw Error('Expected unique --base <ancestor-ref> and/or --explain');
 }
 const plan=selectChecks(repository,{base});console.log(JSON.stringify(plan,null,2));if(explain)return plan;
 const before=plan.profile==='dependency'?bindFeedback(repository,plan):null;
 const commands=feedbackCommands(plan);
 for(const argv of commands){
  const command=argv[0]==='pwsh'?'pwsh':process.execPath,args=argv[0]==='pwsh'?argv.slice(1):argv;
  const r=spawnSync(command,args,{cwd:repository,stdio:'inherit',env:{...process.env,EGRET_METADATA_BASE:plan.base}});
  if(r.error)throw r.error;if(r.status!==0)throw Error('Selected check failed: '+command+' '+args.join(' '));
 }
 if(before!==null&&before!==feedbackIdentity(repository))throw Error('Inputs changed during local feedback; prepare a new selection');
 // This is feedback, never a reusable acceptance receipt; final gates re-read the tree.
 console.log('Selected local feedback PASS ('+plan.profile+'); complete pre-push and merge checks remain required.');return plan;
}
// All non-behavior verification lanes remain complete; only test-file scheduling narrows.
export function feedbackCommands(plan){
 if(plan.profile==='full')return [['tools/prepush.mjs']];
 const common=[['tools/doctor.mjs'],['tools/check-repository-hygiene.mjs'],['tools/check-publication.mjs','--contribution'],['--test','tests/publication/incremental-checks.test.mjs']];
 const kb=['pwsh','-NoProfile','-File','knowledge-base/tools/Validate-KnowledgeBase.ps1','-CheckOnly'];
 if(plan.profile==='documentation')return [...common,kb];
 if(plan.profile!=='dependency'||!Array.isArray(plan.selectedTests)||!plan.selectedTests.length)throw Error('Unknown feedback profile');
 // Give behavioral diagnostics before immutable source admission; all checks still must pass.
 const scripts=['build','check-boundaries','spritesheet-boundary','sequence-playback-boundary','browser-png-boundary','bitmap-resource-slot-boundary','bitmap-binding-ticket-boundary','resource-scene-boundary','atlas-frame/boundary','atlas-import-boundary','check-types','browser-png-types'];
 const publication=["tests/publication/historical-browser-tools.test.mjs","tests/publication/resource-browser-tools.test.mjs","tests/publication/incremental-checks.test.mjs","tests/publication/browser-tools.test.mjs","tests/publication/contribution-metadata.test.mjs","tests/publication/m0-foundations.test.mjs","tests/publication/check-publication.test.mjs","tests/publication/knowledge-base-check-only.test.mjs","tests/publication/file-case.test.mjs","tests/publication/file-identity.test.mjs","tests/publication/repository-hygiene.test.mjs","tests/publication/text-writers.test.mjs","tests/publication/powershell-comments.test.mjs"];
 return [...common.slice(0,3),['--test',...publication],...scripts.slice(0,2).map(x=>['tools/'+x+'.mjs']),['--test',...plan.selectedTests],...scripts.slice(2).map(x=>['tools/'+x+'.mjs']),['tools/verify-spine-f2-source.mjs'],['examples/headless.mjs'],['examples/nine-slice-bitmap-headless.mjs'],kb];
}
// Capture inputs before reselecting: edits between planning and execution cannot hide.
export function bindFeedback(root,plan){
 const before=feedbackIdentity(root);
 if(JSON.stringify(selectChecks(root,{base:plan.base}))!==JSON.stringify(plan))throw Error('Selection changed before execution; prepare a new selection');
 return before;
}
export function feedbackIdentity(root){
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,env:isolatedGitEnvironment(),encoding:'utf8',maxBuffer:32*1024*1024});if(r.error||r.status!==0)throw Error('Cannot bind feedback inputs');return r.stdout;};
 const hash=createHash('sha256');
 // Include index blobs as well as actual file bytes: opposite staged edits cannot disappear.
 hash.update(git('rev-parse','HEAD'));hash.update(git('ls-files','--stage','-z'));
 const files=git('ls-files','-z').split('\0').filter(Boolean);
 hash.update(git('ls-files','--others','--exclude-standard','-z'));
 for(const file of [...new Set(files)].sort())hash.update(JSON.stringify(fingerprintFile(root,file))+'\n');
 return hash.digest('hex');
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))runIncremental(process.argv.slice(2));
