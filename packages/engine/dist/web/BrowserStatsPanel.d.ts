import type { SharedRenderFrame2D } from '@egret/engine';
/** What a game knows at one frame of the display. Every part may be left out; its line then shows a dash. */
export interface BrowserStatsSample {
    /** The time of the display's frame in milliseconds; `performance.now()` unless given. */
    readonly now?: number;
    /** The frame that was drawn since the last sample, if one was. */
    readonly frame?: SharedRenderFrame2D;
    /** Frames the Host holds that it has not finished: `host.getStatus().pendingFrames`. */
    readonly pendingFrames?: number;
    /** Frames drawn and frames skipped so far, as a frame loop's `snapshot()` gives them. */
    readonly frames?: number;
    readonly skipped?: number;
}
/** The numbers the panel shows, as of its last refresh. */
export interface BrowserStatsSnapshot {
    /** Frames of the display a second, and the longest time between two of them, in milliseconds, since the refresh before. */
    readonly fps: number;
    readonly longestFrameMs: number;
    /** Of the last frame drawn: its commands, the triangles they draw, its different geometries and its pages. */
    readonly commands: number;
    readonly triangles: number;
    readonly geometries: number;
    readonly pages: number;
    readonly pendingFrames: number;
    readonly frames: number;
    readonly skipped: number;
}
export interface BrowserStatsPanelOptions {
    /** The canvas the panel lies over: it is placed at the canvas's top left corner. */
    readonly canvas: HTMLCanvasElement;
    /** A line at the top of the panel, such as the backend's name. */
    readonly label?: string;
    /** How often the text changes, in milliseconds. 500 unless given; at least 100. */
    readonly intervalMs?: number;
}
export interface BrowserStatsPanel {
    /** The panel's element, a child of the page's body. */
    readonly element: HTMLElement;
    /** Called once for each frame of the display. */
    sample(sample?: BrowserStatsSample): void;
    snapshot(): BrowserStatsSnapshot;
    /** Removes the panel from the page. */
    dispose(): void;
}
export declare function createBrowserStatsPanel(options: BrowserStatsPanelOptions): BrowserStatsPanel;
//# sourceMappingURL=BrowserStatsPanel.d.ts.map