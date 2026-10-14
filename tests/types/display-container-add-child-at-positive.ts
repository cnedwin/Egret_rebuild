// SPDX-License-Identifier: Apache-2.0
// Compile-only public generic identity and inherited receivers.
import { DisplayObject, DisplayObjectContainer, Sprite } from '@egret/engine';
import type { Engine, Stage } from '@egret/engine';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type Signature = <T extends DisplayObject>(child: T, index: number) => T;
type ContainerMember = Assert<Equal<DisplayObjectContainer['addChildAt'], Signature>>;
type SpriteMember = Assert<Equal<Sprite['addChildAt'], Signature>>;
type StageMember = Assert<Equal<Stage['addChildAt'], Signature>>;
type LeafAbsent = Assert<Equal<'addChildAt' extends keyof DisplayObject ? true : false, false>>;

class Panel extends Sprite { public readonly panelTag = 'panel'; }
declare const engine: Engine;
const scope = engine.createScope();
const container = scope.use(new DisplayObjectContainer());
const leaf = scope.use(new DisplayObject());
const sprite = scope.use(new Sprite());
const panel = scope.use(new Panel());
const stageContainer: DisplayObjectContainer = engine.stage.addChildAt(container, 0);
const leafResult: DisplayObject = container.addChildAt(leaf, 0);
const spriteResult: Sprite = container.addChildAt(sprite, 1);
const panelResult: Panel = container.addChildAt(panel, container.numChildren);
const inheritedResult: Panel = sprite.addChildAt(panel, -0);
const stageResult: Panel = engine.stage.addChildAt(panel, engine.stage.numChildren);
type InferredPanel = Assert<Equal<typeof inheritedResult, Panel>>;
void [stageContainer, leafResult, spriteResult, panelResult, inheritedResult, stageResult];
