// SPDX-License-Identifier: Apache-2.0
// Admission is checked before importing browser automation or starting a host.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
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


// These are structural completion fixtures, never native execution evidence.
// No SDK import or browser is needed to catch a wrapper that accepts missing work.
function sharedCompletionFixture(dir){
 const manifest=JSON.parse(fs.readFileSync(new URL('../../tools/shared-rendering/native-cases.json',import.meta.url)));
 const controls=JSON.parse(fs.readFileSync(new URL('../../tools/shared-rendering/native-controls.json',import.meta.url)));
 const artifact=(name,bytes)=>{fs.writeFileSync(path.join(dir,name),bytes);return {name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
 const status=closed=>({state:closed?'closed':'active',lastSerial:1,pendingFrames:0,pendingUploadBytes:0,
  pendingReadbackBytes:0,firstFailure:null,callbackFailureCount:0,lastCallbackFailure:null,cleanupOutcome:closed?'safe':'not-started'});
 const idle=(closed,scene)=>{const host=status(closed);return {hostStatus:host,
  sharedStatus:{host:{...host},pendingGeometryBytes:0,pendingColorBytes:0,pendingCanonicalBytes:0},
  ...(scene?{sceneStatus:{host:{...host},pendingSceneBytes:0,pendingUniformBytes:0,pendingDepthBytes:0}}:{})};};
 const schedule=manifest.cases.map(def=>['positive',def.id]);
 for(const control of controls)schedule.push(['baseline-'+control.id,control.caseId],[control.id,control.caseId],['restored-'+control.id,control.caseId]);
 const receipt={schemaVersion:1,status:'PASS',node:'v26.7.0',browser:'structural-fixture',
  launch:{channel:'msedge',headless:true,additionalFlags:[],deviceScaleFactor:1},counts:{cases:30,points:321,controls:11},
  input:artifact('input-closure.json',Buffer.from('{"structuralFixture":true}')),runs:[],controls:[],
  requests:[{path:'/',status:200}],errors:[],cleanupFailures:[],browserClosed:true,serverClosed:true,identitiesStable:true};
 for(const [index,[mode,caseId]] of schedule.entries()){
  const def=manifest.cases.find(row=>row.id===caseId),negative=manifest.negatives.find(row=>row.id===mode);
  const prefix=String(index+1).padStart(3,'0')+'-'+mode+'-'+caseId,raw=Buffer.alloc(262144);
  for(const point of def.points)raw.set(point.expectedRGBA,4*(point.y*256+point.x));
  if(negative){const point=def.points.find(row=>row.id===negative.pointId);raw.set(negative.expectedWrongRGBA,4*(point.y*256+point.x));}
  const samples=def.points.map(point=>{
   const offset=4*(point.y*256+point.x),actual=[...raw.subarray(offset,offset+4)];
   const differences=actual.map((v,c)=>Math.abs(v-point.expectedRGBA[c]));
   const failedChannels=point.channels.filter(c=>differences[c]>point.tolerance[c]);
   const bleedFailure=point.bleed?actual[point.bleed.channel]>point.bleed.max:false;
   return {id:point.id,actual,expected:point.expectedRGBA,tolerance:point.tolerance,channels:point.channels,
    differences,failedChannels,bleedFailure,coverageOnly:point.coverageOnly===true,pass:!failedChannels.length&&!bleedFailure};
  });
  const regions=[...new Set(def.draws.map(draw=>draw.regionId).filter(id=>id!==undefined))];
  const native={caseId,status:'COMPLETE',deviceAcquired:true,adapter:{isFallbackAdapter:null},device:{},failure:null,
   deviceLoss:{reason:'destroyed',destroyRequested:true},unexpectedDeviceLoss:false,uncaptured:[],hostDiagnostics:[],engineDiagnostics:[],
   overflow:false,observationRetained:true,inputs:{regions:regions.map(id=>({id}))},
   frame:{frameId:1,profile:'egret.shared-frame2d/1',width:256,height:256,outputAlpha:def.outputAlpha},
   beforeObservation:idle(false,def.scene),cleanup:{...idle(true,def.scene),scopeClosed:true,engineClosed:true,hostClosed:true,
    deviceDestroyed:true,lossSettled:true,failures:[],pendingActors:[],textures:regions.map(id=>({id,providerDisposals:1,disposed:true}))}};
  receipt.runs.push({mode,caseId,native,observations:[{samples,representationFailures:[],pass:!negative,
   readback:{width:256,height:256,format:'rgba8unorm',sourceFormat:'bgra8unorm',colorSpace:'srgb',alphaMode:def.outputAlpha,serial:1,frameId:1},
   raw:artifact(prefix+'.rgba',raw),pngs:['black','white'].map(color=>artifact(prefix+'-'+color+'.png',Buffer.from('structural-image')))}],
   errors:[],contextClosed:true,failure:null});
 }
 for(const control of controls){
  const row=receipt.runs.find(row=>row.mode===control.id),witness=manifest.negatives.find(row=>row.id===control.id);
  receipt.controls.push({id:control.id,file:control.file,from:control.from,to:control.to,original:control.original,
   changed:artifact(control.id+'-module.js',Buffer.from(control.to)),witness:control.pointId,channel:witness.channel,
   observed:row.observations[0].samples.find(sample=>sample.id===control.pointId).actual,baseline:true,restored:true,assignedFailure:true});
 }
 return receipt;
}
function withSharedCompletion(run){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret-shared-completion-'));
 try{
  const fixture=sharedCompletionFixture(dir);
  const save=receipt=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(receipt));
  save(fixture);assert.deepEqual(readCompletion('shared-webgpu',dir,''),{status:'PASS',browser:'structural-fixture'});
  const refuse=(label,change)=>{const altered=structuredClone(fixture);change(altered);save(altered);assert.throws(()=>readCompletion('shared-webgpu',dir,''),undefined,label);};
  run({dir,fixture,save,refuse});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('shared WebGPU entry accepts only the fixed suite without a source snapshot',()=>{
 const args=['--suite','shared-webgpu','--playwright','C:/tools/playwright','--output','C:/runs/fresh'];
 assert.equal(parseBrowserOptions(args).suite,'shared-webgpu');
 assert.throws(()=>parseBrowserOptions([...args,'--snapshot','C:/runs/input.json','--snapshot-sha256','a'.repeat(64)]));
});
test('shared completion requires all 30 positive and 11 baseline/assigned/restored runs in order',()=>withSharedCompletion(({refuse})=>{
 refuse('PASS alone',r=>{for(const key of Object.keys(r))if(key!=='status')delete r[key];});
 refuse('missing positive',r=>r.runs.splice(1,1));
 refuse('duplicate positive',r=>{r.runs[1]=r.runs[0];});
 refuse('missing restoration',r=>r.runs.pop());
 refuse('reordered restoration',r=>{[r.runs[30],r.runs[32]]=[r.runs[32],r.runs[30]];});
 refuse('duplicate assigned control',r=>{r.controls[1]=r.controls[0];});
 refuse('altered point count',r=>r.counts.points--);
}));
test('shared completion requires observed raw samples and the assigned numeric channel, not a runtime failure',()=>withSharedCompletion(({dir,fixture,save,refuse})=>{
 refuse('unsupported native',r=>r.runs[31].native.status='UNSUPPORTED');
 refuse('caught native failure',r=>r.runs[31].native.failure={message:'shader compilation'});
 refuse('assigned page failure',r=>r.runs[31].failure={message:'page exception'});
 refuse('no retained observation',r=>r.runs[0].native.observationRetained=false);
 refuse('missing observation',r=>r.runs[0].observations=[]);
 refuse('missing point',r=>r.runs[0].observations[0].samples.pop());
 refuse('forged sample success',r=>r.runs[0].observations[0].samples[0].actual[0]=255);
 refuse('missing channel witness',r=>{const s=r.runs[31].observations[0].samples.find(s=>s.id==='wx0.5-wy0.5');s.failedChannels=[];});
 refuse('wrong witness',r=>r.controls[0].witness='wx0.25-wy0');
 refuse('unhealthy restoration',r=>r.runs[32].observations[0].pass=false);
 refuse('readback frame mismatch',r=>r.runs[0].observations[0].readback.frameId=2);
 refuse('raw path escape',r=>r.runs[0].observations[0].raw.name='../outside.rgba');
 save(fixture);fs.unlinkSync(path.join(dir,fixture.runs[0].observations[0].raw.name));
 assert.throws(()=>readCompletion('shared-webgpu',dir,''));
}));
test('shared completion refuses pending ledgers, unsafe retirement, hidden errors and unstable identities',()=>withSharedCompletion(({refuse})=>{
 refuse('pending actors',r=>r.runs[0].native.cleanup.pendingActors.push('mapAsync'));
 refuse('pending before observation',r=>r.runs[0].native.beforeObservation.hostStatus.pendingFrames=1);
 refuse('pending shared target',r=>r.runs[0].native.cleanup.sharedStatus.pendingColorBytes=262144);
 refuse('pending B1 depth',r=>r.runs[23].native.cleanup.sceneStatus.pendingDepthBytes=262144);
 refuse('unsafe despite hostClosed',r=>r.runs[0].native.cleanup.hostStatus.cleanupOutcome='unsafe');
 refuse('resource not retired',r=>r.runs[0].native.cleanup.textures[0].providerDisposals=0);
 refuse('scope not closed',r=>r.runs[0].native.cleanup.scopeClosed=false);
 refuse('unsettled device loss',r=>r.runs[0].native.cleanup.lossSettled=false);
 refuse('uncaptured native error',r=>r.runs[0].native.uncaptured.push({message:'validation'}));
 refuse('page error',r=>r.runs[0].errors.push({message:'uncaught'}));
 refuse('discarded diagnostics',r=>r.runs[0].native.overflow=true);
 refuse('context not closed',r=>r.runs[0].contextClosed=false);
 refuse('request failure',r=>r.requests[0].status=404);
 refuse('browser not closed',r=>r.browserClosed=false);
 refuse('server not closed',r=>r.serverClosed=false);
 refuse('identity failure',r=>r.identitiesStable=false);
 refuse('identity absent',r=>delete r.identitiesStable);
}));
