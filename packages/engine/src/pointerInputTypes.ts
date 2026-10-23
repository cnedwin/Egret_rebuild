// SPDX-License-Identifier: Apache-2.0
import type {DisplayObject, EventType, Scope} from '@egret/runtime';
import type {PointerCancelReason, PointerContact, PointerEventKind, PointerRouter} from '@egret/runtime/input';
import type {Engine} from './Engine.js';
export type {PointerCancelReason, PointerContact, PointerEventKind, PointerSample, PointerSession, PointerType, PointerUpdate, PointerRouterState} from '@egret/runtime/input';

export interface PointerNotification {
  readonly kind: PointerEventKind;
  readonly contact: PointerContact;
  readonly target: DisplayObject | undefined;
  readonly reason?: PointerCancelReason;
}
export interface PointerInputOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly width: number;
  readonly height: number;
  readonly maxNodes?: number;
  readonly capacity?: number;
  readonly onContact?: (notification: PointerNotification) => void;
}
export interface PointerInputEvents {
  readonly begin: EventType<PointerContact>;
  readonly move: EventType<PointerContact>;
  readonly end: EventType<PointerContact>;
  readonly cancel: EventType<PointerContact & {readonly reason: PointerCancelReason}>;
}
/** Scope-owned input for an explicitly supplied logical host stream. */
export interface PointerInput extends PointerRouter<DisplayObject> {
  readonly events: PointerInputEvents;
}
