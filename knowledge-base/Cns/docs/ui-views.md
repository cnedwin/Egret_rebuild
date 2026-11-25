# 用数据描述界面

[English](../../en/docs/ui-views.md) | 简体中文

游戏的商店、设置页、结算界面，每次做的事情都差不多：卡片、一排按钮、一个数字、一根进度条、一个开关，贴着边放好，并随时保持最新。用精灵一个个写出来，界面的结构就埋在坐标计算里，手机一转屏又得重写。这里改为用数据描述界面：描述里给代码关心的部件起名，再用一张绑定表把这些名字连到游戏的状态上。`@egret/engine/web/view` 负责检查描述并规划每个部件的位置；[play](play.md) 的 `game.show` 按皮肤把规划画出来，并保持绑定。

## 一个界面

```js
const shop = game.show(
  {
    label: 'Shop',
    root: {
      type: 'panel', card: true, anchor: 'center', width: 420, height: 280, padding: 16, layout: 'column', gap: 12,
      children: [
        { type: 'text', name: 'gold' },
        { type: 'bar', name: 'hp', label: 'Health', height: 14 },
        { type: 'toggle', name: 'sound', text: 'Sound' },
        { type: 'panel', layout: 'row', gap: 12, height: 52, justify: 'center', children: [
          { type: 'button', name: 'buy', text: 'Buy 60', width: 140 },
          { type: 'button', name: 'sell', text: 'Sell all', width: 140 }
        ] }
      ]
    },
    portrait: { /* 同样的名字，竖握手机时排在屏幕底部 */ }
  },
  {
    state,
    bind: {
      gold: { pick: s => s.gold, roll: 0.5, format: n => 'Gold ' + n },
      hp: { value: s => s.hp / s.maxHp },
      sound: { checked: s => s.sound, tap: s => (s.sound = !s.sound) },
      buy: { disabled: s => s.gold < 60, tap: s => (s.gold -= 60) },
      sell: { tap: () => askToSell() }
    }
  }
);
```

代码只改 `state`，不碰界面。每一帧在 `update` 之后读取所有绑定，只重画变化了的部分。

## 部件

| `type` | 是什么 | 它自己的字段 |
| --- | --- | --- |
| `panel` | 容纳部件的区域；`card: true` 或给出 `color` 时画成卡片 | `layout`（`'free'`、`'row'`、`'column'`）、`gap`、`padding`、`align`、`justify`、`alpha`、`label`、`children` |
| `text` | 一行文字，在所占区域里上下居中 | `text`、`size`、`color`、`align`（`'left'`、`'center'`、`'right'`）、`bold` |
| `button` | 带文字的按钮 | `text`（必填）、`size`、`color`、`textColor` |
| `bar` | 某样东西有多满，0 到 1 | `value`、`color`、`label` |
| `toggle` | 文字，右端一个开关 | `text`（必填）、`checked`、`size` |
| `space` | 空白；在行里用 `'fill'` 可以把后面的部件推到末端 | |

每个部件都可以有 `name`、`anchor`、`x`、`y`、`width`、`height` 和 `visible`。尺寸可以是游戏单位、`'50%'` 这样的比例，或 `'fill'`。在自由布局的面板里，部件按 `anchor`（四角、四边或 `'center'`）放置，`x`、`y` 向内偏移。在行或列里，部件依次排列：先算固定尺寸，剩下的空间由 `'fill'` 的部件平分。`align` 决定横向的对齐，默认是 `stretch`；没有部件 `'fill'` 时，`justify` 决定它们沿行聚在哪里：`'start'`、`'center'`、`'end'` 或 `'between'`。

根部件放在 `game.safe` 里，也就是没有刘海遮挡的部分；给出 `area: 'screen'` 时则放在整个 `game.screen` 里。[屏幕](screen-fit.md)每次变化都会重新规划。屏幕高大于宽时，改用 `portrait` 部件并重新创建，每次创建后都会调用 `built(view)`。竖屏部件必须有同样的名字、同样的种类。

部件没有的字段、重复的名字、竖屏缺少的名字，会以 `UI_VIEW_INVALID` 或 `UI_VIEW_VARIANT_MISMATCH` 拒绝，并指出是哪个部件，例如 `root/3/0 (buy)`。绑定了视图里没有的名字，抛出 `UI_VIEW_BINDING_UNKNOWN`；部件不能接受的绑定，抛出 `UI_VIEW_BINDING_INVALID`。拼错的字段绝不会被当成什么都没有。

## 多行文字、带说明的按钮、图片和边框

给 `game.show` 传入 `paragraphCache`，文字部件和按钮说明便可以使用[段落 SDK](paragraph-layout-controls.md)。在视图描述中给每个段落部件指定高度。文字按规划宽度换行，超出部件高度的内容会被裁掉。按钮说明显示在标题下方，按按钮内部宽度换行。`lineHeight` 设置最小行高，`fontFamilies` 按顺序指定回退字体，`maxLines` 限制行数。只写 `text` 的按钮继续使用原来的单行标题。

```js
import { createParagraphCache } from '@egret/engine/paragraph';

// 在 play 的 setup 中使用由游戏管理的缓存和段落提供器。
const paragraphCache = createParagraphCache(game.engine.assets, { provider });
const paragraph = { fontFamilies: ['Noto Sans', 'Noto Sans CJK SC'], locale: 'zh-CN', lineHeight: 24 };
const workshop = game.show({
  label: '工坊',
  root: {
    type: 'panel', width: 340, height: 300, padding: 14, layout: 'column', gap: 10,
    border: { color: 0x8ba87a, width: 2 },
    children: [
      { type: 'image', name: 'cover', src: '/art/workshop.webp', label: '工坊外观', height: 64 },
      { type: 'text', name: 'notes', text: '筹备 Wood workshop', paragraph, height: 72 },
      { type: 'button', name: 'build', text: '建造工坊', description: '备齐两箱木材。\nPlace two crates.',
        paragraph: { ...paragraph, maxLines: 3 }, height: 108, border: { color: 0x56caff, width: 2 } }
    ]
  }
}, { paragraphCache, bind: { build: { tap: () => buildWorkshop() } } });
```

每个部件都支持 `border: { color, width }`，边框沿部件内侧绘制。`image` 保持原始宽高比，在部件范围内居中。给图片同时填写 `name` 和 `label`，可以发布图片角色和可访问名称。关闭视图会释放它持有的段落和图片资源引用。共享的缓存和提供器由游戏管理，等使用它们的视图全部关闭后再释放。

游戏可以自行选择段落提供器和字体。浏览器配置见[段落面板示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.zh-CN.md)，其中可选的 CanvasKit 和 Noto 字体附有[来源和许可记录](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json)。普通的单行视图启动时无需加载这些文件。如果页面原生使用 import map，启用段落时应映射 `@egret/engine/paragraph` 和 `@egret/runtime/paragraph`，使用 CanvasKit 提供器时再映射 `@egret/engine/web/paragraph`。

```text
node tools/build.mjs
node --test tests/ui-view.test.mjs
node examples/play/verify-ui.mjs <Playwright index.mjs 绝对路径> <新的绝对输出目录> <Chromium 可执行文件绝对路径> rich
```

Chromium 157 软件 WebGL2 实测，两段文字都换成三行，基线间距为 24 个逻辑单位。取样像素确认了边框和 WebP 封面，按钮点击执行一次操作，关闭视图后段落缓存的借用计数回到零。这个用例的硬件 WebGPU、Safari、Firefox 和实体手机渲染仍待验证。

## 绑定

| 键 | 用于 | 读作 |
| --- | --- | --- |
| `text` | text、button、toggle | 文字 |
| `pick`、`format`、`roll` | text、button | 一个数字、它的文字（不给时取整），以及滚动到新数字所用的秒数 |
| `value` | bar | 0 到 1 |
| `checked` | toggle | 开或关 |
| `disabled` | button、toggle | 变灰，按下无效 |
| `visible` | 所有部件 | 连同里面的部件一起隐藏 |
| `color` | text、button、bar、panel | 绘制的颜色 |
| `tap` | button、toggle、panel | 按下时做什么，参数是状态 |

绑定函数抛出的错误会让游戏停下，和 `update` 抛出的一样。

## 皮肤

没有自带颜色的部件按 `DEFAULT_VIEW_SKIN` 绘制：深灰蓝卡片上的白字、蓝色按钮、不可用时为灰色、进度条和开关用绿色强调色、圆角 10。在描述里写 `skin: { button: 0xe11d48 }`，只改它指定的那一项。

## 视图

`game.show` 返回视图：

- `get(name)` 是某个部件的精灵，可以给它加[手势](gestures.md)、往里加东西或做缓动。
- `rect(name)` 是它以游戏单位计的位置；`shows(name)` 表示它当前是否显示。
- `show()`、`hide()`、`close()` 和 `refresh()`。

视图同时也是[界面栈](ui-screen-stack.md)的句柄：`open: () => game.show(...)` 会让它被覆盖时隐藏、别的界面在前面时不接受按下、关闭时移除。在不用打包工具的页面里使用界面栈，需要在 import map 里映射 `@egret/engine/ui`。

`modal: true` 会在视图后面的所有东西上加一层暗色，并接住所有没点在视图上的按下。

## 可滚动视图

给固定高度的面板设置 `scroll: 'vertical'`。双列建筑单子可以用一个列面板放多行，每行再放两个按钮。视口裁剪子项，并支持滚轮、触屏拖动和键盘导航。

```js
const buildings = game.show({
  label: '建筑单子',
  root: {
    type: 'panel', name: 'list', scroll: 'vertical',
    layout: 'column', gap: 8, width: 330, height: 104,
    children: [0, 1, 2, 3].map(row => ({
      type: 'panel', layout: 'row', gap: 12, height: 44,
      children: [
        { type: 'button', name: 'house' + row, text: '民居', width: 'fill' },
        { type: 'button', name: 'workshop' + row, text: '工坊', width: 'fill' }
      ]
    }))
  }
}, { bind });
const scroll = buildings.scroll('list');
scroll.scrollTo(48);
```

滚动句柄提供 `offset`、`maximum`、`scrollTo`、`scrollBy` 和 `page(-1 | 1)`。刷新绑定会保留此前的滚动位置，内容缩短时将位置限制在可用范围内。Tab 和 Shift+Tab 可让下一项或上一项滚入视口。完全被裁掉的控件只有重新露出，才可被测试器或辅助技术直接操作。手指纵向拖动会滚动，避免误按列表项。滚轮推动列表时由视图消费，此时 `game.pointer.wheel` 不会再收到同一事件。迁移旧界面时，每个面板保留一个滚动控制器。

## 可交互区域

语义树按父面板的实际变换和裁剪发布舞台坐标。局部裁剪时发布剩余范围，完全裁剪时移除对应语义节点。关闭模态时，优先将焦点还给仍可操作的原控件，否则选择另一个可操作控件。`view.rect(name)` 仍返回布局计划中的矩形。

### 浏览器复跑

先构建工作区，再运行：

```text
node examples/play/verify-ui.mjs <Playwright index.mjs 绝对路径> <新建输出目录绝对路径> <Chromium 可执行文件绝对路径>
```

Windows Chromium 157 软件 WebGL2 复现了初始位置 (620, 430, 120, 42)。修复后，左移得到 (545, 430, 120, 42)，部分裁剪时语义和投影都报告 (555, 415, 97.5, 12)，完全裁剪后不再发布。建筑列表测得滚轮位置 62、触屏拖动位置 54、Tab 自动滚入时位置 48、列表缩短后位置 0。本轮浏览器注入了输入，并检查了供辅助技术读取的投影 DOM。真实读屏播报和真人手指仍需设备验收。

## 大多数界面都需要的部件

| 调用 | 是什么 |
| --- | --- |
| `await game.confirm(question, { yes, no, title })` | 显示在所有东西之上的提问，用它的按钮回答，也可以用 Enter、空格或手柄 A 回答“是”，用 Escape 或 B 回答“否”。一个问题打开时提出的其他问题会排队等待。打开期间 `game.asking` 为真，`update` 可以借此暂停游戏逻辑 |
| `game.hints(list)` | 安全区底部的一条提示栏。每条提示是 `{ action, key, pad, touch }`，按玩家最近使用的设备 `game.device` 显示：键盘或鼠标显示 `Space Jump`，手柄显示 `A Jump`，手指显示 `touch` 的文字；在触屏上，没有 `touch` 的提示不显示。`shown` 是当前显示的内容；另有 `set(list)` 和 `dispose()` |
| `await game.loading(tasks, { label, atOnce })` | 在所有东西之上显示 `Loading 2 / 5` 和进度条，直到所有 promise（或返回 promise 的函数）完成；函数每次最多运行 `atOnce` 个（默认 4 个）。按顺序返回结果；有一个失败就关闭并抛出 |
| `game.badges` | 沿路径累加的红点：`set('mail/system', 3)` 之后 `count('mail')` 也是 3。另有 `has`、`clear(path)`、`paths()`、`onChange`。重新开始时清空。`badge` 绑定会在部件右上角画出红点，`view.badge(name)` 可以读取它 |
| `game.compact(n, { locale, digits })` | `999`、`12.3K`、`4.5M`；`locale: 'zh'` 时为 `9999`、`1.2万`、`3.4亿`。截断而不是四舍五入，所以 9999 是 `9.9K` 而不是 `10K`。不给时按页面的语言 |
| `game.request(send)` | 按钮发出的请求，同一时间只发一个。请求未返回时再次 `run()` 得到的是同一个 promise。`busy`、`result` 和 `error` 可以绑定到按钮的 `disabled` 和文字上；失败保存在 `error` 里，不会抛出 |

`createBadges`、`formatCompact`、`createRequest` 和 `keyCap` 也从 `@egret/engine/web/view` 导出，供不用 play 的代码使用。

## 测试与辅助技术

给 `play` 一棵语义树，即来自 `@egret/engine/ui/semantics` 的 `semantics: createUiSemantics()`，每个视图都会把自己加进去。视图的 `label` 成为一个组，模态时成为对话框。每个有名字的部件成为对应的角色：组、文字、按钮、进度条或开关。语义树在每帧结束时发布。这样 [UI 测试器](ui-testing.md)就能按名字按下 `'Shop / Buy 60'`、读取 `state('Sound').checked`。按钮不可用或有模态对话框挡住时，测试器会像玩家一样被拒绝。`@egret/engine/web/semantics` 把同一棵树提供给读屏软件。

## 检查了什么

`tests/ui-view.test.mjs` 在 Node 里规划视图。它检查：

- 自由面板里的锚点、偏移、比例和填充；
- 行和列的固定尺寸与填充、间距、内边距、`align` 和 `justify`；
- 竖屏部件和两种区域；
- 每一种拒绝，以及错误里指出的位置。

`examples/play/verify-views.mjs` 在无界面 Chromium（软件 WebGL2）里用 `game.show` 显示一个商店。它检查：

- 在规划给出的按钮位置读取页面颜色：可用时是皮肤的蓝色，不可用时是灰色；
- 数字滚动着减少；
- 不可用的按钮拒绝鼠标，也拒绝测试器；
- 用鼠标点击开关；
- 模态对话框接住本该点到商店上的点击，并拒绝按名字按它后面的控件；
- 窗口转成竖屏后，用同样的绑定换成竖屏部件，并能点击按钮的新位置。

`tests/ui-view-parts.test.mjs` 检查不需要绘制的部件：

- 累加的红点，以及变化时的通知；
- 两种语言的数字缩写；
- 第二次按下不会重复发出的请求；
- 按键的显示名称。

`examples/play/verify-view-parts.mjs` 在浏览器里检查其余部分：

- 在按钮右上角读到红点的红色；
- 双击只购买一次，期间按钮不可用；
- 两个问题分别用 Escape 和点击回答；
- 按键、鼠标点击和触摸之后提示栏的变化；
- 加载过程数到三。

没有在手机上运行，没有用读屏软件，没有接手柄，也没有在其他浏览器里运行。

## 设计说明

LumioGames 的 LGUI 用编辑器生成的数据搭建界面，按名字找到控件，再在代码里把数据绑定上去。这里保留这种分工，但数据由人或智能体直接写成普通对象，并做严格检查，拼错就报错，而不是留下一块空白。界面放在任何形状屏幕的安全区里，测试通过语义树找到它，它也能作为界面栈中的界面关闭。这里把它的设计作为参考研究过，没有用它的任何代码。
