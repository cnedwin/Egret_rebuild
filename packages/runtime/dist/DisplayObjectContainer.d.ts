import { DisplayObject } from "./DisplayObject.js";
import { OWNERSHIP_CHILDREN } from "./ownership.js";
/** Ordered display children with atomic reparenting and ownership-aware cleanup. */
export declare class DisplayObjectContainer extends DisplayObject {
    constructor();
    /** Suppressed descendants never implicitly retarget to this container. */
    get touchChildren(): boolean;
    set touchChildren(value: boolean);
    get numChildren(): number;
    [OWNERSHIP_CHILDREN](): readonly object[];
    /** Subclass hooks run in preflight; final binding and reparenting use internal state. */
    addChild<T extends DisplayObject>(child: T): T;
    /** Insert at an inclusive index; subclass callbacks finish before one private plan. */
    addChildAt<T extends DisplayObject>(child: T, index: number): T;
    /** Detach without disposing or transferring the cleanup owner. */
    removeChild<T extends DisplayObject>(child: T): T;
    /** Detach every direct child without disposing nodes or transferring owners. */
    removeChildren(): void;
    /** The first child with this name, or undefined. Children's own children are not looked at. */
    getChildByName(name: string): DisplayObject | undefined;
    getChildAt(index: number): DisplayObject;
    /** Return a genuine direct child's current zero-based index without mutation. */
    getChildIndex(child: DisplayObject): number;
    setChildIndex(child: DisplayObject, index: number): void;
    private validateIndex;
    dispose(): void;
}
//# sourceMappingURL=DisplayObjectContainer.d.ts.map