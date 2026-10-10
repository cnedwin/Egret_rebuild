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

// Logical coordinate queries require no host globals.
import type {
  Point2D as CoordinateDomPoint,
  CoordinateQueryOptions as CoordinateDomOptions,
  DisplayObject as CoordinateDomNode,
  Stage as CoordinateDomStage,
} from '@egret/engine';

declare const coordinateDomNode: CoordinateDomNode;
declare const coordinateDomStage: CoordinateDomStage;
const coordinateDomOptions: CoordinateDomOptions = {maxNodes: 4};
const coordinateDomForward: CoordinateDomPoint = coordinateDomNode.localToGlobal(undefined, 2, coordinateDomOptions);
const coordinateDomInverse: CoordinateDomPoint = coordinateDomStage.globalToLocal(1, undefined);
const coordinateDomX: number = coordinateDomForward.x;
const coordinateDomY: number = coordinateDomInverse.y;
void coordinateDomX; void coordinateDomY;

// Receiver-local content-bounds types and calls require no host globals.
import type {
  BoundsQueryOptions as BoundsDomOptions,
  Rectangle2D as BoundsDomRectangle,
  DisplayObject as BoundsDomNode,
  DisplayObjectContainer as BoundsDomContainer,
  Sprite as BoundsDomSprite,
  Bitmap as BoundsDomBitmap,
  Stage as BoundsDomStage,
} from '@egret/engine';

declare const boundsDomNode: BoundsDomNode;
declare const boundsDomContainer: BoundsDomContainer;
declare const boundsDomSprite: BoundsDomSprite;
declare const boundsDomBitmap: BoundsDomBitmap;
declare const boundsDomStage: BoundsDomStage;
const boundsDomOptions: BoundsDomOptions = {maxNodes: 4, maxPrimitives: 8};
const boundsDomResults: readonly BoundsDomRectangle[] = [
  boundsDomNode.getBounds(),
  boundsDomContainer.getBounds(undefined),
  boundsDomSprite.getBounds({}),
  boundsDomBitmap.getBounds(boundsDomOptions),
  boundsDomStage.getBounds({maxPrimitives: 2}),
];
const boundsDomStructuralOptions = {maxNodes: 2, x: 0, y: 0, width: 1, height: 1};
const boundsDomRectangle: BoundsDomRectangle = boundsDomNode.getBounds(boundsDomStructuralOptions);
const boundsDomX: number = boundsDomRectangle.x;
const boundsDomY: number = boundsDomRectangle.y;
const boundsDomWidth: number = boundsDomRectangle.width;
const boundsDomHeight: number = boundsDomRectangle.height;
void boundsDomResults; void boundsDomX; void boundsDomY; void boundsDomWidth; void boundsDomHeight;
