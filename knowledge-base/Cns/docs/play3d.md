# Play3D：一次调用做出一个完整的 3D 小游戏

[English](../../en/docs/play3d.md) | 简体中文

`play3d` 是下面垫了一个三维世界的 [`play`](play.md)。一次调用创建画面、相机、太阳和循环；它返回的游戏对象提供用普通数字摆放的方块、球、圆柱、圆锥和地面，会跟随的相机，距离和重叠的判断，以及命中时迸出的碎块。其余的都是 `play` 原样提供的：每帧查询的按键和指针、代码合成的音效、定时器、补间、文字、按钮、存档和 `restart`。它由 `@egret/engine/webgl2/world3d` 导出。

画面是一个画在自己画布上的 [World3D 应用](world3d-app.md)。界面是一个透明地画在它上面的 `play` 游戏，和应用的[叠加层](world3d-app.md)一样，所以文字和按钮是平面的，使用 `width` 和 `height` 的单位。

**核对了什么。** 选项、物体的各个数字和重叠判断在 Node 中核对。在无头 Chromium 的软件 WebGL2 上，[play 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.zh-CN.md)中的游戏被键盘玩到结束：球落地、滚到一颗星、跳起、从边缘掉下去，按钮让它重新开始。软件渲染时画质为 `low`，所以没有绘制阴影和抗锯齿。这次最初的完整游戏检查没有覆盖硬件 GPU。

2026 年 11 月 18 日，以 main `ec17a5a2` 为基线的契约修复，在 Windows Edge 157.0.4341.60 / RTX 5090 Laptop 和 Galaxy Z Fold7 / Android 17 / Chrome 157.0.8103.78 / Adreno 830 上通过，均显式使用 WebGPU 和 WebGL2，没有软件回退。采集期间的系统采样均显示 Edge 位于前台，手机保持亮屏解锁。两台实体设备上注入的鼠标／触摸操作，在四组组合中均使中心像素从 RGBA `255,32,64,255` 变为 `32,255,96,255`。 有界的 128 × 96、低画质 World3D 用例还核对了偏心与镜像碰撞、导入旋转与偏航修改，以及球体落地停在 `y = 0.45`。每组设备／后端均完成 24 次重开：当前五个自有图元保持有效，上一代五个图元的几何与材质均已清理。最终关闭还释放了三枚池化粒子，借用模型资源保持有效。清理时拒绝重入的 box/add/burst，借用模型的变换没有被修改；重复与重入关闭共用同一个 Promise，原生 Motion 链停止。离屏目标有可见几何（6 次绘制、972 个三角形）。这些是逻辑生命周期与有界像素观察，不代表物理显存、高画质阴影／抗锯齿、真人输入或性能验收。

## 一个游戏

```js
import { play3d } from '@egret/engine/webgl2/world3d';

let ball, floor, vy = 0;

await play3d({
  width: 960, height: 540, background: 0x0b1020,
  setup(game) {
    floor = game.ground(24, 0x2d6a4f);
    ball = game.sphere(0.5, 0xe8453c, { y: 3 });
    game.follow(ball, { y: 6, z: 9 });
    game.text('方向键滚动，空格跳', { x: 16, y: 12 });
  },
  update(dt, game) {
    const move = game.keys.axis();
    ball.x += move.x * 6 * dt;
    ball.z += move.y * 6 * dt;
    vy -= 20 * dt;
    ball.y += vy * dt;
    const push = game.pushOut(ball, floor);
    if (push) { ball.y += push.y; vy = 0; if (game.keys.pressed('space')) vy = 8; }
  },
});
```

游戏开始时，`x` 向右，`y` 向上，`z` 朝向相机，所以在地面上方向键的 `axis()` 对应 `x` 和 `z`。一个单位有多大由游戏自己决定；半径 0.5 的球配 24 见方的地面，看起来比较合适。

## 选项

与 [`play`](play.md#选项) 相同，但没有 `canvas`：`play3d` 自己创建两块画布。`width` 和 `height` 是界面的单位，也决定画面的比例。`background` 是天空的颜色。`backend: 'webgpu'` 让两者都用 WebGPU 绘制；不指定时都用 WebGL2。

## 物体

| 调用 | 得到 |
| --- | --- |
| `game.box(width, height, depth, color, { x, y, z })` | 一个方块，中心在给定位置 |
| `game.sphere(radius, color, { x, y, z })` | 一个球 |
| `game.cylinder(radius, height, color, { x, y, z })` | 一个竖立的圆柱 |
| `game.cone(radius, height, color, { x, y, z })` | 一个底面朝下的圆锥 |
| `game.ground(size, color, y = 0)` | 一块该大小的方形地面，顶面在高度 `y`。它有 8 个单位厚，所以在慢的一帧里快速下落的物体仍会被推回到它上面 |
| `game.add(model, { x, y, z })` | 把自己的模型变成一个物体：自己几何体的 `Mesh3D`、由它们组成的组，或 `loadGltf3D` 加载的模型。用于判断的包围盒由它所有的网格按各自在其中的位置算出，所以脚站在原点的人物会站在地面上。它保留自己的材质，设置 `color` 不会改变它 |
| `game.remove(thing)` | 把它从世界中拿掉 |
| `game.group([a, b, c], { x, y, z })` | 把几个物体合成一个：组作为一个物体放置、旋转、缩放、补间和判断。物体在组里保持原位，位置从此以组的位置为原点，组的位置是 `at`，未给出时为 0。判断时用组而不是它的部分；移除组也会移除它们。一个物体最多属于一个组 |
| `game.lamp(color, { x, y, z }, { intensity: 4, range: 8 })` | 一盏灯：从一点发出、到 range 处衰减为零的光。可设置和补间它的 `x`、`y`、`z`、`color`、`intensity`、`range` 和 `visible`；`game.remove(lamp)` 熄灭它。八盏以内完整照明，更多的用较粗略的方式照明 |
| `game.onTap(thing, () => …)` | 物体被点击或轻触时调用函数：从相机穿过指针发出一条射线，它遇到的最近一个设置了点击的物体收到。按在物体上的那一下仍然算作 `game.pointer.pressed`。界面上的精灵和 `play` 中一样交给 `onTap` |

自己的模型可以用代码塑形：由圆润的零件平滑相连，再作为物体加入，见[用距离场塑形的模型](world3d-app.md#用距离场塑形的模型)：

```js
const { createSdfGeometry3D, createStandardMaterial3D, Mesh3D, sdfEllipsoid, sdfSphere, sdfUnion } = Egret;
const shape = sdfUnion([sdfEllipsoid([0.5, 0.4, 0.6], { color: 0xf0a040 }), sdfSphere(0.35, { at: [0, 0.45, 0.45], color: 0xf0a040 })], { smooth: 0.1 });
const critter = game.add(new Mesh3D(createSdfGeometry3D(shape), createStandardMaterial3D({ vertexColors: true })), { x: 0, y: 0.5, z: 0 });
```

带骨骼的模型会动：在 `setup` 里加入它的根节点并播放一个片段，在 `update` 里推进。以载入为 `villager` 的范例库村民模块为例：

```js
let rig;
// 在 setup(game) 里：
rig = villager.rig(Egret);
game.add(rig.root, { x: 2, z: -3 });
rig.play(rig.clips.walk);
// 在 update(dt, game) 里：
rig.update(dt);
```

每个调用都返回一个物体。可以随时设置它的 `x`、`y`、`z`、`rotationX`、`rotationY`、`rotationZ`（角度）、`scale` 或 `scaleX`、`scaleY`、`scaleZ`、`visible` 和 `color`；它们都可以补间，例如 `game.tween(door).to({ y: 4 }, 0.5)`。也可以加上自己的属性（`enemy.hp = 3`）。`thing.removed` 表示它是否已被移除；设置已移除的物体不起作用，也不会出错。`thing.node` 是它的 [Mesh3D](world3d.md)。 `thing.glow` 让物体以自己的颜色发光，无论是否被照亮：默认 0，1 与它的颜色一样亮，灯笼或屏幕可以更大；它跟随新的 `color`，模型保留自己的材质。发光的物体不会被雾遮住。`thing.opacity` 表示物体可见的程度，默认 1：小于 1 时能透过它看到后面，例如玻璃或幽灵，半透明物体不投影；同时有 `glow` 时它的光会叠加到后面，就像光束。每种形状都以中心定位。`rotationY` 让物体向左转，从上往下看是逆时针；为 0 时物体背对相机、朝向 -z，所以向前移动是 `x -= Math.sin(r) * d`、`z -= Math.cos(r) * d`，其中 `r = thing.rotationY * Math.PI / 180`。

导入模型保留自身已有的根旋转，修改 `rotationY` 会保留其他两个轴。碰撞推出方向使用判定重叠时的同一组缩放后包围盒中心，也适用于原点在脚底的模型。

内建几何及其生成的材质归游戏所有，移除、重开或关闭时会释放。传给 `add` 的模型按借用处理，其几何、材质和纹理仍由调用方管理。粒子共用的形状在重开时继续复用，在最终关闭时释放。世界清理期间或关闭后创建、挂接物体，会以 `PLAY_OPTIONS_INVALID` 拒绝。资源释放监听器失败时，其余清理仍会继续，失败会返回给调用方。

Play3D 遵循 [Play 重开契约](play.md)。初始化失败会释放本轮创建的内建图元，并撤下借用模型。等待 `game.dispose()` 即可等到界面层与 World3D Engine 完成关闭，包括渲染器及其 Scope。如果某项资源清理失败，其余清理仍会继续，关闭 Promise 会将错误返回给调用方。并发关闭共用同一个 Promise。

2026 年 11 月 18 日，Windows Edge 157（RTX 5090 Laptop）和 Galaxy Z Fold7 Chrome 157（Adreno 830）均在 WebGPU、WebGL2 上通过了[异步生命周期用例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/verify-async-lifecycle.mjs)。128 × 96 的场景沿用此前生命周期检查的 World3D 低画质预设。用例在初次加载和重开时控制应用加载完成的时机，用指针操作 UI 和网格触发加载失败，并验证随后显式调用重开可以恢复更新，还通过公开的关闭 Promise 收到资源清理错误。每组均记录到关闭后迟到的对象挂接数为零、残留画布为零、未处理的 Promise 拒绝为零。

未修改的 #369 在 Windows WebGL2 默认高画质下运行单场景时曾丢失上下文。主干 `b3874464` 在 Windows Edge 157.0.4341.60、GeForce RTX 5090 Laptop（ANGLE D3D11）上用一个箱体和 2D 叠层复现。仅关闭 SSAO 后，首先报告错误的着色器从 `post/ssao` 变为 `post/down`。仅关闭箱体的阴影接收，保留 SSAO，场景即可持续运行。

WebGL2 片元着色器现在读取分割距离向量的四个固定分量，选择方向光阴影级联及其远边界，表面阴影与体积阴影共用这一选择。在原高画质设置下保留阴影与 SSAO，同一场景在 120 次浏览器帧回调中更新了 119 次，上下文丢失和渲染错误均为零。另一组 128 × 96 地面与箱体用例核查一至四张阴影图下的受光和阴影像素，在原生 WebGL2 与 WebGPU 上通过。单独使用 SwiftShader 对照修复前后，关闭阴影及一至四张阴影图的五次读回均逐字节一致。以上结果验证画面与运行正确性。

## 相机和太阳

`game.follow(thing, { x: 0, y: 4, z: 8, smooth: 6 })` 让相机与一个物体保持这样的距离、看着它，并平滑地跟上；`smooth: 0` 让它严格保持在那里；`turn: true` 让这个位置随物体的 `rotationY` 一起转，所以无论车或人物朝哪边，相机都在它后面。`lookY` 让相机看向物体上方这么高的地方，而不是看物体本身，用来把高塔或船上方的天空收进画面；相机位置不变。不用 `follow` 时，设置 `game.camera.x`、`.y` 和 `.z`，并调用 `game.camera.lookAt(x, y, z)`；`game.camera.fov` 是它的视角，不设置时为 55 度。它一开始在 (0, 6, 12)，看着世界的中心。

**竖着拿。** 和大多数引擎一样，`game.camera.fov` 是从上到下的视角。竖着拿的手机宽度只有高度的一半左右，看到的两侧比横着拿时少得多：在 393 × 852 CSS 像素上，横向只有 27 度，而不是 55 度。`game.camera.keepWidthBelow = 1` 让比正方形窄的画面都保持正方形画面的横向视角，多出来的部分显示在上下。在 393 × 852 上，从上到下的视角变为 97 度。换一个比例就保持另一个宽度：`16 / 9` 保持宽屏的横向视角。画面至少这么宽时，`fov` 不变。实际绘制用的视角是 `game.camera.node.fov`。用 `createWorld3DApp` 做的游戏也可以按 `camera.aspect` 这样设置相机的 `fov`：在这个比例以下取 `2 * atan(tan(fov / 2) * 比例 / aspect)`。

`game.sun` 是白天的光，另有来自天空的柔光。它保持方向不变，并始终位于相机所看之处的上方。每个物体都会投下并接收阴影，不需要设置。阴影在应用为设备选择的[画质](world3d-app.md#画质)为 `medium` 或 `high` 时绘制；软件渲染的浏览器得到 `low`，没有阴影，用 `game.app.setQuality('medium')` 可以强制打开。

## 世界的观感

`game.look(name)` 一次设定光线和空气：`'day'`（游戏开始时的样子）、`'dusk'`、`'night'`、`'fog'` 或 `'snow'`。它改变背景、上下两方天光的颜色和强度、太阳的颜色、强度和方向，以及雾（雾色跟随背景色）。传入对象 `{ background, sky, ground, light, sun, sunIntensity, sunFrom, fog }` 只改其中给出的部分。`fog` 是指数雾的浓度：0 为晴朗，0.02 为薄霾，0.06 为浓雾。`sunFrom` 是太阳照来的方向 `[x, y, z]`，y 须大于 0。重开后保持当前观感；五种预设见 `PLAY_LOOKS_3D`。软件渲染的浏览器画质为 `low`，没有阴影和泛光，这些预设是在那里检查的；硬件上会带阴影绘制。 `game.weather('snow')` 或 `'rain'` 让雪或雨在相机所看之处周围落下，`{ amount }` 从 0 到 3，默认 1；`'none'` 停止，重新开始时同样保留。相机移动时雪花留在落下的地方；它们的运动在 GPU 上计算，每帧不占游戏的时间。

## 判断

| 查询 | 回答 |
| --- | --- |
| `game.overlaps(a, b)` | 两个物体是否重叠，按它们的大小和缩放取正放的包围盒 |
| `game.hits(a, list)`、`game.hitsAll(a, list)` | 列表中第一个与 `a` 重叠的物体，或全部 |
| `game.near(a, b, distance?)` | 两者中心是否在某个距离以内：不指定时为两者半径之和 |
| `game.pushOut(a, b)` | 把 `a` 沿最短的方向移出 `b` 需要移动多少：`{ x, y, z }`，其中一个不为 0；不重叠时为 `undefined`。`y` 大于 0 表示 `a` 站在 `b` 上 |

隐藏的或已移除的物体不与任何东西重叠。转动过的物体仍按正放的包围盒判断。需要翻滚、滑动和堆叠的物体，可以用[物理](world3d.md)：`@egret/engine/world3d` 的 `createPhysicsWorld3D`，`play3d` 没有包装它。

## 手感

`game.shake(amount = 0.3, seconds = 0.25)` 让相机晃动，幅度不超过这么多个世界单位。`game.burst(x, y, z, { color, count, speed, life, size, gravity })` 从一个点迸出小碎块。`game.flash`、`game.hitStop` 和 `game.sfx` 就是 `play` 的那些。

## 页面

使用模块时，页面与 [`play`](play.md#页面) 的相同，只是 import map 里要有 `@egret/engine/webgl2/world3d`。使用[单文件](single-file.md)时是 `egret3d.js`，其中包含 `play`、`play3d` 和 World3D：

```html
<script src="egret3d.js"></script>
<script type="module">
const { play3d } = Egret;
await play3d({ width: 960, height: 540, setup(game) { … }, update(dt, game) { … } });
</script>
```

## 保留已经配置的 World3D 渲染器，使用 Play 的时钟

游戏已经有自己的渲染器、画布、场景、相机和画质策略时，可以从任一显式 World3D 浏览器入口调用 `play3dAttached`。它是 `play3d` 的配套入口，不改变 `play3d` 创建新世界的方式。

```js
import { play3dAttached } from '@egret/engine/webgl2/world3d';

// 页面在 holder 内把现有 World3D 画布放在 Play 界面下方。
// 渲染器、场景、相机均由游戏配置。
const session = await play3dAttached({
  parent: holder, width: 960, height: 540,
  portrait: { width: 540, height: 960 }, fit: 'expand',
  setup(game) { game.text('准备就绪', { x: 20, y: 20 }); },
  async world(game) {
    await loadAssets();
    return { renderer, scene, camera, maxPixelRatio: 1.5,
      onUpdate(dt) { advanceWorld(dt, game); } };
  },
});
const game = session.game;
console.assert(session.view?.renderer === renderer);
```

支持普通的 `PlayOptions`（`transparent` 除外，界面始终透明）。可选的 `setup` 先运行，再等待异步 `world` 工厂；`arrange` 和 `update` 保留 Play 原有职责。`world` 收到的正是 `session.game` 返回的同一 `PlayGame`。工厂返回 [World3DView 的选项](world3d-app.md)，包括 `autoResize`、`maxPixelRatio`、`mixers`、`controls`、`updateParticles`、`onUpdate`、`onFrameTiming` 和 `onError`。`autoResize: false` 保留调用方管理的绘制尺寸与投影。入口不会应用画质预设、增添灯光或者修改场景和相机选定的投影参数。

顶层 `onFrameTiming` 记录整个 Play 浏览器回调（其中包含接入的世界更新及 2D 提交各阶段），而返回的 World3DView 选项里的独立 `onFrameTiming` 记录世界更新和 3D 渲染提交。这两组时序存在重叠，不能直接相加，也不能当作 GPU 执行时间。

这里只使用一个 Play Engine 时钟，以及由 Play 生命周期 Scope 管理、每一轮结束即清理的 Scope 中的一个视图订阅；`play3dAttached` 不创建 3D 应用、渲染器或额外的动画帧循环。由调用者摆放原有 3D 画布，保证与 2D 画布分离，并在接入前停止已有的独立绘制循环。同一个渲染器不能同时绑定到两次尚存活的配套会话。返回的 `view` 是当前 World3DView；加载中、重启失败、释放后或者工厂返回 `undefined` 时均为空。工厂返回 `undefined` 会保留实际的 Play 原生界面但不绘制世界，例如游戏自己的资源重试界面。

`game.restart()` 会在新一轮 setup 和工厂之前撤掉旧视图订阅，新工厂加载期间旧世界不再绘制，工厂失败后也没有活动视图。Play 的重试、关闭 Promise 保留原有行为。`game.dispose()` 终止自己创建的界面和时钟订阅，但不会代为释放已有渲染器及其画布、场景、相机、控制器或资源。创建者可以明确把自己拥有的渲染器／资源登记到 `game.scope`，或者另行释放；默认是借用。与 `createWorld3DView` 一样，`game.pause()` 停止 Play 的游戏更新和定时器，不会自动停止每个世界绘制回调；需要时显式暂停 `session.view`。

2026 年 11 月 28 日，公有接入会话浏览器用例在 Windows Edge 上分别使用 RTX 5090 Laptop 的 WebGL2（ANGLE D3D11）及 NVIDIA Blackwell WebGPU 适配器。同一组 12 次浏览器回调中，各观察到 12 次 Play Engine 时钟、12 次世界更新、12 次渲染器帧、12 次计时记录。两组的阻塞与失败重启均撤掉上一代视图；连续八次重启、特意触发的 `arrange` 失败、仅界面运行及重试、加载未完成时关闭、重复绑定渲染器拒绝与首次加载失败清理均通过。传入的相机、场景、渲染器配置与借用画布保持原样；关闭游戏后，调用方仍能用同一渲染器绘制。浏览器错误为零。这些是有界的生命周期与提交次数观察，不代表呈现帧率、GPU 执行耗时或手机验收。复跑：`node tests/play3d-attached-browser.mjs <Playwright index.mjs 的绝对路径> webgl2`（或 `webgpu`）；用 `CHROMIUM_PATH` 和 `EGRET_BROWSER_HARDWARE=1` 选择已安装的硬件浏览器。

## 游戏变大之后

`game.scene` 是 [Scene3D](world3d.md)，`game.app` 是 [World3D 应用](world3d-app.md)：从 glTF 加载的模型、材质、更多的灯光、粒子、物理和后期处理，都可以加到场景里，与 `play3d` 创建的内容并存。`game.camera.node` 和 `thing.node` 就是相机和网格本身。

## 11 月 27 日真机补验

11 月 27 日实测：Fold7 在 140 × 325 CSS 的窄容器中，双后端保持相机宽视野后显示两侧物体，视角由 55° 变为 100.78°；Windows 硬件 WebGL2 原投影测试也通过。该窄容器在真实竖屏会话（411 × 813 CSS）中由脚本设置，实际旋转过渡和真人画面体验仍待测。 [真机观测及剩余范围](november-27-claude-hardware.md).
