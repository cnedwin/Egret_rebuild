# 段落对齐与行数限制

[English](../../en/docs/paragraph-layout-controls.md) | 简体中文

只读段落通过既有段落缓存和 UI 准备事务支持水平对齐及可选行数限制。本次增量属于 M3.2；属性分段、选区、编辑和输入法仍由后续工程负责。

## 请求与结果契约

| 字段 | 含义 |
| --- | --- |
| `textAlign` | 可选 `left\|right\|center\|start\|end\|justify`。省略与显式 `left` 共用既有默认缓存键。 |
| `start`／`end` | 根据请求明确的 `ltr\|rtl` 基方向，解析为物理左／右对齐。 |
| `maxLines` | 可选安全整数 1–8,193。省略时继续按既有输入／图像限制自由换行。 |
| `metrics.truncated` | 限行结果必须提供 boolean，普通结果不增加该字段。使用真实原生溢出状态，不靠行数猜测。 |

内容超过 `maxLines` 时，最后可见行显示固定的 U+2026 省略号，显式换行与空白行导致的溢出也遵守此规则。恰好容纳和空文本返回 `truncated: false`。两端对齐沿用固定后端的段落策略：自然末行／硬换行不拉伸，RTL 末行采用该实现的右对齐策略。自定义省略字符串及垂直对齐不在本次范围。

```js
paragraph.setRequest({ ...request, textAlign: 'start', maxLines: 2 });
const metrics = await paragraph.prepare();
// Use metrics.height as the UI measurement; truncated describes hidden content.
```

提供器可声明 `capabilities.textAlign` 和 `capabilities.maxLines`，缓存只捕获一次这些 boolean。旧自定义提供器仍接受旧请求。未支持的非默认选项在分配缓存槽或调用提供器前抛出 `PARAGRAPH_FEATURE_UNSUPPORTED`，不会暗中采用其他对齐或裁切方式。自定义提供器须提供真实且不可变的行指标及溢出状态。

## 原生边界与源坐标

当前可选原生构建除真实溢出状态外，还提供 layout version1 和实际行省略号查询；三者齐备才准入限行能力。旧运行库继续支持基本段落／对齐，但拒绝未经此资格验证的限行 profile。提供器身份包含捕获的能力和构建／字体身份，防止跨行为复用缓存。

Patch09 为有限行数下的硬换行截断补上省略号，并在行宽中仅排除终止硬换行的 advance。此前由作者写入的空格、源／cluster 位置保持不变，包括没有其他文字的空行，修复缺失省略号及居中／右对齐位移。省略号独立整形，因此不必继承源文本 `B…` 同 run 时的成对字距。

浏览器适配器仅在私有布局缓冲区将 CRLF 转为一个 LF、单独 CR 转为 LF。请求、源／缓存身份保留作者文本，公开 UTF-16 行索引通过有界边界映射回原文；其他双向控制不删除或重写。例如 `A\r\nB\rC` 的公开行范围为 [0,1)、[3,4)、[5,6)。继续使用既有 Unicode17 基线；硬换行规则见 [UAX14 revision55 LB5](https://www.unicode.org/reports/tr14/tr14-55.html#LB5)，段落划分见 [UAX9 revision51 P1](https://www.unicode.org/reports/tr9/tr9-51.html#P1)。

放不下必需省略号时，准备过程在发布栅格前抛出 `PARAGRAPH_ELLIPSIS_DOES_NOT_FIT`，同一提供器随后仍可使用。独立段落与准备式 UI 叶节点在拒绝后保留先前提交的图像及几何；应用可增宽、修改请求或明确采用其他 UI 策略，不会收到“成功但截断画面为空”的结果。缺少省略号字形另行拒绝。

## 接入与验证

同一不可变准备结果提供栅格、自然逻辑高度和行指标。既有条目／任务／图像预算、Scope 取消、纹理租约、最新意图发布和 UI 兄弟／命中几何继续生效。density 只影响像素，不改变逻辑行布局。默认 Engine 入口不加载 Wasm 或字体。

集中针对性套件 36 项通过，覆盖公开严格类型正／负例、旧提供器兼容、取消／失败、原生对齐、省略号／过窄恢复和 UI 几何。默认 Edge156／Playwright1.62.1 的实际 WebGL2 与 WebGPU 各通过 20 项检查；每个后端另覆盖 16 组硬换行／方向、6 组硬换行对齐、6 组省略号预留宽度、过窄拒绝／恢复、作者 UTF-16 映射及既有 90 组原生 bidi 重排。这些是有限功能观察，不是独立字体／墨迹或性能验收。见[可移植证据记录](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-layout/verification.json)与[可运行示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.zh-CN.md)。

可选运行库为 8,696,388 原始字节，三个未修改字体共 17,148,712 字节，合计 25,845,100。Patch09 接在00–08之后，原许可、字体及旧产物字节不变。详见 [vendor manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json)。已观察增量原生构建与准确补丁重放，未做干净机器／逐字节一致重建。

完整 M3.2、独立字形／墨迹参考、未列出的文字／字体、属性分段、选区／光标映射、IME、Android／iPhone、性能、物理内存和 OOM 恢复继续 OPEN。受保护 CI 与 PR／Main 发布属于独立交付证据。
