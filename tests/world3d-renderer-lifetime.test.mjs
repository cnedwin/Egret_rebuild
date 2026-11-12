// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {RenderTarget3D, World3DError} from '@egret/engine/world3d';
import {createWebGL2Renderer3D} from '@egret/engine/webgl2/world3d';
import {createWebGPURenderer3D} from '@egret/engine/webgpu/world3d';

const code = expected => error => error instanceof World3DError && error.code === expected;

function webGLFixture() {
    const canvas = new EventTarget();
    let allocations = 0, lost = false;
    const gl = {
        MAX_TEXTURE_SIZE: 0x0d33, ACTIVE_TEXTURE: 0x84e0, TEXTURE0: 0x84c0,
        TEXTURE_BINDING_2D: 0x8069, RENDERBUFFER_BINDING: 0x8ca7, TEXTURE_2D: 0x0de1,
        FRAMEBUFFER: 0x8d40, FRAMEBUFFER_COMPLETE: 0x8cd5, DRAW_FRAMEBUFFER: 0x8ca9,
        DRAW_FRAMEBUFFER_BINDING: 0x8ca6, READ_FRAMEBUFFER: 0x8ca8, READ_FRAMEBUFFER_BINDING: 0x8caa,
        getParameter: parameter => parameter === gl.MAX_TEXTURE_SIZE ? 64 : state.get(parameter),
        getExtension: () => null,
        isContextLost: () => lost,
        createFramebuffer() { allocations++; return {}; },
        createTexture: () => ({}),
        createRenderbuffer: () => ({}),
        activeTexture(unit) { state.set(gl.ACTIVE_TEXTURE, unit); },
        bindTexture(_target, texture) { state.set(gl.TEXTURE_BINDING_2D, texture); },
        bindRenderbuffer(_target, buffer) { state.set(gl.RENDERBUFFER_BINDING, buffer); },
        bindFramebuffer(target, buffer) {
            if (target !== gl.READ_FRAMEBUFFER) state.set(gl.DRAW_FRAMEBUFFER_BINDING, buffer);
            if (target !== gl.DRAW_FRAMEBUFFER) state.set(gl.READ_FRAMEBUFFER_BINDING, buffer);
        },
        texImage2D() {}, texParameteri() {}, framebufferTexture2D() {}, renderbufferStorage() {}, framebufferRenderbuffer() {},
        checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
        readPixels() {}, deleteFramebuffer() {}, deleteTexture() {}, deleteRenderbuffer() {},
    };
    const state = new Map([[gl.ACTIVE_TEXTURE, gl.TEXTURE0], [gl.TEXTURE_BINDING_2D, null],
        [gl.RENDERBUFFER_BINDING, null], [gl.DRAW_FRAMEBUFFER_BINDING, null], [gl.READ_FRAMEBUFFER_BINDING, null]]);
    canvas.getContext = () => gl;
    return {
        canvas, gl, allocations: () => allocations,
        lose() { lost = true; canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true})); },
    };
}

test('world3d WebGL2 preserves framebuffer and texture state during readback allocation and resize', async () => {
    const {canvas, gl} = webGLFixture();
    const renderer = createWebGL2Renderer3D({canvas});
    const target = new RenderTarget3D(2, 2);
    const draw = {}, read = {}, texture = {}, depth = {};
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
    const {canvas, allocations, lose} = webGLFixture();
    const renderer = createWebGL2Renderer3D({canvas});
    const target = new RenderTarget3D(2, 2);
    const register = target.onDispose.bind(target);
    let detached = 0;
    target.onDispose = listener => {
        const unsubscribe = register(listener);
        return () => { detached++; unsubscribe(); };
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

function webGPUFixture(t) {
    const property = Object.getOwnPropertyDescriptor(navigator, 'gpu');
    Object.defineProperty(navigator, 'gpu', {configurable: true, value: {getPreferredCanvasFormat: () => 'rgba8unorm'}});
    t.after(() => {
        if (property) Object.defineProperty(navigator, 'gpu', property);
        else delete navigator.gpu;
    });
    const lost = Promise.withResolvers();
    const textures = [];
    let deviceDestroys = 0;
    const device = {
        lost: lost.promise, limits: {maxTextureDimension2D: 64},
        queue: {writeTexture() {}, submit() {}},
        createBindGroupLayout: () => ({}), createPipelineLayout: () => ({}), createBindGroup: () => ({}),
        createBuffer: ({size}) => ({destroy() {}, mapAsync: async () => {}, getMappedRange: () => new ArrayBuffer(size), unmap() {}}),
        createTexture() {
            const texture = {destroys: 0, createView: () => ({}), destroy() { this.destroys++; }};
            textures.push(texture);
            return texture;
        },
        createCommandEncoder: () => ({copyTextureToBuffer() {}, finish: () => ({})}),
        createSampler: () => ({}),
        destroy() { deviceDestroys++; },
    };
    const context = {configure() {}, unconfigure() {}};
    return {
        canvas: {getContext: () => context}, device, textures, deviceDestroys: () => deviceDestroys,
        async lose() { lost.resolve({message: 'test device loss'}); await lost.promise; },
    };
}

test('world3d WebGPU readbacks respect resource lifetime and release fallbacks on a borrowed device', async t => {
    const {canvas, device, textures, deviceDestroys, lose} = webGPUFixture(t);
    const renderer = await createWebGPURenderer3D({canvas, device});
    const target = new RenderTarget3D(2, 2);
    target.dispose();
    await assert.rejects(renderer.readRenderTargetPixels(target), code('WORLD3D_DISPOSED'));
    await lose();
    const liveTarget = new RenderTarget3D(2, 2);
    await assert.rejects(renderer.readRenderTargetPixels(liveTarget), code('WORLD3D_CONTEXT_LOST'));
    renderer.dispose();
    renderer.dispose();
    await assert.rejects(renderer.readRenderTargetPixels(liveTarget), code('WORLD3D_DISPOSED'));
    assert.deepEqual(textures.map(texture => texture.destroys), [1, 1]);
    assert.equal(deviceDestroys(), 0);
    liveTarget.dispose();
});
