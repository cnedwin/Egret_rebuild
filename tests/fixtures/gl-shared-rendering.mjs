// SPDX-License-Identifier: Apache-2.0
// Controlled WebGL2 ports model ownership and commands, never rasterization.
import assert from 'node:assert/strict';
export * as egret from '@egret/engine';
export const delay = () => new Promise(resolve => setTimeout(resolve, 2));
export async function until(test, message = 'controlled completion') {
  for (let i = 0; i < 100; i++) { if (test()) return; await delay(); }
  assert.fail(message);
}
const constants = {
  NO_ERROR:0, INVALID_ENUM:1280, INVALID_VALUE:1281, INVALID_OPERATION:1282, OUT_OF_MEMORY:1285, CONTEXT_LOST_WEBGL:37442,
  ARRAY_BUFFER:34962, ELEMENT_ARRAY_BUFFER:34963, UNIFORM_BUFFER:35345, PIXEL_PACK_BUFFER:35051, PIXEL_UNPACK_BUFFER:35052,
  DYNAMIC_DRAW:35048, STREAM_DRAW:35040, STREAM_READ:35041, STATIC_DRAW:35044,
  TEXTURE_2D:3553, TEXTURE0:33984, TEXTURE_MIN_FILTER:10241, TEXTURE_MAG_FILTER:10240,
  TEXTURE_WRAP_S:10242, TEXTURE_WRAP_T:10243, TEXTURE_BASE_LEVEL:33084, TEXTURE_MAX_LEVEL:33085,
  NEAREST:9728, LINEAR:9729, CLAMP_TO_EDGE:33071, RGBA:6408, RGBA8:32856, SRGB8_ALPHA8:35907,
  SRGB:35904, UNSIGNED_NORMALIZED:35863, UNSIGNED_BYTE:5121, UNSIGNED_INT:5125, FLOAT:5126,
  FRAMEBUFFER:36160, DRAW_FRAMEBUFFER:36009, READ_FRAMEBUFFER:36008, RENDERBUFFER:36161,
  FRAMEBUFFER_COMPLETE:36053, COLOR_ATTACHMENT0:36064, DEPTH_ATTACHMENT:36096, BACK:1029,
  FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING:33296, FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE:33297,
  FRAMEBUFFER_ATTACHMENT_RED_SIZE:33298, FRAMEBUFFER_ATTACHMENT_GREEN_SIZE:33299,
  FRAMEBUFFER_ATTACHMENT_BLUE_SIZE:33300, FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE:33301,
  DEPTH_COMPONENT32F:36012, DEPTH_COMPONENT:6402, COLOR_BUFFER_BIT:16384, DEPTH_BUFFER_BIT:256,
  VERTEX_SHADER:35633, FRAGMENT_SHADER:35632, COMPILE_STATUS:35713, LINK_STATUS:35714, HIGH_FLOAT:36338,
  MAX_TEXTURE_SIZE:3379, MAX_RENDERBUFFER_SIZE:34024, MAX_VIEWPORT_DIMS:3386, MAX_VERTEX_ATTRIBS:34921,
  MAX_UNIFORM_BLOCK_SIZE:35376, UNIFORM_BUFFER_OFFSET_ALIGNMENT:35380, MAX_UNIFORM_BUFFER_BINDINGS:35375,
  MAX_VERTEX_UNIFORM_BLOCKS:35371, MAX_FRAGMENT_UNIFORM_BLOCKS:35373, MAX_COMBINED_TEXTURE_IMAGE_UNITS:35661,
  MAX_TEXTURE_IMAGE_UNITS:34930, UNIFORM_BLOCK_DATA_SIZE:35392, UNIFORM_OFFSET:35387, INVALID_INDEX:4294967295,
  PACK_ALIGNMENT:3333, PACK_ROW_LENGTH:3330, PACK_SKIP_ROWS:3331, PACK_SKIP_PIXELS:3332,
  UNPACK_ALIGNMENT:3317, UNPACK_ROW_LENGTH:3314, UNPACK_SKIP_ROWS:3315, UNPACK_SKIP_PIXELS:3316,
  UNPACK_IMAGE_HEIGHT:32878, UNPACK_SKIP_IMAGES:32877, UNPACK_FLIP_Y_WEBGL:37440,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL:37441, UNPACK_COLORSPACE_CONVERSION_WEBGL:37443, NONE:0,
  BLEND:3042, DEPTH_TEST:2929, STENCIL_TEST:2960, SCISSOR_TEST:3089, CULL_FACE:2884, DITHER:3024,
  RASTERIZER_DISCARD:35977, SAMPLE_ALPHA_TO_COVERAGE:32926, SAMPLE_COVERAGE:32928, POLYGON_OFFSET_FILL:32823,
  FUNC_ADD:32774, ONE:1, ZERO:0, ONE_MINUS_SRC_ALPHA:771, ONE_MINUS_SRC_COLOR:769, DST_COLOR:774,
  GREATER:516, TRIANGLES:4, SYNC_GPU_COMMANDS_COMPLETE:37143, ALREADY_SIGNALED:37146,
  TIMEOUT_EXPIRED:37147, CONDITION_SATISFIED:37148, WAIT_FAILED:37149,
};
export function glPorts({ alignment = 256, colorEncoding = constants.LINEAR, attributes = {} } = {}) {
  const events = [], owners = [], errors = [], listeners = new Map(), buffers = new Map();
  let ordinal = 0, generation = 1, lost = false, framebuffer = null, program = null, readOrdinal = 0;
  const options = { alpha:true, premultipliedAlpha:true, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false };
  const f = { events, owners, errors, fail:undefined, onCall:undefined, nextPixels:undefined, autoSignal:true };
  const log = (name, ...args) => {
    events.push([name, ...args]); f.onCall?.(name, args);
    if (f.fail?.name === name) { const cause = f.fail.cause; f.fail = undefined; throw cause; }
  };
  const canvas = { width:8, height:8,
    getContext(kind, attrs) { assert.equal(this, canvas); log('getContext', kind, attrs); return kind === 'webgl2' ? gl : null; },
    addEventListener(type, listener) { log('addEventListener', type); let set = listeners.get(type); if (!set) listeners.set(type, set = new Set()); set.add(listener); },
    removeEventListener(type, listener) { log('removeEventListener', type); listeners.get(type)?.delete(listener); },
  };
  const gl = { ...constants, canvas, drawingBufferColorSpace:'srgb',
    get drawingBufferWidth() { return canvas.width; }, get drawingBufferHeight() { return canvas.height; },
    getContextAttributes() { log('getContextAttributes'); return { ...options, ...attributes }; },
    getError() { log('getError'); return errors.shift() ?? 0; },
    isContextLost() { return lost; },
    getParameter(key) {
      log('getParameter', key);
      const values = new Map([[gl.MAX_TEXTURE_SIZE,8192],[gl.MAX_RENDERBUFFER_SIZE,8192],[gl.MAX_VIEWPORT_DIMS,new Int32Array([8192,8192])],
        [gl.MAX_UNIFORM_BLOCK_SIZE,16384],[gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT,alignment],[gl.MAX_UNIFORM_BUFFER_BINDINGS,24],
        [gl.MAX_VERTEX_UNIFORM_BLOCKS,12],[gl.MAX_FRAGMENT_UNIFORM_BLOCKS,12],[gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,32],
        [gl.MAX_TEXTURE_IMAGE_UNITS,16],[gl.MAX_VERTEX_ATTRIBS,16]]);
      assert.ok(values.has(key), 'explicit native capability: ' + key); return values.get(key);
    },
    getShaderPrecisionFormat() { log('getShaderPrecisionFormat'); return { rangeMin:127, rangeMax:127, precision:23 }; },
    getFramebufferAttachmentParameter(_target, _attachment, key) {
      log('getFramebufferAttachmentParameter', _target, _attachment, key);
      return key === gl.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING ? framebuffer ? gl.SRGB : colorEncoding
        : key === gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE ? gl.UNSIGNED_NORMALIZED : 8;
    },
    checkFramebufferStatus() { log('checkFramebufferStatus'); return gl.FRAMEBUFFER_COMPLETE; },
    bindFramebuffer(target, value) { log('bindFramebuffer', target, value); framebuffer = value; },
    bindBuffer(target, value) { log('bindBuffer', target, value); buffers.set(target, value); },
    bufferData(target, size, usage) { log('bufferData', target, size, usage); const b = buffers.get(target); assert.ok(b); b.bytes = new Uint8Array(size); },
    bufferSubData(target, offset, value) { log('bufferSubData', target, offset, value.slice()); const b = buffers.get(target); assert.ok(b); b.bytes.set(new Uint8Array(value.buffer,value.byteOffset,value.byteLength), offset); },
    getBufferSubData(target, offset, value) { log('getBufferSubData', target, offset, value.byteLength); const b = buffers.get(target); assert.ok(b); value.set(b.bytes.subarray(offset,offset+value.byteLength)); },
    readPixels(x, y, width, height, format, type, output) {
      log('readPixels', x, y, width, height, format, type, output); const bytes = f.nextPixels?.slice() ?? new Uint8Array(width*height*4).fill(++readOrdinal);
      if (typeof output === 'number') { const b = buffers.get(gl.PIXEL_PACK_BUFFER); assert.ok(b); b.bytes.set(bytes, output); }
      else output.set(bytes);
    },
    shaderSource(shader, source) { log('shaderSource', shader, source); shader.source = source; },
    attachShader(p, shader) { log('attachShader', p, shader); (p.shaders ??= []).push(shader); },
    getShaderParameter(shader, pname) { log('getShaderParameter', shader, pname); return true; },
    getProgramParameter(p, pname) { log('getProgramParameter', p, pname); return true; },
    getShaderInfoLog() { return ''; }, getProgramInfoLog() { return ''; },
    getUniformBlockIndex(p, name) { log('getUniformBlockIndex', p, name); return 0; },
    getActiveUniformBlockParameter(p, _index, pname) { log('getActiveUniformBlockParameter', p, pname); return p.shaders?.some(s => /mat4/.test(s.source)) ? 64 : 128; },
    getUniformIndices(p, names) { log('getUniformIndices', p, names); return names.map((_n, i) => i); },
    getActiveUniforms(p, indices, pname) { log('getActiveUniforms', p, indices, pname); return indices.map(i => pname === 35389 ? 16 : pname === 35390 ? false : 16*i); },
    getUniformLocation(p, name) { log('getUniformLocation', p, name); return { program:p, name }; },
    useProgram(p) { log('useProgram', p); program = p; },
    fenceSync(condition, flags) { log('fenceSync', condition, flags); const sync = own('Sync'); sync.signaled = f.autoSignal; return sync; },
    clientWaitSync(sync, flags, timeout) { log('clientWaitSync', sync, flags, timeout); assert.equal(timeout, 0); return sync.signaled ? gl.CONDITION_SATISFIED : gl.TIMEOUT_EXPIRED; },
  };
  const own = kind => { const object = { kind, id:++ordinal, generation, deleted:false }; owners.push(object); return object; };
  for (const kind of ['Buffer','Texture','Framebuffer','Renderbuffer','Shader','Program','VertexArray']) {
    gl['create'+kind] = (...args) => { log('create'+kind, ...args); return own(kind); };
    gl['is'+kind] = object => !!object && object.kind === kind && !object.deleted && !lost && object.generation === generation;
  }
  for (const kind of ['Buffer','Texture','Framebuffer','Renderbuffer','Shader','Program','VertexArray','Sync'])
    gl['delete'+kind] = object => { log('delete'+kind, object); if (object) { assert.equal(object.deleted, false, 'one cleanup attempt per native allocation'); object.deleted = true; } };
  for (const name of ['activeTexture','bindTexture','bindRenderbuffer','bindVertexArray','bindSampler','bindBufferRange',
    'enable','disable','colorMask','depthMask','depthFunc','clearDepth','depthRange','clearColor','clear','viewport','scissor',
    'blendEquation','blendEquationSeparate','blendFuncSeparate','pixelStorei','texParameteri','texImage2D','texStorage2D','texSubImage2D',
    'renderbufferStorage','framebufferTexture2D','framebufferRenderbuffer','drawBuffers','readBuffer',
    'compileShader','linkProgram','detachShader','uniformBlockBinding','uniform1i','uniform1f','uniform2f',
    'enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','drawArrays','drawElements','flush'])
    gl[name] = (...args) => log(name, ...args);
  const emit = type => {
    const event = { type, defaultPrevented:false, preventDefault() { this.defaultPrevented = true; } };
    for (const listener of [...listeners.get(type) ?? []]) listener.call(canvas, event);
    return event;
  };
  return Object.assign(f, { gl, canvas, options,
    signalAll() { for (const object of owners) if (object.kind === 'Sync') object.signaled = true; },
    lose(expectPrevented = true) { lost = true; const event = emit('webglcontextlost'); if (expectPrevented) assert.equal(event.defaultPrevented, true); return event; },
    restore() { generation++; lost = false; buffers.clear(); framebuffer = null; program = null; return emit('webglcontextrestored'); },
    syntheticLoss() { return emit('webglcontextlost'); },
    live() { return owners.filter(o => !o.deleted && o.generation === generation && !lost); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  });
}
