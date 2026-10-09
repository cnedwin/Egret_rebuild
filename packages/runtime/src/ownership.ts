import type { Diagnostic } from "@egret/contracts";
import { EgretError } from "./EgretError.js";
import { assertLive, childrenOf, isDisplayNode } from "./displayTreeState.js";

/** Internal instance port; runtime never imports the Engine implementation. */
export interface EngineContext {
  assertOpen(): void;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
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
