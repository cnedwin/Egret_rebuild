import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
// One explicit entry point serves manual runs and the repository-local Git hook.
for(const args of [['tools/check-publication.mjs'],['--test','tests/publication/check-publication.test.mjs','tests/publication/knowledge-base-check-only.test.mjs'],['tools/verify.mjs'],['examples/headless.mjs']]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
// The existing knowledge-base validator remains the canonical structure check.
const kb=spawnSync('pwsh',['-NoProfile','-File','knowledge-base/tools/Validate-KnowledgeBase.ps1','-CheckOnly'],{cwd:root,stdio:'inherit'});
if(kb.error)throw kb.error;
if(kb.status!==0)process.exit(kb.status??1);
console.log('Pre-push structural and headless checks PASS; public content and translation meaning require author review.');
