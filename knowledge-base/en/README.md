# Egret Engine Rebuild knowledge base

English | [简体中文](../Cns/README.md)

Egret serves new creators who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. Rendering and runtime, editable projects, Agent collaboration and complete legacy-project migration are central to the design.

<!-- SP1B-DOC-0.36.0-BEGIN -->
## Engineering preview 0.36.0 — original F1 Spine experiment

An opt-in original two-region manual bridge connects real resources and owned Mesh2D geometry. Portable CPU execution passed **12/12** original tests and **6** assigned controls, each with a fresh baseline. Complete Spine **R020/V020 remains OPEN**.

Separate browser WebGPU validation recorded **8** positive submissions and **1** assigned double-update error control; a separate **3**-read classification actor verified `PIXEL_FAIL`. These results are not combined. The prepared public CPU/browser reproduction tool also passed in a new clone with the same **8+1** profile; these are repeated observations, not additional feature coverage. Its finite independent review has **0** open findings. The public checkout also passed the same CPU/browser profile. **Final publication gates and 0.36.0 delivery remain PENDING at this cutoff.** Read [the experiment guide](experiments/spine-f1/README.md), [verification](../evidence/spine-f1-manual-verification.json) and [projection provenance](../evidence/spine-f1-public-projection.json) for exact profiles, original oracles, source terms and remaining UI/runtime/creator/migration work.

The preceding **0.35.0** was actually delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22). Its recorded gates and Main identities are in the guide/evidence; **0** remote statuses and **0** check runs establish no remote CI PASS. Earlier PENDING cutoffs below remain history.
<!-- SP1B-DOC-0.36.0-END -->

<!-- SP1A-DOC-0.34.0-BEGIN -->
## Engineering preview 0.34.0 — Spine import planning

The optional built `@egret/project/spine` entry provides `createSpineImportPlan` and frozen `SPINE_IMPORT_LIMITS`. It prepares an immutable bounded plan from stable 4.3 skeleton JSON, a modern atlas and explicit page-to-asset bindings. Precise diagnostics identify original source locations. Read the [contract](docs/spine-import-plan-contract.md) and [verification record](../evidence/spine-import-plan-verification.json). Successful planning keeps animation semantics and rendering **not_run**, entitlement **unverified** and feature inventory **partial**.

<!-- SP1A-READING-ACTUAL-BEGIN -->
Current build and production boundary scan passed (465 files). Public planning behavior passed **32/32**; TypeScript **7.0.2** passed one DOM-free positive and **22 + 6** exact unsuppressed negative diagnostics. Focused policy passed **9/9**, and **5** separate owned-copy controls each passed a genuine baseline before failing its assigned mutant witness. Independent finite implementation review has zero open findings. Initial **30/32** exposed a test-helper source-ID assumption; the retained production boundary refusal exposed message wording and exact forwarding punctuation. Narrow repairs preserve the API and guard rules. Final complete publication checks, the mandatory push hook and **0.34.0** remote delivery remain **PENDING** at this cutoff.
<!-- SP1A-READING-ACTUAL-END -->

The preceding **0.33.0** package was delivered through [PR #20](https://github.com/cnedwin/Egret_rebuild/pull/20), merged to Main `4ae7e71ee72e5f2c46e7dbccd28b27f482294a0c`, tree `f340e46f0d88783b268b732dcacbfcf7c45a363a`. Its complete mandatory push gate passed **2,631/2,631** core and **63/63** publication tests, **145** document pairs and **174** critical comment records. Local/remote Main identity and a clean checkout were verified at **2026-10-11 23:31:37 UTC**. GitHub returned zero statuses and check runs; no remote CI PASS is claimed. Earlier pending cutoffs below remain historical.

Full Spine **R020/V020** remains open. A separately prepared official core artifact and original animation fixture recipe establish research inputs, not executed playback, redistribution rights or product acceptance. Next work connects per-instance animation state and owned mesh frames to the genuine clock, asset leases and renderers. Complete UI, target phones/SDKs, performance, editor/Agent workflows and legacy migration remain in the engineering plan.
<!-- SP1A-DOC-0.34.0-END -->

<!-- MI1-DOC-0.33.0-BEGIN -->
## Current engineering preview: 0.33.0 (MI1)

Development preview **0.33.0 (MI1)** introduces Scope-owned primary mouse input through the optional `@egret/engine/web/input` entry. It connects existing logical hit testing and typed display events while rendering remains explicit. Read the [primary mouse contract](docs/primary-mouse-input-contract.md) and designated [verification record](../evidence/primary-mouse-input-verification.json) for the exact profile, ownership, failure handling and gate scopes.

At the documentation cutoff **2026-10-11 22:52:43 UTC**, the final Engine build and genuine public interface check passed. Public MI1 behavior/lifecycle passed **98/98**. TypeScript **7.0.2** passed one public positive and matched **26 + 15 + 5** exact unsuppressed negative diagnostics; the public type gate exited **0**. Focused MI1 policy passed **21/21** after correcting one expected diagnostic to retain the existing guard order. Public cancellation **8/8** and earlier retained CPU checks keep their separately recorded scopes. These overlapping checks are not added.

Default headless Edge **154.0.4258.62** with Playwright **1.62.1** passed the fixed desktop Canvas mouse subset: **1** genuine native baseline and **6** assigned controls cover literal events, logical points, RGBA witnesses and observed physical listener cleanup. The ordinary HTTP example passed, and collector policy/grammar units passed **13/13**. All **7** retained desktop gates—Canvas, WebGPU, B1, textured rendering, sequence animation, Canvas text and picking—passed their existing bounded profiles. This establishes neither phones, arbitrary UI/3D, OS reclamation nor a performance lead.

**The complete 259-case boundary rerun, final publication/bilingual checks, mandatory pre-push gate and current 0.33.0 remote delivery remain PENDING.** The earlier timeout and full **258/259** result retain their original artifacts; the latter exposed one expected-message mismatch. Focused **21/21** is its finite successor, not a complete rerun. Other earlier failures retain their recorded identities and cutoffs in the verification record.

The delivered baseline **0.32.0 (S3D1)** was merged through [PR #19](https://github.com/cnedwin/Egret_rebuild/pull/19) to Main `a240bc1e6ee218c63fc1511d715d01d1358d908f`. Earlier scene/preview sections retain their original sources, results and pending/failure cutoffs as history; their earlier pending labels do not undo this delivery.

Full Spine support **R020/V020** remains planned, implementation **not_started**, acceptance **not_run**. Complete UI, touch/pen, phones, Native SDKs, target-device performance, editor/Agent tools and complete legacy migration retain their separate implementation and acceptance obligations.
<!-- MI1-DOC-0.33.0-END -->

<!-- S3D1-DOC-0.32.0-BEGIN -->
## Current bounded checkpoint: 0.32.0 (S3D1)

Verified implementation: public behavior **35/35**, boundaries **238/238**, **2** positive type consumers and **10 + 3 + 11 + 15** exact negative diagnostics pass. Retained integration checks **161/161** and fresh fixed headless Edge composition pass after independently reviewed repairs. Full final publication and current delivery remain pending at this curation cutoff; the linked scene contract records exact scopes and successors.

**Initial source/API observation (historical cutoff):**

The [public scene contract](docs/public-scene3d-contract.md) describes the experimental DOM-free geometry/scene entry and explicit browser scene Host, directly reusing current first-party algorithms through independently designed interfaces. Three-file adoption, build and interface GREEN at **2026-10-11 19:54:25–19:54:26 UTC** confirm source/API reachability only. Behavior, types, policy, native and final acceptance/delivery are **PENDING**. Complete UI/3D, assets, characters, Spine, Native SDKs and performance remain separate obligations.

The delivered **0.31.0** successor was merged through [PR #18](https://github.com/cnedwin/Egret_rebuild/pull/18) to Main `b4062e134af7b923ab6c2c16381004bc1c62ee3c`, tree `5bf7e05cf88e15ca66d1b8b6e26e2c442cbfcf7a`. The preview/status paragraphs below preserve their saved historical cutoffs and counts; their earlier pending labels do not undo this delivery successor.
<!-- S3D1-DOC-0.32.0-END -->

The historical engineering preview **0.31.0** added Scope-owned resource acquisition groups for resource-backed scenes. The adopted working-tree build, two-texture CPU example and **86/86** combined checks passed (**29** RG1 and **57** retained resource/lifecycle cases). Private strict types bind **15** ordinary and **11** import negatives to exact unsuppressed diagnostics; corrected finite policy controls passed **35/35**. Seven retained desktop browser profiles passed their existing subsets and do not exercise a group-based browser application. Earlier **28/29**, **34/35** and current **29/86** results overlap and are not summed. The [shared verification record](../evidence/resource-acquisition-groups-verification.json) tracks complete current checks, bilingual/publication review, the mandatory push hook and RG1 remote delivery successors. First-party code remains Apache-2.0, with no added dependency; private packages stay `0.0.0`, protocol `1.0`. Read the [combined contract, usage and bounded evidence](docs/resource-acquisition-groups.md). Full Spine under R020/V020, complete UI/3D, phones, performance, physical resource reclamation and migration remain separate unfinished acceptance obligations.

The following paragraph preserves the earlier 0.30.0 preparation cutoff; its separate delivery is recorded in [PR #17](https://github.com/cnedwin/Egret_rebuild/pull/17).

The historical engineering preview **0.30.0** added a small display-picking application that composes the existing Stage, typed events and CanvasHost. The actual adopted public-entry headless run passed 12/12; private execution and independent core review are recorded separately, and overlapping counts are not summed. It covers authored overlap/clips, literal half-open boundaries, CSS mouse coordinates, one post-dispatch repaint/render and bounded startup/close ownership. The fresh desktop successor passed **PASS_DESKTOP_HT1_CANVAS_SUBSET** in default Edge **154.0.4258.62**: ten baseline rows and five assigned controls cover real mouse input, typed routes, Canvas pixels and an independent six-pair native listener ledger. Pure admission checks passed **32/32** separately; counts from these scopes are not summed. Complete local verification passed: build, type fixtures and package boundaries; core **2377/2377** and structural publication **63/63**. Localization checked **140** pairs, **6** registry views and **154** critical source files. Knowledge-base validation checked **159** records, **243** Markdown files, **1997** links and **955** references with **0** issues; the headless lifecycle closed with **0** pending timers. These are separate scopes, not a combined test count. Final independent bilingual meaning review, the mandatory Git push hook and delivery remain **PENDING**. This is a fixed desktop mouse/Canvas subset; phones, OS/physical reclamation, performance and full input/UI/Spine acceptance remain separate. Packages remain private `0.0.0`, protocol `1.0`. Read the [example record](docs/display-picking-example.md) and [running guide](../../examples/hit-test/README.md).

The **0.29.0** HT1 delivery successor passed the mandatory push hook with 2,333 core and 59 publication tests and was merged through [PR #16](https://github.com/cnedwin/Egret_rebuild/pull/16) to Main `fb7f15b21cf80345e23490c551552deb4b68061a`, tree `e79ad52bf85a1efa7835a1d4074c5a4368ca8981`. The recorded source commit is `6e724971938ec8be4d271066f327814394e0b7fb`. Remote status/check counts were both 0; no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

The **0.28.0** Canvas text delivery successor passed the mandatory push hook with 2,285 core and 59 publication tests and was merged through [PR #15](https://github.com/cnedwin/Egret_rebuild/pull/15) to Main `b704349207c536d2bdae38496ef622613355a3f4`, tree `d1b4fcd5629c2fe54455244534220c50e0cdc419`. The recorded source commit is `94f239b2d1bd6b1af6f63ebc4f375bc7c9894bca`. Remote status/check counts were both 0, so no remote CI pass is claimed. Earlier preparation records retain their original pending/failure cutoffs.

## Start here

| Topic | Reading |
| --- | --- |
| Product direction | [Positioning](docs/design-philosophy-and-positioning.md) · [Product requirements](docs/product-requirements.md) · [Product components](docs/product-components.md) |
| Architecture and delivery | [Technical white paper](docs/technical-white-paper.md) · [Rendering and runtime](docs/rendering-engine-and-runtime.md) · [Engineering plan](docs/engineering-plan.md) · [Delivery plan](docs/delivery-plan.md) |
| Structure, API and code | [Engineering architecture](docs/engineering-architecture-and-project-structure.md) · [API and naming](docs/public-api-design-and-naming.md) · [Quality gates](docs/code-standards-and-quality-gates.md) |
| Implemented slices and evidence | [Core progress](docs/core-progress.md) · [Content bounds](docs/display-content-bounds-evidence.md) · [Bitmap regions](docs/bitmap-region-evidence.md) · [B1 browser verifier](docs/b1-browser-verifier.md) · [Texture collection](docs/texture-first-four-evidence.md) |
| Primary mouse input | [MI1 contract and bounded verification](docs/primary-mouse-input-contract.md) |
| Resource acquisition groups | [Combined contract, usage and bounded evidence](docs/resource-acquisition-groups.md) |
| Text resources | [DOM-free T1 contract](docs/text-raster-t1-contract.md) · [Bounded T1 evidence and verification scope](docs/text-raster-t1-evidence.md) |
| Display picking application: desktop Canvas subset and complete local checks PASS | [Small example, lifecycle and evidence](docs/display-picking-example.md) · [Run](../../examples/hit-test/README.md) |
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
