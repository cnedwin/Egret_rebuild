import type { HoverInput, HoverInputOptions } from '@egret/engine/input/hover';
/**
 * Whether a wheel over the canvas also scrolls the page: only when nothing consumed it, never
 * (the canvas owns the wheel), or always (the listener is passive and cannot hold the page).
 */
export type WheelPagePolicy = 'unconsumed' | 'never' | 'always';
export interface BrowserHoverInputOptions extends HoverInputOptions {
    /** The canvas the Engine draws on. Its CSS rectangle is mapped to the logical width and height. */
    readonly canvas: HTMLCanvasElement;
    /** Defaults to 'unconsumed'. */
    readonly wheelPage?: WheelPagePolicy;
    /**
     * Told when the adapter has stopped because a callback or an event failed. The input is closed
     * by then. Without it the failure is reported to the page as an uncaught error.
     */
    readonly onError?: (cause: unknown) => void;
}
/**
 * Hover and wheel of the page for the canvas of a started Engine, in the same connected,
 * untransformed profile as the pointer adapter. It captures no pointer and sets no style, so it
 * shares the canvas with that adapter.
 */
export declare function createBrowserHoverInput(options: BrowserHoverInputOptions): HoverInput;
//# sourceMappingURL=BrowserHoverInput.d.ts.map