// SPDX-License-Identifier: Apache-2.0
// Finite metadata-only tool UNIT checks. No SDK import, browser, build or timing run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fingerprintFile, canonicalTextBytes } from '../tools/lib/file-identity.mjs';
import { buildTrialSchedule, nearestRank, summarizeSamples, aggregateTiming, validateRecipe, canonicalPublicValues, readPinned, loadRecipe, createFixedRecipe, publicSummary, prepareOptions, validateBuildRecord, collectSnapshotInputs, validatePrimingObservation } from '../tools/verify-incremental-rendering.mjs';

function metadataFixture(run) {
  const parent=fs.realpathSync(os.tmpdir()),owner=fs.mkdtempSync(path.join(parent,'egret-native-meta-'));
  try {
    const roles={};
    for(const role of ['baseline','candidate']) {
      const root=path.join(owner,role);fs.mkdirSync(root);
      fs.writeFileSync(path.join(root,'manifest.json'),canonicalTextBytes(JSON.stringify({metadataOnly:true,role},null,2)));
      roles[role]={root,manifest:fingerprintFile(root,'manifest.json')};
    }
    const recipe=createFixedRecipe(roles.baseline,roles.candidate),file=path.join(owner,'recipe.json');
    fs.writeFileSync(file,canonicalTextBytes(JSON.stringify(recipe,null,2)));
    return run({owner,recipe,file});
  } finally {
    assert.equal(path.dirname(fs.realpathSync(owner)),parent);assert.ok(path.basename(owner).startsWith('egret-native-meta-'));
    fs.rmSync(owner,{recursive:true});
  }
}

test('UNIT exact serial finite schedules and timing pair order', () => {
  const rows = buildTrialSchedule('timing');
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map(x => x.id)).size, 30);
  for (let round=0; round<5; round++) {
    const part=rows.slice(round*6,round*6+6);
    assert.deepEqual(part.filter((_,i)=>i%2===0).map(x=>x.state), ['static','sparse','full'].map((_,i)=>['static','sparse','full'][(round+i)%3]));
    for(let pair=0;pair<3;pair++) assert.deepEqual(part.slice(pair*2,pair*2+2).map(x=>x.role),round%2===0?['baseline','candidate']:['candidate','baseline']);
  }
  assert.equal(buildTrialSchedule('diagnostic').length,6);
  assert.equal(buildTrialSchedule('correctness').length,6);
  assert.equal(buildTrialSchedule('counts').length,6);
  assert.equal(buildTrialSchedule('preflight').length,2);
  assert.throws(()=>buildTrialSchedule('arbitrary'),/MODE/);
});

test('UNIT nearest rank includes all values and does not interpolate or mutate', () => {
  const values=[10,1,6,3,8,2,7,4,9,5],saved=[...values];
  assert.equal(nearestRank(values,.5),5);
  assert.equal(nearestRank(values,.95),10);
  assert.equal(nearestRank(values,.99),10);
  assert.deepEqual(values,saved);
  assert.throws(()=>nearestRank([], .95),/SAMPLES/);
  assert.throws(()=>nearestRank([1,NaN], .95),/SAMPLES/);
});

test('UNIT continuous span retains timing gaps and boundary interval separately', () => {
  const columns={ordinal:[0,1],rafTimestamp:[0,16],updateStart:[1,17],updateEnd:[3,19],renderStart:[5,21],renderEnd:[9,30],flags:[3,3]};
  const result=summarizeSamples(columns,2,50);
  assert.equal(result.update.p95,2);
  assert.equal(result.engine.p95,9);
  assert.equal(result.updateThroughRender.p95,13);
  assert.equal(result.intervals.p95,16);
  assert.equal(result.crossWindowInterval,34);
  assert.notEqual(result.updateThroughRender.p95,result.update.p95+result.engine.p95);
  assert.throws(()=>summarizeSamples({...columns,flags:[3,1]},2,50),/FOREGROUND/);
  assert.throws(()=>summarizeSamples(columns,65537,50),/SAMPLE/);
});

test('UNIT five-run medians use continuous full spans and refuse partial aggregates', () => {
  const rows=buildTrialSchedule('timing').map(trial=>({trial,status:'PASS_TIMING',metrics:{
    updateThroughRender:{p95:trial.role==='baseline'?10:11},
    engine:{p95:trial.role==='baseline'?1:100},intervals:{p95:16,p99:32}
  }}));
  const result=aggregateTiming(rows);
  assert.equal(result.fullDirtyRatio,1.1);
  assert.equal(result.fullDirtyRatioAccepted,true);
  assert.throws(()=>aggregateTiming(rows.slice(1)),/COMPLETE/);
  assert.throws(()=>aggregateTiming([...rows.slice(0,29),rows[0]]),/COMPLETE/);
  assert.throws(()=>aggregateTiming(rows.map((row,i)=>i===0?{...row,status:'INCOMPLETE'}:row)),/COMPLETE/);
});

test('UNIT recipe accepts only fixed fields and exact finite parameters', () => {
  assert.throws(()=>validateRecipe({}),/RECIPE/);
  assert.throws(()=>validateRecipe({schema:'egret.incremental-native-recipe/2',warmMs:0}),/RECIPE/);
});

test('UNIT canonical public numbers retain signed zero and actual table order', () => {
  const input={ b:new Float32Array([-0,0,1]), a:[{ y:2,x:-0 },{ x:1 }] };
  const result=canonicalPublicValues(input);
  assert.deepEqual(result,{a:[{x:{signedZero:-1},y:2},{x:1}],b:[{signedZero:-1},0,1]});
  assert.ok(Object.is(input.b[0],-0));
  assert.notDeepEqual(canonicalPublicValues([0,-0]),canonicalPublicValues([-0,0]));
});

test('UNIT diagnostic timestamps preserve capture and Host separately', () => {
  const columns={ordinal:[0,1],rafTimestamp:[0,16],updateStart:[1,17],updateEnd:[2,18],captureStart:[3,19],captureEnd:[5,23],
    renderStart:[6,24],renderEnd:[9,29],flags:[3,3]};
  const value=summarizeSamples(columns,2,40);
  assert.equal(value.capture.p95,4); assert.equal(value.host.p95,5); assert.equal(value.updateThroughRender.p95,12);
  assert.throws(()=>summarizeSamples({...columns,captureEnd:[7,23]},2,40),/CAPTURE_ORDER/);
  assert.throws(()=>summarizeSamples({...columns,rafTimestamp:[0,0]},2,40),/SAMPLE_RAF/);
});

test('UNIT fixed recipe pins parameters and complete schedules without loading SDK code', () => metadataFixture(({recipe}) => {
  assert.equal(validateRecipe(recipe),recipe);
  assert.throws(()=>validateRecipe({...recipe,schema:'egret.incremental-native-recipe/3'}),/RECIPE_FIXED/);
  assert.throws(()=>validateRecipe({...recipe,unexpected:true}),/RECIPE_FIELDS/);
  for(const key of ['warmMs','measurementMs','maxPendingFrames','sampleCapacity','operationMs','countsFramesPerState','primingFrames','warmObservationCapacity']) {
    const changed=structuredClone(recipe);changed.fixed[key]++;assert.throws(()=>validateRecipe(changed),/RECIPE_FIXED/);
  }
  const absent=structuredClone(recipe);absent.schedules.timing.pop();assert.throws(()=>validateRecipe(absent),/RECIPE_SCHEDULES/);
  const duplicate=structuredClone(recipe);duplicate.schedules.timing[29]=duplicate.schedules.timing[0];assert.throws(()=>validateRecipe(duplicate),/RECIPE_SCHEDULES/);
  const foreign=structuredClone(recipe);foreign.tools[0].path='foreign.mjs';assert.throws(()=>validateRecipe(foreign),/RECIPE_TOOL_MEMBERS/);
  const equal=structuredClone(recipe);equal.candidate.root=equal.baseline.root;assert.throws(()=>validateRecipe(equal),/RECIPE_DISTINCT_ROOTS/);
}));

test('UNIT exact raw pin and owner mismatch refuse changed bytes without SDK execution', () => metadataFixture(({owner,recipe,file:recipeFile}) => {
  const file=path.join(owner,'raw.bin');fs.writeFileSync(file,Buffer.from([0,13,10,255]));
  const pin=fingerprintFile(owner,'raw.bin');assert.deepEqual(readPinned(owner,pin),Buffer.from([0,13,10,255]));
  fs.writeFileSync(file,Buffer.from([0,10,13,255]));assert.throws(()=>readPinned(owner,pin),/PIN_CHANGED/);
  assert.throws(()=>readPinned(owner,{...pin,path:'../raw.bin'}));
  assert.deepEqual(loadRecipe(recipeFile).recipe,recipe);
  assert.throws(()=>loadRecipe(recipeFile,owner,recipe.candidate.root),/RECIPE_BASELINE_ARGUMENT/);
  const changed=structuredClone(recipe);changed.baseline.manifest.sha256='0'.repeat(64);
  const changedFile=path.join(owner,'changed.json');fs.writeFileSync(changedFile,canonicalTextBytes(JSON.stringify(changed,null,2)));
  assert.throws(()=>loadRecipe(changedFile),/PIN_CHANGED/);
  const field='  "schema": "egret.incremental-native-recipe/4",';
  const duplicate=fs.readFileSync(recipeFile,'utf8').replace(field,field+'\n'+field);
  assert.deepEqual(JSON.parse(duplicate),recipe);
  fs.writeFileSync(changedFile,duplicate);assert.throws(()=>loadRecipe(changedFile),/RECIPE_CANONICAL_RAW/);
}));

test('UNIT public summary exposes only fixed safe fields', () => {
  const marker='SECRET_PERSONAL_VALUE',sha256='a'.repeat(64);
  const result=publicSummary({mode:'timing',status:'FAIL',failure:{message:marker},source:{repository:marker,role:'built-sdk',manifest:{path:'manifest.json',bytes:12,sha256}},
    environment:{node:'v26.7.0',browserExecutable:marker,commandLine:marker,pid:123},native:{adapter:{description:marker},frames:[]},
    metrics:{updateThroughRender:{count:2,p50:1,p95:2,p99:2}},frames:[{ordinal:4,raw:{name:'frame.rgba',path:marker,bytes:8,sha256}}]});
  assert.equal(JSON.stringify(result).includes(marker),false);assert.equal(result.failurePresent,true);
  assert.equal(result.sourceRole,'built-sdk');assert.equal(result.metrics.updateThroughRender.p95,2);
  assert.deepEqual(result.frames[0].raw,{name:'frame.rgba',bytes:8,sha256});
});

test('UNIT prepare requires exactly seven absolute input pairs', () => metadataFixture(({owner}) => {
  const pairs=['--baseline','--candidate','--baseline-build-log','--baseline-build-exit','--candidate-build-log','--candidate-build-exit','--output'];
  const args=['--prepare',...pairs.flatMap((key,i)=>[key,path.join(owner,String(i))])];
  assert.equal(Object.keys(prepareOptions(args)).length,7);
  assert.throws(()=>prepareOptions(args.slice(0,-2)),/PREPARE_CLI/);
  const duplicate=[...args];duplicate[3]='--baseline';assert.throws(()=>prepareOptions(duplicate),/PREPARE_CLI/);
  const relative=[...args];relative[2]='relative';assert.throws(()=>prepareOptions(relative),/PREPARE_ABSOLUTE/);
  assert.throws(()=>prepareOptions([...args,'--mode','timing']),/PREPARE_CLI/);
}));

test('UNIT provided successful build records preserve exact bytes and reject malformed or failed inputs', () => {
  const log=Buffer.from('Project format check PASS (21 definitions).\r\n'),exit=Buffer.from('0\r\n');
  assert.equal(validateBuildRecord(log,exit),true);
  for(const value of [Buffer.from('1'),Buffer.from('0\n1'),Buffer.from([0xff]),Buffer.from('0'.repeat(65))])
    assert.throws(()=>validateBuildRecord(log,value),/BUILD/);
  for(const value of [Buffer.from('arbitrary PASS'),Buffer.from([0xff]),Buffer.concat([Buffer.from([239,187,191]),log]),Buffer.alloc(4194305)])
    assert.throws(()=>validateBuildRecord(value,exit),/BUILD/);
  assert.equal(log.toString(),'Project format check PASS (21 definitions).\r\n');
});

test('UNIT bounded SDK membership reads files only, including complete dependency originals', () => metadataFixture(({owner}) => {
  const root=path.join(owner,'input');fs.mkdirSync(root);
  const put=(name,body)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  for(const name of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json'])put(name,'{}');
  for(const name of ['contracts','runtime','engine']) {
    put('packages/'+name+'/package.json',JSON.stringify({name:'@egret/'+name,...(name==='engine'?{dependencies:{'robust-predicates':'3.0.3'}}:{})}));
    put('packages/'+name+'/tsconfig.json','{}');put('packages/'+name+'/src/index.ts','throw Error("MUST NOT EXECUTE");');
    put('packages/'+name+'/dist/index.js','throw Error("MUST NOT EXECUTE");');put('packages/'+name+'/dist/index.d.ts','export {};');
  }
  put('packages/engine/rendering/index.ts','');put('packages/engine/web/index.ts','');
  put('packages/engine/node_modules/robust-predicates/package.json',JSON.stringify({name:'robust-predicates',version:'3.0.3',exports:'./index.js'}));
  put('packages/engine/node_modules/robust-predicates/index.js','throw Error("MUST NOT EXECUTE");');
  put('packages/engine/node_modules/robust-predicates/LICENSE','upstream original');
  const before=collectSnapshotInputs(root);assert.equal(before.members.length,25);
  assert.equal(before.members.filter(row=>row.category==='dependency-original').length,3);
  put('packages/engine/node_modules/robust-predicates/README.md','raw upstream');
  const after=collectSnapshotInputs(root);assert.equal(after.members.length,26);
  assert.ok(after.members.some(row=>row.target.endsWith('/README.md')));
  const saved=after.members.find(row=>row.target==='packages/runtime/src/index.ts');
  put('packages/runtime/src/index.ts','changed source');assert.throws(()=>readPinned(saved.owner,saved),/PIN_CHANGED/);
  const restoredPackage=fs.readFileSync(path.join(root,'packages/contracts/package.json'));
  fs.unlinkSync(path.join(root,'packages/contracts/package.json'));assert.throws(()=>collectSnapshotInputs(root));
  put('packages/contracts/package.json',restoredPackage);
  const alias=path.join(root,'packages/runtime/src/alias'),target=path.join(owner,'alias-target');fs.mkdirSync(target);
  fs.symlinkSync(target,alias,'junction');assert.throws(()=>collectSnapshotInputs(root),/SNAPSHOT_MEMBER_ALIAS/);fs.unlinkSync(alias);
  put('packages/engine/node_modules/robust-predicates/package.json',JSON.stringify({name:'robust-predicates',version:'3.0.4',exports:'./index.js'}));
  assert.throws(()=>collectSnapshotInputs(root),/DEPENDENCY/);
}));

test('UNIT a completed pair cannot qualify an unfinished batch environment', () => {
  const schedule=buildTrialSchedule('timing');
  const partial={mode:'timing',status:'INCOMPLETE',runs:schedule.slice(0,2).map(trial=>({trial,status:'PASS_TIMING'})),comparisons:[{environment:'PASS'}]};
  assert.equal(publicSummary(partial).environmentQualification,'INCOMPLETE');
  const complete={...partial,status:'PASS_TIMING',runs:schedule.map(trial=>({trial,status:'PASS_TIMING'})),comparisons:Array.from({length:15},()=>({environment:'PASS'}))};
  assert.equal(publicSummary(complete).environmentQualification,'PASS');
  complete.runs[29].status='INCOMPLETE';assert.equal(publicSummary(complete).environmentQualification,'INCOMPLETE');
});


function primingMetadata() {
  const state=(serial,frames)=>({state:'active',lastSerial:serial,firstFailure:null,callbackFailureCount:0,
    pending:{frames,upload:frames*150032,readback:0,geometry:frames*280}});
  return {priming:{startedUtcMs:1000,finishedUtcMs:1020,idleStartedUtcMs:1010,afterIdle:state(2,0),frames:[
    {ordinal:0,frameId:1,stepBefore:0,stepAfter:0,startedUtcMs:1000,finishedUtcMs:1005,before:state(0,0),after:state(1,1)},
    {ordinal:1,frameId:2,stepBefore:0,stepAfter:0,startedUtcMs:1005,finishedUtcMs:1010,before:state(1,1),after:state(2,2)}]},
    windows:[{label:'warm',count:10,firstFrameId:3,observations:Array.from({length:4},(_,ordinal)=>({ordinal,frameId:ordinal+3,
      rafTimestamp:100+ordinal*16,startedUtcMs:1021+ordinal*16,finishedUtcMs:1025+ordinal*16,
      before:state(ordinal+2,ordinal%2),after:state(ordinal+3,ordinal%2+1),failure:null}))}]};
}

test('UNIT priming receipt requires two base-state submissions, exact serials and drained ownership', () => {
  const valid=primingMetadata();assert.equal(validatePrimingObservation(valid),valid.priming);
  for(const change of [
    value=>value.priming.frames.pop(),value=>value.priming.frames.push(value.priming.frames[0]),
    value=>value.priming.frames[1].frameId=3,value=>value.priming.frames[0].stepAfter=1,
    value=>value.priming.frames[1].before.lastSerial=0,value=>value.priming.frames[1].after.pending.frames=1,
    value=>value.priming.afterIdle.pending.upload=1,value=>value.priming.afterIdle.pending.geometry=1,
    value=>value.priming.afterIdle.firstFailure={code:'fault'},value=>value.priming.afterIdle.callbackFailureCount=1,
    value=>value.priming.idleStartedUtcMs=1009,value=>value.priming.finishedUtcMs=1009,
    value=>value.windows[0].firstFrameId=1
  ]) {const altered=structuredClone(valid);change(altered);assert.throws(()=>validatePrimingObservation(altered),/PRIMING/);}
});

test('UNIT only the first four warm attempts form the observation receipt', () => {
  const valid=primingMetadata();
  for(const change of [
    value=>value.windows[0].observations.pop(),value=>value.windows[0].observations.push(value.windows[0].observations[0]),
    value=>value.windows[0].observations[1].ordinal=0,value=>value.windows[0].observations[2].frameId=9,
    value=>value.windows[0].observations[3].after.pending.frames=0,value=>value.windows[0].observations[1].failure={code:'WEBGPU_BACKPRESSURE'},
    value=>value.windows[0].observations[0].startedUtcMs=1019,value=>value.windows[0].observations[2].rafTimestamp=100
  ]) {const altered=structuredClone(valid);change(altered);assert.throws(()=>validatePrimingObservation(altered),/WARM_OBSERVATION/);}
  const short=structuredClone(valid);short.windows[0].count=2;short.windows[0].observations.length=2;
  assert.equal(validatePrimingObservation(short),short.priming);
});
