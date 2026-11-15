import type { Rectangle2D, SharedMaterial2D } from "@egret/contracts";
import type { DisplayObject } from "./DisplayObject.js";
import type { RenderEffect2D } from "./renderEffect.js";
import type { ShapeState } from "./graphicsShape.js";
export interface Primitive {
    readonly rect: Rectangle2D;
    readonly color: number;
    readonly alpha: number;
}
export interface VisualState {
    structureRevision: number;
    transformRevision: number;
    appearanceRevision: number;
    contentRevision: number;
    bindingRevision: number;
    x: number;
    y: number;
    anchorOffsetX: number;
    anchorOffsetY: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    /** Degrees by which the y axis and the x axis are turned beyond the rotation; 0 and 0 is no skew. */
    skewX: number;
    skewY: number;
    /** A name the application gives, for getChildByName. */
    name: string;
    alpha: number;
    visible: boolean;
    sharedMaterial: SharedMaterial2D | null;
    renderBoundary: "none" | "isolate";
    renderEffect: RenderEffect2D | undefined;
    clipRect: Rectangle2D | undefined;
    primitives: Primitive[];
    /** What the node draws besides filled rectangles: triangles and a path, which Graphics alone writes. */
    shape: ShapeState | undefined;
    /** What the shared capture keeps of this node between frames; the capture alone reads and writes it. */
    sharedCapture: object | undefined;
    /** How many changes were recorded for this node, of any kind. It only grows. */
    changes: number;
    /** The last capture that visited this node; a capture visits a node once. The captures alone read and write it. */
    seenBy: number;
}
export declare const VISUAL_STRUCTURE = 1;
export declare const VISUAL_TRANSFORM = 2;
export declare const VISUAL_APPEARANCE = 4;
export declare const VISUAL_CONTENT = 8;
export declare const VISUAL_BINDING = 16;
/**
 * Publish after the original authoritative write. No lifecycle check, callback or
 * explicit allocation may enter tree/ticket commits or terminal cleanup here.
 * Non-display affinity values have no visual state and need no capture revision.
 */
export declare function recordVisualChange(node: object, changes: number): void;
export declare function registerVisual(node: DisplayObject): void;
export declare function visualOf(node: DisplayObject): VisualState;
type AnchorAxis = "anchorOffsetX" | "anchorOffsetY";
export declare function readAnchorOffset(receiver: unknown, axis: AnchorAxis): number;
export declare function writeAnchorOffset(receiver: unknown, axis: AnchorAxis, value: unknown): void;
export declare function assertVisualMutable(node: DisplayObject): void;
export declare function finite(value: unknown): value is number;
export declare function color(value: unknown): value is number;
export declare function unit(value: unknown): value is number;
export declare function copyRect(value: Rectangle2D, code: string): Rectangle2D;
export {};
//# sourceMappingURL=displayVisualState.d.ts.map