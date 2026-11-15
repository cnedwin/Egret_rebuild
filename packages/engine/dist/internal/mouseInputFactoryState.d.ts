import { Bitmap, DisplayObject } from '@egret/runtime';
import type { AssetLease, Texture } from '@egret/runtime';
import type { Rectangle2D, TextureRegion2D } from '@egret/contracts';
import type { MouseInputEnginePort } from '../mouseInput.js';
import type { MouseInputPayload } from '../mouseInputTypes.js';
/** Assembly installs authority before publishing the genuine Engine. */
export declare function registerMouseInputEngine(engine: object, port: MouseInputEnginePort): void;
export declare function requireMouseInputEngine(engine: unknown): MouseInputEnginePort;
/** Successful Host startup is separate from ordinary open-state observation. */
export declare function markMouseInputEngineStarted(engine: object): void;
/** Eager Engine assembly records genuine Scope origin without retaining its Engine. */
export declare function registerMouseInputScope(scope: object, engine: object): void;
/** Button admission distinguishes foreign genuine Scope from an unregistered value. */
export declare function assertBitmapButtonScopeOrigin(scope: unknown, engine: object): void;
/** Native delivery alone owns these associations and their opaque gesture tokens. */
export interface BitmapButtonAssociation {
    readonly target: Bitmap;
    syncTerminal(): void;
    beforeBegin(token: object): void;
    beforeEnd(token: object): void;
    cancel(): void;
    afterActivate(token: object, payload: MouseInputPayload, eligible: () => boolean): void;
    finish(token: object): void;
    retire(): readonly unknown[];
}
export interface BitmapButtonInputPort {
    assertOpen(): void;
    add(association: BitmapButtonAssociation): void;
    remove(association: BitmapButtonAssociation): void;
}
/** Keep only an opaque origin token after input retirement, not its Engine. */
export declare function registerMouseInputInstance(input: object, engine: object, port: BitmapButtonInputPort): void;
export declare function requireBitmapButtonInput(input: unknown, engine: object): BitmapButtonInputPort;
/** Public accessors read original private slots despite later instance/prototype shadows. */
export declare const bitmapButtonOperations: Readonly<{
    lease(bitmap: Bitmap): AssetLease<Texture> | undefined;
    crop(bitmap: Bitmap): TextureRegion2D | undefined;
    hit(bitmap: Bitmap): Rectangle2D | undefined;
    touch(bitmap: Bitmap): boolean;
    disposed(bitmap: Bitmap): boolean;
    setLease(bitmap: Bitmap, lease: AssetLease<Texture> | undefined): void;
    setCrop(bitmap: Bitmap, crop: TextureRegion2D): void;
    setHit(bitmap: Bitmap, hit: Rectangle2D): void;
    setTouch(bitmap: Bitmap, enabled: boolean): void;
    dispose(bitmap: Bitmap): void;
    disposeDisplay(bitmap: Bitmap): void;
    invoke(callback: (payload: MouseInputPayload) => void, payload: MouseInputPayload): unknown;
}>;
declare const inputRuntimePrimitives: Readonly<{
    parent(target: DisplayObject): DisplayObject | undefined;
    visible(target: DisplayObject): boolean;
    disposed(target: DisplayObject): boolean;
}>;
/** Optional keyboard admission reuses getters captured before Engine publication. */
export declare function captureMouseInputRuntimePrimitives(): typeof inputRuntimePrimitives;
export {};
//# sourceMappingURL=mouseInputFactoryState.d.ts.map