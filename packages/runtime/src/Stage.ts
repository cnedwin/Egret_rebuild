import { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import { ASSERT_ATTACHABLE, bind } from "./ownership.js";
import type { EngineContext } from "./ownership.js";
import { EgretError } from "./EgretError.js";
import { markStageRoot } from "./displayTreeState.js";

export let createStage: (engine: EngineContext) => Stage;
const CREATION_TOKEN: unique symbol = Symbol("egret.stageFactory");

/** Created and bound by Engine; there is no implicit global stage. */
export class Stage extends DisplayObjectContainer {
  private constructor(engine: EngineContext, token: typeof CREATION_TOKEN) {
    super();
    if (token !== CREATION_TOKEN) throw new EgretError("STAGE_FACTORY_REQUIRED");
    markStageRoot(this);
    bind(this, engine);
  }

  static {
    createStage = (engine): Stage => new Stage(engine, CREATION_TOKEN);
  }

  // A Stage is an engine root and cannot become another display node's child.
  public override [ASSERT_ATTACHABLE](): void { throw new EgretError("STAGE_ROOT_ONLY"); }
}
