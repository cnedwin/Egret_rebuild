# Explicit local linear layout

English | [简体中文](README.zh-CN.md)

This original application plans two bitmap Buttons through the optional built `@egret/engine/layout` entry, then applies the returned local coordinates using existing display APIs. One genuine Engine, shared MouseInput, separately owned Button Scopes and a borrowed programmatic atlas retain the existing bitmap-button lifecycle.

## Run

From the repository root, run `node tools/build.mjs`, serve the repository root over ordinary local HTTP, then open `/examples/linear-layout/`. Canvas is the default. Select WebGPU explicitly, or open `/examples/linear-layout/?backend=webgpu`. WebGPU requires browser support; unavailable startup is reported without changing backend. Switching renderer waits for the current Engine close chain before navigation.

Both preview and verification use a 24 × 24 logical scene at DPR 1, enlarged eight times by CSS. `?preset=verification&backend=canvas` and `?preset=verification&backend=webgpu` select the verification path. In WebGPU verification, each original submission arms a genuine readback; startup waits for the original ancillary ticket before creating layout containers. The evidence record bounds the actual readbacks and startup-order checks.

## Use the controls

- Horizontal and Vertical restore both enabled controls in their original order.
- Hide and filter first removes the first numeric record and hides its control. Reinsert first after second restores it after the second control. Both preserve the selected axis.
- Disable first and Enable first retain both layout records and change first-control availability.
- Reject invalid gap plans with `gap: -1` before any scene write. It reports `LAYOUT_OPTIONS_INVALID` and retains the last valid plan and scene.
- Replay saved horizontal presents the original captured frame while the live tree keeps its current state. Show live returns to the current controls.
- Close awaits the original Button/MouseInput/resource and Engine retirement chain. The application does not close the Host or release the borrowed atlas twice.

Red indicates up, blue pressed and gray disabled. Status displays the current plan, order, Button states, activation counters, presentation, atlas loads/disposals and expected refusal.

## Understand the placement

The caller supplies two 8 × 6 records, gap 2, padding 2 and start alignment. The horizontal plan is 22 × 10; the vertical plan is 12 × 18. Nested containers add (3,3), and the outer clip cuts the horizontal second Button's right edge. Each Button retains an explicit local hit area. Filtering, child order and applying coordinates are explicit caller actions; the planner does not discover bounds, inspect visibility or mutate the scene.

The source and first-party programmatic atlas use Apache-2.0. The application reuses the existing bitmap-button example and adds no dependency, default API or SDK Host protocol.

## Verification scope

Recorded desktop Canvas/WebGPU checks cover the fixed two-Button workflow; their environment and limits are in the evidence record. The profile uses default desktop Edge 155.0.4283.45 with no extra flags, 24 × 24 and DPR 1. It establishes no phone performance, Native SDK, automatic EUI layout or general Host support.

Read the [specification](../../knowledge-base/en/docs/local-linear-layout-spec.md) and [evidence record](../../knowledge-base/en/docs/local-linear-layout-evidence.md) for exact semantics and result boundaries.
