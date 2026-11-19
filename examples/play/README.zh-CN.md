# Play：三个完整的小游戏

[English](README.md) | 简体中文

三个游戏，每个只有一个文件、一次对 `@egret/engine/play` 中 `play` 的调用：打砖块、平台跳跃和翻牌配对；一个带剧情的小场景：标题菜单、可阅读和选择回答的对白、血条和提示；还有一个 3D 游戏，一次对 [`play3d`](../../knowledge-base/Cns/docs/play3d.md) 的调用：滚动小球收集星星。它们都没有图片、声音文件或字体；形状是画出来的，声音由代码合成，每个游戏都可以用键盘和指针来玩。它们就是 [llms.txt](../../llms.txt) 中的三个游戏；那一页是智能体编写游戏时阅读的页面，其中的游戏与这里逐字相同。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/play/index.html`，运行的是打砖块；加上 `?game=platformer`、`?game=memory`、`?game=story` 或 `?game=roll3d` 运行其他几个。游戏铺满窗口。

## 可以试什么

- 打砖块：用方向键或拖动来移动挡板。球落在挡板上的位置决定它弹出的方向。丢掉三个球，或打掉所有砖块后，按按钮重新开始。
- 平台跳跃：用方向键或按住屏幕的一侧来跑，用空格或点按屏幕上半部分来跳。关卡比舞台宽，视野跟随主角。地面一直通到终点，每个平台上方有一枚金币。
- 翻牌配对：点两张牌。相同的一对保持翻开，不同的两张翻回去。最少步数会在两次访问之间保留。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 画布、适配窗口和循环 | `play({ width, height, setup, update })` |
| 砖块、挡板、平台、金币 | `game.rect` 和 `game.circle`，按中心放置 |
| 圆角的牌，翻面时重新绘制 | `game.sprite(g => …)` 和 `sprite.graphics.clear()` |
| 按键和指针 | `game.keys.axis()`、`game.keys.pressed`、`game.pointer`、`game.onTap` |
| 球碰砖块、主角碰金币 | `game.overlaps` 和 `game.hits` |
| 站在平台上、在墙前停住 | `game.pushOut` |
| 比舞台宽的关卡 | `game.view.x` |
| 牌的翻转，以及等待它完成 | `game.tween(card).to({ scaleX: 0 }, 0.1).done` 和 `game.wait` |
| 声音 | `game.sfx.play('coin')` 和其他由代码合成的音效 |
| 有手感的命中 | `game.burst`、`game.shake`、`game.flash` |
| 分数、结束和重新开始 | `game.text`、`game.button`、`game.restart` |
| 最好成绩 | `game.save` 和 `game.load` |

参见 [play 指南](../../knowledge-base/Cns/docs/play.md)。

## 核对

```text
node examples/play/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

它用键盘和鼠标把每个游戏玩到结束，并从页面的截图读取结果：游戏里没有任何为核对而写的代码。打砖块中，挡板跟随指针和方向键，一块砖被打掉并发出声音，随后挡板一直躲开球直到丢掉三个球，按钮让所有砖块回来。平台跳跃中，主角落地、跳起，靠按住的指针和按键跑到终点，按钮把它放回起点。翻牌配对中，核对脚本每次翻两张牌、记住它们的颜色、找出全部八对，按钮让十六张牌重新扣下。剧情场景中，用回车选标题菜单，看守的话逐字出现、按键后整段显示，轻触选第二个回答，按住方向键走完院子点亮三盏灯笼，血条停在四分之一，最后的菜单让院子重新开始。声音只计数，没有人听。最初的完整游戏检查使用软件 WebGL2。2026 年 11 月 18 日的硬件契约检查，在 Windows 和 Fold7 的两个后端上覆盖暂停／补间时钟、碰撞、导入旋转、资源清理和指针像素，具体范围见 [Play](../../knowledge-base/Cns/docs/play.md) 和 [Play3D](../../knowledge-base/Cns/docs/play3d.md)。这不代表重新完成了完整游戏、声音或性能验收。

要核对你自己写的单页游戏，见 `tools/verify-game.mjs`。它默认盲玩；给它一个脚本，它就按人的玩法去玩。[play-breakout.mjs](play-breakout.mjs) 就是这样一个脚本，把打砖块玩到结束。
