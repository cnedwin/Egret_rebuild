// SPDX-License-Identifier: Apache-2.0
// Check shared fixture prerequisites before their expensive mutation matrices.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const options=process.argv.slice(2);
if(options.length>1||options.some(x=>x!=='--no-build'))throw new TypeError('Usage: node tools/check-test-baselines.mjs [--no-build]');
// These are existing independent positive controls, not replacement acceptance.
const cases=[
 ['tests/b1-webgpu-verifier.test.mjs','S07 the finite native collector admits the actual current emitted public closure'],
 ['tests/boundaries.test.mjs','S3D1 canonical boundary policy baseline admits every retained surface'],
 ['tests/project-boundaries.test.mjs','strict public project consumers and unsuppressed diagnostic locations run through the actual type gate'],
];
const environment={...process.env};
// A runner-control test may invoke this CLI inside a Node test session.
delete environment.NODE_TEST_CONTEXT;
if(!options.includes('--no-build')){
 const built=spawnSync(process.execPath,['tools/build.mjs'],{cwd:root,stdio:'inherit',env:environment});
 if(built.error)throw built.error;if(built.status!==0)process.exit(built.status??1);
}
const pattern='^('+cases.map(([,name])=>name).join('|')+')$';
const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern',pattern,...cases.map(([file])=>file)],{cwd:root,encoding:'utf8',env:environment,maxBuffer:16*1024*1024});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
// Bind the three executed names as well as counts; a broad selection is not proof.
const names=[...(result.stdout??'').matchAll(/^ok [0-9]+ - (.+)$/gm)].map(row=>row[1]);
if(names.length!==cases.length||cases.some(([,name])=>names.filter(value=>value===name).length!==1))throw Error('BASELINE_SELECTION_INCOMPLETE: exact test names differ');
// A renamed or removed control must not turn an empty selection into success.
for(const [name,expected]of [['tests',3],['pass',3],['fail',0],['cancelled',0],['skipped',0],['todo',0]]){
 const rows=[...(result.stdout??'').matchAll(new RegExp('^# '+name+' ([0-9]+)$','gm'))];
 if(rows.length!==1||Number(rows[0][1])!==expected)throw Error('BASELINE_SELECTION_INCOMPLETE: '+name+' must equal '+expected);
}
console.log('Shared test baselines PASS (3/3); complete protected merge checks remain required.');
