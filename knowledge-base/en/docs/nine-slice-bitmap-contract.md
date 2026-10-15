# NineSliceBitmap contract

English | [简体中文](../../Cns/docs/九宫格位图契约.md)

Engineering preview **0.48.0** · **S102 / V053**. `NineSliceBitmap` is a stretch-only display leaf for panel, button and dialog backgrounds whose borders retain their local thickness when the target size changes. It reuses the independently authored [NS1 geometry](nine-slice-geometry-ns1-contract.md), genuine Texture leases and existing textured rendering. The [evidence](nine-slice-bitmap-evidence.md) and [native verifier guide](nine-slice-bitmap-native-verifier.md) retain separate acceptance cutoffs.

## Public API

The `@egret/runtime` and `@egret/engine` roots add exactly one runtime value, `NineSliceBitmap`, and one erased type, `NineSliceBitmapOptions`. Engine forwards the actual runtime bindings. Existing `NineSliceInsets2D` is reused. Other entries and package subpaths gain no new names; the core remains DOM/Node-free.

```ts
interface NineSliceBitmapOptions {
  readonly width: number;
  readonly height: number;
  readonly insets: NineSliceInsets2D;
}

class NineSliceBitmap extends DisplayObject {
  constructor(textureLease: AssetLease<Texture>, options: NineSliceBitmapOptions);
  get textureLease(): AssetLease<Texture> | undefined;
  get targetWidth(): number;
  get targetHeight(): number;
  get insets(): NineSliceInsets2D;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

This is a display leaf, not a Bitmap/Mesh2D subclass or container. Its declared private nominal marker supports typing; module-owned identity supplies actual receiver authority. It has no texture/content/sourceRect setter, geometry port, asset loader, implicit scheduler or cache. Ordinary inherited transforms, alpha, visibility, clipRect and explicitly authored hitArea remain available. Target dimensions are local sizes; scale is a separate transform.

## Source view and borrowing

The input must be an actual manager-issued `AssetLease<Texture>`. Runtime-private identity/value and Texture live-snapshot readers authenticate it; public getters and structural lookalikes confer no authority. The source dimensions come from that Texture's immutable integer crop, including nonzero x/y. NS1 UVs are local to the crop and the textured command retains the original absolute sourceRect. The leaf does not copy image pixels or infer packed/rotated atlas metadata. A SpriteSheet crop or returned Bitmap is not a substitute for a Texture lease.

The leaf borrows the exact caller-owned lease. It acquires no second lease, releases neither the lease nor Texture, and creates no implicit resource request. Register the genuine lease before `scope.use(leaf)` to obtain reverse cleanup ordering. The actual API is `Scope.use`; there is no `Scope.adopt`. Existing cross-Engine Scope/tree attachment still refuses with `ENGINE_MISMATCH`.

## Admission and resize

Constructor order is lease identity → entitlement → Texture identity/live snapshot → Engine open, before external options reads. Lookalike leases receive `NINE_SLICE_BITMAP_LEASE_INVALID`; non-Texture values receive `NINE_SLICE_BITMAP_TEXTURE_INVALID`. Existing `ASSET_LEASE_RELEASED`, `TEXTURE_DISPOSED` and `ENGINE_CLOSED` errors remain distinct.

Options/insets must be non-null, non-array objects; inherited properties and getters are allowed. Read exactly once in this order: width, height, insets, left, top, right, bottom. Unknown keys are not enumerated and no iterator/coercion is used. After each successful read, check Engine, then the same lease, then the live Texture before the next read or semantic admission. A throwing read stops immediately with TypeError and its exact original cause, including undefined; a post-failure lifecycle check does not replace it. Captured admission/error/freezing operations preserve this functional contract across descriptor callbacks; this is not process or adversarial isolation.

All primitive-number checks precede range checks. The existing NS1 factory governs finite positive source/target dimensions, finite nonnegative borders, source border sums strictly below source dimensions, target sizes at least the border sums and precision refusals. Fractions and intentional zero target centers are accepted; border signed zero is normalized. There is no border compression, tiling, coercion or default border.

`resize` authenticates the receiver, display lifetime, Engine and exact resource entitlement before numeric semantics. It builds fresh owned NS1 geometry, even for the same target size, then publishes geometry and dimensions together without callbacks/events/public setters. Every pre-commit failure retains the previous committed dimensions/geometry; rollback does not revive independently retired resources. Saved Engine frames retain their earlier owned geometry/image values. Allocation-before-commit is a source obligation, not an executed physical OOM experiment.

## Identity, bounds and retirement

Mesh2D's class identity is separate from its shared capture-content slot. Borrowed Mesh2D operations on this leaf refuse `MESH_INVALID`; borrowed NineSliceBitmap members on other objects refuse `NINE_SLICE_BITMAP_INVALID`. The new leaf cannot gain a mutable Mesh content port through shared capture registration.

Own bounds are `(0, 0, targetWidth, targetHeight)`; parent bounds use ordinary transforms. Capture charges the unchanged NS1 eighteen-triangle geometry to existing budgets. Cached geometry does not disappear because visibility, alpha, clipping or resource entitlement changes; actual Engine/display lifetime and traversal rules still apply. Resizing does not alter hitArea automatically.

Metadata getters require genuine receiver identity but do not authorize resources or require Engine open. Dimensions and the same frozen inset snapshot remain readable after disposal. `textureLease` returns the exact borrow while the leaf is live, even if the lease retired independently, and undefined after leaf disposal. Disposal drops content and borrow references before normal base terminal cleanup; it is idempotent and works after Engine closure. Bounds/resize still refuse disposed objects.

## Rendering and use

| Route | Behavior |
| --- | --- |
| `captureTexturedFrame` / recording textured host | Existing owned textured-frame profile; CPU composition alone is not native pixel proof. |
| Explicit `createTexturedWebGPUHost` | The positive rendering route; real-browser acceptance is recorded separately. |
| `createEngineForProfile` with Canvas host | `ENGINE_RENDER_PROFILE_UNSUPPORTED` before rendering; no positive Canvas mesh route. |
| Canvas submission of genuine textured frame | `CANVAS_FRAME_PROFILE_UNSUPPORTED` before target mutation. |
| Ordinary non-textured capture/render | Visible occupied leaf retains `FRAME_MESH_UNSUPPORTED`; existing skipped branches remain unchanged. |

After selecting a genuine textured host/Engine and obtaining a registered Texture lease:

```ts
scope.use(lease);
const panel = new NineSliceBitmap(lease, {
  width: 16, height: 12,
  insets: { left: 2, top: 2, right: 2, bottom: 2 },
});
scope.use(panel);
engine.stage.addChild(panel);
const saved = engine.renderTexturedFrame({ width: 20, height: 20 });
panel.resize(12, 16);
engine.renderTexturedFrame({ width: 20, height: 20 });
// The saved frame retains its earlier owned geometry.
```

The example assumes an 8 × 8 source view. Shutdown retires the owning Scope/Engine and host under their existing contracts. The runnable recording example is `examples/nine-slice-bitmap-headless.mjs`; it measures no browser pixels.

## Provenance and remaining work

The leaf, class identity repair, captured Texture intrinsic, tests and original fixtures are independently authored **Apache-2.0** Egret work. They reuse first-party NS1, Texture, Mesh2D, AssetLease, Scope, capture and bounds contracts. AI assisted source/test/document preparation; independent source and saved-result review qualify only their recorded scopes. The increment adds no dependency, shader, decoder, frame format or SDK protocol. Packages remain private **0.0.0**, host protocol **1.0**.

This background leaf does not implement full EUI/layout, scrolling/input controls, tiling, rotated/trimmed atlases, old scale9Grid migration or 3D materials. Full Spine **R020/V020** and migration **R008/V006 remain OPEN**. Mobile/native SDKs, platform hosts, fonts, physical GPU/GC, power and comparative performance remain separate work.
