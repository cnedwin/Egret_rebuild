import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import type { Bitmap } from './Bitmap.js';
import type { Stage } from './Stage.js';
import type { CapturedSharedContent2D } from './sharedFrameCapture.js';
import type { Diagnostic } from '@egret/contracts';
import type { CapturedInsertionNode, PreparedInsertionTree } from './displayTreeState.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { Scope } from './Scope.js';
import type { DisplayObject } from './DisplayObject.js';
import type { AssetGroupOperations } from './assetManagerOwnerState.js';
/** Internal instance port; runtime never imports the Engine implementation. */
export interface EngineContext {
    /** @internal Registered once by the genuine Stage; never a caller scene callback. */
    readonly registerPreparedDisplayOperations?: (operations: Readonly<{
        prepare(target: DisplayObjectContainer, candidate: DisplayObject): object;
        validate(token: object): void;
        capture(token: object): CapturedSharedContent2D;
        commit(token: object): void;
        dispose(token: object): void;
    }>) => void;
    /** @internal Genuine Bitmap assembly; no runtime root forwards these operations. */
    readonly registerBitmapResourceTarget?: (bitmap: Bitmap, operations: Readonly<{
        capture(bitmap: Bitmap, expected?: object): object;
        prepare(bitmap: Bitmap, lease: AssetLease<Texture>): object;
        commit(bitmap: Bitmap, expected: object, prepared: object): void;
        claim(bitmap: Bitmap, lease: AssetLease<Texture>, owner: object): void;
        release(lease: AssetLease<Texture>): void;
        clearIfCurrent(bitmap: Bitmap, expected: object): boolean;
        captureBatch(targets: readonly Bitmap[]): object;
        prepareBatch(captured: object, members: readonly AssetLease<Texture>[]): object;
        commitBatch(captured: object, prepared: object): object;
        capturePreparedSharedContent(stage: Stage, captured: object, prepared: object): CapturedSharedContent2D;
        clearBatchIfCurrent(publication: object): void;
    }>) => void;
    assertOpen(): void;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
    /** @internal Optional explicit-text assembly; ordinary runtime contexts need not supply it. */
    readonly registerTextFieldCache?: (cache: object, construct: (scope: Scope) => DisplayObject, kind?: 'explicit-lines' | 'paragraph') => void;
    /** @internal Optional group assembly; ordinary runtime contexts remain unchanged. */
    readonly registerAssetGroupOperations?: (operations: AssetGroupOperations) => void;
}
export declare const OWNERSHIP_CHILDREN: unique symbol;
export declare const ASSERT_BINDABLE: unique symbol;
export declare const ASSERT_ATTACHABLE: unique symbol;
export declare function ownerOf(value: object): object | undefined;
export declare function engineOf(value: object): EngineContext | undefined;
export declare function claimOwner(value: object, owner: object): void;
export declare function engineInSubtree(value: object): EngineContext | undefined;
/** Validate every descendant before touching any owner, binding, or parent. */
export declare function preflightBinding(value: object, engine: EngineContext): readonly object[];
/** Callback-free final validation uses the current tree and binding authority. */
export declare function validateBinding(value: object, engine: EngineContext): readonly object[];
/** Commit only values returned by callback-free validation, without intervening hooks. */
export declare function commitBinding(values: readonly object[], engine: EngineContext): void;
export declare function bind(value: object, engine: EngineContext): void;
interface CapturedInsertionAffinity {
    readonly record: CapturedInsertionNode;
    readonly engine: EngineContext | undefined;
}
/** This plan stays inside runtime-private modules and is consumed once by addChildAt. */
export interface PreparedChildInsertion {
    readonly tree: PreparedInsertionTree;
    readonly receiverAffinities: readonly CapturedInsertionAffinity[];
    readonly incomingAffinities: readonly CapturedInsertionAffinity[];
    readonly engine: EngineContext | undefined;
    readonly stagedBindings: readonly DisplayObject[];
}
/** One post-last-hook capture supplies Engine selection, validation and all preparation. */
export declare function prepareChildInsertion(receiver: DisplayObjectContainer, child: DisplayObject, index: number): PreparedChildInsertion;
/** Straight-line commit has no hook, validation, explicit allocation or ownership write. */
export declare function publishPreparedChildInsertion(plan: PreparedChildInsertion): void;
export {};
//# sourceMappingURL=ownership.d.ts.map