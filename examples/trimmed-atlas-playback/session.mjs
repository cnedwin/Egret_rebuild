// SPDX-License-Identifier: Apache-2.0
// Public SDK composition. The session owns acquired leases; sheets and Bitmaps borrow them.
import { Sprite, createAssetRef, createAssetType, createEngine, createEngineForProfile,
  createSequenceClip, createSpriteSheet, createTexture, isTexture, TEXTURED_FRAME_PROFILE_2D } from '@egret/engine';

const PROFILE = 'trim-rotation-v1';
const A = Object.freeze({ name:'A', x:0, y:0, width:2, height:3,
  layout:Object.freeze({sourceWidth:4,sourceHeight:5,trimX:1,trimY:1,packedRotation:0}) });
const B = Object.freeze({ name:'B', x:3, y:0, width:2, height:3,
  layout:Object.freeze({sourceWidth:4,sourceHeight:5,trimX:1,trimY:2,packedRotation:90}) });
const FRAME = Object.freeze({width:24,height:16,clearColor:0,clearAlpha:0});
function errorView(cause,seen=new Set(),depth=0){
  const result={wasUndefined:cause===undefined};
  try{
    result.name=typeof cause?.name==='string'?cause.name:null;result.code=typeof cause?.code==='string'?cause.code:null;
    result.message=String(cause?.message??cause);
    if(cause!==null&&(typeof cause==='object'||typeof cause==='function')){
      if(seen.has(cause)){result.cycle=true;return result;}seen.add(cause);
      if(depth>=8){result.truncated=true;return result;}
      if(Object.hasOwn(cause,'cause'))result.cause=errorView(cause.cause,new Set(seen),depth+1);
      if(Array.isArray(cause.errors))result.errors=cause.errors.map(value=>errorView(value,new Set(seen),depth+1));
      if(Array.isArray(cause.cleanupErrors))result.cleanupErrors=cause.cleanupErrors.map(value=>errorView(value,new Set(seen),depth+1));
    }
  }catch{result.unreadable=true;}
  return result;
}
export async function createAtlasFrameSession({host,profile,image}) {
  if (!['canvas-2d','webgpu-textured-2d'].includes(profile)) throw new TypeError('Fixed 2D profile required');
  const diagnostics=[], ticks=[], cleanupErrors=[], leases=[], textures=[];
  const engine = await (profile==='canvas-2d' ? createEngine({host,onDiagnostic:row=>diagnostics.push(row)})
    : createEngineForProfile({host,onDiagnostic:row=>diagnostics.push(row)},TEXTURED_FRAME_PROFILE_2D));
  const scope=engine.createScope(), animationScope=engine.createScope();
  const type=createAssetType('egret.example.trimmed-atlas',isTexture);
  const ref=createAssetRef(type,'original-atlas');
  let sourceSeconds=0, state='starting', closePromise, sheet;
  const actors={};
  const clip=createSequenceClip({atlasWidth:6,atlasHeight:6,frames:[
    {...A,durationSeconds:.125},{...B,durationSeconds:.25},
  ]},PROFILE);
  engine.assets.register(type,{load(){const value=createTexture(image);textures.push(value);return Promise.resolve(value);},dispose(value){value.dispose();}});
  const diagnosticViews=()=>diagnostics.map(row=>({code:row.code,severity:row.severity,phase:row.phase,cause:errorView(row.cause)}));
  function retirementEvidence(){
    // Terminal state alone is not cleanup success: authentic diagnostics carry nonthrowing Scope failures.
    const released=leases.map(lease=>{try{void lease.value;return false;}catch(cause){if(cause?.code!=='ASSET_LEASE_RELEASED')throw cause;return true;}});
    return {state,controllers:Object.values(actors).map(actor=>actor.playback.isDisposed),
      bitmaps:Object.values(actors).map(actor=>actor.bitmap.isDisposed),sheets:Object.values(actors).map(actor=>actor.sheet.isDisposed),
      leases:released,textures:textures.map(texture=>texture.isDisposed),stage:engine.stage.isDisposed,clock:engine.clock.state,
      cleanupErrors:cleanupErrors.length,cleanupFailures:cleanupErrors.map(row=>({name:row.name,error:errorView(row.cause)})),diagnostics:diagnosticViews()};
  }
  function close() {
    if(closePromise) return closePromise;
    state='closing';
    closePromise=(async()=>{
      const keep=async(name,run)=>{try{await run();}catch(cause){cleanupErrors.push({name,cause});}};
      // Controllers retire before display owners and before the lease-owning scope.
      await keep('animation Scope',()=>animationScope.dispose());
      await keep('display and lease Scope',()=>scope.dispose());
      await keep('Engine and original Host',()=>engine.dispose());
      state='closed';
      if(cleanupErrors.length||diagnostics.length){
        // Preserve every original thrown/diagnostic cause, including an actual throw(undefined).
        const causes=[...cleanupErrors.map(row=>row.cause),...diagnostics.map(row=>row.cause)];
        const error=new AggregateError(causes,'Atlas session cleanup failed',{cause:causes[0]});
        error.diagnostics=Object.freeze([...diagnostics]);error.retirement=retirementEvidence();throw error;
      }
    })();
    return closePromise;
  }
  try {
    engine.clock.onTick(animationScope,tick=>{ticks.push({...tick});});
    engine.advanceTime(0);
    // Each acquisition has its own exact lease even when the manager shares a Texture.
    for(const [id,x,mode] of [['left',2,'once'],['right',12,'loop']]) {
      const lease=scope.use(await engine.assets.acquire(ref,{signal:scope.signal})); leases.push(lease);
      const ownedSheet=scope.use(createSpriteSheet(lease,[A,B],PROFILE)); sheet??=ownedSheet;
      const parent=scope.use(new Sprite()), bitmap=scope.use(ownedSheet.createBitmap('A'));
      parent.x=x;parent.y=2;parent.addChild(bitmap);engine.stage.addChild(parent);
      const playback=engine.createSequencePlayback(animationScope,bitmap,clip,{mode});
      actors[id]=Object.freeze({parent,bitmap,playback,lease,sheet:ownedSheet,mode});
    }
    if(leases[0]===leases[1]) throw new Error('Independent exact leases required');
    state='ready';
  } catch(cause) { try{await close();}catch(cleanup){throw new AggregateError([cause,cleanup],'Atlas initialization and cleanup failed');} throw cause; }
  const open=()=>{if(state!=='ready')throw new Error('Atlas session is closed');};
  const inspect=()=>({state,sourceSeconds,gameSeconds:engine.clock.elapsedSeconds,tickId:engine.clock.tickId,
    ticks:ticks.map(row=>({...row})),diagnostics:diagnosticViews(),
    actors:Object.fromEntries(Object.entries(actors).map(([id,actor])=>[id,{
      mode:actor.mode,state:actor.playback.state,elapsed:actor.playback.elapsedSeconds,isDisposed:actor.playback.isDisposed,
      sample:actor.playback.lastSample??null,bitmapDisposed:actor.bitmap.isDisposed,
      naturalWidth:actor.bitmap.naturalWidth,naturalHeight:actor.bitmap.naturalHeight,
      sourceRect:actor.bitmap.sourceRect,bounds:actor.bitmap.isDisposed?null:actor.bitmap.getBounds(),
      parent:{x:actor.parent.x,y:actor.parent.y,rotation:actor.parent.rotation,anchorOffsetX:actor.parent.anchorOffsetX,
        anchorOffsetY:actor.parent.anchorOffsetY,clipRect:actor.parent.clipRect??null},
    }])),cleanupErrors:cleanupErrors.map(row=>({name:row.name,error:errorView(row.cause)}))});
  return Object.freeze({engine,actors:Object.freeze(actors),clip,
    advanceTo(seconds){open();const tick=engine.advanceTime(seconds);sourceSeconds=seconds;return tick;},
    capture(){open();return profile==='canvas-2d'?engine.captureFrame(FRAME):engine.captureTexturedFrame(FRAME);},
    inspect,
    async retire(){
      actors.right.playback.stop();await close();
      const retired=retirementEvidence();
      if(retired.state!=='closed'||!['controllers','bitmaps','sheets','leases','textures'].every(key=>retired[key].length>0&&retired[key].every(Boolean))
        ||!retired.stage||retired.clock!=='closed'||retired.cleanupErrors||retired.diagnostics.length)throw new Error('Original owners did not retire');
      return retired;
    },close});
}
