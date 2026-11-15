import type { UiSemantics } from '@egret/engine/ui/semantics';
export interface BrowserSemanticsOptions {
    readonly semantics: UiSemantics;
    /** The canvas the Engine draws on. Its CSS rectangle is mapped to the logical width and height. */
    readonly canvas: HTMLCanvasElement;
    /** The logical size the bounds of the nodes are given in. */
    readonly width: number;
    readonly height: number;
    /** The accessible name of the canvas, set only when it has none. */
    readonly label?: string;
    /**
     * Told when an action a node performed failed, and when the adapter has stopped because the
     * page refused it. Without it the failure is reported to the page as an uncaught error.
     */
    readonly onError?: (cause: unknown) => void;
}
export interface BrowserSemantics {
    readonly state: 'active' | 'closed';
    /** The element that holds the projection. It is invisible and takes no pointer. */
    readonly container: HTMLElement;
    /** The element a published node is projected to. */
    elementOf(id: string): HTMLElement | undefined;
    /** Measures the canvas again, for a layout change that came without a resize or a scroll. */
    sync(): void;
    dispose(): void;
}
/**
 * Projects a semantic tree to the page, for assistive technology. The canvas stays the one element
 * with the keyboard: it owns an invisible container of elements laid over it, one for each
 * published node, and names the focused one as its active descendant. Nothing here draws, and a
 * pointer goes through to the canvas.
 */
export declare function createBrowserSemantics(options: BrowserSemanticsOptions): BrowserSemantics;
//# sourceMappingURL=BrowserSemantics.d.ts.map