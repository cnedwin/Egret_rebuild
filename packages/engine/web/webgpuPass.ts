import type { PreparedRectangles2D } from '../rendering/prepareRectangles2D.js';
import { packedOrientation } from '../rendering/packedOrientation.js';

export class WebGPUPackingError extends Error {
    public constructor(public readonly reason: 'precision' | 'budget' | 'device', cause: unknown = undefined) { super(`WebGPU packing ${reason}`, { cause }); }
}
export function packWebGPUVertices(prepared: PreparedRectangles2D, width: number, height: number, limits: { readonly maxUploadBytes: number; readonly maxBufferSize: number }): {
    data: Float32Array; ranges: readonly { firstVertex: number; vertexCount: number }[]; collapsedTriangles: number; maxBackingDisplacement: number;
} {
    let maxBackingDisplacement = 0, collapsedTriangles = 0, vertices = 0;
    // Ordinary scratch preserves converted bits; no typed storage exists before both byte checks.
    const points = prepared.points.map(point => {
        const x = Math.fround(2 * point.x / width - 1), y = Math.fround(1 - 2 * point.y / height);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new WebGPUPackingError('precision');
        maxBackingDisplacement = Math.max(maxBackingDisplacement, Math.abs((x + 1) * width / 2 - point.x), Math.abs((1 - y) * height / 2 - point.y));
        return { x, y };
    });
    const ranges: { firstVertex: number; vertexCount: number }[] = [];
    const groups: { indices: number[]; color: number; alpha: number }[] = [];
    for (const command of prepared.commands) {
        const indices: number[] = [], firstVertex = vertices;
        for (let i = 1; i + 1 < command.pointIndices.length; i++) {
            const a = command.pointIndices[0]!, b = command.pointIndices[i]!, c = command.pointIndices[i + 1]!;
            const p = points[a]!, q = points[b]!, r = points[c]!;
            const sign = packedOrientation(p.x, p.y, q.x, q.y, r.x, r.y);
            if (!Number.isFinite(sign) || sign > 0) throw new WebGPUPackingError('precision');
            if (sign === 0) { collapsedTriangles++; continue; }
            if (vertices > 4294967295 - 3) throw new WebGPUPackingError('device');
            vertices += 3; indices.push(a, b, c);
        }
        if (vertices !== firstVertex) { ranges.push({ firstVertex, vertexCount: vertices - firstVertex }); groups.push({ indices, color: command.color, alpha: command.alpha }); }
    }
    if (vertices > Math.floor(Number.MAX_SAFE_INTEGER / 24) || vertices > Math.floor(limits.maxUploadBytes / 24)) throw new WebGPUPackingError('budget');
    if (vertices > Math.floor(limits.maxBufferSize / 24)) throw new WebGPUPackingError('device');
    const data = new Float32Array(vertices * 6);
    let offset = 0;
    for (const group of groups) {
        const alpha = group.alpha, red = ((group.color >>> 16) & 255) / 255 * alpha, green = ((group.color >>> 8) & 255) / 255 * alpha, blue = (group.color & 255) / 255 * alpha;
        for (const index of group.indices) { const p = points[index]!; data[offset++] = p.x; data[offset++] = p.y; data[offset++] = red; data[offset++] = green; data[offset++] = blue; data[offset++] = alpha; }
    }
    return { data, ranges, collapsedTriangles, maxBackingDisplacement };
}
const SHADER = `
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) @interpolate(flat) color: vec4<f32>, }
@vertex fn vertexMain(@location(0) position: vec2<f32>, @location(1) color: vec4<f32>) -> VertexOutput {
    var out: VertexOutput; out.position = vec4<f32>(position, 0.0, 1.0); out.color = color; return out;
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> { return input.color; }
`;
/** Host supplies captured methods, checks terminal gates, and owns surrounding scopes. */
export function createWebGPURectanglePipeline(shader: (descriptor: GPUShaderModuleDescriptor) => GPUShaderModule, pipeline: (descriptor: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, format: 'rgba8unorm' | 'bgra8unorm'): Promise<GPURenderPipeline> {
    const module = shader({ code: SHADER });
    const blend: GPUBlendComponent = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
    return pipeline({ layout: 'auto', vertex: { module, entryPoint: 'vertexMain', buffers: [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x4' }] }] }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, blend: { color: blend, alpha: blend }, writeMask: 15 }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: 1, alphaToCoverageEnabled: false } });
}
export function encodeWebGPURectangles(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, buffer: GPUBuffer | undefined, ranges: readonly { firstVertex: number; vertexCount: number }[], width: number, height: number): void {
    pass.setPipeline(pipeline); pass.setViewport(0, 0, width, height, 0, 1); pass.setScissorRect(0, 0, width, height);
    if (buffer) { pass.setVertexBuffer(0, buffer); for (const range of ranges) pass.draw(range.vertexCount, 1, range.firstVertex, 0); }
}
