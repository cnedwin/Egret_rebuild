# Resource acquisition groups

English | [简体中文](../../Cns/docs/资源批量获取.md) · [Resource core](resource-core-implementation-record.md)

Recorded engineering checkpoint **0.31.0** · Workspace packages **0.0.0**, private · Protocol **1.0**, unchanged · Experimental CPU slice. Document date: **2026-10-12**. Evidence cutoff: **2026-10-11 18:50:31 UTC**.

RG1 gives a resource-backed scene one bounded acquisition owner. The recorded build and two-texture CPU example passed, together with **86/86** combined CPU checks (**29** RG1 and **57** retained resource/lifecycle checks). Earlier private strict types and the corrected **35/35** finite policy controls also passed. Seven existing browser profiles passed within their recorded limits; they do not exercise a group-based browser application. Complete current checks, bilingual/publication review, the mandatory push hook and RG1 remote delivery were **PENDING** at that evidence cutoff. These checkpoint numbers do not announce an npm release.

## API and use

RG1 adds one Engine instance method and three engine-root **type-only** exports: `AssetGroup`, `AssetGroupState`, `AssetGroupOptions`.

```ts
createAssetGroup<T>(
  scope: Scope,
  refs: readonly AssetRef<T>[],
  options?: AssetGroupOptions,
): AssetGroup<T>;
```

The opaque frozen group exposes readonly `state`, `ready: Promise<readonly AssetLease<T>[]>`, and `dispose(): void`. States are `pending`, `ready`, `failed`, `disposed`. Input is homogeneous and invariant in `T`; there is no heterogeneous tuple overload. The required private type brand prevents structural fabrication without emitting a runtime brand. There is no group constructor, root factory, new group subpath or runtime group facade.

The caller registers providers and supplies a `HostAdapter`. This example uses the existing genuine Texture/Bitmap API; it illustrates CPU fixtures, with no downloading, decoding or GPU upload:

```ts
import {
  Bitmap, createAssetRef, createAssetType, createEngine,
  createImageData2D, createTexture, isTexture,
} from '@egret/engine';
import type { AssetGroup, HostAdapter, RenderFrame2D, Texture } from '@egret/engine';

export async function captureScene(host: HostAdapter): Promise<RenderFrame2D> {
  const engine = await createEngine({ host });
  const scope = engine.createScope();
  const type = createAssetType('scene texture', isTexture);
  const fixtures = new Map([
    ['red', new Uint8Array([220, 40, 40, 255])],
    ['blue', new Uint8Array([40, 80, 220, 255])],
  ]);
  try {
    engine.assets.register(type, {
      async load(ref) {
        const pixels = fixtures.get(ref.id);
        if (pixels === undefined) throw new Error('Unknown fixture');
        return createTexture(createImageData2D({ width: 1, height: 1, pixels }));
      },
      dispose(texture) { texture.dispose(); },
    });
    const group: AssetGroup<Texture> = engine.createAssetGroup(scope, [
      createAssetRef(type, 'red'), createAssetRef(type, 'blue'),
    ], { concurrency: 2 });
    const leases = await group.ready;
    const red = scope.use(new Bitmap(leases[0]!));
    const blue = scope.use(new Bitmap(leases[1]!));
    blue.x = 1;
    engine.stage.addChild(red); engine.stage.addChild(blue);
    return engine.captureFrame({ width: 2, height: 1 });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
```

The group owns member cleanup; Bitmaps borrow the leases. `scope.use(member)` refuses `OWNERSHIP_CONFLICT`, including the originating Scope. Early `member.release()` is idempotent and does not change a ready group or revoke another lease. Borrowers must keep their exact member active throughout use. The executed fixture counterpart is `examples/asset-group.mjs`; its saved CPU frame remains an owned image snapshot after scene retirement. This printed CPU result establishes no native pixels.

## Admission, scheduling and retirement

- Accept an actual Array with **0–128 occurrences**, including duplicates. Snapshot its length once; require every indexed position to be its own property and read each value once. Inherited ref-filled holes refuse. Do not consume the caller's iterator or retain mutable input/options. Options are a non-null non-array object; read only `concurrency` once. Default **4** applies only to `undefined`; valid values are integers **1–16**. These are engineering bounds, with no measured throughput claim.
- Check the open Engine and genuine same-Engine open Scope before caller reads. Recheck Engine then Scope after every read or throwing proxy/getter; a changed lifetime wins, otherwise the original thrown value, including `undefined`, is retained as cause. Whole-input manager preflight authenticates every ref, registered provider and existing/input-local ID/type pair before any load. It creates no identity, generation or demand reservation.
- Enroll the inert group with the Scope before starting loads. A recursive factory call during admission gets `ASSET_GROUP_REENTRANT`. Clear admission busy before activation, so synchronous provider callbacks may create a separate group. Private assembly captures original manager and Scope operations. The runtime-root type-only assembly port is `AssetGroupOperations`, with `admitGroupRefs`, `acquire`, `claimGroupLease` and `releaseGroupLease`. The optional `EngineContext.registerAssetGroupOperations` callback supplies the frozen genuine-manager operations to the Engine's private closure, preserving ordinary contexts and existing text-cache behavior without a new runtime-root value export.
- `concurrency` bounds this group's started acquisitions until their handlers retire their slots. Reserve before calling acquire and observe every result. Refill in input order only while pending and alive. This local waiter window does not limit global network activity, provider threads or unrelated Engine demand. Duplicate occurrences receive distinct genuine leases while the manager may coalesce their load/value.
- Publish one frozen input-order member array only after all occurrences succeed; empty input is immediately ready. The first terminal transition observed by the group wins. Acquisition/member-commit failure sets `failed` and rejects readiness before its cancellation/release callbacks. Manager rejection can run provider abort hooks before the group's Promise reaction; disposal triggered by such a hook may win instead.
- Failure or disposal stops queued starts, withdraws only group waiters and releases known members in **reverse input order**, continuing through faults. External waiters/leases survive. Late provider values remain the manager's responsibility; an already-delivered lease arriving at a terminal group is released by that group reaction. Pending readiness settles promptly even if a provider never finishes. Scope disposal retires known members synchronously; late arrivals cannot revive the group.
- Engine shutdown marks **all tracked pending/ready groups disposed** and settles pending readiness before the first group's abort/release callback, then uses its existing shutdown sequence. Disposing a ready group preserves its earlier fulfilled Promise; failed/disposed groups remain terminal. No provider-idle or group-cleanup promise is added to Engine close.

Preflight is a snapshot. Unrelated demand may subsequently claim a queued ID; original acquire then remains authoritative. Invalidation may produce **mixed actual resource generations** in one result. Readiness provides neither a synchronized resource snapshot nor version compatibility or a multi-resource transaction.

## Errors and diagnostics

| Boundary | Result |
| --- | --- |
| Engine/Scope admission | Existing `ENGINE_CLOSED`, `SCOPE_CLOSED`; fake/foreign Scope: `ASSET_GROUP_SCOPE_INVALID`. |
| Input/options/admission reentry | `ASSET_GROUP_REFS_INVALID`, `ASSET_GROUP_OPTIONS_INVALID`, `ASSET_GROUP_REENTRANT`; caller-read causes are preserved. |
| Whole-input manager preflight | Existing `ASSET_REF_INVALID`, `ASSET_PROVIDER_MISSING`, `ASSET_TYPE_MISMATCH`, `ASSET_MANAGER_CLOSED`. |
| Facade receiver/member commit | `ASSET_GROUP_INVALID`; genuine lease identity, affinity or ownership refusal: `ASSET_GROUP_MEMBER_INVALID` as acquisition-failure cause. |
| Pending failure/disposal | `ASSET_GROUP_ACQUIRE_FAILED` retains the original acquisition error; `ASSET_GROUP_DISPOSED` retains observed `ENGINE_CLOSED`/`SCOPE_CLOSED`, or `undefined` for manual disposal while open. |
| Cleanup | Manager-caught provider disposal faults retain `ASSET_CLEANUP_FAILED` and their captured cause. Only direct group abort/release-operation throws use `ASSET_GROUP_CLEANUP_FAILED`, phase `assets`, severity `error`. Neither replaces terminal readiness; Engine closing retains cleanup causes. |

The group internally observes readiness rejection from creation. Consumers should still handle `await group.ready`. Facade receiver checks and captured operations describe finite authority controls, not a general sandbox guarantee.

## Recorded evidence and remaining acceptance

| Saved execution/review | Confirmed scope |
| --- | --- |
| Original missing-feature RED, 17:44:21 UTC | **1 test, 0 pass, 1 fail**, assigned missing factory after genuine Engine/Scope/provider/lease setup; baseline loaded/disposed once, Engine close awaited. **343 SDK inputs unchanged**. Future group assertions were not reached. |
| First stable private build/CPU/example, 18:16:49 UTC | Build exit **0**; focused **28/28**; two genuine textures produced two CPU image commands at x **0/1**, generations **1/1**, then two provider disposals and host stop/close, with **0** pending timers. |
| Private focused successor, 18:20:15 UTC | **29/29**, including disposal after manager delivery but before the group fulfillment reaction: disposed readiness, exactly one final provider disposal and no queue revival. All **8 product source pins** remained unchanged; earlier 28-case bytes are preserved. **28 and 29 overlap and are not summed.** |
| Primary compiler probe, 18:19:16 UTC | Positive consumer exit **0**; unsuppressed negatives produced **15 ordinary** and **11 import** file/line/code diagnostics, with inputs unchanged. This earlier probe remains preserved. |
| Private strict type checker, 18:36:23–18:36:27 UTC | Exit **0** for retained and new positive consumers; all **15 ordinary** and **11 import** negative cases bind to exact unsuppressed file/line/code diagnostics. The probe and checker overlap and are not summed. |
| Initial private finite policy controls, 18:36:27–18:37:50 UTC | **34/34**: **2** direct controls and **32** mutants, each accepting the unchanged genuine four-package graph before its assigned single change/refusal. |
| Independent policy review and targeted RED, 18:41:12 / 18:45:50–18:45:52 UTC | No current product type-module leak was found. A non-exported local runtime-brand mutation escaped the export-namespace guard. Its test actually failed (**1 test, 0 pass, 1 fail**) because the checker accepted the mutant after its genuine baseline passed. |
| Corrected private policy successor, 18:49:16–18:50:31 UTC | **35/35**: **2** direct controls and **33** baseline-first mutants. The narrow emitted empty-module guard rejects the extra local-brand mutant. Finite source review at **18:50:17 UTC** resolved that coverage finding with **0** open successor findings; that review is separate from the actual pass. **34 and 35 overlap and are not summed.** |
| Adopted public working-tree core, 18:47:55–18:47:56 UTC | Build and CPU example exit **0**; combined checks **86/86**, comprising **29** RG1 and **57** retained resource/lifecycle cases. The example retains two CPU image commands, generations **1/1**, two disposals and **0** pending timers. The 29 RG1 cases overlap earlier results. |
| Retained browser regressions, 18:49:16–18:50:04 UTC | **8** commands exit **0**: **7** existing browser profiles plus the textured-input build/freeze. Profile results are Canvas checked pixels, WebGPU **PASS**, B1 **PASS**, textured **PASS**, SequencePlayer **PASS_OPAQUE_REGION_SUBSET**, Canvas text **PASS_WC1_CANVAS_SUBSET**, and picking **PASS_DESKTOP_HT1_CANVAS_SUBSET**. The freeze prepares inputs; it is not native execution. None is a group-based browser application. |
| Independent contract/source review | Required finite amendments incorporated; no blocking product source defect found. Finite successor review confirmed the distinct late delivered-lease coverage follow-up addressed. Direct artificial group-operation faults have source review, without fault-injection execution. |

Earlier setup failures, the original missing-feature RED, the initial 34-control pass and the assigned type-erasure RED remain retained alongside their successors. Complete current checks, bilingual meaning review, RG1 publication/content checks, the mandatory pre-push hook and RG1 remote delivery are **PENDING** at this cutoff; no RG1 remote CI success is claimed. Retained browser results establish their desktop composition/readback subsets only: SequencePlayer is an opaque-region subset; Canvas text is WC1; picking is HT1. They establish no group-based browser application, whole A2, physical display or OS resource retirement, phones, performance, full UI/3D, migration or full Spine acceptance.

The preceding **0.30.0** example checkpoint was delivered through [PR #17](https://github.com/cnedwin/Egret_rebuild/pull/17), with local and remote Main identities verified. That receipt belongs to 0.30.0 and supplies no RG1 delivery result.

This independently authored first-party increment reuses the existing manager/ref/lease machinery, with Codex assistance and finite review, under the project's Apache-2.0 license. The external dependency set and package/export map remain unchanged. It supports resource-backed scene startup toward existing **R002/R003**, engineering **R011/R015/R016/R017**, and public collaboration **R018/R019**; it does not complete those broader requirements. Registry entries **S084/V035** record this increment as in progress at the frozen cutoff.

Full Spine remains required under [R020/V020](spine-animation-support-and-acceptance.md). RG1 supplies partial-load cleanup and instance ownership groundwork only. Spine import, atlas, official version/feature/license matrix, pose, playback, events, rendering, recovery, complete UI/3D and migration remain separate unfinished obligations.
