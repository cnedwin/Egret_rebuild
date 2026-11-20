# Play：一次调用做出一个完整的小游戏

[English](../../en/docs/play.md) | 简体中文

做游戏从 `@egret/engine/play` 开始。一次调用就创建画布、让它适应页面并运行循环；返回的 game 上有大多数游戏都要自己写一遍的东西：每帧可以直接询问的键盘和指针、用代码合成的音效、重叠判断、定时器、文字、缓动、粒子爆发、震屏、闪屏和顿帧。游戏不需要任何图片、声音或字体文件。

它由公开入口组合而成（[浏览器游戏](browser-game.md)、[音频](audio.md)、[游戏工具包](game-kit.md)、[Graphics](graphics.md)），它没有覆盖的部分，这些入口都还在。

**检查了什么。** 选项、音效配方及其采样在 Node 中检查。在使用软件 WebGL2 的无头 Chromium 中，下面这个游戏能启动、绘制、接收键盘和指针、打掉砖块、播放音效并显示居中的文字。这次最初的完整游戏检查没有覆盖硬件 GPU。

2026 年 11 月 18 日，以 main `ec17a5a2` 为基线的契约修复，在 Windows Edge 157.0.4341.60 / RTX 5090 Laptop 和 Galaxy Z Fold7 / Android 17 / Chrome 157.0.8103.78 / Adreno 830 上通过，均显式使用 WebGPU 和 WebGL2，没有软件回退。采集期间的系统采样均显示 Edge 位于前台，手机保持亮屏解锁。两台实体设备上注入的鼠标／触摸操作，在四组组合中均使中心像素从 RGBA `255,32,64,255` 变为 `32,255,96,255`。 有界的公开 SDK 用例通过了暂停、零倍率、半速／八倍速、顿帧、回调中暂停、循环停止／启动及回调中关闭。循环恢复后待执行定时器保留，关闭后没有继续执行链式回调。这不代表完整游戏、声音听感或性能验收。

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
| `transparent` | `true` 时每帧清为透明，页面上位于画布下面的内容会透出来 | 绘制背景色 |
| `setup(game)` | 搭建游戏；可以是 `async` | 什么都不搭建 |
| `update(seconds, game)` | 游戏的一步 | 没有这一步 |
| `parent` | 放画布的元素。画布占满它的宽度；元素自己没有高度时，按舞台的比例取高度 | 游戏占满窗口 |
| `canvas` | 页面里已有的画布，位置保持不变 | 自动创建一个 |
| `onError(error)` | 游戏被什么停下时得到通知 | 抛到控制台 |
| `seed` | `game.random` 的种子 | 每次都不同 |
| `saveKey` | `game.save` 保存数据时用的名字 | 页面的路径 |
| `backend` | `'auto'`、`'webgpu'` 或 `'webgl2'` | `'auto'` |
| `blendSpace` | 半透明颜色的混合方式：`'srgb'` 与 2D canvas 和白鹭 5 一致，深色底上 10% 的白仍是淡淡的白；`'linear'` 按光线混合，同样的白看起来更强 | `'srgb'` |

无法做出游戏的选项会以 `PLAY_OPTIONS_INVALID` 被拒绝；错误信息的末尾说明是哪一项。

## 绘制

| 调用 | 得到 |
| --- | --- |
| `game.rect(x, y, width, height, color, layer?)` | 一个填充矩形，**中心**在 (x, y) |
| `game.circle(x, y, radius, color, layer?)` | 一个填充圆，中心在 (x, y) |
| `game.sprite(g => …)` | 一个精灵，内容由函数绘制：`g` 是它的 [Graphics](graphics.md)，例如 `g.beginFill(0xff0000).drawRoundRect(-20, -10, 40, 20, 6).endFill()` |
| `game.text(words, { x, y, size, color, align, bold })` | 一行文字，见下文 |
| `game.button(words, { x, y, width, height, color }, onTap)` | `ui` 层里的一个按钮，中心在 (x, y)，文字居中；用 `button.label.text` 修改文字 |
| `game.remove(sprite)` | 立刻把它连同里面的内容从舞台上拿掉，并在这次更新结束时结束它。重复移除不会出错 |
| `game.toFront(sprite)` | 把它放到同一层其他精灵的前面 |

每个调用都返回一个精灵。可以随时设置它的 `x`、`y`、`rotation`（角度，顺时针）、`scaleX`、`scaleY`、`alpha`（0 到 1）和 `visible`，读取它的 `width` 和 `height`，也可以加上自己的属性（`enemy.hp = 3`）。颜色是一个数字 `0xRRGGBB`。已移除的精灵在移除它的那次更新结束之前仍然可以设置，所以还拿着它的循环不会出错；之后再设置会抛出 `OBJECT_DISPOSED`，此时 `sprite.isDisposed` 为真。

精灵绕自己的原点旋转和缩放：`rect` 和 `circle` 的原点在中心，`game.sprite` 的原点是绘制内容的 (0, 0)。所以把 `scaleX` 缓动到 0 再回来，卡片就绕中心翻转。精灵按创建顺序绘制，后创建的在前面。要改变精灵的样子，就重新画一遍：`sprite.graphics.clear().beginFill(0x00ff00).drawRect(-10, -10, 20, 20).endFill()`。

`game.world` 是这些内容所在的层。`game.ui` 是盖在它上面、保持不动的层；做状态条或面板时把它作为最后一个参数传入，例如 `game.rect(240, 20, 480, 40, 0x000000, game.ui)`。任何精灵都可以当作层：在它里面创建的内容会跟着它一起移动、旋转、淡出和移除。`game.view.x` 和 `game.view.y` 决定看到世界的哪一部分，比舞台宽的关卡用 `game.view.x = hero.x - game.width / 2` 就能卷动。

**文字。** `const score = game.text('分数 0', { x: 240, y: 8, align: 'center' })` 画在 `ui` 层，创建后立刻可用；内容变化时设置 `score.text = '分数 ' + n`（直接给数字也可以）。`align` 说明 `x` 是文字的哪一部分：`'left'`、`'center'` 或 `'right'`。不指定时 `size` 为 24，`color` 为白色；之后可以用 `score.color` 和 `score.size` 修改。`y` 是文字的顶部，加上 `baseline: 'middle'` 则是文字的中线。文字里的 `\n` 会换行。`{ layer: 'world' }` 把文字放进世界层，例如命中后向上飘的数字；`{ layer: tile, align: 'center', baseline: 'middle' }` 把文字放在一个精灵上，位于精灵的原点，并跟着它移动。文字就是一个精灵，可以像精灵一样移动、淡出、缓动和移除。字体用页面自己的，设备上有中文、日文、韩文字体时就能显示。

## 输入

| 询问 | 回答 |
| --- | --- |
| `game.keys.down('left', 'a')` | 这些键里是否有按住的 |
| `game.keys.pressed('space')` | 自上次 update 以来是否按下 |
| `game.keys.released('space')` | 自上次 update 以来是否松开 |
| `game.keys.axis()` | 方向键和 WASD 合成的 `{ x, y }`，各自在 -1 到 1 之间，y 向下，长度最多为 1；手柄的左摇杆也算在内 |
| `game.keys.look()` | 手柄右摇杆的 `{ x, y }`，用于转视角或瞄准；没有手柄时为 0 和 0 |
| `game.pointer.x`、`.y` | 鼠标或手指在舞台上的位置；不按键时也跟随鼠标 |
| `game.pointer.down`、`.pressed`、`.released` | 是否按着、刚按下、刚松开 |
| `game.pointer.swipe` | 一次滑动结束后的那次 update 里为 `'left'`、`'right'`、`'up'` 或 `'down'` |
| `game.pointer.over(sprite)` | 指针是否在精灵画出的内容上 |
| `game.pointer.dx`、`.dy` | 自上次更新以来鼠标移动了多少屏幕像素，指针锁定时也照常计数 |
| `game.pointer.wheel` | 自上次更新以来鼠标滚轮转了几格，朝向玩家为正。游戏下面的页面不会跟着滚动 |
| `game.pointer.lock()`、`.unlock()`、`.locked` | 隐藏光标并把鼠标留在游戏里，用于第一人称视角。浏览器只允许在一次点击之后锁定，所以要在点击回调里或 `pressed` 为真时调用；按 Escape 会交还鼠标 |
| `game.onTap(sprite, () => …)` | 精灵被点击或轻触时调用函数。精灵重叠时，前面的那个收到点击。函数可以是 `async` 的；它立即或稍后抛出的错误会像 `update` 抛出的错误一样让游戏停下 |

键的写法：`'left'`、`'right'`、`'up'`、`'down'`、`'space'`、`'enter'`、`'escape'`、`'shift'`、一个字母、一个数字，或 `KeyboardEvent.code`（如 `'KeyQ'`）。游戏运行时，方向键和空格不会滚动页面。鼠标还没移动时，指针位于舞台中心。按在舞台上、且下面没有按钮和带 `onTap` 的精灵时，`game.pointer.pressed` 为真：按在它们上面的那一下只属于它们，所以“按哪里就在哪里放东西”的游戏不会把东西放到自己的按钮下面。主指针按住期间，`game.pointer.down` 保持为真，包括按在按钮上的情况。

在 Play 画布上最先按下的指针负责驱动 `game.pointer`，直到该指针松开或被取消。拖动时，其他手指可点按独立的 UI 控件，拖动坐标、滑动起点和松手状态仍由原指针决定。原指针松开后，已经按住的手指不会自动接管。Galaxy Z Fold7（Android 17、Chrome 157）上的浏览器协议触摸已在 WebGL2 和 WebGPU 验证两种松手顺序、主指滑动、独立点按和取消。

## 声音

`game.sfx.play('coin')` 播放一个用代码合成的音效。可用的名字有 `jump`、`coin`、`hit`、`hurt`、`explosion`、`shoot`、`powerup`、`bounce`、`pop`、`click`、`hum`、`wind`、`win` 和 `lose`。`game.sfx.play('coin', { volume: 0.5, pitch: 1.2 })` 只改变这一次播放。不存在的名字会以 `PLAY_SFX_UNKNOWN` 被拒绝，错误信息里列出全部名字。

**持续的声音。** `const engine = game.sfx.loop('hum', { volume: 0.5 })` 会一遍又一遍地播放一个音效，直到 `engine.stop()`；停止时默认用十分之一秒淡出，也可以给出秒数。车加速时设置 `engine.pitch = 1 + speed / 20`，播放过程中 `volume` 和 `pan` 也可以随时修改。`hum` 和 `wind` 是专为循环做的；用 `define` 定义的旋律可以循环成音乐，带 `seamless: true` 的音调在长度是整数个波时首尾相接不会有咔哒声。暂停会让所有循环停住，`restart` 和 `dispose` 会停止它们。

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

`overlaps`、`hits` 和 `hitsAll` 的第三个参数让双方每一边都缩进这么多单位，判定更宽松。用 `visible = false` 隐藏的、已移除的或什么都没画的精灵不与任何东西重叠；`alpha` 为 0 的精灵仍然会重叠。精灵不会和自己碰撞，所以列表里可以包含它自己。

瓦片关卡只需一次调用：`const map = game.tiles(['##########', '#........#', '##########'], { size: 32, x: 0, y: 0, colors: { '#': 0x445566 } })` 把这些行画成一个精灵 `map.sprite`，左上角在 `x`、`y`。除非用 `solid` 指定实心字符，否则 `#` 是实心的；没有指定颜色的字符不画。`map.pushOut(hero)` 给出把精灵移出它重叠的实心瓦片需要的距离，`{ x, y }` 或 `undefined`，先移出重叠最多的那块；`map.solidAt(x, y)` 和 `map.cellAt(x, y)` 读取所在图层上的一点，`map.at(column, row)` 读取一个格子，`map.set(column, row, '.')` 修改一个格子并重画地图。`game.mix(a, b, t)` 是从颜色 `a` 到 `b`（都是 `0xRRGGBB`）走 `t` 那么远的颜色。

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

补间、定时器和 `update` 使用同一份游戏时间。暂停或将 `timeScale` 设为零会保持它们的进度，`hitStop` 会在指定时间内保持进度。画面绘制和输入继续运行，因此界面可以恢复暂停中的游戏。回调中暂停、重开或关闭游戏，会阻止旧更新继续执行。当前循环是 `game.browser.loop`。关闭游戏会停止待执行的补间，多次调用 `dispose()` 会等待同一次清理。

初始化期间多次调用 `game.restart()` 会得到同一个 Promise，`setup` 只执行一次。初始化成功后才恢复游戏更新。如果 `setup` 抛错或返回被拒绝的 Promise，重开会将错误返回给调用方并清理本轮已经创建的场景内容。再次调用 `restart()` 可以重试。当前重开要等 `setup` 返回才能完成，因此应在 `setup` 外等待这次重开。

初次初始化或重开期间，即使应用的加载仍在等待，`game.dispose()` 也能关闭游戏。被中断的启动或重开会以 `SCOPE_CLOSED` 拒绝。之后才完成的加载无法通过已经关闭的 SDK 句柄挂接游戏对象或恢复更新。外部下载由应用负责取消。

## 图片

`await game.image(url, { x, y, width, height, smooth, layer })` 从地址加载 PNG，以中心放在 `x`、`y`，默认放在 world 层。只给 `width` 或 `height` 之一时保持比例；都不给时用原尺寸。它和其他精灵一样可以移动、旋转和移除。默认平滑，缩小绘制时从[多级缩小副本](shared-render-profile-contract.md)采样，大图缩小不会闪烁；`smooth: false` 保留每个纹素的锐利边缘，适合像素风。同一地址加载两次是同一张纹理。

## 文字、菜单与血条

剧情对白、标题菜单和血条，是大多数游戏都要自己画的部分。Play 现在自带这些，全部由游戏自己 ui 层上的精灵和文字组成，所以重开时会一并清掉，键盘、指针和手指都能操作。

```js
async setup(game) {
  hp = game.bar({ x: 12, y: 12, width: 140, value: 4, max: 4, color: 0xef4444 });
  if ((await game.menu(['开始', '静音开始'], { title: '夜院' })) === 1) game.sfx.muted = true;
  const answer = await game.say('你愿意把灯笼重新点亮吗？', { who: '看守', choices: ['我去。', '凭什么？'] });
},
update(seconds, game) {
  if (game.asking) return; // 对白框或菜单打开时
  // ...
  hp.value -= 1;           // 血条滑下，并留下一段淡色残影
  game.toast('点亮了一盏灯');
}
```

- `game.bar({ x, y, width = 120, height = 12, value, max = 1, color, back, layer })` 是一个精灵，`x`、`y` 为左上角。设置 `value` 后会滑到该值，范围在 0 到 `max` 之间。
- `game.toast(words, { seconds = 2, color })` 在顶部显示一条会淡出的提示，多条会叠放。
- `await game.say(words, { who, choices, color, speed = 40 })` 在底部打开对白框，文字按每秒 `speed` 个字逐字出现，并按框宽换行。空格、回车、Z 或轻触会显示剩余文字，再按一次关闭，返回 `undefined`。带 `choices` 时，文字全部出现后显示选项；方向键或 W、S 以及摇杆移动选择，回车、空格、Z 或轻触确认，返回选项序号。对白框打开期间再请求的对白会排队。超出一个框容量的文字会分到后续的框里，每个框按一次关闭，选项随最后一个框出现。
- `await game.menu(items, { title, x, y, width, color })` 在舞台中间（或 `x`、`y` 处）打开一个列表，以同样方式选择并返回序号。新菜单会关闭正在打开的菜单，被关闭的菜单不返回结果。
- `game.asking` 表示是否有对白框或菜单打开。

游戏暂停时它们仍可操作，`setup` 也可以等待它们：等待期间照常绘制画面，但 `update`、计时器和缓动要等 `setup` 结束后才开始。重开会移除它们，正在等待的结果不再返回。对白文字按行只绘制一次，再逐字揭开遮罩，不会每帧重绘。`examples/play/story.mjs` 用到了以上全部功能。

## 手机、手柄与音乐

为键盘写的游戏，加上屏幕上的控件就能在手机上玩，接手柄则什么都不用改：

```js
game.touchStick();                                            // 计入 game.keys.axis()
game.touchButton('A', { x: 430, y: 230, key: 'space' });      // 手指按住时相当于按住空格
if (game.keys.pressed('space', 'pad:a')) jump();              // 手柄下方的面键
game.music.play('mystery');
game.music.intensity = lanterns / 3;                          // 强度越高，加入的声部越多
```

- `game.touchStick({ x, y, radius = 48, always })` 和 `game.touchButton(words, { x, y, key = 'space', radius = 32, color, always })` 画在 ui 层之上，对白框不会遮住它们；手指第一次触碰舞台后才显示，带 `always` 时立即显示。每根手指在抬起前一直控制它按下时的控件，所以一个拇指按摇杆、另一个按按钮可以同时进行。从别处开始的触摸仍是游戏的指针。
- 第一个标准布局手柄的按钮是名为 `pad:a`、`pad:b`、`pad:x`、`pad:y`、`pad:l1`、`pad:r1`、`pad:l2`、`pad:r2`、`pad:select`、`pad:start` 以及 `pad:up`、`pad:down`、`pad:left`、`pad:right` 的键，`down`、`pressed` 和 `released` 都能用。十字键计入 `keys.axis()`；`pad:a` 和十字键可以操作对白框和菜单。
- `game.music.play(mood)` 用代码写一段乐曲（`'calm'`、`'mystery'`、`'tense'`、`'battle'` 或 `'triumph'`），也可以传 `{ mood, seed, tempo, bars }`。乐曲由等长的四个声部组成：持续和弦、贝斯、鼓和旋律，一起循环播放；正在播放的乐曲会淡出。`game.music.intensity`（0 到 1）依次加入贝斯、鼓和旋律，过渡约一秒半。`volume` 默认 0.6，音效的音量和静音同样作用于音乐。`stop(seconds)` 淡出停止。暂停时保持，重开时停止。需要样本数据的游戏可以直接用导出的 `composeMusic` 和 `musicMix`。

第一次 `setup` 等待的菜单或对白框一打开就会开始绘制画面，所以能被看到并操作；否则画面仍在 `setup` 结束后才开始，与以前相同。

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

页面也可以把引擎作为[一个文件](single-file.md)使用，不需要 import map：`<script src="egret2d.js"></script>`，然后 `const { play } = Egret;`。[play 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.zh-CN.md)里有三个完整的游戏。

## 三维

[`play3d`](play3d.md) 就是下面垫了一个由方块、球和地面组成的世界、带跟随相机和太阳的它：按键、指针、声音、时间、文字和按钮都一样。

## 游戏变大之后

`game.browser` 是它所基于的[浏览器游戏](browser-game.md)，`game.engine` 和 `game.scope` 是它的 Engine 和 scope。从这里可以使用所有入口：图片和图集、[2D 相机](camera-2d.md)、[瓦片地图](tilemap.md)、带贴图的[粒子](particles.md)、[2D 物理](physics-2d.md)、[界面控件](ui-controls.md)、[带手柄的按动作输入](game-kit.md)和 [World3D](world3d.md)。它们创建的内容可以和 `play` 创建的一起加进 `game.world` 与 `game.ui`。
