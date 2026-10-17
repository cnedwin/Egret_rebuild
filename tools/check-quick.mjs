// SPDX-License-Identifier: Apache-2.0
// Fast contributor feedback still checks the complete public dependency boundary.
import {spawnSync} from 'node:child_process';
import {repository} from './doctor.mjs';
for(const args of [['tools/doctor.mjs'],['tools/build.mjs'],['tools/check-boundaries.mjs'],['--test','tests/publication/m0-foundations.test.mjs'],['examples/headless.mjs']]){
 const result=spawnSync(process.execPath,args,{cwd:repository,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
}
console.log('Quick checks PASS; final merge checks remain required.');
