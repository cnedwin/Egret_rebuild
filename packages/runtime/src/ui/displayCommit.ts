import type { Rectangle2D } from '@egret/contracts';
import { DisplayObjectContainer } from '../DisplayObjectContainer.js';
import type { DisplayObject } from '../DisplayObject.js';
import type { Stage } from '../Stage.js';
import { Scope } from '../Scope.js';
import { EgretError } from '../EgretError.js';
import { engineOf, ownerOf, preflightBinding } from '../ownership.js';
import { captureUiChildren, childAtOf, childCountOf, detachNode, isDisplayNode, isStageRoot, isTerminated, parentOf, publishUiTree, validateUiChildren } from '../displayTreeState.js';
import type { UiTreeReplacement } from '../displayTreeState.js';
import { copyRect, finite, recordVisualChange, visualOf, VISUAL_APPEARANCE, VISUAL_TRANSFORM } from '../displayVisualState.js';
import { readDisplayHitState } from '../displayHitState.js';
import { cleanupManagedWrapper, isManagedWrapper, managedBy, managedTerminal, registerManagedWrapper } from './managedState.js';

/** Internal cross-package assembly, never exposed by the Engine facade. */
export interface UiDisplayUpdate {
  readonly wrapper: DisplayObjectContainer;
  readonly children?: readonly DisplayObject[];
  readonly x?: number;
  readonly y?: number;
  readonly visible?: boolean;
  readonly clipRect?: Rectangle2D | undefined;
  readonly hitArea?: Rectangle2D | undefined;
  readonly touchEnabled?: boolean;
  readonly touchChildren?: boolean;
}
export interface UiDisplayOperations {
  createWrapper(scope: Scope): DisplayObjectContainer;
  validateContent(content: DisplayObject, scope: Scope): void;
  prepare(root: DisplayObjectContainer, updates: readonly UiDisplayUpdate[]): object;
  commit(token: object): void;
  detach(root: DisplayObjectContainer): void;
  disposeWrapper(wrapper: DisplayObjectContainer): void;
  assertStage(): void;
}
const scopeUse = Scope.prototype.use;
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const containerDispose = DisplayObjectContainer.prototype.dispose;
const own = Object.prototype.hasOwnProperty;
const MAX_UPDATES = 8192;
interface NodeCapture {
  readonly node: DisplayObject;
  readonly parent: DisplayObjectContainer | undefined;
  readonly owner: object | undefined;
  readonly children: readonly DisplayObject[];
}
interface VisualUpdate {
  readonly wrapper: DisplayObjectContainer;
  readonly visual: ReturnType<typeof visualOf>;
  readonly hit: ReturnType<typeof readDisplayHitState>;
  readonly x: number; readonly y: number; readonly visible: boolean;
  readonly clipRect: Rectangle2D | undefined; readonly hitArea: Rectangle2D | undefined;
  readonly touchEnabled: boolean; readonly touchChildren: boolean;
}
interface Plan {
  readonly epoch: number;
  readonly root: DisplayObjectContainer;
  readonly nodes: readonly NodeCapture[];
  readonly replacements: readonly UiTreeReplacement[];
  readonly updates: readonly VisualUpdate[];
}
function refuse(code = 'UI_CONTENT_INVALID'): never { throw new EgretError(code); }
/** A callback-capable array exposes exactly one admitted finite capture boundary. */
function captureArrayCount(value: readonly unknown[]): number {
  if (!Array.isArray(value)) refuse('UI_CAP_EXCEEDED');
  const count = value.length;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_UPDATES) refuse('UI_CAP_EXCEEDED');
  return count;
}
function rectangle(value: Rectangle2D | undefined): Rectangle2D | undefined {
  if (value === undefined) return undefined;
  const result = copyRect(value, 'UI_VALUE_INVALID');
  if (!finite(result.x + result.width) || !finite(result.y + result.height)) refuse('UI_VALUE_INVALID');
  return result;
}

/** Create a single root publication authority over the original genuine Stage. */
export function createUiDisplayOperations(stage: Stage): UiDisplayOperations {
  if (!isStageRoot(stage)) refuse('UI_OWNER_INVALID');
  const engine = engineOf(stage);
  if (engine === undefined) refuse('UI_OWNER_INVALID');
  const authority = {};
  const plans = new WeakMap<object, Plan>();
  let epoch = 0;
  let mountedRoot: DisplayObjectContainer | undefined;
  let detached = false;

  function assertStage(): void {
    engine!.assertOpen();
    if (isTerminated(stage)) refuse('UI_OWNER_INVALID');
    const state = visualOf(stage);
    if (state.x !== 0 || state.y !== 0 || state.scaleX !== 1 || state.scaleY !== 1 || state.rotation !== 0
        || state.anchorOffsetX !== 0 || state.anchorOffsetY !== 0) refuse('UI_STAGE_TRANSFORM_UNSUPPORTED');
  }
  function assertWrapper(wrapper: DisplayObjectContainer): void {
    if (!managedBy(wrapper, authority) || isTerminated(wrapper) || engineOf(wrapper) !== engine) refuse('UI_OWNER_INVALID');
    const scope = ownerOf(wrapper);
    if (scope === undefined || scopeState.call(scope) !== 'open') refuse('UI_OWNER_INVALID');
  }
  function validateContent(content: DisplayObject, scope: Scope): void {
    if (scopeState.call(scope) !== 'open') refuse('UI_CONTENT_INVALID');
    const pending = [{ node: content, depth: 1 }];
    const seen = new Set<DisplayObject>();
    while (pending.length !== 0) {
      const {node, depth} = pending.pop()!;
      if (!isDisplayNode(node) || isTerminated(node) || isStageRoot(node) || seen.has(node)
          || depth > 8 || seen.size >= 32 || ownerOf(node) !== scope || engineOf(node) !== engine
          || isManagedWrapper(node) || managedTerminal(node)) refuse();
      seen.add(node);
      const parent = parentOf(node);
      if (node === content && parent !== undefined && !managedBy(parent, authority)) refuse();
      const childCount = childCountOf(node);
      // Refuse before allocating a frontier wider than the remaining subtree budget.
      if (childCount > 32 - seen.size - pending.length || (depth === 8 && childCount !== 0)) refuse();
      for (let index = 0; index < childCount; index++) {
        const child = childAtOf(node, index)!;
        if (parentOf(child) !== node) refuse();
        pending.push({node: child, depth: depth + 1});
      }
    }
  }
  function capture(node: DisplayObject): NodeCapture {
    const children: DisplayObject[] = [];
    for (let index = 0; index < childCountOf(node); index++) children.push(childAtOf(node,index)!);
    return {node, parent: parentOf(node), owner: ownerOf(node), children};
  }
  function validatePlan(plan: Plan): void {
    if (detached || plan.epoch !== epoch || (mountedRoot !== undefined && mountedRoot !== plan.root)) refuse('UI_STALE_PREPARATION');
    for (let index = 0; index < plan.nodes.length; index++) {
      const item = plan.nodes[index]!, node = item.node;
      if (isTerminated(node) || ownerOf(node) !== item.owner || engineOf(node) !== engine
          || parentOf(node) !== item.parent || childCountOf(node) !== item.children.length) refuse('UI_STALE_PREPARATION');
      for (let childIndex = 0; childIndex < item.children.length; childIndex++) {
        if (childAtOf(node,childIndex) !== item.children[childIndex] || parentOf(item.children[childIndex]!) !== node) refuse('UI_STALE_PREPARATION');
      }
      if (item.owner !== undefined && scopeState.call(item.owner) !== 'open') refuse('UI_STALE_PREPARATION');
    }
    for (let index = 0; index < plan.replacements.length; index++) {
      const replacement = plan.replacements[index]!;
      if (!validateUiChildren(replacement.parent,replacement.previous)) refuse('UI_STALE_PREPARATION');
    }
  }
  assertStage();
  return Object.freeze({
    assertStage,
    createWrapper(scope: Scope): DisplayObjectContainer {
      assertStage();
      const wrapper = new DisplayObjectContainer();
      try {
        scopeUse.call(scope, wrapper);
        if (engineOf(wrapper) !== engine) refuse('UI_OWNER_INVALID');
        registerManagedWrapper(wrapper, authority, () => containerDispose.call(wrapper));
        return wrapper;
      } catch (cause) { containerDispose.call(wrapper); throw cause; }
    },
    validateContent,
    prepare(root: DisplayObjectContainer, sources: readonly UiDisplayUpdate[]): object {
      assertStage(); assertWrapper(root);
      if (detached || (mountedRoot !== undefined && mountedRoot !== root)) refuse('UI_OWNER_INVALID');
      const baseEpoch = epoch;
      const sourceCount = captureArrayCount(sources);
      const replacements: UiTreeReplacement[] = [];
      const updates: VisualUpdate[] = [];
      const seen = new Set<DisplayObjectContainer>();
      const contents: {node: DisplayObject; scope: Scope}[] = [];
      for (let index = 0; index < sourceCount; index++) {
        const source = sources[index]!, wrapper = source.wrapper;
        assertWrapper(wrapper);
        if (seen.has(wrapper)) refuse('UI_CONTENT_INVALID');
        seen.add(wrapper);
        const visual = visualOf(wrapper), hit = readDisplayHitState(wrapper);
        const x = own.call(source,'x') ? source.x : visual.x, y = own.call(source,'y') ? source.y : visual.y;
        const visible = own.call(source,'visible') ? source.visible : visual.visible;
        const touchEnabled = own.call(source,'touchEnabled') ? source.touchEnabled : hit.touchEnabled;
        const touchChildren = own.call(source,'touchChildren') ? source.touchChildren : hit.touchChildren!;
        const clipRect = own.call(source,'clipRect') ? rectangle(source.clipRect) : visual.clipRect;
        const hitArea = own.call(source,'hitArea') ? rectangle(source.hitArea) : hit.hitArea;
        if (!finite(x) || !finite(y) || typeof visible !== 'boolean' || typeof touchEnabled !== 'boolean' || typeof touchChildren !== 'boolean') refuse('UI_VALUE_INVALID');
        updates.push({wrapper,visual,hit,x,y,visible,touchEnabled,touchChildren,clipRect,hitArea});
        const children = source.children;
        if (children !== undefined) {
          const childCount = captureArrayCount(children);
          const next: DisplayObject[] = [];
          for (let childIndex = 0; childIndex < childCount; childIndex++) {
            const child = children[childIndex]!;
            if (managedBy(child,authority)) assertWrapper(child as DisplayObjectContainer);
            else {
              const scope = ownerOf(wrapper) as Scope;
              validateContent(child,scope);
              contents.push({node:child,scope});
            }
            next.push(child);
          }
          replacements.push({parent:wrapper,previous:captureUiChildren(wrapper),next});
        }
      }
      // Hooks are preparation only. Revalidate every content after the final hook.
      for (let index = 0; index < contents.length; index++) preflightBinding(contents[index]!.node,engine!);
      for (let index = 0; index < contents.length; index++) validateContent(contents[index]!.node,contents[index]!.scope);
      assertStage(); assertWrapper(root);
      if (epoch !== baseEpoch || detached) refuse('UI_STALE_PREPARATION');
      const stageChildren = captureUiChildren(stage);
      const rootParent = parentOf(root);
      if (rootParent !== undefined && rootParent !== stage) refuse('UI_CONTENT_INVALID');
      const nextStage = stageChildren.slice();
      if (rootParent === undefined) nextStage.push(root);
      replacements.push({parent:stage,previous:stageChildren,next:nextStage});
      const desiredParents = new Map<DisplayObject,DisplayObjectContainer>();
      const replaced = new Set<DisplayObjectContainer>();
      for (let index = 0; index < replacements.length; index++) replaced.add(replacements[index]!.parent);
      for (let index = 0; index < replacements.length; index++) {
        const item = replacements[index]!;
        for (let childIndex = 0; childIndex < item.next.length; childIndex++) {
          const child = item.next[childIndex]!;
          if (desiredParents.has(child)) refuse();
          desiredParents.set(child,item.parent);
          const oldParent = parentOf(child);
          if (oldParent !== undefined && oldParent !== item.parent && !replaced.has(oldParent)) refuse();
        }
      }
      // Walk final ancestry to reject cycles, including unchanged intermediate edges.
      for (const [child] of desiredParents) {
        const ancestors = new Set<DisplayObject>();
        let current: DisplayObject | undefined = child;
        while (current !== undefined) {
          if (ancestors.has(current)) refuse();
          ancestors.add(current);
          const previous = parentOf(current);
          current = desiredParents.get(current) ?? (previous !== undefined && replaced.has(previous) ? undefined : previous);
        }
      }
      const nodes: NodeCapture[] = [];
      const captured = new Set<DisplayObject>();
      const pending: DisplayObject[] = [root];
      for (let index = 0; index < replacements.length; index++) {
        const item = replacements[index]!;
        if (item.parent !== stage) for (let childIndex = 0; childIndex < item.next.length; childIndex++) pending.push(item.next[childIndex]!);
      }
      for (let index = 0; index < updates.length; index++) { assertWrapper(updates[index]!.wrapper); pending.push(updates[index]!.wrapper); }
      for (let index = 0; index < contents.length; index++) pending.push(contents[index]!.node);
      while (pending.length !== 0) {
        const node = pending.pop()!;
        if (captured.has(node)) continue;
        captured.add(node);
        const entry = capture(node); nodes.push(entry);
        for (let index = 0; index < entry.children.length; index++) pending.push(entry.children[index]!);
      }
      const plan: Plan = {epoch,root,nodes,replacements,updates};
      validatePlan(plan);
      const token = Object.freeze({}); plans.set(token,plan); return token;
    },
    commit(token: object): void {
      const plan = plans.get(token);
      if (plan === undefined) refuse('UI_STALE_PREPARATION');
      plans.delete(token);
      assertStage(); validatePlan(plan);
      // All callbacks, validation and allocations precede this straight-line publication.
      publishUiTree(plan.replacements);
      for (let index = 0; index < plan.updates.length; index++) {
        const item = plan.updates[index]!;
        item.visual.x = item.x; item.visual.y = item.y; item.visual.visible = item.visible;
        item.visual.clipRect = item.clipRect;
        item.hit.hitArea = item.hitArea; item.hit.touchEnabled = item.touchEnabled; item.hit.touchChildren = item.touchChildren;
        recordVisualChange(item.wrapper,VISUAL_TRANSFORM | VISUAL_APPEARANCE);
      }
      mountedRoot = plan.root; epoch++;
    },
    detach(root: DisplayObjectContainer): void {
      if (detached) return;
      if (!managedBy(root,authority) && !managedTerminal(root)) refuse('UI_OWNER_INVALID');
      if (mountedRoot !== undefined && root !== mountedRoot) refuse('UI_OWNER_INVALID');
      detached = true; epoch++;
      visualOf(root).visible = false;
      readDisplayHitState(root).touchEnabled = false;
      detachNode(root);
      recordVisualChange(root,VISUAL_APPEARANCE);
    },
    disposeWrapper(wrapper: DisplayObjectContainer): void {
      if (managedTerminal(wrapper)) return;
      if (!managedBy(wrapper,authority)) refuse('UI_OWNER_INVALID');
      epoch++;
      cleanupManagedWrapper(wrapper);
    },
  });
}
