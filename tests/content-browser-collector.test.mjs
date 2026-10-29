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


test('finite native oracle fixes 72 authored pixels independently of SDK decoding',()=>{
 const program="import {contentPixelOracle} from './tools/verify-content-build.mjs'; const a=contentPixelOracle('red'),b=contentPixelOracle('green'); console.log(JSON.stringify({a:[...a],b:[...b]}));";
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(NODE_OPTIONS|NODE_PATH|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key)));
 const child=spawnSync(process.execPath,['--input-type=module','-e',program],{cwd:root,env,encoding:'utf8',timeout:15000});
 assert.equal(child.status,0,child.stderr);
 const {a,b}=JSON.parse(child.stdout);assert.equal(a.length,288);assert.equal(b.length,288);
 const at=(bytes,x,y)=>bytes.slice((y*12+x)*4,(y*12+x)*4+4);
 for(const [x,y]of [[0,0],[11,5],[1,2],[4,2],[7,2],[10,2]]){assert.deepEqual(at(a,x,y),[17,24,39,255]);assert.deepEqual(at(b,x,y),[17,24,39,255]);}
 for(const [x,y]of [[2,2],[3,2],[2,3],[3,3]]){assert.deepEqual(at(a,x,y),[255,0,0,255]);assert.deepEqual(at(b,x,y),[0,255,0,255]);}
 for(const [x,y]of [[8,2],[9,2],[8,3],[9,3]]){assert.deepEqual(at(a,x,y),[0,0,255,255]);assert.deepEqual(at(b,x,y),[0,0,255,255]);}
});
