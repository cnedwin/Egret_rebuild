# Display anchor offsets

English | [简体中文](../../Cns/docs/显示锚点偏移契约.md)

Engineering preview 0.52.0 · S106 / V057. This contract covers the two inherited scalar properties. [Evidence](display-anchor-offsets-evidence.md) records each verification cutoff separately.

## Public values and lifetime

`DisplayObject.anchorOffsetX: number` and `anchorOffsetY: number` define a local pivot for existing display subclasses, including Sprite, Bitmap and Stage. Both start at +0. An element can scale or rotate about its authored pivot while its position continues to place that pivot in its parent's coordinates.

Each property accepts every finite primitive number, including negative values, pivots outside the content and -0, and stores the exact value. NaN, infinities and non-number values fail with `DISPLAY_VALUE_INVALID`; objects are not coerced through valueOf or toString.

Both accessors authenticate genuine private display-node identity. Forged receivers and proxies fail with `INVALID_DISPLAY_OBJECT` without shape inspection. Getters retain stored observations after disposal or Engine close. Setter refusal order is identity, `OBJECT_DISPOSED`, bound `ENGINE_CLOSED`, then value validation. A refused write retains the earlier scalar. Each axis is independent; no combined transaction, subclass hook or lifecycle event is added.

## Transform and exact zero compatibility

Keep the existing binary64 coefficients: `a=cos*scaleX`, `b=sin*scaleX`, `c=-sin*scaleY`, `d=cos*scaleY`. For a nonzero pivot, local translation is evaluated left to right:

```text
localTx = x - a * anchorOffsetX - c * anchorOffsetY
localTy = y - b * anchorOffsetX - d * anchorOffsetY
```

The existing parent-times-local expressions then compose that translation. The local pivot maps to authored (x,y) in the parent frame, subject to ordinary binary64 arithmetic.

When both offsets compare equal to zero, including -0, the exact old translation expressions and evaluation order are retained. Extra zero products or regrouped arithmetic would change this contract. Default-zero compatibility uses original observed matrix bytes and signs, rather than idealized arithmetic.

## Coordinates, bounds, clips and resources

- localToGlobal/globalToLocal include the receiver and its ancestors' pivots. Existing budgets, singular-transform refusal, arithmetic errors and frozen results remain applicable.
- getBounds remains receiver-local content measurement. It excludes the receiver's own pivot/transform and all ancestors, includes descendant pivots, and retains its existing visibility/clip treatment. A pivot edits neither geometry nor Texture source rectangles.
- clipRect and explicit hitArea stay in authored local coordinates. Captures and Stage.hitTest use the same pivoted matrix and existing clip/touch rules. A pivot creates no implicit hit region, scrollRect, inferred size or layout anchor.
- Legacy/image and textured captures share the transform. Saved frozen frames retain their earlier matrices, geometry and owned image data after later pivot edits. Existing renderer ports and frame schemas remain unchanged.
- Anchor operations add no owner transfer, permanent Engine-affinity change, listener mutation, Bitmap lease replacement, Texture disposal, sourceRect update or TextField raster ownership change. Existing Scope/resource admission and cleanup remain authoritative.
- A finite stored pivot may overflow later composition. Existing coordinate, bounds, hit-test and frame errors remain authoritative, including `COORDINATE_ARITHMETIC_RANGE`, `BOUNDS_ARITHMETIC_RANGE`, `HIT_TEST_ARITHMETIC_RANGE` and `FRAME_TRANSFORM_INVALID`. A failed capture publishes no public frame or renderer invocation. Own-local getBounds still excludes an extreme own pivot.

## Hand-checkable example

Use an identity Stage, parent position (5,7), child position (20,30), scale (2,1), rotation 0, pivot (4,3), and child rectangle (0,0,8,6).

| Observation | Result |
| --- | --- |
| Child pivot (4,3), global | (25,37) |
| Child origin, global | (17,34) |
| Child getBounds | (0,0,8,6) |
| Parent getBounds | (12,27,16,6) |
| Child matrix | a=2, b=0, c=0, d=1, tx=17, ty=34 |

An authored local clip (0,0,4,6) clips rendering and explicit picking at the same transformed edge; it does not shrink logical bounds. Picking additionally needs touchEnabled=true and hitArea (0,0,8,6), with no other interactive node. Non-axis rotations use ordinary binary64 trigonometry; the bounded coordinate fixtures use tolerance 1e-10, while zero compatibility compares exact original bytes.

## Scope

The implementation changes three existing runtime files and reuses the shared transform's five consumers. It adds no root value/type, package entry, runtime module, dependency or renderer command. Packages remain private 0.0.0 and host protocol 1.0.

The separately bounded desktop Native schedule uses opaque rectangles and saved replay. It establishes no new Native SDK/backend, physical GPU identity, fonts, mobile-platform coverage, GC or performance result. Full Spine R020/V020, migration R008/V006, complete EUI/layout, advanced 3D and AI interfaces remain OPEN or unverified. See the [remaining plan](display-anchor-offsets-implementation-plan.md).
