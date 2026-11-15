/** Fixed separable box kernel, a spread of the group's alpha for a glow or an outline, Egret's colour matrix, and
 * source-over Alpha mask, in linear PMA space. Native targets encode sRGB on store; integer loads decode once on read. */
export type SharedEffectPass = 'horizontal' | 'vertical' | 'spread' | 'composite';
export declare const EFFECT_PASSES: readonly SharedEffectPass[];
/** The bytes of one group's uniform, as prepareEffects2D fills it. */
export declare const EFFECT_UNIFORM_BYTES: number;
export declare function sharedEffectGLSL(mode: SharedEffectPass): string;
export declare function createSharedEffectPipeline(shader: (d: GPUShaderModuleDescriptor) => GPUShaderModule, pipeline: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, mode: SharedEffectPass): Promise<GPURenderPipeline>;
//# sourceMappingURL=sharedEffectShaders.d.ts.map