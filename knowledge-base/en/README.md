# Egret Engine knowledge base

English | [简体中文](../Cns/README.md)

Egret connects complex 2D interfaces and lightweight 3D with a rendering/runtime core, resource and animation systems, creation tools and project automation. This knowledge base explains how those parts fit together and how the project verifies them.

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
| Status and participation | [Capability overview](docs/core-progress.md) |
| Status and participation | [Changelog](CHANGELOG.md) |
| Status and participation | [Contributing](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md) |
| Sources | [Acknowledgements](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md) |

## Current engineering state

Engineering preview **0.55.0** adds explicit local linear planning: callers select membership and apply placements to existing Buttons. Read the [specification](docs/local-linear-layout-spec.md), [evidence](docs/local-linear-layout-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/linear-layout/README.md). Recorded desktop Canvas/WebGPU checks cover the fixed two-Button workflow; their environment and limits are in the evidence record. The [capability overview](docs/core-progress.md) describes wider interfaces and remaining work. Workspace packages remain private 0.0.0; the host protocol remains 1.0.

## API contracts and examples

Use the [documentation guide](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.md) for subsystem contracts, evidence and runnable examples. Detailed contracts define ownership, ordered observations, errors and resource retirement. Example guides explain how to run each supported path.

## Records and history

The [requirements](registry/requirements.json), [decisions](registry/decisions.json), [hypotheses](registry/hypotheses.json), [deliverables](registry/deliverables.json) and [sources](registry/sources.json) share one status model with their Chinese originals.

Historical research is collected in [round 1](archive/round-1-research.md), [round 2](archive/round-2-research.md) and [round 3](archive/round-3-research.md). Dates, fixed versions and experimental results retain their stated scope. Historical checkpoints are described in the Changelog and linked records.

## Contribute

Start with the [knowledge-base contribution guide](CONTRIBUTING.md). Use [RFC](templates/rfc-proposal.md), [ADR](templates/adr-decision-record.md), [experiment](templates/experiment-and-acceptance.md) and [implementation-origin](templates/implementation-origin-record.md) templates when they fit the contribution. Maintain both language editions and follow the [maintenance policy](docs/knowledge-base-maintenance.md).
