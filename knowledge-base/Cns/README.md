# 白鹭引擎知识库

[English](../en/README.md) | 简体中文

从这里查阅白鹭社区重建的产品与工程文档。[当前能力](docs/core-progress.md)记录最近一次源码复盘的基线及实际验收范围。

## 从当前项目开始

| 问题 | 阅读入口 |
| --- | --- |
| 现在能运行什么？ | [核心能力与剩余工作](docs/core-progress.md) |
| 怎样上手或参与？ | [上手指南](docs/getting-started.md) · [贡献指南](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.zh-CN.md) |
| 接下来开发什么？ | [工程计划](docs/工程规划.md) · [M2–M4 路线图](docs/m2-m4-delivery-plan.md) |
| 完整产品是什么？ | [产品需求](docs/产品需求说明书.md) · [产品组成](docs/产品组成.md) · [定位](docs/设计理念与定位.md) |
| 技术如何组织？ | [白皮书](docs/技术白皮书.md) · [架构计划](docs/architecture-and-engineering-plan.md) · [实际／未来包结构](docs/工程技术架构与项目结构.md) |
| 什么算完成交付？ | [交付计划](docs/交付计划.md) · [更新日志](CHANGELOG.md) |

## 按子系统阅读

| 领域 | 契约与活动计划 |
| --- | --- |
| 渲染／资源 | [M1](docs/m1-rendering-resource-plan.md) · [共享渲染](docs/shared-render-profile-contract.md) · [WebGL2](docs/webgl2-executor-contract.md) · [恢复](docs/resource-recovery-contract.md) |
| 内容／动画 | [M2](docs/m2-spine-content-plan.md) · [构建／运行时](docs/content-build-pipeline.md) · [Spine](docs/spine-content-ingress.md) · [序列 RESET](docs/序列动画RESET替换.md) |
| UI／文字／输入 | [M3](docs/m3-ui-text-input-plan.md) · [托管 UI](docs/ui-data-panel.md) · [段落](docs/readonly-paragraph-sdk.md) · [字体](docs/font-resource-generations.md) · [特效](docs/shared-ui-effects.md) |
| 混合整合 | [M4](docs/m4-core-acceptance-plan.md) · [Android 范围](docs/android-device-validation.md) · [干净消费者](docs/clean-consumer.md) |
| 3D | [有界 3D 与 2D 合成](docs/authored-scene3d.md) · [独立 World3D](docs/world3d.md) |
| 后续工具／兼容 | [工程事务](docs/工程事务核心合同.md) · [AI／工程接口](docs/AI创作与工程接口.md) · [完整迁移](docs/旧工程迁移.md) |

[完整文档目录](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.zh-CN.md)继续链接底层契约，各子系统保留准确运行时入口、来源／许可和验证。

## 阅读状态与证据

当前为工程预览。[#55](https://github.com/cnedwin/Egret_rebuild/issues/55) 的固定桌面 CPU 与准备目标已达到，稀疏和全脏帧节奏及 GPU 时间仍待验收。[Issues](https://github.com/cnedwin/Egret_rebuild/issues)、[里程碑](https://github.com/cnedwin/Egret_rebuild/milestones)和[社区看板](https://github.com/users/cnedwin/projects/2)跟踪工作包。

已确认需求与原证据／决策／交付登记保留身份，英文登记视图是中文权威记录的只读翻译。历史待定截止按原日期阅读，不升级为当前项目结论。

## 历史记录与署名

[更新日志](CHANGELOG.md)、有日期的研究归档和子系统证据保留原始测量、失败、修复和来源。[旧知识库首页](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/Cns/README.md)保留早期预览叙述及计数；当前索引不重跑或扩张其范围。

第一方代码／文档仍采用 Apache-2.0，第三方依赖、字体和动画内容保留各自告知与条件。[鸣谢](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md)和[来源账本](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json)区分独立实现、依赖整合、参考及 AI 协助。
