// SPDX-License-Identifier: Apache-2.0
// Browser-only finite native lifetime fixture. Public SDK entries create Engines, assets and frames.
import * as sdk from '@egret/engine';
import * as webgl2 from '@egret/engine/webgl2';
import * as scene3d from '@egret/engine/scene3d';
import * as sceneWebgl2 from '@egret/engine/webgl2/scene3d';
const PROFILE='egret.shared-frame2d/1', OPERATION_MS=60000, TOTAL_MS=90000, MAX_EVENTS=128;
const requireValue=(value,reason)=>{if(!value)throw Error(reason);};
const observed=p=>{p.catch(()=>{});return p;};
function fault(value,depth=0){return {name:value?.name??'Unknown',code:value?.code??null,
  message:String(value?.message??value).slice(0,8000),cause:depth<3&&value?.cause!==undefined?fault(value.cause,depth+1):null};}
function status(host){const h=host.getStatus(),s=host.getSharedStatus();const f=x=>x===null?null:{...x,cause:fault(x.cause)};
  return {host:{...h,firstFailure:f(h.firstFailure),generationFailure:f(h.generationFailure),lastCallbackFailure:f(h.lastCallbackFailure)},
    shared:{pendingGeometryBytes:s.pendingGeometryBytes,pendingColorBytes:s.pendingColorBytes,pendingCanonicalBytes:s.pendingCanonicalBytes,retention:{...s.retention}},
    scene:typeof host.getSceneStatus==='function'?{pendingSceneBytes:host.getSceneStatus().pendingSceneBytes,pendingUniformBytes:host.getSceneStatus().pendingUniformBytes,pendingDepthBytes:host.getSceneStatus().pendingDepthBytes}:null};}
function idle(s){return s.host.pendingFrames===0&&s.host.pendingUploadBytes===0&&s.host.pendingReadbackBytes===0
  &&s.shared.pendingGeometryBytes===0&&s.shared.pendingColorBytes===0&&s.shared.pendingCanonicalBytes===0
  &&(!s.scene||Object.values(s.scene).every(x=>x===0))
  &&['reservedBytes','reservedEntries','unknownBytes','unknownEntries','unknownNativeBytes','unknownNativeObjects'].every(k=>s.shared.retention[k]===0);}
const material=color=>sdk.createSharedMaterial2D({light:[...color,1],dark:[0,0,0],blend:'normal',samplingDomain:'region',filter:'nearest',addressU:'clamp-to-edge',addressV:'clamp-to-edge',regionIsolation:'bounded',mipLevel:0,minFilter:'nearest',magFilter:'nearest',maxAnisotropy:1});
const options=scene=>({width:256,height:256,clearColor:0,clearAlpha:scene?1:0,outputAlpha:scene?'opaque':'premultiplied'});
function dirty(gl){
  // Assigned fixture-only contamination; this is not concurrent external work supported by the SDK lease.
  for(const cap of [gl.BLEND,gl.DEPTH_TEST,gl.STENCIL_TEST,gl.SCISSOR_TEST,gl.CULL_FACE,gl.DITHER,gl.RASTERIZER_DISCARD,gl.SAMPLE_ALPHA_TO_COVERAGE,gl.SAMPLE_COVERAGE,gl.POLYGON_OFFSET_FILL])gl.enable(cap);
  gl.colorMask(false,false,false,false);gl.depthMask(true);gl.depthFunc(gl.NEVER);gl.depthRange(0.25,0.75);
  gl.viewport(0,0,1,1);gl.scissor(0,0,1,1);gl.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT,gl.FUNC_SUBTRACT);gl.blendFuncSeparate(gl.ZERO,gl.ZERO,gl.ZERO,gl.ZERO);
  gl.activeTexture(gl.TEXTURE1);gl.useProgram(null);gl.bindVertexArray(null);
  for(const key of [gl.UNPACK_ROW_LENGTH,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_IMAGES,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_ROWS,gl.PACK_SKIP_PIXELS])gl.pixelStorei(key,1);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,8);gl.pixelStorei(gl.PACK_ALIGNMENT,8);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.BROWSER_DEFAULT_WEBGL);
  requireValue(gl.getError()===gl.NO_ERROR,'DIRTY_SETUP_GL_ERROR');
  return {rasterizerDiscard:gl.isEnabled(gl.RASTERIZER_DISCARD),scissorTest:gl.isEnabled(gl.SCISSOR_TEST),colorMask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK)),depthRange:Array.from(gl.getParameter(gl.DEPTH_RANGE)),viewport:Array.from(gl.getParameter(gl.VIEWPORT)),packAlignment:gl.getParameter(gl.PACK_ALIGNMENT),unpackAlignment:gl.getParameter(gl.UNPACK_ALIGNMENT)};
}
function depthScene(){
  const draws=[],identity=scene3d.createMatrix4([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const patch=(x,y,z,color)=>{const l=x/128-1,r=(x+48)/128-1,t=1-y/128,b=1-(y+48)/128;
    draws.push({geometry:scene3d.createMeshGeometry3D({positions:[l,t,z,r,t,z,l,b,z,r,b,z],colors:[...color,...color,...color,...color],indices:[0,1,2,2,1,3]}),modelView:identity});};
  patch(32,32,-0.5,[1,0,0]);patch(112,32,-1.5,[0,1,0]);patch(192,32,-2.5,[0,0,1]);
  patch(32,112,-3.5,[1,0,0]);patch(112,112,-1.5,[1,0,0]);patch(112,112,-2.5,[0,1,0]);
  patch(192,112,-2.5,[0,1,0]);patch(192,112,-1.5,[1,0,0]);patch(32,192,-3,[0,0,1]);patch(112,192,-1,[0,1,0]);
  return scene3d.createSceneFrame3D({projection:{kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3},draws});
}
export async function runLifetimeCase(def){
  const began=performance.now(),deadline=began+OPERATION_MS,cleanupDeadline=began+TOTAL_MS;
  const report={caseId:def.id,status:'INCOMPLETE',failure:null,contextAcquired:false,environment:{userAgent:navigator.userAgent,platform:navigator.platform,devicePixelRatio,explicitPixelRatio:1},contextEvents:[],hostDiagnostics:[],engineDiagnostics:[],observations:[],checks:[],overflow:false,cleanup:{failures:[],scopeClosed:false,engineClosed:false,hostClosed:false,pendingActors:[]}};
  let host,engine,scope,canvas,gl,texture,lease,node,engineClose,hostClose,closing=false,providerDisposals=0,actor=0;
  const pending=new Map(),eventWaiters=new Set();
  const record=(list,value)=>{if(list.length<MAX_EVENTS)list.push(value);else report.overflow=true;};
  const check=(name,value,details=null)=>{record(report.checks,{name,pass:!!value,details});requireValue(value,name);};
  const track=(label,promise)=>{const id=++actor,value=Promise.resolve(promise);pending.set(id,{label,value});observed(value.then(()=>pending.delete(id),()=>pending.delete(id)));return observed(value);};
  async function bounded(label,promise,until=deadline){const work=track(label,promise),remaining=until-performance.now();requireValue(remaining>0,'DEADLINE:'+label);let timer;
    try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DEADLINE:'+label)),remaining);})]);}finally{clearTimeout(timer);}}
  function event(type,until){return track(type,new Promise((resolve,reject)=>{
    let timer;const cancel=()=>{clearTimeout(timer);canvas.removeEventListener(type,done);eventWaiters.delete(cancel);reject(Error('EVENT_CANCELLED:'+type));};
    const done=e=>{clearTimeout(timer);canvas.removeEventListener(type,done);eventWaiters.delete(cancel);resolve(e);};
    eventWaiters.add(cancel);canvas.addEventListener(type,done);timer=setTimeout(cancel,Math.max(0,until-performance.now()));}));}
  const nextTask=()=>bounded('next event-loop task',new Promise(resolve=>setTimeout(resolve,0)));
  const closeHost=()=>hostClose??=track('host.close',Promise.resolve().then(()=>host.close()));
  const closeEngine=()=>engineClose??=track('engine.dispose',Promise.resolve().then(()=>engine.dispose()));
  const events=e=>record(report.contextEvents,{type:e.type,at:performance.now(),trusted:e.isTrusted,defaultPrevented:e.defaultPrevented,isContextLost:gl.isContextLost(),host:status(host)});
  async function rejected(label,promise,code){const result=await bounded(label,observed(Promise.resolve(promise).then(()=>({fulfilled:true}),reason=>({fulfilled:false,reason:fault(reason)}))));check(label,!result.fulfilled&&result.reason.code===code,result);return result;}
  async function retain(id,result,kind='sdk'){
    requireValue(result.bytes instanceof Uint8Array&&result.bytes.length===262144&&result.width===256&&result.height===256,'READBACK_BYTES');
    requireValue(result.format==='rgba8unorm'&&result.sourceFormat==='rgba8unorm'&&result.colorSpace==='srgb','READBACK_REPRESENTATION');
    const {bytes,...metadata}=result;record(report.observations,{id,kind,...metadata});
    await bounded('retain:'+id,globalThis.__retainLifetimeObservation({caseId:def.id,id,kind,readback:{...metadata,bytes:Array.from(bytes)}}));
  }
  const meta=(frame,serial,generation,bytes)=>({width:256,height:256,format:'rgba8unorm',sourceFormat:'rgba8unorm',colorSpace:'srgb',alphaMode:frame.outputAlpha,frameId:frame.frameId,serial,generation,bytes});
  function readDefault(frame){const raw=new Uint8Array(262144);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.readBuffer(gl.BACK);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,raw);requireValue(gl.getError()===gl.NO_ERROR,'IMMEDIATE_DEFAULT_B_GL_ERROR');
    const top=new Uint8Array(raw.length);for(let y=0;y<256;y++)top.set(raw.subarray(y*1024,(y+1)*1024),(255-y)*1024);return meta(frame,2,1,top);}
  try{
    canvas=document.querySelector('#shared');check('REAL_CANVAS',canvas instanceof HTMLCanvasElement);
    const rect=canvas.getBoundingClientRect();check('FIXED_SURFACE',canvas.width===256&&canvas.height===256&&rect.width===256&&rect.height===256&&innerWidth===256&&innerHeight===256);
    requireValue(typeof globalThis.__retainLifetimeObservation==='function','COLLECTOR_BINDING');
    host=(def.scene?sceneWebgl2.createSharedSceneWebGL2Host:webgl2.createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:def.scene?'opaque':'premultiplied',enableReadback:true,onDiagnostic:d=>record(report.hostDiagnostics,{...d,cause:fault(d.cause)})});
    const startup=sdk.createEngineForProfile({host,shutdownTimeoutMs:20000,onDiagnostic:d=>record(report.engineDiagnostics,{...d,cause:fault(d.cause)})},PROFILE).then(value=>{engine=value;if(closing)observed(closeEngine());return value;});
    await bounded('createEngineForProfile',startup);gl=canvas.getContext('webgl2');check('REAL_CONTEXT',gl&&!gl.isContextLost());report.contextAcquired=true;
    report.context={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),attributes:gl.getContextAttributes(),alignment:gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT)};
    check('CONTEXT_QUERY_NO_ERROR',gl.getError()===gl.NO_ERROR);canvas.addEventListener('webglcontextlost',events);canvas.addEventListener('webglcontextrestored',events);
    check('GENUINE_ENGINE_STAGE',engine instanceof sdk.Engine&&engine.stage instanceof sdk.Stage);scope=engine.createScope();
    const image=sdk.createImageData2D({width:1,height:1,pixels:new Uint8Array([255,255,255,255])});
    texture=sdk.createTextureView(image,{packed:{x:0,y:0,width:1,height:1},logicalWidth:1,logicalHeight:1,trimX:0,trimY:0,quarterTurn:0});
    const type=sdk.createAssetType('native-gl-lifetime-texture',sdk.isTexture);engine.assets.register(type,{async load(){return texture;},dispose(value){check('PROVIDER_SAME_TEXTURE',value===texture);providerDisposals++;value.dispose();}});
    lease=await bounded('asset.acquire',engine.assets.acquire(sdk.createAssetRef(type,'white'),{signal:scope.signal}).then(value=>{lease=value;if(closing)value.release();return value;}));scope.use(lease);
    const geometry=sdk.createSharedGeometry2D({positions:new Float64Array([32,32,96,32,32,96,96,96]),uvs:new Float64Array([.5,.5,.5,.5,.5,.5,.5,.5]),lightColors:new Float64Array([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]),darkColors:new Float64Array(12),indices:new Uint32Array([0,1,2,2,1,3])});
    node=scope.use(new sdk.Mesh2D(lease,geometry));node.sharedMaterial=material([1,0,0]);engine.stage.addChild(node);
    const makeB=()=>{node.x=128;node.sharedMaterial=material([0,1,0]);};
    const identity={engine,stage:engine.stage,scope,clock:engine.clock,assets:engine.assets,signal:scope.signal};
    const ticks=[];const subscription=engine.clock.onTick(scope,tick=>{record(ticks,{...tick});return undefined;});
    engine.advanceTime(10);engine.advanceTime(10.125);
    const identityCheck=label=>check(label,engine===identity.engine&&engine.stage===identity.stage&&scope===identity.scope&&engine.clock===identity.clock&&engine.assets===identity.assets&&scope.signal===identity.signal&&scope.state==='open'&&!scope.signal.aborted&&!subscription.isDisposed&&node.parent===engine.stage&&!texture.isDisposed&&providerDisposals===0&&engine.clock.state==='running'&&engine.clock.tickId===1&&engine.clock.elapsedSeconds===.125&&ticks.length===1);
    if(def.id==='L01-immediate-dirty'){
      report.dirtyState=dirty(gl);check('DIRTY_STATE_OBSERVED',report.dirtyState.rasterizerDiscard&&report.dirtyState.scissorTest&&report.dirtyState.colorMask.every(v=>!v));
      let aSettled=false;const ticketA=track('ticket-A',host.requestReadback());observed(ticketA.then(()=>{aSettled=true;},()=>{aSettled=true;}));
      const frameA=engine.renderSharedFrame(options(false));const afterA=status(host);makeB();const frameB=engine.renderSharedFrame(options(false));const afterB=status(host);
      check('TWO_IMMEDIATE_ACCEPTED_BEFORE_A_SETTLES',!aSettled&&afterA.host.pendingFrames===1&&afterA.host.lastSerial===1&&afterB.host.pendingFrames===2&&afterB.host.lastSerial===2&&frameB.frameId===frameA.frameId+1,{afterA,afterB,frameA:frameA.frameId,frameB:frameB.frameId});
      // Same JavaScript task: preserve B's current presentation before any browser clearing opportunity.
      const defaultB=readDefault(frameB);const resultA=await bounded('delayed ticket-A',ticketA);await bounded('two-frame idle',host.whenIdle());
      check('A_TICKET_KEEPS_ORIGINAL_METADATA',resultA.frameId===frameA.frameId&&resultA.serial===1&&resultA.generation===1);
      await retain('ticket-A',resultA);await retain('default-B',defaultB,'native-default-same-task');
      const ticketB=track('ticket-B',host.requestReadback());const replayB=engine.renderSharedFrame(options(false));const resultB=await bounded('ticket-B',ticketB);await bounded('replay-B idle',host.whenIdle());
      check('FRESH_B_TICKET_METADATA',resultB.frameId===replayB.frameId&&resultB.serial===3&&resultB.generation===1);await retain('ticket-B',resultB);
      identityCheck('IDENTITIES_CLOCK_UNCHANGED_AFTER_DOUBLE');
    }else if(def.scene){
      // Retain a genuine asset/node in Scope but exclude it from this fixed B1 overlay.
      node.visible=false;const overlay=engine.captureSharedFrame(options(true)),scene=depthScene(),ticket=track('depth-ticket',host.requestReadback());
      host.renderSceneSharedFrame(scene,overlay);const result=await bounded('depth readback',ticket);await bounded('depth idle',host.whenIdle());
      check('GENUINE_B1_METADATA',result.frameId===overlay.frameId&&result.serial===1&&result.generation===1&&scene.draws.length===10&&overlay.commands.length===0);await retain('depth',result);
      identityCheck('IDENTITIES_CLOCK_UNCHANGED_AFTER_DEPTH');
    }else{
      const extension=gl.getExtension('WEBGL_lose_context');check('REAL_LOSS_EXTENSION',!!extension);
      const oldTicket=track('old readback',host.requestReadback()),saved=engine.renderSharedFrame(options(false)),oldIdle=track('old idle',host.whenIdle());
      const before=status(host);check('LOSS_HAS_ACCEPTED_PENDING_RECORD',before.host.pendingFrames===1&&before.host.lastSerial===1&&before.host.generation===1,before);
      let ordinaryTimerCount=0,timerState;let timerResolve;const ordinaryTimer=track('ordinary Host timer',new Promise(resolve=>{timerResolve=resolve;}));
      const cancelOrdinary=host.setTimeout(()=>{ordinaryTimerCount++;timerState=host.getStatus().state;timerResolve(true);},250);
      // Own this test timer even if an earlier assertion fails.
      scope.use({dispose(){cancelOrdinary();timerResolve(false);}});
      const lossRequestedAt=performance.now(),lossEvent=event('webglcontextlost',Math.min(deadline,lossRequestedAt+5000));extension.loseContext();check('ACTUAL_LOST_SYNCHRONOUSLY',gl.isContextLost());
      const lost=await bounded('real loss event',lossEvent);check('TRUSTED_CANCELED_LOSS',lost.isTrusted&&lost.defaultPrevented&&gl.isContextLost());
      report.loss={requestedAt:lossRequestedAt,observedAt:performance.now(),status:status(host)};
      check('HOST_LOST',host.getStatus().state==='lost');await rejected('OLD_READBACK_REJECTS',oldTicket,'WEBGL2_CONTEXT_LOST');await rejected('OLD_IDLE_REJECTS',oldIdle,'WEBGL2_CONTEXT_LOST');
      const ready=track('generation readiness',host.whenReady());check('SHARED_READY_PROMISE',ready===host.whenReady()&&host.whenReady()===host.whenReady());
      identityCheck('IDENTITIES_CLOCK_PRESERVED_WHILE_LOST');makeB();const liveCapture=engine.captureSharedFrame(options(false));check('PURE_CAPTURE_WHILE_LOST',liveCapture.frameId===saved.frameId+1);
      if(def.closeRace){await bounded('close before restore',closeHost());await rejected('READY_REJECTED_BY_CLOSE',ready,'WEBGL2_CLOSED');check('CLOSED_BEFORE_RESTORE',host.getStatus().state==='closed'&&host.getStatus().cleanupOutcome==='safe');}
      // A new task is mandatory: restoreContext during the loss event microtask is invalid.
      await nextTask();const restoreDeadline=lossRequestedAt+10000;check('RESTORE_REQUEST_WITHIN_ORIGINAL_DEFAULT_DEADLINE',performance.now()<restoreDeadline);
      const restoredEvent=event('webglcontextrestored',Math.min(deadline,restoreDeadline));report.restore={requestedAt:performance.now(),requestCount:1};extension.restoreContext();
      const restored=await bounded('real restored event',restoredEvent);report.restore.observedAt=performance.now();
      check('TRUSTED_ACTUAL_RESTORE',restored.isTrusted&&!gl.isContextLost()&&canvas.getContext('webgl2')===gl&&report.restore.observedAt<=restoreDeadline);
      if(def.closeRace){
        await nextTask();await nextTask();const after=status(host);check('NO_RESURRECTION_AFTER_ACTUAL_RESTORE',after.host.state==='closed'&&after.host.generation===1&&after.host.lastSerial===1&&after.host.cleanupOutcome==='safe'&&idle(after)&&Object.values(after.shared.retention).every(v=>v===0),after);
        await rejected('LATE_READY_REFUSED',host.whenReady(),'WEBGL2_CLOSED');await rejected('LATE_READBACK_REFUSED',host.requestReadback(),'WEBGL2_CLOSED');
        let cause;try{host.renderSharedFrame(saved);}catch(value){cause=value;}check('LATE_SAVED_DRAW_REFUSED',cause?.code==='WEBGL2_CLOSED',fault(cause));
        report.closeRace={afterActualRestore:after};identityCheck('ENGINE_IDENTITIES_SURVIVE_HOST_CLOSE');
      }else{
        await bounded('restored ready',ready,Math.min(deadline,restoreDeadline));const after=status(host);check('FRESH_GENERATION_PUBLISHED',after.host.state==='active'&&after.host.generation===2&&after.host.generationFailure===null&&after.host.firstFailure?.code==='WEBGL2_CONTEXT_LOST'&&idle(after),after);
        identityCheck('IDENTITIES_CLOCK_PRESERVED_AFTER_RESTORE');
        const replayTicket=track('saved replay ticket',host.requestReadback());host.renderSharedFrame(saved);const replay=await bounded('saved replay readback',replayTicket);await bounded('saved replay idle',host.whenIdle());
        check('SAVED_FRAME_NEW_GENERATION_METADATA',replay.frameId===saved.frameId&&replay.serial===2&&replay.generation===2);await retain('restored-saved-A',replay);
        const freshTicket=track('fresh frame ticket',host.requestReadback()),fresh=engine.renderSharedFrame(options(false));const freshReadback=await bounded('fresh readback',freshTicket);await bounded('fresh idle',host.whenIdle());
        check('CONTINUING_ENGINE_FRAME_SEQUENCE',fresh.frameId===liveCapture.frameId+1&&freshReadback.frameId===fresh.frameId&&freshReadback.serial===3&&freshReadback.generation===2);await retain('restored-live-B',freshReadback);
        identityCheck('CLOCK_NOT_ADVANCED_BY_RECOVERY_OR_REPLAY');
        const tick=engine.advanceTime(10.25);check('SAME_CLOCK_AND_SUBSCRIPTION_CONTINUE',tick.tickId===2&&tick.elapsedSeconds===.25&&tick.deltaSeconds===.125&&ticks.length===2);
        report.recovery={afterReady:after,savedFrameId:saved.frameId,capturedWhileLost:liveCapture.frameId,freshFrameId:fresh.frameId,ticks};
      }
      await bounded('ordinary timer survived',ordinaryTimer);check('ORDINARY_HOST_TIMER_SURVIVES_LOSS',ordinaryTimerCount===1,{ordinaryTimerCount,timerState});
      check('EXACT_REAL_EVENT_PAIR',report.contextEvents.length===2&&report.contextEvents[0].type==='webglcontextlost'&&report.contextEvents[1].type==='webglcontextrestored'&&report.contextEvents.every(e=>e.trusted));
    }
    report.beforeCleanup=status(host);check('IDLE_AND_NO_UNKNOWN_OWNERS',idle(report.beforeCleanup),report.beforeCleanup);
    check('NO_CALLBACK_FAILURES',report.beforeCleanup.host.callbackFailureCount===0&&report.engineDiagnostics.length===0);
    if(def.loss)check('ONLY_EXPECTED_CONTEXT_LOSS_DIAGNOSTIC',report.hostDiagnostics.length===1&&report.hostDiagnostics[0].code==='WEBGL2_CONTEXT_LOST');
    else check('NO_UNEXPECTED_CONTEXT_OR_DIAGNOSTIC',report.contextEvents.length===0&&report.hostDiagnostics.length===0&&report.beforeCleanup.host.firstFailure===null);
    check('ALL_OBSERVATIONS_RETAINED',report.observations.length===def.observations.length);report.status='COMPLETE';
  }catch(cause){report.failure=fault(cause);}
  finally{
    closing=true;const cleanupFailure=(label,cause)=>record(report.cleanup.failures,{label,...fault(cause)});
    if(scope)try{scope.dispose();report.cleanup.scopeClosed=scope.state==='closed';}catch(cause){cleanupFailure('scope.dispose',cause);}
    if(engine)try{await bounded('engine.dispose wait',closeEngine(),cleanupDeadline);report.cleanup.engineClosed=true;}catch(cause){cleanupFailure('engine.dispose',cause);}
    if(host)try{await bounded('host.close wait',closeHost(),cleanupDeadline);}catch(cause){cleanupFailure('host.close',cause);}
    for(const cancel of [...eventWaiters])cancel();
    try{while(pending.size&&performance.now()<cleanupDeadline)await bounded('settle actors',Promise.allSettled([...pending.values()].map(row=>row.value)),cleanupDeadline);}catch(cause){cleanupFailure('settle actors',cause);}
    if(host)try{const s=status(host);report.cleanup.final=s;report.cleanup.hostClosed=s.host.state==='closed'&&s.host.cleanupOutcome==='safe'&&idle(s)&&Object.values(s.shared.retention).every(v=>v===0);if(!report.cleanup.hostClosed)throw Error('SAFE_CLOSE_UNPROVEN');}catch(cause){cleanupFailure('final status',cause);}
    if(texture)try{if(!texture.isDisposed)texture.dispose();report.cleanup.texture={disposed:texture.isDisposed,providerDisposals};if(lease&&providerDisposals!==1)throw Error('PROVIDER_DISPOSAL_UNPROVEN');}catch(cause){cleanupFailure('texture',cause);}
    if(canvas){canvas.removeEventListener('webglcontextlost',events);canvas.removeEventListener('webglcontextrestored',events);}
    report.cleanup.pendingActors=[...pending.values()].map(row=>row.label);
    // Diagnostics and native events can arrive while asynchronous close settles.
    // Recheck the retained lifetime evidence only after final owner cleanup and listener removal.
    const finalHost=report.cleanup.final?.host;
    const finalEventsValid=def.loss
      ? report.contextEvents.length===2&&report.contextEvents[0].type==='webglcontextlost'
        &&report.contextEvents[0].trusted&&report.contextEvents[0].defaultPrevented&&report.contextEvents[0].isContextLost
        &&report.contextEvents[1].type==='webglcontextrestored'&&report.contextEvents[1].trusted&&!report.contextEvents[1].isContextLost
      : report.contextEvents.length===0;
    const finalDiagnosticsValid=report.engineDiagnostics.length===0&&finalHost?.callbackFailureCount===0&&finalHost.lastCallbackFailure===null
      &&(def.loss?report.hostDiagnostics.length===1&&report.hostDiagnostics[0].code==='WEBGL2_CONTEXT_LOST':report.hostDiagnostics.length===0);
    report.cleanup.finalLifetimeEvidence={eventsValid:finalEventsValid,diagnosticsValid:finalDiagnosticsValid};
    if(!finalEventsValid||!finalDiagnosticsValid)report.status='INCOMPLETE';
    if(!report.cleanup.scopeClosed||!report.cleanup.engineClosed||!report.cleanup.hostClosed||report.cleanup.failures.length||report.cleanup.pendingActors.length||report.overflow)report.status='INCOMPLETE';
    report.elapsedMs=performance.now()-began;
  }
  return report;
}
