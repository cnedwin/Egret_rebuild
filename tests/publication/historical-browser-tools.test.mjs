// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const tool=await import('../../tools/browser-history.mjs').catch(()=>({}));
test('historical migration exposes a finite prepare/run workflow',()=>{
 assert.equal(typeof tool.parseHistoryOptions,'function');
 for(const suite of ['textured-webgpu','textured-scene','sequence-player','sequence-playback','spritesheet']){
  const args=['prepare','--suite',suite,'--playwright',path.resolve('pw'),'--output',path.resolve('fresh')];
  if(['sequence-playback','spritesheet'].includes(suite))args.push('--admission',path.resolve('admission.json'),'--admission-sha256','a'.repeat(64));
  assert.equal(tool.parseHistoryOptions(args).suite,suite);
 }
});
test('missing admission, duplicate switches, unknown suites and digest errors fail closed',()=>{
 assert.equal(typeof tool.parseHistoryOptions,'function');
 for(const args of [[],['prepare','--suite','unknown'],['run','--manifest',path.resolve('x'),'--sha256','bad'],['run','--manifest',path.resolve('x'),'--sha256','a'.repeat(64),'--sha256','b'.repeat(64)],['prepare','--suite','spritesheet','--playwright',path.resolve('pw'),'--output',path.resolve('fresh')]])assert.throws(()=>tool.parseHistoryOptions(args));
});
test('raw snapshot verification rejects byte drift, missing and duplicated inputs',()=>{
 assert.equal(typeof tool.verifyHistoryPins,'function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret-history-'));
 try{const file=path.join(dir,'input');fs.writeFileSync(file,'x\n');const pin=tool.historyPin(file);
  assert.doesNotThrow(()=>tool.verifyHistoryPins([pin]));
  assert.throws(()=>tool.verifyHistoryPins([pin,pin]));assert.throws(()=>tool.verifyHistoryPins([]));
  fs.writeFileSync(file,'x\r\n');assert.throws(()=>tool.verifyHistoryPins([pin]));fs.unlinkSync(file);assert.throws(()=>tool.verifyHistoryPins([pin]));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a success label alone never earns historical suite credit',()=>{
 assert.equal(typeof tool.validateHistoryCompletion,'function');
 for(const suite of ['textured-webgpu','textured-scene','sequence-player','sequence-playback','spritesheet'])for(const value of [{status:'PASS'},{status:'PASS_SPRITESHEET_OPAQUE_SUBSET'},{}])assert.throws(()=>tool.validateHistoryCompletion(suite,value));
});
test('selected current collectors admit Node26 and exact hoisted owners',()=>{
 for(const file of ['freeze-textured-webgpu-inputs.mjs','textured-webgpu/collector.mjs','verify-textured-scene-webgpu.mjs','sequence-player/collector.mjs','sequence-playback/collector.mjs','spritesheet/collector.mjs']){
  const source=fs.readFileSync(new URL('../../tools/'+file,import.meta.url),'utf8');
  assert.ok(source.includes('26.7.0'),file);assert.ok(!source.includes("process.version === 'v24.19.0'")&&!source.includes("process.version==='v24.19.0'"),file);
 }
});

test('complete clock receipt refuses a missing replay, owner recheck or cleanup',()=>{
 for(const suite of ['sequence-playback','spritesheet']){
  const steps=['1','2','3','4','5','6','7','8','9'];
  const good={environment:{node:'v26.7.0',browserVersion:'fixture'},status:suite==='spritesheet'?'PASS_SPRITESHEET_OPAQUE_SUBSET':'PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET',completedCaptures:18,comparedPixels:576,comparedChannels:2304,firstError:null,overflow:false,identitiesStable:true,retirement:{browser:'closed',server:'closed',contexts:[{state:'closed'},{state:'closed'}],fixtures:[{},{}]},requestedStepsPerBackend:steps,captures:['canvas','webgpu'].flatMap(backend=>steps.map(step=>({backend,step,observation:{pass:true}}))),completedNewCaptures:16,completedReplays:2,compilerOwnership:{stable:true},workspaceOwnership:{stable:true}};
  assert.doesNotThrow(()=>tool.validateHistoryCompletion(suite,good));
  for(const mutate of [r=>r.completedReplays=1,r=>r.compilerOwnership.stable=false,r=>r.retirement.server='unresolved',r=>r.captures.pop(),r=>r.firstError={message:'failure'}]){const bad=structuredClone(good);mutate(bad);assert.throws(()=>tool.validateHistoryCompletion(suite,bad));}
 }
});

test('the current source ledger has its own finite cap without enlarging module limits',async()=>{
 const native=await import('../../tools/textured-webgpu/native-files.mjs');assert.equal(typeof native.inputByteLimit,'function');
 assert.equal(native.inputByteLimit('source-origin.json'),4194304);
 for(const name of ['packages/engine/dist/index.js','elsewhere/source-origin.json','SOURCE-ORIGIN.JSON'])assert.equal(native.inputByteLimit(name),1048576);
 assert.equal(native.LIMITS.moduleBytes,1048576);
});

test('mixed-scene success with incomplete final retirement is refused',()=>{
 const receipt={environment:{node:'v26.7.0',browserVersion:'fixture'},status:'PASS',exitCode:0,rawCheck:{status:'PASS',observations:2,checkedPixels:24},sensitivity:{status:'EXPECTED_PIXEL_REJECTION'},safeNative:{status:'PASS'},lifecycle:{pageClosed:true,contextClosed:true,browserClosed:true,serverClosed:true,identitiesStable:true,artifactsStable:true,pendingOperations:0,lateAcquisitionsSettled:true,cooperativeAPIClosure:true},failure:null,cleanupFailures:[],browserEvents:[]};
 assert.doesNotThrow(()=>tool.validateHistoryCompletion('textured-scene',receipt));
 for(const key of ['browserClosed','identitiesStable','artifactsStable','cooperativeAPIClosure']){const bad=structuredClone(receipt);bad.lifecycle[key]=false;assert.throws(()=>tool.validateHistoryCompletion('textured-scene',bad));}
});
