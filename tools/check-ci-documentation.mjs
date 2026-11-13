// SPDX-License-Identifier: Apache-2.0
// Conservative admission for the Windows documentation-only merge checks.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Ledgers are refreshed after merges by a change that carries nothing else. A reading change
// leaves all three as the base has them; one that carries a ledger takes the full gate.
const ledgers = ['localization.json','knowledge-base/documentation-layout.json','source-origin.json'];
const ledgerPaths = new Set(ledgers);
const rootPairs = new Map([
 ['README.md','README.zh-CN.md'],
 ['DOCUMENTATION.md','DOCUMENTATION.zh-CN.md'],
 ['knowledge-base/README.md','knowledge-base/README.zh-CN.md'],
 ['knowledge-base/en/README.md','knowledge-base/Cns/README.md'],
 ['knowledge-base/en/CHANGELOG.md','knowledge-base/Cns/CHANGELOG.md'],
]);
const readings = new Set([
 'README.md','DOCUMENTATION.md','knowledge-base/README.md','knowledge-base/en/README.md',
 'knowledge-base/en/CHANGELOG.md',
 ...[
  'architecture-and-engineering-plan','content-build-pipeline','core-progress','delivery-plan',
  'engineering-plan','getting-started','glossary','m1-rendering-resource-plan','m2-m4-delivery-plan',
  'm2-spine-content-plan','m3-ui-text-input-plan','m4-core-acceptance-plan','mobile-examples','world3d',
 ].map(name=>'knowledge-base/en/docs/'+name+'.md'),
]);
const architecture = 'architecture-and-engineering-plan.md';
const sha = /^[0-9a-f]{40}$/;
const utf8 = new TextDecoder('utf-8',{fatal:true});

function reader(root){
 return (...args)=>{
  const result=spawnSync('git',['--no-replace-objects',...args],{
   cwd:root,windowsHide:true,timeout:30000,maxBuffer:16*1024*1024,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1'},
  });
  if(result.error||result.status!==0)throw Error('Git admission read failed: '+args[0]);
  return utf8.decode(result.stdout);
 };
}
function requireThat(condition,reason){if(!condition)throw Error(reason);}

function allowedReadings(localization){
 const permitted=new Set();
 for(const {kind,en,zh} of localization.documents){
  if(!readings.has(en)||!['public_reading','public_navigation'].includes(kind))continue;
  // The existing bilingual registry gives the exact authored Chinese spelling.
  requireThat(rootPairs.has(en)?rootPairs.get(en)===zh
   :typeof zh==='string'&&/^knowledge-base\/Cns\/docs\/[^/\\\x00-\x1f\x7f]+\.md$/.test(zh),
  'Unrecognized translation path');
  requireThat(!permitted.has(en)&&!permitted.has(zh),'Ambiguous reading pair');
  permitted.add(en);permitted.add(zh);
 }
 return permitted;
}

// The architecture guide mixes current status with normative delivery rules.
// Mask only the registered status lines; compare all remaining bytes verbatim.
function architecturePolicy(text){
 const lines=text.split('\n');
 const first=lines.findIndex(line=>line.startsWith('## 1. '));
 requireThat(first>0,'Architecture status section changed shape');
 function mask(test,from,to){
  const found=lines.map((line,i)=>i>=from&&i<to&&test.test(line)?i:-1).filter(i=>i>=0);
  requireThat(found.length===1,'Architecture status slot changed shape');
  requireThat(!/[<>]|`{3}/.test(lines[found[0]]),'Architecture status slot must remain inline prose');
  lines[found[0]]='';
 }
 mask(/^\d{4}-\d{2}-\d{2} · /,0,first);
 mask(/^(?:Audited main |复盘 main )/,0,first);
 mask(/^M0 /,0,first);
 mask(/\[M2–M4 (?:roadmap|路线图)\]\(m2-m4-delivery-plan\.md\)/,0,first);
 if(lines[0].startsWith('# Egret Engine ')){
  const sources=lines.findIndex(line=>line.startsWith('## 13. '));
  requireThat(sources>first,'Architecture baseline section changed shape');
  mask(/^The links below preserve the original architecture-design baseline\./,sources,sources+4);
 }
 return lines.join('\n');
}
export async function selectWindowsMergeChecks(root,inputs){
 const {eventName,baseRef,base,head,merge}=inputs;
 const full=reason=>({profile:'full',reason});
 try{
  requireThat(eventName==='pull_request'&&baseRef==='main','Only pull requests to main are eligible');
  requireThat([base,head,merge].every(id=>typeof id==='string'&&sha.test(id)),'Exact event commit IDs required');
  const git=reader(root);
  requireThat(git('rev-parse','--verify','HEAD^{commit}').trim()===merge,'Checkout is not the event merge commit');
  requireThat(git('rev-list','--parents','-n','1',merge).trim()===merge+' '+base+' '+head,'Event merge parents do not match');
  requireThat(git('merge-base','--all',base,head).trim()===base,'The pull request is not based on the exact event base');
  const tree=git('rev-parse','--verify',merge+'^{tree}').trim();
  requireThat(sha.test(tree)&&tree===git('rev-parse','--verify',head+'^{tree}').trim(),'Synthetic merge and candidate trees differ');
  requireThat(!git('status','--porcelain=v1','-z','-uall'),'Checkout has local changes');
  requireThat(git('ls-files','-v','-z').split('\0').filter(Boolean).every(row=>row.startsWith('H ')),'Checkout has hidden or sparse index entries');

  const admitted=allowedReadings(JSON.parse(git('show',base+':localization.json')));
  // Identical head and merge trees make this one raw diff sufficient for both.
  const raw=git('diff-tree','--no-commit-id','-r','--raw','--no-abbrev','--no-renames','-z',base,merge,'--').split('\0');
  requireThat(raw.pop()===''&&raw.length%2===0,'Malformed Git path records');
  const documents=new Set();
  for(let i=0;i<raw.length;i+=2){
   const file=raw[i+1];
   requireThat(/^:100644 100644 [0-9a-f]{40} [0-9a-f]{40} M$/.test(raw[i]),'A path was added, removed, renamed, or changed file mode');
   requireThat(!ledgerPaths.has(file),'A change that carries a ledger takes the full gate: '+file);
   requireThat(admitted.has(file),'Change outside the current reading allowlist: '+file);
   if(file.endsWith('/'+architecture)){
    requireThat(architecturePolicy(git('show',base+':'+file))===architecturePolicy(git('show',merge+':'+file)),'Architecture policy or document structure changed');
   }
   documents.add(file);
  }
  requireThat(documents.size>0,'No eligible reading edits');

  // Nothing is written for a reading change, so no generated metadata needs admitting here. The
  // documentation checks that follow still plan it and refuse an undeclared or unpaired file.
  return {profile:'documentation',base,head,merge,tree,documents:[...documents].sort()};
 }catch(error){return full(error.message);}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const [eventName,baseRef,base,head,merge]=process.argv.slice(2);
 const root=fileURLToPath(new URL('..',import.meta.url));
 console.log(JSON.stringify(await selectWindowsMergeChecks(root,{eventName,baseRef,base,head,merge})));
}
