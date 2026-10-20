// SPDX-License-Identifier: Apache-2.0
// Admission is checked before importing browser automation or starting a host.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {parseBrowserOptions,assertBrowserEnvironment,readCompletion,browserTimeoutForSuite} from '../../tools/browser-verify.mjs';
import {validateRecoveryAccounting,encodeRecoveryArtifact} from '../../tools/shared-rendering/resource-recovery-collector.mjs';
import {compareRecoveryPixels} from '../../tools/shared-rendering/resource-recovery-oracle.mjs';
import {deflateSync} from 'node:zlib';
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

test('resource recovery is the sole fixed long-duration browser suite',()=>{
 const args=['--suite','resource-recovery','--playwright','C:/tools/playwright','--output','C:/runs/fresh'];
 assert.equal(parseBrowserOptions(args).suite,'resource-recovery');
 assert.throws(()=>parseBrowserOptions([...args,'--snapshot','C:/runs/input.json','--snapshot-sha256','a'.repeat(64)]));
 const matrix=JSON.parse(fs.readFileSync(new URL('../../tools/browser-tool-matrix.json',import.meta.url)));
 assert.deepEqual(matrix.current.find(row=>row.id==='resource-recovery'),{id:'resource-recovery',script:'tools/verify-resource-recovery.mjs',channel:true});
 for(const row of matrix.current)assert.equal(browserTimeoutForSuite(row.id),row.id==='resource-recovery'?4920000:300000);
 assert.throws(()=>browserTimeoutForSuite('unlisted'));
});

// This is explicitly synthetic protocol data, never SDK/native execution.
// One bounded seven-case fixture supplies complete real byte/hash/PNG artifacts.
// The original pixel oracle and the real completion validator check them.
const recoveryDefs=[{id:'C01-gl-primary',backend:'gl',mode:'sustained'},{id:'C02-gpu-primary',backend:'gpu',mode:'sustained'},
 {id:'C03-gpu-borrowed',backend:'gpu',mode:'borrowed-retained'},{id:'C04-gl-loss-close',backend:'gl',mode:'loss-close'},
 {id:'C05-gl-restore-close',backend:'gl',mode:'restore-close'},{id:'C06-gpu-loss-close',backend:'gpu',mode:'loss-close'},
 {id:'C07-gpu-acquire-close',backend:'gpu',mode:'restore-close'}];
const recoveryModes=['replace','cancel-before-fetch','cancel-native-decode','cancel-native-upload','binding-conflict'];
function recoveryCatalog(){return {
 schemaVersion:1,width:256,height:256,profile:'egret.shared-frame2d/1',cycleOrder:recoveryModes,
 policy:{cycles:100,losses:10,foregroundMs:1800000,slotMs:15000,slots:120,networkMbps:10,latencyMs:80,coldTargetMs:5000,retainedTargetMs:2000,reloadTargetMs:5000,maxJsGzipBytes:1048576,maxInitialAssetBytes:4194304,maxDecodedCpuBytes:134217728,maxReadyBytes:33554432,maxReadyEntries:256,maxReusableBytes:33554432,maxInFlightUploadBytes:67108864,maxTemporaryBytes:33554432},
 slots:Array.from({length:120},(_,i)=>{const round=Math.floor(i/11),within=i%11;return i>=110?{index:i,atMs:i*15000,kind:'interaction'}:within===10?{index:i,atMs:i*15000,kind:'loss',lossIndex:round,reload:round%2===1}:{index:i,atMs:i*15000,kind:'cycle',cycleIndex:round*10+within,mode:recoveryModes[(round*10+within)%5]};}),
 variants:{a:['e_a0','e_a1'],b:['e_b0','e_b1']},pressure:Array.from({length:40},(_,i)=>({id:'e_p'+String(i).padStart(2,'0'),rgba:[i*5+20,240-i*4,80,255]})),
 references:{base:[{id:'resource-0',x:24,y:24,key:'resource0'},{id:'resource-1',x:72,y:24,key:'resource1'},{id:'mesh',x:136,y:24,rgba:[0,255,255,255]},{id:'atlas',x:200,y:24,key:'atlas'},{id:'clip-inside',x:24,y:88,rgba:[0,0,255,255]},{id:'clip-outside',x:64,y:88,rgba:[0,0,0,255]},{id:'transparent-order',x:120,y:88,rgba:[188,0,188,255],tolerance:1},{id:'b1',x:136,y:152,rgba:[255,0,255,255]},{id:'text-block',x:18,y:212,rgba:[255,255,255,255]},{id:'text-space',x:38,y:212,rgba:[0,0,0,255]},{id:'interaction',x:208,y:216,key:'interaction'},{id:'clear',x:248,y:248,rgba:[0,0,0,255]}]},
 structuralFixture:true,
};}
function recoveryPixels(catalog,row){
 const bytes=Buffer.alloc(262144);for(let i=3;i<bytes.length;i+=4)bytes[i]=255;
 let points;if(row.kind==='pressure'){points=row.pageIds.map((id,i)=>({x:(i%8)*32+16,y:Math.floor(i/8)*32+16,rgba:catalog.pressure.find(p=>p.id===id).rgba}));points.push({x:136,y:152,rgba:[255,0,255,255]},{x:248,y:248,rgba:[0,0,0,255]});}
 else{const a=row.state.variant==='a',colors={resource0:a?[255,0,0,255]:[0,0,255,255],resource1:a?[0,255,0,255]:[255,255,0,255],atlas:row.state.atlas?[0,255,0,255]:[255,0,0,255],interaction:row.state.interaction?[0,255,0,255]:[255,0,0,255]};points=catalog.references.base.map(p=>({...p,rgba:p.rgba??colors[p.key]}));}
 for(const p of points)bytes.set(p.rgba,4*(p.y*256+p.x));return bytes;
}
function recoveryPng(bytes){
 const crc=data=>{let value=0xffffffff;for(const byte of data){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^(0xedb88320&-(value&1));}return(value^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);type.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc(Buffer.concat([type,data])),data.length+8);return result;};
 const header=Buffer.alloc(13);header.writeUInt32BE(256);header.writeUInt32BE(256,4);header[8]=8;header[9]=6;const rows=Buffer.alloc(256*1025);for(let y=0;y<256;y++)bytes.copy(rows,y*1025+1,y*1024,(y+1)*1024);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
function syntheticAccounting(primary){
 const zero=names=>Object.fromEntries(names.split(' ').map(key=>[key,0]));
 const s=zero('jobs queuedNetwork queuedDecode retryWaiting activeNetwork activeDecode encodedCreditBytes ownedEncodedBytes borrowedChunkBytes quarantinedJobs');
 const p=zero('jobs encodedCreditBytes ownedEncodedBytes blobLogicalBytes activeDecodes bitmapLogicalBytes rasterLogicalBytes readbackCpuBytes materializedCpuBytes quarantinedJobs unknownNativeObjects');
 const h={pending:zero('frames uploadCreditBytes pageCreditBytes readbackCreditBytes geometryCreditBytes colorCreditBytes sceneCreditBytes uniformCreditBytes depthCreditBytes'),cpu:zero('canonicalBytes scratchBytes temporaryBytes'),images:zero('readyBytes readyEntries pinnedReadyBytes pinnedReadyEntries allocatedLogicalBytes reservedCreditBytes'),reusable:zero('idleBytes idleEntries leasedBytes leasedEntries reservedBytes reservedEntries detachedBytes detachedEntries unknownBytes unknownEntries'),unknownNative:zero('knownLogicalBytes objects')};
 const sh={...s,jobs:1,activeNetwork:1,activeDecode:1,encodedCreditBytes:2,ownedEncodedBytes:1},ph={...p,jobs:1,encodedCreditBytes:1,ownedEncodedBytes:1,blobLogicalBytes:1,activeDecodes:1,bitmapLogicalBytes:4,rasterLogicalBytes:4,readbackCpuBytes:4,materializedCpuBytes:4};
 const images=primary?[...Array.from({length:40},(_,i)=>({id:i+1,bytes:1048576,kind:'manifest'})),{id:41,bytes:4,kind:'frame-text'}]:[{id:1,bytes:4,kind:'manifest'},{id:2,bytes:4,kind:'frame-text'}];
 const a={imageBytes:images.reduce((n,row)=>n+row.bytes,0),images:images.length,frames:1,frameReferences:2,frameCommands:1,sceneFrames:1,sceneDraws:1,geometryBytes:24,geometries:2,readbackBytes:0,readbackArrays:0,serializationValues:0,assetBytes:1,textImageBytes:4,selectedFrameId:1};
 const samples=[],hh=structuredClone(h);let writes=0,evictions=0;
 function sample(label,current=structuredClone(h),application={...a},textCacheImageBytes=4){
  for(const group of Object.keys(h))for(const key of Object.keys(h[group]))hh[group][key]=Math.max(hh[group][key],current[group][key]);
  const row={id:samples.length,label,at:samples.length,source:{current:{...s},highWater:{...sh},saturated:false},provider:{current:{...p},highWater:{...ph},saturated:false},resources:{current,highWater:structuredClone(hh),totals:{pageWriteCalls:writes,pageWriteBytes:writes*1048576,readyCapacityEvictions:evictions},saturated:false},textCacheImageBytes,application,sameTask:{sourceOwnedEncodedBytes:0,providerOwnedEncodedBytes:0,encodedOwnedBytes:0,decodedCpuBytes:application.imageBytes,callerReadbackBytes:application.readbackBytes,callerGeometryBytes:application.geometryBytes,callerAssetBytes:application.assetBytes,providerNativeLogicalBytes:0,textUnaliasedBytes:0,reusableAllocatedLogicalBytes:current.reusable.idleBytes+current.reusable.leasedBytes+current.reusable.detachedBytes+current.reusable.unknownBytes,reusableReturnCapacityBytes:current.reusable.reservedBytes,reusablePolicyBytes:current.reusable.idleBytes+current.reusable.reservedBytes}};
  samples.push(row);return {label,accountingSample:row.id};
 }
 const start=sample('pressure-before',structuredClone(h),{...a,readbackBytes:262144,readbackArrays:1,serializationValues:262144});let ready,warm,after;
 if(primary){const first=structuredClone(h);first.pending.frames=1;first.pending.uploadCreditBytes=17*1048576;first.pending.pageCreditBytes=16*1048576;first.cpu.canonicalBytes=16*1048576;first.cpu.temporaryBytes=16*1048576;first.images.allocatedLogicalBytes=16*1048576;hh.cpu.scratchBytes=1048576;hh.cpu.temporaryBytes=17*1048576;ready=sample('pressure-first-ready',first);
  const pinned=structuredClone(h);pinned.pending.frames=1;pinned.pending.uploadCreditBytes=1048576;pinned.images={readyBytes:32*1048576,readyEntries:32,pinnedReadyBytes:1048576,pinnedReadyEntries:1,allocatedLogicalBytes:32*1048576,reservedCreditBytes:0};pinned.reusable.leasedBytes=64;pinned.reusable.leasedEntries=1;pinned.reusable.reservedBytes=32;pinned.reusable.reservedEntries=1;warm=sample('pressure-warm-ready',pinned);writes=2;evictions=1;after=sample('pressure-after');
 }
 const beforeRelease=sample('application-before-release',structuredClone(h),{...a},0);
 const cleared=Object.fromEntries(Object.keys(a).map(key=>[key,key==='selectedFrameId'?null:0]));const afterRelease=sample('application-after-release',structuredClone(h),cleared,0);
 const {textImageBytes,selectedFrameId,...numeric}=a,applicationHighWater=Object.fromEntries(Object.keys(numeric).map(key=>[key,Math.max(...samples.map(row=>row.application[key]))]));
 const inventory={images,geometries:[{id:1,kind:'shared2d',bytes:12},{id:2,kind:'scene3d',bytes:12}],frames:[{frameId:1,category:'synthetic-protocol',archiveReferences:1,commands:1,imageIds:[1,images.at(-1).id],geometryIds:[1],selectedReferences:1}],scene:{draws:1,geometryIds:[2]}};
 return {accounting:{schemaVersion:2,samples,applicationHighWater,inventory,beforeRelease,afterRelease,released:true,scope:'Explicit synthetic structural fixture; no native observation.'},start,ready,warm,after};
}
function recoveryCompletionFixture(dir){
 const pins=new Map(),put=(name,value)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));fs.writeFileSync(path.join(dir,name),bytes);const pin={name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};pins.set(name,pin);return pin;};
 const catalog=recoveryCatalog(),natives=[];
 const report={schemaVersion:2,status:'COMPLETE',acceptanceStatus:'COMPLETE',observedStatus:'COMPLETE',node:'v26.7.0',browser:'explicit-synthetic-protocol-fixture',launch:{channel:'msedge',headless:false,additionalFlags:[],viewport:{width:256,height:256},deviceScaleFactor:1},cases:recoveryDefs,
  inputs:put('input-closure.json',{structuralFixture:true,sourceProvenance:'not native; no SDK or source closure execution'}),catalog:put('fixed-catalog.json',catalog),allJsGzipBytes:100,errors:[],cleanupFailures:[],browserClosed:true,serverClosed:true,inputsStable:true,requests:[{status:200}],runs:[],coverageGaps:[]};
 for(const def of recoveryDefs){
  const primary=def.mode==='sustained',shape=syntheticAccounting(primary),native={...def,status:'COMPLETE',accounting:shape.accounting,startup:{firstFrameAt:100,interactionMatchedAt:200},visibility:[{state:'visible',focused:true}],checks:[{code:'EXPLICIT_STRUCTURAL_FIXTURE',pass:true}],interactions:Array.from({length:primary?121:1},()=>({trusted:true,dispatchedAt:10,matchedAt:20})),cycles:[],losses:[],cleanup:{safe:true,errors:[],pending:[],providerPending:0,liveProviderValues:0,disposalExactlyOnce:true,nativeObserverValid:true,finalDiagnosticsValid:true,finalHost:{state:'closed',cleanupOutcome:'safe'},finalSession:{state:'closed'},png:{pending:0,issued:4,overflow:false,untracked:false,failures:[]},pressure:{restored:true,active:false,overflow:false,failures:[]}}};
  if(def.backend==='gpu'&&def.mode!=='borrowed-retained')native.cleanup.acquisitions={restored:true,pendingRequests:0,pendingLost:0,overflow:false,untracked:false,failures:[],requests:Array.from({length:primary?11:1},(_,i)=>({id:i+1})),devices:Array.from({length:primary?11:1},(_,i)=>({id:i+1}))};
  for(let i=0;i<(primary?10:1);i++){const reload=primary&&i%2===1,row={index:i,reload,requestedAt:100,lostAt:110};if(primary||def.mode==='borrowed-retained')Object.assign(row,{readyAt:120,matchedAt:130,elapsedMs:20,targetMs:reload?5000:2000});else row.closedAt=120;native.losses.push(row);}
  if(primary){native.foreground={startedAt:1000,finishedAt:1801000,requiredMs:1800000};native.pressureBefore=shape.start;native.pressureAfter=shape.after;native.pressure=['first','second','third','cancel-revisit','revisit'].map(pass=>({pass,readyCounters:shape.ready,beforeCounters:shape.start,counters:shape.after}));native.cycles=Array.from({length:100},(_,i)=>({index:i,mode:recoveryModes[i%5],startedAt:i*15000,finishedAt:i*15000+100,before:shape.after,warmAfter:shape.after,after:shape.after,warmPageWriteCalls:0,...(i%5===0?{publication:{readyAt:10,commitStartedAt:20,submittedAt:30,completedAt:40,matchedAt:50}}:{refusal:{message:'explicit synthetic assigned refusal'}})}));}
  natives.push(native);const run={id:def.id,status:'COMPLETE',nativeStatus:'COMPLETE',contextClosed:true,pageErrors:[],console:[],cleanup:[],pendingNativeRequestsAtRealmDisposal:0,networkConditions:{method:'Network.emulateNetworkConditions',latency:80,downloadBytesPerSecond:1250000,uploadBytesPerSecond:1250000,cacheDisabled:true,clearBrowserCache:true,serviceWorkers:'block',bypassServiceWorker:true},observations:[],presentations:[],network:[{phase:'response',fromDiskCache:false,fromServiceWorker:false}],accounting:structuredClone(validateRecoveryAccounting(native,def)),checkpoints:[{caseId:def.id,kind:'startup',network:{status:'COMPLETE',initialAssetBytes:1}}]};report.runs.push(run);
  if(primary)for(const slot of catalog.slots)if(slot.kind!=='interaction')run.checkpoints.push({caseId:def.id,kind:slot.kind,network:{status:'COMPLETE'}});if(def.mode==='borrowed-retained')run.checkpoints.push({caseId:def.id,kind:'loss',network:{status:'COMPLETE'}});
  let variant='a',atlas=0,interaction=false,input=0;
  const add=(channel,label,kind='scene',pageIds=[])=>{const row={label,kind,state:{variant,atlas,interaction},pageIds},raw=recoveryPixels(catalog,row),comparison=compareRecoveryPixels(catalog,row,raw);assert.equal(comparison.pass,true);if(channel==='readback')run.observations.push({...row,metadata:{width:256,height:256,format:'rgba8unorm',sourceFormat:'rgba8unorm',colorSpace:'srgb',alphaMode:'opaque',frameId:1,serial:1,generation:1},raw:put(def.id+'-'+label+'.rgba',raw),...comparison});else run.presentations.push({...row,raw:put(def.id+'-'+label+'.png',recoveryPng(raw)),...comparison});};
  const click=()=>{atlas=1-atlas;interaction=!interaction;add('readback','input-'+input++);};const pages=(start,count)=>catalog.pressure.slice(start,start+count).map(row=>row.id);
  add('readback','startup-first');click();if(primary){for(const [pass,start,count]of[['first',0,16],['second',16,16],['third',32,8]])add('readback','pressure-'+pass,'pressure',pages(start,count));add('presentation','pressure-cancel-preserves-third','pressure',pages(32,8));add('readback','pressure-revisit','pressure',pages(0,16));add('readback','pressure-return-to-scene');
   for(const slot of catalog.slots){if(slot.kind==='cycle'){add('readback','cycle-'+slot.cycleIndex+'-old');if(slot.mode==='replace'){add('presentation','cycle-'+slot.cycleIndex+'-new-before-commit');variant=variant==='a'?'b':'a';add('readback','cycle-'+slot.cycleIndex+'-new');}else{add('presentation','cycle-'+slot.cycleIndex+'-refused-presentation');add('readback','cycle-'+slot.cycleIndex+'-old-preserved');}}else if(slot.kind==='loss')add('readback','loss-'+slot.lossIndex+(slot.reload?'-reload':'-retained'));click();}
  }else if(def.mode==='borrowed-retained')add('readback','loss-0-retained');
  put(def.id+'-network.json',run.network);put(def.id+'-bootstrap.json',{allJsGzipBytes:100,inlineJsGzipBytes:1});
 }
 const write=state=>{for(const [i,native]of state.natives.entries())state.report.runs[i].native=put(recoveryDefs[i].id+'-native.json',native);state.report.coverageGaps=state.report.coverageGaps.length?state.report.coverageGaps:[{id:'C-SOURCE-RETAINED-PEAK',status:'CLOSED'},{id:'C-PRIVATE-RESIDENCY-PEAK',status:'CLOSED'}];for(const gap of state.report.coverageGaps)gap.evidence=state.report.runs.map(run=>({caseId:run.id,native:run.native,accountingStatus:'COMPLETE'}));put('report.json',state.report);fs.writeFileSync(path.join(dir,'artifacts.json'),JSON.stringify({schemaVersion:1,artifacts:[...pins.values()]}));};
 return {state:{report,natives},write,put};
}

test('resource recovery completion rejects false accounting, incomplete schedules and changed raw artifacts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret-recovery-structural-'));
 try{
  const fixture=recoveryCompletionFixture(dir);
  const baseline=()=>{fixture.write(fixture.state);assert.deepEqual(readCompletion('resource-recovery',dir,''),{status:'COMPLETE',browser:'explicit-synthetic-protocol-fixture'});};
  baseline();
  assert.notStrictEqual(fixture.state.report.runs[0].accounting.hostTotals,fixture.state.natives[0].accounting.samples.at(-1).resources.totals);
  // Every assigned mutant has its own complete baseline and verified restoration.
  // Keep any original refusal failure if restoration independently fails as well.
  const isolated=(label,run,restore=()=>{})=>{
   baseline();const failures=[];
   try{run();}catch(error){failures.push(error);}
   try{restore();baseline();}catch(error){failures.push(error);}
   if(failures.length===1)throw failures[0];if(failures.length>1)throw new AggregateError(failures,label);
  };
  const refuse=(label,change)=>isolated(label,()=>{const state=structuredClone(fixture.state);change(state);fixture.write(state);assert.throws(()=>readCompletion('resource-recovery',dir,''),undefined,label);});
  refuse('open gap',s=>s.report.coverageGaps[0].status='OPEN');
  refuse('not accepted',s=>s.report.acceptanceStatus='OPEN');
  refuse('missing seventh case',s=>s.report.cases.pop());
  refuse('duplicate case identity',s=>s.report.runs[1].id=s.report.runs[0].id);
  refuse('outer browser not closed',s=>s.report.browserClosed=false);
  refuse('unstable source inputs',s=>s.report.inputsStable=false);
  refuse('short foreground duration',s=>s.natives[0].foreground.finishedAt--);
  refuse('missing replacement cycle',s=>s.natives[0].cycles.pop());
  refuse('wrong retained/reload split',s=>s.natives[0].losses[1].reload=false);
  refuse('slow real recovery',s=>{s.natives[0].losses[0].elapsedMs=2001;s.natives[0].losses[0].matchedAt=2111;});
  refuse('missing trusted interaction',s=>s.natives[0].interactions.pop());
  refuse('unsettled original work',s=>s.natives[0].cleanup.pending.push('original decoder'));
  refuse('unsafe Host',s=>s.natives[0].cleanup.finalHost.cleanupOutcome='unsafe');
  refuse('missing diagnostic field',s=>delete s.natives[0].accounting.samples[0].source.current.jobs);
  refuse('saturated diagnostic',s=>s.natives[0].accounting.samples[0].provider.saturated=true);
  refuse('source credit exceeded',s=>{const row=s.natives[0].accounting.samples[0].source;row.current.encodedCreditBytes=row.highWater.encodedCreditBytes=33554433;});
  refuse('temporary sum forged',s=>s.natives[0].accounting.samples[1].resources.current.cpu.temporaryBytes--);
  refuse('overlapping return credit double counted',s=>s.natives[0].accounting.samples[2].sameTask.reusableAllocatedLogicalBytes+=32);
  refuse('duplicate retained image identity',s=>s.natives[0].accounting.inventory.images[1].id=1);
  refuse('extra inventory key',s=>s.natives[0].accounting.inventory.extra=true);
  refuse('missing inventory scene',s=>delete s.natives[0].accounting.inventory.scene);
  refuse('extra image row key',s=>s.natives[0].accounting.inventory.images[0].unmeasured=1);
  refuse('missing geometry kind',s=>delete s.natives[0].accounting.inventory.geometries[0].kind);
  refuse('extra frame row key',s=>s.natives[0].accounting.inventory.frames[0].nativeOwner={});
  refuse('extra scene row key',s=>s.natives[0].accounting.inventory.scene.bytes=12);
  refuse('duplicate image references',s=>s.natives[0].accounting.inventory.frames[0].imageIds=[1,1]);
  refuse('unknown geometry reference',s=>s.natives[0].accounting.inventory.frames[0].geometryIds=[999]);
  refuse('non-array scene references',s=>s.natives[0].accounting.inventory.scene.geometryIds={0:2,length:1});
  refuse('non-string accounting scope',s=>s.natives[0].accounting.scope={});
  refuse('retained readback after release',s=>{const row=s.natives[0].accounting.samples.at(-1);row.application.readbackArrays=1;row.application.readbackBytes=262144;row.sameTask.callerReadbackBytes=262144;});
  refuse('warm reupload hidden',s=>s.natives[0].cycles[0].warmPageWriteCalls=1);
  refuse('no actual capacity eviction',s=>{for(const row of s.natives[0].accounting.samples)row.resources.totals.readyCapacityEvictions=0;});
  refuse('compact summary altered',s=>s.report.runs[0].accounting.hostTotals.pageWriteCalls++);
  refuse('missing original pixel observation',s=>s.report.runs[0].observations.pop());
  refuse('false saved pixel result',s=>s.report.runs[0].observations[0].samples[0].actual[0]--);
  refuse('live network at realm disposal',s=>s.report.runs[0].pendingNativeRequestsAtRealmDisposal=1);
  const raw=fixture.state.report.runs[0].observations[0].raw,original=fs.readFileSync(path.join(dir,raw.name));
  const restoreRaw=()=>assert.deepEqual(fixture.put(raw.name,original),raw);
  isolated('changed raw artifact identity',()=>{
   const bytes=Buffer.from(original);bytes[0]^=1;fs.writeFileSync(path.join(dir,raw.name),bytes);
   assert.throws(()=>readCompletion('resource-recovery',dir,''),/changed artifact/);
  },restoreRaw);
  // Even a freshly rehashed artifact cannot borrow the saved success boolean.
  isolated('rehashed wrong interior pixel',()=>{
   const forged=structuredClone(fixture.state),wrong=Buffer.from(original);wrong.set([0,0,0,255],4*(24*256+24));
   forged.report.runs[0].observations[0].raw=fixture.put(raw.name,wrong);fixture.write(forged);
   assert.throws(()=>readCompletion('resource-recovery',dir,''),/reference pixels/);
  },restoreRaw);
 }finally{
  const target=path.resolve(dir),parent=path.resolve(os.tmpdir());assert.equal(path.dirname(target),parent);assert.ok(path.basename(target).startsWith('egret-recovery-structural-'));fs.rmSync(target,{recursive:true,force:true});assert.equal(fs.existsSync(target),false);
 }
});

// Pure serialization controls. Synthetic samples establish no SDK/native acceptance.
test('resource recovery retains every synthetic diagnostic sample within compact artifact encoding',()=>{
 const shape=syntheticAccounting(true),template=shape.accounting.samples[1];
 const value={scope:'Explicit synthetic encoding fixture; no native observation.',accounting:{...shape.accounting,
  samples:Array.from({length:4096},(_,id)=>({...template,id,at:id,label:'synthetic-'+id}))}};
 const expected=JSON.stringify(value),pretty=Buffer.byteLength(JSON.stringify(value,null,2)+'\n');
 assert.ok(pretty>16*1024*1024,'fixture must expose pretty-print expansion beyond the unchanged artifact cap');
 const bytes=encodeRecoveryArtifact(value);
 assert.ok(bytes.length<=16*1024*1024);
 assert.equal(bytes.toString('utf8'),expected+'\n');
 assert.deepEqual(JSON.parse(bytes.toString('utf8')),value);
 assert.equal(JSON.stringify(value),expected,'encoding must not change the input evidence');
 assert.equal(JSON.parse(bytes.toString('utf8')).accounting.samples.length,4096);
 const text={unicode:'雪',escaped:'quote" and slash\\ and newline\n',values:[null,true,false,0,1.25,Number.MAX_SAFE_INTEGER]};
 assert.deepEqual(JSON.parse(encodeRecoveryArtifact(text).toString('utf8')),text);
});

test('resource recovery encoding preserves exact raw bytes and refuses original byte quotas without consuming credit',()=>{
 const perFile=16*1024*1024,total=512*1024*1024,quota=error=>error?.code==='ERR_ASSERTION'&&error.message==='C artifact quota';
 const atLimit='x'.repeat(perFile-3),bytes=encodeRecoveryArtifact(atLimit); // two JSON quotes plus the canonical final newline
 assert.equal(bytes.length,perFile);assert.equal(JSON.parse(bytes.toString('utf8')),atLimit);
 assert.throws(()=>encodeRecoveryArtifact(atLimit+'x'),quota);
 assert.deepEqual(encodeRecoveryArtifact(atLimit),bytes);
 const raw=Buffer.from([0,13,10,255,239,187,191]),original=Buffer.from(raw);
 assert.strictEqual(encodeRecoveryArtifact(raw),raw);assert.deepEqual(raw,original);
 const retained=total-bytes.length;
 assert.equal(encodeRecoveryArtifact(atLimit,retained).length,perFile);
 assert.throws(()=>encodeRecoveryArtifact(atLimit,retained+1),quota);
 assert.equal(encodeRecoveryArtifact(atLimit,retained).length,perFile);
 assert.strictEqual(encodeRecoveryArtifact(raw,total-raw.length),raw);
 assert.throws(()=>encodeRecoveryArtifact(raw,total-raw.length+1),quota);
 assert.strictEqual(encodeRecoveryArtifact(raw,total-raw.length),raw);assert.deepEqual(raw,original);
 const tooLarge=Buffer.alloc(perFile+1);
 assert.strictEqual(encodeRecoveryArtifact(raw),raw);
 assert.throws(()=>encodeRecoveryArtifact(tooLarge),quota);
 assert.strictEqual(encodeRecoveryArtifact(raw),raw);assert.equal(tooLarge.length,perFile+1);
});
