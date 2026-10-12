# Experimental public scene frames and ordered UI composition

English | [简体中文](../../Cns/docs/公共3D场景契约.md)

Proposed documentation checkpoint **0.32.0**, package **S3D1**. Source **S085** and delivery **V036** are reserved for enrollment; their availability was verified, and registration and acceptance remain pending. This independently designed interface exposes the current first-party owned geometry, scene capture and browser Host algorithms through small typed forwarders. First-party code and documentation remain Apache-2.0; no dependency is added. Workspace packages remain private `0.0.0`, protocol `1.0`.

The delivered **0.31.0** resource-group successor was merged through [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) to Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`, tree `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`. On that base, the genuine baseline preceded a missing-map interface **RED** at **2026-10-11 19:43:55 UTC**. The three public product files were adopted, built and checked for interface **GREEN** at **2026-10-11 19:54:25–19:54:26 UTC**. Independent source review found **0** open findings in those files. These observations confirm the bounded source and public API reachability only. **Behavior, types, policy, native and final gates are PENDING.** The [shared verification record](../../evidence/scene3d-public-verification.json) is the designated evidence destination; its publication and completed gate results are pending. Historical internal scene and browser results retain their original subjects and cutoffs.

<!-- MATRIX4-DOC-0.38.0-BEGIN -->
## 0.38.0 proposed — public Matrix4 authoring and composition

**SOURCE_ONLY / NOT_RUN. S091 / V042** proposes additions to `@egret/engine/scene3d`. The existing scene interfaces and historical export inventories below retain their original checkpoints. The proposed functions use typed public wrappers, pass untouched arguments exactly once to the existing first-party implementation, and return its exact result or propagate its exact thrown value. The diagnostic value and type retain their original module bindings; the default engine and browser Host entries gain no matrix export from this proposal.

```ts
function createMatrix4(input: readonly number[]): Matrix4;
function multiplyMatrix4(left: Matrix4, right: Matrix4): Matrix4;
export { Math3DError };
export type { Math3DErrorCode };
```

`Matrix4` uses column-major storage and column vectors. `multiplyMatrix4(left, right)` computes `left * right`, so the right transform acts first. `createMatrix4` accepts an ordinary Array of exactly **16** own slots with finite number values. Typed arrays, missing or inherited-only slots and nonfinite values are refused without coercion. Both functions publish fresh, frozen, owned binary64 tuples and normalize negative zero to positive zero; caller storage is not retained or written.

Capture reads own slots in order before component validation. Multiplication completes the left capture before the right capture; aliased operands are captured separately. Caller getters/proxies can affect subsequent reads, so this is ordered capture rather than a simultaneous snapshot. Arithmetic checks the original fixed products and sums for finite range; cancellation does not repair intermediate overflow. `Math3DError` preserves the original code/cause behavior for input, source-read, arithmetic-range and owned allocation/publication failures. The public facade adds no error wrapping. Its existing error-code union includes other math operations and does not promise that every code is reachable through these functions.

The public tuple type and diagnostic constructor do not authenticate provenance by themselves. Binary64 results promise neither exact-real arithmetic nor float32 representability; existing scene precision admission remains a later boundary.

### Proposed authoring example

The following unexecuted example takes `readonly number[]` inputs through `createMatrix4`, composes them with `multiplyMatrix4`, and supplies the result to existing scene capture without a caller type assertion. It creates a CPU frame and starts no Host. Scene capture still applies its own authenticity, precision and budget admission; successful matrix construction alone does not guarantee that all finite matrices are scene-admissible.

```ts
import {
  createMatrix4, multiplyMatrix4,
  createMeshGeometry3D, createSceneFrame3D
} from '@egret/engine/scene3d';
import type { Matrix4, SceneFrame3D } from '@egret/engine/scene3d';

const parentSource: readonly number[] = [
  0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
];
const localSource: readonly number[] = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1
];
const parent: Matrix4 = createMatrix4(parentSource);
const local: Matrix4 = createMatrix4(localSource);
// Column vectors: local acts before parent.
const modelView: Matrix4 = multiplyMatrix4(parent, local);
const geometry = createMeshGeometry3D({
  positions: [0, 0, -1, 1, 0, -1, 0, 1, -1],
  colors: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 1, 2]
});
const scene: SceneFrame3D = createSceneFrame3D({
  projection: {
    kind: 'orthographic',
    left: -1, right: 1, bottom: -1, top: 1, near: 0, far: 2
  },
  draws: [{ geometry, modelView }]
});
void scene;
```

Implementation, actual RED/GREEN, public-route behavior and strict types, updated export/guard inventories, retained math/scene regressions, current full gates and delivery are **PENDING**. Clock **0.37.0** delivery remains **PENDING at this preparation cutoff**. Browser gates are required if rendering behavior changes; the proposed forwarding change leaves rendering algorithms and existing scene precision gates unchanged. No inverse/vector API, camera system, new dependency, performance result or complete scene/Spine capability is added. Existing first-party code/documentation remains Apache-2.0.

**Recorded delivery successor:** Clock **0.37.0** was merged through [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24), with Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` read back locally and remotely. This supersedes the earlier delivery checkpoint without rewriting it and establishes no Matrix acceptance or remote CI PASS.
**Actual 0.38.0 successor:** the old public SDK passed **17** retained cases and refused **4** new cases at the named missing-API assertion; its positive type consumer reported **4** missing exports. The newly built SDK passed **168/168** retained math, projection, scene and public cases, including **21/21** public cases. The positive consumer compiled; **11** intentional import negatives were bound to actual diagnostics, and exact boundary/strict-type gates passed with **0** unexpected failures. Original math algorithms remain unchanged. No new GPU, device or performance acceptance is claimed. Independent source/bilingual review, the full repository gate and delivery remain PENDING at this successor cutoff. See [the shared verification record](../../evidence/public-matrix-authoring-verification.json).
<!-- MATRIX4-DOC-0.38.0-END -->

## Explicit modes and package entries

| Entry | Bounded role |
| --- | --- |
| `@egret/engine/scene3d` | DOM-free owned geometry and scene-frame authoring; no browser Host creation. |
| `@egret/engine/webgpu/scene3d` | Explicit browser scene Host, with existing ordered screen-space UI composition. |
| `@egret/engine/webgpu` | Existing ordinary WebGPU Hosts; base Host types remain here. |
| `@egret/engine/web` | Existing Canvas route. |
| `@egret/engine` | Existing Engine, Stage and lifecycle APIs. |

Only the two scene subpaths add scene exports. Public examples and behavior checks consume built package entries. Importing the scene route does not itself request an adapter, device or context, start a Host or clock, fetch a resource or schedule work. Rendering and game time stay explicit. Emitted import closure, default-root/Canvas isolation and ordinary Host surface checks remain pending; this contract alone is not an observed loader result.

The package maps are exact:

```json
"./scene3d": {
  "types": "./dist/rendering/scene3d.d.ts",
  "import": "./dist/rendering/scene3d.js"
},
"./webgpu/scene3d": {
  "types": "./dist/web/scene3d.d.ts",
  "import": "./dist/web/scene3d.js"
}
```

## Exact exported API

The CPU scene entry has **8** runtime exports, in this order:

```ts
createMeshGeometry3D, isMeshGeometry3D, MeshGeometry3DError,
getMeshGeometry3DErrorOrigin,
createSceneFrame3D, isSceneFrame3D, Scene3DError,
getScene3DErrorOrigin
```

Its **12** type-only exports are:

```ts
Matrix4, MeshGeometry3DInput, MeshGeometry3D,
MeshGeometry3DErrorCode, MeshGeometry3DErrorOrigin,
SceneProjectionInput3D, SceneDrawInput3D, SceneInput3D,
SceneDraw3D, SceneFrame3D, Scene3DErrorCode, Scene3DErrorOrigin
```

The authoring and capture signatures are:

```ts
interface MeshGeometry3DInput {
  readonly positions: readonly number[];
  readonly colors: readonly number[];
  readonly indices: readonly number[];
}
function createMeshGeometry3D(input: MeshGeometry3DInput): MeshGeometry3D;
function createSceneFrame3D(input: SceneInput3D): SceneFrame3D;
type Matrix4 = readonly [number, number, number, number,
  number, number, number, number, number, number, number, number,
  number, number, number, number];
interface SceneProjectionInput3D {
  readonly kind: 'perspective' | 'orthographic';
  readonly left: number; readonly right: number;
  readonly bottom: number; readonly top: number;
  readonly near: number; readonly far: number;
}
interface SceneDrawInput3D {
  readonly geometry: MeshGeometry3D;
  readonly modelView: Matrix4;
}
interface SceneInput3D {
  readonly projection: SceneProjectionInput3D;
  readonly draws: readonly SceneDrawInput3D[];
}
interface SceneDraw3D {
  readonly geometry: MeshGeometry3D;
  readonly mvp: Matrix4;
}
interface SceneFrame3D {
  readonly draws: readonly SceneDraw3D[];
  readonly geometries: readonly MeshGeometry3D[];
  readonly cpuLogicalBytes: number;
  readonly sceneBytes: number;
  readonly uniformBytes: number;
}
```

`MeshGeometry3D` retains readonly owned `positions`, `colors`, `indices`, `vertexCount`, `indexCount` and `logicalBytes`. Each CPU forwarder makes one direct synchronous factory call with untouched input and returns the exact result or propagates the exact thrown value. Predicates, error constructors and origin functions retain their original module bindings. No wrapper pre-read, clone, coercion, cache or error reclassification is introduced.

The browser entry has **1** runtime export, `createSceneWebGPUHost`, and **3** type-only exports, `SceneWebGPUHostOptions`, `SceneWebGPUHostStatus`, `SceneWebGPUHost`:

```ts
import type { RenderFrame2D } from '@egret/contracts';
import type { SceneFrame3D } from '@egret/engine/scene3d';
import type {
  WebGPUHost, WebGPUHostOptions, WebGPUHostStatus
} from '@egret/engine/webgpu';
type SceneWebGPUHostOptions = WebGPUHostOptions;
interface SceneWebGPUHostStatus {
  readonly host: WebGPUHostStatus;
  readonly pendingSceneBytes: number;
  readonly pendingUniformBytes: number;
  readonly pendingDepthBytes: number;
}
interface SceneWebGPUHost extends WebGPUHost {
  renderSceneFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined;
  getSceneStatus(): SceneWebGPUHostStatus;
}
function createSceneWebGPUHost(options: SceneWebGPUHostOptions): SceneWebGPUHost;
```

The browser factory returns the current first-party scene Host directly. Its declaration dependencies are the public scene facade, public base Host facade and contracts; there is no public packing function, protocol getter, supplied encoder, shader callback, authenticity brand or mutable GPU buffer API.

## Authentic immutable capture

Runtime geometry input uses actual ordinary Arrays and own slots; readonly annotations do not admit typed arrays or arbitrary iterables. Cross-realm ordinary Arrays follow the retained factory policy. The factory captures positions, colors and indices into dense owned binary64 arrays, validates them and freezes the arrays and wrapper. It retains no caller storage. Scene capture owns fresh frozen draw wrappers, MVP tuples, draw arrays and first-seen geometry arrays; it shares only already owned immutable geometry identities. Every successful call, including an empty scene, returns a fresh value.

Private WeakMap authentication is registered after successful publication. Matching fields, copies, proxies and TypeScript structural compatibility cannot confer authenticity. Predicates do not read caller fields. Geometry identity is charged once per scene; each draw retains its own uniform charge. Equal-valued distinct geometry identities remain distinct. Host packing is once per geometry per frame, with no lifetime-wide geometry cache.

Geometry errors are `MESH3D_INPUT_INVALID`, `MESH3D_INPUT_READ_FAILED`, `MESH3D_BUDGET`, `MESH3D_NATIVE_FAILED`. Scene errors are `SCENE3D_INPUT_INVALID`, `SCENE3D_INPUT_READ_FAILED`, `SCENE3D_BUDGET`, `SCENE3D_PRECISION_UNSUPPORTED`, `SCENE3D_ARITHMETIC_RANGE`, `SCENE3D_NATIVE_FAILED`. Registered origins are `validation`, `budget`, `source`, `native`; a consumer-created error has no registered factory origin. Source causes and thrown identities are retained. Here CPU `native` means an owned JavaScript/intrinsic failure. Real OOM or permanent intrinsic poisoning has no universal recovery guarantee.

## Camera, geometry and numeric profile

Authoring follows right-handed coordinates, +Y up, meters and camera local -Z. The caller supplies camera-space `modelView = view × model`; the frame computes `mvp = projection × modelView`, using column-major storage and column vectors. There is no implicit camera inversion, transpose, perspective divide, Y flip or FOV conversion. Frustum bounds are `left/right/bottom/top`; perspective bounds are on the near plane and require `near > 0`, while orthographic permits `near = 0`. Both require ordered bounds and `far > near`.

Depth is reversed zero-to-one: near maps to **1**, far to **0**. Raw homogeneous w is preserved, including zero/negative values; CPU capture does not reject visibility or perform clipping. Screen UI uses independent logical pixels, top-left origin, +X right and +Y down, retaining its existing transform, alpha, order and local-clip contract.

XYZ and RGB arrays have equal lengths divisible by **3**; triangle-index length is divisible by **3** and all indices are in-range safe integers. Empty geometry has `V=I=0`; otherwise `V>=3` and `I>=3`. Positions are finite binary64 and RGB is in `[0,1]`; `-0` normalizes to `+0`. Counts and complete quotas precede payload scratch/index reads; the source arrays are captured before semantic validation.

Geometry capture and the scene rendering precision gate remain distinct. The scene profile requires every geometry XYZ/RGB value and final MVP coefficient to be zero or an exact finite normal f32: nonzero magnitude `2^-126 .. (2-2^-23)*2^127` and `Math.fround(x) === x`. Model-view input may be finite binary64, while the final MVP must satisfy that profile. The fixed row/vertex absolute-product sum `((p0+p1)+p2)+p3` must be finite and at most `2^120`. Operation order and failure precedence are retained, with no epsilon or rounding fallback. Many ordinary asset/camera values are deliberately refused; this is a limited procedural profile, not a general asset precision or conditioning guarantee.

## Logical admission budgets and draw rules

| Subject | Bound |
| --- | --- |
| Geometry vertices / indices | `V <= 65536`, `I <= 196608` |
| Geometry logical bytes | `8*(6*V+I) <= 4194304` |
| Scene draws / first-seen geometry identities | `N <= 64`, identities `<= 64` |
| Scene CPU logical geometry / packed payload | `<= 8388608` / `<= 4194304` bytes |
| Scene uniforms | `64*N <= 4096` bytes, including empty draws |
| Default frame / pending upload | `33554432` / `67108864` bytes |
| Default pending frames / readback | `2` / `67108864` bytes |
| Outstanding scene payload / uniforms | `8388608` / `8192` bytes |
| Logical per-frame / pending depth | `16777216` / `33554432` bytes, using `4*backingWidth*backingHeight` |
| Small readback charge | `1*1` pixels require `260` bytes for aligned staging plus output |

Configured UI, backing-size, device-buffer and readback bounds also apply. These are logical admission budgets; they are not measurements of physical memory, reclamation or performance. Draw and identity caps couple some byte witnesses: an independent uniform overflow and an extra geometry identity cannot be observed beyond the draw cap, and defensive packing branches unreachable from authentic admitted values are not counted as observed coverage.

The fixed mesh layout is triangle-list, XYZ float32x3 at offset **0**, RGB float32x3 at offset **12**, stride **24**, uint32 indices and one **64**-byte column-major uniform per draw. Output is opaque RGB; CCW, cull none and sample count **1** are fixed. Depth32float clears to **0**, compares `greater`, writes depth and uses zero bias. Caller draw order is preserved; strict-greater equal-depth behavior keeps an already covered earlier draw. This defines no transparent sorting or cross-device triangle-edge rule.

## Ordered composition and Host ownership

`renderSceneFrame(scene, overlay)` requires an authentic scene before field reads and an ordinary immutable `RenderFrame2D` overlay with `clearAlpha === 1`. A textured-profile frame is not a substitute. The complete scene/UI plan, identity charges and device limits are admitted before GPU/serial/ledger commitment. The scene pass clears and stores with reverse depth; the UI pass loads and stores without depth; readback follows both pass ends. They use one target view, encoder, finish and submission. Existing rectangle/image painter order and local clips are retained. Prepared TF1 text images follow the ordinary image-command route, while native font-plus-scene verification remains pending.

The intended bounded application combines procedural opaque meshes with existing ordered screen UI. It does not accept the complete complex-UI product scope. The Host inherits current options, start/stop/close/whenIdle/readback/status behavior and WebGPU errors. Temporary upload, uniform, depth, UI and readback resources remain Host-owned until observed settlement. Attempted queue work receives a fence even when submission fails; unsafe retirement retains ledgers and follows current close/quarantine reporting. A borrowed GPUDevice remains caller-owned. An Engine-created Host is disposed through `engine.dispose()`; a standalone Host uses `host.close()`. Immutable CPU values may be shared and expose no geometry disposal or GPU object. Device loss ends the current execution; creating a fresh Host is not accepted automatic recovery.

## Exact pending verification assertions

The following rows are obligations awaiting actual evidence. Their status is **PENDING**; they are not passing results or predicted test totals.

| Gate | Bounded assertions to bind to actual results |
| --- | --- |
| Public behavior | Callable lookalike RED must fail `authentic-public-geometry` and `authentic-public-scene`; a scene-free Host substitute must fail scene-method/composition assertions. GREEN must use actual public factories for readonly owned capture, caller mutation isolation, predicate/error/origin identity, one-read getter and throw preservation, identity accounting, raw w, literal projection/MVP, numeric/budget refusal, pre-GPU admission and settled lifecycle/ledgers. |
| Public types | Positive DOM-free scene use, DOM-enabled scene Host and a SceneWebGPUHost supplied to createEngine. Exact unsuppressed diagnostics for typed-array input, invalid projection kind, a **15**-component model-view tuple, missing projection/geometry, readonly mutation, invalid overlay, wrong public entry/private imports and browser Host use without DOM. |
| Policy and evaluation | Exact scene export inventories and public declaration references; unchanged default root, Canvas and ordinary WebGPU surfaces; literal emitted/evaluation closure, no import-time GPU request or automatic work, and retained private-authority guards. |
| Native baseline and controls | Fresh public-route **F1–F7** and **N1–N5** evidence: **7** baselines, **5** intended negatives, **11** renders and **8214** baseline comparisons. **N4** must retain the real WGSL error, async validation rejection, startup failure and zero submission; other controls must expose their named wrong-color literals. |
| Supplementary Engine composition | Separate **S1**, **S2**, **SN1** at **64*64**, DPR **1**, with **2** supplementary baselines and **1** control. Genuine Stage/Sprite/Bitmap capture and one Engine/Host pair must preserve the independently authored overlay; these cases do not inflate the baseline schedule. |
| Final acceptance and delivery | Affected regression identity assessment, complete verify/prepush at final bytes, independent specification/quality and bilingual review, current evidence enrollment and separately authorized delivery. |

For the supplementary cases, draw order is red then blue; the fixed orthographic frustum is `left=-1,right=1,bottom=-1,top=1,near=1,far=9`, with identity model-view. Red spans magnitude **0.5** at z **-3**; blue spans magnitude **0.75** at z **-7**. Both MVPs are `[1,0,0,0,0,1,0,0,0,0,0.125,0,0,0,1.125,1]`, with red depth **0.75** and blue **0.25**. Each geometry has **4** vertices/**6** indices, CPU **240** and packed **120** bytes; the two identities/draws charge CPU **480**, scene **240**, uniforms **128**. The constant opaque magenta image is **2*2**, scaled by **4** to **8*8**. Opaque black clear and exact display transforms/order remain fixed independently of Engine capture.

**S1** preserves white at **(22,24)**, magenta at **(29,30)**, green at **(31,32)**, red at **(17,18)**, blue at **(10,12)** and opaque black at **(4,4)**. **S2** adds parent local clip `{x:0,y:0,width:4,height:8}` at **(28,28)**: inside **(29,28)** is magenta and outside **(33,28)** is white. **SN1** omits only that clip and must select the outside assertion first, exposing actual magenta `[255,0,255,255]` against expected white `[255,255,255,255]` at **(33,28)**. Setup/import or unrelated earlier failure is not this control. The shared record must bind complete frozen fixture inputs, raw RGBA, environment, source/build identities, actual controls and observed cleanup; unsupported or incomplete execution is not PASS.

## Product boundaries and next work

This experimental frame route adds no mutable scene graph, camera pose/inversion helper, material hierarchy, lighting, glTF importer, transparent sorting, skinning, character system, Spine integration, resource-group coupling, implicit clock or automatic rendering. The broader creator, complete UI/3D, animation, editing, migration and publishing requirements remain in the [engineering plan](engineering-plan.md). Browser graphics evidence, Native SDK acceptance, phones, target-device performance and physical precision/reclamation each require their own evidence. No performance advantage, general asset compatibility or production readiness is claimed.

[Historical foundation](3d-foundation.md) · [Core progress](core-progress.md) · [Knowledge base](../README.md)

### 0.32.0 observed verification successor

The earlier PENDING rows retain their original cutoff. Current public behavior passes **35/35** checks; four genuine-baseline-first substitutions reach five assigned authenticity/method assertions. The direct strict checker accepts two positive consumers and **10 + 3 + 11 + 15** exact unsuppressed diagnostics. A real duplicated diagnostic receipt exposed a coverage gap; complete one-to-one tuple matching now passes the valid compiler record and refuses three assigned malformed records. All **238/238** boundary checks pass, including the retained controls and sixteen new mutations.

Fresh default headless Edge **154.0.4258.62** / Playwright **1.62.1** passes the unchanged **7/5/11/8214** baseline schedule and separate **2/1/3/14** Engine composition schedule. Independent review rechecks fourteen raw RGBA buffers against authored literals; these totals overlap CPU/source coverage and are not summed. The interactive example itself remains **PENDING**. Complete publication, final bilingual review, mandatory push hook and 0.32.0 delivery remain pending at this metadata cutoff. Phone/Native SDK/font performance, full UI/3D/Spine and production acceptance remain separate. The shared [verification record](../../evidence/scene3d-public-verification.json) binds exact inputs, actual failures and successors.

### 0.32.0 retained integration successor

The complete publication run passed its 63 publication checks but exposed two retained integration obligations (2497/2499 core checks). The copied-package fixture now preserves the identity of its two scene modules; the collector restores the exact internal source mappings. Existing negative controls, the S01 test, product algorithms and original pixel oracle remain unchanged. Targeted regression checks and fresh default headless Edge verification pass after these source-reviewed changes, with independent saved-evidence review. Earlier failures and cutoffs remain in the shared verification record. The final complete publication run and current delivery remain pending at this successor cutoff.
