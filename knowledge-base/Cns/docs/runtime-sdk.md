# Egret Runtime SDK

[English](../../en/docs/runtime-sdk.md) | 简体中文

开发者保留一份 TypeScript 游戏入口和资源清单，导出时由打包器选择宿主服务。项目若直接使用 DOM、浏览器图形上下文或目标平台缺少的系统服务，导出器应指出依赖所在位置与所需能力。现有 TypeScript 包 `@egret/runtime` 保留原有职责，原生 SDK 单独维护二进制接口和兼容范围。

Android AAR、游戏导出与 Activity 接入方法见[Android 游戏项目播放器指南](android-project-player.md)。

## 五个平台的发布路径

| 目标 | 构建产物 | 宿主与首轮验收 |
| --- | --- | --- |
| Android | AAR 及生成的 Gradle 工程，可外部签名构建面向 API 36 的 arm64 APK／AAB。 | Fold7 已验证分包安装与覆盖升级恢复存档，GLES3 播放器已运行选定的 2D 和含 2D HUD 的 World3D 游戏，并从驻留几何恢复回放。更多图形档位及 Vulkan 待验证。[播放器与测量](android-project-player.md) |
| iOS | XCFramework 和可签名归档的 Xcode 工程 | 使用 Metal 和随包脚本，可替换脚本宿主。在 iPhone 上验证首次输入、内存告警、前后台、缩放和旋转。 |
| 原生鸿蒙 | 原生库和可构建签名应用包的 DevEco Studio 工程 | ArkTS 通过 C ABI 对接 XComponent 原生窗口。实机验证窗口替换和图形后端后再设为默认。 |
| 微信小游戏 | 仓库工具导出 WebGL2 所需的 JS 入口、适配层、包内资产和工程配置。 | 2D 游戏已在模拟 wx 宿主进入玩法。微信开发者工具、客户端真机及平台提交待验证。[导出方法与限制](wechat-minigame.md) |
| 抖音小游戏 | 含 JS 入口、平台配置和资源分包的抖音工程 | 使用宿主图形接口和一个上屏画布。各支持宿主分别验证画面合成和可选的 TTWebAssembly。 |

普通小游戏采用公开平台接口。手机厂商或应用运营方内置原生 SDK 属于单独合作，需约定设备和分发条件。原生后端候选包括 wgpu，选择依据为所需能力、包体和设备实测成本。[Android 游戏宿主](https://developer.android.com/games/agdk/game-activity/get-started) · [Apple Metal](https://developer.apple.com/metal/) · [华为 XComponent](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/napi-xcomponent-guidelines/) · [微信接口](https://github.com/wechat-miniprogram/minigame-api-typings) · [抖音运行环境](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/bytedance-mini-game) · [抖音 Wasm](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/optimization)

Rust 渲染器、Android 宿主和程序生成的场景均为本项目原创。APK 随附项目及内置依赖的许可声明。[来源登记](https://github.com/cnedwin/Egret_rebuild/blob/main/contributions/android-runtime-sdk.json)

## 资源与执行职责

TypeScript 负责输入、游戏逻辑、显示顺序、时钟和资源租约。原生执行器接收由完整 SharedRenderFrame2D 捕获结果生成的有序批次。每个支持范围都要明确纹理页身份、采样方式、颜色、变换和可接受指令；遇到不支持的指令，要在显示这一帧之前报告。只在创建或恢复时传输不可变的纹理页。稳态路径只传处理当前变化和绘制所需的数据。

AssetManager 和所属 Scope 继续管理逻辑资源、版本替换和取消。原生表面管理本代设备的物理分配。游戏持有租约期间，保留可重建的 CPU 来源；设备上下文丢失时，旧代句柄失效。关闭时停止接收新工作，安全处理在途命令并报告清理错误。原生接口明确边界、所有权和字节序，调用方不得在调用结束后继续借用 JS 或 Rust 对象。

## 初始实施顺序

1. 让 Android 2D 样板可安装。在手机 Chrome、实时 Rust 宿主和原生命令回放中运行同一场景。先确认像素和纹理生命周期，再解释性能数据。记录脚本 VM、传输方式、图形后端和支持的场景范围。
2. 接入 iOS Metal 和第二个脚本宿主。用相同契约验证启动、前后台、关闭和纹理重建。两端跑通后固定可供第三方嵌入的 ABI。
3. 接入原生鸿蒙，再生成两类小游戏工程。分别核对权限、签名、存储、输入和分包，按实测能力选择加速路径。
4. 分步支持复杂 UI 与文字、透明批次、单表面 World3D/2D 合成。验证外部项目、能力不匹配提示和签名构建后，交付通用导出器。浏览器导出持续可用。

## 同机测量口径

固定源码、捕获的帧循环、纹理字节、实际渲染缓冲尺寸和画质。实时与回放两路须产生相同的命令字节。浏览器使用现有共享 2D 执行器，像素采样在计时区间之外完成。交替安排各组次序，保留逐轮结果、预热长度、观察到的刷新率、前台及热状态。

启动到首帧须标明各宿主的时钟起点，可观测时分别列出进程启动、内容加载和首次可用帧。已有 Chrome 进程中的新导航和新建 Activity 的启动覆盖不同。记录帧间隔 p50/p95/p99、实时捕获与编码和传输的耗时、回放及提交的 CPU 耗时，并写明进程 PSS 采样覆盖的进程。回放同时去掉 JS 生成和桥接，两组总耗时之差也受调度影响，因此单列直接测到的分段。GPU 完成与屏幕实际呈现需各自取证。单一场景只能证明该场景的结果。

## 运行原版白鹭 5 游戏

同一个 Android 播放器可接收白鹭 7 游戏、使用迁移适配包的项目，或白鹭 5.3 原版引擎模块与业务脚本。走原版路径时，显示列表、EUI、RES、事件分发和命中逻辑仍在白鹭 5 中执行。原生绑定将变化映射到共享显示树，现有编码器生成帧命令，Rust 负责校验并执行已支持的 GLES3 绘制，与白鹭 7 共用 GPU 资源生命周期。每个 APK 只含所选的一种虚拟机。Activity、系统编辑器、音频和渠道回调由 Android 平台层接管。[原版游戏打包说明](android-migration-build-kit.md)

Windows Edge 和 Fold7 上安装的 APK 使用了同一份原版 5.3.10 模块。Android 重新打开后恢复了图集、中文文字和存档计数，原版输入框能够收到 Android 系统编辑器的变更事件。独立的九宫格用例在相同显示尺寸下，六个状态的 779 个 RGB 采样全部一致。一个商业工程的浏览器鼠标插件仍需要原生绑定。该工程完整玩法、渠道和白鹭 5.3 其他补丁版本仍待验收。[原版引擎实测记录](original5-atlas-verification.md)

另一组同包对照中，仅为 Release APK 增加八个白鹭 5.3.10 压缩模块，包体从 64,441,672 字节变为 64,603,144 字节。相差的 161,472 字节只代表这八个脚本。实际适配层、游戏素材和第三方库的成本需分别计算。

## 虚拟机与平台分工

Android 采用上游 Javet 6.0.4 嵌入 V8 15.8.62.52。依赖 `Intl` 的游戏应选带国际化的构建。独立分发的 Release APK 可压缩原生库，安装时再展开。在同场景对照中，裁剪版 APK 直接映射原生库时为 64,305,415 字节，压缩模式为 17,670,631 字节。两者安装使用的 V8 动态库都是 62,039,024 字节。游戏依赖仍可使用 WebAssembly。游戏如果会动态加载脚本，裁掉虚拟机功能前需要先声明并实际运行相应依赖。[V8 验收记录](https://github.com/cnedwin/Egret_rebuild/pull/531)

iOS 宿主用 Apple JavaScriptCore 执行包内的白鹭 7 二维场景，经共享 Rust 解码器处理 EGR2，由 Metal 呈现。macOS/Xcode 已编译模拟器和真机目标，并核对模拟器的合成画面和资源重建。真机归档安装需要客户的 Apple 签名。iPhone 实机性能、Android 的其余帧格式和白鹭 5 原版输入仍需在 iOS 分别验证。[iOS 宿主与构建说明](https://github.com/cnedwin/Egret_rebuild/pull/530)
