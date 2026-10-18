// SPDX-License-Identifier: Apache-2.0
// Public SDK with controlled browser ports: no rasterization or native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, glPorts, until } from './fixtures/gl-shared-rendering.mjs';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';

const PROFILE = 'egret.shared-frame2d/1';
const TOP = ['canvas','onDiagnostic','pixelRatio','maxBackingPixels','maxCommands','maxClipRectangles',
  'maxPreparedVertices','maxClipEdgeTests','maxUploadBytes','maxPendingUploadBytes','maxPendingFrames',
  'maxReadbackBytes','enableReadback','maxSourceTriangles','maxFrameGeometryBytes','maxPendingGeometryBytes',
  'maxTupleComparisons','outputAlpha','restoreTimeoutMs'];
const code = name => e => e instanceof egret.EgretError && e.code === 'WEBGL2_' + name;
async function author(body) {
  const engine = await egret.createEngine({ host: { surface:{}, start(){}, stop(){}, async close(){}, setTimeout(){return ()=>{};} } });
  const scope = engine.createScope();
  const sprite = scope.use(new egret.Sprite()); engine.stage.addChild(sprite);
  sprite.graphics.beginFill(0xff0000).drawRect(0,0,4,4).endFill();
  try { return await body({engine, scope, sprite, frame:() => engine.captureSharedFrame({width:8,height:8})}); }
  finally { scope.dispose(); await engine.dispose(); }
}

test('GL G01 options snapshot once in order; getter causes and unknown properties remain separate', async () => {
  const f = glPorts(), trace = [];
  const input = Object.defineProperties({}, Object.fromEntries(TOP.map(key => [key, { get() { trace.push(key); return key === 'canvas' ? f.canvas : undefined; } }])));
  Object.defineProperty(input, 'device', { get() { throw Error('unknown property read'); } });
  const h = createSharedWebGL2Host(input);
  assert.deepEqual(trace, TOP); assert.equal(h.surface, f.canvas); assert.equal(h.sharedFrameProfile, PROFILE);
  assert.equal('renderFrame' in h, false); assert.equal('renderTexturedFrame' in h, false);
  assert.equal(h.getStatus().state, 'new'); assert.deepEqual(f.events, []);
  const cause = {}, bad = Object.defineProperties({ canvas:f.canvas, maxCommands:-1 }, { restoreTimeoutMs:{get(){throw cause;}} });
  assert.throws(() => createSharedWebGL2Host(bad), e => code('OPTIONS_INVALID')(e) && e.cause === cause);
  await h.close();
});

test('GL G02 startup qualifies attributes, formats and actual non-power-of-two UBO alignment', async () => {
  for (const alignment of [4,12,16,256]) {
    const f = glPorts({alignment}), h = createSharedWebGL2Host({canvas:f.canvas});
    const first = h.start(); assert.equal(h.start(), first); assert.equal(h.whenReady(), first);
    await first; assert.equal(h.getStatus().state, 'active'); assert.equal(h.getStatus().generation, 1);
    assert.deepEqual(f.events.find(row => row[0] === 'getContext').slice(1), ['webgl2',f.options]);
    await h.close(); assert.equal(h.getStatus().cleanupOutcome, 'safe'); assert.equal(f.live().length, 0); assert.equal(f.listenerCount(), 0);
    await assert.rejects(h.start(), code('CLOSED'));
  }
  for (const [port, expected] of [[{alignment:3},'CONTEXT_LIMIT'],[{attributes:{antialias:true}},'CONTEXT_ATTRIBUTES_UNSUPPORTED'],[{colorEncoding:constantsSRGB()},'FORMAT_UNSUPPORTED']]) {
    const f = glPorts(port), h = createSharedWebGL2Host({canvas:f.canvas});
    await assert.rejects(h.start(), code(expected)); await h.close(); assert.equal(f.live().length, 0);
  }
});
function constantsSRGB() { return 35904; }

test('GL G03 genuine saved shared frames submit; lookalikes refuse before native allocation', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas}); await h.start();
  const frame = a.frame(), before = f.events.length;
  assert.throws(() => h.renderSharedFrame({...frame}), code('FRAME_PROFILE_UNSUPPORTED'));
  assert.equal(f.events.length, before); assert.equal(h.getStatus().lastSerial, 0);
  assert.equal(h.renderSharedFrame(frame), undefined); await h.whenIdle();
  assert.equal(h.getStatus().lastSerial, 1); assert.equal(h.getStatus().pendingFrames, 0);
  assert.equal(f.events.filter(row => row[0] === 'drawArrays').length, 2, 'one solid draw and one final resolve');
  assert.ok(Object.isFrozen(h.getSharedStatus().retention));
  await h.close(); assert.equal(f.live().length, 0);
}));

test('GL G04 PBO copy is issued before a later submission; delayed extraction belongs to the first frame', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true}); await h.start(); f.autoSignal = false;
  const frame = a.frame(), readback = h.requestReadback();
  const pixels = new Uint8Array(8*8*4); for(let y=0;y<8;y++) pixels.fill(y+10,y*32,(y+1)*32); f.nextPixels = pixels;
  h.renderSharedFrame(frame); const firstEnd = f.events.length;
  assert.equal(f.events.filter(row => row[0] === 'readPixels').length, 1);
  assert.equal(f.events.filter(row => row[0] === 'getBufferSubData').length, 0);
  f.nextPixels = new Uint8Array(8*8*4).fill(99); h.renderSharedFrame(frame);
  assert.ok(f.events.findIndex(row => row[0] === 'readPixels') < firstEnd);
  assert.equal(h.getStatus().pendingFrames, 2); assert.throws(() => h.renderSharedFrame(frame), code('BACKPRESSURE'));
  f.signalAll(); const result = await readback; await h.whenIdle();
  assert.deepEqual([result.serial,result.frameId,result.generation,result.width,result.height,result.sourceFormat,result.colorSpace], [1,frame.frameId,1,8,8,'rgba8unorm','srgb']);
  assert.deepEqual([...result.bytes.subarray(0,32)], Array(32).fill(17));
  assert.deepEqual([...result.bytes.subarray(7*32)], Array(32).fill(10));
  await h.close(); assert.equal(f.live().length, 0);
}));

test('GL G05 loss keeps old outcomes rejected and recovery publishes one fresh readiness generation', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true}); await h.start(); f.autoSignal = false;
  const frame = a.frame(), ticket = h.requestReadback(); h.renderSharedFrame(frame); const oldIdle = h.whenIdle();
  const rejectedTicket = assert.rejects(ticket, code('CONTEXT_LOST')), rejectedIdle = assert.rejects(oldIdle, code('CONTEXT_LOST'));
  f.lose(); const ready = h.whenReady(); assert.equal(h.whenReady(), ready);
  assert.equal(h.getStatus().state, 'lost'); assert.equal(h.getStatus().firstFailure.code, 'WEBGL2_CONTEXT_LOST');
  assert.throws(() => h.renderSharedFrame(frame), code('CONTEXT_LOST'));
  f.autoSignal = true; f.restore(); await ready; await rejectedTicket; await rejectedIdle;
  assert.equal(h.getStatus().generation, 2); assert.equal(h.getStatus().generationFailure, null);
  assert.equal(h.getStatus().firstFailure.code, 'WEBGL2_CONTEXT_LOST');
  h.renderSharedFrame(frame); await h.whenIdle(); assert.equal(h.getStatus().lastSerial, 2);
  await h.close(); assert.equal(f.live().length, 0); assert.equal(f.listenerCount(), 0);
}));

test('GL G06 close cancels recovery and a stale restored event cannot resurrect the Host', async () => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas}); await h.start(); f.lose();
  const ready = h.whenReady(), rejected = assert.rejects(ready, code('CLOSED'));
  await h.close(); await rejected; const before = f.events.length; f.restore();
  assert.equal(h.getStatus().state, 'closed'); assert.equal(h.getStatus().cleanupOutcome, 'safe');
  assert.equal(f.events.length, before); assert.equal(f.listenerCount(), 0);
});

test('GL G07 recovery timeout is finite and cannot be renewed by duplicate loss events', async () => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,restoreTimeoutMs:15}); await h.start(); f.lose();
  const ready = h.whenReady(), rejection = assert.rejects(ready, code('RESTORE_TIMEOUT'));
  f.lose(); assert.equal(h.whenReady(), ready); await rejection;
  assert.equal(h.getStatus().state, 'failed'); await h.close(); assert.equal(h.getStatus().cleanupOutcome, 'safe');
});

test('GL G08 unknown native deletion remains charged through a later context loss', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas}); await h.start(); h.renderSharedFrame(a.frame()); await h.whenIdle();
  const cause = Object.freeze({deleteFailure:true}); f.fail = {name:'deleteBuffer',cause};
  const closing = h.close(); await assert.rejects(closing, code('CLOSE_UNSAFE'));
  const before = h.getSharedStatus().retention; assert.ok(before.unknownBytes > 0 || before.unknownNativeBytes > 0);
  // No manual refund is permitted after the first cleanup attempt became unknown.
  f.lose(false); // Listener removal does not authorize a second native cleanup.
  assert.deepEqual(h.getSharedStatus().retention, before); assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
}));


test('GL G09 actual loss during close invalidates known owners without starting recovery', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true});
  await h.start(); f.autoSignal = false;
  const ticket = h.requestReadback(); h.renderSharedFrame(a.frame());
  const idle = h.whenIdle();
  const rejectedTicket = assert.rejects(ticket, code('CONTEXT_LOST'));
  const rejectedIdle = assert.rejects(idle, code('CONTEXT_LOST'));
  const generation = h.getStatus().generation, closing = h.close();
  closing.catch(() => undefined);
  assert.equal(h.getStatus().state, 'closing');
  f.lose();
  await until(() => h.getStatus().state === 'closed', 'actual loss during close must retire all accepted records');
  await closing; await rejectedTicket; await rejectedIdle;
  assert.equal(h.getStatus().cleanupOutcome, 'safe');
  assert.equal(h.getStatus().pendingFrames, 0);
  assert.equal(h.getSharedStatus().retention.unknownNativeObjects, 0);
  assert.equal(h.getSharedStatus().retention.unknownBytes, 0);
  assert.equal(h.getStatus().generation, generation);
  assert.equal(f.listenerCount(), 0);
  const before = f.events.length; f.restore();
  assert.equal(f.events.length, before, 'a restored event cannot start a generation after close');
  assert.equal(h.getStatus().state, 'closed');
}));

test('GL G10 event-delayed actual loss inside retirement deletion still settles every barrier', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts();
  // A browser may report native loss before delivering webglcontextlost. This
  // public port controls that order without reaching any Host/private helper.
  const nativeLost = f.gl.isContextLost.bind(f.gl);
  let lossReported = false, injected = false;
  f.gl.isContextLost = () => lossReported || nativeLost();
  const h = createSharedWebGL2Host({canvas:f.canvas});
  await h.start(); f.autoSignal = false;
  h.renderSharedFrame(a.frame());
  const idleOutcome = h.whenIdle().then(() => ({resolved:true}), error => ({error}));
  const closing = h.close(); closing.catch(() => undefined);
  f.onCall = name => {
    if (name === 'deleteBuffer' && !injected) {
      injected = true; lossReported = true;
      // No loss event yet. cleanup's own native loss query is the first proof.
    }
  };
  f.signalAll();
  await until(() => h.getStatus().state === 'closed', 'retirement must settle after cleanup observes context loss');
  assert.equal(injected, true, 'exercise deletion within record retirement, before final close cleanup');
  await closing;
  const idle = await idleOutcome;
  // The completion fence may already have settled the frame before loss is
  // observed. Either documented completion or CONTEXT_LOST is allowed, but a
  // private ledger exception or a permanently pending promise is not.
  if (!idle.resolved) assert.ok(code('CONTEXT_LOST')(idle.error));
  assert.equal(h.getStatus().pendingFrames, 0);
  assert.equal(h.getStatus().cleanupOutcome, 'safe');
  assert.equal(h.getSharedStatus().retention.unknownNativeObjects, 0);
  assert.equal(h.getSharedStatus().retention.unknownBytes, 0);
  assert.equal(f.listenerCount(), 0);
  assert.equal(h.close(), closing);
}));

test('GL S01 optional genuine scene uses one matrix arena, uint32 indices and ordered overlay', async () => author(async a => {
  const sceneEntry=await import('@egret/engine/webgl2/scene3d');
  assert.deepEqual(Object.keys(sceneEntry),['createSharedSceneWebGL2Host']);
  const {createMeshGeometry3D,createSceneFrame3D,createMatrix4}=await import('@egret/engine/scene3d');
  const mesh=createMeshGeometry3D({positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]});
  const scene=createSceneFrame3D({projection:{kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3},draws:[{geometry:mesh,modelView:createMatrix4([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}]});
  const f=glPorts({alignment:12});
  assert.throws(()=>sceneEntry.createSharedSceneWebGL2Host({canvas:f.canvas}),code('OPTIONS_INVALID'));
  const h=sceneEntry.createSharedSceneWebGL2Host({canvas:f.canvas,outputAlpha:'opaque'});await h.start();
  const frame=a.engine.captureSharedFrame({width:8,height:8,outputAlpha:'opaque',clearAlpha:1});
  const before=f.events.length;
  assert.throws(()=>h.renderSceneSharedFrame({...scene},frame),code('FRAME_INVALID'));assert.equal(f.events.length,before);
  h.renderSceneSharedFrame(scene,frame);await h.whenIdle();
  const events=f.events.slice(before),draws=events.filter(e=>e[0]==='drawElements'||e[0]==='drawArrays');
  assert.deepEqual(draws.map(e=>e[0]),['drawElements','drawArrays','drawArrays']);
  assert.deepEqual(draws[0].slice(1),[f.gl.TRIANGLES,3,f.gl.UNSIGNED_INT,0]);
  const ranges=events.filter(e=>e[0]==='bindBufferRange'&&e[3]!==null);
  assert.deepEqual(ranges.map(e=>e.slice(4)),[[132,64],[0,128]]);
  const uniformAlloc=events.filter(e=>e[0]==='bufferData'&&e[1]===f.gl.UNIFORM_BUFFER);
  assert.deepEqual(uniformAlloc.map(e=>e[2]),[204]);
  assert.ok(events.some(e=>e[0]==='depthFunc'&&e[1]===f.gl.GREATER));
  assert.ok(events.some(e=>e[0]==='depthRange'&&e[1]===0&&e[2]===1));
  assert.deepEqual([h.getSceneStatus().pendingSceneBytes,h.getSceneStatus().pendingUniformBytes,h.getSceneStatus().pendingDepthBytes],[0,0,0]);
  await h.close();assert.equal(f.live().length,0);
}));


test('GL G11 both assemblies detach retained container references before completion and release the current program at close', { timeout: 2000 }, async () => author(async a => {
  for (const sceneMode of [false, true]) {
    const f = glPorts(), gl = f.gl, violations = [], vaos = new Map(), fbos = new Map();
    let vao = null, array = null, drawFBO = null, readFBO = null, currentProgram = null;
    let populatedAttributes = 0, populatedDepth = 0, populatedIndices = 0, fences = 0;
    const vertexState = key => { if (!vaos.has(key)) vaos.set(key, { attributes:new Map(), element:null }); return vaos.get(key); };
    const targetFBO = target => target === gl.READ_FRAMEBUFFER ? readFBO : drawFBO;
    const attachments = key => { if (!fbos.has(key)) fbos.set(key, new Map()); return fbos.get(key); };
    f.onCall = (name, args) => {
      if (name === 'bindVertexArray') vao = args[0];
      if (name === 'bindBuffer') {
        if (args[0] === gl.ARRAY_BUFFER) array = args[1];
        if (args[0] === gl.ELEMENT_ARRAY_BUFFER) { vertexState(vao).element = args[1]; if (args[1]) populatedIndices++; }
      }
      if (name === 'vertexAttribPointer') {
        vertexState(vao).attributes.set(args[0], array);
        if (array) populatedAttributes++;
        else if (args[5] !== 0) violations.push('null array binding with nonzero attribute offset');
      }
      if (name === 'bindFramebuffer') {
        if (args[0] !== gl.READ_FRAMEBUFFER) drawFBO = args[1];
        if (args[0] !== gl.DRAW_FRAMEBUFFER) readFBO = args[1];
      }
      if (name === 'framebufferTexture2D' || name === 'framebufferRenderbuffer') {
        attachments(targetFBO(args[0])).set(args[1], args[3]);
        if (name === 'framebufferRenderbuffer' && args[1] === gl.DEPTH_ATTACHMENT && args[3]) populatedDepth++;
      }
      if (name === 'useProgram') currentProgram = args[0];
      if (name === 'fenceSync') {
        fences++;
        for (const [key, state] of vaos) {
          if ([...state.attributes.values()].some(Boolean) || state.element) violations.push('buffer retained at fence by VAO ' + (key?.id ?? 'default'));
        }
        for (const [key, state] of fbos) if ([...state.values()].some(Boolean)) violations.push('attachment retained at fence by FBO ' + (key?.id ?? 'default'));
      }
      // Deleting from an unbound container does not detach that container's
      // reference. A disabled attribute still owns its recorded buffer binding.
      if (name === 'deleteBuffer') for (const [key, state] of vaos) {
        if (key !== vao && ([...state.attributes.values()].includes(args[0]) || state.element === args[0])) violations.push('buffer deleted while retained by another VAO');
        if (key === vao) { for (const [index, value] of state.attributes) if (value === args[0]) state.attributes.set(index, null); if (state.element === args[0]) state.element = null; }
      }
      if (name === 'deleteTexture' || name === 'deleteRenderbuffer') for (const [key, state] of fbos) {
        if (key !== drawFBO && key !== readFBO && [...state.values()].includes(args[0])) violations.push('attachment deleted while retained by another FBO');
        if (key === drawFBO || key === readFBO) for (const [attachment, value] of state) if (value === args[0]) state.set(attachment, null);
      }
      if (name === 'deleteProgram' && currentProgram === args[0]) violations.push('current program deleted before useProgram(null)');
      if (name === 'deleteVertexArray') vaos.delete(args[0]);
      if (name === 'deleteFramebuffer') fbos.delete(args[0]);
    };
    let h, submit;
    if (sceneMode) {
      const {createSharedSceneWebGL2Host} = await import('@egret/engine/webgl2/scene3d');
      const {createMeshGeometry3D,createSceneFrame3D,createMatrix4} = await import('@egret/engine/scene3d');
      const geometry = createMeshGeometry3D({positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]});
      const scene = createSceneFrame3D({projection:{kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3},draws:[{geometry,modelView:createMatrix4([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}]});
      h = createSharedSceneWebGL2Host({canvas:f.canvas,outputAlpha:'opaque'});
      submit = () => h.renderSceneSharedFrame(scene,a.engine.captureSharedFrame({width:8,height:8,outputAlpha:'opaque',clearAlpha:1}));
    } else { h = createSharedWebGL2Host({canvas:f.canvas}); submit = () => h.renderSharedFrame(a.frame()); }
    try {
      await h.start(); f.autoSignal = false; submit(); h.stop();
      const idle = h.whenIdle(); f.signalAll(); await idle; await h.close();
      assert.equal(fences, 1); assert.ok(populatedAttributes > 0);
      if (sceneMode) { assert.ok(populatedDepth > 0); assert.ok(populatedIndices > 0); }
      assert.deepEqual(violations, [], sceneMode ? 'scene and overlay containers' : 'shared 2D containers');
      assert.equal(f.live().length, 0);
    } finally { f.signalAll(); await h.close(); f.onCall = undefined; }
  }
}));

test('GL G12 whenIdle waits for its complete record snapshot before reporting the first failure', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true});
  try {
    await h.start(); f.autoSignal = false;
    const ticket = h.requestReadback(), ticketOutcome = ticket.then(value => ({value}), error => ({error}));
    h.renderSharedFrame(a.frame()); h.renderSharedFrame(a.frame());
    const syncs = f.owners.filter(value => value.kind === 'Sync'); assert.equal(syncs.length, 2);
    let idleSettled = false;
    const idleOutcome = h.whenIdle().then(() => { idleSettled = true; return {}; }, error => { idleSettled = true; return {error}; });
    const cause = Object.freeze({readbackFault:'first snapshot record'});
    f.fail = {name:'getBufferSubData',cause}; syncs[0].signaled = true;
    await until(() => h.getStatus().pendingFrames === 1, 'first record retired, second fence still pending');
    assert.equal(idleSettled, false, 'a failed first record must not end the snapshot wait');
    assert.ok(code('READBACK_FAILED')((await ticketOutcome).error));
    syncs[1].signaled = true;
    const idle = await idleOutcome;
    assert.ok(code('READBACK_FAILED')(idle.error)); assert.equal(idle.error.cause, cause);
    assert.equal(h.getStatus().pendingFrames, 0);
  } finally { f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));

// Exact, case-scoped whole-descriptor substitution authorized by the paired
// AGENTS clock UNIT allowance. Restore before ordinary Host/Engine cleanup.
function glDeadlineClock(initial) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  assert.ok(descriptor?.configurable, 'test runtime permits exact descriptor restoration');
  let now = initial;
  Object.defineProperty(globalThis, 'performance', {configurable:true,enumerable:descriptor.enumerable,writable:true,value:Object.freeze({now:() => now})});
  return {
    advance(value) { assert.ok(value >= now, 'controlled clock remains monotonic'); now = value; },
    restore() { Object.defineProperty(globalThis, 'performance', descriptor); },
  };
}

test('GL G13 UNIT a distinct loss during restore rejects the old readiness and starts one new bounded attempt', { timeout: 2000 }, async () => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,restoreTimeoutMs:1000});
  const clock = glDeadlineClock(100);
  try {
    await h.start(); f.lose();
    const oldReady = h.whenReady(), oldOutcome = oldReady.then(() => ({}), error => ({error}));
    clock.advance(150); let injected = false;
    f.onCall = name => {
      if (!injected && name === 'getContextAttributes' && h.getStatus().state === 'restoring') {
        injected = true; f.onCall = undefined; f.lose();
      }
    };
    f.restore();
    await until(() => injected && h.getStatus().state === 'lost', 'new generation loss must open a fresh recovery cycle');
    assert.ok(code('CONTEXT_LOST')((await oldOutcome).error));
    assert.equal(h.getStatus().generation, 2);
    const ready = h.whenReady(), outcome = ready.then(() => ({}), error => ({error}));
    assert.notEqual(ready, oldReady); assert.equal(h.whenReady(), ready);
    clock.advance(1140); f.lose();
    assert.equal(h.whenReady(), ready, 'duplicate loss keeps the existing promise and original deadline');
    assert.equal(h.getStatus().generation, 2);
    clock.advance(1151); f.restore();
    const result = await outcome;
    assert.ok(code('RESTORE_TIMEOUT')(result.error), 'duplicate loss cannot renew the second cycle deadline');
    assert.equal(h.getStatus().state, 'failed');
  } finally { clock.restore(); f.onCall = undefined; await h.close(); }
});

test('GL G14 UNIT an already-signaled fence cannot publish success after the unchanged sync deadline', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true});
  const clock = glDeadlineClock(1000);
  try {
    await h.start(); const ticket = h.requestReadback(), ticketOutcome = ticket.then(value => ({value}), error => ({error}));
    h.renderSharedFrame(a.frame()); const idleOutcome = h.whenIdle().then(() => ({}), error => ({error}));
    clock.advance(31001);
    assert.ok(code('SYNC_TIMEOUT')((await ticketOutcome).error));
    assert.ok(code('SYNC_TIMEOUT')((await idleOutcome).error));
    assert.equal(f.events.filter(row => row[0] === 'getBufferSubData').length, 0);
    assert.equal(h.getStatus().pendingFrames, 0);
  } finally { clock.restore(); f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));

test('GL G15 UNIT crossing the sync deadline during extraction rejects before readback publication', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true});
  const clock = glDeadlineClock(1000);
  try {
    await h.start(); const ticket = h.requestReadback(), ticketOutcome = ticket.then(value => ({value}), error => ({error}));
    h.renderSharedFrame(a.frame()); const idleOutcome = h.whenIdle().then(() => ({}), error => ({error}));
    let extracted = false;
    f.onCall = name => { if (name === 'getBufferSubData') { extracted = true; clock.advance(31001); } };
    assert.ok(code('SYNC_TIMEOUT')((await ticketOutcome).error));
    assert.ok(code('SYNC_TIMEOUT')((await idleOutcome).error));
    assert.equal(extracted, true, 'exercise the later publication checkpoint');
    assert.equal(f.events.filter(row => row[0] === 'getBufferSubData').length, 1);
    assert.equal(h.getStatus().pendingFrames, 0);
  } finally { clock.restore(); f.onCall = undefined; f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));

test('GL G16 retirement cleanup preserves its exact cause, fails closed and keeps the unknown owner charged', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), diagnostics = [], h = createSharedWebGL2Host({canvas:f.canvas,onDiagnostic:event => diagnostics.push(event)});
  const cause = Object.freeze({cleanupFault:'deleteSync'});
  try {
    await h.start(); f.autoSignal = false; h.renderSharedFrame(a.frame());
    const idleOutcome = h.whenIdle().then(() => ({}), error => ({error}));
    f.fail = {name:'deleteSync',cause}; f.signalAll();
    const outcome = await idleOutcome;
    assert.ok(code('CLOSE_UNSAFE')(outcome.error)); assert.equal(outcome.error.cause, cause);
    await until(() => diagnostics.length > 0, 'original cleanup failure diagnostic');
    assert.equal(h.getStatus().state, 'failed');
    assert.equal(h.getStatus().firstFailure.cause, cause);
    assert.equal(h.getStatus().firstFailure.phase, 'cleanup');
    assert.ok(diagnostics.some(event => event.cause === cause && event.phase === 'cleanup'));
    const serial = h.getStatus().lastSerial;
    assert.throws(() => h.renderSharedFrame(a.frame()), code('FAILED'));
    assert.equal(h.getStatus().lastSerial, serial);
    assert.equal(h.getSharedStatus().retention.unknownNativeObjects, 1);
    await assert.rejects(h.close(), error => code('CLOSE_UNSAFE')(error) && error.cause === cause);
    assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
  } finally { f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));

test('GL G17 a throwing native create keeps its unpublished allocation charged and preserves the original cause', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), diagnostics = [], h = createSharedWebGL2Host({canvas:f.canvas,onDiagnostic:event => diagnostics.push(event)});
  const cause = Object.freeze({createFault:'createBuffer before handle publication'});
  try {
    await h.start(); const buffers = f.owners.filter(owner => owner.kind === 'Buffer').length;
    f.fail = {name:'createBuffer',cause};
    assert.throws(() => h.renderSharedFrame(a.frame()), error => code('RENDER_FAILED')(error) && error.cause === cause);
    assert.equal(f.owners.filter(owner => owner.kind === 'Buffer').length, buffers, 'the failing port did not publish a buffer identity');
    assert.equal(h.getStatus().lastSerial, 1, 'failure belongs to the accepted submission');
    await until(() => h.getStatus().pendingFrames === 0, 'partial submission still retires behind its completion proof');
    await until(() => diagnostics.some(event => event.cause === cause), 'original create failure diagnostic');
    assert.equal(h.getStatus().firstFailure.cause, cause);
    const retained = h.getSharedStatus().retention;
    assert.ok(retained.unknownNativeBytes > 0, 'no returned handle is not proof of no allocation');
    assert.equal(retained.unknownNativeObjects, 1);
    await assert.rejects(h.close(), error => code('CLOSE_UNSAFE')(error) && error.cause === cause);
    assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
    assert.equal(h.getSharedStatus().retention.unknownNativeBytes, retained.unknownNativeBytes);
    assert.equal(h.getSharedStatus().retention.unknownNativeObjects, 1);
  } finally { f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));


test('GL G18 a close detachment throw preserves its cause while completing independent owner and listener cleanup', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas});
  const cause = Object.freeze({closeFault:'bindVertexArray detachment'});
  try {
    await h.start(); h.renderSharedFrame(a.frame()); await h.whenIdle();
    f.fail = {name:'bindVertexArray',cause};
    const closing = h.close();
    await assert.rejects(closing, error => code('CLOSE_UNSAFE')(error) && error.cause === cause);
    assert.equal(h.close(), closing, 'the original terminal outcome remains stable');
    assert.equal(h.getStatus().state, 'closed'); assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
    assert.equal(f.live().length, 0, 'a detach failure cannot skip independent known-owner deletion');
    assert.equal(f.listenerCount(), 0, 'listeners are removed even after a previous close step failed');
    const retained = h.getSharedStatus().retention;
    assert.equal(retained.unknownNativeObjects, 0); assert.equal(retained.unknownBytes, 0);
    const before = f.events.length; f.restore(); assert.equal(f.events.length, before);
  } finally { f.fail = undefined; f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));

test('GL G19 a failed partial restore cannot bind stale fixed handles during new-generation cleanup', { timeout: 1000 }, async () => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas});
  const cause = Object.freeze({restoreFault:'compileShader before new VAO publication'}), stale = [];
  f.onCall = (name, args) => {
    const value = name === 'bindFramebuffer' ? args[1] : name === 'bindVertexArray' || name === 'useProgram' ? args[0] : undefined;
    if (value && value.generation !== h.getStatus().generation) {
      stale.push([name,value.kind,value.generation]);
      // The owned port models the native invalid-object refusal. It does not
      // fabricate a successful bind of an object invalidated by actual loss.
      f.errors.push(f.gl.INVALID_OPERATION);
    }
  };
  try {
    await h.start(); f.lose(); const ready = h.whenReady();
    const rejection = assert.rejects(ready, error => code('RESTORE_FAILED')(error) && error.cause === cause);
    f.fail = {name:'compileShader',cause}; f.restore(); await rejection;
    assert.equal(h.getStatus().generation, 2); assert.equal(h.getStatus().state, 'failed');
    await h.close();
    assert.deepEqual(stale, [], 'fixed native fields belong only to the attempted generation');
    assert.equal(f.live().length, 0); assert.equal(f.listenerCount(), 0);
    assert.equal(h.getStatus().cleanupOutcome, 'safe');
  } finally { f.onCall = undefined; f.fail = undefined; await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
});

test('GL G20 actual loss inside flush preserves confirmed invalidation through the completion-proof catch', { timeout: 1000 }, async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true});
  try {
    await h.start(); const frame = a.frame();
    const ticket = h.requestReadback(), ticketOutcome = ticket.then(value => ({value}), error => ({error}));
    let injected = false, idleOutcome;
    f.onCall = name => {
      if (!injected && name === 'flush') {
        injected = true; f.onCall = undefined;
        idleOutcome = h.whenIdle().then(() => ({}), error => ({error}));
        f.lose();
      }
    };
    assert.throws(() => h.renderSharedFrame(frame), code('CONTEXT_LOST'));
    assert.equal(injected, true);
    assert.ok(code('CONTEXT_LOST')((await ticketOutcome).error));
    assert.ok(code('CONTEXT_LOST')((await idleOutcome).error));
    assert.equal(h.getStatus().state, 'lost'); assert.equal(h.getStatus().pendingFrames, 0);
    const retained = h.getSharedStatus().retention;
    assert.equal(retained.unknownBytes, 0); assert.equal(retained.unknownEntries, 0);
    assert.equal(retained.unknownNativeBytes, 0); assert.equal(retained.unknownNativeObjects, 0);
    const ready = h.whenReady(); f.restore(); await ready;
    assert.equal(h.getStatus().state, 'active'); assert.equal(h.getStatus().generation, 2);
    h.renderSharedFrame(frame); await h.whenIdle(); await h.close();
    assert.equal(h.getStatus().cleanupOutcome, 'safe'); assert.equal(f.live().length, 0); assert.equal(f.listenerCount(), 0);
  } finally { f.onCall = undefined; f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
}));
