/** Attach rejection observation before handing the promise to either host. */
export declare function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (cause: unknown) => void;
};
//# sourceMappingURL=sharedHostDeferred.d.ts.map