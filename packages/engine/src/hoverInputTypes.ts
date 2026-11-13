// SPDX-License-Identifier: Apache-2.0
import type {DisplayObject, EventType, Scope} from '@egret/runtime';
import type {Engine} from './Engine.js';

/** Pointers that can be over the scene without pressing it. A finger cannot. */
export type HoverPointerType = 'mouse' | 'pen';
export type HoverInputState = 'active' | 'suspended' | 'closed';
/**
 * Why a target stopped being hovered: the pointer went to another target or to none, left the
 * surface, pressed, or was cancelled by the platform; the target stopped being a possible target;
 * the mapping of the surface changed; the window or the page went away; or the input was
 * suspended, disposed or failed.
 */
export type HoverLeaveReason = 'target' | 'outside' | 'contact' | 'pointercancel' | 'owner' | 'viewport'
  | 'blur' | 'hidden' | 'pagehide' | 'suspended' | 'dispose' | 'error';
export type WheelUnit = 'pixel' | 'line' | 'page';

export interface HoverSample {
  readonly pointerId: number;
  readonly pointerType: HoverPointerType;
  readonly globalX: number;
  readonly globalY: number;
  readonly timestamp: number;
}
/** A retained value: sequence orders every hover and wheel observation of this input. */
export interface HoverPoint extends HoverSample {
  readonly sequence: number;
  readonly viewportRevision: number;
}
/** A point of an enter or a leave, with the other end of the movement when there is one. */
export interface HoverTransition extends HoverPoint {
  /** On an enter, what the pointer left in the same movement. On a leave, what it is going to. */
  readonly related?: DisplayObject;
}
export interface WheelSample {
  readonly globalX: number;
  readonly globalY: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ?: number;
  /** What one unit of the deltas is. The host reports it; nothing is converted. */
  readonly unit: WheelUnit;
  readonly timestamp: number;
  /** The platform's zoom modifier was held, as a pinch on a trackpad also reports. */
  readonly zoom?: boolean;
}
export interface WheelPoint extends WheelSample {
  readonly sequence: number;
  readonly viewportRevision: number;
}
export interface HoverNotification {
  readonly kind: 'enter' | 'move' | 'leave';
  readonly point: HoverPoint;
  /** On a leave, the object that is no longer hovered, even when it has left the stage. */
  readonly target: DisplayObject;
  readonly reason?: HoverLeaveReason;
  /** On an enter, what the pointer left in the same movement. On a leave, what it is going to. */
  readonly related?: DisplayObject;
}
export interface WheelNotification {
  readonly point: WheelPoint;
  readonly target: DisplayObject | undefined;
  /** A listener on the target path prevented the default. */
  readonly consumed: boolean;
}
export interface HoverInputOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly width: number;
  readonly height: number;
  readonly maxNodes?: number;
  /** Pointers that may hover at once. Defaults to 4. */
  readonly capacity?: number;
  /** Runs before the target path of each enter, move and leave. */
  readonly onHover?: (notification: HoverNotification) => void;
  /** Runs after the target path of a wheel. Returning true consumes a wheel nothing else consumed. */
  readonly onWheel?: (notification: WheelNotification) => boolean | void;
}
export interface HoverInputEvents {
  readonly enter: EventType<HoverTransition>;
  readonly move: EventType<HoverPoint>;
  readonly leave: EventType<HoverTransition & {readonly reason: HoverLeaveReason}>;
  readonly wheel: EventType<WheelPoint>;
}
export interface HoverState {
  readonly point: HoverPoint;
  readonly target: DisplayObject | undefined;
}
/** Scope-owned hover and wheel routing for an explicitly supplied logical host stream. */
export interface HoverInput {
  readonly state: HoverInputState;
  readonly events: HoverInputEvents;
  readonly width: number;
  readonly height: number;
  readonly viewportRevision: number;
  /** One entry for each pointer that is over the surface, in order of arrival. */
  readonly hovers: readonly HoverState[];
  /** Where an unpressed pointer is. Returns what it is over now. */
  sample(sample: HoverSample): DisplayObject | undefined;
  leave(pointerId: number, reason: HoverLeaveReason): boolean;
  leaveAll(reason: HoverLeaveReason): void;
  /** Routes one wheel step. Returns whether it was consumed. */
  wheel(sample: WheelSample): boolean;
  /** Picks again where each pointer rests, after the scene changed under it. */
  sync(): void;
  setViewportRevision(revision: number): void;
  setInteractive(interactive: boolean): void;
  /**
   * Every enter, move and leave from now on, each after its target path has run. A failure of
   * the listener is kept from the input and from the other listeners. Returns a function that
   * removes it.
   */
  observe(listener: (notification: HoverNotification) => void): () => void;
  /**
   * Runs the listener once when the input has closed, after what was hovered has been left. A
   * listener added later runs at once. Returns a function that removes it.
   */
  onClose(listener: () => void): () => void;
  dispose(): void;
}
