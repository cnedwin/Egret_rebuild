import { describeErrorCode } from './errorHelp.js';
export interface EgretErrorOptions {
  readonly cause?: unknown;
  readonly cleanupErrors?: readonly unknown[];
}

/** Stable machine-readable code, original cause, and associated cleanup failures. The message is for people and may change. */
export class EgretError extends Error {
  public readonly code: string;
  public readonly cleanupErrors: readonly unknown[];

  public constructor(code: string, options: EgretErrorOptions = {}) {
    // The message is the code and, where this SDK has one, a sentence about it. Programs read `code`.
    const help = describeErrorCode(code);
    super(help === '' ? code : code + ': ' + help, { cause: options.cause });
    this.name = "EgretError";
    this.code = code;
    // Copy and freeze the list without replacing the original failure cause.
    this.cleanupErrors = Object.freeze([...(options.cleanupErrors ?? [])]);
  }
}
