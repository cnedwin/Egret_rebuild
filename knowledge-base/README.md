# Egret Engine knowledge base

English | [简体中文](README.zh-CN.md)

## Experimental WebGPU image residency — 0.61.0

The **0.61.0 engineering preview** adds an internal image cache with per-Host ownership, reusing exact cropped GPU images after safe completion. Its LRU mechanism keeps a 32 MiB logical image pool and at most 256 ready entries, preserving existing public admission, rendering profiles and lifecycle management. It adds no public API or dependency.

Read the [contract](en/docs/gpu-image-residency-contract.md) and [evidence and limits](en/docs/gpu-image-residency-evidence.md). Controlled specification/ownership results and any current desktop regression results have separate scopes. The new dedicated cache browser matrix remains deferred and OPEN. Physical GPU memory, performance, target devices and actual device-loss recovery remain unverified. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## Atlas import planning — 0.60.0

The **0.60.0 engineering preview** adds the optional `@egret/project/atlas` entry: strict single-page Aseprite stable-marker JSON-array planning with one explicit PNG binding. Its two runtime values and sixteen erased types produce owned, frozen inputs for the existing SpriteSheet and SequenceClip factories. The exact profile is `aseprite-json-array-1.3.18.6-v1`; exporter output compatibility, declared hashes and entitlement remain unverified.

Read the [contract](en/docs/atlas-import-plan-contract.md) and [evidence and limits](en/docs/atlas-import-plan-evidence.md).

Independently accepted saved results are focused planner 47/47, the earlier normal SDK run with core 3625/3625 and separate F2 160/160, and the distinct CPU firstGREEN 5/5. These overlapping scopes are not added together. Independent review also accepts the selected new Native Canvas/WebGPU four-readback result. Final integrated gates/prepush and 0.60 Git/remote delivery remain pending. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

The 0.56.0 [Bitmap resource slot](en/docs/bitmap-resource-slot-spec.md) adds explicit replacement for one persistent Bitmap: borrow the initial binding, retain the prior usable binding while a request is pending or rejected, and commit only the latest accepted intent. Read the [evidence record](en/docs/bitmap-resource-slot-evidence.md) and [composition example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md). Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence.

The knowledge base explains Egret's product direction, architecture, public contracts and delivery. Choose a complete reading edition:

- [English](en/README.md)
- [简体中文](Cns/README.md)

Begin with [product positioning](en/docs/design-philosophy-and-positioning.md), [requirements](en/docs/product-requirements.md) and the [technical white paper](en/docs/technical-white-paper.md). The [capability overview](en/docs/core-progress.md) and [Changelog](en/CHANGELOG.md) describe implementation and version history.

Design documents explain the reasoning behind the product. API contracts define behavior; verification records state what was exercised; registries track requirements, decisions and delivery. Research references and historical experiments are available through the reading editions.

白鹭引擎的产品定位、架构、接口契约与交付进展，均提供完整中英文版本。请从所需语言入口开始阅读。
