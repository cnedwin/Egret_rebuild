export interface EgretErrorOptions {
  readonly cause?: unknown;
  readonly cleanupErrors?: readonly unknown[];
}

/** Stable machine-readable code, original cause, and associated cleanup failures. */
export class EgretError extends Error {
  public readonly code: string;
  public readonly cleanupErrors: readonly unknown[];

  public constructor(code: string, options: EgretErrorOptions = {}) {
    super(code, { cause: options.cause });
    this.name = "EgretError";
    this.code = code;
    // Copy and freeze the list without replacing the original failure cause.
    this.cleanupErrors = Object.freeze([...(options.cleanupErrors ?? [])]);
  }
}
