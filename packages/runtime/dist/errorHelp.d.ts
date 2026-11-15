/** The languages an error's sentence can be in. */
export type ErrorLanguage = 'en' | 'zh';
/**
 * The language of the sentence in the message of every error made from now on: English unless set. The code of an
 * error is the same in every language.
 */
export declare function setErrorLanguage(value: ErrorLanguage): void;
export declare function getErrorLanguage(): ErrorLanguage;
/**
 * A sentence for an error code: what went wrong and, for the codes a game meets most, what to do. It is in the
 * language given, or the one set by `setErrorLanguage`. A code this SDK does not know gives an empty string.
 */
export declare function describeErrorCode(code: string, inLanguage?: ErrorLanguage): string;
//# sourceMappingURL=errorHelp.d.ts.map