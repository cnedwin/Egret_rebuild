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
  'maxTupleComparisons','outputAlpha','restoreTimeoutMs','measureSharedFrames'];
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

// Break caught: end a batch at another page, bind every page to the first unit, or leave a page bound to a later unit.
test('GL G03 bitmaps of two pages in turn are one draw; each page has its own texture unit and none stays bound', async () => author(async a => {
  const sizes = [[4, 2], [2, 6]], pages = sizes.map(([width, height]) => egret.createImageData2D({width, height, pixels:new Uint8Array(4 * width * height).fill(255)}));
  const type = egret.createAssetType('gl-two-pages', egret.isTexture);
  a.engine.assets.register(type, { async load(ref) { return egret.createTextureView(pages[Number(ref.id)], {packed:{x:0,y:0,width:1,height:2},logicalWidth:1,logicalHeight:2,trimX:0,trimY:0,quarterTurn:0}); }, dispose(value) { value.dispose(); } });
  const leases = []; for (const id of ['0', '1']) leases.push(a.scope.use(await a.engine.assets.acquire(egret.createAssetRef(type, id), {signal:a.scope.signal})));
  a.sprite.visible = false;
  for (const [index, page] of [0, 1, 0, 1].entries()) { const node = a.scope.use(new egret.Bitmap(leases[page])); node.x = 2 * index; a.engine.stage.addChild(node); }
  const frame = a.frame();
  assert.equal(frame.pages.length, 2); assert.deepEqual(frame.commands.map(command => frame.regions[command.regionIndex].pageIndex), [0, 1, 0, 1]);
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas}); await h.start();
  // The program of a batch of several pages is linked at startup, after the others, and its eight page samplers name the eight units then.
  const programs = f.events.filter(row => row[0] === 'linkProgram').map(row => row[1]), paged = programs.at(-1);
  assert.ok(/uniform highp sampler2D page7;/.test(paged.shaders[1].source) && !/sampler2D page7/.test(programs[0].shaders[1].source));
  assert.deepEqual(f.events.filter(row => row[0] === 'uniform1i').map(row => [row[1].program === paged, row[1].name, row[2]]), Array.from({length:8}, (_value, unit) => [true, 'page' + unit, unit]));
  const before = f.events.length; h.renderSharedFrame(frame); await h.whenIdle();
  const events = f.events.slice(before), gl = f.gl;
  // One draw of the four bitmaps, by that program, then the resolve.
  assert.deepEqual(events.filter(row => row[0] === 'drawArrays').map(row => row.slice(1)), [[gl.TRIANGLES, 0, 24], [gl.TRIANGLES, 0, 3]]);
  const used = events.slice(0, events.findIndex(row => row[0] === 'drawArrays')).filter(row => row[0] === 'useProgram').at(-1);
  assert.equal(used[1], paged);
  // The block of the batch names page 0 for the first unit and page 1 for the second.
  const block = events.filter(row => row[0] === 'bufferSubData' && row[1] === gl.UNIFORM_BUFFER && !(row[3] instanceof Uint32Array));
  assert.equal(block.length, 1);
  const bytes = new Uint8Array(block[0][3].buffer, block[0][3].byteOffset, block[0][3].byteLength);
  assert.deepEqual([...new Uint32Array(bytes.slice(48, 80).buffer)], [0, 1, ...Array(6).fill(4294967295)]);
  // Both rows of the region table name their page and its size.
  const table = events.filter(row => row[0] === 'bufferSubData' && row[1] === gl.UNIFORM_BUFFER && row[3] instanceof Uint32Array);
  assert.deepEqual([...table[0][3]].filter((_value, index) => index % 12 >= 8), [0, 0, 4, 2, 0, 1, 2, 6]);
  // Between the start of the frame's draws and the draw itself: the second unit is selected once, given a
  // texture that is not the first unit's, and the first unit is selected again before the draw.
  const draw = events.findIndex(row => row[0] === 'drawArrays'), leading = events.slice(0, draw);
  const units = leading.filter(row => row[0] === 'activeTexture').map(row => row[1] - gl.TEXTURE0);
  assert.deepEqual(units.slice(-2), [1, 0]); assert.equal(units.filter(unit => unit > 1).length, 0);
  const selected = leading.map((row, index) => [row, index]).filter(([row]) => row[0] === 'activeTexture'), last = selected.at(-2)[1];
  const second = leading[last + 1]; assert.equal(second[0], 'bindTexture'); assert.equal(second[1], gl.TEXTURE_2D); assert.ok(second[2]);
  const first = leading.slice(0, last).filter(row => row[0] === 'bindTexture' && row[1] === gl.TEXTURE_2D && row[2]).at(-1);
  assert.notEqual(first[2], second[2]);
  // After the draw the second unit holds nothing, and the first unit is the selected one for the resolve.
  const trailing = events.slice(draw + 1), resolve = trailing.findIndex(row => row[0] === 'drawArrays');
  const after = trailing.slice(0, resolve).filter(row => row[0] === 'activeTexture' || row[0] === 'bindTexture');
  assert.deepEqual(after.slice(0, 3).map(row => row[0] === 'activeTexture' ? row[1] - gl.TEXTURE0 : row[2]), [1, null, 0]);
  await h.close(); assert.equal(f.live().length, 0);
}));

// Break caught: start on a context that cannot hold five attributes, a second uniform block for the region window, or the eight pages of a batch.
test('GL G02 a context one below any limit the batched layout needs is refused at startup; the least values start', async () => {
  const needed = { MAX_VERTEX_ATTRIBS:5, MAX_UNIFORM_BLOCK_SIZE:16368, MAX_UNIFORM_BUFFER_BINDINGS:2, MAX_VERTEX_UNIFORM_BLOCKS:2, MAX_TEXTURE_IMAGE_UNITS:8 };
  const least = glPorts({parameters:needed}), started = createSharedWebGL2Host({canvas:least.canvas});
  await started.start(); assert.equal(started.getStatus().state, 'active'); await started.close(); assert.equal(least.live().length, 0);
  for (const [name, value] of Object.entries(needed)) {
    const f = glPorts({parameters:{...needed, [name]:value - 1}}), h = createSharedWebGL2Host({canvas:f.canvas});
    await assert.rejects(h.start(), code('CONTEXT_LIMIT'), name);
    assert.equal(f.events.filter(row => row[0] === 'createProgram').length, 0, name);
    await h.close(); assert.equal(f.live().length, 0);
  }
});

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

// Break caught: keep the region or the opacity in the batch key, give a solid draw the region block, or bind a window per draw.
test('GL G03 draws of different regions and opacities of one page are one draw through one window of the region table', async () => author(async a => {
  for (const alignment of [16, 256]) {
    const page = egret.createImageData2D({width:4,height:2,pixels:new Uint8Array(32).fill(255)}), textures = [];
    const type = egret.createAssetType('gl-batch-' + alignment, egret.isTexture);
    a.engine.assets.register(type, { async load(ref) { const texture = egret.createTextureView(page, {packed:{x:Number(ref.id.split(':')[1]),y:0,width:1,height:2},logicalWidth:1,logicalHeight:2,trimX:0,trimY:0,quarterTurn:0}); textures.push(texture); return texture; }, dispose(value) { value.dispose(); } });
    const nodes = [], opacities = [1, .5, .25];
    for (const [index, x] of [0, 2, 0].entries()) {
      const lease = a.scope.use(await a.engine.assets.acquire(egret.createAssetRef(type, alignment + ':' + x), {signal:a.scope.signal}));
      const node = a.scope.use(new egret.Bitmap(lease)); node.x = 2 * index; node.alpha = opacities[index]; a.engine.stage.addChild(node); nodes.push(node);
    }
    // The fixture's rectangle is drawn first; move it behind the images and give it an opacity of its own.
    a.engine.stage.setChildIndex(a.sprite, 3); a.sprite.alpha = .75;
    const frame = a.frame();
    assert.deepEqual(frame.commands.map(command => command.kind), ['image', 'image', 'image', 'rect']); assert.equal(frame.regions.length, 2);
    const f = glPorts({alignment}), h = createSharedWebGL2Host({canvas:f.canvas}); await h.start();
    const programs = f.events.filter(row => row[0] === 'linkProgram').map(row => row[1]);
    // The sampled program declares the region window at binding point 1; the solid program does not declare it.
    const bindings = f.events.filter(row => row[0] === 'uniformBlockBinding').map(row => [programs.indexOf(row[1]), row[3]]);
    assert.deepEqual(bindings.slice(0, 3), [[0, 0], [0, 1], [1, 0]]);
    assert.ok(/uniform RegionWindow/.test(programs[0].shaders[0].source) && !/RegionWindow/.test(programs[1].shaders[0].source + programs[1].shaders[1].source));
    const before = f.events.length; h.renderSharedFrame(frame); await h.whenIdle();
    const events = f.events.slice(before), gl = f.gl;
    // Three images are one draw of eighteen vertices; the rectangle follows with the other program; then the resolve.
    assert.deepEqual(events.filter(row => row[0] === 'drawArrays').map(row => row.slice(1)), [[gl.TRIANGLES, 0, 18], [gl.TRIANGLES, 18, 6], [gl.TRIANGLES, 0, 3]]);
    const order = events.filter(row => row[0] === 'useProgram' || row[0] === 'drawArrays').map(row => row[0] === 'drawArrays' ? 'draw' : programs.indexOf(row[1]));
    assert.deepEqual(order.slice(0, order.indexOf('draw', order.indexOf('draw') + 1) + 1), [0, 'draw', 1, 'draw']);
    // Five float attributes of one 52-byte row.
    assert.deepEqual(events.filter(row => row[0] === 'vertexAttribPointer').slice(0, 5).map(row => [row[1], row[2], row[5], row[6]]), [[0, 2, 52, 0], [1, 2, 52, 8], [2, 4, 52, 16], [3, 3, 52, 32], [4, 2, 52, 44]]);
    // Each batch is written to its own range of the vertex arena: eighteen rows at 0, six at 18 * 52.
    const written = events.filter(row => row[0] === 'bufferSubData' && row[1] === gl.ARRAY_BUFFER);
    assert.deepEqual(written.map(row => [row[2], row[3].length]), [[0, 18 * 13], [18 * 52, 6 * 13]]);
    const rows = written.flatMap(row => [...row[3]]);
    assert.deepEqual(Array.from({length:24}, (_value, vertex) => [rows[13 * vertex + 11], rows[13 * vertex + 12]]),
      [...[0, 1, 2].flatMap(index => Array(6).fill([index === 1 ? 1 : 0, opacities[index]])), ...Array(6).fill([0, .75])]);
    // The region table is one uniform buffer of one whole window; only the two regions' rows are written.
    assert.deepEqual(events.filter(row => row[0] === 'bufferData' && row[1] === gl.UNIFORM_BUFFER).map(row => row[2]).sort((x, y) => x - y), [2 * Math.ceil(128 / alignment) * alignment, 16368]);
    const table = events.filter(row => row[0] === 'bufferSubData' && row[1] === gl.UNIFORM_BUFFER && row[3] instanceof Uint32Array);
    assert.deepEqual(table.map(row => [row[2], [...row[3]]]), [[0, [1, 2, 0, 0, 1, 2, 0, 0, 0, 0, 4, 2, 1, 2, 0, 0, 1, 2, 2, 0, 0, 0, 4, 2]]]);
    // A batch of one page is drawn by the program of one page sampler, on the first unit; no other unit is selected.
    assert.deepEqual(events.filter(row => row[0] === 'uniform1i' && /^page/.test(row[1].name)).map(row => [programs.indexOf(row[1].program), row[1].name, row[2]]), [[0, 'page', 0]]);
    assert.deepEqual(events.filter(row => row[0] === 'activeTexture').map(row => row[1] - gl.TEXTURE0).filter(unit => unit !== 0), []);
    // The window is bound once, at binding point 1, in full.
    assert.deepEqual(events.filter(row => row[0] === 'bindBufferRange' && row[2] === 1 && row[3] !== null).map(row => [row[4], row[5]]), [[0, 16368]]);
    assert.deepEqual(events.filter(row => row[0] === 'bindBufferRange' && row[2] === 0 && row[3] !== null).map(row => row[5]), [128, 128]);
    // A frame of the rectangle alone leases and binds no region table.
    for (const node of nodes) node.visible = false;
    const solid = f.events.length; h.renderSharedFrame(a.frame()); await h.whenIdle();
    const after = f.events.slice(solid);
    assert.deepEqual(after.filter(row => row[0] === 'drawArrays').map(row => row.slice(1)), [[gl.TRIANGLES, 0, 6], [gl.TRIANGLES, 0, 3]]);
    assert.equal(after.filter(row => row[0] === 'bindBufferRange' && row[2] === 1 && row[3] !== null).length, 0);
    assert.equal(after.filter(row => row[0] === 'bufferSubData' && row[3] instanceof Uint32Array).length, 0);
    await h.close(); assert.equal(f.live().length, 0);
    for (const node of nodes) node.dispose();
  }
}));

test('GL G03 contained clips preserve packed attributes and exact tuple admission', async () => author(async a => {
  const unclipped = a.frame();
  a.sprite.clipRect = {x:0,y:0,width:6,height:6};
  const contained = a.frame();
  assert.equal(contained.commands.find(command => command.kind === 'rect')?.clips.length, 1);
  // Four distinct corners cost ten XY comparisons per normalization.
  // One explicit clip and the viewport each normalize four more times.
  const tupleLimit = 90;
  for (const maxTupleComparisons of [tupleLimit - 1, tupleLimit]) {
    const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,maxTupleComparisons});
    try {
      await h.start();
      const draw = async frame => {
        const before = f.events.length;
        h.renderSharedFrame(frame);
        await h.whenIdle();
        return f.events.slice(before).filter(row => row[0] === 'bufferSubData' && row[1] === f.gl.ARRAY_BUFFER).map(row => row[3]);
      };
      const expected = await draw(unclipped);
      assert.equal(expected.length, 1);
      assert.equal(expected[0].length, 6 * 13);
      if (maxTupleComparisons === tupleLimit) {
        assert.deepEqual(await draw(contained), expected);
      } else {
        const before = f.events.length;
        assert.throws(() => h.renderSharedFrame(contained), code('GEOMETRY_RANGE'));
        assert.equal(f.events.length, before);
        assert.equal(h.getStatus().lastSerial, 1);
      }
    } finally { await h.close(); }
  }
}));


test('GL attachment validation follows owned targets and resets after context restoration', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas});
  const draw = async (frame) => {
    const before = f.events.length;
    h.renderSharedFrame(frame);
    await h.whenIdle();
    const events = f.events.slice(before);
    const color = events.find(row => row[0] === 'framebufferTexture2D' && row[4] !== null)?.[4];
    const queries = events.filter(row => row[0] === 'getFramebufferAttachmentParameter');
    return {
      color,
      working:queries.filter(row => row[2] === f.gl.COLOR_ATTACHMENT0).length,
      default:queries.filter(row => row[2] === f.gl.BACK).length,
      status:events.filter(row => row[0] === 'checkFramebufferStatus').length,
    };
  };
  try {
    await h.start();
    const frame = a.frame(), resized = a.engine.captureSharedFrame({width:12,height:8});
    const first = await draw(frame);
    assert.ok(first.color);
    assert.deepEqual(first, {color:first.color,working:6,default:6,status:1});
    assert.deepEqual(await draw(frame), {color:first.color,working:0,default:6,status:0});
    const larger = await draw(resized);
    assert.notEqual(larger.color, first.color);
    assert.deepEqual(larger, {color:larger.color,working:6,default:6,status:1});
    assert.deepEqual(await draw(frame), {color:first.color,working:0,default:6,status:0});
    f.lose();
    const ready = h.whenReady();
    f.restore();
    await ready;
    const restored = await draw(frame);
    assert.notEqual(restored.color, first.color);
    assert.deepEqual(restored, {color:restored.color,working:6,default:6,status:1});
  } finally { await h.close(); }
}));

// The Host that drew a scene with a depth buffer is removed, so every working target here has none; the
// qualification by depth buffer that the native session still holds is not reached from this entry.
test('GL working validation is made once for a target and a warm bind error still refuses the frame', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,outputAlpha:'opaque'});
  const frame = a.engine.captureSharedFrame({width:8,height:8,outputAlpha:'opaque',clearAlpha:1});
  const draw = async () => {
    const before = f.events.length;
    h.renderSharedFrame(frame);
    await h.whenIdle();
    const events = f.events.slice(before);
    return {
      color:events.find(row => row[0] === 'framebufferTexture2D' && row[4] !== null)?.[4],
      depth:events.find(row => row[0] === 'framebufferRenderbuffer')?.[4],
      status:events.filter(row => row[0] === 'checkFramebufferStatus').length,
    };
  };
  try {
    await h.start();
    const plain = await draw();
    assert.ok(plain.color);
    assert.deepEqual(plain, {color:plain.color,depth:null,status:1});
    assert.deepEqual(await draw(), {...plain,status:0});

    // An error raised by rebinding a cached attachment must still fail the frame.
    f.onCall = (name, args) => {
      if (name === 'framebufferTexture2D' && args[3] === plain.color) f.errors.push(1285);
    };
    const before = f.events.length;
    assert.throws(() => h.renderSharedFrame(frame), code('OUT_OF_MEMORY'));
    assert.equal(f.events.slice(before).some(row => row[0] === 'drawArrays'), false);
  } finally { f.onCall = undefined; await h.close(); }
}));


test('GL effect target switches qualify each distinct target once and refuse an incomplete new target', async () => author(async a => {
  const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableEffects:true});
  const checkFramebufferStatus = f.gl.checkFramebufferStatus;
  let complete = true;
  f.gl.checkFramebufferStatus = () => {
    checkFramebufferStatus();
    return complete ? f.gl.FRAMEBUFFER_COMPLETE : 36054; // FRAMEBUFFER_INCOMPLETE_ATTACHMENT
  };
  const draw = async (frame) => {
    const before = f.events.length;
    h.renderSharedFrame(frame);
    await h.whenIdle();
    return f.events.slice(before);
  };
  try {
    a.sprite.renderEffect = {blurRadius:1};
    await h.start();
    const frame = a.frame();
    const first = await draw(frame);
    const targets = first.filter(row => row[0] === 'framebufferTexture2D' && row[4] !== null);
    assert.equal(new Set(targets.map(row => row[4])).size, 3);
    assert.equal(first.filter(row => row[0] === 'checkFramebufferStatus').length, 3);
    const warm = await draw(frame);
    assert.deepEqual(warm.filter(row => row[0] === 'framebufferTexture2D' && row[4] !== null), targets);
    assert.equal(warm.filter(row => row[0] === 'checkFramebufferStatus').length, 0);
    complete = false;
    const before = f.events.length;
    const resized = a.engine.captureSharedFrame({width:12,height:8});
    assert.throws(() => h.renderSharedFrame(resized), code('FORMAT_UNSUPPORTED'));
    assert.equal(f.events.slice(before).filter(row => row[0] === 'checkFramebufferStatus').length, 1);
    assert.equal(f.events.slice(before).some(row => row[0] === 'drawArrays'), false);
  } finally { await h.close(); }
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

test('GL G11 the Host detaches retained container references before completion and releases the current program at close', { timeout: 2000 }, async () => author(async a => {
  {
    const f = glPorts(), gl = f.gl, violations = [], vaos = new Map(), fbos = new Map();
    let vao = null, array = null, drawFBO = null, readFBO = null, currentProgram = null;
    let populatedAttributes = 0, fences = 0;
    const vertexState = key => { if (!vaos.has(key)) vaos.set(key, { attributes:new Map(), element:null }); return vaos.get(key); };
    const targetFBO = target => target === gl.READ_FRAMEBUFFER ? readFBO : drawFBO;
    const attachments = key => { if (!fbos.has(key)) fbos.set(key, new Map()); return fbos.get(key); };
    f.onCall = (name, args) => {
      if (name === 'bindVertexArray') vao = args[0];
      if (name === 'bindBuffer') {
        if (args[0] === gl.ARRAY_BUFFER) array = args[1];
        if (args[0] === gl.ELEMENT_ARRAY_BUFFER) vertexState(vao).element = args[1];
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
    const h = createSharedWebGL2Host({canvas:f.canvas}), submit = () => h.renderSharedFrame(a.frame());
    try {
      await h.start(); f.autoSignal = false; submit(); h.stop();
      const idle = h.whenIdle(); f.signalAll(); await idle; await h.close();
      assert.equal(fences, 1); assert.ok(populatedAttributes > 0);
      assert.deepEqual(violations, []);
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

test('GL completion and Sync deletion preserve separate numeric error attribution', {timeout: 1000}, async () => author(async a => {
  for (const [boundary, expectedCode, phase] of [
    ['clientWaitSync', 'VALIDATION', 'readback'],
    ['deleteSync', 'CLOSE_UNSAFE', 'cleanup'],
  ]) {
    const f = glPorts(), h = createSharedWebGL2Host({canvas:f.canvas,enableReadback:true});
    const cause = f.gl.INVALID_OPERATION;
    try {
      await h.start(); f.autoSignal = false;
      const ticket = h.requestReadback();
      const readback = assert.rejects(ticket, code(expectedCode));
      h.renderSharedFrame(a.frame());
      const idle = assert.rejects(h.whenIdle(), code(expectedCode));
      let injected = false;
      f.onCall = name => {
        if (injected || name !== boundary) return;
        injected = true;
        f.errors.push(cause);
      };
      f.signalAll();
      await Promise.all([idle, readback]);
      assert.equal(injected, true);
      const {firstFailure, state} = h.getStatus();
      assert.equal(state, 'failed');
      assert.equal(firstFailure.code, 'WEBGL2_' + expectedCode);
      assert.equal(firstFailure.phase, phase);
      assert.equal(firstFailure.serial, 1);
      assert.equal(boundary === 'deleteSync' ? firstFailure.cause : firstFailure.cause.cause, cause);
      const calls = f.events.map(row => row[0]), {retention} = h.getSharedStatus();
      if (boundary === 'clientWaitSync') {
        assert.equal(calls.includes('getBufferSubData'), false);
        assert.equal(calls.includes('deleteSync'), false);
        assert.equal(retention.unknownNativeObjects, 2, 'completion failure retains the Sync and PBO');
        assert.ok(retention.unknownEntries > 0, 'completion failure retains draw resources');
      } else {
        assert.ok(calls.indexOf('getBufferSubData') < calls.indexOf('deleteSync'));
        assert.equal(calls.filter(name => name === 'deleteSync').length, 1);
        assert.equal(retention.unknownNativeObjects, 1, 'failed deletion retains only the original Sync');
        assert.equal(retention.unknownEntries, 0);
      }
      await assert.rejects(h.close(), code('CLOSE_UNSAFE'));
    } finally { f.onCall = undefined; f.signalAll(); await h.close().catch(error => assert.ok(code('CLOSE_UNSAFE')(error))); }
  }
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
