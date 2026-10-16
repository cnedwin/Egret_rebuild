// SPDX-License-Identifier: Apache-2.0
// Original browser operations only; the collector controls page/origin separation.
import { copyImageData2DPixels } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createAtlasFrameSession } from '../../examples/trimmed-atlas-playback/session.mjs';
import { decodeAtlasPng } from '../../examples/trimmed-atlas-playback/image.mjs';
import { assertAtlasObservation, assertAtlasRetirement, PROFILES, KINDS } from './scenario.mjs';
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
async function executeAtlasFrameNativeFixture({profile,kind,role}) {
  assert(PROFILES.includes(profile)&&KINDS.includes(kind)&&['healthy','assigned'].includes(role),'Closed fixture selector');
  assert(kind!=='ordinary'||role==='healthy','Ordinary healthy only');
  const realmId=crypto.randomUUID(),documentURL=location.href;
  let surface,host,session,replaySurface,replayHost,savedN01,originalRetirement,replayRetirement;
  const records=[],cleanupErrors=[],cleanupCauses=[];let primary;
  const decoded=await decodeAtlasPng();
  async function capture(id){
    const frame=session.capture();if(id==='N01')savedN01=frame;
    assert(Object.isFrozen(session.clip)&&session.actors.left.lease!==session.actors.right.lease,'Immutable shared clip and independent exact leases');
    for(const actor of Object.values(session.actors)){
      const sample=actor.playback.lastSample;
      if(sample)assert(Object.isFrozen(sample)&&Object.isFrozen(sample.region)&&Object.isFrozen(sample.region.layout),'Original immutable complete sample');
      const region=actor.sheet.getRegion('A');assert(Object.isFrozen(region)&&Object.isFrozen(region.layout),'Original immutable sheet region');
    }
    const observations={profile,session:session.inspect(),commands:frame.commands,
      images:(frame.images??[]).map(image=>({width:image.width,height:image.height,byteLength:image.byteLength,pixels:Array.from(copyImageData2DPixels(image))})),
      frameProfile:frame.profile??null};
    assertAtlasObservation(observations,id,kind,role);
    const presentation=await present(host,surface,frame,profile);
    const caseId=kind==='ordinary'?id:kind+':'+role;
    await globalThis.__egretAtlasFrame({id:caseId,profile,realmId,documentURL,presentation,observations});
    records.push(caseId);
  }
  try {
    surface=canvas();host=createHost(surface,profile);
    session=await createAtlasFrameSession({host,profile,image:decoded.image});
    if(kind==='ordinary'){
      await capture('N01');session.actors.left.playback.start();session.advanceTo(.125);await capture('N02');
      session.actors.right.playback.start();await capture('N03');session.actors.left.playback.pause();await capture('N04');
      session.advanceTo(.1875);session.actors.left.playback.resume();await capture('N05');
      session.advanceTo(.4375);await capture('N06');session.advanceTo(.5);await capture('N07');
      const parent=session.actors.left.parent;parent.rotation=90;parent.anchorOffsetX=1;parent.anchorOffsetY=1;
      await capture('N08');parent.clipRect={x:0,y:0,width:3,height:4};await capture('N09');
      parent.rotation=0;parent.anchorOffsetX=0;parent.anchorOffsetY=0;parent.clipRect=undefined;await capture('N10');
      const owners=await session.retire();assertAtlasRetirement(owners);const original=await closeHost(host,surface,profile);
      originalRetirement={owners,host:original};
      // The exact original immutable frame survives all of its origin owners and Host.
      assert(Object.isFrozen(savedN01)&&Object.isFrozen(savedN01.commands),'Saved genuine frame remains frozen');
      replaySurface=canvas();replayHost=createHost(replaySurface,profile);assert(replayHost!==host,'Distinct replay Host');
      await replayHost.start();
      const presentation=await present(replayHost,replaySurface,savedN01,profile);
      await globalThis.__egretAtlasFrame({id:'N11',profile,realmId,documentURL,presentation,
        observations:{savedSubject:'savedN01',sameFrameObject:true,originalRetirement,commands:savedN01.commands,
          images:(savedN01.images??[]).map(image=>({width:image.width,height:image.height,byteLength:image.byteLength,pixels:Array.from(copyImageData2DPixels(image))}))}});
      records.push('N11');replayRetirement=await closeHost(replayHost,replaySurface,profile);
    } else {
      session.actors.left.playback.start();session.advanceTo(.125);await capture('N02');
      const owners=await session.retire();assertAtlasRetirement(owners);
      originalRetirement={owners,host:await closeHost(host,surface,profile)};
    }
    return {profile,kind,role,realmId,documentURL,origin:location.origin,decoded:decoded.evidence,records,originalRetirement,replayRetirement:replayRetirement??null,cleanupErrors};
  } catch(cause){primary={cause};throw cause;}
  finally {
    // A cleanup error rejects the fixture; it can never become a successful assigned control.
    for(const [name,operation] of [['session',()=>session?.close()],['original Host',()=>host&&closeHost(host,surface,profile)],
      ['replay Host',()=>replayHost&&closeHost(replayHost,replaySurface,profile)]]){
      try{await operation();}catch(cause){cleanupCauses.push(cause);cleanupErrors.push({name,error:errorView(cause)});}
    }
    if(cleanupErrors.length)throw new AggregateError([...(primary?[primary.cause]:[]),...cleanupCauses],'Native owner cleanup failed',
      {cause:primary?primary.cause:cleanupCauses[0]});
  }
}
export async function runAtlasFrameNativeFixture(selector){
  // Preserve causes across the browser/Node serialization boundary instead of losing them in a thrown Playwright Error.
  try{return {status:'COMPLETE',...await executeAtlasFrameNativeFixture(selector)};}
  catch(cause){return {status:'FAILED',error:errorView(cause)};}
}
