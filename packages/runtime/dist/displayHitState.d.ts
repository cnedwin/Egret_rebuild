import type { Rectangle2D } from '@egret/contracts';
import type { DisplayObject } from './DisplayObject.js';
interface DisplayHitState {
    touchEnabled: boolean;
    hitArea: Rectangle2D | undefined;
    touchChildren: boolean | undefined;
}
export declare function registerDisplayHitNode(node: DisplayObject): void;
export declare function registerDisplayHitContainer(node: DisplayObject): void;
/** Genuine identity is checked before any receiver property can be consulted. */
export declare function readDisplayHitState(receiver: unknown): DisplayHitState;
export declare function writeDisplayTouchEnabled(receiver: unknown, value: unknown): void;
export declare function readDisplayTouchChildren(receiver: unknown): boolean;
export declare function writeDisplayTouchChildren(receiver: unknown, value: unknown): void;
/** Read caller fields once in fixed order; source faults never become semantics. */
export declare function writeDisplayHitArea(receiver: unknown, source: unknown): void;
export {};
//# sourceMappingURL=displayHitState.d.ts.map