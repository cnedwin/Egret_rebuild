// SPDX-License-Identifier: Apache-2.0
// Genuine public leaf/lease/host composition. This fixture never decodes a PNG.
import * as egret from '@egret/engine';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createCanvasHost } from '@egret/engine/web';

const COLORS = Object.freeze({ R:[255,0,0,255], G:[0,255,0,255], B:[0,0,255,255], Y:[255,255,0,255],
  M:[255,0,255,255], C:[0,255,255,255], W:[255,255,255,255], H:[128,128,128,255], K:[0,0,0,255] });
const SOURCE_ROWS = Object.freeze(['RRGGGGBB','RRGGGGBB','YYMMMMCC','YYMMMMCC','YYMMMMCC','YYMMMMCC','WWHHHHKK','WWHHHHKK']);
const FRAME = Object.freeze({ width:24, height:24, clearColor:0, clearAlpha:0 });
const CROP = Object.freeze({ x:2, y:2, width:8, height:8 });
const check = (condition, message, code='NLB_NATIVE_ASSERTION') => { if (!condition) throw Object.assign(new Error(message), {code}); };
const handled = value => { const promise=Promise.resolve(value); promise.catch(()=>undefined); return promise; };
const errorData = cause => ({ occurrence:true, undefined:cause===undefined, name:cause?.name??null, code:cause?.code??null, message:String(cause?.message??cause) });
function sourcePixels() {
  const pixels=new Uint8Array(12*12*4);
  for(let y=0;y<12;y++)for(let x=0;x<12;x++)pixels.set(COLORS.M,(y*12+x)*4);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)pixels.set(COLORS[SOURCE_ROWS[y][x]],((y+2)*12+x+2)*4);
  return pixels;
}
export function createNineSliceBitmapFixture() {
  let started=false, closing=false, operationDeadline, cleanupDeadline, origin, replay, savedFrame, leaf, lease, texture, image, scope;
  let stepIndex=0, newCaptures=0, savedReplays=0, loads=0, disposals=0, primaryOccurred=false, primary, closePromise, canvasRefusal;
  const ports=[], tickets=[], pending=new Set(), cleanupErrors=[], diagnostics=[];
  const fail=cause=>{if(!primaryOccurred){primaryOccurred=true;primary=cause;}return cause;};
  function track(value,label,register) {
    const promise=handled(value), row={id:tickets.length+1,label,settled:false}; tickets.push(row); pending.add(promise);
    handled(promise.then(result=>{row.settled=true;row.fulfilled=true;pending.delete(promise);try{register?.(result);}catch(cause){fail(cause);}},
      cause=>{row.settled=true;row.fulfilled=false;row.error=errorData(cause);pending.delete(promise);})); return promise;
  }
  async function bounded(value,label,cleanup=false) {
    const promise=handled(value), delay=Math.min(20000,(cleanup?cleanupDeadline:operationDeadline)-Date.now());
    check(delay>0,label+' deadline expired','NLB_NATIVE_DEADLINE');let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(label+' pending'),{code:'NLB_NATIVE_TIMEOUT'})),delay);})]);}
    finally{clearTimeout(timer);}
  }
  function hostStatus(port) { const value=port.host?.getStatus(); return value?{state:value.state,pendingFrames:value.pendingFrames,
    pendingUploadBytes:value.pendingUploadBytes,pendingReadbackBytes:value.pendingReadbackBytes,cleanupOutcome:value.cleanupOutcome}:null; }
  function snapshot() { return {primaryOccurred,primary:primaryOccurred?errorData(primary):null,cleanupErrors:cleanupErrors.map(errorData),
    pendingTickets:pending.size,tickets:tickets.map(row=>({...row})),newCaptures,savedReplays,loads,disposals,canvasRefusal,
    sourceImages:image?[{width:image.width,height:image.height,bytes:Array.from(egret.copyImageData2DPixels(image))}]:[],
    originRetired:origin?.closeState==='fulfilled',textureRetired:texture?.isDisposed??false,scopeState:scope?.state??null,
    leafDisposed:leaf?.isDisposed??false,borrowedLeaseDropped:leaf?.textureLease===undefined,
    diagnostics:[...diagnostics],ports:ports.map(port=>({id:port.id,renderSubmissions:port.renderSubmissions,close:port.closeState,
      safeHostReturn:port.safeHostReturn,deviceDestroyed:port.deviceDestroyed,deviceLoss:port.deviceLoss??null,
      status:hostStatus(port),quarantine:port.quarantine??false}))}; }
  async function openPort() {
    check(!closing&&ports.length<2,'Only origin and fresh replay ports');
    const port={id:ports.length,renderSubmissions:0,closeState:'not-started',safeHostReturn:false,deviceDestroyed:false,native:new Set(),startups:new Set()};ports.push(port);
    port.canvas=document.createElement('canvas');port.canvas.width=24;port.canvas.height=24;document.body.appendChild(port.canvas);
    port.startup=handled((async()=>{
      check(isSecureContext&&navigator.gpu,'WebGPU unavailable','NLB_NATIVE_UNAVAILABLE');
      const adapter=await bounded(track(navigator.gpu.requestAdapter(),'adapter'),'default adapter');check(adapter!==null&&!closing,'Default adapter unavailable','NLB_NATIVE_UNAVAILABLE');
      const acquisition=track(adapter.requestDevice(),'device',device=>{
        port.device=device;port.lost=handled(device.lost);port.uncaptured=event=>fail(event.error);device.addEventListener('uncapturederror',port.uncaptured);
        handled(port.lost.then(loss=>{port.deviceLoss={reason:loss.reason,message:loss.message};if(!port.destroyRequested)fail(Object.assign(new Error('Unexpected device loss'),{code:'NLB_NATIVE_DEVICE_LOST'}));},fail));
      });
      port.startups.add(acquisition);handled(acquisition.finally(()=>port.startups.delete(acquisition)));
      await bounded(acquisition,'device');check(!closing,'Late device retained for retirement');
      port.host=createTexturedWebGPUHost({canvas:port.canvas,device:{kind:'borrow',device:port.device},pixelRatio:1,maxBackingPixels:576,enableReadback:true,
        onDiagnostic:value=>{diagnostics.push(errorData(value.cause));fail(value.cause);}});
      const engineAcquisition=track(egret.createEngineForProfile({host:port.host,shutdownTimeoutMs:20000,onDiagnostic:value=>{diagnostics.push(errorData(value.cause));fail(value.cause);}},
        egret.TEXTURED_FRAME_PROFILE_2D),'Engine',engine=>{port.engine=engine;});
      port.startups.add(engineAcquisition);handled(engineAcquisition.finally(()=>port.startups.delete(engineAcquisition)));
      await bounded(engineAcquisition,'genuine profile Engine');check(!closing,'Late Engine retained for retirement');return port;
    })());
    await port.startup;return port;
  }
  function retire(port) {
    if(port.closePromise)return port.closePromise;port.closeState='pending';
    port.closePromise=handled((async()=>{
      try {
        await bounded(Promise.allSettled([port.startup,...port.startups,...port.native]),'original port tickets',true);
        check(port.startups.size===0&&port.native.size===0,'Original startup/native tickets remain','NLB_NATIVE_CLOSE_UNSAFE');
        if(port.engine)await bounded(track(port.engine.dispose(),'Engine.dispose'),'genuine Engine/host retirement',true);
        else if(port.host)await bounded(track(port.host.close(),'host.close'),'unattached host retirement',true);
        const state=hostStatus(port),textured=port.host?.getTexturedStatus();
        port.safeHostReturn=!port.host||state.state==='closed'&&state.cleanupOutcome==='safe'&&state.pendingFrames===0&&state.pendingUploadBytes===0&&state.pendingReadbackBytes===0&&textured.pendingGeometryBytes===0;
        check(port.safeHostReturn,'Host safe return missing','NLB_NATIVE_CLOSE_UNSAFE');
        if(port.device){port.destroyRequested=true;port.device.destroy();port.deviceDestroyed=true;await bounded(port.lost,'owned device loss',true);
          check(port.deviceLoss?.reason==='destroyed','Owned device loss reason','NLB_NATIVE_CLOSE_UNSAFE');port.device.removeEventListener('uncapturederror',port.uncaptured);}
        port.canvas.width=0;port.canvas.height=0;port.canvas.remove();port.closeState='fulfilled';
      }catch(cause){port.quarantine=true;port.closeState='rejected';throw cause;}
    })());return port.closePromise;
  }
  async function refusals(frame) {
    const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const host=createCanvasHost({canvas,pixelRatio:1,maxBackingPixels:576});
    let factoryCode,directCode,unexpectedEngine;
    try {
      try{unexpectedEngine=await egret.createEngineForProfile({host},egret.TEXTURED_FRAME_PROFILE_2D);}catch(cause){factoryCode=cause?.code;}
      check(!unexpectedEngine&&factoryCode==='ENGINE_RENDER_PROFILE_UNSUPPORTED','Actual Canvas factory profile refusal');
      host.start();const before=Array.from(canvas.getContext('2d').getImageData(0,0,24,24).data);
      try{host.renderFrame(frame);}catch(cause){directCode=cause?.code;}
      const after=Array.from(canvas.getContext('2d').getImageData(0,0,24,24).data);
      check(directCode==='CANVAS_FRAME_PROFILE_UNSUPPORTED'&&before.every((byte,index)=>byte===after[index]),'Actual direct owned-frame Canvas refusal with unchanged target');
      canvasRefusal={status:'PASS_REFUSAL_ONLY',factoryCode,directCode,positiveCanvasSubmissions:0,targetBytesUnchanged:true};
    }finally{if(unexpectedEngine)await unexpectedEngine.dispose();host.stop();await host.close();canvas.width=0;canvas.height=0;}
  }
  async function start(deadlines) {
    check(!started&&!closing,'Start once');started=true;operationDeadline=deadlines.operationDeadline;cleanupDeadline=deadlines.cleanupDeadline;
    check(Number.isSafeInteger(operationDeadline)&&Number.isSafeInteger(cleanupDeadline)&&operationDeadline>Date.now()&&cleanupDeadline>operationDeadline,'Finite deadlines');
    try {
      origin=await openPort();check(typeof egret.NineSliceBitmap==='function','Public NineSliceBitmap missing');
      scope=origin.engine.createScope();image=egret.createImageData2D({width:12,height:12,pixels:sourcePixels()});texture=egret.createTexture(image,CROP);
      const type=egret.createAssetType('nine-slice-native-original',egret.isTexture);origin.engine.assets.register(type,{async load(){loads++;return texture;},dispose(value){disposals++;value.dispose();}});
      await bounded(track(origin.engine.assets.acquire(egret.createAssetRef(type,'original-panel')),'genuine lease',value=>{lease=value;}),'original lease');
      // Real Scope.use order gives leaf-before-lease retirement. The leaf only borrows.
      scope.use(lease);leaf=new egret.NineSliceBitmap(lease,{width:16,height:12,insets:{left:2,top:2,right:2,bottom:2}});scope.use(leaf);
      leaf.x=2;leaf.y=2;origin.engine.stage.addChild(leaf);check(leaf.textureLease===lease,'Exact borrowed original lease');return snapshot();
    }catch(cause){throw fail(cause);}
  }
  async function collectStep(step) {
    check(started&&!closing&&['N1','N2','N3'][stepIndex]===step,'Exact three-step schedule');
    try {
      let port=origin,frame;
      if(step==='N2')leaf.resize(12,16);
      if(step==='N3'){
        await retire(origin);check(scope.state==='closed'&&leaf.isDisposed&&leaf.textureLease===undefined&&texture.isDisposed&&disposals===1,'Origin resource retirement');
        let released=false;try{lease.value;}catch(cause){released=cause?.code==='ASSET_LEASE_RELEASED';}check(released,'Original lease released');
        replay=await openPort();check(replay.host!==origin.host&&replay.engine!==origin.engine&&replay.device!==origin.device,'Fresh genuine replay port');port=replay;frame=savedFrame;savedReplays++;
      }else{frame=origin.engine.captureTexturedFrame(FRAME);newCaptures++;if(step==='N1'){savedFrame=frame;await refusals(frame);}}
      check(frame.profile===egret.TEXTURED_FRAME_PROFILE_2D&&frame.commands.length===1&&frame.commands[0].kind==='mesh'&&frame.images[0]===image
        &&frame.commands[0].sourceRect.x===2&&frame.commands[0].sourceRect.y===2&&frame.commands[0].sourceRect.width===8&&frame.commands[0].sourceRect.height===8,'Genuine original cropped mesh capture');
      const ticket=track(port.host.requestReadback(),'original raw readback');port.native.add(ticket);handled(ticket.finally(()=>port.native.delete(ticket)));
      check(port.host.renderTexturedFrame(frame)===undefined,'Synchronous public textured submission');port.renderSubmissions++;
      const idle=track(port.host.whenIdle(),'native idle');port.native.add(idle);handled(idle.finally(()=>port.native.delete(idle)));
      const [result]=await bounded(Promise.all([ticket,idle]),'native original readback and idle');stepIndex++;
      return {backend:'webgpu',step,raw:Array.from(result.bytes),metadata:{width:result.width,height:result.height,byteLength:result.bytes.byteLength,
        format:result.format,sourceFormat:result.sourceFormat,colorSpace:result.colorSpace,alphaMode:result.alphaMode,origin:'top-left',hostStatus:hostStatus(port)},
        frame:{frameId:frame.frameId,width:frame.width,height:frame.height,commands:frame.commands.length,images:frame.images.length,geometries:frame.geometries.length},
        exactSavedN1:step==='N3'?frame===savedFrame:null,originRetired:origin.closeState==='fulfilled',sameBorrowedLease:step==='N3'?null:leaf.textureLease===lease,
        canvasRefusal,snapshot:snapshot()};
    }catch(cause){throw fail(cause);}
  }
  function close() {
    if(closePromise)return closePromise;closing=true;closePromise=handled((async()=>{
      for(const port of [...ports].reverse())try{await retire(port);}catch(cause){cleanupErrors.push(cause);}
      try{await bounded(Promise.allSettled([...pending]),'all original tickets',true);}catch(cause){cleanupErrors.push(cause);}
      if(pending.size||ports.some(port=>port.quarantine))cleanupErrors.push(Object.assign(new Error('Unsettled or quarantined port'),{code:'NLB_NATIVE_CLOSE_UNSAFE'}));
      check(!scope||scope.state==='closed','Original Scope cleanup');return snapshot();
    })());return closePromise;
  }
  return Object.freeze({start,collectStep,close});
}
