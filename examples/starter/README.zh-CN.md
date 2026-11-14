# 起步项目

[English](README.md) | 简体中文

一个 2D 游戏的起点：一个 Engine、一个舞台、一个帧循环、指针和键盘输入，再加一条规则。蓝色方块会走到你点击的位置，或者按方向键指的方向走，并拾取五枚金币。`main.mjs` 不到一百行，需要替换的部分在两行标着 "Game" 的注释之间。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印出的主机和端口上打开 `/examples/starter/index.html`。加上 `?backend=webgl2` 或 `?backend=webgpu` 可以指定后端。

## 里面有什么

| 步骤 | 在 `main.mjs` 中 |
| --- | --- |
| Host | 在画布上创建 `createSharedWebGPUHost` 或 `createSharedWebGL2Host`，取浏览器支持的那个 |
| Engine | `createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D)` |
| 作用域 | `engine.createScope()`；`scope.use(new Sprite())` 把游戏创建的对象交给作用域，销毁作用域时一并销毁 |
| 舞台 | `engine.stage.addChild(...)`；`Sprite` 用 `graphics` 绘制，用 `x`、`y` 定位 |
| 输入 | 画布上页面自己的 `pointerdown` 和 `keydown`，换算成舞台单位 |
| 循环 | `@egret/engine/web/loop` 的 `createBrowserFrameLoop`：推进 Engine 的时钟、调用 `update(seconds)` 并绘制 |

[帧循环](../../knowledge-base/Cns/docs/frame-loop.md)替你处理了两处手写时容易忽略的事。一步最多十分之一秒，所以标签页从隐藏状态回来时不会走出巨大的一步。另外，Host 最多同时持有两帧尚未完成的画面：已有两帧时循环跳过这一帧的绘制，而不是等着被拒绝。

## 改成你自己的

1. 把这个文件夹复制到其他示例旁边，用同样的方式打开它的 `index.html`。
2. 保留 `index.html` 里的 import map。它告诉浏览器每个 `@egret/...` 名称在已构建的仓库里的位置。要用别的入口，例如 `@egret/engine/particles`，就加上对应的一行；[该引哪个入口](../../knowledge-base/Cns/docs/entry-points.md)列出了全部入口。
3. 替换 `main.mjs` 里三段 "Game" 部分：状态、输入和每一步的逻辑。

如果项目在这个仓库之外，使用包管理器和打包工具而不是 import map，请看[在干净工程中使用预览版](../../knowledge-base/Cns/docs/clean-consumer.md)。

## 核对

```text
node examples/starter/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

脚本从画布读取方块和金币的颜色，点击、按住方向键、按下按钮，并在手机配置下轻触。它只运行 WebGL2；给出 `software` 时在无头 Chromium 中用软件渲染运行。没有人工按键，也没有运行 WebGPU。
