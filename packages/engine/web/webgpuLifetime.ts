/** Immediate observation and settlement, separate from successful retirement. */
export function observed<T>(value: PromiseLike<T> | T): Promise<T> {
    const promise = Promise.resolve(value); promise.catch(() => undefined); return promise;
}
/** Separate lexical scope ensures a healthy borrowed lost Promise retains only its cell. */
export function observeWebGPUDeviceLoss(value: PromiseLike<GPUDeviceLostInfo>, cell: { notify?: (cause: unknown) => void }): void {
    observed(value).then(info => cell.notify?.(info), cause => cell.notify?.(cause));
}
/** Authenticated observers retain only a detachable cell, including the rejection path. */
export function observeAuthenticatedWebGPUDeviceLoss(value:PromiseLike<GPUDeviceLostInfo>,cell:{notify?:(cause:unknown)=>void;unknown?:(cause:unknown)=>void}):void {
    observed(value).then(info=>cell.notify?.(info),cause=>cell.unknown?.(cause));
}
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (cause: unknown) => void } {
    let resolve!: (value: T) => void, reject!: (cause: unknown) => void;
    const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
    promise.catch(() => undefined); return { promise, resolve, reject };
}
export interface WebGPUResourceGeneration { readonly invalidated: boolean; }
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
    logicalByteLength?:number;diagnosticUnknown?:boolean;
}
/** One cleanup attempt per captured resource, including best-effort failure paths. */
export function cleanupWebGPUBuffer(resource: OwnedWebGPUBuffer): unknown[] {
    if (resource.cleaned) return [];
    resource.cleaned = true;
    if (resource.generation?.invalidated) { resource.mapped = false; resource.settlement = 'context-invalidated'; return []; }
    const errors: unknown[] = [];
    if (resource.mapped) { resource.mapped = false; try { resource.unmap(); } catch (cause) { errors.push(cause); } }
    try { resource.destroy(); } catch (cause) { errors.push(cause); }
    resource.settlement = errors.length === 0 ? 'destroyed' : 'unknown';
    return errors;
}

export interface OwnedWebGPUTexture {
    readonly texture: GPUTexture;
    readonly destroy: () => void;
    cleaned: boolean;
    generation?: WebGPUResourceGeneration;
    settlement?: WebGPUResourceSettlement;
    /** Descriptor observation and once-only unknown accounting; never cleanup authority. */
    logicalByteLength?:number;diagnosticUnknown?:boolean;
}
/** Mark the attempt before calling captured cleanup, including throwing or reentrant paths. */
export function cleanupWebGPUTexture(resource: OwnedWebGPUTexture): unknown[] {
    if (resource.cleaned) return [];
    resource.cleaned = true;
    if (resource.generation?.invalidated) { resource.settlement = 'context-invalidated'; return []; }
    try { resource.destroy(); resource.settlement = 'destroyed'; return []; } catch (cause) { resource.settlement = 'unknown'; return [cause]; }
}
