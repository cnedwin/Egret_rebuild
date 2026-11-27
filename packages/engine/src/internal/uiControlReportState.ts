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
