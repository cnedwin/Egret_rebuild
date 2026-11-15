/** What the loop asks of an Engine: its clock's limit, time and frames. `F` is what `renderSharedFrame` takes. */
export interface FrameLoopEngine<F> {
    readonly clock: {
        readonly maxDeltaSeconds: number;
    };
    advanceTime(sourceSeconds: number): unknown;
    renderSharedFrame(options: F): unknown;
}
/** What the loop asks of a Host: how many frames it holds that it has not finished. Both shared Hosts have it. */
export interface FrameLoopHost {
    getStatus(): {
        readonly pendingFrames: number;
    };
}
export interface BrowserFrameLoopOptions<F> {
    readonly engine: FrameLoopEngine<F>;
    /** The frame to draw: its size and clear colour. A function is called for each frame that is drawn. */
    readonly frame: F | (() => F);
    /** The Host the Engine draws with. With it, a frame is skipped while the Host holds `maxPendingFrames`, instead of being refused. */
    readonly host?: FrameLoopHost;
    /** How many unfinished frames a Host takes; 2, as both shared Hosts take unless they are made with another number. */
    readonly maxPendingFrames?: number;
    /** One step of the game, called before each frame with the seconds since the step before: 0 at first, never more than `maxStepSeconds`. */
    readonly update?: (deltaSeconds: number) => void;
    /** The longest step, in seconds. A tab that was hidden comes back with one step of this length. Defaults to 0.1, and is never more than the Engine's clock takes. */
    readonly maxStepSeconds?: number;
    /** Told once of what stopped the loop. Without it the failure is thrown from the display's callback, where the console shows it. */
    readonly onError?: (error: unknown) => void;
    /** The display's frame callback and its cancellation; `requestAnimationFrame` and `cancelAnimationFrame` by default. */
    readonly requestFrame?: (callback: (milliseconds: number) => void) => number;
    readonly cancelFrame?: (handle: number) => void;
}
export type BrowserFrameLoopState = 'idle' | 'running' | 'failed' | 'closed';
export interface BrowserFrameLoopSnapshot {
    readonly state: BrowserFrameLoopState;
    /** Steps taken, frames drawn, and frames skipped because the Host was busy. */
    readonly steps: number;
    readonly frames: number;
    readonly skipped: number;
    /** The seconds of game time the loop has given the Engine's clock. */
    readonly seconds: number;
    readonly failure: unknown;
}
export interface BrowserFrameLoop {
    readonly state: BrowserFrameLoopState;
    /** Starts, or starts again after `stop`. The time spent stopped is not played back. */
    start(): void;
    stop(): void;
    snapshot(): BrowserFrameLoopSnapshot;
    dispose(): void;
}
/**
 * The frame loop of a game in a page. On each frame the display shows, it advances the Engine's clock, which moves
 * tweens and sequences, calls `update`, and draws one frame. It keeps a step short after the page was hidden, and it
 * skips a frame, without failing, while the Host has not finished the frames it holds.
 */
export declare function createBrowserFrameLoop<F>(options: BrowserFrameLoopOptions<F>): BrowserFrameLoop;
//# sourceMappingURL=BrowserFrameLoop.d.ts.map