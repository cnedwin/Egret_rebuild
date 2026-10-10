# 文档指南

[English](DOCUMENTATION.md) | 简体中文

按主题选择入口。完整知识库阅读版本分别位于[英文目录](knowledge-base/en/README.md)和[中文目录](knowledge-base/Cns/README.md)，历史研究与当前设计、实现文档分开组织。

| 主题 | English | 中文 |
| --- | --- | --- |
| 项目介绍与版本 | [README](README.md) · [Changelog](knowledge-base/en/CHANGELOG.md) | [README](README.zh-CN.md) · [变更记录](knowledge-base/Cns/CHANGELOG.md) |
| 产品方向 | [Positioning](knowledge-base/en/docs/design-philosophy-and-positioning.md) · [Requirements](knowledge-base/en/docs/product-requirements.md) | [设计理念与定位](knowledge-base/Cns/docs/设计理念与定位.md) · [产品需求](knowledge-base/Cns/docs/产品需求说明书.md) |
| 架构与交付 | [White paper](knowledge-base/en/docs/technical-white-paper.md) · [Engineering plan](knowledge-base/en/docs/engineering-plan.md) · [Delivery plan](knowledge-base/en/docs/delivery-plan.md) | [技术白皮书](knowledge-base/Cns/docs/技术白皮书.md) · [工程规划](knowledge-base/Cns/docs/工程规划.md) · [交付计划](knowledge-base/Cns/docs/交付计划.md) |
| 工程规范 | [Structure](knowledge-base/en/docs/engineering-architecture-and-project-structure.md) · [API](knowledge-base/en/docs/public-api-design-and-naming.md) · [Quality gates](knowledge-base/en/docs/code-standards-and-quality-gates.md) | [工程结构](knowledge-base/Cns/docs/工程技术架构与项目结构.md) · [API](knowledge-base/Cns/docs/公共API设计与命名规范.md) · [质量门禁](knowledge-base/Cns/docs/代码规范与质量门禁.md) |
| 核心与包 API | [Progress](knowledge-base/en/docs/core-progress.md) · [Engine](packages/engine/README.md) · [Runtime](packages/runtime/README.md) · [Contracts](packages/contracts/README.md) | [核心进展](knowledge-base/Cns/docs/core-progress.md) · [Engine](packages/engine/README.zh-CN.md) · [Runtime](packages/runtime/README.zh-CN.md) · [Contracts](packages/contracts/README.zh-CN.md) |
| 渲染与资源 | [Rendering direction](knowledge-base/en/docs/rendering-engine-and-runtime.md) · [Bitmap evidence](knowledge-base/en/docs/bitmap-region-evidence.md) · [Texture API](docs/texture-a1.md) · [B1 verification](knowledge-base/en/docs/b1-browser-verifier.md) | [渲染方向](knowledge-base/Cns/docs/渲染引擎与运行时.md) · [Bitmap 证据](knowledge-base/Cns/docs/bitmap-region-evidence.md) · [纹理 API](docs/texture-a1.zh-CN.md) · [B1 验证](knowledge-base/Cns/docs/b1-browser-verifier.md) |
| 3D 基础 | [CPU foundation](knowledge-base/en/docs/3d-foundation.md) · [Scene contract](knowledge-base/en/docs/3d-cpu-scene-contract.md) · [Mesh contract](knowledge-base/en/docs/3d-webgpu-mesh-contract.md) | [CPU 基础](knowledge-base/Cns/docs/3d-foundation.md) · [场景契约](knowledge-base/Cns/docs/3d-cpu-scene-contract.md) · [网格契约](knowledge-base/Cns/docs/3d-webgpu-mesh-contract.md) |
| 动画与迁移 | [Spine requirement](knowledge-base/en/docs/spine-animation-support-and-acceptance.md) · [Clips](knowledge-base/en/docs/sequence-clip-contract.md) · [Sequence player](knowledge-base/en/docs/sequence-player-contract.md) · [Legacy migration](knowledge-base/en/docs/legacy-project-migration.md) | [Spine 需求](knowledge-base/Cns/docs/Spine动画支持需求与验收.md) · [序列帧](knowledge-base/Cns/docs/sequence-clip-contract.md) · [播放器](knowledge-base/Cns/docs/显式时间序列播放器契约.md) · [旧工程迁移](knowledge-base/Cns/docs/旧工程迁移.md) |
| AI 创作与工程编辑 | [AI interfaces](knowledge-base/en/docs/ai-creation-and-engineering-interfaces.md) · [Project API](packages/project/README.md) | [AI 接口](knowledge-base/Cns/docs/AI创作与工程接口.md) · [工程 API](packages/project/README.zh-CN.md) |
| 参考机制与归属 | [Reference adoption](knowledge-base/en/docs/open-source-reference-implementations-and-adoption.md) · [Independent implementation](knowledge-base/en/docs/independent-implementation-and-dependency-policy.md) · [Acknowledgements](ACKNOWLEDGEMENTS.md) | [开源参考](knowledge-base/Cns/docs/开源参考实现与采用方案.md) · [独立实现](knowledge-base/Cns/docs/独立实现与第三方依赖规范.md) · [鸣谢](ACKNOWLEDGEMENTS.zh-CN.md) |
| 历史研究 | [Round 1](knowledge-base/en/archive/round-1-research.md) · [Round 2](knowledge-base/en/archive/round-2-research.md) · [Round 3](knowledge-base/en/archive/round-3-research.md) | [第一轮](knowledge-base/Cns/archive/第一轮研究.md) · [第二轮](knowledge-base/Cns/archive/第二轮研究.md) · [第三轮](knowledge-base/Cns/archive/第三轮研究.md) |
| 贡献与发布 | [Contributing](CONTRIBUTING.md) · [Agent agreement](AGENTS.md) · [Publication guide](PUBLICATION.md) | [贡献指南](CONTRIBUTING.zh-CN.md) · [Agent 约定](AGENTS.zh-CN.md) · [发布指南](PUBLICATION.zh-CN.md) |

完整双语文件清单与当前身份见 [localization.json](localization.json)，实现来源见 [source-origin.json](source-origin.json)。中文登记册为权威记录，英文版是只读视图。证据、源码快照及上游许可原件保留身份；文件放置方式见[语言目录约定](knowledge-base/Cns/docs/documentation-layout.md)。

文档区分提案、已实现切片、已有结果与待验收工作。Spine 已登记为确认需求，实施仍待开始。历史测试数量或文档维护不证明当前产品功能或性能。
