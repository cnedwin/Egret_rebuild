# 为 Android 游戏选择脚本宿主

[English](../../en/docs/android-project-player-v8.md) | 简体中文

用 [Android 游戏项目播放器](android-project-player.md)导出的游戏，可以使用手机上的系统 WebView，也可以把 V8 随 AAR 一起打包。三种构建共用 Rust GLES3 渲染器、资源作用域和 Android 游戏视图。在构建 AAR 时选择脚本宿主。同一游戏仍可单独打包，或嵌入已有应用的 Activity。

| 构建参数 | 脚本环境 | 最低 Android API |
| --- | --- | ---: |
| `webview`（默认） | 已安装的系统 WebView、本地 HTML 入口及浏览器 API | 26 |
| `standard` | V8 15.7.112.19，带 JavaScript `Intl` 和 ICU 语言数据 | 29 |
| `trimmed` | 相同版本的 V8，构建时去掉 `Intl` 及其 ICU 数据 | 29 |

游戏依赖 DOM 或优先控制下载体积时，可用系统 WebView。需要自带虚拟机，且使用 `Intl` 进行本地化格式化或排序时，选标准 V8。三种宿主均可调用 Android 字体显示中文。两种内置 V8 使用 Javet 6.0.3 的 arm64 构建。依赖版本、哈希及许可见[来源清单](../../../runtime-sdk/android/v8-provenance.json)。

## 构建与运行

按照项目播放器文档准备工具链后，在仓库根目录运行下列命令。对比构建时使用同一份游戏工程和渲染器。各配置的依赖和许可文件下载齐备后，缓存可离线复用。

```sh
node runtime-sdk/android/player/build-aar.mjs --v8-profile trimmed --v8-cache out/v8-cache --out out/player-trimmed.aar
node runtime-sdk/android/player/create-app.mjs --aar out/player-trimmed.aar --project runtime-sdk/examples/moon-herbarium --esbuild /path/to/node_modules/esbuild --layout embedded --id org.example.herbarium --out out/herbarium-v8
gradle -p out/herbarium-v8 assembleDebug
```

构建其他配置时，相应更换 `--v8-profile`、AAR 文件名和导出目录。生成的应用按所选库设置最低 Android API。V8 版 AAR 含虚拟机、Java 绑定、供应用压缩时使用的保留规则及分发许可。生成的调试 APK 把虚拟机原生库按对齐要求直接存储，AAR 则对同一文件进行压缩。签名 APK、AAR 和应用商店下载体积需分别测量。标准版首次使用时，还会把校验过的 ICU 数据安装到应用私有目录。

## 工程接口与生命周期

内置 V8 在独立线程直接执行导出的 `game.js`。项目可以使用游戏时钟、定时器、资源取消、舞台输入、原生文字编辑、音效和二进制帧提交。需要执行本地 HTML 脚本或直接访问 `document`、`Image` 等浏览器对象的游戏，应使用系统 WebView。播放器从安装包读取项目资源。需要加载远程内容时，由应用另行接入。播放器面向随包分发的可信游戏脚本。

项目可通过可选的 `services.raster` 解码已声明的 PNG，测量文字宽度，或把文字绘入纹理。三种构建使用同一套 Android 解码器和系统字体。每页最多 1,048,576 个像素，每边最多 4,096 像素。在加载资源或文字变化时准备纹理，准备阶段的图像传输采用 Base64。逐帧命令使用二进制缓冲区。每个 V8 游戏会话独占一个线程和一个隔离实例。收到 `onClosed()` 后，宿主可打开下一款游戏，此时上一会话的资源和虚拟机均已清理。

## 如何测量播放器

嵌入示例支持在 `adb shell am start` 启动参数中传入 `--ez egret.timing true`。Activity 诊断输出的 `timing` 对象记录预热 30 帧后连续 180 次成功提交。启动时间从进程启动或视图创建开始，到主线程收到首次原生提交成功的回调结束。帧间隔指连续两次回调之间的时间。`dispatchToEnqueueUs` 包含调度、脚本生成和传输，`enqueueToCallbackUs` 包含 GL 队列和主线程接收回调的时间。跨宿主比较可使用从派发到入队的时间。WebView 在 JavaScript 内计时，内置 V8 的生成耗时还包含 Java 调用 V8 方法的开销。V8 可单独记录显式缓冲复制耗时。WebView 的 Java 桥内部转换无法单独计时，该项记为不可测。GPU 实际执行、屏幕呈现和人耳听感需要另行测量。

## Fold7 实测

2026 年 11 月 19 日，在 Android 17、Adreno 830 的同一台设备上运行《月下药铺》。三份调试 APK 包含逐字节相同的六个游戏文件及 Rust 渲染库。每个宿主先完成一次独立的全新安装测试，再轮换顺序各测三次进程冷启动。后者复用文件缓存，标准 V8 的 ICU 已在私有目录内。下表为三轮的中位数。PSS 包含可归属的 WebView 渲染进程。

| 宿主 | APK（MiB） | 首次提交（ms） | 提交间隔 p95（ms） | 派发至入队 p50（ms） | PSS（MiB） |
| --- | ---: | ---: | ---: | ---: | ---: |
| 系统 WebView | 1.69 | 332.1 | 16.18 | 3.18 | 237.2 |
| 标准 V8 | 69.27 | 250.9 | 8.90 | 1.01 | 216.3 |
| 裁剪 V8 | 61.80 | 250.8 | 8.89 | 1.01 | 216.9 |

三种宿主都完成配药、列表滚动、系统键盘编辑及音效的启动和释放。排除移动角色经过的区域后，各宿主的 2,038,968 个静态游戏像素逐点相同。每个游戏切后台再返回后恢复了 EGL 上下文，静态区域与切后台前一致。关闭时每个宿主均归还了 14 份逻辑纹理，随后重新打开游戏。另一个开启 R8 压缩的裁剪 V8 应用通过了独立的真机启动、关闭和再打开。

原始回放基准使用独立的 EGR1 固定场景。《月下药铺》的数据仅覆盖以上三种实时脚本宿主。[本轮设备记录](../../../runtime-sdk/measurements/fold7-project-v8.json) · [原生命令回放对照](runtime-sdk-v8-fold7.md)
