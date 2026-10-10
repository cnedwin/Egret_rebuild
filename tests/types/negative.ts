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
