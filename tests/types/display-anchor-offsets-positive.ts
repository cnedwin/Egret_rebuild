// SPDX-License-Identifier: Apache-2.0
// Compile-only public number scalars, writable inherited members and subclasses.
import { DisplayObject, DisplayObjectContainer, Sprite } from '@egret/engine';
import type { Bitmap, Stage, Engine } from '@egret/engine';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)
  ? (<T>()=>T extends B?1:2) extends (<T>()=>T extends A?1:2)?true:false:false;
type Assert<T extends true>=T;
type BaseX=Assert<Equal<DisplayObject['anchorOffsetX'],number>>;
type BaseY=Assert<Equal<DisplayObject['anchorOffsetY'],number>>;
type ContainerX=Assert<Equal<DisplayObjectContainer['anchorOffsetX'],number>>;
type SpriteY=Assert<Equal<Sprite['anchorOffsetY'],number>>;
type BitmapX=Assert<Equal<Bitmap['anchorOffsetX'],number>>;
type StageY=Assert<Equal<Stage['anchorOffsetY'],number>>;

class Panel extends Sprite {public readonly panelTag='panel';}
declare const engine:Engine;
declare const bitmap:Bitmap;
const leaf=new DisplayObject(),container=new DisplayObjectContainer(),sprite=new Sprite(),panel=new Panel();
for(const node of [leaf,container,sprite,panel,bitmap,engine.stage]) {
  node.anchorOffsetX=-0;node.anchorOffsetY=-4.5;
  const x:number=node.anchorOffsetX,y:number=node.anchorOffsetY;
  void [x,y];
}
panel.anchorOffsetX=Number.MAX_VALUE;
const inherited:number=panel.anchorOffsetY;
void inherited;
