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

// Geometry admission and consumer declarations require only ES2022 globals.
import {createTexturedGeometry2D as createDomGeometry, isTexturedGeometry2D as isDomGeometry} from '@egret/engine';
import type {TexturedFloatArray2D as DomGeometryFloat, TexturedIndexArray2D as DomGeometryIndex, TexturedGeometry2DInput as DomGeometryInput, TexturedGeometry2D as DomGeometry} from '@egret/engine';
const domGeometryFloat: DomGeometryFloat = new Float64Array(new ArrayBuffer(0));
const domGeometryIndex: DomGeometryIndex = new Uint32Array(new ArrayBuffer(0));
const domGeometryInput: DomGeometryInput = {positions: domGeometryFloat, uvs: new Float32Array(0), lightColors: domGeometryFloat, indices: domGeometryIndex};
const domGeometry: DomGeometry = createDomGeometry(domGeometryInput);
const domGeometryPositions: readonly number[] = domGeometry.positions;
const domGeometryUnknown: unknown = domGeometry;
if (isDomGeometry(domGeometryUnknown)) { const domGeometryNarrowed: DomGeometry = domGeometryUnknown; void domGeometryNarrowed; }
void domGeometryPositions;

// Mesh construction, cached getters and inherited bounds need no host globals.
import {Mesh2D as DomMesh} from '@egret/engine';
import type {AssetLease as DomMeshLease, Texture as DomMeshTexture} from '@egret/engine';
declare const domMeshLease: DomMeshLease<DomMeshTexture>;
const domMesh = new DomMesh(domMeshLease, domGeometry);
const domMeshCachedLease: DomMeshLease<DomMeshTexture> | undefined = domMesh.textureLease;
const domMeshCachedGeometry: DomGeometry | undefined = domMesh.geometry;
domMesh.setContent(domMeshLease, domGeometry);
const domMeshBounds: BoundsDomRectangle = domMesh.getBounds({maxNodes: 1, maxPrimitives: 1});
domMesh.clear();
domMesh.dispose();
void domMeshCachedLease; void domMeshCachedGeometry; void domMeshBounds;

// Task 5: opt-in consumers use ES2022 types without DOM or GPU globals.
import {TEXTURED_FRAME_PROFILE_2D as DomProfileLiteral, createEngineForProfile as DomProfileFactory} from '@egret/engine';
import type {TexturedFrameProfile2D as DomProfile, TexturedRenderFrame2D as DomProfileFrame, TexturedRenderHostAdapter as DomProfileHost, TexturedRenderCommand2D as DomProfileCommand, TexturedMeshCommand2D as DomProfileMesh, FrameOptions2D as DomProfileOptions, Engine as DomProfileEngine} from '@egret/engine';
import {collectTexturedFrameContent as DomProfileCollect} from '../../packages/runtime/dist/index.js';
import type {CapturedTexturedContent2D as DomProfileContent} from '../../packages/runtime/dist/index.js';
declare const domProfileEngine: DomProfileEngine;
declare const domProfileHost: DomProfileHost;
declare const domProfileMesh: DomProfileMesh;
const domProfile: DomProfile = DomProfileLiteral;
const domProfileOptions: DomProfileOptions = {width: 1, height: 1};
const domProfileFrame: DomProfileFrame = domProfileEngine.captureTexturedFrame(domProfileOptions);
const domProfileRendered: DomProfileFrame = domProfileEngine.renderTexturedFrame(domProfileOptions);
const domProfileReturn: undefined = domProfileHost.renderTexturedFrame(domProfileFrame);
const domProfileFactory: Promise<DomProfileEngine> = DomProfileFactory({host: domProfileHost}, domProfile);
const domProfileCommands: readonly DomProfileCommand[] = [domProfileMesh];
const domProfileContent: DomProfileContent = DomProfileCollect(stage);
void domProfileRendered; void domProfileReturn; void domProfileFactory; void domProfileCommands; void domProfileContent;

// Public clock consumers remain within the retained ES2022-only/no ambient types config.
import type {GameClockOptions as DomClockOptions, GameClockState as DomClockState, GameClockTick as DomClockTick, GameClockHandler as DomClockHandler, GameClock as DomClock, GameClockSubscription as DomClockSubscription, Engine as DomClockEngine} from '@egret/engine';
declare const domClockEngine: DomClockEngine;
const domClockOptions: DomClockOptions = {maxDeltaSeconds: 0.25};
const domClock: DomClock = domClockEngine.clock;
const domClockState: DomClockState = domClock.state;
const domClockScope = domClockEngine.createScope();
const domClockHandler: DomClockHandler = tick => { const elapsed: number = tick.elapsedSeconds; void elapsed; return undefined; };
const domClockSubscription: DomClockSubscription = domClock.onTick(domClockScope, domClockHandler);
const domClockOwned: DomClockSubscription = domClockScope.use(domClockSubscription);
const domClockTick: DomClockTick | undefined = domClockEngine.advanceTime(10);
const domClockCaptured: RenderFrame2D = domClockEngine.captureFrame({width: 1, height: 1});
const domClockRendered: RenderFrame2D = domClockEngine.renderFrame({width: 1, height: 1});
void domClockOptions; void domClockState; void domClockOwned; void domClockTick; void domClockCaptured; void domClockRendered;

// Public scalar Tween consumers use the unchanged ES2022-only/no-ambient config.
import type {Tween as DomTween, TweenOptions as DomTweenOptions, TweenState as DomTweenState, TweenEasing as DomTweenEasing, Engine as DomTweenEngine} from '@egret/engine';
declare const domTweenEngine: DomTweenEngine;
const domTweenScope = domTweenEngine.createScope();
const domTweenEasing: DomTweenEasing = 'quadInOut';
const domTweenOptions: DomTweenOptions = {from: 0, to: 1, durationSeconds: 1, easing: domTweenEasing, onUpdate(value) { sprite.alpha = value; return undefined; }, onComplete() { return undefined; }};
const domTween: DomTween = domTweenEngine.createTween(domTweenScope, domTweenOptions);
const domTweenOwned: DomTween = domTweenScope.use(domTween);
const domTweenState: DomTweenState = domTween.state;
const domTweenElapsed: number = domTween.elapsedSeconds;
const domTweenProgress: number = domTween.progress;
const domTweenValue: number = domTween.value;
domTween.start(); domTween.pause(); domTween.resume(); domTween.stop(); domTween.dispose();
void domTweenOwned; void domTweenState; void domTweenElapsed; void domTweenProgress; void domTweenValue;
