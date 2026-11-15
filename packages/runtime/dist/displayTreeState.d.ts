import type { DisplayObject } from "./DisplayObject.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import type { Stage } from "./Stage.js";
export declare function registerNode(node: DisplayObject): void;
export declare function registerContainer(node: DisplayObjectContainer): void;
/** Authenticate an actual registered container without inspecting its shape. */
export declare function assertContainer(value: object): void;
export declare function markStageRoot(node: DisplayObject): void;
/** Identity-only authentication never reads a forged or proxied Stage. */
export declare function isStageRoot(value: unknown): value is Stage;
export declare function isDisplayNode(value: object): value is DisplayObject;
export declare function isTerminated(node: DisplayObject): boolean;
export declare function parentOf(node: DisplayObject): DisplayObjectContainer | undefined;
/** Return a snapshot so callers cannot mutate the authoritative child list. */
export declare function childrenOf(node: DisplayObject): readonly DisplayObject[];
/** Callback-free O(1) readers for budgeted traversal; never clone the list. */
export declare function childCountOf(node: DisplayObject): number;
export declare function childAtOf(node: DisplayObject, index: number): DisplayObject | undefined;
/** Read the exact direct-child index in O(n), without a snapshot or callbacks. */
export declare function childIndexOf(parent: DisplayObjectContainer, child: DisplayObject): number;
export declare function assertLive(node: DisplayObject): void;
export declare function assertAttachable(node: DisplayObject): void;
export declare function assertNoCycle(parent: DisplayObjectContainer, child: DisplayObject): void;
export declare function detachNode(child: DisplayObject): void;
/** Caller has completed validation; mutation has no subclass callbacks. */
export declare function attachNode(parent: DisplayObjectContainer, child: DisplayObject): void;
export declare function removeNode(parent: DisplayObjectContainer, child: DisplayObject): void;
/** Preflight every direct edge, then detach the batch without user callbacks. */
export declare function detachChildren(parent: DisplayObjectContainer): void;
export declare function setNodeIndex(parent: DisplayObjectContainer, child: DisplayObject, index: number): void;
export declare function terminateNode(node: DisplayObject): void;
/** Runtime-private records preserve ordered refusals until after Engine selection. */
export interface CapturedInsertionNode {
    readonly node: DisplayObject | undefined;
    readonly actualParent: DisplayObjectContainer | undefined;
    readonly children: readonly DisplayObject[] | undefined;
    readonly genuine: boolean;
    readonly terminated: boolean;
    readonly stageRoot: boolean;
    readonly repeated: boolean;
    readonly edgeAgrees: boolean;
}
export interface CapturedChildInsertion {
    readonly receiver: DisplayObjectContainer;
    readonly child: DisplayObject;
    readonly receiverTree: readonly CapturedInsertionNode[];
    readonly incomingTree: readonly CapturedInsertionNode[];
    readonly receiverAncestors: readonly DisplayObject[];
    readonly repeatedAncestor: boolean;
    readonly targetChildren: readonly DisplayObject[];
    readonly oldParent: DisplayObjectContainer | undefined;
    readonly sourceChildren: readonly DisplayObject[] | undefined;
    readonly sourceEdges: readonly CapturedInsertionNode[];
    readonly sourceContainerGenuine: boolean;
    readonly oldIndex: number;
}
/** The publication port receives fully allocated replacements, never public tokens. */
export interface PreparedInsertionTree {
    readonly capture: CapturedChildInsertion;
    readonly effectiveIndex: number;
    readonly targetReplacement: DisplayObject[] | undefined;
    readonly sourceReplacement: DisplayObject[] | undefined;
    readonly parentChanged: boolean;
}
/** Capture the complete posthook authority once, without semantic refusals or hooks. */
export declare function captureChildInsertion(receiver: DisplayObjectContainer, child: DisplayObject): CapturedChildInsertion;
/** Inclusive index checks never coerce boxed, string or other caller values. */
export declare function assertChildInsertionIndex(receiver: DisplayObjectContainer, index: number): void;
/** Engine openness is checked by ownership before these ordered root semantics. */
export declare function validateCapturedInsertionRoots(capture: CapturedChildInsertion, index: number): void;
/** Identity, life and edge checks precede the corresponding recorded affinity check. */
export declare function validateCapturedInsertionNode(record: CapturedInsertionNode): void;
/** Validate every current distinct-source direct edge, including unrelated siblings. */
export declare function validateCapturedInsertionSource(capture: CapturedChildInsertion): void;
/** Build both replacements solely from the validated capture; no mapping writes occur. */
export declare function prepareCapturedInsertionTree(capture: CapturedChildInsertion, index: number): PreparedInsertionTree;
/** Publication uses captured native writes only: source, target, then moved parent. */
export declare function publishCapturedInsertionTree(plan: PreparedInsertionTree): void;
/** UI-only preallocated list replacement, after complete private validation. */
export interface UiTreeReplacement {
    readonly parent: DisplayObjectContainer;
    readonly previous: readonly DisplayObject[];
    readonly next: DisplayObject[];
}
export declare function captureUiChildren(parent: DisplayObjectContainer): DisplayObject[];
export declare function validateUiChildren(parent: DisplayObjectContainer, expected: readonly DisplayObject[]): boolean;
export declare function publishUiTree(replacements: readonly UiTreeReplacement[]): void;
/** One validated borrowed-child replacement; all storage was allocated in preparation. */
export declare function publishPreparedChildren(parent: DisplayObjectContainer, previous: readonly DisplayObject[], next: DisplayObject[]): void;
//# sourceMappingURL=displayTreeState.d.ts.map