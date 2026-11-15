import type { Rectangle2D } from '@egret/contracts';
import { DisplayObjectContainer } from '../DisplayObjectContainer.js';
import type { DisplayObject } from '../DisplayObject.js';
import type { Stage } from '../Stage.js';
import { Scope } from '../Scope.js';
/** Internal cross-package assembly, never exposed by the Engine facade. */
export interface UiDisplayUpdate {
    readonly wrapper: DisplayObjectContainer;
    readonly children?: readonly DisplayObject[];
    readonly x?: number;
    readonly y?: number;
    readonly visible?: boolean;
    readonly clipRect?: Rectangle2D | undefined;
    readonly hitArea?: Rectangle2D | undefined;
    readonly touchEnabled?: boolean;
    readonly touchChildren?: boolean;
}
export interface UiDisplayOperations {
    createWrapper(scope: Scope): DisplayObjectContainer;
    validateContent(content: DisplayObject, scope: Scope): void;
    prepare(root: DisplayObjectContainer, updates: readonly UiDisplayUpdate[]): object;
    commit(token: object): void;
    detach(root: DisplayObjectContainer): void;
    disposeWrapper(wrapper: DisplayObjectContainer): void;
    assertStage(): void;
    /** Authenticated root-only presentation; does not traverse/rebuild its content. */
    presentRoot(root: DisplayObjectContainer, value: Readonly<{
        x: number;
        y: number;
        visible: boolean;
        interactive: boolean;
        index?: number;
    }>): void;
    /** Lifetime revocation, like detach: remains legal while the owning Scope/Engine closes. */
    releaseRoot(root: DisplayObjectContainer, value: Readonly<{
        x: number;
        y: number;
        visible: boolean;
    }>): void;
}
/** Create a single root publication authority over the original genuine Stage. */
export declare function createUiDisplayOperations(stage: Stage): UiDisplayOperations;
//# sourceMappingURL=displayCommit.d.ts.map