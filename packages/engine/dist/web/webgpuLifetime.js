/** Immediate observation and settlement, separate from successful retirement. */
export function observed(value) {
    const promise = Promise.resolve(value);
    promise.catch(() => undefined);
    return promise;
}
/** Separate lexical scope ensures a healthy borrowed lost Promise retains only its cell. */
export function observeWebGPUDeviceLoss(value, cell) {
    observed(value).then(info => cell.notify?.(info), cause => cell.notify?.(cause));
}
/** Authenticated observers retain only a detachable cell, including the rejection path. */
export function observeAuthenticatedWebGPUDeviceLoss(value, cell) {
    observed(value).then(info => cell.notify?.(info), cause => cell.unknown?.(cause));
}
export { deferred } from './sharedHostDeferred.js';
/** One cleanup attempt per captured resource, including best-effort failure paths. */
export function cleanupWebGPUBuffer(resource) {
    if (resource.cleaned)
        return [];
    resource.cleaned = true;
    if (resource.generation?.invalidated) {
        resource.mapped = false;
        resource.settlement = 'context-invalidated';
        return [];
    }
    const errors = [];
    if (resource.mapped) {
        resource.mapped = false;
        try {
            resource.unmap();
        }
        catch (cause) {
            errors.push(cause);
        }
    }
    try {
        resource.destroy();
    }
    catch (cause) {
        errors.push(cause);
    }
    resource.settlement = errors.length === 0 ? 'destroyed' : 'unknown';
    return errors;
}
/** Mark the attempt before calling captured cleanup, including throwing or reentrant paths. */
export function cleanupWebGPUTexture(resource) {
    if (resource.cleaned)
        return [];
    resource.cleaned = true;
    if (resource.generation?.invalidated) {
        resource.settlement = 'context-invalidated';
        return [];
    }
    try {
        resource.destroy();
        resource.settlement = 'destroyed';
        return [];
    }
    catch (cause) {
        resource.settlement = 'unknown';
        return [cause];
    }
}
//# sourceMappingURL=webgpuLifetime.js.map