# Egret Engine Rebuild knowledge base

English | [简体中文](../Cns/README.md)

Egret serves new creators who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. Rendering and runtime, editable projects, Agent collaboration and complete legacy-project migration are central to the design.

The latest engineering preview is **0.29.0**, adding authored rectangular Stage picking with whole-current-tree admission, owned local areas and half-open clips. Actual combined CPU checks passed 98/98; full strict types passed 16 ordinary and 8 import diagnostics; the source scan passed 426 files; separate synthetic boundary-policy records passed 221/221. These scopes overlap and are not summed. Finite source approval, execution results and final public meaning review remain distinct. Complete current verification passed 2,333/2,333 core tests and 59/59 publication tests; all six affected existing desktop renderer regressions passed. The private-plan browser picking supplement, independent bilingual meaning review, mandatory Git push hook and delivery remain PENDING. Workspace packages remain private 0.0.0. [HT1 scope and evidence](docs/display-hit-test-ht1.md) retain router, gesture, content/pixel-hit, full UI, Spine, phone, performance and migration limits.

The **0.28.0** Canvas text delivery successor passed the mandatory push hook with 2,285 core and 59 publication tests and was merged through [PR #15](https://github.com/cnedwin/Egret_rebuild/pull/15) to Main `b704349207c536d2bdae38496ef622613355a3f4`, tree `d1b4fcd5629c2fe54455244534220c50e0cdc419`. The recorded source commit is `94f239b2d1bd6b1af6f63ebc4f375bc7c9894bca`. Remote status/check counts were both 0, so no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

## Start here

| Topic | Reading |
| --- | --- |
| Product direction | [Positioning](docs/design-philosophy-and-positioning.md) · [Product requirements](docs/product-requirements.md) · [Product components](docs/product-components.md) |
| Architecture and delivery | [Technical white paper](docs/technical-white-paper.md) · [Rendering and runtime](docs/rendering-engine-and-runtime.md) · [Engineering plan](docs/engineering-plan.md) · [Delivery plan](docs/delivery-plan.md) |
| Structure, API and code | [Engineering architecture](docs/engineering-architecture-and-project-structure.md) · [API and naming](docs/public-api-design-and-naming.md) · [Quality gates](docs/code-standards-and-quality-gates.md) |
| Implemented slices and evidence | [Core progress](docs/core-progress.md) · [Content bounds](docs/display-content-bounds-evidence.md) · [Bitmap regions](docs/bitmap-region-evidence.md) · [B1 browser verifier](docs/b1-browser-verifier.md) · [Texture collection](docs/texture-first-four-evidence.md) |
| Text resources | [DOM-free T1 contract](docs/text-raster-t1-contract.md) · [Bounded T1 evidence and verification scope](docs/text-raster-t1-evidence.md) |
| Logical display picking | [HT1 authored rectangles, admission and evidence](docs/display-hit-test-ht1.md) |
| Canvas text | [WC1 public provider and bounded native Canvas evidence](docs/canvas-text-wc1-canvas.md) |
| Text display | [CPU TextField TF1 contract](docs/text-field-tf1-contract.md) · [Source-bound evidence and limits](docs/text-field-tf1-evidence.md) |
| Game time | [Engine-owned clock contract](docs/game-clock-contract.md) · [CPU, type and source evidence](docs/game-clock-evidence.md) |
| Display-tree scaling | [Attachment boundary, cost limits and verification scope](docs/display-tree-scaling.md) |
| Binary reading | [Owned ByteReader BR1 contract](docs/byte-reader-br1-contract.md) · [Recorded verification and pending integration](docs/byte-reader-br1-evidence.md) |
| Scalar Tween | [Scope-owned scalar contract](docs/scalar-tween-contract.md) · [Bounded verification record](docs/scalar-tween-evidence.md) |
| Animation and migration | [Spine support and acceptance](docs/spine-animation-support-and-acceptance.md) · [Sequence sampling](docs/sequence-clip-contract.md) · [Legacy MovieClip](docs/legacy-movieclip-evidence.md) · [Legacy-project migration](docs/legacy-project-migration.md) |
| AI creation | [AI creation and engineering interfaces](docs/ai-creation-and-engineering-interfaces.md) · [Shaders and Playground research](docs/shaders-and-playground-lessons.md) |
| Reference research | [Competitor evolution](docs/competitor-evolution-and-ecosystems.md) · [Open-source reference mechanisms](docs/open-source-reference-implementations-and-adoption.md) · [Backend and Native Runtime proposals](docs/graphics-backends-and-native-runtime-selection.md) |
| Historical experiments | [First round](archive/round-1-research.md) · [Second round](archive/round-2-research.md) · [Third round](archive/round-3-research.md) |
| Participation | [Contribution guide](CONTRIBUTING.md) · [Independent implementation policy](docs/independent-implementation-and-dependency-policy.md) · [Acknowledgements](ACKNOWLEDGEMENTS.md) · [Glossary](docs/glossary.md) |

## Spine requirement

Confirmed **R020** requires complete Spine animation support. **V020** remains planned, implementation not_started and acceptance not_run. Version matching, animation features, complex UI/3D composition, recovery, tools and migration are defined in the [support and acceptance matrix](docs/spine-animation-support-and-acceptance.md). This requirement amendment does not establish implemented compatibility.

## Records and history

[Requirements](registry/requirements.json), [decisions](registry/decisions.json), [hypotheses](registry/hypotheses.json), [deliverables](registry/deliverables.json) and [sources](registry/sources.json) provide the shared status views; their authoritative Chinese records are preserved in the Chinese edition. Stable R/D/H/V/S IDs connect goals, proposals, hypotheses, delivery and evidence. IDs are never reused, and superseded records retain their replacement relationships.

Read the [record index](current-version.json), [Changelog](CHANGELOG.md) and [maintenance guide](docs/knowledge-base-maintenance.md) for versioned documents and history. The index's version field retains the historical **0.13.0 knowledge-base checkpoint**, including the delivery status recorded at that checkpoint. Engineering preview **0.28.0** adds [Canvas-only WC1 text](docs/canvas-text-wc1-canvas.md); fixed CPU/type/native observations passed, finite source and actual saved-native review passed with 0 open findings; complete current verification passed 2,285/2,285 core tests and 59/59 publication tests. Independent bilingual meaning review including the public shared JSON passed with 0 open findings; the mandatory Git push hook and delivery remain pending. Prior Engineering preview **0.27.2** records [display-tree scaling](docs/display-tree-scaling.md), with 2,228 core tests, 52 publication tests and all five affected existing desktop browser regressions passed; delivery is recorded separately. Prior Engineering preview **0.27.1** adds [owned ByteReader](docs/byte-reader-br1-contract.md); [its evidence](docs/byte-reader-br1-evidence.md) separates isolated checks from pending Main integration and publication. Engineering preview **0.27.0** adds [explicit-line CPU TextField](docs/text-field-tf1-contract.md); [its evidence](docs/text-field-tf1-evidence.md) distinguishes 2,157 whole prototype tests and the current 411-file scan from overlapping focused suites. Native TextField, full UI/fonts and final publication/delivery remain unaccepted at this cutoff. The prior Engineering preview **0.26.0** adds [Scope-owned scalar Tween](docs/scalar-tween-contract.md); [recorded checks](docs/scalar-tween-evidence.md) retain bounded scopes. Complete core verification passed in its recorded source/fixture scope; final publication checks and delivery remain **PENDING**. The prior **0.25.0 engineering preview** is described by the [explicit game-clock contract](docs/game-clock-contract.md) and [recorded CPU, type and source evidence](docs/game-clock-evidence.md); bounded core integration is reviewed, while delivery retains a separate cutoff. The prior **0.24.0** [text raster T1 contract](docs/text-raster-t1-contract.md) and [evidence](docs/text-raster-t1-evidence.md) preserve the initial cutoff, subsequent accepted verification and PR #9/Main delivery. The earlier **0.23.0** [owned textured geometry and Mesh2D contract](docs/textured-geometry-and-mesh2d-contract.md) and [bounded CPU/desktop evidence](docs/textured-profile-cpu-evidence.md) retain their recorded scope; [content bounds](docs/display-content-bounds-contract.md), [coordinate queries](docs/display-coordinate-query-contract.md) and [SequencePlayer](docs/sequence-player-contract.md) remain prior increments. Acceptance is governed separately by the registries. Original evidence, source identities, failures and repairs retain their recorded scope. Structural checks and historical research do not establish current product acceptance or a performance lead.

## Contribute

Contribute implementations, reproducible counterexamples, source corrections, translations, API proposals and authorized game or migration samples. Before every push, review public content, attribution and both languages, complete critical English code comments and run the full [pre-push checks](docs/bilingual-documentation-and-prepush-checks.md). See the [public collaboration policy](docs/open-source-collaboration-and-public-communication.md) and [language layout](docs/documentation-layout.md).

## Textured geometry and desktop rendering

- [Contract](docs/textured-geometry-and-mesh2d-contract.md)
- [CPU and desktop evidence](docs/textured-profile-cpu-evidence.md)
