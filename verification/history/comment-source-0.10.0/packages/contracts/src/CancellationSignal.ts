/** A DOM-free cancellation listener; it receives no host Event object. */
export type CancellationListener = () => void;

/** One-way cancellation state. A late subscriber must inspect aborted itself. */
export interface CancellationSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  addEventListener(
    type: "abort",
    listener: CancellationListener,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: CancellationListener): void;
}
