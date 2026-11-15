// SPDX-License-Identifier: Apache-2.0
// Shared error type, identity counters and the disposable resource base used
// by geometries, textures and materials. DOM-free; no backend dependency.
/** Stable machine-readable code plus a human-readable detail and the original cause. */
export class World3DError extends Error {
    code;
    detail;
    constructor(code, detail, cause) {
        super(detail === undefined ? code : code + ': ' + detail, { cause });
        this.name = 'World3DError';
        this.code = code;
        this.detail = detail;
    }
}
let nextId = 1;
/** Process-unique positive integer identity for sort keys and cache lookups. */
export function allocateId3D() {
    return nextId++;
}
export function requireFinite3D(value, field) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return value;
}
export function requirePositive3D(value, field) {
    const number = requireFinite3D(value, field);
    if (number <= 0)
        throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return number;
}
export function requireCount3D(value, field, max) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
        throw new World3DError('WORLD3D_INPUT_INVALID', field);
    if (value > max)
        throw new World3DError('WORLD3D_BUDGET', field);
    return value;
}
/**
 * CPU-side resource with a version counter and terminal disposal.
 * Backends subscribe through onDispose to retire their GPU objects; the
 * resource never references a backend, so the core stays host-independent.
 */
export class Resource3D {
    id = allocateId3D();
    name = '';
    #version = 1;
    #disposed = false;
    #listeners;
    /** Increases whenever content changed and a backend copy must be refreshed. */
    get version() {
        return this.#version;
    }
    get isDisposed() {
        return this.#disposed;
    }
    /** Mark CPU content as changed. */
    touch() {
        this.#version++;
    }
    /** Returns an unsubscribe function. Listeners run once, in registration order. */
    onDispose(listener) {
        if (this.#disposed) {
            listener();
            return () => { };
        }
        (this.#listeners ??= new Set()).add(listener);
        return () => {
            this.#listeners?.delete(listener);
        };
    }
    /** Idempotent. Listener failures are collected and rethrown after all have run. */
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        const listeners = this.#listeners;
        this.#listeners = undefined;
        if (!listeners)
            return;
        const failures = [];
        for (const listener of listeners) {
            try {
                listener();
            }
            catch (cause) {
                failures.push(cause);
            }
        }
        if (failures.length === 1)
            throw failures[0];
        if (failures.length > 1)
            throw new AggregateError(failures, 'WORLD3D_RESOURCE_FAILED');
    }
    assertLive() {
        if (this.#disposed)
            throw new World3DError('WORLD3D_DISPOSED', this.name || undefined);
    }
}
//# sourceMappingURL=core3D.js.map