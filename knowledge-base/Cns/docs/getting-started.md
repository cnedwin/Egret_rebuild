# 上手与贡献指南

[English](../../en/docs/getting-started.md) | 中文

本仓库是面向复杂 2D 界面、动画及后续轻量 3D 的工程预览。完整 Spine、自动 UI 布局和原生 SDK 尚未完成。

## 准备环境

安装 Node **26.7.0**、pnpm **11.25.0**、Git 和 PowerShell **7.6.5**。TypeScript **7.0.2** 由锁文件安装，无需全局编译器。Windows 是完整开发/合并环境；Linux/macOS CI 只执行明确列出的平台无关 CPU 集合，不代表其浏览器或完整发布工具链通过。

选择 Node 后，如需安装包管理器，可运行 `npm install --global pnpm@11.25.0 --ignore-scripts`。这条可选命令会修改全局 pnpm 安装；也支持单独安装的固定版本 pnpm。将仓库克隆到自选目录后运行：

```text
node --version
pnpm --version
node tools/doctor.mjs --preinstall
pnpm setup:dev
pnpm check:quick
pnpm example:browser
```

打开服务器输出的本地地址。服务器只监听 127.0.0.1，仅提供示例和其声明的模块/素材；用 Ctrl+C 停止。安装需要访问包仓库，禁用生命周期脚本并使用冻结锁文件。重复准备保留源码改动，只安装依赖、构建产物和设置仓库本地 hooks，不替换全局 Node 或 PowerShell。已有不同 hooksPath 时报告问题，不覆盖。

Doctor 只读，报告实际父子进程 Node 版本、所需工具和本地包归属。终端可能显示正确 Node，但 pnpm 包装器仍启动旧版：应检查包装器，在 Node 26.7.0 下安装或选择 pnpm；不要跳过版本检查或修改旧证据。依赖缺失时运行 setup；端口占用可用 `pnpm example:browser --port 4174` 更换。

## 首次看到画面

现有资源场景展示两个动画角色、服装、文字和选择控件。先选择 Canvas 2D，WebGPU 仍是显式实验配置。选择角色、换装、暂停、单步时间或改变旋转，观察对应变化。示例使用固定字体子集，不代表通用中文排版或手机性能。

首次修改可调整 `examples/resource-scene/index.html` 的可见标题，刷新并确认只有标题变化。实际贡献应提交有用、范围明确的改进，而非任意演示改动。阅读文档保持中英文配对目录，关键代码注释使用英文。

## 首次贡献

1. 查看[公开看板](https://github.com/users/cnedwin/projects/2)、里程碑和 Issues。[Issue #52](https://github.com/cnedwin/Egret_rebuild/issues/52)是范围明确的新人入口。认领 `good first issue` 前，确认代码入口、预期结果、验证命令和评审人齐备。
2. Fork 后创建分支，完成集中修改。欢迎问题报告、复现样例、翻译和设备测试。
3. 迭代时运行 `pnpm check:quick`，完成构建、实际包边界、上手工具及无界面示例检查；它不是合并门禁。
4. 提交草稿 PR，说明问题、行为、验证、兼容和来源/AI 辅助。可使用中英文任一语言；维护方协助双语与当前账本，历史证据不重新生成。
5. 公开交付及主干合并前，完成 `pnpm check:merge`、双语评审和受影响的真实浏览器验证。现有 hooks 仍执行完整门禁，本次 M0 首批交付不移除该义务。

## 评审与当前边界

Edwin（`@cnedwin`）是当前集成联系人。CODEOWNERS 用于路由评审请求，不代表独立批准。AI 评审与人工审批分别标注；缺少独立技术评审的核心变更保持待审。维护方按实际能力分流，延期时记录阻碍和下一步，不承诺尚无人承担的响应时限。

贡献者可在 PR 中请求翻译或元数据协助，补齐后的最终集成树必须重新检查。公开 CI 不授予仓库写权限；首次 fork 贡献可能需要维护者批准运行。必需 job 缺失、失败或取消时，最终 `M0 / merge-ready` 不得通过。

M0 尚有独立真人/fork 演练、场景/设备预算及独立准入的历史配置未完成。下文提供当前账本生成、本地风险选择及八个浏览器入口，完整合并检查仍强制执行。

## 完整演练首次贡献

实际贡献使用自己的 fork：在 GitHub 选择 Fork，复制该 fork 的克隆地址，克隆后创建如 `docs/onboarding-note` 的分支。修改前记录 `git rev-parse HEAD`。PR 的 base 指向上游仓库，head 指向自己的 fork/分支，不直接推送上游 main。维护者账户下的本地克隆不能验证外部 fork 首次运行的批准流程。

完成上述环境和示例步骤后，在 [Issue #52](https://github.com/cnedwin/Egret_rebuild/issues/52) 或草稿 PR 中记录以下清单：

| 步骤 | 记录与预期结果 |
| --- | --- |
| 环境 | 系统、Node/pnpm/PowerShell/Git 版本及 doctor 的父子 Node，移除个人路径 |
| 安装 | 基线提交、依赖缓存是否为空、退出结果、下载及安装耗时，无手工包别名 |
| 运行 | 资源 Ready、画面 Completed、交互 Ready；两个角色、固定文字、成功换装与 0.125 秒单步 |
| 修改 | 只改本地标题，刷新观察；重复安装保留改动；实际 PR 应提交有用修正 |
| 检查 | 分别记录快速和完整合并结果，保留首次失败及修复，不只写最终成功 |
| 提交与评审 | fork/head/base、PR/CI 链接、批准等待、评审角色和集成结果；区分 AI 与人工评审 |

后续演练的暂定流程目标为：已准备工具的 Windows 机器上安装五分钟、快速检查一分钟、完整合并 job 三十分钟。下载、初始工具安装、用户操作及评审排队分别记录；这是排查阈值，不是速度保证，也不允许省略检查。没有人员覆盖时不承诺评审响应期限。

## 贡献元数据与浏览器检查

修改已有文件时只改内容，不手改共享哈希。新增文件使用独立命名的 `contributions/<change-name>.json`：包含 `schemaVersion: 1`、由 `path`/`originRole` 组成的 `files` 数组（关键代码加 `criticalComment: true`），以及新增阅读文档的 `documents` 数组，配对格式为 `{en, zh}`。两种语言的路径均须在 files 中声明。使用完整仓库相对路径，说明作者、许可证、参考来源和 AI 辅助。现有 `contributions/m0-tooling.json` 可供参考结构，不应照抄其来源声明。每项贡献使用独立文件名，不修改其他贡献的声明。

普通完整 prepush 从与 origin/main 的 Git 合并基点只读推导当前发布元数据，贡献者无需手改 localization.json、source-origin.json 或 documentation-layout.json。保持 origin/main 可用且及时更新；使用 fork 时，添加并获取上游仓库，将 EGRET_METADATA_BASE 设为确切目标基线提交进行验证。单语草稿可以讨论，但推送 hook 仍要求最终阅读文档配对；需要翻译协助时应在交付前提出。

完成内容、来源及双语评审后，集成人选择最终基线并运行：

```text
node tools/contribution-metadata.mjs --base <target-base-commit> --write
node tools/contribution-metadata.mjs --base <target-base-commit> --check
node tools/prepush.mjs --integrated
```

若 prepush 默认合并基点不同，运行时将 EGRET_METADATA_BASE 设为同一提交。将生成的账本与评审后的内容一起提交。CI 使用 PR 基线 SHA，拒绝过期的集成元数据，不回写贡献者分支。内容、声明或基线变化后须重新生成并验证。生成器只更新当前派生字段及已声明新增项，保留无关旧来源行和全部历史对象。删除、重命名、已有来源声明及历史/结构变更需单独评审迁移。哈希继续按原始字节计算；生成不证明翻译质量、来源权利或行为正确。

当前浏览器检查使用 Windows x64、Node **26.7.0** 和已安装 Edge，在独立工具目录安装 Playwright 与 playwright-core **1.62.1** 后运行：

```text
node tools/browser-verify.mjs --suite canvas --playwright <absolute-installed-playwright-package> --output <absolute-fresh-directory-outside-repository>
```

直接运行的套件为 canvas、webgpu、b1、text、hit-test、mouse-input。resource-scene 和 bitmap-slot 还需要已复核的源码快照：

```text
node tools/browser-prepare.mjs --suite resource-scene --output <absolute-new-snapshot-file-outside-repository>
node tools/browser-verify.mjs --suite resource-scene --playwright <absolute-installed-playwright-package> --output <absolute-fresh-directory-outside-repository> --snapshot <absolute-reviewed-snapshot-file> --snapshot-sha256 <reviewed-raw-sha256>
```

验证 bitmap-slot 时，将两条命令中的套件名均替换为 bitmap-slot。准备前使用选定工具链构建。准备步骤不启动浏览器，也不批准生成结果；先复核完整源码闭包、所有者、导入及原有判定标准，再显式提供已复核的原始摘要。采集器会在原生执行前重新计算完整闭包；源码或构建输入变化后必须重新生成并复核快照。不要把未经复核的生成摘要自动传入执行。resource-scene 保留固定 Edge 155.0.4283.45 与字体参考，不自动接纳其他浏览器版本。

输出父目录须已存在，选定文件或目录须为新建且位于输入所有者之外。入口拒绝额外 Node 参数、NODE_OPTIONS/NODE_PATH、错误版本、变化的快照及缺失完成记录；保留失败，不下载浏览器，不放宽原有像素/反例断言。桌面子集不证明手机、通用中文字体性能或完整引擎能力。查看 tools/browser-tool-matrix.json：prepared-group、atlas、BIP1 PNG 和五种独立准入的固定场景配置 使用[资源类型验证流程](resource-browser-workflow.md)，保留独立夹具/配置准入；固定 Node 24.19.0 实验保留历史身份，不能被这些套件替代。渲染变更仍须验证受影响范围，包装入口不证明独立操作系统进程退出。

## 按风险选择本地反馈

```text
node tools/check-incremental.mjs --base origin/main --explain
node tools/check-incremental.mjs --base origin/main
```

第一条命令只输出路径、理由和所选检查，不执行验证。使用 fork 时先获取 upstream，再选择它的目标引用。基线必须解析为 HEAD 的祖先，缺失或无关引用会失败；省略 --base 时使用 HEAD 与 origin/main 的合并基点。已提交、暂存、未暂存及未被忽略的未跟踪输入均参与选择。

仅修改现有阅读文档时选择文档反馈。现有包的 TypeScript 修改可使用[依赖感知的本地检查](dependency-aware-checks.md)：按包影响选择已评审的行为测试，同时保留共享测试、完整构建、严格类型及源码边界。新增、未知、配置、测试、元数据和工具修改回退完整 prepush；清单过期或隐藏索引标记也不缩减检查，不缓存旧验收。

pnpm check:quick 仍可用于构建、依赖边界和上手工具反馈。两种本地反馈均不替代完整的已提交推送 hook、集成合并检查、受影响浏览器验收及独立来源/双语评审。本地 PASS 不是合并凭据。

示例未就绪时报告后端、失败步骤和脱敏诊断。缺少真人参与、手机、小游戏宿主或字体工作负载时，在 [M0 结果记录](m0-community-foundations.md)中保留未执行状态。

纹理、序列帧和 SpriteSheet 变更使用[当前历史验证范围流程](historical-browser-workflow.md)。新人先提供环境/无窗口结果；原始评审证据和外部进程退出验证由维护者协助准备。

维护者可以通过[检查维护流程](check-maintenance.md)生成基线原始差异和保守的清单候选。提案始终待评审，不替代当前源码准入或完整门禁。
