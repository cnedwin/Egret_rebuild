// SPDX-License-Identifier: Apache-2.0
// Genuine public anchor offsets/local clip and exact same-live saved baseline; no PNG or SDK.
import * as egret from '@egret/engine';

const FRAME = Object.freeze({ width:24, height:24, clearColor:0, clearAlpha:0 });
const handled = value => { const promise=Promise.resolve(value); promise.catch(()=>undefined); return promise; };
const errorData = cause => ({ occurrence:true, undefined:cause===undefined,
  name:cause?.name??null, code:cause?.code??null, message:String(cause?.message??cause) });
function check(condition,message,code='AO_NATIVE_ASSERTION') {
  if(!condition)throw Object.assign(new Error(message),{code});
}

/** Host namespace comes from the selected public entry, keeping Canvas GPU-free. */
export function createDisplayAnchorOffsetsFixture({backend,hostEntry}) {
  check(['canvas','webgpu'].includes(backend),'One explicit ordinary backend');
  const createHost=backend==='canvas'?hostEntry.createCanvasHost:hostEntry.createWebGPUHost;
  check(typeof createHost==='function','Actual public ordinary host factory');
  let started=false,closing=false,operationDeadline,cleanupDeadline,closePromise,scope,red,savedFrame,originalEngine,mode='main';
  let nextStep=0,newCaptures=0,savedReplays=0,primaryOccurred=false,primary;
  const pending=new Set(),tickets=[],cleanupErrors=[],diagnostics=[],ports=[];
  const fail=cause=>{if(!primaryOccurred){primaryOccurred=true;primary=cause;}return cause;};
  function track(value,label,register) {
    const promise=handled(value),row={id:tickets.length+1,label,settled:false};tickets.push(row);pending.add(promise);
    handled(promise.then(value=>{row.settled=true;row.fulfilled=true;pending.delete(promise);
      try{register?.(value);}catch(cause){fail(cause);}},cause=>{
      row.settled=true;row.fulfilled=false;row.error=errorData(cause);pending.delete(promise);}));return promise;
  }
  async function bounded(value,label,cleanup=false) {
    const promise=handled(value),delay=Math.min(20000,(cleanup?cleanupDeadline:operationDeadline)-Date.now());
    check(delay>0,label+' deadline expired','AO_NATIVE_DEADLINE');let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(
      Object.assign(new Error(label+' pending'),{code:'AO_NATIVE_TIMEOUT'})),delay);})]);}
    finally{clearTimeout(timer);}
  }
  function status(port) {
    if(backend!=='webgpu'||!port?.host)return null;
    const value=port.host.getStatus();return {state:value.state,pendingFrames:value.pendingFrames,
      pendingUploadBytes:value.pendingUploadBytes,pendingReadbackBytes:value.pendingReadbackBytes,cleanupOutcome:value.cleanupOutcome};
  }
  function treeState() {
    if(!red)return null;
    const stage=originalEngine.stage;
    return {stageIds:Array.from({length:stage.numChildren},(_,i)=>stage.getChildAt(i)===red?'red':'unknown'),
      redParent:red.parent===stage?'stage':'other',allSceneNodesLive:!red.isDisposed,scopeState:scope.state,
      stage:{x:stage.x,y:stage.y,scaleX:stage.scaleX,scaleY:stage.scaleY,rotation:stage.rotation,
        anchorOffsetX:stage.anchorOffsetX,anchorOffsetY:stage.anchorOffsetY},
      red:{x:red.x,y:red.y,scaleX:red.scaleX,scaleY:red.scaleY,rotation:red.rotation,
        anchorOffsetX:red.anchorOffsetX,anchorOffsetY:red.anchorOffsetY,clipRect:red.clipRect===undefined?null:{...red.clipRect}},
      ownBounds:{...red.getBounds()}};
  }
  function snapshot() {
    return {backend,mode,primaryOccurred,primary:primaryOccurred?errorData(primary):null,cleanupErrors:cleanupErrors.map(errorData),
      pendingTickets:pending.size,tickets:tickets.map(r=>({...r})),newCaptures,savedReplays,sourceImages:[],scopeState:scope?.state??null,
      allSceneNodesDisposed:red!==undefined&&red.isDisposed,
      diagnostics:[...diagnostics],ports:ports.map(p=>({id:p.id,renderSubmissions:p.renderSubmissions,
        close:p.closeState,safeHostReturn:p.safeHostReturn,engineDisposeFulfilled:p.engineDisposeFulfilled,
        deviceDestroyed:p.deviceDestroyed,deviceLoss:p.deviceLoss??null,quarantine:p.quarantine??false,hostStatus:status(p)}))};
  }
  async function openPort() {
    check(!closing&&ports.length===0,'One genuine Engine/host per backend');
    const port={id:0,renderSubmissions:0,closeState:'not-started',safeHostReturn:false,engineDisposeFulfilled:false,
      deviceDestroyed:false,startups:new Set(),native:new Set()};ports.push(port);
    port.canvas=document.createElement('canvas');port.canvas.width=24;port.canvas.height=24;
    port.canvas.style.cssText='display:block;width:24px;height:24px;transform:none;border:0;padding:0;margin:0;background:transparent';
    document.body.appendChild(port.canvas);
    port.startup=handled((async()=>{
      if(backend==='webgpu') {
        check(isSecureContext&&navigator.gpu,'Default WebGPU unavailable','AO_NATIVE_UNAVAILABLE');
        const adapter=await bounded(track(navigator.gpu.requestAdapter(),'requestAdapter'),'default adapter');
        check(adapter!==null&&!closing,'No adapter or closing setup','AO_NATIVE_UNAVAILABLE');
        const acquire=track(adapter.requestDevice(),'requestDevice',device=>{
          port.device=device;port.lost=handled(device.lost);port.uncaptured=event=>fail(event.error);
          device.addEventListener('uncapturederror',port.uncaptured);
          handled(port.lost.then(loss=>{port.deviceLoss={reason:loss.reason,message:loss.message};
            if(!port.intentionalDestroy)fail(Object.assign(new Error('Unexpected device loss'),{code:'AO_NATIVE_DEVICE_LOST'}));},fail));
        });
        port.startups.add(acquire);handled(acquire.finally(()=>port.startups.delete(acquire)));
        await bounded(acquire,'default device');check(!closing,'Late device is retained for retirement');
        port.host=createHost({canvas:port.canvas,device:{kind:'borrow',device:port.device},pixelRatio:1,maxBackingPixels:576,
          enableReadback:true,onDiagnostic:value=>{diagnostics.push(errorData(value.cause));fail(value.cause);}});
      }else port.host=createHost({canvas:port.canvas,pixelRatio:1,maxBackingPixels:576});
      const acquire=track(egret.createEngine({host:port.host,shutdownTimeoutMs:20000,
        onDiagnostic:value=>{diagnostics.push(errorData(value.cause));fail(value.cause);}}),'createEngine',engine=>{port.engine=engine;});
      port.startups.add(acquire);handled(acquire.finally(()=>port.startups.delete(acquire)));
      await bounded(acquire,'genuine Engine and host startup');check(!closing,'Late Engine is retained for retirement');return port;
    })());
    await port.startup;return port;
  }
  function retire(port) {
    if(port.closePromise)return port.closePromise;port.closeState='pending';
    port.closePromise=handled((async()=>{
      try {
        // Timeout is observation only: drain original ownership before host/device release.
        await bounded(Promise.allSettled([port.startup,...port.startups,...port.native]),'original startup/native settlement',true);
        check(port.startups.size===0&&port.native.size===0,'Original native ticket remains','AO_NATIVE_CLOSE_UNSAFE');
        if(port.engine){await bounded(track(port.engine.dispose(),'Engine.dispose'),'genuine Scope/host retirement',true);port.engineDisposeFulfilled=true;}
        else if(port.host)await bounded(track(port.host.close(),'host.close'),'unattached host retirement',true);
        const state=status(port);port.safeHostReturn=!port.host||backend==='canvas'||state.state==='closed'
          &&state.cleanupOutcome==='safe'&&state.pendingFrames===0&&state.pendingUploadBytes===0&&state.pendingReadbackBytes===0;
        check(port.safeHostReturn,'Unsafe host retirement','AO_NATIVE_CLOSE_UNSAFE');
        if(port.device){port.intentionalDestroy=true;port.device.destroy();port.deviceDestroyed=true;
          await bounded(port.lost,'owned device destroyed loss',true);check(port.deviceLoss?.reason==='destroyed','Owned device loss reason','AO_NATIVE_CLOSE_UNSAFE');
          port.device.removeEventListener('uncapturederror',port.uncaptured);}
        port.canvas.width=0;port.canvas.height=0;port.canvas.remove();port.closeState='fulfilled';
      }catch(cause){port.quarantine=true;port.closeState='rejected';throw cause;}
    })());return port.closePromise;
  }
  function rectangle() {
    const node=scope.use(new egret.Sprite());node.x=8;node.y=8;
    node.graphics.beginFill(0xff0000).drawRect(0,0,8,6).endFill();return node;
  }
  function sceneLive() {
    const stage=originalEngine.stage;
    check(stage.numChildren===1&&stage.getChildAt(0)===red&&red.parent===stage,'Exact public stage/parent edge');
    check(!red.isDisposed&&!stage.isDisposed&&scope.state==='open','Genuine live Scope-owned scene');
    check(stage.x===0&&stage.y===0&&stage.scaleX===1&&stage.scaleY===1&&stage.rotation===0
      &&stage.anchorOffsetX===0&&stage.anchorOffsetY===0,'Identity Stage without transformed parent');
    check(red.x===8&&red.y===8&&red.scaleY===1&&red.rotation===0,'Authored red geometry stays unchanged');
  }
  async function start(deadlines) {
    check(!started&&!closing,'Start once');started=true;operationDeadline=deadlines.operationDeadline;cleanupDeadline=deadlines.cleanupDeadline;mode=deadlines.mode??'main';
    check(['main','wrong-pivot-control'].includes(mode)&&Number.isSafeInteger(operationDeadline)&&Number.isSafeInteger(cleanupDeadline)&&operationDeadline>Date.now()&&cleanupDeadline>operationDeadline,'Finite deadlines and explicit mode');
    try {const port=await openPort();
      for(const key of ['anchorOffsetX','anchorOffsetY']) {
        const descriptor=Object.getOwnPropertyDescriptor(egret.DisplayObject.prototype,key);
        check(descriptor&&typeof descriptor.get==='function'&&typeof descriptor.set==='function','Genuine inherited anchor accessors required');
      }
      originalEngine=port.engine;scope=port.engine.createScope();red=rectangle();port.engine.stage.addChild(red);
      check(red.anchorOffsetX===0&&red.anchorOffsetY===0&&red.scaleX===1&&red.clipRect===undefined,'Fresh genuine baseline');
      sceneLive();return snapshot();
    }catch(cause){throw fail(cause);}
  }
  async function collectStep(step) {
    check(started&&!closing&&(mode==='main'?['N1','N2','N3','N4','N5']:['N1','C1'])[nextStep]===step,'Exact finite genuine step sequence');
    try {const port=ports[0];let frame;
      if(step==='N2'){red.anchorOffsetX=4;red.anchorOffsetY=3;}
      if(step==='N3'){red.scaleX=2;red.scaleY=1;}
      if(step==='N4')red.clipRect={x:0,y:0,width:4,height:6};
      if(step==='C1'){red.anchorOffsetX=0;red.anchorOffsetY=0;}
      sceneLive();
      check(red.anchorOffsetX===(step==='N1'||step==='C1'?0:4)&&red.anchorOffsetY===(step==='N1'||step==='C1'?0:3),'Actual assigned pivot');
      check(red.scaleX===(['N3','N4','N5'].includes(step)?2:1),'Actual assigned scale');
      const clipped=step==='N4'||step==='N5';
      check(clipped?red.clipRect?.x===0&&red.clipRect.y===0&&red.clipRect.width===4&&red.clipRect.height===6:red.clipRect===undefined,'Current local clip persists through saved replay');
      if(step==='N5'){frame=savedFrame;savedReplays++;check(frame===savedFrame,'Exact saved baseline identity');}
      else{frame=port.engine.captureFrame(FRAME);newCaptures++;if(step==='N1')savedFrame=frame;}
      check(frame.commands.length===1&&frame.commands[0].kind==='rect'&&frame.images===undefined,'Actual one opaque rectangle capture');
      const command=frame.commands[0];
      let raw,metadata;
      if(backend==='webgpu') {
        const ticket=track(port.host.requestReadback(),'original WebGPU raw readback');port.native.add(ticket);
        handled(ticket.finally(()=>port.native.delete(ticket)));
        check(port.host.renderFrame(frame)===undefined,'Synchronous ordinary host submission');port.renderSubmissions++;
        const idle=track(port.host.whenIdle(),'original WebGPU idle');port.native.add(idle);handled(idle.finally(()=>port.native.delete(idle)));
        const [result]=await bounded(Promise.all([ticket,idle]),'original native readback and idle');raw=Array.from(result.bytes);
        metadata={width:result.width,height:result.height,byteLength:result.bytes.byteLength,format:result.format,
          sourceFormat:result.sourceFormat,colorSpace:result.colorSpace,alphaMode:result.alphaMode,origin:'top-left',hostStatus:status(port)};
      }else{
        check(port.host.renderFrame(frame)===undefined,'Synchronous ordinary host submission');port.renderSubmissions++;
        const result=port.canvas.getContext('2d').getImageData(0,0,24,24,{colorSpace:'srgb'});raw=Array.from(result.data);
        metadata={width:result.width,height:result.height,byteLength:result.data.byteLength,format:'rgba8unorm',sourceFormat:null,
          colorSpace:result.colorSpace,alphaMode:'straight',origin:'top-left',hostStatus:null};
      }
      const box=port.canvas.getBoundingClientRect();nextStep++;
      return {backend,step,raw,metadata,css:{width:box.width,height:box.height,backingWidth:port.canvas.width,
        backingHeight:port.canvas.height,devicePixelRatio},frame:{frameId:frame.frameId,width:frame.width,height:frame.height,
        commands:frame.commands.length,images:0,kind:command.kind,
        matrix:{...command.matrix},clips:command.clips.map(clip=>({rect:{...clip.rect},matrix:{...clip.matrix},frozen:Object.isFrozen(clip)})),
        frozen:Object.isFrozen(frame)&&Object.isFrozen(frame.commands)&&Object.isFrozen(command)&&Object.isFrozen(command.matrix)&&Object.isFrozen(command.clips)},
        exactSavedN1:step==='N5'?frame===savedFrame:null,sameEngineAlive:port.engine===originalEngine&&!port.engineDisposeFulfilled&&scope.state==='open'&&!port.engine.stage.isDisposed,
        tree:treeState(),snapshot:snapshot()};
    }catch(cause){throw fail(cause);}
  }
  function close() {
    if(closePromise)return closePromise;closing=true;closePromise=handled((async()=>{
      for(const port of [...ports].reverse())try{await retire(port);}catch(cause){cleanupErrors.push(cause);}
      try{await bounded(Promise.allSettled([...pending]),'all original tickets',true);}catch(cause){cleanupErrors.push(cause);}
      if(pending.size||ports.some(port=>port.quarantine))cleanupErrors.push(Object.assign(new Error('Unsettled or quarantined native ownership'),{code:'AO_NATIVE_CLOSE_UNSAFE'}));
      // Retire an immediately owned CPU wrapper after all genuine ownership settled; unsafe ownership remains quarantined.
      // Genuine Scope-owned Sprites retire through their original Engine/Scope owner.
      return snapshot();
    })());return closePromise;
  }
  return Object.freeze({start,collectStep,close});
}
