import type { BufferHandle } from './webgpuBufferPool.js';
export interface DrawBindingKey {
    readonly session: object;
    readonly layout: GPUBindGroupLayout;
    readonly texture: object | undefined;
    readonly view: GPUTextureView | undefined;
    readonly sampler: GPUSampler | undefined;
    readonly uniform: BufferHandle;
    readonly offset: 0;
    readonly size: 16 | 64 | 112 | 128;
}
export interface DrawBindingCandidate {
    readonly key: DrawBindingKey;
    readonly binding: GPUBindGroup;
}
export interface WebGPUBindingCache {
    lookup(key: DrawBindingKey): GPUBindGroup | undefined;
    publish(candidates: readonly DrawBindingCandidate[]): void;
    invalidateTexture(identity: object): void;
    invalidateBuffer(identity: object): void;
    invalidate(): void;
    clear(): void;
}
/** The Host qualifies READY candidates and owns every resource and submission. */
export declare function createWebGPUBindingCache(session: object): WebGPUBindingCache;
//# sourceMappingURL=webgpuBindingCache.d.ts.map