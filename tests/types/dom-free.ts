import { createEngine, Sprite } from '@egret/engine';
import type { RenderHostAdapter, RenderFrame2D } from '@egret/engine';
declare const host: RenderHostAdapter;
const core = createEngine({host});
const sprite = new Sprite();
declare const frame: RenderFrame2D;
void core; void sprite; void frame;
