# Android 2D Runtime 示例

[English](README.md) | 简体中文

此 arm64 调试 APK 用 Rust GLES3 渲染器运行共享 2D 场景。默认通过系统 WebView 运行随包发布的白鹭游戏，也可以选择内置 V8。两种脚本宿主均逐帧向原生绘制表面提交编码后的命令，回放模式直接读取固定的命令循环。所有路径使用同一图集、视口和 Rust 执行器。

如需将自己的游戏打成 APK 或把游戏嵌入现有 Activity，请参阅[Android 工程播放器指南](../../knowledge-base/Cns/docs/android-project-player.md)。

## 构建

安装项目规定的 Node 版本、JDK 17、Android 平台 35、SDK Build Tools 35.0.0、Android NDK r27c，以及带 `aarch64-linux-android` 目标的 Rust。将 `JAVA_HOME`、`ANDROID_HOME` 和 `ANDROID_NDK_HOME` 指向相应安装目录。Rust 工具链需带有对应版本的 `share/doc/rust/COPYRIGHT-library.html`，供分发时随包保留。先构建 JS 工作区，再通过 esbuild 0.28.2 将场景生成到新目录。

```text
node runtime-sdk/scene/build.mjs --esbuild <esbuild-module> --out <scene-directory>
node runtime-sdk/android/build.mjs --scene <scene-directory> --output <output-directory>/egret-runtime.apk
```

打包工具编译 Rust 静态库、链接 JNI 库、编译 Java、打包游戏和第三方声明，再用本地调试证书签名。最终检查包括签名、嵌套资源的路径及 16 KiB ZIP 对齐。要复用从相同源码构建的库，传入 `--rust-lib <archive>` 和 `--rust-notice <matching-COPYRIGHT-library.html>`。保留输出目录中的 `egret-debug.p12` 以便更新已安装的示例。构建产物和调试密钥应放在仓库之外。

## 可选的 V8 构建

省略 `--v8-profile` 时生成默认的系统 WebView 包。两种 V8 构建使用各自的输出目录，在同一台手机对照时共用签名证书。构建程序将校验和锁定的 Javet 归档下载到指定缓存。标准版还会包含与 V8 匹配的 ICU 数据。缓存备齐后可以离线复用。

```text
node runtime-sdk/android/build.mjs --scene <scene-directory> --v8-profile standard --v8-cache <cache-directory> --keystore <debug-key> --output <standard-directory>/egret-runtime.apk
node runtime-sdk/android/build.mjs --scene <scene-directory> --v8-profile trimmed --v8-cache <cache-directory> --keystore <debug-key> --output <trimmed-directory>/egret-runtime.apk
```

内置 V8 的包可用 `--es mode v8` 启动定长测量。`--es mode native` 选择系统 WebView，`--es mode replay` 回放已捕获的命令。标准版启动时验证中文地区的数字格式，裁剪版省去 `Intl`。请按游戏及其依赖选择配置。[构建配置与真机结果](../../knowledge-base/Cns/docs/runtime-sdk-v8-fold7.md)

## 在已授权的手机上运行

```text
adb -s <serial> install -r <output-directory>/egret-runtime.apk
adb -s <serial> shell am start -n org.egret.runtime.sample/.GameActivity --es mode native --es runId live-01 --ei warmup 60 --ei samples 300 --ez finish true
adb -s <serial> shell run-as org.egret.runtime.sample cat files/result.json
```

轮询结果，直到 `runId` 与本轮匹配且 `status` 为 `complete`。改用 `--es mode replay` 和新的运行 ID 即可执行回放。点击应用图标会持续播放实时场景，点按画面可暂停或继续。退到后台会保留场景的资源租约，并释放 GPU 图集；返回时会在新上下文中重新上传，从保存的循环位置继续。返回键会关闭引擎作用域与原生渲染器。示例仅保存当前帧和循环位置，单独的 `files/demo.json` 记录前后台切换和关闭。计时批次结束会保留最后一帧，传入 `finish` 则关闭 Activity。计时中途失去前台会记录中断。

正确性检查传入 `--ez verify true`。宿主校验资源摘要，并在至少一个完整循环中逐帧比较实时命令与回放字节。加上 `--ez recover true` 可在批次中点触发 Android EGL 上下文重建，并从保留的图集重新上传。正式计时时省略这两个标记。比较实时、回放及 H5 在同一循环索引的自上而下 RGBA 像素摘要。

结果记录原始 Choreographer 时间戳、JS 求值及解码和排队区间、GL 提交的 CPU 时间、从进程和 Activity 启动到首次提交的耗时、结束时宿主进程的 PSS 及资源释放次数。WebView 还有独立渲染进程，应用宿主 PSS 只覆盖其中一个进程。JS 区间含构建并编码一帧的耗时，可与完整实时和回放链路分别对照。屏幕呈现、GPU 执行和功耗需要另行观测。各宿主对照应固定设备设置、渲染尺寸和负载。
