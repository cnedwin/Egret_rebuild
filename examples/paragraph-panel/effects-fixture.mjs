// SPDX-License-Identifier: Apache-2.0
// Original procedural pixel fixture; no external artwork or input bridge.
import {createEngineForProfile,Sprite,Bitmap,createTexture,createImageData2D,createAssetType,createAssetRef,isTexture,CancellationController} from '@egret/engine';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';
const params=new URL(location.href).searchParams,backend=params.get('backend')??'webgl2',ratio=Number(params.get('ratio')??1),canvas=document.querySelector('canvas');
let host,engine,scope,group,child,mask,lease,oldFrame,device;
const frameOptions={width:64,height:64,clearColor:0x000000,clearAlpha:1,outputAlpha:'opaque'};
const ready=(async()=>{
 if(backend==='webgpu')device=await (await navigator.gpu.requestAdapter()).requestDevice();
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:ratio,outputAlpha:'opaque',enableReadback:true,enableEffects:params.get('disabled')!=='1',...(device?{device:{kind:'borrow',device},recovery:{mode:'manual'}}:{})});
 engine=await createEngineForProfile({host},'egret.shared-frame2d/1');scope=engine.createScope();
 group=scope.use(new Sprite());engine.stage.addChild(group);
 child=scope.use(new Sprite());group.addChild(child);child.graphics.beginFill(0xff0000).drawRect(16,16,16,16).endFill();
 const type=createAssetType('effect-fixture-mask',isTexture);engine.assets.register(type,{async load(){const pixels=new Uint8Array(4*4*4);for(let y=0;y<4;y++)for(let x=0;x<4;x++)pixels.set([255,255,255,x<2?(y<2?255:128):0],(y*4+x)*4);return createTexture(createImageData2D({width:4,height:4,pixels}));},dispose(t){t.dispose();}});
 lease=scope.use(await engine.assets.acquire(createAssetRef(type,'quadrants'),{signal:scope.signal}));mask=scope.use(new Bitmap(lease));
})();
function effect(radius=0,masked=false){return {blurRadius:radius,...(masked?{alphaMask:mask,maskRect:{x:16,y:16,width:16,height:16}}:{})};}
async function draw(){const readback=host.requestReadback();void readback.catch(()=>{});host.renderSharedFrame(engine.captureSharedFrame(frameOptions));const r=await readback;await host.whenIdle();return {width:r.width,height:r.height,bytes:Array.from(r.bytes),resources:host.getSharedStatus().resources};}
async function run(name){await ready;group.renderEffect=undefined;group.clipRect=undefined;group.x=0;group.rotation=0;child.renderEffect=undefined;child.x=0;
 if(name==='cap')group.renderEffect=effect(8);
 if(name==='rotated'){group.x=64;group.rotation=90;group.renderEffect=effect(0,true);}
 if(name==='mask')group.renderEffect=effect(0,true);
 if(name==='blur')group.renderEffect=effect(2);
 if(name==='both')group.renderEffect=effect(2,true);
 if(name==='clip'){group.clipRect={x:20,y:20,width:8,height:8};group.renderEffect=effect(2);}
 if(name==='nested'){group.renderEffect=effect(1,true);child.renderEffect=effect(1);}
 if(name==='translated'){group.x=5;group.renderEffect=effect(0,true);}
 if(name==='old-frame'){group.renderEffect=effect(0,true);oldFrame=engine.captureSharedFrame(frameOptions);group.renderEffect=effect(2);const pending=host.requestReadback();void pending.catch(()=>{});host.renderSharedFrame(oldFrame);const r=await pending;await host.whenIdle();return {width:r.width,height:r.height,bytes:Array.from(r.bytes),resources:host.getSharedStatus().resources};}
 if(name==='staged'){group.renderEffect=effect(2,true);const pending=host.requestReadback();void pending.catch(()=>{});const upload=host.stageSharedFrame(engine.captureSharedFrame(frameOptions));await upload.ready;upload.submit();const r=await pending;await host.whenIdle();return {width:r.width,height:r.height,bytes:Array.from(r.bytes),resources:host.getSharedStatus().resources};}
 return draw();
}
async function close(){scope?.dispose();await host?.whenIdle();await engine?.dispose();device?.destroy();return {scope:scope?.state,resources:host?.getSharedStatus().resources};}
async function cancel(){await ready;group.renderEffect=effect(2,true);const c=new CancellationController(),upload=host.stageSharedFrame(engine.captureSharedFrame(frameOptions),{signal:c.signal});const observed=upload.ready.catch(e=>e.code);c.abort('fixture cancellation');await observed;let code;try{upload.submit();}catch(e){code=e.code;}let idleCode;try{await host.whenIdle();}catch(e){idleCode=e.code;if(!String(idleCode).endsWith('UPLOAD_ABORTED'))throw e;}return {code,idleCode,state:host.getStatus().state,resources:host.getSharedStatus().resources};}
async function recover(){await ready;await run('both');const before=host.getSessionStatus().generation;
 if(device){device.destroy();await device.lost;for(let i=0;i<100&&host.getSessionStatus().state!=='lost';i++)await new Promise(r=>setTimeout(r,10));device=await(await navigator.gpu.requestAdapter()).requestDevice();await host.recover(device);}
 else{const extension=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!extension)throw Error('ACTUAL_LOSS_UNAVAILABLE');const lost=new Promise(r=>canvas.addEventListener('webglcontextlost',r,{once:true}));extension.loseContext();await lost;await new Promise(r=>setTimeout(r,50));extension.restoreContext();await host.whenReady();}
 const frame=await run('both');return {...frame,before,after:host.getSessionStatus().generation};}
globalThis.__egretEffects={ready,run,close,cancel,recover,inspect:()=>({backend,ratio,state:host?.getStatus(),resources:host?.getSharedStatus().resources})};
