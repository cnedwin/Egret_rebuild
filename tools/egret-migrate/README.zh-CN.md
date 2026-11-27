# Egret Migrate

[English](README.md) | 简体中文

Egret Migrate 是面向受支持的经典白鹭 5 Web 2D 源工程的本地 CLI。它复用白鹭 7 的工程存储和现有浏览器验收工具。保留旧源码和可运行的浏览器构建，用它们对照验收新工程。

可选的本地包 `@egret/legacy` 通过 `@egret/legacy/web` 提供原浏览器适配器，通过 `@egret/legacy/protocol` 提供无需 DOM 的二进制协议读写。从源码目录运行 `npm install ./tools/egret-migrate` 即可安装。转换产物已包含这些模块。字段类型和容量边界见[协议兼容指南](compat/README.zh-CN.md)。

## 旧项目的背景音乐与资源统计

将本地 WAV、MP3 或 Ogg 文件声明为 RES 的 `sound` 类型。调用 `RES.loadConfig` 后，用 `await RES.getResAsync("music")` 取得音乐，调用 `sound.play(0, 1)` 播放一次，在**返回的声道**上监听 `egret.Event.SOUND_COMPLETE`。音量范围为 0 到 1。切换曲目或调用 `stop()` 会结束旧声道，销毁资源会释放媒体。浏览器通过媒体元素流式播放，启用自动播放限制时需要用户手势。Android 播放器使用 MediaPlayer 读取 APK 内已声明且未经压缩的文件。每个视图同时播放一首背景音乐。Android 播放位置在准备完成和恢复前台后按系统播放器校准，两次采样之间按前台时钟推进。编解码格式的可用性取决于设备。

`RES.profile()` 打印并返回冻结的资源统计，包含声明、组、URL 别名、已加载与待完成的资源数量，以及执行中和排队的读取数量。浏览器还提供文字标签计数，原生宿主提供文字页占用。在 Windows Edge 158 上，白鹭 5.3.10 和新版各播放同一段自制的一秒 WAV，在 Galaxy Z Fold7 的裁剪 V8 上也用同一文件验收。三者都只在自然结束时收到一次事件，事件目标均为播放声道；停止或替换均未触发完成。新版释放后已加载资源从 1 降到 0。此次验证了事件和资源回收，听感仍需人工验收。

## 经典显示滤镜

把一个 `egret.ColorMatrixFilter` 放进显示对象的 `filters` 数组，浏览器适配器通过已有的共享效果组处理整棵显示子树。4×5 矩阵每行包含四个通道系数和一个按字节计的偏移值。给滤镜的 `matrix` 属性重新赋值会更新所有已使用它的节点，设 `filters = null` 或 `[]` 可移除矩阵并由宿主归还离屏目标。节点已有的遮罩和模糊配置保留，效果组数量沿用共享宿主上限。

Windows Edge 158 分别以原版 5.3.10 WebGL 和新版 WebGL2 绘制[自制面板和贴图](../../tests/fixtures/migrate-editor/filters.js)。两处不透明红色的采样值都由 `(255,0,0,255)` 变成 `(0,32,255,255)`，清除矩阵后还原，迁移资源可正常销毁。经典 BlurFilter 和 GlowFilter 可保留原始参数；应用超过上限或两轴不等的配置（包括 10×10 模糊、35×35 辉光）会报 `LEGACY_FILTER_RADIUS_UNSUPPORTED`。半径在范围内时，原版与共享采样核心仍有差异，应用会报 `LEGACY_FILTER_KERNEL_UNVERIFIED`。Android GLES3 工程帧尚缺离屏效果组，应用迁移滤镜会在下一帧绘制前报 `LEGACY_ANDROID_FILTER_UNSUPPORTED`。

## 迁移控件的文字编辑

经典 `egret.TextField` 设为 `egret.TextFieldType.INPUT` 后，与 `eui.EditableText` 使用同一套编辑会话。数量框可设 `inputType = egret.TextFieldInputType.TEL`、`restrict = '0-9'` 和 `maxChars = 3`。控件上台后，轻点或调用 `setFocus()` 打开编辑器。在每次冒泡的 `egret.Event.CHANGE` 中读取 `field.text`，在控件或父节点监听 `egret.FocusEvent.FOCUS_IN`、`FOCUS_OUT`。编辑之外由业务代码给 `text` 赋值不会触发用户改值事件。

浏览器单文件包含引擎已有的系统文字输入端口，Android 使用配套播放器里的原生编辑框。两端支持普通和电话输入；迁移适配器接受不限制字符和显式的 `0-9` 约束。密码字段和其他字符规则需要另做适配。本轮验证覆盖单行字段，中文输入法组合、编辑时父节点持续移动、辅助技术和生产表单仍需在具体游戏验收。

[同一份自制控件](../../tests/fixtures/migrate-editor/board.js) 在 Windows Edge 158 分别加载原版 5.3.10 和新版浏览器宿主，在 Android 17 的 Fold7 上使用裁剪 V8。三端的父节点都按 `focusIn(1) → change(14) → change(142) → focusOut(142)` 收到事件，目标均为正在编辑的字段。在手机继续输入第四位会被长度限制拦下；关闭视图后两页文字均释放，占用为零字节。数字通过自动操作实际系统输入控件完成。

## 编译 5.3 业务脚本清单

当原工程仍能编译，而检查结果显示业务或宿主需要人工适配时，可先保留原项目的 TypeScript 编译流程。由项目方提供可信、版本匹配的 Egret TypeScript-Plus `lib/typescript.js`，放在原工程目录以外。CLI 在本机加载这个编译器，核对原输入指纹，逐个解析生成的脚本，全程不执行游戏代码。

```sh
egret-migrate compile-classic --source ./old-client --compiler ./original-tools/lib/typescript.js --compiler-sha256 <已核准的SHA256> --out ./classic-first --theme resource/default.thm.json
egret-migrate compile-classic --source ./old-client --compiler ./original-tools/lib/typescript.js --out ./classic-reviewed --theme resource/default.thm.json --baseline ./classic-first/classic-build.json
```

先审阅 `classic-build.json`，再用它作为诊断基线。回执记录编译器、标准库、原模块顺序和指纹、业务源码与 JS 产物的逐文件对应关系、原清单略过的已配置脚本，以及带行列的语义诊断。缺失的原模块和待接宿主适配器也会列出。与已审基线不符会拒绝产物。配置、语法或原脚本顺序错误时，编译在发布输出前结束。

默认的 `--target config` 继承原 tsconfig 的编译目标。如果旧代码用 ES5 的调用方式继承迁移后提供的原生 ES2015 类，可以显式选择 `--target es2015`，并为该目标另审一份诊断基线。新目标保留原生基类构造，顶层具名类仍可用原名从全局查找，支持经典皮肤解析。两个目标均启用原编译器的 `__reflect`。用 `--mode debug` 或 `--mode release` 选择原 DEBUG、RELEASE 编译常量。

把 `classic/` 复制到可编辑的 Android 游戏目录，再将 `v8-scripts.json` 合入它的 `project.json`。默认所有业务脚本按 `manifest.game` 顺序先于游戏入口启动。若要先安装宿主类型，可把原业务放入延后加载组。例如，`--groups groups.json` 读取 `[{"name":"business","from":"src/Boot.ts"}]`，其中路径替换为第一个延后加载的原文件。游戏入口安装已审适配器后调用 `await EgretRuntimeScripts.loadGroup("business")`。每组覆盖从起始文件到下一组之前的连续范围，有依赖的组按原顺序加载。导出器允许至多 4,095 个附加脚本，每个脚本最多 16 MiB，含主入口合计 64 MiB，Android 工程清单最多 64 KiB。

传入 `--theme` 后，`static-skins.json` 列出 EUI 适配器接收的描述树、待处理的类映射和剩余 EXML 位置。解析器提供消息与偏移时一并保留。涉及业务代码的构造器、原外部服务、画面、登录和玩法仍需分别联调。

一个非公开的 5.3.10 工程按原编译目标生成 1,633 个脚本，共 10,189,917 字节。两次编译均得到相同的十条语义诊断。统一换行、去除 source-map 文件尾和文末空白后，1,633 份均与保留的原版编译结果相同。Android 导出器逐份复制，每个文件都匹配新产物的 SHA-256。独立的 ES2015 目标生成 8,737,317 字节，报告 60 条语义诊断。本次静态 EUI 读取接收 935 个引用中的 451 个，记录 478 个超出现有能力的 EXML 及六个缺失文件，另有八个默认皮肤映射待处理。这些结果覆盖静态编译和装包；原创小工程独立验证原生类构造、命名空间继承和反射。此次未运行客户游戏。

### 使用原工程预编译的 EUI 皮肤

在工程副本里，用项目有使用权、版本匹配的原 EUI 发布工具重新构建。若工具支持 EXML 发布策略，可在原发布流程选择 `new ExmlPlugin('gjs')`。保留原来按路径列出 EXML 的主题，把生成的主题另存一份。生成文件中的每条 `exmls` 应包含 `path`、`className` 和 `gjs` 构造器表达式。记录生成文件的 SHA-256，把原 EXML 和构建工具留在可编辑工程中。

在工程副本内新建 `migration/theme-profile.json`：

```json
{
  "schemaVersion": 1, "origin": "project-regenerated", "format": "gjs",
  "global": "ShelfTheme", "provider": "migration/published.thm.json",
  "sha256": "<完整生成文件的 SHA-256>", "namespaces": ["sample"]
}
```

```sh
egret-migrate compile-classic --source ./old-client --compiler ./original-tools/lib/typescript.js --theme resource/default.thm.json --theme-factories migration/theme-profile.json --out ./classic-with-skins
```

工程也可直接提供已有的经典 `.js` 注册表。将 `format` 设为 `registry`、`origin` 设为 `project-owned`，在 `entries` 中逐项填写原 EXML 路径和类名。指定的全局对象需实现 `names()` 与 `get(className)`，后者返回原构造器。工具按原字节保留这个脚本。注册前先装载其原有依赖，并确认项目有权运行和分发所提供的代码。

命令生成有装载顺序的经典脚本和 `theme-factories.json`。可选的 `after: "src/Boot.ts"` 会将脚本放到对应原业务代码之后，两者属于同一个启动组或延迟组。先加载脚本，再在业务创建控件前注册：

```js
import { registerLegacyThemeFactories } from '@egret/legacy/theme-factories';

registerLegacyThemeFactories(eui, themeManifest, {egret, namespaces: {sample}});
const panel = new eui.Component();
panel.skinName = 'resource/Panel.exml';
```

在相应命名空间传入游戏的真实自定义构造器。检查 `missingProviders`、`unresolvedMappings` 及单独生成的静态皮肤报告。当前适配器支持已验证的控件和基于属性的状态切换。依赖其他 EUI 类、状态操作或业务服务的工厂仍需补对应适配并逐项运行对照。

公开夹具 `tests/fixtures/migrate-theme-factories` 随附自制 EXML 和 5.3.10 编译产物。在 RTX 5090 Laptop 的 Windows Edge 158 中，旧版和迁移版均创建三个具名部件，标签完成关闭、打开、关闭的切换，列表选中 B，并构造了自定义标记。迁移版 WebGL2 使用一页纹理（7,280 字节），零帧遭拒。另一次私有工程盘点中，保持原字节的注册表覆盖主主题 935 个路径中的 929 个，副主题 34 个路径中的 28 个。两个主题各保留六个缺失路径和六个未解析映射。上述数字说明工厂的可用范围；各工程的画面和玩法仍需单独验收。

同一次编译会生成 `sdk-surface.json`。工具用原编译器读取 `libs/modules` 中配套的声明，逐项记录完整名称、定义位置、可见性，以及命名空间值、静态成员、实例成员或纯类型。将它与 `api-usage.json`、实际宿主的绑定结合查看。继承成员的声明可能在父类。计算属性、导出别名、重载签名和实例行为还需用项目验证。若项目改过 SDK，这份清单反映项目随附的版本。

## 用原编译器重新生成编辑后的 EXML

依赖项目自定义控件、超过静态转换范围的皮肤，可以复用旧项目的编译器。先生成旧版目标脚本，再从本地 HTML 入口启动原项目；用实际存在的就绪属性指明何时可以反射业务控件。浏览器会话读取提供的目录和已核对的脚本，阻断外网请求，把结果写入新目录。

```sh
egret-migrate compile-classic --source ./old-client --compiler ./original-tools/typescript.js --out ./original-build
egret-migrate compile-theme --source ./old-client --classic ./original-build --theme resource/default.thm.json --entry index.html --ready Main.ready --namespaces app --playwright ./tools/playwright/index.mjs --out ./skin-build
egret-migrate compile-classic --source ./old-client --compiler ./original-tools/typescript.js --target es2015 --theme resource/default.thm.json --compiled-theme ./skin-build --out ./android-scripts
```

将示例中的就绪属性和命名空间换成项目实际使用的值。报告会列出源文件和启动依赖的摘要、生成的类、缺失及编译失败的皮肤。改动 EXML 或补入此前缺失的文件后，需要重新生成。Windows Edge 上，工具从引用 935 个路径的真实主题生成了 929 份工厂，其余 6 个路径缺源文件。组件能否在目标宿主上创建、界面玩法是否一致，须分别验证。

## 安装和运行

在已经构建白鹭包的仓库里生成本地 CLI 归档。传入本机安装的 esbuild 模块和 npm CLI 入口。

```text
node tools/egret-migrate/pack.mjs --esbuild <esbuild-module> --npm <npm-cli.js> --out <new-package-dir>
npm install --prefix <tool-folder> <new-package-dir>/egret-migrate-0.7.0.tgz
```

使用安装后的 `egret-migrate` 命令，也可以直接运行 `node <tool-folder>/node_modules/@egret/migrate/bin.mjs`。CLI 可以在引擎仓库之外运行。准备固定版本的白鹭 7.0 系列 `egret2d.mjs`、esbuild 模块和带 Chromium 的 Playwright。扫码预览另需 qrcode-generator 2.0.4。使用时显式传入这些工具的路径。

```text
egret-migrate inspect --source <old-project>
egret-migrate convert --source <old-project> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module>
egret-migrate verify --old <old-built-index.html> --converted <new-project> --scenario <shared-scenario.mjs> --playwright <playwright-index.mjs> --out <new-evidence-directory>
egret-migrate preview --run <new-evidence-directory> --address <LAN-IPv4> --qr-module <qrcode.mjs>
```

工具读取经典 HTML 的舞台声明、引擎与编译器配置、`manifest.json` 中有序的游戏脚本，以及本地 RES 清单。已接纳 `egret`、`game`、`res`、`assetsmanager`、`promise`、受支持范围内的 `eui` 和 `dragonBones` 模块。浏览器适配器提供测试所覆盖的显示、监听、图片和 JSON 资源组及本地存储操作。可以用 `--source-order` 提供按加载顺序排列的工程内 `src/*.ts` 路径数组，用 `--resources` 指定另一份工程内资源清单。自定义运行时模块和动态舞台尺寸需要按工程适配。

经典 5.1 工程支持引擎与编译器同时声明为 5.1.7 或同时声明为 5.1.9 的项目。

### 盘点 5.3 工程

引擎与编译器声明为相同 5.3.x 版本时，可以直接只读盘点。报告保留原游戏脚本的加载顺序，列出缺失或未进入清单的 TypeScript 源文件、额外的启动库，并列出类型声明文件。可转换工程会保留这些声明和已提供的 tsconfig.json。替换旧宿主前，须复核自定义 HTML 启动脚本。每份本地 `.res.json` 和 `.thm.json` 都会列出已引用、交付目录中却缺少的资源或皮肤。远程资源按 RES 名称报告。盘点范围包括项目根目录、`src/` 和 `resource/`。服务端下发或运行时拼接的资源路径仍需结合实际玩法核对。

先看 `conversion.status`。`eligible` 表示所选输入通过了经典 Web 转换方案的准入检查。`review-required` 会带上原因，转换会在建立输出目录前停止。例如，`MIGRATE_SOURCE_LIMIT` 表示超出自动转换的 512 个脚本上限。报告仍会保留完整顺序，同时列出自定义启动库、多份资源清单和缺失皮肤。盘点在本地读取项目声明，旧工程脚本始终作为数据处理。输入摘要覆盖本次实际读取的文件，其他文件内容、玩法和渠道服务还需实测。

### 重建可编辑的迁移工程

在转换目录中修改保留下来的 TypeScript、EXML、原始资源或清单，保留已有 `conversion.json` 和固定版本的浏览器引擎。用新的同级目录接收重建结果，再复跑同一段玩法。

```text
egret-migrate rebuild --source <可编辑转换目录> --out <新构建目录> --esbuild <esbuild模块>
```

重建会沿用游戏存档所用的项目 ID，核对引擎文件摘要，重新解析输入和编译。新 `conversion.json` 中的 `inputChanges.added`、`.changed`、`.removed` 按原始文件字节比较本次准入的输入和上次清单。`web/` 内的生成文件由源码重建。沿用原浏览器存档时还需保持同源。

大尺寸 MovieClip 图集可在转换时传入 `--movie-atlases <JSON文件>`，明确指定 RES 键，例如 `[{"data":"action_json","texture":"action_png"}]`。重建会复用保留的 `movie-atlases.json` 映射。

应用过项目事务的新转换会保存 `project-transaction.json`，以便重建时重放原修正。替换该修正，或者处理没有保存原事务的旧版输出时，传入 `--transaction <文件>`。缺失输入可以在可编辑工程内补齐后重试。升级引擎版本时请显式运行新的 `convert`。

### 从白鹭 5.0.14 迁出联网大厅

对同时包含 `client/` 和 `socket.io/` 的上游仓库根目录使用 `eraser-lobby`。工具自动选取原版大厅与房间两个业务类、两幕皮肤、列表行和按钮皮肤、两张按钮图片，以及工程随附的 Socket.IO 客户端，并记录所选输入的文件身份。其余游戏内容可原样留在工程里。[参考工程](https://github.com/EraserTeam/EraserSanGuoSha/tree/30c315bb7296efd0518eb0c31dd0e4d115742b69)

```text
egret-migrate inspect --profile eraser-lobby --source <EraserSanGuoSha-root>
egret-migrate convert --profile eraser-lobby --source <EraserSanGuoSha-root> --out <new-project> --engine <egret2d.mjs> --engine-version <7.0.x> --esbuild <esbuild-module> --socket-url http://127.0.0.1:43676
```

单独启动原版 Node 服务端，将其 `PORT` 设为示例使用的端口，以启用原作的多房间流程。通过 HTTP 托管生成的 `web/` 目录。两个服务同源时默认连接页面来源；在本机分端口运行时，用 `--socket-url` 指定回环地址。

用两个独立浏览器会话打开生成的客户端。A 点击「创建房间」；B 点击「刷新列表」，选中 A 的房号，再点击「加入房间」。原服务开始对局后，核对两端是否进入同一房号的开局交接界面。可另开一间房，在第二位玩家加入前验证离房。可玩的牌桌、持久化和断线重连需另行迁移。

Windows 对照使用两个隔离的 Chromium 157 会话、软件 WebGL2 和未改动的源工程。A 离开第一间房后，B 刷新列表，房间消失。第二间房开局时，两端画布及无障碍状态文本都显示同一房号、两名玩家和不同座位。原服务端记录了双方加入以及该房开局。两端都使用原项目随附的 Socket.IO 字节。本次采集范围为桌面功能，移动输入与渲染性能另行验收。

### EUI、图集资源与骨骼导出

静态和动态皮肤共用工程事务和浏览器宿主。`eui` 默认读取 `resource/default.thm.json`，也可用 `--theme <相对路径>` 指定另一份本地主题。编译器把主题声明的 EXML 作为数据读取，保留皮肤部件 ID、层级、字面量属性、尺寸及受支持的基础与线性布局。业务代码可用原 ID 访问部件。0.3 版支持 `{hostComponent.model.title}`、`{data.name}` 等属性链，注册 EXML 以限定名引用的工程组件，并按状态更新属性和子项。验收时应替换一次绑定对象，再卸载并重新进入页面，核对监听和部件状态。编译器会指出无法转换的表达式位置。保留原主题并记录任何主题范围调整，部分未实例化的默认皮肤也可能包含未支持声明。适配器复用显示树和作用域文字资源。

`index.html` 的 `data-scale-mode` 会保留。`showAll`、`noBorder` 和 `exactFit` 的舞台保持设计尺寸。`fixedWidth`、`fixedHeight`、`fixedNarrow` 和 `fixedWide` 按白鹭 5 的方式计算舞台。窗口变化时，`stage.stageWidth` 和 `stage.stageHeight` 跟着变化，EUI 按新尺寸重新排布各个根节点，舞台派发 `egret.Event.RESIZE`。`noScale` 在 `inspect` 时被拒绝。

传统 RES 图集支持未旋转帧、裁切偏移和已声明子键，复用同一张原生纹理页和现有 SpriteSheet API。页路径来自原声明，裸子键和带图集名的帧键都能解析到同一帧。已兼容的 PNG 保持字节一致；受支持但超出目标解码范围的旧 PNG 可离线规范为 RGBA8，对照解码像素并记录输入输出 SHA-256。非 sRGB 色彩配置和未知语义元数据需要明确适配。缺失、歧义及旋转帧需要明确修复。

为每组已接纳的 DragonBones 骨骼、图集描述及纹理提供本地 JSON 映射：

```json
[{"skeleton":"actor_ske_json","atlas":"actor_tex_json","texture":"actor_tex_png"}]
```

在 `inspect` 和 `convert` 中传入 `--bones <映射.json>`。这些名称是 RES 键，图集声明必须匹配选定的 PNG 及其尺寸。已确认的图集页改名需要在该映射中显式设置 `"allowRenamedPage": true`，报告保存原路径并检查尺寸。转换后的 Web JSON 路径保存中性的原生骨骼描述，兼容工厂通过白鹭 7 显示节点、纹理租约和引擎时钟播放。新游戏没有随附 DragonBones 运行时或商用 Spine SDK，可编辑输出保留原资源。

当前支持局部变换的 DragonBones 5.x 刚性图片骨骼、父节点优先的层级、普通附件顺序、未旋转的裁切矩形、有限的动画通道、线性与阶跃插值、有限和循环片段以及受支持的插槽显示和透明度变化。0.3 版新增关闭缩放继承、单帧保持姿态和加法混合图片插槽。权重网格、IK、形变时间线、动态绘制顺序、非线性缓动和多层混合仍需单独转换，遇到超出支持范围的声明会给出诊断。Agent 可在工程所有者授权下适配源码或导出，也可通过白鹭 7 的 Spine 路径接入具备单独许可的数据，再做姿态与行为验证。自动转换至 Spine 和任意 DragonBones 骨骼仍待完成。

基础布局支持边约束和百分比尺寸。`eui.ArrayCollection` 变更会更新使用自定义行渲染器的 `List` 或 `DataGroup`。应与旧版对照选中、取消、行顺序和纵向滚动。固定行高的纵向虚拟列表会复用滚出视区的列表项，行高不一致时保留完整布局。普通 Group 也可作为 Scroller 视口。通过旧版容器移动它时，滚动状态会随即解除。混用白鹭 7 原生容器时，应先设置 `scroller.viewport = null`，再移动 Group。按行排列的 TileLayout 支持固定尺寸的单元格、横纵间距和内边距。每个按钮各自拥有内联皮肤的命名部件。用可运行的旧版对照导航、状态切换和存档进度。按列排列、运行中换肤和描边文字仍需单独适配。自定义事件支持冒泡和取消，指针和舞台事件由引擎派发。

转换将可编辑 TypeScript 及已接纳的输入、`web/` 构建、`history.json` 和 `conversion.json` 写入新目录。工程事务回执记录导入的舞台和资源身份。修正工程数据可传入基于导入修订的 `--transaction <json>`。修正源码时编辑副本，再转换到另一个新目录。需要复用存档命名空间时，通过 `--project-id` 保持报告里的工程 ID。浏览器存档按站点来源隔离。跨站点迁移时，按游戏自己的数据格式选择并导入所需键。

为两版使用同一份独立的 verify-game 场景，按顺序记录 `first-action`、`round-finished`、`restart`、`first-action-after-restart` 和 `save-restored`，每步先断言玩家能观察到的行为。场景可导出包含浏览器宽高的 `viewport` 以对齐响应式布局。CLI 保存两版结果，只为该次对照通过的新构建生成预览。旧版入口哈希记录传入验收的 HTML。为了能复跑对照，还要单独固定对应旧构建。

局域网验收使用私有地址，安装 [qrcode-generator 模块](https://www.npmjs.com/package/qrcode-generator/v/2.0.4) 并传入它的 `dist/qrcode.mjs`。已授权 USB 调试的 Android 可以把预览绑定到 `127.0.0.1`，用输出的端口配置 `adb reverse`。预览 15 分钟后失效。终端报告的构建 SHA-256 对应桌面验收所用的浏览器文件。

## 在 Agent 中使用

三个客户端共用包里的 `skill/SKILL.md`。Codex 放在 `.agents/skills/egret-migrate`，Claude Code 放在 `.claude/skills/egret-migrate`，WorkBuddy 用本地技能上传导入同一个目录。文件和命令权限由各自客户端控制。可以直接说：“把这个白鹭 5 游戏迁到 7.0，保留玩法和存档，验证一局能完整玩完。”

## 首次验收

独立包已在干净目录离线安装。白鹭 5.2.7 的原 Web 构建和适配后的 7.0.2 构建，均在 Windows Chrome 157 跑完同一局单人扫雷。脚本检查打开数字格、标记与取消标记、输局、重开及再次开格，使用 640 × 1136 视口和随机种子 739081。Agent 修复保留棋盘逻辑，替换场景内的 EUI 呈现，并把 13 个图集帧转换为独立本地 PNG。样例独立于本包。 [固定版本和许可](https://github.com/zjalen/Multi_Minesweeper/tree/57d48a8781bf104a60dac4b47556c0ce3be711d0)

Galaxy Z Fold7 上的 Chrome 157 识别了二维码图片，经 USB 预览读取全部 19 个匹配文件，在硬件 WebGL2 上复跑同一套操作。构建身份为 `cc6038460782728dc0bb96c5b5a3c9d5e558ca831c5bf4a6e63d32111a616eff`。原扫雷没有棋盘存档，这一案例单独验证了测试值持久化。原创对照游戏 Dawn Signal Run 在两代引擎上验证了真实游戏进度，刷新后恢复最佳成绩 3。该对照的通过构建也在 Fold7 上完成了验证。跨浏览器来源导入已有存档、更多 EUI 布局及目标平台完整兼容仍待验收。Claude Code 和 WorkBuddy 已有接入说明，客户端调用仍待实测。

## 0.2 版验收

Lantern Guardian 是为本次验收独立编写的原创迁移标杆，包含三套嵌套 EXML 皮肤、三根骨骼和三个插槽的 DragonBones 5.5 动画、三个动作、可操作的三步玩法、动态成绩和进度 UI、重开及最高分存档。旧版使用真实白鹭 5.2.7 WebGL/EUI/DragonBones 运行时，新版使用白鹭 7.0.2 与原生图片骨骼描述。TypeScript 和 EXML 无需修改玩法即可进入转换。两版均在 Windows Chrome 157（软件 WebGL）通过同一套五步浏览器检查，包含灯笼上下动作像素及恢复最高分 3。独立安装 CLI 生成的 11 个浏览器文件经过验收，构建身份为 `39b2600b3e81f78bd4469823c2131dc742d19b6d8167694c13b8123047b5885b`。布局与采样颜色符合玩法断言，两代引擎字体基线及动画采样相位仍有差异。

Galaxy Z Fold7（Chrome 157、硬件 WebGL2）识别本地二维码，读取完全一致的 11 个浏览器文件，并通过真机触控完成同一套五步检查，包含向上攻击、向下防御及刷新后恢复最高分 3。首轮已经取得得分变化，但截图采样错过瞬时动画姿态；在同一构建上提高舞台采样频率复验通过，原失败记录保留。原创源码及场景位于 `tests/fixtures/egret-migrate-eui/`。使用本地 [白鹭 5.2.7 SDK 构建](https://github.com/egret-labs/egret-core/tree/v5.2.7/build) 和 esbuild 0.27.4 即可复跑。准备工具核对五个旧运行时文件并在本地组装，无需随工具分发旧运行时。

```text
node tests/fixtures/egret-migrate-eui/prepare.mjs --legacy-libs <Egret-5.2.7-build> --esbuild <esbuild-module> --out <old-fixture>
egret-migrate convert --source <old-fixture> --bones tests/fixtures/egret-migrate-eui/bones.json --out <new-fixture> --engine <egret2d.mjs> --engine-version 7.0.2 --esbuild <esbuild-module>
egret-migrate verify --old <old-fixture>/index.html --converted <new-fixture> --scenario tests/fixtures/egret-migrate-eui/scenario.mjs --playwright <playwright-module> --out <new-proof>
```

此前的扫雷案例也用原始 13 帧打包图集复验，保留已适配的界面和棋盘逻辑。首轮发现旧 PNG 的文本块使目标解码器拒绝。离线规范化保留解码 RGBA 像素，原文件保存在 `web/` 之外，省去裁切 13 个单独 PNG 的步骤。最终桌面同局玩法、重开及存储测试值对照通过。此处复用真实历史游戏，尚无棋盘存档能力。

另外，历史 Egret CoreExample 的 DragonBoy 资产（DragonBones 5.0，19 根骨骼、18 个插槽、四个动作）以原骨骼、图集和 PNG 进行验证。stand、walk、jump、fall 的 10 个固定采样姿态共对照 180 次可见插槽变换，位置最大差异约为 0.00000125 舞台单位，画面覆盖区域 IoU 为 97.78%–98.24%。颜色与边缘平滑存在差异。这一结论针对该动画，无完整玩法或性能结论。 [历史示例出处](https://github.com/egret-labs/egret-examples)

固定版本的 [白鹭 5.2.2 `dbplay` 教学工程](https://github.com/xiashu/egret-code/tree/8f4a47b79fd574913689936ecd5c16462dc576ba/%E9%BE%99%E9%AA%A8%E7%AF%87/dbplay) 原版也在 Chromium 显示了两个不同 run 姿态。0.3 版已用其 37 根骨骼的角色及独立光效验证动画迁移；该教学工程没有完整的一局玩法。本轮未确认同时具备许可明确、复杂 EUI/EXML、骨骼动画以及整局玩法和存档的独立历史 5.x 游戏，商业级完整迁移仍待验收。上述各项对照为后续实现提供具体证据。CLI 未纳入历史美术资产或 SDK 二进制。

## 0.3 版对照结果

- **《斗兽棋》。** 在 Windows Chromium 157 软件 WebGL 上，白鹭 5.0.15 原版与转换版使用同一随机种子，翻开 16 枚棋子，完成相同的 14 步移动和吃子，直至一方清空；重新加载后，两版都能再次翻开第一枚棋子。六个检查点的棋子状态与顺序一致。确认变化区域已经呈现后，600 × 600 截图的 RGB 平均绝对差为 4.01–4.54（满量程 255）。在 Galaxy Z Fold7 的 Chrome 157、Adreno 830 上解析预览二维码，以自动触摸重放了相同的 14 步和六个检查点。原作没有棋局存档。迁移副本改了两份文件：主题清单排除 13 张未使用的模板皮肤，入口去掉未使用的模板注册，并把私有子节点数组遍历改成公开接口。所有游戏图片保留原格式。目标单文件构建自引擎提交 `0728eccc`，早期标杆使用的归档 7.0.2 浏览器包会拒绝原作 JPEG 背景。[固定版本源码](https://github.com/tangjx/cubs/tree/ae7da87b961a3c7fd8f1ef6bd4ec3aac914efbc2)
- **历史图片骨骼。** 用白鹭 5.2.2 原播放器和白鹭 7.0.2 播放同一 37 骨骼、36 插槽角色的 10 个动作。在 28 个姿态、1,008 次插槽比较中，显隐与绘制顺序一致；可见插槽原点最大差异为 0.00000633 舞台单位。角色轮廓交并比为 98.80%–99.38%，独立三插槽加法光效为 95.73%–96.62%。对照使用 Chromium 157 软件 WebGL，逐像素仍能测出平滑与颜色差异。[固定版本教学工程](https://github.com/xiashu/egret-code/tree/8f4a47b79fd574913689936ecd5c16462dc576ba)
- **历史商品列表。** 在白鹭 5.1.9 和白鹭 7 上，同一自定义行渲染器显示七件商品的名称、说明和已加载图标。两版都能点选第二项、拖动滚动后点选末项；直接修改和替换已选中的末项后，两版都保留选中索引 6 和稳定的滚动位置 224 舞台单位，说明与图标随之更新。旧版只实例化可见行，转换版实例化了全部七行。组件 TypeScript 和两份 EXML 皮肤保持字节一致。目标端使用单独入口挂载该列表，八张带嵌入色彩配置的 PNG 在浏览器中转换，逐张核对输入与输出解码后的 RGBA 哈希一致。旧工程的其他页面仍待验收。[固定版本组件源码](https://github.com/JuntaoWu/egret-demo/tree/dfb9f4e8b304c1d3792c17d8d2d62cda7c21c1d9)
- **动态库存面板。** 使用原创夹具，在白鹭 5.2.7 和 7.0.2 上执行相同的 EXML 与 TypeScript。六个检查点覆盖按屏幕坐标选行、替换模型、切换条件状态、增删菜单项、滚动 32 个单位及重新进入面板。单独的回归检查重复列表项和关闭整局游戏后的解绑。既有《灯笼守卫》证据覆盖该样板自己的分数存档恢复。

复跑原创库存面板需要本地四个白鹭 5.2.7 库和 esbuild 0.27.4。夹具按哈希核对旧库，把两版构建、截图及对照结果写入新目录。

```text
node tests/fixtures/egret-migrate-dynamic-ui/verify.mjs --legacy-libs <Egret-5.2.7-build> --engine <egret2d.mjs> --esbuild <esbuild-module> --playwright <playwright-module> --browser <chromium-executable> --out <new-directory>
```

在历史联网候选中，白鹭 5.2.33 的 UniversalIdle 同时含有业务 EXML 和 DragonBones 数据。跑通完整工程需要重新构建客户端、生成 `config.pack`，并启动游戏所依赖的 STOMP 与 MongoDB 服务。目前尚未在已有客户端源码中确认实际播放该角色的玩法。整局、存档与美术素材授权仍需独立核实。[固定版本源码](https://github.com/MoeCrow/UniversalIdle/tree/dc200eeee78318dc6d3ab9760196c9be3e8e4e41)

复跑时需固定旧浏览器构建和新引擎单文件。5.0.15 的 Wing 工程从 `egret_version` 读取 SDK 版本；5.1.9 工程需同时声明匹配的引擎和编译器版本。这两类工程声明了预加载的 tween 模块时，仍需核实业务代码实际调用的补间 API，超出支持范围的调用应列为独立适配项。

完整阶段目标见[旧工程迁移规格](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/Cns/docs/%E6%97%A7%E5%B7%A5%E7%A8%8B%E8%BF%81%E7%A7%BB.md)。
