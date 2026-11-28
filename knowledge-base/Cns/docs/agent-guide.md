# 面向智能体的指南，以及它如何从游戏中学习

[English](../../en/docs/agent-guide.md) | 中文

基于本引擎的游戏，大部分由编程智能体编写。它们需要知道引擎的名字，也需要那些只有把游戏做完才能得到的经验：一帧的时间花在哪里，什么在手机上会出问题，一个首次使用的着色器要付出多少代价。本页介绍提供这两者的指南，以及在少量人工审阅下让它保持更新的循环。

## 开始创作游戏

在已构建的检出里运行 `node tools/egret.mjs new <目录> --target web|mobile|wechat|steam --title <名字>`，会生成一个用来开始做游戏的目录，里面有：

- 一个小而完整的游戏：标题、按开始后一秒内就能做的第一个动作、分数、结束、保存最高分、键盘和触屏；
- `src/rules.mjs` 里的规则，用 `npm test` 在 Node 里测试；
- `src/main.mjs` 里用 `play` 画的画面；
- 带指南和 `egret` 命令的引擎副本；
- `AGENTS.md`（Codex 和大多数智能体会读）、把它引入 Claude Code 的 `CLAUDE.md`，以及一个 Claude Code 技能 `.claude/skills/egret-game`，带着从需求一步步走到检查通过的游戏。

`AGENTS.md` 控制在 1,000 个 token 以内，写明：

- 各个命令；
- 做一个游戏的步骤；
- 目标平台的舞台、适配方式和输入，以及发布平台对应的卡片；
- 说「做完了」之前要跑什么。

`--genre <类型>` 会把这一类游戏的配方放在 `AGENTS.md` 和技能的最前面。指南的 `genre` 领域收了十四份配方，每份都取自游戏仓库里同类型的游戏：塔防、幸存者、三消加卡牌、物理解谜、推理、剧情养成、角色扮演、横版动作、音游、经营、棋牌、战棋与策略、三维动作和驾驶。每份配方写明循环、规则和画面拆成哪些文件、这些游戏用了哪些入口、先读哪些卡片，以及「做完」是什么标准。在游戏里运行 `node vendor/egret.mjs new ../另一个`，会用它自己的引擎副本在旁边再建一个游戏。新建出来的游戏直接就能通过自己的测试、`egret check` 和 `egret verify`。

要在同样的工作上比较不同的智能体，或比较引擎改动前后的效果，[智能体基准](agent-bench.md)用这种方式开始十二份固定的简报，并给每次运行留下的结果打分。

先用一句话说明玩家要对谁做什么、场景中哪里会发生变化，以及玩家接下来还能做什么，再选引擎入口。经营或叙事游戏可以先读[让首次操作改变场景](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/game/first-playable-world.txt)。如果开场靠移动、落地或打击来表达玩法，再读[用角色或载具的动作传达反馈](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/game/action-body-feedback.txt)。例如，第一次跳跃可以用起跳时的舒展和接触地面时的下压，让玩家看清落点。已有游戏需要排错时，按 API 名称、错误码或症状查询下文的技术指南。

用程序图形搭建 2D 场景时，要给玩家操作成功的那一帧留出绘制余量。单帧捕获最多接纳 65,536 个网格三角形。即使远处的布景还在镜头外，挂在场景树上的几何也可能已计入预算。玩家激活一个大范围径向光晕时，还会再增加数千个三角形。可以用亮色中心和两层半透明平面形状表现发光，按段挂载布景，在玩家离开后移除旧段。实测时看三件事：操作前的画面、效果同时出现的一帧、操作后还能否继续移动。

参见[首稿对照记录](first-playable-entry-study.md)，了解两份开场的实录和这次对照能回答的问题。

[《暴雨渡口》对照](agent-guide-routing-study.md)记录了两组智能体自行读取的资料，以及玩家在未经精修的游戏开场里实际能做的事。

## 试玩并在修改工程后复跑

给智能体一份本地构建和一个可信、可独立运行的试玩脚本。用 [`verify-game` 的浏览器操作接口](https://github.com/cnedwin/Egret_rebuild/blob/main/tools/verify-game.mjs) 操作实际呈现的控件。确认游戏反馈后，依次用 `player.checkpoint(name)` 记录 `first-action`、`restart` 和 `first-action-after-restart`。仓库提供[点亮信标的示例和脚本](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/agent-playtest)。用现有[单文件构建](single-file.md)生成 `egret2d.mjs`，再将示例 HTML 和游戏模块复制到同一个构建目录。

```text
node tools/agent-playtest.mjs run --project examples/agent-playtest/project.json --web <build-folder> --file game.mjs --file egret2d.mjs --scenario examples/agent-playtest/scenario.mjs --playwright <Playwright-index.mjs> --out <new-run-folder>
node tools/agent-playtest.mjs run --after <failed-run-folder> --transaction <repair.json> --scenario examples/agent-playtest/scenario.mjs --playwright <Playwright-index.mjs> --out <new-retry-folder>
node tools/agent-playtest.mjs preview --run <passing-run-folder> --address <private-LAN-IPv4> --qr-module <qrcode.mjs>
```

首次运行把 `index.html`、列出的文件和序列化为 `project.json` 的工程快照复制到独立目录。示例信标的初始颜色无效，页面可以启动，第一次点击时 `report.json` 会记录错误码、实体、字段、路径和工程修订号。智能体可以据此检查快照并提交一条明确的[工程事务](工程事务核心合同.md)，将基准修订设为失败运行中的修订号，编辑范围限定在受影响实体。复跑会核对试玩脚本的字节，通过工程存储应用事务，并保留提交回执和浏览器证据。失败和复跑各保留一份记录。修改应用源码或工程文件时，重新构建并新建一次试玩记录。

预览会输出已验证构建的 SHA-256，并将 `preview-qr.png` 保存到通过验收的运行目录。手机连入同一局域网后扫码，完成同样的首次操作和重开。预览只提供选定的构建文件，15 分钟后关闭，也可以按 Ctrl+C 提前结束。请使用可信的网络和构建。桌面报告与手机试玩分别记录。在仓库外运行 `npm install --prefix <tool-folder> qrcode-generator@2.0.4`，并传入 `<tool-folder>/node_modules/qrcode-generator/dist/qrcode.mjs` 作为二维码生成模块。[qrcode-generator 许可与 npm 包](https://www.npmjs.com/package/qrcode-generator/v/2.0.4)

2026 年 11 月 26 日，Windows Chromium 用 WebGL2 运行示例。修订 0 在首次点灯时返回 `PLAYTEST_SIGNAL_COLOR_INVALID`。事务只修改了信标实体，同一脚本随后在修订 1 核对了点灯、重开后灯灭和再次点灯。Galaxy Z Fold7 上的 Chrome 157 识别了保存的二维码图片，经 USB 端口转发加载构建并用自动触摸完成三步。手机获取的四个文件与桌面清单逐一匹配，构建 SHA-256 为 `32f455a0537a043d40012f9a6658cd7889b8d345f6e815c9ea66e198d6b72c6f`。Wi‑Fi 测试也识别了二维码，Chrome 打开页面失败。在已授权调试的 Android 上进行 USB 测试时，可以将预览绑定到 `127.0.0.1`，用输出的端口执行 `adb -s <serial> reverse tcp:<port> tcp:<port>`。测试结束后移除本次转发规则。

## 开发者的智能体读什么

[`llms.txt`](https://github.com/cnedwin/Egret_rebuild/blob/main/llms.txt) 为智能体提供四条入口：做第一个 2D 交互、建立 3D 场景、接手已有游戏、排查报错。最小示例能响应空格键，完整游戏则直达仓库里的可运行源码。如果需求限定了源码大小，交付前请计算最终文件的 UTF-8 字节数。程序化 2D 特效触发帧捕获拒绝时，可以查阅[几何预算卡](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/perf/geometry-budget-2d.txt)。更多内容按需读取：

- [`guide/index.txt`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/index.txt) 列出各个领域，每个领域一行，写明卡片数和它们回答什么问题。`guide/areas/<领域>.txt` 列出一个领域的卡片，每张一行：卡片 id、它适用的引擎用法（`play`、`play3d`、`engine`、`world3d`、`web`），以及它回答什么问题。一个领域就是一个卡片文件夹，所以卡片再多，索引也不会变大；每一层都保持在 150 行和 1,500 个 token 以内。
- `guide/cards/<area>/<id>.txt` 是一个主题，打印出来不超过 800 个 token：简短的规则、一个最小示例，以及规则所依据的测量结果或总结出它的游戏。
- `node tools/egret-guide.mjs <问题>` 在预算内（默认 2,500 个 token，用 `--budget` 调整）打印最匹配的两到三张卡片。问题可以是英文或中文的词语、引擎名字、错误码或 devtools 提示 id。`--card <id>` 打印一张卡片，`--list` 打印领域索引，`--list <领域>` 打印一个领域的卡片，`--list all` 打印所有领域。
- `node tools/egret-guide.mjs --full --out <文件>` 把索引、各领域和所有卡片写成一个文件，供只接受单个文件的工具使用。它是构建产物，不提交到仓库。
- `node tools/egret.mjs` 把同一份指南做成给智能体用的一个命令：`guide <问题>`、`card <id>`、`list [<领域> | all]`，以及 `explain <错误码>`：它先打印运行时为这个错误码写的中英文句子，再打印提到这个错误码的卡片。
- 在游戏里，引擎副本带着这份指南。`tools/vendor-game.mjs` 把命令和卡片写到 `vendor/egret/` 下，由 `vendor/egret.mjs` 启动，所以在游戏目录里工作的智能体运行 `node vendor/egret.mjs guide <问题>`，得到的回答与在本仓库里相同，取自游戏固定的那个引擎提交。每次刷新副本都会整体替换这部分，指南删掉的卡片也随之消失。`--no-agent-kit` 不带指南。
- `node vendor/egret.mjs check` 在运行游戏之前读游戏自己的文件（`vendor/` 之外），找智能体用这个引擎时最常犯的错误。它报告：
  - 入口没有导出的名字，并给出导出它的入口或最接近的名字；
  - 不是入口的模块名；
  - 引擎副本或页面 import map 漏掉的入口；
  - 按路径引用副本里的引擎文件；
  - 在 `update` 里每帧新建文字或贴图；
  - 副本已经修好的缺陷的绕过代码；
  - 不考虑无痕窗口就写 `localStorage`；
  - 副本已经解决的引擎笔记。

  每条都给出文件和行号、该怎么做和要读的卡片。有错误时以 1 退出，加 `--strict` 时有警告也以 1 退出。写这个命令时，游戏仓库里能运行的 23 个游戏都没有报出错误。
- `node vendor/egret.mjs verify [<页面>]` 通过 `tools/verify-game.mjs` 在无头浏览器里运行游戏，引擎副本带着这个工具和 `pngjs`。它需要在游戏目录里装好 Playwright，或用 `--playwright` 指定。报告说明页面是否无错误地启动、画出了内容、持续运行、对输入有反应、发出了声音。报告的 `engineWarnings` 还列出运行期间引擎发出的告警，例如接近图片上限的帧、每帧新建的文字，不管游戏有没有要求告知。普通 verify 在盲测输入之前，会在包含导航耗时的 60,000 毫秒墙钟启动期限内等待就绪。它观察可见画布、非空白截图，以及空闲一秒内至少两次动画帧回调。如果游戏公开布尔值 `window.egretGame.ready`，为 false 时不采样或输入；为 true 时仍须有可见绘制和帧推进。请在加载初期设为 false，只在标题或第一个可操作游戏状态可以接受输入时设为 true。若没有这个由游戏维护的可选标记，验证器还会观察本地资源请求是否平息；这只是尽力判断，不能证明有动画的加载界面或游戏特有的状态已就绪。较大的游戏可用 `--startup-timeout <milliseconds>`（1 到 300000 的整数）设置期限。超时会在 `startupReady` 检查中记录失败和原因；错过启动期限时不执行盲测输入。可选的 `--play` 试玩路线会重新加载并再次检查就绪，因此后续脚本通过不会抹去先前的失败。暂存产物的仅脚本试玩路径与 `--screens` 不变；启动期限选项仅用于普通 verify。
- `node vendor/egret.mjs verify --screens` 改为在九种屏幕规格上运行页面：有刘海和没有刘海的手机、横竖两种拿法、横竖两种方向的平板、折叠状态外屏的横向浏览器视口（873 × 325，`foldable-cover-wide`）、展开的折叠屏和桌面。每种屏幕写一张图片，刘海或主屏指示条遮住的部分染成红色。对 `play` 游戏，它还列出伸进被遮部分的控件、触屏上小于 44 CSS 像素的控件，以及互相遮挡的两个控件。`--screens=phone-notch,tablet` 只跑其中几种。加上 `--play test/play.mjs` 可在每种屏幕上跑一段试玩路线，等待 `player.checkpoint(name)` 可单独检查其他界面状态。刘海是在 Chromium 里交给引擎的代替值。加 `--prepare <可信本地.mjs>` 可以在每个全新屏幕上检查后续菜单或集市：默认导出函数确认就绪并返回实际场景名称。两种选项同时使用时，先准备场景，准备失败则跳过该屏幕的试玩路线；准备成功后还会单独检查这个状态（`preparedState`）。准备异常、异步超时或没有原生控件报告均判失败；见[把舞台适配到屏幕](screen-fit.md#一次检查多种屏幕)。
- [`guide/entries.json`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/entries.json) 列出引擎每个公开入口经导入带上的其他入口（`includes`），以及哪些入口带上了它（`partOf`）：例如 `@egret/engine/web/game` 带上指针、键盘和帧循环。统计游戏用到哪些能力的工具（游戏仓库的能力覆盖矩阵）读它，把游戏点名的入口背后的那些入口也算上。它由 `node tools/egret-guide.mjs` 之外的 `node tools/entry-map.mjs` 从构建产物生成，`--check` 检查它是否最新。

与 `llms.txt` 一样，索引和卡片是以 `.txt` 文件保存的 Markdown 文本，只有英文。它们是智能体通过命令读取的数据，而不是阅读文档，因此没有中文对应版本；本页是双语的说明。

没有任何一个文件包含全部内容，因为智能体读的每个 token 都由开发者付费。这个命令不依赖仓库之外的任何东西：不联网，也不调用模型。排序是确定性的：与某张卡片的触发词或 id 完全相同的问题排在最前；其余卡片按与问题共有的词语排序，每个词按它在卡片中出现的稀有程度加权。中文词之间没有空格，所以卡片还带有中文触发词，只要问题中任何位置包含它就算命中：`node tools/egret-guide.mjs "手机横屏 按钮 点不到"` 通过“手机横屏”和“按钮点不到”找到讲短横屏的卡片。一个中文触发词如果也出现在其他卡片上，或者比较短，权重就较低，因为两个字的词会出现在更多问题里。

卡片的前置元数据记录检查所需的信息：`id`、`title`、`applies`、`triggers`（引擎名字、错误码、提示 id 和普通词语描述的症状）、`local`（属于某个游戏而不属于引擎的名字）、`evidence`（仓库、路径、行号、提交，以及该提交时游戏所用的引擎版本）、`engine`（核对这张卡片时引擎的提交），以及在适用时的 `stale`（总结经验之后发生了什么变化）。过时的卡片会连同警告一起打印，而不是被隐藏。

## 循环

```text
基于引擎的游戏 ──采集──▶ 建议 ──提炼──▶ 卡片 ──合并关卡──▶ 指南
      ▲                                                  │
      └────────── 智能体用指南来制作和修复游戏 ◀─────────┘
```

### 1. 采集

`node tools/harvest-games.mjs --games <克隆> --commit <提交> --out <新目录>` 用 git 读取游戏仓库本地克隆在指定提交时的内容，不改动克隆本身。对每个内置了引擎副本的游戏，它记录：

- `vendor/SOURCE.md` 中固定的引擎版本及其列出的入口；
- 每个模块导入的引擎名字，包括运行时选择的后端的名字；
- 测试文件及每个文件的用例数；
- README 和 STATUS 中按章节分类的说明：已验证、已知问题、已解决和未完成；双语文件取英文部分；
- 每个改动过该游戏的提交，包括标题、`vendor/` 之外的文件和改动量，并标出修复类提交及其涉及的领域。

反复出现的修复正是智能体容易出错的地方，所以采集还会对指南提出修改建议。如果某个修复的标题找不到任何卡片，它会按领域归入一张建议新增的卡片，并附上证据。证据被移动或删除的卡片，或者游戏现在所用的引擎版本与总结经验时不同的卡片，会被列出待审。有两次及以上修复的领域，会连同覆盖它们的卡片一起列出。

输出是私有的工作数据：两个 JSON 文件，写在仓库之外，或写在被忽略的 `work/` 目录下。仓库和提交总是显式给出，因此采集可以重复。

### 2. 提炼成卡片

智能体根据自己对游戏开发的一般经验和证据所显示的内容，把建议写成卡片。欢迎引入来自其他引擎的一般知识，但只用本引擎的名字来写。关于质量的规则要写明它所依据的测量，例如一次改动前后的三角形数和绘制次数，或者写明它来自哪个修复提交。不同的结论分开陈述：测试通过、不开页面完整跑完一局、在指定设备上跑完一局，是三件不同的事。

### 3. 机械检查作为合并关卡

`tests/guide.test.mjs` 与其他测试一起运行，决定对指南的改动能否合并。它不需要人再去通读卡片：

| 检查 | 保证 |
| --- | --- |
| 名字 | 卡片中导入、调用或写到的每个引擎名字，都由所写的入口导出，或者由某个入口导出，以生成的 API 参考和 devtools 的导出为准；写在点号之后的每个成员都是源码中的名字 |
| 错误码和提示 | 每个错误码触发词都在生成的错误码列表或 `errorHelp.ts` 中；每个提示触发词都是 devtools 的提示 id |
| 大小 | 每张卡片打印后不超过 800 个 token，文件不超过 1,000 个 token；索引不超过 150 行和 1,500 个 token |
| 索引 | 每张卡片在索引中恰好出现一次，`applies` 一致；每个链接都能解析 |
| 证据 | 每张卡片都有包含仓库、路径、行号、提交和引擎版本的证据；指向本仓库的证据必须指向存在的行 |
| 检索 | 一组固定的 71 个问题（其中 27 个是中文）都把预期的卡片排在第一；回答不超出预算，并且每次运行结果相同 |
| 采集 | 在测试中临时建立的小仓库上，采集能读出引擎版本、导入、测试、说明和修复，并标出过时的卡片 |

名字检查只读取生成文件或源文件，因此会跟随引擎变化，自己不需要另外的台账。它不比较字节，不属于证据通道。

### 4. 智能体在固定题目上的自我评估

[《风灯驿》实录](first-playable-entry-study.md)对照了同一条需求生成的两份原始首稿。覆盖多个题材的评估仍在第二阶段计划中。把一组固定的游戏题目（一个小型 2D 街机游戏、一个带触屏操作的 3D 游戏、一个有大量灯光和加载的游戏）分别交给使用和不使用指南的智能体。每次尝试只用可测量的结果来评判：`node tools/verify-game.mjs` 或游戏自己的 Node 检查是否通过、抛出了哪些引擎错误、读了多少 token 的指南、尝试了几次。结果作为证据保存，并记录所对应的引擎和指南的提交。它们运行在[证据通道](evidence-lane.md)中：只出报告，从不决定合并，因为智能体每次运行的结果都会有差异。

### 5. 剪枝

计划在第二阶段实施。评估中从未被检索到、或者有没有它都不改变结果的卡片，只有成本没有收益。这样的卡片会被并入另一张或删除，检索题目也随之更新。标记为过时的卡片，如果采集表明经验在新版本下仍然成立，就更新它；否则围绕变化的内容重写。

### 6. 从错误和提示指向卡片

计划在第二阶段实施。引擎错误带有错误码，`@egret/devtools` 会给出 `frames-skipped` 这样的提示 id。两者现在已经可以直接作为问题交给指南（`node tools/egret-guide.mjs FRAME_BUDGET_EXCEEDED`）。错误码的指向现在已经有了：`node tools/egret.mjs explain <错误码>`（在游戏里是 `node vendor/egret.mjs explain`）先打印运行时为这个错误码写的中英文句子，再打印触发词里写着这个错误码的卡片，所以卡片和指向不会不一致。提示 id 仍作为问题交给指南。

### 7. 游戏写回的引擎笔记

游戏遇到引擎的缺陷时，用引擎自己的部件绕过去，并把缺陷写进游戏根目录的 `ENGINE-NOTES.md`，每个缺陷一条带编号的笔记（[卡片](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/cards/verify/engine-notes.txt)）。每条笔记的标题下面有一行给程序读的头：

```html
<!-- engine-note: {"id": "InquestScrolls#3", "status": "open", "topic": "paragraph-without-webassembly", "workaround": ["src/view/plainText.mjs"]} -->
```

`id` 是游戏目录名、`#` 和笔记编号。`status` 是 `open`、`partly`、`worked-around`、`documented` 或 `resolved`。`topic` 用连字符连接的英文词说明是什么缺陷，遇到同一个缺陷的游戏写同一个 topic。`workaround` 列出存放绕过代码的游戏文件。

引擎解决或用文档说明了一个缺陷时，那次改动在 [`guide/resolved.json`](https://github.com/cnedwin/Egret_rebuild/blob/main/guide/resolved.json) 里加一条：topic、引擎做了什么（`resolved`、`partly` 或 `documented`）、一两句话说明改了什么、提交和 PR、要读的卡片，以及它针对的笔记。引擎副本带着游戏固定的那个提交时的清单。在游戏目录里运行 `node vendor/egret.mjs notes`，会按 topic 和 id 把游戏的笔记与这份清单对照，列出副本之后已经解决或说明、但游戏里仍标为未解决的每条笔记：改了什么、要从哪些文件里去掉绕过代码、要读哪张卡片。只要还有这样的笔记，`--check` 就以 1 退出。在本仓库运行（`node tools/egret.mjs notes <游戏目录>`）时，它对照最新的清单，并提示先刷新游戏的引擎副本。

第一批条目来自《洗冤笔录》的笔记（#474 到 #478），以及四个 play 游戏共有、早已修好但仍标为未解决的缺陷。

## 归属与审阅

卡片是第一方文本，采用 Apache-2.0 许可，在 AI 辅助下编写。游戏仓库是证据来源，而不是依赖：引擎和指南都不导入它。人工审阅有意保持轻量。开发者在这些游戏上的反复工作，通过修复提交和 STATUS 记录起到了标注的作用；上面的机械检查则代替了逐张重读卡片。
