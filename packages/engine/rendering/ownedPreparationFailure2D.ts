// Synchronous, module-owned provenance. Error spelling or constructor is never authority.
let current: object | undefined;
const origins = new WeakMap<object, object>();

/** Note only a fresh deliberate first-party failure at its creation site. */
export function noteOwnedPreparationFailure<T extends object>(error: T): T {
    if (current !== undefined && !origins.has(error)) origins.set(error, current);
    return error;
}

/** Report the exact escaping object created under this invocation; preserve all throws. */
export function runOwnedPreparationScope<T>(operation: () => T, privateObserver: (error: object) => void): T {
    const parent = current, token = {};
    current = token;
    try { return operation(); }
    catch (failure) {
        if (((typeof failure === 'object' && failure !== null) || typeof failure === 'function') && origins.get(failure) === token) {
            try { privateObserver(failure); } finally { throw failure; }
        }
        throw failure;
    } finally { current = parent; }
}
