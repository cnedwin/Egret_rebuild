# CPU scene implementation evidence

English | [简体中文](../../Cns/docs/3d-cpu-scene-evidence.md)

The accepted CPU scene slice creates fresh immutable snapshots, authenticates geometry/frame identities, computes ordered MVPs and applies logical admission budgets. Its tests inspect numeric outputs, ownership, capture ordering and failure causes with independently authored literal expectations. Read the [contract](3d-cpu-scene-contract.md) for the usable semantics.

Historical documentary candidate 0.1. Public release and GPU host/native device/pixel/performance acceptance remain **HELD**. This is a curated historical checkpoint with named source identities; no product tests were replayed while preparing this document.

## Named source and test identities

| Subject | Bytes | SHA256 |
|---|---:|---|
| `packages/engine/rendering/sceneFrame3D.ts` | 11442 | `c2ee3db171c8f88f821bfec28ca2d93474c60e6cd1a6d1dd2f7d400e4ff5c16e` |
| Corrected `tests/scene-frame-3d.test.mjs` | 21555 | `31faa4c3cac85ddf4dbfc87f08c01e2715d695e42397583db3602c4118af68fb` |
| Original test-comment bytes at the CPU checkpoint | 21534 | `753403fd74f067ad7854ec9fdb84a4a9ed191a56b01b642fab0932258f028df6` |

The first two identities were freshly checked in the finite documentary source read. The original test identity is inherited from saved run and acceptance metadata. The local CPU source checkpoint is `78ac263c81b44d7961134309b383e1cfb9220823`. These identities describe selected subjects, rather than qualify the changing whole repository or current Host pipeline.

## Saved result scopes

| Historical scope | Executed cases | Pass | Fail | Qualification |
|---|---:|---:|---:|---|
| Meaningful CPU behavior RED | 26 | 0 | 26 | Original behavioral witness |
| CPU scene focused | 26 | 26 | 0 | Original test-comment identity |
| Related CPU regression | 164 | 164 | 0 | Separate historical selection |
| CPU complete checkpoint | 851 | 851 | 0 | One full invocation, original test-comment identity |
| Later mesh complete checkpoint | 861 | 861 | 0 | One later full invocation including the corrected CPU test identity |

The CPU complete checkpoint is dated `2026-10-09`, with exit status 0; its raw summary reports 851 tests, 851 passes and zero failures, cancelled, skipped or todo cases. The acceptance record identifies a subsequent comment-only correction preserving assertion, fixture and operation bytes. No rerun accompanied that CPU acceptance. The later mesh checkpoint is explained in the [mesh evidence](3d-webgpu-mesh-evidence.md). These selections overlap and must not be summed or presented as a current Host-base pass.

## What the 26 CPU witnesses inspect

The suite checks fresh frozen outputs, stable shared geometry identities, empty snapshots, rejection of copied/proxied/foreign identities without field inspection, own-field/slot ordering, ignored extra machinery, source-fault causes, holes/inherited fields, early draw-quota and record-shape refusal, and cross-realm array capture without iteration.

Literal asymmetric perspective/orthographic fixtures check `projection × modelView`, reverse-depth endpoints and column-major ordering. Zero/negative w and near-crossing geometry are preserved. Tests cover every MVP slot, normal-f32 endpoints, subnormal/rounded refusals, unreferenced positions/colors, binary64 model coefficients composing to an admitted final MVP, and +0 normalization. Headroom witnesses cover the exact cap, next float32, absolute-product cancellation policy and finite-range refusal. Expected matrices and charges are authored literals, not outputs from production math used as their own oracle.

Identity accounting witnesses distinguish repeated, distinct, empty and unreferenced geometry. They use authentic factory-created geometries for near-limit budgets: up to 64 draws, 64 identities, `cpuLogicalBytes` 8388608, `sceneBytes` 4194304 and `uniformBytes` 4096. Those limits are logical admission, not physical residency or allocation proof.

Controlled JavaScript allocation/copy/freeze/identity/math/registration failures restore intrinsics and check no frame publication, exact causes and registered origins. CPU math wrappers and rethrown registered errors retain local error boundaries. These one-shot controls establish their selected branches; real OOM, permanent intrinsic poisoning, operating-system resource safety and native graphics remain separate obligations.

## Design acknowledgement and remaining work

Egret authors the snapshot interface and its literal CPU witnesses independently. The previously selected [GPUWeb draft source](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs) informs coordinate/depth conventions, with the historical selected-read qualifications retained in the [foundation note](3d-foundation.md). No new standard/dependency/source import or upstream fetch occurred in this curation.

A complete asset importer, animation/materials, public API delivery, scene/UI Host integration, native WGSL/device validation, hardware pixels/precision and performance remain **HELD**. The [fixed mesh contract](3d-webgpu-mesh-contract.md) describes a separately accepted helper; it does not turn these CPU witnesses into GPU execution evidence.

## 0.17.0 successor scope

The HELD statements above retain the original CPU/mesh documentary checkpoint. Later B1 Host source/mock integration passed the default 13-case schedule and the selected whole-repository 901/901 verification; read the [Host contract](b1-host-contract.md), [Host evidence](b1-host-evidence.md) and [local evidence index](../../evidence/b1-host-mock-evidence.json). These results overlap earlier totals and are not additive. The verified Host test is the 85984-byte identity; its 85983-byte successor only removes the final LF, with no runtime rerun. GitHub publication remains pending. Native SDKs, real browser/device shaders and pixels, physical precision and performance remain unverified. These helpers remain internal.
