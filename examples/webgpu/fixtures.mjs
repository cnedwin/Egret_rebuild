import { createEngine, Sprite } from '@egret/engine';
import { createWebGPUHost } from '@egret/engine/webgpu';
import { createCanvasHost } from '@egret/engine/web';
import { assertPixel, assertZero, pixel } from '/tools/webgpu-oracle.mjs';

const zero = [0,0,0,0], red = [255,0,0,255], green = [0,255,0,255], blue = [0,0,255,255];
const sample = (name,x,y,rgba,classification='strict') => ({name,x,y,rgba,classification});
const rect = (parent,color,alpha,x,y,width,height) => {
  const child = parent.addChild(new Sprite()); child.graphics.beginFill(color,alpha).drawRect(x,y,width,height); return child;
};
// Every coordinate/color below is derived independently in native-oracle-notes.md.
export function defineFixture(name, stage) {
  const options = {width:48,height:40,clearColor:0,clearAlpha:0};
  let samples=[], allZero=false, pixelRatio=1;
  if (name === 'painter' || name === 'opaque-painter') {
    rect(stage,0xff0000,.5,4,4,20,20); rect(stage,0x0000ff,.5,12,12,20,20);
    if(name==='opaque-painter') options.clearAlpha=1;
    samples=[sample('painter-colored-interior',8,8,[128,0,0,name==='painter'?128:255]),sample('painter-overlap',16,16,[64,0,128,name==='painter'?191:255]),sample('painter-blue',28,28,[0,0,128,name==='painter'?128:255]),sample('painter-untouched',40,20,name==='painter'?zero:[0,0,0,255])];
  } else if(name==='inherited') {
    const parent=stage.addChild(new Sprite()); parent.alpha=.5;
    const child=rect(parent,0xff0000,.5,4,4,12,12); child.alpha=.5;
    samples=[sample('inherited-alpha-once',8,8,[32,0,0,32])];
  } else if(name==='zero-alpha') {
    options.clearColor=0xff00ff; rect(stage,0xff0000,0,4,4,20,20); allZero=true;
    samples=[sample('zero-alpha-black',8,8,zero),sample('zero-alpha-clear',40,20,zero)];
  } else if(name==='red-clear') {
    options.clearColor=0xff0000; options.clearAlpha=.5;
    samples=[sample('empty-nonzero-clear',8,8,[128,0,0,128]),sample('empty-nonzero-clear-untouched',40,20,[128,0,0,128])];
  } else if(name==='affine') {
    const parent=stage.addChild(new Sprite()); Object.assign(parent,{x:10,y:20,scaleX:2});
    const child=rect(parent,0xff0000,1,1,2,3,4); Object.assign(child,{x:3,y:4,rotation:90});
    samples=[sample('affine-inside',7,26,red),sample('affine-outside',15,26,zero)];
  } else if(name==='reflection') {
    const child=rect(stage,0x00ff00,1,0,0,8,8); Object.assign(child,{x:24,y:4,scaleX:-1});
    samples=[sample('reflection-inside',20,8,green),sample('reflection-outside',28,8,zero)];
  } else if(name==='shear') {
    options.width=40; options.height=28;
    const parent=stage.addChild(new Sprite()); Object.assign(parent,{x:16,y:12,scaleX:2});
    rect(parent,0xff0000,1,-4,-4,8,8).rotation=45;
    samples=[sample('composed-shear-inside',16,12,red),sample('composed-shear-outside-aabb',27,16,zero)];
  } else if(name==='nested') {
    const outer=stage.addChild(new Sprite()); Object.assign(outer,{x:16,y:16,rotation:90,clipRect:{x:-12,y:-12,width:24,height:24}});
    const diamond=outer.addChild(new Sprite()); Object.assign(diamond,{rotation:-45,scaleX:Math.SQRT2,scaleY:Math.SQRT2,clipRect:{x:-6,y:-6,width:12,height:12}});
    const half=diamond.addChild(new Sprite()); Object.assign(half,{rotation:-45,scaleX:1/Math.SQRT2,scaleY:1/Math.SQRT2,clipRect:{x:0,y:-20,width:20,height:40}});
    rect(half,0x00ff00,1,-20,-20,40,40); rect(stage,0x0000ff,1,32,4,8,8);
    samples=[sample('nested-inside',20,16,green),sample('nested-halfplane-outside',10,16,zero),sample('diamond-outside',26,6,zero),sample('unclipped-sibling',36,8,blue)];
  } else if(name==='fan-rectangle' || name==='fan-polygon') {
    if(name==='fan-rectangle') rect(stage,0x00ff00,.5,4,4,24,24);
    else {
      const parent=stage.addChild(new Sprite()); Object.assign(parent,{x:16,y:16,rotation:45,scaleX:Math.SQRT2,scaleY:Math.SQRT2,clipRect:{x:-8,y:-8,width:16,height:16}});
      const child=rect(parent,0x00ff00,.5,-12,-12,24,24); Object.assign(child,{rotation:-45,scaleX:1/Math.SQRT2,scaleY:1/Math.SQRT2});
    }
    for(let y=5;y<=26;y++)for(let x=5;x<=26;x++) {
      if(name==='fan-rectangle' || Math.abs(x+.5-16)+Math.abs(y+.5-16)<=14)
        samples.push(sample(`${name}-${x}-${y}`,x,y,[0,128,0,128]));
    }
  } else if(name==='dpr') {
    Object.assign(options,{width:10.2,height:8.2}); pixelRatio=1.5;
    rect(stage,0xff0000,1,2,2,4.25,4);
    samples=[sample('dpr-strict-inside',5,5,red),sample('dpr-strict-outside',12,5,zero),sample('nominal-dpr-boundary-marker',9,5,zero,'boundary-diagnostic')];
  } else if(name==='rational' || name==='adjacent' || name==='near-collinear') {
    if(name==='rational') {
      const parent=stage.addChild(new Sprite()); Object.assign(parent,{x:16,y:16,rotation:45,scaleX:Math.SQRT2,scaleY:Math.SQRT2,clipRect:{x:-8,y:-8,width:16,height:16}});
      const child=rect(parent,0x00ff00,1,-12,-12,24,24); Object.assign(child,{rotation:-45,scaleX:1/Math.SQRT2,scaleY:1/Math.SQRT2});
      // Octagon [4,28]^2 intersect |x-16|+|y-16|<=16: half-integer centers use exact integer arithmetic.
      for(let y=1;y<32;y++)for(let x=1;x<32;x++) {
        const X=x+.5,Y=y+.5, diamond=16-Math.abs(X-16)-Math.abs(Y-16);
        const square=Math.min(X-4,28-X,Y-4,28-Y);
        if(square>=1 && diamond>=Math.SQRT2) samples.push(sample(`rational-in-${x}-${y}`,x,y,green));
        else if(square<=-1 || diamond<=-Math.SQRT2) samples.push(sample(`rational-out-${x}-${y}`,x,y,zero));
      }
    } else if(name==='adjacent') {
      const parent=stage.addChild(new Sprite()); Object.assign(parent,{x:16,y:16,rotation:30});
      rect(parent,0xff0000,.5,-10,-10,10,20); rect(parent,0x0000ff,.5,0,-10,10,20);
      samples=[sample('adjacent-left-interior',11,16,[128,0,0,128]),sample('adjacent-right-interior',20,16,[0,0,128,128])];
    } else {
      const parent=stage.addChild(new Sprite()); Object.assign(parent,{x:4,y:4,rotation:.00000001,clipRect:{x:0,y:0,width:24,height:24}});
      rect(parent,0xff0000,1,2,2,18,18);
      samples=[sample('near-collinear-positive',12,12,red),sample('near-collinear-outside',32,12,zero)];
    }
  } else throw new Error(`Unknown fixture ${name}`);
  return {name,options,samples,allZero,pixelRatio};
}

let current;
export async function boot(name, enableReadback=true, hostOptions={}, assertionName) {
  if(current) await close();
  const canvas=document.querySelector('#scene');
  // Use a temporary scene to determine ratio without creating any GPU testing seam.
  const stage=new Sprite(); const definition=defineFixture(name,stage);
  const diagnostics=[];
  const host=createWebGPUHost({canvas,pixelRatio:definition.pixelRatio,enableReadback,...hostOptions,onDiagnostic:d=>diagnostics.push({code:d.code,phase:d.phase,serial:d.serial,message:String(d.cause)})});
  const engine=await createEngine({host});
  const actual=defineFixture(name,engine.stage);
  current={host,engine,canvas,definition:actual,diagnostics,enableReadback,assertionName};
  return await render();
}
export async function render(options=current.definition.options, direct) {
  const {host,engine,canvas,enableReadback,definition}=current;
  const ticket=enableReadback?host.requestReadback():undefined;
  let frame;
  try { frame=direct ?? engine.renderFrame(options); }
  catch(error) {
    const chain=[];let value=error;
    for(let depth=0;value && depth<8;depth++,value=value.cause)chain.push({name:value.name,code:value.code,reason:value.reason,message:value.message});
    current.failed={definition,chain,status:host.getStatus(),frame:engine.captureFrame(options)};
    throw new Error(`Native fixture ${definition.name} submission failed: ${JSON.stringify(chain)}; status ${JSON.stringify(host.getStatus())}`);
  }
  if(direct && host.renderFrame(direct)!==undefined) throw new Error('Host renderer must remain synchronous undefined');
  const result=ticket?await ticket:undefined;
  await host.whenIdle();
  canvas.style.width=`${canvas.width}px`; canvas.style.height=`${canvas.height}px`;
  if(result && (result.frameId!==frame.frameId || result.width!==canvas.width || result.height!==canvas.height || result.format!=='rgba8unorm' || result.colorSpace!=='srgb' || result.alphaMode!=='premultiplied' || !Object.isFrozen(result))) throw new Error('Readback/frame metadata mismatch');
  current.observation=result?{...result,bytes:Array.from(result.bytes)}:null;
  const checks=result?definition.samples.filter(s=>!current.assertionName || s.name===current.assertionName).map(s=>({...assertPixel(pixel(result.bytes,result.width,s.x,s.y),s.rgba,s.name),x:s.x,y:s.y,classification:s.classification})):[];
  if(result && definition.allZero)checks.push(assertZero(result.bytes,'zero-alpha-all-zero'));
  if(current.diagnostics.length) throw new Error(`Unexpected GPU diagnostic ${JSON.stringify(current.diagnostics)}`);
  return {definition,frameId:frame.frameId,serial:result?.serial ?? host.getStatus().lastSerial,readback:result?{...result,bytes:Array.from(result.bytes)}:null,checks,status:host.getStatus(),metadata:metadata()};
}
export function metadata() {
  const c=current.canvas,r=c.getBoundingClientRect(),s=getComputedStyle(c);
  return {backing:[c.width,c.height],rect:{x:r.x,y:r.y,width:r.width,height:r.height},browserDPR:devicePixelRatio,hostPixelRatio:current.definition.pixelRatio,scroll:[scrollX,scrollY],css:{opacity:s.opacity,transform:s.transform,filter:s.filter,border:s.borderWidth,padding:s.padding,background:s.backgroundColor}};
}
export async function background(value) {
  document.documentElement.style.background=document.body.style.background=`rgb(${value},${value},${value})`;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return metadata();
}
export async function reset(width=48,height=40) {
  while(current.engine.stage.numChildren) current.engine.stage.removeChild(current.engine.stage.getChildAt(0));
  current.definition={name:`reset-${width}-${height}`,options:{width,height,clearColor:0,clearAlpha:0},samples:[sample('reset-background',8,8,zero),sample('reset-background-middle',20,16,zero),sample('reset-background-right',32,20,zero)],allZero:true,pixelRatio:1};
  const result=await render();
  if(result.readback)result.checks.push(assertZero(Uint8Array.from(result.readback.bytes),'empty-reset-all-zero'));
  return result;
}
export async function snapshot() {
  while(current.engine.stage.numChildren)current.engine.stage.removeChild(current.engine.stage.getChildAt(0));
  const parent=current.engine.stage.addChild(new Sprite()); parent.x=4;parent.y=4;
  const leaf=rect(parent,0xff0000,1,0,0,8,8);
  const options={width:48,height:40,clearColor:0,clearAlpha:0},A=current.engine.captureFrame(options),before=JSON.stringify(A);
  parent.x=20; leaf.graphics.clear();leaf.graphics.beginFill(0x0000ff).drawRect(0,0,8,8);current.engine.stage.addChild(leaf);leaf.x=28;leaf.y=4;
  current.definition={name:'snapshot-A',options,samples:[sample('immutable-A-old',8,8,red),sample('immutable-A-new-empty',32,8,zero)],allZero:false,pixelRatio:1};
  current.snapshotA=A;current.snapshotADefinition=current.definition;
  const first=await render(options,A),second=await render(options,A);
  if(first.serial===second.serial || before!==JSON.stringify(A) || !Object.isFrozen(A) || !Object.isFrozen(A.commands) || !Object.isFrozen(A.commands[0]) || !Object.isFrozen(A.commands[0].matrix) || !Object.isFrozen(A.commands[0].rect) || first.readback && JSON.stringify(first.readback.bytes)!==JSON.stringify(second.readback.bytes))throw new Error('Immutable snapshot repeat changed');
  current.definition={...current.definition,name:'snapshot-B',samples:[sample('live-B-old-empty',8,8,zero),sample('live-B-new',32,8,blue)]};
  const third=await render(); if(third.frameId===A.frameId)throw new Error('Live B reused frame id');
  return {first,second,third,immutableIdentityPreserved:true};
}
export function failureDetails(){return current?.failed??null;}
export function lastObservation(){return current?.observation??null;}
export async function replaySnapshotA(){current.definition=current.snapshotADefinition;return render(current.definition.options,current.snapshotA);}
export async function canvasComparison(name) {
  const canvas=document.createElement('canvas'),host=createCanvasHost({canvas}),engine=await createEngine({host});
  const definition=defineFixture(name,engine.stage);engine.renderFrame(definition.options);
  const data=Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data);
  await engine.dispose();return {width:canvas.width,height:canvas.height,bytes:data,representation:'straight RGBA'};
}
export async function close() {
  if(!current)return;
  const old=current;current=undefined;await old.engine.dispose();
  if(old.host.getStatus().cleanupOutcome!=='safe')throw new Error('Ordinary close unsafe');
  return old.host.getStatus();
}

export async function lifecycle() {
  const adapter=await navigator.gpu.requestAdapter();
  if(!adapter)throw new Error('INCOMPLETE: default adapter unavailable');
  const limitNames=['maxTextureDimension2D','maxBufferSize','maxVertexBuffers','maxVertexAttributes','maxVertexBufferArrayStride','maxColorAttachments','maxColorAttachmentBytesPerSample'];
  const adapterLimits=Object.fromEntries(limitNames.map(k=>[k,adapter.limits[k]]));
  const observedDevice=await adapter.requestDevice(),limits=Object.fromEntries(limitNames.map(k=>[k,observedDevice.limits[k]]));observedDevice.destroy();
  const info=adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter}:null;
  const records=[];
  const defaultDevice=async()=>{const a=await navigator.gpu.requestAdapter();if(!a)throw new Error('INCOMPLETE: default adapter unavailable');return a.requestDevice();};
  const canvas=()=>document.createElement('canvas');
  const verify=(value,message)=>{if(!value)throw new Error(message);};
  for(const [name,options,frameOptions,expected] of [
    ['native-upload-budget',{maxUploadBytes:143},{width:16,height:16},'WEBGPU_FRAME_BUDGET'],
    ['native-device-texture-limit',{maxBackingPixels:limits.maxTextureDimension2D+1},{width:limits.maxTextureDimension2D+1,height:1},'WEBGPU_DEVICE_LIMIT']
  ]) {
    const c=canvas(),h=createWebGPUHost({canvas:c,...options}),e=await createEngine({host:h});
    rect(e.stage,0xff0000,1,1,1,8,8);const before=[c.width,c.height,h.getStatus().lastSerial];
    let observed;try{e.renderFrame(frameOptions);}catch(error){observed={outer:error.code,inner:error.cause?.code};}
    verify(observed?.outer==='FRAME_RENDER_FAILED'&&observed.inner===expected,`${name} classification`);
    verify(JSON.stringify(before)===JSON.stringify([c.width,c.height,h.getStatus().lastSerial])&&h.getStatus().state==='active',`${name} mutated host`);
    await e.dispose();records.push({name,expected,observed,before,noDimensionOrSerialMutation:true,status:h.getStatus()});
  }
  {
    const h=createWebGPUHost({canvas:canvas(),enableReadback:true}),e=await createEngine({host:h});
    rect(e.stage,0xff0000,.5,4,4,20,20);const ticket=h.requestReadback();e.renderFrame({width:48,height:40});
    const pending=h.getStatus(),closing=e.dispose(),pixels=await ticket;await closing;
    verify(pending.pendingFrames===1&&pending.pendingReadbackBytes>0,'Close did not begin with live native ticket');
    assertPixel(pixel(pixels.bytes,48,8,8),[128,0,0,128],'pending-close-red');
    records.push({name:'live-pending-readback-close',pending,frameId:pixels.frameId,serial:pixels.serial,status:h.getStatus()});
  }
  {
    const device=await defaultDevice(),h=createWebGPUHost({canvas:canvas(),device:{kind:'borrow',device}}),e=await createEngine({host:h});
    e.renderFrame({width:8,height:8});await h.whenIdle();await e.dispose();
    // This allocation is after safe close, outside the cooperative host lease.
    device.pushErrorScope('validation');const buffer=device.createBuffer({size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const scope=device.popErrorScope();
    await buffer.mapAsync(GPUMapMode.READ);const length=buffer.getMappedRange().byteLength;buffer.unmap();buffer.destroy();
    verify(await scope===null&&length===16,'Borrowed device did not survive ordinary close');
    records.push({name:'borrow-survives-ordinary-close',actualMappedBytes:length,status:h.getStatus()});device.destroy();
  }
  {
    const device=await defaultDevice(),diagnostics=[];
    const h=createWebGPUHost({canvas:canvas(),device:{kind:'borrow',device},onDiagnostic:d=>diagnostics.push({code:d.code,phase:d.phase})}),e=await createEngine({host:h});
    // Explicit destructive lease violation, limited to this named default-device loss test.
    device.destroy();await device.lost;await new Promise(resolve=>setTimeout(resolve,0));
    let idleError,closeError;try{await h.whenIdle();}catch(error){idleError=error.code;}
    try{await e.dispose();}catch(error){closeError={outer:error.code,inner:error.cause?.code};}
    verify(idleError==='WEBGPU_DEVICE_LOST'&&closeError?.outer==='ENGINE_CLOSE_FAILED'&&closeError.inner==='WEBGPU_CLOSE_UNSAFE','Controlled loss silently succeeded');
    verify(h.getStatus().firstFailure?.code==='WEBGPU_DEVICE_LOST'&&h.getStatus().cleanupOutcome==='unsafe','Loss proof falsely safe');
    verify(diagnostics.length===1&&diagnostics[0].code==='WEBGPU_DEVICE_LOST','Unexpected diagnostics in controlled-loss window');
    records.push({name:'controlled-default-device-destroy',idleError,closeError,diagnostics,status:h.getStatus(),covers:'Explicit destroy only; not arbitrary driver reset'});
  }
  {
    const device=await defaultDevice(),unexpected=[];device.addEventListener('uncapturederror',e=>unexpected.push(e.error.message));
    // Bounded native allocation/scoped-error supplement; no active host owns this device.
    device.pushErrorScope('validation');const good=device.createBuffer({size:4096,usage:GPUBufferUsage.COPY_DST});const goodScope=device.popErrorScope();
    device.pushErrorScope('validation');const invalid=device.createBuffer({size:16,usage:0});const badScope=device.popErrorScope();
    const [goodError,badError]=await Promise.all([goodScope,badScope]);
    verify(goodError===null&&badError?.constructor.name==='GPUValidationError'&&unexpected.length===0,'Bounded native scoped allocation supplement failed');
    good.destroy();invalid.destroy();device.destroy();
    records.push({name:'bounded-native-allocation-scoped-validation',goodBytes:4096,invalidBytes:16,invalidUsage:0,observed:{type:badError.constructor.name,message:badError.message},unexpected,covers:'Allocation success and actual invalid-descriptor validation; no OOM threshold claim'});
  }
  return {secureContext:isSecureContext,api:!!navigator.gpu,defaultAdapter:true,defaultDevice:true,adapterInfo:info,adapterLimits,limits,preferredFormat:navigator.gpu.getPreferredCanvasFormat(),records};
}
