# 只读段落样式范围

[English](../../en/docs/paragraph-styled-runs.md) | 简体中文

可选段落 SDK 通过现有段落缓存和受管 UI 事务接受有界字体族、字号与前景色范围。这是 Issue #88 内的 M3.2 增量，不是新的文字引擎或编辑器。既有换行、最终行双向处理、对齐、行数限制与几何契约继续生效。

## 请求契约

可选字段 `runs: readonly ParagraphStyleRun[]` 最多包含 256 个按源顺序排列、互不重叠且非空的 UTF-16 `[start, end)` 范围，必须位于原始文本内，边界不得切开代理对或 CRLF。每个范围至少提供 `fontFamilies`、`fontSize`、`fillColor` 之一。未提供的字段分别继承段落默认值，范围之间的间隙使用默认值。重叠、乱序、空覆写或非法范围会明确拒绝，不自动排序或引入覆盖优先级。

```js
paragraph.setRequest({
  ...request, text: 'A larger title 中文', width: 240,
  runs: [
    { start: 2, end: 8, fontSize: 32, fillColor: 0xffaa66 },
    { start: 15, end: 17, fontFamilies: ['Noto Sans CJK SC'] },
  ],
  textGeometry: true,
});
const metrics = await paragraph.prepare();
// 普通 UI 叶节点使用同一 metrics.height 作为 measuredHeight。
```

源文本仍最多 8,192 个 UTF-16 单元。范围字号为 1–512；字体族列表为 1–16 个明确注册的名称；前景色为整数 RGB 0–0xffffff。语言、基础方向与最小行高仍属于整个段落。此次不增加字重、斜体、装饰线、背景、行内图片、编辑、选择输入或 IME 行为。

核心在排队前复制并深度冻结范围和字体族数组。未提供 runs 和空数组保留原请求形状与缓存键。合法非空范围进入现有请求身份，不新增缓存或资源所有者。非法输入不推进段落的期望修订。

## 完整原生排版与字形簇颜色

字体族和字号变化在同一个完整段落内形成原生 shaping 边界。适配器使用既有已初始化 CanvasKit 的 builder、TextStyle、pushStyle/pop，以及原有明确所有权的字体提供者，不独立排版文本片段、不估算字符宽度，也不叠加另一层文字绘制。

有效前景色一致时，包括只改变字体的请求，只需一次完整原生排版。有效颜色不一致时进行两次完整原生排版：第一遍仅带字体样式，处理全部源文本，不加入颜色边界和 maxLines；第二遍使用解析后的前景色与原行数限制完成最终段落。第一遍不提供公共几何或光栅像素。额外工作有界，不代表性能改善。

颜色不一致时，getShapedLines 返回实际绘制字形的段落绝对 UTF-8 源起点。适配器将其转换为排版缓冲区的 UTF-16 坐标，并沿用既有 CRLF 原始坐标映射。RTL 的末尾哨兵可能重复最小源起点，因此不把哨兵作为字形起点。范围切入已成形字形簇时，整簇使用逻辑源起点的颜色；例如 `office` 中从 `ffi` 内部开始的范围不会切开连字。原生字素几何可为光标细分连字，不能替代真实字形源起点。

无绘制的源间隙不能证明新增字形边界。颜色解析在此间隙延续前一个实际字形源颜色；硬换行保留其原始颜色，并重置这种延续。间隙本身没有前景像素。字体边界不变。推断的源末端不会作为原生簇事实公开；公共行、字素框、选择／光标查询和像素全部来自最终绘制的段落。

源排版阶段超过 65,536 次字形出现，或原生 offset 数组缺失、非法时会拒绝。标准 shaped-line 输出无法标识合成的可选连字符，因此包含 U+00AD 且有效颜色不一致的请求以 PARAGRAPH_FEATURE_UNSUPPORTED 拒绝。仅改变字体或有效颜色一致的范围保留原生 U+00AD 行为；无 runs 的旧请求保持原行为。

省略号是独立 shaping 的合成内容，其普通原生 offset 可能与源字形重叠，所以源排版阶段刻意不使用 maxLines。最终原生截断过程为固定 U+2026 标记选择解析后的样式，适配器不伪造标记的原始文本位置。既有标记放不下时拒绝、隐藏源几何和空白行规则均保持不变。

## 能力与所有权

提供者必须明确声明 `capabilities.styledRuns === true`。缓存只捕获一次该布尔值；不支持时在预留槽位或调用提供者之前拒绝非空范围。CanvasKit 适配器要求真实的 TextStyle、builder pushStyle/pop 和 shaped-line 端口，身份包含捕获的能力以及既有 build/font 声明。未注册字体和未解析字形继续明确拒绝。

结果仍由同一 Engine、Scope、AssetManager 与纹理租约持有。共享调用者、缓存失效、最新接受意图、取消和清理均保持原规则。等待、失败或过时的样式替换继续一起保留旧图像、指标和几何。UI 内容修订先准备离屏内容，再通过现有 prepare/commit 事务统一发布文本实测高度及后续布局；仅修改闭包中的 runs 数组不会自动使 UI 内容失效。

## 证据与边界

集中的公共行为和严格类型测试覆盖准入、不可变快照、能力捕获、缓存身份、失败／最新意图替换及最大范围数量。原生测试使用原始 Noto Sans、Noto Sans Arabic 和 Noto Sans CJK SC 资源，比较固定源期望、真实字形 ID／源起点／位置与行指标，并对 ffi、组合附标、多字节文本、双向文本、换行、无墨迹空格、字体变化、CRLF 和省略号进行直接原生明确分色对照。这些同后端参考验证适配器行为，不构成独立字形／墨迹正确性或完整 Unicode 验收。

构建后运行 `node examples/paragraph-geometry/verify-styles.mjs <playwright-root> <new-output-directory>`，在 WebGL2 和 WebGPU 上使用现有公共示例检查最终几何、真实样式像素、UI 高度、源替换、密度、拒绝／恢复、缓存复用和所有权归零。结果与先前失败记录在[有限范围汇总](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-geometry/styled-verification-summary.json)。此次没有新增或修改原生代码、字体字节、许可证或依赖。

独立文字参考、完整文字／字体覆盖、原生编辑／IME、实体手机、无障碍、OOM 恢复、物理／GPU 内存及性能仍为 OPEN。M1.2 正式结果 10.3 ms 对比 8 ms 的缺口不变。完整 M3.2 与受保护 CI／PR／Main 交付仍需分别验收。

## 现有 UI 整合

[段落面板](../../../examples/paragraph-panel/README.zh-CN.md)新增可选的装备说明模式。不可变源范围描述更大的金色标题、较小的品质文字、彩色属性及 CJK 字体范围。普通列布局叶节点和变高虚拟列表复用同一准备结果、实测高度及 Scope 持有的图像。宽度、字号、对齐、行数上限和密度变化沿用现有 UI 修订事务。原默认文字、控件和输入路由保留，不包含触摸改动。

示例显式为段落图像缓存配置 32 MiB，使双倍密度事务中的新旧列布局／列表内容可以共存；产品默认的 16 MiB 和单张图片一百万像素量级的上限（1,048,576 像素）均未改变。装备条目使用 540 单位的保守初始高度估计，限制预先准备的数量；最终几何始终采用原生实测高度。示例文案保持在栅格上限内，不放宽上限。这是有限示例的预算，不代表手机内存验收。

当前主干整合验证通过 76 项相关行为／类型／原生／UI 测试；WebGL2、WebGPU 各通过 19 项装备示例检查、17 项样式几何检查和 20 项原段落面板检查。[整合汇总](../../../examples/paragraph-panel/styled-verification-summary.json)绑定实际输入并保留先前失败。已保存的样式浏览器记录有七项输入随主干变化，因此重新执行浏览器验证；未变源码的既有评审及原记录仍作为历史证据。固定视口可能裁掉末尾追加的标记，完成时必须发布新修订及其对应的准备布局，而不要求可见像素任意发生变化。

构建后运行有限整合检查：node examples/paragraph-panel/verify-equipment.mjs <playwright-root> <new-output-directory>。受保护 CI 和独立评审属于另行执行的交付门禁。当前主干的 macos-latest 作业未启动即取消，macOS CPU 作业因此改用 macos-15-intel；检查内容、Windows／Linux 检查及必需汇总不变，不代表 ARM64 验收。
