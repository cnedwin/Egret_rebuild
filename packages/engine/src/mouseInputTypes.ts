import type { EventType, Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';

declare const MOUSE_INPUT: unique symbol;

/** Fixed logical dimensions; browser layout scaling does not change game coordinates. */
export interface MouseInputOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly width: number;
  readonly height: number;
  readonly maxNodes?: number;
}
/** Whether mouse input is idle, has a button pressed, or has closed. */
export type MouseInputState = 'idle' | 'pressed' | 'closed';
/** Why a press was cancelled. */
export type MouseInputCancelReason = 'pointercancel' | 'blur' | 'pagehide';
/** A mouse event: which pointer, where on the stage, what made it and which button. */
export interface MouseInputPayload {
  readonly pointerId: number;
  readonly globalX: number;
  readonly globalY: number;
  readonly pointerType: 'mouse';
  readonly button: 0;
}
/** The event types mouse input dispatches: begin, end, activate and cancel. */
export interface MouseInputEvents {
  readonly begin: EventType<MouseInputPayload>;
  readonly end: EventType<MouseInputPayload>;
  readonly activate: EventType<MouseInputPayload>;
  readonly cancel: EventType<MouseInputPayload & { readonly reason: MouseInputCancelReason }>;
}
/** Scope-owned synchronous input. Obtain it from the optional browser entry. */
export interface MouseInput {
  readonly [MOUSE_INPUT]: true;
  readonly state: MouseInputState;
  readonly events: MouseInputEvents;
  dispose(): void;
}
