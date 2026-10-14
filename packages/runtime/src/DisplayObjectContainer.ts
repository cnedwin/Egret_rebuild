import { DisplayObject } from "./DisplayObject.js";
import { registerDisplayHitContainer, readDisplayTouchChildren, writeDisplayTouchChildren } from './displayHitState.js';
import { EgretError } from "./EgretError.js";
import { ASSERT_ATTACHABLE, ASSERT_BINDABLE, OWNERSHIP_CHILDREN, commitBinding, engineInSubtree, engineOf, ownerOf, preflightBinding, validateBinding } from "./ownership.js";
import { assertAttachable, assertContainer, assertLive, assertNoCycle, attachNode, childAtOf, childCountOf, childrenOf, detachChildren, detachNode, isTerminated, parentOf, registerContainer, removeNode, setNodeIndex } from "./displayTreeState.js";

// Carries the initiating owner's boundary through unowned intermediate containers.
const disposalBoundaries = new WeakMap<DisplayObject, { readonly owner: object | undefined }>();

/** Ordered display children with atomic reparenting and ownership-aware cleanup. */
export class DisplayObjectContainer extends DisplayObject {
  public constructor() { super(); registerContainer(this); registerDisplayHitContainer(this); }
  /** Suppressed descendants never implicitly retarget to this container. */
  public get touchChildren(): boolean { return readDisplayTouchChildren(this); }
  public set touchChildren(value: boolean) { writeDisplayTouchChildren(this, value); }

  public get numChildren(): number { return childCountOf(this); }
  public override [OWNERSHIP_CHILDREN](): readonly object[] { return childrenOf(this); }

  /** Subclass hooks run in preflight; final binding and reparenting use internal state. */
  public addChild<T extends DisplayObject>(child: T): T {
    // A bound receiver's existing descendants already share its permanent
    // affinity: every attach/bind validates before commit and detach retains it.
    // Preserve whole-tree checks for a receiver that starts unbound, even if a
    // subclass hook binds it while this operation is in progress.
    const receiverWasBound = engineOf(this) !== undefined;
    const engine = engineInSubtree(this) ?? engineInSubtree(child);
    engine?.assertOpen();
    this.assertUsable();
    child[ASSERT_ATTACHABLE]();
    assertNoCycle(this, child);
    if (engine !== undefined) {
      if (receiverWasBound) {
        // Incoming attachability can close the Engine. Preserve the original
        // preflight error priority before invoking any receiver bindable hook.
        engine.assertOpen();
        this[ASSERT_BINDABLE]();
      }
      else preflightBinding(this, engine);
      preflightBinding(child, engine);
    }
    // Re-read state and both current trees after callback-capable preflight.
    // Validation, binding and internal detach/attach below invoke no user code.
    const finalEngine = engineInSubtree(this) ?? engineInSubtree(child);
    finalEngine?.assertOpen();
    assertLive(this);
    assertAttachable(child);
    assertNoCycle(this, child);
    // Receiver hooks still run; unrelated existing descendants do not. Final
    // incoming validation always reads the current tree without user callbacks.
    const binding = finalEngine === undefined ? undefined : [
      ...(receiverWasBound ? [] : validateBinding(this, finalEngine)),
      ...validateBinding(child, finalEngine),
    ];
    if (binding !== undefined && finalEngine !== undefined) commitBinding(binding, finalEngine);
    attachNode(this, child);
    return child;
  }

  /** Detach without disposing or transferring the cleanup owner. */
  public removeChild<T extends DisplayObject>(child: T): T {
    engineOf(this)?.assertOpen(); assertLive(this); assertLive(child);
    removeNode(this, child);
    return child;
  }

  /** Detach every direct child without disposing nodes or transferring owners. */
  public removeChildren(): void {
    // Authenticate before reading affinity; preserve Engine-first life checks.
    assertContainer(this);
    engineOf(this)?.assertOpen(); assertLive(this);
    detachChildren(this);
  }

  public getChildAt(index: number): DisplayObject {
    this.validateIndex(index);
    const child = childAtOf(this, index);
    if (child === undefined) throw new EgretError("INVALID_INDEX");
    return child;
  }

  public setChildIndex(child: DisplayObject, index: number): void {
    this.assertUsable();
    assertLive(this);
    this.validateIndex(index);
    engineOf(this)?.assertOpen();
    setNodeIndex(this, child, index);
  }

  private validateIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= childCountOf(this)) throw new EgretError("INVALID_INDEX");
  }

  public override dispose(): void {
    if (isTerminated(this)) return;
    const boundary = disposalBoundaries.get(this) ?? { owner: ownerOf(this) };
    const engine = engineOf(this);
    const failures: unknown[] = [];
    const recordFailure = (cause: unknown): void => {
      const causes = cause instanceof EgretError && (cause.code === "EVENT_LISTENER_CLEANUP_FAILED" || cause.code === "DISPLAY_TREE_CLEANUP_FAILED")
        ? [cause.cause, ...cause.cleanupErrors] : [cause];
      for (const item of causes) {
        if (engine === undefined) failures.push(item);
        else {
          engine.captureCleanup(item);
          engine.report({ code: "DISPLAY_CHILD_CLEANUP_FAILED", phase: "display-tree", severity: "error", cause: item });
        }
      }
    };
    // A listener cleanup failure must not skip the current child subtree.
    try { super.dispose(); }
    catch (cause) { recordFailure(cause); }
    for (const child of childrenOf(this)) {
      if (parentOf(child) !== this) continue;
      const childOwner = ownerOf(child);
      // Detach a foreign-owned subtree intact; its Scope remains responsible for it.
      if (childOwner !== undefined && childOwner !== boundary.owner) {
        detachNode(child);
        engine?.report({ code: "FOREIGN_SUBTREE_DETACHED", phase: "display-tree", severity: "warning" });
        continue;
      }
      disposalBoundaries.set(child, boundary);
      try {
        child.dispose();
      } catch (cause) {
        recordFailure(cause);
      } finally {
        disposalBoundaries.delete(child);
        if (parentOf(child) === this) detachNode(child);
      }
    }
    if (failures.length !== 0) throw new EgretError("DISPLAY_TREE_CLEANUP_FAILED", { cause: failures[0], cleanupErrors: failures.slice(1) });
  }
}
