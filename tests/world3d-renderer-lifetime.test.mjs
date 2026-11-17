// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InstancedMesh3D,
  Mesh3D,
  Object3D,
  PlanarReflection3D,
  RenderTarget3D,
  Scene3D,
  World3DError,
  createBoxGeometry3D,
  createCustomShader3D,
  createDirectionalLight3D,
  createPerspectiveCamera3D,
  createStandardMaterial3D
} from '@egret/engine/world3d';
import { createWebGL2Renderer3D } from '@egret/engine/webgl2/world3d';
import { createWebGPURenderer3D } from '@egret/engine/webgpu/world3d';

const code = expected => error => error instanceof World3DError && error.code === expected;

function webGLFixture() {
  const canvas = new EventTarget();
  let allocations = 0,
    lost = false;
  const gl = {
    MAX_TEXTURE_SIZE: 0x0d33,
    ACTIVE_TEXTURE: 0x84e0,
    TEXTURE0: 0x84c0,
    TEXTURE_BINDING_2D: 0x8069,
    RENDERBUFFER_BINDING: 0x8ca7,
    TEXTURE_2D: 0x0de1,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    DRAW_FRAMEBUFFER: 0x8ca9,
    DRAW_FRAMEBUFFER_BINDING: 0x8ca6,
    READ_FRAMEBUFFER: 0x8ca8,
    READ_FRAMEBUFFER_BINDING: 0x8caa,
    getParameter: parameter => (parameter === gl.MAX_TEXTURE_SIZE ? 64 : state.get(parameter)),
    getExtension: () => null,
    isContextLost: () => lost,
    createFramebuffer() {
      allocations++;
      return {};
    },
    createTexture: () => ({}),
    createRenderbuffer: () => ({}),
    activeTexture(unit) {
      state.set(gl.ACTIVE_TEXTURE, unit);
    },
    bindTexture(_target, texture) {
      state.set(gl.TEXTURE_BINDING_2D, texture);
    },
    bindRenderbuffer(_target, buffer) {
      state.set(gl.RENDERBUFFER_BINDING, buffer);
    },
    bindFramebuffer(target, buffer) {
      if (target !== gl.READ_FRAMEBUFFER) state.set(gl.DRAW_FRAMEBUFFER_BINDING, buffer);
      if (target !== gl.DRAW_FRAMEBUFFER) state.set(gl.READ_FRAMEBUFFER_BINDING, buffer);
    },
    texImage2D() {},
    texParameteri() {},
    framebufferTexture2D() {},
    renderbufferStorage() {},
    framebufferRenderbuffer() {},
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
    readPixels() {},
    deleteFramebuffer() {},
    deleteTexture() {},
    deleteRenderbuffer() {}
  };
  const state = new Map([
    [gl.ACTIVE_TEXTURE, gl.TEXTURE0],
    [gl.TEXTURE_BINDING_2D, null],
    [gl.RENDERBUFFER_BINDING, null],
    [gl.DRAW_FRAMEBUFFER_BINDING, null],
    [gl.READ_FRAMEBUFFER_BINDING, null]
  ]);
  canvas.getContext = () => gl;
  return {
    canvas,
    gl,
    allocations: () => allocations,
    lose() {
      lost = true;
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    },
    restore() {
      lost = false;
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    }
  };
}

test('WebGL2 refreshes changed inactive instance data when the active count grows', () => {
  const { renderer, gl, mesh: template } = shaderPreparationFixture({ parallel: false });
  const scene = new Scene3D();
  const camera = createPerspectiveCamera3D({ fov: 45, aspect: 1 });
  camera.setPosition(0, 0, 6).lookAt(0, 0, 0);
  scene.addChild(camera);
  const mesh = new InstancedMesh3D(template.geometry, template.material, 2, 4);
  scene.addChild(mesh);
  mesh.setTransformAt(1, [1, 0, 0]);
  mesh.setColorAt(1, 1, 0, 0);

  const uploads = [];
  const drawnCounts = [];
  gl.vertexAttribDivisor = () => {};
  gl.drawElementsInstanced = (_mode, _length, _type, _offset, count) => drawnCounts.push(count);
  gl.bufferSubData = (_target, _offset, data, start, length) => {
    if (data === mesh.instanceMatrices || data === mesh.instanceColors)
      uploads.push(Array.from(data.subarray(start, start + length)));
  };

  try {
    assert.equal(renderer.render(scene, camera), true);
    assert.deepEqual(drawnCounts, [2]);

    mesh.count = 1;
    mesh.setTransformAt(1, [2, 0, 0]);
    mesh.setColorAt(1, 0, 1, 0, 0.5);
    assert.equal(renderer.render(scene, camera), true);
    assert.deepEqual(
      uploads.splice(0).map(data => data.length),
      [16, 4]
    );

    mesh.count = 2;
    assert.equal(renderer.render(scene, camera), true);
    assert.deepEqual(
      uploads.map(data => data.length),
      [32, 8]
    );
    assert.equal(uploads[0][16 + 12], 2);
    assert.deepEqual(uploads[1].slice(4), [0, 1, 0, 0.5]);
    uploads.length = 0;

    mesh.count = 1;
    assert.equal(renderer.render(scene, camera), true);
    mesh.count = 2;
    assert.equal(renderer.render(scene, camera), true);
    assert.deepEqual(drawnCounts, [2, 1, 2, 1, 2]);
    assert.deepEqual(uploads, []);
  } finally {
    renderer.dispose();
  }
});

function shaderPreparationFixture({ parallel = true } = {}) {
  const fixture = webGLFixture();
  const { canvas, gl } = fixture;
  const extension = { COMPLETION_STATUS_KHR: 0x91b1 };
  const sources = new WeakMap();
  const programActions = [],
    linked = [],
    checked = [],
    inspected = [],
    deletedPrograms = [],
    deletedShaders = [];
  const firstPoll = Promise.withResolvers();
  const previousProgram = {};
  let currentProgram = previousProgram,
    complete = false,
    successful = true,
    draws = 0,
    buffers = 0;
  const getParameter = gl.getParameter;
  Object.assign(gl, {
    ACTIVE_UNIFORMS: 0x8b86,
    CURRENT_PROGRAM: 0x8b8d,
    LINK_STATUS: 0x8b82,
    INVALID_INDEX: 0xffffffff,
    TRIANGLES: 0x0004,
    DEPTH_COMPONENT24: 0x81a6,
    DEPTH_ATTACHMENT: 0x8d00,
    drawingBufferWidth: 16,
    drawingBufferHeight: 16,
    getExtension(name) {
      if (!parallel || name !== 'KHR_parallel_shader_compile') return null;
      programActions.push('enable-extension');
      return extension;
    },
    getParameter: parameter => (parameter === gl.CURRENT_PROGRAM ? currentProgram : getParameter(parameter)),
    createBuffer() {
      buffers++;
      return {};
    },
    createVertexArray: () => ({}),
    createShader: () => ({}),
    createProgram: () => ({}),
    shaderSource(shader, source) {
      sources.set(shader, source);
    },
    attachShader(program, shader) {
      (program.shaders ??= []).push(shader);
    },
    linkProgram(program) {
      programActions.push('link');
      linked.push(program);
    },
    getProgramParameter(program, parameter) {
      if (parameter === extension.COMPLETION_STATUS_KHR) {
        firstPoll.resolve();
        return complete || gl.isContextLost();
      }
      if (parameter === gl.LINK_STATUS) {
        checked.push(program);
        return successful;
      }
      assert.equal(parameter, gl.ACTIVE_UNIFORMS);
      inspected.push(program);
      return 1;
    },
    getActiveUniform: () => ({ name: 'uMap' }),
    getUniformLocation: () => ({}),
    getUniformBlockIndex: () => gl.INVALID_INDEX,
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => 'test link failure',
    useProgram(program) {
      currentProgram = program;
    },
    uniform1i() {},
    deleteProgram(program) {
      deletedPrograms.push(program);
    },
    deleteShader(shader) {
      deletedShaders.push(shader);
    },
    drawArrays() {
      draws++;
    },
    drawElements() {
      draws++;
    }
  });
  for (const name of [
    'bindBuffer',
    'bindBufferBase',
    'bindVertexArray',
    'blendFuncSeparate',
    'bufferData',
    'bufferSubData',
    'clear',
    'clearColor',
    'clearDepth',
    'colorMask',
    'compileShader',
    'cullFace',
    'deleteBuffer',
    'deleteVertexArray',
    'depthFunc',
    'depthMask',
    'disable',
    'disableVertexAttribArray',
    'drawBuffers',
    'enable',
    'enableVertexAttribArray',
    'frontFace',
    'polygonOffset',
    'readBuffer',
    'scissor',
    'texStorage2D',
    'vertexAttribPointer',
    'viewport'
  ])
    gl[name] = () => {};

  const renderer = createWebGL2Renderer3D({ canvas });
  const geometry = createBoxGeometry3D({});
  const material = createStandardMaterial3D({ alphaMode: 'blend', opacity: 0.22 });
  const mesh = new Mesh3D(geometry, material);
  mesh.receiveShadow = true;
  return {
    ...fixture,
    renderer,
    mesh,
    material,
    programActions,
    linked,
    checked,
    inspected,
    deletedPrograms,
    deletedShaders,
    previousProgram,
    firstPoll: firstPoll.promise,
    programDefines(program) {
      const source = program.shaders.map(shader => sources.get(shader)).join('\n');
      return new Set(Array.from(source.matchAll(/^#define (\w+)/gm), match => match[1]));
    },
    finish(linkedSuccessfully = true) {
      complete = true;
      successful = linkedSuccessfully;
    },
    get draws() {
      return draws;
    },
    get buffers() {
      return buffers;
    },
    dispose() {
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    }
  };
}

test('World3D program preparation shares pending work, waits before introspection and leaves draw state alone', {
  timeout: 2000
}, async () => {
  const f = shaderPreparationFixture();
  try {
    const request = { mesh: f.mesh, material: f.material, receiveShadows: true, fog: true };
    const preparation = Promise.all([f.renderer.preparePrograms([request]), f.renderer.preparePrograms([request])]);
    void preparation.catch(() => {});
    await Promise.race([f.firstPoll, preparation]);
    assert.equal(f.programActions[0], 'enable-extension');
    assert.equal(f.linked.length, 1);
    assert.deepEqual(f.checked, []);
    assert.deepEqual(f.inspected, []);
    assert.equal(f.gl.getParameter(f.gl.CURRENT_PROGRAM), f.previousProgram);
    assert.equal(f.draws, 0);
    assert.equal(f.buffers, 0);
    assert.equal(f.allocations(), 0);
    const defines = f.programDefines(f.linked[0]);
    for (const define of ['SHADING_STANDARD', 'ALPHA_BLEND', 'RECEIVE_SHADOW', 'USE_FOG'])
      assert.ok(defines.has(define), 'Missing ' + define);

    f.finish();
    await preparation;
    assert.deepEqual(f.checked, f.linked);
    assert.deepEqual(f.inspected, f.linked);
    assert.equal(f.gl.getParameter(f.gl.CURRENT_PROGRAM), f.previousProgram);
    await f.renderer.preparePrograms([request]);
    assert.equal(f.linked.length, 1);
  } finally {
    f.dispose();
  }
});

test('World3D program preparation and an early render share one native program', { timeout: 2000 }, async () => {
  const f = shaderPreparationFixture();
  try {
    const scene = new Scene3D();
    scene.addChild(f.mesh);
    const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1, near: 0.1, far: 20 });
    camera.setPosition(0, 0, 5).lookAt(0, 0, 0);
    const preparation = f.renderer.preparePrograms([{ mesh: f.mesh, material: f.material }]);
    void preparation.catch(() => {});
    await Promise.race([f.firstPoll, preparation]);
    assert.deepEqual(f.checked, []);
    assert.equal(f.renderer.render(scene, camera), true);
    await preparation;
    assert.equal(f.draws, 1);
    assert.equal(f.linked.length, 1);
    assert.deepEqual(f.checked, f.linked);
    assert.deepEqual(f.inspected, f.linked);
  } finally {
    f.dispose();
  }
});

test('World3D program preparation covers color and shadow variants without KHR', async () => {
  const f = shaderPreparationFixture({ parallel: false });
  const target = new RenderTarget3D(2, 2, { format: 'rgba16f' });
  try {
    const base = { mesh: f.mesh, material: f.material };
    await f.renderer.preparePrograms([
      base,
      { ...base, target },
      { ...base, pass: 'shadow' },
      { ...base, pass: 'depth-prepass' }
    ]);
    assert.equal(f.linked.length, 3);
    assert.deepEqual(f.checked, f.linked);
    const defines = f.linked.map(f.programDefines);
    const color = defines.find(item => !item.has('LINEAR_OUTPUT') && !item.has('DEPTH_ONLY'));
    const linear = defines.find(item => item.has('LINEAR_OUTPUT'));
    const shadow = defines.find(item => item.has('DEPTH_ONLY'));
    assert.equal(color?.has('TONE_MAPPED'), true);
    assert.equal(linear?.has('TONE_MAPPED'), false);
    assert.equal(shadow?.has('ALPHA_BLEND'), true);
    for (const name of ['SHADING_STANDARD', 'TONE_MAPPED', 'LINEAR_OUTPUT']) assert.equal(shadow.has(name), false);
    f.renderer.postProcess.enabled = true;
    await f.renderer.preparePrograms([base]);
    assert.equal(f.linked.length, 3);
    assert.deepEqual(f.checked, f.linked);
    assert.equal(f.draws, 0);
    assert.equal(f.allocations(), 0);
  } finally {
    target.dispose();
    f.dispose();
  }
});

test('WebGL2 reflection preparation and drawing share the scoped color program', async () => {
  const f = shaderPreparationFixture({ parallel: false });
  const { renderer, gl, mesh, material } = f;
  const scene = new Scene3D();
  const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1, near: 0.1, far: 20 });
  camera.setPosition(0, 3, 5).lookAt(0, 1, 0);
  camera.layerMask = 7;
  const mirror = new PlanarReflection3D({ width: 16, height: 16 });
  mirror.layerMask = 1;
  mirror.toneMapping = 'reinhard';
  mirror.shadows = false;
  renderer.toneMapping = 'aces';
  renderer.shadowsEnabled = true;
  renderer.postProcess.enabled = true;
  mesh.setPosition(0, 1, 0);
  scene.addChild(mesh);

  const other = createStandardMaterial3D({});
  const layerExcluded = new Mesh3D(mesh.geometry, other);
  layerExcluded.layers = 2;
  layerExcluded.setPosition(0, 1, 0);
  scene.addChild(layerExcluded);
  const hidden = new Object3D();
  const descendant = new Mesh3D(mesh.geometry, other);
  descendant.setPosition(0, 1, 0);
  hidden.addChild(descendant);
  scene.addChild(hidden);

  try {
    const reflection = mirror.createPass(camera, [hidden]);
    await renderer.preparePrograms([
      { mesh, material, reflection, receiveShadows: true },
      { mesh, material, reflection, pass: 'shadow' },
      { mesh: layerExcluded, material: other, reflection },
      { mesh: layerExcluded, material: other, reflection, pass: 'depth-prepass' },
      { mesh: descendant, material: other, reflection }
    ]);
    assert.equal(f.linked.length, 1);
    const color = f.linked[0];
    const defines = f.programDefines(color);
    assert.equal(defines.has('LINEAR_OUTPUT'), true);
    assert.equal(defines.has('TONE_MAPPED'), true);
    for (const name of ['RECEIVE_SHADOW', 'DEPTH_ONLY']) assert.equal(defines.has(name), false);
    assert.equal(f.draws, 0);
    assert.equal(f.allocations(), 0);

    const drawElements = gl.drawElements;
    gl.drawElements = (...args) => {
      assert.equal(gl.getParameter(gl.CURRENT_PROGRAM), color);
      assert.equal(renderer.toneMapping, 'aces');
      assert.equal(renderer.shadowsEnabled, true);
      assert.equal(renderer.postProcess.enabled, true);
      assert.equal(camera.layerMask, 7);
      assert.equal(hidden.visible, true);
      assert.equal(descendant.visible, true);
      drawElements(...args);
    };
    assert.equal(mirror.render(renderer, scene, camera, [0, 1, 0, 0], [hidden]), true);
    assert.equal(f.draws, 1);
    assert.deepEqual(f.linked, [color]);
    assert.deepEqual(f.checked, [color]);

    const allocations = f.allocations();
    mirror.interval = 4;
    const draw = () => assert.equal(mirror.render(renderer, scene, camera, [0, 1, 0, 0], [hidden]), true);
    assert.deepEqual(renderer.measureFrame(draw).reflections, { rendered: 1, reused: 0 });
    assert.deepEqual(renderer.measureFrame(draw).reflections, { rendered: 0, reused: 1 });
    mirror.invalidate();
    assert.deepEqual(renderer.measureFrame(draw).reflections, { rendered: 1, reused: 0 });
    assert.equal(f.allocations(), allocations);
    assert.deepEqual(f.linked, [color]);
  } finally {
    f.dispose();
    mirror.dispose();
    other.dispose();
  }
});

test('World3D program preparation reuses a custom shader across different materials', async () => {
  const f = shaderPreparationFixture({ parallel: false });
  const geometry = createBoxGeometry3D({});
  const material = createStandardMaterial3D({ alphaMode: 'blend', opacity: 0.22 });
  try {
    const source = {
      key: 'program-preparation-custom',
      glsl: 'vec4 customFragment(vec4 c, vec3 p, vec3 n, vec2 uv) { return c * uCustom[0]; }'
    };
    f.material.shader = createCustomShader3D({ ...source, uniforms: [1, 1, 1, 1] });
    material.shader = createCustomShader3D({ ...source, uniforms: [0.25, 0.5, 0.75, 0.5] });
    f.gl.getActiveUniform = program => ({
      name: f.programDefines(program).has('CUSTOM_FRAGMENT') ? 'uCustom[0]' : 'uMap'
    });
    const uploads = [];
    f.gl.uniform4fv = (_location, values) => {
      uploads.push({ program: f.gl.getParameter(f.gl.CURRENT_PROGRAM), values: [...values] });
    };
    const request = { mesh: f.mesh, material: f.material };
    await f.renderer.preparePrograms([request, { ...request, pass: 'shadow' }]);
    const [color, shadow] = f.linked;
    assert.equal(f.linked.length, 2);
    assert.ok(f.programDefines(color).has('CUSTOM_FRAGMENT'));
    assert.ok(f.programDefines(shadow).has('DEPTH_ONLY'));
    assert.ok(!f.programDefines(shadow).has('CUSTOM_FRAGMENT'));
    assert.deepEqual(uploads, []);

    const scene = new Scene3D();
    scene.addChild(new Mesh3D(geometry, material));
    const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1, near: 0.1, far: 20 });
    camera.setPosition(0, 0, 5).lookAt(0, 0, 0);
    assert.equal(f.renderer.render(scene, camera), true);
    assert.equal(f.draws, 1);
    assert.equal(f.linked.length, 2);
    assert.deepEqual(f.checked, [color, shadow]);
    assert.deepEqual(uploads, [{ program: color, values: [...material.shader.uniforms] }]);
  } finally {
    f.dispose();
    geometry.dispose();
    material.dispose();
  }
});

test('World3D program preparation invalidates old work across WebGL2 restoration', { timeout: 2000 }, async () => {
  const f = shaderPreparationFixture();
  try {
    const request = { mesh: f.mesh, material: f.material };
    const abandoned = assert.rejects(f.renderer.preparePrograms([request]), code('WORLD3D_CONTEXT_LOST'));
    await Promise.race([f.firstPoll, abandoned]);
    f.lose();
    f.restore();
    f.finish();
    await abandoned;
    await f.renderer.preparePrograms([request]);
    assert.equal(f.linked.length, 2);
    assert.deepEqual(f.checked, f.linked.slice(1));
    assert.deepEqual(f.inspected, f.linked.slice(1));
  } finally {
    f.dispose();
  }
});

test('World3D program preparation retires pending and failed native handles once', { timeout: 2000 }, async () => {
  const f = shaderPreparationFixture();
  try {
    const request = { mesh: f.mesh, material: f.material };
    const pending = assert.rejects(f.renderer.preparePrograms([request]), code('WORLD3D_DISPOSED'));
    await Promise.race([f.firstPoll, pending]);
    f.renderer.dispose();
    await pending;
    assert.deepEqual(f.checked, []);
    assert.deepEqual(f.deletedPrograms, f.linked);
    assert.deepEqual(f.deletedShaders, f.linked[0].shaders);
  } finally {
    f.dispose();
  }

  const retry = shaderPreparationFixture();
  try {
    const request = { mesh: retry.mesh, material: retry.material };
    retry.finish(false);
    await assert.rejects(retry.renderer.preparePrograms([request]), code('WORLD3D_SHADER_FAILED'));
    assert.deepEqual(retry.deletedPrograms, retry.linked);
    assert.deepEqual(retry.deletedShaders, retry.linked[0].shaders);
    assert.deepEqual(retry.inspected, []);
    retry.finish();
    await retry.renderer.preparePrograms([request]);
    assert.equal(retry.linked.length, 2);
    assert.deepEqual(retry.checked, retry.linked);
    assert.deepEqual(retry.inspected, retry.linked.slice(1));
  } finally {
    retry.dispose();
  }
});

test('World3D program preparation drains an earlier link if a later program cannot start', {
  timeout: 2000
}, async () => {
  const f = shaderPreparationFixture();
  try {
    const request = { mesh: f.mesh, material: f.material };
    const error = new Error('test program startup failure');
    const createProgram = f.gl.createProgram;
    f.gl.createProgram = () => {
      if (f.linked.length === 1) throw error;
      return createProgram();
    };
    const rejected = assert.rejects(
      f.renderer.preparePrograms([request, { ...request, fog: true }]),
      cause => cause === error
    );
    void rejected.catch(() => {});
    await Promise.race([f.firstPoll, rejected]);
    assert.equal(f.linked.length, 1);
    assert.deepEqual(f.checked, []);
    f.finish();
    await rejected;
    assert.deepEqual(f.checked, f.linked);
    assert.equal(f.deletedShaders.length, 4);
    assert.deepEqual(f.deletedPrograms, []);
    await f.renderer.preparePrograms([request]);
    assert.equal(f.linked.length, 1);
  } finally {
    f.dispose();
  }
});

test('world3d WebGL2 preserves framebuffer and texture state during readback allocation and resize', async () => {
  const { canvas, gl } = webGLFixture();
  const renderer = createWebGL2Renderer3D({ canvas });
  const target = new RenderTarget3D(2, 2);
  const draw = {},
    read = {},
    texture = {},
    depth = {};
  gl.activeTexture(gl.TEXTURE0 + 3);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
  for (const size of [2, 3]) {
    target.setSize(size, size);
    assert.equal((await renderer.readRenderTargetPixels(target)).length, size * size * 4);
    assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), draw);
    assert.equal(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), read);
    assert.equal(gl.getParameter(gl.ACTIVE_TEXTURE), gl.TEXTURE0 + 3);
    assert.equal(gl.getParameter(gl.TEXTURE_BINDING_2D), texture);
    assert.equal(gl.getParameter(gl.RENDERBUFFER_BINDING), depth);
  }
  renderer.dispose();
  target.dispose();
});

test('world3d WebGL2 refuses dead readbacks and detaches target callbacks when lost', async () => {
  const { canvas, allocations, lose } = webGLFixture();
  const renderer = createWebGL2Renderer3D({ canvas });
  const target = new RenderTarget3D(2, 2);
  const register = target.onDispose.bind(target);
  let detached = 0;
  target.onDispose = listener => {
    const unsubscribe = register(listener);
    return () => {
      detached++;
      unsubscribe();
    };
  };
  await renderer.readRenderTargetPixels(target);
  lose();
  await assert.rejects(async () => renderer.readRenderTargetPixels(target), code('WORLD3D_CONTEXT_LOST'));
  assert.throws(() => renderer.readPixels(), code('WORLD3D_CONTEXT_LOST'));
  renderer.dispose();
  assert.equal(detached, 1);
  await assert.rejects(async () => renderer.readRenderTargetPixels(target), code('WORLD3D_DISPOSED'));
  assert.throws(() => renderer.readPixels(), code('WORLD3D_DISPOSED'));
  assert.equal(allocations(), 1);
  target.dispose();
});

test('world3d WebGL2 reuses shadow atlases across reflection, restore and dispose', () => {
  const { canvas, gl, lose, restore } = webGLFixture();
  const actual = { drawCalls: 0, triangles: 0 };
  const textures = new Map(),
    shadowFramebuffers = new Set();
  const deletedTextures = [],
    deletedFramebuffers = [];
  Object.assign(gl, {
    DEPTH_COMPONENT24: 0x81a6,
    DEPTH_ATTACHMENT: 0x8d00,
    TRIANGLES: 0x0004,
    LINK_STATUS: 0x8b82,
    INVALID_INDEX: 0xffffffff,
    drawingBufferWidth: 16,
    drawingBufferHeight: 16,
    createBuffer: () => ({}),
    createVertexArray: () => ({}),
    createShader: () => ({}),
    createProgram: () => ({}),
    getProgramParameter: (_program, parameter) => (parameter === gl.LINK_STATUS ? true : 0),
    getUniformBlockIndex: () => gl.INVALID_INDEX,
    texStorage2D(_target, _levels, format, width, height) {
      if (format === gl.DEPTH_COMPONENT24) {
        assert.equal(width, height);
        textures.set(gl.getParameter(gl.TEXTURE_BINDING_2D), width);
      }
    },
    framebufferTexture2D(_target, attachment, _textureTarget, texture) {
      if (attachment === gl.DEPTH_ATTACHMENT && textures.has(texture)) {
        shadowFramebuffers.add(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING));
      }
    },
    deleteTexture(texture) {
      if (textures.has(texture)) deletedTextures.push(texture);
    },
    deleteFramebuffer(framebuffer) {
      if (shadowFramebuffers.has(framebuffer)) deletedFramebuffers.push(framebuffer);
    }
  });
  for (const name of [
    'attachShader',
    'bindBuffer',
    'bindBufferBase',
    'bindVertexArray',
    'bufferData',
    'bufferSubData',
    'clear',
    'clearColor',
    'clearDepth',
    'colorMask',
    'compileShader',
    'cullFace',
    'deleteBuffer',
    'deleteProgram',
    'deleteShader',
    'deleteVertexArray',
    'depthFunc',
    'depthMask',
    'disable',
    'disableVertexAttribArray',
    'drawArrays',
    'drawBuffers',
    'drawElements',
    'enable',
    'enableVertexAttribArray',
    'frontFace',
    'linkProgram',
    'polygonOffset',
    'readBuffer',
    'scissor',
    'shaderSource',
    'useProgram',
    'vertexAttribPointer',
    'viewport'
  ])
    gl[name] = () => {};

  const record = (mode, count) => {
    actual.drawCalls++;
    if (mode === gl.TRIANGLES) actual.triangles += Math.floor(count / 3);
  };
  gl.drawArrays = (mode, _first, count) => record(mode, count);
  gl.drawElements = (mode, count) => record(mode, count);
  const renderer = createWebGL2Renderer3D({ canvas, shadowAtlasSize: 64 });
  const renderReflectionPass = renderer.renderReflectionPass.bind(renderer);
  let mirrorCalls = 0;
  renderer.renderReflectionPass = (scene, camera, pass) => {
    mirrorCalls++;
    return renderReflectionPass(scene, camera, pass);
  };
  const scene = new Scene3D();
  const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1, near: 0.1, far: 20 });
  camera.setPosition(0, 3, 5).lookAt(0, 0, 0);
  const geometry = createBoxGeometry3D({});
  const material = createStandardMaterial3D({});
  const caster = new Mesh3D(geometry, material);
  caster.castShadow = true;
  caster.setPosition(0, 1, 0);
  const light = createDirectionalLight3D({ castShadow: true });
  light.setPosition(2, 4, 3).lookAt(0, 0, 0);
  scene.addChild(caster);
  scene.addChild(light);
  const reflection = new PlanarReflection3D({ width: 16, height: 16 });
  reflection.shadows = false;
  const draw = () => {
    assert.equal(reflection.render(renderer, scene, camera, [0, 1, 0, 0]), true);
    assert.equal(renderer.info.shadowMaps, 0);
    assert.equal(renderer.shadowsEnabled, true);
    assert.equal(renderer.render(scene, camera), true);
    assert.equal(renderer.info.shadowMaps, 1);
  };
  try {
    const frame = renderer.measureFrame(draw);
    assert.deepEqual({ drawCalls: frame.drawCalls, triangles: frame.triangles }, actual);
    assert.deepEqual(
      frame.passes.map(({ view, kind, width, height }) => [view, kind, width, height]),
      [
        ['reflection', 'color', 16, 16],
        ['main', 'shadow', 64, 64],
        ['main', 'color', 16, 16]
      ]
    );
    assert.deepEqual(frame.passes[1].shadowMapSizes, [32]);
    assert.equal(mirrorCalls, 1);
    assert.deepEqual(frame.reflections, { rendered: 1, reused: 0 });
    reflection.interval = 3;
    const cadence = [];
    for (let i = 0; i < 6; i++) {
      const frame = renderer.measureFrame(() => {
        assert.ok(reflection.render(renderer, scene, camera, [0, 1, 0, 0]));
        assert.ok(renderer.render(scene, camera));
      });
      assert.equal(frame.passes.filter(pass => pass.view === 'reflection').length, frame.reflections.rendered);
      cadence.push(frame.reflections);
    }
    assert.deepEqual(
      cadence,
      Array.from({ length: 6 }, (_, i) => (i % 3 === 0 ? { rendered: 1, reused: 0 } : { rendered: 0, reused: 1 }))
    );
    assert.equal(mirrorCalls, 3);
    const rejected = renderer.measureFrame(() =>
      assert.equal(reflection.render(renderer, scene, camera, [0, -1, 0, 0]), false)
    );
    assert.deepEqual(rejected.reflections, { rendered: 0, reused: 0 });
    reflection.interval = 1;
    assert.deepEqual(
      [...textures.values()].sort((a, b) => a - b),
      [1, 64]
    );
    assert.equal(shadowFramebuffers.size, 2);
    assert.deepEqual([deletedTextures.length, deletedFramebuffers.length], [0, 0]);

    lose();
    assert.equal(renderer.render(scene, camera), false);
    restore();
    reflection.interval = 3;
    const captureReflection = () => renderer.measureFrame(draw);
    assert.deepEqual(captureReflection().reflections, { rendered: 1, reused: 0 });
    lose();
    restore();
    assert.deepEqual(captureReflection().reflections, { rendered: 1, reused: 0 });
    assert.deepEqual(
      [...textures.values()].sort((a, b) => a - b),
      [1, 1, 1, 64, 64, 64]
    );
    assert.equal(shadowFramebuffers.size, 6);
    assert.deepEqual([deletedTextures.length, deletedFramebuffers.length], [0, 0]);

    renderer.dispose();
    renderer.dispose();
    assert.equal(deletedTextures.length, 2);
    assert.equal(deletedFramebuffers.length, 2);
    assert.deepEqual(new Set(deletedTextures), new Set([...textures.keys()].slice(-2)));
    assert.deepEqual(new Set(deletedFramebuffers), new Set([...shadowFramebuffers].slice(-2)));
  } finally {
    renderer.dispose();
    reflection.dispose();
    geometry.dispose();
    material.dispose();
  }
});

test('World3D measures one application frame and resolves owned GPU queries asynchronously', () => {
  const { canvas, gl, lose, restore } = webGLFixture();
  const extension = { TIME_ELAPSED_EXT: 101, QUERY_COUNTER_BITS_EXT: 102, GPU_DISJOINT_EXT: 103 };
  let active,
    ready = false,
    disjoint = false,
    bits = 0,
    result = 2_500_000;
  const deleted = new Set();
  const getParameter = gl.getParameter;
  Object.assign(gl, {
    CURRENT_QUERY: 104,
    QUERY_RESULT_AVAILABLE: 105,
    QUERY_RESULT: 106,
    DEPTH_COMPONENT24: 0x81a6,
    drawingBufferWidth: 32,
    drawingBufferHeight: 24,
    getParameter(parameter) {
      if (parameter !== extension.GPU_DISJOINT_EXT) return getParameter(parameter);
      const flag = disjoint;
      disjoint = false;
      return flag;
    },
    getExtension: name => (name === 'EXT_disjoint_timer_query_webgl2' ? extension : null),
    getQuery: (_target, key) => (key === extension.QUERY_COUNTER_BITS_EXT ? bits : active),
    createQuery: () => ({}),
    beginQuery(_target, query) {
      assert.equal(active, undefined);
      active = query;
    },
    endQuery() {
      assert.ok(active);
      active = undefined;
    },
    getQueryParameter(_query, key) {
      if (key === gl.QUERY_RESULT_AVAILABLE) return ready;
      assert.ok(ready);
      return result;
    },
    deleteQuery(query) {
      assert.ok(!deleted.has(query));
      deleted.add(query);
    },
    createBuffer: () => ({}),
    createVertexArray: () => ({})
  });
  for (const name of [
    'bindBuffer',
    'bindBufferBase',
    'bindVertexArray',
    'bufferData',
    'bufferSubData',
    'clear',
    'clearColor',
    'clearDepth',
    'colorMask',
    'deleteBuffer',
    'deleteVertexArray',
    'depthFunc',
    'depthMask',
    'disable',
    'drawBuffers',
    'frontFace',
    'readBuffer',
    'texStorage2D',
    'viewport'
  ])
    gl[name] = () => {};
  const renderer = createWebGL2Renderer3D({ canvas, shadows: false });
  const scene = new Scene3D(),
    camera = createPerspectiveCamera3D({});
  const target = new RenderTarget3D(12, 8);
  const draw = () => {
    assert.ok(renderer.render(scene, camera));
    assert.ok(renderer.render(scene, camera, target));
  };
  const capture = () => renderer.measureFrame(draw, { gpuTiming: true });
  const states = frame => frame.passes.map(pass => pass.gpuTime.status);
  try {
    assert.deepEqual(states(capture()), ['unsupported', 'unsupported']);
    lose();
    restore();
    bits = 64;
    renderer.viewport = [0, 0, 0.5, 0.5];
    gl.enable = gl.scissor = () => {};
    const frame = capture();
    assert.deepEqual(
      frame.passes.map(({ view, viewIndex, width, height }) => [view, viewIndex, width, height]),
      [
        ['main', 0, 32, 24],
        ['offscreen', 1, 12, 8]
      ]
    );
    assert.equal(frame.drawCalls, 0);
    assert.equal(frame.triangles, 0);
    assert.ok(frame.cpuSubmissionMs >= 0);
    assert.deepEqual(states(frame), ['pending', 'pending']);
    renderer.pollFrameTimings();
    assert.deepEqual(states(frame), ['pending', 'pending']);
    ready = true;
    renderer.pollFrameTimings();
    assert.deepEqual(
      frame.passes.map(pass => pass.gpuTime),
      Array.from({ length: 2 }, () => ({ status: 'ready', milliseconds: 2.5 }))
    );
    assert.equal(deleted.size, 2);

    result = null;
    const invalid = capture();
    renderer.pollFrameTimings();
    assert.deepEqual(states(invalid), ['unavailable', 'unavailable']);
    const interrupted = capture();
    disjoint = true;
    renderer.pollFrameTimings();
    assert.deepEqual(states(interrupted), ['disjoint', 'disjoint']);

    active = {};
    assert.deepEqual(states(capture()), ['unavailable', 'unavailable']);
    assert.ok(active, 'An interop query remains active');
    active = undefined;
    assert.throws(() => renderer.measureFrame(() => renderer.measureFrame(draw)), code('WORLD3D_INPUT_INVALID'));
    assert.throws(
      () =>
        renderer.measureFrame(async () => {
          throw Error('rejected async callback');
        }),
      code('WORLD3D_INPUT_INVALID')
    );
    assert.deepEqual(states(renderer.measureFrame(draw)), ['disabled', 'disabled']);

    const lost = capture();
    lose();
    assert.deepEqual(states(lost), ['context-lost', 'context-lost']);
    restore();
    const beforeDispose = capture();
    renderer.dispose();
    assert.deepEqual(states(beforeDispose), ['unavailable', 'unavailable']);
    assert.equal(deleted.size, 8);
  } finally {
    renderer.dispose();
    target.dispose();
  }
});

function webGPUFixture(t) {
  const property = Object.getOwnPropertyDescriptor(navigator, 'gpu');
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: { getPreferredCanvasFormat: () => 'rgba8unorm' }
  });
  t.after(() => {
    if (property) Object.defineProperty(navigator, 'gpu', property);
    else delete navigator.gpu;
  });
  const lost = Promise.withResolvers();
  const textures = [];
  let deviceDestroys = 0;
  const device = {
    lost: lost.promise,
    limits: { maxTextureDimension2D: 64 },
    queue: { writeTexture() {}, submit() {} },
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createBindGroup: () => ({}),
    createBuffer: ({ size }) => ({
      destroy() {},
      mapAsync: async () => {},
      getMappedRange: () => new ArrayBuffer(size),
      unmap() {}
    }),
    createTexture() {
      const texture = {
        destroys: 0,
        createView: () => ({}),
        destroy() {
          this.destroys++;
        }
      };
      textures.push(texture);
      return texture;
    },
    createCommandEncoder: () => ({ copyTextureToBuffer() {}, finish: () => ({}) }),
    createSampler: () => ({}),
    destroy() {
      deviceDestroys++;
    }
  };
  const context = { configure() {}, unconfigure() {} };
  return {
    canvas: { getContext: () => context },
    device,
    textures,
    deviceDestroys: () => deviceDestroys,
    async lose() {
      lost.resolve({ message: 'test device loss' });
      await lost.promise;
    }
  };
}

test('world3d WebGPU readbacks respect resource lifetime and release fallbacks on a borrowed device', async t => {
  const { canvas, device, textures, deviceDestroys, lose } = webGPUFixture(t);
  const renderer = await createWebGPURenderer3D({ canvas, device });
  const target = new RenderTarget3D(2, 2);
  target.dispose();
  await assert.rejects(renderer.readRenderTargetPixels(target), code('WORLD3D_DISPOSED'));
  await lose();
  const liveTarget = new RenderTarget3D(2, 2);
  await assert.rejects(renderer.readRenderTargetPixels(liveTarget), code('WORLD3D_CONTEXT_LOST'));
  renderer.dispose();
  renderer.dispose();
  await assert.rejects(renderer.readRenderTargetPixels(liveTarget), code('WORLD3D_DISPOSED'));
  assert.deepEqual(
    textures.map(texture => texture.destroys),
    [1, 1]
  );
  assert.equal(deviceDestroys(), 0);
  liveTarget.dispose();
});
