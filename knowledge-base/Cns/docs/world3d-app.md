# 一次调用启动 World3D 游戏

[English](../../en/docs/world3d-app.md) | 简体中文

本页介绍大多数 3D 游戏原本各自实现的部分：启动、用代码拼模型、画面上的标签，以及性能读数。

`createWorld3DApp` 在一个画布上启动 3D 游戏：选择后端，在 World3D 宿主上创建 Engine，按画质创建渲染器，运行帧循环，并在帧率偏低时降低绘制分辨率。`@egret/engine/webgl2/world3d` 和 `@egret/engine/webgpu/world3d` 都导出它。

**验证记录。** Node 检查覆盖后端选择、画质预设和分辨率控制。早期软件 WebGL2 验证覆盖了后端回退、几何合并、标记、统计读数和覆盖层合成。随后在 Windows Edge 157（RTX 5090 Laptop GPU）和 Fold7 Chrome（Adreno 830）上，使用 WebGPU 与 WebGL2 验证了应用启动、暂停、尺寸调整、销毁、屏幕标记、蒙皮重定向和实例范围变化。

基线 `c049bc38` 的真机测试发现，WebGPU 在 128 × 65 渲染目标上选中了第九盏点光源，画面中却缺失这盏灯。Windows 同机全目标像素对照确认，同一光源走直接照明时可以正常照亮。128 × 64 对照与 WebGL2 两种尺寸均正常。按片元坐标计算分块行后，两台设备 128 × 65 画面的 33,280 个 RGBA8 字节全部与直接照明一致。结论覆盖本次采样场景的像素与生命周期。

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
3. 设备：WebGL 由软件绘制（无头浏览器、虚拟机、显卡被禁用）、手指操作或窗口短边小于 600 像素时为 `low`；内存不超过 4 GB 时为 `medium`；否则为 `high`。

把 `softwareRenderer` 提示设为 `isSoftwareRendered3D()` 时，`pickWorld3DQuality(hints)` 给出同样的结果；应用会替你查询。

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
  .add(createBoxGeometry3D({ width: 2, height: 1, depth: 1.6 }), { position: [0, 1, 0], color: 0x4b5d3a })
  .add(createCylinderGeometry3D({ radiusTop: 0.4, radiusBottom: 0.4, height: 0.3 }), { position: [0.7, 0.4, 0.85], rotation: [Math.PI / 2, 0, 0], color: 0x1a1a1a })
  .build();
scene.addChild(new Mesh3D(truck, createStandardMaterial3D({ vertexColors: true })));
```

零件用 `position`、`rotation`（欧拉角，弧度）或 `quaternion`、`scale` 摆放，也可以直接给 `matrix`。`color` 是屏幕上看到的十六进制颜色或线性 RGB，以线性值写入顶点颜色，所以材质要设 `vertexColors: true`。`keepColors` 会乘上零件原有的顶点颜色。镜像摆放的零件，三角形仍然朝外。合成的几何体有位置、法线、颜色，所有零件都有纹理坐标时也保留纹理坐标。手写顶点颜色时，`linearColor3D(hex)` 给出十六进制颜色的线性值。

## 用距离场塑形的模型

方块互相穿插，看上去就是方块。做动物、道具、房子、植物时，可以把形状描述成平滑相连的圆润零件，由引擎生成网格：`createSdfGeometry3D(shape, options)` 把用 `sdf*` 调用搭出的形状变成一个带颜色的网格，法线平滑，零件相接处颜色自然过渡，褶皱和凹处的阴影烘焙进顶点颜色。

```js
import { createSdfGeometry3D, createStandardMaterial3D, Mesh3D, sdfCapsule, sdfEllipsoid, sdfMirror, sdfSphere, sdfSubtract, sdfUnion } from '@egret/engine/world3d';

const fur = 0xf0a040;
const body = sdfUnion([
  sdfEllipsoid([0.6, 0.5, 0.72], { color: fur }),
  sdfSphere(0.42, { at: [0, 0.55, 0.55], color: fur }),
  sdfMirror(sdfEllipsoid([0.1, 0.22, 0.06], { at: [0.25, 0.98, 0.45], rotation: [0, 0, -0.4], color: fur })), // 耳朵
  sdfMirror(sdfCapsule([0.3, -0.2, 0.3], [0.33, -0.62, 0.36], 0.14, { radiusEnd: 0.11, color: fur })), // 前腿
  sdfEllipsoid([0.2, 0.14, 0.14], { at: [0, 0.45, 0.9], color: 0xfff0dd }) // 口鼻
], { smooth: 0.1 });
const mouth = sdfSubtract(body, sdfEllipsoid([0.1, 0.03, 0.1], { at: [0, 0.37, 1.0], color: 0x6a1a1a }), { smooth: 0.02 });
const face = sdfUnion([mouth, sdfMirror(sdfSphere(0.07, { at: [0.17, 0.68, 0.9], color: 0x111111 }))], { smooth: 0.01 }); // 眼睛保持清晰
const critter = new Mesh3D(createSdfGeometry3D(face, { variation: { amount: 0.06 } }), createStandardMaterial3D({ vertexColors: true, roughness: 0.75 }));
```

零件：`sdfSphere(radius)`、`sdfBox([w, h, d], { round })`、`sdfEllipsoid([rx, ry, rz])`、用于四肢、树枝和角的 `sdfCapsule(from, to, radius, { radiusEnd })`、`sdfCylinder(radius, height, { round })`、`sdfCone(bottom, top, height)` 和 `sdfTorus(radius, tube)`。每个零件都接受 `at`、`rotation`（欧拉角，弧度）、单一的 `scale` 和 `color`；没给颜色的零件取所在组的颜色。组合：`sdfUnion(parts, { smooth })` 在 `smooth` 的范围内把零件融成一体；`sdfSubtract(base, cuts, { smooth })` 挖掉一部分（带颜色的挖切会给挖出的面上色，比如嘴里）；`sdfIntersect(parts)` 只留共有部分；`sdfMirror(part, { axis })` 生成成对的眼睛、耳朵、腿。`sdfRound(shape, r)` 加厚并倒圆，`sdfShell(shape, t)` 掏空，`sdfDisplace(shape, { amount, frequency, seed })` 让石头、树皮、泥土表面起伏。组也接受同样的 `at`、`rotation`、`scale` 和 `color`，所以由几个零件组成的一条腿可以整体摆放。游戏运行时 `shape.distance(x, y, z)` 也有用，可以拿来对模型做命中判断。

网格选项：`resolution`（最长边上的格数，默认 64，范围 8 到 192）、`triangles`（三角形上限，默认 8000；0 表示全部保留）、`occlusion`（褶皱变暗的程度，默认 0.7）、`occlusionRadius`、`variation`（{ `amount`, `frequency`, `seed` }，亮度的起伏，让大块零件不是一整片纯色），以及给没有颜色的零件用的 `color`。模型在初始化时生成一次：默认设置下一个模型要几百毫秒。眼睛、纽扣这类不能融进底下的细节，单独放进一个 `smooth` 很小的组。

`simplifyGeometry3D(geometry, { triangles | ratio, maxError })` 把任何带索引的三角形几何体减到给定的面数，适用于生成或扫描的模型，以及远处的细节层级。它按二次误差度量先折叠代价最小的边，拒绝会让三角形翻面或让表面捏合的折叠，开放边和纹理接缝上的顶点保持原位，每个顶点保留自己的属性，几何体的材质分组也保留，返回 `{ geometry, before, after, error }`。带变形目标的几何体会被拒绝。

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

## 引擎的 2D 界面叠在场景上

```js
import { createWorld3DApp, createWorld3DOverlay } from '@egret/engine/webgl2/world3d';
import { Sprite } from '@egret/engine';

const app = await createWorld3DApp(canvas);
const ui = await createWorld3DOverlay(canvas, { width: 1280, height: 720 });
const pause = new Sprite();
pause.graphics.beginFill(0x203040).drawRect(0, 0, 120, 48).endFill();
pause.touchEnabled = true;
ui.game.stage.addChild(pause);
```

`createWorld3DOverlay` 在 3D 画布正上方放一块透明画布（3D 画布须放在定位的父元素里），并用 `createBrowserGame` 在上面启动一个 2D 游戏。菜单、血条、文字、位图按钮和 `ui` 控件随后用引擎的 2D 舞台画在场景之上。页面尺寸变化时，叠加层跟随 3D 画布的位置和大小。默认情况下舞台被拉伸铺满这个框，手机一转界面就被压扁；`fit: 'contain'` 保持舞台的宽高比，在框内尽量放大并居中；`fit: 'cover'` 保持宽高比并铺满框，超出部分由父元素裁掉。`overlay.box` 给出舞台当前的位置和缩放（每单位多少 CSS 像素）。舞台自己的 `width`、`height` 保持创建时的值：布局需要随宽高比改变时，请按新的宽度重新创建叠加层。

按压或滚轮落在开启 `touchEnabled` 的 2D 节点上时，由覆盖层接收。起点在空白处的按压及后续拖动交给 3D 画布。浏览器原生主指针点击只有在按下已归属场景且释放仍在空白处时，才会将 DOM 事件副本交给场景。从 2D 控件拖到空白处会保留原手势归属。空白处转发悬停移动。设置 `passThrough: false` 可让所有事件留在覆盖层。`ui.dispose()` 结束 2D 游戏并移除覆盖层。Windows 鼠标和 Fold7 触摸自动化在双后端都验证了点击和拖动路由。

2D 舞台默认用 WebGL2，这样 3D 渲染器使用 WebGPU 时不必共用。两块画布由页面合成，彼此之间不复制任何内容。

## 性能读数

`createWorld3DStats(renderer, { container })` 显示帧时间、游戏自己各部分的耗时，以及渲染器画了什么：绘制次数、三角形数、被舍去的灯、程序、几何体和纹理。每帧开始时调用 `begin()`，每部分之后调用 `lap(name)`，绘制之后调用 `end()`。不传 `container` 时仍会收集数字，供自动检查使用。

## 限制

应用同一时间只用一个相机绘制一个场景。需要第二个视图或画中画的游戏，自行驱动 `World3DView`。设备丢失会报告给 `onDeviceLost`，恢复的办法是重新创建一个应用。
