import type { SharedMaterial2D } from '@egret/contracts';
export declare const SHARED_BLENDS: readonly ['normal', 'add-accumulate', 'add-preserve', 'multiply-factor', 'screen', 'erase'];
/** The pipelines of a draw without a region, of a batch of one page, and of a batch of several pages. */
export declare const SHARED_PIPELINE_KINDS: readonly ['solid', 'sampled', 'paged'];
/** All shaders and promises are immediately owned by the Host's captured startup boundaries. */
export declare function createSharedWebGPUPipeline(shader: (d: GPUShaderModuleDescriptor) => GPUShaderModule, pipeline: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, kind: (typeof SHARED_PIPELINE_KINDS)[number], blend: SharedMaterial2D['blend']): Promise<GPURenderPipeline>;
//# sourceMappingURL=webgpuSharedPass.d.ts.map