import { EventDispatcher } from "./EventDispatcher.js";
import { ASSERT_ATTACHABLE, ASSERT_BINDABLE, OWNERSHIP_CHILDREN } from "./ownership.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import { assertLive, isTerminated, parentOf, registerNode, terminateNode } from "./displayTreeState.js";

/** A live display node; detach and terminal dispose are separate operations. */
export class DisplayObject extends EventDispatcher {
  public constructor() { super(); registerNode(this); }

  public get parent(): DisplayObjectContainer | undefined { return parentOf(this); }
  public get isDisposed(): boolean { return isTerminated(this); }

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

