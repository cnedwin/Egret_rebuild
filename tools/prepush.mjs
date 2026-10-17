import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const options=process.argv.slice(2);
if(new Set(options).size!==options.length||options.some(x=>!['--committed','--integrated'].includes(x)))throw new TypeError('Only --committed and --integrated are supported');
const hygiene=options.filter(x=>x==='--committed');
const metadata=options.includes('--integrated')?[['tools/contribution-metadata.mjs','--check',...(process.env.EGRET_METADATA_BASE?['--base',process.env.EGRET_METADATA_BASE]:[])]]:[];
// One explicit entry point serves manual runs and the repository-local Git hook.
for(const args of [['tools/check-repository-hygiene.mjs',...hygiene],...metadata,['tools/check-publication.mjs','--contribution'],['--test','tests/publication/browser-tools.test.mjs','tests/publication/contribution-metadata.test.mjs','tests/publication/m0-foundations.test.mjs','tests/publication/check-publication.test.mjs','tests/publication/knowledge-base-check-only.test.mjs','tests/publication/file-case.test.mjs','tests/publication/file-identity.test.mjs','tests/publication/repository-hygiene.test.mjs','tests/publication/text-writers.test.mjs','tests/publication/powershell-comments.test.mjs'],['tools/verify.mjs'],['examples/headless.mjs'],['examples/nine-slice-bitmap-headless.mjs']]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
// The existing knowledge-base validator remains the canonical structure check.
const kb=spawnSync('pwsh',['-NoProfile','-File','knowledge-base/tools/Validate-KnowledgeBase.ps1','-CheckOnly'],{cwd:root,stdio:'inherit'});
if(kb.error)throw kb.error;
if(kb.status!==0)process.exit(kb.status??1);
console.log('Pre-push structural and headless checks PASS; public content and translation meaning require author review.');
