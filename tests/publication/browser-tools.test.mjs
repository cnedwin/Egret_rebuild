// SPDX-License-Identifier: Apache-2.0
// Admission is checked before importing browser automation or starting a host.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {parseBrowserOptions,assertBrowserEnvironment,readCompletion} from '../../tools/browser-verify.mjs';
test('current browser entry selects a fixed suite and refuses implicit configuration',()=>{
 const options=parseBrowserOptions(['--suite','canvas','--playwright','C:/tools/playwright','--output','C:/runs/fresh']);
 assert.equal(options.suite,'canvas');
 for(const args of [[],['--suite','unknown'],['--suite','canvas','--suite','b1'],['--flag','x']])assert.throws(()=>parseBrowserOptions(args));
});
test('browser environment and text collector use the selected Node baseline',()=>{
 const matrix=JSON.parse(fs.readFileSync(new URL('../../tools/browser-tool-matrix.json',import.meta.url)));
 assert.equal(matrix.node,'26.7.0');assert.equal(matrix.playwright,'1.62.1');
 const source=fs.readFileSync(new URL('../../tools/verify-canvas-text-canvas.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("process.version==='v26.7.0'"));
 assert.ok(matrix.historical.every(row=>row.reason&&row.originalNode==='24.19.0'));
});

test('inherited Node loader configuration is refused before browser startup',()=>{
 for(const key of ['NODE_OPTIONS','NODE_PATH'])assert.throws(()=>assertBrowserEnvironment({[key]:'injected'}),/Inherited Node/);
 assert.doesNotThrow(()=>assertBrowserEnvironment({}));
});
test('zero child exit without the selected completion receipt cannot pass',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret-browser-receipt-'));
 try{
  for(const suite of ['canvas','webgpu','b1','text'])assert.throws(()=>readCompletion(suite,dir,''));
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'FAIL'}));
  for(const suite of ['webgpu','b1','text'])assert.throws(()=>readCompletion(suite,dir,''));
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({status:'PASS'}));
  assert.throws(()=>readCompletion('text',dir,''));
  assert.throws(()=>readCompletion('b1',dir,''));
  assert.throws(()=>readCompletion('canvas',dir,JSON.stringify({browser:'fake',counterexample:{failed:true},checks:[]})));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
