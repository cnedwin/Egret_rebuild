import test from 'node:test';
import assert from 'node:assert/strict';
import {TextBudget} from '../packages/runtime/dist/text/budget.js';
import {EgretError} from '../packages/runtime/dist/EgretError.js';
import {
  createTextValueInvocation, closeTextValueInvocation, createTextValueFailure, takeTextValueFailure,
  snapshotTextRasterRequest, summarizeTextRasterRequest, createOwnedTextRasterRequest,
} from '../packages/runtime/dist/text/request.js';
import {
  createTextRasterPlanIssuer, closeTextRasterPlanIssuer, readIssuedTextRasterPlan, requireIssuedTextRasterPlan,
} from '../packages/runtime/dist/text/plan.js';

// Explicit private units under frozen T18/T19/T37-T42. No cache, provider,
// lease, cleanup or public quota behavior is inferred from scalar proposals.
const limits = Object.freeze({maxGenerations:64,maxPendingJobs:4,maxWaiters:128,maxCallerLeases:128,
  maxResidentEntries:32,maxMetadataBytes:2097152,maxLogicalImageBytes:16777216,maxPendingRasterBytes:8388608});
const requestInput = Object.freeze({text:'A',fontFamily:'Test',fontSize:16,fontWeight:400,fontStyle:'normal',
  lineHeight:10,locale:'und',direction:'ltr',density:1,fillColor:0xffffff});
const ink = Object.freeze({advance:8,hasInk:true,inkLeft:-1,inkTop:-4,inkRight:7,inkBottom:2});
const noInk = Object.freeze({advance:5,hasInk:false,inkLeft:0,inkTop:0,inkRight:0,inkBottom:0});
function owned(input=requestInput) {
  const invocation=createTextValueInvocation();
  try {
    const summary=summarizeTextRasterRequest(snapshotTextRasterRequest(input,invocation),'literal.t1',1,invocation);
    return createOwnedTextRasterRequest(summary,invocation);
  } finally { closeTextValueInvocation(invocation); }
}
function fixture(input=requestInput) {
  const invocation=createTextValueInvocation();
  const issuer=createTextRasterPlanIssuer(owned(input),invocation);
  return {invocation,issuer,close(){closeTextRasterPlanIssuer(issuer);closeTextValueInvocation(invocation);}};
}
function failure(action,code,invocation) {
  let error;
  try { action(); } catch (cause) { error=cause; }
  assert.notEqual(error,undefined,'assigned unit operation must fail');
  const note=takeTextValueFailure(invocation,error);
  assert.ok(note,'fresh exact invocation note required in this direct unit');
  assert.equal(note.code,code);assert.equal(note.error,error);
  return error;
}
function refusal(budget,delta,code='TEXT_CACHE_BUDGET') {
  const before=budget.snapshot(), invocation=createTextValueInvocation();
  try { failure(()=>budget.check(delta,(assigned,cause)=>createTextValueFailure(invocation,assigned,cause)),code,invocation); }
  finally { closeTextValueInvocation(invocation); }
  assert.deepEqual(budget.snapshot(),before,'refused proposal commits no counters');
}
function admit(budget,delta) {
  const invocation=createTextValueInvocation();
  try { budget.check(delta,(code,cause)=>createTextValueFailure(invocation,code,cause));budget.commit(delta); }
  finally { closeTextValueInvocation(invocation); }
}

test('UNIT T18 exact line length refuses before every indexed getter',()=>{
  const f=fixture(), table=new Array(2);let indexed=0;
  Object.defineProperty(table,0,{get(){indexed++;throw new Error('unreached index');}});
  try { failure(()=>f.issuer.createPlan({baselineOffset:5,lines:table}),'TEXT_PLAN_INVALID',f.invocation);assert.equal(indexed,0);assert.equal(readIssuedTextRasterPlan(f.issuer),undefined); }
  finally { f.close(); }
});
test('UNIT T18 header and six row reads complete before malformed early field semantics',()=>{
  const f=fixture(), events=[], exactCause=Object.freeze({tag:'late-row-read'});
  const line={};for(const name of ['advance','hasInk','inkLeft','inkTop','inkRight','inkBottom'])
    Object.defineProperty(line,name,{get(){events.push(name);if(name==='inkBottom')throw exactCause;return name==='advance'?-1:ink[name];}});
  const input={get baselineOffset(){events.push('baselineOffset');return 5;},get lines(){events.push('lines');return [line];}};
  try { const error=failure(()=>f.issuer.createPlan(input),'TEXT_PLAN_INVALID',f.invocation);assert.equal(error.cause,exactCause);
    assert.deepEqual(events,['baselineOffset','lines','advance','hasInk','inkLeft','inkTop','inkRight','inkBottom']);assert.equal(readIssuedTextRasterPlan(f.issuer),undefined); }
  finally { f.close(); }
});
test('UNIT T18 inkless rows preserve advance and never short-circuit the admitted line table',()=>{
  const f=fixture({...requestInput,text:'A\nB'}), events=[];
  const rows=[0,1].map(index=>Object.fromEntries(Object.keys(noInk).map(name=>[name,noInk[name]])));
  for(let i=0;i<rows.length;i++)for(const name of Object.keys(noInk))Object.defineProperty(rows[i],name,{get(){events.push(`${i}:${name}`);return noInk[name];}});
  try { const plan=f.issuer.createPlan({baselineOffset:5,lines:rows});assert.equal(plan.metrics.raster,undefined);
    assert.deepEqual(plan.metrics.logicalBounds,{x:0,y:0,width:5,height:20});
    assert.deepEqual(events,[0,1].flatMap(index=>['advance','hasInk','inkLeft','inkTop','inkRight','inkBottom'].map(name=>`${index}:${name}`))); }
  finally { f.close(); }
});

for(const density of [1,1.5])test(`UNIT T19 frozen signed witness at density ${density}`,()=>{
  const f=fixture({...requestInput,density});
  try { const plan=f.issuer.createPlan({baselineOffset:5,lines:[ink]});const m=plan.metrics;
    assert.deepEqual(m.logicalBounds,{x:0,y:0,width:8,height:10});assert.deepEqual(m.inkBounds,{x:-1,y:1,width:8,height:6});
    assert.deepEqual(m.contentBounds,{x:-1,y:0,width:9,height:10});
    assert.deepEqual(m.raster,density===1?{pixelLeft:-3,pixelTop:-1,width:12,height:10,byteLength:480,density:1,x:-3,y:-1,logicalWidth:12,logicalHeight:10}:
      {pixelLeft:-4,pixelTop:-1,width:17,height:14,byteLength:952,density:1.5,x:-8/3,y:-2/3,logicalWidth:34/3,logicalHeight:28/3});
    assert.equal(requireIssuedTextRasterPlan(f.issuer,plan,f.invocation),plan);
    closeTextRasterPlanIssuer(f.issuer);closeTextValueInvocation(f.invocation);
    assert.equal(readIssuedTextRasterPlan(f.issuer),plan);assert.equal(requireIssuedTextRasterPlan(f.issuer,plan,f.invocation),plan);
    for(const value of [plan,plan.request,plan.request.sourceLines,plan.request.sourceLines[0],m,m.lines,m.lines[0],m.logicalBounds,m.inkBounds,m.contentBounds,m.raster])assert.equal(Object.isFrozen(value),true); }
  finally { f.close(); }
});
const malformedMetrics=[
  ['nan-advance',{...ink,advance:NaN},5],['negative-advance',{...ink,advance:-1},5],
  ['inkless-nonzero-edge',{...noInk,inkLeft:1},5],['degenerate-real-ink',{...ink,inkRight:-1},5],
  ['infinite-baseline',ink,Infinity],['over-magnitude-baseline',ink,1048577],
];
for(const [name,row,baselineOffset]of malformedMetrics)test(`UNIT T19 ${name} refuses without issuing a plan`,()=>{
  const f=fixture();try{failure(()=>f.issuer.createPlan({baselineOffset,lines:[row]}),'TEXT_PLAN_INVALID',f.invocation);assert.equal(readIssuedTextRasterPlan(f.issuer),undefined);}finally{f.close();}
});
test('UNIT T19 derived signed baseline sum and density product retain the coordinate envelope',()=>{
  for(const [input,planInput]of [
    [{...requestInput,text:'A\nB'},{baselineOffset:1048576,lines:[noInk,noInk]}],
    [{...requestInput,density:4},{baselineOffset:0,lines:[{advance:1,hasInk:true,inkLeft:300000,inkTop:0,inkRight:300001,inkBottom:1}]}],
  ]){const f=fixture(input);try{failure(()=>f.issuer.createPlan(planInput),'TEXT_PLAN_INVALID',f.invocation);}finally{f.close();}}
});
for(const [name,w,h,accepted,expectedWidth,expectedHeight,expectedBytes]of [
  ['edge-exact',4092,1,true,4096,5,81920],['edge-over',4093,1,false],
  ['pixel-exact',1020,1020,true,1024,1024,4194304],['pixel-over',1021,1020,false],
])test(`UNIT T40 frozen reachable raster ${name}`,()=>{
  const f=fixture();const input={baselineOffset:0,lines:[{advance:8,hasInk:true,inkLeft:0,inkTop:0,inkRight:w,inkBottom:h}]};
  try{if(accepted){const raster=f.issuer.createPlan(input).metrics.raster;assert.equal(raster.width,expectedWidth);assert.equal(raster.height,expectedHeight);assert.equal(raster.byteLength,expectedBytes);}
    else failure(()=>f.issuer.createPlan(input),'TEXT_REQUEST_LIMIT',f.invocation);}finally{f.close();}
});

test('UNIT T37 frozen metadata proposal and delivery/retirement transfers count once',()=>{
  const budget=new TextBudget({...limits,maxGenerations:1,maxPendingJobs:1,maxWaiters:1,maxCallerLeases:1,maxResidentEntries:0,maxMetadataBytes:4964,maxLogicalImageBytes:480,maxPendingRasterBytes:960});
  assert.equal(budget.snapshot().metadataBytes,4096);
  const invocation=createTextValueInvocation();try{
    const summary=summarizeTextRasterRequest(snapshotTextRasterRequest(requestInput,invocation),'literal.t1',1,invocation);
    assert.deepEqual({sourceCodeUnits:summary.sourceCodeUnits,lineCount:summary.lineCount,metadataBytes:summary.metadataBytes},{sourceCodeUnits:1,lineCount:1,metadataBytes:676});
  }finally{closeTextValueInvocation(invocation);}
  const pending={occupiedSlots:1,currentGenerations:1,pendingJobs:1,pendingWaiters:1,callerLeaseSlots:1,metadataBytes:868};
  admit(budget,pending);assert.equal(budget.snapshot().metadataBytes,4964);
  const oneByteShort=new TextBudget({...limits,maxMetadataBytes:4963});refusal(oneByteShort,pending);
  admit(budget,{reservedImageBytes:480,pendingRasterBytes:960});
  admit(budget,{reservedImageBytes:-480,liveImageBytes:480,pendingRasterBytes:-960,pendingWaiters:-1,pendingJobs:-1,activeCallerLeases:1,metadataBytes:-128});
  const ready=budget.snapshot();assert.equal(ready.metadataBytes,4836);assert.equal(ready.callerLeaseSlots,1);assert.equal(ready.activeCallerLeases,1);assert.equal(ready.liveImageBytes,480);assert.equal(ready.reservedImageBytes,0);
  admit(budget,{occupiedSlots:-1,currentGenerations:-1,callerLeaseSlots:-1,activeCallerLeases:-1,liveImageBytes:-480,metadataBytes:-740});
  assert.equal(budget.snapshot().metadataBytes,4096);assert.equal(budget.snapshot().liveImageBytes,0);
});

const ordered=[
  ['waiter-before-lease',{pendingWaiters:129,callerLeaseSlots:-1}],
  ['lease-before-routing',{callerLeaseSlots:129,occupiedSlots:-1}],
  ['routing-before-generation',{occupiedSlots:33,currentGenerations:-1}],
  ['retained-generation-before-job',{currentGenerations:64,retiredGenerations:1,pendingJobs:-1}],
  ['job-before-metadata',{pendingJobs:5,metadataBytes:-4097}],
  ['metadata-before-output',{metadataBytes:2097152-4096+1,liveImageBytes:-1}],
  ['output-before-scratch',{liveImageBytes:16777216,pendingRasterBytes:-1,reservedImageBytes:1}],
  ['scratch-before-residency',{pendingRasterBytes:8388609,residentEntries:-1}],
  ['residency-before-idle',{residentEntries:33,idleWaiters:-1}],
  ['idle-before-late-count-validation',{idleWaiters:9,lateProviderFailureCount:-1}],
];
for(const [name,delta]of ordered)test(`UNIT T37-T41 ordered quota ${name}`,()=>refusal(new TextBudget(limits),delta));
test('UNIT T38/T39 exact additive output and twice-image scratch precede any scalar commit',()=>{
  const budget=new TextBudget({...limits,maxLogicalImageBytes:480,maxPendingRasterBytes:960});
  admit(budget,{liveImageBytes:240,reservedImageBytes:240,pendingRasterBytes:960});
  refusal(budget,{reservedImageBytes:1});refusal(budget,{pendingRasterBytes:1});
  const scratchShort=new TextBudget({...limits,maxLogicalImageBytes:480,maxPendingRasterBytes:959});
  refusal(scratchShort,{reservedImageBytes:480,pendingRasterBytes:960});assert.equal(scratchShort.snapshot().reservedImageBytes,0);
});
test('UNIT T41 fixed idle exact cap and independent caller/resident counters',()=>{
  const budget=new TextBudget(limits);admit(budget,{idleWaiters:8,metadataBytes:512});refusal(budget,{idleWaiters:1,metadataBytes:64});
  admit(budget,{idleWaiters:-8,metadataBytes:-512});assert.equal(budget.snapshot().metadataBytes,4096);
  admit(budget,{callerLeaseSlots:128,activeCallerLeases:128,residentEntries:32});refusal(budget,{callerLeaseSlots:1});refusal(budget,{residentEntries:1});
});
test('UNIT T37/T41 quarantine remains a retired subset and retains unproved output/scratch',()=>{
  const budget=new TextBudget({...limits,maxGenerations:1,maxLogicalImageBytes:480,maxPendingRasterBytes:960});
  admit(budget,{currentGenerations:1,pendingJobs:1,metadataBytes:676,reservedImageBytes:480,pendingRasterBytes:960});
  admit(budget,{currentGenerations:-1,retiredGenerations:1,quarantinedGenerations:1,pendingJobs:-1,quarantinedImageBytes:480,quarantinedRasterBytes:960,cleanupFailureCount:1});
  admit(budget,{});const state=budget.snapshot();assert.equal(state.retiredGenerations,1);assert.equal(state.quarantinedGenerations,1);assert.equal(state.pendingJobs,0);
  assert.equal(state.metadataBytes,4772);assert.equal(state.reservedImageBytes,480);assert.equal(state.pendingRasterBytes,960);
  refusal(budget,{currentGenerations:1});refusal(budget,{reservedImageBytes:1});refusal(budget,{pendingRasterBytes:1});
});
test('UNIT T42 unsafe/negative resultant transitions and failed multi-field commits are atomic',()=>{
  for(const delta of [{pendingWaiters:-1},{metadataBytes:-4097},{cleanupFailureCount:NaN},{lateProviderFailureCount:Infinity},{idleWaiters:0.5},{cleanupFailureCount:Number.MAX_SAFE_INTEGER+1}]){
    const budget=new TextBudget(limits);refusal(budget,delta,'TEXT_COUNTER_EXHAUSTED');
    const before=budget.snapshot();assert.throws(()=>budget.commit(delta),error=>error.code==='TEXT_COUNTER_EXHAUSTED');assert.deepEqual(budget.snapshot(),before);
  }
  const budget=new TextBudget(limits),before=budget.snapshot();
  assert.throws(()=>budget.commit({pendingWaiters:1,lateProviderFailureCount:-1}),error=>error.code==='TEXT_COUNTER_EXHAUSTED');assert.deepEqual(budget.snapshot(),before);
  budget.commit({lateProviderFailureCount:Number.MAX_SAFE_INTEGER});assert.equal(budget.snapshot().lateProviderFailureCount,Number.MAX_SAFE_INTEGER);
  refusal(budget,{lateProviderFailureCount:1},'TEXT_COUNTER_EXHAUSTED');
  const exact=budget.snapshot();assert.throws(()=>budget.commit({lateProviderFailureCount:1}),error=>error.code==='TEXT_COUNTER_EXHAUSTED');assert.deepEqual(budget.snapshot(),exact);
  assert.notEqual(budget.snapshot(),budget.snapshot());assert.equal(Object.isFrozen(budget.snapshot()),true);
});
test('UNIT T42 first-party notes require exact open invocation and one consumption',()=>{
  const first=createTextValueInvocation(),second=createTextValueInvocation(),cause=Object.freeze({tag:'original'});
  const error=createTextValueFailure(first,'TEXT_PLAN_INVALID',cause);
  assert.equal(takeTextValueFailure(second,error),undefined);const note=takeTextValueFailure(first,error);assert.equal(note.error,error);assert.equal(note.error.cause,cause);
  assert.equal(takeTextValueFailure(first,error),undefined);assert.equal(takeTextValueFailure(second,error),undefined);
  assert.equal(takeTextValueFailure(second,new EgretError('TEXT_PLAN_INVALID',{cause:error})),undefined);
  const closed=createTextValueFailure(first,'TEXT_CACHE_BUDGET',cause);closeTextValueInvocation(first);
  assert.equal(takeTextValueFailure(first,closed),undefined);assert.equal(takeTextValueFailure(second,closed),undefined);closeTextValueInvocation(second);
});
