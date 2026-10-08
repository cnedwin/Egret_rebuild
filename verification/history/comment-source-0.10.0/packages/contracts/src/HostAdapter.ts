/** Host owns the surface and any borrowed device. Core never destroys them. */
export interface HostAdapter {
  /** Stable identity used to prevent concurrent engines borrowing one surface. */
  readonly surface: object;
  /** Startup may be asynchronous; createEngine returns only after it succeeds. */
  start?(): void | Promise<void>;
  /** Stops new work synchronously; close still proves completion of pending work. */
  stop?(): void;
  /** Resolves only after safe return of the surface and completion of host work.
   * Rejection does not prove safe return; core keeps that surface quarantined.
   * This prototype provides no force-release/recovery override.
   */
  close(): Promise<void>;
  /** Milliseconds. Cancellation must be synchronous and idempotent. */
  setTimeout(callback: () => void, delayMs: number): () => void;
}
