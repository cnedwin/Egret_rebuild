# 3D CPU foundation and future rendering boundaries

English | [简体中文](../../Cns/docs/3d-foundation.md)

<!-- S3D1-DOC-0.32.0-BEGIN -->
## Current public scene checkpoint: 0.32.0 (S3D1)

Verified implementation: public behavior **35/35**, boundaries **238/238**, **2** positive type consumers and **10 + 3 + 11 + 15** exact negative diagnostics pass. Retained integration checks **161/161** and fresh fixed headless Edge composition pass after independently reviewed repairs. Full final publication and current delivery remain pending at this curation cutoff; the linked scene contract records exact scopes and successors.

**Initial source/API observation (historical cutoff):**

Read the [public scene contract](public-scene3d-contract.md) for exact exported factories/types, authentic readonly snapshots, restricted camera/numeric/budget rules and explicit browser Host ownership. The independently designed interfaces directly reuse the current first-party foundation and Host algorithms. Three-file adoption, build and interface GREEN at **2026-10-11 19:54:25–19:54:26 UTC** confirm source/API reachability only. Behavior, types, policy, native and final acceptance/delivery are **PENDING**. This experimental procedural mesh/screen-UI route does not accept complete UI/3D, assets, characters, Spine, Native SDKs or performance.

The delivered **0.31.0** successor was merged through [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) to Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`, tree `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`. The following **0.16.0** body is the historical internal-foundation cutoff, including its absence of public rendering exports. Its original results, numbers and source identities remain unchanged and are not new public-route acceptance.
<!-- S3D1-DOC-0.32.0-END -->

The 0.16.0 3D increment establishes verifiable data and numeric contracts before GPU host integration. B0 math/projection, B1 CPU geometry and CPU packing are accepted. Mixed GPU execution of scenes, characters, effects and complex 2D UI still requires implementation and actual verification. These are internal engineering foundations; they add no public rendering API and do not change RenderFrame2D.

## Math and projection

B0 uses owned frozen binary64 tuples, column-major matrices and column vectors. Homogeneous transforms preserve raw w without implicit perspective division or clipping. Projection explicitly selects zero-to-one/minus-one-to-one depth and forward/reverse direction, rather than hiding backend conventions in matrix calls. CPU contracts check finite inputs/results; binary64 tests do not prove float32 shader precision.

## Geometry ownership and admission

B1 geometry contains positions, colors, indices, vertexCount, indexCount and logicalBytes. Inputs are ordinary arrays. Positions are finite binary64, RGB is within [0,1], indices are in-range safe integers and triangle index counts are multiples of 3. Empty geometry has both counts zero; nonempty geometry has at least 3 vertices and 3 indices. Numeric -0 is normalized to +0.

The vertex cap is 65536, index cap 196608 and logical byte budget 8*(6*V+I) ≤ 4194304. Counts and the complete budget are checked before payload allocation or indexed reads. The factory captures owned positions, colors and indices in order, then validates and freezes its owned arrays and wrapper. It retains no caller storage and runs no caller iterator. Internal WeakMap identity is registered only after successful publication; annotations, matching fields and proxies cannot acquire authentic geometry identity.

Error origins distinguish validation, budget, source and native, retaining the original cause. Recovery depends on error construction/registration remaining possible; permanently poisoned intrinsics and real OOM recovery are not guaranteed. Counts/bytes are logical admission bounds, not JS heap or GPU memory measurements or allocation guarantees.

## Deliberately bounded CPU packing profile

Packing authenticates geometry before reading any field. It checks counts/bytes, preflights every position followed by every color, including unused vertices, and only then allocates two fresh typed buffers. The current verification profile admits zero or exactly representable normal float32 values; rounded values, subnormals, overflow and nonzero-to-zero conversion are unsupported. Magnitudes range from 2^-126 to (2−2^-23)*2^127 with original signs preserved; zero stays +0. This is a bounded verification profile, not a complete asset-import policy.

The layout has a 24-byte vertex stride, XYZ at offset 0, RGB at offset 12 and Uint32Array indices. The result wrapper is frozen; its Float32Array/Uint32Array and backing buffers are fresh, owned, mutable trusted upload data, rather than deeply frozen objects or GPU resources. Every call creates new storage; changing its output does not change CPU geometry.

Packing has saved 43 focused/794 full passes; geometry has 21/752 and B0 121/731. B0 retains an earlier fixture result of 119 passes/2 failures and was accepted only after correction. Original P01 oracle values/counts are distinct from the complete IEEE word/byte expectation arrays independently authored for implementation. A little-endian fixture does not prove native endianness on every platform; no authentic over-budget fixture bypassing identity is claimed. Exact historical subjects and named current source identities are in the [CPU evidence summary](../../evidence/3d-cpu-source-verification.json). Documentation work reran no product tests; these historical sets cannot be added.

## GPU design evidence and choices awaiting verification

The selected [GPUWeb draft source](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs) is fixed at commit 25a5dc4537074c9b3844dd95891f5cfd193f4407. Research read nine semantic ranges covering coordinates, index/vertex layout, depth and render-pass/submission semantics. A whole-byte digest establishes identity, not full-spec semantic reading. This snapshot is neither the “latest final standard” nor device-support proof. Selected installed TypeScript 7.0.2 DOM declarations provide type evidence only; the read-only file has 6 hard links, establishing neither unique ownership nor native behavior.

The bounded B1 scene candidate chooses reversed zero-to-one, depth32float, clear 0, greater/write, cull none and CCW. The scene pass clears; an ordered 2D UI pass then loads/stores without depth, using one encoder/submit and readback after the selected two passes. These are Egret architectural choices. In particular, depth-free UI and this readback order are not universal WebGPU requirements. They are not implementation acceptance and promise no edge-pixel inclusion rule, cross-device precision or performance.

The next stage must define host ports, float32 MVP admission, resource ledgers, fences/readback/disposal and error origins, then verify mock and actual GPU counterexamples separately. Materials, transparency sorting, skinning/animation, 3D character effects, actual font/complex-UI budgets, phones, Native SDKs and performance comparisons remain open. Standards and mature community experience inform design; no same-conditions experiment currently establishes a performance advantage over competing engines.

[Core progress](core-progress.md) · [Renderer/runtime direction](rendering-engine-and-runtime.md) · [Knowledge base](../README.md)
