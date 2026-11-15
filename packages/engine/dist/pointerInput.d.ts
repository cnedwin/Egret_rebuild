import type { PointerInput, PointerInputOptions } from './pointerInputTypes.js';
export type { PointerInput, PointerInputOptions, PointerInputEvents, PointerNotification, PointerCancelReason, PointerContact, PointerEventKind, PointerSample, PointerSession, PointerType, PointerUpdate, PointerRouterState } from './pointerInputTypes.js';
interface SurfaceBinding {
    readonly surface: object;
    report(cause: unknown): void;
    onClose(callback: () => void): () => void;
}
/** Private browser assembly authority; never exported by the optional public entry. */
export declare function bindPointerSurface(input: PointerInput): SurfaceBinding;
export declare function createPointerInput(options: PointerInputOptions): PointerInput;
//# sourceMappingURL=pointerInput.d.ts.map