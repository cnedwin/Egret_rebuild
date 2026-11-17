# Play：一次调用做出一个完整的小游戏

[English](../../en/docs/play.md) | 简体中文

做游戏从 `@egret/engine/play` 开始。一次调用就创建画布、让它适应页面并运行循环；返回的 game 上有大多数游戏都要自己写一遍的东西：每帧可以直接询问的键盘和指针、用代码合成的音效、重叠判断、定时器、文字、缓动、粒子爆发、震屏、闪屏和顿帧。游戏不需要任何图片、声音或字体文件。

它由公开入口组合而成（[浏览器游戏](browser-game.md)、[音频](audio.md)、[游戏工具包](game-kit.md)、[Graphics](graphics.md)），它没有覆盖的部分，这些入口都还在。

**检查了什么。** 选项、音效配方及其采样在 Node 中检查。在使用软件 WebGL2 的无头 Chromium 中，下面这个游戏能启动、绘制、接收键盘和指针、打掉砖块、播放音效并显示居中的文字。其他浏览器、手机和 WebGPU 没有运行过。

## 一个游戏

```js
import { play } from '@egret/engine/play';

const W = 480, H = 320;
let paddle, ball, bricks = [], score = 0, label, vx = 150, vy = -180;

await play({
  width: W, height: H, background: 0x101828,
  setup(game) {
    paddle = game.rect(W / 2, H - 20, 70, 10, 0x8fa8ff);
    ball = game.circle(W / 2, H - 60, 6, 0xffffff);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        bricks.push(game.rect(40 + c * 57, 40 + r * 20, 50, 14, [0xff4d6d, 0xffa64d, 0xffe14d, 0x7be069][r]));
    label = game.text('分数 0', { x: W / 2, y: 6, size: 18, align: 'center' });
  },
  update(dt, game) {
    paddle.x += game.keys.axis().x * 300 * dt;
    if (game.pointer.down) paddle.x = game.pointer.x;
    ball.x += vx * dt;
    ball.y += vy * dt;
    if (ball.x < 6 || ball.x > W - 6) { vx = -vx; game.sfx.play('bounce'); }
    if (ball.y < 6) { vy = -vy; game.sfx.play('bounce'); }
    if (vy > 0 && game.overlaps(ball, paddle)) { vy = -vy; game.sfx.play('jump'); }
    const hit = game.hits(ball, bricks);
    if (hit) {
      bricks = bricks.filter(brick => brick !== hit);
      game.burst(hit.x, hit.y, { color: 0xffe14d });
      game.remove(hit);
      vy = -vy;
      label.text = '分数 ' + (score += 10);
      game.sfx.play('coin');
      game.shake(4, 0.15);
    }
    if (ball.y > H) { ball.y = H - 60; vy = -180; game.flash(0xff2040); game.sfx.play('hurt'); }
  },
});
```

这就是整个游戏。`setup` 负责搭建；`update` 每帧运行一次，参数是距上一帧的秒数。在 `setup` 返回之前（或它返回的 Promise 完成之前）不会调用 `update`，所以 `setup` 创建的东西到时都已就绪。

## 选项

| 选项 | 含义 | 不给时 |
| --- | --- | --- |
| `width`、`height` | 舞台大小，使用游戏自己的单位：大于 0 的整数。画布会缩放以适应页面，并保持这个比例 | 必填 |
| `background` | 每帧清除成的颜色 | 黑色 |
| `setup(game)` | 搭建游戏；可以是 `async` | 什么都不搭建 |
| `update(seconds, game)` | 游戏的一步 | 没有这一步 |
| `parent` | 放画布的元素。画布占满它的宽度；元素自己没有高度时，按舞台的比例取高度 | 游戏占满窗口 |
| `canvas` | 页面里已有的画布，位置保持不变 | 自动创建一个 |
| `onError(error)` | 游戏被什么停下时得到通知 | 抛到控制台 |
| `seed` | `game.random` 的种子 | 每次都不同 |
| `saveKey` | `game.save` 保存数据时用的名字 | 页面的路径 |
| `backend` | `'auto'`、`'webgpu'` 或 `'webgl2'` | `'auto'` |

无法做出游戏的选项会以 `PLAY_OPTIONS_INVALID` 被拒绝；错误信息的末尾说明是哪一项。

## 绘制

| 调用 | 得到 |
| --- | --- |
| `game.rect(x, y, width, height, color, layer?)` | 一个填充矩形，**中心**在 (x, y) |
| `game.circle(x, y, radius, color, layer?)` | 一个填充圆，中心在 (x, y) |
| `game.sprite(g => …)` | 一个精灵，内容由函数绘制：`g` 是它的 [Graphics](graphics.md)，例如 `g.beginFill(0xff0000).drawRoundRect(-20, -10, 40, 20, 6).endFill()` |
| `game.text(words, { x, y, size, color, align, bold })` | 一行文字，见下文 |
| `game.button(words, { x, y, width, height, color }, onTap)` | `ui` 层里的一个按钮，中心在 (x, y)，文字居中；用 `button.label.text` 修改文字 |
| `game.remove(sprite)` | 把它连同里面的内容从舞台上拿掉并结束它。重复移除不会出错 |
| `game.toFront(sprite)` | 把它放到同一层其他精灵的前面 |

每个调用都返回一个精灵。可以随时设置它的 `x`、`y`、`rotation`（角度）、`scaleX`、`scaleY`、`alpha`（0 到 1）和 `visible`，读取它的 `width` 和 `height`，也可以加上自己的属性（`enemy.hp = 3`）。颜色是一个数字 `0xRRGGBB`。

精灵绕自己的原点旋转和缩放：`rect` 和 `circle` 的原点在中心，`game.sprite` 的原点是绘制内容的 (0, 0)。所以把 `scaleX` 缓动到 0 再回来，卡片就绕中心翻转。精灵按创建顺序绘制，后创建的在前面。要改变精灵的样子，就重新画一遍：`sprite.graphics.clear().beginFill(0x00ff00).drawRect(-10, -10, 20, 20).endFill()`。

`game.world` 是这些内容所在的层。`game.ui` 是盖在它上面、保持不动的层；做状态条或面板时把它作为最后一个参数传入，例如 `game.rect(240, 20, 480, 40, 0x000000, game.ui)`。任何精灵都可以当作层：在它里面创建的内容会跟着它一起移动、旋转、淡出和移除。`game.view.x` 和 `game.view.y` 决定看到世界的哪一部分，比舞台宽的关卡用 `game.view.x = hero.x - game.width / 2` 就能卷动。

**文字。** `const score = game.text('分数 0', { x: 240, y: 8, align: 'center' })` 画在 `ui` 层，创建后立刻可用；内容变化时设置 `score.text = '分数 ' + n`（直接给数字也可以）。`align` 说明 `x` 是文字的哪一部分：`'left'`、`'center'` 或 `'right'`。不指定时 `size` 为 24，`color` 为白色。`y` 是文字的顶部，加上 `baseline: 'middle'` 则是文字的中线。文字里的 `\n` 会换行。`{ layer: 'world' }` 把文字放进世界层，例如命中后向上飘的数字；`{ layer: tile, align: 'center', baseline: 'middle' }` 把文字放在一个精灵上，位于精灵的原点，并跟着它移动。文字就是一个精灵，可以像精灵一样移动、淡出、缓动和移除。字体用页面自己的，设备上有中文、日文、韩文字体时就能显示。

## 输入

| 询问 | 回答 |
| --- | --- |
| `game.keys.down('left', 'a')` | 这些键里是否有按住的 |
| `game.keys.pressed('space')` | 自上次 update 以来是否按下 |
| `game.keys.released('space')` | 自上次 update 以来是否松开 |
| `game.keys.axis()` | 方向键和 WASD 合成的 `{ x, y }`，各自在 -1 到 1 之间，y 向下，长度最多为 1 |
| `game.pointer.x`、`.y` | 鼠标或手指在舞台上的位置；不按键时也跟随鼠标 |
| `game.pointer.down`、`.pressed`、`.released` | 是否按着、刚按下、刚松开 |
| `game.pointer.swipe` | 一次滑动结束后的那次 update 里为 `'left'`、`'right'`、`'up'` 或 `'down'` |
| `game.pointer.over(sprite)` | 指针是否在精灵画出的内容上 |
| `game.onTap(sprite, () => …)` | 精灵被点击或轻触时调用函数。精灵重叠时，前面的那个收到点击 |

键的写法：`'left'`、`'right'`、`'up'`、`'down'`、`'space'`、`'enter'`、`'escape'`、`'shift'`、一个字母、一个数字，或 `KeyboardEvent.code`（如 `'KeyQ'`）。游戏运行时，方向键和空格不会滚动页面。鼠标还没移动时，指针位于舞台中心。在舞台任何位置按下，`game.pointer.pressed` 都为真，按在按钮上也一样；不希望按钮下面的游戏收到这次按下时，先判断 `game.pointer.over(button)`。

## 声音

`game.sfx.play('coin')` 播放一个用代码合成的音效。可用的名字有 `jump`、`coin`、`hit`、`hurt`、`explosion`、`shoot`、`powerup`、`bounce`、`pop`、`click`、`win` 和 `lose`。`game.sfx.play('coin', { volume: 0.5, pitch: 1.2 })` 只改变这一次播放。不存在的名字会以 `PLAY_SFX_UNKNOWN` 被拒绝，错误信息里列出全部名字。

玩家按键或点击之前，浏览器不播放任何声音；在那之前请求的音效听不到，游戏照常进行。

`game.sfx.define('zap', { wave: 'saw', from: 1200, to: 200, seconds: 0.15 })` 添加一个音效。一个音有波形 `wave`（`'sine'`、`'square'`、`'saw'`、`'triangle'` 或 `'noise'`）、起始音高 `from` 和可选的结束音高 `to`（单位赫兹）、时长 `seconds`，以及可选的 `volume`（0 到 1）、`decay`（0 为保持，4 像拨弦，10 像一声嘀）和 `noise`（混入的噪声，0 到 1）。一组音依次播放，就是一小段旋律。`game.sfx.volume` 和 `game.sfx.muted` 作用于所有音效。

## 重叠

| 询问 | 回答 |
| --- | --- |
| `game.overlaps(a, b)` | 两个精灵画出的内容是否重叠，按舞台上的正放矩形计算 |
| `game.hits(a, list)` | 列表里第一个与 `a` 重叠的精灵，没有则是 `undefined` |
| `game.hitsAll(a, list)` | 列表里所有与 `a` 重叠的精灵 |
| `game.near(a, b, distance)` | 两者的中心是否在 `distance` 以内：圆形判定，例如半径为 6 和 14 时写 `game.near(bullet, enemy, 6 + 14)` |
| `game.pushOut(a, b)` | 要让 `a` 不再与 `b` 重叠，需要把 `a` 移动多少（走较短的方向）：`{ x, y }`，其中一个为 0；不重叠时是 `undefined` |

`overlaps`、`hits` 和 `hitsAll` 的第三个参数让双方每一边都缩进这么多单位，判定更宽松。隐藏的、已移除的或什么都没画的精灵不与任何东西重叠；精灵不会和自己碰撞，所以列表里可以包含它自己。

角色站在平台上、被墙挡住，用的就是 `pushOut`：

```js
hero.y += vy * dt;
for (const block of blocks) {
  const push = game.pushOut(hero, block);
  if (!push) continue;
  hero.x += push.x;
  hero.y += push.y;
  if (push.y < 0) { vy = 0; onGround = true; }   // 被向上推：落地了
  if (push.y > 0) vy = 0;                         // 被向下推：撞到头了
}
```

## 时间

| 调用 | 作用 |
| --- | --- |
| `game.after(seconds, fn)` | 游戏进行这么久之后调用一次 `fn`。返回一个用来取消它的函数 |
| `game.every(seconds, fn)` | 每隔这么久调用一次 `fn`。返回一个用来结束它的函数 |
| `game.tween(sprite).to({ x: 100, alpha: 0 }, 0.3, 'quadOut')` | 让对象的数值从当前值随时间变化，自动开始。可以接着写 `.to`、`.wait(seconds)`、`.call(fn)`、`.loop(times)` 和 `.onFinish(fn)`。缓动：`linear`、`quadIn`、`quadOut`、`quadInOut`、`cubicOut`、`backOut`、`elasticOut`、`bounceOut`，以及 [`animate`](api-reference.md) 的其余缓动 |
| `await game.tween(sprite).to({ y: 200 }, 0.2).done` | 等一个缓动结束，这样在 `async` 函数里可以一步接一步 |
| `await game.wait(seconds)` | 等游戏进行这么久 |
| `game.time` | 游戏已进行的秒数 |
| `game.timeScale = 0.5` | 慢动作；1 为正常速度 |
| `game.pause()`、`game.resume()`、`game.paused` | 停止和恢复 update 与定时器。暂停时不调用 `update`；按钮的 `onTap` 仍然会调用，暂停的游戏就靠它恢复 |
| `game.restart()` | 移除世界层和 `ui` 层里的所有内容，取消定时器和缓动，然后重新运行 `setup` |

请用这些而不是 `setTimeout`：暂停、顿帧和页面被隐藏时，它们会和游戏一起停下。

## 打击效果

| 调用 | 作用 |
| --- | --- |
| `game.shake(amount = 6, seconds = 0.25)` | 让世界层最多晃动这么多单位；`ui` 层不动 |
| `game.flash(color = 0xffffff, seconds = 0.15)` | 用一种颜色盖住舞台，然后淡出 |
| `game.hitStop(seconds = 0.06)` | 让游戏停顿一下：没有 update，也没有定时器 |
| `game.burst(x, y, { color, count, speed, life, size, gravity })` | 从世界层的一点向外抛出碎片。不指定时是 12 个白色碎片 |

## 随机与存档

`game.random` 给出的数字在 `seed` 相同时可以重复：`int(1, 6)`、`range(0, 1)`、`chance(0.25)`、`pick(list)`，以及 `shuffle(list)`，它返回一个新列表，不改动传入的列表。

`game.save('best', score)` 把一个值以 JSON 形式保存在页面的存储里，`game.load('best', 0)` 把它读回来，没有时返回第二个参数。页面没有存储时，值只在这次访问期间保留。

## 页面

```html
<!doctype html>
<meta charset="utf-8">
<script type="importmap">{ "imports": { "@egret/engine/play": "…/web/play.js", … } }</script>
<script type="module">
  import { play } from '@egret/engine/play';
  await play({ width: 480, height: 270, setup(game) { … }, update(dt, game) { … } });
</script>
```

不需要别的东西：`play` 会创建画布并让它占满窗口，保持舞台的比例，窗口比例不同时两侧留边。

## 游戏变大之后

`game.browser` 是它所基于的[浏览器游戏](browser-game.md)，`game.engine` 和 `game.scope` 是它的 Engine 和 scope。从这里可以使用所有入口：图片和图集、[2D 相机](camera-2d.md)、[瓦片地图](tilemap.md)、带贴图的[粒子](particles.md)、[2D 物理](physics-2d.md)、[界面控件](ui-controls.md)、[带手柄的按动作输入](game-kit.md)和 [World3D](world3d.md)。它们创建的内容可以和 `play` 创建的一起加进 `game.world` 与 `game.ui`。
