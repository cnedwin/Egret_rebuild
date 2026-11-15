export interface EgretErrorOptions {
    readonly cause?: unknown;
    readonly cleanupErrors?: readonly unknown[];
}
/** Stable machine-readable code, original cause, and associated cleanup failures. The message is for people and may change. */
export declare class EgretError extends Error {
    readonly code: string;
    readonly cleanupErrors: readonly unknown[];
    constructor(code: string, options?: EgretErrorOptions);
}
//# sourceMappingURL=EgretError.d.ts.map