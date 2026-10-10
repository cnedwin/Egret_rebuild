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

import {createSequenceClip,SequencePlayer} from '@egret/engine';
import type {SequenceClipInput,SequenceFrameInput,SequenceClip,SequenceSample,SequenceRegion,SequencePlaybackMode} from '@egret/engine';
const sequenceFrame:SequenceFrameInput={x:0,y:0,width:1,height:1,durationSeconds:0.125};
const sequenceInput:SequenceClipInput={atlasWidth:1,atlasHeight:1,frames:[sequenceFrame]};
const sequenceClip:SequenceClip=createSequenceClip(sequenceInput);
const unknownSequence:unknown=sequenceInput;
const validatedSequence:SequenceClip=createSequenceClip(unknownSequence);
const playbackMode:SequencePlaybackMode='loop';
const player:SequencePlayer=new SequencePlayer(bitmap,sequenceClip,playbackMode);
const defaultPlayer:SequencePlayer=new SequencePlayer(bitmap,validatedSequence);
const selected:SequenceSample=player.applyAt(0.125);
const selectedRegion:SequenceRegion=selected.region;
const cached:SequenceSample|undefined=player.lastSample;
const disposedPlayer:boolean=player.isDisposed;
const scopedPlayer:ScopeValue=player;
player.dispose();void defaultPlayer;void selectedRegion;void cached;void disposedPlayer;void scopedPlayer;

// Append this type-only fixture to R/tests/types/positive.ts after test-only adoption.
import type {Bitmap as RegionBitmap, TextureRegion2D as RegionRect} from '@egret/engine';
declare const bitmapRegionPositive: RegionBitmap;
const bitmapRegionValue: RegionRect = {x:2,y:0,width:1,height:2};
bitmapRegionPositive.sourceRect=bitmapRegionValue;
bitmapRegionPositive.sourceRect=undefined;
const bitmapRegionMaybe: RegionRect | undefined=bitmapRegionPositive.sourceRect;
void bitmapRegionMaybe;

// Public coordinate consumers keep the inherited signatures and shapes exact.
import type {
  Point2D as CoordinatePoint,
  CoordinateQueryOptions as CoordinateOptions,
  DisplayObject as CoordinateNode,
  DisplayObjectContainer as CoordinateContainer,
  Sprite as CoordinateSprite,
  Bitmap as CoordinateBitmap,
  Stage as CoordinateStage,
} from '@egret/engine';

// Generic-function equality distinguishes readonly from writable properties;
// ordinary structural assignment alone does not establish readonly modifiers.
type CoordinateEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false)
    : false;
type CoordinateAssert<T extends true> = T;
type CoordinatePointShape = CoordinateAssert<CoordinateEqual<CoordinatePoint, {readonly x: number; readonly y: number}>>;
type CoordinateOptionsShape = CoordinateAssert<CoordinateEqual<CoordinateOptions, {readonly maxNodes?: number}>>;
// Optional function arguments accept explicit undefined; Parameters retains
// that union even when authored optional object/tuple fields require omission.
type CoordinateParameters = [x?: number | undefined, y?: number | undefined, options?: CoordinateOptions | undefined];
type CoordinateForwardParameters = CoordinateAssert<CoordinateEqual<Parameters<CoordinateNode['localToGlobal']>, CoordinateParameters>>;
type CoordinateInverseParameters = CoordinateAssert<CoordinateEqual<Parameters<CoordinateNode['globalToLocal']>, CoordinateParameters>>;
type CoordinateForwardResult = CoordinateAssert<CoordinateEqual<ReturnType<CoordinateNode['localToGlobal']>, CoordinatePoint>>;
type CoordinateInverseResult = CoordinateAssert<CoordinateEqual<ReturnType<CoordinateNode['globalToLocal']>, CoordinatePoint>>;
type CoordinateCallable = (x?: number, y?: number, options?: CoordinateOptions) => CoordinatePoint;
type CoordinateForwardCallable = CoordinateAssert<CoordinateEqual<CoordinateNode['localToGlobal'], CoordinateCallable>>;
type CoordinateInverseCallable = CoordinateAssert<CoordinateEqual<CoordinateNode['globalToLocal'], CoordinateCallable>>;

declare const coordinateNode: CoordinateNode;
declare const coordinateContainer: CoordinateContainer;
declare const coordinateSprite: CoordinateSprite;
declare const coordinateBitmap: CoordinateBitmap;
declare const coordinateStage: CoordinateStage;
const coordinateOptions: CoordinateOptions = {maxNodes: 8};
const coordinateEmptyOptions: CoordinateOptions = {};
const coordinateLiteralPoint: CoordinatePoint = {x: 1, y: 2};
const coordinateResults: readonly CoordinatePoint[] = [
  coordinateNode.localToGlobal(),
  coordinateNode.localToGlobal(1),
  coordinateNode.localToGlobal(undefined, 2),
  coordinateNode.localToGlobal(undefined, undefined, coordinateOptions),
  coordinateNode.localToGlobal(1, 2, undefined),
  coordinateNode.globalToLocal(),
  coordinateNode.globalToLocal(1),
  coordinateNode.globalToLocal(undefined, 2),
  coordinateNode.globalToLocal(undefined, undefined, coordinateEmptyOptions),
  coordinateNode.globalToLocal(1, 2, undefined),
];
for (const inheritedNode of [coordinateContainer, coordinateSprite, coordinateBitmap, coordinateStage]) {
  const inheritedForward: CoordinatePoint = inheritedNode.localToGlobal(1, 2, coordinateOptions);
  const inheritedInverse: CoordinatePoint = inheritedNode.globalToLocal(1, 2, coordinateOptions);
  void inheritedForward; void inheritedInverse;
}
// Structural variables with a valid known field permit additional properties.
const coordinateStructuralOptions = {maxNodes: 8, x: 10, y: 20};
const coordinateStructuralForward: CoordinatePoint = coordinateNode.localToGlobal(1, 2, coordinateStructuralOptions);
const coordinateStructuralInverse: CoordinatePoint = coordinateNode.globalToLocal(1, 2, coordinateStructuralOptions);
void coordinateLiteralPoint; void coordinateResults;
void coordinateStructuralForward; void coordinateStructuralInverse;

// Public content-bounds consumers keep the inherited signature and readonly shapes exact.
import type {
  BoundsQueryOptions as BoundsPositiveOptions,
  Rectangle2D as BoundsPositiveRectangle,
  DisplayObject as BoundsPositiveNode,
  DisplayObjectContainer as BoundsPositiveContainer,
  Sprite as BoundsPositiveSprite,
  Bitmap as BoundsPositiveBitmap,
  Stage as BoundsPositiveStage,
} from '@egret/engine';

// Generic-function equality checks readonly modifiers as well as field types.
type BoundsPositiveEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false)
    : false;
type BoundsPositiveAssert<T extends true> = T;
type BoundsPositiveRectangleShape = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveRectangle,
  {readonly x: number; readonly y: number; readonly width: number; readonly height: number}
>>;
type BoundsPositiveOptionsShape = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveOptions,
  {readonly maxNodes?: number; readonly maxPrimitives?: number}
>>;
type BoundsPositiveCallable = (options?: BoundsPositiveOptions) => BoundsPositiveRectangle;
type BoundsPositiveWholeCallable = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveNode['getBounds'], BoundsPositiveCallable
>>;
// Optional function arguments accept explicit undefined even though an
// explicitly undefined optional object field is rejected by exact typing.
type BoundsPositiveParameters = BoundsPositiveAssert<BoundsPositiveEqual<
  Parameters<BoundsPositiveNode['getBounds']>, [options?: BoundsPositiveOptions | undefined]
>>;
type BoundsPositiveReturn = BoundsPositiveAssert<BoundsPositiveEqual<
  ReturnType<BoundsPositiveNode['getBounds']>, BoundsPositiveRectangle
>>;
type BoundsPositiveContainerCallable = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveContainer['getBounds'], BoundsPositiveCallable
>>;
type BoundsPositiveSpriteCallable = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveSprite['getBounds'], BoundsPositiveCallable
>>;
type BoundsPositiveBitmapCallable = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveBitmap['getBounds'], BoundsPositiveCallable
>>;
type BoundsPositiveStageCallable = BoundsPositiveAssert<BoundsPositiveEqual<
  BoundsPositiveStage['getBounds'], BoundsPositiveCallable
>>;

declare const boundsPositiveNode: BoundsPositiveNode;
declare const boundsPositiveContainer: BoundsPositiveContainer;
declare const boundsPositiveSprite: BoundsPositiveSprite;
declare const boundsPositiveBitmap: BoundsPositiveBitmap;
declare const boundsPositiveStage: BoundsPositiveStage;
const boundsPositiveReadonlyOptions: BoundsPositiveOptions = {maxNodes: 8, maxPrimitives: 16};
const boundsPositiveLiteralRectangle: BoundsPositiveRectangle = {x: 0, y: 1, width: 2, height: 3};
const boundsPositiveResults: readonly BoundsPositiveRectangle[] = [
  boundsPositiveNode.getBounds(),
  boundsPositiveNode.getBounds(undefined),
  boundsPositiveNode.getBounds({}),
  boundsPositiveNode.getBounds({maxNodes: 2}),
  boundsPositiveNode.getBounds({maxPrimitives: 3}),
  boundsPositiveNode.getBounds({maxNodes: 2, maxPrimitives: 3}),
  boundsPositiveNode.getBounds(boundsPositiveReadonlyOptions),
  boundsPositiveContainer.getBounds(boundsPositiveReadonlyOptions),
  boundsPositiveSprite.getBounds(),
  boundsPositiveBitmap.getBounds(undefined),
  boundsPositiveStage.getBounds({maxPrimitives: 3}),
];
// Structural variables with a recognized options field may have extra fields.
const boundsPositiveStructuralOptions = {maxNodes: 2, x: 0, y: 0, width: 1, height: 1};
const boundsPositiveStructuralResult: BoundsPositiveRectangle =
  boundsPositiveNode.getBounds(boundsPositiveStructuralOptions);
const boundsPositiveX: number = boundsPositiveStructuralResult.x;
const boundsPositiveY: number = boundsPositiveStructuralResult.y;
const boundsPositiveWidth: number = boundsPositiveStructuralResult.width;
const boundsPositiveHeight: number = boundsPositiveStructuralResult.height;
void boundsPositiveLiteralRectangle; void boundsPositiveResults;
void boundsPositiveX; void boundsPositiveY; void boundsPositiveWidth; void boundsPositiveHeight;
