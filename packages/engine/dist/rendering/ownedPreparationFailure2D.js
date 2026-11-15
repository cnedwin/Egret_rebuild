// Synchronous, module-owned provenance. Error spelling or constructor is never authority.
let current;
const origins = new WeakMap();
/** Note only a fresh deliberate first-party failure at its creation site. */
export function noteOwnedPreparationFailure(error) {
    if (current !== undefined && !origins.has(error))
        origins.set(error, current);
    return error;
}
/** Report the exact escaping object created under this invocation; preserve all throws. */
export function runOwnedPreparationScope(operation, privateObserver) {
    const parent = current, token = {};
    current = token;
    try {
        return operation();
    }
    catch (failure) {
        if (((typeof failure === 'object' && failure !== null) || typeof failure === 'function') &&
            origins.get(failure) === token) {
            try {
                privateObserver(failure);
            }
            finally {
                throw failure;
            }
        }
        throw failure;
    }
    finally {
        current = parent;
    }
}
//# sourceMappingURL=ownedPreparationFailure2D.js.map