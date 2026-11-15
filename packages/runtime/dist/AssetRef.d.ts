declare const ASSET_VALUE: unique symbol;
/** Factory identity prevents equal names from aliasing; the phantom is invariant. */
export interface AssetType<T> {
    readonly name: string;
    readonly is: (value: unknown) => value is T;
    readonly [ASSET_VALUE]?: (value: T) => T;
}
/** A stable manager-local identity paired with its invariant value descriptor. */
export interface AssetRef<T> {
    readonly type: AssetType<T>;
    readonly id: string;
}
export declare function createAssetType<T>(name: string, is: (value: unknown) => value is T): AssetType<T>;
/** Keep the caller's valid ID byte-for-byte; whitespace is not normalization. */
export declare function createAssetRef<T>(type: AssetType<T>, id: string): AssetRef<T>;
export declare function assertAssetType(type: unknown): asserts type is AssetType<never>;
/** Authentication checks happen before reading any structural lookalike getter. */
export declare function assertAssetRef(ref: unknown): asserts ref is AssetRef<never>;
export {};
//# sourceMappingURL=AssetRef.d.ts.map