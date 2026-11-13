# 悬停与滚轮

[English](README.md) | 简体中文

三个在鼠标或手写笔下方会亮起的按钮，和一个可以用滚轮和滚动条滚动的列表。悬停和滚轮来自 `@egret/engine/web/hover`，按下来自 `@egret/engine/web/pointer`，两者监听同一个画布。

## 运行

构建各包，以仓库根目录启动服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

使用服务输出的主机和端口打开 `/examples/pointer-hover/index.html`。浏览器支持时页面使用 WebGPU 绘制；加上 `?backend=webgl2` 使用 WebGL2。

## 可以尝试

- 把指针移到按钮上。按钮亮起，状态行显示它的名字。按下它：悬停在按下期间结束，松开后恢复。
- 把指针停在某一行上并转动滚轮。列表滚动，指针没有移动，但它下面的行变了。
- 列表到头后继续转动滚轮，页面开始滚动。
- 拖动列表旁边的滚动条。列表跟随移动，指针横向离开滚动条后拖动仍在继续。
- 把窗口缩到比画布窄。按钮仍然在它被画出的位置被找到。
- 在手机上点按钮。按钮被按下，没有任何对象被悬停。

## 工作方式

`main.mjs` 在每个按钮上监听 `hover.events.enter` 和 `hover.events.leave`。列表的滚动位置是 `@egret/engine/ui` 的 `createScrollControl`。它在视口上监听 `hover.events.wheel`，只在内容还能朝该方向移动时消费滚轮；它没有用掉的滚轮会滚动页面。它还把拖动滑块转换成偏移。滚动之后页面调用 `hover.sync()`，让静止指针下方的行被重新拾取。

事件、离开的原因、滚轮策略和已检查的内容见[指南](../../knowledge-base/Cns/docs/pointer-hover.md)。

## 检查

```text
node examples/pointer-hover/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。八个场景通过自动化协议驱动鼠标、手写笔、手指和滚轮，并写出 `report.json` 和每个场景的截图。它们在无头 Chromium 的软件 WebGL2 上通过。硬件 GPU、WebGPU、Edge、Safari、Firefox 和真人使用鼠标都没有运行。
