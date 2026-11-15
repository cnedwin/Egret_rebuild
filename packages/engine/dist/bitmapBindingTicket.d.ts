import { Scope } from '@egret/runtime';
import type { AssetLease, Bitmap, CapturedSharedContent2D, EngineContext, Stage, Texture } from '@egret/runtime';
/** Publishes borrowed group members once; owns no initial or candidate lease. */
export interface BitmapBindingTicket {
    prepare(members: readonly AssetLease<Texture>[]): void;
    commit(): void;
    dispose(): void;
}
type Operations = Parameters<NonNullable<EngineContext['registerBitmapResourceTarget']>>[1];
export interface BitmapBindingContext {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
}
export interface BitmapBindingOwner {
    capture(scope: unknown, targets: unknown): BitmapBindingTicket;
    readPreparedForCapture(ticket: unknown): Readonly<{
        validate(): void;
        captureContent(stage: Stage): CapturedSharedContent2D;
    }>;
    close(): void;
}
export declare function createBitmapBindingOwner(context: BitmapBindingContext, targets: WeakMap<Bitmap, Operations>): BitmapBindingOwner;
export {};
//# sourceMappingURL=bitmapBindingTicket.d.ts.map