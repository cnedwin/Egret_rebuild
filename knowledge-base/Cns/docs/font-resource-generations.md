# 字体资源与运行时字体集合

[English](../../en/docs/font-resource-generations.md) | 简体中文

本项是 M2.1/M3.2 的有界增量，将可复现的字体构建产物接入只读段落与既有 UI 事务。原有固定字体 Provider 继续可用。替换字体无需重新创建 Engine、资源管理器、渲染器或输入系统。

## 构建与加载

内容配方使用 egret.font 1.0.0，产物格式为 egret.font/1，设置为 {family, flavor}。flavor 为 truetype 或 opentype，源文件为独立 TTF 或 OTF 字体。产物保留原始字节与 SHA-256，构建键、来源声明、不可变缓存代际及 ProjectStore 采纳继续沿用既有机制。family 是明确的运行时别名，不会重命名字体文件。

构建器检查有界 SFNT 目录、必需表与声明格式，字形语义由原生解码器负责。这不是完整的不可信字体清洗器，也不提供可变字体轴 API、集合／WOFF 解码、字体转换或子集化。源字体必须具有实际使用与再分发权利。

单个字体最大 32 MiB，整次构建的源输入／输出预算仍为 64/128 MiB。明确的 font-sfnt/1 存储与浏览器传输配置准入较大字体，默认 PNG／元数据限制不变。浏览器字节源在交给无 DOM 的加载器前校验精确长度及 SHA-256。并行编码传输额度最大 64 MiB，每个文件按两倍大小预留；该额度不代表物理内存保证。

@egret/engine/resources 的 createFontContentLoader 使用已有 AssetManager 和真实 ManifestGroup／Scope。目录最多 128 项，每组 1–16 个唯一字体和唯一别名、合计最大 32 MiB；最多八个组及 64 MiB 逻辑源字节。就绪组的 getFonts 返回不可变描述；组及所属 Scope 有效时，copyBytes 返回独立副本。销毁 Scope 会取消待完成加载并退役该组。浏览器便利接口 createManifestFontContentLoader 提供 loader、source 以及异步 close。

## 不可变字体集合

@egret/engine/web/paragraph 的 createCanvasKitFontSetProvider 为段落缓存提供一个稳定 Provider。load(scope, loader, roots) 在受管字体加载与原生注册后返回新的不可变 ParagraphFontSet。key 是会话内的代际标识，不是持久化内容 ID。工程应保存 Manifest／构建身份，不能把此 key 序列化为可复用字体身份。

~~~ts
const fonts = createManifestFontContentLoader(engine, manifest, {baseUrl});
const provider = createCanvasKitFontSetProvider({canvasKit, buildIdentity});
const cache = createParagraphCache(engine.assets, {provider});
const fontScope = engine.createScope();
const set = await provider.load(fontScope, fonts.loader, fontResourceIds);
paragraph.setRequest({...request, fontFamilies: set.fontFamilies, fontSet: set.key});
await paragraph.prepare();
// Dispose only after no root needs to prepare more content with this set.
set.dispose();
await set.closed;
~~~

可选请求字段 fontSet 进入现有不可变缓存键。省略时保留旧固定字体请求与缓存键结构；旧 Provider 会在分配前拒绝显式字体集合请求。支持代际的 Provider 提供 fontSets 能力和 hasFontSet，缓存命中前及结果交付前均检查集合有效性。退役 key 永不复用。已借用栅格仍是有效的普通纹理租约，因此替换加载中或失败时，旧 UI 可以继续显示。

最多准入八个活动／退役中集合以及 64 MiB 按集合累计的逻辑字体字节。同一 Provider 内，身份与字节均相同的原生字型在活动集合之间共享所有权。最后一个固定 Provider 释放原生字型；未结算的 prepare 工作会推迟原生回收。该表不进行加载，也不独立持有资源租约；Engine 侧字体字节仍归既有资源管理器。原生内部缓存和物理 WASM 内存不属于这些逻辑计数。

固定版本 CanvasKit 的底层字体绑定接管分配的内存。适配器在写入字节前检查分配并拒绝零指针，避免便捷包装函数未经检查的写入损坏旧状态。没有该底层绑定的旧注入模块保留原有便利接口路径，不获得新增的分配检查保证。本项不修改随附运行时或字体字节。

## UI 发布与回收

使用候选集合准备脱离显示树的段落，通过既有 UI content 返回实测高度，再提交根节点。字体就绪不等于段落准备完成或画面发布。文字、几何与实测行／叶节点高度遵循既有 UI 事务；失败、取消或被更新替代的候选不能覆盖已提交内容。

每个 UiRoot 是独立发布域。只要某个根仍可能用该集合准备新行或内容，就必须保留集合，包括虚拟列表滚动。切换不是跨多个根的原子事务，也不承诺 GPU 回滚。取消使用候选的已有 Scope。关闭时销毁根与 Scope，关闭字体 Provider 和浏览器字节源，等待清理 Promise 并处理错误。

既有 paragraph-panel 示例接受生成的 fontConfig 查询参数。按钮替换文章字体，独立列表保留旧选择；后续普通 UI 操作可以采纳新集合。反复替换会释放未使用集合。默认示例继续使用固定字体模式，触摸及其他输入实现未改变。

装备样式范围使用该次 UI 修订已捕获的字体组。所选组包含 Noto Sans CJK SC 时保留命名选择，否则使用该组已注册的 fallback 栈。同一字体以另一个别名注册，不等于旧名字也已注册。未注册字体请求仍被拒绝，失败候选保留已提交内容；默认／固定字体夹具、Provider 准入、字体及既有字节限制不变。

## 验证与边界

先构建，再运行 node tools/content/author-font-example.mjs，将输出的 configPath 作为 fontConfig 附到 paragraph-panel URL。运行 node examples/paragraph-panel/verify-fonts.mjs <playwright-1.62.1-root> <new-output-directory> 可执行真实 Edge WebGL2／WebGPU 检查。采集器记录实际提供的输入身份、输出散列、反复替换、传输失败、取消、更新替代及清理。原生单元测试将真实字体的排版／栅格与保留的固定 Provider 对照；这是接入参考，不是独立字体算法参考。

[验证摘要](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/font-verification-summary.json) 将早期原生分配失败、修复和通过结果分别记录。较早摘要仍属于桌面证据。[2026-11-06 Android 组件报告](android-device-validation.md)单独记录有限手机观测及装备／字体接入修正。完整手机、IME、无障碍、文字／字体集合、物理内存和性能验收保持 OPEN。M1.2 的 10.3 ms 对 8 ms 目标仍未完成，M2.1 和 M3.2 的其他工作继续保留。

来源：既有 Noto／OFL 记录和 CanvasKit 来源声明不变。原生内存所有权依据固定版本 [Skia 绑定](https://github.com/google/skia/blob/e2def78fa232884d4aedcf3ad92d4a0dd673b898/modules/canvaskit/canvaskit_bindings.cpp#L3020)及[字体包装接口](https://github.com/google/skia/blob/e2def78fa232884d4aedcf3ad92d4a0dd673b898/modules/canvaskit/font.js#L145)确认。新增引擎组织、准入和生命周期逻辑为独立实现。
