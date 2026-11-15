import type { Disposable, HostAdapter } from '@egret/contracts';
/**
 * Host adapter that reserves `canvas` for one Engine. The world3d renderer
 * owns the WebGL context, so this host has no device to start or close.
 */
export declare function createWorld3DHost(canvas: HTMLCanvasElement | OffscreenCanvas): HostAdapter;
export interface World3DLoopSource {
    advanceTime(sourceSeconds: number): unknown;
    readonly clock: {
        readonly maxDeltaSeconds: number;
        pause(): void;
        resume(): void;
    };
}
/**
 * Advance the Engine clock once per display frame. A gap longer than the
 * clock's delta limit (a hidden tab, a long shader compile) re-anchors the
 * clock instead of producing one oversized step. Dispose the returned handle
 * before disposing the Engine. Failures stop the loop and go to `onError`
 * when given, otherwise they surface as uncaught errors.
 */
export declare function startWorld3DLoop(engine: World3DLoopSource, onError?: (cause: unknown) => void): Disposable;
//# sourceMappingURL=host3D.d.ts.map