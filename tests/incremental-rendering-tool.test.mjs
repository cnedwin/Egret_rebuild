// SPDX-License-Identifier: Apache-2.0
// Finite metadata-only tool UNIT checks. No SDK import, browser, build or timing run.
import test from 'node:test';
import * as protocol from '../tools/verify-incremental-rendering.mjs';
import * as workloadFixture from '../tools/incremental-rendering/workload.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {runInNewContext} from 'node:vm';
import {collectPublicGraph,sourceCounterpart,LIMITS} from '../tools/textured-webgpu/native-files.mjs';
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
    comparisonEligible:true,admittedFrames:2,wallGapCoverage:{p95:16,p99:32},
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
  const field='  "schema": "egret.incremental-native-recipe/6",';
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

function capacityMetadata(entries, duration = 60000, requestedAt = 90) {
  const names = ['index','rafTimestamp','entry','decision','pending','ordinal','frameId','updateStart','updateEnd','captureStart','captureEnd','renderStart','renderEnd','hostEnter','hostExit','hostCalls','hostFrameId','exit','flags'];
  const columns = Object.fromEntries(names.map(name => [name, []]));
  const samples = Object.fromEntries(['ordinal','rafTimestamp','updateStart','updateEnd','renderStart','renderEnd','flags'].map(name => [name, []]));
  let admitted = 0;
  for (const [index, spec] of entries.entries()) {
    const [entry, decision, engine = .2] = spec, isFrame = decision === 1;
    const row = { index, entry, rafTimestamp: entry - .01, decision, pending: decision === 2 ? 2 : 0,
      ordinal: isFrame ? admitted : -1, frameId: isFrame ? admitted + 3 : -1, flags: 3,
      updateStart: isFrame ? entry + .1 : NaN, updateEnd: isFrame ? entry + .2 : NaN,
      captureStart: NaN, captureEnd: NaN, hostEnter: NaN, hostExit: NaN, hostCalls: 0, hostFrameId: -1, renderStart: isFrame ? entry + .3 : NaN,
      renderEnd: isFrame ? entry + .3 + engine : NaN, exit: entry + (isFrame ? .5 + engine : .005) };
    for (const name of names) columns[name].push(row[name]);
    if (isFrame) { for (const name of Object.keys(samples)) samples[name].push(row[name]); admitted++; }
  }
  return { observation: { requestedAt, start: entries[0][0], end: entries.at(-1)[0], durationMs: duration, length: entries.length, columns }, samples, admitted, boundaryRaf: entries.at(-1)[0] - .01 };
}
function summarizeCapacity(fixture) {
  assert.equal(typeof protocol.summarizeCapacityWindow, 'function');
  return protocol.summarizeCapacityWindow(fixture.observation, fixture.samples, fixture.admitted, fixture.boundaryRaf);
}
test('UNIT recipe 6 keeps capacity-paced/1 and the fixed thirty timing plus six diagnostic trials', () => metadataFixture(({recipe}) => {
  assert.equal(recipe.schema, 'egret.incremental-native-recipe/6');
  assert.equal(recipe.fixed.pacing, 'capacity-paced/1'); assert.equal(recipe.fixed.maxPendingFrames, 2);
  assert.equal(recipe.fixed.hostObservation, 'engine-host-span/1');
  assert.throws(()=>validateRecipe({...recipe,schema:'egret.incremental-native-recipe/5'}),/RECIPE_FIXED/);
  const unobserved=structuredClone(recipe);delete unobserved.fixed.hostObservation;assert.throws(()=>validateRecipe(unobserved),/RECIPE_FIXED/);
  assert.equal(recipe.schedules.timing.length + recipe.schedules.diagnostic.length, 36);
  assert.deepEqual(recipe.browser, { channel: 'msedge' });
}));
test('UNIT gap coverage weights wall time, keeps zero spans and never rounds performance thresholds', () => {
  assert.equal(typeof protocol.weightedGapQuantile, 'function');
  const gaps = [0, ...Array(99).fill(16.7), 58346.7];
  assert.equal(nearestRank(gaps, .95), 16.7); assert.equal(nearestRank(gaps, .99), 16.7);
  assert.equal(protocol.weightedGapQuantile(gaps, 60000, .95), 58346.7);
  assert.equal(protocol.weightedGapQuantile(gaps, 60000, .99), 58346.7);
  for (const bad of [[-1, 2], [NaN], [Infinity], [1]]) assert.throws(() => protocol.weightedGapQuantile(bad, 60000, .95));
  const metrics = { admittedFrames: 2, intervals: { p95: 16.7, p99: 33.4 }, engine: { p95: 8 }, wallGapCoverage: { p95: 16.7, p99: 33.4 } };
  assert.deepEqual(protocol.timingBudgets(metrics), { cadence: true, wallGapCoverage: true, engineCpu: true });
  assert.equal(protocol.timingBudgets({ ...metrics, wallGapCoverage: { p95: 16.7000000001, p99: 33.4 } }).wallGapCoverage, false);
});
test('UNIT complete callback window retains leading interior terminal stalls and request/overrun boundaries', () => {
  const value = summarizeCapacity(capacityMetadata([[100,2],[200,1],[300,2],[400,1],[60200,3]]));
  assert.deepEqual(value.wallGapCoverage.gaps, [100,200,59800]);
  assert.equal(value.window.observedMs, 60100); assert.equal(value.window.overrunMs, 100); assert.equal(value.window.requestDelayMs, 10);
  assert.equal(value.wallGapCoverage.p95, 59800); assert.equal(value.wallGapCoverage.p99, 59800);
  assert.equal(value.intervals.p95, 200); assert.equal(value.admittedFrames, 2);
});
test('UNIT zero/one admission and empty CPU cohorts remain unavailable without invented zero timing', () => {
  const zero = summarizeCapacity(capacityMetadata([[100,2],[60100,3]]));
  assert.deepEqual(zero.wallGapCoverage.gaps, [60000]); assert.equal(zero.engine, null); assert.equal(zero.intervals, null);
  assert.equal(zero.callbackCpu.admitted, null); assert.equal(zero.comparisonEligible, false);
  const one = summarizeCapacity(capacityMetadata([[100,1],[60100,3]]));
  assert.deepEqual(one.wallGapCoverage.gaps, [0,60000]); assert.equal(one.intervals, null);
  assert.equal(one.callbackCpu.stalled, null); assert.equal(one.comparisonEligible, false);
});
test('UNIT cheap stalled callbacks never dilute admitted engine CPU', () => {
  const value = summarizeCapacity(capacityMetadata([[100,1,10],...Array.from({length:20},(_,i)=>[116+i,2]),[150,1,10],[60100,3]]));
  assert.equal(value.engine.count, 2); assert.equal(value.engine.p95, 10);
  assert.equal(value.callbackCpu.stalled.count, 20); assert.ok(value.callbackCpu.stalled.p95 < .01);
  assert.ok(value.callbackCpu.admitted.p95 >= 10); assert.equal(value.callbackCpu.closing.count, 1);
});
test('UNIT missing unordered nonfinite or invalid callback metadata fails integrity', () => {
  const base = () => capacityMetadata([[100,1],[116,2],[132,1],[60100,3]]);
  assert.equal(summarizeCapacity(base()).executionIntegrity,'COMPLETE');
  for (const mutate of [
    f=>f.observation.columns.index[1]=0, f=>f.observation.columns.entry[1]=99,
    f=>f.observation.columns.entry[1]=NaN, f=>f.observation.columns.pending[1]=3,
    f=>f.observation.columns.frameId[2]=99, f=>f.observation.columns.decision[3]=2,
    f=>f.observation.columns.flags[1]=1, f=>f.observation.columns.exit.pop(),
    f=>f.observation.length=65537, f=>f.admitted++, f=>f.observation.end=60101,
  ]) { const fixture=base(); mutate(fixture); assert.throws(()=>summarizeCapacity(fixture)); }
});
test('UNIT capacity decision preserves cap two and rejects failure instead of retrying', () => {
  assert.equal(typeof workloadFixture.capacityDecision, 'function');
  const state = pendingFrames => ({ state:'active', pendingFrames, firstFailure:null, callbackFailureCount:0 });
  for (const count of [0,1]) assert.equal(workloadFixture.capacityDecision(state(count),100,100,60000),1);
  assert.equal(workloadFixture.capacityDecision(state(2),100,100,60000),2);
  assert.equal(workloadFixture.capacityDecision(state(2),60100,100,60000),3);
  for (const value of [state(-1),state(3),state(.5),{...state(0),state:'failed'},{...state(0),firstFailure:{}},{...state(0),callbackFailureCount:1}])
    assert.throws(()=>workloadFixture.capacityDecision(value,100,100,60000));
});
test('UNIT callback storage refuses missing or overwritten rows and finite capacity overflow', () => {
  assert.equal(typeof workloadFixture.createCallbackStore, 'function');
  const store=workloadFixture.createCallbackStore(), row=capacityMetadata([[100,2],[60100,3]]).observation.columns;
  const item=Object.fromEntries(Object.keys(row).map(name=>[name,row[name][0]]));
  assert.equal(store.append(item),0); store.finish(0,100.01); assert.equal(store.length,1);
  assert.throws(()=>store.finish(0,100.02));
  for(let index=1;index<65536;index++){store.append({...item,index});store.finish(index,100.01);}
  assert.throws(()=>store.append({...item,index:65536})); assert.equal(store.length,65536);
});
test('UNIT ordinary budget misses and zero comparison denominators do not discard fixed trial rows', () => {
  const rows=buildTrialSchedule('timing').map(trial=>({trial,status:trial.role==='baseline'?'FAIL_TIMING_TARGET':'PASS_TIMING',metrics:{
    admittedFrames:2,comparisonEligible:true,updateThroughRender:{p95:trial.role==='baseline'?20:21},engine:{p95:trial.role==='baseline'?12:13},
    intervals:{p95:20,p99:40},wallGapCoverage:{p95:20,p99:40}
  }}));
  const value=aggregateTiming(rows); assert.equal(value.fullDirtyRatio,1.05); assert.equal(value.fullDirtyRatioAccepted,true);
  assert.equal(value.candidateCadenceAccepted,false); assert.equal(value.candidateWallCoverageAccepted,false);
  const zeros=structuredClone(rows); for(const row of zeros)row.metrics.updateThroughRender.p95=0;
  assert.equal(aggregateTiming(zeros).fullDirtyRatio,null);
  const insufficient=structuredClone(rows); insufficient[0].status='INCOMPLETE_TIMING_COMPARISON'; insufficient[0].metrics.intervals=null; insufficient[0].metrics.comparisonEligible=false;
  assert.equal(aggregateTiming(insufficient).medians.static.baseline.intervalP95,null);
});
test('UNIT recipe selects one raw executable identity for both roles and refuses changed executable bytes', () => metadataFixture(({owner,recipe}) => {
  const file=path.join(owner,'browser.exe');fs.writeFileSync(file,Buffer.from([0,13,10,255]));
  const selected=createFixedRecipe(recipe.baseline,recipe.candidate,file);
  assert.equal(selected.browser.executable.path,fs.realpathSync(file)); assert.equal(selected.browser.executable.bytes,4);
  assert.equal(validateRecipe(selected),selected); protocol.verifyRecipeBrowser(selected.browser);
  fs.writeFileSync(file,Buffer.from([0,10,13,255])); assert.throws(()=>protocol.verifyRecipeBrowser(selected.browser));
  const mixed=structuredClone(selected);mixed.browser.channel='msedge';assert.throws(()=>validateRecipe(mixed));
  const role=structuredClone(selected);role.candidate.browser=recipe.browser;assert.throws(()=>validateRecipe(role));
}));

// Exercise the actual serialized phase with explicit metadata ports. These are
// scheduler controls, never browser/SDK observations or invented timing evidence.
function phaseControl({renderFailure=false,nativeFailure=false,mode='timing'}={}) {
  const source=fs.readFileSync(new URL('../tools/verify-incremental-rendering.mjs',import.meta.url),'utf8');
  const start=source.indexOf('      async function phase(label, duration, measured) {'),end=source.indexOf("      await phase('warm',",start);
  assert.ok(start>0&&end>start);
  const scheduled=new Map(),report={windows:[]},sampleState={callbackStores:[]},samples=workloadFixture.createSampleStore();
  let clock=90,pending=0,serial=2,advances=0,renders=0,captures=0,requestId=0;
  const state=()=>({state:nativeFailure?'failed':'active',pendingFrames:pending,firstFailure:null,callbackFailureCount:0});
  const ports={fixture:workloadFixture,report,sampleState,samples,mode,captureStart:mode==='diagnostic'?new Float64Array(65536):null,captureEnd:mode==='diagnostic'?new Float64Array(65536):null,hostEnter:mode==='timing'?new Float64Array(65536):null,hostExit:mode==='timing'?new Float64Array(65536):null,stopPhase:undefined,
    foreground:()=>3,deadline:10000000,performance:{now:()=>{const value=clock;clock+=.001;return value;}},Date:{now:()=>100000+clock},
    surfaceBoundary:()=>({}),status:()=>({pending:{frames:pending}}),observe:value=>value,bounded:async value=>value,errorRow:error=>({message:error.message}),
    host:{surface:{},texturedFrameProfile:'metadata-only',close(){return Promise.resolve();},setTimeout(){return ()=>{};},getStatus:state,renderTexturedFrame(){renders++;if(renderFailure)throw Error('OWNED_REFUSAL');}},
    workload:{advance(){advances++;},capture(){captures++;return {frameId:++serial};},render(){const frame={frameId:++serial};ports.hostTiming.host.renderTexturedFrame(frame);return frame;}},
    requestAnimationFrame(callback){scheduled.set(++requestId,callback);return requestId;},cancelAnimationFrame(id){scheduled.delete(id);}};
  assert.equal(typeof workloadFixture.createHostTimingDelegate,'function');
  ports.hostTiming=mode==='timing'?workloadFixture.createHostTimingDelegate(ports.host,ports.performance.now):undefined;
  const phase=runInNewContext('('+source.slice(start,end).trim()+')',ports);
  return {report,sampleState,samples,hostColumns:mode==='timing'?{hostEnter:ports.hostEnter,hostExit:ports.hostExit}:{},start:(label='measure',duration=60000,measured=true)=>phase(label,duration,measured),get advances(){return advances;},get renders(){return renders;},get captures(){return captures;},get queued(){return scheduled.size;},
    tick(entry,nextPending){assert.equal(scheduled.size,1);const [id,callback]=scheduled.entries().next().value;scheduled.delete(id);pending=nextPending;clock=entry;callback(entry-.1);}};
}
test('UNIT serialized phase waits for future RAF, advances only admitted work, and retains closing callback', async()=>{
  const control=phaseControl(),done=control.start();assert.equal(control.queued,1);
  control.tick(100,2);assert.equal(control.advances,0);assert.equal(control.queued,1);
  control.tick(116,0);control.tick(132,1);assert.equal(control.advances,2);assert.equal(control.renders,2);
  control.tick(148,2);assert.equal(control.advances,2);control.tick(60100,2);await done;
  assert.equal(control.queued,0);assert.equal(control.samples.length,2);
  const {store,row}=control.sampleState.callbackStores[0];assert.deepEqual(Array.from(store.columns.decision.slice(0,store.length)),[2,1,1,2,3]);
  assert.ok(Array.from(store.columns.exit.slice(0,store.length)).every(Number.isFinite));
  const columns=Object.fromEntries(Object.entries(store.columns).map(([key,value])=>[key,Array.from(value.slice(0,store.length))]));
  const samples=Object.fromEntries(Object.entries({...control.samples.columns,...control.hostColumns}).map(([key,value])=>[key,Array.from(value.slice(0,control.samples.length))]));
  const metrics=protocol.summarizeCapacityWindow({requestedAt:row.requestedAt,start:row.startEntry,end:row.endEntry,durationMs:row.durationMs,length:store.length,columns},samples,row.count,row.boundaryRaf);
  assert.equal(metrics.stalledCallbacks,2);assert.deepEqual(metrics.wallGapCoverage.gaps,[16,16,59968]);
});
test('UNIT serialized phase stops on native failure or submission refusal without retry or fabricated success',async()=>{
  for(const option of [{nativeFailure:true},{renderFailure:true}]){
    const control=phaseControl(option),done=control.start();control.tick(100,0);
    await assert.rejects(done,option.nativeFailure?/CAPACITY_STATE/:/OWNED_REFUSAL/);
    assert.equal(control.queued,0);assert.equal(control.samples.length,0);
    assert.equal(control.advances,option.nativeFailure?0:1);assert.equal(control.renders,option.nativeFailure?0:1);
    assert.equal(control.sampleState.callbackStores[0].store.columns.decision[0],4);
    assert.ok(control.report.windows[0].failedAttempt);
  }
});
test('UNIT prepare grammar preserves original inputs and strictly isolates optional executable',()=>metadataFixture(({owner})=>{
  const keys=['--baseline','--candidate','--baseline-build-log','--baseline-build-exit','--candidate-build-log','--candidate-build-exit','--output'];
  const args=['--prepare',...keys.flatMap((key,index)=>[key,path.join(owner,String(index))])],exe=path.join(owner,'browser.exe');
  assert.equal(prepareOptions([...args,'--executable',exe])['--executable'],exe);
  for(const value of ['relative.exe','C:browser.exe','/browser.exe'])assert.throws(()=>prepareOptions([...args,'--executable',value]));
  assert.throws(()=>prepareOptions([...args,'--channel','msedge']));
  const mixed=[...args,'--executable',exe];mixed[1]='--executable';assert.throws(()=>prepareOptions(mixed));
  assert.throws(()=>prepareOptions([...args,'--executable',exe,'--executable',exe]));
}));
test('UNIT recipe reread refuses browser identity changed after recipe creation',()=>metadataFixture(({owner,recipe,file})=>{
  const exe=path.join(owner,'browser.exe');fs.writeFileSync(exe,'first bytes');
  fs.writeFileSync(file,canonicalTextBytes(JSON.stringify(createFixedRecipe(recipe.baseline,recipe.candidate,exe),null,2)));
  assert.equal(loadRecipe(file).recipe.browser.executable.bytes,11);
  fs.writeFileSync(exe,'other bytes');assert.throws(()=>loadRecipe(file),/RECIPE_BROWSER_CHANGED/);
}));
test('UNIT M1.2 recipe 5 literal profile admits 132 complete modules but preserves default cap and rejects 133',async()=>{
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'egret-native-graph-meta-'));
  const put=(name,body)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  const module=(name,body)=>{put(name,body+'\nthrow Error("METADATA_ONLY_NEVER_EXECUTE");');const source=sourceCounterpart(name);if(source)put(source,'// metadata-only source');};
  try{
    fs.mkdirSync(path.join(root,'packages/engine/node_modules/robust-predicates'),{recursive:true});
    module('packages/engine/dist/index.js',"export * from './Engine.js';");
    module('packages/engine/dist/Engine.js',"import './internal/texturedFrameState.js';import './chain/m0.js';");
    module('packages/engine/dist/internal/texturedFrameState.js','');
    module('packages/engine/dist/web/webgpu.js',"export * from './WebGPUHost.js';");
    module('packages/engine/dist/web/WebGPUHost.js',"import '#egret-textured-frame-state';");
    for(let index=0;index<127;index++)module('packages/engine/dist/chain/m'+index+'.js',index<126?"import './m"+(index+1)+".js';":'');
    assert.equal(LIMITS.modules,128);await assert.rejects(collectPublicGraph(root,()=>{}),/GRAPH_MODULE_COUNT/);
    const graph=await collectPublicGraph(root,()=>{},'m12-recipe5');assert.equal(graph.modules.size,132);
    assert.ok([...graph.modules.values()].every(row=>row.sha256.length===64&&Array.isArray(row.edges)));
    await assert.rejects(collectPublicGraph(root,()=>{},'unknown'),/GRAPH_SOURCE_PROFILE/);
    module('packages/engine/dist/chain/m126.js',"import './m127.js';");module('packages/engine/dist/chain/m127.js','');
    await assert.rejects(collectPublicGraph(root,()=>{},'m12-recipe5'),/GRAPH_MODULE_COUNT/);
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),parent);assert.ok(path.basename(root).startsWith('egret-native-graph-meta-'));fs.rmSync(root,{recursive:true});}
});

test('UNIT serialized artifact binding retains raw callback columns and empty admitted cohorts only in timing modes',()=>{
  const source=fs.readFileSync(new URL('../tools/verify-incremental-rendering.mjs',import.meta.url),'utf8');
  const start=source.indexOf('      const validCounts ='),end=source.indexOf('      const pin = await artifacts.save(row.name, raw);',start);assert.ok(start>0&&end>start);
  const validate=runInNewContext('(row,args)=>{'+source.slice(start,end)+'return raw;}',{Buffer,requireValue(value,reason){if(!value)throw Error(reason);}});
  const row=(name,format='float64-le',base64=Buffer.alloc(8).toString('base64'))=>({name,format,base64});
  for(const mode of ['diagnostic','timing']){
    for(const phase of ['warm','measure'])for(const column of workloadFixture.CALLBACK_COLUMNS)
      assert.equal(validate(row(phase+'-callbacks-'+column+'.f64'),{'--mode':mode}).length,8);
    assert.equal(validate(row('samples-ordinal.f64','float64-le',''),{'--mode':mode}).length,0);
    assert.equal(validate(row('samples-flags.u8','uint8',''),{'--mode':mode}).length,0);
    assert.throws(()=>validate(row('timer-resolution.f64','float64-le',''),{'--mode':mode}));
    assert.throws(()=>validate(row('measure-callbacks-unknown.f64'),{'--mode':mode}));
    assert.throws(()=>validate(row('measure-callbacks-entry.f64','uint8'),{'--mode':mode}));
  }
  assert.throws(()=>validate(row('samples-captureStart.f64'),{'--mode':'timing'}));
  for(const name of ['hostEnter','hostExit']){assert.equal(validate(row('samples-'+name+'.f64'),{'--mode':'timing'}).length,8);assert.throws(()=>validate(row('samples-'+name+'.f64'),{'--mode':'diagnostic'}));}
  assert.throws(()=>validate(row('warm-callbacks-entry.f64'),{'--mode':'counts'}));
  assert.throws(()=>validate(row('measure-callbacks-entry.f64','float64-le','AA=='),{'--mode':'timing'}));
});
test('UNIT public budget rows preserve each trial miss and unavailable result without private fields',()=>{
  const budgets={cadence:false,wallGapCoverage:true,engineCpu:null,private:'UNPUBLISHED'};
  const report={mode:'timing',status:'FAIL_TIMING_TARGET',budgets,runs:[{trial:buildTrialSchedule('timing')[0],status:'FAIL_TIMING_TARGET',executionComplete:true,budgets}]};
  const result=publicSummary(report);assert.deepEqual(result.budgets,{cadence:false,wallGapCoverage:true,engineCpu:null});
  assert.deepEqual(result.runs[0].budgets,result.budgets);assert.equal(result.runs[0].executionComplete,true);
  assert.equal(JSON.stringify(result).includes('UNPUBLISHED'),false);
  const complete={...report,executionStatus:'COMPLETE',runs:buildTrialSchedule('timing').map(trial=>({trial,status:'FAIL_TIMING_TARGET',executionComplete:true,budgets})),comparisons:Array.from({length:15},()=>({environment:'PASS'}))};
  assert.equal(publicSummary(complete).runtimeExecution,'PASS');
  complete.runs[29].executionComplete=false;assert.equal(publicSummary(complete).runtimeExecution,'INCOMPLETE');
});

test('UNIT actual batch gate continues fixed budget misses but stops incomplete process environment and cleanup',()=>{
  const source=fs.readFileSync(new URL('../tools/verify-incremental-rendering.mjs',import.meta.url),'utf8');
  const start=source.indexOf('      if(processResult.code===1'),end=source.indexOf('      if(result.runs.length%2===0)',start);assert.ok(start>0&&end>start);
  // Use the gate's real parsing path with a per-call metadata report port.
  const run=(details,processResult={code:1,signal:null,hard:false,failure:null})=>{
    const callback=runInNewContext('(processResult,row,mode)=>{'+source.slice(start,end)+'return row;}',{
      COMPLETED_TIMING_STATUSES:['PASS_TIMING','FAIL_TIMING_TARGET','INCOMPLETE_TIMING_COMPARISON'],descriptor:{output:'metadata-only'},
      fingerprintFile:()=>({path:'report.json',bytes:1,sha256:'0'.repeat(64)}),readPinned:()=>JSON.stringify(details),
      requireValue(value,reason){if(!value)throw Error(reason);},requireObservation(value,reason){if(!value)throw Error(reason);}
    });
    return callback(processResult,{status:details.status},'timing');
  };
  const valid={status:'FAIL_TIMING_TARGET',runtimeExecution:'PASS',environmentQualification:'PASS',lifecycle:{cooperativeAPIClosure:true},budgets:{cadence:false,wallGapCoverage:false,engineCpu:true}};
  const all=buildTrialSchedule('timing').map((trial,index)=>({trial,...run({...valid,status:index%2?'INCOMPLETE_TIMING_COMPARISON':'FAIL_TIMING_TARGET'})}));
  assert.equal(all.length,30);assert.ok(all.every(row=>row.executionComplete));
  for(const change of [value=>value.runtimeExecution='INCOMPLETE',value=>value.environmentQualification='INCOMPLETE',value=>value.lifecycle.cooperativeAPIClosure=false,value=>value.status='INCOMPLETE']){
    const details=structuredClone(valid);change(details);assert.throws(()=>run(details));
  }
  for(const processResult of [{code:2,signal:null,hard:false,failure:null},{code:1,signal:'SIGTERM',hard:false,failure:null},{code:1,signal:null,hard:true,failure:null},{code:1,signal:null,hard:false,failure:{}}])assert.throws(()=>run(valid,processResult));
});

test('UNIT diagnostic serialized phase retains fresh capture and Host components in a separate cohort',async()=>{
  const control=phaseControl({mode:'diagnostic'}),done=control.start();control.tick(100,2);control.tick(116,0);control.tick(132,1);control.tick(60100,0);await done;
  assert.equal(control.advances,2);assert.equal(control.captures,2);assert.equal(control.renders,2);
  const {store,row}=control.sampleState.callbackStores[0],columns=Object.fromEntries(Object.entries(store.columns).map(([key,value])=>[key,Array.from(value.slice(0,store.length))]));
  const indices=columns.decision.flatMap((decision,index)=>decision===1?[index]:[]);
  const samples=Object.fromEntries(['ordinal','rafTimestamp','updateStart','updateEnd','captureStart','captureEnd','renderStart','renderEnd','flags'].map(name=>[name,indices.map(index=>columns[name][index])]));
  const result=protocol.summarizeCapacityWindow({requestedAt:row.requestedAt,start:row.startEntry,end:row.endEntry,durationMs:row.durationMs,length:store.length,columns},samples,row.count,row.boundaryRaf);
  assert.equal(result.capture.count,2);assert.equal(result.host.count,2);assert.equal(result.callbackCpu.stalled.count,1);
});

test('UNIT recipe pins the scoped graph helper and refuses its drift until exact restoration',()=>metadataFixture(({recipe,file})=>{
  const relative='tools/textured-webgpu/native-files.mjs',pin=recipe.tools.find(row=>row.path===relative);
  assert.ok(pin,'the scoped graph policy must be in the same strict raw tool pin set');
  assert.equal(recipe.tools.length,5);assert.deepEqual(recipe.tools.map(row=>row.path),recipe.tools.map(row=>row.path).sort());
  const helper=new URL('../'+relative,import.meta.url),before=fs.readFileSync(helper);
  assert.equal(loadRecipe(file).recipe.tools.length,5);
  try{fs.writeFileSync(helper,Buffer.concat([before,Buffer.from('\n// metadata-only drift control\n')]));assert.throws(()=>loadRecipe(file),/PIN_CHANGED:tools\/textured-webgpu\/native-files.mjs/);}
  finally{fs.writeFileSync(helper,before);}
  assert.equal(loadRecipe(file).recipe.tools.find(row=>row.path===relative).sha256,pin.sha256);
  const wrong=structuredClone(recipe);wrong.tools[3].path='tools/unknown-helper.mjs';assert.throws(()=>validateRecipe(wrong),/RECIPE_TOOL_MEMBERS/);
}));
test('UNIT preparation upper bound uses five nested timing Host p95 values without weakening the Engine budget',()=>{
  const rows=buildTrialSchedule('timing').map(trial=>({trial,status:'PASS_TIMING',metrics:{admittedFrames:2,comparisonEligible:true,
    updateThroughRender:{p95:8},engine:{p95:8},host:{p95:trial.role==='baseline'?3.5:[2,3,4,5,6][trial.round-1]},intervals:{p95:16.7,p99:33.4},wallGapCoverage:{p95:16.7,p99:33.4}}}));
  const result=aggregateTiming(rows);assert.equal(result.preparationUpperBoundSatisfied,true);
  for(const state of ['static','sparse','full'])for(const role of ['baseline','candidate'])assert.equal(result.preparationUpperBounds[state][role].satisfied,true);
  assert.equal(result.purePreparation,'UNMEASURED_IN_MAIN_WINDOW');
  const mixed=structuredClone(rows);for(const row of mixed.filter(row=>row.trial.state==='full'&&row.trial.role==='candidate'))row.metrics.host.p95=4.000000001;
  const altered=aggregateTiming(mixed);assert.equal(altered.preparationUpperBoundSatisfied,null);
  assert.equal(altered.preparationUpperBounds.full.candidate.satisfied,null);assert.equal(altered.candidateEngineAccepted,true);
  assert.equal(altered.fullDirtyRatioAccepted,result.fullDirtyRatioAccepted);
  mixed.find(row=>row.trial.state==='static'&&row.trial.role==='candidate').metrics.host=null;
  assert.equal(aggregateTiming(mixed).preparationUpperBounds.static.candidate.satisfied,null);
  const summary=publicSummary({mode:'timing',timing:result});assert.equal(summary.timing.preparationUpperBoundSatisfied,true);
  assert.equal(summary.timing.preparationUpperBounds.full.candidate.upperBoundMs,4);
  assert.equal(summary.timing.medians.full.candidate.hostP95,4);assert.equal(summary.timing.medians.full.candidate.engineP95,8);
  assert.match(summary.timing.preparationMeasurement,/Host/);
  assert.equal(result.hostObservation,'engine-host-span/1');
  const noHost=structuredClone(rows);for(const row of noHost){delete row.metrics.host;row.metrics.engine.p95=1;}
  assert.equal(aggregateTiming(noHost).preparationUpperBoundSatisfied,null,'Recipe 6 does not manufacture missing Host observations from Engine values');
});
test('UNIT package preparation admits only the exact existing manifest-resource alias owner and targets',()=>metadataFixture(({owner})=>{
  assert.equal(typeof protocol.publicEntriesFor,'function');
  const root=path.join(owner,'public-input'),put=(relative,body)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  const manifests={};for(const name of ['contracts','runtime','engine']){
    manifests[name]={name:'@egret/'+name,exports:{'.':{import:'./dist/index.js',types:'./dist/index.d.ts'}}};
    put('packages/'+name+'/dist/index.js','throw Error("METADATA_ONLY");');put('packages/'+name+'/dist/index.d.ts','export {};');
  }
  manifests.engine.imports={'#egret-manifest-resources':{import:'./dist/manifestResourceState.js',types:'./dist/manifestResourceState.d.ts'}};
  for(const ext of ['js','d.ts'])put('packages/engine/dist/manifestResourceState.'+ext,ext==='js'?'throw Error("METADATA_ONLY");':'export {};');
  const save=()=>{for(const [name,value]of Object.entries(manifests))put('packages/'+name+'/package.json',JSON.stringify(value));};save();
  assert.equal(protocol.publicEntriesFor(root).imports['#egret-manifest-resources'],'/packages/engine/dist/manifestResourceState.js');
  const original=structuredClone(manifests.engine.imports);
  for(const change of [value=>value['#unknown']={import:'./dist/index.js',types:'./dist/index.d.ts'},
    value=>value['#egret-manifest-resources'].import='./dist/index.js',value=>value['#egret-manifest-resources'].types='./dist/index.d.ts']){
    manifests.engine.imports=structuredClone(original);change(manifests.engine.imports);save();assert.throws(()=>protocol.publicEntriesFor(root),/PACKAGE_PRIVATE_ALIAS/);
  }
  manifests.engine.imports={};manifests.runtime.imports=original;save();assert.throws(()=>protocol.publicEntriesFor(root),/PACKAGE_PRIVATE_ALIAS/);
}));

// RAF and performance.now are separately sampled/coarsened observations. The
// native diagnostic retained this positive RAF offset without a CPU-clock reversal.
test('UNIT sample storage retains a native RAF offset without cross-clock ordering', () => {
  const samples=workloadFixture.createSampleStore();
  samples.append(0,35342.3,35342.200000047684,35342.200000047684,35345.60000002384,35349.90000003576,true,true);
  assert.equal(samples.length,1); assert.equal(samples.columns.rafTimestamp[0],35342.3);
  assert.equal(samples.columns.updateStart[0],35342.200000047684);
  assert.throws(()=>samples.append(1,35350.7,-1,0,1,2,true,true),/SAMPLE_INVALID/);
  assert.throws(()=>samples.append(1,35350.7,35350.6,35350.5,35351,35352,true,true),/SAMPLE_INVALID/);
  assert.throws(()=>samples.append(1,35342.3,35350.6,35350.6,35351,35352,true,true),/SAMPLE_INVALID/);
});
test('UNIT sample summaries preserve separate RAF cadence and monotonic CPU spans', () => {
  const columns={ordinal:[0,1],rafTimestamp:[10.3,26.3],updateStart:[10.2,26.2],updateEnd:[11,27],renderStart:[12,28],renderEnd:[15,33],flags:[3,3]};
  const before=structuredClone(columns),result=summarizeSamples(columns,2,42.3);
  assert.equal(result.intervals.p95,16);assert.equal(result.engine.p95,5);
  assert.equal(result.updateThroughRender.p95,33-26.2);assert.deepEqual(columns,before);
  assert.throws(()=>summarizeSamples({...columns,updateStart:[-1,26.2]},2,42.3),/SAMPLE_ORDER/);
  assert.throws(()=>summarizeSamples({...columns,renderEnd:[11,33]},2,42.3),/SAMPLE_ORDER/);
  assert.throws(()=>summarizeSamples({...columns,rafTimestamp:[26.3,10.3]},2,42.3),/SAMPLE_RAF/);
});
test('UNIT wall coverage is independent of the RAF offset and keeps same-clock ordering', () => {
  const fixture=capacityMetadata([[100,1],[116,2],[132,1],[60100,3]]);
  const before=summarizeCapacity(structuredClone(fixture));let sample=0;
  for(let i=0;i<fixture.observation.length;i++){
    const raf=fixture.observation.columns.entry[i]+.3;fixture.observation.columns.rafTimestamp[i]=raf;
    if(fixture.observation.columns.decision[i]===1)fixture.samples.rafTimestamp[sample++]=raf;
  }
  fixture.boundaryRaf=fixture.observation.columns.rafTimestamp.at(-1);
  const raw=structuredClone(fixture),after=summarizeCapacity(fixture);
  assert.deepEqual(after.wallGapCoverage,before.wallGapCoverage);assert.deepEqual(after.callbackCpu,before.callbackCpu);
  assert.equal(after.intervals.p95,fixture.samples.rafTimestamp[1]-fixture.samples.rafTimestamp[0]);assert.deepEqual(fixture,raw);
  const reversed=structuredClone(fixture);reversed.observation.columns.entry[1]=99;
  assert.throws(()=>summarizeCapacity(reversed),/CALLBACK_ORDER/);
  const negative=capacityMetadata([[0,1],[60000,3]],60000,0);negative.observation.columns.entry[0]=-.1;negative.observation.start=-.1;
  assert.throws(()=>summarizeCapacity(negative),/WINDOW|CALLBACK/);
});

// Public HostAdapter delegation controls use metadata-only ports, never an SDK or GPU.
test('UNIT timed public Host delegate preserves receiver, surface, frame, lifecycle returns and two-clock scope',()=>{
  assert.equal(typeof workloadFixture.createHostTimingDelegate,'function');
  const surface={},profile={},frame=Object.freeze({frameId:7}),startResult=Promise.resolve(),closeResult=Promise.resolve(),cancel=()=>{},callback=()=>{};
  const calls=[],host={surface,texturedFrameProfile:profile,
    start(){assert.equal(this,host);calls.push('start');return startResult;},stop(){assert.equal(this,host);calls.push('stop');},
    close(){assert.equal(this,host);calls.push('close');return closeResult;},setTimeout(fn,delay){assert.equal(this,host);assert.equal(fn,callback);assert.equal(delay,9);return cancel;},
    renderFrame(value){assert.equal(this,host);assert.equal(value,frame);calls.push('legacy');return undefined;},
    renderTexturedFrame(value){assert.equal(this,host);assert.equal(value,frame);calls.push('render');return undefined;}};
  let clocks=0;const observed=workloadFixture.createHostTimingDelegate(host,()=>++clocks+10);
  assert.equal(observed.host.surface,surface);assert.equal(observed.host.texturedFrameProfile,profile);
  assert.equal(observed.host.start(),startResult);assert.equal(observed.host.setTimeout(callback,9),cancel);
  observed.host.renderFrame(frame);observed.host.renderTexturedFrame(frame);assert.equal(clocks,0,'Untimed priming and reset forward without extra clocks');
  const row={hostEnter:NaN,hostExit:NaN,hostCalls:0,hostFrameId:-1};observed.begin(row);
  let rendered;try{assert.equal(observed.host.renderTexturedFrame(frame),undefined);rendered=frame;}finally{observed.end(rendered);}
  assert.deepEqual(row,{hostEnter:11,hostExit:12,hostCalls:1,hostFrameId:7});assert.equal(clocks,2);
  observed.host.stop();assert.equal(observed.host.close(),closeResult);assert.deepEqual(calls,['start','legacy','render','render','stop','close']);
  assert.equal(Object.isFrozen(observed.host),true);
});
test('UNIT timed Host delegate preserves original throws and clears observation before a later call',()=>{
  assert.equal(typeof workloadFixture.createHostTimingDelegate,'function');
  const original={failure:'original'},frame={frameId:3};let fail=true,clocks=0;
  const host={surface:{},texturedFrameProfile:'metadata',close(){return Promise.resolve();},setTimeout(){return ()=>{};},renderTexturedFrame(){if(fail)throw original;return undefined;}};
  const observed=workloadFixture.createHostTimingDelegate(host,()=>++clocks);
  const row=()=>({hostEnter:NaN,hostExit:NaN,hostCalls:0,hostFrameId:-1});
  const failed=row();observed.begin(failed);assert.throws(()=>{let rendered;try{observed.host.renderTexturedFrame(frame);rendered=frame;}finally{observed.end(rendered);}},cause=>cause===original);
  assert.equal(failed.hostCalls,1);assert.equal(failed.hostEnter,1);assert.equal(failed.hostExit,2);assert.equal(failed.hostFrameId,-1);
  fail=false;const next=row();observed.begin(next);observed.host.renderTexturedFrame(frame);observed.end(frame);assert.equal(next.hostFrameId,3);
  const absent=row();observed.begin(absent);assert.throws(()=>observed.end(frame),/HOST_CALL_COUNT/);
  const duplicate=row();observed.begin(duplicate);observed.host.renderTexturedFrame(frame);observed.host.renderTexturedFrame(frame);assert.throws(()=>observed.end(frame),/HOST_CALL_COUNT/);
  const mismatch=row();observed.begin(mismatch);observed.host.renderTexturedFrame(frame);assert.throws(()=>observed.end({frameId:3}),/HOST_FRAME_IDENTITY/);
  const restored=row();observed.begin(restored);observed.host.renderTexturedFrame(frame);observed.end(frame);assert.equal(restored.hostCalls,1);
  fail=true;const clockFailure=workloadFixture.createHostTimingDelegate(host,()=>{throw Error('OBSERVER_CLOCK');});clockFailure.begin(row());
  assert.throws(()=>{let rendered;try{clockFailure.host.renderTexturedFrame(frame);rendered=frame;}finally{clockFailure.end(rendered);}},cause=>cause===original,'Observation failure never masks a renderer failure');
  fail=false;clockFailure.begin(row());clockFailure.host.renderTexturedFrame(frame);assert.throws(()=>clockFailure.end(frame),/HOST_CLOCK/);
});
test('UNIT nested Host raw spans require exact single-call frame links and do not change Engine or wall cohorts',()=>{
  const fixture=capacityMetadata([[100,1,8],[116,2],[132,1,8],[60100,3]]),raw=fixture.observation.columns;
  fixture.samples.hostEnter=[];fixture.samples.hostExit=[];
  for(let index=0;index<raw.index.length;index++)if(raw.decision[index]===1){raw.hostEnter[index]=raw.renderStart[index]+1;raw.hostExit[index]=raw.hostEnter[index]+4;raw.hostCalls[index]=1;raw.hostFrameId[index]=raw.frameId[index];fixture.samples.hostEnter.push(raw.hostEnter[index]);fixture.samples.hostExit.push(raw.hostExit[index]);}
  const result=summarizeCapacity(fixture);assert.equal(result.engine.p95,8);assert.equal(result.host.p95,4);assert.equal(result.host.count,2);
  assert.equal(result.callbackCpu.stalled.count,1);assert.deepEqual(result.wallGapCoverage.gaps,[0,32,59968]);
  for(const change of [f=>f.observation.columns.hostCalls[0]=0,f=>f.observation.columns.hostCalls[0]=2,f=>f.observation.columns.hostFrameId[0]++,
    f=>f.observation.columns.hostExit[0]=NaN,f=>f.samples.hostEnter.pop(),f=>f.samples.hostExit[0]=f.samples.renderEnd[0]+1,
    f=>f.samples.hostEnter[0]=f.samples.renderStart[0]-1,f=>f.observation.columns.hostCalls[1]=1,f=>f.observation.columns.hostEnter[1]=116,
    f=>delete f.samples.hostExit]){const changed=structuredClone(fixture);change(changed);assert.throws(()=>summarizeCapacity(changed));}
  const diagnostic={...fixture.samples,captureStart:[100.21,132.21],captureEnd:[100.25,132.25]};assert.throws(()=>summarizeSamples(diagnostic,2,60100),/HOST|CAPTURE/);
});
test('UNIT serialized warm and measured callbacks retain the nested actual Host calls',async()=>{
  for(const [label,duration,measured]of [['warm',30000,false],['measure',60000,true]]){
    const control=phaseControl(),done=control.start(label,duration,measured);control.tick(100,2);control.tick(116,0);control.tick(132,1);control.tick(100+duration,0);await done;
    const {store}=control.sampleState.callbackStores[0],raw=store.columns;
    assert.deepEqual(Array.from(raw.hostCalls.slice(0,store.length)),[0,1,1,0]);
    assert.deepEqual(Array.from(raw.hostFrameId.slice(0,store.length)),[-1,3,4,-1]);
    for(const index of [1,2])assert.ok(raw.renderStart[index]<=raw.hostEnter[index]&&raw.hostEnter[index]<=raw.hostExit[index]&&raw.hostExit[index]<=raw.renderEnd[index]);
    for(const index of [0,3])assert.ok(Number.isNaN(raw.hostEnter[index])&&Number.isNaN(raw.hostExit[index]));
    assert.equal(control.samples.length,measured?2:0);assert.equal(control.renders,2);
    if(measured){assert.equal(control.hostColumns.hostEnter[0],raw.hostEnter[1]);assert.equal(control.hostColumns.hostExit[1],raw.hostExit[2]);}
  }
});
