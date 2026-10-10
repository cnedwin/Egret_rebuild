# Agent 协作约定

[English](AGENTS.md) | 简体中文

本约定适用于全仓库，包括知识库共享实验、工具、证据、注释、Issue 与 PR。先读 [README](README.zh-CN.md)、[贡献指南](CONTRIBUTING.zh-CN.md)、[来源记录](source-origin.json)与相关规格，按用户既有授权范围开展工作。

## 架构与实现

- 核心按白鹭自己的规格独立实现。沿用熟悉的白鹭领域命名，遵循既有模块、API 与代码规范。机制研究、第三方依赖、白鹭适配与第一方实现分别登记来源及版本。
- 保持包依赖图：engine 依赖 runtime/contracts，runtime 仅依赖 contracts，contracts 不依赖其他包。保留包 exports、strict 配置及不含 DOM/Node 环境全局的核心边界。公开示例与行为测试通过 `@egret/engine` 公共入口使用构建产物。
- `@egret/engine/web` 保持 Canvas-only，不请求 WebGPU 或 robust-predicates 模块；WebGPU 使用显式 `@egret/engine/webgpu` 入口。rendering 独立编译项目保持无 DOM，仅引用 contracts。engine 精确固定的外部依赖 `robust-predicates` 3.0.3 仅允许在 rendering 通过包根入口的公共 `orient2d` 导入，适用 Unlicense，并与内部包依赖图和项目引用分别检查。
- 私有几何单元测试可直接导入构建后的 `engine/dist/rendering` 辅助模块，此例外不适用于公开行为测试。
- 实验性 `tools/verify-webgpu-b1.mjs` 仅可加载固定构建图：`packages/engine/dist/web/b1.js`、`packages/engine/dist/rendering/meshGeometry3D.js`、`packages/engine/dist/rendering/matrix4.js`、`packages/engine/dist/web/webgpuMeshPass.js`、`packages/contracts/dist/ImageData2D.js`，以及有限字面量导入闭包与固定别名。本例外不增加稳定导出，不允许普通示例或行为测试任意导入私有模块。
- 公共行为变化同步规格、来源记录与必要回归。记录实际环境、未验证项、反例及修复；第三方研究或历史测试不替代自主产品验收。

## 公开贡献与证据

措辞保持专业、客观与友善，以白鹭的目标场景、独立设计、接口和可复现结果说明变更。设计记录连接问题、选项、依据、反例及结论。技术比较注明资料版本与测试条件，性能目标与实测结论分别记录。

AI 辅助贡献注明实际范围、资料与作者复核。保留参考出处和鸣谢，区分机制研究、实验依赖、产品依赖与开发工具。保留第三方归属、版权、许可、NOTICE 及资产来源；第一方代码与文档沿用 Apache-2.0。

使用固定工具和 lockfile，安装时禁用生命周期脚本。版本、依赖、许可证或发布设置发生变化时，说明理由与影响。保护个人及商业信息、未授权原始工程、凭据和私有配置，只公开必要且已获授权的摘要。工作台调度与未经整理的聊天不进入发行内容。

整理证据只调整表达和公开范围，保留数据、结果、来源身份、失败与修订历史。公开副本注明投影关系，不改写历史哈希。实际接受状态以登记册和绑定版本的验证记录为准；浏览器、Native SDK、宿主、CI、目标设备性能及完整迁移分别验收。

## 文档与验证

公开简介英文优先，随后附中文。完整阅读版本分别放在 `knowledge-base/en/` 与 `knowledge-base/Cns/`，英文目录使用英文文件名。英文登记册视图从中文权威记录生成并保持只读，ID、状态、数字与来源一致。共享实验代码、原始证据、历史源码身份及上游许可原件保留出处。

每次推送 GitHub 前，复核来源归属、公开内容及完整双语版本，补齐关键代码英文注释，更新当前文档身份并执行 `node tools/prepush.mjs`。该命令检查公开结构、核心／类型／包边界、headless 行为及知识库结构，不启动浏览器。结构检查不能代替翻译质量复核或公开批准。

克隆后，贡献者与 CI 必须执行 `git config --local core.hooksPath .githooks` 启用同一推送钩子；应修复失败而非绕过钩子。详见[双语规范](knowledge-base/Cns/docs/双语文档与推送前检查.md)及[目录规范](knowledge-base/Cns/docs/documentation-layout.md)。

渲染变更按影响另行执行相应真实浏览器门禁：

```text
node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"
```

B1 命令用于受影响的 B1 场景渲染，详见[有界验证器](knowledge-base/Cns/docs/b1-browser-verifier.md)。使用已接受的固定依赖，浏览器默认启动且不附加 flags。沿用未变构建的已有证据时须明确比对身份；推送前仍须重新通过完整 prepush。

发现与登记路径在 Windows 按大小写不敏感方式排除私有执行、依赖及生成目录，清单不能覆盖排除规则。普通公开 AGENTS 文件仍有效；只有两个封存的 Three r186 研究构建精确路径／哈希保留既定例外。

## 授权

推送、发行、部署和仓库管理以用户实际授权为准，既有授权在其范围内持续有效。本地生成或验证不代表远端发布完成。本约定不授予账号权限，不扩大外部发布、消息发送或资产使用授权。
