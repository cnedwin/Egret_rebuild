# Shared UI masks and blur

English | [简体中文](../../Cns/docs/shared-ui-effects.md)

M3.4 / [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) · Bounded implementation

## Use

Create a shared WebGPU or WebGL2 Host with `enableEffects: true`. Set `DisplayObject.renderEffect` before publishing managed UI content:

```ts
panel.renderEffect = {
    blurRadius: 2,
    alphaMask: maskBitmap,
    maskRect: { x: 0, y: 0, width: 320, height: 240 },
};
// Remove the effect without changing the display tree or input routing.
panel.renderEffect = undefined;
```

The immutable descriptor accepts an integer blur radius from 0 through 8 logical pixels. Omitted radius means zero. A mask requires a positive maskRect in the affected node's local coordinates. The mask Bitmap borrows its ordinary live texture lease in the same Engine; no new asset loader or reference-counting system is introduced. Its own display transform, alpha and parent do not position the mask. Mask RGB is ignored. The mask is not automatically hidden if also attached to a display tree. Initially only full-image, untrimmed, unrotated mask views are admitted; cropped/atlas mask views refuse explicitly.

Effects apply to the subtree's rendered content. Drawing order remains stable. Children retain existing per-draw opacity and material semantics; the composited effect uses normal source-over. Destination-dependent blends inside an isolated group operate against that group's transparent target, not the outer scene. Opaque-output-only add-preserve blending is refused inside an effect. No background/backdrop blur is supplied.

## Rendering and limits

The shared schedule renders a group to transparent linear-premultiplied working color, applies a fixed horizontal/vertical box blur, multiplies by nearest-sampled mask alpha, applies inherited rectangular clips, then composites into its parent. Intermediate sRGB targets use the existing hardware decode/store convention. The blur radius is ceil(logical radius × Host pixelRatio), capped at 16 backing pixels; samples outside the viewport are transparent. Nested groups run from inner to outer. This is one fixed kernel, not a general shader/filter graph or Gaussian-blur compatibility claim.

Each group uses the current surface extent. There are at most eight groups per frame, four nested levels, and eight inherited clip rectangles per group. Effect clips also debit the caller's ordinary maxClipRectangles limit. Two scratch/color targets per active nesting level share existing Host retention pools. The ordinary working target plus effect targets must fit 64 MiB per submission and 128 MiB pending color credit. Each group owns 576 bytes of uniform input (448 before the [filters](filters.md) were added), included in upload admission. Source pages retain their existing image budgets. Singular or unrepresentable effect coordinate maps refuse before native allocation.

Effect targets are pooled allocations, not cross-frame cached output pixels. A submitted effect is recomposited; this increment makes no static-effect GPU-time or frame-rate improvement claim. Existing paragraph preparation and image residency reuse remain available.

## Ownership, recovery and compatibility

Captured effects retain immutable transform, clip, settings and image identities. Later parameter changes do not rewrite saved frames. Mask replacement uses the existing Bitmap/resource slot semantics; disposal or an invalid mask lease prevents a new capture. Rendering effects neither enlarge hit areas nor create pixel-accurate mask hit testing. Existing explicit hit regions and input owners remain authoritative.

Immediate and staged submissions use the same Host resource reservations, pending records and completion-based retirement. Cancellation retires only the cancelled record. Device loss invalidates the native generation; recovery reconstructs effects from the same CPU frame and source resources without a separate manager. The fixture uses an actual WebGL context loss and an explicitly owned/borrowed WebGPU device destruction/replacement, not synthetic success flags.

No-effect rendering remains supported without enabling the capability. An effect submitted to a shared Host without enableEffects is refused before allocation. Legacy Canvas/ordinary/textured captures refuse active renderEffect rather than silently dropping it. The descriptor may be removed to return to those paths; there is no automatic visual downgrade. Touch routing, gestures and mobile controls are unchanged.

## Example and evidence

The [existing paragraph UI example](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/paragraph-panel) accepts `?content=equipment&effects=1&backend=webgl2` or `backend=webgpu`. Cycle mask, blur, both and off on the ordinary column and variable-height list. Changing effects republishes both through their existing UI transactions. The default example does not enable effects.

The [verification summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/effects-verification-summary.json) records 82 successful bounded native/UI checks: both backends at DPR 1 and 3, independent procedural pixel references (maximum permitted channel difference 4), nested effects, transformed masks, clips, staged uploads, cancellation, warm reuse, actual native recovery, cleanup and existing UI replacement. Pixel references are independently calculated from rectangles, mask quadrants and the declared box kernel; comparing two backends alone is not the oracle. Source inputs are hashed before/after the run. Earlier failures remain separate from the passing receipt.

Run `node examples/paragraph-panel/verify-effects.mjs <playwright-1.62.1-root> <new-output-directory>` after the ordinary build. It uses default headless Edge with no additional flags and saves raw pixels, screenshots and source identities. The public behavior tests join the normal test suite. Independent review, complete source/type/publication/bilingual gates and protected CI remain separate delivery requirements.

This does not close full M3.4/M4, complete themes/controls, IME, accessibility, phone/native/minigame support or performance qualification. M1.2 remains 10.3 ms against its 8 ms target. The effect code, procedural mask, shaders and mathematical references are independently authored first-party Apache-2.0 work. Existing attributed paragraph/font dependencies are reused unchanged.

The example reserves two effect groups for article blocks and decorates only the first six stable list keys. Other rows render normally, so short lines, line clamping and scrolling cannot exceed the eight-group limit.
