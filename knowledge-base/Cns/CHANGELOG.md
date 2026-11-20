# 变更记录

[English](../en/CHANGELOG.md) | 简体中文

早期版本号标识工程检查点。工作区包仍使用私有版本 `0.0.0`，宿主协议为 1.0。各检查点的验收范围见其子系统契约和验证记录。

## 形状遮罩与线条渐变 — 2026-11-20

`renderEffect = { shapeMask: sprite }` 用一个 Sprite 的 Graphics 形状遮罩节点，对应白鹭 5 的 `mask = displayObject`：半透明处部分透出，位置按它是节点的子对象计算。它在 CPU 上画成一张 alpha 图，内容不变时沿用，然后在两个共享 host 上像 `alphaMask` 一样遮罩。线条可以用渐变：参数与白鹭相同的 `lineGradientStyle`，以及 `lineLinearGradientStyle` 和 `lineRadialGradientStyle`，与渐变填充一样细分。`createBrowserGame({ effects: true })` 为游戏开启渲染效果。`examples/vector-mask` 将两者与页面自身的 2D canvas 对比：WebGL2 软件渲染下每个点与它相差不超过 8。WebGPU 像素需在硬件上运行确认。

## Play3D：组、发光、灯与天气 — 2026-11-20

`game.group([a, b, c], at)` 把几个物体合成一个，作为一个物体放置、旋转、补间和判断。`thing.glow` 让物体以自己的颜色发光。`game.lamp(color, at, { intensity, range })` 加一盏点光源，可移动、可补间，用 `game.remove` 熄灭。`game.weather('snow' | 'rain' | 'none', { amount })` 让雪或雨在相机所看之处周围落下，运动在 GPU 上计算。`examples/play/lanterns3d.mjs` 是用这四项做的雪夜；Play 核对脚本把它玩到结束，在软件 WebGL2 下通过。

## 混合空间：半透明颜色按 2D canvas 的方式混合 — 2026-11-20

Host 接受 `blendSpace: 'srgb'`（其 Engine 的每一帧都会记录），按存储的颜色编码值混合半透明绘制，与 2D canvas 和白鹭 5 一致，而不是在线性光中混合：深色底上 10% 的白仍是淡淡的白。每次绘制本身的颜色不变；WebGL2 与 WebGPU 的工作目标改为 RGBA8 编码值，清屏色与发光颜色使用编码值，效果的颜色矩阵不再做转换，resolve 直接复制编码值。`createBrowserGame` 与 World3D 覆盖层可传入该选项；`play()` 与 Play3D 的界面层默认 `'srgb'`，传 `'linear'` 可改回。引擎默认仍为 `linear`，现有画面不变。`examples/blend-space` 将两种空间与页面自身的 2D canvas 对比：WebGL2 软件渲染下 `srgb` 每个方块与 canvas 相差不超过 1。WebGPU 像素需在硬件上运行确认。
## Play 第五轮后的修正：长对白分页与文档补漏 — 2026-11-20

放不下的对白现在分到后续框中显示，不再溢出面板，选项随最后一个框出现。`llms.txt` 补充说明：游戏用到的变量要在 `await play` 之前声明（setup 在它结束前运行）；`music.play` 用一个对象传更多参数；jingle 和音调对象的写法；`drawEllipse` 的定位；`bar` 可指定层；对白框不会暂停游戏；屏幕控件在第一次触摸时出现、重开时移除。这些都是三个智能体按页面写剧情游戏时报告的缺口。

## Play：图片与 3D 世界观感 — 2026-11-20

`await game.image(url, { x, y, width, height, smooth })` 以中心放置 PNG，默认平滑，缩小时使用多级缩小副本；`smooth: false` 适合像素风。Play3D 的 `game.look('day' | 'dusk' | 'night' | 'fog' | 'snow')`（或部分参数对象）一次设定背景、上下天光、太阳和雾。

## Play：屏幕控件、手柄按键与代码合成音乐 — 2026-11-20

`game.touchStick` 和 `game.touchButton` 在手机舞台上添加摇杆和按钮：摇杆计入 `keys.axis()`，按钮按住一个键，每根手指各自控制自己的控件。手柄按钮是名为 `pad:a` 等的键，十字键计入方向轴，并可操作对白框和菜单。`game.music.play(mood)` 用代码写出五种情绪的循环乐曲，`game.music.intensity` 逐步加入贝斯、鼓和旋律。第一次 `setup` 中等待的菜单或对白框现在会自行开始绘制画面，否则仍在 `setup` 结束后开始。对白框不再接收它打开之前就已按下的那次松开。

## Play：菜单、对白框、血条与提示 — 2026-11-20

`game.say` 在底部对白框里逐字显示文字，可带人物名和选项；`game.menu` 返回所选项；`game.bar` 平滑滑向数值，下降时留下残影；`game.toast` 显示会淡出的提示；`game.asking` 告诉 update 当前有对白框或菜单打开。它们都支持键盘、摇杆、指针和触摸，暂停时可用，也能在 `setup` 中等待；`setup` 等待期间现在会照常绘制画面。新示例 `examples/play/story.mjs`，由示例核对脚本玩到结束。
## 画小的图片使用多级缩小副本（mipmap） — 2026-11-20

材质设置 `mipmapFilter: 'linear'`（需配合 linear 过滤）后，画得比纹素小的图片会从页面的多级缩小副本采样，并在最近的两级之间混合。某帧第一次这样采样一个页面时，引擎按页面原有编码生成副本，两个 Host 都上传全部层级。共用图集页面的区域只读取各边都能整除的层级，不会混入相邻区域的颜色。示例：`examples/mipmaps`，WebGL2 已用软件渲染检查，WebGPU 待真机验证。

## 首页更新：7.0.1-rc.3、Play 与 Android Runtime SDK — 2026-11-20

README、文档导航和核心能力页现在说明 npm 上的当前候选版（`next`）、Play 与 Play3D 及浏览器单文件和 `llms.txt`、Android Runtime SDK 预览，并链接对应指南。核心能力页的核对点更新到 47efbb5b。

## 白鹭引擎 7.0 候选版 `v7.0.1-rc.3`

五个包发布到公共 npm 注册表，标签为 `next`：`npm install @egret/engine@next`。注册表上的包按版本号互相依赖。GitHub Release 仍保留按地址互相依赖的归档，两者包含的文件相同。[下载和安装](docs/release-archives.md)

## 白鹭引擎 7.0 候选版 `v7.0.1-rc.2`

同一标签为浏览器 2D 和 3D 单文件、五个 npm 格式归档及可编辑入门示例提供统一的发行版本号。[下载和安装](docs/release-archives.md)

## Windows WebGL2 方向光阴影接收 — 2026-11-18

采用 ANGLE D3D11 的 Windows Edge 已能正常渲染 Play3D 默认高画质场景。方向光阴影着色器通过固定向量分量获取级联距离。[真机对照](docs/play3d.md)

## 浏览器游戏工具包支持鼠标组合按键 — 2026-11-18

游戏可以在按住一个鼠标动作的同时按放另一个。Windows Edge 157 的 12 个浏览器自动化状态检查均已通过，覆盖左、中、右键及移出绑定画布后松键。[游戏工具包指南](docs/game-kit.md)

## Play 在多指触摸时保持拖动归属 — 2026-11-18

首个触点控制坐标和滑动直到本次操作结束，其他手指可独立点按 UI 控件。Galaxy Z Fold7 在 WebGL2、WebGPU 两个后端通过两种松手顺序和取消测试。[Play 指针](docs/play.md)

## Play 与 Play3D 的异步重开与关闭 — 2026-11-18

并发重开共用一次初始化及其结果。初始化失败会清理本轮已创建的场景内容，并允许重试。加载中关闭会取消待完成的启动或重开，迟到的加载结果无法重新挂接游戏对象。Play3D 的关闭结果包含 World3D Engine 的异步清理及其错误。

## Play 时间、模型和资源清理契约 — 2026-11-18

偏心模型的碰撞按实际包围盒中心推出，导入模型的旋转保留原有各轴。Play 补间与定时器、更新共同使用受暂停、时间倍率和顿帧控制的游戏时钟。移除、重开和关闭会清理内建物体的自有资源，保留借用模型和粒子池的资源归属。游戏验收工具要求输入阶段仍有帧推进，并纳入游玩脚本期间观察到的错误和请求。

## Play：模型、点击物体、循环声音、鼠标视角和手柄 — 2026-11-17

PortedGamesEgret 中每个示例游戏各自手写的部分，`play` 和 `play3d` 现在都提供了。`game.add(model)` 把任意网格、组或加载的 glTF 变成 `play3d` 的物体，包围盒由几何体算出；`game.onTap(thing)` 用相机射线找到被点中的物体。`game.sfx.loop(name)` 循环播放声音直到停止，播放中可以改音量、音高和声像；`hum` 和 `wind` 专为循环而做，音调支持 `seamless`。`game.pointer` 提供 `dx`、`dy`、`wheel`，以及用于第一人称视角的 `lock()`；`keys.axis()` 读取手柄左摇杆，`keys.look()` 读取右摇杆。

## 单文件改名为 egret2d.js 和 egret3d.js — 2026-11-17

打包工具现在写出用于 script 标签的 `egret2d.js`、用于 import 的 `egret2d.mjs`，以及包含 World3D 和 `play3d` 的 `egret3d.js` 和 `egret3d.mjs`（原来叫 `egret.global.js`、`egret.js`、`egret3d.global.js` 和 `egret3d.js`）。它还在旁边放上 `llms.txt`、许可证、NOTICE 和 robust-predicates 的许可证，所以输出目录就是一次发布要交出的内容。`play3d` 创建的地面厚度从 1 改为 8：在较慢的第一帧里落下的球曾经穿过地面。

## Play3D：一次调用做出一个完整的 3D 小游戏 — 2026-11-17

`@egret/engine/webgl2/world3d` 的 `play3d` 是下面垫了一个三维世界的 `play`：一个画在自己画布上的 World3D 应用，上面透明地画着 `play` 的按键、指针、声音、时间、文字和按钮。它增加了用普通数字摆放、可以补间的方块、球、圆柱、圆锥和地面，会跟随的相机，太阳，三维的重叠和推出，相机晃动和碎块迸出。`play` 支持 `transparent: true`。单文件打包工具另外写出包含 World3D 和 `play3d` 的 `egret3d.global.js`，gzip 后 402 KiB；`llms.txt` 增加了 3D 一节和一个 3D 游戏，示例的核对脚本会把它玩到结束。

## 第四轮之后的 Play：移除、文字颜色、按下，以及核对工具的脚本 — 2026-11-17

只凭 `llms.txt` 写了十个游戏：九个一次写成即可运行，没有一个退回浏览器原生接口。它们遇到的问题在这里修改。`game.remove` 立刻把精灵从舞台上拿掉，并在这次更新结束时才结束它，所以还拿着它的循环设置它时不会让游戏停下。文字在创建后可以设置 `color` 和 `size`；过去这样的设置会被悄悄忽略。按在按钮或带 `onTap` 的精灵上的那一下只属于它们，不再同时算作 `game.pointer.pressed`。`llms.txt` 写明了 `rotation` 的方向、`pitch` 的含义、`alpha` 为 0 仍会重叠，以及暂停会停下什么。`tools/verify-game.mjs` 可以接受一个脚本，按人的玩法把游戏玩到盲玩到不了的胜负；`examples/play/play-breakout.mjs` 就是这样一个脚本。

## Play：点击的函数可以是 async 的，Engine 上报的错误会被告知 — 2026-11-17

`game.onTap` 和 `game.button` 过去把游戏函数的返回值交给了 Engine。`async` 函数返回的是 promise，Engine 会拒绝这样的监听函数，指针输入随之结束：第一次这样的点击之后，任何点击和按钮都不再响应，也没有任何提示。现在不再转交函数的返回值；函数立即或稍后抛出的错误会像 `update` 抛出的错误一样让游戏停下。`createBrowserGame` 现在把 Engine 只能上报的错误交给 `onError`，或上报给页面并显示在控制台；过去这类错误不会告知任何人。

## 面向智能体：一个文件、一个页面、三个游戏和一个核对工具 — 2026-11-17

仓库根目录的 `llms.txt` 是智能体用 `play` 写游戏时阅读的页面：页面写法、容易出错的规则、全部调用，以及三个完整的游戏。测试把其中的每个名称与源码对照，把每个游戏与 `examples/play` 对照；该示例的核对脚本在浏览器里用键盘和鼠标把打砖块、平台跳跃和翻牌配对玩到结束。`tools/pack-single-file.mjs` 把 2D 引擎写成用于 script 标签的 `egret.global.js`（所有内容在全局对象 `Egret` 上）和用于 import 的 `egret.js`，并给出名称和大小的报告：gzip 后 197 KiB，包含两个宿主。打包器由打包的人指定，不是仓库的依赖。`tools/verify-game.mjs` 在无头浏览器里运行任意游戏页面，报告它是否启动、绘制、持续运行、响应输入并发出声音。没有向任何注册表发布。

## 绘制缩放经过零的形状 — 2026-11-17

把 `scaleX` 或 `scaleY` 补间到 0（例如翻牌）时，在到达 0 之前的最后一步是一个舍入误差大小的值。此时圆、圆角矩形、椭圆或线条比任何像素都窄，顶点的舍入使其中一些三角形翻转，准备阶段以 `precision` 拒绝它们：该帧以 `FRAME_RENDER_FAILED` 失败，游戏循环停止。现在这样的三角形被略去，帧照常绘制。纯矩形不受影响。
## WebGL2 上绘制形状时不再采样它的白色像素 — 2026-11-17

不是纯矩形的 Graphics 形状（圆、圆角矩形、多边形、线条）是铺在一个白色像素上的三角形，WebGL2 宿主过去用采样图像的着色程序绘制它：每个像素取四次样、做四次颜色解码，读到的始终是 1。现在这类形状改用绘制矩形的着色程序，不做任何采样。画面逐字节相同。在无头 Chromium 的软件 WebGL2 上，64 个圆角矩形从每秒 19 帧提高到 60 帧，由形状组成的生成游戏从 7 帧提高到 26 帧、从 11 帧提高到 37 帧。没有在真实 GPU 上测量，WebGPU 宿主未改动。

## Play：推出方向、按钮、等待缓动、重新开始 — 2026-11-17

`@egret/engine/play` 补上了十二个生成的游戏仍在手写的部分。`game.pushOut(a, b)` 给出把 `a` 移出 `b` 需要的距离，角色站在平台上用的就是它；`game.near` 做圆形判定，`game.hitsAll` 返回所有命中。`game.tween(...).done` 和 `game.wait(seconds)` 是 Promise，动画可以一步接一步。新增 `game.button`、`game.pointer.over`、`game.toFront` 和 `game.restart`。`rect` 和 `circle` 可以指定层；文字可以创建在精灵里并跟着它移动，用 `baseline: 'middle'` 垂直居中。指南补充了精灵的原点、绘制顺序、重叠时谁收到点击、文字支持 `\n` 换行，以及暂停会停下什么。

## Play：一次调用做出一个完整的小游戏 — 2026-11-17

新入口 `@egret/engine/play`。`play({ width, height, setup, update })` 创建画布、让它适应页面，并在 `setup` 完成后才开始 update。返回的 game 提供每帧可询问的键盘和指针、十二个用代码合成的音效以及用于添加更多音效的 `sfx.define`、`overlaps` 和 `hits`、`after` 和 `every`、可居中且可立即修改的文字、自动开始的缓动、`burst`、`shake`、`flash`、`hitStop`、可卷动的 `view`、可重复的随机数以及 `save`/`load`。它建立在浏览器游戏、音频和工具包入口之上，并通过 `game.browser` 保留对它们的访问。
## alpha 越界时限制在 0 到 1，不再拒绝 — 2026-11-17

超出 0 到 1 的 alpha 现在会被限制到较近的一端，显示对象以及 Graphics 的填充、线条和渐变色标都是如此。此前会抛出 `DISPLAY_VALUE_INVALID` 或 `GRAPHICS_VALUE_INVALID`，在 update 里发生时会让游戏循环停止：一次多走了一步的淡出就足以触发。不是有限数字的值仍然被拒绝。`animate` 不再对名为 `alpha` 的属性做特殊处理。

## 绘制角点贴着视口边缘的旋转图形 — 2026-11-17

旋转后的图形或精灵，如果某个角点与视口边缘只差一个舍入误差（任何四分之一圈的旋转都可能如此），裁剪出的多边形会被预处理或打包以 `precision` 拒绝；该帧以 `FRAME_RENDER_FAILED` 失败，游戏循环随之停止。现在这样的多边形会被整理后正常绘制。此前能通过的多边形，角点和各项计数都与原来完全一致。

## 修复让第一个游戏跑不起来的问题 — 2026-11-17

错误信息现在以原因结尾（`… Cause: DISPLAY_VALUE_INVALID: … Cause: RangeError: alpha was given 1.07`），被拒绝的显示属性值会说明是哪个属性、给了什么值。指针和悬停输入接受祖先被 CSS 平移或缩放的画布，例如用 `transform: translate(-50%, -50%)` 居中；拒绝时说明违反了哪条规则。`createBrowserGame` 的 label 会排队绘制，可以同时创建或修改很多个而不出现 `TEXT_CACHE_BUDGET`。`animate` 在回弹类缓动下把 alpha 限制在 0 到 1。`graphics.clear()` 返回 graphics 本身。浏览器游戏指南说明了循环何时开始、返回的对象是冻结的；World3D 应用指南里的几何体调用改为传入选项对象。

## 八盏以外的点光源按屏幕分块照明 — 2026-11-17

World3D 每帧在 WebGL2 和 WebGPU 上按屏幕分块额外照亮最多 256 盏点光源（分块前向光照），不再舍去。`renderer.info.lightsTiled` 记录数量；设置 `renderer.tiledLights = false` 恢复舍去。分块照明的灯不投射阴影。

## World3D 动画在骨架之间重定向 — 2026-11-17

`retargetAnimationClip3D` 把一套骨架的动画放到体型和骨骼朝向不同的另一套骨架上：每根骨骼相对静止姿势的转动在骨架空间中转移，根骨骼的位移按高度缩放。[World3D 动画](docs/world3d.md#动画)
## 引擎的 2D 界面叠在 World3D 场景上 — 2026-11-17

`createWorld3DOverlay(canvas, { width, height })` 在 World3D 画布上叠一块透明的 2D 舞台，并用 `createBrowserGame` 启动它，菜单、血条、文字和控件因此可以用引擎的 2D 舞台画在场景之上。落在设了 `touchEnabled` 的 2D 节点上的按下交给界面；落在界面空白处的按下、拖动、滚轮和悬停继续交给 3D 画布。[一次调用启动 3D 游戏](docs/world3d-app.md)

## 按画质选模型、无界面跑整局、IndexedDB 存档和离线资源包 — 2026-11-17

`pickQualityVariant` 和 `pickQualityFiles` 按画质选择模型或图片，缺少的档位取最近的一档。`runHeadless` 用代打玩家按种子逐局跑完游戏规则并报告每局结果。`openIndexedDBSaveStorage` 用于本地存储放不下的大存档，`openBrowserBundleCache` 保存资源包的索引和条目，离线时也能打开和读取。比首次请求范围还短的资源包现在也能打开。[游戏工具包](docs/game-kit.md)

## 绘制几乎等于单位变换的变换 — 2026-11-17

显示变换中的数值小于 2^-100 时（例如快要停下的震屏），两个共享宿主都会以 `WEBGL2_GEOMETRY_RANGE` 或 `WEBGPU_GEOMETRY_RANGE` 拒绝。现在准备几何时把这么小的数值当作零；非有限值或超过 2^20 的数值仍会被拒绝。
## 一次调用启动 World3D 游戏；拼模型、画面标记和性能读数 — 2026-11-17

`createWorld3DApp(canvas, options)` 根据地址选择 WebGL2 或 WebGPU，WebGPU 没有适配器时退回到 WebGL2；根据地址、已保存的选择或设备选出低、中、高画质；创建 Engine、渲染器和循环，并在帧率偏低时降低绘制分辨率。`pickWorld3DQuality`、`pickWorld3DBackend`、`WORLD3D_QUALITY_PRESETS` 和 `createDynamicResolution3D` 也可以单独使用。`createGeometryBuilder3D` 把摆好位置、上了颜色的零件合成一个几何体；`createScreenMarkers3D` 让网页元素跟随场景中的点，需要时贴在屏幕边缘；`createWorld3DStats` 显示性能读数。[一次调用启动 3D 游戏](docs/world3d-app.md)
## 按动作读取输入、带版本的存档、可复现的随机数、音效提示和触屏控件 — 2026-11-17

`@egret/engine/kit` 新增 `createInputActions`（覆盖按键、鼠标按钮、手柄按钮和摇杆以及屏幕控件的按钮、轴和向量动作，支持改键并保存）、`createSaveStore`（带版本和升级步骤的存档，存储已满或不可用时也不会抛出异常）、`createRandom`（带种子的 sfc32，可分叉、可保存状态）、`createAudioCues`（按名字播放音效，轮换录音、变化音高、冷却并限制同时发声数）、用于合成声音的 `encodeWav`，以及把许多资源合成一个文件、按字节范围读取的 `writeAssetBundle` 和 `openBrowserAssetBundle`。`tools/vendor-game.mjs` 把游戏所用入口加载的文件拷贝进游戏目录，并生成 import map 和 Node 加载器。`createBrowserAudio` 新增 `limiter`。`@egret/engine/web/kit` 新增 `bindBrowserInputActions`、`createTouchStick`、`createTouchButton` 和 `browserSaveStorage`。[游戏工具包](docs/game-kit.md)
## 在任何浏览器里把图片变成纹理；帧循环支持追帧 — 2026-11-17

新入口 `@egret/engine/web/kit` 提供一条宽松的图片路线，与 `@egret/engine/web/image` 中严格的 PNG 提供者并存。`decodeBrowserImage` 接受 PNG、JPEG、WebP、GIF 和 AVIF 字节，由浏览器解码；`createImageBitmap` 拒绝时退回到图片元素；超过 2D 上限的图片等比缩小而不是被拒绝。`textureFromCanvas` 把画好的画布变成纹理，`createBrowserImageTextureProvider` 把这条路线注册为资源提供者。`createBrowserFrameLoop` 新增 `catchUpSeconds`：慢的一帧在画出之前拆成若干步补上。[图片变纹理](docs/browser-images.md) · [帧循环](docs/frame-loop.md)

## World3D 保留离相机最近的灯 — 2026-11-17

点光源或聚光灯点亮的数量超过一帧的上限（八盏和四盏）时，每帧改为先保留范围照得到相机的灯，再按相机处的亮度取最亮的，不再取场景顺序里的前几盏。`renderer.info.lightsDropped` 记录其余的灯数。用加法、乘法或预乘混合创建的材质默认进入混合通道，不再画成不透明方块。[World3D 灯光](docs/world3d.md#灯光与阴影)

## World3D 分开上传实例数据 — 2026-11-17

实例的矩阵与颜色写入各自更新对应的 GPU 缓冲。Windows 上的《风雪山神庙》对照消除了每帧 17,600 字节的稳态雪花颜色上传，全帧测得的缓冲写入减少 17.4%，帧间隔 p95 仍为 4.3 ms。草块实验减少了三角形但增加了绘制调用，该路线继续使用原有单批次。[World3D 实例化与验证](docs/world3d.md#网格实例化蒙皮与变形)

## World3D 平面反射共用通道设置 — 2026-11-17

反射绘制使用自身的色调映射、阴影、图层掩码和排除子树，主视图设置保持原值。WebGL2 程序准备接受同一份通道设置。在 Windows 真机复跑《风雪山神庙》的湿石板路线时，首次进入和重返均无新链接。两次反射图和完整画面均与旧绘制路径逐像素一致。路线内三次反射绘制和六次间隔复用沿用同一张原生颜色纹理。[World3D 反射契约](docs/world3d.md#地形与水面)

## 修复 World3D 实例数量变化 — 2026-11-17

调整 `InstancedMesh3D.count` 后，裁剪包围体会按当前活跃实例重新计算。活跃范围超出当前版本已上传的前缀时，WebGL2 会刷新矩阵和颜色。在 Windows Edge 157、RTX 5090 Laptop GPU 上，两个实例的用例通过了 WebGL2 和 WebGPU 验证。只把数量从 1 改为 2 再改回 1，第二个实例会出现再消失。在它不活跃时修改数据，再次启用后的位置、颜色和透明度都符合预期。[World3D 实例化](docs/world3d.md#网格实例化蒙皮与变形)

## World3D WebGL2 程序预准备 — 2026-11-17

`preparePrograms` 可在加载期链接选定材质的场景颜色和阴影程序。在支持扩展的 WebGL2 设备上先轮询完成，再读取链接状态和 uniform。Windows RTX 5090 Laptop GPU 同机对照把首次透明材质链接移出交互，帧回调间隔从 179.2 ms 降到 4.1 ms。 新建 `CustomShader3D` 特效复用了准备好的程序，零新链接，RGBA8 像素一致。提前准备耗时 79.4 ms，首次显示帧回调间隔由 87.4 ms 降至 4.2 ms。 [World3D 契约与证据](docs/world3d.md#webgl2-程序预准备)

## WebKit 浏览器加载 PNG — 2026-11-16

默认 PNG 提供器在自建画布省略透明度或色彩空间元数据时，采用画布和像素回读的默认值。自定义端口仍须报告两个上下文属性和回读颜色空间。这一修改覆盖 `createBrowserGame` 加载的纹理和清单纹理。

Windows 上的 Playwright WebKit 26.5 复现了 `ASSET_LOAD_FAILED ← WEB_PNG_SURFACE_INVALID`。修复后，RGB 和 RGBA 直读、带摘要校验的清单加载，以及 WebGL2 上的 `game.loadTexture()` 均通过固定样本的逐像素核对。Edge 157.0.4341.46 修复前后都通过同样的检查。

iPhone 16 Pro Max（iOS 和 Safari 27.2）上的《灯影·闹天宫》原版复现了同一报错。换用已合并的引擎后，同一份游戏源码和资源在 WebGL2 和 WebGPU 上都能进入游戏。两个后端的最小用例也通过了 RGB／RGBA 样本像素、同地址纹理共享、带摘要校验的清单加载和释放检查。 [提供器契约](docs/浏览器PNG纹理Provider契约.md) · [《灯影·闹天宫》故障记录](https://github.com/cnedwin/PortedGamesEgret/pull/38) · [引擎修复](https://github.com/cnedwin/Egret_rebuild/pull/341)

## Spine：接入以预乘方式存储的图集页面 — 2026-11-16

图集页面声明 `pma: true`（Spine 纹理打包器的默认导出方式）时，以前会被 `SPINE_PAGE_ALPHA_PROFILE_FAILED` 拒绝。现在加载器为这样的页面制作一份非预乘副本并从副本绘制：红、绿、蓝各除以透明度并四舍五入，透明度为 0 的像素变为透明黑。副本按每像素四字节计入该设置的费用，由共享该设置的各组共用，并随设置一起释放。`info.pages[i].sourcePremultiplied` 现在是布尔值，标明哪些页面做了副本；此前它恒为 `false`。预乘页面在透明度为零处叠加的光不会保留；这条规则目前只有自有测试，没有来自 Editor 导出的参考。
## 组合动画场景各部分的开销 — 2026-11-16

`examples/animation-outfits/measure.mjs` 把含 20 个 Spine 实例和 200 个序列控制器的场景打开两次，每次之后对 240 步计时，分别报告动画、采集、渲染和等待完成；场景模块为此新增了 `measure` 函数。在 RTX 5090 Laptop 的 WebGPU 上，一步在 p95 下是动画 1.3 ms、采集 0.5 ms、渲染 2.1 ms，4.8 ms 内完成。由处理器绘制的 WebGL2 的结果一并记录，但不能说明显卡上的情况。这些都是单次运行，不是预算验收；显卡上的 WebGL2 没有运行，因为在隐藏的面板里 Host 等待 GPU 时超时了。
## 可安装的发行归档 — 2026-11-16

`node tools/pack-release.mjs --version <版本> --out <目录>` 为五个包各打一个归档。归档带有给定的版本，不是私有包，附带许可证和声明，并用同一发行版中各归档的地址来指明工作区里的其他包，所以 `npm install https://github.com/cnedwin/Egret_rebuild/releases/download/v<版本>/egret-engine-<版本>.tgz` 就能装上引擎及其所需。仓库里的包仍是私有的 0.0.0，不向 npm 发布任何内容。推送标签 `v<版本>` 会运行 `Release archives` 工作流：构建、打包、把归档装进干净工程并导入，再附到 GitHub release 上。`tools/verify-release.mjs` 就是这项安装检查。0.1.0-preview.1 的归档已在 Linux 上用 npm 安装并导入；工作流本身还没有运行过。

## 可读性整改后的 Windows 证据 — 2026-11-15

Windows 核查记录产品身份表、20 项历史重放工具和 67 份保存的证据文件。原始回执保留历史适用范围，当前验收依据单独标记源码身份的检查和浏览器实测。

## 新增源码文件行数提醒 — 2026-11-15

提示性 lint 任务以拉取请求的精确基线和受审的 Git 差异为依据，提示超过 600 行的新增源码及脚本。现有文件、Git 识别到的重命名、链接及已知的生成和第三方路径不计入。可在本地运行 `node tools/lint.mjs --base <commit-sha>` 查看同样的提醒。行数提醒供评审参考，不会使任务失败。

## 移除两处未使用的私有渲染导出 — 2026-11-15

移除了未使用的网格裁剪策略和旧的单顶点 UV 包装函数。共享绘制继续使用原有的裁剪与 float32 UV 校验。

## 浏览器宿主共用一个延迟结算的 Promise 辅助函数 — 2026-11-15

WebGL2 和 WebGPU 现在共用同一个私有 deferred 函数，按原顺序创建 Promise 并注册拒绝观察。WebGPU 生命周期模块保留原有导入入口，各宿主继续独立管理结算条件和资源所有权。

## sRGB 字节表统一维护来源 — 2026-11-15

以 `packages/runtime/src/srgbBytes.ts` 中的 sRGB 字节表为维护源。运行 `node tools/sync-srgb-byte-tables.mjs --write` 同步引擎中的两份副本，运行 `node tools/sync-srgb-byte-tables.mjs --check` 检查差异。各模块保留自己的字面量和导入边界。现有数值测试继续按已记录的摘要核对全部 256 个值。

## 移除未使用的位图放置辅助模块 — 2026-11-15

私有模块 `bitmapAtlasPlacement.ts` 已无当前调用。图集类型检查仍拒绝通过运行时公开入口导入该辅助函数。重新构建删去了四个私有产物，其余 1,636 个产物逐字节一致。既有验收回执和精确复现记录保留当时的源码路径。

## WebGPU Host 图像驻留规划拆分 — 2026-11-15

WebGPU Host 把图像需求和淘汰对象的选择移入私有模块，代次校验、图像上传、租约提升、资源回收及提交仍由 Host 管理。公开声明、图像预算和淘汰顺序保持一致。

## 独立组织 WebGL2 缓存图层准备 — 2026-11-15

WebGL2 私有模块集中组织缓存图层限制、位置和光照校验及程序绑定。宿主继续负责提交、程序缓存发布、设备代次检查和图层回收。现有公开入口、类型声明和原生调用顺序保持一致。

## World3D WebGPU 数据打包使用内部模块 — 2026-11-15

顶点转换、变形数据存储、线框索引和对象变形区块移入统一的内部模块。缓冲复用、缓存版本、分配上限、渲染提交和公开声明均沿用现有渲染器。

## World3D WebGL2 材质设置拆分 — 2026-11-15

WebGL2 渲染器通过私有模块 `materialWebGL23D` 生成着色器变体定义，并设置材质 uniform 和纹理绑定。程序缓存、渲染阶段顺序、上下文恢复和资源释放由渲染器管理。`WebGL2Renderer3D.ts` 从 1,308 行缩减为 1,108 行。原有构建声明逐字节一致。

## World3D 物理查询使用独立内部模块 — 2026-11-15

World3D 的静态物体树和形状级射线检测移入内部查询模块。物理世界把现有的网格法线临时数组传给射线检测，复合形状的递归检测继续共用该数组。此次拆分保持查询顺序、求解逻辑和公开声明一致。

## UI 根模块独立组织私有显示准备 — 2026-11-15

UI 根模块继续负责事务、版本校验、取消和清理。私有模块集中组织数据模型、校验函数和提交前的显示准备，保留现有公开入口、类型声明、绘制顺序和释放顺序。

## 源码 lint 提示性检查 — 2026-11-15

用 `npm ci --ignore-scripts --prefix tools/format` 安装锁定版本后，运行 `node tools/lint.mjs`。独立的 Biome 配置用推荐规则检查各包的 TypeScript 源码。认知复杂度阈值为 30，引擎渲染和 Web 目录为 60。报告列出总数并最多显示 12 条诊断。诊断作为提示，安装、配置或源码解析失败仍会使 lint 任务失败。

## 部分测试脚本使用源码格式化工具 — 2026-11-15

Biome 2.6.7 检查 165 个测试模块，其中 163 个发生排版变更。所选文件中超过 120 字符的行从 5,340 行减至 953 行。变更文件的 JavaScript 语法树、标准化源码和注释逐项一致。固定源码身份的测试脚本、按原文字面断言的脚本及编译诊断夹具保留原始字节。格式化上限可覆盖现有 1.6 MiB 的增量检查测试，Source layout 工作流已纳入本轮选择的测试。

## 部分工具脚本使用源码格式化工具 — 2026-11-15

Biome 2.6.7 格式化了 36 个工具脚本。这些脚本中超过 120 字符的行从 622 行减至 64 行。逐文件核对确认语法树和标准化 JavaScript 一致，注释文字也逐项核对。其余 88 个脚本保留原始字节，以维护精确源码检查、固定哈希和原生验证输入。现有 Source layout 工作流已覆盖本轮纳入的工具脚本。

## 示例脚本使用源码格式化工具 — 2026-11-15

Biome 2.6.7 格式化了 169 个示例脚本。统计仓库跟踪的 171 个示例 `.mjs` 文件，超过 120 字符的行从 3,787 行减至 186 行。语法对比确认所有排版前后的脚本行为一致，其中两处省略括号的差异也已核对。以后修改示例脚本时也会触发 Source layout 检查。

## 引擎源码改由格式化工具排版 — 2026-11-15

Biome 2.6.7 对 `packages/*/src`、`packages/*/web` 和 `packages/*/rendering` 下的 408 个 TypeScript 源文件排版：两个空格缩进，每行最多 120 个字符，引号沿用各文件原来的风格。有 369 个文件发生变化；总行数从 70,423 增加到 110,781，超过 120 个字符的行从 6,281 减少到 320。行为没有变化：410 个构建出的 `.js` 文件，去掉注释和排版后按语法树重新打印，文本与之前逐一相同；410 个类型声明文件中有一个不同，差别是一对含义相同的括号。`node tools/format.mjs` 执行排版，有文件未按格式排版时 `Source layout` 工作流会让 PR 失败。格式化工具从 `tools/format` 下它自己的锁文件安装，独立于工作区，因为工作区的锁文件被多项检查逐字节固定。边界检查中有三处按旧的空格或引号保存的源码文本已改为现在的写法；错误码扫描器现在能跟踪跨多行书写的辅助函数，因此多找到 19 个之前漏掉的错误码。构建产物的字节是新的，所以绑定在旧字节上的证据在重新取证之前不再成立。

## 根据类型声明生成的 API 参考，以及与契约分开的使用指南 — 2026-11-15

`knowledge-base/*/docs/api-reference.md` 列出 `@egret/engine` 40 个入口各自导出的全部名字，共 1,131 个，附种类和源码中写在它上方的第一句说明。`node tools/api-reference.mjs` 根据构建出的类型声明生成它，`tests/api-reference.test.mjs` 在它过期或有名字找不到时失败。它也显示了缺口：有 707 个导出在源码里还没有说明。知识库索引现在以写游戏用的指南开头，与契约和计划分开。

## Graphics：平滑边缘，以及渐变的开销 — 2026-11-15

`graphics.smoothing = 1` 让之后绘制的每个形状和线条在边缘 1 个单位内渐隐到透明，不再以像素阶梯结束。它是形状外围的一圈三角形带，轮廓每条边两个三角形，所以两种 Host 都像绘制普通形状一样绘制它；默认关闭，取值 0 到 8 个单位。带线条的填充自己没有这圈带；只画填充矩形的 sprite 和图片填充也没有。Graphics 指南现在给出了实际统计的渐变三角形数量：按钮和面板上的线性渐变是 40 到 234 个，径向渐变是 2,514 到 15,296 个。

## 更清楚的错误说明，对照表多列出 160 个错误码，还清三笔欠账 — 2026-11-15

原先拼成 "This has not been started: a tween." 的英文说明现在是 "A tween has not been started."，共改了 29 个模板。错误码对照表现在会跟踪各部分抛错用的辅助函数，从 702 个错误码增加到 862 个；其中 48 个原本只会得到兜底句的错误码，都写了中英文说明。Spine 的 web 加载器以前抛出以错误码为 message 的普通 `Error`，现在是 `EgretError`。渐变在两个字节之间的颜色改为从写定的 sRGB 表中插值，不再用幂运算，所以在任何 JavaScript 引擎上都是同一个数，与曲线的差在 1e-5 以内。形状的共享几何体改为用一个混合出来的短键查找并逐个数字核对，不再用和绘图一样长的键。`tests/types/game.ts` 按游戏会写的调用对 `@egret/engine/web/game` 做类型编译，并发现入口漏导出了三个类型：`BrowserGameFit`、`BrowserGameLabel` 和 `BrowserGameLabelOptions`，现已导出。

## 显示对象有了 skew、name、width 和 height；游戏可以适配容器并有了文本标签 — 2026-11-15

`skewX` 和 `skewY`（角度）在旋转之上让显示对象的两条轴倾斜。`name` 和 `container.getChildByName(name)` 用来查找子对象。`width` 和 `height` 是对象在父级上的大小，设置其中一个会设置 `scaleX` 或 `scaleY`。`createBrowserGame` 增加 `fit`：`'contain'`、`'cover'` 或 `'stretch'` 把画布放进它的元素，并在元素大小变化时重新调整。`game.createLabel({ text, fontSize, color })` 创建一行文本，它的 `text` 可以像普通值一样设置。起步示例用中文标签显示分数，它的核对脚本用软件 WebGL2 覆盖了三种适配方式和标签。仍然没有非矩形遮罩。

## 一条链写动画，一次调用加载图片 — 2026-11-15

`animate(engine, scope, object).to({ x: 100, alpha: 0 }, 0.5, 'quadOut').wait(0.2).call(fn).loop(2).start()` 让一个对象的多个数字一起变化，一步接一步，运行在 Engine 的时钟上；有 21 种按名字选择的缓动函数，也可以传函数。它建立在标量缓动之上，标量缓动保持不变。动画随它的作用域结束，对象被销毁时也会结束。`createBrowserGame` 的 `game.loadTexture(url)` 加载一张 PNG 并给出纹理的租约；`game.host` 是 Host。起步示例在拾取金币时让它淡出，加上 `?image=` 会加载一张图片并统计在它上面的点击。一处更正：此前写软件 WebGPU 适配器“绘制了若干帧且没有失败”，说得比实际看到的多。在这里该适配器会丢失设备或永远画不完一帧；起步示例的核对现在覆盖浏览器没有适配器的两种情况，并说明选中 WebGPU 的情况没有核对。

## 画出来的按钮在画的地方被命中，点击是一个事件 — 2026-11-15

开启 `touchEnabled` 但没有 `hitArea` 的显示对象以前永远不会被命中。现在它按自己画出的内容命中：形状的某个三角形、某个填充矩形，或位图的矩形。圆不会在边界矩形的角上被命中，孔也不会被命中。设置了 `hitArea` 时仍然使用它。指针输入增加了第四个事件 `events.tap`：接触在它开始时所在的目标上结束，且距开始位置不超过 12 个舞台单位时派发。现在一个按钮只需要 `touchEnabled = true` 加一个监听器。参见[指针输入](docs/multi-pointer-input.md)。

## Graphics：图片填充 — 2026-11-15

`beginBitmapFill(lease, matrix, repeat)` 用图片填充形状或路径，默认重复；`matrix` 决定图片在 sprite 中的位置。图片填充是以该图片为纹理的单独网格，所以一个 sprite 的绘图现在是按绘制顺序排列的最多 16 个网格，而不再总是一个。纹理必须是一整张图片，不能是图集的一部分；重复的图片最远只画到距起点 8,192 个自身像素处。绘图示例用一张 8 像素的图片填充了一个圆角面板，它的核对脚本用软件 WebGL2 从画布上读取了其中四个重复的方格。至此 Graphics 原先缺少的部分只剩线条渐变。参见[绘图指南](docs/graphics.md)。迁移对照表原先写租约用 `dispose()` 结束，实际是 `release()`，现已改正。

## 运行时中文错误说明，不再有兜底句 — 2026-11-15

调用 `@egret/engine` 的 `setErrorLanguage('zh')` 之后创建的错误，message 里是中文说明；`error.code` 在两种语言下相同。`describeErrorCode(code, 'en' | 'zh')` 把某个错误码的说明交给程序。原来只有某部分出现问题：xxx这种兜底句的 37 个错误码，现在都有了专门写的中英文说明，并且测试会拒绝新出现的、只能落到兜底句的错误码。`TWEEN_OPTIONS_INVALID` 的说明原先提到了缓动没有的选项，现在写的是 `from`、`to`、`durationSeconds` 和 `onUpdate`。中文说明从文档工具移到了运行时，所以[错误码对照表](docs/error-codes.md)和 message 是同一份文字。

## 白鹭 5 API 到本 SDK 的对照表 — 2026-11-15

[从白鹭 5 到本 SDK](docs/egret-api-migration.md)逐个调用说明 `egret.runEgret`、`egret.Shape`、`TouchEvent`、`egret.Tween`、`RES`、`egret.TextField`、`eui` 等换成什么，以及哪些没有提供：skew、`name`、非矩形遮罩、`cacheAsBitmap`、缓动链式调用、EXML 和 DragonBones。开头是每个文件里都不同的五件事，结尾是同一个界面的两种写法。每一行的新写法都对照本仓库核对过；写这份对照表时没有实际转换过白鹭 5 工程。

## 一次调用启动页面里的游戏，并带有显示开销的面板 — 2026-11-15

`@egret/engine/web/game` 提供 `createBrowserGame({ canvas, width, height, update })`。浏览器能给出适配器时它选择 WebGPU，否则选择 WebGL2，并创建 Host、Engine、作用域、指针和键盘输入以及帧循环，每一样都与各自入口创建的相同；`game.dispose()` 一并结束它们。给 `stats: true` 时，画布上方会出现一个面板，显示每秒帧数、相邻两帧的最长间隔、一帧的命令数和三角形数，以及 Host 持有的帧数和循环跳过的帧数；自己启动的游戏可以用 `createBrowserStatsPanel` 创建这个面板。起步示例现在用这种方式启动，加上 `?stats` 可以看到面板。面板统计的是 Engine 的命令数，不是 Host 的绘制调用次数。参见[一次调用启动页面里的游戏](docs/browser-game.md)。

## 一帧可容纳 4,096 份不同的绘图，不再是 128 份 — 2026-11-15

以前一帧只接受 128 个不同的几何体，所以 200 个各画一个不同大小圆的 sprite 会以 `FRAME_BUDGET_EXCEEDED` 被拒绝。这张表现在可容纳 4,096 个，与一帧的区域数相同。一帧的开销仍由其他上限约束：65,536 个网格三角形和 16 MiB 的几何数据。Host 不为每个几何体保留任何东西，所以其他行为不变。绘图示例加上 `&many=300` 会画 300 个大小不同的圆，它的核对脚本用软件 WebGL2 从画布上读取这些圆。

## Graphics：线条端点与转角、虚线、孔和渐变 — 2026-11-15

`lineStyle` 增加第四个参数：`caps`（`'none'`、`'round'`、`'square'`）、`joints`（`'miter'`、`'round'`、`'bevel'`）、`miterLimit` 和 `dash`。`beginLinearGradientFill` 和 `beginRadialGradientFill` 用 2 到 16 个色标的渐变填充，按 sRGB 数值混合；`beginGradientFill` 接受旧代码传入的颜色、透明度、比例和矩阵。同一条路径的各部分现在按非零规则一起填充：画在另一部分内部且方向相反的部分是一个孔，互相重叠的部分和自相交的轮廓只涂一次。对按第一版写的代码有三处变化：路径的各部分以前是各自单独填充的；超过四个半宽的尖角现在改为平切，而不是缩短；线条的两段现在在内侧共用一点、外侧单独绘制，所以带转角的线条顶点更多。尚不支持位图填充和线条渐变。参见[绘图指南](docs/graphics.md)。

## 错误会说明发生了什么 — 2026-11-15

以前 `EgretError` 的 message 就是错误码本身，控制台上的 `FRAME_RENDER_FAILED` 什么也没说明。现在 message 是错误码加一句说明：出了什么问题；对游戏最常遇到的错误码，还会说明该怎么做。`error.code` 不变，程序仍然用它来比较。新增的[错误码对照表](docs/error-codes.md)按部分列出 696 个错误码及其中文含义；它由 `node tools/error-codes.mjs` 根据源码生成，新增错误码而没有说明、或者对照表落后于源码时，测试会失败。以前用 `error.message` 与错误码比较的程序，要改为比较 `error.code`。
## Graphics：圆、圆角矩形、路径、曲线和线条 — 2026-11-15

sprite 的 `graphics` 现在可以绘制 `drawCircle`、`drawEllipse`、`drawRoundRect`，用 `moveTo`、`lineTo`、`curveTo`、`cubicCurveTo` 和 `drawArc` 绘制路径，用 `lineStyle` 绘制线条，方法名与白鹭一致。以前它只能画填充矩形。只画填充矩形的 sprite 没有变化；任何其他形状都会把它的绘图变成一个由带颜色三角形组成的网格，和其他内容一样跟随 sprite。曲线是与真实曲线相差不超过四分之一单位的直线段，边缘没有抗锯齿，线条是平头端点和尖角转角。绘图相同的 sprite 共用一份绘图；一帧可容纳 128 份不同的绘图。在 Node 中验证，并在无头 Chromium 的软件 WebGL2 中从画布验证；未运行 WebGPU。属于 #289。[指南](docs/graphics.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/graphics/README.zh-CN.md)
## 页面中游戏的帧循环 — 2026-11-15

`@egret/engine/web/loop` 提供 `createBrowserFrameLoop`：显示器每显示一帧，它就推进 Engine 的时钟、调用 `update(seconds)` 并绘制。一步不会超过 `maxStepSeconds`，所以标签页被隐藏后回来，时钟不再拒绝这段时间。Host 已持有它能接受的帧数时，这一帧被跳过并计数，所以慢设备不再让手写循环以 `FRAME_RENDER_FAILED` 结束。起步示例已改用它。在 Node 中验证，并通过起步示例在无头 Chromium 的软件 WebGL2 中验证；未运行 WebGPU。属于 #289。[指南](docs/frame-loop.md)

## 起步示例和入口对照页 — 2026-11-15

`examples/starter` 是一个约一百行的 2D 游戏起点：Host、Engine、作用域、舞台、指针和键盘输入，以及在 Host 已持有两帧时跳过一帧的帧循环。它在无头 Chromium 的软件 WebGL2 中从画布核对；未运行 WebGPU。[该引哪个入口](docs/entry-points.md)按要做的事列出 `@egret/engine` 的 38 个入口该用哪一个。属于 #289。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.zh-CN.md)

## 所有 JavaScript 引擎里颜色一致 — 2026-11-15

sRGB 字节对应的线性光值，现在是一张写明的 256 个数的表。矩形填充、位图文本和粒子的着色、发光颜色、清屏颜色都读这张表。以前它是运行时计算的幂，而不同 JavaScript 引擎算出的幂在最后一位上不同：Node 22 和 Node 26 对部分字节给出不同的数，所以同一场景预处理出的帧在两者中并不相同。表里是 Node 26 算出的值，所以在 Node 26 上没有任何变化。`tests/shared-frame-golden.test.mjs` 现在在 Node 22 上也能重现摘要。属于 #289。

## 捕获时保留已移动节点的矩形 — 2026-11-14

移动过的节点会保留其图元和位图的矩形。矩形的值与矩阵无关，每个矩形都会在新矩阵下重新检查。帧和拒绝结果都没有变化。捕获 5,000 个移动中的矩形，从 3.9 ms 降到 3.2 ms。属于 #266。[详情](docs/显示树扩展性.md#移动节点的矩形)

## 共享预处理中每个角点的检查更少 — 2026-11-14

用于限定绘制纹理坐标的采样域，改为每次绘制求一次，而不是每个角点求一次。顶点行阶段改为通过求和，检查一个角点的 13 个值是否都是有限值。检查内容、顺序和拒绝结果都没有变化。对 5,000 个位图，一帧的裁剪几何从 4.2 ms 降到 3.7 ms，顶点行从 3.2 ms 降到 2.3 ms。属于 #266。[详情](docs/显示树扩展性.md#纹理坐标与有限值检查)

## 无旋转四边形的裁剪几何提速 — 2026-11-14

无旋转、无切变放置的矩形和位图，跳过裁剪几何阶段的方向测试和规范化测试。这些测试的结果事先可知，该阶段改为一次性记入相同的计数。无法证明结果相同的情况仍交给通用路径。几何、计数和拒绝都没有变化。在 `tools/bench-2d.mjs` 中，同一图集的 5,000 个位图从 11.8 ms 降到 5.3 ms，20,000 个矩形从 44 ms 降到 34 ms。属于 #266。[详情](docs/显示树扩展性.md#无旋转的四边形)

## 作为显示对象的视频 — 2026-11-14

`@egret/engine/video` 把源的画面作为显示对象显示：每帧新画面都通过引擎的资源系统成为一个 Bitmap 的纹理，并释放上一帧。`update()` 每帧取最新画面，不会堆积画面。`@egret/engine/web/video` 从页面的视频元素创建源——文件、流（例如画布或摄像头的流）或页面自己的元素——按不超过 `maxWidth` 的尺寸读回每一帧呈现的画面。新示例 `examples/video` 实时显示画布的流，并回放页面录制的四秒 WebM，在无头 Chromium 的软件 WebGL2 中从画布核对。每帧画面都被完整读回并上传；直接送到 GPU 的路径不在本次改动中。属于 #266。[指南](docs/video.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/video/README.zh-CN.md)

## Spine 二进制骨骼 — 2026-11-14

`@egret/spine` 在 JSON 之外接受二进制骨骼（`egret.spine-binary`、`spine-binary/4.3-1`、`application/octet-stream`，最大 4 MiB）。它们由 Core 自己的二进制读取器通过受约束的准入读取：每个数量、索引和字符串长度都必须能放进文件剩余的字节，Core 创建的数值存储按文件大小设定的预算计费，因此伪造的数量会在创建存储之前被拒绝。工厂会得知二进制绑定的种类，元数据 provider 给出其字节，浏览器加载器保持字节形式。二进制骨骼与对应 JSON 得到相同的设置，并在相同时间得到相同的姿态。其测试数据由测试按二进制格式写出，不是由 Spine 编辑器保存的。属于 #266。[指南](docs/spine-content-ingress.md)

## 滤镜：颜色矩阵、发光、投影和描边 — 2026-11-14

`DisplayObject.renderEffect` 支持 Egret 的二十数 `colorMatrix`、`glow`（对应 Egret 的 GlowFilter，可设 `inner`、`knockout`，带偏移即为投影）以及宽度最多 8 像素的 `outline`。它们在现有效果组中位于模糊之后执行，两个共享宿主都支持：新增一个通道把组的 alpha 横向扩散到临时目标，合成时再纵向扩散，并在所见颜色上应用矩阵，把发光绘制在组的下方或内部。每组 uniform 从 448 字节增至 576 字节，其他上限不变。新示例 `examples/filters` 在无头 Chromium 的软件 WebGL2 中，于六个方块周围各十六处与独立算出的值核对；这里没有在浏览器中绘制 WebGPU。属于 #266。[指南](docs/filters.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/filters/README.zh-CN.md)

## 沿用 Egret 名称的混合模式 — 2026-11-14

`DisplayObject.blendMode` 可取 `normal`、`add`、`multiply`、`screen` 或 `erase`，作用于对象及其子对象，除非子对象设置了自己的模式。它就是对象共享材质的混合方式，因此着色会保留。`erase` 是材质合同中新增的混合方式，两个宿主都支持：绘制的内容按其 alpha 从目标中擦除。粒子和位图文字可用 `display.blendMode = 'add'` 发光。新示例 `examples/blend-modes` 在无头 Chromium 的软件 WebGL2 中逐像素与每个公式核对；这里没有在浏览器中绘制 WebGPU。属于 #266。[指南](docs/blend-modes.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/blend-modes/README.zh-CN.md)

## 粒子颜色按所见颜色显示 — 2026-11-14

`@egret/engine/particles` 的颜色现在像位图文字的着色一样，以渲染器的线性光照交给渲染器，所以白色粒子纹理显示为所给的颜色；此前着色显示得比所给颜色更浅。这是在浏览器中检查位图文字着色时发现的。属于 #266。[指南](docs/particles.md)

## 位图字体 — 2026-11-14

`@egret/engine/bitmapfont` 是可选入口。`parseBitmapFont` 读取 BMFont 的文本、XML 和 JSON 格式（AngelCode 生成器、Hiero、Glyph Designer 和 Littera 保存的格式），以及 Egret 纹理合并工具写出的帧格式字体，并用各自的代码拒绝无法读取的内容。`layoutBitmapText` 按字体的字距调整、行距和字间距排版，按宽度在空格之后和表意文字之间换行——不在 `，。！？」` 等闭合标点之前换行——并左、中、右对齐。`createBitmapText` 按字体的每一页把文字绘制为一个网格，以所见颜色着色，并在文字或选项改变时重新排版。新示例 `examples/bitmap-font` 用页面绘制的两种字体显示标题、对话框和得分。已在 Node、真实引擎和无头 Chromium 的软件 WebGL2 中验证；没有读取由生成工具本身保存的字体。属于 #266。[指南](docs/bitmap-font.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-font/README.zh-CN.md)

## 2D 碰撞与简单物理 — 2026-11-14

`@egret/engine/physics2d` 是可选入口。由圆、矩形和凸多边形组成的世界——刚体可以是动态、运动学或静态的——在重力下按固定步长推进，按质量用弹性和摩擦把刚体推开，让堆叠稳定下来，并在速度低于阈值时不再弹起，使静止的东西保持静止。它通知接触的开始和结束（传感器也一样），按层和掩码过滤，并能查询某个点、某个矩形内以及射线上第一个遇到的刚体。`moveAndSlide` 移动角色，使其沿墙滑动而不会穿墙；`addTileColliders` 把网格的实心格子合并成少量静态矩形。刚体不会自行旋转。新示例 `examples/physics-2d` 是一间有弟子、石头、斜坡和池塘的练功房。已在 Node 和无头 Chromium 的软件 WebGL2 中验证；没有运行硬件 GPU 或手机。属于 #266。[指南](docs/physics-2d.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/physics-2d/README.zh-CN.md)

## 2D 粒子 — 2026-11-14

`@egret/engine/particles` 是可选入口。发射器按速率、成批或在一段时间内产生粒子；每个粒子在点、矩形或圆内出生，以某个角度和速度出发，在任意步长下都以同样方式受重力和阻力影响，并从出生时的缩放、颜色、透明度和旋转过渡到消亡时的值。一个发射器的粒子在共享渲染器上以一张纹理绘制为一个网格，每次更新重建；同样的种子产生同样的粒子。新示例 `examples/particles` 有燃烧的火盆、飘落的花瓣和点击处迸出的火花。已在 Node 中的真实引擎上和无头 Chromium 的软件 WebGL2 中验证；没有运行硬件 GPU 或手机，目前也还没有加法混合。属于 #266。[指南](docs/particles.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/particles/README.zh-CN.md)

## 瓦片地图，以及用 Tiled 制作的地图 — 2026-11-14

`@egret/engine/tilemap` 是可选入口。`importTiledMap` 把 Tiled 以 JSON 保存的正交地图——有限或无限、以数组或不压缩 base64 保存的图块层、地图内或单独文件中的图块集、分组、对象层、属性，以及作为数据的图块动画——读成冻结的数据，并用各自的代码拒绝无法读取的内容。`createTileMap` 用图块集的图片把图块层绘制成网格区块，每个区块每个图块集一个网格，支持边距、间距、翻转和比格子高的图块；可以按格子读取和修改图块，只重新绘制所在区块，并只显示与视野相交的区块。新示例 `examples/tilemap` 让一名弟子在 64×40 格的庭院中行走，并通过相机观看。已在 Node 中的真实引擎上和无头 Chromium 的软件 WebGL2 中验证；示例地图由脚本按 Tiled 的格式写出，不是 Tiled 本身保存的。属于 #266。[指南](docs/tilemap.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/tilemap/README.zh-CN.md)

## 2D 相机 — 2026-11-14

`@egret/engine/camera` 是观察 2D 世界的可选视图。它设置装着世界的容器，让世界从相机看的位置呈现出来；可以跟随世界中任意位置的目标，平滑程度与帧率无关，并带有死区；停留在边界之内；围绕视图中心缩放和旋转；平移到某处；沿带种子的平滑噪声震动并逐渐平息；并让世界前后的图层以各自的速度和缩放比例移动。它能双向换算坐标，并判断什么能被看见。新示例 `examples/camera-2d` 让一名弟子在庭院里行走。已在 Node 中用真实显示树验证，并在无头 Chromium 和软件 WebGL2 中验证；没有运行硬件 GPU 或手机。属于 #266。[指南](docs/camera-2d.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/camera-2d/README.zh-CN.md)

## 手柄 — 2026-11-14

两个可选入口用于读取手柄。`@egret/engine/input/gamepad` 接收每次查看时手柄的状态，告知每次按下、每次松开以及每个接入或被拔掉的手柄；按键按标准布局中的位置读取，摇杆带有死区。`bindGamepadKeys` 用手柄驱动键盘输入，所以能响应按键的 UI 就能响应手柄：十字键和左摇杆是方向键，在没有控件接收时移动焦点，`a` 是 Enter，`b` 是 Escape，肩键移动焦点，方向在按住时重复。`@egret/engine/web/gamepad` 每帧读取一次网页上的手柄，在页面隐藏或窗口失去焦点时松开所有按键，并能让支持震动的手柄震动。控件示例可以用手柄操作。已在 Node 和无头 Chromium 中用脚本写出的手柄列表验证；没有人握过手柄。属于 #266。[指南](docs/gamepad.md)

## 以流的方式播放长音乐 — 2026-11-14

`mixer.stream(url)` 打开一个边读边播的文件，所以长音乐不会在内存中保留已解码的样本。流和其他声音一样：可以作为音乐，可以渐变、暂停和调节音量。它同一时间只有一个发声位，并自己给出播放位置。在网页上，它是一个被接入音频图的媒体元素；因为输出挂起并不会让它停下，所以只要输出不在运行，适配器就暂停它，并在第一次触碰中启动它。页面在同一轮里隐藏又显示，或游戏在同一轮里暂停又恢复，现在最终都会有声音：即使输出仍在运行，也会请求它再次运行，这样正在途中的挂起就不会成为最后的结果。已在 Node 和无头 Chromium 中用浏览器自己的媒体元素验证；没有运行手机、Safari 或 Firefox。属于 #266。[指南](docs/audio.md#以流的方式播放长音乐)

## 2D 游戏的声音 — 2026-11-14

两个可选入口为 2D 游戏提供声音。`@egret/engine/audio` 是不依赖 DOM 的混音器：从字节解码并计入预算的声音；带有音量、速率、左右平衡、渐变、暂停和播放位置的发声位；同一时间只有一首、并以渐变让位给下一首的音乐；总音量之下若干个有名字的音量；以及让最早的发声位让位的上限。`@egret/engine/web/audio` 是它基于 Web Audio 的后端：在第一次点击、按键或轻触允许页面发声之前，混音器保持锁定；页面隐藏期间保持静音。引擎的 scope 可以拥有混音器和声音。新示例 `examples/audio-mixer` 播放由页面生成的音乐和音效。已在 Node 和无头 Chromium 中验证，并测量了浏览器渲染出的样本；没有任何东西去听扬声器，也没有运行手机、Safari 或 Firefox。长音乐是整体解码的：以流的方式播放不在这一步之内。[指南](docs/audio.md) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/audio-mixer/README.zh-CN.md)

## 从哪个界面示例开始 — 2026-11-14

新增一页，按界面的内容列出各个 UI 示例：控件、文本框、设置、标签页、长列表、行的下拉选择和菜单、多行选择、可排序的表格、树、行囊和按步分配的数量。它说明这些示例的共同点，以及界面完成之前应该检查什么，其中每一条都曾是某个示例里发现的缺陷。只涉及文档。属于 #90。[指南](docs/ui-examples.md)

## 可展开和收起的树，以及标题 — 2026-11-14

语义树新增 `tree`、`treeitem` 和 `heading` 三个角色，并用 `level` 表示项目的深度和标题的级别；`createUiListSemantics` 接受 `role: 'tree'`：显示出来的行就是树的项目，各自带有它说明的深度，以及在同一父项目之下的位置。新示例 `examples/ui-tree` 是一个由堂口、队伍和成员组成的门派，可以用按下和方向键展开、收起，上方有一个标题。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#树) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tree/README.zh-CN.md)

## 可排序的托管列表表格 — 2026-11-14

`createUiListSemantics` 接受 `role: 'grid'` 以及 `columns` 和 `rowOffset`：托管列表的行作为网格的行发布，应用在每一行里添加单元格，并在它们上方添加一行表头，`rowBounds` 让单元格可以根据所在的行来度量。语义树新增带 `sort` 的 `columnheader`；`row` 和 `gridcell` 只有在自己是被选中的对象时才说明 `selected`。新示例 `examples/ui-roster-table` 通过表头按四列对四十名成员排序，并可以选中一行。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#托管列表的表格) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-roster-table/README.zh-CN.md)

## 数据源替换之后，滚动到列表当前所在的位置 — 2026-11-14

托管列表的 `setScrollOffset` 会丢弃滚动到列表当前偏移的请求，即使同一轮里还有一次数据源替换在等待提交。列表随后跟随锚点去了另一个偏移，这违反了“显式滚动覆盖锚点保留”的规则：处于顶部的列表在换了新的顺序并被要求留在顶部之后，并没有留在顶部。现在只要还有其他变更待提交，这样的滚动就会被保留。已在 Node 中用真实 Engine 和 UI 根检查。属于 #87。[指南](docs/ui-data-panel.md)

## 单元格网格，以及一个行囊 — 2026-11-14

语义树新增 `grid`、`row` 和 `gridcell` 三个角色，并用 `extent` 表示网格的行数和列数；浏览器投射会连同行列数和序号一起写出它们。新示例 `examples/ui-inventory` 是一个二十四格的行囊：一个键盘停靠点，带有由方向键、Home、End、Page Up 和 Page Down 沿两个方向移动的光标，一个显示光标所在物品的面板，使用、丢弃和整理三个按钮，以及一行 status。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#网格) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-inventory/README.zh-CN.md)

## 经过无法获得焦点的按钮时，Tab 可以离开画布 — 2026-11-14

浏览器投射为每个可按下的节点生成一个原生按钮，但只有在节点可以应请求获得焦点时，才把它标记为非 Tab 停靠点。于是被禁用的按钮，或者没有焦点动作的按钮，成了页面的停靠点：过了应用的最后一个停靠点，Tab 落在这个隐藏的元素上，投射又把焦点交还给画布，键盘因此无法离开画布。现在每个原生按钮从一开始就带有 `tabindex="-1"`。在 `examples/ui-multi-select` 和 `examples/ui-tabs` 中，被禁用的按钮也不再是应用的停靠点。已在 Node 中检查，并在无头 Chromium 的软件 WebGL2 上用 Tab 键实际走出画布。属于 #90。[指南](docs/ui-semantics.md#投射)

## 按步改变的数量，以及会被朗读的消息 — 2026-11-14

语义树新增 `spinbutton`、`status` 和 `alert` 三个角色，浏览器投射会写出它们：带有范围、按步改变的数量，以及文字变化时由读屏软件朗读的两种消息。新示例 `examples/ui-stepper` 用范围的按键和两侧的按钮把一个固定的总数分给四个数量，说明还剩多少，并说明某个数量为什么没有增加。已在 Node 和无头 Chromium 的软件 WebGL2 上检查；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#消息) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-stepper/README.zh-CN.md)

## 两个示例的弹出层在第一次打开之前 — 2026-11-14

`examples/ui-dropdown` 和 `examples/ui-context-menu` 中的弹出层原先只在第一次打开时才注册为层。在那之前，它的根只是一个普通的根：被绘制在舞台左上角，它的行也是键盘停靠点。现在两个示例都在开始时以关闭状态注册它，菜单示例的按钮在被禁用期间也不再是键盘停靠点。语义树自始至终是正确的，所以原有的检查没有发现问题；现在检查会在任何东西打开之前读取屏幕角落的颜色，并走一遍 Tab 顺序。只涉及示例。属于 #90。[指南](docs/ui-layers.md#生命周期与示例)

## 行的动作菜单 — 2026-11-14

语义树新增 `menu` 和 `menuitem` 两个角色，`createUiListSemantics` 接受 `role: 'menu'`，于是弹出层里的托管列表会作为菜单告知辅助技术，其中的菜单项可以执行，或说明自己不能执行。新示例 `examples/ui-context-menu` 把这样的菜单挂在滚动名册的行上，用鼠标右键、菜单键、Shift+F10、一个按钮或一次请求打开。已在 Node 和无头 Chromium 的软件 WebGL2 上检查。属于 #90。[指南](docs/ui-semantics.md#菜单) · [示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-context-menu/README.zh-CN.md)

## 字体迟到和主题改变之下持有焦点的编辑器行 — 2026-11-14

一个 CPU 层面的整合用例检查：持有焦点的编辑器行在字体迟到、主题改变，或两者与新的文本值同时发生时，托管列表的各行、焦点、编辑器的文字几何和语义树保持一致。只涉及测试；原生输入元素和真实字体仍需在浏览器中运行。属于 #87。[指南](docs/native-text-editing.md#验证与剩余资格)

## 用 Shift 选中一段行，用 Control+A 选中所有人 — 2026-11-14

在多选示例中，按住 Shift 再按移动键，会选中从离开的那一行到到达的那一行之间的所有成员；Control+A 选中所有在场的人。只涉及示例。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-multi-select/README.zh-CN.md)

## 设置示例的存档行可以悬停和按住 — 2026-11-14

`examples/ui-settings` 中存档列表的行在指针下面会变亮，按住时变暗，两套主题都是如此，做法是使用行绑定得到的显示对象。只涉及示例。属于 #90。[指南](docs/ui-controls.md#托管列表的行)

## 在列表中同时选中多行 — 2026-11-14

语义树的列表框接受 `multiple`，`createUiListSemantics` 会把它传下去，所以可以选中多行的列表会被如实告知辅助技术。新示例 `examples/ui-multi-select` 可以通过按下、在获得焦点的行上按空格或辅助技术的请求，从四十名成员中选出任意多人并派出；已经外出的成员是被禁用的选项。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-multi-select/README.zh-CN.md)

## 托管列表上手指可以拖动的滚动条 — 2026-11-14

下拉示例的名册有了滚动条，它的滑块可以用鼠标或手指拖动，另有一个 `scrollbar` 节点指明它所滚动的列表。手指仍然不能平移各行，那属于手势；在此之前，手机通过滑块到达列表的其余部分。只涉及示例和文档。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md)

## 托管列表的行可以悬停和按住 — 2026-11-14

托管列表中一行的绑定会得到 `target`，即这一行的显示对象。悬停控件和动作控件在它上面监听，所以行在指针下面会变亮，按住时变暗，完成一次按下就被激活，与自绘按钮一样。下拉示例用这种方式绘制它的行和选项。属于 #90。[指南](docs/ui-controls.md#托管列表的行)

## 标签页与进度条 — 2026-11-14

语义树新增 `tablist`、`tab`、`tabpanel` 和 `progressbar` 角色。标签说明自己是否被选中，并可以指明它显示的面板；进度条说明工作进行到哪里，或者工作量未知。新示例 `examples/ui-tabs` 把三个标签画成一个选择组和一个键盘停靠点，其中一个面板里有进度条。这些角色不在 #90 的首批控件集合之内。属于 #90。[指南](docs/ui-semantics.md#标签页与进度)

## 列表每一行的下拉选择 — 2026-11-14

新示例 `examples/ui-dropdown` 在滚动的托管列表中被激活的那一行下面打开一个弹出选择层，按下、键盘和辅助技术都可以激活；这一行滚走后它会关闭。为此增加了两处小功能：层管理器的锚点接受 `align: 'start' | 'center' | 'end'`，弹出层可以挂在一行的末尾；`createUiListSemantics` 接受 `hidden`，已关闭的层中的列表不进入语义树。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md)

## 滑动条：范围内的一个值 — 2026-11-14

`@egret/engine/ui` 的 `createRangeControl` 为应用自绘的滑动条保存范围内的一个值：按在轨道上，值就移到那里，同一个触点可以拖动它，值始终落在范围的步进上。`createControlKeys` 新增 `'range'` 类型，按键与原生滑动条相同；语义树新增 `slider` 角色，投射时带有它的数值和两端。设置示例增加了音量。滑动条不在 #90 的首批控件集合之内，因为设置界面需要它而加入。属于 #90。[指南](docs/ui-controls.md#范围内的一个值)

## 选项组作为一个停靠点，不再移动它 — 2026-11-14

控件示例不再把键盘停靠点从一个选项移到另一个选项。一个组的各个选项放在同一个显示对象里，这个对象就是停靠点，也只做一次按键绑定；选择移动时焦点留在那里，所以按住方向键现在可以连续经过各个选项。指南说明了做法。只涉及示例和文档。属于 #90。[指南](docs/ui-controls.md#按键)

## 把 UI 放在一起的一个设置界面 — 2026-11-14

新增的示例把 UI 的各个部件放在同一个界面上：一个开关、一组选项、一个可以输入中文的文本框、一个主题开关、一个重置前在模态卡片中询问的按钮，以及一个作为键盘单个停靠点的两百项存档托管列表。每个控件都通过同一份状态响应按下、常用按键和辅助技术的请求。切换主题时，自绘控件、各行、文字和未打开的卡片在同一帧内换色。八个场景在无头 Chromium 的软件 WebGL2 上通过；没有运行硬件 GPU、手机、输入法或读屏软件。它不含遮罩或模糊组，也不演练设备恢复。属于 #90。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.zh-CN.md)

## 托管列表作为键盘的一个停靠点 — 2026-11-14

托管 UI 根的 `keyboard: {input, idPrefix, tabStop}` 让列表的各行成为键盘的一个停靠点。Tab 从上次持有焦点的行进入列表，没有这样的行时从第一个可见行进入，并从那里离开，与原生列表框一致；行与行之间的焦点由应用移动。不提供 `tabStop` 时，每个可见行仍各自是一个停靠点。列表示例已改用它，真实浏览器检查用 Tab 离开画布并回到同一行。属于 #89。[指南](docs/ui-data-panel.md#托管虚拟行的键盘焦点)

## 皮肤为状态给出的名称 — 2026-11-14

`@egret/engine/ui` 的 `selectUiSkin` 给出主题皮肤为控件当前成立的状态所提供的名称。几种状态同时成立时，按玩家读取控件的顺序取第一个：不可用、按住、已设置、获得焦点、被指向；皮肤没有命名的状态落到下一个，最后落到 `default`。控件示例通过它从主题取得颜色，真实浏览器检查读取每种状态实际绘制出的颜色。已在 Node 和无头 Chromium 的软件 WebGL2 中检查。属于 #90。[指南](docs/ui-controls.md#绘制状态)

## 托管 UI 的盒与层的语义 — 2026-11-14

`@egret/engine/ui/semantics` 的 `semanticBoxOf` 度量托管 UI 根所布局的一个盒，因此叶子或整张卡片都可以成为语义树的节点。借助它，层管理器的弹出层或模态层可以描述为对话框，层关闭时隐藏。列表示例新增一张模态卡片：在无头 Chromium 中，浏览器计算出的树此时只有对话框及其按钮，不含它后面的列表；卡片关闭后焦点回到原来的行。没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#托管-ui-的盒与层)

## 托管列表各行的语义 — 2026-11-14

`@egret/engine/ui/semantics` 的 `createUiListSemantics` 让语义树与托管 UI 的虚拟列表保持一致：列表一个节点，每个可见行一个节点，带有它在舞台上的位置和在全部记录中的序号。持有焦点的行就是获得焦点的节点；滚走的行连同它的节点一起消失，所以投射永远不会指向一个不存在的元素。新增的示例列出五万行，只发布可见的八行。已在真实 UI 根上检查，并对照了无头 Chromium 计算出的列表框；没有运行读屏软件。属于 #90。[指南](docs/ui-semantics.md#托管虚拟列表)

## 控件的常用按键 — 2026-11-14

`@egret/engine/ui` 的 `createControlKeys` 在获得焦点的显示对象上绑定自绘控件的常用按键：按钮、开关和文本框是空格或回车，松开时生效；多选一是方向键、Home 和 End；滚动位置在此之外还有 Page Up 和 Page Down；移动是方向键和 W A S D 键位。按住的键会被报告，可以据此绘制；按住期间失去焦点不产生激活；更靠近焦点处已接管的键不再处理；滚动到头后把按键交还给页面。三个控件示例都已改用它。已在真实 Engine 上以及无头 Chromium 的软件 WebGL2（美式布局）中检查；没有运行实体键盘、其他布局或读屏软件。属于 #90。[指南](docs/ui-controls.md#按键)

## Spine 替换会保留进行中的混合 — 2026-11-14

Spine 重置槽的 `requestPreserving` 不再拒绝正从一个动画混合到另一个动画的播放器。轨道仍在混合退出的条目与当前条目一起被保留：每个混合进行到哪里、每个被混合的旋转朝哪个方向转，以及条目保持的内容。使用相同资源时，副本在之后的每个 tick 都处于原播放器的姿态，这在七种混合、每种九个替换时刻上得到验证。资源现在还必须包含那些只是正在混合退出的动画。已经结束的动画留在骨骼上的值仍然不保留，文档现已写明。这条路径的硬件和 WebGPU 行仍未运行。[指南](docs/spine-reset-slot.md#保留播放)

## 跳转中的物理 — 2026-11-14

跳转测试旁新增了一个带物理约束的原创 Spine 夹具。六项用例表明约束确实被模拟并且记得之前发生的事，固定了把一次推进切成六十分之一秒并把较短余数放在最后的规则，并确认带物理时跳转与直接运行相等：在每一步的结尾、每一步之内、当前时间之后，以及经过重置槽创建的实例。代码没有改动。夹具不是编辑器导出文件，也没有使用独立参考。[指南](docs/spine-seek.md#物理)

## 从干净消费者打开页面 — 2026-11-14

`tools/verify-clean-consumer-page.mjs` 从干净消费者检查结束的地方继续：它只对消费者目录提供服务，写入一个通过 import map 导入已安装引擎的页面（import map 根据已安装各包的清单生成），并在真实浏览器中打开。页面绘制一个按钮并响应一次注入的按下，Host 回读的帧会被检查。它在无头 Chromium 的软件渲染下用 WebGL2 通过，128 个请求全部留在消费者内部。WebGPU、硬件 GPU 和其他浏览器都没有打开过它，其中的时间是一次运行的观察值，不是预算。[指南](docs/clean-consumer.md#从消费者打开页面)

## 基于平台文字输入的文本框控件 — 2026-11-14

`@egret/engine/ui` 的 `createTextFieldControl` 保存应用所绘文本框的文字以及它是否正在编辑。完成一次按下、按键或辅助技术的请求，都会在应用指明的位置上方打开编辑器；平台文字输入原样就是这样一个编辑器，因此玩家用平台自带的输入法在自绘文本框里输入中文。多个文本框共用一个编辑器，取消的编辑不改变文字，长度上限按读者的方式数字符。新增的示例绘制了由两个文本框和一个按钮组成的表单。其中的输入法组字通过 Chromium 的协议驱动，没有运行真实输入法、屏幕键盘或真人操作。[指南](docs/ui-controls.md#文本框)

## 自绘界面的语义 — 2026-11-14

`@egret/engine/ui/semantics` 保存一棵描述应用所绘控件的树：每个控件的角色、名称、范围和状态，在每次发布时从控件读取，并带有按下和按键已经触达的激活与聚焦请求。`@egret/engine/web/semantics` 把它投射到页面：键盘仍属于画布，画布拥有一个覆盖在各控件上方的不可见元素容器，并把持有焦点的元素指明为活动后代。模态对话框让其外的一切变为 inert。控件示例现在描述了它的开关、选项和按钮。投射对照无头 Chromium 的无障碍树做了检查，没有运行读屏软件、其他辅助技术或其他浏览器。[指南](docs/ui-semantics.md)

## Spine 实例的分阶段跳转 — 2026-11-14

`instance.seek` 把 Spine 实例移到另一个已用时间。播放在一个私有副本上从设置姿态重建：按有上限的分片重放实例接受过的命令和增量，提交之前实例不受影响。事件默认不派发；向前跳转可以重放事件，数量有上限，且只在成功之后派发。历史有上限，超出后被丢弃，此后的跳转会被拒绝。出错的实例可以通过跳转到它最后发布的时间恢复。测试使用原创的数值夹具，其中没有物理约束。[指南](docs/spine-seek.md) · [#84](https://github.com/cnedwin/Egret_rebuild/issues/84)

## 视口的滚动位置 — 2026-11-14

`@egret/engine/ui` 的 `createScrollControl` 保存应用自己绘制的裁剪视口在一个轴上的偏移。滚轮经悬停输入滚动它，只有偏移确实移动时才被消费，所以内层视口会把滚轮向外交，最外层交给页面。一个触点可以拖动滚动条滑块，`line`、`page`、`toStart` 和 `toEnd` 供按键使用。悬停示例的列表现在用它滚动。用手指平移内容属于手势，本控件不识别。[指南](docs/ui-controls.md#滚动位置) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

## 控件的悬停、开关和多选一状态 — 2026-11-14

`@egret/engine/ui` 在移动和动作控件之外新增 `createHoverControl`、`createToggleControl` 和 `createSelectionGroup`。它们保存应用自己绘制的控件的状态：鼠标或手写笔在目标或其后代上时的悬停、是否选中，以及若干键中被选中的一个并可在可用项之间移动。按键走的是指针所走的同一批方法。悬停输入现在会指明 enter 和 leave 的另一端（`related`），并接受后加的观察者。新增的指南说明了全部五个控件。检查包括真实 Engine 上的单元测试，以及无头 Chromium 软件 WebGL2 中注入输入的真实页面；目前不向辅助技术通报任何内容。[指南](docs/ui-controls.md) · [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)

## 悬停与滚轮路由 — 2026-11-14

两个可选入口在显示树上路由悬停和滚轮。`@egret/engine/input/hover` 是逻辑输入；`@egret/engine/web/hover` 监听画布，并与触点适配器共用它。目标能得知鼠标或手写笔进入、在其上移动或离开，每次离开都带原因；滚轮交给它下面的对象，页面是否滚动由应用选择的策略决定。检查包括真实 Engine 上的单元测试，以及无头 Chromium 软件 WebGL2 中注入输入的真实页面。没有使用真实的鼠标、手写笔或触控板，也没有在硬件 GPU、WebGPU、Safari 和 Firefox 上运行；托管控件尚未使用它。[指南](docs/pointer-hover.md) · [#89](https://github.com/cnedwin/Egret_rebuild/issues/89)

## 默认引擎的干净消费者检查 — 2026-11-14

`tools/verify-clean-consumer.mjs` 用固定版本的 pnpm 打包默认引擎的三个包，安装到仓库之外的新工程并在那里使用。未经修改的公开示例可以运行，23 个入口都从已安装的副本解析并加载，最小路线不加载 Web、3D 或可选模块，严格的 TypeScript 消费者可以编译。检查在 Node 中进行。这些包仍未发布，从消费者一侧的浏览器运行、首次可交互和真人演练仍然开放。[指南](docs/clean-consumer.md) · [#93](https://github.com/cnedwin/Egret_rebuild/issues/93)

## 换装工作室打开工程 — 2026-11-14

换装工作室可在运行中的页面内打开已导出的工程。文件先在当前工程的副本上准入，并作为一次编辑事务写入，角色的稳定 ID 不变。新配色在加载并由 Host 接收期间保留原画面，随后工程、角色和列表一起切换。被拒绝的文件、加载失败或取消都不改变任何东西。新增浏览器验证的 WebGL2 各项已在软件渲染的无头 Chromium 上通过；WebGPU、硬件和手机各项尚未运行。[#91](https://github.com/cnedwin/Egret_rebuild/issues/91) · [换装工作室](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/README.zh-CN.md)

## SharedFrame2D 与渲染诊断 — 2026-11-14

SharedFrame2D 成为 WebGPU 和 WebGL2 的公共 2D 帧路径。旧 Canvas Host、旧帧捕获及早期 scene3d Host 已退役。共享路径已支持保持顺序的跨纹理页合批，以及稳定命令、打包和批次复用。集成像素对比使用软件渲染。可选调试面板和 GPU 计时工具报告各自可用的计数与时间来源。 [#187](https://github.com/cnedwin/Egret_rebuild/pull/187) · [#188](https://github.com/cnedwin/Egret_rebuild/pull/188) · [#190](https://github.com/cnedwin/Egret_rebuild/pull/190) · [#193](https://github.com/cnedwin/Egret_rebuild/pull/193)

## 保留播放的 Spine 替换 — 2026-11-14

Spine reset 槽新增 `requestPreserving`。新资源版本在候选被捕获时，从播放器所处的位置接续每条轨道的动画和队列，以及皮肤、速率、暂停和位置。资源必须以相同名称包含每个被保留的动画，长度和事件时间表相同；无法延续播放的资源在发布前被拒绝，正在混合的播放同样被拒绝。保留后的播放器已逐 tick 对照被替换的播放器检查，示例在软件渲染的无头 Chromium 上通过了 WebGL2 浏览器验证。WebGPU、硬件和手机各项尚未运行。[#86](https://github.com/cnedwin/Egret_rebuild/issues/86) · [契约](docs/spine-reset-slot.md#保留播放)

## 画布原生文字输入 — 2026-11-14

可选浏览器适配层在游戏画布上方放置原生文本框。测试覆盖公开 API 行为及 Chromium 协议驱动的组合输入示例。托管编辑仍作为独立路径提供。此适配层的实体输入法、移动软键盘、Safari 和 Firefox 仍待验收。 [#195](https://github.com/cnedwin/Egret_rebuild/pull/195)

## PC 与 Android 的有限图形观察 — 2026-11-13

World3D WebGL2 阴影图集与帧统计在硬件 Edge 及一种 Android Chrome 配置上完成检查。SharedFrame2D 冷纹理与附件改动另有硬件 Edge 成对像素对照、选定 Android 生命周期与计时记录。两份结果分别绑定各自的源码、负载及图形适配器。 [#179](https://github.com/cnedwin/Egret_rebuild/pull/179) · [#185](https://github.com/cnedwin/Egret_rebuild/pull/185)

## World3D 玩法物理与渲染 — 2026-11-13

自动实例化合并兼容的绘制项，拾取层级加速稠密网格查询。物理增加形状扫掠、组合刚体、接触报告和求解器改进，并提供布娃娃、街机式载具、绳索、布料和消息端口辅助组件。最新 PR 记录了 27 项无头软件渲染 WebGL2／WebGPU 固定对比，以及使用 MessageChannel 和 Node 工作线程的远程测试。浏览器 Worker、实体设备和性能仍待验收。 [#163](https://github.com/cnedwin/Egret_rebuild/pull/163) · [#166](https://github.com/cnedwin/Egret_rebuild/pull/166) · [#167](https://github.com/cnedwin/Egret_rebuild/pull/167) · [#168](https://github.com/cnedwin/Egret_rebuild/pull/168)

## Windows 合并检查并行化 — 2026-11-13

一个 Windows 作业执行结构和发布检查，四个独立测试分片在同一候选上覆盖完整套件。#164 合并前的最终托管运行从创建到完成用时 13 分 12 秒。 [#164](https://github.com/cnedwin/Egret_rebuild/pull/164) · [托管运行记录](https://github.com/cnedwin/Egret_rebuild/actions/runs/43294257120)

## World3D 角色、地形与特效 — 2026-11-12–13

系列交付涵盖角色控制、资源解码、导航、地形与水面、蒙皮人群和特效。该系列最后一个检查点在 Windows Edge 通过 25 项固定 WebGL2／WebGPU 离屏对比，以及两个后端各自的软粒子深度检查。 [#154](https://github.com/cnedwin/Egret_rebuild/pull/154)–[#159](https://github.com/cnedwin/Egret_rebuild/pull/159) · [#161](https://github.com/cnedwin/Egret_rebuild/pull/161)

## 固定桌面渲染 CPU 目标 — 2026-11-12

Windows E20 的全脏 Engine p95 中位数达到 5.3 ms，三种状态均达到 CPU 与准备目标。稀疏和全脏帧节奏仍超出目标，GPU 时间未测。[#153](https://github.com/cnedwin/Egret_rebuild/pull/153)

## World3D 渲染、物理与展厅 — 2026-11-12

新增可选独立 3D 场景图及渲染器，接入 glTF、光照阴影、后处理和物理，提供功能展厅与固定 CPU 回归负载。各后端的功能与已验证环境见 [World3D 契约](docs/world3d.md)。[#147](https://github.com/cnedwin/Egret_rebuild/pull/147) · [#148](https://github.com/cnedwin/Egret_rebuild/pull/148) · [#149](https://github.com/cnedwin/Egret_rebuild/pull/149) · [#151](https://github.com/cnedwin/Egret_rebuild/pull/151) · [#152](https://github.com/cnedwin/Egret_rebuild/pull/152)

## WebGL2 等距地图 — 2026-11-12

独立示例使用白鹭公开接口展示网格移动、碰撞、深度排序及有界帧提交。 [#136](https://github.com/cnedwin/Egret_rebuild/pull/136)

## 共享几何构造 — 2026-11-11

减少 Spine 角色逐帧构造共享几何的开销，保留输入复制、数值校验和身份规则。桌面双后端及一部 Android 真机的短时对照显示动画阶段下降，正式帧间隔、CPU／GPU 和设备目标仍待验收。 [#140](https://github.com/cnedwin/Egret_rebuild/pull/140)

## 序列播放状态保留 — 2026-11-11

兼容 ContentLoader 资源的逐帧时间边界完全一致时，替换会延续播放位置、循环、速率、暂停状态与标记序号。双浏览器后端通过有限像素和生命周期检查，Spine 状态保留仍待交付。 [#139](https://github.com/cnedwin/Egret_rebuild/pull/139)

## 共享裁剪优化 — 2026-11-11

WebGPU 和 WebGL2 复用完全包含的多边形，沿用原预算计费与相交裁剪。固定场景短时对照记录 Host p95 的变化，完整 M4 验收仍开放。 [#138](https://github.com/cnedwin/Egret_rebuild/pull/138)

## 固定换装负载与多点触摸 — 2026-11-11

同一换装工作室运行固定桌面和移动档位，并记录两后端桌面计时及 Android 受控多触点结果。正式帧间隔和触摸响应目标仍待验收。 [#137](https://github.com/cnedwin/Egret_rebuild/pull/137)

## 可编辑换装工作室 — 2026-11-07

同一个 Engine 组合独立 Spine 实例、序列动画、托管 UI 与不透明 3D 背景。桌面双后端验证精简场景、替换路径和冷启动开销。 [#135](https://github.com/cnedwin/Egret_rebuild/pull/135)

## UI 弹出层与模态层合成 — 2026-11-07 · [#134](https://github.com/cnedwin/Egret_rebuild/pull/134)

新增可选根级弹出层与模态层、分阶段发布、裁剪锚点、指针屏障及键盘和原生编辑交互资格的包含与恢复。现有表单整合草稿重命名，继续共享字体和生命周期。桌面证据、首次锁屏拒绝、两项真实手机失败及最终32项当前设备观察分别记录。程序化回退不再激活后台编辑器，宽度重建先结束组合输入再保存重命名模型。完整 M3.4、语义、触摸贡献及 M1.2 继续开放。[契约](docs/ui-layers.md)。

## Android 原生编辑与响应式表单 — 2026-11-07 · [#133](https://github.com/cnedwin/Egret_rebuild/pull/133)

修复取消后的终止组合回调，保留活动会话重入拒绝。既有表单按宽度／启动 DPR 响应，并独立退役界面 Scope，固定夹具保持不变。记录三星实际键盘、两后端最终源码生命周期及桌面检查，区分前序复用与失败边界。见[证据及剩余资格](docs/android-native-text-editing.md)。

## 产品／核心路线统一——2026-11-07

将当前能力与完整产品需求及原 M2–M4 工作包统一，整理白皮书、工程／交付计划和导航。下一阶段优先原生编辑、同一混合参考及剩余内容／动画，保留触摸边界、M1.2 失败和设备／素材限制。可选 Spine／CanvasKit 实现替代过时的无播放器／无 provider 表述。不改变引擎行为、验收目标、依赖或历史回执，参见[工程计划](docs/工程规划.md)。

## Android 内存口径与生命周期 — 2026-11-07

精确目标诊断区分缓存的 performance.memory 读数、活跃 JS 和 backing storage；段落、序列与 Spine 示例补充两后端有限 Android 生命周期／恢复证据，历史 41.4 ms 触发条件仍未复现。不宣称引擎修复或完整 M4／M1.2 验收。见[补充验证](docs/android-device-validation.md#回调内存与生命周期补充验证--2026-11-07)。

## Android 装备字体选择 — 2026-11-06

段落示例按捕获的字体组生成装备样式范围，保留默认夹具，并支持候选组实际注册的 CJK 别名。真机失败、短路径复现和指定后端检查分别记录；核心准入和预算不变。见 [Android 组件验证](docs/android-device-validation.md)。完整 M4 与 M1.2 验收保持 OPEN。

## 可选 Spine 资产 — 2026-10-30

固定官方 Core 4.3.13，通过既有资源与 Scope 读取 JSON 设置资产及原始多页图集。可选 SDK 保留明确许可条件和不可变信息；完整播放、图形、稳定素材集与独立参考继续开放。 [SDK](docs/spine-content-ingress.md).

## 段落对齐与行数限制 — 2026-10-29

只读段落新增左／右／居中／start／end／两端对齐及固定省略号的 maxLines。硬换行／空白行溢出显示省略号，过窄时明确拒绝且保留已提交内容；继续复用既有 UI 几何与资源所有权。见[布局契约](docs/paragraph-layout-controls.md)。针对性 36 项及每后端 20 项实际浏览器检查属于有限功能证据；完整 M3.2、设备、IME 和性能继续 OPEN。

## 最终行双向排版 — 2026-10-29

可选段落运行库在换行后应用原生逐行 L1／L2，绘制、几何与命中共享 canonical 字形存储。有限原生及实际浏览器检查覆盖重置空格、控制逻辑槽和宽度恢复；完整 M3.2、设备与性能验收仍未完成。见[行契约](docs/paragraph-line-bidi.md)。

## M2.2 序列帧控制 — 2026-10-23

可选动画入口增加倍率、有限总播放次数、有序标记以及显式静默／重放跳转，共享既有时钟和资源所有权。新旧播放不能同时占用同一个 Bitmap。参见[序列帧控制契约](docs/sequence-controls.md)。完整 Spine 与 M2.2 验收仍然开放。

## M3.1 完整提交的 UI 面板 — 2026-10-23

M3.1 增加托管 UI 根、显式 prepare/commit、自动行列布局、稳定键变高列表和有界异步行复用。多个面板复用现有渲染器、输入路由和资源所有者。详见[UI 面板契约](docs/ui-data-panel.md)。完整控件、段落文字、焦点／IME、手势、移动端资格与性能验收继续开放。

## M2.1 内容构建基础 — 2026-10-23

M2.1 增加经过字节验证的 PNG／图集／序列帧构建、持久缓存复用、依赖失效和通过现有项目事务采用的不可变代次，保留源文件与旧代次。参阅[内容构建契约](docs/content-build-pipeline.md)。完整 Spine、字体和目标变体继续开放。

## M3.3 多触点基础 — 2026-10-23

M3.3 增加可选 DOM-free 触点路由及 Engine／浏览器入口，支持独立多触点会话、捕获、取消，以及视口和生命周期清理。附双区域示例与可复现桌面采集器，定向回归通过 176 项。参阅[契约与证据](docs/multi-pointer-input.md)。完整 M3.3 焦点／IME、M3.4 手势及 Android／iPhone 真机验收继续开放。

## M1.2 准备阶段后续优化 — 2026-10-21

有界裁剪校验与矩形复用、同槽缓存查找、角点临时数组减少及已包含边处理，减少重复准备工作，同时保留原有工作预算和失败顺序，不改变公开 API。候选的原生预检、像素及操作计数已通过，每帧 draw 仍为基线 991、候选 155。此前正式计时未达到目标；最新诊断因前台窗口切换中断，尚无有效候选成对计时或新一轮正式计时结果。M1.2 验收继续开放；参阅[验证记录与边界](docs/incremental-frame-preparation-evidence.md)。

## M1.5 交付 — 2026-10-21

资源清单、依赖感知的共享加载、分阶段上传及统一 WebGL2/WebGPU 恢复已通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付，main 为 `4924b471b52927184252191055f902c30c29af52`。[CI 执行 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) 的四个作业全部成功。Windows 完整集成门禁通过 290 项发布检查、4,528 项核心测试和 160 项 Spine F2 测试，各组失败、取消和跳过均为零。

固定 C7 七案以及二十四个受影响的浏览器套件（三十六次调用）均已完成实际执行与独立评审。M1.2 正式成对性能及外部平台/设备验收继续开放。[验证记录](docs/resource-recovery-evidence.md)保留较早截止点与本地失败执行，并另行记录此次完成的交付。

## M1.5 资源恢复验证 — 2026-10-20

M1.5 增加资源清单、依赖感知加载和共享资源所有权，支持有界加载与完整性校验、分阶段上传，以及统一的 WebGL2/WebGPU 恢复。Windows / Chrome for Testing 157.0.8103.6 上的七项固定恢复验证及受影响的浏览器回归均已通过独立评审。WebGL2 与 WebGPU 各完成 100 次资源循环、十次原生丢失与恢复循环及 30 分钟前台运行。在此验证截止点，最终工作包评审、M1.5 受保护合并门禁与 M1.2 正式性能验收仍待完成。参阅[验证记录](docs/resource-recovery-evidence.md)。

流程简化已单独通过 [PR #78](https://github.com/cnedwin/Egret_rebuild/pull/78) 合并。交付情况以仓库的 [PR 记录](https://github.com/cnedwin/Egret_rebuild/pulls)为准；较早条目保留各自记录截止点。

## M1.3 候选 — 共享纹理页与渲染

显式共享配置分离源页、逻辑纹理区域、材质状态和已完成帧身份。多个图集区域共享规范化上传，裁边/旋转、九宫格、明暗双色、有序边界和有界目标复用共同支撑复杂 2D 界面。有限线性 B1 路径先合成不透明 3D 与共享 UI，最后统一转换一次输出；既有颜色配置继续保留。

100 项聚焦检查、24 项类型负例，以及固定桌面矩阵中的 30 个正常场景和 11 组三段数值反例，均在记录范围内通过。完整回归和受保护集成仍待完成。参阅[契约](docs/shared-render-profile-contract.md)与[结果及限制](docs/shared-rendering-evidence.md)。这些结果不构成性能、手机或完整 Spine 声明。

## M1.2 功能已交付 — 增量有序帧准备

已通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 合并，主干提交为 `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`；正式性能验收仍开放。下文早期候选观察保留各自记录截止点。

M1.2 复用未变化的显示变换、裁剪和已准备几何，并在保持绘制顺序及公开 API 的前提下合并相邻兼容绘制。当前资源仍执行完整准入，保存帧保持与后续修改隔离。固定原生操作场景记录的每帧 draw 为基线 991、候选 155。

参阅[契约](docs/incremental-frame-preparation-contract.md)及[验证记录与边界](docs/incremental-frame-preparation-evidence.md)。操作计数不能证明耗时提升。在该早期截止点，基线在固定预热中达到两帧在途上限。后续完成的计时及当前候选状态另见上文，M1.2 性能验收继续开放。完整发布门禁和仓库交付分别记录。

## M1.1 已交付 — WebGPU 提交复用

已通过 [PR #73](https://github.com/cnedwin/Egret_rebuild/pull/73) 合并，主干提交为 `fa88111f5e73503e1804f92a9f444207110b773c`。早期证据保留原记录截止点；仓库交付不扩大其性能或平台支持声明。

M1.1 增加安全完成后的顶点、索引、uniform 缓冲复用及完整键绑定复用，并省去已覆盖热图像的裁剪复制。有限缓存保留原准入规则、绘制顺序与公开 API。参阅[契约](docs/warm-submission-contract.md)及[当前证据](docs/warm-submission-evidence.md)。实际操作计数、原生图像验证、性能与仓库交付分别验收。

## 0.61.0 — 实验性 WebGPU 图像驻留

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](docs/gpu-image-residency-contract.md)及[证据与限制](docs/gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 0.60.0 候选 — 图集导入规划

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 入口，以一个显式 PNG 绑定规划严格单页 Aseprite stable-marker JSON-array。两个运行时值与十六个擦除类型为既有 SpriteSheet、SequenceClip 工厂生成自有、冻结的输入。精确 profile 为 `aseprite-json-array-1.3.18.6-v1`；exporter 输出兼容性、声明 hash 与许可资格仍未验证。

参阅[契约](docs/atlas-import-plan-contract.md)及[证据与限制](docs/atlas-import-plan-evidence.md)。

已独立接受的保存结果分别为聚焦 planner 47/47、较早正常 SDK 核心 3625/3625 与单独 F2 160/160，以及独立 CPU firstGREEN 5/5；这些重叠范围不相加。独立审查还接受所选新增 Native Canvas/WebGPU 四次读回结果。最终集成门禁/prepush 及 0.60 Git/远端交付仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 0.59.0 交付更新

前一 0.59 增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。较早 0.59 读物和证据保留原编写截止点，新增交付说明不改写它们。未报告远端 status 或 check run，不据此推断 CI 通过。

## 0.59.0 候选 — 标准化图集帧 — 2026-10-17

现有 SpriteSheet 与 SequenceClip 工厂的显式 `'trim-rotation-v1'` profile 支持带透明裁边和顺时针90度打包的单页帧。拥有的 layout 通过 Bitmap 和现有序列播放保留逻辑尺寸与放置，默认矩形路径保持兼容。参阅[契约](docs/atlas-frame-layout-contract.md)、[证据与边界](docs/atlas-frame-layout-evidence.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md)。

已获独立接受的十二阶段 SDK `node tools/verify.mjs` 运行通过 **3559/3559 项核心测试**及单独的 **160/160 项 Spine 实验测试**，两套的 failed/cancelled/skipped/todo 均为 **0**。单独的桌面 Canvas 与纹理 WebGPU 验证通过六个全新上下文和 30 次零容差完整 RGBA 读回，包括指定突变对照及原资源退役后的重放。当前验证器增加了第十三个图集源码边界阶段；截至本次编写，完整重跑、最终公开内容/prepush、0.59 Git 交付与远端 CI 仍待完成。此前失败与修复保留在所链接证据中。exporter 导入、多页、pivot/nine-slice 导入、动画 retarget、controller seek/rate/events、完整 Spine R020/V020、迁移 R008/V006 以及物理设备/性能接受保持 OPEN。

## 0.58.0 — Bitmap 原子绑定与组合换装

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](docs/prepared-resource-groups-spec.md)、[证据与边界](docs/prepared-resource-groups-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md)。

## 0.57.0 — 真实资源场景集成

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](docs/resource-scene-integration.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 0.56.0 交付更新 — 2026-10-16

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

## 0.56.0 — 可恢复位图资源替换

`Engine.createBitmapResourceSlot(scope, bitmap)` 通过既有根入口，为一个持久 Bitmap 增加显式异步 Texture 替换，并增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。槽借用初始绑定，仅拥有新替换租约。请求等待、失败或取消时保留先前可用绑定，只有最新已接受意图可以提交；取消或被新请求取代会拒绝对应请求 Promise。参阅[规格](docs/位图资源槽规格.md)、[证据及剩余验收](docs/位图资源槽核验.md)和[组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。

聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录，完整 UI、Spine R020/V020 与旧工程迁移 R008/V006 保持 OPEN。前一个 0.55 增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付，Main 为 `f6b7968db89febfdbe00fb1322f208ab2135f68f`；较早条目继续保留各自历史证据截止点。

## 0.55.0 — 显式本地线性布局

可选 `@egret/engine/layout` 将显式数字记录转换为冻结的局部矩形计划，调用方负责过滤成员、排列子对象并应用坐标。双 Button 示例连接既有共享输入、借用程序化图集、嵌套裁剪及保存/实时帧。参阅[规格](docs/local-linear-layout-spec.md)及[验证范围](docs/local-linear-layout-evidence.md)。

## 文档维护 — 2026-10-15

公开叙述围绕产品目标、设计推导、契约与交付重新组织，产品文档、导航和双语阅读版本共同维护，来源、许可及原始实验证据保持可追溯。本次文字整理不增加引擎能力。

## 前次集成 — 0.54.0

工程预览 0.54.0 已通过 [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42) 集成，Main 为 efd2a9c91fb6cfe633214b50b82cf7952941452a，tree 为 2b39b8439a5b30ce3572edc162e8a7a916a76185。已记录的完整本地检查通过核心 3218/3218 和 Spine 源码 160/160；桌面 Canvas/WebGPU 检查完成 38 次主读回和 87552 通道比较，容差为 0。这些验证范围分别记录且存在重叠。远端 CI 没有返回检查项，不据此推断 CI 通过。

## 0.54.0

可复用位图按钮连接共享鼠标输入、资源租约及按下／禁用皮肤，在事件路由结束后最终复查命中。 [详细说明](docs/位图按钮契约.md).

## 0.53.0

可运行图集示例连接纹理加载、SpriteSheet 裁剪、Engine 时钟播放、显式锚点及保存／实时画面。 [详细说明](docs/锚点图集播放契约.md).

## 0.52.0

显式锚点偏移在画面收集、坐标转换、bounds 和拾取中共用变换语义。 [详细说明](docs/显示锚点偏移契约.md).

## 0.51.0

按索引插入子对象，保持父子顺序、所有权和重入校验。 [详细说明](docs/容器按索引插入契约.md).

## 0.50.0

查询直接子对象当前索引，不改变显示树。 [详细说明](docs/容器子节点索引契约.md).

## 0.49.0

批量分离全部直接子对象，保持各自资源与生命周期规则。 [详细说明](docs/容器清空子节点契约.md).

## 0.48.0

NineSliceBitmap 基于既有几何、纹理租约和自有画面提供固定边框背景。 [详细说明](docs/九宫格位图契约.md).

## 0.47.0

实验性官方 Spine Core 桥接将原创手动测试内容接入 Mesh2D 画面，完整 Spine 仍按独立需求验收。 [详细说明](docs/SpineCore手动网格桥接.md).

## 0.46.0

可选浏览器 PNG Provider 在既有资源系统上增加受限静态图像解码和显式关闭。 [详细说明](docs/浏览器PNG纹理Provider契约.md).

## 0.45.1

共用路径／字节身份工具、规范文本写入器和必需钩子，处理 Windows 路径写法及换行漂移。 [详细说明](docs/仓库路径身份与换行规范.md).

## 0.45.0

命名 SpriteSheet 帧让静态裁剪与序列播放共用一个图集租约。 [详细说明](docs/命名图集契约.md).

## 0.44.0

Scope 所有的序列播放使用显式 Engine 时钟，支持单次与循环控制。 [详细说明](docs/时钟驱动序列动画契约.md).

## 0.43.0

Spine 线性动画源规格定义版本化输入及源码层检查。 [详细说明](docs/Spine线性动画源规格契约.md).

## 0.42.0

Spine 网格源规划定义自有网格画面准备及校验范围。 [详细说明](docs/Spine网格源规划契约.md).

## 0.41.0

九宫格几何定义边框与拉伸语义，为显示组件提供基础。 [详细说明](docs/九宫格几何NS1契约.md).

## 0.40.0

ByteWriter 提供自有二进制输出、显式字节序和事务式游标行为。 [详细说明](docs/字节写入器BW1契约.md).

## 0.39.0

纹理场景组合通过显式浏览器 Host 连接选定三维 pass 与独立于深度的 UI。 [详细说明](docs/textured-scene-host-contract.md).

## 0.38.0

公共 Matrix4 编写接口开放既有第一方 CPU 矩阵语义。 [详细说明](docs/公共3D场景契约.md).

## 0.37.0

原创 Spine F1 实验增加显式选择的 Engine 时钟集成。

## 0.36.0

原创 F1 Spine 实验连接手动动画测试内容、网格画面与浏览器验证。

## 0.35.0

Scope 所有权针对已记录的公开属性覆盖及释放重入案例得到修正。 [详细说明](docs/Scope私有所有权.md).

## 0.34.0

可选 Spine 导入规划器增加严格元数据与扫描优先的拒绝语义。 [详细说明](docs/Spine导入计划契约.md).

## 0.33.0

主鼠标输入连接显式命中区域、类型化显示事件和 Scope 生命周期。 [详细说明](docs/主鼠标输入契约.md).

## 0.32.0

可选公共场景与网格入口开放选定的自有 CPU 画面和浏览器 Host。 [详细说明](docs/公共3D场景契约.md).

## 0.31.0

资源获取组增加完整输入预检、受限本地等待队列及统一释放。 [详细说明](docs/资源批量获取.md).

## 0.30.0

Canvas 拾取示例展示公共命中查询、类型化路由及派发后的视觉反馈。 [详细说明](docs/显示拾取示例.md).

## 0.29.0

逻辑命中测试定义显式矩形输入及显示树拾取。 [详细说明](docs/显示命中HT1.md).

## 0.28.0

Canvas 文字路径在已验证子集中连接栅格图像、替换、代际与生命周期。 [详细说明](docs/Canvas文字WC1.md).

## 0.27.2

显示树挂接减少特定同级扫描，保持校验与释放顺序。 [详细说明](docs/显示树扩展性.md).

## 0.27.1

ByteReader 提供自有标量读取、显式字节序、独立复制及原子游标。 [详细说明](docs/字节读取器BR1契约.md).

## 0.27.0

可选的非编辑 TextField 连接已准备文字图像、资源租约和显式替换。 [详细说明](docs/文字显示TF1契约.md).

## 0.26.0

标量 Tween 增加 Scope 所有的过渡、选定缓动函数及终态释放。 [详细说明](docs/标量补间契约.md).

## 0.25.0

显式 Engine 时钟将游戏时间推进与渲染、捕获分开。 [详细说明](docs/游戏时间核心契约.md).

## 0.24.0

文字栅格编排增加精确请求、带符号度量、资源槽位及显式预算。 [详细说明](docs/文字栅格T1契约.md).

## 0.23.0

自有纹理几何与 Mesh2D 增加不可变捕获、准备和显式 WebGPU 路径。 [详细说明](docs/自有纹理几何与Mesh2D契约.md).

## 0.22.0

接收者局部内容 bounds 增加不可变测量结果与显式遍历预算。 [详细说明](docs/显示内容边界契约.md).

## 0.21.0

公共局部／全局坐标查询增加不可变点及祖先／生命周期边界。 [详细说明](docs/显示坐标查询契约.md).

## 0.20.0

SequencePlayer 提供显式时间图集采样及公共浏览器示例。 [详细说明](docs/显式时间序列播放器契约.md).

## 0.19.0

Bitmap 区域接纳／捕获与 B1 浏览器验证器建立独立的图像和场景检查。 [详细说明](docs/bitmap-region-contract.md).

## 0.18.0

单个命名旧 MovieClip 的 CPU 转换保留裁剪、偏移和编写的停留时间，完整迁移仍未完成。 [详细说明](docs/legacy-movieclip-contract.md).

## 0.17.0

内部 CPU 场景、网格、序列与 RES 意图扩展初始核心，未完成生产宿主验收。 [详细说明](docs/3d-cpu-scene-contract.md).

## 0.16.0

图像源投影、画面准备、CPU 混合参考及三维／RES 分析形成统一证据记录。 [详细说明](docs/核心框架实现记录.md).

## 0.13.0

浏览器 WebGPU 矩形执行建立固定的渲染与生命周期规格。 [详细说明](docs/WebGPU矩形执行合同.md).

## 0.12.0

显示变换、继承可见性／透明度、裁剪及不可变画面接入独立 Canvas 适配器。 [详细说明](docs/显示与帧执行合同.md).

## 0.11.0

类型化资源增加共享获取、独立租约、取消与代际隔离。 [详细说明](docs/资源核心合同.md).

## 0.10.0

双语阅读、当前文件身份、关键英文注释与推送前检查形成共用贡献规范。 [详细说明](docs/双语文档与推送前检查.md).

## 0.9.0

仓库整合独立核心源码与知识库，建立公开协作和来源署名。 [详细说明](docs/开源协作与公开表达规范.md).

## 0.8.0

首个独立无界面核心实现 contracts、runtime 与 engine 的职责、生命周期及类型化事件。 [详细说明](docs/核心框架实现记录.md).

## 0.7.0

工程结构、现代 API 约定与代码质量规范形成共用实现基础。 [详细说明](docs/工程技术架构与项目结构.md).

## 0.6.2

技术研究补充 shader 资产分发和工程持续编辑流程的设计考虑。 [详细说明](docs/Shaders与Playground产品技术启发.md).

## 0.6.1

独立实现、显式依赖与研究来源分别建立规范。 [详细说明](docs/独立实现与第三方依赖规范.md).

## 0.6.0

图形后端、编译与原生运行时方案作为候选设计进行分析。 [详细说明](docs/图形后端编译与原生Runtime选型.md).

## 0.5.0

固定版本第三方资产实验检查动画实例、文字、资源释放和上下文恢复。

## 0.4.0

参考研究明确源码版本、许可、集成角色与验证职责。 [详细说明](docs/开源实现优先与验证分工.md).

## 0.3.0

事件、资源、UI 和混合图形实验细化身份、代际与恢复约束。

## 0.2.0

首版白皮书、需求与工程规划将设计假设连接到技术实验。

## 0.1.0

初始知识库组织产品范围、架构候选、交付与社区参与。

## 历史验证记录

早期结果、失败、修正及 PENDING 状态，按原日期和源码身份保存在对应证据及[固定版本详细记录](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/CHANGELOG.md)中，表达历史检查点，不代表当前集成状态。本页记录各版本主要变化，详细测试数值随相关实验或子系统维护。

完整 Spine 支持于 2026-10-10 登记为 R020/V020，上述导入、网格及手动 Core 实验尚未完成这项要求。旧工程自动迁移 R008/V006 仍未完成。
