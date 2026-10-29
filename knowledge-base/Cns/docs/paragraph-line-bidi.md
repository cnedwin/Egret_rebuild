# 最终行双向文字排版

[English](../../en/docs/paragraph-line-bidi.md) | 简体中文

可选只读段落后端现在按实际换行结果计算每一行的双向文字顺序。拉丁文、阿拉伯文、数字、嵌入与隔离控制保留完整段落上下文，行尾按 Unicode 的逐行规则重置。SDK API、缓存所有权及 UI 发布协议保持不变。这是 M3.2 的有界集成，不代表整个 M3.2 已完成。

后续[布局控制](paragraph-layout-controls.md)增加对齐与限行。适配器仅在私有布局缓冲区转换 CRLF／CR，再将公开索引映射回作者 UTF-16；原生双向算法与此历史资格记录保留原范围。

## 为什么要在换行后解析行顺序

段落的 shaping level 不能原样用于所有最终行。例如使用固定字体、字号 20、宽度 95 时，以下内容的 UTF-16 断行范围为 [0,11)、[11,21)、[21,24)：

```js
const text = 'abc \u202Bمرحبا 123     \u202C xyz';
```

旧可选运行库让 PDF 之前的五个空格保留 RTL 顺序，把第二行数字推至 x≈26。当前版本让数字从 x=0 开始，空格重置为 LTR 并依次位于数字后面；PDF 对应的源位置宽度为零。这些坐标属于固定字体与字号的用例，并非跨字体通用度量。

## 共享原生契约

1. 原生 Sheen 上下文持有原始不可变 UTF-16 文本及已解算的 P1 段落。在可选的 tab 替换之前捕获；缓存命中时，必要的回退路径从原文创建上下文。
2. 换行确定实际源范围后，对每行调用未经修改的 SheenBidi 行接口，纳入尾部空格、格式控制与分隔符。跨行嵌入和隔离仍使用完整 P1 上下文。
3. 通过精确 UTF-16／UTF-8 边界转换可视行 run。最终行片段引用 canonical shaping Run 和 cluster，并单独持有生效行 level；不改写共享 Run 的 shaping level，不复制其可变对齐状态。
4. 每个可绘制 cluster 只拥有一次字形绘制。格式控制源位置是独立零宽逻辑槽；附着的默认可忽略控制不能重复绘制相邻字形，也不能按源字节比例占用其宽度。普通相邻片段只在保留原始存储方向时合并。
5. 绘制、字形行遍历、选区矩形、命中查询与两端对齐使用同一最终片段顺序。生效行方向决定逻辑端点，原始存储方向决定字形切片。行尾 ghost 几何按未裁剪的 canonical 片段宽度推进，不依赖 visitor 返回的已裁剪墨迹宽度。
6. 范围判断显式排除零宽或反向交集。原生范围类型的 empty 哨兵不是重叠判断；行解析被拒绝时，不悄悄退回旧段落顺序。

内部一致性不新增公开选区／光标／编辑 API。该后端的原生行拒绝及分配失败仍是终止性失败；内存预算与可恢复 OOM 需要单独实现。额外保留的 P1 上下文尚未通过性能或物理内存验收。

## 资源、源码与兼容

[vendor 清单](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json) 选择 `runtime/line-bidi-r1/`。glue 为 96,090 字节，Wasm 为 8,600,088 字节，当前运行库合计 8,696,178 字节。三个未改动字体共 17,148,712 字节，当前可选载荷为 25,844,890 原始字节。这不是压缩传输或活动内存测量。旧运行库保持原始字节，用于历史兼容比较，示例不加载旧版本。

在现有 00–07 patch 链之后应用 `source/patches/08-final-line-bidi.patch`，增量涉及七个原生文件。原 full-paragraph solver、私有资格验证导出、上游算法及法律原件保持完整。补丁已在精确的前一版七文件源码状态上回放，并与编译输入逐字节比较；尚未观察完整净机重建。原生 Emscripten 构建使用单独固定的构建期 Node 工具链；仓库 SDK 开发与测试要求 Node 26.7.0。

Windows 回放补丁时使用 `git -c core.autocrlf=false -c core.eol=lf apply <patch>`，避免本地 Git 默认配置改变原生源码字节。应用后比较原始哈希，不规范化编译输入或历史证据。

## 统一验证

- 原生 CPU：90 组文字／方向／宽度用例，每组均改宽再恢复，核对恢复后的矩形和栅格字节；包括嵌套隔离、显式嵌入、多 P1 段落、空行、控制符、组合标记及有限的默认可忽略／软连字符用例。
- 追加原生检查：八组对齐／方向组合，两组明确的行顺序／零宽／尾空格位置预期，并查询每个重置空格左右两半的命中位置。八组普通拉丁／阿拉伯文本栅格与旧运行库逐字节一致。
- 实际 Edge 156.0.4314.50、Playwright 1.62.1、Node 26.7.0：WebGL2 和 WebGPU 各通过 14 项集成检查，覆盖同一原生行用例、真实 SDK／UI 换行及高度、密度、静态帧、失败／待决／过期更新、虚拟列表、指针路由及资源清理。没有额外浏览器参数，不声明实体设备通过。
- 独立源码评审在最终验收前发现并修正了范围哨兵和裁剪尾空格位移问题；修正后的七文件源码再次独立评审通过。

运行 `node --test tests/paragraph-line-bidi.test.mjs tests/paragraph-vendor.test.mjs` 检查有限原生回归及精确资源身份。运行 `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>` 采集实际浏览器结果；后者记录精确 HTTP 依赖及原始 RGBA 哈希及保存截图。两条命令都不能替代保护分支合并检查。

完整 Unicode 符合性、独立字形／墨迹参考、未列出文字和字体、原生编辑／IME、Android／iPhone 输入、广泛浏览器覆盖、性能、GPU 时间、物理内存及 OOM 恢复继续 OPEN。有限 ZWJ／组合用例不代表支持完整 emoji 或任意文字系统。M1.2 全脏性能目标继续 OPEN。

## 参考与鸣谢

集成遵循 [Unicode 17 UAX #9 的 L1／L2](https://www.unicode.org/reports/tr9/tr9-51.html#L1)，使用未经修改的 [SheenBidi](https://github.com/Tehreer/SheenBidi/tree/cfe430e7375a7845b679adae9d51dac6deaa8858)。原生 shaping 和绘制保留固定的 [Skia 源码](https://skia.googlesource.com/skia/+/e2def78fa232884d4aedcf3ad92d4a0dd673b898)。Egret 集成改动、上游算法、派生二进制及原始字体的来源和适用 notices 分别保留在 [vendor 说明](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/README.zh-CN.md) 中。
