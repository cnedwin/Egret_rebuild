import { DisplayObject, DisplayObjectContainer, Stage } from '@egret/engine';
import type { HitTestOptions, Rectangle2D } from '@egret/engine';
import type { HitTestOptions as RuntimeOptions } from '@egret/runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ExactOptions = Assert<Equal<HitTestOptions, { readonly maxNodes?: number }>>;
type SharedOptions = Assert<Equal<HitTestOptions, RuntimeOptions>>;
type HitArea = Assert<Equal<DisplayObject['hitArea'], Rectangle2D | undefined>>;
type Enabled = Assert<Equal<DisplayObject['touchEnabled'], boolean>>;
type Children = Assert<Equal<DisplayObjectContainer['touchChildren'], boolean>>;
type Query = Assert<Equal<Stage['hitTest'], (globalX: number, globalY: number, options?: HitTestOptions) => DisplayObject | undefined>>;
declare const stage: Stage;
const node = new DisplayObject(), container = new DisplayObjectContainer();
node.touchEnabled = true; node.hitArea = { x: -2, y: 0, width: 5, height: 8 };
node.hitArea = undefined; container.touchChildren = false;
const options: HitTestOptions = { maxNodes: 4096 };
const defaultBudget: HitTestOptions = {};
const explicit: DisplayObject | undefined = stage.hitTest(1, 2, options);
const omitted: DisplayObject | undefined = stage.hitTest(1, 2);
const absent: DisplayObject | undefined = stage.hitTest(1, 2, undefined);
if (explicit !== undefined) { explicit.touchEnabled = false; explicit.hitArea = undefined; }
void defaultBudget; void omitted; void absent;
export type { ExactOptions, SharedOptions, HitArea, Enabled, Children, Query };
