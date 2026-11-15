export type World3DErrorCode = 'WORLD3D_INPUT_INVALID' | 'WORLD3D_BUDGET' | 'WORLD3D_DISPOSED' | 'WORLD3D_HIERARCHY_INVALID' | 'WORLD3D_GLTF_INVALID' | 'WORLD3D_GLTF_UNSUPPORTED' | 'WORLD3D_RESOURCE_FAILED' | 'WORLD3D_CONTEXT_UNAVAILABLE' | 'WORLD3D_CONTEXT_LOST' | 'WORLD3D_SHADER_FAILED';
/** Stable machine-readable code plus a human-readable detail and the original cause. */
export declare class World3DError extends Error {
    readonly code: World3DErrorCode;
    readonly detail: string | undefined;
    constructor(code: World3DErrorCode, detail?: string, cause?: unknown);
}
/** Process-unique positive integer identity for sort keys and cache lookups. */
export declare function allocateId3D(): number;
export declare function requireFinite3D(value: unknown, field: string): number;
export declare function requirePositive3D(value: unknown, field: string): number;
export declare function requireCount3D(value: unknown, field: string, max: number): number;
export type DisposeListener3D = () => void;
/**
 * CPU-side resource with a version counter and terminal disposal.
 * Backends subscribe through onDispose to retire their GPU objects; the
 * resource never references a backend, so the core stays host-independent.
 */
export declare abstract class Resource3D {
    #private;
    readonly id: number;
    name: string;
    /** Increases whenever content changed and a backend copy must be refreshed. */
    get version(): number;
    get isDisposed(): boolean;
    /** Mark CPU content as changed. */
    touch(): void;
    /** Returns an unsubscribe function. Listeners run once, in registration order. */
    onDispose(listener: DisposeListener3D): () => void;
    /** Idempotent. Listener failures are collected and rethrown after all have run. */
    dispose(): void;
    protected assertLive(): void;
}
//# sourceMappingURL=core3D.d.ts.map