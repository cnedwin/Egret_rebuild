// SPDX-License-Identifier: Apache-2.0
// Public SDK regressions: content and lifetime precede optimization assertions.
// Controlled GPU ports establish behavior, not native pixels or timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, withAuthored, withGpu, imagesOf, writesOf, submitSafe, frame, image, view, MATRIX, bindingsOf } from
  './fixtures/gpu-image-residency.mjs';

const SOURCE_PIXELS = [255, 64, 0, 255, 0, 128, 255, 128];
const CROP = { x: 0, y: 0, width: 1, height: 1 };
const matrix = (tx, ty) => ({ a: 1, b: 0, c: 0, d: 1, tx, ty });
const pixels = source => [...egret.copyImageData2DPixels(source)];

function assertClosed(a) {
  assert.equal(a.scope.state, 'closed');
  assert.equal(a.engine.stage.isDisposed, true);
  assert.equal(a.bitmap.isDisposed, true);
  assert.equal(a.mesh.isDisposed, true);
  assert.equal(a.texture.isDisposed, true);
  assert.throws(() => a.lease.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.throws(() => a.engine.captureFrame({ width: 8, height: 8 }), { code: 'ENGINE_CLOSED' });
  assert.deepEqual(pixels(a.source), SOURCE_PIXELS, 'owned pixels survive producer cleanup');
}

function eightImages(a) {
  const result = [a.bitmap];
  for (let i = 1; i < 8; i++) {
    const bitmap = a.scope.use(new egret.Bitmap(a.lease));
    a.engine.stage.addChild(bitmap); result.push(bitmap);
  }
  result.forEach((bitmap, i) => { bitmap.x = i; bitmap.y = 2; bitmap.scaleY = 2; bitmap.alpha = 0.5; });
  return result;
}

// Literal viewport/corner oracle, independent of production preparation helpers.
// Eight 1x2 tiles fill x=[0,8], initially y=[2,4], in an 8x8 backing.
function expectedVertices(top, bottom) {
  const pairs = [[-1, -0.75], [-0.75, -0.5], [-0.5, -0.25], [-0.25, 0],
    [0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]];
  return pairs.flatMap(([left, right]) => [
    left, top, 0, 0, right, top, 1, 0, right, bottom, 1, 1,
    left, top, 0, 0, right, bottom, 1, 1, left, bottom, 0, 1,
  ]);
}
const floatValues = bytes => [...new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)];

function assertExecutedImages(calls, texture, sampler, alpha, expected) {
  const uploads = new Map(), executed = [];
  let vertex, binding, pipeline, count = 0;
  for (const call of calls) {
    if (call[0] === 'writeBuffer') {
      assert.equal(call[2], 0); uploads.set(call[1], call[3]);
    } else if (call[0] === 'setPipeline') pipeline = call[1];
    else if (call[0] === 'setVertexBuffer') { assert.equal(call[1], 0); vertex = call[2]; }
    else if (call[0] === 'setBindGroup') { assert.equal(call[1], 0); binding = call[2]; }
    else if (call[0] === 'draw') {
      count++;
      assert.equal(pipeline.kind, 'image');
      assert.ok(vertex && binding, 'each real draw selects its own observed vertex/binding state');
      assert.equal(vertex.descriptor.usage, 40);
      assert.deepEqual(call.slice(2), [1, 0, 0]);
      const entries = binding.descriptor.entries;
      assert.deepEqual(entries.map(entry => entry.binding), [0, 1, 2]);
      assert.equal(entries[0].resource.texture, texture);
      assert.equal(entries[1].resource, sampler);
      const uniform = entries[2].resource.buffer;
      assert.equal(uniform.descriptor.usage, 72);
      assert.ok(uploads.has(vertex), 'selected vertex buffer was written this submission');
      assert.ok(uploads.has(uniform), 'selected uniform buffer was written this submission');
      assert.deepEqual(floatValues(uploads.get(uniform)), [alpha, 0, 0, 0]);
      const vertexData = floatValues(uploads.get(vertex));
      assert.equal(vertexData.length, call[1] * 4);
      executed.push(...vertexData);
    }
  }
  assert.ok(count > 0, 'nonempty selected draws are mandatory before a reduction assertion');
  assert.equal(calls.filter(call => call[0] === 'setVertexBuffer').length, count);
  assert.equal(calls.filter(call => call[0] === 'setBindGroup').length, count);
  assert.equal(calls.filter(call => call[0] === 'drawIndexed').length, 0);
  const vertexWrites = calls.filter(call => call[0] === 'writeBuffer' && call[1].descriptor.usage === 40);
  const uniformWrites = calls.filter(call => call[0] === 'writeBuffer' && call[1].descriptor.usage === 72);
  assert.equal(vertexWrites.reduce((bytes, call) => bytes + call[3].byteLength, 0), 768);
  assert.equal(uniformWrites.length, count);
  assert.equal(executed.length, 48 * 4);
  assert.deepEqual(executed, expected, 'actual selected draws retain all 48 ordered XY/UV vertices');
  return count;
}

for (const profile of ['ordinary', 'textured']) {
  test(`B01 ${profile}: eight adjacent same-view alpha images execute as one draw`, async () => {
    let authored;
    const counts = await withAuthored(async a => {
      authored = a;
      const bitmaps = eightImages(a);
      return withGpu(async f => {
        const h = f.host({}, profile); await f.ready(h);
        const capture = profile === 'ordinary' ? a.capture : a.textured;
        const render = profile === 'ordinary' ? value => h.renderFrame(value) : value => h.renderTexturedFrame(value);
        const first = capture();
        assert.equal(first.commands.length, 8);
        assert.equal(first.images.length, 1);
        assert.equal(first.images[0], a.source);
        assert.deepEqual(first.commands.map(command => [command.kind, command.imageIndex, command.alpha, command.matrix.tx]),
          Array.from({ length: 8 }, (_, i) => ['image', 0, 0.5, i]));
        assert.ok(first.commands.every(command => command.clips.length === 0));
        assert.deepEqual(first.commands.map(command => command.sourceRect), Array(8).fill(CROP));
        assert.deepEqual(pixels(first.images[0]), SOURCE_PIXELS);
        const start = f.calls.length; await submitSafe(f, h, first, render);
        const firstCalls = f.calls.slice(start);
        assert.equal(imagesOf(f).length, 1);
        assert.equal(writesOf(f).length, 1);
        assert.deepEqual([...writesOf(f)[0][2]], [255, 64, 0, 255], 'the chosen 1x1 crop is really uploaded');
        assert.deepEqual(writesOf(f)[0][3], { offset: 0, bytesPerRow: 4, rowsPerImage: 1 });
        const firstCount = assertExecutedImages(firstCalls, imagesOf(f)[0], f.sampler, 0.5, expectedVertices(0.5, 0));
        bitmaps.forEach(bitmap => { bitmap.y = 3; bitmap.alpha = 0.25; });
        const second = capture();
        assert.equal(second.frameId, 2);
        assert.notEqual(first, second); assert.notEqual(first.commands, second.commands); assert.notEqual(first.images, second.images);
        assert.deepEqual(first.commands.map(command => [command.matrix.ty, command.alpha]), Array(8).fill([2, 0.5]));
        assert.deepEqual(second.commands.map(command => [command.matrix.ty, command.alpha]), Array(8).fill([3, 0.25]));
        const next = f.calls.length; await submitSafe(f, h, second, render);
        const secondCalls = f.calls.slice(next);
        const secondCount = assertExecutedImages(secondCalls, imagesOf(f)[0], f.sampler, 0.25, expectedVertices(0.25, -0.25));
        assert.equal(writesOf(f).length, 1, 'the existing settled image residency remains effective');
        assert.equal(h.getStatus().pendingFrames, 0);
        assert.equal(h.getStatus().pendingUploadBytes, 0);
        assert.equal(h.getStatus().pendingReadbackBytes, 0);
        assert.equal(f.maps.length, 0); assert.equal(f.open, 0);
        assert.ok(f.buffers.length > 0);
        assert.ok(f.buffers.every(buffer => buffer.destroyed === 0));
        await f.close(h);
        assert.equal(h.getStatus().state, 'closed');
        assert.equal(h.getStatus().cleanupOutcome, 'safe');
        assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
        assert.equal(imagesOf(f)[0].destroyed, 1); assert.equal(f.logicalBytes, 0);
        assert.equal(f.calls.filter(call => call[0] === 'deviceDestroy').length, 0);
        return [firstCount, secondCount];
      });
    });
    assertClosed(authored);
    // Both settled submissions have already proved content and safe cleanup.
    assert.deepEqual(counts, [1, 1], `${profile} adjacent image batches still issue eight draws per frame`);
  });
}

test('B02 A-B-A preserves three adjacent groups and actual texture selection', async () => {
  await withGpu(async f => {
    const a=image(1,1,new Uint8Array([255,0,0,255])), b=image(1,1,new Uint8Array([0,0,255,255]));
    const input=frame([...Array(8).fill(view(a)),...Array(8).fill(view(b)),...Array(8).fill(view(a))]);
    const h=f.host(); await f.ready(h);
    for(let turn=0;turn<2;turn++) {
      const start=f.calls.length; await submitSafe(f,h,input);
      const calls=f.calls.slice(start), draws=calls.filter(c=>c[0]==='draw');
      assert.deepEqual(draws.map(c=>c.slice(1)),[[48,1,0,0],[48,1,0,0],[48,1,0,0]]);
      assert.deepEqual(calls.filter(c=>c[0]==='setBindGroup').map(c=>c[2].descriptor.entries[0].resource.texture),
        [imagesOf(f)[0],imagesOf(f)[1],imagesOf(f)[0]],'actual selected order cannot become A-A-B');
      assert.equal(calls.filter(c=>c[0]==='writeBuffer'&&c[1].descriptor.usage===40).reduce((sum,c)=>sum+c[3].byteLength,0),2304);
    }
    assert.equal(writesOf(f).length,2); await f.close(h);
    assert.ok(f.buffers.every(b=>b.destroyed===1)); assert.ok(imagesOf(f).every(t=>t.destroyed===1));
  });
});

for(const barrier of ['opacity','clip','crop','identity','empty-image']) {
  test('B03 adjacent batching retains '+barrier+' barrier', async()=>withGpu(async f=>{
    const a=image(2,1,new Uint8Array([255,0,0,255,255,0,0,255])), v=view(a,{x:0,y:0,width:1,height:1});
    const input=frame(Array(4).fill(v));
    if(barrier==='opacity') for(const c of input.commands.slice(2)) c.alpha=0.5;
    if(barrier==='clip') for(const c of input.commands.slice(2)) c.clips=[{matrix:MATRIX,rect:{x:0,y:0,width:8,height:8}}];
    if(barrier==='crop') for(const c of input.commands.slice(2)) c.sourceRect={x:1,y:0,width:1,height:1};
    if(barrier==='identity') {
      input.images.push(image(2,1,new Uint8Array([255,0,0,255,255,0,0,255])));
      for(const c of input.commands.slice(2)) c.imageIndex=1;
    }
    if(barrier==='empty-image') input.commands.splice(2,0,{...input.commands[0],rect:{x:0,y:0,width:0,height:4}});
    const h=f.host(); await f.ready(h);
    for(let turn=0;turn<2;turn++) {
      const start=f.calls.length; await submitSafe(f,h,input);
      const draws=f.calls.slice(start).filter(c=>c[0]==='draw');
      assert.deepEqual(draws.map(c=>c.slice(1)),[[12,1,0,0],[12,1,0,0]],barrier);
    }
    assert.equal(writesOf(f).length,barrier==='crop'||barrier==='identity'?2:1);
    await f.close(h); assert.ok(f.buffers.every(b=>b.destroyed===1));
  }));
}

test('B04 hardware buffer limit splits only at admitted logical image boundaries',async()=>withGpu(async f=>{
  f.limits.maxBufferSize=192;
  const h=f.host(); await f.ready(h); const v=view(), input=frame(Array(8).fill(v));
  const start=f.calls.length; await submitSafe(f,h,input);
  const calls=f.calls.slice(start);
  assert.deepEqual(calls.filter(c=>c[0]==='draw').map(c=>c[1]),[12,12,12,12]);
  assert.deepEqual(calls.filter(c=>c[0]==='writeBuffer'&&c[1].descriptor.usage===40).map(c=>c[3].byteLength),[192,192,192,192]);
  assert.equal(h.getStatus().pendingUploadBytes,0); await f.close(h);
}));

for(const differentClip of [false,true]) {
  test('B05 rectangle ranges '+(differentClip?'retain distinct clips':'merge with original vertex colors'),async()=>withGpu(async f=>{
    const commands=[0xff0000,0x0000ff].map((color,i)=>({kind:'rect',matrix:{...MATRIX,tx:i*2},rect:{x:0,y:0,width:2,height:2},
      color,alpha:1,clips:differentClip&&i===1?[{matrix:MATRIX,rect:{x:0,y:0,width:8,height:8}}]:[]}));
    const input=frame([],{commands}),h=f.host(); await f.ready(h);
    for(let turn=0;turn<2;turn++) {
      const start=f.calls.length; await submitSafe(f,h,input);
      const calls=f.calls.slice(start),draws=calls.filter(c=>c[0]==='draw');
      assert.deepEqual(draws.map(c=>c.slice(1)),differentClip?[[6,1,0,0],[6,1,6,0]]:[[12,1,0,0]]);
      const writes=calls.filter(c=>c[0]==='writeBuffer'&&c[1].descriptor.usage===40);
      assert.equal(writes.length,1); const data=floatValues(writes[0][3]);
      assert.equal(data.length,72);
      for(let i=0;i<12;i++) assert.deepEqual(data.slice(i*6+2,i*6+6),i<6?[1,0,0,1]:[0,0,1,1]);
    }
    await f.close(h);assert.ok(f.buffers.every(b=>b.destroyed===1));
  }));
}

test('B06 actual queue callback cannot contaminate later cached packed vertices',async()=>withGpu(async f=>{
  const original=f.queue.writeBuffer;
  let poison=true;
  f.queue.writeBuffer=function(buffer,offset,data){
    original.call(this,buffer,offset,data);
    if(poison&&buffer.descriptor.usage===40)data.fill(99);
  };
  const h=f.host();await f.ready(h);const input=frame();
  const firstStart=f.calls.length;await submitSafe(f,h,input);
  poison=false;
  const nextStart=f.calls.length;await submitSafe(f,h,input);
  const first=f.calls.slice(firstStart,nextStart).find(c=>c[0]==='writeBuffer'&&c[1].descriptor.usage===40);
  const next=f.calls.slice(nextStart).find(c=>c[0]==='writeBuffer'&&c[1].descriptor.usage===40);
  assert.ok(first&&next);assert.equal(first[3].byteLength,96);assert.deepEqual(next[3],first[3]);
  assert.ok(floatValues(next[3]).every(v=>Math.abs(v)<=1));await f.close(h);
}));

// Controlled constructor faults are scoped to the known numeric allocation.
// Genuine original packing and the optional concat have different fixed lengths.
function withFloatConstruction(run, targetLength, action) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Float32Array');
  let attempts=0;
  try {
    Object.defineProperty(globalThis,'Float32Array',{...descriptor,value:new Proxy(descriptor.value,{
      construct(target,args,newTarget){
        if(args.length===1&&args[0]===targetLength){attempts++;action();}
        return Reflect.construct(target,args,newTarget);
      },
    })});
    return {value:run(),attempts};
  } finally {
    Object.defineProperty(globalThis,'Float32Array',descriptor);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'Float32Array'),descriptor);
  }
}

test('UNIT B07 optional concat allocation failure preserves admitted original draws',async()=>withGpu(async f=>{
  const h=f.host();await f.ready(h);const v=view(),input=frame(Array(8).fill(v));
  const sentinel=new Error('assigned optional concat failure');
  const start=f.calls.length;
  const result=withFloatConstruction(()=>f.capture(()=>h.renderFrame(input)),192,()=>{throw sentinel;});
  assert.equal(result.attempts,1);assert.equal(result.value.threw,false);
  await result.value.finish();await h.whenIdle();
  assert.deepEqual(f.calls.slice(start).filter(c=>c[0]==='draw').map(c=>c[1]),Array(8).fill(6));
  const next=f.calls.length;await submitSafe(f,h,input);
  assert.deepEqual(f.calls.slice(next).filter(c=>c[0]==='draw').map(c=>c[1]),[48]);
  assert.equal(h.getStatus().pendingUploadBytes,0);await f.close(h);
}));

test('UNIT B08 original logical uniform fault precedes optional concat',async()=>withGpu(async f=>{
  const h=f.host();await f.ready(h);const v=view(),input=frame(Array(8).fill(v));
  const sentinel=new Error('assigned original uniform failure'),start=f.calls.length;
  // Uniforms are constructed from four-element literals, not numeric lengths.
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Float32Array');let uniformAttempts=0,concatAttempts=0,record;
  try {
    Object.defineProperty(globalThis,'Float32Array',{...descriptor,value:new Proxy(descriptor.value,{
      construct(target,args,newTarget){
        if(args.length===1&&Array.isArray(args[0])&&args[0].length===4){uniformAttempts++;throw sentinel;}
        if(args.length===1&&args[0]===192)concatAttempts++;
        return Reflect.construct(target,args,newTarget);
      },
    })});
    record=f.capture(()=>h.renderFrame(input));
  }finally{Object.defineProperty(globalThis,'Float32Array',descriptor);}
  assert.equal(uniformAttempts,1);assert.equal(concatAttempts,0);assert.equal(record.threw,true);
  assert.equal(record.error.code,'WEBGPU_FRAME_INVALID');assert.equal(record.error.cause,sentinel);
  assert.equal(f.calls.length,start);assert.equal(h.getStatus().lastSerial,0);assert.equal(h.getStatus().pendingFrames,0);
  await f.close(h);
}));

test('UNIT B09 stop during optional concat keeps the original state-first refusal',async()=>withGpu(async f=>{
  const h=f.host();await f.ready(h);const v=view(),input=frame(Array(8).fill(v));
  const start=f.calls.length,sentinel=new Error('assigned concat callback');
  const result=withFloatConstruction(()=>f.capture(()=>h.renderFrame(input)),192,()=>{h.stop();throw sentinel;});
  assert.equal(result.attempts,1);assert.equal(result.value.threw,true);assert.equal(result.value.error.code,'WEBGPU_STOPPED');
  assert.equal(f.calls.length,start);assert.equal(h.getStatus().lastSerial,0);assert.equal(h.getStatus().pendingFrames,0);
  await f.close(h);assert.equal(h.getStatus().cleanupOutcome,'safe');
}));

test('B10 filtered rectangle keeps original command provenance and a missing-row barrier',async()=>withGpu(async f=>{
  const rect=(width,clips=[])=>({kind:'rect',matrix:MATRIX,rect:{x:0,y:0,width,height:2},color:0xff0000,alpha:1,clips});
  const input=frame([],{commands:[rect(2),rect(0),rect(2,[{matrix:MATRIX,rect:{x:0,y:0,width:8,height:8}}])]}),h=f.host();
  await f.ready(h);
  for(let turn=0;turn<2;turn++){
    const start=f.calls.length;await submitSafe(f,h,input);
    assert.deepEqual(f.calls.slice(start).filter(c=>c[0]==='draw').map(c=>c.slice(1)),[[6,1,0,0],[6,1,6,0]]);
  }
  await f.close(h);assert.ok(f.buffers.every(b=>b.destroyed===1));
}));
