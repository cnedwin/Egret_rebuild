// SPDX-License-Identifier: Apache-2.0
// Finite genuine one-actor browser composition; consumes only the sealed Node plan.
import { copyImageData2DPixels } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createAtlasImportSession } from '../../examples/atlas-import-playback/session.mjs';
import { decodeAtlasPng } from '../../examples/trimmed-atlas-playback/image.mjs';
import { EXPECTED_PLAN, SEQUENCE, PLAN_ROUTE, serialize, deepFreeze, allFrozen, assertImportObservation, assertImportRetirement } from './scenario.mjs';
const assert=(value,message)=>{if(!value)throw new Error(message);};
function errorView(cause,seen=new Set(),depth=0){
  const result={wasUndefined:cause===undefined};
  try{
    result.name=typeof cause?.name==='string'?cause.name:null;result.code=typeof cause?.code==='string'?cause.code:null;result.message=String(cause?.message??cause);
    if(cause!==null&&(typeof cause==='object'||typeof cause==='function')){
      if(seen.has(cause)){result.cycle=true;return result;}seen.add(cause);if(depth>=10){result.truncated=true;return result;}
      if(Object.hasOwn(cause,'cause'))result.cause=errorView(cause.cause,new Set(seen),depth+1);
      for(const key of ['errors','cleanupErrors'])if(Array.isArray(cause[key]))result[key]=cause[key].map(value=>errorView(value,new Set(seen),depth+1));
      if(Object.hasOwn(cause,'retirement'))result.retirement=cause.retirement;
      if(Array.isArray(cause.diagnostics))result.diagnostics=cause.diagnostics.map(row=>({code:row.code,severity:row.severity,phase:row.phase,cause:errorView(row.cause,new Set(seen),depth+1)}));
    }
  }catch{result.unreadable=true;}return result;
}
function canvas(){const result=document.createElement('canvas');result.width=24;result.height=16;document.body.append(result);return result;}
function createHost(surface,profile){return profile==='canvas-2d'?createCanvasHost({canvas:surface,pixelRatio:1}):
  createTexturedWebGPUHost({canvas:surface,pixelRatio:1,enableReadback:true});}
function status(host,profile){return profile==='canvas-2d'?null:{general:host.getStatus(),textured:host.getTexturedStatus()};}
async function present(host,surface,frame,profile){
  if(profile==='canvas-2d'){
    host.renderFrame(frame);return {width:24,height:16,frameId:frame.frameId,serial:null,
      bytes:Array.from(surface.getContext('2d').getImageData(0,0,24,16).data)};
  }
  const ticket=host.requestReadback();void ticket.catch(()=>undefined);
  host.renderTexturedFrame(frame);const result=await ticket;await host.whenIdle();
  assert(result.frameId===frame.frameId&&result.width===24&&result.height===16,'Original readback identity');
  return {width:result.width,height:result.height,frameId:result.frameId,serial:result.serial,bytes:Array.from(result.bytes)};
}
async function closeHost(host,surface,profile){
  if(profile!=='canvas-2d')await host.whenIdle();
  await host.close();
  if(profile!=='canvas-2d'){
    const view=host.getStatus();assert(view.state==='closed'&&view.cleanupOutcome==='safe'&&view.pendingFrames===0
      &&view.pendingUploadBytes===0&&view.pendingReadbackBytes===0,'Real GPU retirement');
    assert(host.getTexturedStatus().pendingGeometryBytes===0,'Real geometry retirement');
  }
  let refused=false;try{host.renderFrame({});}catch(cause){refused=cause?.code===(profile==='canvas-2d'?'CANVAS_HOST_CLOSED':'WEBGPU_CLOSED');}
  assert(refused,'Original Host is terminal');surface.width=0;surface.height=0;surface.remove();
  return {closed:true,status:status(host,profile),surface:{connected:surface.isConnected,width:surface.width,height:surface.height}};
}

async function execute({profile,kind,role,importIdentity}){
  assert(['canvas-2d','webgpu-textured-2d'].includes(profile)&&kind==='atlas-import-v1'&&role==='healthy','Exact importer healthy selector');
  const realmId=crypto.randomUUID(),documentURL=location.href,records=[],cleanupErrors=[],causes=[];let surface,host,session,originalRetirement,primary,readbackContextAttributes=null;
  const response=await fetch(new URL('./__atlas-import-plan-v1.json',location.href));
  assert(response.ok&&response.url===new URL(PLAN_ROUTE,location.origin).href,'Fixed plan HTTP response');
  const raw=new Uint8Array(await response.arrayBuffer()),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
  assert(raw.length===importIdentity.plan.bytes&&sha256===importIdentity.plan.sha256,'Sealed actual Node plan body');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),plan=JSON.parse(text);
  assert(text===serialize(plan)&&JSON.stringify(plan)===JSON.stringify(EXPECTED_PLAN),'Complete normalized Node plan');
  deepFreeze(plan);assert(allFrozen(plan),'Parsed normalized values deeply immutable');
  const decoded=await decodeAtlasPng(),planResponse={url:response.url,status:response.status,bytes:raw.length,sha256,immutable:allFrozen(plan)};
  try{
    surface=canvas();
    if(profile==='canvas-2d'){
      // This collector reads every presented frame. Select its readback context before the Host uses the surface;
      // this does not change Engine defaults or request a 2D context from a WebGPU presentation surface.
      const context=surface.getContext('2d',{willReadFrequently:true});
      assert(context&&typeof context.getContextAttributes==='function','Actual Canvas readback context attributes required');
      const attributes=context.getContextAttributes();
      assert(attributes.willReadFrequently===true&&attributes.alpha===true&&attributes.colorSpace==='srgb','Actual fixed Canvas readback attributes');
      assert(surface.getContext('2d')===context,'Original selected Canvas context retained');
      readbackContextAttributes={...attributes};
    }
    host=createHost(surface,profile);
    // These exact parsed/frozen normalized objects flow directly into the public example's two factories.
    session=await createAtlasImportSession({host,profile,image:decoded.image,sequenceInput:plan.sequenceInput,spriteSheetFrames:plan.spriteSheetFrames});
    const {actor,clip}=session;actor.playback.start();
    for(const row of SEQUENCE){
      if(row.time)session.advanceTo(row.time);
      const frame=session.capture(),texture=actor.lease.value;
      const observations={profile,session:session.inspect(),displayBasis:[actor.bitmap.localToGlobal(0,0),actor.bitmap.localToGlobal(1,0),actor.bitmap.localToGlobal(0,1)],
        commands:frame.commands,images:frame.images.map(image=>({width:image.width,height:image.height,byteLength:image.byteLength,pixels:Array.from(copyImageData2DPixels(image))})),
        frameProfile:frame.profile??null,importIdentity,planResponse,
        factories:{sequenceInput:plan.sequenceInput,spriteSheetFrames:plan.spriteSheetFrames,
          clip:{atlasWidth:clip.atlasWidth,atlasHeight:clip.atlasHeight,frameCount:clip.frameCount,durationSeconds:clip.durationSeconds},
          sheet:{atlasWidth:actor.sheet.atlasWidth,atlasHeight:actor.sheet.atlasHeight,frameCount:actor.sheet.frameCount,names:actor.sheet.names},
          fullAtlas:texture.sourceRect,sameOriginalTexture:session.resources().textures[0]===texture,
          immutable:allFrozen(plan)&&allFrozen(clip)&&allFrozen(actor.sheet.getRegion('A'))&&allFrozen(actor.sheet.getRegion('B'))}};
      assertImportObservation(observations,row.id);
      const presentation=await present(host,surface,frame,profile);
      const accepted=await globalThis.__egretAtlasFrame({id:row.id,profile,realmId,documentURL,presentation,observations});
      assert(accepted?.accepted===true&&accepted.id===row.id,'Original bridge comparison accepted');records.push(row.id);
    }
    const owners=await session.retire();assertImportRetirement(owners);originalRetirement={owners,host:await closeHost(host,surface,profile)};
  }catch(cause){primary={cause};}
  finally{
    for(const [name,operation] of [['session',()=>session?.close()],['original Host',()=>host&&closeHost(host,surface,profile)]]){
      try{await operation();}catch(cause){causes.push(cause);cleanupErrors.push({name,error:errorView(cause)});}
    }
  }
  if(primary||causes.length)throw new AggregateError([...(primary?[primary.cause]:[]),...causes],'Original importer fixture failed',
    {cause:primary?primary.cause:causes[0]});
  return {profile,kind,role,realmId,documentURL,origin:location.origin,decoded:decoded.evidence,planResponse,importIdentity,records,originalRetirement,readbackContextAttributes,cleanupErrors};
}
export async function runAtlasImportNativeFixture(selector){
  try{return {status:'COMPLETE',...await execute(selector)};}catch(cause){return {status:'FAILED',error:errorView(cause)};}
}
