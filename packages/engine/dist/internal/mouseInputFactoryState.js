import { Bitmap, DisplayObject, EgretError } from '@egret/runtime';
const engines = new WeakMap();
const engineTokens = new WeakMap();
const scopeOrigins = new WeakMap();
/** Assembly installs authority before publishing the genuine Engine. */
export function registerMouseInputEngine(engine, port) {
    engines.set(engine, port);
    engineTokens.set(engine, {});
}
export function requireMouseInputEngine(engine) {
    const port = engines.get(engine);
    if (port === undefined)
        throw new EgretError('MOUSE_INPUT_INVALID');
    port.assertReady();
    return port;
}
/** Successful Host startup is separate from ordinary open-state observation. */
export function markMouseInputEngineStarted(engine) {
    engines.get(engine)?.markStarted();
}
/** Eager Engine assembly records genuine Scope origin without retaining its Engine. */
export function registerMouseInputScope(scope, engine) {
    const origin = engineTokens.get(engine);
    if (origin === undefined)
        throw new EgretError('MOUSE_INPUT_INVALID');
    scopeOrigins.set(scope, origin);
}
/** Button admission distinguishes foreign genuine Scope from an unregistered value. */
export function assertBitmapButtonScopeOrigin(scope, engine) {
    const origin = scopeOrigins.get(scope);
    if (origin === undefined)
        throw new EgretError('MOUSE_INPUT_SCOPE_INVALID');
    if (origin !== engineTokens.get(engine))
        throw new EgretError('ENGINE_MISMATCH');
}
const inputs = new WeakMap();
/** Keep only an opaque origin token after input retirement, not its Engine. */
export function registerMouseInputInstance(input, engine, port) {
    const engineToken = engineTokens.get(engine);
    if (engineToken === undefined)
        throw new EgretError('MOUSE_INPUT_INVALID');
    inputs.set(input, { engineToken, port });
}
export function requireBitmapButtonInput(input, engine) {
    const identity = inputs.get(input);
    if (identity === undefined)
        throw new EgretError('MOUSE_INPUT_INVALID');
    if (identity.engineToken !== engineTokens.get(engine))
        throw new EgretError('ENGINE_MISMATCH');
    identity.port.assertOpen();
    return identity.port;
}
// This module is already eagerly reached by Engine -> mouseInput before SDK
// publication. A late optional input import reuses these original public ports.
// Prototype/intrinsic replacement before trusted eager initialization is outside
// this profile; no hostile-realm or arbitrary JavaScript isolation is promised.
const APPLY = Reflect.apply;
const LEASE = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'textureLease').get;
const SET_LEASE = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'textureLease').set;
const CROP = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'sourceRect').get;
const SET_CROP = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'sourceRect').set;
const HIT = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'hitArea').get;
const SET_HIT = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'hitArea').set;
const TOUCH = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'touchEnabled').get;
const SET_TOUCH = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'touchEnabled').set;
const DISPOSED = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'isDisposed').get;
const DISPOSE = Bitmap.prototype.dispose;
const DISPOSE_DISPLAY = DisplayObject.prototype.dispose;
/** Public accessors read original private slots despite later instance/prototype shadows. */
export const bitmapButtonOperations = Object.freeze({
    lease(bitmap) {
        return APPLY(LEASE, bitmap, []);
    },
    crop(bitmap) {
        return APPLY(CROP, bitmap, []);
    },
    hit(bitmap) {
        return APPLY(HIT, bitmap, []);
    },
    touch(bitmap) {
        return APPLY(TOUCH, bitmap, []);
    },
    disposed(bitmap) {
        return APPLY(DISPOSED, bitmap, []);
    },
    setLease(bitmap, lease) {
        APPLY(SET_LEASE, bitmap, [lease]);
    },
    setCrop(bitmap, crop) {
        APPLY(SET_CROP, bitmap, [crop]);
    },
    setHit(bitmap, hit) {
        APPLY(SET_HIT, bitmap, [hit]);
    },
    setTouch(bitmap, enabled) {
        APPLY(SET_TOUCH, bitmap, [enabled]);
    },
    dispose(bitmap) {
        APPLY(DISPOSE, bitmap, []);
    },
    disposeDisplay(bitmap) {
        APPLY(DISPOSE_DISPLAY, bitmap, []);
    },
    invoke(callback, payload) {
        return APPLY(callback, undefined, [payload]);
    }
});
const INPUT_PARENT = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'parent').get;
const INPUT_VISIBLE = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'visible').get;
const inputRuntimePrimitives = Object.freeze({
    parent(target) {
        return APPLY(INPUT_PARENT, target, []);
    },
    visible(target) {
        return APPLY(INPUT_VISIBLE, target, []);
    },
    disposed(target) {
        return APPLY(DISPOSED, target, []);
    }
});
/** Optional keyboard admission reuses getters captured before Engine publication. */
export function captureMouseInputRuntimePrimitives() {
    return inputRuntimePrimitives;
}
//# sourceMappingURL=mouseInputFactoryState.js.map