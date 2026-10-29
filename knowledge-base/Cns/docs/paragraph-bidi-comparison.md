# 私有段落 bidi 后端比较 — 2026-10-29

[English](../../en/docs/paragraph-bidi-comparison.md) | 简体中文

私有 SheenBidi 比较版本已接入真实 SkUnicode/SkParagraph 路径，并在声明范围内完成 Unicode 17 bidi 全量比较，零差异。这是实验实现与有界资格验证结果，不是 Egret SDK 功能或 provider 采用结论。M3.2 仍为 OPEN，包括最终软换行后的 L1、独立 glyph／ink 参考、原生编辑、设备覆盖及内存／性能验收。[历史检查点](m3-ui-text-input-plan.md)保留此前 ICU 结果。

## 实现与源码身份

本次比较基于 [Skia/SkParagraph e2def78](https://github.com/google/skia/tree/e2def78fa232884d4aedcf3ad92d4a0dd673b898) 和原版 [SheenBidi v3.0.0，提交 cfe430e](https://github.com/Tehreer/SheenBidi/tree/cfe430e7375a7845b679adae9d51dac6deaa8858)。四个真实段落 builder 路径将同一私有候选工厂传入 bidi region 提取、整形及最终 run 排序。原 ICU export 与全部既有 ICU 诊断保持原义。Break iterator、code-unit flags、属性及已声明的 locale／data 行为仍由 ICU 提供；字体及 32/64 MiB 内存声明不变。

Sheen 对每个 P1 段执行 X1–I2，再通过完整段落的 line API 取得 L1 调整后的 logical UTF16 levels。真实段落路径继续使用 linked ICU 的纯 `reorderVisual` L2 对 run levels 排序。独立 backend 诊断展开原生 Sheen SBLine runs；adapter 诊断观察真实工厂，并在各 P1 范围内分别调用 ICU L2。原始 map 的单位为 UTF16 slot，UTF8 byte regions 单独报告。NUL、补充字符、CRLF、非法输入拒绝及 iterator 自有结果均有有限控制。Typed-class 诊断通过私有同 unity C seam 使用原始 type token，不猜代表字符，也不宣称 Sheen 公开提供 class callback。

**最终软换行后的逐行 L1 尚未接入。** 完整 P1 的 line 结果不能替代实际换行后的逐行 reset。候选明确报告 `wrapLineL1Integrated=false`，标准输入比较通过不能关闭此边界。借用的 native 值在释放前复制；普通 nullable allocation 拒绝及保留的 plain arrays，不证明原生 OOM 恢复或物理回收。

[源码清单](../../../verification/paragraph-sheen-comparison/public-source-manifest.json)与 [native patch](../../../verification/paragraph-sheen-comparison/native.patch)固定七个文件改动：四个新增自有 wrapper 采用 Apache-2.0，三个修改过的 Skia 文件保留 BSD 归属。Native source receipt `23e1c33e…` 与 patch `0273da28…`标识已审源码。清单列出精确派生基线身份、六个前序 patch 及 strict-data 前置。这不是在 clean upstream Skia 上一键重放的完整配方。公开包不加入原版 vendor 源码、字体或可执行载荷；本次没有公开 SDK 或产品运行时依赖变更。

## 已观察比较与保留的失败

[验证摘要](../../../verification/paragraph-sheen-comparison/verification-summary.json)记录精确产物与证据身份。完整比较 receipt 为 `59fe420f0631e12498986b887cfbd9e85b16a8824024b1583ba1ac48d5415770`。

| 声明 profile | 已观察次数 | 结果 |
| --- | ---: | --- |
| BidiTest 原始 class token | 770,241 | 严格 level／order 比较零差异 |
| BidiCharacterTest 原文，包含声明的 auto 模式 | 91,707 | 严格 level／order 比较零差异 |
| 真实段落工厂 adapter，固定方向 0/1 | 91,679 | 严格 level／order 比较零差异 |
| 固定方向 adapter 能力之外的官方 auto 案例 | 28 | NOT_OBSERVED；未转换为固定方向案例 |

总 schedule 为 953,655 次：953,627 OBSERVED 加 28 项已声明的 adapter 排除。已观察 profile 中 refusal、error、parse、capacity 事件均为零，21 个已审计输入身份保持不变。原期望和严格 comparator 保留，没有把候选结果转成 golden。

Focused 结果为 24/24 项 N0 order 控制、54 项边界控制通过及两项明确的 scope NOT_RUN，另有独立的 10/10 项 typed-class 控制。首次边界运行真实的测试失败继续保留：测试将嵌套的不可变 ICU identity 字段当作顶层字段访问。Revision 1 仅修正三处字段访问，保留期望值和 native 产物。普通拒绝控制不能填补独立的 OOM 注入缺口。

历史 ICU 产物仍有 105,785 次 class 尝试失败，以及 11 项 character／11 项固定 adapter 不符。这些历史矛盾没有重标为通过，也不证明修复了 105,785 个渲染 bug。各诊断范围存在重叠，计数不能相加成为缺陷总数。

## 真实段落与桌面浏览器范围

既有 53-case corpus 得到原组 49 项已观察、一项保留的 missing-font preflight，以及三项已观察 companion。未改动的 finite verifier 记录 844 MATCH、零 mismatch、494 个输入不变。既有 38-invariant 范围、有限独立参考与有条件 parity 继续保留；不能据此声称 53 例全有独立整形或像素 golden，也不能将 mark 索引次序直接当作 ink 结果。

桌面浏览器 revision 1 在默认 Edge（`msedge`、headless、无额外 flags）及 Playwright 1.62.1 下通过，观察全部 24 项 N0 order 控制，并绘制真实 Ahem CPU raster，其 RGBA 字节与同一产物在 Node 下的结果精确一致。这是跨宿主一致性，不是独立整形 golden、GPU 结果、整体浏览器合成结果、手机结果或 IME 验收。

浏览器 revision 0 在初始化前失败：生成的 loader 忽略所传 `wasmBinary`，其默认 Wasm URL 不在窄 allowlist 内。原失败 receipt 保留。Revision 1 仅将 I/O 配置改为支持的 `locateFile` 路由；没有 native rebuild、期望变更或断言放宽。

## 成本与剩余验收

按 Node 26.7.0 `gzipSync` level 9，Wasm 贡献 **4,184,563 字节**，glue **29,909 字节**，合计 **4,214,472 字节**。嵌入的 ICU 数据已在 Wasm 内，只计一次。对照 4.5 MiB 组件上限的是 Wasm 贡献，glue 单独报告；这不代表总 M4 传输、启动或性能验收通过。

在最大 64 MiB 不变的条件下，实际线性内存容量再次从 32 增长到 38.4375 MiB。容量不是 live ownership、物理峰值、回收、OOM 恢复或堆余量资格。M3.2／provider 验收、最终软换行 L1、独立 glyph／ink 参考、字体、浏览器合成、IME／无障碍、移动端和完整 M4 均保持 OPEN。独立的 M1.2 计时结果为 10.3 ms，对照 8 ms 目标，同样仍为 OPEN。

## 来源与许可

各来源角色保持独立：[选定 ICU 源码](https://chromium.googlesource.com/chromium/deps/icu/+/d578f2e8b7bd5938e21cfb6bf15c079e0aa5b738/)提供共享服务；[Unicode 17 BidiTest](https://www.unicode.org/Public/17.0.0/ucd/BidiTest.txt)、[BidiCharacterTest](https://www.unicode.org/Public/17.0.0/ucd/BidiCharacterTest.txt) 与 [UAX #9 修订 51](https://www.unicode.org/reports/tr9/tr9-51.html)提供独立标准期望。Sheen 源数据声明 Unicode 17.0.0；实际库版本与表的声明来源分别记录，不虚构运行时 Unicode-version getter，也不声称生成表已完成全量等价验证。保留 [Skia 原 BSD 许可](../../../verification/paragraph-sheen-comparison/skia-BSD-3-Clause.txt)、[Sheen 原 Apache-2.0 许可](../../../verification/paragraph-sheen-comparison/sheen-Apache-2.0.txt)及适用的 Unicode／ICU notices。新增 wrapper 调用固定原版库，不移植算法片段另造 UBA 实现。
