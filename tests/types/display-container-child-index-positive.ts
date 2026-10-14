// SPDX-License-Identifier: Apache-2.0
// Compile-only genuine public class forwarding and the zero-mutation query API.
import { Bitmap, DisplayObject, DisplayObjectContainer, Sprite } from '@egret/engine';
import type { AssetLease, Engine, Stage, Texture } from '@egret/engine';
import type { DisplayObjectContainer as RuntimeContainer } from '@egret/runtime';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ForwardIdentity = Assert<Equal<DisplayObjectContainer, RuntimeContainer>>;
type Member = Assert<Equal<DisplayObjectContainer['getChildIndex'], (child: DisplayObject) => number>>;
type SpriteMember = Assert<Equal<Sprite['getChildIndex'], (child: DisplayObject) => number>>;
type StageMember = Assert<Equal<Stage['getChildIndex'], (child: DisplayObject) => number>>;
type LeafAbsent = Assert<Equal<'getChildIndex' extends keyof DisplayObject ? true : false, false>>;
declare const engine: Engine;
declare const lease: AssetLease<Texture>;
const scope = engine.createScope();
const container = scope.use(new DisplayObjectContainer());
const sprite = scope.use(new Sprite());
const bitmap = scope.use(new Bitmap(lease));
engine.stage.addChild(container); container.addChild(sprite); container.addChild(bitmap);
const index: number = container.getChildIndex(bitmap);
container.setChildIndex(sprite, index);
const stageIndex: number = engine.stage.getChildIndex(container);
const spriteIndex: number = sprite.getChildIndex(new DisplayObject());
const sameForwarded: RuntimeContainer = container;
void [stageIndex, spriteIndex, sameForwarded];
