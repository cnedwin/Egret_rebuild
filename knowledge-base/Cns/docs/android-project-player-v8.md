# 为 Android 游戏选择脚本宿主

[English](../../en/docs/android-project-player-v8.md) | 简体中文

用 [Android 游戏项目播放器](android-project-player.md)导出的游戏，可以使用手机上的系统 WebView，也可以把 V8 随 AAR 一起打包。三种构建共用 Rust GLES3 渲染器、资源作用域和 Android 游戏视图。在构建 AAR 时选择脚本宿主。同一游戏仍可单独打包，或嵌入已有应用的 Activity。

| 构建参数 | 脚本环境 | 最低 Android API |
| --- | --- | ---: |
| `webview`（默认） | 已安装的系统 WebView、本地 HTML 入口及浏览器 API | 26 |
| `standard` | V8 15.7.112.19，带 JavaScript `Intl` 和 ICU 语言数据 | 29 |
| `trimmed` | 相同版本的 V8，构建时去掉 `Intl` 及其 ICU 数据 | 29 |

游戏依赖 DOM 或优先控制下载体积时，可用系统 WebView。需要自带虚拟机，且使用 `Intl` 进行本地化格式化或排序时，选标准 V8。三种宿主均可调用 Android 字体显示中文。两种内置 V8 使用 Javet 6.0.3 的 arm64 构建。依赖版本、哈希及许可见[来源清单](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/android/v8-provenance.json)。

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

原始回放基准使用独立的 EGR1 固定场景。《月下药铺》的数据仅覆盖以上三种实时脚本宿主。[本轮设备记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-v8.json) · [原生命令回放对照](runtime-sdk-v8-fold7.md)

## 在同一款游戏里对照原生命令回放

生成的嵌入示例可在开启调试的应用中选择三种测量模式。`capture` 让游戏按固定逻辑时间运行前 210 次提交，第 n 帧的时间为 `n × 1000 / 120` 毫秒。录制器保存已提交的 EGR2 命令字节及当时对应的未预乘 Alpha 的 RGBA 纹理页，包含纹理替换和移除。完整记录写入应用私有目录后，以原子操作发布。每份记录最多 64 MiB，最多包含 4,096 个纹理页版本。每个应用保留最近一次完整记录。若新录制替换了旧文件，回放会在绘制前核对请求的摘要。

`live` 以相同逻辑时间运行游戏，跳过录制。`replay` 预加载经校验的记录，将相同命令直接提交给原有 GLES3 渲染器，全程无需启动脚本虚拟机。各模式均忽略游戏操作，完成后停在第 209 帧，便于逐像素比较。EGL 上下文重建后，渲染器恢复纹理并重绘该帧。录制、实时计时和回放计时分别启动。回放的启动时间包含读取和校验，下表使用的驻留内存也包含停在末帧时仍保留的预加载记录。

以应用标识为 `org.example.herbarium` 的嵌入示例为例，先执行：

```sh
adb shell am start -S -n org.example.herbarium/org.egret.example.LibraryActivity --es egret.benchmark capture
adb shell dumpsys activity org.example.herbarium/org.egret.example.LibraryActivity
```

等 `benchmark.complete` 为真后读取 `benchmark.sha256`，各轮之间保留应用数据。以下命令分两次执行，每次完成后读取 Activity 诊断输出。将 `CAPTURE_SHA256` 替换为实际得到的小写摘要。

```sh
adb shell am start -S -n org.example.herbarium/org.egret.example.LibraryActivity --es egret.benchmark live --ez egret.timing true
adb shell am start -S -n org.example.herbarium/org.egret.example.LibraryActivity --es egret.benchmark replay --es egret.replaySha256 CAPTURE_SHA256 --ez egret.timing true
```

原生回放没有脚本生成或脚本到宿主的复制阶段。跨模式比较可采用从派发到进入渲染队列的耗时，以及相邻提交成功回调的间隔。各模式预热后开始采样。这两项指标包含宿主调度与队列等待。GPU 执行和屏幕呈现需要单独采集。

### 固定负载的 Fold7 结果

每组四次进程冷启动，轮换测试顺序，让每种模式在四个位置各出现一次。每次均预热 30 帧，再记录 180 次提交，共 2,880 个样本。先按每轮样本计算 p95，再取四轮各项指标的中位数。PSS 在持有末帧时读取，包含实际归属该应用的 WebView 渲染子进程。

| 模式 | 进程启动到首次提交回调（ms） | 提交回调间隔 p95（ms） | 派发到入队 p95（ms） | 驻留 PSS（MiB） |
| --- | ---: | ---: | ---: | ---: |
| 系统 WebView | 329.5 | 15.885 | 7.221 | 222.1 |
| 标准 V8 | 247.9 | 8.830 | 2.291 | 202.0 |
| 裁剪 V8 | 244.3 | 8.788 | 2.296 | 200.4 |
| 原生命令回放 | 75.2 | 8.812 | 0.012 | 118.4 |

210 帧中每帧绘制 81 个四边形。去掉帧号后，命令内容有 26 种变化。原生回放的派发耗时很低，两个内置 V8 的提交间隔 p95 与回放接近。对这个场景，WebView 从派发到入队的时间值得优先分析。该差额同时包含线程调度、命令生成和传输，无法单独归因于某一次复制或 GPU 执行。

三种脚本宿主各自录出的文件逐字节相同，大小均为 2,483,048 字节。四组末帧的 2,073,600 个像素完全一致，包括移动角色。取原始角色图集的 280 个不透明采样点逐一核对，四组采样均与原画一致。每组重建 EGL 后再次绘出相同画面，关闭时合计上传和释放纹理各 8 次。调试版拒绝摘要不符的回放，开启 R8 压缩的正式版按普通游戏路径运行。[四组实测及原始样本](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-replay.json)

### Galaxy Z Fold7 上的 WebView 命令传输

上表的派发到入队 p95 为 7.221 ms。为定位耗时，在同一台 Fold7 上用原 WebView 通道冷启动《Moon Herbarium》三次，每次沿用 30 帧预热，再记录 180 帧。分别取每轮派发最慢的 9 帧，从 JS 调用到 Java 收到数组占其平均派发耗时的 65.2%–69.5%。该区间包含参数转换、跨进程传递和线程调度。

| 同一组最慢 9 帧的平均耗时（ms） | 第 1 轮 | 第 2 轮 | 第 3 轮 |
| --- | ---: | ---: | ---: |
| 派发到 JS 开始执行 | 1.009 | 0.951 | 1.149 |
| 游戏生成命令 | 0.733 | 0.800 | 0.900 |
| 创建视图与长度校验 | 0.022 | 0.000 | 0.011 |
| JS 调用到 Java 进入桥接方法 | 4.422 | 3.719 | 5.224 |
| Java 校验和捕获帧快照 | 0.038 | 0.026 | 0.033 |
| 等待 UI 线程执行 | 0.152 | 0.196 | 0.180 |
| UI 线程开始执行到入队计时点 | 0.017 | 0.010 | 0.019 |
| 派发到入队总计 | 6.392 | 5.702 | 7.515 |

每轮采集前后各用 24 次往返对齐 JS 和 Android 时钟。对每次往返得到的偏移区间，两端各放宽实测 JS 时钟粒度 100 µs 和取整余量 1 µs。每批取 24 个区间的交集，以各次往返中心的平均时刻为基准，在两批交集中点之间做线性插值。端点偏移区间半宽为 42.6–94.4 µs。540 帧重算的派发总耗时与原计时器逐帧相差最多 1 µs。很短的 JS 操作可能落在同一个时钟刻度内。[逐帧时间戳与时钟校准数据](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-webview-bridge-diagnostic.json)

当命令视图的偏移和长度都按 4 字节对齐时，WebView 播放器把每 4 个字节作为一个有符号 32 位整数发送。场景中每帧 5,208 字节，通过同步桥接只需传递 1,302 个数组元素。Java 按设备字节序还原原始命令，在原位置获取纹理页快照，再向 UI 线程投递。其他切片沿用逐字节通道。

关闭分段探针后，在同一台手机、WebView 157 和 GLES3 渲染器上做 6 对冷启动复验，AB 和 BA 交替。各轮派发到入队 p95 的中位数从 6.562 降至 3.593 ms。逐对计算，耗时降幅的中位数为 2.894 ms，相对降幅的中位数为 44.1%，6 对均有改善。采集前约定的门槛为至少 4 对改善、中位降幅至少 0.500 ms 且至少 10%。提交回调间隔 p95 的中位数从 11.024 降至 8.930 ms。本次计时覆盖宿主线程，GPU 执行、屏幕呈现和功耗仍待分别测量。

两版 210 帧生成的完整命令与纹理记录逐字节相同，均为 2,483,048 字节。EGL 重建前后，固定末帧的 2,073,600 个像素全部一致。两版在两个上下文中各上传和释放 8 张纹理，均通过独立的普通关闭和重开验证。[成对样本、包身份与一致性结果](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-webview-bridge-pairs.json)
