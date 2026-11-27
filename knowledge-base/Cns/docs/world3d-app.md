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

零件：`sdfSphere(radius)`、`sdfBox([w, h, d], { round })`、`sdfEllipsoid([rx, ry, rz])`、用于四肢、树枝和角的 `sdfCapsule(from, to, radius, { radiusEnd })`、`sdfCylinder(radius, height, { round })`、`sdfCone(bottom, top, height)` 和 `sdfTorus(radius, tube)`。每个零件都接受 `at`、`rotation`（欧拉角，弧度）、单一的 `scale` 和 `color`；没给颜色的零件取所在组的颜色。组合：`sdfUnion(parts, { smooth })` 在 `smooth` 的范围内把零件融成一体；`sdfSubtract(base, cuts, { smooth })` 挖掉一部分（带颜色的挖切会给挖出的面上色，比如嘴里）；`sdfIntersect(parts)` 只留共有部分（有颜色的零件给它上色，切出的面也一样；没有颜色的零件只负责切）；`sdfMirror(part, { axis })` 生成成对的眼睛、耳朵、腿。`sdfRound(shape, r)` 加厚并倒圆，`sdfShell(shape, t)` 掏空，`sdfDisplace(shape, { amount, frequency, seed })` 让石头、树皮、泥土表面起伏。组也接受同样的 `at`、`rotation`、`scale` 和 `color`，所以由几个零件组成的一条腿可以整体摆放。游戏运行时 `shape.distance(x, y, z)` 也有用，可以拿来对模型做命中判断。

网格选项：`resolution`（最长边上的格数，默认 64，范围 8 到 192）、`triangles`（三角形上限，默认 8000；0 表示全部保留）、`occlusion`（褶皱变暗的程度，默认 0.7）、`occlusionRadius`、`variation`（{ `amount`, `frequency`, `seed` }，亮度的起伏，让大块零件不是一整片纯色），以及给没有颜色的零件用的 `color`。`sharp: true` 让硬表面保持硬朗：每个顶点放在周围表面的平面交汇处（对偶轮廓法），面与面夹角超过 40 度（或给定角度）处拆分法线，所以木箱、墙、屋顶、武器和机械保留棱角，边缘的明暗也像边；动物和植物不要打开。模型在初始化时生成一次：默认设置下一个模型要几百毫秒。眼睛、纽扣这类不能融进底下的细节，单独放进一个 `smooth` 很小的组。

`simplifyGeometry3D(geometry, { triangles | ratio, maxError })` 把任何带索引的三角形几何体减到给定的面数，适用于生成或扫描的模型，以及远处的细节层级。它按二次误差度量先折叠代价最小的边，拒绝会让三角形翻面或让表面捏合的折叠，开放边和纹理接缝上的顶点保持原位，每个顶点保留自己的属性，几何体的材质分组也保留，返回 `{ geometry, before, after, error }`。带变形目标的几何体会被拒绝。

另外两种零件来自轮廓。`sdfLathe(profile, { round })` 把由 [半径, 高度] 点组成的闭合轮廓绕 y 轴旋转：花瓶、瓶子、柱子、钟、路灯杆。`sdfExtrude(outline, depth, { round })` 把由 [x, y] 点组成的闭合轮廓沿 z 方向挤出 `depth` 的厚度：路牌、山墙、刀刃、星星、剪影形状。

`sdfPattern(shape, { kind, color, frequency, amount, axis, size, from, to, seed })` 在形状的颜色上画图案，不改变表面：`'spots'` 斑点（皮毛、毒蘑菇）、横跨 `axis` 的 `'stripes'` 条纹（老虎、木板、岩层）、`'noise'` 斑块（苔藓、泥土、斑驳的皮肤），以及沿 `axis` 从 `from` 到 `to` 的 `'gradient'` 渐变（颜色更深的脚、爬上墙的苔藓）。图案写在顶点颜色里，所以 `frequency` 保持在每单位几个以内。网格选项 `edges: { amount, color }` 让外侧边缘变亮，像磨旧的木头、掉漆的边；不给 `color` 时，每个零件的边缘取它自己颜色的浅色。减面时会考虑顶点颜色，所以减掉三角形后画出的色块边界依然整齐。

`exportGlb3D(geometryOrObject)` 把模型写成 .glb 的字节：几何、顶点颜色、纹理坐标、材质分组、节点树和每个节点的位置、旋转、缩放，以及每个材质的颜色、不透明度、金属度和粗糙度（不包括贴图、蒙皮、变形目标和动画）。用代码做的模型可以存一次，之后用 `loadGltf3D` 加载，也可以在 Blender 里打开。

在代码仓库里，`node tools/model-preview.mjs <Playwright index.mjs 的绝对路径> <model.mjs> <picture.png> [--glb <model.glb>]` 在无头浏览器里从四个方向画出模型，写成一张图，并给出三角形数、顶点数、尺寸和生成用时。模块的默认导出接收 `@egret/engine/world3d` 的导出，返回形状、几何体或对象；`export const meshOptions` 给出形状的网格选项。每次改完模型都看一下这张图：比例不对、某个零件颜色画错、细节融掉了，这些在图上一眼可见，在代码里看不出来。

`examples/models` 里的模型范例库有二十四个这样的模型：动物、人物、建筑、植物和道具，每个都从四个方向检查过，并附有做它们时学到的经验。新模型从最接近的那个开始改。

`createSdfLod3D(shape, options)` 生成多级细节的模型：一个 `Lod3D`，镜头近时显示完整网格，远处显示更简单的网格，每一级由上一级减面而来。除非用 `levels`（[三角形数, 距离] 对）指定，否则超过模型尺寸 12 倍距离时用四分之一的三角形，超过 30 倍时用十六分之一。场景里有很多树或石头时，绘制的三角形会少得多。

生成一个模型要几百毫秒。`node tools/bake-models.mjs <模型文件夹或 model.mjs ...> <新的输出文件夹>` 在 Node 里提前生成（不需要浏览器），每个模型写成一个 .glb：范例库的 24 个模型约 16 秒烘焙完，之后用 `loadGltf3D` 一共约 50 毫秒就能全部加载。带骨骼的模型在运行时生成。

`createSurfaceMaterial3D({ surface, scale, strength, bump, ...标准材质选项 })` 在顶点之间画出表面的颜色和起伏：`'wood'`（木纹）、`'stone'`（石头）、`'brick'`（砖）、`'plaster'`（灰泥）、`'metal'`（拉丝金属）、`'cloth'`（布料）或 `'bark'`（树皮）。它是一个标准材质（默认开启顶点颜色，除非 `vertexColors: false`），着色器按世界坐标从三个轴向投影计算图案，所以不需要贴图和纹理坐标，细节精度取决于像素而不是三角形。`scale` 是每个世界单位里的图案单位数（每种表面各有默认值），`strength` 是明暗变化的强度（0.5），`bump` 是起伏看上去的深度（0.5）。图案固定在世界里：模型移动时会从图案中穿过，所以适合建筑、道具和场景。WebGL2 和 WebGPU 都能绘制。导出了 `surface` 的范例库模型（木箱、木桶、宝箱、路牌用木纹，小屋用灰泥，水井和瞭望塔用石头）在画廊和预览里会用它绘制。

模型预览还会列出 `notes`：网格分成了几块（某个零件悬空、太细连不上，或里面封住了一个空腔）、模型陷到 y = 0 以下或浮在上面，以及生成太慢。范例库的每个模型都是一整块；这项检查发现过悬空的狗尾巴、门洞里松脱的门板，以及被一层盖子封住的水井。

## 会动的模型

`createSdfRig3D(shape, bones, options)` 让距离场模型动起来。每根骨骼写明它转动的关节（`at`）、它挂在哪根骨骼下（`parent`），以及它带动的零件；网格的每个顶点跟随零件离它最近的骨骼（最多四根），所以关节处的皮肤是弯曲而不是撕开。`mirror: 'x'` 由一侧生成一对骨骼：+x 一侧的 `name.L` 和另一侧的 `name.R`。零件只用来引导权重：可以是搭模型用的形状，也可以是位置相近的更简单的形状。选项与 `createSdfGeometry3D` 相同，另有 `material` 和 `blend`（关节处的皮肤在相邻骨骼间分担的范围，默认是模型尺寸的五十分之一）。

```js
const leg = sdfCapsule([0.08, 0.3, 0], [0.09, 0.08, 0.01], 0.06);
const rig = createSdfRig3D(villagerShape, [
  { name: 'body', at: [0, 0.34, 0], parts: torso },
  { name: 'head', parent: 'body', at: [0, 0.74, 0], parts: head },
  { name: 'leg', parent: 'body', at: [0.08, 0.3, 0], parts: leg, mirror: 'x' }
]);
const walk = rig.clip('walk', 0.8, {
  'leg.L': [[0, [0.5, 0, 0]], [0.4, [-0.5, 0, 0]], [0.8, [0.5, 0, 0]]],
  'leg.R': [[0, [-0.5, 0, 0]], [0.4, [0.5, 0, 0]], [0.8, [-0.5, 0, 0]]],
  body: [[0, [0, 0, 0]], [0.2, [0, 0, 0], [0, 0.025, 0]], [0.4, [0, 0, 0]]]
});
scene.addChild(rig.root);
rig.play(walk);
// 每帧：rig.update(seconds)
```

`rig.clip(name, duration, poses)` 把命名骨骼的姿势变成动画片段：每个关键帧是一个时间、相对骨骼静止姿势的欧拉角（弧度），以及可选的相对静止位置的偏移。每根骨骼的最后一个关键帧与第一个相同时，片段可以无缝循环。`rig.play(clip, fade)` 从正在播放的片段淡入（默认 0.2 秒）；`rig.update(seconds)` 推进动画。`rig.root` 包含骨骼和蒙皮网格 `rig.mesh`；移动它就是移动模型。`rig.bones` 按名字给出每根骨骼，可以让手握剑、让头转向玩家。模型范例库里的村民和狐狸带有骨骼：`rig(W)` 返回一个带 `clips` 的骨骼动画模型。

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

`createWorld3DOverlay` 在 3D 画布正上方放一块透明画布（3D 画布须放在定位的父元素里），并用 `createBrowserGame` 在上面启动一个 2D 游戏。菜单、血条、文字、位图按钮和 `ui` 控件随后用引擎的 2D 舞台画在场景之上。页面尺寸变化时，叠加层跟随 3D 画布的位置和大小。默认情况下舞台被拉伸铺满这个框，手机一转界面就被压扁；`fit: 'contain'` 保持舞台的宽高比，在框内尽量放大并居中；`fit: 'cover'` 保持宽高比并铺满框，超出部分由父元素裁掉。`overlay.box` 给出舞台当前的位置和缩放（每单位多少 CSS 像素）。用这三种方式时，舞台自己的 `width`、`height` 保持创建时的值。

界面要在任何宽高比下都贴到每条边时，用 `fit: 'expand'`，或白鹭 5 的固定模式（`fixedWidth`、`fixedHeight`、`fixedNarrow`、`fixedWide`）。这时 2D 游戏像 `createBrowserGame` 用这些适配方式时一样规划舞台：

- **舞台跟随 3D 画布。** 设计尺寸按自己的比例完整保留，舞台扩展到铺满画布。
- **画布高大于宽时用竖屏尺寸。** 由 `portrait: { width, height }` 给出。
- **安全区避开刘海。** `game.screen.safe` 去掉页面的 safe-area insets，或给出的 `insets`。
- **每次变化都会告知。** `game.onScreenChange` 会通知，游戏重新摆放界面即可，不必重建叠加层：

```js
const ui = await createWorld3DOverlay(canvas, { width: 1280, height: 720, portrait: { width: 720, height: 1280 }, fit: 'expand' });
const place = () => {
  const safe = ui.game.screen.safe;
  pause.x = safe.x + safe.width - 16 - pause.width;
  pause.y = safe.y + 16;
};
place();
ui.game.onScreenChange(place);
```

`portrait` 和 `insets` 与 `stretch`、`contain`、`cover` 一起给出时，以 `WORLD3D_OVERLAY_OPTIONS_INVALID` 拒绝。

`examples/world3d/verify-overlay.mjs` 在无头 Chromium（SwiftShader WebGL2）里检查这些，刘海的 insets 通过 `__egretAgent.insets` 给出：

- **横屏 852 × 393。** 舞台为 1560 × 720，叠加层盖满 3D 画布。安全区两侧各让出 59 CSS 像素，暂停按钮在安全区右上角。点按钮由界面接住，点界面空白处传到了 3D 画布。
- **转成竖屏 393 × 852。** 舞台为 720 × 1560，`onScreenChange` 发出了通知，按钮移到了刘海下方。

没有在手机、Safari、Firefox 或 WebGPU 叠加层上运行。

按压或滚轮落在开启 `touchEnabled` 的 2D 节点上时，由覆盖层接收。起点在空白处的按压及后续拖动交给 3D 画布。浏览器原生主指针点击只有在按下已归属场景且释放仍在空白处时，才会将 DOM 事件副本交给场景。从 2D 控件拖到空白处会保留原手势归属。空白处转发悬停移动。设置 `passThrough: false` 可让所有事件留在覆盖层。`ui.dispose()` 结束 2D 游戏并移除覆盖层。Windows 鼠标和 Fold7 触摸自动化在双后端都验证了点击和拖动路由。

2D 舞台默认用 WebGL2，这样 3D 渲染器使用 WebGPU 时不必共用。两块画布由页面合成，彼此之间不复制任何内容。

### 保留静止界面并量启动

```js
const ui = await createWorld3DOverlay(canvas, {
  width: 800, height: 420, portrait: { width: 380, height: 680 },
  fit: 'expand', uiScale: { min: 44 / 48, max: 1.35 },
  renderMode: 'on-demand', webgl2PageBatching: 'single-page'
});
console.log(ui.getStartupTiming());
```

- 默认仍持续绘制。按需模式的 2D 时钟、更新、输入和文字维护每个显示步照常运行；显示版本、屏幕方案、缓存图层和宿主原生代未变时保留上次提交的帧。改变 3D 投影标记的显示节点会重绘；显示树外的数据用 `ui.game.invalidate()` 请求重绘。被拒绝的帧仍保留待绘请求，不影响 3D 绘制。
- `uiScale` 限定铺满模式的 CSS 像素/逻辑单位，安全区、输入和语义都走同一套原生方案，不改变 3D 场景，见[屏幕适配](screen-fit.md)。多屏验证可采集实际命中矩形和语义名称，但轴对齐包围框不代表逐像素遮挡验证。
- `webgl2PageBatching: 'single-page'` 仍合并同一纹理页、相邻的兼容绘制，遇到另一页才拆批。启动不编译多页着色程序，此宿主后来也不会编译它，不把等待搬到首次操作。默认仍是 `'multi-page'`，仅 WebGL2 使用此选项。分辨率、合成、混合顺序和效果不变；频繁交错纹理页可能增加绘制调用。没有效果时可另设 `effects: false`；叠加层默认开启效果。
- `ui.getStartupTiming()` 给出放置、就绪及 `game` 的后端选择、模块加载、宿主创建、引擎打开、游戏准备等毫秒耗时。首次被 SDK 接受的提交发生后，`ui.game.getStartupTiming()` 还会报告该时点，这不是 GPU 完成或屏幕呈现。WebGL2 诊断区分当前已成功启动原生代的上下文/能力检查、采样、纯色、输出、效果、多页和收尾耗时。冷缓存与热缓存是不同实验。分别看 `game.loop.snapshot().steps` 与 `.frames` 区分更新和帧提交。

`node examples/world3d/verify-overlay.mjs <Playwright index.mjs 的绝对路径>` 验证按需时钟、首帧、显示变更、显式重绘、转屏和原生触控归属，以及两页交错半透明图形在两种批处理策略下的真实 WebGL2 读回。软件 Chromium 中 768 个 RGBA 字节完全一致，该交错样例分别两次和五次绘制调用。属于功能和像素验证，不是假定设备帧率。

## 性能读数

`createWorld3DStats(renderer, { container })` 显示帧时间、游戏自己各部分的耗时，以及渲染器画了什么：绘制次数、三角形数、被舍去的灯、程序、几何体和纹理。每帧开始时调用 `begin()`，每部分之后调用 `lap(name)`，绘制之后调用 `end()`。不传 `container` 时仍会收集数字，供自动检查使用。

## 限制

应用同一时间只用一个相机绘制一个场景。需要第二个视图或画中画的游戏，自行驱动 `World3DView`。设备丢失会报告给 `onDeviceLost`，恢复的办法是重新创建一个应用。
