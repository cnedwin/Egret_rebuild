// SPDX-License-Identifier: Apache-2.0
// UNIT: first-party CPU concat ownership and ordered provenance only.
// Synthetic packed arrays do not establish public admission or native performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PreparedBatchScratch2D, prepareAdjacentBatches2D } from '../packages/engine/dist/rendering/preparedBatches2D.js';

const CAP=8388608, crop=Object.freeze({x:0,y:0,width:1,height:1});
function draw(bytes, value=1, changes={}) {
  const data=new Float32Array(bytes/4);data.fill(value);
  return {kind:'image',packed:{data,vertexCount:bytes/16,collapsedTriangles:0,maxBackingDisplacement:0,maxUVDisplacement:0},
    viewIndex:0,alpha:1,clips:[],crop,uniform:new Float32Array([1,0,0,0]),...changes};
}

test('UNIT exact concat cap remains charged while another submission is prepared',()=>{
  const scratch=new PreparedBatchScratch2D(),input=[draw(CAP/2,0.25),draw(CAP/2,0.75)];
  const first=prepareAdjacentBatches2D(input,CAP,scratch);
  assert.equal(first.draws.length,1);assert.equal(first.bytes,CAP);assert.equal(scratch.available(),0);
  assert.deepEqual(first.logicalSpans,[{first:0,count:2}]);assert.equal(first.logicalDraws,input);
  const data=first.draws[0].packed.data;assert.equal(data.byteLength,CAP);
  assert.equal(data[0],0.25);assert.equal(data[data.length/2-1],0.25);assert.equal(data[data.length/2],0.75);assert.equal(data.at(-1),0.75);
  const second=prepareAdjacentBatches2D(input,CAP,scratch);
  assert.equal(second.draws.length,2);assert.equal(second.bytes,0);assert.equal(second.draws[0],input[0]);
  scratch.release(second);assert.equal(scratch.available(),0);
  scratch.release(first);assert.equal(scratch.available(),CAP);assert.equal(first.logicalDraws,undefined);
  assert.equal(first.draws.length,0);scratch.release(first);assert.equal(scratch.available(),CAP);
  const third=prepareAdjacentBatches2D(input,CAP,scratch);assert.equal(third.draws.length,1);assert.equal(third.bytes,CAP);
  scratch.release(third);assert.equal(scratch.available(),CAP);
});

test('UNIT above concat cap retains both original logical payloads without a rejection',()=>{
  const scratch=new PreparedBatchScratch2D(),input=[draw(CAP/2),draw(CAP/2+16)];
  const plan=prepareAdjacentBatches2D(input,2*CAP,scratch);
  assert.deepEqual(plan.draws,input);assert.equal(plan.draws[0],input[0]);assert.equal(plan.draws[1],input[1]);
  assert.equal(plan.bytes,0);assert.equal(scratch.available(),CAP);
  assert.deepEqual(plan.logicalSpans,[{first:0,count:1},{first:1,count:1}]);scratch.release(plan);
});

test('UNIT exact signed-zero crop and missing provenance do not authorize merging',()=>{
  for(const changed of [{crop:{x:-0,y:0,width:1,height:1}},{clips:undefined},{crop:undefined}]){
    const scratch=new PreparedBatchScratch2D(),input=[draw(96),draw(96,1,changed)];
    const plan=prepareAdjacentBatches2D(input,1024,scratch);
    assert.equal(plan.draws.length,2);assert.equal(plan.bytes,0);assert.equal(plan.draws[0],input[0]);scratch.release(plan);
  }
});
