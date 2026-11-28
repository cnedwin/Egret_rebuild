# 只读段落 SDK

[English](../../en/docs/readonly-paragraph-sdk.md) | 简体中文

可选的只读段落 profile 按逻辑宽度自动换行，并把实际排版高度提供给普通 UI 叶节点与虚拟行。同一份准备结果提供显示图像和行指标，复用既有 Engine、Scope、AssetManager 与纹理租约；完整 M3.2 继续 OPEN。

## 对齐、行数限制与提供器能力

请求可选字段为 `textAlign` 和 `maxLines`，限行结果增加 `truncated`。能力显式准入，CRLF／CR 保留作者 UTF-16 坐标；必需省略号放不下时在发布前拒绝。见[完整布局契约](paragraph-layout-controls.md)。

## 公开入口与所有权

| 入口 | 公开能力 |
| --- | --- |
| `@egret/engine/paragraph` | `createParagraphCache(assets, options)`、`createParagraph(engine, scope, cache)` 及段落类型 |
| `@egret/engine/web/paragraph` | `createCanvasKitParagraphProvider(options)` 及 host/module/font 类型；不需要 WebAssembly 的 `createCanvasParagraphProvider(options)`；`chooseParagraphProvider(options)` |
| `@egret/engine/ui` | 既有 `createUiRoot`，新增 `UiLeafContent`、`UiLeafPrepareContext` |

默认 Engine 入口不加载段落 provider、Wasm 或字体。runtime 段落代码不依赖 DOM/Node。web adapter 接收已初始化的 CanvasKit 模块和明确的字体字节，不负责模块加载、网络请求或系统字体发现。

**一个资源管理器只有一个段落缓存。** 每个 Engine 只创建一次，把同一个缓存传给所有段落、UI 叶子和文本编辑器。在同一个 `engine.assets` 上第二次调用 `createParagraphCache` 会以 `PARAGRAPH_CACHE_ALREADY_CREATED` 拒绝，错误信息会说明原因。标签用的文本缓存也一样（`TEXT_CACHE_ALREADY_CREATED`）；浏览器游戏会为它的标签创建那个缓存。

真实 Engine 只接纳自己的 Scope 和已注册缓存。同一个真实 `engine.assets` 可同时拥有一个固定显式行缓存和一个固定段落缓存；每种 profile 在每个 manager 上只有一次生命周期。另建 AssetManager 不会取得 Engine 权限，显示父子关系也不转移资源所有权。

应用拥有 provider 及其后端模块。provider 快照注册字体字节，并从声明的 build/module 与字体身份构建自身身份。同步 adapter 不独立验证调用者声明的哈希。provider 的字体集合保持不变；不同注册字体集合需要新的 provider，以及用于段落缓存的新 Engine/AssetManager 生命周期。缓存借用 provider，不负责销毁它。应用持有的准备任务及缓存／显示借用全部退役后，由 host 显式销毁 provider。Engine 关闭负责 Scope 和 AssetManager 清理；原生模块／realm 生命周期仍由 host 负责。

## CanvasKit 段落的彩色字体

对于独立 TTF 和 OTF 文件，固定字体提供器和从资源清单加载字体集合的提供器，都会在遇到 OpenType `SVG ` 表或版本高于 0 的 `COLR` 表时返回 `PARAGRAPH_FONT_COLOR_UNSUPPORTED`。应用可以在加载可选字体时捕获这个错误，替换失败后继续使用上一套字体。在内置渲染器上，用作对照的 SVG 字形悄然变成了文字颜色的轮廓，而 COLRv0 字形正确使用了绿色调色板。位图表和普通轮廓字体继续交给现有解码器处理。

直接接收字节的接口还会检查 TrueType 字体集合中实际打开的第一个字体，以及 WOFF1 可见的表目录。它可以识别 WOFF1 中的 SVG 表，也可以读取未压缩的 COLR 版本。WOFF1 中压缩的 COLR、WOFF2 及其他无法直接读取表信息的封装继续沿用宿主解码行为。如果应用依赖这个准入检查，请提供独立 TTF 或 OTF。通用字体资源导入器仍可供其他渲染器使用。[OpenType 彩色图层](https://learn.microsoft.com/en-us/typography/opentype/spec/colr) · [OpenType SVG 字形](https://learn.microsoft.com/en-us/typography/opentype/spec/svg)

## 准备并显示段落

应用先初始化 `hostCanvasKit`，再加载条目形如 `{ family, data: Uint8Array, identity }` 的 `fonts`。[段落面板示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.zh-CN.md) 校验字体字节并提供随附 build 身份。

```js
import { createParagraph, createParagraphCache } from '@egret/engine/paragraph';
import { createCanvasKitParagraphProvider } from '@egret/engine/web/paragraph';

// engine、hostCanvasKit、buildIdentity 和 fonts 由应用提供并拥有。
const provider = createCanvasKitParagraphProvider({
  canvasKit: hostCanvasKit, buildIdentity, fonts,
});
const cache = createParagraphCache(engine.assets, { provider });
const scope = engine.createScope();
const paragraph = createParagraph(engine, scope, cache);
const request = {
  text: 'Text wraps to the available width. 段落按宽度换行。',
  width: 320,
  fontFamilies: fonts.map(font => font.family),
  fontSize: 20, locale: 'en', direction: 'ltr',
  fillColor: 0xffffff, density: 1,
};
paragraph.setRequest(request);
const metrics = await paragraph.prepare();
engine.stage.addChild(paragraph);
// metrics.width、metrics.height 和 metrics.lines 对应这次已提交结果。
```

兼容的无 runs 请求对整段使用一组字号、颜色、语言和基础方向，采用明确注册的 fallback 字体顺序，支持自动换行和可选的最小 `lineHeight`。字体自然 ascent/descent 与 leading 可能使实际行高超过请求的最小值。请求未注册字体或存在未解析字形时会拒绝。

`setRequest` 快照请求。`prepare()` 返回不可变的 `{ width, height, lines }`；每行提供 UTF-16 `start/end`、`baseline`、`ascent`、`descent`、`height` 和 `width`。`getStatus()` 区分目标／已提交版本和 pending 状态。请求及代次不变时复用已提交结果。替换失败或被新请求取代时，保持上一份已提交图像及指标。Scope 销毁会取消 pending demand 并退役显示租约，迟到结果不能恢复已关闭节点。

直接拥有准备后纹理租约的调用者也可使用 `cache.acquire(request, { signal })`，在显示退役时释放该租约。`invalidate()` 退役缓存代次，同时保持已借出图像有效；它不会自动替换所有可见段落。独立节点需再次调用 `prepare()`，UI 则使受影响内容失效或提交新版本。`getStatus()` 报告逻辑图像字节、条目、任务与调用者需求，不测量原生堆或物理内存。

## 按宽度准备 UI 内容

普通叶节点可提供 `content` 或同步 `measure` 回调，两者互斥。内容源提供非负安全整数 `revision` 和 `prepare({ scope, width, density, signal })`，同步或异步返回 `{ content: DisplayObjectContainer, measuredHeight }`。

```js
import { createUiRoot } from '@egret/engine/ui';

const textContent = {
  revision: 1,
  async prepare(context) {
    const node = createParagraph(engine, context.scope, cache);
    node.setRequest({ ...request, width: context.width, density: context.density });
    const metrics = await node.prepare();
    return { content: node, measuredHeight: metrics.height };
  },
};
const ui = createUiRoot({
  engine, scope: engine.createScope(), id: 'article',
  viewport: { width: 360, height: 600 }, density: 1,
  tree: {
    id: 'column', kind: 'column', explicitWidth: 360,
    crossAlign: 'stretch', gap: 12,
    children: [
      { id: 'body', kind: 'leaf', content: textContent },
      { id: 'footer', kind: 'leaf', explicitHeight: 8, fill: { color: 0x44ccaa } },
    ],
  },
});
ui.commit(await ui.prepare());
```

`context.width` 是计入 padding 和约束后的实际内部宽度。把该宽度传给段落，并返回 `metrics.height`；需要文字决定高度时，不设置叶节点显式高度。既有显式／最小／最大布局约束仍然生效。UI 准备等待所需的离树内容就绪，再以同一版本发布内容、兄弟节点几何和命中树。失败、过期或关闭时销毁新的暂存 Scope，在成功接纳替换前保持原已提交表现。同一内容源在版本、宽度和密度不变时复用，不再次准备内容；`invalidate(id, 'measure')` 强制重新准备。内容源版本变化通过 `setTree` 提交，单独修改闭包值不会使布局失效。

既有虚拟行通过 `bind` 使用相同的宽度／Scope／密度契约：

```js
async function bind(context) {
  const node = createParagraph(engine, context.scope, cache);
  node.setRequest({ ...request, text: context.value.text,
    width: context.width, density: context.density });
  const metrics = await node.prepare();
  return { content: node, measuredHeight: metrics.height };
}
```

记录保持稳定 key；内容变化时增加 `contentVersion`，并增加数据源 revision。既有高度 journal 把实测高度、行内容、命中几何及保留的顶部 key 滚动锚点一起提交。实测高度扩展有限可见窗口时，列表准备可能返回 `pending`；按既有 [UI 面板准备契约](ui-data-panel.md) 处理。

逻辑排版高度包括实际行指标及空行。栅格可能因带符号的墨迹边界及每边两像素抗锯齿 guard 超出该盒子。密度缩放像素，不改变逻辑行几何。不能把纹理像素高度当作行高，也不能从已绘制像素反推命中范围。

## 接纳限制

| 输入或资源 | 当前上限 |
| --- | --- |
| 源文本 | 良构 UTF-16，最多 8,192 code units |
| 逻辑宽度／字号 | 宽度 0.25–4,096；字号 1–512 |
| 可选最小行高／密度 | 行高 1–1,024；密度 0.25–4 |
| 字体／locale | 请求／注册字体均为 1–16；字体名最多 256 code units；locale 最多 64 |
| provider 字体／build 身份 | 各最多 512 code units；组合 provider 身份最多 8,192 |
| 注册原始字体字节 | 每个 CanvasKit provider 最多 32 MiB |
| 栅格 | 每边最多 4,096 像素，总量最多 1,048,576 像素 |
| 段落缓存条目／并发 provider 任务 | 默认 32/32；各可配置为 1–32 |
| 逻辑缓存／活动图像字节 | 默认 16 MiB；可配置为 4 字节–64 MiB |
| 调用者租约与 pending 调用者需求 | 合计最多 256 |

超限会拒绝任务，不暗中截断文字、选择系统字体或降低密度。已借出图像在退役前持续记账，可能阻止淘汰。图像字节上限约束受管图像记账，不包含全部 CPU/Wasm scratch、provider 字体、pending 原生分配或物理内存。空段／无墨迹的缓存结果使用有界透明图像资源。

## 可选资源、观察结果与剩余范围

示例的可选 runtime 为 **8,696,388 原始字节**，三个原始字体合计 **17,148,712 字节**，总计 **25,845,100 字节**。`source/icudtl.dat` 是已嵌入 Wasm 的重建输入，浏览器不单独加载。默认 SDK 导入不加载这些资源。原始字节数不证明压缩传输、启动、活动内存或性能。精确版本、哈希、patch、源码重建边界与保留的第三方／字体 notices 见 [vendor 说明](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/README.zh-CN.md) 和 [manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json)。

初始 SDK 桌面验证使用 Edge 156.0.4314.50、默认 headless 配置和 Playwright 1.62.1。WebGL2 与 WebGPU 各通过 13 项行为检查：换行及后续几何、字体／最小行高、密度不改变逻辑布局、静态复用、失败／待定／完成替换、取消后晚 settlement、滚动／命中，以及关闭后的图像与租约退役。实际请求的 161 个依赖路径（包含固定的 robust-predicates 虚拟别名）在捕获期间保持原身份。SDK／UI／T1 的针对性回归共 118 项通过。见[实际结果与截图](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-sdk/verification.json)；这些是有限功能观察，不是计时或独立字形／墨迹验收。

构建后，使用已安装的 Playwright 1.62.1 与 Edge，执行 `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>`。采集器对每个后端运行一次完整行为序列，输出目录必须是新目录。浏览器延迟用例在进入 native 前阻塞提供器，证明晚 settlement 不覆盖已提交版本，不证明运行中的 Wasm 可被抢占。密度为二时，不断言两个后端逐像素相同。原始失败观察保留，并在结果范围中说明。受保护 CI 与 PR/Main 交付仍是独立发布证据。

**最终行 L1／L2 已集成，并完成有限原生及浏览器验证。** 见[共享行契约与结果](paragraph-line-bidi.md)。完整 M3.2、独立 glyph/ink 参考、完整 glyph-cluster 映射、编辑／IME、手机／浏览器覆盖、性能、活动／物理内存验收及 OOM 恢复继续 OPEN。有界[样式范围](paragraph-styled-runs.md)及[字素选区／光标几何](paragraph-text-geometry.md)已有独立契约。首个 profile 不宣传自定义省略标记或垂直对齐、emoji/ZWJ、Indic 或可变字体／字体集合覆盖。历史 [私有 bidi 结果](paragraph-bidi-comparison.md) 保留原证据范围；采用这个有界的可选 SDK 不改写历史结果。

## 只读样式范围

可选[样式范围契约](paragraph-styled-runs.md)通过同一提供者、缓存和 UI 所有权增加有界字体族、字号与前景色范围。上文原单样式配置仍是兼容基线；链接的增量契约记录当前准入、整簇颜色与合成内容限制。

## 不需要 WebAssembly 的提供者

`createCanvasParagraphProvider(options)` 用画布的 2D 上下文排版和绘制。它不需要 WebAssembly，也不需要字体字节：它使用网页用 `FontFace`、或小游戏用 `wx.loadFont` 注册过的字体，按字体族名引用。它接收的请求、给出的度量和几何与 CanvasKit 提供者相同，能力为 `styledRuns`、`textAlign`、`textGeometry` 和 `maxLines`。

- `families` 列出请求可以使用的字体族。请求用了别的字体族，会以 `PARAGRAPH_FONT_NOT_REGISTERED` 拒绝。不给时接受任何字体族。
- `buildIdentity` 给这组字体命名，字体变了，提供者的标识也随之改变。
- `createCanvas` 返回一个能 `getContext('2d')` 的画布。默认用 `document.createElement('canvas')`，小游戏的适配器用 `wx.createCanvas()` 生成它。

它按 CanvasKit 的方式排版：

- 英文在空格处、`-` 和 `/` 之后断行。中文和日文在字与字之间断行。`，` 这类收尾标点不放在行首，`（` 这类开头标点不放在行尾。比一行还宽的单词在字母之间截断。
- 全角字符单独测量，与 CanvasKit 的排法相同。
- 给了 `lineHeight` 时，每行取这个高度，多出的空间平分到第一个字体族字体的上方和下方。不给时，一行的高度取该行实际用到的最高字体。
- 限行时，从最后一行末尾逐个去掉字符，直到后面放得下省略号。省略号用最后保留字符的字体，并由该字符的框一并覆盖。

从右到左的文字（`direction: 'rtl'`，或从右到左书写系统的字符）以 `PARAGRAPH_FEATURE_UNSUPPORTED` 拒绝，不会按错误的顺序画出来。

**与 CanvasKit 的对比。** `examples/paragraph-canvas/verify.mjs` 在无头 Chromium 里，用同样的 Noto Sans 和 Noto Sans CJK SC 字体，把同一段带样式的中英文段落分别交给两个提供者排版。共排三次：带最小行高、自然行高居中、限三行。2026 年 11 月 26 日，三组的行都相同，字符框和选区误差都在 0.000 px 以内，在每个字符上点中的位置也相同。手机上的画布可能只给 `measureText` 一个宽度。这时提供者会估计字体的上伸和下伸，行高可能与 CanvasKit 差几个像素。手机上没有运行过。

`chooseParagraphProvider(options)` 创建设备承受得起的提供者，返回 `{ backend, reason, provider, cause? }`：

```js
import { chooseParagraphProvider } from '@egret/engine/web/paragraph';

const { provider, backend, reason } = await chooseParagraphProvider({
  // 只有选中 CanvasKit 时才调用。
  loadCanvasKit: async () => ({ canvasKit: await CanvasKitInit({ locateFile }), fonts, buildIdentity }),
  canvas: { families: ['Noto Sans', 'Noto Sans CJK SC'] }
});
const cache = createParagraphCache(engine.assets, { provider });
```

- 没有 `WebAssembly` 全局、在微信小游戏里，或 `navigator.deviceMemory` 不超过 `lowMemory`（默认 2）时，给画布提供者。此时不调用 `loadCanvasKit`，模块和字体字节都不会下载。
- 否则加载 CanvasKit。加载或启动失败时，给画布提供者，`reason` 为 `'load-failed'`，错误放在 `cause` 里。
- `prefer: 'canvas'` 或 `prefer: 'canvaskit'` 直接指定。指名要 CanvasKit 时，失败会抛出。`device` 用已知的设备情况代替从全局对象读到的值。

使用画布提供者时，要在准备第一个段落之前注册好字体。

## 11 月 27 日真机补验

11 月 27 日实测：Windows 真实 WebGL2 以相同字体对照 Canvas 和 CanvasKit；Fold7 上不需要 WASM 的 Canvas provider 生成三行中英文段落。字体集合编辑 Node 测试通过，真实微信字体度量及宿主输入待验收。 [真机观测及剩余范围](november-27-claude-hardware.md).
