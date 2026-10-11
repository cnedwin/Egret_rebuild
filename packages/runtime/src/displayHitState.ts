import type { Rectangle2D } from '@egret/contracts';
import type { DisplayObject } from './DisplayObject.js';
import { EgretError } from './EgretError.js';
import { assertLive, isDisplayNode } from './displayTreeState.js';
import { finite } from './displayVisualState.js';
import { engineOf } from './ownership.js';

interface DisplayHitState {
  touchEnabled: boolean;
  hitArea: Rectangle2D | undefined;
  touchChildren: boolean | undefined;
}

// Interaction authority is independent of rendering content and public hooks.
const states = new WeakMap<object, DisplayHitState>();

export function registerDisplayHitNode(node: DisplayObject): void {
  states.set(node, { touchEnabled: false, hitArea: undefined, touchChildren: undefined });
}

export function registerDisplayHitContainer(node: DisplayObject): void {
  readDisplayHitState(node).touchChildren = true;
}

/** Genuine identity is checked before any receiver property can be consulted. */
export function readDisplayHitState(receiver: unknown): DisplayHitState {
  if (!isDisplayNode(receiver as object)) throw new EgretError('HIT_TEST_RECEIVER_INVALID');
  const state = states.get(receiver as object);
  if (state === undefined) throw new EgretError('HIT_TEST_RECEIVER_INVALID');
  return state;
}

function live(node: DisplayObject): void {
  assertLive(node);
  engineOf(node)?.assertOpen();
}

export function writeDisplayTouchEnabled(receiver: unknown, value: unknown): void {
  const state = readDisplayHitState(receiver), node = receiver as DisplayObject;
  live(node);
  if (typeof value !== 'boolean') throw new EgretError('HIT_TEST_VALUE_INVALID');
  state.touchEnabled = value;
}

export function readDisplayTouchChildren(receiver: unknown): boolean {
  const value = readDisplayHitState(receiver).touchChildren;
  if (value === undefined) throw new EgretError('HIT_TEST_RECEIVER_INVALID');
  return value;
}

export function writeDisplayTouchChildren(receiver: unknown, value: unknown): void {
  const state = readDisplayHitState(receiver);
  if (state.touchChildren === undefined) throw new EgretError('HIT_TEST_RECEIVER_INVALID');
  const node = receiver as DisplayObject;
  live(node);
  if (typeof value !== 'boolean') throw new EgretError('HIT_TEST_VALUE_INVALID');
  state.touchChildren = value;
}

/** Read caller fields once in fixed order; source faults never become semantics. */
export function writeDisplayHitArea(receiver: unknown, source: unknown): void {
  const state = readDisplayHitState(receiver), node = receiver as DisplayObject;
  live(node);
  if (source === undefined) { state.hitArea = undefined; return; }
  if (source === null || typeof source !== 'object') throw new EgretError('HIT_TEST_AREA_INVALID');
  let array: boolean;
  try { array = Array.isArray(source); }
  catch (cause) { throw new EgretError('HIT_TEST_AREA_INVALID', { cause }); }
  if (array) throw new EgretError('HIT_TEST_AREA_INVALID');
  let x: unknown, y: unknown, width: unknown, height: unknown;
  try {
    const area = source as Rectangle2D;
    x = area.x;
    y = area.y;
    width = area.width;
    height = area.height;
  } catch (cause) {
    // Application EgretError and even undefined throws retain their exact cause.
    throw new EgretError('HIT_TEST_AREA_INVALID', { cause });
  }
  // Successful source reads may terminate or rebind the current node. Their
  // completed reentrant effects stand; this outer admission commits only here.
  live(node);
  if (!finite(x) || !finite(y) || !finite(width) || !finite(height)
      || width < 0 || height < 0 || !finite(x + width) || !finite(y + height)) {
    throw new EgretError('HIT_TEST_AREA_INVALID');
  }
  state.hitArea = Object.freeze({ x, y, width, height });
}
