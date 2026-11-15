import { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import type { DisplayObject } from "./DisplayObject.js";
import type { HitTestOptions } from "./displayHitTest.js";
import { ASSERT_ATTACHABLE } from "./ownership.js";
import type { EngineContext } from "./ownership.js";
export declare let createStage: (engine: EngineContext) => Stage;
/** Created and bound by Engine; there is no implicit global stage. */
export declare class Stage extends DisplayObjectContainer {
    private constructor();
    /** Pick one authored input area after complete structural/arithmetic admission. */
    hitTest(globalX: number, globalY: number, options?: HitTestOptions): DisplayObject | undefined;
    [ASSERT_ATTACHABLE](): void;
}
//# sourceMappingURL=Stage.d.ts.map