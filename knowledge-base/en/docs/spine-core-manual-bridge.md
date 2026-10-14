# Spine Core manual mesh bridge

English | [简体中文](../../Cns/docs/SpineCore手动网格桥接.md)

Engineering preview **0.47.0** · **S101 / V052**. F2-C is an optional development experiment connecting Egret's owned resources and display tree to the externally supplied official Spine Core **4.3.13** runtime. It advances the previously admitted [F2-B source profile](spine-linear-profile-contract.md) from source planning to finite manual pose sampling. [Verification and open work](spine-core-manual-bridge-evidence.md) describe its actual acceptance cutoff. Complete Spine **R020/V020** and migration **R008/V006 remain OPEN**.

## Entry and public API

After its standalone build, use `knowledge-base/experiments/spine-f2-core/dist/index.js`. This experiment is separate from the default engine, runtime and project entries; those entries gain no Spine Core export or dependency. Its complete public namespace contains one runtime value, `createF2CoreResources`, and four erased types: `F2CoreCreateOptions`, `F2CoreResources`, `F2CoreInstanceState` and `F2CoreInstance`.

```ts
createF2CoreResources(
  engine: Engine,
  resourceScope: Scope,
  options: F2CoreCreateOptions,
): Promise<F2CoreResources>;

interface F2CoreCreateOptions {
  readonly input: SpineImportInput;
  readonly pageRef: AssetRef<Texture>;
}

interface F2CoreResources {
  readonly isDisposed: boolean;
  createInstance(instanceScope: Scope, animationName: string): F2CoreInstance;
  dispose(): void;
}

type F2CoreInstanceState = 'live' | 'failed' | 'disposed';

interface F2CoreInstance {
  readonly display: DisplayObjectContainer | undefined;
  readonly state: F2CoreInstanceState;
  readonly sampleTimeSeconds: number;
  sampleAt(seconds: number): void;
  dispose(): void;
}
```

The factory accepts the original public `SpineImportInput`, creates a fresh qualified F2-B result, and retains owned source text. Caller-created plans do not confer admission. `options` must have ordinary own data descriptors for exactly `input` and `pageRef`; getters are not invoked. Descriptor operations may trigger Proxy callbacks, so the genuine resource Scope is rechecked after each operation, including a throw. Scope closure wins over the subordinate input observation.

The page reference's exact asset ID must match the admitted atlas page. One genuine `engine.createAssetGroup(resourceScope, [pageRef], { concurrency: 1 })` acquires one genuine full-image Texture lease. Engine/Scope affinity, page dimensions, full crop, disposal state and the public ImageData2D profile are checked. Accepted pixel data is RGBA8, sRGB, straight alpha and top-left origin, with exact `width × height × 4` logical bytes. No structural imitation establishes Texture or lease authority. The dimension-only Core texture wrapper never owns the page or a GPU texture.

## Manual sampling and display ownership

Resources admit at most **two resident instances**, including failed instances until explicit disposal. An instance Scope must belong to the same genuine Engine. `animationName` matches an admitted source name exactly. Construction publishes a genuine Scope-owned DisplayObjectContainer containing one genuine Mesh2D, initially sampled at time zero. Attach the returned root to the Engine Stage and use normal root transforms; rendering does not advance time.

`sampleAt(seconds)` is synchronous and absolute: a primitive finite time in **[0, source duration]**, where the inherited source duration is at most **60 seconds**. It supports forward, repeated and backward sampling. There is no Clock subscription, timer, RAF loop, animation mixing or AnimationState interface. Applications own scheduling explicitly.

For the qualified official version, each sample starts from setup pose, applies the named animation with setup mixing parameters and no loop, updates world transforms with `Physics.none`, then asks Core's renderer for its 2D command. Egret independently validates and copies that command into public owned `TexturedGeometry2D`; it does not implement Core's pose or deform algorithms. The bridge keeps Core's `Skeleton.yDown === false` premise without mutating the global setting and performs exactly one Y inversion while copying positions.

The admitted command has one page, normal blending, a null next command, white light colors, zero dark colors and at most **4096 vertices / 12288 indices**. Used native arrays must have exact types and lengths; finite positions, normalized UVs, counts and index ranges are checked. Geometry publication replaces the Mesh content only after the entire copy succeeds. No public geometry retains a Core command, pooled storage or Core object. Previously captured geometry and Engine frames remain immutable when later sampling occurs.

The root's child structure, the mesh identity and its content/lease binding are owned by the bridge. Caller mutation is refused with `DISPLAY_MUTATED`; this is a functional ownership check, not process or adversarial isolation. The sampling guard is acquired before callback-capable display validation: nested sampling is refused with `F2C_SAMPLE_REENTRANT`, and the guard is released on every path.

## Failure and retirement

Invalid input before a Core call keeps a live instance and its previous committed geometry/time. An unexpected failure after Core is touched makes the instance `failed`, retains the last committed frame, and refuses later sampling. A failed instance still occupies one of the two resident slots until disposal. Scope/resource retirement makes the instance `disposed` and removes its exposed display; repeated disposal is inert.

Retirement publishes terminal state before callbacks, retires instances, disposes the atlas/wrapper, and releases the genuine asset group. Resource Scope registration follows the group so reverse Scope cleanup retires the facade first. Engine asset management and the provider retain page-disposal authority. Construction rollback does not publish a partially initialized facade. Original initiating causes and ordered secondary cleanup errors remain separate; cleanup does not replace the original failure.

## Use and reproduce

Build the ordinary repository and the retained F2 experiment with the pinned tools first. Supply an existing official Core 4.3.13 installation with the exact recorded bytes, and configure its resolution only in this optional experiment. The runner installs nothing and creates no aliases. Obtain and use upstream software only under its applicable license.

```text
node knowledge-base/experiments/spine-f2-core/run.mjs --help
node knowledge-base/experiments/spine-f2-core/run.mjs --spine-core <existing-official-package-directory> --output <fresh-directory-outside-repository>
```

Help reports the command interface without starting compilation, type, pose or browser work. The ordinary runner records source/tool/SDK identities, standalone compilation, actual unsuppressed type diagnostics, genuine F2C00 prerequisites, the public namespace and ten CPU case IDs. A failed prerequisite executes zero main cases. Optional resource, callback, fault and browser observers have separate records and counts; they are not included in the main ten-case total.

A schematic application sequence, after providing a genuine Engine, resource/instance Scopes, original input and registered page reference, is:

```ts
const resources = await createF2CoreResources(engine, resourceScope, {
  input,
  pageRef,
});
const instance = resources.createInstance(instanceScope, 'bend');
const display = instance.display;
if (display === undefined) throw new Error('Instance was retired');
engine.stage.addChild(display);
instance.sampleAt(0.5);
// Capture or render explicitly through the selected Egret host.
instance.dispose();
resources.dispose();
```

`bend` and `0.5` refer to the original one-second fixture, not every admitted input. Application shutdown also closes the Engine and any asynchronous provider according to their own contracts.

### Optional browser collection

The revised native collector has its own input qualification and acceptance lane. Its source interface is:

```text
node knowledge-base/experiments/spine-f2-core/native/verify.mjs --admission <absolute-reviewed-input-json> --output <fresh-absolute-directory-outside-repository>
```

Collection requires an independently reviewed original input binding before it exposes its bounded loopback server or launches a browser. The binding record has exactly `schemaVersion: 1`, `kind: 'F2C_NATIVE_EXACT_INPUT_BINDING_RECORD'`, `status: 'ORIGINAL_INPUTS_BOUND_FOR_INDEPENDENT_REVIEW'` and `inputs`. The thirteen `inputs` keys are `repositoryRoot`, `repositoryPins`, `sdkRoot`, `sdkPins`, `readerProjection`, `reviewPins`, `runtimePins`, `nodeExecutable`, `playwrightEntry`, `edgeExecutable`, `playwrightCorePackage`, `playwrightCoreBundle` and `evidencePins`. Each complete value and array order must match admission; repository paths retain full owner-relative case and SDK/emitted/original-evidence bytes are pinned exactly.

Admission additionally carries exact `inputBindingPin` and `inputBindingReviewPin`. The independent binding review has exactly `schemaVersion`, `kind`, `verdict`, `openFindings`, `findings`, `bindingRecordPin`, `checkedInputKeys`, `currentInputsMatch` and `reviewedEvidencePins`; it must report `PASS_EXACT_F2C_NATIVE_INPUT_BINDING_ONLY`, zero open findings, an empty findings array, the exact binding pin, all thirteen sorted input keys, `currentInputsMatch: true` and the exact original evidence list. Nonempty findings, absent/extra keys or substituted records are refused. Commentary may be retained separately, never inserted into this closed schema.

Evidence pins have exactly `{ role, pin }`, with all three roles `nativeSource`, `coreActual` and `controlsActual` present; 3..512 entries are allowed without duplicate role/full-path pairs. This binds accepted source and genuine prior execution instead of a drafted outcome. The actual installed Playwright 1.62.1 / playwright-core 1.62.1 package, exported core bundle and selected default `msedge` executable are also pinned. Channel resolution is checked before and after the ordinary headless launch, with no extra flags or replacement executable.

The frozen browser fixture uses a genuine original PNG provider, Engine, resource/instance Scopes and the public bridge with an explicit textured WebGPU host. It targets 64 × 48 at DPR 1, literal pixel observations, movement/repeat and old-frame ownership. The decoded PNG page is straight-alpha ImageData2D; GPU source readback is premultiplied. The opaque literal fixture does not qualify alternate alpha modes or translucent precision. Its module serving uses a closed bounded dependency graph, including only the exact recorded jsonc-parser extensionless routes. Canvas textured-mesh refusal remains separate. This documents the revised collector's source contract; actual input/browser acceptance is governed by the [evidence cutoff](spine-core-manual-bridge-evidence.md), not by the existence of this interface. No captured adapter information qualifies GPU identity or performance.

## Profile, provenance and remaining work

F2-B's full source limits remain authoritative: one page, a single default skin, static unweighted meshes/regions, translation-only setup and linear translate/deform timelines. The bridge deliberately refuses incompatible official-runtime structures or commands. Weighted/linked meshes, attachment switching, constraints, physics, events, tint/dark color, packing/rotation, curves, animation mixing and full export-version compatibility have no acceptance here. The finite numerical oracle is not a universal error bound for all admitted profiles.

Egret's adapter, resource/display ownership logic, controls and programmatically authored fixture/oracle are first-party **Apache-2.0** work. The external `@esotericsoftware/spine-core` **4.3.13** dependency uses the [Spine Runtimes License](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/LICENSE). The [official source](https://github.com/EsotericSoftware/spine-runtimes/tree/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core), [runtime licensing guidance](https://esotericsoftware.com/spine-runtimes-license) and [Editor license](https://esotericsoftware.com/spine-editor-license) explain the applicable upstream terms. Entitlement is **unknown** and distribution clearance **unverified**. This repository bundles no Core SDK, upstream animation assets or supplied historical projects. Research attribution does not establish permission to redistribute another artifact.

Real-device performance, fonts, mobile/native SDKs, platform hosts, full UI composition and complete Spine remain separate engineering work.
