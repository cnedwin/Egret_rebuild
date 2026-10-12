import { Engine, Stage, Scope, DisplayObject, Event, EventDispatcher, createEventType } from "@egret/engine";
import type { EngineOptions, EventType } from "@egret/engine";
import { AssetManager, AssetLease, createAssetRef, createAssetType } from "@egret/engine";
import type { AssetRef, AssetType } from "@egret/engine";

const numeric = createEventType<number>("numeric");
const dispatcher = new EventDispatcher();
// @ts-expect-error Descriptor fixes payload type.
new Event(numeric, "wrong");
// @ts-expect-error Handler payload cannot contradict the descriptor.
dispatcher.on(numeric, (event: Event<string>) => { void event; });
// @ts-expect-error Synchronous event handlers reject Promise return types.
dispatcher.on(numeric, async () => {});
declare const mixedHandler: (event: Event<number>) => number | Promise<void>;
// @ts-expect-error A union containing a Promise is not a synchronous handler.
dispatcher.on(numeric, mixedHandler);
// @ts-expect-error Invariant descriptors cannot be widened to unrelated payloads.
const wide: EventType<number | string> = numeric;
const node = new DisplayObject();
// @ts-expect-error Parent is controlled by the display tree.
node.parent = undefined;
// @ts-expect-error Pure core does not expose DOM globals.
document.createElement("canvas");
// @ts-expect-error Pure core does not expose Node globals.
process.exit(0);
declare const validOptions: EngineOptions;
// @ts-expect-error Engine must reserve the surface and start through its factory.
new Engine(validOptions, 1000, () => {});
// @ts-expect-error Stage can only be created by Engine.
new Stage({ assertOpen() {}, report() {}, captureCleanup() {} });
// @ts-expect-error Scope can only be created by Engine.
new Scope({ assertOpen() {}, report() {}, captureCleanup() {} }, () => {});
void wide;

const stringType = createAssetType("text", (value): value is string => typeof value === "string");
const stringRef = createAssetRef(stringType, "greeting");
declare const engine: Engine;
// @ts-expect-error Descriptor generics must remain invariant.
const broadType: AssetType<string | number> = stringType;
// @ts-expect-error Resource reference generics must remain invariant.
const broadRef: AssetRef<string | number> = stringRef;
// @ts-expect-error Acquisition accepts a factory reference, never a string ID.
engine.assets.acquire("greeting");
// @ts-expect-error Provider value type follows the descriptor.
engine.assets.register(stringType, { load: async () => 42, dispose: () => {} });
// @ts-expect-error Validators must narrow unknown to the selected value type.
createAssetType<string>("bad", (value): value is number => typeof value === "number");
// @ts-expect-error CPU managers must be created through Engine.
new AssetManager({ assertOpen() {}, report() {}, captureCleanup() {} });
// @ts-expect-error CPU leases must be created through the manager.
new AssetLease();
// @ts-expect-error Internal manager factory is not a facade API.
import { createAssetManager } from "@egret/engine";
void broadType; void broadRef;

import {SequencePlayer,createSequenceClip} from '@egret/engine';
import type {SequenceClip,SequenceClipInput,SequenceFrameInput,SequencePlaybackMode} from '@egret/engine';
declare const sequenceBitmap:Bitmap;
const publicClip:SequenceClip=createSequenceClip({});
const publicPlayer=new SequencePlayer(sequenceBitmap,publicClip);
// @ts-expect-error Mode is restricted to the documented selections.
new SequencePlayer(sequenceBitmap,publicClip,'ping-pong');
// @ts-expect-error Player requires a Bitmap target.
new SequencePlayer(new DisplayObject(),publicClip);
// @ts-expect-error Player requires admitted clip metadata, not input frames.
new SequencePlayer(sequenceBitmap,{atlasWidth:1,atlasHeight:1,frames:[]});
// @ts-expect-error Absolute seconds are numeric.
publicPlayer.applyAt('0');
// @ts-expect-error Cached sample is readonly.
publicPlayer.lastSample=undefined;
// @ts-expect-error Disposal observation is readonly.
publicPlayer.isDisposed=false;
// @ts-expect-error Samples own readonly region metadata.
publicPlayer.applyAt(0).region.width=2;
// @ts-expect-error Valid documented frame durations are numeric.
const invalidSequenceFrame:SequenceFrameInput={x:0,y:0,width:1,height:1,durationSeconds:'0.1'};
// @ts-expect-error Valid documented atlas dimensions are numeric.
const invalidSequenceInput:SequenceClipInput={atlasWidth:'1',atlasHeight:1,frames:[]};
// @ts-expect-error Public playback modes do not include stop controllers.
const invalidSequenceMode:SequencePlaybackMode='stop';
// @ts-expect-error The underlying sampler remains internal.
import {sampleSequenceClip} from '@egret/engine';
void invalidSequenceFrame;void invalidSequenceInput;void invalidSequenceMode;

import type {RenderFrame2D, RenderHostAdapter} from '@egret/engine';
declare const capturedFrame:RenderFrame2D;
// @ts-expect-error Frames are immutable headers.
capturedFrame.width=10;
// @ts-expect-error Commands are readonly snapshots.
capturedFrame.commands.push(capturedFrame.commands[0]!);
// @ts-expect-error Geometry is immutable.
capturedFrame.commands[0]!.matrix.tx=1;
declare const baseRenderHost:RenderHostAdapter;
// @ts-expect-error Async rendering cannot satisfy the synchronous submission port.
const asyncRenderHost:RenderHostAdapter={...baseRenderHost,async renderFrame(){}};

import {createImageData2D} from '@egret/engine';
import type {ImageData2D, ImageCommand2D, RenderCommand2D} from '@egret/engine';
// @ts-expect-error IMAGE_CASE forged-nominal TS2741: metadata cannot forge the private image brand.
const forgedImage:ImageData2D={width:1,height:1,bytesPerRow:4,byteLength:4,format:'rgba8unorm',colorSpace:'srgb',alphaMode:'straight',origin:'top-left'};
// @ts-expect-error IMAGE_CASE shared-input TS2322: shared storage cannot be an owned-image input.
createImageData2D({width:1,height:1,pixels:new Uint8Array(new SharedArrayBuffer(4))});
// @ts-expect-error IMAGE_CASE clamped-input TS2322: clamped bytes are a distinct intrinsic view kind.
createImageData2D({width:1,height:1,pixels:new Uint8ClampedArray(new ArrayBuffer(4))});
declare const ownedImage:ImageData2D;
// @ts-expect-error IMAGE_CASE readonly-metadata TS2540: image metadata is immutable.
ownedImage.width=2;
// @ts-expect-error IMAGE_CASE wrong-format TS2322: only the fixed CPU format is admitted.
createImageData2D({width:1,height:1,pixels:new Uint8Array(new ArrayBuffer(4)),format:'bgra8unorm'});
// @ts-expect-error IMAGE_CASE missing-region TS2741: every image command has an explicit source rectangle.
const incompleteImageCommand:ImageCommand2D={kind:'image',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:1,height:1},alpha:1,clips:[],imageIndex:0};
declare const mixedCommand:RenderCommand2D;
// @ts-expect-error IMAGE_CASE unnarrowed-color TS2339: a mixed command needs kind narrowing.
mixedCommand.color;
void forgedImage;void incompleteImageCommand;

import {Texture,Bitmap} from '@egret/engine';
declare const texture:Texture;
declare const stringLease:AssetLease<string>;
declare const bitmap:Bitmap;
// @ts-expect-error TEXTURE_CASE missing-lease TS2554: Bitmap requires an exact lease.
new Bitmap();
// @ts-expect-error TEXTURE_CASE bare-texture TS2739: Texture itself is not an entitlement.
new Bitmap(texture);
// @ts-expect-error TEXTURE_CASE wrong-generic TS2379: Lease value types remain invariant.
new Bitmap(stringLease);
// @ts-expect-error TEXTURE_CASE direct-constructor TS2673: Texture requires its factory.
new Texture();
// @ts-expect-error TEXTURE_CASE readonly-size TS2540: Bitmap natural sizes are cached readonly values.
bitmap.naturalWidth=1;
// @ts-expect-error TEXTURE_CASE structural-texture TS2741: Public metadata cannot forge Texture identity.
const structuralTexture:Texture={imageData:ownedImage,sourceRect:{x:0,y:0,width:1,height:1},width:1,height:1,isDisposed:false,dispose(){}};
void structuralTexture;

// @ts-expect-error CAPTURE_CASE engine-port TS2305: low-level capture stays runtime-only.
import {collectFrameContent} from '@egret/engine';
// @ts-expect-error CAPTURE_CASE engine-type TS2305: low-level content stays runtime-only.
import type {CapturedContent2D} from '@egret/engine';
import type {CapturedContent2D as RuntimeContent} from '../../packages/runtime/dist/index.js';
declare const runtimeContent:RuntimeContent;
// @ts-expect-error CAPTURE_CASE readonly-commands TS2540: captured command arrays cannot be replaced.
runtimeContent.commands=[];
// @ts-expect-error CAPTURE_CASE readonly-images TS2339: saved image tables cannot be appended to.
runtimeContent.images!.push(ownedImage);

// Append to R/tests/types/negative.ts; the existing checker removes these suppressions.
import type {Bitmap as RegionNegativeBitmap} from '@egret/engine';
declare const bitmapRegionNegative: RegionNegativeBitmap;
// @ts-expect-error BITMAP_REGION_CASE nonnumeric-width TS2322: region fields are primitive numbers.
bitmapRegionNegative.sourceRect={x:0,y:0,width:'1',height:1};
// @ts-expect-error BITMAP_REGION_CASE null-reset TS2322: undefined is the only reset sentinel.
bitmapRegionNegative.sourceRect=null;
// @ts-expect-error BITMAP_REGION_CASE readonly-crop TS2540: exposed region metadata is immutable.
bitmapRegionNegative.sourceRect!.x=1;

// Coordinate misuse must produce real, unsuppressed compiler diagnostics.
import type {
  Point2D as CoordinateNegativePoint,
  CoordinateQueryOptions as CoordinateNegativeOptions,
  DisplayObject as CoordinateNegativeNode,
} from '@egret/engine';
import * as CoordinateNegativePublic from '@egret/engine';

declare const coordinateNegativeNode: CoordinateNegativeNode;
declare const coordinateNegativeOptions: CoordinateNegativeOptions;
const coordinateNegativeForward: CoordinateNegativePoint = coordinateNegativeNode.localToGlobal();
const coordinateNegativeInverse: CoordinateNegativePoint = coordinateNegativeNode.globalToLocal();
// @ts-expect-error COORDINATE_CASE readonly-forward-x: query results have readonly x.
coordinateNegativeForward.x = 3;
// @ts-expect-error COORDINATE_CASE readonly-inverse-y: query results have readonly y.
coordinateNegativeInverse.y = 4;
// @ts-expect-error COORDINATE_CASE readonly-options: the typed budget field is readonly.
coordinateNegativeOptions.maxNodes = 9;
// @ts-expect-error COORDINATE_CASE forward-scalar: the first coordinate is numeric.
coordinateNegativeNode.localToGlobal('1', 2);
// @ts-expect-error COORDINATE_CASE inverse-scalar: the second coordinate is numeric.
coordinateNegativeNode.globalToLocal(1, false);
// @ts-expect-error COORDINATE_CASE budget-scalar: a budget literal is numeric.
coordinateNegativeNode.localToGlobal(1, 2, {maxNodes: '8'});
// @ts-expect-error COORDINATE_CASE null-options: null is not an optional options object.
coordinateNegativeNode.globalToLocal(1, 2, null);
// @ts-expect-error COORDINATE_CASE forward-legacy-output: fresh Point-like literals are not query options.
coordinateNegativeNode.localToGlobal(1, 2, {x: 0, y: 0});
// @ts-expect-error COORDINATE_CASE inverse-legacy-output: fresh Point-like literals are not query options.
coordinateNegativeNode.globalToLocal(1, 2, {x: 0, y: 0});
// @ts-expect-error COORDINATE_CASE fourth-argument: there is no fourth output argument.
coordinateNegativeNode.localToGlobal(1, 2, {}, {});
// @ts-expect-error COORDINATE_CASE inverse-fourth-argument: there is no fourth inverse output argument.
coordinateNegativeNode.globalToLocal(1, 2, {}, {});
// @ts-expect-error COORDINATE_CASE undefined-field: exact optional properties omit the field instead of storing undefined.
const coordinateUndefinedField: CoordinateNegativeOptions = {maxNodes: undefined};
// @ts-expect-error COORDINATE_CASE point-type-only: the root namespace exports no executable Point2D value.
CoordinateNegativePublic.Point2D;
// @ts-expect-error COORDINATE_CASE options-type-only: the root namespace exports no executable CoordinateQueryOptions value.
CoordinateNegativePublic.CoordinateQueryOptions;
void coordinateUndefinedField;

// Content-bounds misuse must produce real, unsuppressed compiler diagnostics.
import type {
  BoundsQueryOptions as BoundsNegativeOptions,
  Rectangle2D as BoundsNegativeRectangle,
  DisplayObject as BoundsNegativeNode,
} from '@egret/engine';
import * as BoundsNegativePublic from '@egret/engine';

declare const boundsNegativeNode: BoundsNegativeNode;
declare const boundsNegativeOptions: BoundsNegativeOptions;
declare const boundsNegativeUnknownOptions: unknown;
const boundsNegativeResult: BoundsNegativeRectangle = boundsNegativeNode.getBounds();
// @ts-expect-error BOUNDS_CASE readonly-result-x: the returned origin is readonly.
boundsNegativeResult.x = 3;
// @ts-expect-error BOUNDS_CASE readonly-result-width: the returned extent is readonly.
boundsNegativeResult.width = 4;
// @ts-expect-error BOUNDS_CASE readonly-max-nodes: the node budget field is readonly.
boundsNegativeOptions.maxNodes = 9;
// @ts-expect-error BOUNDS_CASE readonly-max-primitives: the content budget field is readonly.
boundsNegativeOptions.maxPrimitives = 10;
// @ts-expect-error BOUNDS_CASE unknown-options: unknown input needs prior type admission.
boundsNegativeNode.getBounds(boundsNegativeUnknownOptions);
// @ts-expect-error BOUNDS_CASE null-options: null is not an optional options object.
boundsNegativeNode.getBounds(null);
// @ts-expect-error BOUNDS_CASE nonnumeric-max-nodes: the node budget field is numeric.
boundsNegativeNode.getBounds({maxNodes: '2'});
// @ts-expect-error BOUNDS_CASE nonnumeric-max-primitives: the content budget field is numeric.
boundsNegativeNode.getBounds({maxPrimitives: false});
// @ts-expect-error BOUNDS_CASE undefined-max-nodes: typed optional fields omit undefined values.
const boundsNegativeUndefinedNodes: BoundsNegativeOptions = {maxNodes: undefined};
// @ts-expect-error BOUNDS_CASE undefined-max-primitives: typed optional fields omit undefined values.
const boundsNegativeUndefinedPrimitives: BoundsNegativeOptions = {maxPrimitives: undefined};
// @ts-expect-error BOUNDS_CASE fresh-legacy-output: a fresh rectangle literal is not query options.
boundsNegativeNode.getBounds({x: 0, y: 0, width: 1, height: 1});
// @ts-expect-error BOUNDS_CASE extra-argument: there is no second output or target-space argument.
boundsNegativeNode.getBounds({}, {});
// @ts-expect-error BOUNDS_CASE options-type-only: the facade exports no executable BoundsQueryOptions value.
BoundsNegativePublic.BoundsQueryOptions;
void boundsNegativeUndefinedNodes; void boundsNegativeUndefinedPrimitives;

// Each geometry misuse has a predicted unsuppressed file/line/code receipt.
import {createTexturedGeometry2D as createNegativeGeometry} from '@egret/engine';
import type {TexturedFloatArray2D as NegativeGeometryFloat, TexturedIndexArray2D as NegativeGeometryIndex, TexturedGeometry2DInput as NegativeGeometryInput, TexturedGeometry2D as NegativeGeometry} from '@egret/engine';
import * as GeometryNegativePublic from '@egret/engine';
declare const geometryNegativeSharedFloat: Float32Array<SharedArrayBuffer>;
declare const geometryNegativeSharedIndex: Uint32Array<SharedArrayBuffer>;
declare const geometryNegativeInput: NegativeGeometryInput;
declare const geometryNegativeValue: NegativeGeometry;
declare const geometryNegativeUnknown: unknown;
// @ts-expect-error GEOMETRY_CASE ordinary-float TS2322
const geometryNegativeOrdinaryFloat: NegativeGeometryFloat = [0, 0];
// @ts-expect-error GEOMETRY_CASE ordinary-index TS2322
const geometryNegativeOrdinaryIndex: NegativeGeometryIndex = [0, 1, 2];
// @ts-expect-error GEOMETRY_CASE shared-float TS2322
const geometryNegativeSharedFloatAssignment: NegativeGeometryFloat = geometryNegativeSharedFloat;
// @ts-expect-error GEOMETRY_CASE shared-index TS2322
const geometryNegativeSharedIndexAssignment: NegativeGeometryIndex = geometryNegativeSharedIndex;
// @ts-expect-error GEOMETRY_CASE floating-index TS2322
const geometryNegativeFloatingIndex: NegativeGeometryIndex = new Float32Array(new ArrayBuffer(0));
// @ts-expect-error GEOMETRY_CASE byte-float TS2322
const geometryNegativeByteFloat: NegativeGeometryFloat = new Uint8Array(new ArrayBuffer(0));
// @ts-expect-error GEOMETRY_CASE missing-indices TS2741
const geometryNegativeMissingIndices: NegativeGeometryInput = {positions: new Float32Array(0), uvs: new Float64Array(0), lightColors: new Float32Array(0)};
// @ts-expect-error GEOMETRY_CASE unknown-input TS2345
createNegativeGeometry(geometryNegativeUnknown);
// @ts-expect-error GEOMETRY_CASE forged-brand TS2741
const geometryNegativeForged: NegativeGeometry = {vertexCount: 0, indexCount: 0, triangleCount: 0, logicalByteLength: 0, positions: [], uvs: [], lightColors: [], indices: []};
// @ts-expect-error GEOMETRY_CASE readonly-position TS2542
geometryNegativeValue.positions[0] = 1;
// @ts-expect-error GEOMETRY_CASE readonly-count TS2540
geometryNegativeValue.vertexCount = 3;
// @ts-expect-error GEOMETRY_CASE readonly-input-slot TS2540
geometryNegativeInput.positions = new Float32Array(0);
// @ts-expect-error GEOMETRY_CASE float-type-only TS2339
GeometryNegativePublic.TexturedFloatArray2D;
// @ts-expect-error GEOMETRY_CASE index-type-only TS2339
GeometryNegativePublic.TexturedIndexArray2D;
// @ts-expect-error GEOMETRY_CASE input-type-only TS2551
GeometryNegativePublic.TexturedGeometry2DInput;
// @ts-expect-error GEOMETRY_CASE geometry-type-only TS2551
GeometryNegativePublic.TexturedGeometry2D;
void geometryNegativeOrdinaryFloat; void geometryNegativeOrdinaryIndex;
void geometryNegativeSharedFloatAssignment; void geometryNegativeSharedIndexAssignment;
void geometryNegativeFloatingIndex; void geometryNegativeByteFloat;
void geometryNegativeMissingIndices; void geometryNegativeForged;

// Each Mesh misuse is checked at its own generated-file location and code.
import {Mesh2D as NegativeMesh} from '@egret/engine';
declare const meshNegativeLease: AssetLease<Texture>;
declare const meshNegativeUnknownLease: AssetLease<unknown>;
declare const meshNegativeWrongLease: AssetLease<string>;
declare const meshNegativeNode: NegativeMesh;
const meshNegativeForgedGeometry = {vertexCount: 0, indexCount: 0, triangleCount: 0, logicalByteLength: 0, positions: [], uvs: [], lightColors: [], indices: []};
// @ts-expect-error MESH_CASE missing-geometry TS2554
new NegativeMesh(meshNegativeLease);
// @ts-expect-error MESH_CASE extra-constructor-argument TS2554
new NegativeMesh(meshNegativeLease, geometryNegativeValue, {});
// @ts-expect-error MESH_CASE forged-geometry TS2741
new NegativeMesh(meshNegativeLease, meshNegativeForgedGeometry);
// @ts-expect-error MESH_CASE unknown-lease-value TS2379
new NegativeMesh(meshNegativeUnknownLease, geometryNegativeValue);
// @ts-expect-error MESH_CASE wrong-resource-lease TS2379
new NegativeMesh(meshNegativeWrongLease, geometryNegativeValue);
// @ts-expect-error MESH_CASE reversed-content-arguments TS2739
meshNegativeNode.setContent(geometryNegativeValue, meshNegativeLease);
// @ts-expect-error MESH_CASE undefined-content-geometry TS2345
meshNegativeNode.setContent(meshNegativeLease, undefined);
// @ts-expect-error MESH_CASE readonly-texture-lease TS2540
meshNegativeNode.textureLease = meshNegativeLease;
// @ts-expect-error MESH_CASE readonly-geometry TS2540
meshNegativeNode.geometry = geometryNegativeValue;
// @ts-expect-error MESH_CASE clear-extra-argument TS2554
meshNegativeNode.clear({});
// @ts-expect-error MESH_CASE no-source-rect TS2339
meshNegativeNode.sourceRect;
// @ts-expect-error MESH_CASE no-natural-width TS2339
meshNegativeNode.naturalWidth;
// @ts-expect-error MESH_CASE no-max-triangles-option TS2353
meshNegativeNode.getBounds({maxTriangles: 1});

// Task 5: each predicted code requires one actual unsuppressed receipt at root.
import {TEXTURED_FRAME_PROFILE_2D as NegativeProfileLiteral, createEngineForProfile as NegativeProfileFactory} from '@egret/engine';
import type {Engine as NegativeProfileEngine, EngineOptions as NegativeProfileEngineOptions, TexturedRenderFrame2D as NegativeProfileFrame, TexturedMeshCommand2D as NegativeProfileMesh, TexturedRenderHostAdapter as NegativeProfileHost, RenderFrame2D as NegativeProfileLegacyFrame, RenderCommand2D as NegativeProfileLegacyCommand} from '@egret/engine';
declare const negativeProfileEngine: NegativeProfileEngine;
declare const negativeProfileEngineOptions: NegativeProfileEngineOptions;
declare const negativeProfileFrame: NegativeProfileFrame;
declare const negativeProfileMesh: NegativeProfileMesh;
// @ts-expect-error TEXTURED_FRAME_CASE unsupported-profile TS2345
NegativeProfileFactory(negativeProfileEngineOptions, 'egret.textured-frame2d/2');
// @ts-expect-error TEXTURED_FRAME_CASE factory-missing-profile TS2554
NegativeProfileFactory(negativeProfileEngineOptions);
// @ts-expect-error TEXTURED_FRAME_CASE factory-extra-argument TS2554
NegativeProfileFactory(negativeProfileEngineOptions, NegativeProfileLiteral, {});
// @ts-expect-error TEXTURED_FRAME_CASE readonly-engine-profile TS2540
negativeProfileEngine.texturedFrameProfile = NegativeProfileLiteral;
// @ts-expect-error TEXTURED_FRAME_CASE wrong-frame-options TS2353
negativeProfileEngine.captureTexturedFrame({width: 1, height: 1, maxTriangles: 1});
// @ts-expect-error TEXTURED_FRAME_CASE plain-frame-missing-brand TS2741
const negativeProfilePlainFrame: NegativeProfileFrame = {profile: NegativeProfileLiteral, frameId: 1, width: 1, height: 1, clearColor: 0, clearAlpha: 0, commands: [], images: [], geometries: []};
// @ts-expect-error TEXTURED_FRAME_CASE textured-frame-to-legacy TS2322
const negativeProfileLegacyFrame: NegativeProfileLegacyFrame = negativeProfileFrame;
// @ts-expect-error TEXTURED_FRAME_CASE mesh-command-to-legacy TS2322
const negativeProfileLegacyCommand: NegativeProfileLegacyCommand = negativeProfileMesh;
// @ts-expect-error TEXTURED_FRAME_CASE missing-required-tables TS2739
const negativeProfileMissingTables: Omit<NegativeProfileFrame, Extract<keyof NegativeProfileFrame, symbol>> = {profile: NegativeProfileLiteral, frameId: 1, width: 1, height: 1, clearColor: 0, clearAlpha: 0, commands: []};
// @ts-expect-error TEXTURED_FRAME_CASE readonly-table-push TS2339
negativeProfileFrame.geometries.push();
// @ts-expect-error TEXTURED_FRAME_CASE readonly-frame-field TS2540
negativeProfileFrame.frameId = 2;
// @ts-expect-error TEXTURED_FRAME_CASE async-host-port TS2322
const negativeProfileAsyncPort: NegativeProfileHost['renderTexturedFrame'] = async (_frame: NegativeProfileFrame) => undefined;
void negativeProfilePlainFrame; void negativeProfileLegacyFrame; void negativeProfileLegacyCommand;
void negativeProfileMissingTables; void negativeProfileAsyncPort;

// Predictions are frozen before compilation and checked individually unsuppressed.
import * as ClockNegativePublic from '@egret/engine';
import type {GameClock as NegativeClock, GameClockSubscription as NegativeClockSubscription, GameClockTick as NegativeClockTick, GameClockOptions as NegativeClockOptions} from '@egret/engine';
declare const negativeClock: NegativeClock;
declare const negativeClockSubscription: NegativeClockSubscription;
declare const negativeClockTick: NegativeClockTick;
declare const negativeClockOptions: NegativeClockOptions;
declare const negativeClockEngine: Engine;
declare const negativeClockScope: Scope;
// @ts-expect-error GAME_CLOCK_CASE readonly-engine-clock TS2540
negativeClockEngine.clock = negativeClock;
// @ts-expect-error GAME_CLOCK_CASE readonly-state TS2540
negativeClock.state = 'paused';
// @ts-expect-error GAME_CLOCK_CASE readonly-elapsed TS2540
negativeClock.elapsedSeconds = 1;
// @ts-expect-error GAME_CLOCK_CASE readonly-tick-id TS2540
negativeClock.tickId = 1;
// @ts-expect-error GAME_CLOCK_CASE readonly-limit TS2540
negativeClock.maxDeltaSeconds = 1;
// @ts-expect-error GAME_CLOCK_CASE readonly-options TS2540
negativeClockOptions.maxDeltaSeconds = 1;
// @ts-expect-error GAME_CLOCK_CASE readonly-tick TS2540
negativeClockTick.deltaSeconds = 1;
// @ts-expect-error GAME_CLOCK_CASE readonly-disposal TS2540
negativeClockSubscription.isDisposed = true;
// @ts-expect-error GAME_CLOCK_CASE wrong-scope TS2739
negativeClock.onTick({}, () => undefined);
// @ts-expect-error GAME_CLOCK_CASE promise-handler TS2322
negativeClock.onTick(negativeClockScope, async () => undefined);
// @ts-expect-error GAME_CLOCK_CASE no-public-advance TS2339
negativeClock.advance(1);
// @ts-expect-error GAME_CLOCK_CASE no-public-close TS2339
negativeClock.close();
// @ts-expect-error GAME_CLOCK_CASE no-clock-scope-adoption TS2345
negativeClockScope.use(negativeClock);
// @ts-expect-error GAME_CLOCK_CASE no-forged-clock TS2741
const negativeClockForgery: NegativeClock = {state: 'running', elapsedSeconds: 0, tickId: 0, maxDeltaSeconds: 0.25, onTick: () => negativeClockSubscription, pause() {}, resume() {}};
// @ts-expect-error GAME_CLOCK_CASE no-forged-subscription TS2741
const negativeClockSubscriptionForgery: NegativeClockSubscription = {isDisposed: false, dispose() {}};
// @ts-expect-error GAME_CLOCK_CASE options-type-only TS2339
ClockNegativePublic.GameClockOptions;
// @ts-expect-error GAME_CLOCK_CASE state-type-only TS2339
ClockNegativePublic.GameClockState;
// @ts-expect-error GAME_CLOCK_CASE tick-type-only TS2339
ClockNegativePublic.GameClockTick;
// @ts-expect-error GAME_CLOCK_CASE handler-type-only TS2339
ClockNegativePublic.GameClockHandler;
// @ts-expect-error GAME_CLOCK_CASE clock-type-only TS2339
ClockNegativePublic.GameClock;
// @ts-expect-error GAME_CLOCK_CASE subscription-type-only TS2339
ClockNegativePublic.GameClockSubscription;
void negativeClockForgery; void negativeClockSubscriptionForgery;

// First-party named Tween diagnostic predictions; actual compiler evidence pending.
import * as TweenNegativePublic from '@egret/engine';
import type {Tween as NegativeTween, TweenOptions as NegativeTweenOptions, Engine as NegativeTweenEngine, Scope as NegativeTweenScope} from '@egret/engine';
declare const negativeTween: NegativeTween;
declare const negativeTweenOptions: NegativeTweenOptions;
declare const negativeTweenEngine: NegativeTweenEngine;
declare const negativeTweenScope: NegativeTweenScope;
// @ts-expect-error TWEEN_CASE readonly-state TS2540
negativeTween.state = 'paused';
// @ts-expect-error TWEEN_CASE readonly-disposal TS2540
negativeTween.isDisposed = false;
// @ts-expect-error TWEEN_CASE readonly-elapsed TS2540
negativeTween.elapsedSeconds = 1;
// @ts-expect-error TWEEN_CASE readonly-progress TS2540
negativeTween.progress = 1;
// @ts-expect-error TWEEN_CASE readonly-value TS2540
negativeTween.value = 1;
// @ts-expect-error TWEEN_CASE readonly-from-option TS2540
negativeTweenOptions.from = 1;
// @ts-expect-error TWEEN_CASE readonly-to-option TS2540
negativeTweenOptions.to = 1;
// @ts-expect-error TWEEN_CASE readonly-duration-option TS2540
negativeTweenOptions.durationSeconds = 1;
// @ts-expect-error TWEEN_CASE readonly-easing-option TS2540
negativeTweenOptions.easing = 'linear';
// @ts-expect-error TWEEN_CASE readonly-writer-option TS2540
negativeTweenOptions.onUpdate = () => undefined;
// @ts-expect-error TWEEN_CASE readonly-completion-option TS2540
negativeTweenOptions.onComplete = () => undefined;
// @ts-expect-error TWEEN_CASE wrong-scope TS2739
negativeTweenEngine.createTween({}, negativeTweenOptions);
// @ts-expect-error TWEEN_CASE unsupported-easing TS2322
negativeTweenEngine.createTween(negativeTweenScope, {...negativeTweenOptions, easing: 'cubic'});
// @ts-expect-error TWEEN_CASE asynchronous-writer TS2322
negativeTweenEngine.createTween(negativeTweenScope, {...negativeTweenOptions, onUpdate: async () => undefined});
// @ts-expect-error TWEEN_CASE asynchronous-completion TS2322
negativeTweenEngine.createTween(negativeTweenScope, {...negativeTweenOptions, onComplete: async () => undefined});
// @ts-expect-error TWEEN_CASE non-undefined-writer TS2322
negativeTweenEngine.createTween(negativeTweenScope, {...negativeTweenOptions, onUpdate: () => 1});
// @ts-expect-error TWEEN_CASE no-forged-handle TS2741
const negativeTweenForgery: NegativeTween = {state: 'idle', isDisposed: false, elapsedSeconds: 0, progress: 0, value: 0, start() {}, pause() {}, resume() {}, stop() {}, dispose() {}};
// @ts-expect-error TWEEN_CASE state-type-only TS2339
TweenNegativePublic.TweenState;
// @ts-expect-error TWEEN_CASE options-type-only TS2339
TweenNegativePublic.TweenOptions;
// @ts-expect-error TWEEN_CASE easing-type-only TS2339
TweenNegativePublic.TweenEasing;
void negativeTweenForgery;
