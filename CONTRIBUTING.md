# 贡献指南

[English](CONTRIBUTING.en.md) | 简体中文

先查看[README](README.md)、[知识库](knowledge-base/README.md)和[来源记录](source-origin.json)。现阶段可以改进三个headless包，提交生命周期、显示树或事件的反例与修复；也可校勘文档、补来源、提出接口设计，以及提供自有或获授权的迁移与文字样本。

本候选为开发预览，远端为[cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)，提交与评审状态见仓库分支和PR；尚未发布npm包。Issue、PR和维护职责按仓库实际配置执行。第一方代码与文档采用既有Apache-2.0，第三方声明随文件保留。具体贡献者与评审职责仍待公开登记。

## 变更说明

每项贡献说明问题、范围、关联规格、实现来源和验证结果。公共接口变化同步设计与迁移说明，候选设计通过评审后再登记为决策。沟通围绕技术影响、证据与复现步骤，保留上游项目的归属和版本。

自主核心按白鹭规格独立设计和编写；第三方库作为显式依赖记录版本、适用许可与修改。代码贡献填写[实现来源记录](knowledge-base/templates/实现来源记录.md)，说明实际资料、AI参与、生成范围和作者复核。来源问题结合具体输入与实现解决，结论限于实际检查范围。

## 验证

使用固定Node.js 24.19.0、pnpm 11.25.0与TypeScript 7.0.2。执行`pnpm install --frozen-lockfile --ignore-scripts`后，运行`node tools/verify.mjs`及`node examples/headless.mjs`。按变化选择有意义的回归，记录环境、命令、输入、输出和未覆盖项。

现有原型基线为44/44行为检查和11项负类型断言，限于CPU与模拟host。真实GPU、Native、宿主、性能和CI另行验证。包清单的`private: true`、版本0.0.0、exports与依赖方向属于当前检查合同；升级或发布设置的变化需单独说明影响。

## 可公开资料

提交可分发代码、样本和技术摘要。私有原包、凭据、个人数据和未获公开授权的内容不进入贡献；历史研究以必要的来源种类和技术结论呈现。详细流程见[知识库贡献指南](knowledge-base/CONTRIBUTING.md)与[独立实现规范](knowledge-base/docs/独立实现与第三方依赖规范.md)。

## 每次推送前的双语与公开检查

每次推送到GitHub前，整理全部可公开的文档和知识库，保持完整中文及英文阅读版本，并补全关键代码的英文注释。登记册英文视图从中文权威记录生成，保持ID、状态、数字与来源一致；原始证据、代码快照和上游许可保持原始身份。完成来源、归属、可公开内容与翻译语义复核后，运行`node tools/prepush.mjs`，该命令包含双语检查及核心验证。机器检查不能替代作者对公开授权和翻译含义的复核。

本地克隆后可执行`git config --local core.hooksPath .githooks`启用仓库推送钩子；钩子执行同一检查。CI与贡献者均执行该命令，禁止以跳过钩子代替修复。该约定适用于所有后续推送，详情见[双语规范](knowledge-base/docs/双语文档与推送前检查.md)。
