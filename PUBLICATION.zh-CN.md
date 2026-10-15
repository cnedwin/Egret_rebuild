# 发布指南

[English](PUBLICATION.md) | 简体中文

公开仓库为 [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild)，main 是集成分支。工程预览 0.54.0 已通过 PR #42 合入主干。工作区包仍为 private、版本 0.0.0，宿主协议为 1.0。源码公开与生产版引擎交付采用各自的验收条件。

## 准备贡献

1. 说明问题、行为、受影响的契约及验证方式，遵循[贡献指南](CONTRIBUTING.zh-CN.md)和[仓库协作规范](AGENTS.zh-CN.md)。
2. 补齐两种语言的阅读文档、来源鸣谢与关键英文代码注释，在文字定稿后更新当前文件身份。
3. 运行 node tools/prepush.mjs。渲染改动还需执行 AGENTS 中适用的真实浏览器检查，记录实际环境、结果和剩余限制。
4. 按仓库贡献权限推送经过审阅的分支并建立 PR。核对远端提交，经授权合并后再核对 main 的内容。

本地启用钩子：git config --local core.hooksPath .githooks。按正常检查流程修复失败。

## 公开范围与来源

第一方代码和文档采用 [Apache-2.0](LICENSE)。第三方版权、许可证、通知和资产署名随相应材料保留。[来源记录](source-origin.json)说明第一方实现、依赖、研究与 AI 辅助的实际作用。

公开可维护的源码、示例、规格及可复现的技术说明。凭据、私有配置、未获授权的旧工程、依赖／构建缓存和未经整理的内部交流不进入仓库。原始证据、封存源码及法律原件保持其身份。

## 验收范围

[能力与进展总览](knowledge-base/Cns/docs/core-progress.md)说明已实现与已验证的范围。完整 Spine、生产宿主、目标设备性能、创作工具及旧工程迁移分别按其计划验收。[变更记录](knowledge-base/Cns/CHANGELOG.md)与仓库历史记录实际交付；本地检查不能替代远端 CI 或正式发布结果。
