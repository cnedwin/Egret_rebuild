// SPDX-License-Identifier: Apache-2.0
// Reads what a frame loop already counts: its state, the steps it took, the
// frames it drew and the frames it skipped because the host was still busy.
import type { SourceValues } from './types.js';

/** The part of a frame loop this module reads: createBrowserFrameLoop, or the loop of createBrowserGame. */
export interface FrameLoopLike {
    snapshot(): {
        readonly state?: unknown; readonly steps?: unknown; readonly frames?: unknown;
        readonly skipped?: unknown; readonly seconds?: unknown; readonly failure?: unknown;
    };
}

export interface FrameLoopSourceOptions {
    /** Millisecond clock. Default performance.now(). */
    readonly now?: () => number;
    /** The share of skipped frames is taken over spans of this many milliseconds. Default 1000. */
    readonly windowMs?: number;
}

const whole = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** What stopped a loop, as a short text: an error's code, else its message. */
function describe(failure: unknown): string {
    if (failure !== null && typeof failure === 'object') {
        const { code, message } = failure as { readonly code?: unknown; readonly message?: unknown };
        if (typeof code === 'string' && code.length > 0) return code;
        if (typeof message === 'string' && message.length > 0) return message;
    }
    return String(failure);
}

/**
 * A source for monitor.addSource('loop', ...). Besides the loop's own counts
 * it gives skippedShare: the part of the latest span's steps that drew nothing.
 */
export function frameLoopSource(loop: FrameLoopLike, options: FrameLoopSourceOptions = {}): () => SourceValues {
    const clock = (globalThis as { readonly performance?: { now(): number } }).performance;
    const now = options.now ?? ((): number => clock === undefined ? Date.now() : clock.now());
    const windowMs = options.windowMs ?? 1000;
    let baseAt: number | undefined, baseSteps = 0, baseSkipped = 0, share = 0;
    return () => {
        const read = loop.snapshot(), at = now(), steps = whole(read.steps), skipped = whole(read.skipped);
        if (baseAt === undefined || steps < baseSteps) { baseAt = at; baseSteps = steps; baseSkipped = skipped; share = 0; }
        else if (at - baseAt >= windowMs) {
            share = steps > baseSteps ? Math.round(100 * (skipped - baseSkipped) / (steps - baseSteps)) / 100 : 0;
            baseAt = at; baseSteps = steps; baseSkipped = skipped;
        }
        const out: Record<string, number | string | boolean | null> = {
            state: typeof read.state === 'string' ? read.state : 'unknown',
            steps, frames: whole(read.frames), skipped, skippedShare: share, seconds: Math.round(whole(read.seconds) * 10) / 10,
        };
        if (read.failure !== undefined && read.failure !== null) out['failure'] = describe(read.failure);
        return out;
    };
}
