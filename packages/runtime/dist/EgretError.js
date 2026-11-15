import { describeErrorCode } from './errorHelp.js';
/** Stable machine-readable code, original cause, and associated cleanup failures. The message is for people and may change. */
export class EgretError extends Error {
    code;
    cleanupErrors;
    constructor(code, options = {}) {
        // The message is the code and, where this SDK has one, a sentence about it. Programs read `code`.
        const help = describeErrorCode(code);
        super(help === '' ? code : code + ': ' + help, { cause: options.cause });
        this.name = 'EgretError';
        this.code = code;
        // Copy and freeze the list without replacing the original failure cause.
        this.cleanupErrors = Object.freeze([...(options.cleanupErrors ?? [])]);
    }
}
//# sourceMappingURL=EgretError.js.map