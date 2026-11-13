# 悬停与滚轮

[English](../../en/docs/pointer-hover.md) | 简体中文

两个可选入口告诉游戏：没有按下时，鼠标或手写笔正指向哪个显示对象；并把滚轮交给它下面的对象。它们属于 M3.3，[#89](https://github.com/cnedwin/Egret_rebuild/issues/89)。按下仍由[触点输入](multi-pointer-input.md)处理，两者共用同一个画布。

## 公开用法

在页面里使用 `@egret/engine/web/hover` 的 `createBrowserHoverInput`：

```js
import { createBrowserHoverInput } from '@egret/engine/web/hover';

const hover = createBrowserHoverInput({ engine, scope, canvas, width: 480, height: 300 });
button.on(hover.events.enter, () => showHighlight());
button.on(hover.events.leave, () => hideHighlight());
list.on(hover.events.wheel, event => { if (scrollBy(event.payload.deltaY)) event.preventDefault(); });
```

`engine` 是已启动的 Engine，`scope` 是它的一个打开的 Scope，`canvas` 是它绘制的画布，`width` 和 `height` 是舞台的逻辑尺寸。宿主不是页面时，使用 `@egret/engine/input/hover` 的 `createHoverInput`，选项相同但没有 `canvas`，由 `sample`、`leave` 和 `wheel` 驱动。两个入口都不属于默认 Engine，其他入口也不导出它们。

对象能否被悬停与能否被按下遵循同一规则：已挂到舞台、`touchEnabled`、自身和所有祖先可见，且没有祖先关闭 `touchChildren`。显式命中区域和裁剪同样生效。

## 事件

| 事件 | 时机 | 载荷 |
| --- | --- | --- |
| `events.enter` | 指针移到目标上 | 点；从另一个目标移来时还有 `related` |
| `events.move` | 指针移动后仍在同一目标上 | 点 |
| `events.leave` | 目标不再被悬停 | 点、`reason`；移向另一个目标时还有 `related` |
| `events.wheel` | 滚轮在目标上转动 | 滚轮点。可取消。 |

四种事件都会冒泡，容器能听到子对象上发生的事。enter、move 和 leave 不可取消。点包含 `pointerId`、`pointerType`（`'mouse'` 或 `'pen'`）、舞台单位的 `globalX` 和 `globalY`、`timestamp`、为本输入所有观察排序的 `sequence`，以及映射时所用的 `viewportRevision`。点是冻结的。

属于同一次移动的 enter 和 leave 互相指明对方：leave 的载荷带有 `related`，即指针要去的对象；enter 的载荷带有 `related`，即指针离开的对象。没有另一端时就没有 `related`。

选项里的 `onHover` 在每次 enter、move 和 leave 的目标路径之前运行。leave 时它给出失去悬停的对象，即使该对象已离开舞台；事件只在目标仍可到达时派发。`hover.observe(listener)` 可以在之后添加监听器。每条通知在其目标路径运行之后告知它，监听器自身的失败不会影响输入。

leave 会说明原因：

| 原因 | 含义 |
| --- | --- |
| `target` | 指针移到了另一个目标，或不在任何目标上 |
| `outside` | 指针离开了画布 |
| `contact` | 指针按下了。在画布上松开后它会再次悬停。 |
| `pointercancel` | 平台取消了该指针 |
| `owner` | 目标被隐藏、禁用或移除 |
| `viewport` | 画布在页面上移动或改变了大小 |
| `blur`、`hidden`、`pagehide` | 窗口或页面离开 |
| `suspended`、`dispose`、`error` | 输入被暂停、关闭或失败 |

手指不会悬停。触摸触点只交给触点输入。

## 场景在指针下方移动

指针静止而场景变化时，不会有事件到来。场景变化后调用 `hover.sync()`，或者每帧调用一次：它会在每个指针停留的位置重新拾取，并发布随之而来的 leave 和 enter。示例在列表滚动后调用它。

## 滚轮

滚轮以 `events.wheel` 派发给它下面的对象。载荷包含 `deltaX`、`deltaY`、可选的 `deltaZ`、`unit`（`'pixel'`、`'line'` 或 `'page'`，即平台报告的单位，不做换算）和 `zoom`。按住平台的缩放修饰键时 `zoom` 为 true，触控板的捏合也会这样报告。用掉滚轮的监听器调用 `event.preventDefault()`。

`onWheel` 在目标路径之后运行。它能看到目标（如果有）以及是否已有监听器消费了滚轮，并可以返回 `true` 自己消费它。指针下没有对象需要滚轮时缩放地图，就写在这里。

`wheelPage` 决定页面如何处理画布上的滚轮：

| `wheelPage` | 页面滚动 |
| --- | --- |
| `'unconsumed'`（默认） | 仅当没有任何对象消费滚轮时 |
| `'never'` | 从不：滚轮归画布 |
| `'always'` | 总是。监听器是被动的，无法拦住页面。 |

## 映射、中断与所有权

浏览器适配器接受与触点适配器相同的范围：已连接的画布，祖先没有变换和缩放，画布没有边框和内边距，且 `object-fit: fill`。CSS 像素按一个比例和一个偏移映射到舞台单位，与设备像素比无关。超出此范围的画布以 `HOVER_INPUT_SURFACE_INVALID` 拒绝。同一画布上的第二个适配器以 `HOVER_INPUT_SURFACE_BUSY` 拒绝。

画布移动或改变大小时，正在悬停的对象按旧的 `viewportRevision` 离开，下一次移动按新的映射。窗口尺寸变化、滚动和方向变化会立即触发。没有事件的布局变化在下一次指针事件时发现。

适配器不捕获指针，也不设置样式，所以能与 `createBrowserPointerInput` 共用画布。WebGL 上下文丢失会暂停输入，渲染宿主恢复后由应用调用 `setInteractive(true)` 恢复。

Scope 释放和 Engine 关闭会结束输入：正在悬停的对象以 `dispose` 原因离开，监听器被移除，`onClose` 监听器运行。`capacity` 限制同时悬停的指针数量（默认 4，最多 16）。多出的指针通过 `onError` 报告，其余指针继续工作。

## 失败

一个采样或滚轮正在路由时到来的另一个，会以 `HOVER_INPUT_REENTRANT` 拒绝。在回调里离开、暂停和释放是允许的。回调抛出异常会关闭输入：所有悬停对象以 `error` 原因离开，错误为 `HOVER_INPUT_CALLBACK_FAILED`，第一个失败在 `cause` 中，其后的在 `cleanupErrors` 中。浏览器适配器把同一个错误交给 `onError`；没有 `onError` 时作为未捕获错误报告给页面。

## 已检查的内容

| 检查 | 范围 |
| --- | --- |
| [`tests/hover-input.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/hover-input.test.mjs)，16 项 | 真实 Engine 上的逻辑输入：路由、原因、滚轮、版本、暂停、重入、失败和释放 |
| [`tests/browser-hover.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/browser-hover.test.mjs)，15 项 | 适配器对照测试自有的页面替身，严格 TypeScript 消费者，以及精确的导出 |
| [`examples/pointer-hover/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/verify.mjs)，9 个场景 | 无头 Chromium 软件 WebGL2 的真实页面：鼠标、手写笔、触摸和滚轮通过自动化协议注入。其中一个场景检查[列表的按键](ui-controls.md#按键) |

向构建产物逐个写入了五十五个错误，单元测试发现了五十二个。其余三个不改变调用者能看到的任何行为：拾取之后重复的一次资格检查，以及关闭后的两处引用释放。

## 尚未完成

- 没有人使用真实的鼠标、手写笔或触控板操作过。所有输入都是注入的。
- 没有在硬件 GPU、WebGPU、已安装的 Edge、Safari 和 Firefox 上运行。省略第三个参数时，验证工具会启动已安装的 Edge。
- `@egret/engine/ui` 的 `createHoverControl` 把此输入转成控件的悬停状态（[指南](ui-controls.md)）。托管 UI 根的布局节点和行尚未使用它。
- 小游戏和原生宿主没有适配器，可以直接驱动 `createHoverInput`。
