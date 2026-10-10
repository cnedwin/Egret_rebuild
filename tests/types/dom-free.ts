import { createEngine, Sprite } from '@egret/engine';
import type { RenderHostAdapter, RenderFrame2D } from '@egret/engine';
declare const host: RenderHostAdapter;
const core = createEngine({host});
const sprite = new Sprite();
declare const frame: RenderFrame2D;
void core; void sprite; void frame;

import {createImageData2D,copyImageData2DPixels,isImageData2D,IMAGE_LIMITS_2D} from '@egret/engine';
import type {ImageData2D,ImageCommand2D,RenderCommand2D,TextureRegion2D} from '@egret/engine';
const image:ImageData2D=createImageData2D({width:1,height:1,pixels:new Uint8Array(new ArrayBuffer(4))});
const pixels:Uint8Array<ArrayBuffer>=copyImageData2DPixels(image);
declare const command:ImageCommand2D;
const mixed:RenderCommand2D=command;const region:TextureRegion2D=command.sourceRect;
void pixels;void mixed;void region;void isImageData2D;void IMAGE_LIMITS_2D;

import {collectFrameContent} from '../../packages/runtime/dist/index.js';
import type {CapturedContent2D,Stage} from '../../packages/runtime/dist/index.js';
declare const stage:Stage;
const captured:CapturedContent2D=collectFrameContent(stage);
const images:readonly ImageData2D[]|undefined=captured.images;
void captured;void images;
