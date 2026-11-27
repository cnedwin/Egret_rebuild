# 重新构建已迁移的 Android 游戏

[English](../../en/docs/android-migration-build-kit.md) | 简体中文

交接时分别提供可编辑的游戏工程、匹配客户操作系统和处理器的构建工具包，以及可独立维护的 Gradle 应用工程。三者放在不同目录。工具包包含编译后的白鹭模块、2D 和 World3D 播放器适配器、指定的播放器 AAR、导出器与 esbuild 0.28.2。Activity、包名、渠道接入及签名由应用持有。

## 准备工具包

在已构建的引擎工程中使用 Node 26.7.0，指定同一引擎提交构建的播放器 AAR。在交付清单记录引擎提交、AAR 摘要和最终工具清单的摘要。如果游戏需要旧版封包或分块场景模块，加入 `--legacy`，套件将提供 `@egret/legacy/protocol` 与 `@egret/legacy/scene`。游戏使用 Spine 且接收方具备对应分发权利时，增加 `--spine`。

```sh
node runtime-sdk/android/player/pack-build-kit.mjs --esbuild <已安装的esbuild目录> --aar <player.aar> --out <新工具包目录>
```

进入收到的工具包目录，先核对文件，再导出 Gradle 工程。输出放在工具包以外。客户可直接使用此入口，无需检出引擎或安装 npm 依赖。

```sh
node verify-build-kit.mjs
node runtime-sdk/android/player/create-app.mjs --project <可编辑游戏> --aar libs/egret-player.aar --esbuild node_modules/esbuild --id com.example.game --name "示例" --out <新应用目录>
```

构建环境为 Gradle 8.11.1、JDK 17、Android SDK Platform 36 和 Build Tools 35.0.0，设置 `JAVA_HOME` 和 `ANDROID_HOME`。要在空 Gradle 缓存中离线构建，将 `EGRET_ANDROID_MAVEN_REPO` 设为本地 Maven 仓库绝对路径，其中须包含固定版本的插件与依赖。省略变量时沿用默认仓库。单独移交允许分发的依赖和声明文件，或说明客户的获取方式。Release 构建时，将 EGRET_ANDROID_KEYSTORE 设为密钥库的绝对路径，并在构建环境中设置 EGRET_ANDROID_KEY_ALIAS、EGRET_ANDROID_STORE_PASSWORD 和 EGRET_ANDROID_KEY_PASSWORD。[Android 打包与签名](android-project-player.md)

## 保留原生工程，单独迭代游戏

修改游戏后，从工具包运行导出器。它构建游戏并按输出文件树计算 SHA-256，返回不可变的游戏版本目录。保留同一个 Gradle 应用工程及构建目录供后续迭代。

```sh
node runtime-sdk/android/player/stage-revision.mjs --project <可编辑游戏> --store <版本库> --esbuild node_modules/esbuild
node runtime-sdk/android/player/stage-revision.mjs --verify <返回的版本目录>
gradle --offline -p <应用工程> -PegretGameRevision=<返回的版本目录> assembleDebug
```

Gradle 检查版本中的文件，用所选游戏资源生成 APK，并保留应用自己的其他资源。省略该参数可构建原来随工程交付的版本。使用此版本库的所有构建停止后，可用以下命令保留两个已验收版本。要保留其他数量，指定 `--retain-count N`，并为每个版本分别提供一个 `--keep` 摘要。工具先核对候选项，再清理旧的受管目录。请将版本库放在游戏和工具包以外。

```sh
node runtime-sdk/android/player/stage-revision.mjs --prune --store <版本库> --keep <已验收SHA256> --keep <上一版SHA256>
```

## 引入渠道库

把厂商提供的 AAR、JAR 与 JSON 清单放在同一目录，保留文件名大小写，填入已核对的摘要，同时列出需本地提供的间接依赖。在 `create-app.mjs` 后加 `--channel <manifest.json>`。独立工程会在 Gradle 配置时再核对依赖。渠道凭据及签名私钥由运营方保管。

```json
{"schemaVersion":1,"libraries":[{"file":"Channel.jar","sha256":"<64位小写十六进制摘要>"}]}
```

应用在 Activity 中注册提供给游戏的操作。渠道库进入安装包后，还需在对应渠道测试环境验证登录、支付确认、取消、回调及发布配置，才能验收这些功能。

## 一次导出可编辑工程和 APK 构建工具

逐项列出客户编辑和重建所需的文件，包括原工程配置、业务脚本、界面源文件、美术资源、接入层源码，以及有权分发的许可与维护文档。清单中的文件路径相对于游戏源码目录。请列全入口所引用的模块和资源。导出器从已复制的源码重新构建游戏。文件内容与其中可能嵌入的凭据由交付方审定。

```json
{"schemaVersion":1,"application":{"id":"org.example.lantern","name":"Lantern"},"sourceFiles":["project.json","index.html","main.mjs","lantern.png"]}
```

在引擎工程或含移交命令的套件中执行下列命令，传入已验收 `kit.json` 的 SHA-256。导出成功后，一个新目录中会有 `source/` 可编辑工程、`kit/` 工具包、`android/` 独立 Gradle 工程和记录源码摘要的 `handoff.json`。客户可以将三个目录一起搬到自己的机器。签名材料保存在客户自己的签名环境。已有原生集成可通过 `androidFiles` 指定需要保留的 Android 文件，再用 `--android` 提供源目录。例如，列入 `src/main/java/org/egret/example/GameActivity.java` 即可保留 Activity 注册的渠道 SDK。

```sh
node runtime-sdk/android/player/handoff.mjs --project <editable-game> --plan <handoff-plan.json> --kit <accepted-kit> --kit-sha256 <digest> --out <new-delivery>
```

游戏的 tsconfig 可以继承工具包中的 `game-types.json` 并包含游戏源码，从而获得播放器、网络适配器及引擎模块的类型定义。修改 `source/` 后，按上文方法生成游戏资源版本，将结果目录传给 Gradle。连接开发手机时，填写 `adb devices` 显示的序列号。如果 Platform Tools 单独安装，可加 `-PegretAdb=<adb 绝对路径>`。调试任务会覆盖安装同包名、同签名的应用，保留数据并重新启动游戏。Android 会报告已安装 APK 与本次签名不匹配的情况。

```sh
gradle --offline -p <application> -PegretDevice=<serial> -PegretGameRevision=<revision> egretRunDebug
gradle --offline -p <application> -PegretGameRevision=<revision> assembleRelease bundleRelease
```

### 更新已安装的调试应用

首次安装调试 APK 后，在其 Activity 中打开一次游戏。修改业务脚本或资源，生成资源版本，即可把差异内容发到该应用的私有调试目录。工具核对本地版本清单，按 SHA-256 发送新内容，再从选定版本重新启动 Activity。游戏存档会保留。报告中的 `assetBytesSent` 只统计资源内容，`assetTransportBytes` 包含 Windows USB 传输所需的 Base64 编码；清单和激活指令的流量另计。

```sh
node runtime-sdk/android/player/sync-debug.mjs --app ./application --device <序列号> --revision ./revisions/<摘要>
node runtime-sdk/android/player/sync-debug.mjs --app ./application --device <序列号> --embedded
```

第二条命令切回 APK 自带的游戏。如果修改了 Java、渠道库、原生渲染器或播放器 AAR，需要重建调试 APK。关闭调试的发行应用始终读取包内资源。上传过的资源留在设备的应用私有目录内，供后续版本复用。

### 注册厂商 SDK

Activity 提供从操作名到 `ProjectHostServices.Handler` 的映射。每个处理器接收一份 JSON 请求和应答对象。异步操作应返回取消动作，通过 `closeSession()` 解绑厂商监听。已启用网络配置的工程可将相同的映射作为第四个参数交给 `GameNetwork.open(activity, "game", listener, channels)`。交接时换回原 Activity 也要保留这一步。按厂商要求转发生命周期与 Activity 返回结果。

```java
Map<String, ProjectHostServices.Handler> channels = new HashMap<>();
channels.put("channel.locale", (request, reply) -> {
    reply.resolve(JSONObject.quote(Locale.getDefault().toLanguageTag()));
    return null;
});
player = GameNetwork.open(this, "game", listener, channels);
```

游戏通过 `await services.host.call('channel.locale', null, services.signal)` 读取返回值。示例从 Android 获取当前语言。登录、购买、订单确认及凭据由运营方接入其真实 SDK。

## 打包原版白鹭 5.3.x JavaScript 引擎

现有 2D 游戏可以在内置 V8 的播放器中加载原版白鹭引擎、EUI、RES 和业务脚本。原引擎负责类型、事件分发、界面验证、触摸命中和游戏时钟。原生显示绑定将绘制提交给共享播放器和 Rust GLES3 渲染器。重新打开游戏时使用新的原生视图。希望改用白鹭 7 API 的游戏仍可走 `@egret/legacy` 迁移路线。

从旧工程已经发布的 `manifest.json` 和文件开始，保留旧 JS 模块及许可声明。构建配置给出舞台尺寸、入口类、包内资源路径及各 PNG 的解码尺寸。下面是一张图集的示例。

```json
{"entryClass":"Main","width":480,"height":270,"frameRate":30,"assets":["resource/default.res.json"],"images":[{"path":"resource/atlas.png","width":256,"height":128}]}
```

```sh
node verify-build-kit.mjs
node runtime-sdk/android/player/prepare-original5.mjs --source ../published5 --config ../original5.json --out ../prepared-game
node runtime-sdk/android/player/create-app.mjs --project ../prepared-game --aar ./libs/egret-player.aar --esbuild ./node_modules/esbuild --layout embedded --id org.example.originalgame --out ../android-game
gradle --offline -p ../android-game assembleDebug
```

请选择内置 V8 的 AAR。准备工具按原清单顺序逐字节复制引擎和业务 JS。默认首个 `egret.js` 或 `egret.min.js` 是核心，同名的浏览器宿主脚本由原生宿主接管。发布文件如果改过名，请通过 `coreScript` 和 `webHostScript` 填写两个文件的确切路径。资源清单应包含附加许可文件，以及 RES 需要的包内文本、二进制和 PNG。请保留准备目录中的 `original-script-map.json`，用它将诊断里的 `original/0007.js` 等短名还原到原文件路径。该表不会进入 APK。随后可直接使用上文的 APK／AAB 签名构建流程。若拿到的是缺少已编译业务 JS 的源码工程，先使用匹配的旧工具链编译。

需要自定义启动时，可在准备好的游戏 `main.mjs` 中从 `@egret/android-original5` 引入 `installOriginal5Project`。可选的 `remoteRequest` 接口用于连接项目明确配置的 HTTPS 通讯。使用原渠道 SDK 的应用需要接上相应原生服务。包内资源和游戏私有存档沿用 RSDK 现有机制。只有 5.3.x 接口版本一致还不能证明商业游戏的私有引擎扩展、高级滤镜、动态脚本、编辑控件或线上后台可用。

有些浏览器插件在模块求值时就会读取全局对象。可在准备配置中用 `hostAdapter` 指定项目自有的独立 ES 模块相对路径。组件会在原版模块前调用可选的 `installHost({defineGlobal,services})` 导出。该文件也可以导出 `remoteRequest`，对接原版 HTTP 加载器。渠道调用应接到实际的原生服务，并保留成功、失败和取消语义。例如：

```js
export function installHost({defineGlobal, services}) {
  defineGlobal('readDeviceLocale', () => services.host.call('channel.locale', null, services.signal));
}
```

一个私有 5.3.10 商业工程的 Android 实测说明了这条边界。原归档库在初始化时创建浏览器下载链接。接入原生导出绑定后，启动推进到读取 DOM 的项目鼠标插件。该插件需要项目侧的输入适配。此次只覆盖启动诊断，线上渠道与实际玩法仍待验证。

### 原版引擎已验证的接口

Fold7 上的原版 5.3.10 工程用 RES 加载 PNG，用同一图集绘制两个 EUI 图片，并排版双色中文标签。点击实心圆或图集按钮会推进存档计数，点击圆形包围盒的透明角不会触发。强停重开后计数恢复。原版输入框唤起 Android 系统编辑器，在 `12` 后输入 `34` 并确认，收到一次获得焦点、两次内容变更和一次失去焦点事件。原版 InputController 继续处理游戏的字符过滤规则。密码输入需要单独的安全输入绑定。[图集与资源记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-atlas.json) · [系统编辑器记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-original5-editor.json)

每个应用只加载一种 V8 构建。切换配置时应验证游戏实际依赖的原引擎模块和第三方 SDK。浏览器插件启动前注册真实的原生接口，权限弹窗、渠道 Activity 回调、安全存储及交易走对应的平台服务。上面的命令用于 Android 工程。iOS 上加载原版 5 模块、任意浏览器 DOM 插件和白鹭 5 全部补丁版本仍需各自验证。

### 打包原版 5.3 脚本

准备工具会在启动前读取原引擎版本。5.3.1、5.3.2 两个标签使用原生显示接口 ABI 4，其中 5.3.2 标签附带的核心文件自报 5.3.1。5.3.5 到 5.3.10 使用 ABI 5。已人工确认接口的特殊构建可以在准备配置中填写 `nativeAbi`，与已识别版本相矛盾时会报错。图集样例的 `--engine-version` 填核心文件自报的版本。

原版项目会声明 `v8ScriptMode: "classic"`。部分旧版调试 EUI 依赖经典浏览器脚本中块级函数的作用域。原文件若自行指定严格模式，该声明仍生效。现有项目继续使用默认的严格模式。需要在同一宿主安装包中嵌入两种 V8 模式时，请将它们放在不同应用进程。[覆盖版本与像素核对](original5-atlas-verification.md)
