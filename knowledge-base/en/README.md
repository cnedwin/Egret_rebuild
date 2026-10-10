# Egret Engine Rebuild knowledge base

English | [简体中文](../Cns/README.md)

Egret serves new creators who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. Rendering and runtime, editable projects, Agent collaboration and complete legacy-project migration are central to the design.

The current engineering preview is **0.20.0**, with partial independently authored core implementation. The complete engine, production hosts, editor, Agent services, target-device performance and complete migration remain open. Engineering checkpoints, design proposals and accepted results are recorded separately.

## Start here

| Topic | Reading |
| --- | --- |
| Product direction | [Positioning](docs/design-philosophy-and-positioning.md) · [Product requirements](docs/product-requirements.md) · [Product components](docs/product-components.md) |
| Architecture and delivery | [Technical white paper](docs/technical-white-paper.md) · [Rendering and runtime](docs/rendering-engine-and-runtime.md) · [Engineering plan](docs/engineering-plan.md) · [Delivery plan](docs/delivery-plan.md) |
| Structure, API and code | [Engineering architecture](docs/engineering-architecture-and-project-structure.md) · [API and naming](docs/public-api-design-and-naming.md) · [Quality gates](docs/code-standards-and-quality-gates.md) |
| Implemented slices and evidence | [Core progress](docs/core-progress.md) · [Bitmap regions](docs/bitmap-region-evidence.md) · [B1 browser verifier](docs/b1-browser-verifier.md) · [Texture collection](docs/texture-first-four-evidence.md) |
| Animation and migration | [Spine support and acceptance](docs/spine-animation-support-and-acceptance.md) · [Sequence sampling](docs/sequence-clip-contract.md) · [Legacy MovieClip](docs/legacy-movieclip-evidence.md) · [Legacy-project migration](docs/legacy-project-migration.md) |
| AI creation | [AI creation and engineering interfaces](docs/ai-creation-and-engineering-interfaces.md) · [Shaders and Playground research](docs/shaders-and-playground-lessons.md) |
| Reference research | [Competitor evolution](docs/competitor-evolution-and-ecosystems.md) · [Open-source reference mechanisms](docs/open-source-reference-implementations-and-adoption.md) · [Backend and Native Runtime proposals](docs/graphics-backends-and-native-runtime-selection.md) |
| Historical experiments | [First round](archive/round-1-research.md) · [Second round](archive/round-2-research.md) · [Third round](archive/round-3-research.md) |
| Participation | [Contribution guide](CONTRIBUTING.md) · [Independent implementation policy](docs/independent-implementation-and-dependency-policy.md) · [Acknowledgements](ACKNOWLEDGEMENTS.md) · [Glossary](docs/glossary.md) |

## Spine requirement

Confirmed **R020** requires complete Spine animation support. **V020** remains planned, implementation not_started and acceptance not_run. Version matching, animation features, complex UI/3D composition, recovery, tools and migration are defined in the [support and acceptance matrix](docs/spine-animation-support-and-acceptance.md). This requirement amendment does not establish implemented compatibility.

## Records and history

[Requirements](registry/requirements.json), [decisions](registry/decisions.json), [hypotheses](registry/hypotheses.json), [deliverables](registry/deliverables.json) and [sources](registry/sources.json) provide the shared status views; their authoritative Chinese records are preserved in the Chinese edition. Stable R/D/H/V/S IDs connect goals, proposals, hypotheses, delivery and evidence. IDs are never reused, and superseded records retain their replacement relationships.

Read the [record index](current-version.json), [Changelog](CHANGELOG.md) and [maintenance guide](docs/knowledge-base-maintenance.md) for versioned documents and history. The index's version field retains the historical **0.13.0 knowledge-base checkpoint**, including the delivery status recorded at that checkpoint. The latest **0.20.0 engineering preview** is described by the [SequencePlayer contract and acceptance](docs/sequence-player-contract.md); acceptance status is governed separately by the registries. Original evidence, source identities, failures and repairs retain their recorded scope. Structural checks and historical research do not establish current product acceptance or a performance lead.

## Contribute

Contribute implementations, reproducible counterexamples, source corrections, translations, API proposals and authorized game or migration samples. Before every push, review public content, attribution and both languages, complete critical English code comments and run the full [pre-push checks](docs/bilingual-documentation-and-prepush-checks.md). See the [public collaboration policy](docs/open-source-collaboration-and-public-communication.md) and [language layout](docs/documentation-layout.md).
