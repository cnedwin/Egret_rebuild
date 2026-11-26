# 智能体基准

[English](../../en/docs/agent-bench.md) | 简体中文

这个引擎上的游戏大多由编程智能体编写。引擎、指南或工具的一次改动是否帮到了它们，要看实际运行的结果，而不是看意见。基准把工作固定下来，让各次运行可以相互比较：

- 十二份简报；
- 每份用同一种方式开始；
- 给智能体同一句话；
- 用同一种方式给智能体留下的结果打分。

它用于两类比较：

- 在同一个引擎提交上，Codex 对比 Claude Code，或一个模型对比另一个；
- 用同一个智能体，一个引擎提交对比它之前的提交。

开始和打分由 `tools/agent-bench.mjs` 完成。它不向任何地方发送内容，也不调用任何模型：智能体由人用它自己的应用来运行。

## 简报

每份简报是开发者可能写下的一小段话，放在 `tools/agent-bench/briefs/<id>.txt`，有英文和中文两个版本。十二类游戏各有一份简报，每一类在[指南](agent-guide.md#开始创作游戏)里都有配方。这些简报合起来覆盖 `egret new` 的四个目标平台。

| 简报 | 类型 | 目标 | 标题 |
| --- | --- | --- | --- |
| `td-canal` | 塔防 | web | Lock Keepers |
| `sv-lanterns` | 幸存者 | mobile | Lantern Night |
| `mc-tiles` | 三消加卡牌 | web | Tile Duel |
| `pp-crane` | 物理解谜 | web | Crane Yard |
| `dd-ledger` | 推理 | wechat | The Missing Ledger |
| `ss-tea` | 剧情养成 | mobile | Tea House Spring |
| `rp-pass` | 角色扮演 | web | Mountain Pass |
| `sc-kite` | 横版动作 | steam | Kite Runner |
| `rh-drum` | 音游 | web | Festival Drum |
| `mg-orchard` | 经营 | wechat | Hill Orchard |
| `tt-dominoes` | 棋牌 | web | Four Winds Dominoes |
| `a3-duel` | 三维动作 | steam | Rain Duel |

`node tools/agent-bench.mjs list` 列出全部简报，`brief <id>` 打印其中一份。同一个系列里简报不变：改动简报、换用另一种语言的简报或换一个引擎提交，都算开始一个新系列。

## 一次运行

1. 在这个系列的提交上构建一份检出。
2. 开始游戏：

   ```text
   node tools/agent-bench.mjs start rh-drum runs/s1/rh-drum --agent codex --model <模型> [--language zh]
   ```

   它按简报的游戏类型、目标平台和标题运行 `egret new`，并把简报以 `BRIEF.md` 放进文件夹。文件夹的起点记录在它旁边的 `rh-drum.bench.json` 里，在文件夹里工作的智能体不会读到。
3. 在游戏文件夹里打开智能体：在该文件夹里启动 Codex 或 Claude Code，允许它在那里运行命令、写文件。它可以安装 `egret verify` 需要的 Playwright。
4. 只发送 `start` 打印出的那一句话，别的都不发：
   - 英文：`Make the game that BRIEF.md describes, in this folder.`
   - 中文：`在这个文件夹里做出 BRIEF.md 描述的游戏。`
5. 智能体工作期间：
   - 它提问时，只回答“你自己决定”（英文运行回答 "Decide yourself."）。这不计数。
   - 其他任何帮助都计一次人工介入：贴一段报错、给一个提示、手动改一个文件。
   - 智能体说做完了，或者满 60 分钟，就停止。
6. 把智能体的最后一条消息存到文件夹旁边的 `rh-drum.said.md`：它说自己运行了什么、有什么没能运行。
7. 给文件夹打分：

   ```text
   node tools/agent-bench.mjs score runs/s1/rh-drum --minutes 42 --interventions 1 [--playwright <index.mjs>]
   ```

   Playwright 会从文件夹或检出里查找；找不到时用 `--playwright` 指定。
8. 标记评审项。由一个人玩十分钟游戏，然后在 `rh-drum.score.json` 里把 `review.items` 的每一项标为 `true` 或 `false`。重新打分时，已有的标记会保留。
9. 比较：`node tools/agent-bench.mjs table runs/s1/*.score.json` 每次运行给出一行。

## 分数

**健康度**，满分 100：游戏能不能运行，有没有按引擎的规矩来？

| 部分 | 分值 | 得分条件 |
| --- | --- | --- |
| tests | 30 | 游戏自己的测试通过：它的 `npm test`，或者用 `node --test` 跑 `test/` 下全部 `*.test.mjs` |
| checkErrors | 25 | `egret check` 没有错误 |
| checkWarnings | 5 | 而且没有警告 |
| verify | 30 | 通过 `tools/verify-game.mjs` 盲玩 `index.html`，每一项检查都通过 |
| engineWarnings | 5 | 而且这次运行里引擎没有发出告警 |
| notes | 5 | 有 `ENGINE-NOTES.md`，而且每条记录的头行格式正确 |

没能运行的部分不计入总分，并在“未运行”一栏列出。所以满分 65 的分数（没有浏览器）不和满分 100 的分数比较。

**改动**：这次运行替换了起始项目的多少内容：
- 起始项目 `src/` 下的文件被改动或删除的比例；
- `src/` 和 `test/` 下新增的文件；
- 新增的测试；
- README 是否重写。

健康却什么都没替换的游戏就是起始项目本身，而不是按简报做出的游戏。

**简报完成**：由人标为已完成的评审项。评审项包括按本次运行语言给出的简报原句，以及这类游戏的配方里“做完”的标准，去掉了健康度已经检查的那些命令。`rh-drum` 有十项，其中包括“每一击按事件时间对照音乐判为早、准或晚。”和配方里的“The clock taken from the music, never from frames.”（时钟取自音乐，而不是帧）。

看一次运行时，先看**简报完成**，**健康度**是它的底线，**分钟数**和**人工介入**是它的代价。只比较同一个系列里的运行。

## 校准

以下结果测于 2026 年 11 月 26 日，环境是使用软件渲染的无头 Chromium。没有任何智能体参与。

| 文件夹 | 健康度 | 起始项目替换比例 | 简报完成 |
| --- | --- | --- | --- |
| 十二份简报各自未经改动的起始项目 | 100/100 | 0% | 7–11 项中 0 项 |
| `update` 每帧都新建一个文字的起始项目 | 90/100：`text-in-update`、`PLAY_MADE_EVERY_FRAME` | 50% | – |
| 导入了入口并不导出的名字、并且有一个失败测试的起始项目 | 5/100：测试、检查和浏览器运行全部失败 | 50% | – |
| 游戏仓库里的 OperaDrums、LubanBridge、NightWardens | 100/100 | – | – |
| 游戏仓库里的 CanalWatch | 95/100：按路径导入了一个引擎文件 | – | – |

健康度能把坏掉或粗心的游戏与能运行的游戏分开，游戏仓库里完成的游戏和起始项目得分一样高。健康度分不开完成的游戏和起始项目，这要靠改动和评审项。

## 它不衡量什么

- **这里还没有记录任何智能体运行。** 第一个系列是 Codex 和 Claude Code 在同一个提交上完成这十二份简报，由人用这两个应用按上面的步骤运行。这个仓库里没有任何东西会启动智能体。
- **浏览器运行是盲玩。** 它按键、点击、拖动，所以到不了游戏的结尾。游戏有没有做到简报要求的事，由评审项来回答。
- **不在设备上运行。** 微信简报不在微信开发者工具或手机上运行，Steam 简报不构建桌面版，也不在 Steam Deck 上运行。
- **评审是一个人的判断。** 两个人可能给同一次运行标出不同的结果。一个系列尽量由同一个人评审。

相关：[智能体指南](agent-guide.md)、[Play](play.md)。
