# 模型范例库

[English](README.md) | 简体中文

二十四个用距离场代码做出的模型，每个都从四个方向看过：动物、人物、建筑、植物和道具。它们是起点：要给游戏做一个模型，复制最接近的那个，改它的比例、颜色和零件，再看一遍。每个文件开头的注释说明它由哪些零件组成，以及为什么这样做。

## 运行

在仓库根目录使用 Node.js 26.7.0 和 pnpm 11.25.0：

    pnpm setup:dev
    pnpm example:browser

打开 `http://127.0.0.1:4173/examples/models/index.html`。页面打开时生成所有模型，按种类分行排列。拖动可以转动视角；勾选“真实尺寸”按米为单位显示真实大小。

## 模型

| 种类 | 模型 |
| --- | --- |
| 动物 | 狐狸、猫、狗、兔子、小鸡、鱼 |
| 人物 | 村民、骑士 |
| 建筑 | 小屋、水井、瞭望塔、宝塔 |
| 植物 | 树、松树、灌木、花、蘑菇、仙人掌 |
| 道具 | 木桶、木箱、宝箱、灯笼、石头、路牌 |

每个模型都立在 y = 0 上，面朝 +z（与 glTF 模型一致），在 x 方向居中，单位是米。每个模块导出 `about`（`name`、`zh`、`kind`）、给 `createSdfGeometry3D` 的 `meshOptions`，以及一个默认函数：它接收 `@egret/engine/world3d` 的导出并做出形状。

```js
import * as W from '@egret/engine/world3d';
import fox, { meshOptions } from './fox.mjs';

const mesh = new W.Mesh3D(W.createSdfGeometry3D(fox(W), meshOptions), W.createStandardMaterial3D({ vertexColors: true }));
```

在 `play3d` 游戏里，把 `Egret` 作为 `W` 传入。

村民和狐狸还导出 `rig(W)`：用 `createSdfRig3D` 蒙皮到骨骼上的模型，动画片段在 `rig.clips` 里（村民有行走和待机，狐狸有小跑和待机）。画廊会播放第一个。调用 `rig.play(rig.clips.walk)`，并在每帧调用 `rig.update(seconds)`。

## 改一个，看一眼

    node tools/model-preview.mjs <Playwright index.mjs 的绝对路径> examples/models/fox.mjs fox.png

从四个方向把模型画进 `fox.png`，并打印三角形数、尺寸和生成用时。

## 做这些模型学到的

- 渐变要先画在它所属的零件上，再把零件合起来：画在整只动物身上的肚皮渐变会把腿也染上。
- 眼睛、鼻子、纽扣和镶边单独放进一个 `smooth` 只有几毫米的组，否则会融进底下的部件，颜色也会糊开。
- 零件至少要有两个格子厚：默认 64 格时，6 米高的塔一格约 10 厘米，比这更细的旗杆会消失。提高 `resolution` 或加粗零件。
- 带圆角的旋转体、壳体或圆角盒，圆角会伸出形状之外：轮廓从这个高度开始画，否则模型会陷进地面。
- 一个有颜色的零件陷进另一个零件时，露出来的那条边是参差的：让它在上方结束，或者贴在表面上。
- `edges` 会让表面急转的每一处变亮：在箱子、木桶、盔甲上很好，在起伏的石头上就太多了。
- 每个零件都要碰到下一个：离背一厘米悬空的尾巴、门洞里松脱的门板、切口没切到盖子的水井，都会多出一块。模型预览会在 `notes` 里列出这些块，范例库的测试要求每个模型都是一整块。
- 真正硬的东西（木箱、宝箱、小屋、路牌）用 `sharp: true`：角保持是角，面保持是平的。

`node tools/bake-models.mjs examples/models <新文件夹>` 把每个模型写成 .glb，加载只要几毫秒。

每个模型生成要几百毫秒：在加载关卡时生成，或者用 `exportGlb3D` 存下来。检查用的图片是在无头浏览器里用软件渲染画的，不是在设备上。
