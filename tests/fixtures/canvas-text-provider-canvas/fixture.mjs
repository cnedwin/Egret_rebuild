// First-party Apache-2.0 Canvas-only native fixture. Targets only built public Egret entries.
import { createEngine, Sprite, copyImageData2DPixels, isImageData2D, EgretError } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';

import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { RECIPE_ID, collectReference, disposeReference, ownSurface, retireSurface, nativeBytes, sceneBytes, sample, equal, failure, createFailureState, rememberFailure, rememberCleanup, serializeThrown } from './reference.mjs';
const RAW=['width','actualBoundingBoxLeft','actualBoundingBoxAscent','actualBoundingBoxRight','actualBoundingBoxDescent'];
const FRAME={width:80,height:80,clearColor:0,clearAlpha:0};
const zeroStatus=status=>['pendingJobs','pendingWaiters','activeCallerLeases','liveImageBytes','reservedImageBytes','pendingRasterBytes','quarantinedImageBytes','quarantinedRasterBytes','cleanupFailureCount'].every(name=>status[name]===0);
const serialError=serializeThrown;
const displayBounds=metrics=>metrics.contentBounds.width===0||metrics.contentBounds.height===0?{x:0,y:0,width:0,height:0}:metrics.contentBounds;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return {promise,resolve,reject};}
function insist(value,stage,detail){if(!value)throw failure('FAIL',stage,'Public target obligation differs',detail);}
function request(family,text,density=1){return {text,fontFamily:family,fontSize:20,fontWeight:400,fontStyle:'normal',lineHeight:10,locale:'und',direction:'ltr',density,fillColor:0x2753a1};}
function sameBytes(actual,expected,stage){insist(actual.length===expected.length,stage,{actualLength:actual.length,expectedLength:expected.length});let mismatchCount=0,first=null,maxDifference=0;
  for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i]){mismatchCount++;maxDifference=Math.max(maxDifference,Math.abs(actual[i]-expected[i]));first??={index:i,actual:actual[i],expected:expected[i]};}
  if(mismatchCount)throw failure('FAIL',stage,'Exact bytes differ; no pixel tolerance',{mismatchCount,maxDifference,first});}
async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function runWindow({mode,cases,fontBytes,nonce}) {
  insist(cases.recipeId===RECIPE_ID&&cases.windows.includes(mode)&&/^[a-f0-9]{32}$/.test(nonce),'fixed-recipe');
  const family='EgretWC1Owned_'+nonce, face=new FontFace(family,fontBytes,{style:'normal',weight:'400'}),actors=new Set(),callerLeases=new Set(),hosts=[],caches=[],fields=[],scopes=[],engines=[],surfaces=[],compilation=[],rawNative=[],errors=createFailureState();
  let reference,referenceAck=null,restored=false,referenceRetirement=null,faceAdded=false,cleaning=false;
  const witnessCompletion={holdRaster:false,notReady:false};
  const counters={measure:0,issuedPlans:0,raster:0,release:0,held:0,lateImages:0,firstTargetAcquire:0},rows=[],observations=[],artifacts=[];
  const held=deferred(),entered=deferred();let holdEnabled=false,phase=null,observeMeasure=false;
  const proto=CanvasRenderingContext2D.prototype,originalMeasure=proto.measureText,originalFill=proto.fillText,originalTransform=proto.setTransform;
  const canvasProto=HTMLCanvasElement.prototype,originalContext=canvasProto.getContext,contextSeen=new WeakSet();
  function track(value){const promise=Promise.resolve(value);actors.add(promise);promise.then(()=>actors.delete(promise),()=>actors.delete(promise));return promise;}
  async function wait(value,label){const promise=track(value);if(errors.present&&!cleaning)throw errors.value;let timer;try{const result=await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('INCOMPLETE','action-timeout',label)),20000);})]);if(errors.present&&!cleaning)throw errors.value;return result;}finally{clearTimeout(timer);}}
  async function emit(name,bytes,metadata){const descriptor=await wait(window.saveOwnedArtifact({name,bytes:Array.from(bytes),metadata}), 'durable target artifact');insist(descriptor.bytes===bytes.length&&descriptor.sha256===await digest(bytes),'saved-owned-artifact',descriptor);artifacts.push(descriptor);return descriptor;}
  function remember(error){rememberFailure(errors,error,'fixture-operation');}
  function cleanup(error,phase){rememberCleanup(errors,error,phase);}
  // Register callers before wait/assertion failure; a late settlement owns its retirement.
  function ownCallerResult(result){if(result.kind==='image'){const lease=result.lease;callerLeases.add(lease);if(cleaning){try{releaseCallerLease(lease);}catch(error){cleanup(error,'late-caller-lease-retirement');}return undefined;}}return result;}
  function releaseCallerLease(lease){lease.release();callerLeases.delete(lease);}
  function patchNative(){
    canvasProto.getContext=function(type,options){const first=!contextSeen.has(this);contextSeen.add(this);const context=Reflect.apply(originalContext,this,[type,options]);if((observeMeasure||phase==='raster')&&type==='2d'){const attrs=context?.getContextAttributes?.();const item={kind:'actual-provider-context',phase:observeMeasure?'measure':'raster',first,width:this.width,height:this.height,requested:{alpha:options?.alpha??null,colorSpace:options?.colorSpace??null,willReadFrequently:options?.willReadFrequently??null},actual:attrs?{alpha:attrs.alpha,colorSpace:attrs.colorSpace,willReadFrequently:attrs.willReadFrequently??null}:null};observations.push(item);if(phase==='raster'&&first)insist(item.requested.alpha===true&&item.requested.colorSpace==='srgb'&&item.requested.willReadFrequently===true&&item.actual?.alpha===true&&item.actual.colorSpace==='srgb','actual-raster-first-context-state',item);}return context;};
    proto.measureText=function(text){const result=Reflect.apply(originalMeasure,this,[text]);if(observeMeasure){const raw={},negativeZero={};for(const name of RAW){raw[name]=result[name];negativeZero[name]=Object.is(result[name],-0);}rawNative.push({text,raw,negativeZero,font:this.font,align:this.textAlign,baseline:this.textBaseline,direction:this.direction,contextLang:this.lang,canvasLang:this.canvas.lang});}return result;};
    proto.fillText=function(...args){if(phase==='raster'&&mode==='omitFill')return undefined;return Reflect.apply(originalFill,this,args);};
    proto.setTransform=function(...args){if(phase==='raster'&&mode==='omitOrigin'&&args.length===6)args=[args[0],args[1],args[2],args[3],0,0];return Reflect.apply(originalTransform,this,args);};
  }
  const base=createCanvasTextRasterProvider();
  insist(base.identity==='egret.canvas-text.wc1'&&base.profile==='canvas-explicit-lines-v1'&&Object.isFrozen(base),'current-provider-public-identity');
  const provider=Object.freeze({identity:base.identity,profile:base.profile,
    async measure(input,context){counters.measure++;observeMeasure=true;let issued,calls=0;const decorated={...context,createPlan:value=>{calls++;issued=context.createPlan(value);return issued;}};try{const plan=await Reflect.apply(base.measure,base,[input,decorated]);insist(calls===1&&issued===plan,'exact-genuine-plan-return');counters.issuedPlans++;return plan;}finally{observeMeasure=false;}},
    async rasterize(plan,context){counters.raster++;phase='raster';let result;try{result=await Reflect.apply(base.rasterize,base,[plan,context]);}finally{phase=null;}if(holdEnabled){counters.held++;entered.resolve();await held.promise;if(result!==undefined)counters.lateImages++;}return result;},
    release(plan){counters.release++;return Reflect.apply(base.release,base,[plan]);}});
  async function engineFor(kind){
    insist(kind==='canvas','Canvas-only host');
    const surface=ownSurface(80,80,errors);surfaces.push(surface);
    const host=createCanvasHost({canvas:surface.canvas,pixelRatio:1,maxBackingPixels:6400});hosts.push(host);
    const port=mode==='noOp'?{surface:host.surface,start:()=>host.start(),stop:()=>host.stop(),close:()=>host.close(),setTimeout:(callback,ms)=>host.setTimeout(callback,ms),renderFrame:()=>undefined}:host;
    const engine=await wait(createEngine({host:port}),'genuine Canvas Engine');engines.push(engine);
    const scope=engine.createScope();scopes.push(scope);const cache=createTextRasterCache(engine.assets,{provider,maxResidentEntries:0});caches.push(cache);return {engine,scope,cache,host,surface,kind};
  }
  function newField(owner,input){const field=createTextField(owner.engine,owner.scope,owner.cache);fields.push(field);field.x=20;field.y=20;owner.engine.stage.addChild(field);field.setRequest(input);return field;}
  async function render(owner,label){
    if(errors.present&&!cleaning)throw errors.value;
    owner.engine.renderFrame(FRAME);const bytes=nativeBytes(owner.surface);
    return {bytes,alphaMode:'straight',descriptor:await emit(label+'-canvas.rgba',bytes,{width:80,height:80,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight'})};
  }
  try{
    await wait(face.load(),'owned FontFace load');insist(face.status==='loaded','owned-face-loaded');
    const selectionSurface=ownSurface(1,1,errors);let beforeAddAdvance,afterAddAdvance,selectionPrimaryPresent=false;
    try{selectionSurface.context.font=`normal 400 20px ${JSON.stringify(family)}`;beforeAddAdvance=selectionSurface.context.measureText('XXXXXXXXXXXXXXXXXXXX').width;document.fonts.add(face);faceAdded=true;selectionSurface.context.font=`normal 400 20px ${JSON.stringify(family)}`;afterAddAdvance=selectionSurface.context.measureText('XXXXXXXXXXXXXXXXXXXX').width;}catch(error){selectionPrimaryPresent=true;remember(error);throw error;}finally{try{retireSurface(selectionSurface,errors);}catch(error){if(!selectionPrimaryPresent)throw error;}}
    reference=collectReference(cases,family,face,{beforeAddAdvance,afterAddAdvance,ownedLoadedMembership:document.fonts.has(face)},errors);
    const raw=[];for(const entry of reference.entries){raw.push({id:entry.id+'-owned',width:entry.metrics.raster?.width??0,height:entry.metrics.raster?.height??0,bytes:Array.from(entry.ownedBytes)});raw.push({id:entry.id+'-scene',width:80,height:80,bytes:Array.from(entry.sceneBytes)});}
    const envelope={schemaVersion:1,recipeId:RECIPE_ID,mode,nonce,metadata:reference.metadata,raw};referenceAck=await wait(window.persistIndependentReference(envelope),'durable independent reference ACK');
    insist(referenceAck.stored===true&&referenceAck.recipeId===RECIPE_ID&&referenceAck.mode===mode&&referenceAck.nonce===nonce&&referenceAck.raw.length===28&&counters.measure===0&&counters.raster===0,'pre-first-target-ACK');
    for(const entry of raw){const saved=referenceAck.raw.find(r=>r.id===entry.id);insist(saved&&saved.bytes===entry.bytes.length&&saved.sha256===await digest(new Uint8Array(entry.bytes)),'exact-reference-readback-ACK');}
    const canonical=new TextEncoder().encode(JSON.stringify({schemaVersion:1,recipeId:RECIPE_ID,mode,nonce,metadata:reference.metadata,raw:referenceAck.raw})+'\n');insist(referenceAck.metadata.bytes===canonical.length&&referenceAck.metadata.sha256===await digest(canonical),'exact-reference-metadata-ACK');
    patchNative();
    if(mode==='notReady'){
      const owner=await engineFor('canvas'),oldCheck=Object.getOwnPropertyDescriptor(document.fonts,'check'),reasonRows=[];
      Object.defineProperty(document.fonts,'check',{value:()=>false,configurable:true,writable:true});let readinessPrimaryPresent=false;
      try{counters.firstTargetAcquire++;try{await wait(owner.cache.acquire(request(family,'X')).then(ownCallerResult),'not-ready genuine acquire');throw failure('FAIL','not-ready','Unexpected acquisition success');}catch(error){if(!(error instanceof EgretError&&error.code==='TEXT_MEASURE_FAILED'&&error.cause?.code==='WEB_TEXT_FONT_NOT_READY')){readinessPrimaryPresent=true;remember(error);throw error;}reasonRows.push(serialError(error));}}
      finally{try{if(oldCheck)Object.defineProperty(document.fonts,'check',oldCheck);else delete document.fonts.check;}catch(error){cleanup(error,'readiness-check-restoration');if(!readinessPrimaryPresent)throw error;}}
      await wait(owner.cache.whenIdle(),'not-ready actual idle');insist(counters.raster===0&&rawNative.length===0&&zeroStatus(owner.cache.getStatus()),'not-ready-no-native-work');observations.push({kind:'readiness-refusal',completed:true,actualIdleObserved:true,nativeMeasureCalls:rawNative.length,providerCanvasContexts:observations.filter(o=>o.kind==='actual-provider-context').length,errors:reasonRows,remaining:owner.cache.getStatus()});witnessCompletion.notReady=true;
    }else if(mode==='holdRaster'){
      const owner=await engineFor('canvas'),field=newField(owner,request(family,'X'));counters.firstTargetAcquire++;await wait(field.prepare(),'initial actual field');await wait(owner.cache.whenIdle(),'initial actor idle');
      const old=reference.entries.find(e=>e.row==='X'&&e.density===1),savedFrame=owner.engine.captureFrame(FRAME),savedImage=savedFrame.images[0];
      holdEnabled=true;field.setRequest(request(family,'p'));const pending=track(field.prepare());await wait(entered.promise,'genuine held raster entry');const oldRender=await render(owner,'held-old');sameBytes(oldRender.bytes,old.sceneBytes,'atomic-old-visible');
      let closing;owner.scope.signal.addEventListener('abort',()=>{closing=track(field.prepare());},{once:true});owner.scope.dispose();let closingError;try{await wait(closing,'actual closing reentry rejection');}catch(error){closingError=error;}insist(closingError?.code==='SCOPE_CLOSED','Scope-lifetime-before-pending-busy');
      let rejected;try{await wait(pending,'actual pending field rejection');}catch(error){rejected=error;}insist(rejected instanceof EgretError&&owner.scope.signal.reason?.code==='SCOPE_CLOSED','held-scope-termination',{error:serialError(rejected)});
      held.resolve();await wait(owner.cache.whenIdle(),'late actual provider settlement');insist(counters.lateImages===1&&zeroStatus(owner.cache.getStatus()),'late-image-release-and-idle',owner.cache.getStatus());
      insist(isImageData2D(savedImage),'saved-frame-owned-image');sameBytes(copyImageData2DPixels(savedImage),old.ownedBytes,'saved-image-survives-scope');observations.push({kind:'held-replacement',completed:true,heldRasterEntered:true,heldRasterSettled:true,actualIdleObserved:true,oldVisibilityChecked:true,oldHostArtifact:oldRender.descriptor,savedImageAuthorityChecked:true,savedImageBytesChecked:true,pendingRejected:true,pendingRejectionIsEgretError:rejected instanceof EgretError,scopeReason:serialError(owner.scope.signal.reason),oldFrameId:savedFrame.frameId,lateImages:counters.lateImages,closedScope:owner.scope.state,closingError:serialError(closingError),pendingError:serialError(rejected),remaining:owner.cache.getStatus()});witnessCompletion.holdRaster=true;
    }else{
      const kinds=['canvas'];
      for(const kind of kinds){const owner=await engineFor(kind);
        const selected=mode==='baseline'?reference.entries:[reference.entries.find(e=>e.row===(mode==='omitOrigin'?'p':'X')&&e.density===1)];
        for(const entry of selected){const before=rawNative.length,input=request(family,entry.text,entry.density);counters.firstTargetAcquire++;
          const prepared=await wait(owner.cache.acquire(input).then(ownCallerResult),'genuine own raster');equal(prepared.metrics,entry.metrics,'independent-normalized-metrics');const observed=rawNative.slice(before);equal(observed.map(({text,raw,negativeZero})=>({text,raw,negativeZero})),entry.native.map(({text,raw,negativeZero})=>({text,raw,negativeZero})),'actual-native-to-reference-metrics');insist(observed.every(n=>n.font.includes(family)&&n.font.includes('20px')&&n.align==='left'&&n.baseline==='alphabetic'&&n.direction==='ltr'&&n.contextLang==='und'),'actual-native-measure-state',observed);
          let ownedDescriptor=null,ownedBytes;
          if(entry.metrics.raster){insist(prepared.kind==='image'&&isImageData2D(prepared.lease.value.imageData),'genuine-owned-output');ownedBytes=copyImageData2DPixels(prepared.lease.value.imageData);ownedDescriptor=await emit(kind+'-'+entry.id+'-owned.rgba',ownedBytes,{width:entry.metrics.raster.width,height:entry.metrics.raster.height,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight'});
            if(mode==='baseline'||mode==='noOp')sameBytes(ownedBytes,entry.ownedBytes,'independent-owned-raster-bytes');
          }else insist(prepared.kind==='empty','genuine-blank-result');
          const measureBeforeField=counters.measure;
          if(mode==='baseline'&&entry.metrics.raster){const paired=await wait(owner.cache.acquire(input).then(ownCallerResult),'second genuine shared caller');insist(paired.kind==='image'&&paired.lease!==prepared.lease&&paired.lease.value===prepared.lease.value&&counters.measure===measureBeforeField,'separate-genuine-coalesced-leases');releaseCallerLease(paired.lease);}
          const field=newField(owner,input);const fieldMetrics=await wait(field.prepare(),'actual public TextField prepare');equal(fieldMetrics,entry.metrics,'independent-field-metrics');equal(field.getBounds(),displayBounds(entry.metrics),'contract-content-without-padding-and-zero-area');
          if(entry.metrics.raster)insist(counters.measure===measureBeforeField&&owner.cache.getStatus().activeCallerLeases===2,'field-and-public-caller-separate-coalesced-leases');
          if(mode==='baseline'&&entry.metrics.raster){const secondField=newField(owner,input);secondField.visible=false;equal(await wait(secondField.prepare(),'second genuine shared field'),entry.metrics,'second-field-independent-metrics');insist(counters.measure===measureBeforeField&&owner.cache.getStatus().activeCallerLeases===3&&document.fonts.has(face),'two-fields-and-caller-share-real-demand');secondField.dispose();insist(owner.cache.getStatus().activeCallerLeases===2&&!owner.cache.getStatus().closed&&document.fonts.has(face),'field-disposal-keeps-shared-cache-and-owned-font');}
          const frame=owner.engine.captureFrame(FRAME);insist(frame.commands.filter(c=>c.kind==='image').length===(entry.metrics.raster?1:0),'current-field-frame-image-count');
          const output=await render(owner,kind+'-'+entry.id);let control=null;
          if(mode==='baseline')sameBytes(output.bytes,entry.sceneBytes,'independent-current-host-full-bytes');
          else{const assigned=cases.controls.find(c=>c.mode===mode);let actual,witness;
            if(mode==='noOp'){const [x,y]=assigned.scenePoint;actual=sample(output.bytes,80,80,x,y);witness={artifact:output.descriptor,referenceArtifact:referenceAck.raw.find(r=>r.id===entry.id+'-scene'),x,y};}
            else{const r=entry.metrics.raster,p=assigned.logicalPoint,x=Math.floor(p[0]*entry.density-r.pixelLeft),y=Math.floor(p[1]*entry.density-r.pixelTop);actual=sample(ownedBytes,r.width,r.height,x,y);witness={artifact:ownedDescriptor,referenceArtifact:referenceAck.raw.find(r=>r.id===entry.id+'-owned'),x,y};}
            equal(actual,assigned.mutant,'assigned-mutant-channel');insist(JSON.stringify(actual)!==JSON.stringify(assigned.expected),'assigned-sensitivity');control={id:assigned.id,status:'FAIL_ASSIGNED_WITNESS',actual,expected:assigned.expected,unrelatedFailure:false,witness};}
          rows.push({host:kind,id:entry.id,metrics:prepared.metrics,native:observed,ownedArtifact:ownedDescriptor,hostArtifact:output.descriptor,control,frameId:frame.frameId});
          field.dispose();if(prepared.kind==='image')releaseCallerLease(prepared.lease);await wait(owner.cache.whenIdle(),'actual row retirement');insist(zeroStatus(owner.cache.getStatus()),'row-logical-retirement',owner.cache.getStatus());
        }
        if(mode==='baseline'){
          const entry=reference.entries.find(e=>e.row==='X'&&e.density===1),requestedClip={x:4,y:4,width:12,height:12},field=newField(owner,request(family,'X'));await wait(field.prepare(),'composition field');field.x=24;field.y=18;field.alpha=0.5;field.clipRect={...requestedClip};
          const overlay=new Sprite();overlay.graphics.beginFill(0xff0000);overlay.graphics.drawRect(28,28,4,4);overlay.graphics.endFill();owner.engine.stage.addChild(overlay);
          const expected=sceneBytes(entry,{origin:[24,18],alpha:0.5,clip:requestedClip,overlay:true},errors),expectedBytes=expected;
          // Save the independent witness before target rendering so a failed comparison preserves both operands.
          const expectedArtifact=await emit(kind+'-composition-reference.rgba',expectedBytes,{width:80,height:80,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight'});
          const output=await render(owner,kind+'-composition');sameBytes(output.bytes,expectedBytes,'independent-transform-clip-alpha-painter');
          observations.push({kind:'composition',host:kind,hostArtifact:output.descriptor,expectedArtifact});overlay.dispose();
          field.setRequest(request(family,''));await wait(field.prepare(),'blank atomic replacement');const blank=await render(owner,kind+'-blank-replacement');insist(blank.bytes.every(v=>v===0),'blank-replacement-clear');observations.push({kind:'blank-replacement',host:kind,allBytesZero:true,hostArtifact:blank.descriptor});field.dispose();await wait(owner.cache.whenIdle(),'blank retirement');
          const generationBefore=owner.cache.getStatus().fontGeneration;insist(document.fonts.delete(face),'application-owned-font-change-delete');document.fonts.add(face);insist(document.fonts.has(face)&&owner.cache.getStatus().fontGeneration===generationBefore,'no-automatic-font-generation');for(const affected of caches)affected.invalidate();
          const replacement=newField(owner,request(family,'X'));await wait(replacement.prepare(),'explicit generation preparation');insist(owner.cache.getStatus().fontGeneration===generationBefore+1,'explicit-per-cache-invalidation');
          const generationExpected=await emit('canvas-generation-reference.rgba',entry.sceneBytes,{width:80,height:80,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight'});
          const generationOutput=await render(owner,'canvas-generation');sameBytes(generationOutput.bytes,entry.sceneBytes,'independent-generation-full-frame');
          replacement.dispose();await wait(owner.cache.whenIdle(),'generation retirement');observations.push({kind:'owned-font-change',host:kind,affectedCaches:caches.length,generationBefore,generationAfter:owner.cache.getStatus().fontGeneration,automaticGeneration:false,hostArtifact:generationOutput.descriptor,expectedArtifact:generationExpected});
        }
      }
    }
  }catch(error){remember(error);}
  finally{
    cleaning=true;held.resolve();observeMeasure=false;phase=null;
    for(const [target,name,value]of [[proto,'measureText',originalMeasure],[proto,'fillText',originalFill],[proto,'setTransform',originalTransform],[canvasProto,'getContext',originalContext]])try{target[name]=value;}catch(error){cleanup(error,'native-method-restore-'+name);}
    try{restored=proto.measureText===originalMeasure&&proto.fillText===originalFill&&proto.setTransform===originalTransform&&canvasProto.getContext===originalContext;}catch(error){cleanup(error,'native-method-restoration-readback');}
    for(const field of fields)try{field.dispose();}catch(error){cleanup(error,'field-disposal');}
    for(const scope of scopes)try{scope.dispose();}catch(error){cleanup(error,'scope-disposal');}
    for(const lease of callerLeases)try{releaseCallerLease(lease);}catch(error){cleanup(error,'caller-lease-retirement');}
    for(const cache of caches){try{cache.dispose();await wait(cache.whenIdle(),'actual final cache idle');insist(zeroStatus(cache.getStatus()),'final-cache-zero',cache.getStatus());}catch(error){cleanup(error,'cache-disposal-and-idle');}}
    for(const engine of engines)try{await wait(engine.dispose(),'actual final Engine close');}catch(error){cleanup(error,'Engine-disposal');}
    for(const host of hosts)try{await wait(host.close(),'actual final Canvas host close');}catch(error){cleanup(error,'Canvas-host-close');}
    for(const surface of surfaces)try{retireSurface(surface,errors);}catch(error){remember(error);}
    if(reference)try{referenceRetirement=disposeReference(reference);}catch(error){cleanup(error,'reference-buffer-retirement');}
    if(faceAdded)try{insist(document.fonts.delete(face)&&!document.fonts.has(face),'owned-face-retirement');}catch(error){cleanup(error,'owned-face-retirement');}
    // Every actual observer actor is awaited; the parent collector owns the final deadline.
    if(actors.size)try{await wait(Promise.allSettled([...actors]),'actual remaining actor settlement');}catch(error){cleanup(error,'remaining-actor-settlement');}
  }
  const primary=errors.present?serialError(errors.value):null,cleanupFailures=errors.cleanup.map(({phase,value})=>({phase,error:serialError(value)}));
  const status=errors.present?(primary.outcome==='INCOMPLETE'?'INCOMPLETE':'FAIL'):mode==='omitFill'||mode==='omitOrigin'||mode==='noOp'?'PASS_ASSIGNED_CONTROL_SENSITIVITY':'PASS_WC1_CANVAS_SUBSET';
  return {schemaVersion:1,mode,status,failurePresent:errors.present,failurePhase:errors.phase,failure:primary,preJobReference:referenceAck?{ack:referenceAck,beforeFirstTargetAcquire:true}:null,rows,observations,counters,compilation,artifacts,cleanupFailures,witnessCompletion,
    retirement:{pendingActors:actors.size,providerPlansReleased:counters.issuedPlans===counters.release,nativeMethodsRestored:restored,ownedFaceDeleted:!document.fonts.has(face),reference:referenceRetirement,caches:caches.map(c=>c.getStatus()),engineClosePromisesSettled:engines.length},
    scope:{profile:'wc1-canvas-explicit-lines-v1',currentTextField:true,currentCanvas:true,currentTexturedWebGPU:false,nativeFontSubset:true,physicalMemory:false,performance:false,phones:false,CJK:false,Spine:false,fullUI:false,migration:false,publicAdoption:false}};
}
