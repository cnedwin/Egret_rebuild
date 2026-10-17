# 纹理、序列帧与 SpriteSheet 验证

[English](../../en/docs/historical-browser-workflow.md) | 中文

使用 Node 26.7.0、仓库固定依赖、已安装的 Playwright/core 1.62.1，以及 Windows x64 上默认 Microsoft Edge。这些工具覆盖五个已有验证范围，不增加引擎功能，也不替代完整推送/合并门禁。此前 Node 24 的记录仍为历史证据，其字节、失败和评审时点保持不变。

## 选择受影响的验证范围

| 套件 | 必须保留的原始比较范围 |
| --- | --- |
| textured-webgpu | 11 个校准和 10 个留出案例，共 27 次正例观察；16 个对照窗口、19 次观察，12 个对照全部敏感 |
| textured-scene | 两次 3D/纹理混合观察，每次 12 个指定像素；指定错误预期被拒绝 |
| sequence-player | Canvas/WebGPU 显式时间播放器；八次提交、1,024 通道，包含已保存帧回放 |
| sequence-playback | Canvas/WebGPU 时钟驱动的单次/循环/暂停/恢复；18 次提交，16 次新采集和两次回放，2,304 通道 |
| spritesheet | Canvas/WebGPU 命名角色/静态图标与时钟播放；18 次提交，16 次新采集和两次回放，2,304 通道 |

这些数量定义完整性，不代表性能测量。原始场景、数值预期、容差和退出清理检查仍是判定依据。进程正常退出或生成摘要本身不代表验收。

## 贡献者流程

1. 完成[环境准备与无窗口验证](getting-started.md)，在 PR 中标明受影响套件。没有 Windows/Edge 环境时，可提交源码和无窗口结果，并明确原生验证待完成；维护者须安排对应原生门禁后才能声明验收。
2. 使用 node tools/build.mjs 构建当前源码。playback/SpriteSheet 使用下述实际构建工具，并申请独立证据评审。不要自行生成 PASS 评审或编辑历史账本。
3. 在仓库外创建全新准备目录，由独立评审者阅读清单、源码/构建记录及原始准入。记录谁评审了哪些字节；AI 评审不等于真人批准。完成后再执行经评审的摘要。
4. 保存原始文件和失败尝试，在 PR 中附准确的套件结果、原始清单/结果指纹、评审和未完成的外部进程退出证据。完整推送钩子与受保护 CI 继续执行。

~~~text
node tools/browser-history.mjs prepare --suite sequence-player --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory>
node tools/browser-history.mjs run --manifest <absolute-reviewed-manifest.json> --sha256 <reviewed-raw-sha256>
~~~

纹理验证将 sequence-player 换为 textured-webgpu 或 textured-scene。纹理准备执行有界的真实标准构建，在新目录冻结完整输入、着色器与指定对照配方，不覆盖旧冻结记录。混合场景记录当前产品指纹，不再将历史硬编码产品指纹用于当前验收；评审者必须将这些源码与产物绑定到实际成功的当前构建，准备不等于批准。路径必须为绝对路径，含空格时加引号；父目录须存在，每次尝试使用仓库和已安装工具之外的新子目录。

## Playback 与 SpriteSheet 准入

~~~text
node tools/browser-history-build.mjs --suite spritesheet --output <absolute-new-build-directory>
~~~

工具记录真实命令/执行文件/工作目录、原始 stdout/stderr、退出/超时、时间戳、完整 SDK 源码与产物、20 项配置、七项编译器/运行时归属，以及 SpriteSheet 的四个工作区别名。输出 admission.pending.json，状态为 PENDING_INDEPENDENT_REVIEW，reviews 为空；命令摘要中的 browserRun 为 false；该文件不能通过原采集器。失败构建保留原始尝试，不生成已批准准入。

维护者在独立评审后组装另一份准入文件，保留全部原始构建指纹。仅在评审完成后设置 ROOT_FROZEN_REVIEWED_CURRENT_BUILD，并按`tools/sequence-playback/README.zh-CN.md`或 `tools/spritesheet/README.zh-CN.md`提供原有角色和 JSON 指针。playback 需要 plan/product/build；SpriteSheet 另需实际 cpu/types/policy/units/example 和 nativeSource。原格式要求构建清单保留待独立执行评审状态时，评审通过另一份记录确认原字节，不改写生成时点。缺失角色、过期源码、其他工作区、错误编译器归属或构建日志不匹配均拒绝准入。

~~~text
node tools/browser-history.mjs prepare --suite spritesheet --playwright <absolute-installed-playwright-package> --output <absolute-new-run-directory> --admission <absolute-reviewed-admission.json> --admission-sha256 <reviewed-raw-sha256>
~~~

另一原始准入格式使用 sequence-playback。当前依赖物理归属固定为提升安装的 node_modules/typescript、node_modules/@typescript/typescript-win32-x64 和 node_modules/robust-predicates。逻辑路径与物理路径保持区分，原始哈希不做归一化；执行前后的编译器和工作区别名观察仍为必需。

## 结果与边界

运行入口在启动前及采集后核对当前源码集合、原始指纹、已安装运行时、原始准入和冻结输入。输入改变必须重新准备和评审。工具保存完整子进程日志与退出状态；PASS_BOUNDED_COLLECTOR 仅表示所选完整采集器通过，像素、回放和资源生命周期仍由原生断言判定。

操作系统级进程退出仍需独立的外部 Windows Job 管理器，另行记录归属分配、原始输出流 EOF、活动进程归零与 Job 关闭，外层看门狗不超过 300 秒。本入口不提供该管理器，也不将浏览器协作关闭提升为操作系统退出证明；即使像素通过，缺少外部退出证据仍须保持待完成。真人上手、外部 fork 批准、手机/小游戏宿主、通用中文字体性能、功耗/预算、完整 Spine 和完整迁移仍是独立未完成项（#52/#54），本轮迁移不代表 M0 整体验收完成。
