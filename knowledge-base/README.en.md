# Egret Engine Rebuild engineering knowledge base

English | [简体中文](README.md)

## Current local engineering increment: 0.19.0

Read the implemented [Bitmap region contract](docs/bitmap-region-contract.en.md) and [CPU evidence](docs/bitmap-region-evidence.en.md), the [first-four texture collection](docs/texture-first-four-evidence.en.md), and the [reproducible B1 browser verifier](docs/b1-browser-verifier.en.md). Bitmap focused checks passed 113/113. The public B1 command recorded 7 baselines, 5 negatives, 11 renders and 8214 literal comparisons; its bounded saved-artifact independent review is accepted. Texture collection integrity is accepted, with numeric bounds UNKNOWN and full A2 incomplete.

This evidence curation records no successor complete prepush; a fresh prepush must pass before any push. Visible Bitmap sequence playback and device/performance/full-migration gates remain open. This is a local engineering label, not a release; package 0.0.0/protocol 1.0 are unchanged. Earlier records retain their own dates, identities and scopes.

## Historical local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](docs/legacy-movieclip-contract.en.md), [evidence](docs/legacy-movieclip-evidence.en.md) and [compact record](evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](docs/3d-cpu-scene-contract.en.md), [mesh](docs/3d-webgpu-mesh-contract.en.md), [Host](docs/b1-host-contract.en.md), [sequence](docs/sequence-clip-contract.en.md) and [RES intents](docs/legacy-res-plan-contract.en.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](docs/b1-host-evidence.en.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

## Historical local engineering preview: 0.16.0

The current additive scope covers accepted bounded image source/mock logic, CPU texture reference formulas, CPU 3D math/geometry/packing, and legacy RES declaration analysis. Read [core progress](docs/core-progress.en.md), [3D CPU foundation](docs/3d-foundation.en.md) and [legacy RES declarations](docs/legacy-res-declarations.en.md) for contracts, exact historical evidence and open work. The label is an engineering preview; package 0.0.0 and protocol 1.0 remain unchanged. Final independent public review, prepush and this preview's GitHub delivery remain pending.

Earlier 0.13.0/0.14.0/0.15.0 sections are historical checkpoints with their own source identities and results. Their rectangle/browser observations do not validate current image or 3D native pixels. Task 5a provides CPU formulas/bounds only; A2 Task 5b/Task 6, P0–P7, device/text/animation/Native, V003 and complete R008/V006 migration remain open or UNRUN.

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](docs/WebGPU矩形执行合同.en.md), [implementation plan](docs/WebGPU矩形实施计划.en.md) and [bounded evidence](docs/WebGPU矩形实现证据.en.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](evidence/webgpu-verification.json) and [review](evidence/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match that historical metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](docs/显示与帧执行合同.en.md) and [implementation plan](docs/显示与帧执行实现计划.en.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](docs/显示与帧执行实现记录.en.md) and [verification](evidence/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

Egret Rebuild serves new creators who primarily use AI to make games. Its first phase covers both 2D games with complex UI and lightweight 3D games. The rendering engine and runtime are central. One-click import of legacy Egret projects, automatic Agent conversion, minimal manual intervention, and perfect execution after migration are formal delivery requirements.

Historical knowledge-base checkpoint: 0.13.0 · Updated: October 9, 2026 · Stage: public review preparation for independent browser WebGPU rectangles. The technical white paper, PRD, and engineering plan are each candidate version 0.7.

Egret uses public collaboration from early development. This directory provides continuously maintained design, source, decision, and verification records. Independent contract models and local browser graphics research programs have already run. The complete engine, workbench, production hosts, performance, and migration have not passed acceptance. V002 contains a partial independently developed headless core; V003–V006 product implementation has not started. Local research results do not establish product usability or a performance lead. The local public repository candidate contains core source and the knowledge base. Its project repository is [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild), continuing the existing Apache-2.0 configuration. Consult release records for this candidate's submission and review status; maintenance responsibilities are being clarified. Historical materials are retained according to their respective permissions; public copies retain versions and source identity. Following R012, the third round used Three r186 as an explicit third-party research dependency, loaded a real glTF skinned cylinder, and integrated Canvas text UI. The historical research chain recorded 17/17 main checks. Research code exists; full-product implementation and acceptance statuses remain separate, and existing experimental coverage does not expand.


Current CPU asset-core work is tracked separately as V010: [contract](docs/资源核心合同.en.md) and [implementation record](docs/资源核心实现记录.en.md). It builds on the previously verified V009 lifecycle slice; full V002/V004 acceptance, all production hosts, performance, and R008/V006 migration remain pending.

## Start here

| What you want to understand | Entry points |
| --- | --- |
| Joining public collaboration and understanding reference sources | [Public communication policy](docs/开源协作与公开表达规范.en.md) · [Contribution guide](CONTRIBUTING.en.md) · [Acknowledgements](ACKNOWLEDGEMENTS.en.md) |
| This round's actual independent core and missing evidence | [Core implementation record](docs/核心框架实现记录.en.md) · [First-slice plan](docs/核心框架首段实现计划.en.md) · [Evidence gaps](docs/核心框架证据缺口与研究清单.en.md) |
| Why rebuild Egret and whom to serve first | [Design principles and positioning](docs/设计理念与定位.en.md) |
| Candidate designs and product boundaries in this round | [Technical white paper](docs/技术白皮书.en.md) · [Product requirements document](docs/产品需求说明书.en.md) · [Engineering plan](docs/工程规划.en.md) |
| Learning from principles, implementing independently, and adopting public dependencies | [Open-source reference implementations and adoption plan](docs/开源参考实现与采用方案.en.md) · [Research and verification responsibilities](docs/开源实现优先与验证分工.en.md) |
| Current real assets and adapter verification | [Third-round integration record](docs/第三轮集成记录.en.md) · [Third-round audit](docs/第三轮审计.en.md) · [Execution guide](experiments/asset-reference-probe/README.en.md) · [Current screenshot](evidence/asset-reference-probe.png) |
| Second-round historical verification and counterevidence | [Second-round verification record](docs/第二轮验证记录.en.md) · [Second-round audit](docs/第二轮审计.en.md) · [Graphics experiment screenshot](evidence/mixed-scene-probe.png) |
| First-round historical research, verification, and counterevidence | [Technical verification record](docs/技术验证记录.en.md) · [First-round audit](docs/第一轮审计.en.md) · [First-round research checks](docs/第一轮研究核查.en.md) |
| What is confirmed and what remains open to proposals | [Decisions and open questions](docs/决策与开放问题.en.md) · [Requirements registry](registry/需求.en.json) |
| Product components | [Product composition](docs/产品组成.en.md) |
| Choosing WebGPU, TS, and native Runtime | [Candidate backend design](docs/图形后端编译与原生Runtime选型.en.md) |
| Unifying new project structure, API, and code | [Engineering architecture](docs/工程技术架构与项目结构.en.md) · [API and naming](docs/公共API设计与命名规范.en.md) · [Code standards and gates](docs/代码规范与质量门禁.en.md) |
| Organizing the core architecture | [Technical architecture](docs/技术架构.en.md) · [Rendering engine and runtime](docs/渲染引擎与运行时.en.md) |
| How AI continuously changes and verifies games | [AI creation and engineering interfaces](docs/AI创作与工程接口.en.md) |
| Turning historical advantages into present-day advantages | [Core advantages and verification](docs/核心优势与验证.en.md) |
| Bringing legacy projects into the new engine | [Legacy-project migration](docs/旧工程迁移.en.md) |
| What to deliver first and what counts as complete | [Delivery plan](docs/交付计划.en.md) · [Delivery registry](registry/交付.en.json) |
| How Shaders and Playground affect the product direction | [Component and creation-workflow research](docs/Shaders与Playground产品技术启发.en.md) |
| Lessons from competitor and platform changes | [Competitor evolution and ecosystem](docs/竞品演进与生态.en.md) · [Source registry](registry/来源.en.json) |
| Historical assets that can be reused | [Historical assets and research boundaries](docs/历史资产与研究边界.en.md) |
| Distinguishing the independent core from third-party dependencies | [Independent implementation policy](docs/独立实现与第三方依赖规范.en.md) · [Implementation source record](templates/实现来源记录.en.md) |
| Joining, proposing, and maintaining | [Contribution guide](CONTRIBUTING.en.md) · [Community participation](docs/社区参与.en.md) · [Knowledge-base maintenance](docs/知识库维护.en.md) |
| Terms and subsequent changes | [Glossary](docs/术语表.en.md) · [Changelog](CHANGELOG.en.md) |

## Determining a record's authority

Project goals enter the requirements registry. R017 requires starting core implementation and investigating evidence gaps; R011 requires research, design verification, and self-audit; R012 requires first researching mature principles; R015 requires independent core implementation and explicit attribution of public dependencies. Technical approaches enter the decisions registry; all D001–D016 are currently proposed. H001–H008 remain untested; partial experiments have not promoted advantage hypotheses into conclusions. The delivery registry records implementation and acceptance status; finishing documentation does not mean finishing the product.

V001 research is in_progress; shared product samples, devices, and performance baselines remain to be established. V002 contains a partial independent headless core; V003–V006 product implementation has not started. V007 is the local knowledge-base foundation. V008 is the candidate technical white paper, PRD, and engineering-plan package. R008 remains part of the first complete release target. V006 ultimately depends on V001–V005; documents or partial research cannot replace full migration acceptance.

Stable IDs connect discussion and delivery: R means requirement, D technical decision, H hypothesis awaiting verification, V deliverable, and S source. Explanations may improve; IDs are never reused. Retain withdrawn or superseded records and identify their replacement relationships.

The [current version](当前版本.en.json) points to authoritative registries and current documents. The [checking record](核验记录.json) proves only structural checks of registry references, document links, and release-candidate boundaries. It does not prove engine functionality, performance, or license compliance.

Both rounds of contract and graphics review found problems. The historical second round recorded 64 checks across four CPU programs and 7 local WebGL items. See the [second-round verification record](docs/第二轮验证记录.en.md) and [second-round audit](docs/第二轮审计.en.md) for bounded scope, failure history, and repairs. Counts are not performance or completeness scores. Consult the [first-round research checks](docs/第一轮研究核查.en.md) for date conflicts between official sources and items not reverified; do not replace differing source definitions with a single aggregate date.

## First issues to solve together

Following R016, this round redefined candidate engineering structure, public API/naming, lifecycle, and code-quality gates. Eight historical entries received only static checks. Retain familiar domain names first, then modernize modules and ownership. The first slice has created independent source artifacts and completed limited compilation and headless verification; That historical first-slice record did not establish CI, GPU/native or performance acceptance. See the [core implementation record](docs/核心框架实现记录.en.md) for complete scope. Shaders/Playground source research remains a reference for components and creation workflows. Native Rust, VMs and GPU AI remain candidates; browser WebGPU has only passed the rectangle gate above. The first real-asset reference chain has run. Next, combine legacy 2D skeleton-semantic golden samples, production-representative complex UI, and a complete 3D character in one work; define recovery-readiness stages, trim target package size, and continue legacy-semantic regressions. Converge benchmark works, initial hosts, and devices in parallel. Measure corresponding performance when devices arrive, then extend AI creation, publication, and the complete migration loop. Initial host order, team, schedule, numerical performance budgets, and business model have not been confirmed by the user.

Private original project packages, internal source evidence, and original plan snapshots are stored outside this directory and excluded from the current public copy. Contributors do not need access to private source to participate in the currently listed documentation, architecture, and experiment proposals.

Before every push, follow the [bilingual documentation and pre-push checks](docs/双语文档与推送前检查.en.md), synchronize Chinese and English reading versions and shared registered statuses, and add English comments to critical code.

V011 is the historical 0.12.0 display/frame and desktop Canvas rectangle slice; V002 full acceptance, V003–V006 and R008/V006 remain unaccepted. See the [implementation record](docs/显示与帧执行实现记录.en.md).

## Project transaction core engineering preview

The local 0.14.0 preview adds a headless authored-project core: [contract](docs/工程事务核心合同.en.md), [implementation and memory evidence](docs/工程事务核心实现证据.en.md) and package API (repository-root `packages/project/README.en.md`). This is separate from the historical 0.13 WebGPU checkpoint; registry acceptance statuses remain unchanged. At this documentation-authoring checkpoint, final independent preview review and delivery remain pending and are tracked separately. V003/editor and complete R008/V006 remain unaccepted.

## CPU texture preview entry

Use this page's existing public repository entry to read repository-root docs/texture-a1.en.md and docs/evidence/texture-a1.en.md. The local 0.15.0 addition covers CPU images, borrowed assets and attributed UV geometry; production image sampling and GPU settlement await A2. Existing knowledge-base versions, registry states, historical evidence and full migration acceptance retain their own scopes. This entry does not claim completed remote delivery.
