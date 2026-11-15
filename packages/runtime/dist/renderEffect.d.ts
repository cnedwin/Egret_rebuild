import type { Rectangle2D } from '@egret/contracts';
import type { Bitmap } from './Bitmap.js';
import type { DisplayObject } from './DisplayObject.js';
/** Render-only subtree effect. The mask borrows its Bitmap's existing texture lease.
 * maskRect is in the affected node's local coordinates; mask display transforms
 * and opacity do not apply. The mask is not removed from its own display tree. */
export interface RenderEffect2D {
    readonly blurRadius?: number;
    readonly alphaMask?: Bitmap;
    readonly maskRect?: Rectangle2D;
    /**
     * Twenty numbers, as Egret's ColorMatrixFilter: four rows of red, green, blue and alpha, each four factors and an
     * offset from 0 to 255. Applied to colour as it is seen, without its alpha multiplied in, after the blur.
     */
    readonly colorMatrix?: readonly number[];
    /** A glow from the alpha of what is drawn, as Egret's GlowFilter; with an offset it is a drop shadow. */
    readonly glow?: RenderGlow2D;
    /** A hard line of a colour around what is drawn, a few pixels wide. One effect has a glow or an outline. */
    readonly outline?: RenderOutline2D;
}
export interface RenderGlow2D {
    /** 0xRRGGBB. */
    readonly color: number;
    /** 0 to 1; defaults to 1. */
    readonly alpha?: number;
    /** How far it spreads, 0 to 16 logical pixels; defaults to 6, as Egret's. */
    readonly blur?: number;
    /** What its spread alpha is multiplied by, 0 to 255; defaults to 2, as Egret's. */
    readonly strength?: number;
    /** Glow inside the edge instead of outside it. */
    readonly inner?: boolean;
    /** Show the glow alone, without what it glows around. */
    readonly knockout?: boolean;
    /** Where the glow is moved to, in logical pixels of the surface, -256 to 256: a drop shadow. */
    readonly offsetX?: number;
    readonly offsetY?: number;
}
export interface RenderOutline2D {
    /** 0xRRGGBB. */
    readonly color: number;
    /** 1 to 8 logical pixels. */
    readonly width: number;
    /** 0 to 1; defaults to 1. */
    readonly alpha?: number;
}
export declare function setRenderEffect(node: DisplayObject, input: RenderEffect2D | undefined): void;
//# sourceMappingURL=renderEffect.d.ts.map