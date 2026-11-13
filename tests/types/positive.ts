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
import type { ImageData2DInput, ImageData2D, TextureRegion2D } from '@egret/engine';
const imageInput: ImageData2DInput = {width:1,height:1,pixels:new Uint8Array(new ArrayBuffer(4)),format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight',origin:'top-left'};
const image: ImageData2D = createImageData2D(imageInput);
const imagePixels: Uint8Array<ArrayBuffer> = copyImageData2DPixels(image);
const sourceEdge: 4096 = IMAGE_LIMITS_2D.maxSourceEdge;
const sourceRect: TextureRegion2D = {x:0,y:0,width:1,height:1};
const unknownImage:unknown=image;
if(isImageData2D(unknownImage)){const guarded:ImageData2D=unknownImage;void guarded;}
void imagePixels;void sourceEdge;

import {Texture,createTexture,isTexture,Bitmap} from '@egret/engine';
const textureValue:Texture=createTexture(image,sourceRect);
declare const textureBorrow:AssetLease<Texture>;
const bitmap=new Bitmap(textureBorrow);
const maybeLease:AssetLease<Texture>|undefined=bitmap.textureLease;
bitmap.textureLease=undefined;
const naturalWidth:number=bitmap.naturalWidth;
if(isTexture(textureValue)){const immutableImage:ImageData2D=textureValue.imageData;void immutableImage;}
textureValue.dispose();bitmap.dispose();void maybeLease;void naturalWidth;

import {collectSharedFrameContent} from '../../packages/runtime/dist/index.js';
import type {CapturedSharedContent2D,Stage} from '../../packages/runtime/dist/index.js';
import type {SharedRenderCommand2D} from '@egret/engine';
declare const stage:Stage;
const content:CapturedSharedContent2D=collectSharedFrameContent(stage);
const captureCommands:readonly SharedRenderCommand2D[]=content.commands;
void captureCommands;

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

// Exact owned-geometry declarations, including callable and readonly equality.
import {createTexturedGeometry2D, isTexturedGeometry2D} from '@egret/engine';
import type {TexturedFloatArray2D, TexturedIndexArray2D, TexturedGeometry2DInput, TexturedGeometry2D} from '@egret/engine';
import type {ContractsGeometryFloat, ContractsGeometryIndex, ContractsGeometryInput, ContractsGeometry} from '../../packages/engine/tests/geometry-contract-types.js';
type GeometryEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false)
    : false;
type GeometryAssert<T extends true> = T;
type GeometryFloatUnion = GeometryAssert<GeometryEqual<TexturedFloatArray2D, Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>>>;
type GeometryIndexUnion = GeometryAssert<GeometryEqual<TexturedIndexArray2D, Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>>>;
type GeometryInputShape = GeometryAssert<GeometryEqual<TexturedGeometry2DInput, {
  readonly positions: TexturedFloatArray2D;
  readonly uvs: TexturedFloatArray2D;
  readonly lightColors: TexturedFloatArray2D;
  readonly indices: TexturedIndexArray2D;
}>>;
type GeometryFields = {
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
  readonly logicalByteLength: number;
  readonly positions: readonly number[];
  readonly uvs: readonly number[];
  readonly lightColors: readonly number[];
  readonly indices: readonly number[];
};
type GeometryStringKeys = GeometryAssert<GeometryEqual<Extract<keyof TexturedGeometry2D, string>, keyof GeometryFields>>;
type GeometryReadonlyFields = GeometryAssert<GeometryEqual<Pick<TexturedGeometry2D, keyof GeometryFields>, GeometryFields>>;
type GeometryPrivateBrand = GeometryAssert<GeometryEqual<TexturedGeometry2D[Extract<keyof TexturedGeometry2D, symbol>], true>>;
type GeometryHasBrand = GeometryAssert<GeometryEqual<Extract<keyof TexturedGeometry2D, symbol> extends never ? false : true, true>>;
type GeometryCreateCallable = GeometryAssert<GeometryEqual<typeof createTexturedGeometry2D, (input: TexturedGeometry2DInput) => TexturedGeometry2D>>;
type GeometryGuardCallable = GeometryAssert<GeometryEqual<typeof isTexturedGeometry2D, (value: unknown) => value is TexturedGeometry2D>>;
type GeometryFloatReexport = GeometryAssert<GeometryEqual<TexturedFloatArray2D, ContractsGeometryFloat>>;
type GeometryIndexReexport = GeometryAssert<GeometryEqual<TexturedIndexArray2D, ContractsGeometryIndex>>;
type GeometryInputReexport = GeometryAssert<GeometryEqual<TexturedGeometry2DInput, ContractsGeometryInput>>;
type GeometryValueReexport = GeometryAssert<GeometryEqual<TexturedGeometry2D, ContractsGeometry>>;
const geometryF32: TexturedFloatArray2D = new Float32Array(new ArrayBuffer(0));
const geometryF64: TexturedFloatArray2D = new Float64Array(new ArrayBuffer(0));
const geometryU16: TexturedIndexArray2D = new Uint16Array(new ArrayBuffer(0));
const geometryU32: TexturedIndexArray2D = new Uint32Array(new ArrayBuffer(0));
const geometryInput: TexturedGeometry2DInput = {positions: geometryF32, uvs: geometryF64, lightColors: geometryF32, indices: geometryU16};
const geometryInput32: TexturedGeometry2DInput = {...geometryInput, indices: geometryU32};
const geometryValue: TexturedGeometry2D = createTexturedGeometry2D(geometryInput);
const geometryArrays: readonly (readonly number[])[] = [geometryValue.positions, geometryValue.uvs, geometryValue.lightColors, geometryValue.indices];
const geometryUnknown: unknown = geometryValue;
if (isTexturedGeometry2D(geometryUnknown)) { const geometryNarrowed: TexturedGeometry2D = geometryUnknown; void geometryNarrowed; }
void geometryInput32; void geometryArrays;

// Exact borrowed Mesh leaf declarations; bounds retains the existing callable.
import {Mesh2D} from '@egret/engine';
type MeshEqual<A, B> = GeometryEqual<A, B>;
type MeshAssert<T extends true> = T;
type MeshConstructorArguments = MeshAssert<MeshEqual<
  ConstructorParameters<typeof Mesh2D<TexturedGeometry2D>>,
  [textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D]
>>;
type MeshInstance = MeshAssert<MeshEqual<InstanceType<typeof Mesh2D<TexturedGeometry2D>>, Mesh2D>>;
type MeshTextureGetter = MeshAssert<MeshEqual<Mesh2D['textureLease'], AssetLease<Texture> | undefined>>;
type MeshGeometryGetter = MeshAssert<MeshEqual<Mesh2D['geometry'], TexturedGeometry2D | undefined>>;
type MeshSetContent = MeshAssert<MeshEqual<
  Mesh2D['setContent'], (textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D) => void
>>;
type MeshClear = MeshAssert<MeshEqual<Mesh2D['clear'], () => void>>;
type MeshDispose = MeshAssert<MeshEqual<Mesh2D['dispose'], () => void>>;
type MeshDisplayInheritance = MeshAssert<MeshEqual<Mesh2D extends DisplayObject ? true : false, true>>;
type MeshBoundsInherited = MeshAssert<MeshEqual<Mesh2D['getBounds'], DisplayObject['getBounds']>>;
type MeshBoundsExactCallable = MeshAssert<MeshEqual<Mesh2D['getBounds'], BoundsPositiveCallable>>;
const meshExactConstructor: new (textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D) => Mesh2D = Mesh2D;
const meshPositive: Mesh2D = new meshExactConstructor(textureBorrow, geometryValue);
const meshInferred = new Mesh2D(textureBorrow, geometryValue);
type MeshInferenceExact = MeshAssert<MeshEqual<typeof meshInferred, Mesh2D<TexturedGeometry2D>>>;
const meshInferredDefault: Mesh2D = meshInferred;
meshInferred.setContent(textureBorrow, geometryValue);
void meshInferredDefault;
const meshPositiveDisplay: DisplayObject = meshPositive;
const meshPositiveLease: AssetLease<Texture> | undefined = meshPositive.textureLease;
const meshPositiveGeometry: TexturedGeometry2D | undefined = meshPositive.geometry;
meshPositive.setContent(textureBorrow, geometryValue);
const meshPositiveBounds: BoundsPositiveRectangle = meshPositive.getBounds({maxNodes: 1, maxPrimitives: 2});
meshPositive.clear();
meshPositive.dispose();
void meshPositiveDisplay; void meshPositiveLease; void meshPositiveGeometry; void meshPositiveBounds;

// The shared profile is the only frame profile: exact factory, Engine ports and private collector.
import {SHARED_FRAME_PROFILE_2D as SharedProfileLiteral, createEngineForProfile as ProfileFactory} from '@egret/engine';
import type {SharedFrameProfile2D as SharedProfileType, SharedRenderFrame2D as ProfileFrame, SharedRenderHostAdapter as ProfileHost, SharedFrameOptions2D as ProfileOptions, Engine as ProfileEngine, EngineOptions as ProfileEngineOptions} from '@egret/engine'
import {collectSharedFrameContent as ProfileCollect} from '../../packages/runtime/dist/index.js';
import type {CapturedSharedContent2D as ProfileContent, Stage as ProfileStage} from '../../packages/runtime/dist/index.js';
type ProfileEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false) : false;
type ProfileAssert<T extends true> = T;
type ProfileLiteralExact = ProfileAssert<ProfileEqual<typeof SharedProfileLiteral, 'egret.shared-frame2d/1'>>;
type ProfileTypeExact = ProfileAssert<ProfileEqual<SharedProfileType, typeof SharedProfileLiteral>>;
type ProfileFactoryExact = ProfileAssert<ProfileEqual<typeof ProfileFactory, (options: ProfileEngineOptions, profile: SharedProfileType) => Promise<ProfileEngine>>>;
type ProfileEngineAdvertisement = ProfileAssert<ProfileEqual<Pick<ProfileEngine, 'sharedFrameProfile'>, {readonly sharedFrameProfile: SharedProfileType | undefined}>>;
type ProfileEngineCapture = ProfileAssert<ProfileEqual<ProfileEngine['captureSharedFrame'], (options: ProfileOptions) => ProfileFrame>>;
type ProfileEngineRender = ProfileAssert<ProfileEqual<ProfileEngine['renderSharedFrame'], (options: ProfileOptions) => ProfileFrame>>;
// The Engine has no member of the removed legacy and textured profiles.
type ProfileEngineRemoved = ProfileAssert<ProfileEqual<Extract<keyof ProfileEngine, 'captureFrame' | 'renderFrame' | 'captureTexturedFrame' | 'renderTexturedFrame' | 'texturedFrameProfile'>, never>>;
type ProfileCollectExact = ProfileAssert<ProfileEqual<typeof ProfileCollect, (stage: ProfileStage) => ProfileContent>>;
declare const profilePositiveEngine: ProfileEngine;
declare const profilePositiveHost: ProfileHost;
declare const profilePositiveStage: ProfileStage;
const profilePositiveOptions: ProfileOptions = {width: 1, height: 1};
const profilePositiveCaptured: ProfileFrame = profilePositiveEngine.captureSharedFrame(profilePositiveOptions);
const profilePositiveRendered: ProfileFrame = profilePositiveEngine.renderSharedFrame(profilePositiveOptions);
const profilePositiveFactory: Promise<ProfileEngine> = ProfileFactory({host: profilePositiveHost}, SharedProfileLiteral);
const profilePositiveContent: ProfileContent = ProfileCollect(profilePositiveStage);
void profilePositiveCaptured; void profilePositiveRendered; void profilePositiveFactory; void profilePositiveContent;

// First-party clock consumer authored from revision-1 API, not private owner ports.
import type {GameClockOptions, GameClockState, GameClockTick, GameClockHandler, GameClock, GameClockSubscription, Engine as ClockEngine, EngineOptions as ClockEngineOptions, Scope as ClockScope} from '@egret/engine';
type ClockEqual<A, B> = ProfileEqual<A, B>;
type ClockAssert<T extends true> = T;
type ClockOptionsExact = ClockAssert<ClockEqual<GameClockOptions, {readonly maxDeltaSeconds?: number}>>;
type ClockStatesExact = ClockAssert<ClockEqual<GameClockState, 'running' | 'paused' | 'closed'>>;
type ClockTickExact = ClockAssert<ClockEqual<GameClockTick, {readonly tickId: number; readonly elapsedSeconds: number; readonly deltaSeconds: number}>>;
type ClockHandlerExact = ClockAssert<ClockEqual<GameClockHandler, (tick: GameClockTick) => undefined>>;
type ClockFields = {readonly state: GameClockState; readonly elapsedSeconds: number; readonly tickId: number; readonly maxDeltaSeconds: number; onTick(scope: ClockScope, handler: GameClockHandler): GameClockSubscription; pause(): void; resume(): void};
type ClockKeysExact = ClockAssert<ClockEqual<Extract<keyof GameClock, string>, keyof ClockFields>>;
type ClockFieldsExact = ClockAssert<ClockEqual<Pick<GameClock, keyof ClockFields>, ClockFields>>;
type ClockBrandPresent = ClockAssert<ClockEqual<Extract<keyof GameClock, symbol> extends never ? false : true, true>>;
type ClockBrandExact = ClockAssert<ClockEqual<GameClock[Extract<keyof GameClock, symbol>], true>>;
type ClockSubscriptionFields = {readonly isDisposed: boolean; dispose(): void};
type ClockSubscriptionKeys = ClockAssert<ClockEqual<Extract<keyof GameClockSubscription, string>, keyof ClockSubscriptionFields>>;
type ClockSubscriptionExact = ClockAssert<ClockEqual<Pick<GameClockSubscription, keyof ClockSubscriptionFields>, ClockSubscriptionFields>>;
type ClockSubscriptionBrandPresent = ClockAssert<ClockEqual<Extract<keyof GameClockSubscription, symbol> extends never ? false : true, true>>;
type ClockSubscriptionBrandExact = ClockAssert<ClockEqual<GameClockSubscription[Extract<keyof GameClockSubscription, symbol>], true>>;
type ClockEngineFieldExact = ClockAssert<ClockEqual<Pick<ClockEngine, 'clock'>, {readonly clock: GameClock}>>;
type ClockAdvanceExact = ClockAssert<ClockEqual<ClockEngine['advanceTime'], (sourceSeconds: number) => GameClockTick | undefined>>;
type ClockEngineOptionExact = ClockAssert<ClockEqual<Pick<ClockEngineOptions, 'clock'>, {readonly clock?: GameClockOptions}>>;
declare const clockConsumerEngine: ClockEngine;
const clockConsumerScope = clockConsumerEngine.createScope();
const clockConsumerHandler: GameClockHandler = (tick) => { const seconds: number = tick.elapsedSeconds; void seconds; return undefined; };
const clockConsumerSubscription: GameClockSubscription = clockConsumerEngine.clock.onTick(clockConsumerScope, clockConsumerHandler);
const clockOwnedSubscription: GameClockSubscription = clockConsumerScope.use(clockConsumerSubscription);
const clockAdvancedTick: GameClockTick | undefined = clockConsumerEngine.advanceTime(10);
const clockAfterAdvanceCapture: ProfileFrame = clockConsumerEngine.captureSharedFrame({width: 1, height: 1});
const clockAfterAdvanceRender: ProfileFrame = clockConsumerEngine.renderSharedFrame({width: 1, height: 1});
void clockOwnedSubscription; void clockAdvancedTick; void clockAfterAdvanceCapture; void clockAfterAdvanceRender;

// First-party scalar Tween consumer from the adopted API; no private owner port.
import type {Tween, TweenState, TweenOptions, TweenEasing, Engine as TweenEngine, Scope as TweenScope, Disposable as TweenDisposable} from '@egret/engine';
type TweenAssert<T extends true> = T;
type TweenEqual<A, B> = ProfileEqual<A, B>;
type TweenStatesExact = TweenAssert<TweenEqual<TweenState, 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed'>>;
type TweenEasingExact = TweenAssert<TweenEqual<TweenEasing, 'linear' | 'quadIn' | 'quadOut' | 'quadInOut'>>;
type TweenOptionsFields = {readonly from: number; readonly to: number; readonly durationSeconds: number; readonly easing?: TweenEasing; readonly onUpdate: (value: number) => undefined; readonly onComplete?: () => undefined};
type TweenOptionsExact = TweenAssert<TweenEqual<TweenOptions, TweenOptionsFields>>;
type TweenFields = {readonly state: TweenState; readonly isDisposed: boolean; readonly elapsedSeconds: number; readonly progress: number; readonly value: number; start(): void; pause(): void; resume(): void; stop(): void; dispose(): void};
type TweenStringKeysExact = TweenAssert<TweenEqual<Extract<keyof Tween, string>, keyof TweenFields>>;
type TweenFieldsExact = TweenAssert<TweenEqual<Pick<Tween, keyof TweenFields>, TweenFields>>;
type TweenBrandPresent = TweenAssert<TweenEqual<Extract<keyof Tween, symbol> extends never ? false : true, true>>;
type TweenBrandValue = TweenAssert<TweenEqual<Tween[Extract<keyof Tween, symbol>], true>>;
type TweenEngineMethodExact = TweenAssert<TweenEqual<TweenEngine['createTween'], (scope: TweenScope, options: TweenOptions) => Tween>>;
declare const tweenConsumerEngine: TweenEngine;
const tweenConsumerScope = tweenConsumerEngine.createScope();
const tweenConsumerOptions: TweenOptions = {from: 0, to: 100, durationSeconds: 1, easing: 'quadIn', onUpdate(value) { const scalar: number = value; void scalar; return undefined; }, onComplete() { return undefined; }};
const tweenConsumer: Tween = tweenConsumerEngine.createTween(tweenConsumerScope, tweenConsumerOptions);
const tweenConsumerOwned: Tween = tweenConsumerScope.use(tweenConsumer);
const tweenConsumerDisposable: TweenDisposable = tweenConsumer;
const tweenConsumerState: TweenState = tweenConsumer.state;
tweenConsumer.start(); tweenConsumer.pause(); tweenConsumer.resume(); tweenConsumer.stop(); tweenConsumer.dispose();
void tweenConsumerOwned; void tweenConsumerDisposable; void tweenConsumerState;

// Multi-contact consumers use the optional public Engine contract without DOM types.
import {createPointerInput} from '@egret/engine/input';
import type {PointerInput,PointerInputOptions,PointerContact,PointerSession} from '@egret/engine/input';
function pointerConsumer(options:PointerInputOptions):PointerInput {
 const input=createPointerInput(options);
 const id:PointerSession|undefined=input.begin({pointerId:1,pointerType:'touch',globalX:0,globalY:0,buttons:1,timestamp:0});
 input.events.begin satisfies import('@egret/engine').EventType<PointerContact>;
 if(id)input.cancel(id,'pointercancel');
 return input;
}
void pointerConsumer;

// Owned UI consumers remain DOM-free and use only the optional public entry.
import {createUiRoot} from '@egret/engine/ui';
import {Sprite as UiConsumerSprite} from '@egret/engine';
import type {UiRootOptions,UiPreparation,UiCommitResult,VirtualDataSource,LayoutNode,UiSnapshot} from '@egret/engine/ui';
declare const uiOptions: UiRootOptions;
const ownedUi = createUiRoot(uiOptions);
const uiPreparing: Promise<UiPreparation> = ownedUi.prepare();
uiPreparing.then(token => { const result: UiCommitResult = ownedUi.commit(token); return result.revision; });
const uiSnapshot: UiSnapshot = ownedUi.snapshot();
const uiResourceDemands: number | undefined = uiSnapshot.counters.resourceDemands;
const uiRows: VirtualDataSource<{label: string}> = {
 revision: 1, records: [{key: 'first', contentVersion: 1, estimatedHeight: 24, value: {label: 'First'}}],
 bind(context) { const label: string = context.value.label; void label; return {content: context.scope.use(new UiConsumerSprite()), measuredHeight: 24}; },
 unbind(info) { const key: string = info.key; void key; }
};
ownedUi.list<{label:string}>('rows').setSource(uiRows);
const uiTree: LayoutNode = {id:'rows',kind:'virtualList',source:uiRows};
ownedUi.setTree(uiTree);
const uiRetention = ownedUi.list('rows').retain('first','composition');
uiRetention.release();
void uiResourceDemands;

// Sequence controls are optional and preserve DOM-free application composition.
import {createSequenceController} from '@egret/engine/animation';
import type {SequenceController, SequenceControllerOptions, SequenceControllerStatus, SequenceControllerEvent, SequenceSeekRequest} from '@egret/engine/animation';
import type {Engine as SequenceControlEngine, Scope as SequenceControlScope, Bitmap as SequenceControlBitmap, SequenceClip as SequenceControlClip} from '@egret/engine';
declare const sequenceControlEngine: SequenceControlEngine;
declare const sequenceControlScope: SequenceControlScope;
declare const sequenceControlBitmap: SequenceControlBitmap;
declare const sequenceControlClip: SequenceControlClip;
const sequenceControlOptions: SequenceControllerOptions = {
  profile: 'egret.sequence-control/1', totalPlays: 2, rate: 1,
  markers: [{id: 'step', timeSeconds: 0.25}],
  onEvent(event: SequenceControllerEvent): undefined {
    if (event.kind === 'marker') { const id: string = event.id; void id; }
    else { const plays: number = event.totalPlays; void plays; }
    return undefined;
  },
};
const sequenceControl: SequenceController = createSequenceController(sequenceControlEngine, sequenceControlScope, sequenceControlBitmap, sequenceControlClip, sequenceControlOptions);
sequenceControl.start();
sequenceControl.pause();
sequenceControl.setRate(2);
sequenceControl.resume();
const sequenceSeek: SequenceSeekRequest = {timeSeconds: 0.5, replayEvents: true};
sequenceControl.seek(sequenceSeek);
const sequenceControlStatus: SequenceControllerStatus = sequenceControl.getStatus();
const sequenceControlIssue: string | undefined = sequenceControlStatus.lastIssue?.code;
sequenceControl.stop();
sequenceControl.dispose();
void sequenceControlIssue;

import type { VirtualListRevealOptions } from '@egret/engine/ui';
declare const navigationList: import('@egret/engine/ui').VirtualListHandle<number>;
const navigationOptions: VirtualListRevealOptions = {align: 'nearest'};
navigationList.reveal('record', navigationOptions);
navigationList.reveal('record', {align: 'start'});
navigationList.reveal('record', {align: 'center'});
navigationList.reveal('record', {align: 'end'});
navigationList.reveal(undefined);

import { createUiTheme } from '@egret/engine/ui';
import type { UiTheme, UiThemeDescriptor, UiLeafPrepareContext, RowBindContext } from '@egret/engine/ui';
const themeDescription: UiThemeDescriptor = { id: 'day', colors: { background: 0xffffff }, spacing: { gap: 4 }, typography: { body: { fontFamily: 'A', fontSize: 12, lineHeight: 20 } }, skins: { badge: { default: 'red', focus: 'green' } } };
const uiTheme: UiTheme = createUiTheme(themeDescription);
ownedUi.setTheme(uiTheme);
ownedUi.setTheme(ownedUi.snapshot().theme);
const themedNode: LayoutNode = { id: 'body', kind: 'leaf', theme: { fill: 'background', padding: 'gap' } };
declare const themeLeaf: UiLeafPrepareContext, themeRow: RowBindContext<string>;
const contextTheme: UiTheme | undefined = themeLeaf.theme ?? themeRow.theme;
const plannerCalls: number = ownedUi.snapshot().counters.layoutPasses;
void themedNode; void contextTheme; void plannerCalls;
