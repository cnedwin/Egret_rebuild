# Android 游戏项目播放器

[English](../../en/docs/android-project-player.md) | 简体中文

同一份 arm64 Android 库可以把可信的 JavaScript 或 TypeScript 游戏打成独立应用，也可以把游戏作为子视图放入已有 Activity。默认由 Android System WebView 运行随包脚本。使用播放器服务的游戏也可以选择[内置 V8](android-project-player-v8.md)。Rust 通过 OpenGL ES 3 在可见的 `GLSurfaceView` 上绘制游戏。库声明的最低系统版本为 Android API 26，随包提供支持 GLES3 的 arm64 原生代码。脚本环境另需支持 ES2022 和 AbortController 的较新 Android System WebView。下文验证结论以实际跑过的配置为限。

## 构建 AAR 和游戏应用

在引擎仓库根目录执行以下命令。准备 Node 26.7.0、pnpm 11.25.0、JDK 17、Android SDK Platform 35、Build Tools 35.0.0、NDK r27c，以及已安装 `aarch64-linux-android` 目标的 Rust。配置 `JAVA_HOME`、`ANDROID_HOME` 和 `ANDROID_NDK_HOME`。构建时需要对应 Rust 安装中的 `share/doc/rust/COPYRIGHT-library.html`。游戏导出器需要已安装的 **esbuild 0.28.2** 模块路径。

```sh
pnpm install --frozen-lockfile
pnpm run build
node runtime-sdk/android/player/build-aar.mjs --out out/egret-player.aar
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/moon-herbarium --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.herbarium --layout standalone --out out/herbarium
gradle -p out/herbarium assembleDebug
```

生成的 Gradle 应用使用 Android Gradle Plugin 8.7.3。可用兼容的 Gradle 构建，也可以用 Android Studio 打开生成目录。调试 APK 位于 `out/herbarium/build/outputs/apk/debug/`。改用 `--layout embedded` 并指定新输出目录，即可生成带原生控件的 Activity，在其中打开、关闭和重新打开游戏子视图。接入方管理应用 ID、清单、签名和发行构建。如果已有同一源码编出的 Rust 静态库，可用 `--rust-lib` 和 `--rust-notice` 向 AAR 构建器提供静态库和对应许可文件。

## 导出自己的游戏项目

将游戏目录的完整路径传给 `--project`，项目可放在引擎仓库之外。游戏的 `project.json` 声明逻辑舞台尺寸、本地 HTML 入口、JS 或 TS 脚本、随包图片及其他文件。下面的清单可以运行一个只画矩形、无需额外资源的游戏。

```json
{
  "width": 360,
  "height": 640,
  "entry": "index.html",
  "script": "main.ts",
  "pages": [],
  "assets": []
}
```

在 `index.html` 中加入 `<script src="./game.js"></script>`。导出器将入口脚本及其引用打包为 `game.js`。打包图片时，在 `pages` 中添加形如 `{"id":1,"src":"assets/herbs.png","width":240,"height":60}` 的记录。音效等运行时文件列入 `assets`。游戏负责读取资源、创建引擎纹理并发布对应的图像对象。随仓库提供的《月下药铺》使用两张 PNG 图集、栅格化的中文文字、角色动画和裁剪列表，支持触摸、滚动、原生改名输入和交付药方时的音效。

```ts
import { Sprite } from '@egret/engine';
import { installPlayerProject } from '@egret/android-player-project';

installPlayerProject({
  width: 360, height: 640, clearColor: 0x18281d,
  create({ engine, scope }) {
    const marker = scope.use(new Sprite());
    marker.graphics.beginFill(0xc8e9bd, 0.75).drawRect(20, 30, 96, 44).endFill();
    engine.stage.addChild(marker);
    return { input(event) { if (event.type === 'up') marker.x = event.x - 68; } };
  }
});
```

TypeScript 项目使用 `@egret/engine` 的类型，并在游戏的 `tsconfig.json` 中包含 `runtime-sdk/project/android-player-project.d.ts` 或其副本。导出器将 `@egret/android-player-project` 解析到本仓库的适配器。每个播放器独立拥有一个 Engine 和 Scope。异步加载时传入宿主提供的 `signal`。调用 `publishPage(id, image)` 将纹理实际使用的 `ImageData2D` 登记到 1 至 255 号槽位，返回句柄的 `release()` 支持重复调用。通过 `edit(text)`、`playSound(assetPath)` 和 `state(value)` 调用 Android 服务。游戏可实现 `input`、`update`、`pause`、`resume`、`close` 和 `closedSnapshot`。输入事件提供舞台坐标、触点 ID、位移或编辑及提交的文字。`update(elapsedMs)` 收到前台累计时间，引擎时钟单次最多推进 100 毫秒，恢复后重新建立时间基准。

## 读取包内关卡文件

在 `project.json` 的 `assets` 中登记文件，例如 `"assets": ["levels/harbor.json"]`，并以 UTF-8 保存。关卡可以通过名称选择图集帧。

```json
{"关卡":"雾港🌙","图集帧":"lantern","对白":"沿河向东。"}
```

在项目工厂中，假设 `sheet` 是已加载的图集：

```ts
const text = await services.assets.readText('levels/harbor.json', services.signal);
const level = JSON.parse(text);
const sprite = sheet.createBitmap(level['图集帧']);
services.engine.stage.addChild(sprite);
```

系统 WebView、标准 V8 和裁剪 V8 共用这个接口。可以传入 `AbortSignal` 单独取消一次读取。即使省略信号，关闭游戏也会取消这个项目尚未完成的读取。取消时 Promise 以信号的原因拒绝。重新打开游戏会创建独立的读取会话。

单文件上限为 256 KiB，按编码后的字节数计算。读取时会去掉开头的一个 UTF-8 BOM，空文件返回空字符串。使用项目内的相对路径，拼写和大小写需与清单及包内文件一致。文件缺失或未声明时返回 `NotFoundError`，UTF-8 无效时返回 `EncodingError`，路径无效（如 `../level.json`）时返回 `TypeError`，超过大小或并发上限时返回 `RangeError`。可通过 `error.name` 区分这些情况。每个会话最多同时接纳八个读取请求。请用支持此接口的版本构建 AAR 并导出游戏。

Galaxy Z Fold7 上，系统 WebView、标准 V8 和裁剪 V8 读取同一份 UTF-8 关卡，均选中了灯笼图集帧。三个宿主都识别了已声明但包内缺失的文件和未声明路径，取消待处理的读取后重试成功。在首次读取期间关闭时，游戏没有提交画面或上传纹理；重新打开后显示了预期的精灵。测试 Activity 暂时占住读取队列，使两项待处理读取的验证可以复现。[Fold7 结果和像素对照](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-text-assets.json)

## 读取二进制关卡

在 `project.json` 的 `assets` 中登记文件，例如 `"assets": ["levels/harbor.bin"]`。用同一个项目资源服务的 `readBytes` 读取。每次成功都会得到独立的 `Uint8Array`，包内的零字节、开头的 BOM 和无效 UTF-8 字节都原样保留。空文件返回长度为零的数组。

本例由游戏规定关卡格式。前四个字节是 ASCII 标识 `EGB1`，第五个字节选择图集帧。

```ts
const bytes = await services.assets.readBytes('levels/harbor.bin', services.signal);
if (bytes.length < 5 || bytes[0] !== 0x45 || bytes[1] !== 0x47 ||
    bytes[2] !== 0x42 || bytes[3] !== 0x31) throw new Error('Invalid level header');
const frame = ['gate', 'lantern'][bytes[4]];
if (frame === undefined) throw new Error('Unknown atlas frame');
services.engine.stage.addChild(sheet.createBitmap(frame));
```

`readText` 和 `readBytes` 的单文件上限为 256 KiB，它们与分块读取共用每个视图的八个请求名额。可通过可选信号取消一次读取，关闭视图会取消该会话未完成的请求，重新打开后使用独立的读取器。清单和路径错误与文本读取相同。本版在资源加载时通过 Base64 传递 Android 宿主与脚本之间的二进制结果，游戏直接使用字节数组。请用支持 `readBytes` 的版本构建 AAR 并导出游戏；仅支持文本读取的旧版播放器在调用二进制读取时返回 `NotSupportedError`。

在 Galaxy Z Fold7 上，三个宿主都逐字节核对了同一份 196,613 字节的包内关卡，并选中灯笼帧。首次打开和重新打开时，整幅 1080 × 1920 游戏画面均符合预期。取消与关闭测试中，真实 APK 流先返回了 8,192 字节，测试包装器随后在第二次读取向 Android 请求更多字节前暂停。播放器中断了读取线程，流只关闭一次，字节数停在 8,192。取消后重试读到了完整文件；启动中关闭的会话提交了零帧，上传了零张纹理。这组结果验证了分块读取已在进行时的行为。[Fold7 二进制资源实测](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-binary-assets.json)

## 分块读取包内大文件

在同一份 `assets` 清单中声明文件。游戏能边读边处理数据时，可使用 `services.assets.readChunks(path, signal?)`。小文件和空文件也能按同样的方式读取。下面的关卡解析器逐块接收数据。

```ts
for await (const bytes of services.assets.readChunks('levels/world.bin', services.signal)) {
  parser.append(bytes);
}
parser.finish();
```

第一次取块时才打开文件。每次返回独立的 `Uint8Array`，最多 64 KiB，最后一块可以更短。到达文件末尾时循环结束，空文件直接结束。两次取块之间，读取器占用一个共享请求名额，最多保留一个原生文件流。遇到不足 64 KiB 的尾块时，文件流随即关闭，下一次取块会报告结束并释放名额。调用方执行 `next()` 时才会请求下一块，请等待本次取块完成再发起下一次。并行发起的第二次取块会返回 `TypeError`。宿主桥接层逐块进行 Base64 编码，脚本侧解码后再将字节数组交给游戏。解析器如果保留先前的数据块或自行拼接整个文件，还会占用额外内存。

使用 `break` 提前退出循环会释放读取器。手动调用 `next()` 时，可在 `finally` 中调用 `return()` 来处理提前结束。取消信号或关闭视图也会释放读取器，在两次取块之间同样有效。重试时新建迭代器，文件会从头读取。若安装的 AAR 尚未支持分块读取，第一次取块会返回 `NotSupportedError`。

在 Galaxy Z Fold7 上，三个宿主逐字节核对了同一份 8,388,645 字节的包内资源。首次打开、取消后重试和关闭视图后重开，每次都得到 128 个整块和一个 37 字节的尾块。在第一块已交付、第二块已读取 8,192 字节时，取消和关闭均成功中断了工作线程，文件流各关闭一次。首次打开和重开后的 1080 × 1920 画面逐像素符合预期。

| 进程 | 读取前 PSS 中位数（KiB） | 读取中 PSS 采样最大值（KiB） | 读取中样本数 |
| --- | ---: | ---: | ---: |
| WebView 应用进程 | 203,393 | 206,267 | 22 |
| WebView 渲染进程 | 33,438 | 41,839 | 22 |
| 标准 V8 应用进程 | 208,031 | 222,846 | 30 |
| 裁剪 V8 应用进程 | 210,492 | 224,655 | 31 |

三个宿主各在预热后另做一次内存采集，测试程序每处理完一块等待 100 ms，供系统采样。Android PSS 按比例分摊进程共享的驻留内存，包含脚本宿主和渲染状态。WebView 应用与渲染进程各自的采样最大值可能出现在不同时刻。采样间隔、RSS 和读取后的数值见[真机记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-asset-chunks.json)。

### Galaxy Z Fold7 连续读取实测

播放器在已有的 arm64 原生库中编码每个数据块。NEON 每次转换 48 个输入字节，剩余字节用标量代码处理，再将有效的 Base64 ASCII 字节构造成 Java 字符串。游戏侧继续收到独立的字节数组。

测试沿用上次验收的 8 MiB 加 37 字节关卡。基线使用原 Java 编码器。两侧采集应用均关闭调试和混淆，签名、游戏脚本和压缩资源相同。每个宿主做四组相邻冷启动配对，覆盖基线先跑和优化版先跑两种顺序。每次打开后先预热三遍，再连续计时九遍，块与块之间不加延迟。每遍计时到文件末尾，随后逐字节校验本遍保留的数据块。

| 脚本宿主 | 基线（MiB/s） | 优化版（MiB/s） | 配对变化中位数 | 吞吐提高的配对数 |
| --- | --- | --- | --- | --- |
| WebView | 47.1 | 73.0 | +56.5% | 4/4 |
| 标准 V8 | 103.9 | 117.4 | +14.9% | 4/4 |
| 裁剪 V8 | 100.4 | 119.5 | +19.0% | 4/4 |

下表来自独立的分段采集，单位为每个文件的毫秒数，箭头表示从基线到优化版。发起请求及返回通知的剩余时间包括原生计时区间之外的传递和线程调度，原始记录另列读取队列和宿主队列等待。每一列单独取中位数。

| 脚本宿主 | 包内读取 | Base64 编码及字符串构造 | 通过桥取回字符串 | JS 解码 | 发起请求及返回通知的剩余时间 |
| --- | --- | --- | --- | --- | --- |
| WebView | 8.1 → 7.0 | 58.7 → 27.6 | 54.7 → 45.0 | 11.6 → 9.9 | 22.1 → 21.3 |
| 标准 V8 | 6.3 → 6.4 | 47.1 → 26.9 | 16.0 → 15.6 | 8.6 → 8.2 | 8.7 → 8.6 |
| 裁剪 V8 | 5.5 → 6.6 | 45.9 → 26.8 | 13.5 → 15.9 | 7.7 → 8.1 | 7.5 → 7.3 |

内存单独采集。每次启动后，游戏连续读取并校验同一个文件 96 遍，只保留正在处理的数据块。下表取每个版本两次启动中观察到的最大值，WebView 单列与应用绑定的渲染进程。PSS 和 RSS 包含运行时、渲染和应用本身的内存。采样分辨不了更短的尖峰，也无法单独量出编码器的分配量。

| 进程 | PSS 采样最大值（KiB） | RSS 采样最大值（KiB） |
| --- | --- | --- |
| WebView 应用进程 | 195,961 → 196,163 | 342,016 → 342,408 |
| WebView 渲染进程 | 71,269 → 69,969 | 180,808 → 178,792 |
| 标准 V8 应用进程 | 259,923 → 261,003 | 380,788 → 381,720 |
| 裁剪 V8 应用进程 | 257,403 → 250,639 | 378,332 → 370,772 |

WebView 和标准 V8 的应用进程 PSS 采样峰值略高，裁剪 V8 的峰值较低。本轮在这台设备上观察到三个宿主的吞吐均有改善，内存变化的方向则因宿主而异。

Fold7 还在读取第二块时分别执行取消和关闭，随后核对了重试及重新打开的游戏。逐次测量、资源文件身份、资源回收计数和画面比对均收录在[测量记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-chunk-throughput.json)中。

## 接入已有 Activity

将 AAR 放入应用模块的 `libs/egret-player.aar`，在 Gradle 依赖中加入 `implementation files('libs/egret-player.aar')`。把资源导出到该模块 assets 下的新目录。将下例路径替换为自己的游戏、打包器和应用模块路径。

```sh
node runtime-sdk/android/player/export-project.mjs --project /projects/my-game --esbuild /path/to/node_modules/esbuild --out /projects/my-app/app/src/main/assets/game
```

在主线程上创建 `new org.egret.runtime.player.EgretPlayerView(activity, "game", listener)` 并加入布局。将 Activity 的 `onResume()`、`onPause()` 转发给视图。退出游戏时调用 `close()`，等 `listener.onClosed()` 到达后再创建新视图。`onReady()` 表示首次原生绘制已成功提交，`onError(String)` 报告错误，`onState(String)` 接收游戏主动发送的 JSON。`getDiagnostics()` 提供会话统计和项目关闭回执。完整的两种 Activity 示例位于 `runtime-sdk/android/player/consumers/`。

## 支持的画面和验证范围

播放器按捕获顺序绘制，每帧最多 4,096 个矩形或贴图四边形。它支持仿射变换、中性材质颜色、正常透明度合成、半透明填充和纹理、最近邻采样，以及多个轴对齐裁剪矩形的交集。原生执行器在线性光空间按预乘透明度合成，最后转换为显示用 sRGB。视图按可用空间适配不透明逻辑舞台，并将输入映射回舞台坐标。网格、特效、旋转裁剪区以及其他混合和过滤模式仍属此绘制接口的支持范围之外。

### 打包图集与序列帧

图集和序列动画沿用已有布局。`sourceWidth` 和 `sourceHeight` 描述原始画布，`trimX` 和 `trimY` 指定去掉透明边后图像在画布中的位置，`packedRotation` 接受 0° 或顺时针 90°。如需使用四种直角旋转，可调用 `createTextureView`，将 `quarterTurn` 设为 0、1、2 或 3。游戏按原始逻辑尺寸定位和缩放位图，播放器将裁掉的区域显示为透明，先按最近邻规则选中逻辑纹素，再映射到图集中。这套规则同样适用于镜像和动画换帧。采用整页采样时，纹理须覆盖完整页面且未经旋转或去边。

使用这类图集帧时，请用同一版源码构建播放器 AAR 并导出游戏。普通帧继续生成 EGR2 字节。含有图集映射的帧采用 EGR3，在原有的 64 字节绘制记录之后，为每个需要映射的四边形追加 24 字节，记录绘制序号、逻辑尺寸、裁边偏移和旋转方向。两种命令均复用已上传的纹理，可以交替录制和回放。旧版播放器仅能读取 EGR2 项目帧。

在 Galaxy Z Fold7 上，测试游戏在同一屏幕位置互换打包图集与独立展开的位图。每个受测脚本宿主的 581,256 对采样像素均一致，覆盖四种旋转、镜像、裁剪和半像素定位。把两种图画在屏幕不同位置时，半像素行的每种旋转各有 18 个采样点不同；互换纹理后，差异仍出现在相同的屏幕位置。记录中另有录制、回放和资源检查结果。[Fold7 图集实测](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-atlas.json)

Rust 单元测试覆盖帧长度与取值检查、纹理标识、透明度转换、裁剪取整和 EGR1 兼容性。JavaScript 测试通过真实 Engine 捕获两张有租约的图像，并改变可见图像集合。Windows 的离屏 EGL 1.5 验证通过 ANGLE SwiftShader 读取一幅测试画面的全部 48 个像素。黑底上 50% 白色得到 RGBA (188,188,188,255)，其上叠加半透明红色纹理得到 (224,137,137,255)，第二张不透明绿色纹理得到 (0,255,0,255)。镜像图集在边界上仍采到自身的纹素，透明清屏得到 (128,0,0,128)。这些像素来自桌面软件渲染器。

2026 年 11 月 19 日，两款 Gradle 应用均在 Galaxy Z Fold7（Android 17、系统 WebView 157、Adreno 830）上运行。两份 APK 中的六个游戏文件和原生渲染库逐字节相同。两种模式下，通过 Android 注入点击完成药方，拖动列表滚动，系统键盘成功弹出，音效播放器启动并释放了一次音效。切到后台再返回，第二个 EGL 上下文恢复了四张纹理页。对照切后台前后的药材列表静态区域，独立版的 152,106 个像素和嵌入版的 103,500 个像素均无变化。宿主关闭游戏时归还了全部 14 份逻辑纹理，保留原生控件，随后成功重新打开游戏。本地调试构建中，AAR 为 701,200 字节，独立 APK 为 1,767,567 字节，宿主 APK 为 1,767,575 字节，均使用设备已有的系统 WebView。本轮覆盖功能及生命周期，未测帧速、实际听感和真人输入法组词。[真机与构建产物记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-player.json)

此前的 EGR1 样板另有带 Intl 和不带 Intl 的 Javet/V8 两种可选构建、冻结命令回放及 Galaxy Z Fold7 的耗时和 PSS 记录。该数据对应原样板及其脚本宿主。上面的实机记录使用默认的系统 WebView 版 AAR。[原样板与实机记录](runtime-sdk-v8-fold7.md)

项目适配器、Android 视图、Rust 渲染器和示例游戏均为本项目贡献。AAR 的 `assets/egret-player-licenses/` 包含项目 LICENSE/NOTICE，以及 Rust 标准库、NDK/工具链和 robust-predicates 的许可文件。发布应用时请保留这些文件及游戏自带资源适用的许可声明。
