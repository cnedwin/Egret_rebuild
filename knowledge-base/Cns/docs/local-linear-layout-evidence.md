# 本地线性布局证据

[English](../../en/docs/local-linear-layout-evidence.md) | 简体中文

工程预览 **0.55.0** 增加显式局部数字规划及双 Button 消费者。[规格](local-linear-layout-spec.md)定义精确契约。本记录区分完整代码检查、较晚的应用集成、既有渲染器回归及固定布局浏览器 schedule。

## 目的、来源与范围

调用方提供尺寸、选择成员、取得冻结计划，再通过既有 display API 应用坐标。规划器是独立第一方 Apache-2.0 代码，由 Codex 协助根据选定第一方规格编写。应用复用原创第一方 bitmap-button session 和程序化图集、共享 MouseInput、借用 atlas lease 及分别所有的 Button Scope，不增加依赖、默认 API 或 SDK Host 协议。

起始 Main 为文档 PR #43 之后的 ecad4f71d602cee55c09a03c6e55afcadb9e7d0b，tree 为 73864a6d76e66790362ee56c50c5f7d79332d310。较早的 0.54 及发布截止点保留原范围。实际交付以仓库提交及[PR 历史](https://github.com/cnedwin/Egret_rebuild/pulls)为准，本记录不嵌入未来合并身份。

## 代码与应用检查

产品编写前，真实既有 Engine/Scope/resource/input/Button 基线完成 capture/render/pick 及清理，独立 API fixture 随后报告预期缺少入口的 LINEAR_LAYOUT_REQUIRED 失败。

已保存聚焦构建 exit 0，25 个测试通过，失败、取消、跳过和 todo 均为零。strict 编译记录正例实际诊断 0，24 个不抑制的错误用法诊断全部精确匹配，并绑定完整 tuple/configuration/declaration 身份。

已验收 Task 1 完整运行完成全部九个阶段，Core 3243/3243，另有保留 Spine Source 160/160，所有非通过计数均为零；headless 关闭完成且 timer 为零。该完整套件使用较早的 Task 1 API fixture。启动屏障应用修订之后，单独的当前 API 运行通过一个集成测试，所有非通过计数均为零。语义及延迟启动断言均为该测试内的情况，不是七个独立 Node 测试。这些运行不合称为一次联合执行；后续发布检查须使用最终选定文件。

两个较早完整尝试保持保留。R1 在构建/一般边界通过后停在有效 SS1 engine 包快照。R2 运行 Core 3243 个测试，其中 2965 通过、278 个隔离 fixture 闭包失败。已审阅的有效策略及合成 scaffold 后继修复了配置/fixture 闭包；这些失败未证明 SDK 布局缺陷，这些后继未修改产品源文件。

## 固定桌面布局执行

**独立结果状态：ACCEPTED_BOUNDED_DESKTOP_CANVAS_WEBGPU_ONLY。** 默认无额外启动 flags 的 headless Edge 155.0.4283.45 在 Canvas 及 WebGPU 执行固定 24 × 24、DPR 1 schedule。每个 backend 呈现 19 次：一次辅助启动呈现及 18 次计入主范围的布局/输入/重放呈现。36 次主读回比较 82944 个字面 RGBA 通道，容差 0，像素和通道差异均为零。两个辅助读回不计入主 credit。

全新 Canvas 对照另外保存三个原始读回：辅助帧、真实横向基线及一次指定的错误期望布局。错误期望相差 84 像素和 168 通道，主 credit 为零。全量原始 RGBA 共 41 份，该总数包含辅助及单独对照记录，不是主验收计数。期望像素在执行前独立冻结，原始读回先保存再比较。

schedule 检查真实主鼠标路由、嵌套变换/裁剪拾取、调用方过滤/重插、禁用行为、无效间距场景保持，以及实时树不同时的原始保存帧重放。包括辅助启动 ticket 在内，全部 19 个原始 WebGPU ticket 均 fulfilled。三个 session 的控件/input/Scope 均关闭、借用 lease 已释放、各有一次图集加载/释放、保持缓存 Close promise 身份且 pending task 为零。WebGPU Host 报告安全清理，pending frame/upload/readback 均为零。这些结论限定为记录环境下观察到的协作式 API 结果。

## 既有渲染器回归范围

单独验收的普通 Canvas 套件检查真实 pointer/完整像素、预期 no-op 拒绝及三个 PNG。既有 WebGPU 套件记录 42 帧、1709 次原始检查、84 个合成 PNG 及 6808 次解码合成检查，并有八个对照：七个私有单补丁原生对照及一个明确的合成对照。必需检查失败及意外错误均为零。这些既有套件的计数、比较规则和身份与布局 schedule 分开，不相加。

## 证据身份与边界

结构化来源记录以字节数/SHA256 绑定选定的 28 个代码文件及独立审查身份。源文件审查覆盖 49 个有限 source/oracle row，另有 11 个单独审阅的有效策略/scaffold 后继；这是源证据，不是 49 个运行测试。最终当前双语阅读变更涉及 10 个修改/新增配对，其余未变 190 对保留原语义审查截止点。历史来源 row、法律原件、早期失败及审查范围保持保留。

固定桌面结果不证明手机性能、硬件/GPU 认证、物理内存/GC、字体/IME、focus/键盘/touch、Native SDK 或通用 Host 验收。自动 EUI/flex/布局、完整 Spine R020/V020、完整迁移 R008/V006 及高级 3D 仍开放。有序读取、精确 cause、快照/重入及 binary64 语义见[规格](local-linear-layout-spec.md)。
