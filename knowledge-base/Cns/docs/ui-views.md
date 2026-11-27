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

### 平板

短边不小于 600 CSS 像素的屏幕算平板（`@egret/engine/web/view` 的 `TABLET_SHORT_SIDE`）：iPad、大尺寸安卓平板、展开的折叠屏、桌面窗口。在平板上，屏幕宽大于高时视图用 `tablet` 部件，高大于宽时用 `tabletPortrait` 部件；没有这些部件时，竖着用 `portrait` 部件，否则用 `root`：

| 屏幕 | 用哪组部件（取视图有的第一个） |
| --- | --- |
| 手机，横 | `root` |
| 手机，竖 | `portrait`、`root` |
| 平板，横 | `tablet`、`root` |
| 平板，竖 | `tabletPortrait`、`portrait`、`root` |

每组部件的名字、种类以及显式页签角色都必须与 `root` 相同。`view.variant` 表示当前用的是哪组，每次变化都会重新创建视图并调用 `built(view)`。手机上一栏的内容，在平板上常常可以排成两栏。

### 视图按自己的尺寸显示

视图默认跟随游戏的缩放。给 `play` 传入 `uiScale: { min, max }`（单位是每单位多少 CSS 像素）后，视图保持在这个范围内，游戏画面不受影响：

- **1920 × 1080 的设计在 844 × 390 的手机上**，游戏每单位 0.36 像素。加上 `min: 0.75`，视图大约放大一倍，88 个单位高的按钮有 66 像素高。
- **1280 × 720 的设计在 1920 × 1080 的窗口里**，游戏每单位 1.5 像素。加上 `max: 1`，视图按游戏单位的 2/3 绘制，面板不会比设计时更大。

`game.uiScale` 是当前的倍数。视图在缩小了这么多的区域里规划，根节点再按这个倍数缩放，因此仍占屏幕上同样的位置，锚点和比例都照常生效。`rect(name)` 仍用视图自己的单位，`visibleRect(name)` 用舞台单位。对话框、菜单、提示、进度条和触屏控件保持游戏的缩放。

部件盖在游戏世界上的视图也必须保持游戏的缩放，否则 `uiScale` 一变，它就会偏离它盖着的东西。手牌上的点击区、棋盘格子上的点击区就是这样的部件。在这种视图的描述里写 `uiScale: false`，它就保持游戏的缩放，其他视图仍按自己的尺寸显示：

```js
g.show({ label: 'Hand', uiScale: false, root: { type: 'panel', children: tiles.map(tapAreaOver) } });
```

部件没有的字段、重复的名字、竖屏缺少的名字，会以 `UI_VIEW_INVALID` 或 `UI_VIEW_VARIANT_MISMATCH` 拒绝，并指出是哪个部件，例如 `root/3/0 (buy)`。绑定了视图里没有的名字，抛出 `UI_VIEW_BINDING_UNKNOWN`；部件不能接受的绑定，抛出 `UI_VIEW_BINDING_INVALID`。拼错的字段绝不会被当成什么都没有。

## 多行文字、带说明的按钮、图片和边框

给 `game.show` 传入 `paragraphCache`，文字部件和按钮说明便可以使用[段落 SDK](paragraph-layout-controls.md)。在视图描述中给每个段落部件指定高度。文字按规划宽度换行，超出部件高度的内容会被裁掉。按钮说明显示在标题下方，按按钮内部宽度换行。`lineHeight` 设置最小行高，`fontFamilies` 按顺序指定回退字体，`maxLines` 限制行数。只写 `text` 的按钮继续使用原来的单行标题。

段落可选的 `density` 表示每个舞台单位对应的栅格像素数，范围为 0.25–4（默认 `1`）。在高像素密度的屏幕上可设 `density: 2`，使说明文字更清晰，而不改变部件区域、换行宽度、字号、行高、指针范围或语义边界。该参数由应用显式设置，不随设备 DPR 自动变化：较高密度会消耗更多栅格内存，段落提供器原有的栅格限制和缓存字节预算仍然适用。

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
        paragraph: { ...paragraph, maxLines: 3, density: 2 }, height: 108, border: { color: 0x56caff, width: 2 } }
    ]
  }
}, { paragraphCache, bind: { build: { tap: () => buildWorkshop() } } });
```

每个部件都支持 `border: { color, width }`，边框沿部件内侧绘制。`image` 保持原始宽高比，在部件范围内居中。给图片同时填写 `name` 和 `label`，可以发布图片角色和可访问名称。关闭视图会释放它持有的段落和图片资源引用。共享的缓存和提供器由游戏管理，等使用它们的视图全部关闭后再释放。

同一游戏的各个 Play 视图共用一条声明式图片加载队列，每次最多启动四个加载。关闭或重建视图时，跳过属于该视图且尚未开始的请求。显式加载图片也占用同一浏览器预算。显式请求占满全部名额时，声明式加载仍可能报告并发限制错误。

游戏可以自行选择段落提供器和字体。浏览器配置见[段落面板示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.zh-CN.md)，其中可选的 CanvasKit 和 Noto 字体附有[来源和许可记录](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json)。普通的单行视图启动时无需加载这些文件。如果页面原生使用 import map，启用段落时应映射 `@egret/engine/paragraph` 和 `@egret/runtime/paragraph`，使用 CanvasKit 提供器时再映射 `@egret/engine/web/paragraph`。

```text
node tools/build.mjs
node --test tests/ui-view.test.mjs
node examples/play/verify-ui.mjs <Playwright index.mjs 绝对路径> <新的绝对输出目录> <Chromium 可执行文件绝对路径> rich
```

Chromium 157 软件 WebGL2 实测，两段文字都换成三行，基线间距为 24 个逻辑单位。取样像素确认了边框和 WebP 封面，按钮点击执行一次操作，关闭视图后段落缓存的借用计数回到零。另对相同内容的 1× 与 2× 段落进行配对检查，逻辑宽高、行范围、基线及行宽保持一致。2× 栅格具有更多像素，其 Bitmap 显示缩放为 0.5。这个用例的硬件 WebGPU、Safari、Firefox 和实体手机渲染仍待验证。

单行文字、按钮标题及开关支持 `fontFamily`、`fontWeight`（1–1000 的整数，覆盖默认粗体选择）与 `italic`。这几个字段不改变段落提供者和段落的字体回退列表。

## 绑定

| 键 | 用于 | 读作 |
| --- | --- | --- |
| `text` | text、button、toggle | 文字 |
| `pick`、`format`、`roll` | text、button | 一个数字、它的文字（不给时取整），以及滚动到新数字所用的秒数 |
| `value` | bar | 0 到 1 |
| `checked` | toggle | 开或关 |
| `selected` | 带 `role: 'tab'` 的 button | 语义选中状态，与绘制颜色相互独立 |
| `disabled` | button、toggle、可操作的 panel | 禁用，按下无效 |
| `visible` | 所有部件 | 连同里面的部件一起隐藏 |
| `src` | image | 最新图片地址，或 undefined 清除图片 |
| `color` | text、button、bar、panel | 绘制的颜色 |
| `tap` | button、toggle、panel | 按下时做什么，参数是状态和激活信息 |
| `tapTargetOnly` | button、toggle、panel | 只响应直接点中自身的操作，不响应从子部件冒泡的指针点击 |
| `label` | 除 space 外的命名部件 | 独立于绘制文字的当前无障碍名称 |
| `pointerOnly` | panel | 布尔值；设为 `true` 时必须绑定 `tap`，该面板的操作只响应鼠标和触摸 |

绑定了 `tap` 的面板通常也参与键盘焦点和激活。当绑定同时设置 `pointerOnly: true` 时，面板仍响应指针点击，但不会抢占键盘焦点。面板自身的操作不参与 Tab、手柄导航和语义激活。面板仍是语义分组，其子项保留各自的交互和语义状态。该选项仅适用于面板。例如，用来拦住点击的装饰面板可以绑定 `paper: { pointerOnly: true, tap: () => {} }`。

使用 `tap: (state, activation) => { ... }` 时，第二个参数带有 `source`（mouse、touch、pen、keyboard、semantic 或 gamepad）、`target` 和 `currentTarget`（已知时为部件名称），以及 `isTarget`。指针激活还提供 `pointerId`、`stageX`、`stageY`，当变换可逆时也提供当前部件局部坐标 `localX`、`localY`；其他来源没有指针坐标。指针点击默认仍会从命中部件向祖先冒泡；点击处理函数内调用 `activation.stopPropagation()` 可阻止继续冒泡，也可以在只处理自身点击的祖先绑定 `tapTargetOnly: true`。现有只接受状态参数的函数行为不变。键盘、手柄和语义激活只针对一个部件。

绑定了非仅指针 tap 的命名面板可以声明 `role: 'button'`，作为一个无障碍控件，其绘制子部件不进入焦点与语义树。默认面板仍是分组。装饰部件设置 `semantic: false` 可以将其子树移出语义与焦点（指针输入不变）。动态 `label` 绑定优先提供无障碍名称；返回空白时回退到默认名称。

绑定函数抛出的错误会让游戏停下，和 `update` 抛出的一样。

### 原生页签选中状态

将命名语义面板声明为 `role: 'tablist'`，下面使用带 `role: 'tab'` 的命名按钮。中间可以有不命名的布局面板，但最近的语义祖先必须是该 tablist。tablist 仅作为结构分组，操作和禁用状态绑定到各个 tab，而不是 tablist 本身。不声明页签角色的按钮仍是普通按钮。

```js
const state = { page: 'offers' };
game.show({ root: { type: 'panel', name: 'pages', role: 'tablist', layout: 'row',
  label: '集市分页', height: 48, gap: 8, children: [
    { type: 'button', name: 'offers', text: '货架', role: 'tab', width: 110 },
    { type: 'button', name: 'relics', text: '法宝', role: 'tab', width: 110 }
  ] } }, { state, bind: {
  offers: { selected: s => s.page === 'offers', tap: s => { s.page = 'offers'; } },
  relics: { selected: s => s.page === 'relics', tap: s => { s.page = 'relics'; } }
} });
```

语义树及浏览器语义投影会提供 `tablist`、`tab` 和当前为 true 或 false 的 `selected` 状态（浏览器中的 `aria-selected`）。描述中没有填写 `selected: true` 时，页签初始未选中；使用 `selected` 绑定时改为读取当前状态。选中不会改动标签或视觉样式，需要选中外观时可绑定 `color`。页签复用按钮原有的指针、键盘焦点与激活、手柄及语义测试器行为，例如 `tester.press('tab:法宝')`。分页内容和选择逻辑仍由游戏管理；这里不附加自动切换、互斥选择、tab panel 或独立的方向键导航模式。同一部件在各种屏幕适配方案中须保持相同的页签角色。

## 有稳定键的列表与可变图片

行囊、手牌或集市的成员变化时，可调用 `view.replaceChildren(panelName, rows, bind?)`。声明一个有名字的面板（必要时设为纵向滚动），每个直接子行都使用稳定的名字。只在成员或静态描述变化时调用，不必每帧重建列表；数值绑定仍然每帧跟随状态。

```js
const bag = game.show({ root: { type: 'panel', name: 'list', scroll: 'vertical',
  width: 340, height: 280, layout: 'column', gap: 6, children: [] } }, { state });
function showItems() {
  const rows = state.items.map(item => ({ type: 'panel', name: 'item_' + item.id,
    role: 'button', card: true, height: 54, layout: 'row', children: [
      { type: 'image', name: 'icon_' + item.id, src: '/art/item-placeholder.webp', width: 48 },
      { type: 'text', name: 'name_' + item.id, text: '物品', width: 'fill' }
    ] }));
  const bind = {};
  for (const { id } of state.items) {
    const current = s => s.items.find(x => x.id === id);
    bind['item_' + id] = { label: s => current(s).name, tap: s => inspectItem(s, id) };
    bind['icon_' + id] = { src: s => current(s).icon };
    bind['name_' + id] = { text: s => current(s).name };
  }
  bag.replaceChildren('list', rows, bind);
}
```

名字必须在整个视图唯一，请用稳定且合法的标识，而不是物品的下标。直接子行的名字是键。某个键保留、静态描述和绑定种类不变时，整行及其子部件都保留精灵和资源借用；静态字段或绑定种类变化时只重建该行。数量、名称、图标或可用性变化应使用值绑定。描述应视作不可变数据。行按给出的数组顺序排列。传入绑定表时只替换本次子行的绑定，省略该参数则保留未消失名字的旧绑定。不能借此绑定该面板以外的名字。

外围面板、滚动句柄和其他控件保持不变。滚动偏移限制在新的内容长度内；保留的焦点如果移出窗口会重新揭示，被移除的焦点先向后、再向前寻找可用控件。语义树保留外围视图与其他对话框的顺序。移除行会释放它持有的图片、段落、文字和输入节点；错误的描述或语义容量拒绝不会破坏原有行。动态更新不调用 `built`，视图首次构建或切换横竖屏变体时仍调用该回调，回调可以在挂载语义树前填充列表。值绑定不得重入同一视图的刷新或行替换。应用绑定回调抛出的运行时异常仍走既有错误路径；已经接受的结构会完成布局和焦点调整，并不会回滚。两个变体都存在时，同名面板必须拥有相同的后代名字，替换行同时用于两种变体；横竖屏原有重建契约不变。

这是按键保留身份的实体化列表，**不是虚拟列表**：视图部件数量、深度和语义树容量限制仍有效。很大的列表应使用底层虚拟列表或自行分页。

有名字的图片可绑定 `src: state => url`（返回 `undefined` 或空字符串清除图片）。旧图在新图完成前仍显示，同一个地址不会随着绑定刷新而重复加载。新地址到来时跳过尚未开始的旧请求；已开始的请求如果随后完成，其过期结果被释放而不覆盖最新图。共用四任务队列仍有界。不保证能够取消浏览器正在进行的解码；当前请求失败仍走既有视图错误路径。

浏览器复跑：`node examples/play/verify-ui.mjs <Playwright index.mjs> <新的输出目录> <Chromium 可执行文件> collections`。Chromium 软件 WebGL2 检查 30 行列表、从中间移除及重排、保留精灵与语义 ID、滚动和焦点、重复名字与语义容量拒绝、竖屏重建、模态顺序，实际延迟 PNG 响应在新图之后到达，以及四个任务都在进行时过期的排队 URL 从未发起请求。另一个 `rich` 用例在保留外围面板的同时删除子行，段落缓存借用从 2 降为 0。这一用例尚未覆盖实体手指操作、辅助技术软件与其他浏览器。

## 皮肤

没有自带颜色的部件按 `DEFAULT_VIEW_SKIN` 绘制：深灰蓝卡片上的白字、蓝色按钮、不可用时为灰色、进度条和开关用绿色强调色、圆角 10。在描述里写 `skin: { button: 0xe11d48 }`，只改它指定的那一项。

## 视图

`game.show` 返回视图：

- `get(name)` 是某个部件的精灵，可以给它加[手势](gestures.md)、往里加东西或做缓动。
- `rect(name)` 是游戏设计单位下声明的布局矩形，不是滚动或变换后的屏幕位置。`visibleRect(name)` 返回逻辑 Stage 单位下经过变换、祖先视口与屏幕裁剪后的可见矩形；隐藏或完全裁掉时为 `undefined`。`fit: 'expand'` 下设计原点可能与 Stage 原点不同。`shows(name)` 表示它当前是否显示。
- `textReady(name)` 返回当前单行文字版本的就绪 Promise（按钮只包括标题）；其他部件返回 `undefined`。换字或重建后应重新读取。文字版本就绪不代表图片、段落或角标都已绘制。被替换的未完成文字版本可能以 `AbortError` 拒绝。原有 `built(view)` 仍表示结构已建立。
- `show()`、`hide()`、`close()` 和 `refresh()`。
- `focus(name)` 请求视图的原生焦点，返回请求是否成功，必要时将目标滚入视口。视图被覆盖或关闭，或目标隐藏、禁用、仅指针响应、无法滚入焦点范围时，返回 `false`。在活动视图中使用未知名称会被拒绝，并报告 `UI_VIEW_NAME_UNKNOWN`。
- `focused` 是该视图当前持有有效焦点的部件声明名称；没有焦点时为 `undefined`。

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

滚动句柄提供 `offset`、`maximum`、`scrollTo`、`scrollBy` 和 `page(-1 | 1)`。刷新绑定会保留此前的滚动位置，内容缩短时将位置限制在可用范围内。Tab 和 Shift+Tab 可让下一项或上一项滚入视口。完全被裁掉的控件只有重新露出，才可被测试器或辅助技术直接操作。即使祖先节点有旋转，手指沿视口本地纵轴拖动也能滚动，并且不会误按列表项。滚轮推动列表时由视图消费，此时 `game.pointer.wheel` 不会再收到同一事件。迁移旧界面时，每个面板保留一个滚动控制器。

## 可交互区域

语义树按父面板的实际变换和裁剪发布舞台坐标。局部裁剪时发布剩余范围，完全裁剪时移除对应语义节点。关闭模态时，优先将焦点还给仍可操作的原控件，否则选择另一个可操作控件。`view.rect(name)` 仍返回布局计划中的矩形。

### 浏览器复跑

先构建工作区，再运行：

```text
node examples/play/verify-ui.mjs <Playwright index.mjs 绝对路径> <新建输出目录绝对路径> <Chromium 可执行文件绝对路径>
```

Windows Chromium 157 软件 WebGL2 复现了初始位置 (620, 430, 120, 42)。修复后，左移得到 (545, 430, 120, 42)，部分裁剪时语义和投影都报告 (555, 415, 97.5, 12)，完全裁剪后不再发布。建筑列表测得滚轮位置 62、触屏拖动位置 54、Tab 自动滚入时位置 48、列表缩短后位置 0。本轮浏览器注入了输入，并检查了供辅助技术读取的投影 DOM。真实读屏播报和真人手指仍需设备验收。

## 密集菜单和手柄焦点

用同一个 `text` 绑定提供控件画面上的文字和可访问名称。视图或其显示祖先隐藏时，Play 会暂停标签的光栅准备。视图重新显示时会准备最新文案。隐藏页可以保留业务状态，同时释放借用的文字纹理。

`game.browser.getLabelStatus()` 提供正在准备、排队、被预算拒绝、释放的光栅数量和缓存的逻辑占用。可复用入口与仍被借用的纹理代分开计数。直接用 `game.browser.createLabel()` 创建的标签可在隐藏时调用 `setRasterActive(false)`。标签处于活动状态时，`ready` 会报告准备失败。

默认缓存保留 32 个可复用入口，已退役和当前的纹理代合计最多 64 个，且受字节预算限制。多页集市可先隐藏旧页再显示新页。直接创建的活动标签如果在待处理任务结束后仍超预算，`ready` 会拒绝并报告 `TEXT_CACHE_BUDGET`。释放或暂停闲置标签后，可用 `label.set({})` 重试。关闭页面会归还标签借用的资源，缓存中的可复用项可保留到游戏关闭。

Tab 和 Shift+Tab 在画布中移动可见焦点，Enter 和空格激活当前控件。模态关闭前独占焦点，禁用控件会被跳过。在 `game.show` 的选项中设置 `initialFocus: 'continue'`，可按名称选择模态打开时的焦点。这个选项仅用于模态，名称必须对应可操作且非仅指针响应的部件。未知名称、不支持焦点的部件类型或在非模态视图中使用该选项会被拒绝，并报告 `UI_VIEW_BINDING_INVALID`。模态会尝试将目标滚入可滚动视口。若指定部件当前隐藏、禁用或无法滚入焦点范围，则按原规则选择首个可获得焦点的部件。关闭模态后还原此前仍有效的焦点。最前面的模态也接收标准手柄的方向键和 A。非模态菜单可设置 `gamepad: true` 接管这些按键，普通非模态视图会把按键留给玩法。

```js
function openPauseMenu(game, pauseView) {
  game.pause();
  const resume = view => {
    view.close();
    game.resume();
  };
  const menu = game.show(pauseView, {
    initialFocus: 'continue',
    dismiss: resume, // Escape 或手柄 B
    resume,          // 暂停后新按下 Start
    bind: { continue: { tap: () => resume(menu) } }
  });
  return menu;
}
```

视图描述需要设为模态，并有一个名为 `continue` 的按钮。手柄按声明顺序向前或向后移动焦点，新焦点在滚动区外时会进入视口。玩法暂停期间，菜单仍接收输入。按住 Start 只产生一次按下边沿，回调恢复玩法后也一样。

先运行 `node tools/build.mjs`，再运行 `node examples/play/verify-market-ui.mjs <Playwright index.mjs 绝对路径> <新建绝对输出目录> <Chromium 可执行文件绝对路径>`。同次运行覆盖 390 × 844 集市密集标签，以及键盘加模拟标准手柄的模态菜单。物理手柄单独验收。

Windows Chromium 157 软件 WebGL2 上，原引擎的首页绘出了 48 个标签，立即切到下一页后只绘出 16 个。新的复现覆盖同样的容量压力，并逐格取样画面。两个页面和三次快速改价后都绘出了 48 个标签，也发布了 48 个对应名称。切页释放了旧页的 48 个借用，关闭视图后活跃借用归零。单独的饱和对照接纳了 64 个标签，报告一次拒绝，释放后重试成功。

Galaxy Z Fold7（Android 17、Chrome 157、Adreno 830）分别通过 WebGL2 和 WebGPU 的功能验收。两端均绘出 48 个标签，「下一波」各触发一次。测试页限定在 390 × 844 的 CSS 视口，通过 Chrome DevTools Protocol 注入触摸。实体手柄、真人触摸和帧性能单独验收。

## 大多数界面都需要的部件

| 调用 | 是什么 |
| --- | --- |
| `await game.confirm(question, { yes, no, title, skin, noColor })` | 模态提问。Enter、空格和手柄 A 激活当前焦点按钮，Escape 和 B 取消。打开期间提出的其他问题会排队等待。`game.asking` 此时为真，`update` 可以借此暂停游戏逻辑 |
| `game.hints(list)` | 安全区底部的一条提示栏。每条提示是 `{ action, key, pad, touch }`，按玩家最近使用的设备 `game.device` 显示：键盘或鼠标显示 `Space Jump`，手柄显示 `A Jump`，手指显示 `touch` 的文字；在触屏上，没有 `touch` 的提示不显示。`shown` 是当前显示的内容；另有 `set(list)` 和 `dispose()` |
| `await game.loading(tasks, { label, atOnce })` | 在所有东西之上显示 `Loading 2 / 5` 和进度条，直到所有 promise（或返回 promise 的函数）完成；函数每次最多运行 `atOnce` 个（默认 4 个）。按顺序返回结果；有一个失败就关闭并抛出 |
| `game.badges` | 沿路径累加的红点：`set('mail/system', 3)` 之后 `count('mail')` 也是 3。另有 `has`、`clear(path)`、`paths()`、`onChange`。重新开始时清空。`badge` 绑定会在部件右上角画出红点，`view.badge(name)` 可以读取它 |
| `game.compact(n, { locale, digits })` | `999`、`12.3K`、`4.5M`；`locale: 'zh'` 时为 `9999`、`1.2万`、`3.4亿`。截断而不是四舍五入，所以 9999 是 `9.9K` 而不是 `10K`。不给时按页面的语言 |
| `game.request(send)` | 按钮发出的请求，同一时间只发一个。请求未返回时再次 `run()` 得到的是同一个 promise。`busy`、`result` 和 `error` 可以绑定到按钮的 `disabled` 和文字上；失败保存在 `error` 里，不会抛出 |

确认框用实际绘制字体测量问题、可选标题和两个按钮标签。过长单词以及中日韩文本会换行；当空间允许且有帮助时，两个按钮改成竖排，取消在前。问题及标题的完整高度放不下时，在原生垂直滚动区中展示；两个操作按钮留在安全区内。确认框遵循 `uiScale`，有空间时保留原有短对话几何，并尽量让两个操作按钮的宽、高都至少达到 44 CSS 像素。宽度最多 440 个视图单位，不会超过可用安全区；若屏幕物理尺寸过小，或任意长的按钮文字在横排和竖排中均放不下，绘制标签会缩略；只有连一个字都放不下时才不绘制文字，仍保留完整语义名称。屏幕尺寸变化时，当前问题会重新布局而不会自行回答，并在适用时保留当前焦点及滚动位置。每段输入文字最多 8192 个代码单元，与文字缓存一致。

```js
const accept = await game.confirm('出售这件稀有法宝，得到二十八颗珍珠？', {
  yes: '确认出售法宝并收取珍珠',
  no: '保留法宝在行囊中',
  skin: { panel: 0x153329, button: 0x92352a, buttonText: 0xffe8bd, radius: 6 },
  noColor: 0x245b48
});
```

`skin` 与 `game.show` 的部分 `ViewSkin` 相同（此处 `size` 范围为 1 到 512）；`noColor` 覆盖原有石板灰色取消按钮，确定按钮使用 `skin.button`。提出问题时立即快照选项和文字；无效主题、文字或 RGB 颜色会在加入队列前以 `UI_VIEW_BINDING_INVALID` 拒绝。


`createBadges`、`formatCompact`、`createRequest` 和 `keyCap` 也从 `@egret/engine/web/view` 导出，供不用 play 的代码使用。

## 测试与辅助技术

给 `play` 一棵语义树，即来自 `@egret/engine/ui/semantics` 的 `semantics: createUiSemantics()`，每个视图都会把自己加进去。视图的 `label` 成为一个组，模态时成为对话框。每个有名字的部件成为对应的角色：组、文字、按钮、页签组、页签、进度条或开关。语义树在每帧结束时发布。这样 [UI 测试器](ui-testing.md)就能按名字按下 `'Shop / Buy 60'`、读取 `state('Sound').checked`。按钮不可用或有模态对话框挡住时，测试器会像玩家一样被拒绝。`@egret/engine/web/semantics` 把同一棵树提供给读屏软件。

命名的非交互文字部件在有效无障碍名称为空或只有空白字符时，不进入发布的语义树。其布局和显示对象不变，文字或显式无障碍名称恢复为非空时，同一节点重新出现。即使绘制文字为空，显式非空名称仍有意义。交互控件仍须具有合法的无障碍名称。

## 检查了什么

`tests/ui-view.test.mjs` 在 Node 里规划视图。它检查：

- 自由面板里的锚点、偏移、比例和填充；
- 一个带 `portrait` 和 `tablet` 部件的视图，窗口依次改为 844 × 390、1024 × 768、768 × 1024 和 390 × 844，分别用了 `root`、`tablet`、`portrait` 和 `portrait`，共创建三次；
- 1280 × 720 的游戏加 `uiScale: { min: 0.75, max: 1 }` 后，368 × 80 单位的按钮在 1920 × 1080 窗口里是 368 × 80 CSS 像素，在 640 × 360 窗口里是 276 × 60，两次都居中，点击能按下。旁边一个 `uiScale: false` 的视图让 120 × 80 单位的点击区保持游戏的缩放，依次是 180 × 120 和 60 × 40 CSS 像素，始终正好在放置的位置上，点击能按下；
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

上述原软件渲染测试未覆盖手机、读屏、实体手柄及其他浏览器。后续真机补验见下文。

## 设计说明

LumioGames 的 LGUI 用编辑器生成的数据搭建界面，按名字找到控件，再在代码里把数据绑定上去。这里保留这种分工，但数据由人或智能体直接写成普通对象，并做严格检查，拼错就报错，而不是留下一块空白。界面放在任何形状屏幕的安全区里，测试通过语义树找到它，它也能作为界面栈中的界面关闭。这里把它的设计作为参考研究过，没有用它的任何代码。

## 11 月 27 日真机补验

11 月 27 日实测：Fold7 双后端验收命名视图、禁用、模态确认、重复点击单次请求、角标/进度及脚本平板部件切换。未修改的桌面完整视图测试保留一条焦点 outline 断言失败，独立语义诊断通过。真人无障碍与实际设备姿态仍待测。 [真机观测及剩余范围](november-27-claude-hardware.md). 另在独立重建的 #516 上确认双终端双后端关闭视图独立缩放时，覆盖层保持世界坐标及点击。
