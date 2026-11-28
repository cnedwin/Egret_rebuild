// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { PointerContact, PointerInput } from '../pointerInputTypes.js';
import { trackScreenControl } from '../internal/uiControlReportState.js';

/**
 * Reusable movement and action controls over the existing contact stream.
 *
 * These own control state only: they add no host listener, scheduler or gesture framework, and they
 * do not decide routing. A control takes one contact at most, refuses a second rather than stealing
 * it, and always ends at exactly one released value so a suspended or disposed control can never
 * leave an action held.
 */

export interface MovementValue {
  readonly x: number;
  readonly y: number;
}

interface MovementGeometry {
  /** Full-deflection distance: target-local when center is given, stage units otherwise. */
  readonly radius: number;
  /** Distance at or below which the control reports rest. Defaults to a tenth of the radius. */
  readonly deadZone?: number;
  /** Fixed point in target-local units. Omit to use the contact's own stage-space origin. */
  readonly center?: MovementValue;
}

/** A movement control to make: its input and target, its geometry, and what it calls. */
export interface MovementControlOptions extends MovementGeometry {
  readonly input: PointerInput;
  /** The surface that owns this control; contacts routed elsewhere are not claimed. */
  readonly target: DisplayObject;
  readonly onMovement?: (value: MovementValue) => void;
}

/** A virtual stick: where it points now, whether it is held, and calls that set or disable it. */
export interface MovementControl {
  readonly value: MovementValue;
  readonly active: boolean;
  readonly enabled: boolean;
  /** Keyboard or scripted equivalents issue movement through the same value. */
  setDirection(x: number, y: number): void;
  /** Replace the geometry. A change retires the held contact and returns to rest. */
  setGeometry(geometry: MovementGeometry): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

/** An action control to make: its input and target, and what is called when it is activated or pressed. */
export interface ActionControlOptions {
  readonly input: PointerInput;
  readonly target: DisplayObject;
  /** Pointer-only release policy. Defaults to capturedRelease, preserving captured delivery. */
  readonly activation?: 'capturedRelease' | 'releaseInside' | 'tap';
  /** For tap only: maximum excursion from down, in stage units. Defaults to 12. */
  readonly tapTolerance?: number;
  readonly onActivate?: () => void;
  readonly onPressChange?: (pressed: boolean) => void;
}

/** A button control: whether it is pressed, how often it was activated, and calls that press or disable it. */
export interface ActionControl {
  readonly pressed: boolean;
  readonly enabled: boolean;
  readonly activationCount: number;
  /** Keyboard or scripted equivalents share the pointer activation path. */
  press(): void;
  release(): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

const ZERO: MovementValue = Object.freeze({ x: 0, y: 0 });

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function checkOptions(options: unknown): void {
  if (options === null || typeof options !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
  const { input, target } = options as { input?: unknown; target?: unknown };
  if (input === null || typeof input !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
  if (target === null || typeof target !== 'object' || typeof (target as DisplayObject).on !== 'function') {
    throw new EgretError('UI_CONTROL_OPTIONS');
  }
}

/** Clamp a scripted or keyboard direction into the control's admitted range. */
function direction(x: number, y: number): MovementValue {
  if (!finite(x) || !finite(y)) throw new EgretError('UI_CONTROL_DIRECTION');
  const length = Math.hypot(x, y);
  if (length === 0) return ZERO;
  const scale = length > 1 ? 1 / length : 1;
  return Object.freeze({ x: x * scale, y: y * scale });
}

function checkedGeometry(options: MovementGeometry): {
  readonly radius: number;
  readonly deadZone: number;
  readonly center: MovementValue | undefined;
} {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new EgretError('UI_CONTROL_OPTIONS');
  }
  const { radius, center } = options;
  const deadZone = options.deadZone ?? radius / 10;
  if (!finite(radius) || radius <= 0) throw new EgretError('UI_CONTROL_RADIUS');
  if (!finite(deadZone) || deadZone < 0 || deadZone >= radius) throw new EgretError('UI_CONTROL_RADIUS');
  if (
    center !== undefined &&
    (center === null || typeof center !== 'object' || Array.isArray(center) || !finite(center.x) || !finite(center.y))
  ) {
    throw new EgretError('UI_CONTROL_OPTIONS');
  }
  return { radius, deadZone, center: center === undefined ? undefined : Object.freeze({ x: center.x, y: center.y }) };
}

/** A singular target (e.g. an animated scale of zero) has no target-local point. */
function localPoint(target: DisplayObject, contact: PointerContact): MovementValue | undefined {
  try {
    return target.globalToLocal(contact.globalX, contact.globalY);
  } catch (cause) {
    if (cause instanceof EgretError && cause.code === 'COORDINATE_TRANSFORM_SINGULAR') return undefined;
    throw cause;
  }
}

/** A virtual stick on a target: dragging from its contact origin or a fixed center gives a direction. */
export function createMovementControl(options: MovementControlOptions): MovementControl {
  checkOptions(options);
  const { input, target, onMovement } = options;
  let geometry = checkedGeometry(options);
  let closed = false;
  let enabled = true;
  let value = ZERO;
  let owner: { session: PointerContact['session']; originX: number; originY: number } | undefined;

  function publish(next: MovementValue): void {
    if (next.x === value.x && next.y === value.y) return;
    value = next;
    try {
      onMovement?.(next);
    } catch (cause) {
      throw cause;
    }
  }

  function release(): void {
    owner = undefined;
    publish(ZERO);
  }

  function begin(event: { payload: PointerContact }): void {
    if (closed || !enabled) return;
    // One owning contact. A second contact is refused rather than replacing the first.
    if (owner !== undefined) return;
    owner = { session: event.payload.session, originX: event.payload.globalX, originY: event.payload.globalY };
    // A fixed stick responds immediately to an off-center down.
    if (geometry.center !== undefined) move(event);
  }

  function move(event: { payload: PointerContact }): void {
    if (closed || owner === undefined || event.payload.session !== owner.session) return;
    let dx: number;
    let dy: number;
    if (geometry.center === undefined) {
      // Preserve the original contact-relative geometry in stage units.
      dx = event.payload.globalX - owner.originX;
      dy = event.payload.globalY - owner.originY;
    } else {
      const point = localPoint(target, event.payload);
      if (point === undefined) {
        release();
        return;
      }
      dx = point.x - geometry.center.x;
      dy = point.y - geometry.center.y;
    }
    const distance = Math.hypot(dx, dy);
    // Inside the dead zone the control reports rest, not a debounced direction.
    if (distance <= geometry.deadZone) {
      publish(ZERO);
      return;
    }
    const magnitude = Math.min(1, distance / geometry.radius);
    const scale = magnitude / distance;
    publish(Object.freeze({ x: dx * scale, y: dy * scale }));
  }

  function end(event: { payload: PointerContact }): void {
    // A refused second contact must not release the contact that owns the movement.
    if (closed || owner === undefined || event.payload.session !== owner.session) return;
    release();
  }

  const subscriptions = [
    target.on(input.events.begin, begin),
    target.on(input.events.move, move),
    target.on(input.events.end, end),
    target.on(input.events.cancel, end)
  ];
  // An invalid target receives no dispatch, so the owner-session terminal stream is the only
  // signal that the held contact is gone.
  const observeTerminal = input.observe(notification => {
    if (closed || owner === undefined || notification.contact.session !== owner.session) return;
    // Retire whatever the owning session leaves behind after the dispatch attempt, whatever the
    // destination, a stopped propagation or a routed failure did to it. An ordinary delivery has
    // already released here from the control's own handler, so this is only the fallback.
    if (notification.kind === 'cancel' || notification.kind === 'end') release();
  });

  const untrack = trackScreenControl(input, target, 'movement', () => enabled && !closed);
  return Object.freeze({
    get value() {
      return value;
    },
    get active() {
      return owner !== undefined;
    },
    get enabled() {
      return enabled;
    },
    setDirection(x: number, y: number) {
      if (closed) throw new EgretError('UI_CONTROL_CLOSED');
      if (!enabled) {
        publish(ZERO);
        return;
      }
      publish(direction(x, y));
    },
    setGeometry(options: MovementGeometry) {
      if (closed) throw new EgretError('UI_CONTROL_CLOSED');
      const next = checkedGeometry(options);
      if (
        next.radius === geometry.radius &&
        next.deadZone === geometry.deadZone &&
        next.center?.x === geometry.center?.x &&
        next.center?.y === geometry.center?.y
      ) {
        return;
      }
      // A new layout cannot reinterpret or accidentally re-arm the old owning contact.
      geometry = next;
      release();
    },
    setEnabled(next: boolean) {
      if (closed) throw new EgretError('UI_CONTROL_CLOSED');
      if (enabled === next) return;
      enabled = next;
      // Disabling a held control must not keep an action pressed.
      if (!enabled) release();
    },
    dispose() {
      if (closed) return;
      closed = true;
      untrack();
      let failure: unknown;
      try {
        release();
      } catch (cause) {
        // Keep the control terminal: every owned subscription is still released below.
        failure = cause;
      } finally {
        observeTerminal();
        for (const unsubscribe of subscriptions) {
          try {
            unsubscribe();
          } catch (cause) {
            failure ??= cause;
          }
        }
      }
      if (failure !== undefined) throw failure;
    }
  });
}

/** A button on a target: a captured press and release activates it by default. */
export function createActionControl(options: ActionControlOptions): ActionControl {
  return createSelectionItemAction(options, () => true);
}

/** A selection item's action still has its existing delivery path; reporting also reads its group's enable state. */
export function createSelectionItemAction(options: ActionControlOptions, reportEnabled: () => boolean): ActionControl {
  checkOptions(options);
  const { input, target, onActivate, onPressChange } = options;
  const activation = options.activation === undefined ? 'capturedRelease' : options.activation;
  const tapTolerance = options.tapTolerance === undefined ? 12 : options.tapTolerance;
  if (
    (activation !== 'capturedRelease' && activation !== 'releaseInside' && activation !== 'tap') ||
    !finite(tapTolerance) ||
    tapTolerance < 0 ||
    (options.tapTolerance !== undefined && activation !== 'tap')
  ) {
    throw new EgretError('UI_CONTROL_OPTIONS');
  }
  let closed = false;
  let enabled = true;
  let candidate: { session: PointerContact['session']; x: number; y: number; withinTolerance: boolean } | undefined;
  let held = false;
  let activations = 0;

  function setPressed(next: boolean): void {
    if (held === next) return;
    held = next;
    onPressChange?.(next);
  }

  function begin(event: { payload: PointerContact }): void {
    if (closed || !enabled) return;
    if (candidate !== undefined) return;
    candidate = {
      session: event.payload.session,
      x: event.payload.globalX,
      y: event.payload.globalY,
      withinTolerance: true
    };
    setPressed(true);
  }

  function noteExcursion(contact: PointerContact): void {
    if (closed || candidate === undefined || contact.session !== candidate.session) return;
    // A swipe cannot become a tap again by returning to its start.
    if (
      activation === 'tap' &&
      Math.hypot(contact.globalX - candidate.x, contact.globalY - candidate.y) > tapTolerance
    ) {
      candidate.withinTolerance = false;
    }
  }

  function releasedInside(contact: PointerContact): boolean {
    const area = target.hitArea;
    if (area === undefined) return false;
    const point = localPoint(target, contact);
    return (
      point !== undefined &&
      point.x >= area.x &&
      point.y >= area.y &&
      point.x - area.x < area.width &&
      point.y - area.y < area.height
    );
  }

  function end(event: { payload: PointerContact }): void {
    if (closed || candidate === undefined || event.payload.session !== candidate.session) return;
    // Judge the final sample as well as moves. Retire the owning press even if the geometry query fails.
    noteExcursion(event.payload);
    const withinTolerance = candidate.withinTolerance;
    candidate = undefined;
    let admitted = false;
    try {
      admitted =
        activation === 'capturedRelease' ||
        ((activation !== 'tap' || withinTolerance) && releasedInside(event.payload));
    } finally {
      setPressed(false);
    }
    if (admitted) activate();
  }

  function cancel(event: { payload: PointerContact }): void {
    // The refused second contact cancelling must not clear the first one's pending activation.
    if (closed || candidate === undefined || event.payload.session !== candidate.session) return;
    candidate = undefined;
    setPressed(false);
  }

  function activate(): void {
    if (closed || !enabled) return;
    activations += 1;
    onActivate?.();
  }

  const subscriptions = [
    target.on(input.events.begin, begin),
    target.on(input.events.end, end),
    target.on(input.events.cancel, cancel)
  ];
  const observeTerminal = input.observe(notification => {
    if (closed || candidate === undefined || notification.contact.session !== candidate.session) return;
    // Swipes count even if a move was stopped or routed away; the owning end must still be delivered.
    if (notification.kind === 'move') noteExcursion(notification.contact);
    // A terminal the control's own handler did not consume clears the press without activating.
    if (notification.kind === 'cancel' || notification.kind === 'end') {
      candidate = undefined;
      setPressed(false);
    }
  });

  const untrack = trackScreenControl(input, target, 'action', () => enabled && !closed && reportEnabled());
  return Object.freeze({
    get pressed() {
      return held;
    },
    get enabled() {
      return enabled;
    },
    get activationCount() {
      return activations;
    },
    press() {
      if (closed) throw new EgretError('UI_CONTROL_CLOSED');
      if (!enabled) return;
      setPressed(true);
    },
    release() {
      if (closed) throw new EgretError('UI_CONTROL_CLOSED');
      if (!enabled) {
        setPressed(false);
        return;
      }
      // A scripted release activates only if a press is outstanding; it cannot double-fire.
      if (!held) return;
      setPressed(false);
      activate();
    },
    setEnabled(next: boolean) {
      if (closed) throw new EgretError('UI_CONTROL_CLOSED');
      if (enabled === next) return;
      enabled = next;
      if (!enabled) {
        candidate = undefined;
        setPressed(false);
      }
    },
    dispose() {
      if (closed) return;
      closed = true;
      untrack();
      candidate = undefined;
      let failure: unknown;
      try {
        setPressed(false);
      } catch (cause) {
        failure = cause;
      } finally {
        observeTerminal();
        for (const unsubscribe of subscriptions) {
          try {
            unsubscribe();
          } catch (cause) {
            failure ??= cause;
          }
        }
      }
      if (failure !== undefined) throw failure;
    }
  });
}
