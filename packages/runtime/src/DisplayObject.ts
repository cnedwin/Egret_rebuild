import type { Point2D, Rectangle2D } from '@egret/contracts';
import { queryDisplayPoint } from './displayCoordinates.js';
import type { CoordinateQueryOptions } from './displayCoordinates.js';
import { EgretError } from './EgretError.js';
import { assertVisualMutable, copyRect, finite, unit, registerVisual, visualOf } from './displayVisualState.js';
import { EventDispatcher } from "./EventDispatcher.js";
import { ASSERT_ATTACHABLE, ASSERT_BINDABLE, OWNERSHIP_CHILDREN } from "./ownership.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import { assertLive, isTerminated, parentOf, registerNode, terminateNode } from "./displayTreeState.js";

/** A live display node; detach and terminal dispose are separate operations. */
export class DisplayObject extends EventDispatcher {
  public constructor() { super(); registerNode(this); registerVisual(this); }

  public get x():number { return visualOf(this).x; }
  public set x(value:number) { assertVisualMutable(this); if(!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).x=value; }
  public get y():number { return visualOf(this).y; }
  public set y(value:number) { assertVisualMutable(this); if(!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).y=value; }
  public get scaleX():number { return visualOf(this).scaleX; }
  public set scaleX(value:number) { assertVisualMutable(this); if(!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).scaleX=value; }
  public get scaleY():number { return visualOf(this).scaleY; }
  public set scaleY(value:number) { assertVisualMutable(this); if(!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).scaleY=value; }
  public get rotation():number { return visualOf(this).rotation; }
  public set rotation(value:number) { assertVisualMutable(this); if(!finite(value)) throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).rotation=value; }
  public get alpha():number { return visualOf(this).alpha; }
  public set alpha(value:number) { assertVisualMutable(this); if(!unit(value)) throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).alpha=value; }
  public get visible():boolean { return visualOf(this).visible; }
  public set visible(value:boolean) { assertVisualMutable(this); if(typeof value!=='boolean') throw new EgretError('DISPLAY_VALUE_INVALID'); visualOf(this).visible=value; }
  public get clipRect():Rectangle2D|undefined { return visualOf(this).clipRect; }
  public set clipRect(value:Rectangle2D|undefined) { assertVisualMutable(this); let copy; try { copy=value===undefined?undefined:copyRect(value,'DISPLAY_VALUE_INVALID'); } catch(cause) { if(cause instanceof EgretError) throw cause; throw new EgretError('DISPLAY_VALUE_INVALID',{cause}); } assertVisualMutable(this); visualOf(this).clipRect=copy; }
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


