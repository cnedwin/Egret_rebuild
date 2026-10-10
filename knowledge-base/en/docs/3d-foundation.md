# 3D CPU foundation and future rendering boundaries

English | [简体中文](../../Cns/docs/3d-foundation.md)

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
