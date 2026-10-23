// SPDX-License-Identifier: Apache-2.0
// Finite refusal checks never launch a browser or create an evidence directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),tool=path.join(root,'tools/verify-content-build.mjs');
function refused(args,pattern,extra={}){
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(NODE_OPTIONS|NODE_PATH|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key)));
 const result=spawnSync(process.execPath,[tool,...args],{cwd:root,env:{...env,...extra},encoding:'utf8',timeout:15000});
 assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,pattern);assert.equal(result.stdout,'');
}
test('closed collector CLI refuses missing, duplicate, unsupported and valueless flags',()=>{
 for(const args of [[],['--output','x'],['--unknown','x'],['--playwright','x','--playwright','y'],['--playwright']])refused(args,/Both --playwright|Usage:/);
});
test('relative installed package cannot become an implicit owner',()=>refused(['--playwright','.','--output',path.dirname(root)],/full Windows drive|absolute physical path/i));
test('evidence inside the repository is refused before generation',()=>refused(['--playwright',root,'--output',path.join(root,'collector-must-not-create')],/outside the repository/));
test('existing external evidence is never overwritten',()=>refused(['--playwright',root,'--output',path.dirname(root)],/Output already exists/));
test('Node environment injection is refused',()=>{
 for(const extra of [{NODE_PATH:root},{NODE_OPTIONS:'--stack-trace-limit=15'}])refused(['--playwright',root,'--output',path.dirname(root)],/environment injection refused/,extra);
});
