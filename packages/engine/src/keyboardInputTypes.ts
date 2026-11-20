// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject, EventType, Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
/** One key as the host gives it: its code and key, whether it repeats, and the modifiers held. */
export interface KeyboardSample {
  readonly code: string;
  readonly key: string;
  readonly repeat?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
}
/** Why a held key was let go of without its key up. */
export type KeyboardCancelReason =
  | 'focus'
  | 'rebind'
  | 'removed'
  | 'owner'
  | 'suspended'
  | 'dispose'
  | 'blur'
  | 'hidden'
  | 'pagehide'
  | 'error';
/** A key event and the target it went to. */
export interface KeyboardKeyPayload extends Required<KeyboardSample> {
  readonly targetId: string;
}
/** A key that was let go of without its key up, and why. */
export interface KeyboardCancelPayload extends KeyboardKeyPayload {
  readonly reason: KeyboardCancelReason;
}
/** A target that gained or lost focus, the other target, why, and whether focus is shown. */
export interface KeyboardFocusPayload {
  readonly targetId: string;
  readonly relatedId: string | undefined;
  readonly reason: string;
  readonly focusVisible: boolean;
}
/** Focus that moved: from which target to which, why, and whether it is shown. */
export interface KeyboardFocusChange {
  readonly previousId: string | undefined;
  readonly focusedId: string | undefined;
  readonly reason: string;
  readonly focusVisible: boolean;
}
/** Keyboard input to make: its engine and scope, its limits, and what is called when focus moves. */
export interface KeyboardInputOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly maxTargets?: number;
  readonly maxKeys?: number;
  readonly maxNodes?: number;
  readonly onFocusChange?: (change: KeyboardFocusChange) => void;
}
/** A target to register: its id, its display object, its place in Tab order and whether it is disabled. */
export interface KeyboardTargetOptions {
  readonly id: string;
  readonly target: DisplayObject;
  readonly tabIndex?: number;
  readonly disabled?: boolean;
}
/** A registered target: change it, or dispose of it to take it out. */
export interface KeyboardTargetRegistration {
  update(options: Partial<Omit<KeyboardTargetOptions, 'id'>>): void;
  dispose(): void;
}
/** Keyboard input as it is now: its state, the focused target, and the keys held. */
export interface KeyboardInputSnapshot {
  readonly state: 'active' | 'suspended' | 'closed';
  readonly focusedId: string | undefined;
  readonly focusVisible: boolean;
  readonly pressedKeys: readonly string[];
  readonly targetCount: number;
}
/** The event types keyboard input dispatches: key down and up, cancel, and focus in and out. */
export interface KeyboardInputEvents {
  readonly keyDown: EventType<KeyboardKeyPayload>;
  readonly keyUp: EventType<KeyboardKeyPayload>;
  readonly cancel: EventType<KeyboardCancelPayload>;
  readonly focusIn: EventType<KeyboardFocusPayload>;
  readonly focusOut: EventType<KeyboardFocusPayload>;
}
/** How focus is given: whether it is shown, and why it moved. */
export interface KeyboardFocusOptions {
  readonly visible?: boolean;
  readonly reason?: 'programmatic' | 'keyboard' | 'pointer';
}
/** Synchronous logical focus; text editing and IME are outside this channel. */
export interface KeyboardInput {
  readonly events: KeyboardInputEvents;
  registerTarget(options: KeyboardTargetOptions): KeyboardTargetRegistration;
  focus(id: string | undefined, options?: KeyboardFocusOptions): void;
  moveFocus(direction: 'next' | 'previous', wrap?: boolean): string | undefined;
  keyDown(sample: KeyboardSample): boolean;
  keyUp(sample: KeyboardSample): boolean;
  cancel(reason?: KeyboardCancelReason): void;
  sync(): void;
  setInteractive(value: boolean): void;
  getSnapshot(): KeyboardInputSnapshot;
  dispose(): void;
}
