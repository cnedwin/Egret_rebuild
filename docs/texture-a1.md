# Texture A1: immutable CPU images and attributed geometry

A1 provides CPU values, borrowed display nodes, saved frames and private geometry preparation. Production Canvas and WebGPU hosts still reject image commands before resize, draw or queue mutation. There is no sampled image rendering, browser certification or GPU lifetime certification in A1. All A2 gates below are UNRUN.

## Ownership and identity

Create an ImageData2D from an intrinsic Uint8Array backed by an attached, fixed ArrayBuffer. Its exact tight 4×width×height bytes are copied; shared/resizable/detached backing, proxies and wrong byte types are rejected. Descriptor reads snapshot width→height→pixels→format→colorSpace→alphaMode→origin before semantics. The CPU format is straight RGBA8, encoded sRGB, top-left, tight 4×width rows. copyImageData2DPixels returns a new independent copy. Frozen public metadata exposes no writable pixel alias, browser resource, disposal or resolver. Primordials assume a normal realm at module initialization.

Identity authentication uses module-local private state. Lookalikes, proxies and values created by a duplicate contracts module do not authenticate. Use one compatible contracts identity across runtime, engine and host. Texture creation requires an authentic image and copies/freezes an integer positive contained source region (omission means full image); -0 becomes 0. Texture is factory-only and terminally disposable. Disposal drops only the wrapper's image reference; dimensions/region remain readable and saved ImageData2D values retain bytes. isTexture authenticates even a disposed wrapper; imageData then fails TEXTURE_DISPOSED.

Bitmap borrows one exact AssetLease<Texture>; construction never acquires or releases it. Assignments validate completely before committing. Clearing/disposal drops the borrow and zeros cached natural sizes, retains Engine affinity, and does not release the caller's lease. A released entitlement prevents future visible capture; independent active leases remain independent. Last-release provider disposal may invalidate their shared Texture wrapper. Cached natural sizes do not change merely because a lease/Texture dies. Saved frames retain immutable values without leases or wrappers and replay to another compatible CPU host after release, invalidation and Engine shutdown. Reachability retains CPU bytes; GC timing and global memory are not bounded.

The later [Bitmap region contract](../knowledge-base/en/docs/bitmap-region-contract.md) now implements `Bitmap.sourceRect`: the Texture's original view stays immutable, while each borrower owns its effective crop and matching natural sizes. Its [CPU evidence](../knowledge-base/en/docs/bitmap-region-evidence.md) and the separate [first-four texture collection](../knowledge-base/en/docs/texture-first-four-evidence.md) retain their own source/case scopes; the latter's numeric bounds remain UNKNOWN. The original A1 description and A2 obligations below are historical.

## Fixed limits and priorities

IMAGE_LIMITS_2D is frozen: source edge4096, source pixels1048576, table length64, distinct views128, distinct table payload16777216 bytes, unique-view projections16777216 bytes, scratch33554432 bytes and pending33554432 bytes. Counts/bytes are safe integers without coercion. Identity deduplicates payload including unused entries; duplicate table slots still count toward64. View identity includes image plus x/y/width/height. A1 enforces source/table/view/projection limits; A2 must own scratch/pending reservations. Limits exclude driver overhead and caller-retained frames and are not options; FrameOptions2D and EngineOptions remain unchanged.

After the complete descriptor snapshot, image factory semantics run in this exact order: width numeric type then finite positive safe-integer/range; height likewise; source edge/pixel caps and exact byte arithmetic; format→colorSpace→alphaMode→origin literals; intrinsic Uint8Array pixel type; backing-buffer kind; resizability; attachment; intrinsic view offset/byte length; finally allocation/copy. No coercion or truncation occurs, and negative-zero dimensions fail positivity. Image factory read faults are TypeError with original cause; semantic type/metadata/authentication faults use TypeError, dimension/capacity/length faults RangeError, and native allocation errors escape. Texture factory checks image first (TEXTURE_IMAGE_INVALID), then all region fields before region semantics (TEXTURE_REGION_INVALID with exact cause). Direct Texture construction without the private factory token fails TEXTURE_FACTORY_REQUIRED; receiver authentication is TEXTURE_INVALID. Bitmap receiver authentication is BITMAP_INVALID; constructor priority is exact lease brand BITMAP_LEASE_INVALID→active ASSET_LEASE_RELEASED→value BITMAP_TEXTURE_INVALID→live TEXTURE_DISPOSED→originating ENGINE_CLOSED. Setter first checks receiver→OBJECT_DISPOSED→ENGINE_CLOSED, then undefined clear or exact lease brand→ENGINE_MISMATCH→active/value/live. Replacement failure leaves the old slot intact. Disposal drops borrow before base listener cleanup; base errors propagate.

Engine frame gate order remains open→busy→renderer-required for render→ordered options→open→traverse→open→frameId exhaustion→construction/submission. Capture failure does not consume an ID or emit FRAME_RENDER_FAILED; renderer failure alone is wrapped/diagnosed. Traversal retains painter order and suppression, geometry before entitlement, image first-emission deduplication and FRAME_IMAGE_BUDGET. collectFrameContent authenticates the genuine Stage (FRAME_STAGE_INVALID) then checks its Engine open before/after traversal. It is runtime-public but not engine-re-exported. Legacy collectFrameCommands preserves its prior stage/rectangle behavior and rejects an emitted valid image with FRAME_IMAGE_UNSUPPORTED before image budgets.

The private mixed copier reads no images for rectangle-only frames. At first image it snapshots the safe-integer table length once. Length above64 fails budget before allocation or indexed reads. For admitted lengths0..64, it reads each index once without iterators and authenticates every entry, including unused entries, before payload/view accounting and geometry. This oversized-length priority intentionally replaces the earlier authentication-before-capacity behavior. Image field order is matrix→destination→alpha→clips→imageIndex→sourceRect. Fully validate metadata/clips before empty coverage. Known getter faults retain exact cause in FrameInputReadError, including an internal-looking indexed sentinel. New table/image-clip Array.isArray faults wrap at origin; old rectangle/header revoked-array errors remain raw. Semantics give FrameCopyError invalid/budget/backing; native allocation remains unclassified. Earlier painter/header errors win.

## Private geometry and CPU observations

Engine-relative private ports are prepareImage2D(command,width,height,options), normalizeImagePolygon(points,options), packImageVertices2D(prepared,width,height,maxUploadBytes). They are not package-root APIs. Image points carry x,y,u,v; output retains imageIndex/sourceRect/alpha even if empty. The source crop's local UVs are (0,0),(1,0),(1,1),(0,1). Shared corners/canonical crossings/clipping and packed positions are bounded first-party extractions, retaining rectangle point shape {x,y}, arithmetic, determinant order/budgets and existing packer errors. Geometry errors are range/precision/budget. Nonzero coordinates stay within2^-100..2^20; polygon cap1024. Collinear attributed vertices remain, conflicting adjacent or nonadjacent position duplicates and mixed turns fail precision; all-collinear coverage is empty. The policy wrappers share only the consecutive-triple winding finish: sign order, mixed-sign rejection, all-collinear empty result and full attached-point reversal remain identical. Full attached points reverse together. No inverse, epsilon, UV clamp or 1-t substitution is used.

Clip validation is unconditional even for zero alpha/singularity/empty clips. Vertex/edge limits are per invocation. The integration test alone carries remaining budgets across alternating rect/image commands; no new production mixed dispatch exists. Its literal24 fan vertices pass and23 fail; edge demand352 passes and351 fails. A quad packs six vertices,96 bytes;95 fails. The A1 observation layout is xNDC,yNDC,u,v (16 bytes/vertex), not an accepted A2 pipeline. Each fan corner is converted once; no cross-command reuse. Float32 represented zero-area triangles are skipped and counted; inverted represented winding fails. Backing/UV displacement observations introduce no acceptance tolerance; opacity remains metadata, applied once only by a future reviewed renderer.

## A2 stop gates — all UNRUN

A separate spike and reviewed plan must preregister nearest and encoded-sRGB source-over oracles, classify interior texels/quantization/seams/external raster edges and derive precision bounds before confirming the corpus. Production Canvas and WebGPU sampled/readback plus black/white composition need browser/device/version records. Corpus: alpha0/1/127/128/254/255, transparent colored texels, odd rows, fractional DPR, minification, mixed order; double-premultiply/wrong-transfer/UV-reversal/texture-sort controls must fail. Unresolved bounds block acceptance and must not be widened to pass.

A2 must implement crop/full-copy/premultiply scratch reservations, fixed pending caps, lower-device-limit enforcement, host error/reentrant-close precedence and complete submission-resource settlement. Release-before-fence, write-then-encode failure, close reentry, loss/rejection/hang, cleanup throw and exactly-once cleanup need separate mock/real-browser evidence. Engine disposes CPU assets before stop/close; async work must never consult leases/Textures. Unsafe proof cannot certify safe return, timeout is not cancellation, borrowed devices are never destroyed. Future nearest/clamp/single-mip rgba8unorm uploads require floor((C*A+127)/255), no automatic sRGB transfer and one opacity application; A1 does not implement these paths.

## Provenance and evidence

This is first-party implementation and narrowly reviewed extraction from existing rectangle geometry/webgpuPass. The existing robust-predicates dependency supplies orientation; no new dependencies or upstream code copies were added. Primary future interface references: [GPUWeb](https://gpuweb.github.io/gpuweb/), [WGSL](https://www.w3.org/TR/WGSL/), [Canvas standard](https://html.spec.whatwg.org/multipage/canvas.html). These references define future A2 interfaces, not A1 test results. See [CPU evidence](evidence/texture-a1.md). Independent review and publication validation remain separate from CPU tests.

## Public declarations

```ts
// @egret/contracts
declare const imageData2DBrand: unique symbol; // not exported
export interface ImageData2DInput {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array<ArrayBuffer>;
  readonly format?: "rgba8unorm";
  readonly colorSpace?: "srgb";
  readonly alphaMode?: "straight";
  readonly origin?: "top-left";
}
export interface ImageData2D {
  readonly [imageData2DBrand]: true;
  readonly width: number;
  readonly height: number;
  readonly bytesPerRow: number;
  readonly byteLength: number;
  readonly format: "rgba8unorm";
  readonly colorSpace: "srgb";
  readonly alphaMode: "straight";
  readonly origin: "top-left";
}
export declare function createImageData2D(input: ImageData2DInput): ImageData2D;
export declare function isImageData2D(value: unknown): value is ImageData2D;
export declare function copyImageData2DPixels(image: ImageData2D): Uint8Array<ArrayBuffer>;
export interface TextureRegion2D {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}
export declare const IMAGE_LIMITS_2D: Readonly<{
  maxSourceEdge: 4096; maxSourcePixels: 1048576;
  maxImagesPerFrame: 64; maxViewsPerFrame: 128;
  maxImageTableBytes: 16777216; maxProjectionBytes: 16777216;
  maxImageScratchBytes: 33554432; maxPendingTextureBytes: 33554432;
}>;
```

```ts
// @egret/runtime; existing same-package imports
import type { ImageData2D, TextureRegion2D, RenderCommand2D, RectangleCommand2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { Stage } from "./Stage.js";
import { DisplayObject } from "./DisplayObject.js";
export declare class Texture {
  private readonly textureBrand: void;
  private constructor();
  get imageData(): ImageData2D;
  get sourceRect(): TextureRegion2D;
  get width(): number;
  get height(): number;
  get isDisposed(): boolean;
  dispose(): void;
}
export declare function createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture;
export declare function isTexture(value: unknown): value is Texture;
export declare class Bitmap extends DisplayObject {
  constructor(textureLease: AssetLease<Texture>);
  get textureLease(): AssetLease<Texture> | undefined;
  set textureLease(value: AssetLease<Texture> | undefined);
  get naturalWidth(): number;
  get naturalHeight(): number;
  override dispose(): void;
}
export interface CapturedContent2D {
  readonly commands: readonly RenderCommand2D[];
  readonly images?: readonly ImageData2D[];
}
export declare function collectFrameContent(stage: Stage): CapturedContent2D;
export declare function collectFrameCommands(stage: Stage): readonly RectangleCommand2D[];
```

```ts
// @egret/contracts RenderFrame2D replacement; existing coordinate types unchanged
import type { HostAdapter } from "./HostAdapter.js";
export interface Matrix2D {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly tx: number; readonly ty: number;
}
export interface Rectangle2D {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}
export interface ClipRectangle2D {
  readonly matrix: Matrix2D; readonly rect: Rectangle2D;
}
export interface RectangleCommand2D {
  readonly kind: "rect"; readonly matrix: Matrix2D;
  readonly rect: Rectangle2D; readonly color: number;
  readonly alpha: number; readonly clips: readonly ClipRectangle2D[];
}
export interface ImageCommand2D {
  readonly kind: "image"; readonly matrix: Matrix2D;
  readonly rect: Rectangle2D; readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
  readonly imageIndex: number; readonly sourceRect: TextureRegion2D;
}
export type RenderCommand2D = RectangleCommand2D | ImageCommand2D;
export interface FrameOptions2D {
  readonly width: number; readonly height: number;
  readonly clearColor?: number; readonly clearAlpha?: number;
}
export interface RenderFrame2D {
  readonly frameId: number; readonly width: number; readonly height: number;
  readonly clearColor: number; readonly clearAlpha: number;
  readonly commands: readonly RenderCommand2D[];
  readonly images?: readonly ImageData2D[];
}
export interface RenderHostAdapter extends HostAdapter {
  renderFrame(frame: RenderFrame2D): undefined;
}
```
