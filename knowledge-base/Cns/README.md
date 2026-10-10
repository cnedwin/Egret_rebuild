# 白鹭引擎重构工程知识库

[English](../en/README.md) | 简体中文

白鹭面向主要依靠 AI 制作游戏的新创作者，首期兼顾复杂 UI 的 2D 游戏与轻量 3D。渲染引擎和运行时、可持续编辑的工程、Agent 协作及旧工程完整迁移是设计核心。

当前工程预览为 **0.20.0**，已有局部自主核心实现。完整引擎、生产宿主、编辑器、Agent 服务、目标设备性能及完整迁移仍待完成；工程检查点、设计提案和已验收结果分别登记。

## 从这里开始

| 主题 | 阅读入口 |
| --- | --- |
| 产品方向 | [设计理念与定位](docs/设计理念与定位.md) · [产品需求](docs/产品需求说明书.md) · [产品组成](docs/产品组成.md) |
| 架构与交付 | [技术白皮书](docs/技术白皮书.md) · [渲染与运行时](docs/渲染引擎与运行时.md) · [工程规划](docs/工程规划.md) · [交付计划](docs/交付计划.md) |
| 结构、API 与代码 | [工程技术架构](docs/工程技术架构与项目结构.md) · [API 与命名](docs/公共API设计与命名规范.md) · [质量门禁](docs/代码规范与质量门禁.md) |
| 已实现切片与证据 | [核心进展](docs/core-progress.md) · [Bitmap 区域](docs/bitmap-region-evidence.md) · [B1 浏览器验证器](docs/b1-browser-verifier.md) · [纹理采集](docs/texture-first-four-evidence.md) |
| 动画与迁移 | [Spine 支持与验收](docs/Spine动画支持需求与验收.md) · [序列帧采样](docs/sequence-clip-contract.md) · [旧 MovieClip](docs/legacy-movieclip-evidence.md) · [旧工程迁移](docs/旧工程迁移.md) |
| AI 创作 | [AI 创作与工程接口](docs/AI创作与工程接口.md) · [Shaders 与 Playground 研究](docs/Shaders与Playground产品技术启发.md) |
| 参考研究 | [竞品演进](docs/竞品演进与生态.md) · [开源参考机制](docs/开源参考实现与采用方案.md) · [后端与原生 Runtime 提案](docs/图形后端编译与原生Runtime选型.md) |
| 历史实验 | [第一轮](archive/第一轮研究.md) · [第二轮](archive/第二轮研究.md) · [第三轮](archive/第三轮研究.md) |
| 社区参与 | [贡献指南](CONTRIBUTING.md) · [独立实现规范](docs/独立实现与第三方依赖规范.md) · [鸣谢](ACKNOWLEDGEMENTS.md) · [术语表](docs/术语表.md) |

## Spine 需求

已确认的 **R020** 要求完整支持 Spine 动画；**V020** 保持 planned，实施为 not_started，验收为 not_run。版本匹配、动画特性、复杂 UI／3D 合成、恢复、工具及迁移见[支持与验收矩阵](docs/Spine动画支持需求与验收.md)。这项需求增补不代表已实现兼容能力。

## 登记与历史

[需求](registry/需求.json)、[决策](registry/决策.json)、[假设](registry/假设.json)、[交付](registry/交付.json)与[来源](registry/来源.json)是共同状态的中文权威记录，英文版提供对应视图。稳定的 R/D/H/V/S 编号连接目标、提案、假设、交付与证据；编号不复用，被替代记录保留替代关系。

[记录索引](当前版本.json)、[变更记录](CHANGELOG.md)与[维护指南](docs/知识库维护.md)提供文档版本和历史。索引的版本字段保留历史 **0.13.0 知识库检查点**，其中交付状态属于该检查点。最新 **0.20.0 工程预览**由[SequencePlayer 契约与验收](docs/显式时间序列播放器契约.md)说明，验收状态另以登记册为准。原始证据、来源身份、失败与修复保留各自记录范围；结构检查或历史研究不证明当前产品验收，也不证明性能领先。

## 参与贡献

欢迎提交实现、可复现反例、来源校勘、翻译、API 提案，以及自有或获授权的游戏与迁移样本。每次推送前，复核公开内容、归属及双语版本，补齐关键代码英文注释并运行完整[推送前检查](docs/双语文档与推送前检查.md)。另见[公开协作规范](docs/开源协作与公开表达规范.md)及[语言目录约定](docs/documentation-layout.md)。
