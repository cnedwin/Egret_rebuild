// SPDX-License-Identifier: Apache-2.0

export type PointerType = "mouse" | "touch" | "pen";
export type PointerEventKind = "begin" | "move" | "end" | "cancel";
export type PointerRouterState = "active" | "suspended" | "closed";
export type PointerCancelReason = "pointercancel" | "lostcapture" | "blur" | "hidden" | "pagehide"
  | "viewport" | "owner" | "suspended" | "dispose" | "error";

declare const sessionIdentity: unique symbol;

/** Only the creating router admits this frozen identity; host IDs may be reused. */
export interface PointerSession {
  readonly [sessionIdentity]: true;
  readonly generation: number;
  readonly id: number;
  readonly pointerId: number;
  readonly pointerType: PointerType;
}

export interface PointerUpdate {
  readonly globalX: number;
  readonly globalY: number;
  readonly buttons: number;
  readonly timestamp: number;
  readonly pressure?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface PointerSample extends PointerUpdate {
  readonly pointerId: number;
  readonly pointerType: PointerType;
}

/** A retained value: sequence orders all contacts on this router. */
export interface PointerContact extends PointerUpdate {
  readonly session: PointerSession;
  readonly sequence: number;
  readonly viewportRevision: number;
}

export interface PointerRouterOptions<T extends object> {
  readonly capacity?: number;
  readonly viewportRevision?: number;
  readonly pick: (globalX: number, globalY: number) => T | undefined;
  readonly eligible: (target: T) => boolean;
  readonly dispatch: (kind: PointerEventKind, contact: PointerContact, target: T | undefined, reason?: PointerCancelReason) => void;
}

/** DOM-free routing kernel; the owner supplies picking and eligibility authority. */
export interface PointerRouter<T extends object> {
  readonly state: PointerRouterState;
  readonly contacts: readonly PointerContact[];
  readonly viewportRevision: number;
  begin(sample: PointerSample): PointerSession | undefined;
  move(session: PointerSession, update: PointerUpdate): boolean;
  end(session: PointerSession, update: PointerUpdate): boolean;
  cancel(session: PointerSession, reason: PointerCancelReason): boolean;
  cancelAll(reason: PointerCancelReason): void;
  capture(session: PointerSession, target: T): boolean;
  releaseCapture(session: PointerSession): boolean;
  sync(): void;
  setViewportRevision(revision: number): void;
  setInteractive(interactive: boolean): void;
  dispose(): void;
}
