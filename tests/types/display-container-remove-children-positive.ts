// SPDX-License-Identifier: Apache-2.0
// Existing roots and one existing-class member, without DOM/Node globals.
import { Bitmap, DisplayObject, DisplayObjectContainer, Sprite } from '@egret/engine';
import type { AssetLease, Engine, Scope, Stage, Texture } from '@egret/engine';
import type { DisplayObjectContainer as RuntimeContainer } from '@egret/runtime';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ForwardIdentity = Assert<Equal<DisplayObjectContainer, RuntimeContainer>>;
type MemberShape = Assert<Equal<DisplayObjectContainer['removeChildren'], () => void>>;
type SpriteMember = Assert<Equal<Sprite['removeChildren'], () => void>>;
type StageMember = Assert<Equal<Stage['removeChildren'], () => void>>;
type LeafHasNoMember = Assert<Equal<'removeChildren' extends keyof DisplayObject ? true : false, false>>;
declare const engine: Engine;
declare const scope: Scope;
declare const lease: AssetLease<Texture>;
const root = scope.use(new DisplayObjectContainer());
const bitmap: Bitmap = scope.use(new Bitmap(lease));
const child: DisplayObject = root.addChild(bitmap);
const first: void = root.removeChildren();
const second: void = root.removeChildren();
root.addChild(child); root.removeChild(child);
const sprite = scope.use(new Sprite()); sprite.removeChildren();
engine.stage.addChild(root); engine.stage.removeChildren();
const count: number = root.numChildren;
const parent: DisplayObjectContainer | undefined = child.parent;
void first; void second; void count; void parent;
export type { ForwardIdentity, MemberShape, SpriteMember, StageMember, LeafHasNoMember };
