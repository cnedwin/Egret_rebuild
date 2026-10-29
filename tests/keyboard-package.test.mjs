// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const root=new URL('..',import.meta.url);
function compile(name){return spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/'+name+'.json','--pretty','false'],{cwd:root,encoding:'utf8'});}
test('keyboard strict ES2022 consumer uses only the optional entries with typed synchronous events',()=>{const result=compile('keyboard-positive');assert.equal(result.status,0,result.stdout+result.stderr);});
test('keyboard unsuppressed core consumer freezes actual misuse diagnostics and no DOM globals',()=>{
 const result=compile('keyboard-negative');assert.equal(result.status,1,result.stdout+result.stderr);
 const observed=[...result.stdout.matchAll(/^tests\/types\/keyboard-negative.ts\((\d+),(\d+)\): error TS(\d+):/gm)].map(m=>[Number(m[1]),Number(m[3])]);
 assert.deepEqual(observed,[[2,2305],[4,2305],[9,2339],[10,2540],[11,2353],[12,2540],[13,2345],[14,2345],[15,2345],[16,2740],[17,2304],[18,2304]],result.stdout);
 assert.equal((result.stdout.match(/error TS/g)??[]).length,12,result.stdout);
});
test('keyboard remains absent from the default DOM Canvas consumer',()=>{const result=compile('keyboard-browser-negative');assert.equal(result.status,1,result.stdout);assert.match(result.stdout,/keyboard-browser-negative.ts\(2,9\): error TS2305:/);assert.match(result.stdout,/keyboard-browser-negative.ts\(4,14\): error TS2305:/);assert.equal((result.stdout.match(/error TS/g)??[]).length,2,result.stdout);});
test('keyboard runtime optional namespaces expose exactly their factories and preserve pointer',async()=>{
 assert.deepEqual(Object.keys(await import('@egret/engine/input')),['createKeyboardInput','createPointerInput']);assert.deepEqual(Object.keys(await import('@egret/engine/web/keyboard')),['createBrowserKeyboardInput']);
 for(const entry of ['@egret/engine','@egret/engine/web','@egret/runtime']){const api=await import(entry);assert.equal('createKeyboardInput' in api,false);assert.equal('createBrowserKeyboardInput' in api,false);assert.equal('bindKeyboardSurface' in api,false);}
 const metadata=JSON.parse(readFileSync(new URL('../packages/engine/package.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.imports['#egret-keyboard-input'],{types:'./dist/keyboardInput.d.ts',import:'./dist/keyboardInput.js'});
});
