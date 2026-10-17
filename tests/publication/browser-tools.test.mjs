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


test('advanced source snapshots require a complete explicit digest pair',()=>{
 const basic=['--suite','resource-scene','--playwright','C:/tools/playwright','--output','C:/runs/new'];
 assert.throws(()=>parseBrowserOptions(basic));
 assert.throws(()=>parseBrowserOptions([...basic,'--snapshot','C:/runs/snapshot.json']));
 const complete=[...basic,'--snapshot','C:/runs/snapshot.json','--snapshot-sha256','a'.repeat(64)];
 assert.equal(parseBrowserOptions(complete).suite,'resource-scene');
 assert.throws(()=>parseBrowserOptions([...complete,'--snapshot-sha256','b'.repeat(64)]));
 assert.throws(()=>parseBrowserOptions(complete.map(x=>x==='resource-scene'?'canvas':x)));
 for(const suite of ['hit-test','mouse-input'])assert.equal(parseBrowserOptions(['--suite',suite,'--playwright','C:/tools/playwright','--output','C:/runs/new']).suite,suite);
});
test('advanced completion refuses missing controls, cleanup and accepted flags',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret advanced receipt '));
 try{
  for(const suite of ['hit-test','mouse-input','resource-scene','bitmap-slot'])assert.throws(()=>readCompletion(suite,dir,''));
  for(const file of ['result.json','report.json'])fs.writeFileSync(path.join(dir,file),JSON.stringify({status:'PASS',accepted:true,nativeInputAccepted:true}));
  for(const suite of ['hit-test','mouse-input','resource-scene','bitmap-slot'])assert.throws(()=>readCompletion(suite,dir,''));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('otherwise successful native receipts must retain the complete baseline/control schedule',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret schedule receipt '));
 const hit=['omit-query','omit-css','omit-dispatch','capture-only','omit-retirement'];
 const mouse=['OMIT_BEGIN','RETARGET_END','OMIT_Q2','CANVAS_ONLY_CSS','DPR_MULTIPLY','OMIT_PHYSICAL_REMOVE'];
 const witnesses=['BEGIN_ROUTE','END_TARGET','ACTIVATION_SUPPRESSED','CSS_REFUSAL','WRONG_X_PAYLOAD_B03','PHYSICAL_REMOVAL'];
 const put=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value));
 try{for(const suite of ['hit-test','mouse-input']){
  const ids=suite==='hit-test'?hit:mouse;
  // A structural fixture for wrapper checks only; it claims no raw native acceptance.
  const collection={environment:{node:'v26.7.0',browserVersion:'fixture',channel:'msedge'},retirement:{browserClosed:true,serverClosed:true,pendingActors:0},contexts:['baseline',...ids].map(id=>({id}))};
  const receipt=suite==='hit-test'
   ?{status:'PASS_DESKTOP_HT1_CANVAS_SUBSET',nativeInputAccepted:true,issues:[],controls:hit.map(id=>({id,status:'PASS_ASSIGNED_CONTROL_SENSITIVITY'}))}
   :{status:'PASS_DESKTOP_PRIMARY_MOUSE_CANVAS_SUBSET',nativeInputAccepted:true,results:[{status:'PASS_NATIVE_BASELINE',issues:[]},...witnesses.map(witness=>({witness,status:'PASS_ASSIGNED_CONTROL_SENSITIVITY'}))]};
  const save=()=>{put('result.json',receipt);put('collection.json',collection);};save();assert.doesNotThrow(()=>readCompletion(suite,dir,''));
  const values=suite==='hit-test'?receipt.controls:receipt.results;
  const last=values.pop();save();assert.throws(()=>readCompletion(suite,dir,''));values.push(last);
  const original=values[1];values[1]=values[2];save();assert.throws(()=>readCompletion(suite,dir,''));values[1]=original;
  collection.contexts.pop();save();assert.throws(()=>readCompletion(suite,dir,''));collection.contexts.push({id:ids.at(-1)});
  if(suite==='mouse-input'){values[0].status='FAIL_NATIVE_BASELINE';save();assert.throws(()=>readCompletion(suite,dir,''));values[0].status='PASS_NATIVE_BASELINE';values[0].issues=['failure'];}
  else receipt.issues=['baseline failure'];
  save();assert.throws(()=>readCompletion(suite,dir,''));
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
