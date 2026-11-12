# 果冻熊猫

[English](README.md) | 简体中文

果冻熊猫是基于 `@egret/engine/world3d` 做的一款完整小游戏：半透明的果冻熊猫要在玩具岛上抵挡越来越多的糖果大军十五分钟。玩具会自动开火，熊猫软弹的身体本身也是武器，每次升级可以选一张强化卡，第 5、10、15 分钟各有一个 Boss。它按真实项目的方式使用引擎：物理、角色移动、实例化、透明材质、粒子、阴影和后处理在同一个 Engine 时钟下一起运行。

游戏的设计参照 GamesByAI 的 [Jiggle Kings](https://github.com/gamesbyai/jiggle-kings)，该仓库只发布了构建后的游戏。这里没有复制其中任何内容：代码、造型、名称、数值和文字都是为本示例重新编写的，角色换成了八种颜色和肚皮花纹的熊猫。

## 运行

在仓库根目录使用 Node.js 26.7.0 和 pnpm 11.25.0：

    pnpm setup:dev
    pnpm example:browser

打开 `http://127.0.0.1:4173/examples/jelly-pandas/index.html`。游戏面向桌面浏览器，使用键盘鼠标或手柄。

| | 键盘和鼠标 | 手柄 |
|---|---|---|
| 移动 | W A S D 或方向键 | 左摇杆 |
| 转视角 | 鼠标 | 右摇杆 |
| 跳跃（长按蓄力大跳） | 空格 | A |
| 空中下砸，地面肚皮撞 | Ctrl、鼠标左键或 Q | B |
| 翻滚 | Shift、鼠标右键或 E | X |
| 选卡 | 1 到 3，R 重抽 | 方向键左、上、右；Y 重抽 |
| 菜单 | Esc 或 P | Start |

地址参数：`?backend=webgpu` 使用 WebGPU 绘制，`?lang=en` 或 `?lang=zh` 指定语言，`?jelly=0` 把透明身体换成普通的光泽材质，`?post=0` 关闭后处理，`?shadows=0` 关闭阴影，`?reflect=0` 关闭水面倒影，`?ratio=1` 降低绘制分辨率。

## 内容

- 八只熊猫，各有自己的颜色、肚皮花纹和初始玩具。可以单人游玩，也可以带一到三位由游戏操控的伙伴；站到倒下的熊猫身边可以把它救起。
- 十二种玩具，各有八级和一次进化（升到满级并拥有对应护符），以及十二种护符，各有五级。
- 七种糖果敌人，戴皇冠的精英会掉落宝箱，每两分半钟一次狂潮，还有三个 Boss。
- 身体动作：蓄力大跳、下落越高威力越大的下砸、肚皮撞和翻滚。
- 敌人会被打飞、摔伤、掉进海里淹没。沙滩球和木桶是刚体，可以推进敌群。

## 如何使用引擎

| 部分 | 引擎功能 |
|---|---|
| 熊猫行走、跳跃、推动道具 | `PhysicsWorld3D` 上的 `createCharacterMotor3D` |
| 岛屿碰撞 | 由 `createMeshShape3D` 生成的静态三角网格刚体 |
| 沙滩球和木桶 | 动态球体与凸包刚体 |
| 果冻身体 | `createGlassMaterial3D` 加上绘制的花纹纹理 |
| 敌群、弹丸、糖粒、棕榈树 | 带逐实例颜色的 `InstancedMesh3D` |
| 海面 | `createWater3D`，带波浪和场景倒影 |
| 特效 | `createParticleEmitter3D` 的爆发和叠加圆环 |
| 相机 | `createFollowCamera3D` |
| 帧循环 | Engine 时钟上的 `createWorld3DView` 与 `startWorld3DLoop` |
| 画面 | 级联阴影、渐变天空与环境光、泛光和 FXAA |

模拟部分（`sim.mjs`、`toys.mjs`、`island.mjs`、`data.mjs`）不依赖页面。`view.mjs` 和 `panda.mjs` 负责绘制，`hud.mjs` 构建画布周围的界面，`input.mjs` 和 `audio.mjs` 处理输入设备和声音。同屏最多 260 个敌人；它们使用比刚体更轻的模型，走在与岛屿网格相同的高度网格上。

## 不开页面运行

    node examples/jelly-pandas/headless.mjs 4 7

用伙伴的规则操控四只熊猫打完一整局（队伍人数、种子和分钟数可选），每分钟输出一行。这是检查规则或数值改动最快的办法。

## 限制

- 只有单人和由游戏操控的伙伴。Jiggle Kings 另有通过独立服务器的联机模式，本示例不包含。
- 已在无头 Chromium 的 WebGL2 软件渲染下检查：标题、游玩、升级选卡、一个 Boss 和结算界面，使用键盘输入。尚未在实体 GPU、WebGPU、手柄上运行，也没有人亲手玩过，因此帧率和操作手感仍待确认。
- 难度是用无页面运行调出来的：按这些规则操控的熊猫单人大约能坚持十分钟，四人队伍能打到最后一个 Boss；还没有人亲手玩过。
- 音效用 Web Audio 生成，没有音乐。不提供触屏操作。
