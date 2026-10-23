# 贡献指南

[English](CONTRIBUTING.md) | 简体中文

白鹭欢迎引擎、示例、工具、设计与文档方面的贡献。请先阅读[能力与进展总览](knowledge-base/Cns/docs/core-progress.md)，再查阅受影响子系统的契约。公开仓库为 [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)。

## 当前可以参与的工作

- 按公共契约改进显示、资源、动画、输入和宿主行为，补充有意义的回归用例。
- 按工程规划推进创作、工程编辑及迁移流程。
- 提供获授权的游戏、界面和动画样本，以及真实宿主或目标设备验证。
- 改进文档、翻译与复现方法，为技术结论补充来源。

需要设计讨论的改动可使用 [RFC 模板](knowledge-base/Cns/templates/RFC提案.md)，已审阅的决策使用 [ADR 模板](knowledge-base/Cns/templates/ADR决策记录.md)登记。

## 提交与审阅

每项贡献围绕明确问题组织，说明改动后的行为、受影响契约与兼容性、来源和验证。缺陷修复应提供复现步骤，并说明剩余限制。公共 API 变化同步更新规格与相应回归。

仓库贡献通过 Issue 与 PR 进行。方案经审阅后再更新其登记状态，草稿或构建成功不等于完整产品能力交付。技术讨论围绕问题、证据和取舍展开。

## 复现现有核心检查

使用 Node.js 26.7.0、pnpm 11.25.0 和 TypeScript 7.0.2，在仓库根目录执行：

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

开发时使用 `node tools/check-incremental.mjs --base origin/main` 获取受影响行为反馈。推送前审阅来源、两种阅读版本和关键英文注释。提交钩子检查文本字节，推送钩子对干净已提交快照运行 `node tools/check-push.mjs --committed`。合并前仍需完整 `pnpm check:merge` / 集成 CI、独立评审及受影响的实际浏览器证据，详见[工程计划](knowledge-base/Cns/docs/architecture-and-engineering-plan.md)的交付分层。

Windows 集成 CI 作业的执行时限为 60 分钟，以便托管运行器完成全部检查。这是执行预算，不是开发迭代耗时目标，也不豁免任何检查；合并前所有必需检查仍须完整通过。

## 工程与 API 规范

遵循[工程结构](knowledge-base/Cns/docs/工程技术架构与项目结构.md)、[API 规范](knowledge-base/Cns/docs/公共API设计与命名规范.md)和[质量要求](knowledge-base/Cns/docs/代码规范与质量门禁.md)，保持包边界、明确的资源所有权和不依赖 DOM/Node 的核心。文件身份及第一方文本使用[路径与原始字节规范](knowledge-base/Cns/docs/仓库路径身份与换行规范.md)。

## 来源、AI 与公开内容

第一方代码和文档采用 Apache-2.0，第三方声明与资产署名随材料保留。按[来源记录](knowledge-base/Cns/templates/实现来源记录.md)说明实现资料、依赖、AI 辅助与审阅。贡献者对提交的行为、来源权利和验证负责。

公开文档以连贯、中性的项目口吻说明目的、约束、推导、契约与结果，引用相关工作，不将产品叙述组织成对话答复或指令清单。实质性决策历史与来源进入对应记录，不把未记录的个人想法归于任何人。

凭据、私有配置、未获授权的旧工程及未整理的内部交流不进入仓库。研究与依赖使用遵循[实现规范](knowledge-base/Cns/docs/独立实现与第三方依赖规范.md)。

## 双语检查与推送钩子

维护完整中英文阅读版本。知识库分别放在 en/ 和 Cns/，仓库默认阅读文档用英文，中文伴随文件用 .zh-CN.md。更新当前身份和登记册视图前，审阅两种语言的含义。关键代码注释使用英文。详见[双语检查](knowledge-base/Cns/docs/双语文档与推送前检查.md)和[目录规范](knowledge-base/Cns/docs/documentation-layout.md)。

## 浏览器检查与公开清单

prepush 不启动浏览器。按改动选取已定义的 Canvas/WebGPU 检查，并记录实际环境和结果；复用旧结果时，明确核对相关身份未变。源码公开、浏览器行为、目标设备性能与远端 CI 分别记录。

私有执行输出、依赖缓存和生成文件不进入公开清单。原始证据、历史源码身份及上游法律原件保留来源。远端交付流程见[发布指南](PUBLICATION.zh-CN.md)。

## M0 上手与协作入口

以[上手指南](knowledge-base/Cns/docs/getting-started.md)为当前环境、贡献分工与评审边界入口。安装固定 PowerShell 7.6.5。贡献草稿允许单语，维护方协助补齐双语及当前元数据；最终公开交付与主干仍须通过完整门禁。

通过[公开看板](https://github.com/users/cnedwin/projects/2)了解实时状态，通过 [Issue #52](https://github.com/cnedwin/Egret_rebuild/issues/52)开始首次贡献。可参与事项必须明确入口、预期结果、检查与评审联系人；阻塞事项写明缺少的依赖和下一步。维护者审查证据后更新状态，Issue/PR 标签本身不证明验收。[新人清单](knowledge-base/Cns/docs/getting-started.md#完整演练首次贡献)说明贡献声明与维护者集成流程。

按[架构计划](knowledge-base/Cns/docs/architecture-and-engineering-plan.md)选择评审范围：纯文字变更需要内容/链接/双语评审；环境/CI/验证变更需要干净环境及拒绝路径证据；渲染/资源/动画变更另需受影响的真实浏览器检查。这些附加评审不替代必需的完整合并门禁，不能从维护者账户 CI 推断外部 fork、真人或设备结果。
