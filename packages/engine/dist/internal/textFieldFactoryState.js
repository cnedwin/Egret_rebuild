import { EgretError } from '@egret/runtime';
const engines = new WeakMap();
/** Only Engine assembly can install the closed-over instance/cache authority. */
export function registerTextFieldEngine(engine, assertOpen, isEngineScope) {
    const caches = new WeakMap();
    const port = Object.freeze({
        assertOpen,
        isEngineScope,
        registerCache(cache, construct, kind = 'explicit-lines') {
            assertOpen();
            caches.set(cache, { construct, kind });
        },
        construct(scope, cache, kind = 'explicit-lines') {
            assertOpen();
            if (!isEngineScope(scope))
                throw new EgretError('TEXT_FIELD_INVALID');
            const registered = caches.get(cache);
            if (registered === undefined || registered.kind !== kind)
                throw new EgretError('TEXT_FIELD_INVALID');
            return registered.construct(scope);
        }
    });
    engines.set(engine, port);
    return port;
}
export function requireTextFieldEngine(engine) {
    const port = engines.get(engine);
    if (port === undefined)
        throw new EgretError('TEXT_FIELD_INVALID');
    return port;
}
//# sourceMappingURL=textFieldFactoryState.js.map