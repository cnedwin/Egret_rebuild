// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject } from '@egret/runtime';
import type { PointerInput } from '../pointerInputTypes.js';

/** Private observation of the real engine control bindings, not another input route. */
export type ScreenControlKind = 'action' | 'range' | 'movement' | 'scroll';
interface Registration {
  readonly kind: ScreenControlKind;
  readonly enabled: () => boolean;
}
const bindings = new WeakMap<PointerInput, WeakMap<DisplayObject, Set<Registration>>>();

/** The owner registers after it acquires its real subscriptions and removes this alongside them. */
export function trackScreenControl(
  input: PointerInput,
  target: DisplayObject,
  kind: ScreenControlKind,
  enabled: () => boolean
): () => void {
  let targets = bindings.get(input);
  if (targets === undefined) {
    targets = new WeakMap();
    bindings.set(input, targets);
  }
  let registrations = targets.get(target);
  if (registrations === undefined) {
    registrations = new Set();
    targets.set(target, registrations);
  }
  const registration = { kind, enabled };
  registrations.add(registration);
  return () => {
    registrations.delete(registration);
    if (registrations.size === 0 && targets.get(target) === registrations) targets.delete(target);
  };
}

/** The native screen verifier sees only the current status of controls on its own pointer surface. */
export function screenControlFor(
  input: PointerInput,
  target: DisplayObject
): { readonly kind: ScreenControlKind; readonly enabled: boolean } | undefined {
  const registrations = bindings.get(input)?.get(target);
  if (registrations === undefined) return undefined;
  let first: Registration | undefined;
  for (const registration of registrations) {
    first ??= registration;
    if (registration.enabled()) return { kind: registration.kind, enabled: true };
  }
  return first === undefined ? undefined : { kind: first.kind, enabled: false };
}

export interface ScreenOccluderRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface ScreenOccluderOptions {
  readonly name: string | (() => string);
  /** The authored painted face in the target's local coordinates, not a container's aggregate bounds. */
  readonly rect: ScreenOccluderRect | (() => ScreenOccluderRect);
}
export interface ScreenOccluder {
  dispose(): void;
}
interface OcclusionClaim {
  readonly name: string;
  readonly rect: ScreenOccluderRect;
}
const occluders = new WeakMap<DisplayObject, Set<ScreenOccluderOptions>>();
const validRect = (rect: ScreenOccluderRect): boolean =>
  rect !== null &&
  typeof rect === 'object' &&
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
  rect.width > 0 &&
  rect.height > 0;

/**
 * Name a genuinely painted UI face that may cover a control without taking its
 * input. The verifier observes this local rectangle in the real display tree;
 * it never changes drawing, picking, or semantic focus. Dispose the handle
 * when that face is retired. Functions permit responsive, translated faces.
 */
export function registerScreenOccluder(target: DisplayObject, options: ScreenOccluderOptions): ScreenOccluder {
  if (
    target === null ||
    typeof target !== 'object' ||
    target.isDisposed ||
    options === null ||
    typeof options !== 'object' ||
    (typeof options.name !== 'function' && (typeof options.name !== 'string' || !options.name.trim())) ||
    (typeof options.rect !== 'function' && !validRect(options.rect))
  )
    throw new TypeError('A screen occluder needs a live target, a name and a positive local rectangle');
  // Keep a snapshot of static inputs. Dynamic suppliers are read only while
  // the tooling requests a receipt, not during ordinary frame updates.
  const record: ScreenOccluderOptions = Object.freeze({
    name: options.name,
    rect: typeof options.rect === 'function' ? options.rect : Object.freeze({ ...options.rect })
  });
  let set = occluders.get(target);
  if (set === undefined) {
    set = new Set();
    occluders.set(target, set);
  }
  set.add(record);
  return Object.freeze({
    dispose() {
      set.delete(record);
      if (set.size === 0 && occluders.get(target) === set) occluders.delete(target);
    }
  });
}

/** Only the live, registered author's rectangles, retrieved by the native screen reporter. */
export function screenOccludersFor(target: DisplayObject): readonly OcclusionClaim[] {
  const result: OcclusionClaim[] = [];
  if (target.isDisposed) return result;
  for (const entry of occluders.get(target) ?? []) {
    try {
      const name = typeof entry.name === 'function' ? entry.name() : entry.name;
      const rect = typeof entry.rect === 'function' ? entry.rect() : entry.rect;
      if (typeof name === 'string' && name.trim() && validRect(rect))
        result.push({ name: name.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
    } catch {
      // A refused diagnostic supplier must not break a game or another control's receipt.
    }
  }
  return result;
}
