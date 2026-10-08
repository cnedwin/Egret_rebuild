import type { CancellationSignal } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { AssetRef } from "./AssetRef.js";
import type { CancellationController } from "./CancellationController.js";

/** Erased callbacks stay inside the manager; public generics remain invariant. */
export interface ProviderBinding {
  readonly load: (ref: AssetRef<never>, context: AssetLoadContext) => Promise<unknown>;
  readonly dispose: (value: unknown) => void;
}

export interface AssetLoadContext {
  readonly signal: CancellationSignal;
  readonly resourceGeneration: number;
  readonly taskId: number;
}

export interface Identity {
  readonly type: object;
  generation: number;
}

/** Installing is a transaction: detach waits until addEventListener has returned. */
export interface Waiter {
  pending: boolean;
  installing: boolean;
  listening: boolean;
  readonly signal: CancellationSignal | undefined;
  readonly listener: () => void;
  readonly resolve: (lease: AssetLease<unknown>) => void;
  readonly reject: (cause: unknown) => void;
  readonly entry: Entry;
}

export interface Entry {
  readonly ref: AssetRef<never>;
  readonly provider: ProviderBinding;
  readonly controller: CancellationController;
  readonly generation: number;
  readonly taskId: number;
  readonly waiters: Set<Waiter>;
  readonly leases: Set<AssetLease<unknown>>;
  state: "loading" | "ready" | "terminal";
  started: boolean;
  hasValue: boolean;
  cleanupAttempted: boolean;
  value: unknown;
}
