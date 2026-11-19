# Egret Runtime SDK

[English](../../en/docs/runtime-sdk.md) | 简体中文

开发者保留一份 TypeScript 游戏入口和资源清单，导出时由打包器选择宿主服务。项目若直接使用 DOM、浏览器图形上下文或目标平台缺少的系统服务，导出器应指出依赖所在位置与所需能力。现有 TypeScript 包 `@egret/runtime` 保留原有职责，原生 SDK 单独维护二进制接口和兼容范围。

Android AAR、游戏导出与 Activity 接入方法见[Android 游戏项目播放器指南](android-project-player.md)。

## 五个平台的发布路径

| 目标 | 构建产物 | 宿主与首轮验收 |
| --- | --- | --- |
| Android | 可嵌入库和用于构建 APK/AAB 的 Gradle 工程。首个产物为 arm64 调试 APK。 | 用 GLES3 跑通不透明 2D 场景，单独测量桥接，再用相同负载验证 Vulkan。检查表面丢失后的 GPU 资源重建。 |
| iOS | XCFramework 和可签名归档的 Xcode 工程 | 使用 Metal 和随包脚本，可替换脚本宿主。在 iPhone 上验证首次输入、内存告警、前后台、缩放和旋转。 |
| 原生鸿蒙 | 原生库和可构建签名应用包的 DevEco Studio 工程 | ArkTS 通过 C ABI 对接 XComponent 原生窗口。实机验证窗口替换和图形后端后再设为默认。 |
| 微信小游戏 | 含 JS 入口、平台配置和资源分包的小游戏工程 | 接入宿主画布、存储和生命周期。有收益的 CPU 模块按能力使用 WXWebAssembly。用真机检查首屏、包体边界及兼容路径。 |
| 抖音小游戏 | 含 JS 入口、平台配置和资源分包的抖音工程 | 使用宿主图形接口和一个上屏画布。各支持宿主分别验证画面合成和可选的 TTWebAssembly。 |

普通小游戏采用公开平台接口。手机厂商或应用运营方内置原生 SDK 属于单独合作，需约定设备和分发条件。原生后端候选包括 wgpu，选择依据为所需能力、包体和设备实测成本。[Android 游戏宿主](https://developer.android.com/games/agdk/game-activity/get-started) · [Apple Metal](https://developer.apple.com/metal/) · [华为 XComponent](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/napi-xcomponent-guidelines/) · [微信接口](https://github.com/wechat-miniprogram/minigame-api-typings) · [抖音运行环境](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/bytedance-mini-game) · [抖音 Wasm](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/optimization)

Rust 渲染器、Android 宿主和程序生成的场景均为本项目原创。APK 随附项目及内置依赖的许可声明。[来源登记](https://github.com/cnedwin/Egret_rebuild/blob/main/contributions/android-runtime-sdk.json)

## 资源与执行职责

TypeScript 负责输入、游戏逻辑、显示顺序、时钟和资源租约。原生执行器接收由完整 SharedRenderFrame2D 捕获结果生成的有序批次。每个支持范围都要明确纹理页身份、采样方式、颜色、变换和可接受指令；遇到不支持的指令，要在显示这一帧之前报告。只在创建或恢复时传输不可变的纹理页。稳态路径只传处理当前变化和绘制所需的数据。

AssetManager 和所属 Scope 继续管理逻辑资源、版本替换和取消。原生表面管理本代设备的物理分配。游戏持有租约期间，保留可重建的 CPU 来源；设备上下文丢失时，旧代句柄失效。关闭时停止接收新工作，安全处理在途命令并报告清理错误。原生接口明确边界、所有权和字节序，调用方不得在调用结束后继续借用 JS 或 Rust 对象。

## 分期交付

1. 让 Android 2D 样板可安装。在手机 Chrome、实时 Rust 宿主和原生命令回放中运行同一场景。先确认像素和纹理生命周期，再解释性能数据。记录脚本 VM、传输方式、图形后端和支持的场景范围。
2. 接入 iOS Metal 和第二个脚本宿主。用相同契约验证启动、前后台、关闭和纹理重建。两端跑通后固定可供第三方嵌入的 ABI。
3. 接入原生鸿蒙，再生成两类小游戏工程。分别核对权限、签名、存储、输入和分包，按实测能力选择加速路径。
4. 分步支持复杂 UI 与文字、透明批次、单表面 World3D/2D 合成。验证外部项目、能力不匹配提示和签名构建后，交付通用导出器。浏览器导出持续可用。

## 同机测量口径

固定源码、捕获的帧循环、纹理字节、实际渲染缓冲尺寸和画质。实时与回放两路须产生相同的命令字节。浏览器使用现有共享 2D 执行器，像素采样在计时区间之外完成。交替安排各组次序，保留逐轮结果、预热长度、观察到的刷新率、前台及热状态。

启动到首帧须标明各宿主的时钟起点，可观测时分别列出进程启动、内容加载和首次可用帧。已有 Chrome 进程中的新导航和新建 Activity 的启动覆盖不同。记录帧间隔 p50/p95/p99、实时捕获与编码和传输的耗时、回放及提交的 CPU 耗时，并写明进程 PSS 采样覆盖的进程。回放同时去掉 JS 生成和桥接，两组总耗时之差也受调度影响，因此单列直接测到的分段。GPU 完成与屏幕实际呈现需各自取证。单一场景只能证明该场景的结果。
