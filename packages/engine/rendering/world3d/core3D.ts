// SPDX-License-Identifier: Apache-2.0
// Shared error type, identity counters and the disposable resource base used
// by geometries, textures and materials. DOM-free; no backend dependency.

export type World3DErrorCode =
    | 'WORLD3D_INPUT_INVALID' | 'WORLD3D_BUDGET' | 'WORLD3D_DISPOSED' | 'WORLD3D_HIERARCHY_INVALID'
    | 'WORLD3D_GLTF_INVALID' | 'WORLD3D_GLTF_UNSUPPORTED' | 'WORLD3D_RESOURCE_FAILED'
    | 'WORLD3D_CONTEXT_UNAVAILABLE' | 'WORLD3D_CONTEXT_LOST' | 'WORLD3D_SHADER_FAILED';

/** Stable machine-readable code plus a human-readable detail and the original cause. */
export class World3DError extends Error {
    readonly code: World3DErrorCode;
    readonly detail: string | undefined;
    constructor(code: World3DErrorCode, detail?: string, cause?: unknown) {
        super(detail === undefined ? code : code + ': ' + detail, {cause});
        this.name = 'World3DError';
        this.code = code;
        this.detail = detail;
    }
}

let nextId = 1;
/** Process-unique positive integer identity for sort keys and cache lookups. */
export function allocateId3D(): number {
    return nextId++;
}

export function requireFinite3D(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return value;
}
export function requirePositive3D(value: unknown, field: string): number {
    const number = requireFinite3D(value, field);
    if (number <= 0) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return number;
}
export function requireCount3D(value: unknown, field: string, max: number): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    if (value > max) throw new World3DError('WORLD3D_BUDGET', field);
    return value;
}

export type DisposeListener3D = () => void;

/**
 * CPU-side resource with a version counter and terminal disposal.
 * Backends subscribe through onDispose to retire their GPU objects; the
 * resource never references a backend, so the core stays host-independent.
 */
export abstract class Resource3D {
    readonly id = allocateId3D();
    name = '';
    #version = 1;
    #disposed = false;
    #listeners: Set<DisposeListener3D> | undefined;

    /** Increases whenever content changed and a backend copy must be refreshed. */
    get version(): number { return this.#version; }
    get isDisposed(): boolean { return this.#disposed; }
    /** Mark CPU content as changed. */
    touch(): void { this.#version++; }
    /** Returns an unsubscribe function. Listeners run once, in registration order. */
    onDispose(listener: DisposeListener3D): () => void {
        if (this.#disposed) { listener(); return () => {}; }
        (this.#listeners ??= new Set()).add(listener);
        return () => { this.#listeners?.delete(listener); };
    }
    /** Idempotent. Listener failures are collected and rethrown after all have run. */
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        const listeners = this.#listeners;
        this.#listeners = undefined;
        if (!listeners) return;
        const failures: unknown[] = [];
        for (const listener of listeners) {
            try { listener(); } catch (cause) { failures.push(cause); }
        }
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) throw new AggregateError(failures, 'WORLD3D_RESOURCE_FAILED');
    }
    protected assertLive(): void {
        if (this.#disposed) throw new World3DError('WORLD3D_DISPOSED', this.name || undefined);
    }
}
