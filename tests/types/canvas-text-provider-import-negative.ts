// Isolated absent imports cannot affect the valid ordinary consumer's types.
// CANVAS_TEXT_IMPORT_CASE root-factory TS2305
import { createCanvasTextRasterProvider as rootFactory } from '@egret/engine';
// CANVAS_TEXT_IMPORT_CASE web-factory TS2305
import { createCanvasTextRasterProvider as webFactory } from '@egret/engine/web';
// CANVAS_TEXT_IMPORT_CASE gpu-factory TS2305
import { createCanvasTextRasterProvider as gpuFactory } from '@egret/engine/webgpu';
// CANVAS_TEXT_IMPORT_CASE text-factory TS2305
import { createCanvasTextRasterProvider as textFactory } from '@egret/engine/text';
// CANVAS_TEXT_IMPORT_CASE runtime-text-factory TS2305
import { createCanvasTextRasterProvider as runtimeFactory } from '@egret/runtime/text';
// CANVAS_TEXT_IMPORT_CASE no-constructor TS2724
import { CanvasTextRasterProvider } from '@egret/engine/web/text';
// CANVAS_TEXT_IMPORT_CASE no-options-type TS2305
import type { CanvasTextRasterProviderOptions } from '@egret/engine/web/text';
// CANVAS_TEXT_IMPORT_CASE no-type-reexport TS2305
import type { TextRasterProvider } from '@egret/engine/web/text';
void [rootFactory,webFactory,gpuFactory,textFactory,runtimeFactory,CanvasTextRasterProvider];
