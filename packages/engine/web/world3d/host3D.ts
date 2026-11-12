// SPDX-License-Identifier: Apache-2.0
// Minimal browser host for applications whose only surface is a world3d
// canvas, plus an animation-frame loop feeding the explicit Engine clock.
import type {Disposable, HostAdapter} from '@egret/contracts';
import {World3DError} from '../../rendering/world3d/core3D.js';

/**
 * Host adapter that reserves `canvas` for one Engine. The world3d renderer
 * owns the WebGL context, so this host has no device to start or close.
 */
export function createWorld3DHost(canvas: HTMLCanvasElement | OffscreenCanvas): HostAdapter {
    if (typeof canvas !== 'object' || canvas === null) throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas');
    return {
        surface: canvas,
        start(): void {},
        stop(): void {},
        async close(): Promise<void> {},
        setTimeout(callback: () => void, delayMs: number): () => void {
            const timer = setTimeout(callback, delayMs);
            return () => clearTimeout(timer);
        },
    };
}

export interface World3DLoopSource {
    advanceTime(sourceSeconds: number): unknown;
    readonly clock: {readonly maxDeltaSeconds: number; pause(): void; resume(): void};
}
/**
 * Advance the Engine clock once per display frame. A gap longer than the
 * clock's delta limit (a hidden tab, a long shader compile) re-anchors the
 * clock instead of producing one oversized step. Dispose the returned handle
 * before disposing the Engine. Failures stop the loop and go to `onError`
 * when given, otherwise they surface as uncaught errors.
 */
export function startWorld3DLoop(engine: World3DLoopSource, onError?: (cause: unknown) => void): Disposable {
    if (!engine || typeof engine.advanceTime !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'engine');
    let request = 0, stopped = false, previous: number | undefined;
    const frame = (milliseconds: number): void => {
        if (stopped) return;
        request = requestAnimationFrame(frame);
        const seconds = milliseconds / 1000;
        try {
            if (previous !== undefined && seconds - previous > engine.clock.maxDeltaSeconds) {
                // Resuming discards the old anchor, so this sample dispatches no tick.
                engine.clock.pause();
                engine.clock.resume();
            }
            previous = seconds;
            engine.advanceTime(seconds);
        }
        catch (cause) {
            stopped = true;
            cancelAnimationFrame(request);
            if (!onError) throw cause;
            onError(cause);
        }
    };
    request = requestAnimationFrame(frame);
    return {dispose(): void { stopped = true; cancelAnimationFrame(request); }};
}
