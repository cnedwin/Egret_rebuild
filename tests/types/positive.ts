import { CancellationController, DisplayObject, DisplayObjectContainer, Event, EventDispatcher, createEngine, createEventType } from "@egret/engine";
import type { CancellationSignal, HostAdapter, ScopeValue } from "@egret/engine";
import { createAssetType, createAssetRef } from "@egret/engine";
import type { AssetLease, AssetManager, AssetRef, AssetType } from "@egret/engine";

const signal: CancellationSignal = new CancellationController().signal;
const pressed = createEventType<{ readonly x: number }>("pressed", { bubbles: true });
const dispatcher = new EventDispatcher();
dispatcher.on(pressed, (event) => { const x: number = event.payload.x; void x; }, { signal, capture: true, priority: 3 });
const result: boolean = dispatcher.dispatchEvent(new Event(pressed, { x: 1 }));
const container = new DisplayObjectContainer();
const child: DisplayObject = container.addChild(new DisplayObject());
const parent: DisplayObjectContainer | undefined = child.parent;
const lease = { release(): void {} } satisfies ScopeValue;
declare const host: HostAdapter;
async function setup(): Promise<void> {
  const engine = await createEngine({ host, shutdownTimeoutMs: 100 });
  const scope = engine.createScope();
  const strings: AssetType<string> = createAssetType("string", (value): value is string => typeof value === "string");
  const ref: AssetRef<string> = createAssetRef(strings, "greeting");
  const assets: AssetManager = engine.assets;
  assets.register(strings, { load: async (request, context) => { const id: string = request.id; const generation: number = context.resourceGeneration; const task: number = context.taskId; const cancellation: CancellationSignal = context.signal; void generation; void task; void cancellation; return id; }, dispose: value => { const text: string = value; void text; } });
  const cpu: AssetLease<string> = await assets.acquire(ref, { signal });
  const text: string = scope.use(cpu).value;
  void text;
  const retained = scope.use(lease);
  retained.release();
  engine.stage.addChild(scope.use(new DisplayObject()));
  scope.dispose();
  await engine.dispose();
}
void result;
void parent;
void setup;

import { createImageData2D, isImageData2D, copyImageData2DPixels, IMAGE_LIMITS_2D } from '@egret/engine';
import type { ImageData2DInput, ImageData2D, TextureRegion2D, ImageCommand2D, RenderCommand2D, RenderFrame2D } from '@egret/engine';
const imageInput: ImageData2DInput = {width:1,height:1,pixels:new Uint8Array(new ArrayBuffer(4)),format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight',origin:'top-left'};
const image: ImageData2D = createImageData2D(imageInput);
const imagePixels: Uint8Array<ArrayBuffer> = copyImageData2DPixels(image);
const sourceEdge: 4096 = IMAGE_LIMITS_2D.maxSourceEdge;
const sourceRect: TextureRegion2D = {x:0,y:0,width:1,height:1};
const imageCommand: ImageCommand2D = {kind:'image',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:sourceRect,alpha:1,clips:[],imageIndex:0,sourceRect};
const imageFrame: RenderFrame2D = {frameId:1,width:1,height:1,clearColor:0,clearAlpha:0,commands:[imageCommand],images:[image]};
function narrowCommand(command: RenderCommand2D): number {
  switch(command.kind){case 'rect':return command.color;case 'image':return command.imageIndex;default:{const exhaustive:never=command;return exhaustive;}}
}
const unknownImage:unknown=image;
if(isImageData2D(unknownImage)){const guarded:ImageData2D=unknownImage;void guarded;}
void imagePixels;void sourceEdge;void imageFrame;void narrowCommand;

import {Texture,createTexture,isTexture,Bitmap} from '@egret/engine';
const textureValue:Texture=createTexture(image,sourceRect);
declare const textureBorrow:AssetLease<Texture>;
const bitmap=new Bitmap(textureBorrow);
const maybeLease:AssetLease<Texture>|undefined=bitmap.textureLease;
bitmap.textureLease=undefined;
const naturalWidth:number=bitmap.naturalWidth;
if(isTexture(textureValue)){const immutableImage:ImageData2D=textureValue.imageData;void immutableImage;}
textureValue.dispose();bitmap.dispose();void maybeLease;void naturalWidth;

import {collectFrameContent,collectFrameCommands} from '../../packages/runtime/dist/index.js';
import type {CapturedContent2D,Stage} from '../../packages/runtime/dist/index.js';
import type {RectangleCommand2D} from '@egret/engine';
declare const stage:Stage;
const content:CapturedContent2D=collectFrameContent(stage);
const legacyCommands:readonly RectangleCommand2D[]=collectFrameCommands(stage);
const captureCommands:readonly RenderCommand2D[]=content.commands;
const captureImages:readonly ImageData2D[]|undefined=content.images;
void legacyCommands;void captureCommands;void captureImages;

// Append this type-only fixture to R/tests/types/positive.ts after test-only adoption.
import type {Bitmap as RegionBitmap, TextureRegion2D as RegionRect} from '@egret/engine';
declare const bitmapRegionPositive: RegionBitmap;
const bitmapRegionValue: RegionRect = {x:2,y:0,width:1,height:2};
bitmapRegionPositive.sourceRect=bitmapRegionValue;
bitmapRegionPositive.sourceRect=undefined;
const bitmapRegionMaybe: RegionRect | undefined=bitmapRegionPositive.sourceRect;
void bitmapRegionMaybe;
