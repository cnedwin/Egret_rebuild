import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import type { Bitmap } from './Bitmap.js';
import type { Diagnostic } from "@egret/contracts";
import { EgretError } from "./EgretError.js";
import { assertLive, captureChildInsertion, childrenOf, isDisplayNode, prepareCapturedInsertionTree, publishCapturedInsertionTree, validateCapturedInsertionNode, validateCapturedInsertionRoots, validateCapturedInsertionSource } from "./displayTreeState.js";
import type { CapturedInsertionNode, PreparedInsertionTree } from "./displayTreeState.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import type { Scope } from './Scope.js';
import type { DisplayObject } from './DisplayObject.js';
import type { AssetGroupOperations } from './assetManagerOwnerState.js';

/** Internal instance port; runtime never imports the Engine implementation. */
export interface EngineContext {
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
    clearBatchIfCurrent(publication: object): void;
  }>) => void;
  assertOpen(): void;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
  /** @internal Optional explicit-text assembly; ordinary runtime contexts need not supply it. */
  readonly registerTextFieldCache?: (cache: object, construct: (scope: Scope) => DisplayObject) => void;
  /** @internal Optional group assembly; ordinary runtime contexts remain unchanged. */
  readonly registerAssetGroupOperations?: (operations: AssetGroupOperations) => void;
}

export const OWNERSHIP_CHILDREN: unique symbol = Symbol("egret.ownershipChildren");
export const ASSERT_BINDABLE: unique symbol = Symbol("egret.assertBindable");
export const ASSERT_ATTACHABLE: unique symbol = Symbol("egret.assertAttachable");

// Cleanup ownership and engine affinity are separate lifetime identities.
const owners = new WeakMap<object, object>();
const engines = new WeakMap<object, EngineContext>();

export function ownerOf(value: object): object | undefined { return owners.get(value); }
export function engineOf(value: object): EngineContext | undefined { return engines.get(value); }
export function claimOwner(value: object, owner: object): void { owners.set(value, owner); }

export function engineInSubtree(value: object): EngineContext | undefined {
  const pending: object[] = [value];
  while (pending.length !== 0) {
    const current = pending.pop();
    if (current === undefined) break;
    const engine = engineOf(current);
    if (engine !== undefined) return engine;
    if (isDisplayNode(current)) pending.push(...childrenOf(current));
  }
  return undefined;
}

/** Validate every descendant before touching any owner, binding, or parent. */
export function preflightBinding(value: object, engine: EngineContext): readonly object[] {
  engine.assertOpen();
  const pending: object[] = [value];
  const values: object[] = [];
  while (pending.length !== 0) {
    const current = pending.pop();
    if (current === undefined) break;
    const existing = engineOf(current);
    if (existing !== undefined && existing !== engine) throw new EgretError("ENGINE_MISMATCH");
    if (isDisplayNode(current)) {
      current[ASSERT_BINDABLE]();
      pending.push(...childrenOf(current));
    }
    values.push(current);
  }
  return values;
}

/** Callback-free final validation uses the current tree and binding authority. */
export function validateBinding(value: object, engine: EngineContext): readonly object[] {
  engine.assertOpen();
  const pending: object[] = [value];
  const values: object[] = [];
  while (pending.length !== 0) {
    const current = pending.pop();
    if (current === undefined) break;
    const existing = engineOf(current);
    if (existing !== undefined && existing !== engine) throw new EgretError("ENGINE_MISMATCH");
    if (isDisplayNode(current)) {
      assertLive(current);
      pending.push(...childrenOf(current));
    }
    values.push(current);
  }
  return values;
}

/** Commit only values returned by callback-free validation, without intervening hooks. */
export function commitBinding(values: readonly object[], engine: EngineContext): void {
  for (const value of values) engines.set(value, engine);
}

export function bind(value: object, engine: EngineContext): void {
  preflightBinding(value, engine);
  commitBinding(validateBinding(value, engine), engine);
}


// The new finite coordinator owns captured affinity reads/writes, separate from legacy bind.
const readInsertionEngine = engines.get.bind(engines);
const writeInsertionEngine = engines.set.bind(engines);
const InsertionBindingSet = Set;
const insertionBindingHas = Set.prototype.has.call.bind(Set.prototype.has) as (set: Set<unknown>, value: unknown) => boolean;
const insertionBindingAdd = Set.prototype.add.call.bind(Set.prototype.add) as (set: Set<unknown>, value: unknown) => Set<unknown>;

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

function captureInsertionAffinities(records: readonly CapturedInsertionNode[]): CapturedInsertionAffinity[] {
  const affinities: CapturedInsertionAffinity[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!;
    affinities[index] = { record, engine: readInsertionEngine(record.node as object) };
  }
  return affinities;
}

function firstInsertionEngine(records: readonly CapturedInsertionAffinity[]): EngineContext | undefined {
  for (let index = 0; index < records.length; index++) {
    const engine = records[index]!.engine;
    if (engine !== undefined) return engine;
  }
  return undefined;
}

function validateInsertionAffinities(records: readonly CapturedInsertionAffinity[], engine: EngineContext | undefined): void {
  for (let index = 0; index < records.length; index++) {
    const current = records[index]!;
    validateCapturedInsertionNode(current.record);
    if (current.engine !== undefined && current.engine !== engine) throw new EgretError("ENGINE_MISMATCH");
  }
}

/** One post-last-hook capture supplies Engine selection, validation and all preparation. */
export function prepareChildInsertion(receiver: DisplayObjectContainer, child: DisplayObject, index: number): PreparedChildInsertion {
  const capture = captureChildInsertion(receiver, child);
  const receiverAffinities = captureInsertionAffinities(capture.receiverTree);
  const incomingAffinities = captureInsertionAffinities(capture.incomingTree);
  const engine = firstInsertionEngine(receiverAffinities) ?? firstInsertionEngine(incomingAffinities);
  engine?.assertOpen();
  validateCapturedInsertionRoots(capture, index);
  // Both complete trees are always validated, including a wholly Engine-free capture.
  validateInsertionAffinities(receiverAffinities, engine);
  validateInsertionAffinities(incomingAffinities, engine);
  validateCapturedInsertionSource(capture);
  const tree = prepareCapturedInsertionTree(capture, index);
  const stagedBindings: DisplayObject[] = [];
  const seen = new InsertionBindingSet<unknown>();
  if (engine !== undefined) {
    for (let treeIndex = 0; treeIndex < 2; treeIndex++) {
      const records = treeIndex === 0 ? receiverAffinities : incomingAffinities;
      for (let position = 0; position < records.length; position++) {
        const current = records[position]!, node = current.record.node;
        if (current.engine === undefined && node !== undefined && !insertionBindingHas(seen, node)) {
          insertionBindingAdd(seen, node);
          stagedBindings[stagedBindings.length] = node;
        }
      }
    }
  }
  // Every explicit list, value and plan allocation finishes before the first outer write.
  return { tree, receiverAffinities, incomingAffinities, engine, stagedBindings };
}

/** Straight-line commit has no hook, validation, explicit allocation or ownership write. */
export function publishPreparedChildInsertion(plan: PreparedChildInsertion): void {
  if (plan.engine !== undefined) {
    for (let index = 0; index < plan.stagedBindings.length; index++) writeInsertionEngine(plan.stagedBindings[index]!, plan.engine);
  }
  publishCapturedInsertionTree(plan.tree);
}
