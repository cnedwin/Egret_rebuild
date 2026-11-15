// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const invalid = () => new EgretError('FRAME_LOOP_OPTIONS_INVALID');
const backpressure = (error) => {
    const cause = error?.cause;
    return typeof cause?.code === 'string' && cause.code.endsWith('_BACKPRESSURE');
};
/**
 * The frame loop of a game in a page. On each frame the display shows, it advances the Engine's clock, which moves
 * tweens and sequences, calls `update`, and draws one frame. It keeps a step short after the page was hidden, and it
 * skips a frame, without failing, while the Host has not finished the frames it holds.
 */
export function createBrowserFrameLoop(options) {
    if (options === null || typeof options !== 'object')
        throw invalid();
    const { engine, frame, host, update, onError } = options, limit = options.maxPendingFrames ?? 2;
    const request = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    const cancel = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    if (engine === null ||
        typeof engine !== 'object' ||
        typeof engine.advanceTime !== 'function' ||
        typeof engine.renderSharedFrame !== 'function' ||
        frame === undefined ||
        frame === null ||
        (host !== undefined && (host === null || typeof host !== 'object' || typeof host.getStatus !== 'function')) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        (update !== undefined && typeof update !== 'function') ||
        (onError !== undefined && typeof onError !== 'function') ||
        typeof request !== 'function' ||
        typeof cancel !== 'function')
        throw invalid();
    const clockLimit = engine.clock?.maxDeltaSeconds, asked = options.maxStepSeconds ?? 0.1;
    if (typeof clockLimit !== 'number' || !(clockLimit > 0) || typeof asked !== 'number' || !(asked > 0))
        throw invalid();
    const maxStep = Math.min(asked, clockLimit);
    let state = 'idle', handle, last;
    let seconds = 0, steps = 0, frames = 0, skipped = 0, failure;
    const tick = (milliseconds) => {
        handle = undefined;
        if (state !== 'running')
            return;
        try {
            // The clock is given the loop's own seconds, which never jump: a long gap counts as one step of the longest length.
            const delta = last === undefined ? 0 : Math.min(maxStep, Math.max(0, (milliseconds - last) / 1000));
            last = milliseconds;
            seconds += delta;
            engine.advanceTime(seconds);
            steps++;
            update?.(delta);
            // The update may have stopped or disposed the loop.
            if (state !== 'running')
                return;
            if (host !== undefined && host.getStatus().pendingFrames >= limit)
                skipped++;
            else {
                try {
                    engine.renderSharedFrame(typeof frame === 'function' ? frame() : frame);
                    frames++;
                }
                catch (error) {
                    if (host !== undefined || !backpressure(error))
                        throw error;
                    skipped++;
                }
            }
            handle = request(tick);
        }
        catch (error) {
            state = 'failed';
            failure = error;
            if (onError === undefined)
                throw error;
            onError(error);
        }
    };
    const stop = () => {
        if (handle !== undefined) {
            cancel(handle);
            handle = undefined;
        }
        if (state === 'running')
            state = 'idle';
    };
    const loop = {
        get state() {
            return state;
        },
        start() {
            if (state === 'closed')
                throw new EgretError('FRAME_LOOP_CLOSED');
            if (state === 'running')
                return;
            // What stopped the loop is forgotten when it is started again; the gap since it ran is not a step.
            state = 'running';
            failure = undefined;
            last = undefined;
            handle = request(tick);
        },
        stop,
        snapshot: () => Object.freeze({ state, steps, frames, skipped, seconds, failure }),
        dispose() {
            stop();
            state = 'closed';
        }
    };
    return Object.freeze(loop);
}
//# sourceMappingURL=BrowserFrameLoop.js.map