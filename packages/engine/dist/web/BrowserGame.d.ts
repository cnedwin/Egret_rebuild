import type { AssetLease, Engine, Scope, Stage, SharedFrameOptions2D, Texture } from '@egret/engine';
import type { TextField } from '@egret/engine/text';
import type { BrowserFrameLoop } from './loop.js';
import type { PointerInput } from './pointer.js';
import type { KeyboardInput } from './keyboard.js';
import type { BrowserStatsPanel } from './BrowserStatsPanel.js';
export type BrowserGameBackend = 'webgpu' | 'webgl2';
/** How the canvas fills the element it is in: not at all, whole inside it, covering it, or stretched to it. */
export type BrowserGameFit = 'none' | 'contain' | 'cover' | 'stretch';
export interface BrowserGameLabelOptions {
    readonly text?: string;
    /** A font the page has: a family of the system, or one the page loaded. "sans-serif" unless given. */
    readonly fontFamily?: string;
    /** In stage units: 24 unless given. */
    readonly fontSize?: number;
    readonly fontWeight?: number;
    readonly italic?: boolean;
    /** In stage units: a quarter more than the font size unless given. */
    readonly lineHeight?: number;
    /** 0xffffff unless given. */
    readonly color?: number;
    /** The language of the text, such as "zh" or "en": "en" unless given. */
    readonly locale?: string;
    readonly direction?: 'ltr' | 'rtl';
}
/** A line of text on the stage whose words can be set like a value. */
export interface BrowserGameLabel {
    /** The text on the stage: place it with `display.x` and `display.y`, add it where it belongs. */
    readonly display: TextField;
    /** Setting it draws the new words when they are ready; until then the old ones stay. */
    text: string;
    /** Settles when the words last set are on the stage, and rejects if they could not be drawn. */
    readonly ready: Promise<void>;
    /** Changes any of the options; what is left out stays. */
    set(options: BrowserGameLabelOptions): void;
    dispose(): void;
}
export interface BrowserGameOptions {
    /** The canvas the game is drawn on. The page gives it its size on the screen. */
    readonly canvas: HTMLCanvasElement;
    /** The size of the stage, in the game's own units, whatever the size of the canvas on the page. */
    readonly width: number;
    readonly height: number;
    /** "auto", unless given: WebGPU where the browser gives an adapter, WebGL2 otherwise. */
    readonly backend?: 'auto' | BrowserGameBackend;
    /** Canvas pixels for each unit of the canvas's own width. The device's ratio unless given, and then never more than 2. */
    readonly pixelRatio?: number;
    /** What a frame is cleared to before the stage is drawn: 0x000000 and 1 unless given. */
    readonly clearColor?: number;
    readonly clearAlpha?: number;
    /** One step of the game, called before each frame with the seconds since the step before. */
    readonly update?: (deltaSeconds: number) => void;
    /** Told once of what stopped the game's loop. Without it the failure is thrown where the console shows it. */
    readonly onError?: (error: unknown) => void;
    /** Touch, mouse and pen on display objects, and the keyboard. Both are made unless false is given. */
    readonly pointer?: boolean;
    readonly keyboard?: boolean;
    /** A panel over the canvas with frames a second, what a frame holds and how busy the Host is. Not made unless true is given. */
    readonly stats?: boolean;
    /** "none" unless given. The canvas is sized inside `fitTo`, or its parent element, and again whenever that changes size. */
    readonly fit?: BrowserGameFit;
    readonly fitTo?: HTMLElement;
    /** The loop starts at once unless false is given; then `game.loop.start()` starts it. */
    readonly autoStart?: boolean;
}
export interface BrowserGame {
    readonly backend: BrowserGameBackend;
    readonly engine: Engine;
    /** The Host that draws: its status says what it holds and what last went wrong. It ends with the game. */
    readonly host: {
        getStatus(): {
            readonly pendingFrames: number;
        };
        whenIdle(): Promise<void>;
    };
    /** The stage of the Engine: what is added to it is drawn. */
    readonly stage: Stage;
    /** A scope for what the game creates. It is disposed with the game. */
    readonly scope: Scope;
    /** The frame the loop draws: the stage's size and what it is cleared to. */
    readonly frame: SharedFrameOptions2D;
    readonly loop: BrowserFrameLoop;
    readonly pointer: PointerInput | undefined;
    readonly keyboard: KeyboardInput | undefined;
    readonly stats: BrowserStatsPanel | undefined;
    /**
     * Loads a PNG image from an address and gives the lease of its texture, for `new Bitmap(lease)` or
     * `graphics.beginBitmapFill(lease)`. The lease belongs to the game's scope. The same address loaded twice is one texture.
     */
    loadTexture(url: string): Promise<AssetLease<Texture>>;
    /** A line of text for the stage. The first call loads the page's text rasterizer. */
    createLabel(options?: BrowserGameLabelOptions): Promise<BrowserGameLabel>;
    /** A place in the page, as a pointer event gives it in `clientX` and `clientY`, as a place on the stage. */
    toStage(clientX: number, clientY: number): {
        x: number;
        y: number;
    };
    /** Stops the loop and ends the input, the scope, the Engine and its Host. */
    dispose(): Promise<void>;
}
/**
 * Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects
 * to `game.stage`. Everything it makes is what the separate entries make; a game that outgrows it takes them apart.
 */
export declare function createBrowserGame(options: BrowserGameOptions): Promise<BrowserGame>;
//# sourceMappingURL=BrowserGame.d.ts.map