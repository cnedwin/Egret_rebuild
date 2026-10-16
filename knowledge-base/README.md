# Egret Engine knowledge base

English | [简体中文](README.zh-CN.md)

The 0.56.0 [Bitmap resource slot](en/docs/bitmap-resource-slot-spec.md) adds explicit replacement for one persistent Bitmap: borrow the initial binding, retain the prior usable binding while a request is pending or rejected, and commit only the latest accepted intent. Read the [evidence record](en/docs/bitmap-resource-slot-evidence.md) and [composition example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md). Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence.

The knowledge base explains Egret's product direction, architecture, public contracts and delivery. Choose a complete reading edition:

- [English](en/README.md)
- [简体中文](Cns/README.md)

Begin with [product positioning](en/docs/design-philosophy-and-positioning.md), [requirements](en/docs/product-requirements.md) and the [technical white paper](en/docs/technical-white-paper.md). The [capability overview](en/docs/core-progress.md) and [Changelog](en/CHANGELOG.md) describe implementation and version history.

Design documents explain the reasoning behind the product. API contracts define behavior; verification records state what was exercised; registries track requirements, decisions and delivery. Research references and historical experiments are available through the reading editions.

白鹭引擎的产品定位、架构、接口契约与交付进展，均提供完整中英文版本。请从所需语言入口开始阅读。
