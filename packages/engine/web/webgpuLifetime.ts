/** Immediate observation and settlement, separate from successful retirement. */
export function observed<T>(value: PromiseLike<T> | T): Promise<T> {
    const promise = Promise.resolve(value); promise.catch(() => undefined); return promise;
}
/** Separate lexical scope ensures a healthy borrowed lost Promise retains only its cell. */
export function observeWebGPUDeviceLoss(value: PromiseLike<GPUDeviceLostInfo>, cell: { notify?: (cause: unknown) => void }): void {
    observed(value).then(info => cell.notify?.(info), cause => cell.notify?.(cause));
}
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (cause: unknown) => void } {
    let resolve!: (value: T) => void, reject!: (cause: unknown) => void;
    const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
    promise.catch(() => undefined); return { promise, resolve, reject };
}
export interface OwnedWebGPUBuffer {
    readonly buffer: GPUBuffer;
    readonly destroy: () => void;
    readonly unmap: () => void;
    readonly map: (mode: GPUMapModeFlags) => Promise<void>;
    readonly mappedRange: () => ArrayBuffer;
    mapped: boolean;
    cleaned: boolean;
}
/** One cleanup attempt per captured resource, including best-effort failure paths. */
export function cleanupWebGPUBuffer(resource: OwnedWebGPUBuffer): unknown[] {
    if (resource.cleaned) return [];
    resource.cleaned = true; const errors: unknown[] = [];
    if (resource.mapped) { resource.mapped = false; try { resource.unmap(); } catch (cause) { errors.push(cause); } }
    try { resource.destroy(); } catch (cause) { errors.push(cause); }
    return errors;
}

export interface OwnedWebGPUTexture {
    readonly texture: GPUTexture;
    readonly destroy: () => void;
    cleaned: boolean;
}
/** Mark the attempt before calling captured cleanup, including throwing or reentrant paths. */
export function cleanupWebGPUTexture(resource: OwnedWebGPUTexture): unknown[] {
    if (resource.cleaned) return [];
    resource.cleaned = true;
    try { resource.destroy(); return []; } catch (cause) { return [cause]; }
}
