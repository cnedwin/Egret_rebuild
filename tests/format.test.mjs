// SPDX-License-Identifier: Apache-2.0
// The sources that biome.json names are laid out as the formatter lays them out. A change that fails here runs
// `pnpm format` and commits what it writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
test('FM01 the sources are formatted',()=>{
 const biome=createRequire(import.meta.url).resolve('@biomejs/biome/bin/biome');
 const result=spawnSync(process.execPath,[biome,'format','.','--max-diagnostics=20','--colors=off'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
 assert.equal(result.status,0,'Run pnpm format. The formatter reports:\n'+(result.stdout+result.stderr).slice(0,4000));
});
