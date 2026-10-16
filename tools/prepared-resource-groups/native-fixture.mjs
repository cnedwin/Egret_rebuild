// SPDX-License-Identifier: Apache-2.0
// Independent browser fixture. Only public SDK objects and original native operations.
import { createCanvasHost } from '@egret/engine/web';
import { createPreparedOutfitSource } from './source.mjs';
import { createPreparedSceneDependencies } from './dependencies.mjs';
import { createPreparedResourceSceneSession } from './session.mjs';

const WIDTH=192, HEIGHT=128, LEFT='pilot-left', RIGHT='pilot-right';
const BASELINE='PSN00 genuine native scene prerequisite';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const outcome=promise=>Promise.resolve(promise).then(value=>({ok:true,value}),cause=>({ok:false,cause}));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});void promise.catch(()=>undefined);return {promise,resolve,reject};}
function errorView(cause,depth=0){
  const view={wasUndefined:cause===undefined,code:typeof cause?.code==='string'?cause.code:null,message:String(cause?.message??cause)};
  if(depth<8&&cause!==null&&(typeof cause==='object'||typeof cause==='function')){
    if(Object.hasOwn(cause,'cause'))view.cause=errorView(cause.cause,depth+1);
    if(Array.isArray(cause.cleanupErrors))view.cleanupErrors=cause.cleanupErrors.map(value=>errorView(value,depth+1));
  }return view;
}
function cleanupFailure(primary,failures){
  const error=new Error('Actual fixture owner cleanup failed');error.code='P03_FIXTURE_CLEANUP_FAILED';
  if(primary!==undefined)error.cause=primary.cause;
  error.cleanupErrors=failures;return error;
}
function contains(cause,test,depth=0){
  if(test(cause))return true;
  if(depth>12||cause===null||(typeof cause!=='object'&&typeof cause!=='function'))return false;
  return Object.hasOwn(cause,'cause')&&contains(cause.cause,test,depth+1)
    ||Array.isArray(cause.cleanupErrors)&&cause.cleanupErrors.some(value=>contains(value,test,depth+1));
}
function canvasForScene(){
  assert(document.querySelector('#scene')===null,'Previous genuine canvas must be retired');
  const canvas=document.createElement('canvas');canvas.id='scene';canvas.width=WIDTH;canvas.height=HEIGHT;
  canvas.style.cssText='display:block;width:192px;height:128px;border:0;padding:0;margin:0;transform:none;opacity:1;visibility:visible;';
  document.body.append(canvas);return canvas;
}
function hostSnapshot(host,profile){return profile==='canvas-2d'?null:{general:host.getStatus(),textured:host.getTexturedStatus(),scene:host.getSceneStatus()};}
function liveLeaseCount(leases){
  let count=0;for(const lease of leases){try{void lease.value;count++;}catch(cause){if(cause?.code!=='ASSET_LEASE_RELEASED')throw cause;}}return count;
}
async function drain(source){while(source.sourceLedger.active.size>0)await Promise.allSettled([...source.sourceLedger.active]);}
function controlledReader(){
  const plans=[],active=new Set();let pending=0,heldBytes=0;
  function arm(){
    const plan={rows:new Map(),entered:deferred()};
    for(const id of ['C','D'])plan.rows.set(id,{gate:deferred(),entered:false});
    plans.push(plan);return plan;
  }
  async function readBytes(ref){
    const match=/outfit-([ABCD])\.png$/.exec(ref.id);assert(match,'Only genuine fixed outfit URL');
    const id=match[1],plan=plans.find(value=>value.rows.has(id)&&!value.rows.get(id).entered),row=plan?.rows.get(id);
    pending++;
    try{
      const response=await fetch(ref.id);assert(response.ok,'Native original reader HTTP');
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(row){
        row.entered=true;row.bytes=bytes;heldBytes+=bytes.byteLength;active.add(row);
        if([...plan.rows.values()].every(value=>value.entered))plan.entered.resolve();
        try{await row.gate.promise;}finally{heldBytes-=bytes.byteLength;row.bytes=undefined;active.delete(row);}
      }
      return bytes;
    }catch(cause){if(plan!==undefined)plan.entered.reject(cause);throw cause;}
    finally{pending--;}
  }
  function release(plan){for(const row of plan.rows.values())row.gate.resolve();}
  function releaseAll(){for(const plan of plans)release(plan);}
  return {readBytes,arm,release,releaseAll,snapshot(){return {readerPending:pending,readerHeldBytes:heldBytes,heldJobs:active.size};}};
}
function actorCoordinators(session){return [session.scene.actors[LEFT].coordinator,session.scene.actors[RIGHT].coordinator];}
async function send(label,frame,control,presentation,observations){
  assert(presentation.bytes instanceof Uint8Array,'Original presentation byte view');
  return globalThis.__egretPreparedNativeFrame({label,frame,control,presentation:{...presentation,bytes:Array.from(presentation.bytes)},observations});
}
async function directPrerequisite(profile,observations){
  let canvas,source,dependencies,host,session,composition,coordinators=[],safeSurface=false,pendingPresentations=0,primary;
  const cleanupErrors=[],cleanupCauses=[];
  const keep=async(operation,run)=>{try{await run();}catch(cause){cleanupCauses.push(cause);cleanupErrors.push({operation,error:errorView(cause)});}};
  try{
    canvas=canvasForScene();source=createPreparedOutfitSource();dependencies=createPreparedSceneDependencies();await dependencies.ready;
    const gpu=profile==='webgpu-scene-textured'?await import('../resource-scene/gpu-scene.mjs'):undefined;
    host=gpu?gpu.createTexturedSceneWebGPUHost({canvas,pixelRatio:1,enableReadback:true}):createCanvasHost({canvas,pixelRatio:1});
    session=createPreparedResourceSceneSession({host,profile,outfitSource:source,dependencies:dependencies.dependencies});
    await session.ready;coordinators=actorCoordinators(session);if(gpu)composition=gpu.createResourceSceneGPU({session});
    await session.scene.textReady;
    const frame=session.capture();pendingPresentations++;
    const presentation={label:'prerequisite-startup',frameId:frame.frameId,serial:null,width:WIDTH,height:HEIGHT,
      frameImagesBytes:(frame.images??[]).reduce((sum,value)=>sum+value.byteLength,0),
      geometryLogicalBytes:(frame.geometries??[]).reduce((sum,value)=>sum+value.logicalByteLength,0)};
    if(gpu){
      const original=host.requestReadback();void original.catch(()=>undefined);host.renderSceneTexturedFrame(composition.scene,frame);
      const readback=await original;await host.whenIdle();
      assert(readback.frameId===frame.frameId&&readback.width===WIDTH&&readback.height===HEIGHT,'Genuine prerequisite readback');
      presentation.serial=readback.serial;presentation.bytes=new Uint8Array(readback.bytes);
    }else{host.renderFrame(frame);presentation.bytes=new Uint8Array(canvas.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data);}
    pendingPresentations--;
    observations.frame=await send('prerequisite-startup','classic-left-pose0','ordinary',presentation,
      {session:session.inspect(),source:source.snapshot(),dependencies:dependencies.snapshot(),host:hostSnapshot(host,profile)});
  }catch(cause){primary={cause};throw cause;}
  finally{
    if(session)await keep('session.close',()=>session.close());
    if(source)await keep('source.close',()=>source.close());
    if(dependencies)await keep('dependencies.close',()=>dependencies.close());
    if(host){
      if(profile!=='canvas-2d')await keep('host.whenIdle',()=>host.whenIdle());
      await keep('host.close',()=>host.close());
      safeSurface=cleanupErrors.length===0&&(profile==='canvas-2d'||host.getStatus().cleanupOutcome==='safe');
    }else safeSurface=cleanupErrors.length===0;
    if(canvas&&safeSurface){canvas.width=0;canvas.height=0;canvas.remove();}
    observations.retirement={session:session?.inspect()??null,source:source?.snapshot()??null,dependencies:dependencies?.snapshot()??null,
      host:host?hostSnapshot(host,profile):null,canvas:canvas?{connected:canvas.isConnected,width:canvas.width,height:canvas.height}:null,
      pendingPresentations,cleanupErrors,safeSurface,readerPending:0,readerHeldBytes:0,warmLeases:0,warmPending:0,
      coordinators:coordinators.map(value=>value.snapshot())};
    if(cleanupErrors.length!==0)throw cleanupFailure(primary,cleanupCauses);
  }
}
async function applicationFactory(observations){
  const response=await fetch(new URL('./application.mjs',import.meta.url));observations.moduleStatus=response.status;
  if(response.status===404){const error=new Error('P03_MISSING_PREPARED_RESOURCE_APPLICATION');error.code=error.message;throw error;}
  assert(response.ok,'Application original module HTTP');
  const module=await import('./application.mjs');
  assert(typeof module.createPreparedResourceApplication==='function','Original public application factory');
  return module.createPreparedResourceApplication;
}
function observeInput(app,canvas){
  const events=[],activations=[],listeners=[];
  for(const type of ['mousemove','mousedown','mouseup']){
    const listener=event=>events.push({type:event.type,isTrusted:event.isTrusted,clientX:event.clientX,clientY:event.clientY,button:event.button,buttons:event.buttons});
    canvas.addEventListener(type,listener);listeners.push([type,listener]);
  }
  // Subscribe to the genuine application's public input descriptors; no duplicate native owner.
  app.session.scene.engine.stage.on(app.input.events.activate,event=>{
    const targetId=event.target===app.session.scene.actors[RIGHT]?.root?RIGHT:event.target===app.session.scene.actors[LEFT]?.root?LEFT:null;
    activations.push({type:event.type.key,targetId,x:event.payload.globalX,y:event.payload.globalY});
  },{signal:app.session.scene.inputScope.signal});
  return {events,activations,detach(){for(const [type,listener]of listeners)canvas.removeEventListener(type,listener);}};
}
async function assignedApplication(create,profile,kind,observations){
  const reader=controlledReader(),warmLeases=[],warmTasks=[],cleanupErrors=[],cleanupCauses=[];
  let app,canvas,source,dependencies,coordinators=[],controlScope,inputObservation,closing,warmPending=0,primary;
  const keep=async(operation,run)=>{try{await run();}catch(cause){cleanupCauses.push(cause);cleanupErrors.push({operation,error:errorView(cause)});}};
  async function saved(label,frame,control='ordinary',original){
    const presentation=original??await app.present(label);
    const account={application:app.inspect(),reader:reader.snapshot(),warmLeases:liveLeaseCount(warmLeases),warmPending};
    const result=await send(label,frame,control,presentation,account);
    observations.checkpoints??=[];observations.checkpoints.push({label,result,account});return result;
  }
  function bindingPair(){return [app.session.scene.actors[LEFT].outer.textureLease,app.session.scene.actors[LEFT].trim.textureLease];}
  function unchanged(pair){assert(pair.every((value,index)=>value===bindingPair()[index]),'Both prior live layer leases survive refusal');}
  async function replace(id,key){await app.session.replaceOutfit(id,key);await drain(source);}
  try{
    source=createPreparedOutfitSource({readBytes:reader.readBytes});dependencies=createPreparedSceneDependencies();canvas=canvasForScene();
    app=create({canvas,profile,outfitSource:source,dependencyOwner:dependencies});
    await saved('startup','classic-left-pose0','ordinary',await app.ready);coordinators=actorCoordinators(app.session);
    inputObservation=observeInput(app,canvas);observations.trustedMouse={events:inputObservation.events,activations:inputObservation.activations};
    await globalThis.__egretPreparedNativeClick();
    const selection=await app.whenIdle();
    assert(app.session.inspect().selectedId===RIGHT,'Actual SDK target selected right');
    assert(inputObservation.activations.length===1&&inputObservation.activations[0].targetId===RIGHT,'One genuine right SDK activation');
    await saved('native-right','classic-right-pose0','ordinary',selection);
    if(kind!=='ordinary'){
      app.session.advanceTo(0.125);
      await replace(LEFT,'summer');await saved('healthy-summer','summer-right-pose1');
      controlScope=app.session.scene.engine.createScope();
      const ref=app.session.scene.outfitRefs[kind==='manual-old-A-outer'?'A':'B'];
      const lease=controlScope.use(await app.session.scene.engine.assets.acquire(ref,{signal:controlScope.signal}));warmLeases.push(lease);
      const actor=app.session.scene.actors[LEFT];
      if(kind==='manual-old-A-outer')actor.outer.textureLease=lease;else actor.trim.textureLease=lease;
      await saved('assigned-old-layer','summer-right-pose1',kind);
    }else{
      app.session.advanceTo(0.125-2**-20);
      await saved('before-boundary','classic-right-before-boundary');
      app.session.advanceTo(0.125);await saved('boundary','classic-right-pose1');
      await replace(LEFT,'summer');await saved('summer','summer-right-pose1');
      await replace(LEFT,'classic');await saved('classic-before-fault','classic-right-pose1');
      // C succeeds and D fails only after both genuine fetches have returned their original bytes.
      for(const mode of ['error','undefined']){
        const prior=bindingPair(),plan=reader.arm(),original=outcome(app.session.replaceOutfit(LEFT,'summer'));
        await plan.entered.promise;
        observations.readerFailures??=[];const record={mode,pending:{...source.snapshot(),...reader.snapshot()}};observations.readerFailures.push(record);
        plan.rows.get('C').gate.resolve();
        const marker=new Error('Assigned original native reader failure');marker.code='P03_ASSIGNED_READER_ERROR';
        plan.rows.get('D').gate.reject(mode==='error'?marker:undefined);
        const result=await original;assert(!result.ok,'Assigned reader failure must reject logical publication');
        assert(mode==='error'?contains(result.cause,value=>value===marker):contains(result.cause,value=>value?.code==='WEB_PNG_READ_FAILED'
          &&Object.hasOwn(value,'cause')&&value.cause===undefined),'Exact original assigned PNG reader rejection retained');
        record.rejection=errorView(result.cause);await drain(source);unchanged(prior);
        await saved(mode==='error'?'source-error':'source-undefined','classic-right-pose1');
      }
      {
        const prior=bindingPair(),plan=reader.arm(),original=outcome(app.session.replaceOutfit(LEFT,'summer'));await plan.entered.promise;
        app.session.cancelOutfit(LEFT,'independent held-reader cancellation');
        const result=await original;assert(!result.ok&&result.cause?.code==='PREPARED_OUTFIT_CANCELLED','Original cancel rejection');
        const pending={...source.snapshot(),...reader.snapshot()};
        assert(pending.activeJobs===2&&pending.pendingReads===2&&pending.readerHeldBytes===164,'Original reader occupancy remains after cancellation');
        observations.heldCancellation={rejection:errorView(result.cause),pending};
        unchanged(prior);await saved('held-cancel','classic-right-pose1');
        reader.release(plan);await drain(source);unchanged(prior);
      }
      {
        const prior=bindingPair(),scope=app.session.scene.engine.createScope();controlScope=scope;
        // Genuine warm values are independently leased before the group requests them.
        const tasks=['C','D'].map(id=>{warmPending++;const original=app.session.scene.engine.assets.acquire(app.session.scene.outfitRefs[id],{signal:scope.signal});
          warmTasks.push(original);return original.then(lease=>{warmLeases.push(scope.use(lease));return lease;}).finally(()=>{warmPending--;});});
        await Promise.all(tasks);await drain(source);assert(liveLeaseCount(warmLeases)===2,'Two genuine independently held warm leases');
        const original=outcome(app.session.replaceOutfit(LEFT,'summer'));app.session.cancelOutfit(LEFT,'independent warm ready-reaction cancellation');
        const result=await original;assert(!result.ok&&result.cause?.code==='PREPARED_OUTFIT_CANCELLED','Warm cancelled before publication reaction');
        await Promise.resolve();await Promise.resolve();unchanged(prior);
        observations.warmCancellation={rejection:errorView(result.cause),actualWarmLeases:liveLeaseCount(warmLeases),source:source.snapshot()};
        await saved('warm-cancel','classic-right-pose1');scope.dispose();controlScope=undefined;await drain(source);
      }
      await replace(LEFT,'mix');await saved('mix','mix-right-pose1');
      await replace(LEFT,'classic');await saved('classic-before-repeat','classic-right-pose1');
      await replace(LEFT,'summer');await saved('repeated-summer','summer-right-pose1');
      await replace(LEFT,'mix');await saved('repeated-mix','mix-right-pose1');
      const right=app.session.scene.actors[RIGHT],rightAtlas=right.atlasLease.value;
      app.session.remove(LEFT);assert(right.atlasLease.value===rightAtlas&&!right.body.isDisposed,'Independent surviving right actor remains live');
      await saved('remove-left','removed-left-right-pose1');
      await saved('pending-close-before','removed-left-right-pose1');
      const plan=reader.arm(),original=outcome(app.session.replaceOutfit(RIGHT,'summer'));await plan.entered.promise;
      let closeSettled=false;closing=app.close();assert(app.close()===closing,'Cached original application close Promise');
      void closing.then(()=>{closeSettled=true;},()=>{closeSettled=true;});
      await Promise.resolve();await Promise.resolve();
      observations.pendingClose={closeSettled,application:app.inspect(),reader:reader.snapshot()};
      assert(!closeSettled&&source.snapshot().activeJobs===2&&reader.snapshot().readerHeldBytes===164,'Close awaits real original held reads');
      reader.release(plan);await closing;const result=await original;assert(!result.ok,'Pending publication rejects after application close');
      observations.pendingClose.rejection=errorView(result.cause);
    }
  }catch(cause){primary={cause};throw cause;}
  finally{
    inputObservation?.detach();
    if(controlScope)await keep('control Scope dispose',()=>controlScope.dispose());
    // Always release genuine external operations before awaiting cleanup after a failing assertion.
    reader.releaseAll();await Promise.allSettled(warmTasks);
    if(app)await keep('application.close',()=>closing??app.close());
    else{
      if(source)await keep('source.close',()=>source.close());
      if(dependencies)await keep('dependencies.close',()=>dependencies.close());
      if(canvas)await keep('canvas retirement',()=>{canvas.width=0;canvas.height=0;canvas.remove();});
    }
    const view=app?.inspect();
    observations.retirement={session:app?.session?.inspect()??null,source:source?.snapshot()??null,dependencies:dependencies?.snapshot()??null,host:view?.host??null,
      canvas:canvas?{connected:canvas.isConnected,width:canvas.width,height:canvas.height}:null,pendingPresentations:view?.pendingPresentations??0,
      cleanupErrors:[...(view?.cleanupErrors??[]),...cleanupErrors],safeSurface:view?.safeSurface??true,
      ...reader.snapshot(),warmLeases:liveLeaseCount(warmLeases),warmPending,coordinators:coordinators.map(value=>value.snapshot())};
    // heldJobs is a separate external observation, not part of the closed retirement shape.
    delete observations.retirement.heldJobs;
    if(cleanupErrors.length!==0)throw cleanupFailure(primary,cleanupCauses);
  }
}
export async function runPreparedResourceSceneFixture({profile,kind}){
  assert(['canvas-2d','webgpu-scene-textured'].includes(profile),'Fixed genuine profile');
  assert(['ordinary','manual-old-A-outer','manual-old-B-trim'].includes(kind),'Fixed native scenario');
  const cases=[];
  async function run(name,phase,operation){const observations={};let ok=true,error=null;
    try{await operation(observations);}catch(cause){ok=false;error=errorView(cause);}
    cases.push({name,phase,ok,error,observations});return ok;
  }
  if(!await run(BASELINE,'baseline',observations=>directPrerequisite(profile,observations)))return {cases};
  await run(kind==='ordinary'?'PSN01 ordinary application lifecycle':'PSN02 assigned wrong layer','assigned',async observations=>{
    const create=await applicationFactory(observations);await assignedApplication(create,profile,kind,observations);
  });
  return {cases};
}
