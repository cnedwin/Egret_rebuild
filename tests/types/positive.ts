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
  ConstructorParameters<typeof Mesh2D>,
  [textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D]
>>;
type MeshInstance = MeshAssert<MeshEqual<InstanceType<typeof Mesh2D>, Mesh2D>>;
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
const meshPositiveDisplay: DisplayObject = meshPositive;
const meshPositiveLease: AssetLease<Texture> | undefined = meshPositive.textureLease;
const meshPositiveGeometry: TexturedGeometry2D | undefined = meshPositive.geometry;
meshPositive.setContent(textureBorrow, geometryValue);
const meshPositiveBounds: BoundsPositiveRectangle = meshPositive.getBounds({maxNodes: 1, maxPrimitives: 2});
meshPositive.clear();
meshPositive.dispose();
void meshPositiveDisplay; void meshPositiveLease; void meshPositiveGeometry; void meshPositiveBounds;

// Task 5: exact opt-in types; append without replacing accepted legacy fixtures.
import {TEXTURED_FRAME_PROFILE_2D as ProfileLiteral, createEngineForProfile as ProfileFactory} from '@egret/engine';
import type {TexturedFrameProfile2D as ProfileType, TexturedMeshCommand2D as ProfileMesh, TexturedRenderCommand2D as ProfileCommand, TexturedRenderFrame2D as ProfileFrame, TexturedRenderHostAdapter as ProfileHost, Engine as ProfileEngine, EngineOptions as ProfileEngineOptions, FrameOptions2D as ProfileOptions, HostAdapter as ProfileHostBase, Matrix2D as ProfileMatrix, ClipRectangle2D as ProfileClip, TextureRegion2D as ProfileRegion, ImageData2D as ProfileImage, TexturedGeometry2D as ProfileGeometry, RenderCommand2D as ProfileLegacyCommand, RectangleCommand2D as ProfileRect, ImageCommand2D as ProfileImageCommand, RenderFrame2D as ProfileLegacyFrame} from '@egret/engine';
import {collectTexturedFrameContent as ProfileCollect} from '../../packages/runtime/dist/index.js';
import type {CapturedTexturedContent2D as ProfileContent, Stage as ProfileStage} from '../../packages/runtime/dist/index.js';
import type {ContractsProfileType, ContractsProfileMesh, ContractsProfileCommand, ContractsProfileFrame, ContractsProfileHost} from '../../packages/engine/tests/profile-contract-types.js';
type ProfileEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false) : false;
type ProfileAssert<T extends true> = T;
type ProfileLiteralExact = ProfileAssert<ProfileEqual<typeof ProfileLiteral, 'egret.textured-frame2d/1'>>;
type ProfileTypeExact = ProfileAssert<ProfileEqual<ProfileType, typeof ProfileLiteral>>;
type ProfileReexportExact = ProfileAssert<ProfileEqual<ProfileType, ContractsProfileType>>;
type ProfileMeshReexportExact = ProfileAssert<ProfileEqual<ProfileMesh, ContractsProfileMesh>>;
type ProfileCommandReexportExact = ProfileAssert<ProfileEqual<ProfileCommand, ContractsProfileCommand>>;
type ProfileFrameReexportExact = ProfileAssert<ProfileEqual<ProfileFrame, ContractsProfileFrame>>;
type ProfileHostReexportExact = ProfileAssert<ProfileEqual<ProfileHost, ContractsProfileHost>>;
type ProfileMeshExact = ProfileAssert<ProfileEqual<ProfileMesh, {readonly kind: 'mesh'; readonly matrix: ProfileMatrix; readonly alpha: number; readonly clips: readonly ProfileClip[]; readonly imageIndex: number; readonly sourceRect: ProfileRegion; readonly geometryIndex: number}>>;
type ProfileUnionExact = ProfileAssert<ProfileEqual<ProfileCommand, ProfileRect | ProfileImageCommand | ProfileMesh>>;
type ProfileLegacyUnionExact = ProfileAssert<ProfileEqual<ProfileLegacyCommand, ProfileRect | ProfileImageCommand>>;
type ProfileFrameFields = {readonly profile: ProfileType; readonly frameId: number; readonly width: number; readonly height: number; readonly clearColor: number; readonly clearAlpha: number; readonly commands: readonly ProfileCommand[]; readonly images: readonly ProfileImage[]; readonly geometries: readonly ProfileGeometry[]};
type ProfileFrameKeys = ProfileAssert<ProfileEqual<Extract<keyof ProfileFrame, string>, keyof ProfileFrameFields>>;
type ProfileFrameReadonlyRequired = ProfileAssert<ProfileEqual<Pick<ProfileFrame, keyof ProfileFrameFields>, ProfileFrameFields>>;
type ProfileBrandPresent = ProfileAssert<ProfileEqual<Extract<keyof ProfileFrame, symbol> extends never ? false : true, true>>;
type ProfileBrandValue = ProfileAssert<ProfileEqual<ProfileFrame[Extract<keyof ProfileFrame, symbol>], true>>;
type ProfileHostFields = {readonly texturedFrameProfile: ProfileType; renderTexturedFrame(frame: ProfileFrame): undefined};
type ProfileHostNewKeys = ProfileAssert<ProfileEqual<Exclude<keyof ProfileHost, keyof ProfileHostBase>, keyof ProfileHostFields>>;
type ProfileHostExact = ProfileAssert<ProfileEqual<Pick<ProfileHost, keyof ProfileHostFields>, ProfileHostFields>>;
type ProfileHostPortExact = ProfileAssert<ProfileEqual<ProfileHost['renderTexturedFrame'], (frame: ProfileFrame) => undefined>>;
type ProfileFactoryExact = ProfileAssert<ProfileEqual<typeof ProfileFactory, (options: ProfileEngineOptions, profile: ProfileType) => Promise<ProfileEngine>>>;
type ProfileEngineAdvertisement = ProfileAssert<ProfileEqual<Pick<ProfileEngine, 'texturedFrameProfile'>, {readonly texturedFrameProfile: ProfileType | undefined}>>;
type ProfileEngineNewCapture = ProfileAssert<ProfileEqual<ProfileEngine['captureTexturedFrame'], (options: ProfileOptions) => ProfileFrame>>;
type ProfileEngineNewRender = ProfileAssert<ProfileEqual<ProfileEngine['renderTexturedFrame'], (options: ProfileOptions) => ProfileFrame>>;
type ProfileEngineOldCapture = ProfileAssert<ProfileEqual<ProfileEngine['captureFrame'], (options: ProfileOptions) => ProfileLegacyFrame>>;
type ProfileEngineOldRender = ProfileAssert<ProfileEqual<ProfileEngine['renderFrame'], (options: ProfileOptions) => ProfileLegacyFrame>>;
type ProfileOptionsExact = ProfileAssert<ProfileEqual<ProfileOptions, {readonly width: number; readonly height: number; readonly clearColor?: number; readonly clearAlpha?: number}>>;
type ProfileContentExact = ProfileAssert<ProfileEqual<ProfileContent, {readonly commands: readonly ProfileCommand[]; readonly images: readonly ProfileImage[]; readonly geometries: readonly ProfileGeometry[]}>>;
type ProfileCollectExact = ProfileAssert<ProfileEqual<typeof ProfileCollect, (stage: ProfileStage) => ProfileContent>>;
function profileExhaustion(command: ProfileCommand): number {
  switch (command.kind) { case 'rect': return command.color; case 'image': return command.imageIndex; case 'mesh': return command.geometryIndex; default: { const exhausted: never = command; return exhausted; } }
}
function profileLegacyExhaustion(command: ProfileLegacyCommand): number {
  switch (command.kind) { case 'rect': return command.color; case 'image': return command.imageIndex; default: { const exhausted: never = command; return exhausted; } }
}
declare const profilePositiveEngine: ProfileEngine;
declare const profilePositiveHost: ProfileHost;
declare const profilePositiveStage: ProfileStage;
const profilePositiveOptions: ProfileOptions = {width: 1, height: 1};
const profilePositiveCaptured: ProfileFrame = profilePositiveEngine.captureTexturedFrame(profilePositiveOptions);
const profilePositiveRendered: ProfileFrame = profilePositiveEngine.renderTexturedFrame(profilePositiveOptions);
const profilePositiveHostReturn: undefined = profilePositiveHost.renderTexturedFrame(profilePositiveCaptured);
const profilePositiveFactory: Promise<ProfileEngine> = ProfileFactory({host: profilePositiveHost}, ProfileLiteral);
const profilePositiveContent: ProfileContent = ProfileCollect(profilePositiveStage);
void profileExhaustion; void profileLegacyExhaustion; void profilePositiveRendered;
void profilePositiveHostReturn; void profilePositiveFactory; void profilePositiveContent;

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
const clockAfterAdvanceCapture: RenderFrame2D = clockConsumerEngine.captureFrame({width: 1, height: 1});
const clockAfterAdvanceRender: RenderFrame2D = clockConsumerEngine.renderFrame({width: 1, height: 1});
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
