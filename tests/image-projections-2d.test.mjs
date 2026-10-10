import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageData2D,copyImageData2DPixels} from '../packages/contracts/dist/index.js';
import {copyMixedFrame2D} from '../packages/engine/dist/rendering/copyMixedFrame2D.js';
import {FrameCopyError} from '../packages/engine/dist/rendering/copyFrame2D.js';

let ImageProjectionError,planImageProjections,copyProjectionPixels,moduleFault;
try {
  ({ImageProjectionError,planImageProjections,copyProjectionPixels}=await import('../packages/engine/dist/web/imageProjections2D.js'));
} catch (error) { moduleFault=error; }

const options={pixelRatio:1,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144};
const matrix=()=>({a:1,b:0,c:0,d:1,tx:0,ty:0});
const region=(x=0,y=0,width=1,height=1)=>({x,y,width,height});
const imageCommand=(imageIndex=0,sourceRect=region(),overrides={})=>({kind:'image',matrix:matrix(),rect:{x:0,y:0,width:1,height:1},alpha:1,clips:[],imageIndex,sourceRect,...overrides});
const rectangle=()=>({kind:'rect',matrix:matrix(),rect:{x:0,y:0,width:1,height:1},color:0x123456,alpha:1,clips:[]});
const frame=(commands,images)=>copyMixedFrame2D({frameId:1,width:8,height:8,clearColor:0,clearAlpha:0,commands,...(images===undefined?{}:{images})},options).frame;
const image=(width=1,height=1)=>createImageData2D({width,height,pixels:new Uint8Array(4*width*height)});
const projectionReason=expected=>error=>error instanceof ImageProjectionError&&error.reason===expected;
function projection(name,body) {
  test(name,()=>{
    assert.equal(typeof planImageProjections,'function',`projection module required: ${moduleFault}`);
    assert.equal(typeof copyProjectionPixels,'function',`projection copy required: ${moduleFault}`);
    assert.equal(typeof ImageProjectionError,'function',`projection error required: ${moduleFault}`);
    body();
  });
}

// A row-stride error, ceil conversion, retained alias, or transparent RGB leak breaks this literal.
projection('crop_is_tight_top_left_and_premultiply_is_exact',()=>{
  const sourceBytes=[9,8,7,255,6,5,4,254,3,2,1,1,255,127,1,128,1,128,255,127,255,99,33,0];
  const input=new Uint8Array(sourceBytes);
  const source=createImageData2D({width:3,height:2,pixels:input});
  input.fill(42);
  const copied=frame([imageCommand(0,region(1,1,2,1))],[source]);
  const straightPlan=planImageProjections(copied,'straight');
  assert.deepEqual(straightPlan.commandViews,[0]);
  assert.equal(straightPlan.projectionBytes,8);
  assert.equal(straightPlan.scratchBytes,40);
  const view=straightPlan.views[0];
  assert.equal(view.image,source);
  assert.deepEqual(view.region,{x:1,y:1,width:2,height:1});
  assert.equal(view.byteLength,8);
  const a=copyProjectionPixels(view,'straight');
  const b=copyProjectionPixels(view,'premultiplied');
  const c=copyProjectionPixels(view,'straight');
  assert.deepEqual([...a],[1,128,255,127,255,99,33,0]);
  assert.deepEqual([...b],[0,64,127,127,0,0,0,0]);
  assert.deepEqual([...c],[1,128,255,127,255,99,33,0]);
  for (const bytes of [a,b,c]) {
    assert.equal(bytes.byteOffset,0);
    assert.equal(bytes.byteLength,8);
    assert.equal(bytes.buffer.byteLength,8);
    assert.equal(bytes.buffer.resizable,false);
  }
  assert.notEqual(a.buffer,b.buffer);
  assert.notEqual(a.buffer,c.buffer);
  a.fill(17);
  structuredClone(b.buffer,{transfer:[b.buffer]});
  assert.deepEqual([...c],[1,128,255,127,255,99,33,0]);
  const sourceCopy=copyImageData2DPixels(source);
  assert.deepEqual([...sourceCopy],sourceBytes);
  sourceCopy.fill(3);
  assert.deepEqual([...copyImageData2DPixels(source)],sourceBytes);
  assert.equal(planImageProjections(copied,'premultiplied').scratchBytes,32);
});

// Content-based merging, table-index keys, lost command slots, or early no-coverage pruning fail here.
projection('identity_views_and_peak_scratch_are_counted',()=>{
  const a=image(2,1),b=image(2,1),unused=image(1024,1024);
  const copied=frame([
    rectangle(),imageCommand(0),imageCommand(1),imageCommand(2),rectangle(),
    imageCommand(0,region(1,0),{alpha:0,rect:{x:0,y:0,width:0,height:0}}),
  ],[a,a,b,unused]);
  const planned=planImageProjections(copied,'premultiplied');
  assert.deepEqual(planned.commandViews,[undefined,0,0,1,undefined,2]);
  assert.equal(planned.views.length,3);
  assert.deepEqual(planned.views.map(view=>view.image),[a,b,a]);
  assert.equal(planned.projectionBytes,12);
  assert.equal(planned.scratchBytes,20);
  assert.equal(planImageProjections(copied,'straight').scratchBytes,32);
  assert.throws(()=>frame([imageCommand()],Array(65).fill(a)),error=>error instanceof FrameCopyError&&error.reason==='budget');
});

// Summing every source, rather than the maximum live sequential copy, over-reserves this plan.
projection('one_live_referenced_source_copy_is_reserved',()=>{
  const a=image(3,2),b=image(2,2),unused=image(1024,1024);
  const copied=frame([imageCommand(0),imageCommand(1)],[a,b,unused]);
  const gpu=planImageProjections(copied,'premultiplied');
  assert.equal(gpu.projectionBytes,8);
  assert.equal(gpu.scratchBytes,32);
  assert.equal(planImageProjections(copied,'straight').scratchBytes,40);
});

projection('fixed_max_projection_passes_gpu_and_rejects_canvas_scratch',()=>{
  const sources=Array.from({length:4},()=>image(1024,1024));
  const copied=frame(sources.map((_,index)=>imageCommand(index,region(0,0,1024,1024))),sources);
  const gpu=planImageProjections(copied,'premultiplied');
  assert.equal(gpu.views.length,4);
  assert.equal(gpu.projectionBytes,16777216);
  assert.equal(gpu.scratchBytes,20971520);
  assert.throws(()=>planImageProjections(copied,'straight'),projectionReason('budget'));
});

// Independent literal sum: 3*4194304+2097152=14680064; 2P+4194304=33554432.
projection('canvas_exact_33554432_boundary_passes',()=>{
  const sources=Array.from({length:4},()=>image(1024,1024));
  const copied=frame([
    imageCommand(0,region(0,0,1024,1024)),imageCommand(1,region(0,0,1024,1024)),
    imageCommand(2,region(0,0,1024,1024)),imageCommand(3,region(0,0,1024,512)),
  ],sources);
  const planned=planImageProjections(copied,'straight');
  assert.equal(planned.views.length,4);
  assert.equal(planned.projectionBytes,14680064);
  assert.equal(planned.scratchBytes,33554432);
});

// Separate authentic geometry: 3*4194300+2095104+2064=14680068; 2P+4194300=33554436.
projection('canvas_exact_33554436_boundary_rejects',()=>{
  const sources=Array.from({length:4},()=>image(1023,1025));
  const copied=frame([
    imageCommand(0,region(0,0,1023,1025)),imageCommand(1,region(0,0,1023,1025)),
    imageCommand(2,region(0,0,1023,1025)),imageCommand(3,region(0,0,1023,512)),
    imageCommand(3,region(0,0,516,1)),
  ],sources);
  const gpu=planImageProjections(copied,'premultiplied');
  assert.equal(gpu.views.length,5);
  assert.equal(gpu.projectionBytes,14680068);
  assert.equal(gpu.scratchBytes,18874368);
  assert.throws(()=>planImageProjections(copied,'straight'),projectionReason('budget'));
});

projection('128_distinct_views_and_a_duplicate_remain_bounded',()=>{
  const source=image(128,1);
  const commands=Array.from({length:128},(_,x)=>imageCommand(0,region(x,0)));
  const planned=planImageProjections(frame([...commands,imageCommand()],[source]),'premultiplied');
  assert.equal(planned.views.length,128);
  assert.equal(planned.commandViews[127],127);
  assert.equal(planned.commandViews[128],0);
  assert.equal(planned.projectionBytes,512);
  assert.equal(planned.scratchBytes,1024);
});

projection('rectangle_only_and_empty_frames_reserve_no_image_storage',()=>{
  for (const mode of ['straight','premultiplied']) {
    assert.deepEqual(planImageProjections(frame([rectangle()]),mode),{views:[],commandViews:[undefined],projectionBytes:0,scratchBytes:0});
    assert.deepEqual(planImageProjections(frame([]),mode),{views:[],commandViews:[],projectionBytes:0,scratchBytes:0});
  }
});

// Authentication must precede reading immutable source metadata even for an internal declared view.
projection('projection_copy_reauthenticates_before_image_property_reads',()=>{
  const source=image();
  let reads=0;
  const forged=new Proxy({...source},{get(){reads++;throw Error('forged image property');}});
  const revoked=Proxy.revocable({},{});revoked.revoke();
  for (const value of [forged,revoked.proxy,new Proxy(source,{})]) {
    assert.throws(()=>copyProjectionPixels({image:value,region:region(),byteLength:4},'straight'),projectionReason('invalid'));
  }
  assert.equal(reads,0);
  assert.deepEqual([...copyProjectionPixels({image:source,region:region(),byteLength:4},'straight')],[0,0,0,0]);
});

projection('internal_projection_region_and_byte_length_must_agree_before_copy',()=>{
  const source=image(2,2);
  for (const crop of [region(0.5,0),region(-1,0),region(0,0,0),region(0,0,3),region(Number.MAX_SAFE_INTEGER,0,2)]) {
    assert.throws(()=>copyProjectionPixels({image:source,region:crop,byteLength:4},'straight'),projectionReason('invalid'));
  }
  for (const byteLength of [-1,3,8,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>copyProjectionPixels({image:source,region:region(),byteLength},'straight'),projectionReason('invalid'));
  }
});


// I1 observer is invocation-local and only deliberate admission construction notifies it.
function projectionOwnedFault(site,source,cause,body){
 const freeze=Object.freeze,set=Map.prototype.set,NativeMap=Map;let attempts=0;
 const injected=()=>{attempts++;throw cause;};
 try{if(site==='freeze')Object.freeze=value=>value?.image===source&&Object.hasOwn(value,'byteLength')?injected():freeze(value);
  else Map.prototype.set=function(key,value){if(key===source&&value instanceof NativeMap)return injected();return set.call(this,key,value);};
  body();assert.equal(attempts,1);
 }finally{Object.freeze=freeze;Map.prototype.set=set;}
}
projection('I1 planner observer receives the exact freshly produced invalid or budget object',()=>{
 const source=image(129,1),valid={frameId:1,width:8,height:8,clearColor:0,clearAlpha:0,commands:[imageCommand()],images:[source]};
 for(const [reason,input] of [['invalid',{...valid,images:[{}]}],['invalid',{...valid,commands:[imageCommand(0,region(.5,0))]}],['budget',{...valid,commands:Array.from({length:129},(_,x)=>imageCommand(0,region(x,0)))}]]){
  const events=[];let caught;try{planImageProjections(input,'straight',error=>events.push(error));}catch(error){caught=error;}
  assert.equal(events.length,1);assert.equal(events[0],caught);assert.ok(caught instanceof ImageProjectionError);assert.equal(caught.reason,reason);
 }
 const events=[];planImageProjections(valid,'straight',error=>events.push(error));assert.deepEqual(events,[]);
});
for(const site of ['freeze','map'])projection('I1 standalone planner '+site+' faults escape unchanged and never notify',()=>{
 const source=image(),copied=frame([imageCommand()],[source]);
 for(const cause of [new ImageProjectionError('budget'),{reason:'budget'},null,undefined]){
  const events=[];let caught,threw=false;projectionOwnedFault(site,source,cause,()=>{try{planImageProjections(copied,'straight',error=>events.push(error));}catch(error){threw=true;caught=error;}});
  assert.equal(threw,true);assert.equal(caught,cause);assert.deepEqual(events,[]);
 }
});
projection('I1 an older genuine planner token is not notified again by an owned operation',()=>{
 const source=image(129,1),wide={frameId:1,width:8,height:8,clearColor:0,clearAlpha:0,commands:Array.from({length:129},(_,x)=>imageCommand(0,region(x,0))),images:[source]};let token;
 try{planImageProjections(wide,'straight');}catch(error){token=error;}assert.ok(token instanceof ImageProjectionError);assert.equal(token.reason,'budget');
 const copied=frame([imageCommand()],[source]);for(const site of ['freeze','map']){const events=[];projectionOwnedFault(site,source,token,()=>assert.throws(()=>planImageProjections(copied,'straight',error=>events.push(error)),error=>error===token));assert.deepEqual(events,[]);}
});
projection('I1 standalone pixel copier remains outside the planner observer convention',()=>{
 const source=image(),copied=frame([imageCommand()],[source]),events=[],plan=planImageProjections(copied,'straight',error=>events.push(error));assert.deepEqual([...copyProjectionPixels(plan.views[0],'straight')],[0,0,0,0]);assert.deepEqual(events,[]);
});
