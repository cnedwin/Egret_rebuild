# 白鹭引擎知识库

[English](../en/README.md) | 简体中文

白鹭引擎以渲染与运行时为基础，将复杂二维界面、轻量三维内容、资源与动画、创作工具及工程自动化连接起来。知识库说明各部分之间的关系，以及相应的验证方式。

## 从这里开始

| 主题 | 阅读 |
| --- | --- |
| 产品方向 | [定位](docs/设计理念与定位.md) |
| 产品方向 | [需求](docs/产品需求说明书.md) |
| 技术架构 | [技术白皮书](docs/技术白皮书.md) |
| 技术架构 | [系统架构](docs/技术架构.md) |
| 技术架构 | [渲染与运行时](docs/渲染引擎与运行时.md) |
| 技术架构 | [产品组成](docs/产品组成.md) |
| 工程实施 | [工程规划](docs/工程规划.md) |
| 工程实施 | [交付与验收](docs/交付计划.md) |
| 工程实施 | [工程结构](docs/工程技术架构与项目结构.md) |
| 工程实施 | [API 设计](docs/公共API设计与命名规范.md) |
| 创作与兼容 | [AI 与工程接口](docs/AI创作与工程接口.md) |
| 创作与兼容 | [Spine 支持](docs/Spine动画支持需求与验收.md) |
| 创作与兼容 | [旧工程迁移](docs/旧工程迁移.md) |
| 进展与参与 | [能力与进展](docs/core-progress.md) |
| 进展与参与 | [变更记录](CHANGELOG.md) |
| 进展与参与 | [贡献指南](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.zh-CN.md) |
| 资料来源 | [鸣谢](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.zh-CN.md) |

## 当前工程状态

工程预览 **0.55.0** 增加显式本地线性规划，调用方选择成员并将位置应用到既有 Button。参阅[规格](docs/local-linear-layout-spec.md)、[证据](docs/local-linear-layout-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/linear-layout/README.zh-CN.md)。已记录的桌面 Canvas/WebGPU 检查覆盖固定双 Button 流程；环境及边界见证据记录。 更广泛的已实现接口及剩余工作见[能力与进展](docs/core-progress.md)。工作区包仍为 private、版本 0.0.0，宿主协议仍为 1.0。

## 接口契约与示例

[文档导航](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.zh-CN.md)提供各子系统的契约、证据与可运行示例。详细契约定义所有权、有序读取、错误及资源释放行为；示例指南说明受支持路径的运行方法。

## 登记与历史

[需求](registry/需求.json)、[决策](registry/决策.json)、[假设](registry/假设.json)、[交付](registry/交付.json)和[来源](registry/来源.json)共用一套状态模型，英文版本由中文原始登记册同步。

历史研究整理在[第一轮](archive/第一轮研究.md)、[第二轮](archive/第二轮研究.md)和[第三轮](archive/第三轮研究.md)。日期、固定版本和实验结果保留其适用范围。版本演进见变更记录及相应的详细记录。

## 参与贡献

请先阅读[知识库贡献指南](CONTRIBUTING.md)，按贡献内容选用 [RFC](templates/RFC提案.md)、[ADR](templates/ADR决策记录.md)、[实验](templates/实验与验收.md)及[实现来源](templates/实现来源记录.md)模板。同步维护两种语言，并遵循[知识库维护规范](docs/知识库维护.md)。
