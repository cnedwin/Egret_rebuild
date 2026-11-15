import { Scope } from '@egret/runtime';
import type { Stage, DisplayObjectContainer } from '@egret/runtime';
import type { CancellationSignal, Diagnostic, ScopeValue } from '@egret/contracts';
import type { createUiDisplayOperations, UiDisplayOperations } from '@egret/runtime/ui';
import type { PointerInputEvents, PointerRouterState } from '../pointerInputTypes.js';
import type { KeyboardInput } from '../keyboardInputTypes.js';
export interface UiScopePort {
    readonly scope: Scope;
    readonly signal: CancellationSignal;
    assertOpen(): void;
    use(value: ScopeValue): void;
    dispose(): void;
    add(listener: () => void): void;
    remove(listener: () => void): void;
}
export interface UiInputPort {
    readonly events: PointerInputEvents;
    state(): PointerRouterState;
    activeContacts(): number;
    sync(): void;
}
export interface UiKeyboardScope {
    setRoots(roots: readonly DisplayObjectContainer[] | undefined): void;
    /** Default layer focus is programmatic, never a synthetic Tab gesture. */
    focusFirst(): void;
    release(): void;
}
export interface UiEnginePort {
    readonly stage: Stage;
    terminal(): boolean;
    keyboardScope(input: KeyboardInput, owner: object): UiKeyboardScope;
    assertOpen(): void;
    assertIdle(): void;
    isEngineScope(value: unknown): value is Scope;
    createScope(): Scope;
    scope(value: unknown): UiScopePort;
    display(factory: typeof createUiDisplayOperations): UiDisplayOperations;
    requireInput(value: unknown): UiInputPort;
    requireKeyboard(value: unknown): KeyboardInput;
    onClose(callback: () => void): () => void;
}
interface UiAssembly {
    readonly stage: Stage;
    assertOpen(): void;
    isFrameBusy(): boolean;
    createScope(): Scope;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
}
export interface UiEngineOwner {
    registerScope(scope: Scope): void;
    deliver<T>(callback: () => T): T;
    close(): void;
}
/** Eager assembly captures authority; optional UI logic and numerical modules stay lazy. */
export declare function registerUiEngine(engine: object, assembly: UiAssembly): UiEngineOwner;
/** Genuine Engine and PointerInput facades are admitted by identity, never shape. */
export declare function requireUiEngine(engine: unknown): UiEnginePort;
export declare function captureUiInputDelivery(engine: object): UiEngineOwner['deliver'];
export declare function registerUiPointerInput(input: object, engine: object, port: UiInputPort): void;
/** Register only an authentic channel assembled against this Engine. */
export declare function registerUiKeyboardInput(input: KeyboardInput, engine: object, claim: (owner: object) => UiKeyboardScope): void;
export {};
//# sourceMappingURL=uiFactoryState.d.ts.map