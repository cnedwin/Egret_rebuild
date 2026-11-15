import type { DisplayObject } from "./DisplayObject.js";
import type { Event } from "./Event.js";
import type { Stage } from "./Stage.js";
/** Engine assembly port; absent from the public Engine and browser entries. */
export interface DisplayInputOperations {
    pick(x: number, y: number, maxNodes: number): DisplayObject | undefined;
    isAttached(target: DisplayObject, maxNodes: number): boolean;
    dispatch<T>(target: DisplayObject, event: Event<T>, maxNodes: number): boolean;
}
/** Bind only a genuine Stage and its existing private Engine affinity. */
export declare function createDisplayInputOperations(stage: Stage): DisplayInputOperations;
//# sourceMappingURL=displayInputOperations.d.ts.map