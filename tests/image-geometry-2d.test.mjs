import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageData2D} from '../packages/contracts/dist/index.js';
import {copyMixedFrame2D} from '../packages/engine/dist/rendering/copyMixedFrame2D.js';
import {prepareRectangles2D,GeometryPreparationError} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import {packWebGPUVertices} from '../packages/engine/dist/web/webgpuPass.js';
import {identityTuples,reflectedTuples,reflectedPackedCorners,endpoint,literalPixels,collinearAttributed} from './fixtures/image-affine-oracles.mjs';
let prepareImage2D,normalizeImagePolygon,packImageVertices2D,fault;
try{({prepareImage2D,normalizeImagePolygon}=await import('../packages/engine/dist/rendering/prepareImages2D.js'));({packImageVertices2D}=await import('../packages/engine/dist/rendering/packImageVertices2D.js'));}catch(e){fault=e;}
const opts={pixelRatio:1,maxPreparedVertices:1048576,maxClipEdgeTests:4194304};
const matrix={a:1,b:0,c:0,d:1,tx:0,ty:0};
const command=(overrides={})=>({kind:'image',matrix,rect:{x:0,y:0,width:4,height:4},alpha:.5,clips:[],imageIndex:0,sourceRect:{x:0,y:0,width:1,height:1},...overrides});
const clip={matrix,rect:{x:1,y:0,width:2,height:4}};
const tuple=p=>[p.x,p.y,p.u,p.v];
const sorted=p=>p.map(tuple).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
const point=([x,y,u,v])=>({x,y,u,v});
const reason=r=>e=>e instanceof GeometryPreparationError&&e.reason===r;
function imageTest(name,body){test(name,()=>{assert.equal(typeof prepareImage2D,'function',`missing image port: ${fault}`);body();});}

// Literal baseline is executed before extraction; no expected value comes from the new ports.
test('old rectangle point shape edge count fan and packed bytes remain literal',()=>{
 const f={frameId:1,width:4,height:4,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix,rect:{x:0,y:0,width:4,height:4},color:0xff0000,alpha:.5,clips:[clip]}]};
 const p=prepareRectangles2D(f,4,4,opts);
 assert.deepEqual(p,{points:[{x:1,y:0},{x:3,y:0},{x:3,y:4},{x:1,y:4}],commands:[{pointIndices:[0,1,2,3],color:0xff0000,alpha:.5}],edgeTests:122});
 const packed=packWebGPUVertices(p,4,4,{maxUploadBytes:144,maxBufferSize:144});
 assert.deepEqual(Array.from(packed.data),[-.5,1,.5,0,0,.5,.5,1,.5,0,0,.5,.5,-1,.5,0,0,.5,-.5,1,.5,0,0,.5,.5,-1,.5,0,0,.5,-.5,-1,.5,0,0,.5]);
 assert.deepEqual(packed.ranges,[{firstVertex:0,vertexCount:6}]);assert.equal(packed.collapsedTriangles,0);assert.equal(packed.maxBackingDisplacement,0);
});
imageTest('literal identity and reflection retain attributes alpha and 96-byte fan',()=>{
 for(const [m,want] of [[matrix,identityTuples],[{...matrix,a:-1,tx:4},reflectedTuples]]){
  const p=prepareImage2D(command({matrix:m,clips:[clip]}),4,4,opts);assert.deepEqual(sorted(p.points),want);assert.equal(p.alpha,.5);assert.equal(p.imageIndex,0);assert.deepEqual(p.sourceRect,{x:0,y:0,width:1,height:1});
  const packed=packImageVertices2D(p,4,4,96);assert.equal(packed.vertexCount,6);assert.equal(packed.data.byteLength,96);
  if(m.a===-1){const corners=[];for(let i=0;i<packed.data.length;i+=4)corners.push(Array.from(packed.data.slice(i,i+4)));assert.deepEqual([...new Map(corners.map(c=>[JSON.stringify(c),c])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),reflectedPackedCorners);}
  const uv=p.points.map(p=>[p.u,p.v]).reverse();assert.throws(()=>assert.deepEqual(sorted(p.points.map((p,i)=>({...p,u:uv[i][0],v:uv[i][1]}))),want),assert.AssertionError);
 }
});
imageTest('C2 complementary endpoint retains each variant Q UV and equal position sets',()=>{
 const {P,Q,u,v}=endpoint,sum=u+v,s=v/sum;assert.equal(u/sum,1);assert.ok(s>0&&s<=.5);assert.deepEqual([Q[0]+s*(P[0]-Q[0]),Q[1]+s*(P[1]-Q[1])],Q);
 const image=createImageData2D({width:1,height:1,pixels:new Uint8Array(literalPixels)}),sets=[];
 for(const {matrix,uv} of endpoint.variants){
  const raw={frameId:1,width:48,height:40,clearColor:0,clearAlpha:0,images:[image],commands:[command({matrix,rect:{x:0,y:0,width:1,height:1},alpha:1,clips:[endpoint.clip]})]};
  const copied=copyMixedFrame2D(raw,{pixelRatio:1,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144});const p=prepareImage2D(copied.frame.commands[0],48,40,opts);
  const hit=p.points.find(p=>Object.is(p.x,Q[0])&&Object.is(p.y,Q[1]));assert.ok(hit);assert.deepEqual([hit.u,hit.v],uv);sets.push(p.points.map(p=>[p.x,p.y]).sort());
  const reversedUV=p.points.map(p=>[p.u,p.v]).reverse();const broken=p.points.map((p,i)=>({...p,u:reversedUV[i][0],v:reversedUV[i][1]})).find(p=>Object.is(p.x,Q[0])&&Object.is(p.y,Q[1]));assert.throws(()=>assert.deepEqual([broken.u,broken.v],uv),assert.AssertionError);
 }assert.deepEqual(sets[0],sets[1]);
});
imageTest('image normalization preserves collinear UVs but rejects conflicting and nonadjacent duplicates',()=>{
 const p=collinearAttributed.map(point);assert.deepEqual(normalizeImagePolygon(p,opts).points,p);
 assert.deepEqual(normalizeImagePolygon([p[0],p[0],...p.slice(1),p[0]],opts).points,p);
 assert.throws(()=>normalizeImagePolygon([p[0],{...p[0],u:1},...p.slice(1)],opts),reason('precision'));
 assert.throws(()=>normalizeImagePolygon([...p,p[1]],opts),reason('precision'));
 assert.deepEqual(normalizeImagePolygon([[0,0,0,0],[1,0,.5,0],[2,0,1,0]].map(point),opts).points,[]);
 assert.throws(()=>normalizeImagePolygon([[0,0,0,0],[2,0,1,0],[1,1,.5,.5],[2,2,1,1],[0,2,0,1]].map(point),opts),reason('precision'));
 assert.deepEqual(normalizeImagePolygon([...p].reverse(),opts).points,p);
});
imageTest('range budget preflight and empty metadata have exact error reasons',()=>{
 for(const tx of [2**-101,2**21])assert.throws(()=>prepareImage2D(command({matrix:{...matrix,tx}}),4,4,opts),reason('range'));
 assert.throws(()=>prepareImage2D(command(),4,4,{...opts,maxClipEdgeTests:0}),reason('budget'));
 assert.throws(()=>prepareImage2D(command(),4,4,{...opts,maxPreparedVertices:5}),reason('budget'));
 for(const overrides of [{alpha:0},{rect:{x:0,y:0,width:0,height:4}},{matrix:{...matrix,a:0}},{clips:[{matrix,rect:{x:0,y:0,width:0,height:0}}]}]){
  const p=prepareImage2D(command(overrides),4,4,opts);assert.deepEqual(p.points,[]);assert.deepEqual(p.pointIndices,[]);assert.equal(p.imageIndex,0);assert.equal(p.alpha,overrides.alpha??.5);
  assert.throws(()=>prepareImage2D(command({...overrides,clips:[...(overrides.clips??[]),{matrix:{...matrix,tx:2**21},rect:{x:0,y:0,width:1,height:1}}]}),4,4,opts),reason('range'));
 }
 assert.throws(()=>normalizeImagePolygon(Array.from({length:1025},()=>point([0,0,0,0])),opts),reason('budget'));
});
imageTest('packing budgets winding represented collapse and unclamped float32 UV are exact',()=>{
 const p=prepareImage2D(command(),4,4,opts);assert.throws(()=>packImageVertices2D(p,4,4,95),reason('budget'));assert.equal(packImageVertices2D(p,4,4,96).data.byteLength,96);
 assert.throws(()=>packImageVertices2D({...p,pointIndices:[3,2,1,0]},4,4,96),reason('precision'));
 const flat={...p,points:[[0,0,0,0],[1,0,.5,0],[2,0,1,0]].map(point),pointIndices:[0,1,2]};const collapsed=packImageVertices2D(flat,4,4,0);assert.equal(collapsed.vertexCount,0);assert.equal(collapsed.collapsedTriangles,1);
 const unclamped={...p,points:p.points.map((p,i)=>({...p,u:i===0?1+2**-23:p.u}))};const packed=packImageVertices2D(unclamped,4,4,96);assert.equal(packed.data[2],1+2**-23);assert.equal(packed.maxUVDisplacement,0);
});
