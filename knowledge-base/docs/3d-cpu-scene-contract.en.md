# CPU scene snapshot contract

English | [简体中文](3d-cpu-scene-contract.md)

Egret's CPU scene snapshot turns a projection and ordered mesh draws into an owned, immutable `SceneFrame3D`. Each draw keeps an authentic CPU geometry identity and its own `mvp`; a separate first-seen geometry list makes shared-resource accounting inspectable. This is an internal engine interface, with historical source acceptance described in the [implementation evidence](3d-cpu-scene-evidence.en.md).

Historical documentary candidate 0.1. Public release remains **HELD**. The accepted slice covers CPU snapshot behavior; GPU host integration, native shader/device/pixel precision and performance remain **HELD**.

## Inputs and projection

`createSceneFrame3D(input)` expects own `projection` and `draws` fields. Projection is a non-array object with own `kind`, `left`, `right`, `bottom`, `top`, `near` and `far`; kind is `perspective` or `orthographic`. `draws` is an array with an admitted safe-integer length and own indexed entries. Every draw is a non-array object with own `geometry` and `modelView`. Geometry must already be authentic `MeshGeometry3D`; matching fields, copies and proxies do not acquire that identity.

Model matrices are captured through the existing CPU matrix factory. The scene builds a **reversed zero-to-one** projection and computes `mvp = projection × modelView` using column-major matrices and column vectors. The final MVP normalizes signed zero to +0. The snapshot preserves homogeneous geometry and raw clip w: zero/negative w and near-crossing geometry are retained, with no perspective division, visibility classification or clipping in this factory.

Required fields are captured without caller iteration or inherited-field substitution. Length/quota refusal precedes payload scratch and indexed draw reads. Admitted projection fields and draw entries are captured before deferred missing/value checks; draw shape refusal stops later payload access. Each model capture completes before the next model call and before projection-kind semantics. These are local ordering rules, not a general theorem that every later source fault outranks every earlier failure.

## Ownership and identities

Each successful call creates a fresh frozen frame, draw array, first-seen geometry array, draw wrappers and MVP tuples. Only the previously owned immutable geometries are shared by identity. Caller projection/draw/model storage is not retained. Empty draws still validate projection and yield fresh frozen empty arrays with zero charges.

`isSceneFrame3D(value)` authenticates the exact published frame through internal identity registration, without inspecting foreign fields. A spread copy or proxy of a frame is not authentic. Registration happens last; an unsuccessful construction publishes no frame.

## Logical admission budgets

Let N be draw count, and V and I the vertex/index counts of each distinct geometry identity.

| Quantity | Accounting | Cap |
|---|---|---:|
| Draws | N | 64 |
| Distinct geometries | First-seen identity count | 64 |
| `cpuLogicalBytes` | Sum of `8*(6*V+I)` once per identity | 8388608 |
| `sceneBytes` | Sum of `24*V+4*I` once per identity | 4194304 |
| `uniformBytes` | `64*N`, including empty-geometry draws | 4096 |

Charges must be safe integers. Repeated geometry identity incurs one geometry charge and one 64-byte MVP charge per draw; equal-valued distinct geometries each incur a charge. Identity charges precede that identity's payload profile. These are logical numeric/payload admission limits, not measured JS heap/GPU residency or allocation-success guarantees. The factory allocates no GPU resources.

## Numeric profile and failures

Every geometry position, color and final MVP coefficient must be zero or exactly representable as a normal float32: magnitude from `1.1754943508222875e-38` to `3.4028234663852886e38`, with `Math.fround(value) === value`. Rounded values and subnormals are unsupported. Unreferenced vertices are still checked. Model input is binary64; the final MVP, rather than every intermediate model coefficient, is restricted to this profile.

For every vertex and MVP row, the factory computes four absolute binary64 products and sums them in the fixed order `((p0+p1)+p2)+p3`; each intermediate must be finite and the sum at most `1.329227995784916e36`. This restrictive headroom policy is not an outward-rounded bound or shader-precision/visibility result.

| Error code | Registered origin |
|---|---|
| `SCENE3D_INPUT_INVALID` | `validation` |
| `SCENE3D_INPUT_READ_FAILED` | `source` |
| `SCENE3D_BUDGET` | `budget` |
| `SCENE3D_PRECISION_UNSUPPORTED` | `validation` |
| `SCENE3D_ARITHMETIC_RANGE` | `validation` |
| `SCENE3D_NATIVE_FAILED` | `native` |

`getScene3DErrorOrigin` recognizes registered errors, not caller classes/codes or error-shaped objects. Source-read failures retain the original thrown value as cause. Trusted CPU math invocation failures preserve the wrapper and nested cause. Here `native` names owned JavaScript/intrinsic-operation failures; it does not certify native graphics. Recovery depends on error construction/registration remaining possible; universal real-OOM or permanently poisoned-intrinsic recovery remains unproved.

## Shared-geometry example

This internal-interface illustration uses an already authentic three-vertex, three-index geometry satisfying the numeric and headroom profile above. It was not executed during documentation preparation.

```ts
const modelView = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-1,1];
const frame = createSceneFrame3D({
  projection: {kind: 'orthographic', left: -1, right: 1,
    bottom: -1, top: 1, near: 0, far: 1},
  draws: [{geometry, modelView}, {geometry, modelView}],
});
// One geometry identity, two independently owned MVPs:
// cpuLogicalBytes = 168; sceneBytes = 84; uniformBytes = 128.
```

The projection conventions acknowledge the previously selected [GPUWeb draft source](https://github.com/gpuweb/gpuweb/blob/25a5dc4537074c9b3844dd95891f5cfd193f4407/spec/index.bs). The [foundation note](3d-foundation.en.md) qualifies its historical nine-range reading and type-only evidence. This draft reference is design context, not a fresh upstream review, latest-standard claim or device-support result.

## 0.17.0 successor scope

The HELD statements above retain the original CPU/mesh documentary checkpoint. Later B1 Host source/mock integration passed the default 13-case schedule and the selected whole-repository 901/901 verification; read the [Host contract](b1-host-contract.en.md), [Host evidence](b1-host-evidence.en.md) and [local evidence index](../evidence/b1-host-mock-evidence.json). These results overlap earlier totals and are not additive. The verified Host test is the 85984-byte identity; its 85983-byte successor only removes the final LF, with no runtime rerun. GitHub publication remains pending. Native SDKs, real browser/device shaders and pixels, physical precision and performance remain unverified. These helpers remain internal.
