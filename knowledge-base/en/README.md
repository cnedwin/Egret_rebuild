# Egret Engine knowledge base

English | [简体中文](../Cns/README.md)

Use this entry to find product and engineering documents for the community rebuild. [Current capabilities](docs/core-progress.md) records the reviewed source baseline and verification scope.

## Start with the current project

| Question | Read |
| --- | --- |
| What can I run now? | [Core capabilities and remaining work](docs/core-progress.md) |
| How do I start or contribute? | [Getting started](docs/getting-started.md) · [Contribution guide](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md) |
| What should be built next? | [Engineering plan](docs/engineering-plan.md) · [M2–M4 roadmap](docs/m2-m4-delivery-plan.md) |
| What is the complete product? | [Requirements](docs/product-requirements.md) · [Components](docs/product-components.md) · [Positioning](docs/design-philosophy-and-positioning.md) |
| How does it work? | [White paper](docs/technical-white-paper.md) · [Architecture plan](docs/architecture-and-engineering-plan.md) · [Actual/future package structure](docs/engineering-architecture-and-project-structure.md) |
| What counts as delivery? | [Delivery plan](docs/delivery-plan.md) · [Changelog](CHANGELOG.md) |

## Follow a subsystem

| Area | Contracts and active plan |
| --- | --- |
| Rendering/resources | [M1](docs/m1-rendering-resource-plan.md) · [Shared rendering](docs/shared-render-profile-contract.md) · [WebGL2](docs/webgl2-executor-contract.md) · [Recovery](docs/resource-recovery-contract.md) |
| Content/animation | [M2](docs/m2-spine-content-plan.md) · [Build/runtime](docs/content-build-pipeline.md) · [Spine](docs/spine-content-ingress.md) · [Spine seek](docs/spine-seek.md) · [Sequence RESET](docs/sequence-reset.md) |
| UI/text/input | [M3](docs/m3-ui-text-input-plan.md) · [Managed UI](docs/ui-data-panel.md) · [Paragraphs](docs/readonly-paragraph-sdk.md) · [Fonts](docs/font-resource-generations.md) · [Effects](docs/shared-ui-effects.md) · [Hover and wheel](docs/pointer-hover.md) · [Control state](docs/ui-controls.md) · [Semantics](docs/ui-semantics.md) · [Screens to start from](docs/ui-examples.md) |
| Sound | [Sound for a 2D game](docs/audio.md) |
| Gamepads | [Gamepads](docs/gamepad.md) |
| 2D world | [Camera](docs/camera-2d.md) · [Tile maps](docs/tilemap.md) · [Particles](docs/particles.md) |
| Mixed integration | [M4](docs/m4-core-acceptance-plan.md) · [Android scope](docs/android-device-validation.md) · [Clean consumer](docs/clean-consumer.md) |
| 3D | [Bounded 3D and 2D composition](docs/authored-scene3d.md) · [Standalone World3D](docs/world3d.md) |
| Future tools/compatibility | [Project transactions](docs/project-transaction-core-contract.md) · [AI/project interfaces](docs/ai-creation-and-engineering-interfaces.md) · [Complete migration](docs/legacy-project-migration.md) |

The [full documentation catalog](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.md) links lower-level contracts. Runtime entries, sources/licenses and exact verification remain in each subsystem record.

## Reading status and evidence

The current core is an engineering preview. The fixed desktop CPU and preparation targets in [#55](https://github.com/cnedwin/Egret_rebuild/issues/55) are met. Sparse and full-dirty pacing and GPU timing remain open. [Issues](https://github.com/cnedwin/Egret_rebuild/issues), [milestones](https://github.com/cnedwin/Egret_rebuild/milestones) and the [community board](https://github.com/users/cnedwin/projects/2) track the work packages.

Confirmed requirements and original evidence/decision/delivery registries retain their identities. English registry views are read-only translations of the authoritative Chinese records. A historical pending cutoff is read at its date, not promoted to a current project summary.

## Historical records and attribution

Use the [changelog](CHANGELOG.md), dated research archives and linked subsystem evidence for original measurements, failures, repairs and sources. The [previous knowledge-base home](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/en/README.md) preserves earlier preview prose and counts; this current index does not rerun or widen them.

First-party code/documentation remains Apache-2.0. Third-party dependencies, fonts and animation content retain their notices and conditions. [Acknowledgements](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md) and the [source ledger](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json) distinguish independent implementation, dependency integration, references and AI assistance.
