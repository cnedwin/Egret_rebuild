# 可选段落运行时与字体资源

[English](README.md) | 简体中文

本目录使仓库中的 paragraph-panel 示例具备可直接运行的资源。SDK 提供器自身不会联网，也不会自动导入这些资源。应用显式加载 `runtime/canvaskit.js`，通过 `locateFile` 指向 `runtime/canvaskit.wasm` 后调用 `CanvasKitInit`，读取选定字体，再把模块实例和字体字节交给 `createCanvasKitParagraphProvider`。适配器的 `buildIdentity` 应使用 `manifest.runtime.buildIdentity`。提供器身份还包含全部已注册 family 和宿主声明的字体身份；该身份声明本身不等于重新计算哈希。

## 运行时与字体身份

[manifest.json](manifest.json) 列出准确相对路径、原始字节数、SHA-256、字体来源版本、通知原件、原生依赖版本及补丁顺序。上游与法律原件均逐字节复制，不归一化换行或 Unicode。

| 可选浏览器资源 | 原始字节 |
| --- | ---: |
| CanvasKit glue | 96,090 |
| CPU Wasm | 8,584,562 |
| Noto Sans Regular | 569,208 |
| Noto Sans Arabic Regular | 142,140 |
| Noto Sans CJK SC Regular | 16,437,364 |
| 运行时与三个字体合计 | 25,829,364 |

三个字体都是未经子集化的完整原件。以上原始字节数不证明压缩传输量、启动速度、存活/物理内存或设备性能。`source/icudtl.dat` 是额外的 3,089,888 字节重建输入；它已经嵌入 Wasm，浏览器不会单独加载。Wasm 声明初始线性内存 32 MiB、最大 64 MiB，该声明不等于存活分配或物理内存测量。

## 实际适配范围与未闭合边界

适配器使用标准 CanvasKit builder、行指标、shaped-line、字形边界与 CPU 栅格接口，不调用私有资格快照或 cluster-paint 导出，因此其 1024 字节/16 行限制不是 SDK 上限。源文本要求合法 UTF-16，最多 8,192 code units，公开行范围以 UTF-16 计数。首版对整段使用同一字号、颜色、语言及基方向，显式指定已注册 fallback 字体，支持自动换行、可选最小逻辑行高，以及带有符号墨迹 bearing 偏移的密度缩放透明 RGBA 图像。字体自然指标可以超过请求的最小行高。

合并后的 provider identity 最多为 8,192 code units。提供器限制为最多 16 个注册 family、合计 32 MiB 原始字体字节；family 名称最多 256 code units，宿主字体/build 身份最多 512 code units，locale 最多 64 code units；逻辑宽度为 0.25 至 4,096，字号为 1 至 512，最小行高为 1 至 1,024，density 为 0.25 至 4。栅格继续遵守既有 ImageData2D 上限：单边最多 4,096 像素，总计最多 1,048,576 像素。超大图像、非法文本、请求未注册字体或缺失字形均会拒绝。本例不宣称系统字体发现、原生编辑、富文本 spans、emoji、Indic、可变字体或字体集合范围。locale 会传给固定实现，但嵌入的数据子集不证明完整 ICU locale 服务。

**最终软换行的逐行 L1 仍为 OPEN。** 固定候选在塑形前调用 Sheen 的完整 P1 行接口，而 SkParagraph 的真实最终行排序仍使用 run levels。因此，混合方向软换行的逐行 reset/order 与尾随空白几何仍存在未解决边界。本例的 Latin、Han 与 Arabic 文本只是有限演示，不代表完整 Unicode 段落验收。独立字形/墨迹参考、浏览器/设备覆盖、内存/OOM 恢复和性能保持单独验收。提供器属于应用；应用应在借用它的缓存与显示资源退场后显式 dispose。

## 第三方归属与原始通知

运行时保留 Skia/SkParagraph 与 skcms 的 BSD 通知、SheenBidi 的 Apache-2.0、ICU 与 Unicode 原始通知、HarfBuzz 原始宽松许可，以及 `licenses/` 中 Brotli、libjpeg-turbo、libpng、libwebp、Wuffs、zlib 与 Chromium PartitionAlloc 的通知。本分发对 FreeType 明确选择 **FreeType License（FTL）**。新增自有 wrapper 文件保留 Apache-2.0 SPDX；修改的 Skia 文件继续保留 Skia BSD 归属。工具链/运行时贡献还保留 Emscripten、musl、LLVM compiler-rt、libc++、libc++abi、libunwind 和原始 dlmalloc 源码中的通知。Chromium 许可原件于 2026-10-29 从其官方 GitHub 镜像取回，PartitionAlloc 的源版本另在 manifest 中固定。

This software is based in part on the work of the Independent JPEG Group.

Portions of this software are copyright © 1996–2026 The FreeType Project (https://freetype.org). All rights reserved.

Noto Sans、Noto Sans Arabic 与 Noto Sans CJK SC 保留原始 OFL、字体内嵌的版权/商标声明、原 family 名称和未经修改的字节。独立通知原件位于 `licenses/fonts/`。不宣称这些原始字体的源到二进制重建。再次分发可选资源包时，须一并保留本目录的 manifest、说明及适用许可原件。

## 源重建输入

原生基底为固定 Skia `e2def78fa232884d4aedcf3ad92d4a0dd673b898`，配套使用 manifest 中的原生依赖版本，并将 stock SheenBidi `cfe430e7375a7845b679adae9d51dac6deaa8858` 放在 `third_party/externals/sheenbidi`。选定 ICU 源版本为 `d578f2e8b7bd5938e21cfb6bf15c079e0aa5b738`。

保留的补丁依次为 `source/patches/00-canvaskit-memory.diff`，再按顺序应用 `01-bridge.patch` 至 `07-sheen-comparison.patch`。每个补丁都依赖前一个准确源状态，不能把最终 Sheen 补丁单独用于干净上游 Skia。将准确的 `source/icudtl.dat` 放在 `third_party/externals/icu/flutter/icudtl.dat`。该 strict 数据子集保留 ICU 原始 payload，并修改 root/ja 的 break-resource 映射；其 SHA-256 表示经审查的构建输入身份，不是新增运行时 getter。

`source/args.gn` 是冻结 CPU 配置的可移植投影；构建宿主须把 `EMSDK` 指向本机 Emscripten SDK 目录。记录的工具链为 Emscripten 4.0.7、clang/LLD revision `57025b42c43b2f14f7e58692bc19cd53d1b8a45e`、GN `b2afae122eeb`、Ninja 1.12.1、SDK Node 20.18.0 和 Closure Compiler v20240317。保留选定依赖、CPU-only 选项、嵌入 ICU 服务及 32/64 MiB 声明；使用所列 args 配置 CanvasKit target，再由 Ninja 构建 `canvaskit.js`。本包提供补丁、数据与配置身份供审查，尚未进行干净机器重放或逐字节一致重建。任何重建产物都须经过独立哈希与运行时/浏览器检查，再替换 manifest 固定的资源。
