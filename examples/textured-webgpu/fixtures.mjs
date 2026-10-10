// First-party Apache-2.0 prospective public scene. Future examples/textured-webgpu/fixtures.mjs.
import * as egret from '@egret/engine';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { definition, ATLAS, N02_GEOMETRY, N06_GEOMETRY, N09_GEOMETRY, PUBLIC_RECIPES } from '../../tools/textured-webgpu/fixtures.mjs';
// No private product imports or frame registrar. Expected pixels live in the independent oracle.
let resourceNumber=0,lastReport;
const fields=['a','b','c','d','tx','ty'];
function invariant(value,reason){if(!value)throw Error(reason);}
function observed(promise){promise.catch(()=>{});return promise;}
function matrixAdmission(actual,ideal,bound,name){
  invariant(actual&&fields.every((field,i)=>Number.isFinite(actual[field])&&Math.abs(actual[field]-ideal[i])<=bound),`NATIVE_AUTHORING_MATRIX:${name}`);
  return {name,actual:fields.map(field=>actual[field]),ideal:[...ideal],absoluteBound:bound};
}
function ownedGeometry(value){return egret.createTexturedGeometry2D({positions:new Float64Array(value.positions),uvs:new Float64Array(value.uvs),
  lightColors:new Float64Array(value.lightColors),indices:new Uint16Array(value.indices)});}
function quad(width,height,light=[1,1,1,1],constantUV){return {positions:[0,0,width,0,width,height,0,height],
  uvs:constantUV===undefined?[0,0,1,0,1,1,0,1]:Array(8).fill(constantUV),lightColors:[...light,...light,...light,...light],indices:[0,1,2,0,2,3]};}
function emptyGeometry(){return ownedGeometry({positions:[],uvs:[],lightColors:[],indices:[]});}
function rect(parent,color,width=32,height=32){const node=parent.addChild(new egret.Sprite());node.graphics.beginFill(color,1).drawRect(0,0,width,height);return node;}
async function author(engine,value){
  const leases=[],textures=[],meshes=[],requirements=[],commandKinds=[];
  async function lease(pixels,width=1,height=1,crop){
    const image=egret.createImageData2D({width,height,pixels:new Uint8Array(pixels)}),texture=egret.createTexture(image,crop);
    const key='textured-native-'+(++resourceNumber),type=egret.createAssetType(key,egret.isTexture);
    engine.assets.register(type,{load:async()=>texture,dispose:resource=>resource.dispose()});
    const result=await engine.assets.acquire(egret.createAssetRef(type,key));leases.push(result);textures.push(texture);return result;
  }
  async function mesh(parent,geometry,pixels=[255,255,255,255],opacity=1,image){
    const resource=image?await lease(image.pixels,image.width,image.height,image.crop):await lease(pixels);
    const owned=ownedGeometry(geometry),node=new egret.Mesh2D(resource,owned);node.alpha=opacity;parent.addChild(node);meshes.push(node);return {node,geometry:owned};
  }
  async function image(parent,pixels,width=32,height=32){const resource=await lease(pixels),node=new egret.Bitmap(resource);
    node.scaleX=width;node.scaleY=height;parent.addChild(node);return node;}
  async function sibling(){const out=await mesh(engine.stage,quad(8,8),[255,128,0,255]);out.node.x=12;out.node.y=2;}
  async function diamond(){const recipe=PUBLIC_RECIPES.diamond,parent=engine.stage.addChild(new egret.Sprite());Object.assign(parent,recipe.parent);
    const out=await mesh(parent,N06_GEOMETRY,[255,255,255,128],.5);Object.assign(out.node,recipe.mesh);
    requirements.push({geometry:out.geometry,mesh:recipe.idealMesh,clip:recipe.idealClip,rect:[0,0,8,8],bound:recipe.matrixAbsoluteBound,name:'diamond'});}
  try {
    if(value.scenario==='alpha')await mesh(engine.stage,quad(32,32,[.5,.25,.75,.5]),[255,32,8,value.alpha],.5);
    else if(value.scenario==='interpolation')await mesh(engine.stage,N02_GEOMETRY,[255,255,255,128],.5);
    else if(value.scenario==='painter'){
      const red=()=>mesh(engine.stage,quad(32,32),[255,0,0,128]),blue=()=>image(engine.stage,[0,0,255,128]);
      if(value.reverse){await blue();await red();commandKinds.push('image','mesh');}else{await red();await blue();commandKinds.push('mesh','image');}
    }else if(value.scenario==='barriers'){
      rect(engine.stage,0xff0000);
      const out=await mesh(engine.stage,value.barrier==='empty'?{positions:[],uvs:[],lightColors:[],indices:[]}:quad(32,32));
      if(value.barrier==='singular')out.node.scaleX=0;
      rect(engine.stage,0xff0000);await image(engine.stage,[0,0,255,255]);
      await mesh(engine.stage,quad(32,32,[1,0,1,1]));await image(engine.stage,[0,255,0,255]);
      commandKinds.push('rect','mesh','rect','image','mesh','image');
    }else if(value.scenario==='palette')await mesh(engine.stage,quad(value.width,value.height,[1,1,1,1],value.constantUV),undefined,1,ATLAS);
    else if(value.scenario==='diamond')await diamond();
    else if(value.scenario==='degenerate'){
      const h=2**-34,translated=await mesh(engine.stage,{positions:[0,0,h,h,3*h,3*h],uvs:[.5,.5,.5,.5,.5,.5],lightColors:Array(12).fill(1),indices:[0,1,2]});
      translated.node.x=2**19;
      await mesh(engine.stage,{positions:[1,1,9,1,1,1+2**-40],uvs:[.5,.5,.5,.5,.5,.5],lightColors:Array(12).fill(1),indices:[0,1,2]});await sibling();
    }else if(value.scenario==='complement'){
      const recipe=PUBLIC_RECIPES.complement,parent=engine.stage.addChild(new egret.Sprite());Object.assign(parent,recipe.parent);
      const inverse=parent.addChild(new egret.Sprite());Object.assign(inverse,recipe.inverse);
      const out=await mesh(inverse,N09_GEOMETRY,[255,255,255,128],.5);Object.assign(out.node,recipe.mesh);
      requirements.push({geometry:out.geometry,mesh:recipe.idealMesh,clip:recipe.idealClip,rect:[0,0,1,1],bound:recipe.matrixAbsoluteBound,name:'public-complement'});await sibling();
    }else throw Error('UNKNOWN_PUBLIC_NATIVE_SCENARIO');
    return {leases,textures,meshes,requirements,commandKinds};
  }catch(cause){for(const resource of leases)resource.release();for(const texture of textures)texture.dispose();throw cause;}
}
function capture(engine,value,owned){
  const frame=engine.captureTexturedFrame({width:value.width,height:value.height,clearColor:0,clearAlpha:0});
  invariant(frame.profile===egret.TEXTURED_FRAME_PROFILE_2D&&frame.clearColor===0&&frame.clearAlpha===0,'NATIVE_CAPTURE_HEADER');
  for(const array of [frame,frame.commands,frame.geometries,frame.images])invariant(Object.isFrozen(array),'NATIVE_CAPTURE_FROZEN');
  for(const geometry of frame.geometries)invariant(egret.isTexturedGeometry2D(geometry),'NATIVE_CAPTURE_GEOMETRY');
  for(const image of frame.images)invariant(egret.isImageData2D(image),'NATIVE_CAPTURE_IMAGE');
  if(owned.commandKinds.length)invariant(JSON.stringify(frame.commands.map(command=>command.kind))===JSON.stringify(owned.commandKinds),'NATIVE_CAPTURE_PAINTER_ORDER');
  const admissions=owned.requirements.map(requirement=>{
    const command=frame.commands.find(row=>row.kind==='mesh'&&frame.geometries[row.geometryIndex]===requirement.geometry);
    invariant(command&&command.clips.length===1,'NATIVE_AUTHORING_CLIP_COUNT');
    invariant(command.alpha===.5&&['x','y','width','height'].every((field,i)=>command.clips[0].rect[field]===requirement.rect[i]),'NATIVE_AUTHORING_CLIP_RECT_OR_OPACITY');
    return {mesh:matrixAdmission(command.matrix,requirement.mesh,requirement.bound,requirement.name),
      clip:matrixAdmission(command.clips[0].matrix,requirement.clip,requirement.bound,requirement.name+'-clip')};
  });
  return {frame,admissions};
}
function headlessAuthorHost(){return {surface:{},close:async()=>{},setTimeout(callback,delay){const handle=setTimeout(callback,delay);return()=>clearTimeout(handle);}};}
async function retireAuthor(engine,owned,mutate){
  const failures=[];
  if(mutate)for(const node of owned.meshes){try{node.setContent(node.textureLease,emptyGeometry());node.clear();node.dispose();}catch(cause){failures.push(cause);}}
  for(const lease of owned.leases){try{lease.release();}catch(cause){failures.push(cause);}}
  for(const texture of owned.textures){try{texture.dispose();}catch(cause){failures.push(cause);}}
  try{await engine.dispose();}catch(cause){failures.push(cause);}
  if(failures.length)throw new AggregateError(failures,'NATIVE_AUTHOR_CLEANUP');
}
async function read(host,frame,canvas){
  const ticket=observed(host.requestReadback());let idle;
  try{invariant(host.renderTexturedFrame(frame)===undefined,'NATIVE_RENDER_RETURN');idle=observed(host.whenIdle());
    const [result]=await observed(Promise.all([ticket,idle]));
    invariant(result.frameId===frame.frameId&&result.serial===host.getStatus().lastSerial,'NATIVE_READBACK_IDENTITY');
    const status=host.getStatus(),textured=host.getTexturedStatus();
    invariant(status.pendingFrames===0&&status.pendingUploadBytes===0&&status.pendingReadbackBytes===0&&textured.pendingGeometryBytes===0&&!status.firstFailure,'NATIVE_LEDGER_NOT_RETIRED');
    invariant(canvas.width===result.width&&canvas.height===result.height,'NATIVE_BACKING_METADATA');
    return {readback:{...result,bytes:Array.from(result.bytes)},status,texturedStatus:textured};
  }catch(cause){throw cause;} // Observers above own late Promise rejection; host close supplies the actual retirement proof.
}
function metadata(canvas,value){const rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);return {hostPixelRatio:value.pixelRatio,browserDPR:devicePixelRatio,
  backing:[canvas.width,canvas.height],rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},css:{opacity:style.opacity,transform:style.transform,filter:style.filter}};}
export async function runCase(caseId,device,onObservation){
  const value=definition(caseId),canvas=document.querySelector('#scene'),diagnostics=[],host=createTexturedWebGPUHost({canvas,pixelRatio:value.pixelRatio,enableReadback:true,
    ...(device===undefined?{}:{device:{kind:'borrow',device}}),
    onDiagnostic:event=>diagnostics.push({code:event.code,phase:event.phase,serial:event.serial})});
  let engine,owned,authorEngine,authorOwned;const report={caseId,phase:value.phase,devicePolicy:device===undefined?'acquire':'borrow',admissions:[],observations:[],diagnostics,cleanup:null};lastReport=report;
  const retainObservation=async(role,observation)=>{
    invariant(onObservation===undefined||typeof onObservation==='function','NATIVE_OBSERVER_INVALID');
    canvas.style.width=`${canvas.width}px`;canvas.style.height=`${canvas.height}px`;
    const row={role,...observation,canvasMetadata:metadata(canvas,value)};report.observations.push(row);
    if(onObservation!==undefined)await onObservation(caseId,role,row);
  };
  try{
    engine=await egret.createEngineForProfile({host},egret.TEXTURED_FRAME_PROFILE_2D);
    if(value.scenario==='retained'){
      // This headless adapter supplies authoring ownership only. Actual submissions use the live public GPU host above.
      authorEngine=await egret.createEngine({host:headlessAuthorHost()});const source=definition(value.replayOf);
      authorOwned=await author(authorEngine,source);const saved=capture(authorEngine,source,authorOwned),beforeSnapshot=JSON.stringify(saved.frame);report.admissions=saved.admissions;
      await retireAuthor(authorEngine,authorOwned,true);authorEngine=undefined;authorOwned=undefined;
      invariant(JSON.stringify(saved.frame)===beforeSnapshot,'NATIVE_RETAINED_FRAME_MUTATED_BY_RETIREMENT');
      report.authorRetiredBeforeReplay=true;
      const resetOptions={width:value.resetBefore[0],height:value.resetBefore[1],clearColor:0,clearAlpha:0};
      const before=engine.captureTexturedFrame(resetOptions);await retainObservation('reset-before',await read(host,before,canvas));
      const first=await read(host,saved.frame,canvas);await retainObservation('replay-first',first);
      const second=await read(host,saved.frame,canvas);await retainObservation('replay-second',second);
      invariant(first.readback.frameId===second.readback.frameId&&first.readback.serial!==second.readback.serial,'NATIVE_REPLAY_SERIALS');
      invariant(JSON.stringify(saved.frame)===beforeSnapshot,'NATIVE_RETAINED_FRAME_MUTATED_BY_REPLAY');report.retainedIdentityPreserved=true;
      // Replay observations were retained while their own live canvas contents were current.
      const after=engine.captureTexturedFrame({width:value.width,height:value.height,clearColor:0,clearAlpha:0});
      await retainObservation('reset-after',await read(host,after,canvas));
    }else{owned=await author(engine,value);const saved=capture(engine,value,owned);report.admissions=saved.admissions;
      await retainObservation('sample',await read(host,saved.frame,canvas));}
    invariant(diagnostics.length===0,'NATIVE_UNEXPECTED_DIAGNOSTIC');canvas.style.width=`${canvas.width}px`;canvas.style.height=`${canvas.height}px`;report.metadata=metadata(canvas,value);
    return report;
  }finally{
    const failures=[];
    if(authorEngine){try{await retireAuthor(authorEngine,authorOwned??{leases:[],textures:[],meshes:[]},false);}catch(cause){failures.push(cause);}}
    if(engine){try{await retireAuthor(engine,owned??{leases:[],textures:[],meshes:[]},false);}catch(cause){failures.push(cause);}}
    else{try{await host.close();}catch(cause){failures.push(cause);}}
    const status=host.getStatus();report.cleanup={status,texturedStatus:host.getTexturedStatus(),failures:failures.map(cause=>({name:cause?.name,code:cause?.code,message:String(cause?.message)}))};
    if(status.state!=='closed'||status.cleanupOutcome!=='safe'||failures.length)throw new AggregateError(failures,'NATIVE_CLOSE_UNSAFE');
  }
}
export function lastObservation(){return lastReport;}
