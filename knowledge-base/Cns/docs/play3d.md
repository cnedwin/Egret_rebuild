# Play3D：一次调用做出一个完整的 3D 小游戏

[English](../../en/docs/play3d.md) | 简体中文

`play3d` 是下面垫了一个三维世界的 [`play`](play.md)。一次调用创建画面、相机、太阳和循环；它返回的游戏对象提供用普通数字摆放的方块、球、圆柱、圆锥和地面，会跟随的相机，距离和重叠的判断，以及命中时迸出的碎块。其余的都是 `play` 原样提供的：每帧查询的按键和指针、代码合成的音效、定时器、补间、文字、按钮、存档和 `restart`。它由 `@egret/engine/webgl2/world3d` 导出。

画面是一个画在自己画布上的 [World3D 应用](world3d-app.md)。界面是一个透明地画在它上面的 `play` 游戏，和应用的[叠加层](world3d-app.md)一样，所以文字和按钮是平面的，使用 `width` 和 `height` 的单位。

**核对了什么。** 选项、物体的各个数字和重叠判断在 Node 中核对。在无头 Chromium 的软件 WebGL2 上，[play 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.zh-CN.md)中的游戏被键盘玩到结束：球落地、滚到一颗星、跳起、从边缘掉下去，按钮让它重新开始。软件渲染时画质为 `low`，所以没有绘制阴影和抗锯齿。没有在真实 GPU、手机、其他浏览器和 WebGPU 上运行。

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
| `game.remove(thing)` | 把它从世界中拿掉 |

每个调用都返回一个物体。可以随时设置它的 `x`、`y`、`z`、`rotationX`、`rotationY`、`rotationZ`（角度）、`scale` 或 `scaleX`、`scaleY`、`scaleZ`、`visible` 和 `color`；它们都可以补间，例如 `game.tween(door).to({ y: 4 }, 0.5)`。也可以加上自己的属性（`enemy.hp = 3`）。`thing.removed` 表示它是否已被移除；设置已移除的物体不起作用，也不会出错。`thing.node` 是它的 [Mesh3D](world3d.md)。

## 相机和太阳

`game.follow(thing, { x: 0, y: 4, z: 8, smooth: 6 })` 让相机与一个物体保持这样的距离、看着它，并平滑地跟上；`smooth: 0` 让它严格保持在那里。不用 `follow` 时，设置 `game.camera.x`、`.y` 和 `.z`，并调用 `game.camera.lookAt(x, y, z)`；`game.camera.fov` 是它的视角，不设置时为 55 度。它一开始在 (0, 6, 12)，看着世界的中心。

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
