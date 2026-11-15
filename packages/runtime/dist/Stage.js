import { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import { queryDisplayHit } from "./displayHitTest.js";
import { ASSERT_ATTACHABLE, bind } from "./ownership.js";
import { EgretError } from "./EgretError.js";
import { markStageRoot } from "./displayTreeState.js";
import { createPreparedDisplayOperations } from "./preparedDisplaySubtree.js";
export let createStage;
const CREATION_TOKEN = Symbol("egret.stageFactory");
/** Created and bound by Engine; there is no implicit global stage. */
export class Stage extends DisplayObjectContainer {
    constructor(engine, token) {
        super();
        if (token !== CREATION_TOKEN)
            throw new EgretError("STAGE_FACTORY_REQUIRED");
        markStageRoot(this);
        bind(this, engine);
        engine.registerPreparedDisplayOperations?.(createPreparedDisplayOperations(this));
    }
    static {
        createStage = (engine) => new Stage(engine, CREATION_TOKEN);
    }
    /** Pick one authored input area after complete structural/arithmetic admission. */
    hitTest(globalX, globalY, options) {
        return queryDisplayHit(this, globalX, globalY, options);
    }
    // A Stage is an engine root and cannot become another display node's child.
    [ASSERT_ATTACHABLE]() {
        throw new EgretError("STAGE_ROOT_ONLY");
    }
}
//# sourceMappingURL=Stage.js.map