/** Synchronous terminal cleanup. Scope catches failures and continues cleanup. */
export interface Disposable {
  dispose(): void;
}

/** Releases a lease; resource ownership and disposal remain with its provider. */
export interface Releasable {
  release(): void;
}

/** Scope prefers dispose() when a value implements both cleanup protocols. */
export type ScopeValue = Disposable | Releasable;
