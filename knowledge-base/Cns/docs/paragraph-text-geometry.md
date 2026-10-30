# 段落源文本、选区与光标几何

[English](../../en/docs/paragraph-text-geometry.md) | 简体中文

可选段落 SDK 在同一次准备中提供图像、行度量和不可变文字几何。本项 M3.2 能力为选区、光标定位与后续原生编辑器接入提供坐标，输入路由和原生组合输入继续由既有模块负责。

## 公开契约

请求设置 `textGeometry: true` 时收集文字几何。后端必须声明 `capabilities.textGeometry === true`，否则在预留缓存或调用后端前拒绝。不设置与 false 共用原有缓存键，不收集几何；已有自定义后端继续处理原请求，无需修改。

缓存准备结果和 `paragraph.getStatus()` 的已提交状态提供可选 `geometry`，包含原文 `text`、不可变 `lines` 与 `clusters`，以及以下纯查询：

| 查询 | 结果 |
| --- | --- |
| `getCaret(offset, affinity?)` | UTF-16 偏移、已解析亲和方向、行号、x 和上下边界；原生布局没有行时返回 undefined。 |
| `hitTest(x, y)` | 最近逻辑行上的最近合法光标；`inside` 表示落在该行的非零字素推进范围中。 |
| `getSelectionRects(start, end)` | 含源范围、行号和方向的冻结视觉矩形；空范围不产生矩形。 |

坐标使用显示变换前的段落局部逻辑单位，图像留白、墨迹偏移和密度不会移动它。使用方转换自己的场景坐标。选区采用原生字素推进框，不采用纯墨迹框或估算字符宽度；同一行的不同方向段可产生多个矩形。

偏移始终对应原文 UTF-16，不是 UTF-8 字节或字形编号。亲和方向为 `upstream` 或默认 `downstream`：在双向文字或换行的共用边界选择前一或后一源文本侧；原生字素内部位置分别吸附到字素起点或终点。连字的细分遵循原生字素边界；部分字素选区向外扩展。CRLF 内部位置选择前后合法停靠点，不拆分代理对或 CRLF。非法偏移、反向范围和非有限坐标明确拒绝。

合成省略号不属于原文。隐藏文本不产生选区矩形，光标查询映射到最近的可见合法停靠点。没有行的空原生布局不提供光标；原生空白行保留本行几何。零宽格式字符不借用相邻选区墨迹。适配器仅对末尾硬换行后范围重叠的最后空行，将其源位置修正为原文结尾，保留原生空行和核心严格范围检查。

## 所有权与提交

CanvasKit 适配器在同一原生段落仍用于栅格化时复制字素、源范围和矩形。原生段落与字形运行字体包装仍在准备结束时退役，查询不保留原生对象。核心复制并验证全部行后才取得缓存或显示发布权。默认引擎入口不加载可选后端、字体或 Wasm。

结果继续由既有 AssetManager 租约、Scope 取消和段落最新意图提交管理。等待中、失败和过期替换保留上一代图像、度量及几何的一致性。UI 叶节点用同一结果测量，只在 UI 事务提交后暴露对应节点。应用保留的几何是不可变独立快照，不代表当前画面的权威，也不持有原生对象。

缓存增加可选 `maxGeometryBytes`（默认 2,097,152，范围 0–67,108,864）及 `getStatus().geometryBytes`。准入采用有界逻辑存储费用：每个原文 UTF-16 单位 2 字节、每行 112、每字素 160，覆盖固定几何和光标记录；图像字节单独计费。旧代次被租约固定时持续计费，直到对应资源退役；释放缓存撤销驻留，待定任务遵循原有取消机制。此计费不是 JS、Wasm 或 GPU 实体内存测量；应用单独保留快照所产生的内存由应用负责。

```js
paragraph.setRequest({ ...request, textGeometry: true });
await paragraph.prepare();
const { geometry, committedRevision } = paragraph.getStatus();
const caret = geometry?.getCaret(5, 'downstream');
const selection = geometry?.getSelectionRects(2, 8);
// Apply results only to the display revision from which they were obtained.
```

## 示例、来源与验收边界

运行 `pnpm example:browser`，打开 `/examples/paragraph-geometry/index.html`。示例通过既有共享渲染器绘制选区与光标，通过受管 UI 根准备段落内容。DOM 表单查询局部坐标，不安装场景触摸监听器，可观察 WebGL2/WebGPU 的选区、对齐和重新排版。原段落面板夹具保持原样，其测试仅更新真实后端能力的断言。

查询、复制、所有权与示例代码为独立实现，使用 Apache-2.0 并有 AI 辅助。原生整形与字素框来自现有已标识 Skia/SheenBidi/ICU 构建和 Noto 字体，原始声明与字节不变。见[供应清单](https://github.com/cnedwin/Egret_rebuild/blob/91f5e222e68a4bcdf8583b3ac9d1e51a91362f5f/examples/paragraph-panel/vendor/manifest.json)与[行布局契约](paragraph-layout-controls.md)。

实际执行结果在采集后记入 [verification/paragraph-geometry](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-geometry/verification.json)。类型／行为测试、指定原生后端集成与实际浏览器结果分别陈述。合成几何测试不能代表字体或 Unicode 验收；自带字体缺少的 Emoji 字形继续明确拒绝。完整字体／文字覆盖、独立字形／墨迹参考、原生编辑／输入法、实体手机、无障碍、性能及完整 M3/M4 验收保持开放。
