# Agent 协作约定

[English](AGENTS.md) | 简体中文

<!-- HYGIENE-0.45.1-POLICY-BEGIN -->
## 仓库路径与原始字节规范

验证和交付工具使用共享 `tools/lib/file-identity.mjs`，完整所属根内逻辑路径使用规范 POSIX 写法并保留创作大小写；绝对物理路径比较与包含检查使用明确的平台语义。文件名相同、统一转小写或词法路径等价不能授权另一个文件身份。

新创作第一方文本通过 `tools/write-repository-text.mjs --path <owner-relative-file>` 或 `knowledge-base/tools/Write-CanonicalText.ps1 -RelativePath <owner-relative-file> -Text <text>` 写入，采用不带 BOM 的 UTF-8、LF 和一个末尾换行，保留内部空行及 Markdown 硬换行空格。不得用 `Environment.NewLine` 序列化仓库文本。原始指纹严格保留字节，计算哈希时不得规范化 EOL、BOM、Unicode 或空白；不得对上游／法律原件、原始回执、封存源码快照或历史证据运行创作格式化器。仅刷新确有修改且经过评审的当前文件身份。

通过 `git config --local core.hooksPath .githooks` 启用两个仓库本地钩子，并保留其 Git 可执行模式。pre-commit 检查工作／未跟踪文本及实际暂存字节；pre-push 对干净已提交快照运行完整 `node tools/prepush.mjs --committed`。准备修改时还须运行普通 `node tools/prepush.mjs`。修复失败并完成独立源码／结果与双语评审后再交付，不能以跳过钩子或放宽字节检查替代修复。

知识库验证采用 `-CheckOnly`。分别记录源码、保存的执行、完整本机门禁、实际推送／PR／Main 和远端 CI，保留早先失败与待完成截止点。阅读[仓库规范](knowledge-base/Cns/docs/仓库路径身份与换行规范.md)与[限定证据](knowledge-base/Cns/docs/仓库路径与换行验证记录.md)。
修改已有第一方文本时，必须通过标准写入器序列化完整的新文件；向旧 CRLF 前缀追加标准文本仍违反新编写文件规范。历史 pin 只有在全部原字节保持一致时才享有未修改豁免；保留原件、封存证据及法律／上游文件保持不变。

<!-- HYGIENE-0.45.1-POLICY-END -->

本约定适用于全仓库，包括知识库共享实验、工具、证据、注释、Issue 与 PR。先读 [README](README.zh-CN.md)、[贡献指南](CONTRIBUTING.zh-CN.md)、[来源记录](source-origin.json)与相关规格，按用户既有授权范围开展工作。

<!-- SP1A-DOC-0.34.0-BEGIN -->
## Spine 导入计划边界

- SP1-A 仅使用可选构建入口 `@egret/project/spine`：两个运行时值及十一个纯类型名称。默认 project／engine 入口保持独立；第一方计划器不新增运行时依赖、宿主访问或 SDK 导入。
- 遵循[导入契约](knowledge-base/Cns/docs/Spine导入计划契约.md)，保留固定预算、严格元数据描述符、scanner 先于 visitor 的优先级、原始来源位置及单项致命拒绝。计划成功不验证动画、渲染、声明哈希或许可资格。
- 原创程序化 fixture 与公共行为测试使用构建入口；编译器完整诊断须实际观察后冻结。每项合成对照须先建立完整、新鲜基线。源码、执行、第三方产物查验及最终交付保持独立状态。
- 完整 R020/V020 需要另行测试时钟／资源／网格适配及版本化特性矩阵；分发前记录官方运行时出处与适用许可条件。公开文档保持双语，排除私有提示词及个人绝对路径。
<!-- SP1A-DOC-0.34.0-END -->

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

- MI1 公开使用仅通过构建后的 `@egret/engine` 与可选 `@egret/engine/web/input`。可选入口导出 `createMouseInput`、`createBitmapButton` 与九个擦除契约类型；默认 Engine／Canvas／WebGPU 入口不增加输入或按钮 API。按钮消费者遵守[所选契约](knowledge-base/Cns/docs/位图按钮契约.md)、借用资源所有权及完整路由后的最终命中复查。Runtime 显示装配端口不通过 Engine 公开，核心保持无 DOM／Node。详见[契约](knowledge-base/Cns/docs/主鼠标输入契约.md)与[验证记录](knowledge-base/evidence/primary-mouse-input-verification.json)。
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

<!-- SS1-PRIVILEGED-UNIT-POLICY-BEGIN -->
## SpriteSheet 原始操作单元

`tests/spritesheet-fault.test.mjs` 与 `tests/spritesheet-fault-child.mjs` 组成隔离的 SS1 原始操作故障单元。子进程仅固定 `packages/runtime/dist/Bitmap.js` 与 `packages/runtime/dist/spriteSheet.js` 的身份；其单模块加载钩子仅可在内存中替换 Bitmap 唯一的原始操作捕获块，用于计数和一项指派故障／回调。SpriteSheet 经公共 `@egret/engine` 外观加载，磁盘字节保持不变。唯一的直接私有导入是子进程在公共外观加载之前导入已固定身份的 Bitmap 模块，以先取得真实原始类，再临时替换其原型的 `sourceRect` setter 与 `dispose` 方法。

每个用例须先在新子进程完成真实、无钩子的基线，再使用独立指派子进程，并在恢复后使用另一个新的无钩子基线子进程。注销钩子，在普通调用者／Scope／Engine 清理之前恢复原型描述符，并在每个子进程前后核对源码、编译产物、配置、单元与权限文件的完整字节以及属于当前克隆的包别名。注销钩子不卸载模块缓存。尚未取得句柄的构造故障不得虚构 Bitmap 退役；真实构造成功后发生裁剪／终止故障，只使用已捕获的原始 disposer，并保留主要原因与次要清理错误。这些单元不增加产品导出或依赖，不授权任意私有导入，也不授权普通示例／公开行为测试私有导入；不能证明物理 OOM、GC、安全性或渲染器验收。
<!-- SS1-PRIVILEGED-UNIT-POLICY-END -->
