# Egret Engine knowledge base

English | [简体中文](../Cns/README.md)

Egret connects complex 2D interfaces and lightweight 3D with a rendering/runtime core, resource and animation systems, creation tools and project automation. This knowledge base explains how those parts fit together and how the project verifies them.

## M2–M4 architecture and community delivery

[M2–M4 architecture and community delivery](docs/m2-m4-delivery-plan.md) · [M2](docs/m2-spine-content-plan.md) · [M3](docs/m3-ui-text-input-plan.md) · [M4](docs/m4-core-acceptance-plan.md)

## Start here

| Topic | Read |
| --- | --- |
| Product direction | [Positioning](docs/design-philosophy-and-positioning.md) |
| Product direction | [Requirements](docs/product-requirements.md) |
| Architecture | [Technical white paper](docs/technical-white-paper.md) |
| Architecture | [System architecture](docs/technical-architecture.md) |
| Architecture | [Rendering and runtime](docs/rendering-engine-and-runtime.md) |
| Architecture | [Product components](docs/product-components.md) |
| Engineering | [Engineering plan](docs/engineering-plan.md) |
| Engineering | [Delivery and acceptance](docs/delivery-plan.md) |
| Engineering | [Project structure](docs/engineering-architecture-and-project-structure.md) |
| Engineering | [API design](docs/public-api-design-and-naming.md) |
| Creation and compatibility | [AI/project interfaces](docs/ai-creation-and-engineering-interfaces.md) |
| Creation and compatibility | [Spine support](docs/spine-animation-support-and-acceptance.md) |
| Creation and compatibility | [Legacy migration](docs/legacy-project-migration.md) |
| Current integration | [M1 rendering/resource plan](docs/m1-rendering-resource-plan.md) |
| Current integration | [M1.4 WebGL2 executor](docs/webgl2-executor-contract.md) · [Evidence](docs/webgl2-executor-evidence.md) |
| Current integration | [Experimental WebGPU image residency](docs/gpu-image-residency-contract.md) · [Evidence](docs/gpu-image-residency-evidence.md) |
| Current integration | [Atlas import planner](docs/atlas-import-plan-contract.md) · [Evidence](docs/atlas-import-plan-evidence.md) |
| Current integration | [Atlas-frame layout](docs/atlas-frame-layout-contract.md) · [Evidence](docs/atlas-frame-layout-evidence.md) |
| Current integration | [Prepared resource groups](docs/prepared-resource-groups-spec.md) |
| Current integration | [Real-resource scene](docs/resource-scene-integration.md) |
| Status and participation | [Capability overview](docs/core-progress.md) |
| Status and participation | [Changelog](CHANGELOG.md) |
| Status and participation | [Contributing](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md) |
| Sources | [Acknowledgements](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md) |

## Experimental WebGPU image residency — 0.61.0

The **0.61.0 engineering preview** adds an internal image cache with per-Host ownership, reusing exact cropped GPU images after safe completion. Its LRU mechanism keeps a 32 MiB logical image pool and at most 256 ready entries, preserving existing public admission, rendering profiles and lifecycle management. It adds no public API or dependency.

Read the [contract](docs/gpu-image-residency-contract.md) and [evidence and limits](docs/gpu-image-residency-evidence.md). Controlled specification/ownership results and any current desktop regression results have separate scopes. The new dedicated cache browser matrix remains deferred and OPEN. Physical GPU memory, performance, target devices and actual device-loss recovery remain unverified. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## Atlas import planning — 0.60.0

The **0.60.0 engineering preview** adds the optional `@egret/project/atlas` entry: strict single-page Aseprite stable-marker JSON-array planning with one explicit PNG binding. Its two runtime values and sixteen erased types produce owned, frozen inputs for the existing SpriteSheet and SequenceClip factories. The exact profile is `aseprite-json-array-1.3.18.6-v1`; exporter output compatibility, declared hashes and entitlement remain unverified.

Read the [contract](docs/atlas-import-plan-contract.md) and [evidence and limits](docs/atlas-import-plan-evidence.md).

Independently accepted saved results are focused planner 47/47, the earlier normal SDK run with core 3625/3625 and separate F2 160/160, and the distinct CPU firstGREEN 5/5. These overlapping scopes are not added together. Independent review also accepts the selected new Native Canvas/WebGPU four-readback result. Final integrated gates/prepush and 0.60 Git/remote delivery remain pending. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

The preceding 0.59 increment was delivered through [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48), Main `44f49f9d97a7baebc400fd4940541529dc33d147`. Earlier 0.59 readings and evidence retain their original authoring cutoffs; the new delivery statement does not rewrite them. No remote statuses or check runs were reported, so no CI pass is inferred.

## Normalized atlas frames — 0.59.0

The **0.59.0 engineering preview candidate** implements normalized single-page atlas frames with the explicit `'trim-rotation-v1'` profile. SpriteSheet and SequenceClip preserve a sprite's logical canvas when transparent margins are removed or pixels are packed clockwise by 90 degrees. Bitmap placement and natural dimensions stay consistent across animation frames; omitted or `undefined` profiles keep the existing rectangle behavior.

The [trimmed-atlas example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md) composes two independent once/loop actors from one immutable clip, with anchors and parent clipping. Read the [layout contract](docs/atlas-frame-layout-contract.md) and [evidence and limits](docs/atlas-frame-layout-evidence.md) for input, ownership and verification details.

At the 2026-10-17 authoring cutoff, SDK behavior, strict consumers and source-boundary checks have accepted results. The separately reviewed desktop Canvas and textured WebGPU runs completed six fresh contexts and 30 full RGBA readbacks, including assigned controls and saved-frame replay after origin retirement. Final publication/prepush checks and 0.59 Git/remote delivery remain pending. Workspace packages remain private 0.0.0; the Host protocol remains 1.0.

## Prepared resource groups — 0.58.0

Engineering preview **0.58.0** adds `Engine.captureBitmapBindings(scope, targets)` and the erased `BitmapBindingTicket` type. The prepared-outfit example waits for both clothing textures and commits their bindings together. Pending, failed, cancelled and obsolete changes preserve the working outfit; a ticket refuses to overwrite a later caller binding.

Recorded desktop Canvas and WebGPU checks passed six fresh contexts with 54 original RGBA readbacks, including separate old-layer controls, genuine mouse selection, animation boundaries and shutdown with original reads still pending. This is finite desktop evidence. General dependency manifests, additional content types, full UI, Spine, production hosts, mobile performance and physical-memory acceptance remain open.

Read the [contract](docs/prepared-resource-groups-spec.md), [evidence and limits](docs/prepared-resource-groups-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md).

## Real-resource scene — 0.57.0

Engineering preview **0.57.0** combines real PNG resources, shared atlas playback, text and mouse input through existing public Engine APIs. Canvas is the default; the textured WebGPU scene is an explicit experimental choice. Resource preparation, presentation readiness, input readiness and safe shutdown have separate boundaries. Read the [integration record](docs/resource-scene-integration.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md).

The recorded desktop Canvas/WebGPU workflow completed seven fresh contexts and retained 64 original RGBA frames. Fixed-point and font-region comparisons, negative controls and retirement passed in the documented environment. Phone, cross-environment font, performance and energy acceptance remain open.

## Delivered resource replacement — 0.56.0

The 0.56 resource-replacement increment was delivered through [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45), Main `19c308af4d7c9590f886c8105d5d678e708184c5`. Earlier verification records retain their original cutoffs.

Engineering preview **0.56.0** focuses on recoverable resource replacement. `Engine.createBitmapResourceSlot(scope, bitmap)` replaces the Texture of one persistent Bitmap through the existing root entry, adding the erased `BitmapResourceSlot` and `BitmapResourceSlotState` types. The slot borrows the initial binding and owns fresh replacement leases; pending, failed or cancelled requests preserve the prior usable binding, and only the latest accepted intent may commit. Promise rejection and lifecycle details follow the [specification](docs/bitmap-resource-slot-spec.md). Read the [evidence](docs/bitmap-resource-slot-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md). Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence.

The previous 0.55 layout increment was delivered through [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44). The [capability overview](docs/core-progress.md) describes wider interfaces and remaining work. Workspace packages remain private 0.0.0; the host protocol remains 1.0.

## API contracts and examples

Use the [documentation guide](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.md) for subsystem contracts, evidence and runnable examples. Detailed contracts define ownership, ordered observations, errors and resource retirement. Example guides explain how to run each supported path.

## Records and history

The [requirements](registry/requirements.json), [decisions](registry/decisions.json), [hypotheses](registry/hypotheses.json), [deliverables](registry/deliverables.json) and [sources](registry/sources.json) share one status model with their Chinese originals.

Historical research is collected in [round 1](archive/round-1-research.md), [round 2](archive/round-2-research.md) and [round 3](archive/round-3-research.md). Dates, fixed versions and experimental results retain their stated scope. Historical checkpoints are described in the Changelog and linked records.

## Contribute

Start with the [knowledge-base contribution guide](CONTRIBUTING.md). Use [RFC](templates/rfc-proposal.md), [ADR](templates/adr-decision-record.md), [experiment](templates/experiment-and-acceptance.md) and [implementation-origin](templates/implementation-origin-record.md) templates when they fit the contribution. Maintain both language editions and follow the [maintenance policy](docs/knowledge-base-maintenance.md).
