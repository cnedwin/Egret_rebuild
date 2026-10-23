# Agent 协作约定

[English](AGENTS.md) | 简体中文

<!-- HYGIENE-0.45.1-POLICY-BEGIN -->
## 仓库路径与原始字节规范

验证和交付工具使用共享 `tools/lib/file-identity.mjs`，完整所属根内逻辑路径使用规范 POSIX 写法并保留创作大小写；绝对物理路径比较与包含检查使用明确的平台语义。文件名相同、统一转小写或词法路径等价不能授权另一个文件身份。

新创作第一方文本通过 `tools/write-repository-text.mjs --path <owner-relative-file>` 或 `knowledge-base/tools/Write-CanonicalText.ps1 -RelativePath <owner-relative-file> -Text <text>` 写入，采用不带 BOM 的 UTF-8、LF 和一个末尾换行，保留内部空行及 Markdown 硬换行空格。不得用 `Environment.NewLine` 序列化仓库文本。原始指纹严格保留字节，计算哈希时不得规范化 EOL、BOM、Unicode 或空白；不得对上游／法律原件、原始回执、封存源码快照或历史证据运行创作格式化器。仅刷新确有修改且经过评审的当前文件身份。

通过 `git config --local core.hooksPath .githooks` 启用两个仓库本地钩子，保留其 Git 可执行模式。pre-commit 检查工作/未跟踪及暂存文本字节。pre-push 对干净已提交快照运行 `node tools/check-push.mjs --committed`，检查环境、来源/公开内容、双语及知识库结构。完整 `node tools/prepush.mjs --integrated`、独立源码/结果与双语评审以及必需浏览器证据仍是合并要求，不得绕过钩子或削弱字节规范。

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

<!-- BRS-0.56.0-POLICY-BEGIN -->
## 位图资源替换边界

- 已构建 `@egret/engine` 根入口增加 `Engine.createBitmapResourceSlot(scope, bitmap)`，以及准确两个擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。保持包依赖图、无 DOM/Node 核心、私有装配 authority 和既有 Host 协议。槽借用初始有效绑定，仅拥有自己获取的新替换租约，只允许最新已接受意图提交。遵循[所选规格](knowledge-base/Cns/docs/位图资源槽规格.md)、[证据记录](knowledge-base/Cns/docs/位图资源槽核验.md)及[公共示例](examples/bitmap-resource-slot/README.zh-CN.md)。
- `tests/bitmap-resource-slot-authority-unit.test.mjs`、`tests/bitmap-binding-ticket-authority-unit.test.mjs` 与 `tests/bitmap-resource-slot-authority-supplement.test.mjs` 是限定 UNIT 夹具，可通过已构建公共 `@egret/runtime` 契约与真实公共 runtime 对象构造自定义 context，并观察该构造登记的操作；外部目标对照使用真实公共 Engine。这项权限不增加 SDK 私有导入、加载 hook、原型拦截或产品导出，普通公共行为夹具及示例继续使用公共 SDK。
- `tools/bitmap-resource-slot-types.mjs` 与 `tools/bitmap-resource-slot-boundary.mjs` 的专用 strict 和源码边界义务须与既有完整检查共同执行。冻结实际未抑制的诊断元组；每项指定类型／策略变异都须先取得全新完整基线，再单独观察拒绝。保持准确的选定公共类型、私有捕获／提交／清理桥、源码／产物身份及已声明依赖边界。
- 原生组合须先独立审阅完整输入闭包快照，再由 `tools/verify-bitmap-resource-slot.mjs` 使用固定 Playwright 1.62.1、默认 Edge 且无额外 flags 执行。保留原始 import-map 反例、完整普通上下文及独立错误颜色上下文、未修改 RGBA 原始产物与清理记录。像素比较范围为六个字面采样点，完整帧留存用于复核。源码、UNIT、行为、strict／策略、浏览器、完整门禁与 PR/Main 交付分别记状态；完整 UI、Spine R020/V020 和迁移 R008/V006 保持 OPEN。
<!-- BRS-0.56.0-POLICY-END -->

<!-- LL-0.55.0-POLICY-BEGIN -->
## 显式本地布局边界

可选已构建入口 `@egret/engine/layout` 仅提供纯规划函数 `planLinearLayout` 及四个擦除接口，保持核心无 DOM/Node，不改变默认入口或 SDK Host 协议。调用方提供尺寸、显式过滤成员，并通过既有 display API 应用返回坐标；规划器不写场景，也不保证自动 EUI 布局。遵循[布局规格](knowledge-base/Cns/docs/local-linear-layout-spec.md)，按[证据记录](knowledge-base/Cns/docs/local-linear-layout-evidence.md)分别限定源文件、聚焦/strict、完整代码及真实浏览器验收。
<!-- LL-0.55.0-POLICY-END -->

<!-- MI1-AGENT-POLICY-BEGIN -->
## 主鼠标输入边界

- MI1 公开使用仅通过构建后的 `@egret/engine` 与可选 `@egret/engine/web/input`。可选入口导出 `createMouseInput`、`createBitmapButton` 与九个擦除契约类型；默认 Engine／Canvas／WebGPU 入口不增加输入或按钮 API。按钮消费者遵守[所选契约](knowledge-base/Cns/docs/位图按钮契约.md)、借用资源所有权及完整路由后的最终命中复查。Runtime 显示装配端口不通过 Engine 公开，核心保持无 DOM／Node。详见[契约](knowledge-base/Cns/docs/主鼠标输入契约.md)与[验证记录](knowledge-base/evidence/primary-mouse-input-verification.json)。
- `tests/mouse-input.test.mjs` 与 `tests/mouse-input-lifecycle.test.mjs` 使用真实公共 SDK 对象及受控浏览器端口，不私有导入产品，不复制命中或事件算法，也不声明真实 DOM／原生验收。实际浏览器与受控单元的结果分别记录。
- `#egret-mouse-input` 仅按精确包映射连接已命名的浏览器输入模块及声明到核心产物；共享验证器只允许显式固定映射和有限闭包，不授权通配符、任意私有导入或新产品导出。每项新策略变异必须先在独立完整夹具中通过当前基线；类型负例冻结实际未抑制诊断，待测表不得标作 PASS。
- MI1 证据分别记录源码、构建／公共接口、行为／生命周期、类型、策略、原生及最终公开／交付状态，保留失败与修正。公开内容不包含私有提示词、委派文件、未经整理的对话或个人绝对路径。
- MI1 沿用 HT1 准入：交互对象须挂接真实 Engine Stage 并显式设置自定义局部 `hitArea`；Graphics 边界或渲染像素不自动提供命中区域。事件回调通过 `event.payload` 读取坐标。
<!-- MI1-AGENT-POLICY-END -->

## 公开贡献与证据

解释性文档使用中性的项目口吻，围绕使用者需求、约束、设计推导、接口和交付组织。对话提示、答复角色与日常文字修订过程不进入正文。保留技术决策、带日期的证据、来源及准确的 AI 署名，不虚构个人思考，也不将未验证工作写成已完成。

措辞保持专业、客观与友善，以白鹭的目标场景、独立设计、接口和可复现结果说明变更。设计记录连接问题、选项、依据、反例及结论。技术比较注明资料版本与测试条件，性能目标与实测结论分别记录。

AI 辅助贡献注明实际范围、资料与作者复核。保留参考出处和鸣谢，区分机制研究、实验依赖、产品依赖与开发工具。保留第三方归属、版权、许可、NOTICE 及资产来源；第一方代码与文档沿用 Apache-2.0。

使用固定工具和 lockfile，安装时禁用生命周期脚本。版本、依赖、许可证或发布设置发生变化时，说明理由与影响。保护个人及商业信息、未授权原始工程、凭据和私有配置，只公开必要且已获授权的摘要。工作台调度与未经整理的聊天不进入发行内容。

整理证据只调整表达和公开范围，保留数据、结果、来源身份、失败与修订历史。公开副本注明投影关系，不改写历史哈希。实际接受状态以登记册和绑定版本的验证记录为准；浏览器、Native SDK、宿主、CI、目标设备性能及完整迁移分别验收。

## 文档与验证

公开简介英文优先，随后附中文。完整阅读版本分别放在 `knowledge-base/en/` 与 `knowledge-base/Cns/`，英文目录使用英文文件名。英文登记册视图从中文权威记录生成并保持只读，ID、状态、数字与来源一致。共享实验代码、原始证据、历史源码身份及上游许可原件保留出处。

每次推送 GitHub 前，复核来源、公开内容、双语版本及关键英文注释，然后完成已提交快照的推送检查。完整集成合并门禁保留代码/类型/包边界、headless 行为和知识库检查。两种命令都不启动浏览器，也不证明翻译含义正确；采用工程计划中的当前交付分层。

克隆后，贡献者与 CI 必须执行 `git config --local core.hooksPath .githooks` 启用同一推送钩子；应修复失败而非绕过钩子。详见[双语规范](knowledge-base/Cns/docs/双语文档与推送前检查.md)及[目录规范](knowledge-base/Cns/docs/documentation-layout.md)。

渲染变更按影响另行执行相应真实浏览器门禁：

```text
node tools/verify-canvas.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <private-output-directory>
node tools/verify-webgpu-b1.mjs --playwright "<absolute-installed-playwright-package-directory>" --channel msedge --output "<absolute-new-output-directory-outside-repository>"
```

B1 命令用于受影响的 B1 场景渲染，详见[有界验证器](knowledge-base/Cns/docs/b1-browser-verifier.md)。使用已接受的固定依赖，浏览器默认启动且不附加 flags。沿用未变构建的已有证据时须明确比对身份；合并候选仍须重新通过完整集成 prepush。

发现与登记路径在 Windows 按大小写不敏感方式排除私有执行、依赖及生成目录，清单不能覆盖排除规则。普通公开 AGENTS 文件仍有效；只有两个封存的 Three r186 研究构建精确路径／哈希保留既定例外。

## 授权

推送、发行、部署和仓库管理以用户实际授权为准，既有授权在其范围内持续有效。本地生成或验证不代表远端发布完成。本约定不授予账号权限，不扩大外部发布、消息发送或资产使用授权。

<!-- SS1-PRIVILEGED-UNIT-POLICY-BEGIN -->
## SpriteSheet 原始操作单元

`tests/spritesheet-fault.test.mjs` 与 `tests/spritesheet-fault-child.mjs` 组成隔离的 SS1 原始操作故障单元。子进程仅固定 `packages/runtime/dist/Bitmap.js` 与 `packages/runtime/dist/spriteSheet.js` 的身份；其单模块加载钩子仅可在内存中替换 Bitmap 唯一的原始操作捕获块，用于计数和一项指派故障／回调。SpriteSheet 经公共 `@egret/engine` 外观加载，磁盘字节保持不变。唯一的直接私有导入是子进程在公共外观加载之前导入已固定身份的 Bitmap 模块，以先取得真实原始类，再临时替换其原型的 `sourceRect` setter 与 `dispose` 方法。

每个用例须先在新子进程完成真实、无钩子的基线，再使用独立指派子进程，并在恢复后使用另一个新的无钩子基线子进程。注销钩子，在普通调用者／Scope／Engine 清理之前恢复原型描述符，并在每个子进程前后核对源码、编译产物、配置、单元与权限文件的完整字节以及属于当前克隆的包别名。注销钩子不卸载模块缓存。尚未取得句柄的构造故障不得虚构 Bitmap 退役；真实构造成功后发生裁剪／终止故障，只使用已捕获的原始 disposer，并保留主要原因与次要清理错误。这些单元不增加产品导出或依赖，不授权任意私有导入，也不授权普通示例／公开行为测试私有导入；不能证明物理 OOM、GC、安全性或渲染器验收。
<!-- SS1-PRIVILEGED-UNIT-POLICY-END -->

## M0 当前元数据集成

贡献者修改内容和独立的 contributions/*.json 声明。普通完整 prepush 只读验证推导出的当前元数据，不修改共享账本；维护者对最终候选运行 tools/contribution-metadata.mjs --base <target-base> --write、--check 及 tools/prepush.mjs --integrated。EGRET_METADATA_BASE 为 prepush 选择同一确切基线，CI 使用 PR 基线 SHA。生成器仅作为 localization.json、knowledge-base/documentation-layout.json 与 source-origin.json 的受限规范写入入口，保留历史对象，拒绝受保护/私有输入，不刷新无关过期来源行。内容/基线变化会使集成失效。完整 hooks、独立来源与双语评审仍为必需。当前浏览器套件使用 tools/browser-verify.mjs；进阶/历史工具保留独立验收范围。参见[贡献流程](knowledge-base/Cns/docs/getting-started.md#贡献元数据与浏览器检查)。

## M1.1 热提交 UNIT

私有缓冲池和绑定辅助模块只管理元数据；WebGPUHost 仍是提交、证明与清理的唯一责任主体。遵循[契约](knowledge-base/Cns/docs/warm-submission-contract.md)，保持公开签名、冷路径错误优先级与逻辑准入不变。不得仅凭 fence 发布可复用分配，也不得把闲置保留当成原生销毁。

仅 tests/webgpu-submission-buffer-private.test.mjs、tests/webgpu-submission-binding-private.test.mjs，以及 tests/webgpu-submission-controls.test.mjs 中的私有绑定保留案例，可直接导入 packages/engine/dist/web/webgpuBufferPool.js 与 webgpuBindingCache.js。这些明确标为 UNIT，不增加产品导出、任意 loader 或公开示例权限。同步 prototype 控制必须在 finally 中恢复精确 descriptor。

tests/webgpu-submission-preparation.test.mjs 与 tests/webgpu-submission-precedence.test.mjs 使用真实公开 SDK 帧和受控 GPU 端口。同步 Float32Array／Uint8Array 构造故障与裁剪计数必须恢复原全局 descriptor；裁剪计数在进入原生 error scope 前结束。其结果只证明受控操作顺序／次数，不证明物理 OOM、总分配或速度。

B1 源码检查后继保留历史上的 19 个捕获，当前仅准入三个指定辅助模块发射文件中的 21 个完整原生方法捕获 initializer。原缓冲区门面作为未链接模块接受检查；该检查不代表运行时执行。七条精确的仅静态导入边覆盖该门面及共享 B1 准备辅助模块；原有五个运行时入口闭包中的每条导入边仍须有实际解析证据。保留原生未链接模块构造、精确捕获消费、指定词法拒绝和原有十三案例调度。采集器的请求与收据容量是有限的验证边界，与产品资源预算分开。该许可不允许动态代码构造，也不是通用 Function 例外。

## M1.2 增量渲染单元

`tests/incremental-batch-private.test.mjs` 是 CPU UNIT，只使用构建后的私有 `engine/dist/rendering/preparedBatches2D.js` helper。合成 packed 数组验证拼接保留上限和有序来源关系，不证明公开准入或原生性能。在 `tests/incremental-preparation-batching.test.mjs` 中，仅明确标注的构造故障单元可以同步拦截 `Float32Array`，目标限于八图合批的精确拼接分配或原四元素 uniform 构造；必须在 `finally` 中恢复完整全局 descriptor，再进行异步完成观察和正常清理。公开行为使用真实 SDK 值及受控 GPU 端口。该权限不增加产品导出、任意 loader 或物理内存耗尽结论。

新增 CPU UNIT 文件仅允许导入以下精确的已构建私有模块：

- `tests/incremental-frame-cache-private.test.mjs`：`packages/runtime/dist/frameCaptureCache.js` 与 `packages/runtime/dist/displayVisualState.js`。所有权来自公开 SDK 构造的真实 Engine、Stage 和 Sprite。读取辅助模块的逻辑账本，以及在溢出前设置私有修订号，仅限这些 UNIT 用例。字节额度可能先于条目额度生效，须如实记录实际触达的限制。
- `tests/incremental-preparation-private.test.mjs`：`packages/engine/dist/rendering/preparedFrameCache2D.js`、同一 rendering 目录中的 `prepareMixedDraws2D.js`、`prepareTexturedDraws2D.js`、`prepareRectangles2D.js`、`prepareImages2D.js`、`prepareTexturedMesh2D.js`、`packImageVertices2D.js`、`packTexturedMesh2D.js`、`texturedPreparationBudget2D.js`，以及 `packages/engine/dist/web/webgpuPass.js`。资源通过公开 SDK 构造。测试验证真实准备流程、完整键、本帧索引、逻辑计费、原子预算回放与终止失效。

上述权限不允许加载器拦截、增加产品导出或在普通公开示例中导入私有模块。逻辑计费不证明实际内存用量或运行速度。

## M1.3 共享保留资源单元验证

仅 `tests/shared-retention-private.test.mjs` 可直接导入构建后的私有辅助模块 `packages/engine/dist/web/webgpuRetentionPool.js`。这些明确标注的元数据 UNIT 用例使用不执行原生操作的自有资源端口，验证统一字节与数量上限、精确兼容性、归还预留顺序、真实租约和终止后的清理归属。它们不调用原生 GPU 方法，不增加产品导出或加载拦截，也不证明物理分配或浏览器验收。普通公开行为测试与示例继续使用公开 SDK 入口。

可选的共享原生采集器在普通场景中仅使用构建后的公开 SDK 入口。其十一项指定反例只可在采集器私有服务副本中改动一个已记录引擎产物，不得修改产品文件或数值参考。必须匹配已评审的唯一源码锚点及修改前后完整原始字节身份，执行新的健康基线、指定数值失败和健康恢复，并保留 RGBA、背景截图与清理记录。当前入口为 `tools/browser-verify.mjs --suite shared-webgpu`，参阅[共享契约](knowledge-base/Cns/docs/shared-render-profile-contract.md)。这些反例不增加公开的私有辅助模块访问或通用加载权限。

## M1.4 共享保留账本单元验证

仅 `tests/shared-retention-ledger-private.test.mjs` 可直接导入构建后的私有辅助模块 `packages/engine/dist/web/sharedRetentionLedger.js`。这些元数据 UNIT 用例使用不执行原生操作的分配身份，验证完整的后端兼容键、真实的整块分配租约、统一保留上限、互不重复的快照计费，以及已销毁、上下文已失效、清理结果未知三种独立结算。后端封装负责描述符验证，Host 负责原生完成证据和清理。测试不调用原生方法，不增加公开导出或加载拦截，也不证明物理内存用量或浏览器恢复。既有 M1.3 私有单元权限保持不变。

## M1.4 共享存储单元

仅 `tests/shared-storage-private.test.mjs` 可直接导入构建后的私有 `packages/engine/dist/web/sharedSubmissionStorage2D.js` 与 `packages/engine/dist/web/prepareSharedSubmission2D.js`。这些 CPU UNIT 用例使用有界的模拟已准备元数据，检查逻辑费用、具体读回布局、容量及原有 WebGPU 拒绝顺序；冷页复制见证使用真实公开 ImageData2D。测试仅可在自身元数据上设置属性 getter，以观察设备、待处理状态及源复制读取之前的拒绝。该许可不增加产品导出、全局拦截、加载钩子或原生访问，也不证明公开帧准入、浏览器像素或性能。普通行为测试与示例继续使用公开 SDK 入口。

## M1.4 WebGL2 选项与 arena 单元验证

仅 `tests/shared-webgl2-private.test.mjs` 可直接导入构建后的私有模块 `packages/engine/dist/web/sharedWebGL2Options.js` 与 `packages/engine/dist/web/sharedWebGL2Arena.js`。这些 CPU UNIT 用例使用不执行原生操作的 canvas 对象、自有选项上的 getter、小型类型化载荷及有界的合成已打包元数据，验证有序快照、有限标量范围、精确区间算术和纯 pending 容量检查。仅含数值的 byteLength 与 pending 计数夹具属于算术对照，不是可上传载荷或已接受的公开帧。测试不调用 canvas 或 GL 方法，不增加全局拦截、加载钩子或公开导出，也不证明原生分配、公开 Host 准入、恢复、像素或性能。公开行为测试与示例继续使用真实的公开 SDK 值。

## M1.4 WebGL2 公开行为与源码边界

WebGL2 仅使用显式构建入口 `@egret/engine/webgl2` 与 `@egret/engine/webgl2/scene3d`。前者导出 `createSharedWebGL2Host` 及九个擦除类型，后者导出 `createSharedSceneWebGL2Host` 及两个擦除类型。根入口与 Canvas 入口不加载 WebGL2 模块。场景模式采用固定的第一方装配，复用既有场景身份验证与打包辅助模块；仅启用私有场景模式的 Host 加载该精确场景模块。调用者提供的 shader、场景插件或原生对象均不是 SDK 输入。

`tests/shared-webgl2-controls.test.mjs` 与 `tests/fixtures/gl-shared-rendering.mjs` 使用构建后的公开 SDK 入口、真实 Engine 捕获，以及测试自有的 canvas、GL 和事件端口。属性 getter、指定故障、完成延迟与重入回调仅作用于这些自有端口／选项。形似帧的对象只用于拒绝对照，不能作为已接受夹具。除下述精确时钟对照外，这些单元不增加私有产品导入、加载钩子、全局／原型拦截或测试导出。它们证明受控准入、命令顺序、逻辑所有权与生命周期结果；真实浏览器像素、原生丢失／恢复及性能需要独立证据。既有选项／arena、共享存储与保留资源 UNIT 权限保持不变。

仅 `tests/shared-webgl2-controls.test.mjs` 中明确标记的单调截止时间对照，可临时用测试自有单调时钟替换完整的 `globalThis.performance` 描述符，在不等待实际时间的情况下跨过保持不变的 30 秒 Host sync 截止时间或已配置的恢复截止时间，包括独立恢复尝试与重复丢失事件的处理。必须在 `finally` 中、普通清理之前恢复原始完整描述符，并把对照限定在指定用例内。该许可不允许其他全局／原型拦截、缩短产品截止时间、原生故障模拟或性能结论。

源码边界固定两个公开导出映射、九个 WebGL2 模块的源码／产物／声明全部依赖边、Host 的精确注册表导入及受场景模式约束的导入。原生捕获仅限 `webgl2Native` 中枚举的 68 个方法，以及八类资源的创建／删除操作；捕获逐一读取具名方法并绑定其所属上下文。该许可不允许枚举原生上下文／原型、计算式依赖发现、动态代码构造或通用拦截。既有 WebGPU 捕获、闭包与验证器额度继续独立适用。源码检查与原始 WebGL 前置验证不代表 SDK 验收或恢复已完成。

<!-- M14-NATIVE-PUBLIC-BEGIN -->
## M1.4 有限公开原生采集器

可选的 `tools/verify-shared-webgl2.mjs` 采集器，其普通夹具只使用构建后的公开 SDK 入口。保持不变的三十例标量参考矩阵与十一个指定反例共使用 63 个全新 context。每个反例先验证唯一源码锚点、原始／变更原始字节身份及不变的字面量 import 图，再只修改采集器私有服务副本中的一个已记录引擎产物；要求全新健康基线、指定数值失败与健康还原。保留原有共享 WebGPU 用例目录、反例和标量参考，以及原始 RGBA、黑白背景截图与清理记录。该工具不增加产品导出、公开夹具的私有 helper 导入、原生拦截或通用 loader 权限。像素验收、原生恢复／深度／状态检查、计时及交付分别记录。

单独的 `tools/verify-shared-webgl2-lifetime.mjs` 夹具使用真实公开 SDK 值与自有 canvas，设置固定脏状态并调用真实 `WEBGL_lose_context` 扩展。四 context／六读回／24 点／96 通道计划覆盖即时提交、固定深度／状态、一次恢复／重放及一次先关闭后恢复竞争。不增加私有产品导入、拦截或合成失效证明。保留精确零容差端点与清理观察；M1.5 持续恢复及计时分别验收。
<!-- M14-NATIVE-PUBLIC-END -->

<!-- M15-MANIFEST-UNIT-BEGIN -->
## 资源身份哈希单元验证

`tests/resource-manifest-sha-unit.test.mjs` 仅可直接导入已构建的私有模块 `packages/contracts/dist/resources/sha256.js`，将其 UTF-8 SHA-256 结果与标准字面量向量及独立的 Node/Web Crypto 结果比较。这一限定的 UNIT 权限不新增公开哈希 API，不允许模块钩子、产品修改或更广泛的私有导入。资源清单和项目行为用例使用已构建的可选公开资源入口。哈希匹配只证明受测摘要计算，不证明实际资源字节完整性、浏览器行为或 M1.5 验收通过。
<!-- M15-MANIFEST-UNIT-END -->

<!-- M15-FOCUSED-IO-BEGIN -->
## 资源清单工具与受控浏览器单元验证

仅由 `tests/resource-manifest-builder-io-unit.test.mjs` 启动的专用子进程 `tests/resource-manifest-builder-io-child.mjs`，可临时替换 Node `fs.readFileSync`、`readSync`、`openSync`、`closeSync`、`fstatSync` 的精确自有属性描述符，并同步内置 ESM 导出。观察与指定拒绝仅限子进程自有、明确列出的临时夹具路径及已捕获的文件描述符；其他调用原样转交。通过普通模块导入执行一次真实构建工具 CLI，保留真实文件字节与独立 Node crypto；在 `finally` 中恢复所有原始描述符及同步导出，并关闭自有句柄。仅限这些子进程自有夹具文件，可在真实大小观察后立即使用未经替换的 ftruncateSync/writeSync 截断或追加实际字节，以验证真实短读／增长拒绝；不得伪造文件系统返回值。该工具 I/O 单元验证读取前限额与有限分块，不授予私有 SDK 导入、预加载、loader 钩子、原型拦截或原生验收权限。

仅 `tests/manifest-byte-source.test.mjs`、`tests/manifest-texture-provider.test.mjs` 与 `tests/manifest-resource-diagnostics.test.mjs` 可在串行用例中，将 `globalThis.fetch` 的完整自有属性描述符临时替换为测试自有传输。纯夹具辅助文件 `tests/manifest-browser-fixtures.mjs` 提供自有 response/body/reader 对象和受控异步操作，但不修改全局对象。自有工作实际结束后恢复原始描述符全部字段。用例保持真实已构建公开 SDK 对象、未经替换的实际 Web Crypto 与既有 PNG ports；不增加 crypto、时钟、构造器或原型拦截、私有 SDK 导入、模块钩子或公开测试权限。受控传输／解码结果仅证明完整性、顺序、逻辑容量与清理；实际浏览器解码、性能与设备恢复需单独验证。
<!-- M15-FOCUSED-IO-END -->

<!-- M15-HOST-CONTROLS-BEGIN -->
## 共享 Host 分阶段上传受控验证

公开行为用例 `tests/shared-frame-upload-webgl2.test.mjs`、`tests/shared-frame-upload-webgpu.test.mjs`、`tests/shared-device-session.test.mjs` 和 `tests/shared-host-resource-diagnostics.test.mjs` 使用真实已构建 SDK 捕获及既有测试自有 GL/GPU/canvas/event ports。其纯辅助文件不增加私有产品导入、模块钩子、产品导出或调度器拦截。GPU 用例可使用既有夹具串行替换 `globalThis.navigator` 完整自有属性描述符的能力，并在自有工作结算后恢复全部原始字段。不授予其他全局对象、构造器或原型替换权限。固定十秒的就绪后持有期限使用实际经过时间验证；原生写入端口观察与普通调度标记只建立受控任务边界，不改变产品调度器。

受控 GPU 分阶段上传不启用恢复。结构化夹具设备不能通过可选恢复或原生丢失身份核验；每个启用恢复的 GPU 代次均须捕获经过原生设备身份核验的观察。真实恢复正例、实际丢失顺序、像素与计时仍属于独立浏览器证据，不得伪造原生 getter 或增加产品测试绕过入口。GL 提取端口保持同步；栅栏成功后的回读失败可区分提交完成与回读，不得虚构异步 GL API。源码、受控、原生与交付结论分别记录。
<!-- M15-HOST-CONTROLS-END -->

<!-- M15-NATIVE-RECOVERY-POLICY-BEGIN -->
## 资源恢复原生观察边界

可选的固定 `tools/verify-resource-recovery.mjs` 采集器在隔离的前台浏览器 context 中使用真实已构建公开 SDK 入口。七个用例覆盖两个持续资源／恢复场景、手动借用设备恢复，以及四个真实失效／关闭或恢复／关闭竞争。保留既定计划、独立参考像素、原始读回与截图字节、源码身份、实际原生完成与清理证据。不支持的能力和未解决的观察保持未执行或不完整。逻辑计数、原生调用已发出、像素匹配、计时与物理内存分别取证。

仅 `tools/shared-rendering/resource-recovery-observations.mjs` 可在这些隔离 context 内、Host 捕获原生方法之前安装以下有限观察：

- 既有 PNG ports 使用原始 receiver 和固定参数转发捕获的真实 Window `createImageBitmap` 与 Document `createElement('canvas')` 操作，原样返回原始解码 promise。固定取消安排仅可在原生解码调用之后，释放其捕获的真实夹具 ManifestAssetGroup。不替换全局解码器、fetch、crypto、bitmap 或 canvas 描述符。
- 自有 GPU 自动获取仅可临时替换 `GPUAdapter.prototype.requestDevice` 精确、可配置的自有数据属性描述符。原样转发原始 receiver、参数、返回值和异常；观察其实际 promise 及捕获的真实 `GPUDevice.prototype.lost` getter。仅通过捕获的真实 `GPUDevice.prototype.destroy` 触发既定代际失效。不允许替换 requestAdapter、读取参数 getter、合成设备／失效或增加适配器描述 getter。恢复时允许使用不同真实适配器；选定适配器的描述信息保持不可用，浏览器 SystemInfo 单独记录。
- 压力观察仅可临时替换 `WebGL2RenderingContext.prototype.texSubImage2D`、`WebGL2RenderingContext.prototype.deleteTexture`、`GPUQueue.prototype.writeTexture` 和 `GPUTexture.prototype.destroy` 精确、可配置的自有数据属性描述符。使用相同 receiver 和参数调用原始方法一次，保留其原始返回值或异常。GPU 目标纹理身份仅从自有数据属性描述符读取。GL 观察不推断当前绑定的纹理身份；不允许拦截 bindTexture 或 getParameter。
- 上传观察仅可通过捕获的内建访问器保留实际 Uint8Array 视图长度和前四个字节，不保留参数数组或底层缓冲区。固定暂存取消仅可在原始上传返回之后，中止捕获的夹具 AbortController。不允许任意注入回调、修改调度器／fence 或新增产品观察钩子。

任何替换之前检查全部描述符。压力记录最多 16,384 行、4,096 个对象身份；PNG 记录最多 8,192 行、四个原始 promise；GPU 获取最多十六个请求／设备／适配器身份和 256 个事件。超出上限或观察失败不得替换原始调用结果；继续转发调用、保留不完整状态，不声称已全部排空。只有实际原始工作已结束且 Host 已关闭后，才恢复原始描述符全部字段。结算未知或采集器期限到达时，明确记录清理不完整及 realm 释放，不据此证明原生资源已退役。上述权限不增加私有产品导入、SDK 导出、通用拦截权限，也不扩大既有受控单元测试权限。
<!-- M15-NATIVE-RECOVERY-POLICY-END -->

## M3 多触点输入切片

可选入口 @egret/engine/input 和 @egret/engine/web/pointer 遵循[多触点契约](knowledge-base/Cns/docs/multi-pointer-input.md)。保留旧 MI1 入口与真实 Engine/Scope/Stage 权限，核心状态位于无 DOM 的 runtime 输入模块。运行时端口单元序列、真实公共 Engine 行为及实际浏览器证据须分别报告。

仅 tests/browser-pointer.test.mjs 可以将其明确声明、由测试拥有的 WebIDL/Window/Document/Canvas/EventTarget/PointerEvent/CSS/矩形端口安装为对应的完整全局属性描述符，串行执行，并在真实 Engine 清理后精确恢复。指定监听/捕获失败与重入仅发生在这些测试拥有的端口上。不允许替换真实原生原型、导入私有 SDK、增加产品测试导出或据此证明物理设备能力。浏览器示例与实际采集使用普通公共 SDK 入口且不拦截原生操作。

## M3.1 托管 UI 单元验证

仅 `tests/ui-display-commit.test.mjs`、`tests/ui-layout-unit.test.mjs` 和 `tests/ui-height-index-unit.test.mjs` 可直接使用构建后的可选 `@egret/runtime/ui` 组合入口，验证有界数值与托管发布单元。运行时身份测试使用真实公共运行时对象和测试自有上下文；输入数组 getter/Proxy 仅用于准入控制，不作为被接受的 Engine 外观。不得引入私有模块导入、原型或全局拦截及新增测试 API。公共生命周期、布局和列表测试使用真实 Engine/Scope 及 `@egret/engine/ui`。单元结果不能证明浏览器像素、物理内存、手机输入或性能通过。
