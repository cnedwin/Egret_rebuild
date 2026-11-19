# Android 游戏项目播放器

[English](../../en/docs/android-project-player.md) | 简体中文

同一份 arm64 Android 库可以把可信的 JavaScript 或 TypeScript 游戏打成独立应用，也可以把游戏作为子视图放入已有 Activity。Android System WebView 运行随包脚本，Rust 通过 OpenGL ES 3 在可见的 `GLSurfaceView` 上绘制游戏。库声明的最低系统版本为 Android API 26，随包提供支持 GLES3 的 arm64 原生代码。脚本环境另需支持 ES2022 和 AbortController 的较新 Android System WebView。下文验证结论以实际跑过的配置为限。

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

## 接入已有 Activity

将 AAR 放入应用模块的 `libs/egret-player.aar`，在 Gradle 依赖中加入 `implementation files('libs/egret-player.aar')`。把资源导出到该模块 assets 下的新目录。将下例路径替换为自己的游戏、打包器和应用模块路径。

```sh
node runtime-sdk/android/player/export-project.mjs --project /projects/my-game --esbuild /path/to/node_modules/esbuild --out /projects/my-app/app/src/main/assets/game
```

在主线程上创建 `new org.egret.runtime.player.EgretPlayerView(activity, "game", listener)` 并加入布局。将 Activity 的 `onResume()`、`onPause()` 转发给视图。退出游戏时调用 `close()`，等 `listener.onClosed()` 到达后再创建新视图。`onReady()` 表示首次原生绘制已成功提交，`onError(String)` 报告错误，`onState(String)` 接收游戏主动发送的 JSON。`getDiagnostics()` 提供会话统计和项目关闭回执。完整的两种 Activity 示例位于 `runtime-sdk/android/player/consumers/`。

## 支持的画面和验证范围

EGR2 按捕获顺序绘制，每帧最多支持 4,096 个矩形或贴图四边形。支持仿射变换、中性材质颜色、正常透明度合成、半透明填充及纹理、最近邻采样、未旋转且未去除透明边缘的图集区域，以及多个对齐坐标轴的矩形裁剪区取交集。区域采样在裁剪边界上保留区域自身的边缘纹素。以整页为采样域时要求区域覆盖全页。原生执行器在线性光空间按预乘透明度合成，最后转换为显示用 sRGB。遇到网格、特效、旋转的裁剪区、带旋转或去边信息的图集区域、其他混合模式或过滤策略时，编码器会报错。项目适配器使用不透明舞台。播放器按舞台宽高比适配可用空间，再将输入映射回舞台。

Rust 单元测试覆盖帧长度与取值检查、纹理标识、透明度转换、裁剪取整和 EGR1 兼容性。JavaScript 测试通过真实 Engine 捕获两张有租约的图像，并改变可见图像集合。Windows 的离屏 EGL 1.5 验证通过 ANGLE SwiftShader 读取一幅测试画面的全部 48 个像素。黑底上 50% 白色得到 RGBA (188,188,188,255)，其上叠加半透明红色纹理得到 (224,137,137,255)，第二张不透明绿色纹理得到 (0,255,0,255)。镜像图集在边界上仍采到自身的纹素，透明清屏得到 (128,0,0,128)。这些像素来自桌面软件渲染器。

2026 年 11 月 19 日，两款 Gradle 应用均在 Galaxy Z Fold7（Android 17、系统 WebView 157、Adreno 830）上运行。两份 APK 中的六个游戏文件和原生渲染库逐字节相同。两种模式下，通过 Android 注入点击完成药方，拖动列表滚动，系统键盘成功弹出，音效播放器启动并释放了一次音效。切到后台再返回，第二个 EGL 上下文恢复了四张纹理页。对照切后台前后的药材列表静态区域，独立版的 152,106 个像素和嵌入版的 103,500 个像素均无变化。宿主关闭游戏时归还了全部 14 份逻辑纹理，保留原生控件，随后成功重新打开游戏。本地调试构建中，AAR 为 701,200 字节，独立 APK 为 1,767,567 字节，宿主 APK 为 1,767,575 字节，均使用设备已有的系统 WebView。本轮覆盖功能及生命周期，未测帧速、实际听感和真人输入法组词。[真机与构建产物记录](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-player.json)

此前的 EGR1 样板另有带 Intl 和不带 Intl 的 Javet/V8 两种可选构建、冻结命令回放及 Galaxy Z Fold7 的耗时和 PSS 记录。该数据对应原样板及其脚本宿主。本项目播放器 AAR 使用设备自带的 Android System WebView。[原样板与实机记录](runtime-sdk-v8-fold7.md)

项目适配器、Android 视图、Rust 渲染器和示例游戏均为本项目贡献。AAR 的 `assets/egret-player-licenses/` 包含项目 LICENSE/NOTICE，以及 Rust 标准库、NDK/工具链和 robust-predicates 的许可文件。发布应用时请保留这些文件及游戏自带资源适用的许可声明。
