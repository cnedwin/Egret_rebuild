# Agent协作约定

[English](AGENTS.en.md) | 简体中文

本仓库包含自主核心切片与公开知识库。先读README、CONTRIBUTING、source-origin.json及相关规格；按当前用户已授权范围完成工作。

- 自主核心按规格独立设计。资料研究、第三方依赖、白鹭适配和自主代码分别记录来源、版本与验证。
- engine依赖runtime/contracts，runtime仅依赖contracts，contracts不依赖其他包。公共示例与行为测试从`@egret/engine`入口使用构建产物，保持包exports、strict配置和无DOM/Node环境全局的核心边界。
- 公共行为变化同步规格、来源记录与必要回归。说明实际运行环境与未验证项，保留反例和修复记录。
- AI参与按实际资料、生成范围和作者复核声明；私有资料只保留可公开的必要摘要，凭据和个人数据不进入仓库。
- 使用固定工具和lockfile，安装禁用生命周期脚本。版本、依赖、许可证或发布设置的变化单独说明理由和影响。
- 第一方代码与文档沿用Apache-2.0，保留第三方版权、许可、NOTICE和资产归属。历史身份hash不因公开投影而改写。
- 推送、发布、部署与仓库管理以用户实际授权为准。本地文件生成或验证不代表远端发布完成。

原型的44/44行为检查与11项负类型断言是已记录的headless基线；GPU、Native、真实宿主、性能与CI需各自验收。知识库中的Three运行链属于第三方研究，不替代自主核心验证。

## 每次推送前的双语与公开检查

每次推送到GitHub前，整理全部可公开的文档和知识库，保持完整中文及英文阅读版本，并补全关键代码的英文注释。登记册英文视图从中文权威记录生成，保持ID、状态、数字与来源一致；原始证据、代码快照和上游许可保持原始身份。完成来源、归属、可公开内容与翻译语义复核后，运行`node tools/prepush.mjs`，该命令包含双语检查及核心验证。机器检查不能替代作者对公开授权和翻译含义的复核。

本地克隆后可执行`git config --local core.hooksPath .githooks`启用仓库推送钩子；钩子执行同一检查。CI与贡献者均执行该命令，禁止以跳过钩子代替修复。该约定适用于所有后续推送，详情见[双语规范](knowledge-base/docs/双语文档与推送前检查.md)。

0.12.0限定显示/帧及独立Canvas实现已通过97/97行为检查及25项负类型诊断；原44项仍是历史基线。渲染变更另须运行`node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>`；默认prepush不包含真实浏览器。
