# Nine-slice geometry NS1: experimental contract

English | [简体中文](../../Cns/docs/九宫格几何NS1契约.md)

Prepared 2026-10-12. **SOURCE_ONLY · NOT_RUN.** This document specifies an experimental CPU geometry factory for fixed-border panels in complex 2D interfaces, within R002/R004. Implementation, strict-type checks and renderer acceptance require separately recorded evidence. Complete UI/EUI, layout and full Spine support remain outside this contract; R020/V020 remains **OPEN**.

## Public surface and ownership

The contract specifies named exports through the canonical `@egret/runtime` and `@egret/engine` roots, with the same value and type bindings. There is no additional package entry or subpath.

```ts
export interface NineSliceInsets2D {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
export interface NineSliceGeometry2DOptions {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly insets: NineSliceInsets2D;
}
export function createNineSliceGeometry2D(
  options: NineSliceGeometry2DOptions
): TexturedGeometry2D;
```

The factory delegates canonical ownership to the existing `createTexturedGeometry2D`. Its result is an authentic branded `TexturedGeometry2D`: a frozen record with frozen `readonly number[]` positions, UVs, light colors and indices. The public arrays are ordinary numeric arrays, not writable typed-array views. Each call returns fresh owned geometry without retaining or modifying the options or inset record. A structural lookalike cannot supply its brand.

This is a DOM/Node-free factory. It does not read an Engine, Texture, asset manager or GPU, acquire an asset, create another owner or expose a disposer. Saved geometry remains an immutable CPU value; its identity grants no asset entitlement or GPU lifetime guarantee. `Mesh2D` borrows an existing manager-issued `AssetLease<Texture>`. Replacing its content with `setContent(lease, geometry)` does not transfer or release that lease.

## Dimensions and ordered admission

The caller must match `sourceWidth`/`sourceHeight` to the borrowed Texture's **unrotated** `sourceRect.width`/`sourceRect.height`. Source dimensions, target dimensions and insets use corresponding coordinate units. The factory cannot inspect or enforce this crop agreement. This contract stretches the center and edge regions while preserving corner dimensions; it supplies no tiling, trimming, rotation, `scale9Grid` mutation or automatic layout invalidation.

Options and insets must be non-null, non-array objects. The factory reads `sourceWidth`, `sourceHeight`, `targetWidth`, `targetHeight` and `insets` once, in that order. After admitting the inset object, it reads `left`, `top`, `right` and `bottom` once. Inherited properties and accessors are allowed; unknown keys are not enumerated. A failed property read throws `TypeError` with the original error as its `cause` and stops later reads. Per-call staging isolates reentry; admission and error intrinsics are captured before callbacks.

After all successful reads, all eight primitive-number type checks complete in that field order before any numeric range check. Type failures produce `TypeError`; finite/range or derived-geometry failures produce `RangeError`. Thus a later wrong type takes precedence over an earlier numeric range error. There is no coercion, default value, clamping or partial result.

All dimensions must be finite and greater than zero. Insets must be finite and nonnegative; fractions are allowed and signed zero is normalized. `left + right` and `top + bottom` must be finite, strictly smaller than their source dimensions and no larger than their target dimensions. The source center must have positive area. A target smaller than its border sum is rejected; corners are never compressed to fit.

## Precision and deliberate degeneracy

Meaning is defined by the computed Float64 geometry, rather than exact real arithmetic or a pixel-perfect promise for every finite input. Before allocation, reject nonfinite or unordered cuts/UVs, collapsed source-center UVs, and any positive inset whose computed target edge or normalized source span disappears through rounding or underflow. A positive target center must remain positive after computation. Such accidental collapses produce `RangeError`.

Zero insets deliberately allow zero-width border regions. A target dimension equal to its computed border sum deliberately allows a zero-width center: the inner cuts coincide exactly at the leading inset. These cases retain the fixed geometry topology, including degenerate triangles. They do not permit a zero target dimension. There is no precision-based clamping. Native allocation/copy faults from canonical geometry creation escape unchanged. GPU Float32 precision, culling and renderer budgets require separate acceptance.

## Canonical topology and resize

The four horizontal cuts are `X = [0, left, targetWidth - right, targetWidth]`; if `targetWidth === left + right`, use `X[2] = left`. Vertical cuts follow the same rule. Normalized source cuts are `U = [0, left / sourceWidth, (sourceWidth - right) / sourceWidth, 1]` and the corresponding `V` values.

Vertices are row-major: vertex `4*j+i` pairs `(X[i], Y[j])` with `(U[i], V[j])`. Staging uses Float64 positions/UV/light values and Uint16 indices. Every light component is `1`. Each cell with leading vertex `k` emits `[k, k+1, k+4, k+1, k+5, k+4]`. The owned result has **16 vertices, 54 indices and 18 triangles**, including deliberate degenerates; these are structural counts, not a draw-call or performance claim.

For a source **8×8**, with all four insets **2**:

| Geometry | Target | X cuts | Y cuts | U/V cuts |
|---|---|---|---|---|
| A | 16×12 | 0, 2, 14, 16 | 0, 2, 10, 12 | 0, 0.25, 0.75, 1 |
| B after resize | 12×16 | 0, 2, 10, 12 | 0, 2, 14, 16 | 0, 0.25, 0.75, 1 |

Resize creates B and replaces Mesh content with the same lease. A, its arrays and any previously completed captured frame retain their original values. The factory performs no automatic display update.

## Integration sketch and verification boundary

The normal textured route uses `createEngineForProfile({ host }, TEXTURED_FRAME_PROFILE_2D)`, an Engine-created Scope, a registered Texture provider and a genuine lease from `engine.assets.acquire(createAssetRef(...))`. The Scope owns lease/Mesh cleanup; the Mesh borrows. The caller must supply a live Mesh and lease from that same Engine, with the matching full 8×8 crop.

The following is a **partial API sketch, not an executed example**. Its parameters represent those existing objects; it shows geometry replacement without a renderer, asset setup or captured-frame evidence.

```ts
import { createNineSliceGeometry2D } from '@egret/engine';
import type { AssetLease, Mesh2D, Texture } from '@egret/engine';

function resizePanel(mesh: Mesh2D, textureLease: AssetLease<Texture>): void {
  const source = {
    sourceWidth: 8, sourceHeight: 8,
    insets: { left: 2, top: 2, right: 2, bottom: 2 },
  };
  const a = createNineSliceGeometry2D({ ...source, targetWidth: 16, targetHeight: 12 });
  mesh.setContent(textureLease, a);
  const b = createNineSliceGeometry2D({ ...source, targetWidth: 12, targetHeight: 16 });
  mesh.setContent(textureLease, b);
}
```

Contract review does not establish a CPU/type/GPU PASS, a shipped API or cross-device behavior. Actual implementation and independent verification will be recorded separately, including real immutable captures, complete readback buffers, resource cleanup and the environment boundary. No phone, native SDK, comparative performance or complete UI/Spine claim follows from this specification.

Related existing contracts: [owned textured geometry and Mesh2D](textured-geometry-and-mesh2d-contract.md), [Scope ownership](scope-private-ownership.md). NS1 is an independently authored extension of these first-party public contracts.
