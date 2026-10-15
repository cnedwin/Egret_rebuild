# Owned textured geometry and Mesh2D: bounded contract

English | [简体中文](../../Cns/docs/自有纹理几何与Mesh2D契约.md) · [Evidence and checkpoints](textured-geometry-and-mesh2d-evidence.md)

The package gives developers immutable indexed XY/UV/light-RGBA geometry, a textured display leaf, retained ordered frames and an explicit rendering profile. CPU ownership can be accepted separately. Package completion requires a real browser to draw a deformable textured Mesh2D between existing rectangles and Bitmaps, preserving order, clipping, tint, alpha and retained-frame ownership.

Engineering checkpoint **0.23.0**, prepared 2026-10-11. Owned textured geometry, Mesh2D, immutable profile frames and the explicit WebGPU host have bounded CPU, strict-type and desktop native evidence. The native run passed all 11 calibration and 10 held-out windows, with all 16 assigned windows detecting their 12 independently copied faults. Independent saved-result review accepted this one recorded Windows/Edge/NVIDIA environment. Public reproduction tooling, final paired-material review, current complete pre-push and remote delivery are separately recorded; this document does not infer them from a native PASS.

GPU plan Task 1 accepted the private shared ledger and optional preparation/packing seams after 31/31 helper and 37/37 affected legacy cases, at its checkpoint of 216 source/fixture files and 328 emissions. Task 2 accepted full-tuple Mesh CPU preparation, represented packing and ordered rectangle/image/Mesh dispatch after a fresh build, 90/90 combined cases (the retained 31 budget cases plus 59 Mesh cases) and a separate 37/37 affected legacy run. Its fresh runner binds 236 selected source/fixture inputs and 340 emissions. Those historical helper checks do not establish the later host or native pixels. The API blocks and numeric host requirements below remain the adopted specification.

Task 3 subsequently passed 155/155 combined CPU cases (31 budget, 59 Mesh and 65 admission), with separate 94/94 projection/image-host and 37/37 legacy geometry runs, at 241 selected inputs and 352 emissions. Task 4 passed 30/30 public controlled-host cases, 14/14 profile/legacy-port cases, a fresh 155/155 helper run and 146/146 affected old GPU checks including all 13 B1 cases, after its corrected build with 360 emissions. These historical results cover bounded source/controlled behavior; the later fixed desktop native cases are recorded separately.

Task 6 passed the strict positive consumer and checked 19 individually located unsuppressed new diagnostics, 33/33 new policy cases and 299/299 retained policy cases. Its source scan passed at the recorded 363-file boundary; later native-only additions retain separate provenance. The fixed comparator passed 208/208 CPU units with unchanged expectations and tolerances. Constructed byte arrays and metadata checks establish comparator behavior, without validating native shader compilation, pixels or copied-production sensitivity.

## Surface and compatibility

### Implemented CPU declarations

These declarations describe the implemented CPU surface; remaining final-stage gates are listed in the paired evidence.

```ts
// @egret/contracts; also re-exported from the DOM-free @egret/engine root.
export type TexturedFloatArray2D =
  Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
export type TexturedIndexArray2D =
  Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
export interface TexturedGeometry2DInput {
  readonly positions: TexturedFloatArray2D;  // x,y, length 2*N
  readonly uvs: TexturedFloatArray2D;        // u,v, length 2*N
  readonly lightColors: TexturedFloatArray2D; // straight r,g,b,a, length 4*N
  readonly indices: TexturedIndexArray2D;   // triangle list, length I
}
declare const texturedGeometry2DBrand: unique symbol;
export interface TexturedGeometry2D {
  readonly [texturedGeometry2DBrand]: true;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
  readonly logicalByteLength: number;
  readonly positions: readonly number[];
  readonly uvs: readonly number[];
  readonly lightColors: readonly number[];
  readonly indices: readonly number[];
}
export function createTexturedGeometry2D(
  input: TexturedGeometry2DInput
): TexturedGeometry2D;
export function isTexturedGeometry2D(value: unknown): value is TexturedGeometry2D;
export const TEXTURED_FRAME_PROFILE_2D: "egret.textured-frame2d/1";
export type TexturedFrameProfile2D = typeof TEXTURED_FRAME_PROFILE_2D;
export interface TexturedMeshCommand2D {
  readonly kind: "mesh";
  readonly matrix: Matrix2D;
  readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
  readonly imageIndex: number;
  readonly sourceRect: TextureRegion2D;
  readonly geometryIndex: number;
}
export type TexturedRenderCommand2D = RenderCommand2D | TexturedMeshCommand2D;
declare const texturedRenderFrame2DBrand: unique symbol;
export interface TexturedRenderFrame2D {
  readonly [texturedRenderFrame2DBrand]: true;
  readonly profile: TexturedFrameProfile2D;
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly clearColor: number;
  readonly clearAlpha: number;
  readonly commands: readonly TexturedRenderCommand2D[];
  readonly images: readonly ImageData2D[]; // required, including []
  readonly geometries: readonly TexturedGeometry2D[]; // required, including []
}
export interface TexturedRenderHostAdapter extends HostAdapter {
  readonly texturedFrameProfile: TexturedFrameProfile2D;
  renderTexturedFrame(frame: TexturedRenderFrame2D): undefined;
}

// @egret/runtime; re-exported by @egret/engine.
export class Mesh2D extends DisplayObject {
  constructor(textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D);
  get textureLease(): AssetLease<Texture> | undefined;
  get geometry(): TexturedGeometry2D | undefined;
  setContent(textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D): void;
  clear(): void;
  override dispose(): void;
}

// @egret/engine root: additions to the existing Engine class.
export function createEngineForProfile(
  options: EngineOptions, profile: TexturedFrameProfile2D
): Promise<Engine>;
// Declaration additions to the existing Engine class; EngineOptions unchanged.
export interface Engine {
  readonly texturedFrameProfile: TexturedFrameProfile2D | undefined;
  captureTexturedFrame(options: FrameOptions2D): TexturedRenderFrame2D;
  renderTexturedFrame(options: FrameOptions2D): TexturedRenderFrame2D;
}

```

### Implemented explicit GPU declarations and verification scope

The explicit factory and host below are implemented and accepted in the controlled-host scope. Task 6 has also accepted their strict public consumer and recorded type/source-boundary checks. Fixed desktop native submissions and pixels have separate accepted evidence. The narrow Pick composition preserves the required legacy WebGPU surface and the two textured adapter members.

```ts
// Explicit @egret/engine/webgpu entry only; DOM/GPU types stay out of root.
export interface TexturedWebGPUHostOptions extends WebGPUHostOptions {
  readonly maxSourceTriangles?: number;
  readonly maxFrameGeometryBytes?: number;
  readonly maxPendingGeometryBytes?: number;
  readonly maxTupleComparisons?: number;
}
export interface TexturedWebGPUHostStatus {
  readonly host: WebGPUHostStatus;
  readonly pendingGeometryBytes: number;
}
export interface TexturedWebGPUHost extends WebGPUHost, Pick<TexturedRenderHostAdapter, 'texturedFrameProfile' | 'renderTexturedFrame'> {
  getTexturedStatus(): TexturedWebGPUHostStatus;
}
export function createTexturedWebGPUHost(
  options: TexturedWebGPUHostOptions
): TexturedWebGPUHost;
```

Geometry declarations/factory/authentication belong to contracts and are re-exported by the DOM-free engine root. The six geometry-stage additions are `TexturedFloatArray2D`, `TexturedIndexArray2D`, `TexturedGeometry2DInput`, `TexturedGeometry2D`, `createTexturedGeometry2D` and `isTexturedGeometry2D`; the first four are type-only. Mesh2D belongs to runtime and is re-exported by engine. Host DOM/GPU declarations belong only to `@egret/engine/webgpu`. Preserve engine → runtime/contracts, runtime → contracts, and contracts → no package dependencies. The root import graph remains free of rendering/WebGPU/robust-predicates. Canvas admits only the import-free, DOM/GPU-free `rendering/ownedPreparationFailure2D.js` error-provenance helper from rendering; its graph contains no WebGPU or robust-predicates modules.

The literal profile is `egret.textured-frame2d/1`. Existing protocol pins `1.0`, `RenderCommand2D = rect | image`, `RenderFrame2D`, `RenderHostAdapter`, default `createEngine` and default factories keep their existing route/types. Mesh is not appended to that old union. Frames require both tables, including empty arrays. There is no public frame factory/registrar. Exact-module private identity authenticates geometry and completed owned frames; structural copies and proxies convey no authority. No cross-loader identity or hostile-intrinsic protection is promised.

UVs are top-left normalized coordinates within the recorded integer Texture crop. Light RGBA is straight and componentwise [0,1]. The implemented profile fixes normal source-over, nearest/clamp-to-edge, mip 0, encoded-premultiplied uploads and an sRGB canvas. Other variants require a distinct explicit profile. WebGL, Canvas mesh approximation, skinning, general/inverse masks, dark tint, additive/multiply/screen, wrapping, linear filtering and mipmaps are outside this profile.

## Geometry admission and ownership

Admission order is normative. No instance iterator, overridden tag/buffer/length, species or payload property callback supplies authority. Genuine fixed-buffer cross-realm typed arrays are admitted through captured normal-realm intrinsics; ordinary arrays, proxies/lookalikes, SharedArrayBuffer, resizable and detached backing are unsupported.

| Phase | Action and priority |
| --- | --- |
| G0 | Require non-null object, rejecting functions: `TypeError("Textured geometry descriptor must be an object")`. |
| G1 | Read `positions`, `uvs`, `lightColors`, `indices` once in order, completing successful reads before semantics. First throw stops: `TypeError("Textured geometry descriptor read failed", { cause: exactThrown })`. Preserve even an undefined cause; a late throw outranks an earlier malformed field. |
| G2 | Complete the brand pass on all four fields in order before any backing check. Captured TypedArray tag getter accepts Float32/Float64 for floating fields and Uint16/Uint32 for indices. First wrong tag: `TypeError("Textured geometry array brand is unsupported")`; intrinsic throws escape intact. |
| G3 | In field order, use captured buffer getter, ArrayBuffer byteLength getter, available resizable getter, available detached getter (otherwise `new Uint8Array(backing,0,0)`), then byteOffset/byteLength getters. Shared backing is rejected by the ArrayBuffer getter; intrinsic throws escape intact. True resizable/detached: `TypeError("Textured geometry backing is unsupported")`. |
| G4 | Derive exact element lengths; validate 2N/2N/4N/I and empty/triangle-list shape, then capacity and safe-integer `64*N+4*I`. Shape: `RangeError("Textured geometry array shape is invalid")`; capacity: `RangeError("Textured geometry capacity exceeded")`. No payload copy, index read or canonical-array allocation before admission. |
| G5 | Copy each intrinsic used range to a new same-element-type fixed typed array in field order using captured constructors/set. Native allocation/copy errors escape intact; source buffers are not retained. |
| G6 | Validate copies ascending: positions, UVs, lightColors, indices. Positions finite; UV/light finite [0,1]; indices integer [0,N). First invalid component: `RangeError("Textured geometry numeric range is invalid")`. Validate unused vertices too. Canonical dense ordinary arrays normalize -0 to +0. |
| G7 | Freeze four independent arrays and metadata; register identity only after completion. No partial value is registered. |

N/I are both zero, or N≥3, I≥3 and I divisible by 3. Repeated indices/positions and unused vertices are allowed. Maxima: N=65,536, I=196,608, triangleCount=65,536, logicalByteLength=4,980,736. Logical bytes are `64*N+4*I` regardless of input element types; a three-vertex/three-index triangle is 204 bytes. Float32 values retain their represented values exactly as binary64 numbers. This accounting is not physical array heap, temporary copy memory, RSS, GPU memory or an OOM guarantee. Native allocation faults are distinct from deterministic limits.

The factory scans all supplied copied components once. Implemented capture and the explicit textured host retain authentic immutable geometry by reference, without per-command full copies or full-vertex rescans. Indexed work reads three referenced tuples per triangle. Mutating supplied views/backing or attempting to mutate returned arrays/metadata cannot change a completed value.

## Mesh lifetime, transactions and bounds — CPU accepted

Constructor order is authentic geometry → lease identity → exact active private lease value → authentic/live Texture and immutable snapshot → lease Engine open → bind leaf → frozen content pair. Errors are `MESH_GEOMETRY_INVALID`, `MESH_LEASE_INVALID`, existing exact lease-entitlement failure, `MESH_TEXTURE_INVALID`, existing Texture-live failure, then Engine-open failure. Overridable lease/Texture properties never establish permission.

`setContent` checks Mesh identity (`MESH_INVALID`), display lifetime, bound Engine openness, mutation guard (`MESH_MUTATION_REENTRANT`), previous slot, geometry, lease, Engine affinity (`ENGINE_MISMATCH`), private lease/Texture live snapshot, then display/Engine/previous-slot recheck before atomic replacement; finally clears the guard. `clear` performs the same first four checks and drops content without releasing the borrowed lease. Affinity remains after clear. Getters authenticate only and return cached fields, undefined after clear/dispose. Dispose drops content before base cleanup and is idempotent for terminated authentic receivers.

Retained frames hold immutable geometry/image/crop, matrix, inherited alpha and clips, with no leaf/Texture wrapper/AssetLease reference. Later content replacement, disposal, release or buffer mutation cannot alter them. New visible capture rechecks entitlement and Texture lifetime. Geometry identity grants no pixel/resource permission.

Mesh bounds extend the existing [content bounds contract](display-content-bounds-contract.md), without new options. Each authored indexed triangle consumes one primitive before three index reads, using maxPrimitives default 65,536/hard 262,144. At most three referenced XY points per triangle contribute, including point/line/collinear triangles; unused vertices do not. Cached geometry survives lease/Texture retirement, visibility/alpha/clips do not suppress it, and cleared content contributes nothing. Preserve maxNodes default 4,096/hard 65,536, receiver-local own/ancestor-transform exclusion, direct descendant-point arithmetic, lifetime/error rules and nonconservative binary64 limitation. Raster suppression must not suppress bounds; do not retransform a child AABB.

## Negotiation, capture and routing — CPU implemented

`createEngineForProfile` first compares the profile literal, rejecting with `ENGINE_RENDER_PROFILE_UNSUPPORTED` without cause or options reads. Then read options.host once (raw throw), and inside one read-fault wrapper read host.texturedFrameProfile, renderTexturedFrame, renderFrame once in order. Read throw becomes `INVALID_RENDERER` with exact cause; complete successful reads before semantics. Validate advertisement first (`ENGINE_RENDER_PROFILE_UNSUPPORTED`, no cause), required new function second and undefined-or-function old port third (`INVALID_RENDERER`, no cause). Read onDiagnostic, then shutdownTimeoutMs once with existing `??1000`/`INVALID_TIMEOUT`, preserving raw getter throws; enter the existing shared surface reservation/start/cleanup/quarantine tail. Negotiation rejection performs no later diagnostic/timeout/surface read, reservation, start or Engine allocation/cleanup. Default createEngine retains its old sequence without new-port reads. Getter reentry effects remain real; surface reservation still decides ownership.

Engine captures ports and calls `Reflect.apply(port, originalHost,[frame])`; later overrides do not reroute. Any Engine can capture a textured frame. Rendering requires the captured new port (`RENDERER_REQUIRED` before frame options), with no old-port fallback. Opted-in Engines retain old capture/render methods and use the captured old port when present. All four frame methods share open/busy (`FRAME_REENTRANT`), renderer-required where needed, width/height/clearColor/clearAlpha reads once in order, completing successful reads before semantics, open rechecks, one safe positive frame-ID stream, freeze/register, port invocation and finally barrier. Ports return undefined; existing result checks and `FRAME_RENDER_FAILED` wrapping remain. Successful freeze consumes the ID even if submission fails.

Legacy capture raises `FRAME_MESH_UNSUPPORTED` for a reached occupied Mesh with nonzero inherited effective alpha, after Graphics/Bitmap but before mesh lease/index reads, even for empty geometry. Existing invisible/own-zero-alpha/empty-clip skips remain; rounded inherited zero and cleared Mesh do not raise this error. First-party Canvas legacy submission rejects every registered new-profile frame with `CANVAS_FRAME_PROFILE_UNSUPPORTED`; legacy WebGPU uses `WEBGPU_FRAME_PROFILE_UNSUPPORTED`, including clear-only/all-rectangle frames, before target/queue/ledger mutation. The implemented new WebGPU port rejects unregistered/proxied/structural frames with `WEBGPU_FRAME_INVALID` without field reads. Existing legacy host guard order remains exact: Canvas checks active state before busy; WebGPU checks busy before active state. Both check their lifecycle guards before new-profile refusal and any legacy input copying. Refusal/preflight faults are nonterminal. Custom-host guarantees apply to Engine negotiation/routing; direct custom-host validation remains its author's responsibility.

New capture uses two synchronous private iterative DFS passes with one child cursor per ancestor, Stage included, authentic live identity/parent/Engine/repeated-node checks and Engine-open rechecks. Pass A visits all hidden/zero-alpha/zero-clip descendants, debits nodes before slots and full primitive counts plus occupied Bitmap/Mesh slots (empty geometry included). Debit each Mesh's complete triangleCount before indices/positions; repeated occurrences count repeatedly, unique logical geometry storage once. It reads no payload/lease/live Texture/transform/clip coordinates and does not validate hidden arithmetic/entitlement. Reject before Pass B if any metadata cap fails.

Pass B emits Graphics → Bitmap → Mesh → children in authored order. Invisible/own-zero/inherited-rounded-zero branches skip before transform/lease work; validate finite transforms/alpha and active clips, then skip zero-extent clip branches. Visible offscreen meshes still validate entitlement and referenced affine results. Geometry table is emitted identities in first-emission order; Pass A storage also charged hidden identities. Source work is not charged twice or refunded. Admit command/clip-reference counts before append/clip flattening; even empty visible geometry emits a mesh command. No callbacks intervene between private slot reads; failed capture publishes no frame/ID/host mutation.

## Capture and explicit GPU capacities

Capture-column limits below are implemented CPU admission rules. The host column, GPU options, submission order and WEBGPU preparation codes are implemented with controlled-host evidence. Native behavior is accepted only for the separately recorded fixed desktop cases. All counters are logical admission units. Safe-integer arithmetic checks remaining capacity before append/iteration/allocation; no overflow, saturation or refund. Only the opted-in host's configurable integers accept 1..hard maximum, defaulting to that maximum; default factories retain old validation/maxima. pixelRatio is finite positive; enableReadback defaults false.

| Counter | Capture cap | Opted-in host default/hard maximum | Charge |
| --- | --- | --- | --- |
| Nodes / authoring units | 65,536 / 65,536 | — | All private metadata, hidden/empty included. |
| Commands / maxCommands | 65,536 | 65,536 | Before append/command scan. |
| Source triangles / maxSourceTriangles | 65,536 | 65,536 | Whole count before indexed work for each occurrence, including zero-alpha/degenerate/singular/clipped. |
| Unique geometries | 128 | 128 fixed | Before next exact identity. |
| Unique geometry bytes / maxFrameGeometryBytes | 16,777,216 | 16,777,216 | Unique logicalByteLength; capture includes hidden identities, host uses emitted table. |
| Clip references / maxClipRectangles | 262,144 | 262,144 | Repeated per-command references before flatten/scan. |
| Prepared vertices / maxPreparedVertices | — | 1,048,576 | Shared rect/image/mesh; 3*(corners-2) before fan append. |
| Robust predicates / maxClipEdgeTests | — | 4,194,304 | Every preparation/packing orientation invocation, including old rect/image work. |
| Mesh polygon corners | — | 64 fixed | Before clipping append; old rect/image cap remains 1,024. |
| Mesh tuple comparisons / maxTupleComparisons | — | 1,048,576 | Each XY/full-attribute pair test, including early mismatch/nested scans. |
| Upload / maxUploadBytes | — | 33,554,432 | Prepared rect*24 + image*16 + mesh*32 +16 per prepared nonempty image/mesh draw. |
| Pending upload / maxPendingUploadBytes | — | 67,108,864 | Same admitted upper bound per pending submission/replay. |
| Pending geometry / maxPendingGeometryBytes | — | 33,554,432 | Unique emitted logical bytes per submission, charged separately across pending frames. |
| Pending frames / maxPendingFrames | — | 2 | One per admitted submission. |
| Backing pixels / maxBackingPixels | — | 16,777,216 | Positive safe-integer ceil(logical edge*pixelRatio), product within cap. |
| Readback / maxReadbackBytes | — | 67,108,864 | ceil(4W/256)*256*H staging +4WH output; shared pending sum. |

Unchanged image limits: source edge 4,096; source pixels 1,048,576; images/frame 64; crop views/frame 128; image table and projected crops each 16,777,216 bytes; scratch and pending texture each 33,554,432 bytes. Projection admission is not refunded by collapse. Independent loaders do not coalesce identity.

Options are captured once: canvas, device, onDiagnostic; pixelRatio,maxBackingPixels,maxCommands,maxClipRectangles,maxPreparedVertices,maxClipEdgeTests,maxUploadBytes,maxPendingUploadBytes,maxPendingFrames,maxReadbackBytes,enableReadback; then maxSourceTriangles,maxFrameGeometryBytes,maxPendingGeometryBytes,maxTupleComparisons. Complete successful reads before semantics. Read policy.kind then policy.device only for borrow; validate canvas/policy/callback before numeric fields in captured order. Read errors use `WEBGPU_OPTIONS_INVALID` with exact cause; semantic causes are TypeError/RangeError. No canvas/GPU call precedes admission. Only opted-in instances own the nonwritable/nonconfigurable advertisement.

Submission order: state/busy/authentic frame → header/backing and command/image/geometry length caps → geometry identity/unique bytes then image identity/bytes → painter-order command kind/source-triangle debit before indices/matrix-alpha-table-crop-clip metadata and all clips → shared polygon preparation → upload upper bound, each maxBufferSize, crop/backing hardware dimensions and readback cap → pending frames/upload/readback/texture/geometry in that order → serial exhaustion → owned Float32 packing/projection copies → active/capacity recheck → serial/ledger/readback reservation and GPU work. Early admitted bounded ordinary tuples may exist; packed buffers/projection payload/GPU allocations wait for their admission. Zero-alpha meshes still perform indexed validation/clip/degeneracy work. Float32 collapse yields no actual draw but no source/projection/prepared/upload refund. Retain geometry and retire geometry/upload/texture/readback exactly once at actual ledger retirement. Shared close/quarantine and borrowed-device authority remain. `getTexturedStatus()` returns frozen `{host:getStatus(),pendingGeometryBytes}`; it independently guarantees neither idle nor device safety.

| Failure | Code |
| --- | --- |
| Authenticity/metadata | WEBGPU_FRAME_INVALID |
| Backing cap / preparation envelope | WEBGPU_BACKING_LIMIT / WEBGPU_GEOMETRY_RANGE |
| Orientation/attributes/intersection/packing precision | WEBGPU_PRECISION_UNSUPPORTED |
| Source/table/clips/prepared/predicate/tuple/upload/configured readback | WEBGPU_FRAME_BUDGET |
| Pending capacity / hardware limits / serial | WEBGPU_BACKPRESSURE / WEBGPU_DEVICE_LIMIT / WEBGPU_SERIAL_EXHAUSTED |
| Capture metadata/output quotas / nonfinite captured transform | FRAME_BUDGET_EXCEEDED / FRAME_TRANSFORM_INVALID |

Resource errors retain Mesh/private entitlement authority. Allocation/copy/GPU failures use existing private source classifications, not caller-spelled public error codes. Failed preflight leaves target/queue/serial/ledger untouched; earlier admitted CPU allocations need not be undone. Upload upper bounds and pending geometry are logical counters, not physical GPU writes/heap measurements.

## Numeric, clipping and pixel model

The existing `robust-predicates` 3.0.3 public orient2d seam supplies conventional sign `-Math.sign(orient2d(...))`; debit before every invocation. Preparation requires finite zero or absolute magnitude [2^-100,2^20], normalizing -0 to +0, for matrix coefficients/referenced local XY/every affine product,sum,translation/backing-ratio result. UV/light remain [0,1]. Validate matrix/clips and all three referenced complete tuples before degeneracy. Linear rank is robust sign of (0,0),(a,b),(c,d), without heuristic epsilon.

| Stage | Decision |
| --- | --- |
| Authored A | A=0 suppresses raster before rounded affine transform; authoredDegenerateTriangles increments. Bounds keeps points. |
| Matrix M | A≠0,M=0 suppresses before transform; singularSuppressedTriangles increments. Local tuple/matrix/clip validation remains. |
| Transformed T | Existing ordered affine then pixelRatio. T=0 increments transformedCollapsedTriangles/skips; T≠A*M rejects precision. T<0 reverses complete tuples to positive backing winding. |
| Clipped polygon | Ordered transformed clips then viewport, preserving XY/UV/RGBA. Empty/all-collinear increments clippedCollapsedTriangles/skips. Inconsistent nonzero convex turns, nonadjacent repeats or equal XY/unequal attributes reject precision. Identical tuples may deduplicate; attribute-carrying collinear points remain. |
| Prepared fan | Reserve 3*(corners-2); preserve tuples. Alpha zero emits none after bounded work. |
| Packed fan | x=fround(2*x/W-1),y=fround(1-2*y/H); UV/light fround. Conventional NDC sign<0 passes, =0 increments packedCollapsedTriangles/skips, >0 rejects precision. Values finite, attributes [0,1]; no quota refund. |

Canonical crossing order/caches preserve complete tuples. With u=abs(det(edge,p)),v=abs(det(edge,q)),sum=u+v, finite 0<t=u/sum<1 uses p+t*(q-p) for every component. If t rounds to 1, compute s=v/sum directly, require finite 0<s≤0.5, use q+s*(p-q); never substitute 1-t. Retain endpoint/finite checks, normalize attribute zero only, reject represented out-of-range attributes rather than clamp. Predicate/corner/tuple work is charged before each operation. Float32 maxBackingDisplacement/maxUVDisplacement/maxLightColorDisplacement describe rounding, with no inherited displacement threshold or result-fitted tolerance. The model is represented binary64/float32, not exact-real affine/intersection arithmetic.

For h=2^-34,T=2^19, authored (0,0),(h,h),(3h,3h) is collinear; translation (T,0) rounds T+h to T and T+3h to T+4h, yielding a transformed determinant -4h². Authored suppression must occur first, while bounds preserves authored point/line content.

Only the explicit host initializes the mesh pipeline. Required device limits: maxVertexBuffers≥1, maxVertexAttributes≥3, maxVertexBufferArrayStride≥32, maxInterStageShaderVariables≥2, plus existing buffer/texture limits; reject `WEBGPU_DEVICE_LIMIT` before target configuration. Float32 stride 32 is XY/UV/lightRGBA at locations 0/1/2; two varyings are vec2 UV and vec4 straight light. CPU clipping expands indexed input to nonindexed ordered GPU triangle lists. For encoded-premultiplied nearest sample S, straight interpolated light L=(r,g,b,A), opacity O: RGB=S.rgb*L.rgb*A*O, alpha=S.a*A*O, then premultiplied normal source-over. No linear-light/sRGB-decode switch. Only adjacent rectangle runs batch; intervening images/meshes remain barriers even with zero output. Preserve authored triangle order.

Fixed first-party native fixtures have independently reviewed rational/literal expectations, channels/sample points/coverage criteria and tolerances, with calibration separated from held-out confirmation. They cover texture alpha 0,1,127,128,254,255, tint/opacity, nearest edges/gradients, reversed order, transformed clips, complementary-weight adversaries, degeneracy and nonidentity pixelRatio. The unchanged comparator passed 208/208 CPU units. Later native observations and all 12 copied-production sensitivity controls passed in the recorded desktop environment. Shader strings, fake devices, synthetic byte arrays and older alpha observations do not establish new mesh pixels or whole-A2 acceptance.

## Source and acceptance boundary

First-party specification and public documentation were prepared with AI assistance. Geometry admission explicitly reuses the existing first-party ImageData2D intrinsic pattern; Mesh/resource/frame/bounds/host lifetime integration builds on existing first-party mechanisms, and private full-tuple clipping retains their complementary-weight transport. First-party code/docs remain Apache-2.0. The existing external `robust-predicates` 3.0.3 dependency remains Unlicense; no new dependency or copied upstream implementation is introduced by this design/document preparation. This is scoped attribution, not a certification of global originality or training provenance. Actual implementation reuse must be recorded from the reviewed final source.

See the [geometry/Mesh evidence](textured-geometry-and-mesh2d-evidence.md) and [profile CPU evidence](textured-profile-cpu-evidence.md) for implemented, reviewed, accepted and pending checkpoints. CPU acceptance alone does not establish drawable Mesh2D, Spine runtime, complete A2/3D/UI/fonts, physical phones, performance, production-host support, full migration or publication.

The accepted geometry implementation creates canonical numeric slots as own properties through a captured intrinsic, with a null-prototype descriptor. A descriptor getter installing an inherited Array numeric setter cannot swallow these writes; this bounded regression is verified. It is not general hostile-intrinsic protection.

An isolated exact-dyadic arithmetic check also confirms a packing sign-reversal witness for a 16×16 backing: P=(12,4), Q=(12+2^-21,4-95·2^-27), R=(12+2^-20,4-161·2^-27). Conventional determinants are +29·2^-48 in backing space, -29·2^-54 before NDC rounding, and +2^-48 after Float32 NDC rounding. This justifies an explicit rejection fixture. It executes no product packer, clipping or GPU pixels.
