import { DisplayObject } from "./DisplayObject.js";
import { EgretError } from "./EgretError.js";
import { ASSERT_ATTACHABLE, OWNERSHIP_CHILDREN, commitBinding, engineInSubtree, engineOf, ownerOf, preflightBinding, validateBinding } from "./ownership.js";
import { assertAttachable, assertLive, assertNoCycle, attachNode, childrenOf, detachNode, isTerminated, parentOf, registerContainer, removeNode, setNodeIndex } from "./displayTreeState.js";

// Carries the initiating owner's boundary through unowned intermediate containers.
const disposalBoundaries = new WeakMap<DisplayObject, { readonly owner: object | undefined }>();

/** Ordered display children with atomic reparenting and ownership-aware cleanup. */
export class DisplayObjectContainer extends DisplayObject {
  public constructor() { super(); registerContainer(this); }
  public get numChildren(): number { return childrenOf(this).length; }
  public override [OWNERSHIP_CHILDREN](): readonly object[] { return childrenOf(this); }

  /** Subclass hooks run in preflight; final binding and reparenting use internal state. */
  public addChild<T extends DisplayObject>(child: T): T {
    const engine = engineInSubtree(this) ?? engineInSubtree(child);
    engine?.assertOpen();
    this.assertUsable();
    child[ASSERT_ATTACHABLE]();
    assertNoCycle(this, child);
    if (engine !== undefined) {
      preflightBinding(this, engine);
      preflightBinding(child, engine);
    }
    // Re-read state and both current trees after callback-capable preflight.
    // Validation, binding and internal detach/attach below invoke no user code.
    const finalEngine = engineInSubtree(this) ?? engineInSubtree(child);
    finalEngine?.assertOpen();
    assertLive(this);
    assertAttachable(child);
    assertNoCycle(this, child);
    const binding = finalEngine === undefined ? undefined : [...validateBinding(this, finalEngine), ...validateBinding(child, finalEngine)];
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

  public getChildAt(index: number): DisplayObject {
    this.validateIndex(index);
    const child = childrenOf(this)[index];
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
    if (!Number.isInteger(index) || index < 0 || index >= childrenOf(this).length) throw new EgretError("INVALID_INDEX");
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

