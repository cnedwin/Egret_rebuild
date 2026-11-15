import type { CancellationSignal, ScopeValue } from "@egret/contracts";
import type { EngineContext } from "./ownership.js";
export type ScopeState = "open" | "closing" | "closed";
export declare let createScope: (engine: EngineContext, onClosed: (scope: Scope) => void) => Scope;
/** Runtime-private identity for owner-chain lifetime validation. */
export declare function isScope(value: object): value is Scope;
/** Synchronous ownership boundary. Use Engine.createScope() to obtain one. */
export declare class Scope {
    #private;
    readonly signal: CancellationSignal;
    private constructor();
    get state(): ScopeState;
    /** Accept one cleanup owner after callback-free validation of the current tree. */
    use<T extends ScopeValue>(value: T): T;
    /** Cancel first, then clean up in reverse acquisition order despite failures. */
    dispose(): void;
}
//# sourceMappingURL=Scope.d.ts.map