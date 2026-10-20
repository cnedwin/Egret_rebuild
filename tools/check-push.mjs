// SPDX-License-Identifier: Apache-2.0
// Lightweight publication feedback; protected CI owns complete merge admission.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const args=process.argv.slice(2);
if(args.length>1||args.some(arg=>arg!=='--committed'))throw new TypeError('Usage: node tools/check-push.mjs [--committed]');
for(const command of [['tools/doctor.mjs'],['tools/check-repository-hygiene.mjs',...args],['tools/check-publication.mjs','--contribution'],['pwsh','-NoProfile','-File','knowledge-base/tools/Validate-KnowledgeBase.ps1','-CheckOnly']]){
 const executable=command[0]==='pwsh'?'pwsh':process.execPath;
 const arguments_=command[0]==='pwsh'?command.slice(1):command;
 const result=spawnSync(executable,arguments_,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
console.log('Push feedback PASS; complete merge checks and required browser acceptance remain required.');
