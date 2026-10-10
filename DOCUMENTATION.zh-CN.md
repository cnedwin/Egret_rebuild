# 文档语言索引

[English](DOCUMENTATION.md) | 简体中文

## 当前本地工程预览：0.18.0

新增单个具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、显示偏移和作者持续段时间；28/28 专项测试通过，输出已由真实序列帧工厂重新准入。阅读[契约](knowledge-base/Cns/docs/legacy-movieclip-contract.md)、[证据](knowledge-base/Cns/docs/legacy-movieclip-evidence.md)和[精简记录](knowledge-base/evidence/legacy-movieclip-focused.json)。API 保持内部使用，图片读取、解码和播放仍未验证。

0.17.0 及更早结果保留为各自源码身份下的历史证据。此次增量的默认模式、全仓回归和完整 prepush 未运行；当前浏览器／设备像素、性能及完整 R008/V006 迁移仍待验收。0.18.0 是本地工程标签，包 0.0.0／协议 1.0 不变；GitHub 交付继续保持 HOLD_HTTP_403。

## 历史本地工程预览：0.17.0

本预览新增自有 CPU 场景快照、固定网格辅助函数、有界 B1 宿主源码／模拟整合、CPU 序列帧采样与纯 RES 转换意图。阅读[CPU 场景](knowledge-base/Cns/docs/3d-cpu-scene-contract.md)、[网格](knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md)、[宿主](knowledge-base/Cns/docs/b1-host-contract.md)、[序列帧](knowledge-base/Cns/docs/sequence-clip-contract.md)及[RES 意图](knowledge-base/Cns/docs/legacy-res-plan-contract.md)与配对证据。这些接口保持内部使用；公开入口与包 0.0.0／协议 1.0 不变。

已记录默认宿主验证通过 13/13 项，CPU 序列帧采样通过 25/25，RES 意图规划通过 14/14。所选整仓运行通过 901/901 项测试、编译、282 个边界文件及类型门禁；901 项包含宿主回归。源码绑定、仅格式后继及保留的早期失败见[配对宿主证据](knowledge-base/Cns/docs/b1-host-evidence.md)。此次文档采用未重跑产品检查。

GitHub 交付因已记录的 403 响应保持 HOLD；当前文档最终审阅与完整 prepush 仍待完成。此前 0.13.0–0.16.0 检查点保留身份及结果。Native SDK、当前浏览器／设备像素、性能、字体、DragonBones、完整 R008/V006 迁移、V003／编辑器及完整产品验收仍未验证或保持开放。

## 历史本地工程预览：0.16.0

当前增量覆盖已接受的有界图片源码／模拟逻辑、CPU 纹理参考公式、CPU 3D 数学／几何／打包，以及旧 RES 声明分析。阅读[核心进展](knowledge-base/Cns/docs/core-progress.md)、[3D CPU 基础](knowledge-base/Cns/docs/3d-foundation.md)和[旧 RES 声明](knowledge-base/Cns/docs/legacy-res-declarations.md)，查看契约、准确历史证据与开放任务。标签为工程预览；包 0.0.0 与协议 1.0 不变。最终独立公开审查、prepush 及本预览的 GitHub 交付仍待完成。

此前 0.13.0／0.14.0／0.15.0 章节是各自有源码身份和结果的历史检查点，其矩形／浏览器观察不能验证当前图片或 3D 的 native 像素。Task 5a 仅提供 CPU 公式／边界；A2 Task 5b／Task 6、P0–P7、设备／文字／动画／Native、V003 和完整 R008／V006 迁移保持开放或 UNRUN。

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/Cns/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/Cns/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/Cns/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/Cns/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/Cns/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/Cns/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

本索引列出全部公开阅读文档的中文和英文版本。技术方案的候选状态、来源、失败记录及验收范围在两个版本中一致。中文登记册是共同状态的权威来源，英文JSON是带原文摘要的只读翻译视图。

原始测试记录、源代码快照、图片与hash是共享证据，保留其原始身份；不另造改变含义的数据版本。上游资产的英文许可保持原文，中文译文明确标注为非约束性说明。第一方代码与文档采用仓库既有Apache-2.0，第三方适用各自声明。

每次推送前完成公开内容和翻译含义复核，同步`localization.json`中的配对文件摘要，再运行`node tools/prepush.mjs`。钩子启用方法与贡献流程见[贡献指南](CONTRIBUTING.zh-CN.md)。结构检查无法证明翻译质量、公开授权或产品性能。

## 阅读文档

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

| [显示与帧执行合同](knowledge-base/Cns/docs/显示与帧执行合同.md) | [English](knowledge-base/en/docs/display-and-frame-execution-contract.md) |
| [显示与帧执行实现计划](knowledge-base/Cns/docs/显示与帧执行实现计划.md) | [English](knowledge-base/en/docs/display-and-frame-implementation-plan.md) |
| [显示与帧执行实现记录](knowledge-base/Cns/docs/显示与帧执行实现记录.md) | [English](knowledge-base/en/docs/display-and-frame-implementation-record.md) |

| [Canvas矩形示例](examples/canvas-scene/README.zh-CN.md) | [English](examples/canvas-scene/README.md) |

| [WebGPU矩形执行合同](knowledge-base/Cns/docs/WebGPU矩形执行合同.md) | [English](knowledge-base/en/docs/webgpu-rectangle-execution-contract.md) |
| [WebGPU矩形实施计划](knowledge-base/Cns/docs/WebGPU矩形实施计划.md) | [English](knowledge-base/en/docs/webgpu-rectangle-implementation-plan.md) |
| [WebGPU矩形实现证据](knowledge-base/Cns/docs/WebGPU矩形实现证据.md) | [English](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md) |
| [WebGPU矩形示例](examples/webgpu/README.zh-CN.md) | [English](examples/webgpu/README.md) |

## 共同登记状态

- [需求](knowledge-base/Cns/registry/需求.json) · [English](knowledge-base/en/registry/requirements.json)
- [决策](knowledge-base/Cns/registry/决策.json) · [English](knowledge-base/en/registry/decisions.json)
- [假设](knowledge-base/Cns/registry/假设.json) · [English](knowledge-base/en/registry/hypotheses.json)
- [交付](knowledge-base/Cns/registry/交付.json) · [English](knowledge-base/en/registry/deliverables.json)
- [来源](knowledge-base/Cns/registry/来源.json) · [English](knowledge-base/en/registry/sources.json)
- [当前版本](knowledge-base/Cns/当前版本.json) · [English](knowledge-base/en/current-version.json)

## 工程事务核心阅读版本

[包API](packages/project/README.zh-CN.md) · [完整合同](knowledge-base/Cns/docs/工程事务核心合同.md) · [实现与内存证据](knowledge-base/Cns/docs/工程事务核心实现证据.md)。本地工程预览标签为0.14.0；包0.0.0/协议1.0及历史0.13身份不变，公开交付在本段文档编写检查点待完成，后续交付证据另行记录。

## CPU 纹理预览阅读版本

中文 | English
--- | ---
| [CPU 纹理 API 与所有权](docs/texture-a1.zh-CN.md) | [English](docs/texture-a1.md) |
| [CPU 纹理验证证据](docs/evidence/texture-a1.zh-CN.md) | [English](docs/evidence/texture-a1.md) |

## 0.16.0 阅读文档对

| 中文 | English |
| --- | --- |
| [核心进展](knowledge-base/Cns/docs/core-progress.md) | [Core progress](knowledge-base/en/docs/core-progress.md) |
| [3D CPU 基础](knowledge-base/Cns/docs/3d-foundation.md) | [3D CPU foundation](knowledge-base/en/docs/3d-foundation.md) |
| [旧 RES 声明](knowledge-base/Cns/docs/legacy-res-declarations.md) | [Legacy RES declarations](knowledge-base/en/docs/legacy-res-declarations.md) |

## 0.17.0 新增文档配对

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
