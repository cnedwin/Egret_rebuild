/** Immediate observation and settlement, separate from successful retirement. */
export declare function observed<T>(value: PromiseLike<T> | T): Promise<T>;
/** Separate lexical scope ensures a healthy borrowed lost Promise retains only its cell. */
export declare function observeWebGPUDeviceLoss(value: PromiseLike<GPUDeviceLostInfo>, cell: {
    notify?: (cause: unknown) => void;
}): void;
/** Authenticated observers retain only a detachable cell, including the rejection path. */
export declare function observeAuthenticatedWebGPUDeviceLoss(value: PromiseLike<GPUDeviceLostInfo>, cell: {
    notify?: (cause: unknown) => void;
    unknown?: (cause: unknown) => void;
}): void;
export declare function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (cause: unknown) => void;
};
export interface WebGPUResourceGeneration {
    readonly invalidated: boolean;
}
export type WebGPUResourceSettlement = 'destroyed' | 'context-invalidated' | 'unknown';
export interface OwnedWebGPUBuffer {
    readonly buffer: GPUBuffer;
    readonly destroy: () => void;
    readonly unmap: () => void;
    readonly map: (mode: GPUMapModeFlags) => Promise<void>;
    readonly mappedRange: () => ArrayBuffer;
    mapped: boolean;
    cleaned: boolean;
    generation?: WebGPUResourceGeneration;
    settlement?: WebGPUResourceSettlement;
    /** Descriptor observation and once-only unknown accounting; never cleanup authority. */
    logicalByteLength?: number;
    diagnosticUnknown?: boolean;
}
/** One cleanup attempt per captured resource, including best-effort failure paths. */
export declare function cleanupWebGPUBuffer(resource: OwnedWebGPUBuffer): unknown[];
export interface OwnedWebGPUTexture {
    readonly texture: GPUTexture;
    readonly destroy: () => void;
    cleaned: boolean;
    generation?: WebGPUResourceGeneration;
    settlement?: WebGPUResourceSettlement;
    /** Descriptor observation and once-only unknown accounting; never cleanup authority. */
    logicalByteLength?: number;
    diagnosticUnknown?: boolean;
}
/** Mark the attempt before calling captured cleanup, including throwing or reentrant paths. */
export declare function cleanupWebGPUTexture(resource: OwnedWebGPUTexture): unknown[];
//# sourceMappingURL=webgpuLifetime.d.ts.map