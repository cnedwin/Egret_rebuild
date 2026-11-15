import { Scope } from '@egret/runtime';
import type { AssetGroupOperations, AssetRef, Bitmap, EngineContext, Texture } from '@egret/runtime';
import type { Diagnostic } from '@egret/contracts';
export type BitmapResourceSlotState = 'idle' | 'pending' | 'ready' | 'failed' | 'conflicted' | 'disposed';
/** Owns only replacement leases; the exact initial Bitmap binding remains borrowed. */
export interface BitmapResourceSlot {
    readonly state: BitmapResourceSlotState;
    replace(ref: AssetRef<Texture>): Promise<void>;
    cancel(reason?: unknown): void;
    dispose(): void;
}
type Operations = Parameters<NonNullable<EngineContext['registerBitmapResourceTarget']>>[1];
export interface BitmapResourceSlotContext {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
    report(diagnostic: Diagnostic): void;
    captureCleanup(cause: unknown): void;
}
export interface BitmapResourceSlotOwner {
    create(scope: unknown, bitmap: unknown): BitmapResourceSlot;
    close(): void;
}
export declare function createBitmapResourceSlotOwner(context: BitmapResourceSlotContext, acquisitions: AssetGroupOperations, targets: WeakMap<Bitmap, Operations>): BitmapResourceSlotOwner;
export {};
//# sourceMappingURL=bitmapResourceSlot.d.ts.map