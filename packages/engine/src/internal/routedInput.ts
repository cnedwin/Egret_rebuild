// SPDX-License-Identifier: Apache-2.0
// What the pointer and the hover input share: which targets may receive them, how their cleanup
// callbacks run, and when a closed input lets go of its Engine.
import { DisplayObject, DisplayObjectContainer, EgretError } from '@egret/runtime';

// Captured when the module loads, so a later change to these accessors cannot redirect admission.
const getter = (prototype: object, key: string): ((this: DisplayObject) => unknown) =>
  Object.getOwnPropertyDescriptor(prototype, key)!.get!;
const parent = getter(DisplayObject.prototype, 'parent'),
  visible = getter(DisplayObject.prototype, 'visible');
const touch = getter(DisplayObject.prototype, 'touchEnabled'),
  children = getter(DisplayObjectContainer.prototype, 'touchChildren');

/**
 * Whether a target may receive routed input now. The Engine and the scope must still be open, the
 * target attached and touch-enabled, every node up to the stage visible, and every ancestor letting
 * its children be touched. An input that has closed passes no owner, scope or operations.
 */
export function acceptsRoutedInput(
  target: DisplayObject,
  owner: { assertReady(): void } | undefined,
  scope: { assertOpen(): void } | undefined,
  operations: { isAttached(target: DisplayObject, maxNodes: number): boolean } | undefined,
  maxNodes: number
): boolean {
  if (owner === undefined || scope === undefined || operations === undefined) return false;
  try {
    owner.assertReady();
    scope.assertOpen();
  } catch {
    return false;
  }
  if (!operations.isAttached(target, maxNodes) || Reflect.apply(touch, target, []) !== true) return false;
  let node: DisplayObject | undefined = target,
    visited = 0;
  while (node !== undefined) {
    if (++visited > maxNodes) throw new EgretError('HIT_TEST_TREE_LIMIT');
    if (Reflect.apply(visible, node, []) !== true) return false;
    if (node !== target && Reflect.apply(children, node, []) !== true) return false;
    node = Reflect.apply(parent, node, []) as DisplayObject | undefined;
  }
  return true;
}

/** What went wrong while cleanup callbacks ran: the first failure, and every later one beside it. */
export interface CleanupFailures {
  readonly failed: boolean;
  readonly first: unknown;
  readonly others: unknown[];
}
/** Runs every callback, whatever an earlier one threw. */
export function runCleanup(callbacks: readonly (() => void)[]): CleanupFailures {
  let first: unknown,
    failed = false;
  const others: unknown[] = [];
  for (const callback of callbacks)
    try {
      callback();
    } catch (cause) {
      if (!failed) {
        first = cause;
        failed = true;
      } else others.push(cause);
    }
  return { failed, first, others };
}

/**
 * Wraps the public operations of one input, which may reenter one another. When the outermost
 * operation returns, `settle` runs; that is where a closed input lets go of its Engine. A failure of
 * `settle` after the operation itself failed is reported as `combined(operationFailure, settleFailure)`.
 */
export function createRoutedOperations(
  settle: () => void,
  combined: (cause: unknown, cleanup: unknown) => Error
): <T>(operation: () => T) => T {
  let calls = 0;
  return function invoke<T>(operation: () => T): T {
    let value: T | undefined,
      first: unknown,
      failed = false;
    calls++;
    try {
      value = operation();
    } catch (cause) {
      failed = true;
      first = cause;
    } finally {
      calls--;
    }
    if (calls === 0)
      try {
        settle();
      } catch (cause) {
        if (failed) throw combined(first, cause);
        throw cause;
      }
    if (failed) throw first;
    return value as T;
  };
}
