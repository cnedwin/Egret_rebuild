# 文档语言索引

[English](DOCUMENTATION.en.md) | 简体中文

## 0.13.0 WebGPU矩形本地检查点 — 2026年10月9日

显式 `@egret/engine/webgpu` 入口同步执行不可变 `RenderFrame2D` 矩形命令。根入口保持无DOM；`@egret/engine/web`保持Canvas-only，实际请求不包含WebGPU或robust-predicates模块。无DOM准备层通过公共 `orient2d` 接入精确固定的基础依赖robust-predicates 3.0.3，适用Unlicense。复制、有界交点构造、打包、WGSL及宿主生命周期属于独立编写的第一方代码。见[完整0.6合同](knowledge-base/docs/WebGPU矩形执行合同.md)、[实施计划](knowledge-base/docs/WebGPU矩形实施计划.md)与[有限证据](knowledge-base/docs/WebGPU矩形实现证据.md)。

已接受的桌面构建记录177/177 CPU/mock/核心检查、28项预期负类型诊断及123个边界文件；独立真实WebGPU门禁记录42帧、1709项原始断言、84张截图、6808项合成断言、8项预期反例及0项意外错误。其中7项变异实际生产代码副本，1项仅为合成断言。实际结果与有限独立实现审阅由[验证](verification/webgpu-verification.json)与[审阅](verification/webgpu-review.json)绑定已接受的源码身份；文档整合没有重跑这些检查。

本experimental检查点记录于2026-10-08T21:23:54.294Z最终原生运行之前，核心/headless与桌面Canvas结果分别记录。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当前仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。浏览器WebGPU与Native App/SDK分别验收；截图合成不证明实体扫描输出、硬件加速、手机或性能。纹理/文字/UI/动画/3D、编辑器/Agent创作、CI、完整迁移与完整产品仍待实施或验收；R008/V006及V003保留既有义务。下文0.9–0.12历史记录保留原日期、身份与结果范围。


## 历史0.12.0显示与帧候选范围

后续工作包按[显示与帧合同](knowledge-base/docs/显示与帧执行合同.md)及[实现计划](knowledge-base/docs/显示与帧执行实现计划.md)推进：显示变换、继承可见性/透明度与本地矩形裁剪、Sprite 所属 Graphics 的矩形填充，以及不可变 CPU 帧捕获/提交。首个已实现执行适配器为独立 @egret/engine/web 入口的 Canvas，核心根入口保留无 DOM 边界。限定实现检查已通过：97/97核心行为测试、25项负类型诊断及真实桌面Canvas像素/指针交互。跨realm拒绝修正后有限独立审阅通过；远端发布另行记录。最终限定结果由[实现记录](knowledge-base/docs/显示与帧执行实现记录.md)和[验证](verification/display-frame-verification.json)承载。

本包不验收完整文本/纹理/动画/UI/3D 执行、GPU 或 Native 支持、目标设备性能、编辑器、Agent 服务或完整迁移。此前 headless、CPU 资源与第三方研究记录保留原版本、数量、hash 和范围，不转为新显示帧验收。

本索引列出全部公开阅读文档的中文和英文版本。技术方案的候选状态、来源、失败记录及验收范围在两个版本中一致。中文登记册是共同状态的权威来源，英文JSON是带原文摘要的只读翻译视图。

原始测试记录、源代码快照、图片与hash是共享证据，保留其原始身份；不另造改变含义的数据版本。上游资产的英文许可保持原文，中文译文明确标注为非约束性说明。第一方代码与文档采用仓库既有Apache-2.0，第三方适用各自声明。

每次推送前完成公开内容和翻译含义复核，同步`localization.json`中的配对文件摘要，再运行`node tools/prepush.mjs`。钩子启用方法与贡献流程见[贡献指南](CONTRIBUTING.md)。结构检查无法证明翻译质量、公开授权或产品性能。

## 阅读文档

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

| [显示与帧执行合同](knowledge-base/docs/显示与帧执行合同.md) | [English](knowledge-base/docs/显示与帧执行合同.en.md) |
| [显示与帧执行实现计划](knowledge-base/docs/显示与帧执行实现计划.md) | [English](knowledge-base/docs/显示与帧执行实现计划.en.md) |
| [显示与帧执行实现记录](knowledge-base/docs/显示与帧执行实现记录.md) | [English](knowledge-base/docs/显示与帧执行实现记录.en.md) |

| [Canvas矩形示例](examples/canvas-scene/README.md) | [English](examples/canvas-scene/README.en.md) |

| [WebGPU矩形执行合同](knowledge-base/docs/WebGPU矩形执行合同.md) | [English](knowledge-base/docs/WebGPU矩形执行合同.en.md) |
| [WebGPU矩形实施计划](knowledge-base/docs/WebGPU矩形实施计划.md) | [English](knowledge-base/docs/WebGPU矩形实施计划.en.md) |
| [WebGPU矩形实现证据](knowledge-base/docs/WebGPU矩形实现证据.md) | [English](knowledge-base/docs/WebGPU矩形实现证据.en.md) |
| [WebGPU矩形示例](examples/webgpu/README.md) | [English](examples/webgpu/README.en.md) |

## 共同登记状态

- [需求](knowledge-base/registry/需求.json) · [English](knowledge-base/registry/需求.en.json)
- [决策](knowledge-base/registry/决策.json) · [English](knowledge-base/registry/决策.en.json)
- [假设](knowledge-base/registry/假设.json) · [English](knowledge-base/registry/假设.en.json)
- [交付](knowledge-base/registry/交付.json) · [English](knowledge-base/registry/交付.en.json)
- [来源](knowledge-base/registry/来源.json) · [English](knowledge-base/registry/来源.en.json)
- [当前版本](knowledge-base/当前版本.json) · [English](knowledge-base/当前版本.en.json)
