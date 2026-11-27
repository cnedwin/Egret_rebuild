# 可选的白鹭 5 兼容层

[English](README.md) · [HTTP、套接字和渠道调用](transport.zh-CN.md)

Egret Migrate 会把本模块带入转换后的浏览器游戏。原业务包可继续继承 `egret.ByteArray`，并通过 `egret.Endian.LITTLE_ENDIAN` 指定小端序。其他宿主可从源码目录运行 `npm install ./tools/egret-migrate`，再通过 `import { ByteArray, Endian } from '@egret/legacy/protocol'` 引入。本模块无依赖，可在没有 DOM 和宿主文本编解码器的环境执行。

### 项目自有 SDK 方法

旧游戏调用项目自有 SDK 的方法时，可向 `launchLegacyWeb` 或 `openLegacyAndroid` 传入 `provideBindings(base, scope)`。它在第一个业务脚本执行前运行，可向已启用的 `egret`、`eui`、`RES` 或 `dragonBones` 命名空间新增方法或值。既有类和方法保持身份一致，重名会在启动时报出。异步操作应归属于本局游戏。例如 `provideBindings: (base, scope) => ({RES: {loadPortrait: id => portraits.acquire(id, scope.signal)}})` 可让原业务继续调用自己的头像资源服务。

### 资源目录

用 `RES.getResByUrl(url, callback, owner, type)` 读取本地 PNG、UTF-8 文本、JSON 或 ArrayBuffer。按名称和 URL 读取共享同一份缓存及同一个在途请求。没有可识别扩展名的二进制可显式传入 `RES.ResourceItem.TYPE_BIN`。Android 工程须把文件列入资源清单，并在图片声明中绑定 PNG 尺寸。运营服务地址通过网络适配器访问。原清单中的文本和二进制文件在迁移中保留原始字节与类型，文本支持 `.txt`、`.csv`，二进制支持 `.bin`、`.dat`。

`RES.createGroup(name, keys)` 可组合已有条目和组。`destroyRes(group, false)` 保留其他已加载组共用的资源。关闭游戏会取消未完成的工作，迟到的回调不会进入旧游戏。命中缓存时，`getResAsync` 的 Promise 先完成，回调在游戏时钟后续一帧执行。Edge 已对照原版 5.3.10 的执行顺序、分组释放、名称、回调接收者和二进制字节。Android 布局示例从安装包读取宽 2 像素的 PNG、中文文本和五个二进制字节。

### 封包示例

```js
const packet = new ByteArray();
packet.endian = Endian.LITTLE_ENDIAN;
packet.writeUnsignedShort(9);
packet.writeUTF('集市');
packet.position = 0;
const id = packet.readUnsignedShort();
const name = packet.readUTF();
```

可读写整数、浮点数、布尔值、UTF-8 文本，并支持按偏移复制、回填字段。`buffer` 返回有效载荷的副本。`bytes` 和 `rawBuffer` 提供对预留空间的直接访问，在扩容、替换或清空后需重新获取。用 `readAvailable` 判断剩余有效数据，`bytesAvailable` 也会计入预留空间。游标移到当前容量以外时会立即预留空间。

每份协议包上限为 16 MiB。遇到错误 UTF-8、超长 UTF 字段或截断数据时，读取会抛错并保留字段起点。沿用旧版 UTF 解码时略过内嵌 NUL 的行为。完整适配表面见 `protocol.d.mts`。渠道握手、网络传输、游戏自己的消息格式及服务端验收由接入游戏和宿主负责。

## 单页 MovieClip

通过已有 RES 配置加载动画 JSON 和整页图集。工厂支持构造时传入两者，也支持稍后设置 `mcDataSet` 与 `texture`。多个显示对象可复用同一份动画数据。

```js
const factory = new egret.MovieClipDataFactory(RES.getRes('pilot_json'), RES.getRes('pilot_png'));
const actor = new egret.MovieClip(factory.generateMovieClipData('walk'));
panel.addChild(actor);
actor.gotoAndPlay('step', -1);
```

动画按原数据的具名区域、持续帧数、偏移、标签区间和具名帧事件播放，复用白鹭 7 的图集租约与序列帧播放器。帧号从 1 起。离开舞台后停用游戏时钟订阅。销毁显示对象时释放播放器，图集仍由 RES 管理。支持最多 1,024 个原始关键帧、1,048,576 个展开帧，帧率最高 240。每个画面需引用具名非空区域。游戏自行覆写的子类方法仍需对照原行为。

## 稀疏地图和角色部件

可通过 `@egret/legacy/scene` 引入，生成页内也可使用 `./compat/scene.mjs`。游戏传入已经注册的纹理类型，继续使用同一个资源管理器。每次回调交出一份新取得的纹理租约。静态图块和动态部件按传入的前后顺序绘制。

```js
import { createLegacySceneLayer, createLegacyTileIndex } from '@egret/legacy/scene';
const index = createLegacyTileIndex(cells, 256);
const layer = createLegacySceneLayer({ sdk, game,
  acquire: (key, signal) => game.engine.assets.acquire(sdk.createAssetRef(textureType, key), { signal })
});
game.stage.addChild(layer.display);
layer.update([...index.visible(camera), { id: 'body', asset: 'body-page', x: 80, y: 60, clip },
  { id: 'coat', asset: 'coat-page', x: 80, y: 60, clip: coatClip }]);
layer.seek(actionSeconds);
const results = await layer.settled();
await layer.close();
```

图块记录包含 `{ id, asset, row, column }`，镜头包含 `{ x, y, width, height }`。部件可传入对应整页图集的 `sdk.createSequenceClip` 序列。默认同时读取四份资源。刷新时沿用已经就绪的节点，重试失败项，并取消移出视区的条目。取消后迟到的租约仍会释放。所有部件共享游戏时钟，迟到的部件从当前动作时刻加入；独立角色可分别建立动作层。`settled()` 返回各 id 的 `ready` 或 `failed` 状态和错误。`close()` 等待所有读取结束，包括已经收到取消但还在收尾的读取。

## 在转换时给大动画图集重新分页

使用 `convert --movie-atlases movie-atlases.json`。映射文件为 JSON 数组，例如 `[{"data":"pilot_json","texture":"pilot_png"}]`。两个名称分别对应原动画工厂的 RES 数据与贴图。业务仍按原资源名加载；`rebuild` 沿用这份映射。

超过单图预算时，转换器在可编辑源码中保留原始 PNG，在 Web 构建中生成无损裁切的 PNG 页。各页内部边缘保留相邻像素用于采样。构建时逐页重新解码并校验 RGBA，透明像素的 RGB 也纳入比较。动画帧名、时长和偏移仍取原 JSON。跨页帧由多个裁切 Bitmap 共同绘制，普通 Bitmap 也可显示完整虚拟大图。已有单帧渲染预算继续生效。虚拟页的九宫格缩放以及兼作另一张 SpriteSheet 或骨骼图集需要额外适配。

源图离线解码上限为单边 8,192 像素、总计 16,777,216 像素。此范围内的单帧可以跨多个页。类型不匹配、绑定有歧义或原图超限会返回 `MIGRATE_MOVIE_ATLAS`。PNG 色彩元数据超出原转换契约时沿用既有资源诊断。

## 文字描边和行距

迁移后的 EUI Label 支持描边半径 `stroke`、颜色 `strokeColor` 和有符号的行距 `lineSpacing`。例如 `<e:Label text="北门" size="24" stroke="2" strokeColor="#003355" lineSpacing="5"/>` 表示 2 单位描边，相邻行间距为 29 单位。Canvas 文字提供器先计算包含描边的墨迹范围，再在同一张缓存纹理上绘制描边及填充。相同请求共享纹理，改变描边宽度或颜色会生成对应结果。描边宽度为零时沿用原有纯填充画面和缓存身份。程序化标签可用 `game.createLabel({ text, fontSize, strokeWidth, strokeColor })`。第三方文字提供器须声明 `supportsStroke: true` 并实现包含描边的测量与绘制，才能接纳非零描边宽度。

在本地 5.3.10 项目的 929 份皮肤中，能够逐份通过 EXML 编译的数量从 230 增至 451。该结果反映静态规则覆盖。整工程类绑定、完整界面操作和原版对照需另行实测。Windows Edge 158 与 RTX 5090 Laptop 上，三个相同文字行共用一条缓存；字号 28、行距 8 时实测行首相隔 36 像素。单项描边由绿色改成红色后，白色填充像素仍为 420 个。关闭场景后，文字使用方的租约全部释放。

## 计时、属性缓动和类型名称

使用 `RES.setMaxLoadingThread(2)` 可同时限制所有组、直接 URL 和纹理页的本地读取数。默认并发数为四，小于一时按一处理。调低上限后已开始的读取会完成，待处理项遵循新上限。图集构造等待纹理页时不占用读取名额。释放尚在排队的资源会阻止其开始读取。关闭视图时丢弃排队项和迟到的结果，各组分别报告成功加载的项数。

通过 `egret.Capabilities` 与 `egret.MainContext.instance.stage` 读取设备和舞台信息。浏览器返回当前后端（WebGL2 为 `webgl`）、系统和移动设备状态。Android GLES3 播放器的 runtimeType、os、isMobile、renderMode 分别为 `native`、`Android`、`true`、`gles3`。`RuntimeType.RUNTIME2` 对应历史 2.0 SDK。舞台宽高使用游戏逻辑单位。`stage.orientation` 返回挂载时的方向策略（`auto`），实际浏览器显示空间可独立旋转。请在创建视图时设置适配方式；挂载后可重复赋同一策略，更换策略会收到 `LEGACY_SCREEN_POLICY_FIXED`。原生界面按既定设计尺寸等比留边。视图关闭后原 MainContext 的 stage 返回 `null`。

Windows Edge 158 的 WebGL2 实测中，窗口视区从 720 × 440 变为 390 × 844，再回到原尺寸；固定宽度模式下舞台依次为 320 × 195、320 × 692、320 × 195。每次变化都发出了 resize 事件，挂载方向策略始终是 `auto`。

浏览器上的 `egret.log/warn/error` 将原参数转发到控制台。在 Android 上可将项目自己的 `logger` 传给 `openLegacyAndroid`。默认关闭回执按日志级别记录次数；显式开启 `captureLogs: true` 后，本地回执还保留最近 32 条、每条最多 256 字符的日志。开启内容采集前，应由应用处理日志中的敏感信息。

迁移后的浏览器和 Android 客户端共用 `egret` 的经典计时接口，时长单位为毫秒。`new egret.Timer(500, 3)` 运行时发送 `egret.TimerEvent.TIMER`，第三次计时后发送 `TIMER_COMPLETE`。`stop()` 保留次数，`start()` 从一个新间隔继续，`reset()` 将次数清零。运行中修改 `delay` 会重置按帧计时的预算。沿用白鹭 5 的行为，每个长帧最多触发一次，同时参考实际游戏时间和标称 60 Hz 的帧数。

```js
const countdown = new egret.Timer(500, 3);
countdown.addEventListener(egret.TimerEvent.TIMER, this.updateCountdown, this);
countdown.start();

const handle = egret.setInterval(this.refreshPrices, this, 2000, 'market');
egret.clearInterval(handle);
egret.setTimeout(this.restock, this, 250, 'north');
egret.callLater(this.relayout, this);
```

`setTimeout` 和 `setInterval` 保留接收对象及尾部参数。两者分别分配数字句柄，分别使用对应的清除函数。重复回调每帧最多触发一次，长帧之后从完整间隔重新计时。`callLater` 在适配层的本帧计时回调之后处理当前队列，队列执行中再次调用会留到下一帧。游戏时钟暂停后这些回调停止，恢复时从新的时间基准开始。游戏关闭时会清空待处理回调并拒绝继续调度。旧接口 `getTimer()` 仍返回绑定启动后经过的实际毫秒数，含暂停时间。

`getQualifiedClassName`、`getQualifiedSuperclassName` 和 `is` 读取原版编译器或 `registerClass` 写入的反射信息。可用 `registerImplementation('eui.IAssetAdapter', adapter)` 登记接口，再用 `getImplementation` 取回当前值。每个游戏单独维护登记项。将特定游戏或渠道提供的对象接到加载流程，仍需在应用侧完成接线。

运行 `node --test tests/egret-migrate-clock.test.mjs`。如需和旧版对照，将 `EGRET_LEGACY_MODULES` 指向受信任的旧 SDK 的 `libs/modules` 路径，其中应有 `egret/egret.js` 和 `game/game.js`。仅在启用对照时执行这两份旧脚本。回归覆盖事件顺序、次数、暂停、取消、回调参数、嵌套延迟和反射查询。线上游戏服务器时序与渠道 SDK 仍需分别验收。

移植后的两个宿主都提供 `egret.getTimer()`、`egret.Tween`、`egret.Ease` 和 `egret.getDefinitionByName()`。计时器返回自绑定初始化以来经过的毫秒数，包含暂停时间。属性缓动复用游戏的既有时钟，跟随它的缩放和单帧步长上限推进，并在作用域关闭时释放。

```js
egret.Tween.removeTweens(pin);
egret.Tween.get(pin, { loop: true })
  .to({ alpha: 0.3 }, 160, egret.Ease.sineInOut)
  .wait(40)
  .to({ alpha: 1 }, 160)
  .call(onPulse, panel, [pin]);
const Scene = egret.getDefinitionByName('market.Shop');
```

当前支持 `get`、`removeTweens`、`removeAllTweens`、`to`、`wait`、`set`、`call` 和 `setPaused`，以及 `paused`、`override`、`loop` 选项。数值属性支持插值，离散值在段尾应用。一次更新跨过多个动作时按原次序触发。可用曲线包括线性、二至五次幂、正弦和圆弧，以及对应的缓入、缓出、缓入缓出。涉及时间轴跳转、插件、onChange 事件、按帧计时或全局暂停后独立推进的用法仍需适配。

按名查询可解析已登记的业务类型、EUI 自定义控件、预编译皮肤构造函数，以及已加载经典命名空间的自有定义。缺失的类型返回 `null`。闭包内的类可以先用 `egret.registerClass(Shop, 'market.Shop')` 登记。仅有静态 EXML 描述时没有可返回的构造函数。

原 5.3.10 缓动库和新适配器在九个采样点的移动、等待、回调、循环和移除结果一致，另有 30 个曲线采样一致。一次商业工程源代码盘点发现 93 处 `Tween.get`、137 处 `removeTweens`、19 处循环选项，计数仅代表该工程的源码引用。

原创驿站样例可以从原 TypeScript 重新编译，再将相同字节作为 `courier.js` 装入游戏。最后一步会校验编译回执和摘要。

```sh
node tools/egret-migrate/bin.mjs compile-classic --source runtime-sdk/examples/legacy-courier/original --compiler <可信的-typescript.js> --groups runtime-sdk/examples/legacy-courier/original/groups.json --target es2015 --out ./courier-code
node runtime-sdk/examples/legacy-courier/prepare.mjs ./courier-game --classic-build ./courier-code
```

## 在 Android 播放器运行同一份旧业务入口

从 `@egret/legacy/android` 导入 `openLegacyAndroid`，让播放器工程的 `create(services)` 返回其结果。传入固定舞台宽高、可移植的工程 ID、经典脚本组名、入口类名、已编译主题、RES 配置和图片绑定。适配器先安装 Egret、EUI 和 RES，再求值该脚本组。显示树、指针路由、资源租约和原生文字页归当前播放器视图管理。关闭时撤销本视图安装的绑定，暂停前按下的触点在恢复时失效。同一游戏会话内可以切换路线、关卡和界面。完整重开游戏时，关闭播放器视图并以相同的应用和工程标识创建新视图。每个 V8 隔离环境内的经典脚本组只执行一次。在同一环境再次调用 `openLegacyAndroid`，会在注册全局名称和分配资源前返回 `LEGACY_ANDROID_NEW_VIEW_REQUIRED`。

项目自有预编译主题仍需提供静态描述（也可用 `{ skins: {}, exmls: [] }`）来启用 EUI。在 `prepareTheme` 中先加载已核查的项目注册脚本组和所依赖的自定义类，再向同一 EUI 宿主安装工厂。播放器等待注册完成后才加载业务组并构造第一个控件。独立的 Edge 工厂对照覆盖生成的皮肤构造函数，下述 Fold7 驿站样例使用静态 EXML 编译结果。

```js
import { registerLegacyThemeFactories } from '@egret/legacy/theme-factories';

async function prepareTheme({ eui, egret }) {
  await EgretRuntimeScripts.loadGroup('theme');
  registerLegacyThemeFactories(eui, themeManifest, { egret });
}
// 将 prepareTheme 传入 openLegacyAndroid 的选项。
```

按包内路径、宽高和原生页号（1–223）声明 PNG，同时在播放器工程的 assets 中列入所用 PNG 和 JSON。例如可用 `{ url: 'north.png', page: 1, width: 8, height: 8 }` 绑定 URL 为 `north.png` 的图片资源。播放器从安装包读取本地 JSON。原生文字缓存区分字体族、字重、斜体和描边，每页最多支持 1,048,576 像素。接入其他旧项目时，需逐项检查迁移报告中剩余的类型和宿主调用。

用上一节命令准备好[驿站示例](../../../runtime-sdk/examples/legacy-courier/main.mjs)后，选择由相同 SDK 构建的裁剪 V8 播放器 AAR：

```sh
node runtime-sdk/android/player/create-app.mjs --project ./courier-game --aar <trimmed-player.aar> --esbuild <esbuild-module> --id org.egret.sample.courier --layout embedded --out ./courier-app
gradle -p ./courier-app assembleDebug
adb install -r ./courier-app/build/outputs/apk/debug/EgretGame-debug.apk
adb shell am start -n org.egret.sample.courier/org.egret.example.LibraryActivity
```

打开游戏后点击路线按钮，标题由「北门驿站」变为「南门渡口」，路标由蓝变橙，存档路线变为 1。Windows Edge 158 与 Galaxy Z Fold7 的裁剪 V8 15.7.112.19 执行了完全相同的 2,365 字节 Egret TypeScript-Plus 编译产物。两端在操作前后的选项、中文标题、标记宽度、存档值、路线加载状态和控件数均相同。按各自显示比例截图，桌面橙色路标占 2,209 像素，手机占 48,400 像素。关闭后浏览器剩余零租约。在同一 Android Activity 中关闭第一个视图，再创建新视图，可读回路线 1「南门渡口」。再次操作后返回「北门驿站」并存为 0。手机两次关闭都释放全部五个已发布页面，文字剩余零字节，废弃上传均为零。该样例使用包内自制数据和注入的指针操作，生产服务器和渠道 SDK 仍需另行验收。

## 代码布局、混合和富文本

给 `group.layout` 指定 `new eui.HorizontalLayout()`、`new eui.VerticalLayout()` 或逐行填充的 `new eui.TileLayout()`，修改间距、内边距或支持的对齐属性即可重新布局。格子支持等尺寸和指定列数。将组设置为 `scroller.viewport`，再分别给 `scrollPolicyH`、`scrollPolicyV` 设置 `eui.ScrollPolicy.AUTO`、`ON` 或 `OFF`。可以在已裁剪视区的空白边缘继续拖动。惯性滚动、弹性越界和通用虚拟格子渲染器需要另行移植。`egret.BlendMode.ADD` 和 `NORMAL` 按显示顺序走引擎的共享材质。代码派发的触摸经过捕获、目标、冒泡三阶段，三处读到的都是原目标局部坐标。

只读 `egret.TextField` 可接收解析的富文本或原版文字元素数组。打开 `touchEnabled`，在字段自身监听链接。文字布局提交后，点击链接会收到 `text`，值为去掉 `event:` 前缀的参数。替换内容、从舞台移除或关闭视图后，旧文字页随作用域释放。

```js
const title = new egret.TextField();
title.width = 240;
title.size = 20;
title.touchEnabled = true;
title.textFlow = new egret.HtmlTextParser().parser(
  '<a href="event:open:gate"><font color="#18f570"><b>北门</b></font></a><font color="#ff9840">驿站</font>'
);
title.addEventListener(egret.TextEvent.LINK, event => visit(event.text), this);
```

支持嵌套的 `font`、`b`、`i`、`u`、`a`，换行字符、五种具名 XML 实体、事件链接、字号、字体、填充色和描边。只读 EUI Label 可以使用排版后的边框。每段复用宿主字体测量、现有文字光栅缓存及引擎作用域。单字段支持最多 256 个输入段、16,384 个 UTF-16 单元和换行后的 256 个绘制片段。可见片段和其他标签共享已有的文字页预算。原生缓存提供拒绝、释放和占用计数。外部链接、任意 HTML、跨样式的双向文字整形和富文本输入另需实现。

[布局样例](../../../runtime-sdk/examples/legacy-layout/board.js)通过 `RES.getResByUrl` 读取自制 PNG、中文 UTF-8 和二进制。连续点击绿色控件切换三种布局和混合方式。横向滑列表后，从视区末端空白处继续拖动。分别点橙色说明和绿色文字，仅绿色链接会触发进城事件。

```sh
node runtime-sdk/examples/legacy-layout/verify-browser.mjs --engine <egret2d.mjs> --playwright <playwright/index.mjs> --channel msedge --out ./edge-board-evidence
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/legacy-layout --aar <trimmed-player.aar> --esbuild <esbuild-module> --id org.egret.sample.layout --layout embedded --out ./layout-app
gradle -p ./layout-app assembleDebug
adb install -r ./layout-app/build/outputs/apk/debug/EgretGame-debug.apk
adb shell am start -n org.egret.sample.layout/org.egret.example.LibraryActivity
```
