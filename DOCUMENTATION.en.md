# Documentation language index

English | [简体中文](DOCUMENTATION.md)


## 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](knowledge-base/docs/显示与帧执行合同.en.md) and [implementation plan](knowledge-base/docs/显示与帧执行实现计划.en.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](knowledge-base/docs/显示与帧执行实现记录.en.md) and [verification](verification/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

This index lists Chinese and English versions of every public reading document. Both versions preserve proposed technical status, sources, failure records and acceptance scope. The Chinese registries are the authority for shared state; English JSON files are read-only translations bound to their canonical source hashes.

Original test records, source snapshots, images and hashes are shared evidence and retain their identities. No alternate data is manufactured for translation. Upstream asset licenses retain their English originals, with Chinese translations explicitly marked as non-binding explanations. First-party code and documentation use the repository’s existing Apache-2.0 license; third parties retain their applicable declarations.

Before every push, review public content and translation meaning, update paired file hashes in `localization.json`, and run `node tools/prepush.mjs`. See [CONTRIBUTING](CONTRIBUTING.en.md) for the hook and contribution process. Structural checks cannot establish translation quality, publication authorization or product performance.

## Reading documents

| 中文 | English |
|---|---|
| [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) | [English](ACKNOWLEDGEMENTS.en.md) |
| [AGENTS.md](AGENTS.md) | [English](AGENTS.en.md) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | [English](CONTRIBUTING.en.md) |
| [PUBLICATION.md](PUBLICATION.md) | [English](PUBLICATION.en.md) |
| [README.md](README.md) | [English](README.en.md) |
| [ACKNOWLEDGEMENTS.md](knowledge-base/ACKNOWLEDGEMENTS.md) | [English](knowledge-base/ACKNOWLEDGEMENTS.en.md) |
| [AGENTS.md](knowledge-base/AGENTS.md) | [English](knowledge-base/AGENTS.en.md) |
| [CHANGELOG.md](knowledge-base/CHANGELOG.md) | [English](knowledge-base/CHANGELOG.en.md) |
| [CONTRIBUTING.md](knowledge-base/CONTRIBUTING.md) | [English](knowledge-base/CONTRIBUTING.en.md) |
| [README.md](knowledge-base/README.md) | [English](knowledge-base/README.en.md) |
| [AI创作与工程接口.md](knowledge-base/docs/AI创作与工程接口.md) | [English](knowledge-base/docs/AI创作与工程接口.en.md) |
| [Shaders与Playground产品技术启发.md](knowledge-base/docs/Shaders与Playground产品技术启发.md) | [English](knowledge-base/docs/Shaders与Playground产品技术启发.en.md) |
| [交付计划.md](knowledge-base/docs/交付计划.md) | [English](knowledge-base/docs/交付计划.en.md) |
| [产品组成.md](knowledge-base/docs/产品组成.md) | [English](knowledge-base/docs/产品组成.en.md) |
| [产品需求说明书.md](knowledge-base/docs/产品需求说明书.md) | [English](knowledge-base/docs/产品需求说明书.en.md) |
| [代码规范与质量门禁.md](knowledge-base/docs/代码规范与质量门禁.md) | [English](knowledge-base/docs/代码规范与质量门禁.en.md) |
| [公共API设计与命名规范.md](knowledge-base/docs/公共API设计与命名规范.md) | [English](knowledge-base/docs/公共API设计与命名规范.en.md) |
| [决策与开放问题.md](knowledge-base/docs/决策与开放问题.md) | [English](knowledge-base/docs/决策与开放问题.en.md) |
| [历史资产与研究边界.md](knowledge-base/docs/历史资产与研究边界.md) | [English](knowledge-base/docs/历史资产与研究边界.en.md) |
| [双语文档与推送前检查.md](knowledge-base/docs/双语文档与推送前检查.md) | [English](knowledge-base/docs/双语文档与推送前检查.en.md) |
| [图形后端编译与原生Runtime选型.md](knowledge-base/docs/图形后端编译与原生Runtime选型.md) | [English](knowledge-base/docs/图形后端编译与原生Runtime选型.en.md) |
| [工程技术架构与项目结构.md](knowledge-base/docs/工程技术架构与项目结构.md) | [English](knowledge-base/docs/工程技术架构与项目结构.en.md) |
| [工程规划.md](knowledge-base/docs/工程规划.md) | [English](knowledge-base/docs/工程规划.en.md) |
| [开源协作与公开表达规范.md](knowledge-base/docs/开源协作与公开表达规范.md) | [English](knowledge-base/docs/开源协作与公开表达规范.en.md) |
| [开源参考实现与采用方案.md](knowledge-base/docs/开源参考实现与采用方案.md) | [English](knowledge-base/docs/开源参考实现与采用方案.en.md) |
| [开源实现优先与验证分工.md](knowledge-base/docs/开源实现优先与验证分工.md) | [English](knowledge-base/docs/开源实现优先与验证分工.en.md) |
| [技术架构.md](knowledge-base/docs/技术架构.md) | [English](knowledge-base/docs/技术架构.en.md) |
| [技术白皮书.md](knowledge-base/docs/技术白皮书.md) | [English](knowledge-base/docs/技术白皮书.en.md) |
| [技术验证记录.md](knowledge-base/docs/技术验证记录.md) | [English](knowledge-base/docs/技术验证记录.en.md) |
| [旧工程迁移.md](knowledge-base/docs/旧工程迁移.md) | [English](knowledge-base/docs/旧工程迁移.en.md) |
| [术语表.md](knowledge-base/docs/术语表.md) | [English](knowledge-base/docs/术语表.en.md) |
| [核心优势与验证.md](knowledge-base/docs/核心优势与验证.md) | [English](knowledge-base/docs/核心优势与验证.en.md) |
| [核心框架实现记录.md](knowledge-base/docs/核心框架实现记录.md) | [English](knowledge-base/docs/核心框架实现记录.en.md) |
| [核心框架证据缺口与研究清单.md](knowledge-base/docs/核心框架证据缺口与研究清单.md) | [English](knowledge-base/docs/核心框架证据缺口与研究清单.en.md) |
| [核心框架首段实现计划.md](knowledge-base/docs/核心框架首段实现计划.md) | [English](knowledge-base/docs/核心框架首段实现计划.en.md) |
| [渲染引擎与运行时.md](knowledge-base/docs/渲染引擎与运行时.md) | [English](knowledge-base/docs/渲染引擎与运行时.en.md) |
| [独立实现与第三方依赖规范.md](knowledge-base/docs/独立实现与第三方依赖规范.md) | [English](knowledge-base/docs/独立实现与第三方依赖规范.en.md) |
| [知识库维护.md](knowledge-base/docs/知识库维护.md) | [English](knowledge-base/docs/知识库维护.en.md) |
| [社区参与.md](knowledge-base/docs/社区参与.md) | [English](knowledge-base/docs/社区参与.en.md) |
| [竞品演进与生态.md](knowledge-base/docs/竞品演进与生态.md) | [English](knowledge-base/docs/竞品演进与生态.en.md) |
| [第一轮审计.md](knowledge-base/docs/第一轮审计.md) | [English](knowledge-base/docs/第一轮审计.en.md) |
| [第一轮研究核查.md](knowledge-base/docs/第一轮研究核查.md) | [English](knowledge-base/docs/第一轮研究核查.en.md) |
| [第三轮审计.md](knowledge-base/docs/第三轮审计.md) | [English](knowledge-base/docs/第三轮审计.en.md) |
| [第三轮集成计划.md](knowledge-base/docs/第三轮集成计划.md) | [English](knowledge-base/docs/第三轮集成计划.en.md) |
| [第三轮集成记录.md](knowledge-base/docs/第三轮集成记录.md) | [English](knowledge-base/docs/第三轮集成记录.en.md) |
| [第二轮审计.md](knowledge-base/docs/第二轮审计.md) | [English](knowledge-base/docs/第二轮审计.en.md) |
| [第二轮验证计划.md](knowledge-base/docs/第二轮验证计划.md) | [English](knowledge-base/docs/第二轮验证计划.en.md) |
| [第二轮验证记录.md](knowledge-base/docs/第二轮验证记录.md) | [English](knowledge-base/docs/第二轮验证记录.en.md) |
| [设计理念与定位.md](knowledge-base/docs/设计理念与定位.md) | [English](knowledge-base/docs/设计理念与定位.en.md) |
| [asset-reference-initial-code-review.zh-CN.md](knowledge-base/evidence/asset-reference-initial-code-review.zh-CN.md) | [English](knowledge-base/evidence/asset-reference-initial-code-review.md) |
| [asset-reference-pre-review-implementation-report.md](knowledge-base/evidence/asset-reference-pre-review-implementation-report.md) | [English](knowledge-base/evidence/asset-reference-pre-review-implementation-report.en.md) |
| [asset-reference-red-provenance.zh-CN.md](knowledge-base/evidence/asset-reference-red-provenance.zh-CN.md) | [English](knowledge-base/evidence/asset-reference-red-provenance.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/README.md) | [English](knowledge-base/experiments/asset-reference-probe/README.en.md) |
| [THIRD_PARTY_NOTICES.md](knowledge-base/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) | [English](knowledge-base/experiments/asset-reference-probe/THIRD_PARTY_NOTICES.en.md) |
| [LICENSE.zh-CN.md](knowledge-base/experiments/asset-reference-probe/assets/RiggedSimple/LICENSE.zh-CN.md) | [English](knowledge-base/experiments/asset-reference-probe/assets/RiggedSimple/LICENSE.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/green-final/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/green-final/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/pre-review-fix/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/pre-review-fix/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-demo-smoke-oracle-caught/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-demo-smoke-oracle-caught/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-demo-smoke-oracle-red/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-demo-smoke-oracle-red/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-final-frozen/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-final-frozen/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-lifecycle-final/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-lifecycle-final/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-lifecycle-green/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-lifecycle-green/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-lifecycle-red/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-lifecycle-red/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-r2-green-r1-red/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-r2-green-r1-red/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-restart-first-frame-red/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-restart-first-frame-red/README.en.md) |
| [README.md](knowledge-base/experiments/asset-reference-probe/history/review-restart-normal-green/README.md) | [English](knowledge-base/experiments/asset-reference-probe/history/review-restart-normal-green/README.en.md) |
| [README.md](knowledge-base/experiments/async-resource-probe/README.md) | [English](knowledge-base/experiments/async-resource-probe/README.en.md) |
| [README.md](knowledge-base/experiments/batch-state-probe/README.md) | [English](knowledge-base/experiments/batch-state-probe/README.en.md) |
| [README.md](knowledge-base/experiments/browser-probe/README.md) | [English](knowledge-base/experiments/browser-probe/README.en.md) |
| [README.md](knowledge-base/experiments/browser-probe/history/attempt-1/README.md) | [English](knowledge-base/experiments/browser-probe/history/attempt-1/README.en.md) |
| [README.md](knowledge-base/experiments/contract-probe/README.md) | [English](knowledge-base/experiments/contract-probe/README.en.md) |
| [README.md](knowledge-base/experiments/mixed-scene-probe/README.md) | [English](knowledge-base/experiments/mixed-scene-probe/README.en.md) |
| [README.md](knowledge-base/experiments/nested-ui-probe/README.md) | [English](knowledge-base/experiments/nested-ui-probe/README.en.md) |
| [README.md](knowledge-base/experiments/reliable-event-probe/README.md) | [English](knowledge-base/experiments/reliable-event-probe/README.en.md) |
| [README.md](knowledge-base/proposals/README.md) | [English](knowledge-base/proposals/README.en.md) |
| [ADR决策记录.md](knowledge-base/templates/ADR决策记录.md) | [English](knowledge-base/templates/ADR决策记录.en.md) |
| [RFC提案.md](knowledge-base/templates/RFC提案.md) | [English](knowledge-base/templates/RFC提案.en.md) |
| [实现来源记录.md](knowledge-base/templates/实现来源记录.md) | [English](knowledge-base/templates/实现来源记录.en.md) |
| [实验与验收.md](knowledge-base/templates/实验与验收.md) | [English](knowledge-base/templates/实验与验收.en.md) |
| [README.md](packages/contracts/README.md) | [English](packages/contracts/README.en.md) |
| [README.md](packages/engine/README.md) | [English](packages/engine/README.en.md) |
| [README.md](packages/runtime/README.md) | [English](packages/runtime/README.en.md) |
| [LICENSE.zh-CN.md](LICENSE.zh-CN.md) | [English](LICENSE) |

| [资源核心合同](knowledge-base/docs/资源核心合同.md) | [English](knowledge-base/docs/资源核心合同.en.md) |

| [资源核心实现记录](knowledge-base/docs/资源核心实现记录.md) | [English](knowledge-base/docs/资源核心实现记录.en.md) |

| [Display and Frame Execution Contract](knowledge-base/docs/显示与帧执行合同.md) | [English](knowledge-base/docs/显示与帧执行合同.en.md) |
| [Display and Frame Implementation Plan](knowledge-base/docs/显示与帧执行实现计划.md) | [English](knowledge-base/docs/显示与帧执行实现计划.en.md) |
| [Display and Frame Implementation Record](knowledge-base/docs/显示与帧执行实现记录.md) | [English](knowledge-base/docs/显示与帧执行实现记录.en.md) |

| [Canvas Rectangle Example](examples/canvas-scene/README.md) | [English](examples/canvas-scene/README.en.md) |

## Shared registry state

- [需求](knowledge-base/registry/需求.json) · [English](knowledge-base/registry/需求.en.json)
- [决策](knowledge-base/registry/决策.json) · [English](knowledge-base/registry/决策.en.json)
- [假设](knowledge-base/registry/假设.json) · [English](knowledge-base/registry/假设.en.json)
- [交付](knowledge-base/registry/交付.json) · [English](knowledge-base/registry/交付.en.json)
- [来源](knowledge-base/registry/来源.json) · [English](knowledge-base/registry/来源.en.json)
- [当前版本](knowledge-base/当前版本.json) · [English](knowledge-base/当前版本.en.json)
