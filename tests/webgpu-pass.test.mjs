import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRectangles2D } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { packWebGPUVertices, encodeWebGPURectangles } from '../packages/engine/dist/web/webgpuPass.js';
const matrix = {a:1,b:0,c:0,d:1,tx:0,ty:0};
export function frame(height=8) { return {frameId:1,width:16,height:16,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix,rect:{x:1,y:1,width:8,height},color:0xff8000,alpha:0.5,clips:[]}]}; }
const prepare = f => prepareRectangles2D(f,16,16,{pixelRatio:1,maxPreparedVertices:100,maxClipEdgeTests:10000});
test('actual surviving bytes are checked before exact output; caller precedence',()=>{
 const p=prepare(frame());
 for(const [upload,device,reason] of [[143,144,'budget'],[144,143,'device'],[143,143,'budget']]) assert.throws(()=>packWebGPUVertices(p,16,16,{maxUploadBytes:upload,maxBufferSize:device}),e=>e.reason===reason);
 const result=packWebGPUVertices(p,16,16,{maxUploadBytes:144,maxBufferSize:144});
 assert.equal(result.data.byteLength,144); assert.equal(result.data.length,36); assert.deepEqual(result.ranges,[{firstVertex:0,vertexCount:6}]);
 assert.deepEqual(Array.from(result.data.slice(0,6)),[-0.875,0.875,0.5,Math.fround(128/255*0.5),0,0.5]);
 assert.deepEqual(Array.from(result.data.slice(0,6)),Array.from(result.data.slice(18,24)));
});
test('float32 collapsed fans and empty coverage use zero upload under one byte',()=>{
 const result=packWebGPUVertices(prepare(frame(2**-40)),16,16,{maxUploadBytes:1,maxBufferSize:144});
 assert.equal(result.collapsedTriangles,2); assert.equal(result.data.byteLength,0); assert.ok(result.maxBackingDisplacement>0); assert.deepEqual(result.ranges,[]);
 const f=frame(); f.commands=[]; assert.equal(packWebGPUVertices(prepare(f),16,16,{maxUploadBytes:1,maxBufferSize:144}).collapsedTriangles,0);
});
test('mixed collapse retains painter ranges and complete one-time state',()=>{
 const f=frame(); f.commands.unshift(frame(2**-40).commands[0]); f.commands.push({...f.commands[1],color:0x00ff00});
 const p=packWebGPUVertices(prepare(f),16,16,{maxUploadBytes:288,maxBufferSize:288});
 assert.equal(p.collapsedTriangles,2); assert.deepEqual(p.ranges,[{firstVertex:0,vertexCount:6},{firstVertex:6,vertexCount:6}]);
 const calls=[]; const pass=Object.fromEntries(['setPipeline','setViewport','setScissorRect','setVertexBuffer','draw'].map(k=>[k,(...a)=>calls.push([k,...a])]));
 encodeWebGPURectangles(pass,'pipeline','buffer',p.ranges,16,16);
 assert.deepEqual(calls.map(c=>c[0]),['setPipeline','setViewport','setScissorRect','setVertexBuffer','draw','draw']);
 assert.deepEqual(calls.slice(-2),[['draw',6,1,0,0],['draw',6,1,6,0]]);
});
test('float32 sign reversal rejects; NDC y flip of ordinary fan is clockwise',()=>{
 const result=packWebGPUVertices(prepare(frame()),16,16,{maxUploadBytes:144,maxBufferSize:144});const a=result.data.slice(0,2),b=result.data.slice(6,8),c=result.data.slice(12,14);assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0);
 const malformed={points:[{x:0,y:0},{x:0,y:8},{x:8,y:0}],commands:[{pointIndices:[0,1,2],color:0,alpha:1}],edgeTests:0};assert.throws(()=>packWebGPUVertices(malformed,16,16,{maxUploadBytes:144,maxBufferSize:144}),e=>e.reason==='precision');
});
