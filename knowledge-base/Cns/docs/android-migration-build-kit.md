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

Gradle 检查版本中的文件，用所选游戏资源生成 APK，并保留应用自己的其他资源。省略该参数可构建原来随工程交付的版本。使用此版本库的所有构建停止后，可运行下面的命令，保留明确指定的两个已验收版本。工具先核对候选项，再清理旧的受管目录。请将版本库放在游戏和工具包以外。

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
