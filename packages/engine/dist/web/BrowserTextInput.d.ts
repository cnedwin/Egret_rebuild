/** Rectangle in logical stage units, the units of the display tree and of pointer input. */
export interface BrowserTextInputRectangle {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export type BrowserTextInputMode = 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none';
export type BrowserTextInputEnterHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
export interface BrowserTextInputChange {
    readonly value: string;
    /** True while the input method still holds provisional text, such as pinyin before a candidate is chosen. */
    readonly composing: boolean;
}
/** One editing session. Every length is in logical stage units and every colour is 0xRRGGBB. */
export interface BrowserTextInputRequest extends BrowserTextInputRectangle {
    readonly value?: string;
    readonly multiline?: boolean;
    readonly password?: boolean;
    /** Counted in characters (code points), so one Chinese character or one emoji counts once. */
    readonly maxLength?: number;
    readonly placeholder?: string;
    readonly placeholderColor?: number;
    /** Accessible name of the field. */
    readonly label?: string;
    /** BCP 47 tag, for example 'zh-CN'. */
    readonly locale?: string;
    readonly inputMode?: BrowserTextInputMode;
    readonly enterKeyHint?: BrowserTextInputEnterHint;
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly fontWeight?: number | 'normal' | 'bold';
    readonly lineHeight?: number;
    readonly color?: number;
    /** Omitted: transparent, so that what the game drew under the field shows through. */
    readonly backgroundColor?: number;
    readonly textAlign?: 'left' | 'center' | 'right';
    readonly padding?: number;
    readonly select?: 'all' | 'end';
    /** What ends the session when the field loses focus or the player presses elsewhere. Default 'commit'. */
    readonly blur?: 'commit' | 'cancel';
    readonly onChange?: (change: BrowserTextInputChange) => void;
    readonly onCommit?: (value: string) => void;
    readonly onCancel?: () => void;
}
export interface BrowserTextInputOptions {
    readonly canvas: HTMLCanvasElement;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    /** Element that receives the field. Default: the parent of the canvas, so that a fullscreen container keeps it. */
    readonly parent?: HTMLElement;
    readonly zIndex?: number;
    /** Keeps key events of the field from bubbling to game shortcuts on the document or the window. Default true. */
    readonly isolateKeys?: boolean;
    readonly onError?: (error: unknown) => void;
}
export interface BrowserTextInputSnapshot {
    readonly state: 'idle' | 'open' | 'disposed';
    readonly value: string;
    readonly composing: boolean;
}
export interface BrowserTextInput {
    /** Opens a field and focuses it. A session that is still open is cancelled first. */
    open(request: BrowserTextInputRequest): void;
    commit(): void;
    cancel(): void;
    setValue(value: string): void;
    /** Moves the open field, for example with a panel that slides. */
    move(rectangle: BrowserTextInputRectangle): void;
    /** New logical size of the stage. */
    resize(logicalWidth: number, logicalHeight: number): void;
    /** Places the open field again. Window, viewport and canvas size changes do this by themselves. */
    sync(): void;
    getSnapshot(): BrowserTextInputSnapshot;
    dispose(): void;
}
/**
 * Platform text entry over a canvas: a native field placed on a rectangle of the stage, so that input methods
 * (Chinese, Japanese, Korean), on-screen keyboards, paste and accessibility work as the platform provides them.
 * Importing performs no host work, and nothing is added to the page until a session opens.
 */
export declare function createBrowserTextInput(options: BrowserTextInputOptions): BrowserTextInput;
//# sourceMappingURL=BrowserTextInput.d.ts.map