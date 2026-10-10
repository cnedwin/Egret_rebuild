# Fixed WebGPU mesh pipeline and draw contract

English | [简体中文](3d-webgpu-mesh-contract.md)

Egret's fixed mesh helper expresses a small inspectable GPU interface: one position/RGB vertex layout, one column-major MVP uniform and ordered indexed draws using caller-supplied resources. `createWebGPUMeshPipeline` supplies fixed shader/descriptor text through captured callbacks; `encodeWebGPUMesh` records state and a draw into a supplied pass. The [implementation evidence](3d-webgpu-mesh-evidence.en.md) distinguishes accepted source/mock behavior from native execution.

Historical documentary candidate 0.1. Public release, scene/UI Host integration, native WGSL/device/pixels and performance remain **HELD**. These internal helpers do not add a public package entry or release a host implementation.

## Fixed shader and resource ABI

The shader has one `MeshUniform.mvp: mat4x4<f32>` at `@group(0) @binding(0)`: a 64-byte column-major MVP. Vertex position is `vec3<f32>` at location 0; color is `vec3<f32>` at location 1. The shader computes `draw.mvp * vec4<f32>(position, 1.0)` and preserves raw clip w, with no transpose, perspective division or Y negation. It passes RGB unchanged to the varying and returns `vec4<f32>(input.rgb, 1.0)`. There is no explicit gamma conversion, premultiplication, texture access, discard or flat-interpolation annotation. This is authored source behavior, not native shader validation or pixel evidence.

| Descriptor part | Fixed choice |
|---|---|
| Layout | `auto` |
| Vertex entry | `vertexMain`; stride 24; stepMode `vertex` |
| Position | location 0, offset 0, `float32x3` |
| RGB | location 1, offset 12, `float32x3` |
| Fragment entry/target | `fragmentMain`; supplied format; writeMask 15; no blend field |
| Primitive | `triangle-list`; frontFace `ccw`; cullMode `none`; unclippedDepth false |
| Depth | `depth32float`; depthWriteEnabled true; depthCompare `greater` |
| Depth bias | depthBias 0; depthBiasSlopeScale 0; depthBiasClamp 0 |
| Multisample | count 1; alphaToCoverageEnabled false |

The typed format parameter is `rgba8unorm` or `bgra8unorm`. The helper passes that value into the descriptor; runtime argument admission and native format support remain caller/native obligations. It adds no strip-index or stencil fields. A matching reversed zero-to-one host supplies clear depth 0; this helper creates no render pass and establishes no pass clear or composition behavior. Allocation, binding alignment/limits, upload and authentic scene/geometry admission belong to the host boundary.

## Callback and Promise identity

`createWebGPUMeshPipeline(shader, pipeline, format)` calls shader once with `{code: MESH_SHADER}`, then pipeline once with the fixed descriptor. The exact shader-module object appears in both stages. The helper returns the pipeline callback's **original Promise**, without an async wrapper, caching or settlement replacement.

A synchronous shader callback fault prevents the pipeline call. A synchronous pipeline callback fault propagates synchronously. Returned-Promise rejection retains its original value. The caller owns captured operations, error scopes/gates and immediate observation of settlement; acceptance of this helper does not establish those host behaviors.

## Encoding order and ownership

For `indexCount === 0`, encoding returns without reading any pass property. Every nonzero call uses this exact order with the supplied resource objects:

| Order | Call |
|---:|---|
| 1 | `setPipeline(pipeline)` |
| 2 | `setViewport(0, 0, width, height, 0, 1)` |
| 3 | `setScissorRect(0, 0, width, height)` |
| 4 | `setVertexBuffer(0, vertices)` |
| 5 | `setIndexBuffer(indices, 'uint32')` |
| 6 | `setBindGroup(0, bindings)` |
| 7 | `drawIndexed(indexCount, 1, 0, 0, 0)` |

Pass methods receive the actual pass as receiver. A fault stops the trace at that call and propagates its exact thrown value. Repeated draws keep each supplied binding identity and order. The encoder does not validate counts/dimensions/resources, allocate or upload, begin/end a pass, finish/submit an encoder, create error scopes, observe fences or retire resources. Those responsibilities remain with the host.

## Illustrative supplied-resource call

```ts
encodeWebGPUMesh(pass, pipeline, vertices, indices, bindings, 3, 20, 12);
// Indexed triangle draw, one instance, full 20-by-12 viewport/scissor.
```

This example describes the supplied-pass call trace and was not executed in documentary preparation. It assumes appropriately admitted resources; it proves no allocation, buffer bounds, real-device output or integrated scene pass.

The [CPU scene contract](3d-cpu-scene-contract.en.md) supplies a separate snapshot/profile contract. Egret independently authors these interfaces and fixed source fixtures, acknowledging the previously selected [GPUWeb draft source](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs) for coordinate/layout/depth/render-pass conventions. The [foundation note](3d-foundation.en.md) preserves the historical nine-range reading and type-only qualification; no fresh upstream review, latest-standard or device-support claim is made here.

## 0.17.0 successor scope

The HELD statements above retain the original CPU/mesh documentary checkpoint. Later B1 Host source/mock integration passed the default 13-case schedule and the selected whole-repository 901/901 verification; read the [Host contract](b1-host-contract.en.md), [Host evidence](b1-host-evidence.en.md) and [local evidence index](../evidence/b1-host-mock-evidence.json). These results overlap earlier totals and are not additive. The verified Host test is the 85984-byte identity; its 85983-byte successor only removes the final LF, with no runtime rerun. GitHub publication remains pending. Native SDKs, real browser/device shaders and pixels, physical precision and performance remain unverified. These helpers remain internal.
