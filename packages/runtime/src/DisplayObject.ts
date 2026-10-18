import type { Point2D, Rectangle2D } from '@egret/contracts';
import { registerDisplayHitNode, readDisplayHitState, writeDisplayHitArea, writeDisplayTouchEnabled } from './displayHitState.js';
import { queryDisplayBounds } from './displayBounds.js';
import type { BoundsQueryOptions } from './displayBounds.js';
import { queryDisplayPoint } from './displayCoordinates.js';
import type { CoordinateQueryOptions } from './displayCoordinates.js';
import { EgretError } from './EgretError.js';
import { assertVisualMutable, copyRect, finite, unit, registerVisual, visualOf, readAnchorOffset, writeAnchorOffset, recordVisualChange, VISUAL_TRANSFORM, VISUAL_APPEARANCE } from './displayVisualState.js';
import { EventDispatcher } from "./EventDispatcher.js";
import { ASSERT_ATTACHABLE, ASSERT_BINDABLE, OWNERSHIP_CHILDREN } from "./ownership.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import { assertLive, isTerminated, parentOf, registerNode, terminateNode } from "./displayTreeState.js";

// Equality is checked only after the original validation; signed zero stays distinct.
const sameVisualValue = Object.is;

/** A live display node; detach and terminal dispose are separate operations. */
export class DisplayObject extends EventDispatcher {
  public constructor() { super(); registerNode(this); registerVisual(this); registerDisplayHitNode(this); }

  /** Explicit input regions are separate from rendering content and opacity. */
  public get touchEnabled(): boolean { return readDisplayHitState(this).touchEnabled; }
  public set touchEnabled(value: boolean) { writeDisplayTouchEnabled(this, value); }
  public get hitArea(): Rectangle2D | undefined { return readDisplayHitState(this).hitArea; }
  public set hitArea(value: Rectangle2D | undefined) { writeDisplayHitArea(this, value); }

  public get x():number { return visualOf(this).x; }
  public set x(value: number) {
    assertVisualMutable(this);
    if (!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.x, value);
    state.x = value;
    if (changed) recordVisualChange(this, VISUAL_TRANSFORM);
  }
  public get y():number { return visualOf(this).y; }
  public set y(value: number) {
    assertVisualMutable(this);
    if (!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.y, value);
    state.y = value;
    if (changed) recordVisualChange(this, VISUAL_TRANSFORM);
  }
  /** Local pivot in logical pixels; finite values are stored without coercion. */
  public get anchorOffsetX(): number { return readAnchorOffset(this, "anchorOffsetX"); }
  public set anchorOffsetX(value: number) { writeAnchorOffset(this, "anchorOffsetX", value); }
  /** The pivot remains readable after disposal; writes obey node/Engine life. */
  public get anchorOffsetY(): number { return readAnchorOffset(this, "anchorOffsetY"); }
  public set anchorOffsetY(value: number) { writeAnchorOffset(this, "anchorOffsetY", value); }

  public get scaleX():number { return visualOf(this).scaleX; }
  public set scaleX(value: number) {
    assertVisualMutable(this);
    if (!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.scaleX, value);
    state.scaleX = value;
    if (changed) recordVisualChange(this, VISUAL_TRANSFORM);
  }
  public get scaleY():number { return visualOf(this).scaleY; }
  public set scaleY(value: number) {
    assertVisualMutable(this);
    if (!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.scaleY, value);
    state.scaleY = value;
    if (changed) recordVisualChange(this, VISUAL_TRANSFORM);
  }
  public get rotation():number { return visualOf(this).rotation; }
  public set rotation(value: number) {
    assertVisualMutable(this);
    if (!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.rotation, value);
    state.rotation = value;
    if (changed) recordVisualChange(this, VISUAL_TRANSFORM);
  }
  public get alpha():number { return visualOf(this).alpha; }
  public set alpha(value: number) {
    assertVisualMutable(this);
    if (!unit(value)) throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.alpha, value);
    state.alpha = value;
    if (changed) recordVisualChange(this, VISUAL_APPEARANCE);
  }
  public get visible():boolean { return visualOf(this).visible; }
  public set visible(value: boolean) {
    assertVisualMutable(this);
    if (typeof value !== 'boolean') throw new EgretError('DISPLAY_VALUE_INVALID');
    const state = visualOf(this), changed = !sameVisualValue(state.visible, value);
    state.visible = value;
    if (changed) recordVisualChange(this, VISUAL_APPEARANCE);
  }
  public get clipRect():Rectangle2D|undefined { return visualOf(this).clipRect; }
  public set clipRect(value: Rectangle2D | undefined) {
    assertVisualMutable(this);
    let copy;
    try { copy = value === undefined ? undefined : copyRect(value, 'DISPLAY_VALUE_INVALID'); }
    catch (cause) {
      if (cause instanceof EgretError) throw cause;
      throw new EgretError('DISPLAY_VALUE_INVALID', { cause });
    }
    assertVisualMutable(this);
    const state = visualOf(this), changed = !sameVisualValue(state.clipRect, copy);
    state.clipRect = copy;
    if (changed) recordVisualChange(this, VISUAL_APPEARANCE);
  }
  public get parent(): DisplayObjectContainer | undefined { return parentOf(this); }
  public get isDisposed(): boolean { return isTerminated(this); }

  /** Map logical coordinates through the actual root, including its transform. */
  public localToGlobal(localX?: number, localY?: number, options?: CoordinateQueryOptions): Point2D {
    return queryDisplayPoint(this, localX, localY, options, false);
  }

  /** Solve the stored world matrix and return one owned, frozen point. */
  public globalToLocal(globalX?: number, globalY?: number, options?: CoordinateQueryOptions): Point2D {
    return queryDisplayPoint(this, globalX, globalY, options, true);
  }

  /** Measure descendant-transformed content in this node's local coordinates. */
  public getBounds(options?: BoundsQueryOptions): Rectangle2D {
    return queryDisplayBounds(this, options);
  }

  protected override assertUsable(): void {
    assertLive(this);
  }

  protected override eventParent(): EventDispatcher | undefined { return this.parent; }
  public [ASSERT_BINDABLE](): void { this.assertUsable(); }
  public [ASSERT_ATTACHABLE](): void { this.assertUsable(); }
  public [OWNERSHIP_CHILDREN](): readonly object[] { return []; }

  /** Mark terminal before removing listeners, so callback reentry sees disposal. */
  public dispose(): void {
    if (isTerminated(this)) return;
    terminateNode(this);
    this.clearListeners();
  }
}
