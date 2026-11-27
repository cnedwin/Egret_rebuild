# 可选的白鹭 5 协议字节兼容包

[English](README.md)

Egret Migrate 会把本模块带入转换后的浏览器游戏。原业务包可继续继承 `egret.ByteArray`，并通过 `egret.Endian.LITTLE_ENDIAN` 指定小端序。其他宿主可从源码目录运行 `npm install ./tools/egret-migrate`，再通过 `import { ByteArray, Endian } from '@egret/legacy/protocol'` 引入。本模块无依赖，可在没有 DOM 和宿主文本编解码器的环境执行。

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

从 `@egret/legacy/android` 导入 `openLegacyAndroid`，让播放器工程的 `create(services)` 返回其结果。传入固定舞台宽高、可移植的工程 ID、经典脚本组名、入口类名、已编译主题、RES 配置和图片绑定。适配器先安装 Egret、EUI 和 RES，再求值该脚本组。显示树、指针路由、资源租约和原生文字页归当前播放器视图管理。关闭时撤销本视图安装的绑定，暂停前按下的触点在恢复时失效。

按包内路径、宽高和原生页号（1–223）声明 PNG，同时在播放器工程的 assets 中列入所用 PNG 和 JSON。例如可用 `{ url: 'north.png', page: 1, width: 8, height: 8 }` 绑定 URL 为 `north.png` 的图片资源。播放器从安装包读取本地 JSON。原生文字缓存区分字体族、字重、斜体和描边，每页最多支持 1,048,576 像素。接入其他旧项目时，需逐项检查迁移报告中剩余的类型和宿主调用。

用上一节命令准备好[驿站示例](../../../runtime-sdk/examples/legacy-courier/main.mjs)后，选择由相同 SDK 构建的裁剪 V8 播放器 AAR：

```sh
node runtime-sdk/android/player/create-app.mjs --project ./courier-game --aar <trimmed-player.aar> --esbuild <esbuild-module> --id org.egret.sample.courier --layout embedded --out ./courier-app
gradle -p ./courier-app assembleDebug
adb install -r ./courier-app/build/outputs/apk/debug/EgretGame-debug.apk
adb shell am start -n org.egret.sample.courier/org.egret.example.LibraryActivity
```

打开游戏后点击路线按钮，标题由「北门驿站」变为「南门渡口」，路标由蓝变橙，存档路线变为 1。Windows Edge 158 与 Galaxy Z Fold7 的裁剪 V8 15.7.112.19 执行了完全相同的 2,365 字节 Egret TypeScript-Plus 编译产物。两端在操作前后的选项、中文标题、标记宽度、存档值、路线加载状态和控件数均相同。按各自显示比例截图，桌面橙色路标占 2,209 像素，手机占 48,400 像素。关闭后浏览器剩余零租约，手机释放全部五个已发布页面。该样例使用包内自制数据和注入的指针操作，生产服务器和渠道 SDK 仍需另行验收。
