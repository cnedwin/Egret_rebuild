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
| `game.onTap(thing, () => …)` | 物体被点击或轻触时调用函数：从相机穿过指针发出一条射线，它遇到的最近一个设置了点击的物体收到。按在物体上的那一下仍然算作 `game.pointer.pressed`。界面上的精灵和 `play` 中一样交给 `onTap` |

每个调用都返回一个物体。可以随时设置它的 `x`、`y`、`z`、`rotationX`、`rotationY`、`rotationZ`（角度）、`scale` 或 `scaleX`、`scaleY`、`scaleZ`、`visible` 和 `color`；它们都可以补间，例如 `game.tween(door).to({ y: 4 }, 0.5)`。也可以加上自己的属性（`enemy.hp = 3`）。`thing.removed` 表示它是否已被移除；设置已移除的物体不起作用，也不会出错。`thing.node` 是它的 [Mesh3D](world3d.md)。

导入模型保留自身已有的根旋转，修改 `rotationY` 会保留其他两个轴。碰撞推出方向使用判定重叠时的同一组缩放后包围盒中心，也适用于原点在脚底的模型。

内建几何及其生成的材质归游戏所有，移除、重开或关闭时会释放。传给 `add` 的模型按借用处理，其几何、材质和纹理仍由调用方管理。粒子共用的形状在重开时继续复用，在最终关闭时释放。世界清理期间或关闭后创建、挂接物体，会以 `PLAY_OPTIONS_INVALID` 拒绝。资源释放监听器失败时，其余清理仍会继续，失败会返回给调用方。

Play3D 遵循 [Play 重开契约](play.md)。初始化失败会释放本轮创建的内建图元，并撤下借用模型。等待 `game.dispose()` 即可等到界面层与 World3D Engine 完成关闭，包括渲染器及其 Scope。如果某项资源清理失败，其余清理仍会继续，关闭 Promise 会将错误返回给调用方。并发关闭共用同一个 Promise。

2026 年 11 月 18 日，Windows Edge 157（RTX 5090 Laptop）和 Galaxy Z Fold7 Chrome 157（Adreno 830）均在 WebGPU、WebGL2 上通过了[异步生命周期用例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/verify-async-lifecycle.mjs)。128 × 96 的场景沿用此前生命周期检查的 World3D 低画质预设。用例在初次加载和重开时控制应用加载完成的时机，用指针操作 UI 和网格触发加载失败，并验证随后显式调用重开可以恢复更新，还通过公开的关闭 Promise 收到资源清理错误。每组均记录到关闭后迟到的对象挂接数为零、残留画布为零、未处理的 Promise 拒绝为零。

在这台 Windows 设备上，单独运行默认高画质 WebGL2 时发生了上下文丢失。未修改的 #369 在单场景、不执行重开的情况下也复现了同一问题。ANGLE 报告 D3D11 动态像素着色器编译错误，渲染器报告 `WORLD3D_SHADER_FAILED: post/ssao`。这套配置的高画质渲染仍待解决。

## 相机和太阳

`game.follow(thing, { x: 0, y: 4, z: 8, smooth: 6 })` 让相机与一个物体保持这样的距离、看着它，并平滑地跟上；`smooth: 0` 让它严格保持在那里；`turn: true` 让这个位置随物体的 `rotationY` 一起转，所以无论车或人物朝哪边，相机都在它后面。不用 `follow` 时，设置 `game.camera.x`、`.y` 和 `.z`，并调用 `game.camera.lookAt(x, y, z)`；`game.camera.fov` 是它的视角，不设置时为 55 度。它一开始在 (0, 6, 12)，看着世界的中心。

`game.sun` 是白天的光，另有来自天空的柔光。它保持方向不变，并始终位于相机所看之处的上方。每个物体都会投下并接收阴影，不需要设置。阴影在应用为设备选择的[画质](world3d-app.md#画质)为 `medium` 或 `high` 时绘制；软件渲染的浏览器得到 `low`，没有阴影，用 `game.app.setQuality('medium')` 可以强制打开。

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

## 游戏变大之后

`game.scene` 是 [Scene3D](world3d.md)，`game.app` 是 [World3D 应用](world3d-app.md)：从 glTF 加载的模型、材质、更多的灯光、粒子、物理和后期处理，都可以加到场景里，与 `play3d` 创建的内容并存。`game.camera.node` 和 `thing.node` 就是相机和网格本身。
