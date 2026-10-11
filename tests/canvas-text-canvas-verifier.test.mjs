// First-party Apache-2.0. Controlled admission inputs, never claimed native browser outputs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {parseCollectorArgs,admitWindow} from '../tools/canvas-text-canvas-contract.mjs';
const root=path.join(os.tmpdir(),'egret-main'),installed=path.join(os.tmpdir(),'installed-playwright'),output=path.join(os.tmpdir(),'independent-canvas-output');
const clone=value=>structuredClone(value),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const zeros={pendingJobs:0,pendingWaiters:0,activeCallerLeases:0,liveImageBytes:0,reservedImageBytes:0,pendingRasterBytes:0,quarantinedImageBytes:0,quarantinedRasterBytes:0,cleanupFailureCount:0};
const modes=[['omitFill','C01','X-d1'],['omitOrigin','C02','p-d1'],['noOp','C03','X-d1']];
// Literal hand-authored byte inputs exercise admission, independent of Egret/native rasterization.
function windowInput(mode='baseline'){
  const store=new Map(),entries=[],raw=[],rows=[],artifacts=[];
  const rgba=(w,h,x,y)=>{const b=new Uint8Array(w*h*4);if(x!==undefined)b.set([39,83,161,255],4*(y*w+x));return b;};
  const save=(name,bytes,w,h,reference=false)=>{store.set(name,bytes.slice());const a={name,bytes:bytes.length,sha256:digest(bytes)};if(reference)Object.assign(a,{width:w,height:h});else{a.metadata={width:w,height:h,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight'};artifacts.push(a);}return a;};
  for(const row of ['X','p','E-acute','space','empty','LF','CRLF'])for(const density of [1,1.5]){
    const id=row+'-d'+String(density).replace('.','_'),blank=row==='space'||row==='empty',width=density===1?24:34;
    const metrics={raster:blank?null:{width,height:width,byteLength:width*width*4,density,pixelLeft:-2,pixelTop:2}};
    const x=12,y=row==='p'?20:8,owned=blank?new Uint8Array():rgba(width,width,x,y),scene=blank?rgba(80,80):rgba(80,80,30,30);
    const native=[{text:row,raw:{width:20,actualBoundingBoxLeft:0,actualBoundingBoxAscent:16,actualBoundingBoxRight:20,actualBoundingBoxDescent:4},negativeZero:{width:false,actualBoundingBoxLeft:false,actualBoundingBoxAscent:false,actualBoundingBoxRight:false,actualBoundingBoxDescent:false}}];
    entries.push({id,metrics,native});raw.push({id:id+'-owned',...save(mode+'-reference-'+id+'-owned.rgba',owned,blank?0:width,blank?0:width,true)},{id:id+'-scene',...save(mode+'-reference-'+id+'-scene.rgba',scene,80,80,true)});
    rows.push({host:'canvas',id,metrics,native:clone(native),ownedArtifact:blank?null:save(id+'-owned.rgba',owned,width,width),hostArtifact:save(id+'-frame.rgba',scene,80,80)});
  }
  const reference={mode,calls:1,state:'durable-read-back',table:{entries},ack:{stored:true,mode,recipeId:'wc1-owned-ahem-complete-line-reference-v1',raw}};
  const frame=rgba(80,80,30,30),image=name=>save(name,frame,80,80);
  const value={schemaVersion:1,mode,status:'PASS_WC1_CANVAS_SUBSET',failurePresent:false,failure:null,cleanupFailures:[],rows,
    preJobReference:{beforeFirstTargetAcquire:true,ack:clone(reference.ack)},
    scope:{profile:'wc1-canvas-explicit-lines-v1',currentCanvas:true,currentTextField:true,currentTexturedWebGPU:false},
    counters:{measure:16,issuedPlans:16,raster:12,release:16,held:0,lateImages:0,firstTargetAcquire:14},witnessCompletion:{holdRaster:false,notReady:false},
    observations:[{kind:'composition',host:'canvas',hostArtifact:image('composition.rgba'),expectedArtifact:image('expected.rgba')},{kind:'blank-replacement',host:'canvas',allBytesZero:true,hostArtifact:save('blank.rgba',rgba(80,80),80,80)},{kind:'owned-font-change',host:'canvas',affectedCaches:1,generationBefore:0,generationAfter:1,automaticGeneration:false,hostArtifact:image('generation.rgba'),expectedArtifact:image('generation-expected.rgba')}],artifacts,
    retirement:{pendingActors:0,providerPlansReleased:true,nativeMethodsRestored:true,ownedFaceDeleted:true,reference:{disposed:true,retainedRawBuffers:0},caches:[{closed:true,...zeros}],engineClosePromisesSettled:1}};
  const assigned=modes.find(([m])=>m===mode);
  if(assigned){const [,id,rowId]=assigned,row=rows.find(r=>r.id===rowId),entry=entries.find(e=>e.id===rowId),r=entry.metrics.raster,noOp=mode==='noOp';
    row.ownedArtifact=save(rowId+'-mutant-owned.rgba',noOp?store.get(row.ownedArtifact.name):rgba(r.width,r.height),r.width,r.height);row.hostArtifact=save(rowId+'-mutant-frame.rgba',rgba(80,80),80,80);
    row.control={id,status:'FAIL_ASSIGNED_WITNESS',actual:[0,0,0,0],expected:[39,83,161,255],unrelatedFailure:false,witness:{artifact:noOp?row.hostArtifact:row.ownedArtifact,referenceArtifact:raw.find(a=>a.id===rowId+(noOp?'-scene':'-owned')),x:noOp?30:12,y:noOp?30:mode==='omitOrigin'?20:8}};
    value.rows=[row];value.observations=[];value.status='PASS_ASSIGNED_CONTROL_SENSITIVITY';
  }else if(mode==='notReady'){
    value.rows=[];value.counters={measure:1,issuedPlans:0,raster:0,release:0,held:0,lateImages:0,firstTargetAcquire:1};value.witnessCompletion={holdRaster:false,notReady:true};
    value.observations=[{kind:'readiness-refusal',completed:true,actualIdleObserved:true,remaining:{...zeros},nativeMeasureCalls:0,providerCanvasContexts:0,errors:[{present:true,code:'TEXT_MEASURE_FAILED',causePresent:true,cause:{present:true,code:'WEB_TEXT_FONT_NOT_READY'}}]}];
  }else if(mode==='holdRaster'){
    value.rows=[];value.counters={measure:2,issuedPlans:2,raster:2,release:2,held:1,lateImages:1,firstTargetAcquire:1};value.witnessCompletion={holdRaster:true,notReady:false};
    value.observations=[{kind:'held-replacement',completed:true,actualIdleObserved:true,remaining:{...zeros},heldRasterEntered:true,heldRasterSettled:true,oldVisibilityChecked:true,savedImageAuthorityChecked:true,savedImageBytesChecked:true,pendingRejected:true,pendingRejectionIsEgretError:true,pendingError:{present:true},closedScope:'closed',scopeReason:{present:true,code:'SCOPE_CLOSED'},closingError:{present:true,code:'SCOPE_CLOSED'},lateImages:1,oldFrameId:1,oldHostArtifact:image('held.rgba')}];
  }
  return {value,store,evidence:{reference,readArtifact:a=>store.get(a.name)?.slice()}};
}
const accept=input=>admitWindow(input.value,input.value.mode,input.evidence);
test('standalone CLI accepts an independent output and rejects injected flags or repository output',()=>{
  assert.deepEqual(parseCollectorArgs(['--playwright',installed,'--output',output],root),{playwright:installed,output});
  for(const args of [['--playwright',installed,'--channel','msedge','--output',output],['--playwright','relative','--output',output],['--playwright',installed,'--output',path.join(root,'evidence')],['--output',output,'--playwright',installed]])assert.throws(()=>parseCollectorArgs(args,root),/Canvas CLI/);
});
test('fourteen Canvas rows require complete owned rasters frames and scene witnesses',()=>{assert.equal(accept(windowInput()),undefined);});
test('baseline rejects missing duplicate GPU or changed row and scene evidence',()=>{
  for(const change of [v=>v.rows.pop(),v=>v.rows[1].id=v.rows[0].id,v=>v.rows[0].host='webgpu',v=>v.rows[0].ownedArtifact=null,v=>v.observations.pop(),v=>v.observations[1].allBytesZero=false,v=>v.observations[2].generationAfter=3,v=>v.retirement.caches[0].liveImageBytes=4,v=>v.failurePresent=true,v=>v.scope.currentTexturedWebGPU=true]){const input=windowInput();change(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('baseline refuses absent independent reference inventory before target',()=>{
  const input=windowInput();delete input.value.preJobReference;assert.throws(()=>accept(input),/Canvas evidence/);
});
test('row metrics retain actual complete-line native values and signed-zero evidence',()=>{
  for(const change of [v=>v.rows[0].native=[],v=>v.rows[0].native[0].raw.width=19,v=>v.rows[0].native[0].negativeZero.actualBoundingBoxLeft=true]){const input=windowInput();change(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('baseline refuses unnamed or repeated saved image identities',()=>{
  for(const mutate of [v=>{for(const a of v.artifacts)delete a.name;},v=>{v.rows[1].hostArtifact=v.rows[0].hostArtifact;}]){const input=windowInput();mutate(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('a one-byte last-channel mismatch fails even with a valid updated target hash',()=>{
  for(const which of ['owned','frame','composition']){const input=windowInput(),a=which==='owned'?input.value.rows[0].ownedArtifact:which==='frame'?input.value.rows[0].hostArtifact:input.value.observations[0].hostArtifact,b=input.store.get(a.name);b[b.length-1]=1;a.sha256=digest(b);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('each C01 C02 C03 requires its exact assigned saved wrong pixel',()=>{
  for(const [mode] of modes){assert.equal(accept(windowInput(mode)),undefined);
    for(const change of [v=>v.rows[0].control.id='C99',v=>v.rows[0].control.actual=[39,83,161,255],v=>v.rows[0].control.expected=[0,0,0,0],v=>v.rows[0].control.unrelatedFailure=true,v=>v.rows[0].control.witness.x++,v=>v.rows[0].id='space-d1',v=>v.rows.push(clone(v.rows[0]))]){const input=windowInput(mode);change(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
  }
});
test('controls refuse empty inventory and missing persisted wrong-pixel bindings',()=>{
  for(const [mode] of modes)for(const change of [v=>v.artifacts=[],v=>delete v.rows[0].control.witness,v=>delete v.rows[0].control.witness.referenceArtifact]){const input=windowInput(mode);change(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('control tuples cannot conceal an actually saved correct pixel',()=>{
  for(const [mode] of modes){const input=windowInput(mode),w=input.value.rows[0].control.witness,a=w.artifact,b=input.store.get(a.name),width=a.metadata.width;b.set([39,83,161,255],4*(w.y*width+w.x));a.sha256=digest(b);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('readiness must refuse before native measure or Canvas provider context allocation',()=>{
  assert.equal(accept(windowInput('notReady')),undefined);
  for(const change of [v=>v.observations[0].nativeMeasureCalls=1,v=>v.observations[0].providerCanvasContexts=1,v=>v.counters.raster=1,v=>v.observations[0].errors[0].cause.code='OTHER',v=>v.witnessCompletion.notReady=false]){const input=windowInput('notReady');change(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
});
test('held replacement needs retained image authority closed-Scope rejection and idle counters',()=>{
  assert.equal(accept(windowInput('holdRaster')),undefined);
  for(const change of [v=>v.observations[0].savedImageBytesChecked=false,v=>v.observations[0].scopeReason.code='OTHER',v=>v.observations[0].remaining.pendingJobs=1,v=>v.counters.lateImages=0]){const input=windowInput('holdRaster');change(input.value);assert.throws(()=>accept(input),/Canvas evidence/);}
});
