import type { WebGPUHostDiagnostic, WebGPUHostOptions } from './WebGPUHost.js';
/** Each may only lower the profile's own bound: 4,096 regions and 64 MiB of pages in a frame, 128 MiB of ready pages. */
export interface SharedPageLimits2D {
    readonly maxFrameRegions: number;
    readonly maxFramePageBytes: number;
    readonly maxReadyPageBytes: number;
}
export interface SharedWebGPUHostOptions extends WebGPUHostOptions, Partial<SharedPageLimits2D> {
    readonly maxSourceTriangles?: number;
    readonly maxFrameGeometryBytes?: number;
    readonly maxPendingGeometryBytes?: number;
    readonly maxTupleComparisons?: number;
    readonly enableEffects?: boolean;
    readonly outputAlpha?: 'premultiplied' | 'opaque';
    readonly recovery?: {
        readonly mode: 'manual' | 'automatic';
        readonly timeoutMs?: number;
    };
}
type BaseConfiguration = Required<Omit<SharedWebGPUHostOptions, 'canvas' | 'device' | 'onDiagnostic' | 'enableEffects' | 'outputAlpha' | 'recovery' | keyof SharedPageLimits2D>>;
export type SharedWebGPUConfiguration = BaseConfiguration & SharedPageLimits2D & {
    readonly enableEffects: boolean;
    readonly outputAlpha: 'premultiplied' | 'opaque';
    readonly recovery: {
        readonly mode: 'manual' | 'automatic';
        readonly timeoutMs: number;
    } | undefined;
};
/** Snapshot every top-level read, then the selected policy reads, before any semantic refusal. */
export declare function admitSharedWebGPUOptions(input: SharedWebGPUHostOptions): {
    surface: HTMLCanvasElement;
    configuration: SharedWebGPUConfiguration;
    borrowed: GPUDevice | undefined;
    callback: ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined;
};
export {};
//# sourceMappingURL=sharedWebGPUOptions.d.ts.map