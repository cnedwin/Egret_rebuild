import { describeErrorCode } from './errorHelp.js';
export interface EgretErrorOptions {
  readonly cause?: unknown;
  readonly cleanupErrors?: readonly unknown[];
}

/** The cause in a few words: an SDK error's own message, which carries its cause in turn, or another error's name and message. */
function causeText(cause: unknown, code?: string): string {
  if (!(cause instanceof Error)) return '';
  // The same code wrapped again adds nothing: what lies under it is told instead.
  if (code !== undefined && cause instanceof EgretError && cause.code === code) return causeText(cause.cause, code);
  let text: string;
  try {
    const { name, message } = cause;
    if (typeof message !== 'string' || message === '') return '';
    text = cause instanceof EgretError || typeof name !== 'string' || name === '' ? message : name + ': ' + message;
  } catch {
    return '';
  }
  return ' Cause: ' + (text.length > 480 ? text.slice(0, 480) + '…' : text);
}

/** Stable machine-readable code, original cause, and associated cleanup failures. The message is for people and may change. */
export class EgretError extends Error {
  public readonly code: string;
  public readonly cleanupErrors: readonly unknown[];

  public constructor(code: string, options: EgretErrorOptions = {}) {
    // The message is the code and, where this SDK has one, a sentence about it. Programs read `code`.
    // What caused it follows, so a log line that shows only the message still names the first failure.
    const help = describeErrorCode(code);
    super((help === '' ? code : code + ': ' + help) + causeText(options.cause, code), { cause: options.cause });
    this.name = 'EgretError';
    this.code = code;
    // Copy and freeze the list without replacing the original failure cause.
    this.cleanupErrors = Object.freeze([...(options.cleanupErrors ?? [])]);
  }
}
