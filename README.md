# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

<!-- BB-0.54.0-BEGIN -->
## Engineering preview 0.54.0 — shared-input bitmap buttons

**S108 / V059 · 2026-10-15.** One reusable 2D control connects a genuine Bitmap, borrowed atlas lease, Scope lifetime and shared primary-mouse input. Press, enable and release operations commit the skin state; a final pick after the complete activate route determines one callback entitlement. The [two-button example](examples/bitmap-button/README.md) offers explicit Canvas/WebGPU, enable/disable, dispose/recreate and saved/live presentation.

Independent acceptance covers all nine local code phases, Core 3218/3218 and retained Spine Source 160/160; focused checks passed 163/163, and strict types produced 0 positive diagnostics and matched all 19 negative diagnostics. Independently accepted desktop Edge 155.0.4283.45 Canvas/WebGPU execution completed 38 main readbacks and 87552 channels at tolerance 0 with no mismatches. A fresh Canvas control adds 2 separate readbacks with main credit 0; its intentionally wrong blue expectation differs by 48 pixels and 96 channels. Final public bilingual review, normal prepush, mandatory hooks and new delivery remain PENDING. These overlapping counts are not added.

Read the [contract](knowledge-base/en/docs/bitmap-button-contract.md), [evidence](knowledge-base/en/docs/bitmap-button-evidence.md) and [remaining plan](knowledge-base/en/docs/bitmap-button-implementation-plan.md). The preceding 0.53 package was delivered through [PR #41](https://github.com/cnedwin/Egret_rebuild/pull/41); older sections below retain their original cutoffs, including recorded PENDING states. Complete EUI/layout, full Spine R020/V020, migration R008/V006, advanced 3D, AI, devices and performance remain open or unverified.

### Five recent changes

| Preview | Useful capability |
| --- | --- |
| 0.54.0 | Reusable shared-input bitmap buttons and a two-control example. |
| 0.53.0 | Runnable resource, atlas, clock-animation and display composition. |
| 0.52.0 | Authored pivots shared by capture, coordinates, bounds and picking. |
| 0.51.0 | Indexed insertion, same-parent positioning and reparenting. |
| 0.50.0 | Queries over genuine current direct-child order. |
<!-- BB-0.54.0-END -->

<!-- AAP-0.53.0-BEGIN -->
## Build and try the current playground

Engineering preview **0.53.0** · S107 / V058. The [anchored atlas playground](examples/anchored-atlas-playback/README.md) loads one genuine asset lease, creates named red/blue frames, plays them through the Engine clock, and positions a Bitmap around its authored pivot. Manual Step/Pause/Resume and saved/live presentation make the complete resource → animation → display → host chain visible.

Build with the fixed Node (`node tools/build.mjs`), serve the repository root over local HTTP, then open `/examples/anchored-atlas-playback/`. Canvas is the default; WebGPU is an explicit choice with visible unavailability. No automatic timer, new Engine API or dependency is added.

Current independent CPU/code acceptance covers 16 public-consumer tests, all 9 code phases, Core 3147/3147 and retained Spine Source 160/160. Desktop Edge 155.0.4283.45 Canvas/WebGPU acceptance covers 14 main readbacks and 32256 channels with zero mismatches at tolerance 0; the separate fresh Canvas control contributes 0 main cases. Public Source/bilingual review, normal full prepush, mandatory hooks and new 0.53 delivery remain PENDING; no remote CI PASS is claimed.

Read the [contract](knowledge-base/en/docs/anchored-atlas-playback-contract.md), [evidence](knowledge-base/en/docs/anchored-atlas-playback-evidence.md) and [remaining plan](knowledge-base/en/docs/anchored-atlas-playback-implementation-plan.md). The preceding 0.52 pivot package was delivered through [PR #40](https://github.com/cnedwin/Egret_rebuild/pull/40); its earlier PENDING passages remain historical.

## Five recent changes

| Preview | Useful capability |
| --- | --- |
| 0.53.0 | [Runnable anchored atlas composition](examples/anchored-atlas-playback/README.md), with explicit time and one owned resource chain. |
| 0.52.0 | [Authored display pivots](knowledge-base/en/docs/display-anchor-offsets-contract.md) shared by capture, coordinates, bounds, clipping and picking. |
| 0.51.0 | [Indexed child insertion](knowledge-base/en/docs/container-add-child-at-contract.md) with same-parent positioning and reparenting. |
| 0.50.0 | [Direct-child index queries](knowledge-base/en/docs/container-child-index-contract.md) over genuine current order. |
| 0.49.0 | [Detach all direct children](knowledge-base/en/docs/container-remove-children-contract.md) while retaining their cleanup owners. |

See the [complete changelog](knowledge-base/en/CHANGELOG.md), [knowledge base](knowledge-base/en/README.md), and [raw README snapshot through 0.52](knowledge-base/en/archive/root-readme-through-0.52.0.md.txt). The snapshot preserves the complete previous README bytes, including original links and recorded cutoffs; it is historical raw data rather than current navigation.

## Scope and contribution

This is an independent community rebuild from Egret specifications and familiar APIs, with first-party Apache-2.0 code, attributed AI assistance and separate Source/execution/delivery evidence. Packages remain private 0.0.0 and host protocol 1.0. Read [contribution guidance](CONTRIBUTING.md) and [acknowledgements](ACKNOWLEDGEMENTS.md).

Full Spine R020/V020, migration R008/V006, complete EUI/layout, advanced 3D, AI, fonts/IME, target devices/native SDKs and performance remain OPEN or unverified. Current examples and bounded checks do not close complete product acceptance.

Both exact raw archives: [English raw](knowledge-base/en/archive/root-readme-through-0.52.0.md.txt) · [Cns raw](knowledge-base/Cns/archive/根说明截至0.52.0.md.txt). They are unchanged historical data, not newly translated reading pages.
<!-- AAP-0.53.0-END -->
