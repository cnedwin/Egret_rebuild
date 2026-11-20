// SPDX-License-Identifier: Apache-2.0

/** What made a pointer: a mouse, a finger or a pen. */
export type PointerType = "mouse" | "touch" | "pen";
/** What happened to a pointer: it went down, moved, went up or was cancelled. */
export type PointerEventKind = "begin" | "move" | "end" | "cancel";
/** Whether a pointer router passes input on, holds it, or has closed. */
export type PointerRouterState = "active" | "suspended" | "closed";
/** Why a pointer was cancelled. */
export type PointerCancelReason =
  | "pointercancel"
  | "lostcapture"
  | "blur"
  | "hidden"
  | "pagehide"
  | "viewport"
  | "owner"
  | "suspended"
  | "dispose"
  | "error";

declare const sessionIdentity: unique symbol;

/** Only the creating router admits this frozen identity; host IDs may be reused. */
export interface PointerSession {
  readonly [sessionIdentity]: true;
  readonly generation: number;
  readonly id: number;
  readonly pointerId: number;
  readonly pointerType: PointerType;
}

/** Where a pointer is on the stage, which buttons it holds, and when, with its pressure and size where the device gives them. */
export interface PointerUpdate {
  readonly globalX: number;
  readonly globalY: number;
  readonly buttons: number;
  readonly timestamp: number;
  readonly pressure?: number;
  readonly width?: number;
  readonly height?: number;
}

/** One pointer's state at one moment: which pointer it is, what made it and where it is. */
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
  readonly dispatch: (
    kind: PointerEventKind,
    contact: PointerContact,
    target: T | undefined,
    reason?: PointerCancelReason
  ) => void;
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
