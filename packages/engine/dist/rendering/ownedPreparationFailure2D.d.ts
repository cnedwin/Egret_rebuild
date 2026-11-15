/** Note only a fresh deliberate first-party failure at its creation site. */
export declare function noteOwnedPreparationFailure<T extends object>(error: T): T;
/** Report the exact escaping object created under this invocation; preserve all throws. */
export declare function runOwnedPreparationScope<T>(operation: () => T, privateObserver: (error: object) => void): T;
//# sourceMappingURL=ownedPreparationFailure2D.d.ts.map