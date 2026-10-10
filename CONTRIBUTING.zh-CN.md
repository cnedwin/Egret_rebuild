# 贡献指南

[English](CONTRIBUTING.md) | 简体中文

历史 0.13.0 矩形检查点见单独的[实现与验证记录](knowledge-base/Cns/docs/WebGPU矩形实现证据.md)；源码身份、结果及待办保留当时范围，不代表当前产品验收。

先查看[README](README.zh-CN.md)、[知识库](knowledge-base/Cns/README.md)和[来源记录](source-origin.json)。现阶段可以改进三个headless包，提交生命周期、显示树或事件的反例与修复；也可校勘文档、补来源、提出接口设计，以及提供自有或获授权的迁移与文字样本。

本候选为开发预览，远端为[cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)，提交与评审状态见仓库分支和PR；尚未发布npm包。Issue、PR和维护职责按仓库实际配置执行。第一方代码与文档采用既有Apache-2.0，第三方声明随文件保留。具体贡献者与评审职责仍待公开登记。

## 变更说明

每项贡献说明问题、范围、关联规格、实现来源和验证结果。公共接口变化同步设计与迁移说明，候选设计通过评审后再登记为决策。沟通围绕技术影响、证据与复现步骤，保留上游项目的归属和版本。

自主核心按白鹭规格独立设计和编写；第三方库作为显式依赖记录版本、适用许可与修改。代码贡献填写[实现来源记录](knowledge-base/Cns/templates/实现来源记录.md)，说明实际资料、AI参与、生成范围和作者复核。来源问题结合具体输入与实现解决，结论限于实际检查范围。

## 验证

使用固定Node.js 24.19.0、pnpm 11.25.0与TypeScript 7.0.2。执行`pnpm install --frozen-lockfile --ignore-scripts`后，运行`node tools/verify.mjs`及`node examples/headless.mjs`。按变化选择有意义的回归，记录环境、命令、输入、输出和未覆盖项。

现有原型基线为44/44行为检查和11项负类型断言，限于CPU与模拟host。真实GPU、Native、宿主、性能和CI另行验证。包清单的`private: true`、版本0.0.0、exports与依赖方向属于当前检查合同；升级或发布设置的变化需单独说明影响。

## 可公开资料

提交可分发代码、样本和技术摘要。私有原包、凭据、个人数据和未获公开授权的内容不进入贡献；历史研究以必要的来源种类和技术结论呈现。详细流程见[知识库贡献指南](knowledge-base/Cns/CONTRIBUTING.md)与[独立实现规范](knowledge-base/Cns/docs/独立实现与第三方依赖规范.md)。

## 每次推送前的双语与公开检查

每次推送到GitHub前，整理全部可公开的文档和知识库，保持完整中文及英文阅读版本，并补全关键代码的英文注释。登记册英文视图从中文权威记录生成，保持ID、状态、数字与来源一致；原始证据、代码快照和上游许可保持原始身份。完成来源、归属、可公开内容与翻译语义复核后，运行`node tools/prepush.mjs`，该命令包含双语检查及核心验证。机器检查不能替代作者对公开授权和翻译含义的复核。

本地克隆后可执行`git config --local core.hooksPath .githooks`启用仓库推送钩子；钩子执行同一检查。CI与贡献者均执行该命令，禁止以跳过钩子代替修复。该约定适用于所有后续推送，详情见[双语规范](knowledge-base/Cns/docs/双语文档与推送前检查.md)。

## 浏览器门禁与公开清单

每次推送必须执行`node tools/prepush.mjs`，检查公开结构、核心/类型/边界、headless行为与知识库结构；它不启动浏览器。渲染变更按影响另执行`node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`与独立`node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`。使用已接受的固定依赖，浏览器默认启动无附加flags；源码身份比对相同的既有构建结果可明确注明后保留。

发现与登记路径均按Windows大小写不敏感方式排除私有执行、依赖及生成目录；清单不能覆盖排除规则。普通公开AGENTS文档仍有效；仅保留两个精确路径/hash的Three r186历史研究构建例外。结构检查不能产生翻译含义或公开审阅批准。

受影响的 B1 场景渲染变更还应执行 `node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"`，使用自己的安装包路径和仓库外全新输出路径。见[有限 B1 浏览器验证器](knowledge-base/Cns/docs/b1-browser-verifier.md)。默认 prepush 不启动浏览器；推送前必须另行通过新完整检查。

## 国际社区文档约定

公开简介英文优先，随后附中文。完整知识库阅读版本分别放在 `knowledge-base/en/` 与 `knowledge-base/Cns/`，英文目录内使用英文文件名。共享实验代码、原始证据、历史源码身份与上游许可原件保留出处。设计记录使用问题、选项、依据、反例及结论，公开表达保持专业、客观与友善。每次推送 GitHub 前复核来源、公开范围及完整双语版本，补全关键代码英文注释，并运行完整 prepush。见[目录规范](knowledge-base/Cns/docs/documentation-layout.md)。
