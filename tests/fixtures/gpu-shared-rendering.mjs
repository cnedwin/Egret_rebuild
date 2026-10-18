// SPDX-License-Identifier: Apache-2.0
// Shared-profile controls compose the existing GPU-port fixture and public SDK entries.
import assert from 'node:assert/strict';
import { createGpuFixture, deferred, egret, tick, admitted } from
  './gpu-image-residency.mjs';
import * as gpu from '@egret/engine/webgpu';
import * as sceneGpu from '@egret/engine/webgpu/scene3d';
export { egret, tick, admitted };

export function requireFactory(scene = false) {
  const name = scene ? 'createSharedSceneWebGPUHost' : 'createSharedWebGPUHost';
  const factory = (scene ? sceneGpu : gpu)[name];
  assert.equal(typeof factory, 'function', name + ' availability; this is not a semantic RED');
  return factory;
}
export async function withPorts(body) {
  const f = createGpuFixture();
  // The existing fixture describes the old 32B/three-attribute profile.
  Object.assign(f.limits, { maxVertexAttributes: 4, maxVertexBufferArrayStride: 44,
    maxUniformBufferBindingSize: 128, maxInterStageShaderVariables: 3 });
  f.device.createRenderPipelineAsync = function (descriptor) {
    assert.equal(this, f.device);
    const stride = descriptor.vertex.buffers?.[0]?.arrayStride;
    const kind = descriptor.depthStencil ? 'scene' : stride === undefined ? 'resolve'
      : stride === 44 ? 'shared' : 'legacy';
    const d = deferred(), layout = { kind, descriptor }, value = { kind, descriptor,
      getBindGroupLayout(index) {
        assert.equal(this, value); f.calls.push(['layout', kind, index]); return layout;
      } };
    const p = { ...d, descriptor, value }; f.pipelines.push(p); f.calls.push(['pipeline', p]);
    return p.promise;
  };
  f.device.createSampler = function (descriptor) {
    assert.equal(this, f.device);
    const sampler = { descriptor };
    f.calls.push(['sampler', descriptor, sampler]); return sampler;
  };
  // Preserve the original native boundary and its logs; record returned identity.
  f.canvasTextures = []; f.canvasViews = [];
  const current = f.context.getCurrentTexture;
  f.context.getCurrentTexture = function () {
    const texture = current.call(this), createView = texture.createView;
    f.canvasTextures.push(texture);
    texture.createView = function () {
      const view = createView.call(this); f.canvasViews.push(view); return view;
    };
    return texture;
  };
  f.sharedHost = (options = {}, scene = false) => {
    const host = requireFactory(scene)(f.options(options)); f.hosts.push(host); return host;
  };
  try { return await body(f); }
  finally { try { await f.cleanup(); } finally { f.restore(); } }
}
export const pageTextures = textures => textures.filter(t =>
  t.descriptor.format === 'rgba8unorm-srgb' && t.descriptor.usage === 6);
export const colorTargets = textures => textures.filter(t =>
  t.descriptor.format === 'rgba8unorm-srgb' && t.descriptor.usage === 20);
export const bytesOfTexture = t => 4 * t.descriptor.size.width * t.descriptor.size.height;
export const writes = (events, buffer) => events.filter(c => c[0] === 'writeBuffer'
  && (buffer === undefined || c[1] === buffer));
export const uploads = events => events.filter(c => c[0] === 'writeTexture');
export function passes(events) {
  const result = []; let current;
  for (const c of events) {
    if (c[0] === 'pass') {
      current = { descriptor: c[1], draws: [], vertices: [], bindings: [], pipeline: undefined,
        vertex: undefined, binding: undefined }; result.push(current);
    } else if (current && c[0] === 'setPipeline') current.pipeline = c[1];
    else if (current && c[0] === 'setVertexBuffer') {
      current.vertex = c[2]; current.vertices.push(c[2]);
    } else if (current && c[0] === 'setBindGroup') {
      current.binding = c[2]; current.bindings.push(c[2]);
    } else if (current && (c[0] === 'draw' || c[0] === 'drawIndexed')) {
      current.draws.push({ kind: c[0], args: c.slice(1), pipeline: current.pipeline,
        vertex: current.vertex, binding: current.binding });
    } else if (c[0] === 'end') current = undefined;
  }
  return result;
}
export function capture(f, run) {
  const start = f.calls.length, record = f.capture(run);
  return { ...record, events: f.calls.slice(start) };
}
export async function submit(f, host, frame, render = value => host.renderSharedFrame(value)) {
  const record = capture(f, () => render(frame)); admitted(record);
  await record.finish(); await host.whenIdle(); return record;
}
