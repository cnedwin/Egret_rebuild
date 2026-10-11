# 白鹭引擎重构工程知识库

[English](../en/README.md) | 简体中文

白鹭面向主要依靠 AI 制作游戏的新创作者，首期兼顾复杂 UI 的 2D 游戏与轻量 3D。渲染引擎和运行时、可持续编辑的工程、Agent 协作及旧工程完整迁移是设计核心。

最新工程预览为 **0.27.2**，是有界 CPU 显示树修复。完整验证通过 2,228 项核心测试、52 项公开检查，全部五项受影响的既有桌面浏览器回归通过。[验证与边界](docs/显示树扩展性.md)区分这些结果与完整引擎、编辑器、生产宿主、Agent、手机性能、Spine 及迁移验收。工作区包仍为 private 0.0.0；远程交付单独记录。

## 从这里开始

| 主题 | 阅读入口 |
| --- | --- |
| 产品方向 | [设计理念与定位](docs/设计理念与定位.md) · [产品需求](docs/产品需求说明书.md) · [产品组成](docs/产品组成.md) |
| 架构与交付 | [技术白皮书](docs/技术白皮书.md) · [渲染与运行时](docs/渲染引擎与运行时.md) · [工程规划](docs/工程规划.md) · [交付计划](docs/交付计划.md) |
| 结构、API 与代码 | [工程技术架构](docs/工程技术架构与项目结构.md) · [API 与命名](docs/公共API设计与命名规范.md) · [质量门禁](docs/代码规范与质量门禁.md) |
| 已实现切片与证据 | [核心进展](docs/core-progress.md) · [内容边界](docs/显示内容边界证据.md) · [Bitmap 区域](docs/bitmap-region-evidence.md) · [B1 浏览器验证器](docs/b1-browser-verifier.md) · [纹理采集](docs/texture-first-four-evidence.md) |
| 文字资源 | [无 DOM T1 契约](docs/文字栅格T1契约.md) · [T1 有界证据与验证范围](docs/文字栅格T1证据.md) |
| 文字显示 | [CPU TextField TF1 契约](docs/文字显示TF1契约.md) · [源码绑定证据与限制](docs/文字显示TF1证据.md) |
| 游戏时间 | [Engine 自有时钟契约](docs/游戏时间核心契约.md) · [CPU、类型与源码证据](docs/游戏时间核心证据.md) |
| 显示树扩展性 | [挂接边界、成本限制与验证范围](docs/显示树扩展性.md) |
| 二进制读取 | [自有 ByteReader BR1 契约](docs/字节读取器BR1契约.md) · [已有验证与待完成集成](docs/字节读取器BR1证据.md) |
| 标量 Tween | [Scope 标量契约](docs/标量补间契约.md) · [有界验证记录](docs/标量补间证据.md) |
| 动画与迁移 | [Spine 支持与验收](docs/Spine动画支持需求与验收.md) · [序列帧采样](docs/sequence-clip-contract.md) · [旧 MovieClip](docs/legacy-movieclip-evidence.md) · [旧工程迁移](docs/旧工程迁移.md) |
| AI 创作 | [AI 创作与工程接口](docs/AI创作与工程接口.md) · [Shaders 与 Playground 研究](docs/Shaders与Playground产品技术启发.md) |
| 参考研究 | [竞品演进](docs/竞品演进与生态.md) · [开源参考机制](docs/开源参考实现与采用方案.md) · [后端与原生 Runtime 提案](docs/图形后端编译与原生Runtime选型.md) |
| 历史实验 | [第一轮](archive/第一轮研究.md) · [第二轮](archive/第二轮研究.md) · [第三轮](archive/第三轮研究.md) |
| 社区参与 | [贡献指南](CONTRIBUTING.md) · [独立实现规范](docs/独立实现与第三方依赖规范.md) · [鸣谢](ACKNOWLEDGEMENTS.md) · [术语表](docs/术语表.md) |

## Spine 需求

已确认的 **R020** 要求完整支持 Spine 动画；**V020** 保持 planned，实施为 not_started，验收为 not_run。版本匹配、动画特性、复杂 UI／3D 合成、恢复、工具及迁移见[支持与验收矩阵](docs/Spine动画支持需求与验收.md)。这项需求增补不代表已实现兼容能力。

## 登记与历史

[需求](registry/需求.json)、[决策](registry/决策.json)、[假设](registry/假设.json)、[交付](registry/交付.json)与[来源](registry/来源.json)是共同状态的中文权威记录，英文版提供对应视图。稳定的 R/D/H/V/S 编号连接目标、提案、假设、交付与证据；编号不复用，被替代记录保留替代关系。

[记录索引](当前版本.json)、[变更记录](CHANGELOG.md)与[维护指南](docs/知识库维护.md)提供文档版本和历史。索引的版本字段保留历史 **0.13.0 知识库检查点**，其中交付状态属于该检查点。工程预览 **0.27.2** 记录[显示树扩展性](docs/显示树扩展性.md)，2,228 项核心测试、52 项公开检查和全部五项受影响的既有桌面浏览器回归通过；交付单独记录。前序工程预览 **0.27.1** 新增[自有 ByteReader](docs/字节读取器BR1契约.md)；[证据](docs/字节读取器BR1证据.md)区分隔离检查与待完成的 Main 集成及公开交付。工程预览 **0.27.0** 新增[显式行 CPU TextField](docs/文字显示TF1契约.md)；[证据](docs/文字显示TF1证据.md)区分 2,157 项完整原型测试、当前 411 文件扫描和相互重叠的限定套件。本截止点不验收原生 TextField、完整 UI／字体或最终公开门禁／交付。前序 工程预览 **0.26.0** 新增 [Scope 标量 Tween](docs/标量补间契约.md)；[记录检查](docs/标量补间证据.md)保留有界范围。完整核心验证已在记录的源码/夹具范围内通过；最终公开门禁与交付仍为 **PENDING**。前序 **0.25.0 工程预览**由[显式游戏时钟契约](docs/游戏时间核心契约.md)及[CPU、类型与源码记录证据](docs/游戏时间核心证据.md)说明；有界核心整合已审阅，交付保留独立截止点。前序 **0.24.0** [文字栅格 T1 契约](docs/文字栅格T1契约.md)及[证据](docs/文字栅格T1证据.md)保留初始截止点、后续已验收验证及 PR #9／Main 交付。此前 **0.23.0** [自有纹理几何与 Mesh2D 契约](docs/自有纹理几何与Mesh2D契约.md)及[有界 CPU／桌面证据](docs/纹理Profile的CPU证据与待完成门禁.md)保留各自记录范围；[内容边界](docs/显示内容边界契约.md)、[坐标查询](docs/显示坐标查询契约.md)与[SequencePlayer](docs/显式时间序列播放器契约.md)保留为前序增量。验收状态另以登记册为准；原始证据、来源身份、失败与修复保留各自记录范围。结构检查或历史研究不证明当前产品验收，也不证明性能领先。

## 参与贡献

欢迎提交实现、可复现反例、来源校勘、翻译、API 提案，以及自有或获授权的游戏与迁移样本。每次推送前，复核公开内容、归属及双语版本，补齐关键代码英文注释并运行完整[推送前检查](docs/双语文档与推送前检查.md)。另见[公开协作规范](docs/开源协作与公开表达规范.md)及[语言目录约定](docs/documentation-layout.md)。

## 纹理几何与桌面渲染

- [契约](docs/自有纹理几何与Mesh2D契约.md)
- [CPU 与桌面证据](docs/纹理Profile的CPU证据与待完成门禁.md)
