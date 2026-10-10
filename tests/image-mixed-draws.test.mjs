import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageData2D} from '../packages/contracts/dist/index.js';
import {copyMixedFrame2D} from '../packages/engine/dist/rendering/copyMixedFrame2D.js';
import {GeometryPreparationError} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import {packImageVertices2D} from '../packages/engine/dist/rendering/packImageVertices2D.js';
import {packWebGPUVertices,WebGPUPackingError} from '../packages/engine/dist/web/webgpuPass.js';
import {planImageProjections,copyProjectionPixels} from '../packages/engine/dist/web/imageProjections2D.js';
import {reflectedTuples,reflectedPackedCorners,endpoint,literalPixels} from './fixtures/image-affine-oracles.mjs';

let prepareMixedDraws2D,moduleFault;
try{({prepareMixedDraws2D}=await import('../packages/engine/dist/rendering/prepareMixedDraws2D.js'));}catch(error){moduleFault=error;}
const opts={pixelRatio:1,maxPreparedVertices:1048576,maxClipEdgeTests:4194304};
const copyOptions={pixelRatio:1,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144};
const matrix={a:1,b:0,c:0,d:1,tx:0,ty:0};
const unit={x:0,y:0,width:1,height:1};
const rectangle=(overrides={})=>({kind:'rect',matrix,rect:{x:1,y:1,width:2,height:2},color:0xff0000,alpha:.5,clips:[],...overrides});
const image=(overrides={})=>({kind:'image',matrix,rect:{x:1,y:1,width:2,height:2},alpha:.5,clips:[],imageIndex:0,sourceRect:unit,...overrides});
const red=()=>createImageData2D({width:1,height:1,pixels:new Uint8Array(literalPixels)});
const frame=(commands,images=[red()],width=16,height=16)=>copyMixedFrame2D({frameId:1,width,height,clearColor:0,clearAlpha:0,commands,images},copyOptions).frame;
const reason=r=>error=>error instanceof GeometryPreparationError&&error.reason===r;
const sorted=points=>points.map(p=>[p.x,p.y,p.u,p.v]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
const corners=packed=>[...new Map(Array.from({length:packed.data.length/4},(_,i)=>Array.from(packed.data.slice(4*i,4*i+4))).map(p=>[JSON.stringify(p),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
function mixed(name,body){test(name,()=>{
 if(moduleFault)assert.equal(moduleFault.code,'ERR_MODULE_NOT_FOUND','red must be the absent Task2 module');
 assert.equal(typeof prepareMixedDraws2D,'function',`mixed port required: ${moduleFault}`);
 body();
});}

// Reordering, independent per-run budgets, or counting corners instead of fan vertices fail.
mixed('mixed_draws_preserve_order_and_share_frame_caps',()=>{
 const f=frame([rectangle(),image(),rectangle({color:0x00ff00}),image({alpha:.75})]);
 const draws=prepareMixedDraws2D(f,16,16,{...opts,maxPreparedVertices:24,maxClipEdgeTests:188});
 assert.deepEqual(draws.map(d=>d.kind),['rect','image','rect','image']);
 assert.deepEqual(draws.filter(d=>d.kind==='image').map(d=>[d.commandIndex,d.prepared.alpha]),[[1,.5],[3,.75]]);
 assert.deepEqual(draws.map(d=>d.prepared.edgeTests),[57,37,57,37]);
 assert.throws(()=>prepareMixedDraws2D(f,16,16,{...opts,maxPreparedVertices:23}),reason('budget'));
 assert.throws(()=>prepareMixedDraws2D(f,16,16,{...opts,maxClipEdgeTests:187}),reason('budget'));
 for(const commands of [[rectangle(),image()],[image(),rectangle()],[image(),image()]]){
  const two=frame(commands),edges=commands[0].kind==='image'&&commands[1].kind==='image'?74:94;
  assert.equal(prepareMixedDraws2D(two,16,16,{...opts,maxPreparedVertices:12,maxClipEdgeTests:edges}).length,2);
  assert.throws(()=>prepareMixedDraws2D(two,16,16,{...opts,maxPreparedVertices:11}),reason('budget'));
  assert.throws(()=>prepareMixedDraws2D(two,16,16,{...opts,maxClipEdgeTests:edges-1}),reason('budget'));
 }
 const adjacent=prepareMixedDraws2D(frame([rectangle(),rectangle({color:2}),image(),rectangle({color:3})]),16,16,opts);
 assert.deepEqual(adjacent.map(d=>d.kind),['rect','image','rect']);
 assert.deepEqual(adjacent[0].prepared.commands.map(c=>c.color),[0xff0000,2]);
 assert.equal(adjacent[1].commandIndex,2);
 assert.deepEqual(prepareMixedDraws2D(frame([image(),image()]),16,16,opts).map(d=>d.commandIndex),[0,1]);
});

// The mixed wrapper must preserve the accepted literal rectangle DTO and packed bytes.
mixed('rectangle_only_mixed_preparation_retains_literal_legacy_values',()=>{
 const clip={matrix,rect:{x:1,y:0,width:2,height:4}};
 const f=frame([rectangle({rect:{x:0,y:0,width:4,height:4},clips:[clip]})],undefined,4,4);
 let imageReads=0;const trusted={...f};Object.defineProperty(trusted,'images',{get(){imageReads++;throw Error('image table must not be read');}});
 const draws=prepareMixedDraws2D(trusted,4,4,opts);
 assert.equal(imageReads,0);
 assert.deepEqual(draws,[{kind:'rect',prepared:{points:[{x:1,y:0},{x:3,y:0},{x:3,y:4},{x:1,y:4}],commands:[{pointIndices:[0,1,2,3],color:0xff0000,alpha:.5}],edgeTests:122}}]);
 const packed=packWebGPUVertices(draws[0].prepared,4,4,{maxUploadBytes:144,maxBufferSize:144});
 assert.deepEqual(Array.from(packed.data),[-.5,1,.5,0,0,.5,.5,1,.5,0,0,.5,.5,-1,.5,0,0,.5,-.5,1,.5,0,0,.5,.5,-1,.5,0,0,.5,-.5,-1,.5,0,0,.5]);
 assert.deepEqual(packed.ranges,[{firstVertex:0,vertexCount:6}]);
 assert.throws(()=>packWebGPUVertices(draws[0].prepared,4,4,{maxUploadBytes:143,maxBufferSize:143}),e=>e instanceof WebGPUPackingError&&e.reason==='budget');
 assert.throws(()=>packWebGPUVertices(draws[0].prepared,4,4,{maxUploadBytes:144,maxBufferSize:143}),e=>e instanceof WebGPUPackingError&&e.reason==='device');
});

// Removing empty image entries merges runs; early invisibility removal skips required clips.
mixed('empty_mixed_runs_keep_association_and_preflight',()=>{
 const invisible=image({alpha:0});
 const draws=prepareMixedDraws2D(frame([rectangle(),invisible,rectangle({alpha:0}),image()]),16,16,opts);
 assert.deepEqual(draws.map(d=>d.kind),['rect','image','rect','image']);
 assert.equal(draws[1].commandIndex,1);assert.deepEqual(draws[1].prepared.points,[]);
 assert.deepEqual(draws[2].prepared.commands,[]);assert.deepEqual(draws[2].prepared.points,[]);
 assert.deepEqual(draws.map(d=>d.prepared.edgeTests),[57,37,57,37]);
 assert.throws(()=>prepareMixedDraws2D(frame([invisible,image()]),16,16,{...opts,maxClipEdgeTests:73}),reason('budget'));
 for(const overrides of [{alpha:0},{matrix:{...matrix,a:0}},{rect:{x:30,y:0,width:1,height:1}}]){
  const f=frame([image(overrides)]),p=prepareMixedDraws2D(f,16,16,opts)[0];
  assert.equal(p.commandIndex,0);assert.deepEqual(p.prepared.pointIndices,[]);
  assert.equal(p.prepared.imageIndex,0);assert.deepEqual(p.prepared.sourceRect,unit);
  const bad=frame([image({...overrides,clips:[{matrix:{...matrix,tx:2**21},rect:unit}]})]);
  assert.throws(()=>prepareMixedDraws2D(bad,16,16,opts),reason('range'));
 }
 assert.deepEqual(prepareMixedDraws2D(frame([]),16,16,{...opts,maxPreparedVertices:0,maxClipEdgeTests:0}),[]);
 for(const pixelRatio of [2**-101,2**21])assert.throws(()=>prepareMixedDraws2D(frame([]),16,16,{...opts,pixelRatio}),reason('range'));
});

// This is future-host upload policy accounting, not aggregate admission by a new Task2 API.
mixed('mixed_pack_counts_and_upload_policy_are_separate',()=>{
 const f=frame([rectangle(),image(),rectangle(),image({alpha:.75})]);
 const planned=planImageProjections(f,'premultiplied');assert.deepEqual(planned.commandViews,[undefined,0,undefined,0]);
 const packed=prepareMixedDraws2D(f,16,16,opts).map(d=>d.kind==='rect'?packWebGPUVertices(d.prepared,16,16,{maxUploadBytes:144,maxBufferSize:144}):packImageVertices2D(d.prepared,16,16,96));
 assert.deepEqual(packed.map(p=>p.data.byteLength),[144,96,144,96]);
 assert.equal(packed[0].data.byteLength+packed[1].data.byteLength+16,256);
 assert.equal(packed.reduce((n,p)=>n+p.data.byteLength,0)+16+16,512);
 const thin=image({rect:{x:1,y:1,width:8,height:2**-40}});
 const thinFrame=frame([thin,image()]);
 assert.throws(()=>prepareMixedDraws2D(thinFrame,16,16,{...opts,maxPreparedVertices:11}),reason('budget'));
 const draws=prepareMixedDraws2D(thinFrame,16,16,{...opts,maxPreparedVertices:12});
 const collapsed=packImageVertices2D(draws[0].prepared,16,16,0);
 assert.equal(collapsed.collapsedTriangles,2);assert.equal(collapsed.vertexCount,0);assert.equal(collapsed.data.byteLength,0);
 assert.ok(collapsed.maxBackingDisplacement>0);assert.equal(collapsed.maxUVDisplacement,0);
 const second=packImageVertices2D(draws[1].prepared,16,16,96);
 const futureUpload=collapsed.data.byteLength+second.data.byteLength+(collapsed.vertexCount?16:0)+(second.vertexCount?16:0);
 assert.equal(futureUpload,112);assert.equal(planImageProjections(thinFrame,'premultiplied').projectionBytes,4);
 assert.throws(()=>packImageVertices2D(draws[1].prepared,16,16,95),reason('budget'));
 assert.throws(()=>packImageVertices2D({...draws[1].prepared,pointIndices:[3,2,1,0]},16,16,96),reason('precision'));
});

// Literal independent C2 data detects detached UV reversal despite equal position sets.
mixed('mixed_reflection_and_C2_keep_attached_literal_UVs',()=>{
 const reflection={...matrix,a:-1,tx:4},clip={matrix,rect:{x:1,y:0,width:2,height:4}};
 const f=frame([image({matrix:reflection,rect:{x:0,y:0,width:4,height:4},clips:[clip]})],undefined,4,4);
 const p=prepareMixedDraws2D(f,4,4,opts)[0].prepared;
 assert.deepEqual(sorted(p.points),reflectedTuples);assert.deepEqual(corners(packImageVertices2D(p,4,4,96)),reflectedPackedCorners);
 const sets=[];
 for(const variant of endpoint.variants){
  const raw=frame([rectangle(),image({matrix:variant.matrix,rect:unit,alpha:1,clips:[endpoint.clip]})],[red()],48,40);
  const draw=prepareMixedDraws2D(raw,48,40,opts)[1];assert.equal(draw.commandIndex,1);
  const hit=draw.prepared.points.find(p=>Object.is(p.x,endpoint.Q[0])&&Object.is(p.y,endpoint.Q[1]));
  assert.ok(hit);assert.deepEqual([hit.u,hit.v],variant.uv);
  sets.push(draw.prepared.points.map(p=>[p.x,p.y]).sort());
  const reversedUV=draw.prepared.points.map(p=>[p.u,p.v]).reverse();
  const broken=draw.prepared.points.map((p,i)=>({...p,u:reversedUV[i][0],v:reversedUV[i][1]})).find(p=>Object.is(p.x,endpoint.Q[0])&&Object.is(p.y,endpoint.Q[1]));
  assert.throws(()=>assert.deepEqual([broken.u,broken.v],variant.uv),assert.AssertionError);
 }
 assert.deepEqual(sets[0],sets[1]);
});

// Byte/UV policy evidence only: the full source neighbor cannot enter the independent crop.
mixed('framebuffer_edge_clipping_keeps_crop_local_UVs',()=>{
 const source=createImageData2D({width:3,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255])});
 const f=frame([image({rect:{x:-2,y:0,width:4,height:4},sourceRect:{x:0,y:0,width:2,height:1},alpha:1})],[source],4,4);
 const p=prepareMixedDraws2D(f,4,4,opts)[0].prepared;
 assert.deepEqual(sorted(p.points),[[0,0,.5,0],[0,4,.5,1],[2,0,1,0],[2,4,1,1]]);
 assert.deepEqual(corners(packImageVertices2D(p,4,4,96)),[[-1,-1,.5,1],[-1,1,.5,0],[0,-1,1,1],[0,1,1,0]]);
 const projection=planImageProjections(f,'premultiplied');
 assert.deepEqual([...copyProjectionPixels(projection.views[0],'premultiplied')],[255,0,0,255,0,255,0,255]);
});
