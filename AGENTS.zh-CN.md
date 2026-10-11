# Agent 协作约定

[English](AGENTS.md) | 简体中文

本约定适用于全仓库，包括知识库共享实验、工具、证据、注释、Issue 与 PR。先读 [README](README.zh-CN.md)、[贡献指南](CONTRIBUTING.zh-CN.md)、[来源记录](source-origin.json)与相关规格，按用户既有授权范围开展工作。

## 架构与实现

- 核心按白鹭自己的规格独立实现。沿用熟悉的白鹭领域命名，遵循既有模块、API 与代码规范。机制研究、第三方依赖、白鹭适配与第一方实现分别登记来源及版本。
- 保持包依赖图：engine 依赖 runtime/contracts，runtime 仅依赖 contracts，contracts 不依赖其他包。保留包 exports、strict 配置及不含 DOM/Node 环境全局的核心边界。公开示例与行为测试通过 `@egret/engine` 公共入口使用构建产物。
- `@egret/engine/web` 保持 Canvas-only，不请求 WebGPU 或 robust-predicates 模块；WebGPU 使用显式 `@egret/engine/webgpu` 入口。rendering 独立编译项目保持无 DOM，仅引用 contracts。engine 精确固定的外部依赖 `robust-predicates` 3.0.3 仅允许在 rendering 通过包根入口的公共 `orient2d` 导入，适用 Unlicense，并与内部包依赖图和项目引用分别检查。
- 私有几何单元测试可直接导入构建后的 `engine/dist/rendering` 辅助模块，此例外不适用于公开行为测试。
- 在已采纳的 T1 测试范围内，公开控制还使用构建后的 `@egret/engine/text`；`@egret/runtime/text` 仅用于 T02 入口身份／类型／源码检查。`tests/text-raster-private.test.mjs` 的私有 runtime 导入仅限 `packages/runtime/dist/text/budget.js`、`packages/runtime/dist/text/request.js`、`packages/runtime/dist/text/plan.js` 与 `packages/runtime/dist/EgretError.js`，必须按单元测试记录。
- `tests/text-raster-allocation.test.mjs` 与 `tests/text-raster-materialization.test.mjs` 是使用真实初始化并恢复被拦截状态的受控构造／计数器故障单元。`tests/text-raster-residency-audit.test.mjs` 仅可在内存中为实际编译的 `packages/runtime/dist/text/TextRasterCache.js` 追加既有只读 `__textRetainedAudit`，注销其单模块加载钩子并保持磁盘字节不变。这些测试不新增产品导出、不授权任意私有导入，也不替代公开行为控制；逻辑计数／保留引用观察不能证明物理内存／GC、字体或渲染器验收。
- 实验性 `tools/verify-webgpu-b1.mjs` 的普通样例通过精确生成的 import map 导入构建后的 `@egret/engine`、`@egret/engine/scene3d`、`@egret/engine/webgpu/scene3d`。唯一直接私有产品导入为 `packages/engine/dist/web/webgpuMeshPass.js`，仅用于绑定源码的固定原生 WGSL 编译／N4 诊断。服务范围仅限验证器显式模块白名单、这些公共入口的有限字面量导入闭包及固定别名；N1–N5 各自在仓库外的一次性副本中只修改一个已记录的构建文件。S1／S2／SN1 是独立的真实 Engine／Stage／Scope／Bitmap 组合阶段，SN1 只遗漏指定父节点裁剪。原有 oracle 与七正例／五控制／十一次绘制／8214 次比较的计划保持不变。本例外不允许普通示例或公开行为测试私有导入产品模块，也不授权新的产品导出或任意诊断钩子。
- 公共行为变化同步规格、来源记录与必要回归。记录实际环境、未验证项、反例及修复；第三方研究或历史测试不替代自主产品验收。

<!-- MI1-AGENT-POLICY-BEGIN -->
## 主鼠标输入边界

- MI1 公开使用仅通过构建后的 `@egret/engine` 与可选 `@egret/engine/web/input`。可选入口只导出 `createMouseInput` 与契约中的六个类型；默认 Engine／Canvas／WebGPU 入口不增加该 API。Runtime 显示装配端口不通过 Engine 公开，核心保持无 DOM／Node。详见[契约](knowledge-base/Cns/docs/主鼠标输入契约.md)与[验证记录](knowledge-base/evidence/primary-mouse-input-verification.json)。
- `tests/mouse-input.test.mjs` 与 `tests/mouse-input-lifecycle.test.mjs` 使用真实公共 SDK 对象及受控浏览器端口，不私有导入产品，不复制命中或事件算法，也不声明真实 DOM／原生验收。实际浏览器与受控单元的结果分别记录。
- `#egret-mouse-input` 仅按精确包映射连接已命名的浏览器输入模块及声明到核心产物；共享验证器只允许显式固定映射和有限闭包，不授权通配符、任意私有导入或新产品导出。每项新策略变异必须先在独立完整夹具中通过当前基线；类型负例冻结实际未抑制诊断，待测表不得标作 PASS。
- MI1 证据分别记录源码、构建／公共接口、行为／生命周期、类型、策略、原生及最终公开／交付状态，保留失败与修正。公开内容不包含私有提示词、委派文件、未经整理的对话或个人绝对路径。
- MI1 沿用 HT1 准入：交互对象须挂接真实 Engine Stage 并显式设置自定义局部 `hitArea`；Graphics 边界或渲染像素不自动提供命中区域。事件回调通过 `event.payload` 读取坐标。
<!-- MI1-AGENT-POLICY-END -->

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
