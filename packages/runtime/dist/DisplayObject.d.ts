import type { RenderEffect2D } from './renderEffect.js';
import type { Point2D, Rectangle2D, SharedMaterial2D } from '@egret/contracts';
import type { BoundsQueryOptions } from './displayBounds.js';
import type { CoordinateQueryOptions } from './displayCoordinates.js';
import { EventDispatcher } from './EventDispatcher.js';
import { ASSERT_ATTACHABLE, ASSERT_BINDABLE, OWNERSHIP_CHILDREN } from './ownership.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
/** A live display node; detach and terminal dispose are separate operations. */
export declare class DisplayObject extends EventDispatcher {
    constructor();
    /** Explicit input regions are separate from rendering content and opacity. */
    get touchEnabled(): boolean;
    set touchEnabled(value: boolean);
    get hitArea(): Rectangle2D | undefined;
    set hitArea(value: Rectangle2D | undefined);
    get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    /** Local pivot in logical pixels; finite values are stored without coercion. */
    get anchorOffsetX(): number;
    set anchorOffsetX(value: number);
    /** The pivot remains readable after disposal; writes obey node/Engine life. */
    get anchorOffsetY(): number;
    set anchorOffsetY(value: number);
    get scaleX(): number;
    set scaleX(value: number);
    get scaleY(): number;
    set scaleY(value: number);
    get rotation(): number;
    set rotation(value: number);
    /** Degrees by which the y axis is turned beyond the rotation, so that upright lines lean. 0 unless set. */
    get skewX(): number;
    set skewX(value: number);
    /** Degrees by which the x axis is turned beyond the rotation, so that level lines slope. 0 unless set. */
    get skewY(): number;
    set skewY(value: number);
    /** A name the application gives the object, for `getChildByName`. Empty unless set; it changes nothing that is drawn. */
    get name(): string;
    set name(value: string);
    /**
     * The width the object takes on its parent: the width of what it and its children draw, in its own units, times its
     * scaleX without the sign. Setting it sets scaleX, keeping its sign, so that the width becomes the value; an object
     * that draws nothing has no width to scale and refuses any but 0.
     */
    get width(): number;
    set width(value: number);
    /** As `width`, down the object and with scaleY. */
    get height(): number;
    set height(value: number);
    get alpha(): number;
    set alpha(value: number);
    get visible(): boolean;
    set visible(value: boolean);
    /** A complete material value overrides the nearest inherited value. */
    get sharedMaterial(): SharedMaterial2D | null;
    set sharedMaterial(value: SharedMaterial2D | null);
    /**
     * How what this object and its children draw is combined with what is under it, by Egret's names: `add` brightens,
     * `multiply` darkens, `screen` lightens softly and `erase` takes away by its alpha. It is the blend of `sharedMaterial`:
     * setting it keeps the material's tints and replaces only its blend, and a child with a material of its own keeps that.
     */
    get blendMode(): 'normal' | 'add' | 'multiply' | 'screen' | 'erase';
    set blendMode(value: 'normal' | 'add' | 'multiply' | 'screen' | 'erase');
    /** Shared backends execute effects; legacy captures explicitly refuse them. */
    get renderEffect(): RenderEffect2D | undefined;
    set renderEffect(value: RenderEffect2D | undefined);
    /** An ordering boundary is metadata, not another display or resource owner. */
    get renderBoundary(): 'none' | 'isolate';
    set renderBoundary(value: 'none' | 'isolate');
    get clipRect(): Rectangle2D | undefined;
    set clipRect(value: Rectangle2D | undefined);
    get parent(): DisplayObjectContainer | undefined;
    get isDisposed(): boolean;
    /** Map logical coordinates through the actual root, including its transform. */
    localToGlobal(localX?: number, localY?: number, options?: CoordinateQueryOptions): Point2D;
    /** Solve the stored world matrix and return one owned, frozen point. */
    globalToLocal(globalX?: number, globalY?: number, options?: CoordinateQueryOptions): Point2D;
    /** Measure descendant-transformed content in this node's local coordinates. */
    getBounds(options?: BoundsQueryOptions): Rectangle2D;
    protected assertUsable(): void;
    protected eventParent(): EventDispatcher | undefined;
    [ASSERT_BINDABLE](): void;
    [ASSERT_ATTACHABLE](): void;
    [OWNERSHIP_CHILDREN](): readonly object[];
    /** Mark terminal before removing listeners, so callback reentry sees disposal. */
    dispose(): void;
}
//# sourceMappingURL=DisplayObject.d.ts.map