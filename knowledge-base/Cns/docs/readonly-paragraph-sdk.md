# 只读段落 SDK

[English](../../en/docs/readonly-paragraph-sdk.md) | 简体中文

可选的只读段落 profile 按逻辑宽度自动换行，并把实际排版高度提供给普通 UI 叶节点与虚拟行。同一份准备结果提供显示图像和行指标，复用既有 Engine、Scope、AssetManager 与纹理租约；完整 M3.2 继续 OPEN。

## 对齐、行数限制与提供器能力

请求可选字段为 `textAlign` 和 `maxLines`，限行结果增加 `truncated`。能力显式准入，CRLF／CR 保留作者 UTF-16 坐标；必需省略号放不下时在发布前拒绝。见[完整布局契约](paragraph-layout-controls.md)。

## 公开入口与所有权

| 入口 | 公开能力 |
| --- | --- |
| `@egret/engine/paragraph` | `createParagraphCache(assets, options)`、`createParagraph(engine, scope, cache)` 及段落类型 |
| `@egret/engine/web/paragraph` | `createCanvasKitParagraphProvider(options)` 及 host/module/font 类型 |
| `@egret/engine/ui` | 既有 `createUiRoot`，新增 `UiLeafContent`、`UiLeafPrepareContext` |

默认 Engine 入口不加载段落 provider、Wasm 或字体。runtime 段落代码不依赖 DOM/Node。web adapter 接收已初始化的 CanvasKit 模块和明确的字体字节，不负责模块加载、网络请求或系统字体发现。

真实 Engine 只接纳自己的 Scope 和已注册缓存。同一个真实 `engine.assets` 可同时拥有一个固定显式行缓存和一个固定段落缓存；每种 profile 在每个 manager 上只有一次生命周期。另建 AssetManager 不会取得 Engine 权限，显示父子关系也不转移资源所有权。

应用拥有 provider 及其后端模块。provider 快照注册字体字节，并从声明的 build/module 与字体身份构建自身身份。同步 adapter 不独立验证调用者声明的哈希。provider 的字体集合保持不变；不同注册字体集合需要新的 provider，以及用于段落缓存的新 Engine/AssetManager 生命周期。缓存借用 provider，不负责销毁它。应用持有的准备任务及缓存／显示借用全部退役后，由 host 显式销毁 provider。Engine 关闭负责 Scope 和 AssetManager 清理；原生模块／realm 生命周期仍由 host 负责。

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

首个 profile 对整段使用一组字号、颜色、语言和基础方向，采用明确注册的 fallback 字体顺序，支持自动换行和可选的最小 `lineHeight`。字体自然 ascent/descent 与 leading 可能使实际行高超过请求的最小值。请求未注册字体或存在未解析字形时会拒绝。

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

**最终行 L1／L2 已集成，并完成有限原生及浏览器验证。** 见[共享行契约与结果](paragraph-line-bidi.md)。完整 M3.2、独立 glyph/ink 参考、公开 glyph-cluster／选区／光标映射、编辑／IME、手机／浏览器覆盖、性能、活动／物理内存验收及 OOM 恢复继续 OPEN。首个 profile 不宣传属性分段、自定义省略标记或垂直对齐、emoji/ZWJ、Indic 或可变字体／字体集合覆盖。历史 [私有 bidi 结果](paragraph-bidi-comparison.md) 保留原证据范围；采用这个有界的可选 SDK 不改写历史结果。
