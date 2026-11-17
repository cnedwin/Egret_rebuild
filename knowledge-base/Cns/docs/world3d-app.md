# 一次调用启动 World3D 游戏

[English](../../en/docs/world3d-app.md) | 简体中文

本页介绍大多数 3D 游戏原本各自实现的部分：启动、用代码拼模型、画面上的标签，以及性能读数。

`createWorld3DApp` 在一个画布上启动 3D 游戏：选择后端，在 World3D 宿主上创建 Engine，按画质创建渲染器，运行帧循环，并在帧率偏低时降低绘制分辨率。`@egret/engine/webgl2/world3d` 和 `@egret/engine/webgpu/world3d` 都导出它。

**验证了什么、没验证什么。** 选择逻辑、画质预设和分辨率控制器在 Node 中验证。在使用软件 WebGL2 的无头 Chromium 中，一个请求 WebGPU 的应用在没有可用适配器时退回到 WebGL2，绘制了 2.5 秒场景，执行了 `setQuality('low')` 并完成销毁；51 个零件合成的模型一次绘制完成，标签跟随方块，相机后方目标的标记停在底边，性能读数正常显示。WebGPU 和硬件没有运行。

## 用法

```js
import { createWorld3DApp } from '@egret/engine/webgl2/world3d';
import { Scene3D, createPerspectiveCamera3D } from '@egret/engine/world3d';

const app = await createWorld3DApp(canvas, {
  storedQuality: save.quality,
  onError: error => showTrouble(error),
  onDeviceLost: () => showTrouble('显卡设备已停止工作。'),
});
const scene = new Scene3D();
const camera = createPerspectiveCamera3D({ fov: 60 });
scene.addChild(camera);
app.show(scene, camera, { onUpdate: (seconds) => game.update(seconds) });
```

`app.show` 替换当前显示的内容并启动循环。`app.stop()` 和 `app.start()` 暂停和恢复。`app.dispose()` 结束循环、视图、渲染器和 Engine。

## 后端

`backend` 为 `webgl2` 或 `webgpu`。不传时由地址决定：`?backend=webgpu` 请求 WebGPU，其他情况用 WebGL2。请求了 WebGPU 但浏览器没有提供适配器时，改用 WebGL2 绘制，`app.fellBack` 为 true。自己创建渲染器的页面可用 `pickWorld3DBackend(query, fallback)` 得到相同的选择。

## 画质

`quality` 为 `low`、`medium`、`high` 或 `auto`（默认）。`auto` 依次读取：

1. 地址中的 `?quality=`；
2. `storedQuality`，玩家之前的选择；
3. 设备：手指操作或窗口短边小于 600 像素时为 `low`，内存不超过 4 GB 时为 `medium`，否则为 `high`。

`pickWorld3DQuality(hints)` 给出同样的结果。

| 画质 | 像素比 | 抗锯齿 | 阴影 | 后期处理 |
| --- | --- | --- | --- | --- |
| `low` | 1 | 关 | 关 | 关 |
| `medium` | 1.5 | 开 | 开，2048 图集 | 泛光和 FXAA |
| `high` | 2 | 开 | 开，4096 图集 | 泛光、FXAA 和环境光遮蔽 |

`WORLD3D_QUALITY_PRESETS` 是这张表。`app.setQuality(quality)` 应用另一行的阴影、后期处理和像素比。抗锯齿和阴影图集尺寸在创建渲染器时确定。启动后游戏仍可自行设置 `renderer.postProcess` 的其他字段。

## 绘制分辨率

除非传入 `dynamicResolution: false`，绘制分辨率随帧率变化。平滑后的帧率持续 1.5 秒低于每秒 45 帧时，像素比的比例下降 0.15，最低 0.6；持续 6 秒高于 57 帧时逐步回升。`app.resolutionScale` 给出当前比例，阈值是 `dynamicResolution` 的选项。自己驱动循环的页面可用 `createDynamicResolution3D(options)` 得到同样的控制器：每帧调用 `update(seconds)`，把像素比乘以返回的比例。

## 用代码拼模型

`createGeometryBuilder3D()` 把许多摆好位置、上了颜色的零件合成一个几何体，所以用方块拼成的卡车、一片石头都只需一次绘制。

```js
import { createBoxGeometry3D, createCylinderGeometry3D, createGeometryBuilder3D, createStandardMaterial3D, Mesh3D } from '@egret/engine/world3d';

const truck = createGeometryBuilder3D()
  .add(createBoxGeometry3D(2, 1, 1.6), { position: [0, 1, 0], color: 0x4b5d3a })
  .add(createCylinderGeometry3D(0.4, 0.4, 0.3), { position: [0.7, 0.4, 0.85], rotation: [Math.PI / 2, 0, 0], color: 0x1a1a1a })
  .build();
scene.addChild(new Mesh3D(truck, createStandardMaterial3D({ vertexColors: true })));
```

零件用 `position`、`rotation`（欧拉角，弧度）或 `quaternion`、`scale` 摆放，也可以直接给 `matrix`。`color` 是屏幕上看到的十六进制颜色或线性 RGB，以线性值写入顶点颜色，所以材质要设 `vertexColors: true`。`keepColors` 会乘上零件原有的顶点颜色。镜像摆放的零件，三角形仍然朝外。合成的几何体有位置、法线、颜色，所有零件都有纹理坐标时也保留纹理坐标。手写顶点颜色时，`linearColor3D(hex)` 给出十六进制颜色的线性值。

## 画面上的标签和标记

3D 游戏的界面通常是叠在画布上的网页元素。`createScreenMarkers3D({ container, camera })` 让这些元素跟着场景中的点。

```js
const markers = createScreenMarkers3D({ container: hud, camera });
markers.add(nameTag, { target: enemy, offset: [0, 2.1, 0], maxDistance: 40 });
markers.add(objective, { target: [120, 0, -40], clampToEdge: true, margin: 32 });
// 每帧，相机移动之后
markers.update();
```

元素用 CSS 变换移动，所以给它设 `position: absolute; left: 0; top: 0`。目标在相机后方或超过 `maxDistance` 时，标记隐藏。设了 `clampToEdge` 的标记则停在屏幕边缘，带上 `data-on-edge`，`marker.angle` 给出箭头应指的方向。自己画标记的代码可用 `projectToViewport3D(camera, point, width, height)` 得到同样的投影。

## 性能读数

`createWorld3DStats(renderer, { container })` 显示帧时间、游戏自己各部分的耗时，以及渲染器画了什么：绘制次数、三角形数、被舍去的灯、程序、几何体和纹理。每帧开始时调用 `begin()`，每部分之后调用 `lap(name)`，绘制之后调用 `end()`。不传 `container` 时仍会收集数字，供自动检查使用。

## 限制

应用同一时间只用一个相机绘制一个场景。需要第二个视图、画中画，或在同一画布上叠加 2D 层的游戏，自行驱动 `World3DView`。设备丢失会报告给 `onDeviceLost`，恢复的办法是重新创建一个应用。
