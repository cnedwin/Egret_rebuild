# Documentation language index

English | [简体中文](DOCUMENTATION.zh-CN.md)

## Current local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](knowledge-base/en/docs/legacy-movieclip-contract.md), [evidence](knowledge-base/en/docs/legacy-movieclip-evidence.md) and [compact record](knowledge-base/evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](knowledge-base/en/docs/3d-cpu-scene-contract.md), [mesh](knowledge-base/en/docs/3d-webgpu-mesh-contract.md), [Host](knowledge-base/en/docs/b1-host-contract.md), [sequence](knowledge-base/en/docs/sequence-clip-contract.md) and [RES intents](knowledge-base/en/docs/legacy-res-plan-contract.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](knowledge-base/en/docs/b1-host-evidence.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

## Historical local engineering preview: 0.16.0

The current additive scope covers accepted bounded image source/mock logic, CPU texture reference formulas, CPU 3D math/geometry/packing, and legacy RES declaration analysis. Read [core progress](knowledge-base/en/docs/core-progress.md), [3D CPU foundation](knowledge-base/en/docs/3d-foundation.md) and [legacy RES declarations](knowledge-base/en/docs/legacy-res-declarations.md) for contracts, exact historical evidence and open work. The label is an engineering preview; package 0.0.0 and protocol 1.0 remain unchanged. Final independent public review, prepush and this preview's GitHub delivery remain pending.

Earlier 0.13.0/0.14.0/0.15.0 sections are historical checkpoints with their own source identities and results. Their rectangle/browser observations do not validate current image or 3D native pixels. Task 5a provides CPU formulas/bounds only; A2 Task 5b/Task 6, P0–P7, device/text/animation/Native, V003 and complete R008/V006 migration remain open or UNRUN.

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](knowledge-base/en/docs/webgpu-rectangle-execution-contract.md), [implementation plan](knowledge-base/en/docs/webgpu-rectangle-implementation-plan.md) and [bounded evidence](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](verification/webgpu-verification.json) and [review](verification/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match that historical metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](knowledge-base/en/docs/display-and-frame-execution-contract.md) and [implementation plan](knowledge-base/en/docs/display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](knowledge-base/en/docs/display-and-frame-implementation-record.md) and [verification](verification/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

This index lists Chinese and English versions of every public reading document. Both versions preserve proposed technical status, sources, failure records and acceptance scope. The Chinese registries are the authority for shared state; English JSON files are read-only translations bound to their canonical source hashes.

Original test records, source snapshots, images and hashes are shared evidence and retain their identities. No alternate data is manufactured for translation. Upstream asset licenses retain their English originals, with Chinese translations explicitly marked as non-binding explanations. First-party code and documentation use the repository’s existing Apache-2.0 license; third parties retain their applicable declarations.

Before every push, review public content and translation meaning, update paired file hashes in `localization.json`, and run `node tools/prepush.mjs`. See [CONTRIBUTING](CONTRIBUTING.md) for the hook and contribution process. Structural checks cannot establish translation quality, publication authorization or product performance.

## Reading documents

| 中文 | English |
|---|---|
| [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.zh-CN.md) | [English](ACKNOWLEDGEMENTS.md) |
| [AGENTS.md](AGENTS.zh-CN.md) | [English](AGENTS.md) |
| [CONTRIBUTING.md](CONTRIBUTING.zh-CN.md) | [English](CONTRIBUTING.md) |
| [PUBLICATION.md](PUBLICATION.zh-CN.md) | [English](PUBLICATION.md) |
| [README.md](README.zh-CN.md) | [English](README.md) |
| [ACKNOWLEDGEMENTS.md](knowledge-base/Cns/ACKNOWLEDGEMENTS.md) | [English](knowledge-base/en/ACKNOWLEDGEMENTS.md) |
| [AGENTS.md](knowledge-base/Cns/AGENTS.md) | [English](knowledge-base/en/AGENTS.md) |
| [CHANGELOG.md](knowledge-base/Cns/CHANGELOG.md) | [English](knowledge-base/en/CHANGELOG.md) |
| [CONTRIBUTING.md](knowledge-base/Cns/CONTRIBUTING.md) | [English](knowledge-base/en/CONTRIBUTING.md) |
| [README.md](knowledge-base/Cns/README.md) | [English](knowledge-base/en/README.md) |
| [AI创作与工程接口.md](knowledge-base/Cns/docs/AI创作与工程接口.md) | [English](knowledge-base/en/docs/ai-creation-and-engineering-interfaces.md) |
| [Shaders与Playground产品技术启发.md](knowledge-base/Cns/docs/Shaders与Playground产品技术启发.md) | [English](knowledge-base/en/docs/shaders-and-playground-lessons.md) |
| [交付计划.md](knowledge-base/Cns/docs/交付计划.md) | [English](knowledge-base/en/docs/delivery-plan.md) |
| [产品组成.md](knowledge-base/Cns/docs/产品组成.md) | [English](knowledge-base/en/docs/product-components.md) |
| [产品需求说明书.md](knowledge-base/Cns/docs/产品需求说明书.md) | [English](knowledge-base/en/docs/product-requirements.md) |
| [代码规范与质量门禁.md](knowledge-base/Cns/docs/代码规范与质量门禁.md) | [English](knowledge-base/en/docs/code-standards-and-quality-gates.md) |
| [公共API设计与命名规范.md](knowledge-base/Cns/docs/公共API设计与命名规范.md) | [English](knowledge-base/en/docs/public-api-design-and-naming.md) |
| [决策与开放问题.md](knowledge-base/Cns/docs/决策与开放问题.md) | [English](knowledge-base/en/docs/decisions-and-open-questions.md) |
| [历史资产与研究边界.md](knowledge-base/Cns/docs/历史资产与研究边界.md) | [English](knowledge-base/en/docs/historical-assets-and-research-boundaries.md) |
| [双语文档与推送前检查.md](knowledge-base/Cns/docs/双语文档与推送前检查.md) | [English](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md) |
| [图形后端编译与原生Runtime选型.md](knowledge-base/Cns/docs/图形后端编译与原生Runtime选型.md) | [English](knowledge-base/en/docs/graphics-backends-and-native-runtime-selection.md) |
| [工程技术架构与项目结构.md](knowledge-base/Cns/docs/工程技术架构与项目结构.md) | [English](knowledge-base/en/docs/engineering-architecture-and-project-structure.md) |
| [工程规划.md](knowledge-base/Cns/docs/工程规划.md) | [English](knowledge-base/en/docs/engineering-plan.md) |
| [开源协作与公开表达规范.md](knowledge-base/Cns/docs/开源协作与公开表达规范.md) | [English](knowledge-base/en/docs/open-source-collaboration-and-public-communication.md) |
| [开源参考实现与采用方案.md](knowledge-base/Cns/docs/开源参考实现与采用方案.md) | [English](knowledge-base/en/docs/open-source-reference-implementations-and-adoption.md) |
| [开源实现优先与验证分工.md](knowledge-base/Cns/docs/开源实现优先与验证分工.md) | [English](knowledge-base/en/docs/open-source-research-and-validation-roles.md) |
| [技术架构.md](knowledge-base/Cns/docs/技术架构.md) | [English](knowledge-base/en/docs/technical-architecture.md) |
| [技术白皮书.md](knowledge-base/Cns/docs/技术白皮书.md) | [English](knowledge-base/en/docs/technical-white-paper.md) |
| [技术验证记录.md](knowledge-base/Cns/docs/技术验证记录.md) | [English](knowledge-base/en/docs/technical-validation-record.md) |
| [旧工程迁移.md](knowledge-base/Cns/docs/旧工程迁移.md) | [English](knowledge-base/en/docs/legacy-project-migration.md) |
| [术语表.md](knowledge-base/Cns/docs/术语表.md) | [English](knowledge-base/en/docs/glossary.md) |
| [核心优势与验证.md](knowledge-base/Cns/docs/核心优势与验证.md) | [English](knowledge-base/en/docs/core-advantages-and-verification.md) |
| [核心框架实现记录.md](knowledge-base/Cns/docs/核心框架实现记录.md) | [English](knowledge-base/en/docs/core-framework-implementation-record.md) |
| [核心框架证据缺口与研究清单.md](knowledge-base/Cns/docs/核心框架证据缺口与研究清单.md) | [English](knowledge-base/en/docs/core-framework-evidence-gaps.md) |
| [核心框架首段实现计划.md](knowledge-base/Cns/docs/核心框架首段实现计划.md) | [English](knowledge-base/en/docs/core-framework-first-slice-plan.md) |
| [渲染引擎与运行时.md](knowledge-base/Cns/docs/渲染引擎与运行时.md) | [English](knowledge-base/en/docs/rendering-engine-and-runtime.md) |
| [独立实现与第三方依赖规范.md](knowledge-base/Cns/docs/独立实现与第三方依赖规范.md) | [English](knowledge-base/en/docs/independent-implementation-and-dependency-policy.md) |
| [知识库维护.md](knowledge-base/Cns/docs/知识库维护.md) | [English](knowledge-base/en/docs/knowledge-base-maintenance.md) |
| [社区参与.md](knowledge-base/Cns/docs/社区参与.md) | [English](knowledge-base/en/docs/community-participation.md) |
| [竞品演进与生态.md](knowledge-base/Cns/docs/竞品演进与生态.md) | [English](knowledge-base/en/docs/competitor-evolution-and-ecosystems.md) |
| [第一轮审计.md](knowledge-base/Cns/docs/第一轮审计.md) | [English](knowledge-base/en/docs/round-1-audit.md) |
| [第一轮研究核查.md](knowledge-base/Cns/docs/第一轮研究核查.md) | [English](knowledge-base/en/docs/round-1-research-verification.md) |
| [第三轮审计.md](knowledge-base/Cns/docs/第三轮审计.md) | [English](knowledge-base/en/docs/round-3-audit.md) |
| [第三轮集成计划.md](knowledge-base/Cns/docs/第三轮集成计划.md) | [English](knowledge-base/en/docs/round-3-integration-plan.md) |
| [第三轮集成记录.md](knowledge-base/Cns/docs/第三轮集成记录.md) | [English](knowledge-base/en/docs/round-3-integration-record.md) |
| [第二轮审计.md](knowledge-base/Cns/docs/第二轮审计.md) | [English](knowledge-base/en/docs/round-2-audit.md) |
| [第二轮验证计划.md](knowledge-base/Cns/docs/第二轮验证计划.md) | [English](knowledge-base/en/docs/round-2-validation-plan.md) |
| [第二轮验证记录.md](knowledge-base/Cns/docs/第二轮验证记录.md) | [English](knowledge-base/en/docs/round-2-validation-record.md) |
| [设计理念与定位.md](knowledge-base/Cns/docs/设计理念与定位.md) | [English](knowledge-base/en/docs/design-philosophy-and-positioning.md) |
| [asset-reference-initial-code-review.zh-CN.md](knowledge-base/Cns/evidence/asset-reference-initial-code-review.md) | [English](knowledge-base/en/evidence/asset-reference-initial-code-review.md) |
| [asset-reference-pre-review-implementation-report.md](knowledge-base/Cns/evidence/asset-reference-pre-review-implementation-report.md) | [English](knowledge-base/en/evidence/asset-reference-pre-review-implementation-report.md) |
| [asset-reference-red-provenance.zh-CN.md](knowledge-base/Cns/evidence/asset-reference-red-provenance.md) | [English](knowledge-base/en/evidence/asset-reference-red-provenance.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/README.md) |
| [THIRD_PARTY_NOTICES.md](knowledge-base/Cns/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) | [English](knowledge-base/en/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) |
| [LICENSE.zh-CN.md](knowledge-base/Cns/experiments/asset-reference-probe/assets/RiggedSimple/LICENSE.md) | [English](knowledge-base/en/experiments/asset-reference-probe/assets/RiggedSimple/LICENSE.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/green-final/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/green-final/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/pre-review-fix/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/pre-review-fix/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-demo-smoke-oracle-caught/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-demo-smoke-oracle-caught/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-demo-smoke-oracle-red/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-demo-smoke-oracle-red/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-final-frozen/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-final-frozen/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-lifecycle-final/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-lifecycle-final/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-lifecycle-green/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-lifecycle-green/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-lifecycle-red/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-lifecycle-red/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-r2-green-r1-red/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-r2-green-r1-red/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-restart-first-frame-red/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-restart-first-frame-red/README.md) |
| [README.md](knowledge-base/Cns/experiments/asset-reference-probe/history/review-restart-normal-green/README.md) | [English](knowledge-base/en/experiments/asset-reference-probe/history/review-restart-normal-green/README.md) |
| [README.md](knowledge-base/Cns/experiments/async-resource-probe/README.md) | [English](knowledge-base/en/experiments/async-resource-probe/README.md) |
| [README.md](knowledge-base/Cns/experiments/batch-state-probe/README.md) | [English](knowledge-base/en/experiments/batch-state-probe/README.md) |
| [README.md](knowledge-base/Cns/experiments/browser-probe/README.md) | [English](knowledge-base/en/experiments/browser-probe/README.md) |
| [README.md](knowledge-base/Cns/experiments/browser-probe/history/attempt-1/README.md) | [English](knowledge-base/en/experiments/browser-probe/history/attempt-1/README.md) |
| [README.md](knowledge-base/Cns/experiments/contract-probe/README.md) | [English](knowledge-base/en/experiments/contract-probe/README.md) |
| [README.md](knowledge-base/Cns/experiments/mixed-scene-probe/README.md) | [English](knowledge-base/en/experiments/mixed-scene-probe/README.md) |
| [README.md](knowledge-base/Cns/experiments/nested-ui-probe/README.md) | [English](knowledge-base/en/experiments/nested-ui-probe/README.md) |
| [README.md](knowledge-base/Cns/experiments/reliable-event-probe/README.md) | [English](knowledge-base/en/experiments/reliable-event-probe/README.md) |
| [README.md](knowledge-base/Cns/proposals/README.md) | [English](knowledge-base/en/proposals/README.md) |
| [ADR决策记录.md](knowledge-base/Cns/templates/ADR决策记录.md) | [English](knowledge-base/en/templates/adr-decision-record.md) |
| [RFC提案.md](knowledge-base/Cns/templates/RFC提案.md) | [English](knowledge-base/en/templates/rfc-proposal.md) |
| [实现来源记录.md](knowledge-base/Cns/templates/实现来源记录.md) | [English](knowledge-base/en/templates/implementation-origin-record.md) |
| [实验与验收.md](knowledge-base/Cns/templates/实验与验收.md) | [English](knowledge-base/en/templates/experiment-and-acceptance.md) |
| [README.md](packages/contracts/README.zh-CN.md) | [English](packages/contracts/README.md) |
| [README.md](packages/engine/README.zh-CN.md) | [English](packages/engine/README.md) |
| [README.md](packages/runtime/README.zh-CN.md) | [English](packages/runtime/README.md) |
| [LICENSE.zh-CN.md](LICENSE.zh-CN.md) | [English](LICENSE) |

| [资源核心合同](knowledge-base/Cns/docs/资源核心合同.md) | [English](knowledge-base/en/docs/resource-core-contract.md) |

| [资源核心实现记录](knowledge-base/Cns/docs/资源核心实现记录.md) | [English](knowledge-base/en/docs/resource-core-implementation-record.md) |

| [Display and Frame Execution Contract](knowledge-base/Cns/docs/显示与帧执行合同.md) | [English](knowledge-base/en/docs/display-and-frame-execution-contract.md) |
| [Display and Frame Implementation Plan](knowledge-base/Cns/docs/显示与帧执行实现计划.md) | [English](knowledge-base/en/docs/display-and-frame-implementation-plan.md) |
| [Display and Frame Implementation Record](knowledge-base/Cns/docs/显示与帧执行实现记录.md) | [English](knowledge-base/en/docs/display-and-frame-implementation-record.md) |

| [Canvas Rectangle Example](examples/canvas-scene/README.zh-CN.md) | [English](examples/canvas-scene/README.md) |

| [WebGPU Rectangle Execution Contract](knowledge-base/Cns/docs/WebGPU矩形执行合同.md) | [English](knowledge-base/en/docs/webgpu-rectangle-execution-contract.md) |
| [WebGPU Rectangle Implementation Plan](knowledge-base/Cns/docs/WebGPU矩形实施计划.md) | [English](knowledge-base/en/docs/webgpu-rectangle-implementation-plan.md) |
| [WebGPU Rectangle Implementation Evidence](knowledge-base/Cns/docs/WebGPU矩形实现证据.md) | [English](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md) |
| [WebGPU Rectangle Example](examples/webgpu/README.zh-CN.md) | [English](examples/webgpu/README.md) |

## Shared registry state

- [需求](knowledge-base/Cns/registry/需求.json) · [English](knowledge-base/en/registry/requirements.json)
- [决策](knowledge-base/Cns/registry/决策.json) · [English](knowledge-base/en/registry/decisions.json)
- [假设](knowledge-base/Cns/registry/假设.json) · [English](knowledge-base/en/registry/hypotheses.json)
- [交付](knowledge-base/Cns/registry/交付.json) · [English](knowledge-base/en/registry/deliverables.json)
- [来源](knowledge-base/Cns/registry/来源.json) · [English](knowledge-base/en/registry/sources.json)
- [当前版本](knowledge-base/Cns/当前版本.json) · [English](knowledge-base/en/current-version.json)

## Project transaction core reading pair

[Package API](packages/project/README.md) · [Complete contract](knowledge-base/en/docs/project-transaction-core-contract.md) · [Implementation and memory evidence](knowledge-base/en/docs/project-transaction-core-evidence.md). The local engineering-preview label is 0.14.0; package 0.0.0/protocol 1.0 and historical 0.13 identities remain unchanged. Public delivery remains pending at this documentation-authoring checkpoint; subsequent delivery evidence is tracked separately.

## CPU texture preview reading versions

Chinese | English
--- | ---
| [CPU texture API and ownership](docs/texture-a1.zh-CN.md) | [English](docs/texture-a1.md) |
| [CPU texture evidence](docs/evidence/texture-a1.zh-CN.md) | [English](docs/evidence/texture-a1.md) |

## 0.16.0 reading pairs

| 中文 | English |
| --- | --- |
| [核心进展](knowledge-base/Cns/docs/core-progress.md) | [Core progress](knowledge-base/en/docs/core-progress.md) |
| [3D CPU 基础](knowledge-base/Cns/docs/3d-foundation.md) | [3D CPU foundation](knowledge-base/en/docs/3d-foundation.md) |
| [旧 RES 声明](knowledge-base/Cns/docs/legacy-res-declarations.md) | [Legacy RES declarations](knowledge-base/en/docs/legacy-res-declarations.md) |

## 0.17.0 added document pairs

| 中文 | English |
| --- | --- |
| [3d-cpu-scene-contract.md](knowledge-base/Cns/docs/3d-cpu-scene-contract.md) | [3d-cpu-scene-contract.en.md](knowledge-base/en/docs/3d-cpu-scene-contract.md) |
| [3d-cpu-scene-evidence.md](knowledge-base/Cns/docs/3d-cpu-scene-evidence.md) | [3d-cpu-scene-evidence.en.md](knowledge-base/en/docs/3d-cpu-scene-evidence.md) |
| [3d-webgpu-mesh-contract.md](knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md) | [3d-webgpu-mesh-contract.en.md](knowledge-base/en/docs/3d-webgpu-mesh-contract.md) |
| [3d-webgpu-mesh-evidence.md](knowledge-base/Cns/docs/3d-webgpu-mesh-evidence.md) | [3d-webgpu-mesh-evidence.en.md](knowledge-base/en/docs/3d-webgpu-mesh-evidence.md) |
| [b1-host-contract.zh-CN.md](knowledge-base/Cns/docs/b1-host-contract.md) | [b1-host-contract.en.md](knowledge-base/en/docs/b1-host-contract.md) |
| [b1-host-evidence.zh-CN.md](knowledge-base/Cns/docs/b1-host-evidence.md) | [b1-host-evidence.en.md](knowledge-base/en/docs/b1-host-evidence.md) |
| [sequence-clip-contract.zh-CN.md](knowledge-base/Cns/docs/sequence-clip-contract.md) | [sequence-clip-contract.en.md](knowledge-base/en/docs/sequence-clip-contract.md) |
| [sequence-clip-evidence.zh-CN.md](knowledge-base/Cns/docs/sequence-clip-evidence.md) | [sequence-clip-evidence.en.md](knowledge-base/en/docs/sequence-clip-evidence.md) |
| [legacy-res-plan-contract.zh-CN.md](knowledge-base/Cns/docs/legacy-res-plan-contract.md) | [legacy-res-plan-contract.en.md](knowledge-base/en/docs/legacy-res-plan-contract.md) |
| [legacy-res-plan-evidence.zh-CN.md](knowledge-base/Cns/docs/legacy-res-plan-evidence.md) | [legacy-res-plan-evidence.en.md](knowledge-base/en/docs/legacy-res-plan-evidence.md) |
