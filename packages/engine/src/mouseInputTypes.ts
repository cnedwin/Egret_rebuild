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
export type MouseInputState = 'idle' | 'pressed' | 'closed';
export type MouseInputCancelReason = 'pointercancel' | 'blur' | 'pagehide';
export interface MouseInputPayload {
  readonly pointerId: number;
  readonly globalX: number;
  readonly globalY: number;
  readonly pointerType: 'mouse';
  readonly button: 0;
}
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
