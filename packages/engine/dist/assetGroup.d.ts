import { Scope } from '@egret/runtime';
import type { AssetGroupOperations } from '@egret/runtime';
import type { Diagnostic } from '@egret/contracts';
import type { AssetGroup } from './assetGroupTypes.js';
export interface AssetGroupContext {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
}
export interface AssetGroupOwner {
    create<T>(scope: unknown, refs: unknown, options: unknown): AssetGroup<T>;
    close(): void;
}
/** Admission is inert; clear busy before activation can invoke any provider. */
export declare function createAssetGroupOwner(context: AssetGroupContext, operations: AssetGroupOperations): AssetGroupOwner;
//# sourceMappingURL=assetGroup.d.ts.map