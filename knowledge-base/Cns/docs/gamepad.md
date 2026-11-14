# 手柄

[English](../../en/docs/gamepad.md) | 简体中文

`@egret/engine/input/gamepad` 把手柄给出的状态变成按键、摇杆和键盘按键，不依赖 DOM。`@egret/engine/web/gamepad` 读取网页上的手柄。两者都是可选入口：不导入的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 输入和按键映射在 Node 中验证，适配器用替身页面验证，[控件示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/README.zh-CN.md)在无头 Chromium 中用检查脚本写出的手柄列表验证。没有人握过手柄，也没有浏览器读取过真实手柄。见[实际运行了什么](#实际运行了什么)。

## 在网页上

```js
import { bindGamepadKeys } from '@egret/engine/input/gamepad';
import { createBrowserGamepadInput } from '@egret/engine/web/gamepad';

const pads = scope.use(createBrowserGamepadInput());
// 每帧一次，带上这一帧的时间：浏览器不会主动告知手柄的变化。
function frame(time) { pads.poll(time); /* 游戏更新与绘制 */ requestAnimationFrame(frame); }
requestAnimationFrame(frame);

const pad = pads.input.pad(0);
if (pad?.pressed('a')) jump();
const { x, y } = pad?.stick('left') ?? { x: 0, y: 0 };
```

`poll(timestamp)` 读取一次 `navigator.getGamepads()`，把每个已连接手柄的状态交给输入。页面隐藏时不读取。页面隐藏或窗口失去焦点时，所有按键都会被松开，因为那时手柄发生了什么不会被告知。`rumble(pad, { duration, weak, strong })` 让支持震动的手柄震动，并返回是否发出了请求；失败交给 `onError`。

## 输入

`createGamepadInput({ deadZone, maxPads, onButton, onConnection })` 接收一次次“查看”：`input.sample(samples, timestamp)` 是某一时刻所有已连接手柄的状态。每次按下和松开只告知一次（`onButton`、`subscribe`），每个接入或被拔掉的手柄也会告知（`onConnection`）。被拔掉的手柄会先松开它的按键。之后 `onSample` 的监听者会被告知这次查看已完成。

| 读取 | 含义 |
| --- | --- |
| `input.pads`、`input.pad(index)` | 已连接的手柄，按序号 |
| `pad.pressed(名字或数字)`、`pad.value(...)` | 一个按键：标准布局下用名字，任何手柄都可以用数字。`value` 是扳机按下的程度 |
| `pad.stick('left' 或 'right')` | 去掉死区（默认 0.15）的摇杆，其余部分拉伸到能达到 1 |
| `pad.axis(index)` | 宿主给出的某一个轴 |
| `pad.standard` | 浏览器是否把这个手柄排成了标准布局。否则名字没有意义，摇杆读作中间 |

名字表示按键的位置：`a` 是下方的面键，`b` 右方，`x` 左方，`y` 上方；`l1`、`r1` 是肩键，`l2`、`r2` 是扳机；以及 `select`、`start`、`l3`、`r3`、`up`、`down`、`left`、`right`、`home`。

`input.release()` 松开所有按键，手柄保留。监听者可以读取手柄，但不能发起下一次查看（`GAMEPAD_REENTRANT`）。监听者抛出的错误在这次查看结束后才告知（`GAMEPAD_LISTENER_FAILED`），其他监听者都已先被告知。

## 用于 UI 的按键

```js
const keys = bindGamepadKeys({ gamepad: pads.input, keyboard });
```

`bindGamepadKeys` 驱动一个键盘输入——引擎的逻辑键盘输入，或任何带有 `keyDown`、`keyUp` 和 `moveFocus` 的对象——所以能响应按键的 UI 不需要多写一行就能响应手柄。

| 按键 | 动作 |
| --- | --- |
| 十字键和左摇杆 | 方向键。没有人接收的方向键会移动焦点：下和右到下一个停靠点，上和左到上一个 |
| `a` | Enter |
| `b` | Escape |
| `l1`、`r1` | 焦点移到上一个或下一个停靠点 |

焦点会从最后一个停靠点绕回第一个；`wrap: false` 会停在两端。方向和焦点移动在按住时重复：`repeatDelay`（400 毫秒）之后每隔 `repeatInterval`（100 毫秒）一次，每次查看最多一次；Enter 和 Escape 不重复。从两处按住的同一个键只算一个键。`map` 可以替换某个动作（`{ key, code, otherwise }` 或 `{ focus }`）或用 `null` 去掉它；`pad` 只让一个手柄驱动按键；`stick: 'right'` 或 `false` 选择摇杆；`threshold`（0.5）是摇杆推到多远才算数，回落到它的 70% 以下才松开。`dispose()` 松开所有按住的键。

## 错误

| 代码 | 何时出现 |
| --- | --- |
| `GAMEPAD_OPTIONS_INVALID` | 某个选项不在允许范围内 |
| `GAMEPAD_SAMPLE` | 某次查看、其中的某个手柄或它的时间不符合要求。这次查看的任何内容都没有被接收 |
| `GAMEPAD_BUTTON_UNKNOWN`、`GAMEPAD_STICK_UNKNOWN`、`GAMEPAD_AXIS_UNKNOWN` | 没有这个按键、摇杆或轴 |
| `GAMEPAD_REENTRANT` | 监听者发起了下一次查看 |
| `GAMEPAD_LISTENER_FAILED` | 某个监听者，或被按键映射驱动的键盘，抛出了错误 |
| `GAMEPAD_CLOSED` | 输入已被销毁 |
| `GAMEPAD_HOST_UNAVAILABLE` | 页面无法提供手柄 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 用测试写出的查看验证输入；用记录请求的键盘和引擎真实的键盘输入验证按键映射 | Node，[`tests/gamepad-input.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/gamepad-input.test.mjs) | 22 个用例 |
| 用替身页面和替身手柄验证适配器；两个入口的严格 TypeScript 使用方（含九处被拒绝的误用）；导出 | Node，[`tests/browser-gamepad.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/browser-gamepad.test.mjs) | 11 个用例 |
| 把三个构建后模块中的每个比较、布尔和逻辑运算符逐个改掉 | Node | 245 处改动，240 处被发现。剩下的 5 处不会改变任何可观察的行为：最后一个按键之后的位置、恰好位于死区边缘的摇杆，以及第二次销毁 |
| 用脚本手柄操作控件示例：焦点、按住再松开、用十字键和摇杆在选项组内移动、肩键、按住方向的重复，以及按住时手柄被拔掉 | 无头 Chromium 153 | 1 个场景 |
| 真实浏览器中的真实手柄；震动；Safari 和 Firefox；手机连接手柄 | — | 未运行 |

## 不在本次范围内

- 玩家自定义按键及保存；按手柄厂商印刷的名称显示按键。
- 在手机屏幕上绘制的触摸摇杆。
- 小游戏宿主中的手柄。
