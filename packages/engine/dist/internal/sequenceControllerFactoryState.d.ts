import { Scope } from '@egret/runtime';
import type { Diagnostic, ScopeValue } from '@egret/contracts';
import type { GameClock } from '../gameClockTypes.js';
import type { SequenceTargetClaims } from '../sequenceTargetClaims.js';
export interface SequenceScopePort {
    readonly scope: Scope;
    assertOpen(): void;
    use(value: ScopeValue): void;
    dispose(): void;
    add(listener: () => void): void;
    remove(listener: () => void): void;
}
export interface SequenceControllerEnginePort {
    assertOpen(): void;
    scope(value: unknown): SequenceScopePort;
    createScope(): SequenceScopePort;
    readonly clock: GameClock;
    isClockBusy(): boolean;
    readonly claims: SequenceTargetClaims;
    onClose(callback: () => void): () => void;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
}
interface SequenceControllerAssembly {
    assertOpen(): void;
    createScope(): Scope;
    readonly clock: GameClock;
    isClockBusy(): boolean;
    readonly claims: SequenceTargetClaims;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
}
export interface SequenceControllerEngineOwner {
    registerScope(scope: Scope): void;
    close(): void;
}
/** Capture authentic lifecycle and clock authority without loading optional animation logic. */
export declare function registerSequenceControllerEngine(engine: object, assembly: SequenceControllerAssembly): SequenceControllerEngineOwner;
/** Public factory arguments grant no authority: only the original Engine identity is admitted. */
export declare function requireSequenceControllerEngine(engine: unknown): SequenceControllerEnginePort;
export {};
//# sourceMappingURL=sequenceControllerFactoryState.d.ts.map