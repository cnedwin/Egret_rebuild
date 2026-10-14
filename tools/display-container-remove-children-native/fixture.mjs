// SPDX-License-Identifier: Apache-2.0
// Genuine public Engine/Scope tree and ordinary frames; no PNG, texture or SDK.
import * as egret from '@egret/engine';

const FRAME = Object.freeze({ width:24, height:24, clearColor:0, clearAlpha:0 });
const handled = value => { const promise=Promise.resolve(value); promise.catch(()=>undefined); return promise; };
const errorData = cause => ({ occurrence:true, undefined:cause===undefined,
  name:cause?.name??null, code:cause?.code??null, message:String(cause?.message??cause) });
function check(condition,message,code='DCA_NATIVE_ASSERTION') {
  if(!condition)throw Object.assign(new Error(message),{code});
}

/** Host namespace comes from the selected public entry, keeping Canvas GPU-free. */
export function createDisplayContainerRemoveChildrenFixture({backend,hostEntry}) {
  check(['canvas','webgpu'].includes(backend),'One explicit ordinary backend');
  const createHost=backend==='canvas'?hostEntry.createCanvasHost:hostEntry.createWebGPUHost;
  check(typeof createHost==='function','Actual public ordinary host factory');
  let started=false,closing=false,operationDeadline,cleanupDeadline,closePromise,scope,root,red,blue,branch,nested,savedFrame,originalEngine;
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
    check(delay>0,label+' deadline expired','DCA_NATIVE_DEADLINE');let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(
      Object.assign(new Error(label+' pending'),{code:'DCA_NATIVE_TIMEOUT'})),delay);})]);}
    finally{clearTimeout(timer);}
  }
  function status(port) {
    if(backend!=='webgpu'||!port?.host)return null;
    const value=port.host.getStatus();return {state:value.state,pendingFrames:value.pendingFrames,
      pendingUploadBytes:value.pendingUploadBytes,pendingReadbackBytes:value.pendingReadbackBytes,cleanupOutcome:value.cleanupOutcome};
  }
  function treeState() {
    if(!root)return null;
    return {rootChildren:root.numChildren,directParentsDetached:red.parent===undefined&&blue.parent===undefined&&branch.parent===undefined,
      nestedParentRetained:nested.parent===branch,branchChildren:branch.numChildren,
      allSceneNodesLive:[root,red,blue,branch,nested].every(node=>!node.isDisposed)};
  }
  function snapshot() {
    return {backend,primaryOccurred,primary:primaryOccurred?errorData(primary):null,cleanupErrors:cleanupErrors.map(errorData),
      pendingTickets:pending.size,tickets:tickets.map(row=>({...row})),newCaptures,savedReplays,sourceImages:[],
      scopeState:scope?.state??null,allSceneNodesDisposed:[root,red,blue,branch,nested].filter(Boolean).length===5
        &&[root,red,blue,branch,nested].every(node=>node.isDisposed),
      diagnostics:[...diagnostics],ports:ports.map(port=>({id:port.id,renderSubmissions:port.renderSubmissions,
        close:port.closeState,safeHostReturn:port.safeHostReturn,engineDisposeFulfilled:port.engineDisposeFulfilled,
        deviceDestroyed:port.deviceDestroyed,deviceLoss:port.deviceLoss??null,quarantine:port.quarantine??false,hostStatus:status(port)}))};
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
        check(isSecureContext&&navigator.gpu,'Default WebGPU unavailable','DCA_NATIVE_UNAVAILABLE');
        const adapter=await bounded(track(navigator.gpu.requestAdapter(),'requestAdapter'),'default adapter');
        check(adapter!==null&&!closing,'No adapter or closing setup','DCA_NATIVE_UNAVAILABLE');
        const acquire=track(adapter.requestDevice(),'requestDevice',device=>{
          port.device=device;port.lost=handled(device.lost);port.uncaptured=event=>fail(event.error);
          device.addEventListener('uncapturederror',port.uncaptured);
          handled(port.lost.then(loss=>{port.deviceLoss={reason:loss.reason,message:loss.message};
            if(!port.intentionalDestroy)fail(Object.assign(new Error('Unexpected device loss'),{code:'DCA_NATIVE_DEVICE_LOST'}));},fail));
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
        check(port.startups.size===0&&port.native.size===0,'Original native ticket remains','DCA_NATIVE_CLOSE_UNSAFE');
        if(port.engine){await bounded(track(port.engine.dispose(),'Engine.dispose'),'genuine Scope/host retirement',true);port.engineDisposeFulfilled=true;}
        else if(port.host)await bounded(track(port.host.close(),'host.close'),'unattached host retirement',true);
        const state=status(port);port.safeHostReturn=!port.host||backend==='canvas'||state.state==='closed'
          &&state.cleanupOutcome==='safe'&&state.pendingFrames===0&&state.pendingUploadBytes===0&&state.pendingReadbackBytes===0;
        check(port.safeHostReturn,'Unsafe host retirement','DCA_NATIVE_CLOSE_UNSAFE');
        if(port.device){port.intentionalDestroy=true;port.device.destroy();port.deviceDestroyed=true;
          await bounded(port.lost,'owned device destroyed loss',true);check(port.deviceLoss?.reason==='destroyed','Owned device loss reason','DCA_NATIVE_CLOSE_UNSAFE');
          port.device.removeEventListener('uncapturederror',port.uncaptured);}
        port.canvas.width=0;port.canvas.height=0;port.canvas.remove();port.closeState='fulfilled';
      }catch(cause){port.quarantine=true;port.closeState='rejected';throw cause;}
    })());return port.closePromise;
  }
  function rectangle(x,y,color) {
    const node=scope.use(new egret.Sprite());
    node.x=x;node.y=y;node.graphics.beginFill(color).drawRect(0,0,6,6).endFill();return node;
  }
  async function start(deadlines) {
    check(!started&&!closing,'Start once');started=true;operationDeadline=deadlines.operationDeadline;cleanupDeadline=deadlines.cleanupDeadline;
    check(Number.isSafeInteger(operationDeadline)&&Number.isSafeInteger(cleanupDeadline)&&operationDeadline>Date.now()
      &&cleanupDeadline>operationDeadline,'Finite existing collector deadlines');
    try {
      const port=await openPort();check(typeof egret.DisplayObjectContainer.prototype.removeChildren==='function','Public removeChildren required');
      originalEngine=port.engine;scope=port.engine.createScope();root=scope.use(new egret.Sprite());root.x=2;root.y=2;
      root.graphics.beginFill(0x00ff00).drawRect(0,0,20,20).endFill();
      red=rectangle(2,2,0xff0000);blue=rectangle(12,2,0x0000ff);
      branch=scope.use(new egret.DisplayObjectContainer());branch.x=2;branch.y=12;nested=rectangle(0,0,0xffff00);
      // Immediate Scope.use preserves ownership on setup failure; tree detach transfers none.
      root.addChild(red);root.addChild(blue);branch.addChild(nested);root.addChild(branch);port.engine.stage.addChild(root);
      check(root.numChildren===3&&branch.numChildren===1,'Original direct and nested child composition');
      return snapshot();
    }catch(cause){throw fail(cause);}
  }
  async function collectStep(step) {
    check(started&&!closing&&['N1','N2','N3'][nextStep]===step,'Fixed before/remove/replay sequence');
    try {
      const port=ports[0];let frame;
      if(step==='N2') {
        check(root.removeChildren()===undefined,'Public batch removal returns void');
        const state=treeState();check(state.rootChildren===0&&state.directParentsDetached&&state.nestedParentRetained
          &&state.branchChildren===1&&state.allSceneNodesLive,'Direct detach preserves subtree and original live owners');
      }
      if(step==='N3'){frame=savedFrame;savedReplays++;}
      else{frame=port.engine.captureFrame(FRAME);newCaptures++;if(step==='N1')savedFrame=frame;}
      // Ordinary capture omits the optional image table when no images were registered.
      check(frame.commands.length===(step==='N2'?1:4)&&frame.commands.every(command=>command.kind==='rect')
        &&frame.images===undefined,'Actual ordinary rectangle-only captured frame');
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
        commands:frame.commands.length,images:0,frozen:Object.isFrozen(frame)&&Object.isFrozen(frame.commands)},
        exactSavedN1:step==='N3'?frame===savedFrame:null,sameEngineAlive:port.engine===originalEngine
          &&!port.engineDisposeFulfilled&&scope.state==='open'&&!port.engine.stage.isDisposed,
        tree:treeState(),snapshot:snapshot()};
    }catch(cause){throw fail(cause);}
  }
  function close() {
    if(closePromise)return closePromise;closing=true;closePromise=handled((async()=>{
      for(const port of [...ports].reverse())try{await retire(port);}catch(cause){cleanupErrors.push(cause);}
      try{await bounded(Promise.allSettled([...pending]),'all original tickets',true);}catch(cause){cleanupErrors.push(cause);}
      if(pending.size||ports.some(port=>port.quarantine))cleanupErrors.push(Object.assign(new Error('Unsettled or quarantined native ownership'),{code:'DCA_NATIVE_CLOSE_UNSAFE'}));
      return snapshot();
    })());return closePromise;
  }
  return Object.freeze({start,collectStep,close});
}
