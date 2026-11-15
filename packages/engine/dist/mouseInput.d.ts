import { EgretError, Scope } from '@egret/runtime';
import type { DisplayInputOperations, DisplayObject } from '@egret/runtime';
import type { CancellationSignal, Diagnostic, ScopeValue } from '@egret/contracts';
import type { MouseInput, MouseInputEvents, MouseInputOptions, MouseInputState } from './mouseInputTypes.js';
import type { BitmapButtonAssociation } from './internal/mouseInputFactoryState.js';
export type { MouseInputOptions, MouseInput, MouseInputState, MouseInputEvents, MouseInputPayload, MouseInputCancelReason } from './mouseInputTypes.js';
export { createBitmapButton } from './bitmapButton.js';
export type { BitmapButton, BitmapButtonOptions, BitmapButtonState } from './bitmapButtonTypes.js';
export type MouseInputNativeKind = 'down' | 'up' | 'cancel' | 'blur' | 'pagehide';
export type MouseInputNativeListener = (event?: unknown) => void;
export interface MouseInputPoint {
    readonly x: number;
    readonly y: number;
}
export interface MouseInputNativePair {
    readonly kind: MouseInputNativeKind;
    add(listener: MouseInputNativeListener): void;
    remove(listener: MouseInputNativeListener): void;
}
/** DOM-free assembly port; the optional browser adapter supplies genuine native operations. */
export interface MouseInputNativePorts {
    readonly pairs: readonly MouseInputNativePair[];
    pointer(event: unknown, kind: 'down' | 'up' | 'cancel', heldId: number | undefined): number | undefined;
    windowEvent(event: unknown, kind: 'blur' | 'pagehide'): boolean;
    point(event: unknown): MouseInputPoint;
}
export type MouseInputNativeFactory = (surface: object, width: number, height: number, assertLive: () => void) => MouseInputNativePorts;
interface ScopePorts {
    readonly scope: Scope;
    readonly signal: CancellationSignal;
    assertOpen(): void;
    use(value: ScopeValue): void;
    add(listener: MouseInputNativeListener): void;
    remove(listener: MouseInputNativeListener): void;
}
export interface MouseInputEnginePort {
    readonly surface: object;
    readonly operations: DisplayInputOperations;
    assertReady(): void;
    assertOpen(): void;
    markStarted(): void;
    scope(value: unknown): ScopePorts;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
    onClose(listener: () => void): () => void;
    addRecord(record: InputRecord): void;
    removeRecord(record: InputRecord): void;
}
export interface MouseInputOwner {
    registerScope(scope: Scope): void;
    close(): void;
}
export interface MouseInputAssembly {
    readonly surface: object;
    readonly operations: DisplayInputOperations;
    assertOpen(): void;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
}
/** Signal methods are captured per assembly, permitting transparent pre-assembly observation. */
export declare function createMouseInputOwner(engine: object, assembly: MouseInputAssembly): MouseInputOwner;
interface HeldPress {
    readonly target: DisplayObject;
    readonly id: number;
    readonly point: MouseInputPoint;
    beginAllowed: boolean;
    readonly token: object;
    readonly button: BitmapButtonAssociation | undefined;
}
interface AttemptedPair {
    readonly listener: MouseInputNativeListener;
    readonly add: (listener: MouseInputNativeListener) => void;
    readonly remove: (listener: MouseInputNativeListener) => void;
    inFlight: boolean;
    addSucceeded: boolean;
    removeAttempted: boolean;
    removeSucceeded: boolean;
}
interface InputRecord {
    state: MouseInputState;
    phase: 'acquiring' | 'ready' | 'retiring' | 'closed';
    busy: boolean;
    failureEpisode: boolean;
    failureCause: unknown;
    failureError: EgretError | undefined;
    owner: MouseInputEnginePort | undefined;
    scope: ScopePorts | undefined;
    native: MouseInputNativePorts | undefined;
    held: HeldPress | undefined;
    readonly events: MouseInputEvents;
    readonly buttons: Map<DisplayObject, BitmapButtonAssociation>;
    readonly maximum: number;
    readonly token: object;
    surface: object | undefined;
    pairs: AttemptedPair[];
    readonly cleanupErrors: unknown[];
    retirement: 'owner' | 'explicit' | 'native' | 'setup' | undefined;
    wasAcquiring: boolean;
}
/** The browser entry admits options before reading any DOM capabilities or installing listeners. */
export declare function createMouseInputWithNative(options: MouseInputOptions, nativeFactory: MouseInputNativeFactory): MouseInput;
//# sourceMappingURL=mouseInput.d.ts.map