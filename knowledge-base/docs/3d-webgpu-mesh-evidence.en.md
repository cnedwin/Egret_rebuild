# Fixed WebGPU mesh implementation evidence

English | [简体中文](3d-webgpu-mesh-evidence.md)

The accepted mesh slice fixes WGSL/descriptor text and the supplied-pass call trace. Independent first-party fixtures compare actual helper output with literal expected shader and descriptor values, while fault witnesses inspect Promise identity, exact thrown/rejected values and resource ownership. The [contract](3d-webgpu-mesh-contract.en.md) describes those interfaces.

Historical documentary candidate 0.1. Public release, scene/UI Host integration, native WGSL/device/pixels and performance remain **HELD**. Source/mock acceptance is the evidence class; no build, product test or native experiment was run during this curation.

## Named source identities

| Subject | Bytes | SHA256 |
|---|---:|---|
| `packages/engine/web/webgpuMeshPass.ts` | 2998 | `6213e04e77f1a09afe35627eaba4ab2be2ddab92b986423deed361e51c7bdc37` |
| `tests/webgpu-mesh-pass.test.mjs` | 10302 | `1250753c4b99fd40e549e4e45e758e54b5cf71e23c992877a5f88953484ff1bf` |
| `packages/engine/rendering/sceneFrame3D.ts` | 11442 | `c2ee3db171c8f88f821bfec28ca2d93474c60e6cd1a6d1dd2f7d400e4ff5c16e` |
| Corrected `tests/scene-frame-3d.test.mjs` | 21555 | `31faa4c3cac85ddf4dbfc87f08c01e2715d695e42397583db3602c4118af68fb` |

These four protected files were freshly read and hashed, and their identities appear in the recorded mesh acceptance source membership. The local mesh source checkpoint is `1ff1e1734952cb31b110c1a8530436de35876aa1`. Identity comparison covers these subjects, rather than the currently changing Host/boundary files, generated output or whole pipeline.

## Historical results kept in separate scopes

| Scope | Executed cases | Pass | Fail |
|---|---:|---:|---:|
| Meaningful fixed-expectation mesh RED | 10 | 4 | 6 |
| Mesh focused | 10 | 10 | 0 |
| Related regression | 78 | 78 | 0 |
| Mesh complete checkpoint | 861 | 861 | 0 |

The saved complete checkpoint is dated `2026-10-09`, with exit code 0. Its raw summary reports 861 tests, 861 passes and zero failures, cancelled, skipped or todo cases; the saved run metadata agrees. One full verification invocation was recorded.

The earlier CPU complete checkpoint was 851 cases on the original CPU test-comment identity. CPU acceptance subsequently changed only that comment and recorded no rerun; the later 861 checkpoint includes the corrected CPU test identity. See [CPU evidence](3d-cpu-scene-evidence.en.md). These historical scopes overlap; they are not additive and do not establish a current Host-base pass. The meaningful RED row records executed behavior cases.

## Ten fixed helper witnesses

| Witness | Inspected behavior |
|---|---|
| D01 / D02 | Exact descriptor for `rgba8unorm` / `bgra8unorm`, callback order, shared shader module and original Promise |
| D03 | Exact independently authored WGSL text, MVP/RGB ABI and absence of extra conversion/division operations |
| D04 | Synchronous shader fault and no pipeline callback |
| D05 | Synchronous pipeline fault with original value |
| D06 | Original returned Promise and exact rejection value |
| D07 | Ordered nonempty pass calls, actual receiver, supplied resources and arguments |
| D08 | Empty encoding with zero pass-property reads |
| D09 | Exact failure prefix and unchanged thrown value for each pass method |
| D10 | Distinct per-draw bindings kept in supplied order |

The fixtures exercise arbitrary values including undefined, null, signed zero, NaN, BigInt, symbols and objects, without replacing failure identity. Promise observations attach immediately in the tests. Supplied mock resource tokens demonstrate helper order; they do not authenticate scenes/geometries, allocate uniforms, validate a device or compile WGSL. Descriptor comparisons inspect exact present/absent fields, including the 24-byte position/RGB stride, uint32 indices, reverse `greater`/write depth, no blend/stencil/strip fields and single-sample policy.

## Primary design acknowledgement and held validation

Egret's fixed helper and literal fixtures are independently authored. The [GPUWeb draft source](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs), previously selected at `25a5dc4537074c9b3844dd95891f5cfd193f4407`, informs coordinate/layout/depth/pass conventions. The [foundation note](3d-foundation.en.md) retains its historical nine-range reading, whole-byte identity versus semantic-reading distinction and type-only declaration evidence. No new upstream review, latest-final-standard, dependency/license clearance or device-support claim follows from this curation.

Authentic scene admission, allocation/upload/retirement, error scopes/fences, scene/UI ordering and cold/cached loader witnesses require a separate Host binding. Native WGSL compilation, actual devices, hardware pixels/precision, A2/B1 calibration and performance remain **HELD**. The saved 10/78/861 scopes release none of those obligations.

## 0.17.0 successor scope

The HELD statements above retain the original CPU/mesh documentary checkpoint. Later B1 Host source/mock integration passed the default 13-case schedule and the selected whole-repository 901/901 verification; read the [Host contract](b1-host-contract.en.md), [Host evidence](b1-host-evidence.en.md) and [local evidence index](../evidence/b1-host-mock-evidence.json). These results overlap earlier totals and are not additive. The verified Host test is the 85984-byte identity; its 85983-byte successor only removes the final LF, with no runtime rerun. GitHub publication remains pending. Native SDKs, real browser/device shaders and pixels, physical precision and performance remain unverified. These helpers remain internal.
