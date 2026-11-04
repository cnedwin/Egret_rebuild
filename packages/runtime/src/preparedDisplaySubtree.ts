// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject } from './DisplayObject.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { Stage } from './Stage.js';
import type { EngineContext } from './ownership.js';
import { engineOf, ownerOf } from './ownership.js';
import { Scope, isScope } from './Scope.js';
import { EgretError } from './EgretError.js';
import { assertContainer, childAtOf, childCountOf, isDisplayNode, isStageRoot, isTerminated, parentOf, publishPreparedChildren } from './displayTreeState.js';
import { visualOf } from './displayVisualState.js';
import { assertManagedChildrenMutable, assertManagedEdgeMutable } from './ui/managedState.js';
import { bitmapCaptureState, readBitmapImage } from './Bitmap.js';
import { readMeshState } from './meshDisplayState.js';
import { readMeshCaptureImage } from './meshCaptureSnapshot.js';
import { assertTextFieldScope, readTextFieldState } from './textDisplayState.js';
import { collectSubtreeSharedFrameContent } from './sharedFrameCapture.js';

type Operations = Parameters<NonNullable<EngineContext['registerPreparedDisplayOperations']>>[0];
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const inherited = ['structureRevision','transformRevision','appearanceRevision','bindingRevision'] as const;
const affected = [...inherited,'contentRevision'] as const;
interface Capture {
  readonly node: DisplayObject;
  readonly parent: DisplayObjectContainer | undefined;
  readonly owners: readonly object[];
  readonly keys: readonly (typeof affected[number])[];
  readonly revisions: readonly number[];
  readonly children: readonly DisplayObject[] | undefined;
}
interface Plan {
  readonly target: DisplayObjectContainer;
  readonly candidate: DisplayObject;
  readonly captures: readonly Capture[];
  readonly nodes: ReadonlySet<DisplayObject>;
  readonly previous: readonly DisplayObject[];
  readonly next: DisplayObject[];
}
function fault(code: string): never { throw new EgretError('DISPLAY_SUBTREE_' + code); }

/** Genuine Stage assembly only. All tree overlays and publication tokens remain private. */
export function createPreparedDisplayOperations(stage: Stage): Operations {
  const engine = engineOf(stage)!;
  const records = new WeakMap<object, Plan>();
  const pending = new Map<DisplayObjectContainer, object>();
  function live(node: DisplayObject): void {
    if (!isDisplayNode(node) || isTerminated(node) || engineOf(node) !== engine) fault('NODE_INVALID');
    ownership(node);
  }
  function ownership(node: object): object[] {
    const chain:object[]=[];let owner=ownerOf(node);
    while(owner!==undefined){if(chain.length>=128||chain.includes(owner))fault('OWNER_INVALID');chain.push(owner);if(isScope(owner)){if(scopeState.call(owner)!=='open')fault('OWNER_CLOSED');break;}owner=ownerOf(owner);}
    return chain;
  }
  function resource(node: DisplayObject): void {
    const bitmap = bitmapCaptureState(node), mesh = readMeshState(node), text = readTextFieldState(node);
    if (bitmap) readBitmapImage(bitmap.lease);
    if (mesh) readMeshCaptureImage(mesh);
    if (text) { assertTextFieldScope(text.scope); if (text.committed?.lease) readBitmapImage(text.committed.lease); }
  }
  function capture(node: DisplayObject, full: boolean): Capture {
    live(node);
    const keys = full ? affected : inherited, state = visualOf(node);
    const children = full ? Array.from({length:childCountOf(node)},(_,i)=>childAtOf(node,i)!) : undefined;
    if (full) resource(node);
    return {node,parent:parentOf(node),owners:ownership(node),keys,revisions:keys.map(key=>state[key]),children};
  }
  function validate(plan: Plan): void {
    engine.assertOpen();
    for (const item of plan.captures) {
      live(item.node);
      const state = visualOf(item.node),owners=ownership(item.node);
      if (parentOf(item.node) !== item.parent || owners.length!==item.owners.length || owners.some((owner,i)=>owner!==item.owners[i])
          || item.keys.some((key,i)=>state[key] !== item.revisions[i])) fault('STALE');
      if (item.children) {
        if (childCountOf(item.node) !== item.children.length) fault('STALE');
        for (let i=0;i<item.children.length;i++) if(childAtOf(item.node,i)!==item.children[i] || parentOf(item.children[i]!)!==item.node) fault('STALE');
        resource(item.node);
      }
    }
    assertManagedChildrenMutable(plan.target);
    assertManagedEdgeMutable(plan.target,plan.candidate);
  }
  function read(token: object): Plan {
    engine.assertOpen();
    const plan=records.get(token);
    if (!plan || pending.get(plan.target)!==token) fault('RETIRED');
    validate(plan); return plan;
  }
  function dispose(token: object): void {
    const plan=records.get(token);records.delete(token);
    if(plan && pending.get(plan.target)===token)pending.delete(plan.target);
  }
  return Object.freeze({
    prepare(target: DisplayObjectContainer,candidate: DisplayObject): object {
      engine.assertOpen();live(target);live(candidate);assertContainer(target);
      if(pending.size>=32&&!pending.has(target))fault('LIMIT');
      if(isStageRoot(target)||isStageRoot(candidate)||target===candidate||parentOf(candidate)!==undefined
          ||!isScope(ownerOf(target)!)||!isScope(ownerOf(candidate)!))fault('ROOT_INVALID');
      // Target plus candidate roots already consume two of the 4,096 node slots.
      // Refuse before the managed-child check clones the target's direct list.
      if(childCountOf(target)>4094)fault('LIMIT');
      assertManagedChildrenMutable(target);assertManagedEdgeMutable(target,candidate);
      const captures:Capture[]=[],nodes=new Set<DisplayObject>();
      function subtree(root:DisplayObject):void {
        const stack=[{node:root,depth:1}];
        while(stack.length){const {node,depth}=stack.pop()!;
          if(nodes.has(node))fault('OVERLAP');
          if(nodes.size>=4096||depth>128)fault('LIMIT');
          live(node);const count=childCountOf(node);
          if(count>4096-nodes.size-stack.length-1)fault('LIMIT');
          nodes.add(node);const item=capture(node,true);captures.push(item);
          for(let i=count-1;i>=0;i--){const child=item.children![i]!;if(parentOf(child)!==node)fault('STALE');stack.push({node:child,depth:depth+1});}
        }
      }
      subtree(target);subtree(candidate);
      let ancestor=parentOf(target),depth=0;
      while(ancestor){if(++depth>128)fault('LIMIT');if(nodes.has(ancestor))fault('OVERLAP');captures.push(capture(ancestor,false));if(ancestor===stage)break;ancestor=parentOf(ancestor);}
      if(ancestor!==stage)fault('TARGET_DETACHED');
      for(const [other,token] of pending){if(other===target)continue;const plan=records.get(token)!;
        if(captures.some(item=>item.node===other))fault('OVERLAP');
        for(const node of nodes)if(plan.nodes.has(node))fault('OVERLAP');
      }
      const previous=captures[0]!.children!,plan:Plan={target,candidate,captures,nodes,previous,next:[candidate]};
      validate(plan);const token=Object.freeze({}),old=pending.get(target);
      // A refused request never supersedes a previously admitted request.
      if(old)dispose(old);records.set(token,plan);pending.set(target,token);return token;
    },
    validate(token:object):void{read(token);},
    capture(token:object){const plan=read(token);const result=collectSubtreeSharedFrameContent(stage,plan.target,plan.candidate);read(token);return result;},
    commit(token:object):void{
      const plan=read(token);
      // No callbacks, allocations or further admission after the complete validation pass.
      publishPreparedChildren(plan.target,plan.previous,plan.next);
      dispose(token);
    },
    dispose,
  });
}
