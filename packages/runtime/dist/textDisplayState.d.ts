import type { Rectangle2D, TextureRegion2D } from '@egret/contracts';
import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import { Scope } from './Scope.js';
export interface TextFieldCommittedDisplay {
    readonly contentBounds: Rectangle2D;
    readonly raster: Rectangle2D | undefined;
    readonly lease: AssetLease<Texture> | undefined;
    readonly sourceRect: TextureRegion2D | undefined;
}
export interface TextFieldDisplayState {
    readonly scope: Scope;
    readonly committed: TextFieldCommittedDisplay | undefined;
}
/** Metadata only: default collectors never import the text cache or leaf class. */
export declare function hasTextFieldState(value: object): boolean;
export declare function readTextFieldState(value: object): TextFieldDisplayState | undefined;
export declare function writeTextFieldState(value: object, state: TextFieldDisplayState): void;
/** A same-name own getter or writable shadow cannot reopen a closing Scope. */
export declare function assertTextFieldScope(scope: Scope): void;
//# sourceMappingURL=textDisplayState.d.ts.map