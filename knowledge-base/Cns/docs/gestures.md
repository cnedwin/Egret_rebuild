# 手势与拖放

[English](../../en/docs/gestures.md) | 简体中文

指针输入告诉你每个触点在哪里，什么时候按下、移动、抬起。游戏很少直接要这些，它要知道的是：一张卡被长按了，一件物品被拖进了格子，地图被双指缩放了，一页被滑走了。可选入口 `@egret/engine/web/gestures` 把[指针输入](multi-pointer-input.md)分派给某个显示对象的触点识别成这些手势，每个手势只报告一次。它不在页面上添加任何监听，所以用自己的方式把触点交给指针输入的宿主，例如[微信小游戏](wechat-minigame.md)，可以直接使用。

## 在 play 里

```js
game.gestures(card, {
  hold: at => showDetails(card),           // 静止按住半秒
  doubleTap: at => equip(card),
  drag: d => { card.x += d.dx; card.y += d.dy; },
  swipe: s => s.direction === 'left' && nextPage(),
});

const bag = game.dragAndDrop();
bag.source(gem, { data: () => gem.item, ghost: item => game.circle(0, 0, 16, item.color) });
bag.target(slot, { drop: item => put(slot, item), accepts: item => item.kind === 'rune', hover: (item, over) => (slot.alpha = over ? 1 : 0.7) });
```

`game.gestures` 返回一个停止识别的函数。位置用的是游戏的单位，所以无论[屏幕怎样适配](screen-fit.md)都成立；`localX`、`localY` 是精灵自己的坐标。处理函数抛出的错误会让游戏停下，和点击一样。

被拖的精灵留在原处，`ghost` 画出的图跟着手指，显示在所有东西之上，拖动结束时消失。手指下有多个目标时，最里层且接受这份数据的目标接收它，所以背包里的格子会接住物品，而不是背包本身。在没有目标接受的地方松手，什么也不会改变。

## 报告什么

| 处理函数 | 何时 | 得到什么 |
| --- | --- | --- |
| `onTap` | 触点在按下的位置附近抬起，且还没成为长按 | 位置 |
| `onDoubleTap` | 0.3 秒内、在第一次点击附近的第二次点击 | 位置 |
| `onHold` | 按引擎时钟静止按住 0.5 秒，之后不再算点击 | 位置 |
| `onDrag` | 触点移动超过 12 单位的容差；之后每次移动，以及结束或取消 | `phase`，这一步的 `dx`、`dy`，以及累计的 `totalX`、`totalY` |
| `onSwipe` | 拖动结束时，最后十分之一秒的速度超过每秒 600 单位 | `direction`、`speed`、`dx`、`dy` |
| `onPinch` | 第二个触点按下；第一个触点原来在做的手势结束 | `phase`、相对开始时的 `scale`、以度为单位的 `rotation`、两指中点 |

这些都来自 `createGestures({ engine, scope, input, target, ... })`。阈值可以通过选项修改：`slop`、`holdSeconds`、`doubleTapSeconds`、`swipeSpeed`。`createDragAndDrop({ engine, scope, input, layer })` 提供 `source`、`target` 和 `dragging`，每次注册都返回对应的移除函数。两者都随作用域或 `dispose()` 结束。选项不可用时抛出 `GESTURE_OPTIONS_INVALID`；在已结束的对象上注册时抛出 `GESTURE_CLOSED`。

长按按引擎时钟计时，所以游戏暂停时不会触发。任一手指抬起时双指缩放就结束，另一根手指在抬起之前不再参与识别，因此不会变成拖动。

## 检查了什么

`tests/gestures.test.mjs` 在真实的引擎上，像宿主那样把触点交给指针输入。它检查：

- 点击和双击，以及移动过的触点不算点击；
- 按时钟计时的长按，以及长按之后不算点击；
- 超过容差的拖动、它报告的每一步，以及滑动；
- 双指缩放的比例和旋转角度；
- 拖放到最里层的目标、没有目标时松手，以及源没有数据；
- 拒绝无效选项，以及已结束的识别器不再收到任何手势。

`examples/play/verify-gestures.mjs` 在无界面 Chromium 里用鼠标检查：双击、长按、拖着卡片移动、快速一甩算作滑动，以及把宝石拖进格子。浏览器里原软件测试没有试双指操作，也没有在真实的触摸屏上试过。

## 设计说明

LumioGames 的 LGUI 为控件提供拖动、长按和放下的处理。这里改为从指针输入已经分派的触点识别手势：宿主和测试用同样的方式提供触点，play 的精灵、按钮和点击共用同一个指针。这里把它的设计作为参考研究过，没有用它的任何代码。

## 11 月 27 日真机补验

11 月 27 日实测：Windows 鼠标手势测试通过；Fold7 双后端接收两触点浏览器输入，缩放 1.9167、旋转 28°，并完成一次长按、拖动和放置。该输入为真机浏览器触摸注入，真人手指体验仍待测。 [真机观测及剩余范围](november-27-claude-hardware.md).
