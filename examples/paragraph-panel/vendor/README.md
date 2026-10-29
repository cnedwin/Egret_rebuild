# Optional paragraph runtime and font assets

English | [简体中文](README.zh-CN.md)

This directory makes the paragraph-panel example runnable from the repository. The SDK adapter itself performs no network access and does not import these assets automatically. The application loads `runtime/layout-r1/canvaskit.js`, initializes `CanvasKitInit` with a `locateFile` route for `runtime/layout-r1/canvaskit.wasm`, reads the selected fonts, and supplies the initialized module and font bytes to `createCanvasKitParagraphProvider`. Use `manifest.runtime.buildIdentity` as the adapter's explicit `buildIdentity`. Its identity also includes every registered family and caller-declared font identity; that declaration does not itself recompute a hash.

## Runtime and font identities

[manifest.json](manifest.json) lists exact relative paths, raw byte sizes, SHA-256 identities, font source revisions, notices, native dependency revisions and the patch order. Preserved upstream/legal originals are copied byte-for-byte, without line-ending or Unicode normalization.

| Optional browser payload | Raw bytes |
| --- | ---: |
| CanvasKit glue | 96,090 |
| CPU Wasm | 8,600,298 |
| Noto Sans Regular | 569,208 |
| Noto Sans Arabic Regular | 142,140 |
| Noto Sans CJK SC Regular | 16,437,364 |
| Runtime and three fonts | 25,845,100 |

These are original full fonts, without subsetting. Transfer compression, startup, live/physical memory and device performance are not established by the raw totals. `source/icudtl.dat` is an additional 3,089,888-byte rebuild input; it is already embedded in Wasm and is not loaded separately by the browser. The Wasm declaration is 32 MiB initial and 64 MiB maximum linear memory, which is not a live-allocation or physical-memory measurement.

## Actual adapter profile and remaining boundaries

The adapter uses standard CanvasKit builder, line metrics, shaped-line, glyph-bound and CPU-raster APIs. It does not call the private qualification snapshot or cluster-paint exports, so their 1024-byte/16-line envelope is not an SDK limit. The source is well-formed UTF-16, at most 8,192 code units; public line offsets are UTF-16. The first profile has one font-size/color/language/direction style for the whole paragraph, explicit registered fallback families, automatic wrapping, optional minimum logical line height, and density-scaled transparent RGBA output with signed ink-bearing placement. The natural font metrics may exceed the requested minimum line height.

The combined provider identity is limited to 8,192 code units. Provider limits are 16 registered families, 32 MiB total original font bytes, family names up to 256 code units, caller font/build identities up to 512 code units, locale up to 64 code units, logical width from 0.25 through 4,096, font size from 1 through 512, minimum line height from 1 through 1,024, and density from 0.25 through 4. Raster output retains the existing ImageData2D limits: at most 4,096 pixels per edge and 1,048,576 total pixels. Oversized output, malformed source, unregistered requested families or unresolved glyphs are refused. No system-font discovery, native editing, attributed spans, emoji, Indic, variable-font or font-collection profile is advertised by this example. Locale strings are passed to the pinned implementation; its embedded data subset does not establish every ICU locale service.

**Final soft-wrapped-line L1/L2 is integrated.** The native line API uses complete P1 context and actual line ranges; paint, geometry and hit queries share canonical final fragments. Finite verification and remaining boundaries are documented in the [line contract](../../../knowledge-base/en/docs/paragraph-line-bidi.md). Full Unicode, independent glyph/ink references, unlisted scripts/fonts, IME, devices, memory/OOM and performance remain separate acceptance work. The application owns and disposes the provider after its borrowed caches and displayed resources retire.

## Third-party attribution and original notices

The runtime uses Skia/SkParagraph and skcms under their retained BSD notices; SheenBidi under Apache-2.0; ICU and Unicode under their original notices; HarfBuzz under its original permissive license; FreeType under the **FreeType License (FTL)** selected for this distribution; and the recorded Brotli, libjpeg-turbo, libpng, libwebp, Wuffs, zlib and Chromium PartitionAlloc components under the notices in `licenses/`. New first-party wrapper files retain Apache-2.0 SPDX declarations; modifications to Skia files retain Skia's BSD attribution. Emscripten, musl, LLVM compiler-rt, libc++, libc++abi, libunwind and the original dlmalloc source notices are also preserved for the toolchain/runtime contribution. The Chromium license original was retrieved on 2026-10-29 from Chromium's official GitHub mirror; the separate PartitionAlloc source revision is pinned in the manifest.

This software is based in part on the work of the Independent JPEG Group.

Portions of this software are copyright © 1996–2026 The FreeType Project (https://freetype.org). All rights reserved.

Noto Sans, Noto Sans Arabic and Noto Sans CJK SC retain their original OFL notices, font-embedded copyright/trademark statements, original family names and unmodified bytes. `licenses/fonts/` contains the standalone upstream notices. No source/binary reconstruction of the original font artifacts is claimed. Keep this directory's manifest, documentation and applicable license originals with any redistributed optional asset package.

## Source rebuild inputs

The pinned native base is Skia `e2def78fa232884d4aedcf3ad92d4a0dd673b898`, with the native revisions recorded in the manifest and stock SheenBidi `cfe430e7375a7845b679adae9d51dac6deaa8858` placed at `third_party/externals/sheenbidi`. The original selected ICU source revision is `d578f2e8b7bd5938e21cfb6bf15c079e0aa5b738`.

The preserved patch sequence is `source/patches/00-canvaskit-memory.diff`, then `01-bridge.patch` through `07-sheen-comparison.patch`. Each patch is an incremental delta on the preceding exact source state. The final Sheen patch alone is insufficient on clean upstream Skia. Place the exact `source/icudtl.dat` at `third_party/externals/icu/flutter/icudtl.dat`. This strict-data subset contains retained ICU payloads and modified root/ja break-resource mappings; its SHA-256 is the reviewed build-input identity, not a newly computed runtime getter.

`source/args.gn` is a portable projection of the frozen CPU configuration; set the build host's `EMSDK` to its Emscripten SDK directory. The recorded toolchain was Emscripten 4.0.7 / clang and LLD revision `57025b42c43b2f14f7e58692bc19cd53d1b8a45e`, GN `b2afae122eeb`, Ninja 1.12.1, SDK Node 20.18.0, and Closure Compiler v20240317. Keep the selected dependencies, CPU-only options, embedded ICU services and 32/64 MiB declaration. Configure the CanvasKit target with the selected args, then build `canvaskit.js` through Ninja. The included patch/data/config identities make the source changes reviewable; a clean-machine build replay and bit-identical reconstruction have not been performed for this package. A rebuilt artifact requires its own hashes and runtime/browser checks before replacing this manifest's exact payloads.

The selected runtime applies `source/patches/08-final-line-bidi.patch` after 00–07, then `09-paragraph-layout.patch` and loads only `runtime/layout-r1/`. Earlier runtime/patch bytes are retained unchanged for provenance and regression comparison.

Layout-r1 exposes native layout version1 and an actual-line marker query. The adapter admits maxLines only with these and the actual overflow method. Patch09 preserves source/cluster positions while excluding the invisible hard-break advance; it changes three Skia source files under their retained BSD notices. The SDK environment remains Node26.7.0; Node20 above belongs only to the separately pinned native build toolchain. See the [layout contract](../../../knowledge-base/en/docs/paragraph-layout-controls.md).
