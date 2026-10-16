// SPDX-License-Identifier: Apache-2.0
// Genuine public SDK CPU regression; this host does not render or establish native pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageData2D } from '@egret/engine';
import { host } from './helpers.mjs';
import { createAtlasFrameSession } from '../examples/trimmed-atlas-playback/session.mjs';
import { assertAtlasObservation } from '../tools/atlas-frame/scenario.mjs';
function image(){
  const pixels=new Uint8Array(144),colors={R:[255,0,0,255],G:[0,255,0,255],B:[0,0,255,255],
    Y:[255,255,0,255],M:[255,0,255,255],C:[0,255,255,255]};
  for(const [x,rows]of [[0,['RG','BY','MC']],[3,['YR','MG','CB']]])
    for(let y=0;y<3;y++)for(let dx=0;dx<2;dx++)pixels.set(colors[rows[y][dx]],(y*6+x+dx)*4);
  return createImageData2D({width:6,height:6,pixels});
}
async function fixture(){const adapter=host();return {adapter,session:await createAtlasFrameSession({host:adapter.adapter,profile:'canvas-2d',image:image()})};}
function observe(session,id){
  const frame=session.capture(),actual={profile:'canvas-2d',session:session.inspect(),commands:frame.commands,
    images:(frame.images??[]).map(value=>({width:value.width,height:value.height,byteLength:value.byteLength}))};
  assert.equal(assertAtlasObservation(actual,id),true);
  return actual;
}
test('completed public handle remains terminal while N06 through N10 display the final B frame',async()=>{
  const {session}=await fixture();
  try{
    observe(session,'N01');session.actors.left.playback.start();session.advanceTo(.125);observe(session,'N02');
    session.actors.right.playback.start();observe(session,'N03');session.actors.left.playback.pause();observe(session,'N04');
    session.advanceTo(.1875);session.actors.left.playback.resume();observe(session,'N05');
    session.advanceTo(.4375);
    function completed(id){
      const actual=observe(session,id),left=session.actors.left;
      assert.equal(left.playback.state,'completed');assert.equal(left.playback.isDisposed,true);
      assert.equal(left.playback.lastSample.frameIndex,1);assert.equal(left.bitmap.isDisposed,false);
      assert.equal(left.sheet.isDisposed,false);assert.equal(left.lease.value.isDisposed,false);assert.equal(session.engine.stage.isDisposed,false);
      const incorrect=structuredClone(actual);incorrect.session.actors.left.isDisposed=false;
      assert.throws(()=>assertAtlasObservation(incorrect,id),/left controller/);
    }
    completed('N06');session.advanceTo(.5);completed('N07');
    const parent=session.actors.left.parent;parent.rotation=90;parent.anchorOffsetX=1;parent.anchorOffsetY=1;completed('N08');
    parent.clipRect={x:0,y:0,width:3,height:4};completed('N09');
    parent.rotation=0;parent.anchorOffsetX=0;parent.anchorOffsetY=0;parent.clipRect=undefined;completed('N10');
  }finally{await session.retire();}
});
async function healthyCleanupBaseline(){
  const {session,adapter}=await fixture();let terminal=false;
  const scope=session.engine.createScope();scope.use({dispose(){terminal=true;}});scope.dispose();
  assert.equal(scope.state,'closed');assert.equal(terminal,true);assert.deepEqual(session.inspect().diagnostics,[]);
  const retired=await session.retire();assert.equal(retired.state,'closed');assert.ok(retired.bitmaps.every(Boolean));
  assert.ok(adapter.trace.includes('stop')&&adapter.trace.includes('close'));assert.equal(adapter.timers.size,0);
}
for(const kind of ['marker','undefined'])test('real explicit Scope diagnostic rejects retirement and preserves '+kind+' cause',async()=>{
  // A new complete genuine baseline precedes each assigned cleanup failure.
  await healthyCleanupBaseline();
  const {session,adapter}=await fixture(),cause=kind==='marker'?Object.assign(new Error('Genuine caller-owned cleanup failure'),{code:'ATLAS_TEST_CLEANUP'}):undefined;
  let terminal=false;
  const scope=session.engine.createScope();scope.use({dispose(){terminal=true;throw cause;}});
  assert.doesNotThrow(()=>scope.dispose());assert.equal(scope.state,'closed');assert.equal(terminal,true);
  assert.equal(session.inspect().diagnostics[0].code,'SCOPE_CLEANUP_FAILED');
  let retained;
  try{
    await assert.rejects(session.retire(),error=>{
      retained=error;
      assert.ok(error instanceof AggregateError);assert.ok(error.errors.some(value=>Object.is(value,cause)));
      assert.ok(error.diagnostics.some(value=>value.code==='SCOPE_CLEANUP_FAILED'&&Object.is(value.cause,cause)));
      assert.equal(error.retirement.state,'closed');assert.ok(error.retirement.bitmaps.every(Boolean));
      assert.ok(error.retirement.leases.every(Boolean));assert.ok(error.retirement.textures.every(Boolean));
      assert.equal(error.retirement.diagnostics[0].cause.wasUndefined,kind==='undefined');
      if(kind==='marker')assert.equal(error.retirement.diagnostics[0].cause.code,'ATLAS_TEST_CLEANUP');
      return true;
    });
    await assert.rejects(session.close(),error=>error===retained);
    assert.ok(adapter.trace.includes('stop')&&adapter.trace.includes('close'));assert.equal(adapter.timers.size,0);
  }finally{await session.close().catch(()=>undefined);}
  await healthyCleanupBaseline();
});
