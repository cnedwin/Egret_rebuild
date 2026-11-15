import type { GamepadInput, GamepadInputOptions } from '@egret/engine/input/gamepad';
export interface BrowserGamepadInputOptions extends GamepadInputOptions {
    /**
     * Told what failed where nothing could be returned: in a listener of the page, or when a pad
     * was asked to shake. Without it the failure is reported to the page.
     */
    readonly onError?: (cause: unknown) => void;
}
export interface GamepadRumble {
    /** Milliseconds, up to 5000. Defaults to 200. */
    readonly duration?: number;
    /** The light, fast motor, 0 to 1. Defaults to 0.5. */
    readonly weak?: number;
    /** The heavy, slow motor, 0 to 1. Defaults to 0.5. */
    readonly strong?: number;
}
export interface BrowserGamepadInput {
    readonly input: GamepadInput;
    /**
     * Looks at the pads of the page once. A game calls it once a frame. The timestamp is the frame's,
     * in milliseconds; without it the clock of the page is read. A hidden page is not looked at.
     */
    poll(timestamp?: number): void;
    /** Shakes a pad that can be shaken. Says whether the pad was asked to. */
    rumble(pad: number, options?: GamepadRumble): boolean;
    /** The same as disposing the input. A scope can own the pads of a game through this. */
    dispose(): void;
}
/**
 * The pads of a page. A browser tells nothing when a button goes down: it has to be asked, so the
 * game asks once a frame through `poll`. Buttons are let go when the page is hidden or the window
 * loses the person, because what happens to a pad then is not told either.
 */
export declare function createBrowserGamepadInput(options?: BrowserGamepadInputOptions): BrowserGamepadInput;
//# sourceMappingURL=BrowserGamepadInput.d.ts.map