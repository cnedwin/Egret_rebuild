# Android 游戏项目播放器

[English](../../en/docs/android-project-player.md) | 简体中文

同一份 arm64 Android 库既能把可信的 JavaScript 或 TypeScript 游戏打成独立应用，也可将游戏视图嵌入已有 Activity。项目播放器默认使用裁剪 V8，Rust 通过 OpenGL ES 3 在 `GLSurfaceView` 上绘制游戏。内置 V8 最低支持 Android API 29。使用 JavaScript `Intl` 的游戏可选标准 V8；显式选择系统 WebView 时最低支持 API 26，并需安装支持 ES2022 和 AbortController 的较新 WebView。[选择脚本宿主](android-project-player-v8.md)

已有游戏可沿用 Activity、外部签名与渠道库，单独更新游戏资源。迁移工具包提供播放器类型、可离线构建的 Gradle 工程，以及指定设备的调试安装命令。[迁移游戏构建与交接](android-migration-build-kit.md)

## 构建 AAR 和游戏应用

在引擎仓库根目录执行以下命令。准备 Node 26.7.0、pnpm 11.25.0、JDK 17、Android SDK Platform 36、Build Tools 35.0.0、NDK r27c，以及已安装 `aarch64-linux-android` 目标的 Rust。配置 `JAVA_HOME`、`ANDROID_HOME` 和 `ANDROID_NDK_HOME`。构建时需要对应 Rust 安装中的 `share/doc/rust/COPYRIGHT-library.html`。游戏导出器需要已安装的 **esbuild 0.28.2** 模块路径。

```sh
pnpm install --frozen-lockfile
pnpm run build
node runtime-sdk/android/player/build-aar.mjs --out out/egret-player.aar
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/moon-herbarium --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.herbarium --layout standalone --out out/herbarium
gradle -p out/herbarium assembleDebug
```

生成的应用以 Android API 36 为目标，使用 Android Gradle Plugin 8.9.1、Gradle 8.11.1 和 JDK 17 构建。调试 APK 位于 `out/herbarium/build/outputs/apk/debug/`。改用 `--layout embedded` 并指定新输出目录，即可生成带原生控件的 Activity，在其中打开、关闭和重新打开游戏子视图。接入方管理应用 ID、清单、签名和发行构建。如果已有同一源码编出的 Rust 静态库，可用 `--rust-lib` 和 `--rust-notice` 向 AAR 构建器提供静态库和对应许可文件。

## 构建本地签名发行包

连续发布的版本使用同一个应用 ID、签名证书和游戏资源根目录，每次升级递增版本号。应用名显示在桌面，版本名供玩家识别。桌面图标使用边长 1 至 2,048 像素、文件大小不超过 8 MiB 的正方形 PNG。版本号为 32 位有符号正整数。每个版本导出到新的目录。

运行 Gradle 前，通过本机凭据管理器或 CI 密钥配置四个环境变量。`EGRET_ANDROID_KEYSTORE` 是外部密钥库的绝对路径，`EGRET_ANDROID_KEY_ALIAS` 指定密钥别名，`EGRET_ANDROID_STORE_PASSWORD` 和 `EGRET_ANDROID_KEY_PASSWORD` 分别用于解锁密钥库和密钥。密钥库及凭据放在生成的工程之外。发行构建启用 R8 优化，并要求提供上述四项配置。调试构建沿用 Android 调试签名。

```sh
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/moon-herbarium --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.herbarium --name "Moon Herbarium" --icon /path/to/icon.png --version-code 1 --version-name 1.0 --out out/herbarium-v1
gradle -p out/herbarium-v1 assembleRelease bundleRelease
```

签名 AAB 位于 `build/outputs/bundle/release/`，APK 位于 `build/outputs/apk/release/`。使用 JDK 的 `jarsigner` 验证 AAB，用 Android Build Tools 的 `apksigner` 验证 APK，并将两份证书与外部密钥的证书比对。APK 可以直接安装。测试 AAB 分包升级时，对每个版本分别运行下面的命令，使用不同的输出文件名。其中 `bundletool` 表示 `java -jar /path/to/bundletool-all-1.18.3.jar`。两个口令文件分别存放密钥库和密钥的密码，只保存在本机。

```sh
bundletool validate --bundle=out/herbarium-v1/build/outputs/bundle/release/EgretGame-release.aab
bundletool build-apks --bundle=out/herbarium-v1/build/outputs/bundle/release/EgretGame-release.aab --output=out/herbarium-v1/game-v1.apks --connected-device --ks=/private/game.jks --ks-key-alias=game --ks-pass=file:/private/store-password --key-pass=file:/private/key-password
bundletool install-apks --apks=out/herbarium-v1/game-v1.apks
```

验证保档升级时，使用通过 `services.storage` 保存进度的游戏（见下文“保存和恢复游戏进度”）。先安装第一版分包，打开游戏并保存进度。沿用游戏资源根目录和应用 ID，指定 `--version-code 2` 和 `--version-name 1.1` 导出第二版。用同一把密钥构建并签名，再把第二版分包覆盖安装到第一版。两次安装之间保留应用及数据，强停并重开后核对已安装版号，再从游戏内读回原进度。[bundletool 本地操作指南](https://developer.android.com/tools/bundletool)

在 Galaxy Z Fold7 上，使用 bundletool 安装 101 版（1.0.1），再覆盖升级到 102 版（1.0.2）。两个版本使用同一张外部测试证书。102 版冷启动后读回了 101 版保存的四步路线和 147 分，存档校验值一致；再走一步，分数增至 168。Android 在升级前后保留了应用 UID 和首次安装时间。[Fold7 覆盖升级记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-local-release.json)

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

## 保存和恢复游戏进度

将游戏服务中的 `storage` 传给已有的 `createSaveStore`。系统 WebView、标准 V8 和裁剪 V8 读写同一份 Android 应用私有文件。应用身份和游戏视图的资源根目录共同决定存档归属，根目录区分大小写。升级游戏或切换宿主时应沿用原目录。同一应用内的两款游戏只要资源根目录不同，就可以分别使用 `progress` 键。清除应用数据会清除本地存档。构建 AAR 和导出游戏时应使用支持存档的版本。在旧 AAR 上首次调用存储操作会得到不支持的错误。

```ts
import { createSaveStore } from '@egret/engine/kit';
import { installPlayerProject } from '@egret/android-player-project';

installPlayerProject({
  width: 360, height: 640, clearColor: 0x18281d,
  create({ storage, state }) {
    const progress = createSaveStore({
      key: 'progress', version: 1, storage,
      defaults: () => ({ level: 1 })
    });
    return {
      input(event) {
        if (event.type === 'up') {
          const saved = progress.save({ level: progress.data.level + 1 });
          state({ checkpointSaved: saved });
        }
      }
    };
  }
});
```

再次启动时用同一个键打开存档。变更数据格式时，提高 `version`，并提供 `migrations[n]` 将第 `n` 版数据转换成第 `n + 1` 版。存档服务会把迁移结果写回，并通过 `onProblem` 报告读写问题。

在视图仍然打开时保存进度。`save()` 返回 `true` 时，新文件已原子替换旧文件。写入失败时返回 `false`，此时内存中仍可能保留新进度。如果 Android 在替换期间强停进程，重开时会读到完整的旧存档或新存档。首次写入在提交前中断时，该存档位仍为空。关闭视图会拒绝新的存档操作，已经接纳的操作结束后才触发 `onClosed`。

单个存档字符串连同存档封装最多为 1 MiB，按 UTF-8 编码计算。底层键长为 1 至 256 个 UTF-16 单元，`createSaveStore` 的键长上限为 200 个单元。存档会同步占用脚本执行时间，适合在关卡完成等进度节点写入。

在 Galaxy Z Fold7 上，同一签名应用依次使用系统 WebView、标准 V8 和裁剪 V8。强停并冷启动后，两款游戏用同一个 `progress` 键各自恢复进度。切换宿主时，游戏 A 的进度从 1 到 2 再到 3，游戏 B 从 10 到 20 再到 30。每个宿主还分别将一份旧存档从 v1 迁移到 v2，重开后均直接读到 v2。三个宿主均完整读回了恰好 1 MiB、含中文和表情的 UTF-8 字符串，超出一个字节的写入被拒绝，旧值保留。

在独立诊断包中，测试让一次真实写入停在临时文件刷盘后、原子替换前。此时强停进程，三个宿主重开后都读到了完整旧存档。在同一时刻关闭游戏视图，已接纳的写入返回成功，原子替换先于 `onClosed` 完成，新进程读回的文件与待提交的新文件逐字节一致。 [Fold7 存档实测记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-saves.json)

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

### Galaxy Z Fold7 上的 WebView 分块交付对照

Android 播放器沿用 WebView 同步取回 Base64 数据块的方式。本轮以 [PR #398](https://github.com/cnedwin/Egret_rebuild/pull/398) 的播放器为基线。三种备选方案都能正确交付字节，但读完整个文件的时间都更长。

测试设备为 Galaxy Z Fold7，运行 Android 17 和系统 WebView 157.0.8103.50。沿用同一份 8,388,645 字节的包内关卡，读取 128 个 64 KiB 整块和一个 37 字节尾块。在两次独立诊断中，每文件 129 次同步取回分别耗时 46.75 和 44.35 ms。Java 侧取出结果连同进入读取器锁，只占 0.187 和 0.194 ms。另一组对照保持调用次数相同，返回实际块长度的字符串比返回四个字符每文件分别多耗 24.7 和 23.8 ms。返回值大小确实影响耗时，Chromium 内部的复制、转换和调度各占多少仍未测出。

每组在同一台手机上用新进程配对，双方 APK 签名相同、关闭调试，游戏脚本一致。每个进程预热三遍，再连续计时九遍，每遍计时到文件末尾，随后逐字节校验。下表取每个进程的中位数，单位为 ms/文件。箭头从该组 #398 基线指向候选方案。

| 候选方案 | 同机配对结果 | 保留原路径的依据 |
| --- | --- | --- |
| 通过窗口消息发送每个 Base64 块 | 102.3 → 158.0、114.1 → 162.6、112.8 → 167.5、112.4 → 195.8 | 全部 129 块都已送达，成功块同步取回降至零。吞吐从 71.05 降至 48.48 MiB/s，配对变化中位数为 −34.0%。独立诊断中，每文件构造消息约用 24 ms，调用 Android 投递约用 58–59 ms。增加的耗时集中在 JS 收到数据之前。 |
| 同步返回每个码元携带一个字节的字符串 | 113.8 → 230.3、111.6 → 234.9 | 全部字节值都正确保留，包括嵌入的零字节。原关卡的同步取回从 50.2 升至 134.9 ms，JS 解码从 10.3 升至 35.6 ms。同大小的高熵文件也从 106.5 升至 275.5 ms。 |
| 每条流移交一个专用消息端口 | 117.3 → 148.9、106.0 → 167.4 | 每个文件只移交一次端口，随后发送 129 个数据块，省去了逐块附加请求编号的开销。两种运行顺序下的吞吐仍分别下降 21.2% 和 36.7%。 |

只有窗口消息方案继续做了完整的内存和生命周期对照。两个版本各做两次独立内存采集，每次连续读 96 遍，只保留当前块。应用进程 PSS 采样峰值从 204,072 升至 231,749 KiB，WebView 渲染进程从 67,918 升至 168,191 KiB。两个进程分别采样，各自峰值可能出现在不同时刻。

两个版本均在已读 73,728 字节时分别验证了取消和关闭视图，每次文件流都恰好关闭一次。重试与重开均读回完整文件，首次打开和重开后的画面分别核对 2,073,600 个像素，差异为零。标准 V8 和裁剪 V8 沿用 #398 的真机结果。[三个宿主的基线测量](https://github.com/cnedwin/Egret_rebuild/blob/c9b3db2502eb9c311ab8108d1ac324b64eb9db2f/runtime-sdk/measurements/fold7-project-chunk-throughput.json)

## 接入已有 Activity

将 AAR 放入应用模块的 `libs/egret-player.aar`，在 Gradle 依赖中加入 `implementation files('libs/egret-player.aar')`。把资源导出到该模块 assets 下的新目录。将下例路径替换为自己的游戏、打包器和应用模块路径。

```sh
node runtime-sdk/android/player/export-project.mjs --project /projects/my-game --esbuild /path/to/node_modules/esbuild --out /projects/my-app/app/src/main/assets/game
```

在主线程上创建 `new org.egret.runtime.player.EgretPlayerView(activity, "game", listener)` 并加入布局。将 Activity 的 `onResume()`、`onPause()` 转发给视图。退出游戏时调用 `close()`，等 `listener.onClosed()` 到达后再创建新视图。`onReady()` 表示首次原生绘制已成功提交，`onError(String)` 报告错误，`onState(String)` 接收游戏主动发送的 JSON。`getDiagnostics()` 提供会话统计和项目关闭回执。完整的两种 Activity 示例位于 `runtime-sdk/android/player/consumers/`。

## 支持的画面和验证范围

播放器按捕获顺序绘制矩形、贴图四边形和带索引的网格。每帧最多 4,096 条绘制命令，命令包最多 360,472 字节。原生执行器在线性光空间按预乘透明度合成，再转换为显示用 sRGB。视图适配不透明逻辑舞台，并将输入映射回舞台坐标。该命令接口支持仿射变换、轴对齐矩形裁剪的交集、普通透明度合成、正片叠底和加法累积，以及第零级纹理的最近邻和线性采样。离屏特效、旋转裁剪和通用透明度遮罩仍待支持。

### 带索引的纹理网格

用已有纹理租约和三角形索引创建 `Mesh2D`，通过位图使用的同一个接口发布图集页。角色变形时可以替换绑定的几何数据，让纹理页继续驻留。网格与前后 UI 的绘制次序取自显示树。网格支持 [0,1] 范围内的归一化 UV 和逐顶点亮色，材质层的亮色与暗色沿用中性默认值。按纹理视图采样时支持图集子区域、透明裁边和直角旋转。采用整页采样的网格始终以完整纹理页解释 UV，即使绑定的是裁剪后的视图。

含普通中性颜色、最近邻采样网格的帧使用 EGR4。EGR5 在相同记录结构上增加了投影所需的混合、加法混合、线性过滤、逐顶点亮色和引擎持有的纯白矢量填充纹理。每个网格携带变换后的位置、UV 和本地三角形索引。原生播放器将索引提交给 GLES3，沿用已有的裁剪、合成和纹理页生命周期。绘制前会检查索引范围、纹理页是否驻留以及命令包大小。请使用同一版源码构建 AAR 并导出网格游戏。同一份录制可以交替包含 EGR2 至 EGR5 帧。

[Kite Courier 示例](https://github.com/cnedwin/Egret_rebuild/tree/main/runtime-sdk/examples/indexed-mesh)从两张图集分别取出一个九顶点网格。一条 UI 横栏穿过斗篷、被面部遮住，另一条盖在面部前方。Fold7 上的 210 次提交覆盖 17 个不同姿势。三个脚本宿主录出的命令带逐字节相同，原生命令回放使用 WebView 的录制。

| Fold7 执行路径 | 每帧跨 JS 桥命令量 | UI 线程提交回调间隔 p95 |
| --- | ---: | ---: |
| 系统 WebView | 948 字节（237 个 32 位字） | 8.882 ms |
| 标准 V8 | 948 字节 | 8.898 ms |
| 裁剪 V8 | 948 字节 | 8.955 ms |
| 原生命令回放 | 0 字节 | 8.773 ms |

四路交给 GLES3 的命令包均为 948 字节。跨桥字节数只计命令数据，纹理首次上传和传输开销另计。各路径启动四次独立进程，每次预热 30 帧，随后记录 Android UI 线程接收到相邻两次原生提交成功回调的间隔，共 180 个样本。表中取四次 p95 的中位数。GPU 完成和屏幕呈现时间尚未测量。

在末姿势，四路在 EGL 上下文重建前后的 1080 × 1920 全幅画面逐像素相同。与独立 CPU 光栅参考比较，远离颜色分界的 2,030,094 个像素全部吻合。剩余区域有 22 个像素与同一网格内的相邻纹素同色，21 个像素与轮廓处的相邻图层同色。这 43 个像素均能在各自的期望 3 × 3 邻域找到相同颜色。每路在两代上下文中各上传两页，关闭时累计释放四次。三个游戏会话各释放两份逻辑纹理，回放释放命令带。[Fold7 测量记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-indexed-mesh.json)

### 导入超过 1 MiB 的包内 GLB

`services.loadGlb(path, { firstPage, signal, onProgress })` 可选择报告已复制的字节数和从有效 GLB 头部读出的文件总长。每块复制完成后同步调用回调。在回调中取消信号，读取器会在请求下一块之前关闭。回调抛出异常时，本次导入会以该异常拒绝并释放读取器。字节复制完成后还需解码 glTF、发布贴图页，使用场景前应等待返回的 Promise 完成。

Terraced Hills 示例使用 27,225 个带法线和 UV 的顶点、53,792 个有索引的三角形和现有披风纹理，生成 1,195,336 字节的地形 GLB。首次导入在已读 131,072 字节时取消。重试沿用同一路径和贴图页编号。点击地形将其释放，再点一次重新加载，最后按 **Close game** 查看资源回收读数。

```sh
node runtime-sdk/examples/terrain-glb/prepare.mjs out/terrain-game
node runtime-sdk/android/player/create-app.mjs --project out/terrain-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.terrain --layout embedded --out out/terrain-app
gradle -p out/terrain-app assembleRelease
node --test runtime-sdk/project/large-glb.test.mjs
```

使用裁剪 V8 的 arm64 AAR，并按上文配置外部测试签名。设备安装运行后，用 `adb shell dumpsys activity org.example.terrain/org.egret.example.LibraryActivity` 查看播放器计数。关闭视图后，`projectClose` 给出 `canceledAt`、`loadedBytes`、`imports`、`retirements` 和 `pagesReleased`。

Fold7 两次完整导入均读完模型。卸载模型时，649,904 个取样像素中有 218,886 个明显变化；重载后与原画面逐像素一致。关闭后两次页发布都已归还，驻留页为零。《风雪山神庙》角色、光照和帧呈现的同机对照见[草料场光照](#草料场光照)。[真机记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-terrain-glb.json)

### 在 Android 上驾驶带贴图的 GLB 赛车

《锦绣飞车》的 Android 本地导出沿用原作单圈赛、八车模拟和赛道。熊猫团团的车身及坐姿车手来自游戏原有的两个 GLB，各自内嵌一张 768 × 768 的 JPEG。比赛规则、模型装配和赛道数据取自固定的游戏版本。[浏览器试玩](https://cnedwin.github.io/PortedGamesEgret/Rally/) · [游戏源码与美术说明](https://github.com/cnedwin/PortedGamesEgret/tree/ce6144533b890be992bea9eb09cb344457f8364c/Rally)

先按本文步骤构建引擎和裁剪 V8 的 AAR，再准备 PortedGamesEgret 的 `ce6144533b890be992bea9eb09cb344457f8364c` 版本及两个新的输出目录。导出工具先核对输入文件，再将游戏文件复制到本地工程。引擎仓库提供适配代码，游戏源码、素材和随附说明均取自游戏仓库。

```sh
node runtime-sdk/examples/rally/prepare.mjs /path/to/PortedGamesEgret/Rally out/rally-game
node runtime-sdk/android/player/create-app.mjs --project out/rally-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.rally --name Rally --out out/rally-app
gradle -p out/rally-app assembleRelease
```

在 World3D 工程中，将 GLB 加入 `project.json` 的 assets，再调用 `await services.loadGlb('panda-kart.glb', { firstPage: 1 })`，把返回的 `scene` 加入游戏场景。从指定编号起，为每张不同的图片预留一个空闲纹理页。加载器沿用可取消的分块读取，Android 直接从清单声明的 APK 资源解码内嵌 JPEG 和 PNG，再交给现有纹理页管理。3D 材质按第一套 UV 坐标取样，支持 sRGB、重复平铺、线性过滤和多级纹理。EGL 上下文变化后可从原页重新上传。可调用 `asset.dispose()` 提前回收，或交由项目作用域统一释放。读取失败或纹理页编号冲突时，原有资源仍然有效。

仅熊猫车身和车手的索引几何数据合计就有 531,520 字节，因此 E3D2 纹理帧设有 2 MiB 上限，随帧携带可见网格，并按编号引用纹理页。原有 2D 和 Roll3D 的命令包上限仍为 360,472 字节。

浏览器加载十二个赛道 GLB。Android 版本直接读取其中用于玩家的两个，保留其网格、UV 和内嵌图片原始字节，按原作函数装配。低细节视图保留可驾驶的赛道及高差、发车位、桥梁、障碍、拾取物和对手。路面、远景、植被、看台、特效及 HUD 的表现有所简化。音频、水面反射和浏览器完整美术资源未纳入本次验收。

首个真机包在第一次触及驾驶控件之前就开始加速，进入开场赛段后还出现过绘制中断。输入适配现已与浏览器一致，等待首次驾驶触控后才开启自动油门。编码器现分别报告字节上限与几何数量上限。离线扫描在原有弯道分块上复现了 64 个几何对象的限制，随后合并了静态道路和地形分块。保留两项上限后，新布局在 3,030 个视角中最多使用 50 个不同几何对象。这里的数据来自离线诊断，以下呈现帧间隔取自单独的真机采集。

在同一台 Galaxy Z Fold7 上，熊猫团团以相同发车顺序、种子 7 参加「闲庭信步」单圈赛。两端均通过游戏本身的触控操作驶完 1,817.51 米，到达八车成绩界面，获得第八名、十枚金币。浏览器用时 1:49.18，签名 APK 用时 1:46.25。两圈由工具分别操控，转向输入的时机有所不同。

| 行驶窗口 | Chrome WebGL2，间隔数 / p95 | 裁剪 V8 与 GLES3，间隔数 / p95 |
| --- | ---: | ---: |
| A | 380 / 16.581 毫秒 | 369 / 16.582 毫秒 |
| B | 373 / 16.581 毫秒 | 368 / 16.581 毫秒 |

两端渲染缓冲均为 873 × 325，实际呈现节奏为 60 Hz。测量的是游戏图层相邻两次呈现的时间间隔。浏览器最长间隔为 16.583 毫秒，APK 最长为 33.159 毫秒，四个计时窗口均未出现达到 34 毫秒的间隔。两端场景的装饰绘制量不同，本轮没有测量 GPU 执行时间、功耗或长时温控。[Fold7 赛果、画面对照与帧时数据](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-glb.json)

在双方发车位静止画面上，都可以辨认熊猫的黑白花色、绿竹和黄色车身。四个预先选定的局部色区中，颜色覆盖率差值最大为 1.17 个百分点。浏览器另外绘制了独立的车尾徽章。在同一 APK 的另一轮测试中，关闭 Android 游戏界面后读回 23 次纹理页发布、23 次释放。重新打开后回到准备界面。

### 在 Android 上驱动林冲的原模型

《风雪山神庙》角色示例沿用原游戏的规则和姿态代码，驱动林冲的 47 个关节。GLB 含两个蒙皮网格，没有内嵌动画片段。衣甲使用底色、金属度与粗糙度、法线三张贴图，手部使用顶点色。原作长枪随动作移动，枪尖在出枪时发亮。准备工具核对游戏输入并打包所需的来源说明，游戏文件从单独提供的游戏仓库读取。[游戏源码与素材说明](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

按上文构建裁剪 V8 的 AAR 并配置本地发行签名。准备工具会生成一个新目录，用 HTTP 提供该目录后，打开 `browser.html` 即可对照浏览器画面。两端顶部的三个按钮可将动作分别停在同一待机、迈步和出枪时刻。按住左下方可行走，按右下方可出枪。

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple
node runtime-sdk/android/player/create-app.mjs --project out/snowtemple --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.snowtemple --name SnowTemple --out out/snowtemple-app
gradle -p out/snowtemple-app assembleRelease
```

通过 `services.loadGlb` 加载模型，纹理页随游戏的资源作用域回收。GLES3 播放器保留顶点位置、索引、关节编号和权重。上一帧绘制成功后，使用同一副骨架的网格每帧共享一份骨骼矩阵。恢复用的完整帧同时携带网格定义。底色按 sRGB 采样，法线、绿色通道的粗糙度与蓝色通道的金属度按线性数据采样。这条路径支持不透明的带索引标准材质网格、每顶点四个骨骼权重，以及每副骨架最多 56 个关节。 法线贴图使用从 UV 坐标求出的切线；网格若自带切线并使用法线贴图，编码器会明确报错。

在一台 Galaxy Z Fold7 上，浏览器和 APK 三个动作检查点的骨骼矩阵摘要均相同。首次完整帧为 1,856,976 字节。实测 1,483 个增量帧，每帧 7,716 字节，其中骨骼矩阵占 3,008 字节，几何定义为零。从后台返回时 GLES 上下文完成重建，待机舞台与切后台前逐像素一致。关闭后，项目归还了全部八个纹理页。[真机数据与画面对照方法](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-skinned-character.json)

### 在草料场与刀手交战

先准备一份本地交战示例，再按上文构建签名 Release APK，或用 HTTP 提供输出目录并打开 `browser.html`。省略 `--yard` 会生成单角色示例。两端使用相同的角色、兵器及原作的移动、敌人 AI 和命中规则。开局时林冲与一名刀手相距六米。按住左下方走近，点击右下方出枪。命中后画面停在落点，方便核对；再次点击攻击即可继续。

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-yard --yard
```

当可见蒙皮几何会使完整帧超过 2 MiB 时，播放器将完整网格定义分批发送。每个几何包和每个绘制包都保持在 2 MiB 以内。整批数据绑定到同一个设备上下文代际和逻辑帧，GLES 在绘制两名角色前先准备所需几何。后续绘制引用驻留网格，更新姿态、变换、材质和界面。上下文重建时，播放器先重新上传该帧所需几何，再显示恢复的战斗画面。

这条路径最多支持 64 份可见几何，编码后的网格定义合计上限为 16 MiB。替换时，暂存定义与正在显示的一代数据可同时占用 CPU 和 GPU 内存。旧 E3D1–6 帧继续兼容。新分批协议的发送端和接收端都须支持 E3G1 几何包和 E3D7 绘制包。单份网格定义连同包头必须装入 2 MiB，较大的单个网格须在制作时拆分。录像器继续支持已有帧格式，遇到分批场景会明确报告当前格式尚不支持录像。

在同一台 Galaxy Z Fold7 上注入触控后，浏览器版和裁剪 V8 签名 APK 均在模拟第 101 步和第 128 步出枪命中，刀手血量依次从 84 降到 71、56。首次加载时，八份网格定义分两包传输，分别为 2,001,236 和 1,540,608 字节。每次 GLES 上下文重建后各重传一次，两段连续交战期间的几何传输均为零。切后台后两端均保留姿态与血量，在命中前和受击时各自恢复的 3D 画面都与切出前逐像素一致。最终 APK 两次恢复场景，两段交战分别收到 298 和 335 个绘制包。关闭时三个 GLES 上下文累计 66 次纹理上传均有对应释放，22 个项目纹理页全部归还。[Fold7 实测记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-yard-encounter.json)

### 打完草料场首战

下面的命令会生成浏览器和 Android 共用的双角色工程。用 HTTP 提供输出目录并打开 `browser.html` 可运行 WebGL2 对照页，也可以按上文用同一目录构建 Release APK。

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-duel --duel
node out/snowtemple-duel/check-duel.mjs
```

按住左侧按钮走近。轻点右侧按钮会靠近枪距并尝试刺一枪，按住则连续出枪。开战后松开双手，刀手仍会继续进攻。每次命中都会更新界面，战斗继续进行。刀手触发原作的 `death` 事件时林冲获胜，林冲触发 `fall` 时刀手获胜。最后一击结算胜负后，场景继续推进 45 个模拟步，让败者倒地，然后定格。点击「Restart」可恢复双方初始位置和血量，清空上一场的输入与命中记录。逐击查看姿态仍可使用 `--yard`。[原作规则与素材](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

在同一台 Galaxy Z Fold7 上注入触控，Chrome WebGL2 和裁剪 V8 + GLES3 签名 APK 的两条路线逐次扣血一致。按住出枪，林冲以六枪取胜。重开后轻点一次，刀手中枪剩 71 点血，随即反击。第一刀将林冲从 120 点血打到 109，第十一刀使他倒地。两种结局都显示败者的倒地姿态。败北后再次重开，第三局轻点出枪仍能将刀手从 84 血打到 71。本次沿用 #453 记录的同场景几何驻留与上下文恢复证据。[Fold7 实测记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-duel.json)

### 按章节顺序迎战草料场两队敌人

使用章节模式可连续打两场。用 HTTP 提供生成的目录并打开 `browser.html` 即可运行浏览器版，也可以将同一目录交给 Android 项目播放器构建裁剪 V8 的 Release APK。

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-parties --encounters
node out/snowtemple-parties/check-encounters.mjs
```

点击 **Fight party** 会追击并连续攻击当前一队，**Single thrust** 会靠近后出一枪，**Stand** 停止主动攻击。首队由两名刀手和一名弓手组成。拾取的残页展开时，从画面上的三个选项中选一项即可继续。首队倒下后，原作章节规则会派出一名盾手、一名刀手和两名弓手。两场共用同一局游戏，保留林冲的血量、位置和背包，可继续用相同按钮迎敌。点击 **Restart** 会从首队重新开局。[原作](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

在同一台 Galaxy Z Fold7 上，Chrome WebGL2 和裁剪 V8 + GLES3 签名 APK 使用相同的触控操作。林冲保留 104 点血和已选能力进入第二场，预先点下的一枪命中弓手（58 → 45 血）。两端直到林冲落败的逐次扣血相同，重开后的第一枪也一致。440,900 字节的藤牌通过包内分块接口读取。几何驻留和上下文恢复沿用此前同机记录。[Fold7 实测](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-yard-parties.json)

### 从草料场走到陆谦面前

同一份准备好的工程可以在浏览器中打开 `browser.html`，也可以交给 Android 项目播放器打包。准备工具校验原作资源，从本地工程读入陆谦的蒙皮模型、长刀和对白。示例以简化的草料场、院门和前庭呈现场景，会面以字幕呈现。[原作与素材说明](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-gate --temple-gate
node out/snowtemple-gate/check-temple-gate.mjs
```

点击 **Advance & fight** 后，林冲会靠近敌人并出枪。残页出现时，选一项招式即可继续。第二队全灭后院门才会打开。林冲还要走过门廊，活着进入前庭，身后的屏障才会关闭，陆谦才会开口。两场战斗和会面沿用同一局游戏，保留血量、招式、背包和场内掉落。也可以用原有的 `--encounters` 入口单独玩草料场。

同一台 Galaxy Z Fold7 上，Chrome WebGL2 和裁剪 V8 + GLES3 签名 APK 使用相同的触控操作。两队清场时林冲剩 120 血、99 枚铜钱，保留「借力」。第 2328 个模拟步开启院门。途中拾取铜钱，入院时为 120 血、103 枚铜钱。越过门槛后，身后的屏障关闭，炉边检查点继续生效，触发陆谦的 5.2 秒会面。恢复交战后的首枪使陆谦从 980 血降至 967 血，两端截至这一枪的 41 条伤害记录逐条一致。 Fold7 这条路线没有拾取第二本残页，而 Windows Node 规则回放拾取了它。验收按每局实际出现的选项核对。 [Fold7 真机记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-temple-gate.json)

### 草料场光照

这个场景可以查看林冲的蒙皮模型如何投下月影，以及一次实际命中怎样照亮附近地面。原作固定在 `4172514ea4369fd9aaf433403423340e8db072ee`。准备工具从单独提供的游戏工程校验并提取推车、火盆和可玩路线上的地形，沿用院门示例的五个角色 GLB、战斗规则及素材署名。[原作和素材说明](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

用同一份引擎源码构建浏览器模块和 arm64 AAR，按上文配置外部签名，所有输出均使用新目录。第二条准备命令生成一份使用本次引擎构建的浏览器版本，`out/snow-lit/browser.html` 则保留游戏自带的浏览器参考版本。

```sh
pnpm run build
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snow-lit --lit-temple
node runtime-sdk/examples/snowtemple/prepare-matched-browser.mjs out/snow-lit out/snow-matched
node runtime-sdk/android/player/create-app.mjs --project out/snow-matched --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.snowyard --layout standalone --out out/snow-app
gradle -p out/snow-app assembleRelease
python -m http.server 8000 --bind 127.0.0.1 --directory out/snow-matched
```

启动静态服务后，执行 `adb reverse tcp:8000 tcp:8000`，用手机 Chrome 打开 `http://127.0.0.1:8000/browser.html`，并在同一手机安装 `out/snow-app/build/outputs/apk/release/` 下的 APK。两端各开一局，依次点 **Before hit**、**Hit/step**。模拟从第 422 步走到 423 步，林冲打出 13 点伤害，刀手剩余 71 点血。分别切换 **Shadows** 和 **Hit light**，每次都先恢复再对照下一项。点 **Play** 继续交战。

要启用中档月影，在 `world3D()` 中返回 `{scene, camera, shadows: {mapSize: 1024}}`，为方向光和投影网格开启 `castShadow`，为受影网格开启 `receiveShadow`。场景使用环境光、半球光、指数雾、邻近的六盏场景灯和最多两盏短暂的命中点光。非火焰命中还会使目标材质短暂变亮。该原生档位支持一张方向光阴影贴图和最多八盏直射点光。地形保留原始顶点位置、法线和顶点色，使用标准材质。此次对照未覆盖原作地面微纹理着色器、冲击环、飞散碎片、天气和屏幕后处理。

Galaxy Z Fold7 上使用 768 × 432 画面，浏览器和 APK 停在同一次命中，骨骼矩阵哈希均为 `bb05cf67`。保留月光照明、只关闭阴影时，角色脚边区域共 5,687 个像素，Chrome WebGL2 有 1,391 个变亮，裁剪 V8／GLES3 有 1,371 个变亮。开启命中点光时，命中区域共 11,340 个像素，Chrome 有 10,769 个变亮，APK 有 10,665 个变亮。计数要求至少一个 RGB 通道变化达到 3/255。分别恢复两个开关后，两端各自场景区域的 191,521 个像素都与切换前完全一致。APK 切后台再返回，该区域也逐像素恢复。[Fold7 实测、取样区域和计时口径](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-lit-yard.json)

在 Fold7 上，原生进程启动后 539–915 ms 首次看见游戏画面。Chrome 保持运行并关闭 HTTP 缓存后，从页面导航到看见同一场景为 2,752–3,168 ms。时间范围由手机合成器截图确定，连续两次匹配可玩画面才计入。

预热 30 帧后，原生播放器采集了 180 个交战样本。V8 生成命令、复制命令包和 GLES 绘制调用的 CPU 耗时 p95 分别为 2.947、0.201 和 0.860 ms。Chrome WebGL2 的游戏更新和绘制调用 p95 分别为 1.0 和 1.6 ms，浏览器直接调用 WebGL。按 SurfaceFlinger 的实际呈现时间计算，APK 的帧间隔 p95 为 8.288 ms（178 个间隔），Chrome 为 16.578 ms（220 个间隔）。本次未取得独立的 GPU 执行耗时。两端的启动条件与采样窗口见上方实测记录。

| 脚本宿主 | 已签名的 arm64 Release APK | 播放器 AAR |
| --- | ---: | ---: |
| 系统 WebView | 5,695,551 字节（5.43 MiB） | 819,876 字节 |
| 裁剪 V8 | 68,336,517 字节（65.17 MiB） | 17,611,005 字节 |

两个 APK 使用相同的游戏脚本和本地测试签名。希望各机型使用固定 JavaScript 运行时的游戏可以随包提供裁剪 V8。优先控制下载体积时，可在目标机型常用的 WebView 版本上验证游戏后选择系统 WebView。两种脚本宿主均通过 Rust／GLES3 绘制。上文的 Fold7 画面对照使用裁剪 V8 APK 和 Chrome WebGL2。[宿主选型和 Android 系统要求](android-project-player-v8.md)

### Android 实时帧的几何驻留

游戏包和播放器均采用此版本构建时，裁剪 V8 和 WebView 工程宿主都可使用同一套 World3D 增量协议。搭配旧版宿主或游戏包时仍发送完整帧。完整帧 E3D1 或 E3D2 包含全部可见网格的定义。GL 线程确认上一帧在同一代 EGL 上下文中成功提交后，E3D3 或 E3D4 即可按编号引用这些网格。每帧仍传送当前相机、光照、有序绘制记录、材质和纹理引用，以及完整的 2D HUD。只有新增或改变的网格需要传输定义。仅移动镜头且可见网格集合不变时，几何部分的每帧桥接字节为零。

网格离开可见集合后，播放器在该帧成功提交时释放它，再次进入时重发定义。修改几何或顶点布局时沿用引擎的属性和布局版本。替换网格须等 3D 场景、HUD 及最终颜色输出全部提交成功后才生效。增量帧仍受 64 个几何对象以及展开为完整帧后的字节上限约束。

新建 EGL 上下文时，播放器从完整帧重建几何和纹理页。同一代上下文中若接收端失去上一帧，宿主会按原绘制列表、HUD 和纹理快照重建被拒帧，以同一帧号重试，游戏逻辑仅推进一次。录像将首帧和末帧保存为可独立绘制的完整帧，中间保存成功提交的命令，包括对已驻留几何的引用。实时基准也保留完整末帧。

在 Galaxy Z Fold7 上进行了四组成对测试。两版均使用裁剪 V8 的签名 Release APK、相同的采集探针以及 873 × 325 的 GLES3 渲染缓冲。《锦绣飞车》的两份带贴图 GLB 随八辆车停在发车位，只有相机移动。1,440 个采样帧的可见绘制列表均为 1,332 条。下表的耗时取每版四轮 p95 的中位数。

| 指标 | 完整帧 | 增量帧 |
| --- | ---: | ---: |
| 稳态每帧几何字节，含定义头 | 918,648 | 0 |
| 稳态每帧桥接总字节 | 1,047,640 | 128,996 |
| V8 到 Java 复制 p95 | 1.800 ms | 0.397 ms |
| 派发到渲染入队 p95 | 8.048 ms | 6.584 ms |
| 原生绘制的 CPU 提交 p95 | 4.921 ms | 3.478 ms |
| 游戏图层呈现帧间隔 p95 | 16.58 ms | 16.58 ms |

四组的复制和提交耗时均下降，屏幕呈现节奏持平。两版均驻留 40 个网格，CPU 副本和 GLES 缓冲的顶点及索引有效载荷各为 918,168 字节。进程 PSS 的变化方向不一致。EGL 重建后的首帧重新发送了 40 份几何定义，游戏画面在两个版本之间、恢复前后均逐像素一致。两版各自的恢复和关闭测试都记录到网格创建和删除各 80 次、纹理页上传和释放各 10 次。这次早期测试验证了 EGL 重建。如果将 210 帧逐帧完整存储，文件会超出 64 MiB 上限。[成对测量及采集方法](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-geometry-residency.json)

### 录制和回放《锦绣飞车》的发车位场景

在 Galaxy Z Fold7 上，裁剪 V8 录下了八车发车位的 210 个逻辑帧，包含两份带贴图的 GLB，镜头持续移动。随后冷启动独立进程，从已校验的落盘文件直接通过 GLES3 回放，全程未启动脚本虚拟机。录像含 5 个纹理页版本，共 **33,705,061 字节（32.14 MiB）**。第 0、209 帧为完整帧，中间 208 帧复用几何。若将 210 帧的命令逐一展开，仅命令数据就有 220,004,400 字节，另须计入纹理页和文件元数据。

逐帧比较显示，回放与录制的 873 × 325 RGBA 画面、每帧 1,332 次 World3D 绘制的顺序以及 HUD 命令字节均一致。在另一次回放中，Android 在第 90 帧提交期间重建了 EGL。播放器以完整帧重新提交第 90 帧，继续播至第 209 帧。停在末帧后重建 EGL 的单独测试也恢复了相同画面。每次经过恢复的会话在关闭时均记录到网格创建和删除各 80 次、纹理页上传和释放各 10 次。

关闭像素读回和顺序哈希后，三次冷启动回放的游戏图层呈现帧间隔 p95 分别为 **16.581、16.582、16.579 ms**；对应的提交回调间隔 p95 为 **19.456、20.107、20.176 ms**。这些数据覆盖同一台手机上的发车位片段。[Fold7 录像、绘制顺序、恢复和帧时记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-resident-tape.json)

### 录制《锦绣飞车》的静止起步

裁剪 V8 在 Galaxy Z Fold7 上录制了 210 帧，使用游戏原有的八车比赛模拟、跟随镜头和两个带贴图的熊猫模型。录像开始时八辆车均静止。第 14 帧亮绿灯，七辆 AI 赛车起步。第 16 帧，自动化输入按下右转，启用游戏原有的自动油门，随后又完成左转和右转。玩家车辆首末位置的地面直线距离为 15.14 米。帧号从 0 开始，比赛按每秒 120 个逻辑步推进。

| 指标 | Fold7 实测 |
|---|---|
| Android 播放器实际收到的 V8 帧命令 | 29,984,264 字节，其中绘制矩阵占 17,923,648 字节。录像文件还保存了 4,911,392 字节的 RGBA 纹理页。 |
| 几何复用 | 首末完整命令分别包含 918,648 和 910,756 字节的几何定义。208 个增量帧中，202 帧没有发送几何定义。其余 6 帧共发送 64,836 字节，对应 4 个首次可见、3 个重新进入视野的几何对象。各增量帧均复用连续驻留的几何。 |
| 录像大小 | 34,899,699 字节（33.28 MiB），包含 37 个纹理页版本，在 64 MiB 上限内。 |
| 三次冷启动原生回放的 p95 | 游戏图层呈现间隔分别为 16.580、16.581、16.582 ms，提交回调间隔分别为 20.400、20.624、19.656 ms。已签名的可调试 APK 请求 60 Hz，计时期间关闭了像素读回和绘制顺序哈希。 |

每辆车各选一个车身部件，210 帧都能在实际绘制列表中找到对应的世界矩阵。七辆对手车的取样部件共用同一个几何。车辆转向和移动时，各部件的几何内容及材质保持一致。原生回放的 210 幅 RGBA 画面、HUD 和 280,057 次 World3D 索引绘制的顺序均与录制一致。回放中途重建 EGL 后，播放器从第 101 帧的完整命令恢复并播至第 209 帧，停留在末帧时也能恢复画面。六轮关闭后，网格和纹理页的创建、释放计数均相符，驻留几何数据为零。本次数据覆盖这台手机上的起步驾驶片段。[Fold7 录像、桥接和回放测量记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-driving-replay.json)

### 在 Android 原生播放器游玩 Roll3D

滚动红球收齐四颗星，其中一颗需要跳上高台。每收一颗，2D 计分都会更新；结算后点击 **Play again** 即可重开。Android 导出工具读取原有关卡并绑定原生宿主，两端共用移动、碰撞、跟随镜头、星星旋转、拾取粒子和重开逻辑。[浏览器原版关卡](https://github.com/cnedwin/Egret_rebuild/blob/dfc3a00010e9e9e9d4fa26c4a3f5a42a82d92b82/examples/play/roll3d.mjs)

先构建仓库，用两个新目录分别放置游戏和 Android 工程，按前文准备裁剪 V8 AAR 和外部签名。

```sh
node runtime-sdk/examples/roll3d/prepare.mjs out/roll3d-game
node runtime-sdk/android/player/create-app.mjs --project out/roll3d-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.roll3d --name Roll3D --out out/roll3d-app
gradle -p out/roll3d-app assembleRelease
```

游戏从 `@egret/android-player-world3d` 导入 `installWorld3DPlayerProject`，在返回的游戏对象中实现 `world3D()`，每次更新后提供当前的 `{scene, camera}`。计分和按钮仍是播放器舞台上的 2D 显示对象。World3D 按相机生成可见绘制列表，E3D1 命令包携带顶点、法线、索引、变换、标准材质参数、相机和光照，末尾附上原有的透明 2D 帧。GLES3 先通过深度测试绘制场景，再叠加 HUD。同一上下文中，多个物体可共享已驻留且内容未变的几何缓冲；完整 E3D1 命令包保留了在新上下文回放所需的几何数据。

本次采用游戏的低画质设置，支持不透明、正面、无贴图的标准材质、带索引三角形、环境光、半球光、一盏方向光和曝光为 1 的 ACES 色调映射。采样时关闭了阴影、多重采样和后处理，已有 2D 入口继续输出 EGR 帧。[Fold7 真机记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-roll3d.json)

首个 APK 在 16:9 舞台上仍使用默认相机宽高比 1，红球被横向拉宽，高台向右偏移。播放器现于视锥裁剪和绘制采集之前按舞台尺寸更新相机。在同一台 Fold7 上复验，开场 12 个布景和物体取样点的 RGB 各通道最大差均在 1/255 以内。红球、高台和最前方的星星在各自取样区域内的颜色轮廓交并比分别为 95.3%、98.5% 和 97.0%。文字排版和转动边缘与这些布景取样分别核对。

在 Fold7 上，两端都通过触控收齐了四颗星，包括跳上高台取得的那一颗。两端都显示胜利界面，点击重开后计分回到 0/4。触控事件由工具注入真机，Android 使用本地签名的 arm64 Release APK。帧时在另外一轮采集，按 Android 合成器实际呈现相邻两帧的间隔计算。两段移动负载都交替短按左右方向。

| 呈现帧间隔 p95（毫秒） | 静止 | 移动 A | 移动 B |
| --- | ---: | ---: | ---: |
| Chrome，WebGL2 | 16.581 | 16.579 | 16.582 |
| Android，裁剪 V8 和 GLES3 | 16.578 | 16.580 | 16.582 |

两端的 3D 缓冲均为 578 × 325，实际显示节奏接近 60 Hz。Chrome 使用独立的 1920 × 1080 界面层，本轮 APK 将界面绘入同一个 578 × 325 缓冲。六个短窗口均未出现达到 34 毫秒的帧间隔。另测 APK 默认的 1780 × 1001 表面和 120 Hz 模式，静止时 802 个间隔的 p95 为 8.289 毫秒。本次数据反映这台手机的呈现节奏，GPU 执行耗时、功耗和持续运行温控尚待测量。

### 在 Android 上游玩《灯影·闹天宫》第一幕

浏览器原版固定在 `7b774670`。玩家可以滑动戏单，透过南天门旗帜的缺口看见背景，进入第一幕后可以攻击、跳跃和施放百身术。击退十名天兵并打败哪吒后，游戏进入结算并保存成绩。Android 工程沿用原版规则、Tiled 关卡、Spine 角色动作和存档格式。原生显示树负责戏单和控件排版，滚动列表使用矩形裁剪，固定形状的旗面由三角形绘制。原生标杆静音运行第一幕，浏览器对照未验收声音。[固定版本的游戏源码](https://github.com/cnedwin/PortedGamesEgret/tree/7b774670237666d73247cc793c55530f7f7c1e5f/LanternShadows)

准备与该提交匹配的游戏源码和本地构建的裁剪 V8 AAR。将 JDK 加入命令搜索路径，将游戏导出到新目录，按前文设置外部签名。

```sh
node runtime-sdk/examples/lantern-shadows/prepare.mjs /path/to/PortedGamesEgret/LanternShadows out/lantern-game
node runtime-sdk/android/player/create-app.mjs --project out/lantern-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.lanternshadows --name "Lantern Shadows" --out out/lantern-app
gradle -p out/lantern-app assembleRelease
```

准备工具读取开发者在本地提供的游戏源码和美术，将游戏来源与上游许可声明写入导出工程。分发时请核对游戏和 Spine 的适用授权。[Spine 运行时许可](https://github.com/cnedwin/PortedGamesEgret/tree/7b774670237666d73247cc793c55530f7f7c1e5f/LanternShadows/vendor/%40esotericsoftware__spine-core)

在 Android 17 的 Galaxy Z Fold7 上，Chrome 157（WebGL2）和 arm64 签名 Release APK（裁剪 V8、GLES3）均通过正常控件完成第一幕。浏览器成绩为 C、最高 13 连击，原生版为 B、最高 22 连击。网页重新载入、APK 强行停止后重新启动，各自在戏单读回了与通关时逐字节相同的成绩。两轮操作不同，通关用时是游戏成绩，不能用来比较播放器性能。

同一台手机上，八个预先选定的布景取样点，RGB 各通道最大相差 6/255。悟空待机时三个身体取样点均在预设的 16/255 容差内。两张独立时刻的截图在活动皮影的轮廓处仍有差异。浏览器使用 HTML 戏单，APK 使用原生舞台上的戏单。两者均能在视口内滚动，南天门旗帜的缺口均能透出布景。[真机数据与取样方法](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-lantern-shadows.json)

第二轮保持角色位置与镜头固定，两端各采集 15 张自然待机画面。按游戏时钟区间中点选择最接近的一对（相差 25 毫秒），整个人物的轮廓交并比为 0.869，RGB 最大通道差的 p95 为 61/255。另按上半身轮廓选姿态，再用下半身独立核对，下半身交并比为 0.881，整个人物的通道差 p95 为 52/255。所选截图的采集区间约为 0.9 秒，能辨认相同角色和动作，仍有部分边缘色差未能归因。

本次测量使用的 Release APK 在 Activity 中提供只读观察接口，供采集器查看游戏状态。它读取画面上显示的成绩，操作通过正常触屏控件输入，存档由游戏写入。

随包的 Spine 读取器在不含 ICU 属性表的裁剪 V8 上也能保留 Unicode 补充平面字符、拒绝孤立代理码元。修复前，首轮原生版在脚本解析阶段即停止。

### 打包图集与序列帧

图集和序列动画沿用已有布局。`sourceWidth` 和 `sourceHeight` 描述原始画布，`trimX` 和 `trimY` 指定去掉透明边后图像在画布中的位置，`packedRotation` 接受 0° 或顺时针 90°。如需使用四种直角旋转，可调用 `createTextureView`，将 `quarterTurn` 设为 0、1、2 或 3。游戏按原始逻辑尺寸定位和缩放位图，播放器将裁掉的区域显示为透明，先按最近邻规则选中逻辑纹素，再映射到图集中。这套规则同样适用于镜像和动画换帧。位图四边形采用整页采样时，纹理须覆盖完整页面且未经旋转或去边。

使用这类图集帧时，请用同一版源码构建播放器 AAR 并导出游戏。普通帧继续生成 EGR2 字节。仅含四边形且需要图集映射的帧采用 EGR3，在原有的 64 字节绘制记录之后，为每个需要映射的四边形追加 24 字节，记录绘制序号、逻辑尺寸、裁边偏移和旋转方向。两种命令均复用已上传的纹理，可以交替录制和回放。使用映射四边形的游戏需要支持 EGR3 的播放器。

在 Galaxy Z Fold7 上，测试游戏在同一屏幕位置互换打包图集与独立展开的位图。每个受测脚本宿主的 581,256 对采样像素均一致，覆盖四种旋转、镜像、裁剪和半像素定位。把两种图画在屏幕不同位置时，半像素行的每种旋转各有 18 个采样点不同；互换纹理后，差异仍出现在相同的屏幕位置。记录中另有录制、回放和资源检查结果。[Fold7 图集实测](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-atlas.json)

Rust 单元测试覆盖帧长度与取值检查、纹理标识、透明度转换、裁剪取整和 EGR1 兼容性。JavaScript 测试通过真实 Engine 捕获两张有租约的图像，并改变可见图像集合。Windows 的离屏 EGL 1.5 验证通过 ANGLE SwiftShader 读取一幅测试画面的全部 48 个像素。黑底上 50% 白色得到 RGBA (188,188,188,255)，其上叠加半透明红色纹理得到 (224,137,137,255)，第二张不透明绿色纹理得到 (0,255,0,255)。镜像图集在边界上仍采到自身的纹素，透明清屏得到 (128,0,0,128)。这些像素来自桌面软件渲染器。

2026 年 11 月 19 日，两款 Gradle 应用均在 Galaxy Z Fold7（Android 17、系统 WebView 157、Adreno 830）上运行。两份 APK 中的六个游戏文件和原生渲染库逐字节相同。两种模式下，通过 Android 注入点击完成药方，拖动列表滚动，系统键盘成功弹出，音效播放器启动并释放了一次音效。切到后台再返回，第二个 EGL 上下文恢复了四张纹理页。对照切后台前后的药材列表静态区域，独立版的 152,106 个像素和嵌入版的 103,500 个像素均无变化。宿主关闭游戏时归还了全部 14 份逻辑纹理，保留原生控件，随后成功重新打开游戏。本地调试构建中，AAR 为 701,200 字节，独立 APK 为 1,767,567 字节，宿主 APK 为 1,767,575 字节，均使用设备已有的系统 WebView。本轮覆盖功能及生命周期，未测帧速、实际听感和真人输入法组词。[真机与构建产物记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-player.json)

此前的 EGR1 样板另有带 Intl 和不带 Intl 的 Javet/V8 两种可选构建、冻结命令回放及 Galaxy Z Fold7 的耗时和 PSS 记录。该数据对应原样板及其脚本宿主。上面的实机记录使用当时选定的系统 WebView 版 AAR。[原样板与实机记录](runtime-sdk-v8-fold7.md)

项目适配器、Android 视图、Rust 渲染器和示例游戏均为本项目贡献。AAR 的 `assets/egret-player-licenses/` 包含项目 LICENSE/NOTICE，以及 Rust 标准库、NDK/工具链和 robust-predicates 的许可文件。发布应用时请保留这些文件及游戏自带资源适用的许可声明。

### Android 上的 2D 子树滤镜

原生帧解码器支持 EGR6 时，播放器通过 `services.capabilities.subtreeEffects` 声明能力。滤镜先按显示顺序将子节点绘制到离屏纹理，再将整组结果一次合成到父级。Android 工程播放器支持共享的 4 × 5 颜色矩阵、半径为 0 到 8 个舞台单位的整数模糊、扩散范围最多 16 个舞台单位的发光和描边，以及合成时的矩形裁剪。换算到实际绘制缓冲后，采样核半径上限为 16 像素。全尺寸离屏附件、主画面颜色附件及可选的 World3D 深度附件共用已有的 64 MiB 渲染目标预算。绘制前按最深同时占用的组和临时纹理核算内存。每帧最多八组，最多嵌套四层。

导出游戏时使用同一版原生播放器。普通帧沿用已有编码。较早的播放器会在提交含子树滤镜的帧之前报告能力缺失。旧游戏可能依赖不同的模糊核或 sRGB 混色，需要使用一致的实际绘制分辨率和颜色设置逐屏对照原作。另见[经典项目 Android 指南](classic-game-android.md)。

在相同的 1236 × 824 绘制缓冲和线性混色下，Galaxy Z Fold7 GLES3 与 Windows Edge WebGL2 整幅画面的 RGB 单通道最大差值，单层和嵌套矩阵均为 1/255，半径 5 的模糊为 2/255，扩散范围 7 的发光为 1/255。切后台后 EGL 上下文重新创建，返回时的嵌套画面和重新打开后的普通画面均与各自的原采样点一致。原版 5.3.10 WebGL 在此矩阵上的颜色计算不同。本次未测帧时和内存占用。[Fold7 与 Edge 像素及生命周期记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-subtree-effects.json)
