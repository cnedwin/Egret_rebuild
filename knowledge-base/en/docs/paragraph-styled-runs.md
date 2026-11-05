# Readonly styled paragraph runs

English | [简体中文](../../Cns/docs/paragraph-styled-runs.md)

The optional paragraph SDK accepts bounded font-family, font-size and foreground-color ranges through the existing paragraph cache and managed UI transaction. This is an M3.2 increment in Issue #88, not a new text engine or editor. Existing wrapping, final-line bidi, alignment, line limits and geometry remain authoritative.

## Request contract

The optional `runs: readonly ParagraphStyleRun[]` contains at most 256 sorted, nonoverlapping, nonempty UTF-16 `[start, end)` ranges within the original text. Boundaries may not split a surrogate pair or CRLF. Each run supplies at least one of `fontFamilies`, `fontSize` or `fillColor`. An omitted field inherits the paragraph default independently; source gaps use those defaults. Overlap, out-of-order input, empty overrides and invalid ranges are refused rather than reordered or merged by precedence.

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
// An ordinary UI leaf returns this same metrics.height as measuredHeight.
```

The unchanged source bound is 8,192 UTF-16 units. Run font sizes use 1–512; family lists use 1–16 explicitly registered names; foreground colors are integer RGB 0–0xffffff. Locale, direction and minimum line height remain paragraph-wide. This adds no weight, italic, decoration, background, inline image, editing, selection input or IME behavior.

The core snapshots and deeply freezes runs and family arrays before queueing. Omitted runs and an empty array retain the original request shape and cache key. Nonempty valid runs enter the existing request identity; no additional cache or resource owner is created. Invalid input does not advance a paragraph's desired revision.

## Complete native layout and cluster paint

Font family and size changes are native shaping boundaries within one complete paragraph. The adapter uses the existing initialized CanvasKit builder, TextStyle, pushStyle/pop and the existing explicitly owned font provider. It neither lays out independent fragments nor estimates character advances or overlays separately painted text.

Uniform effective foreground color, including font-only changes, needs one complete native layout. Nonuniform colors require two complete native layouts: first the entire source with font styles and without paint boundaries or maxLines; then the final complete paragraph with resolved foreground styles and the original line cap. The first pass never supplies public geometry or raster pixels. The additional work is bounded but is not a performance improvement claim.

For nonuniform colors, actual emitted glyph starts from getShapedLines are paragraph-absolute UTF-8 offsets. The adapter converts those starts to the layout buffer's UTF-16 coordinates, then through the existing authored CRLF mapping. It ignores the terminal offset, which can repeat the lowest source start in RTL. A range that cuts a shaped cluster uses the color at that cluster's leading logical source position for the whole painted cluster: in `office`, a range starting inside `ffi` does not divide its glyph. Native grapheme geometry can subdivide a ligature for caret purposes and is not substituted for shaped glyph source starts.

Unpainted source gaps do not establish additional glyph boundaries. Foreground resolution carries the last emitted source color through such a gap; hard breaks retain their authored color and reset that carry. This affects no gap ink. Font boundaries remain unchanged. No inferred source endpoint is exposed as a native cluster fact. Public lines, grapheme boxes, selection/caret queries and pixels all come from the final painted paragraph.

The source pass refuses more than 65,536 emitted glyph occurrences and malformed/missing native offset arrays. Standard shaped-line output does not identify synthetic discretionary hyphens, so nonuniform-color requests containing U+00AD refuse with PARAGRAPH_FEATURE_UNSUPPORTED. Font-only and uniformly colored runs retain native U+00AD behavior; no-runs requests keep their previous behavior.

Ellipsis is separately shaped synthetic content. Its ordinary native offsets can overlap authored glyph offsets, so the source pass deliberately excludes maxLines. The final native truncation chooses the resolved style for the fixed U+2026 marker; the adapter invents no authored marker position. Existing no-fit refusal, hidden-source geometry and blank-line rules remain unchanged.

## Capabilities and ownership

A provider explicitly declares `capabilities.styledRuns === true`. The cache captures that boolean once and refuses nonempty runs before reserving a slot or invoking a provider without the capability. The CanvasKit adapter requires actual TextStyle, builder pushStyle/pop and shaped-line ports. Its identity includes captured capabilities and existing build/font declarations. Missing registered fonts and unresolved glyphs remain explicit refusals.

The same Engine, Scope, AssetManager and texture leases own the result. Shared callers, cache invalidation, latest accepted intent, cancellation and cleanup keep their previous rules. A pending, failed or superseded style replacement leaves the preceding image, metrics and geometry visible together. UI content revisions prepare detached content and publish measured text height and following layout through the existing prepare/commit transaction. Changing a closed-over runs array alone does not invalidate UI content.

## Evidence and limits

The focused public behavior and strict-type fixtures cover admission, immutable snapshots, capability capture, cache identity, failed/latest-intent replacement and maximum run capacity. Native tests use the original Noto Sans, Noto Sans Arabic and Noto Sans CJK SC resources. They compare fixed source expectations, actual glyph IDs/source starts/positions and line metrics, plus direct native explicitly resolved color references for ffi, combining marks, multibyte text, bidi, wrapping, inkless spaces, font changes, CRLF and ellipsis. These same-backend references establish adapter behavior; they are not independent glyph/ink correctness or complete Unicode acceptance.

Run `node examples/paragraph-geometry/verify-styles.mjs <playwright-root> <new-output-directory>` after building. It exercises the existing public example on WebGL2 and WebGPU, including final geometry, real styled pixels, UI height, source replacement, density, refusal/recovery, cache reuse and ownership drain. Results and prior failures are recorded in [the scoped summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-geometry/styled-verification-summary.json). No native code, font bytes, license or dependency was added or changed.

Independent text references, full script/font coverage, native editing/IME, physical phones, accessibility, OOM recovery, physical/GPU memory and performance remain OPEN. M1.2's formal 10.3 ms versus 8 ms gap is unchanged. Full M3.2 and protected CI/PR/Main delivery retain separate acceptance.

## Existing UI integration

The [paragraph panel](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.md) now has an opt-in equipment-description mode. Immutable source ranges describe a larger gold heading, smaller rarity, colored statistics and a CJK font range. Ordinary column leaves and variable-height virtual rows use the same prepared paragraph, measured height and Scope-owned image. Width, type size, alignment, line cap and density changes use the existing UI revision transaction. The original default text, controls and input routing remain; no touch changes are included.

The example explicitly budgets 32 MiB of cached paragraph images so old and replacement column/list content can coexist during DPR-2 transactions; the product's 16 MiB default and one-megapixel per-image limit remain unchanged. Equipment rows use a conservative 540-unit initial estimate to bound speculative preparation; final geometry always uses native measured height. Authored examples stay within raster limits rather than weakening them. This is a bounded demonstration budget, not a mobile-memory qualification.

Current-main integration verification passed 76 focused behavior/type/native/UI tests, 19 equipment checks per WebGL2/WebGPU backend, 17 styled geometry checks per backend, and 20 legacy paragraph-panel checks per backend. The [integration summary](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/styled-verification-summary.json) binds actual inputs and preserves earlier failures. Seven inputs of the saved styled browser receipt changed on main, so the browser pass was refreshed; unchanged saved source review and original receipts remain historical evidence. Fixed viewport clipping can hide an appended marker: completion requires a new committed revision and its matching prepared layout, not an arbitrary change in visible pixels.

Run the bounded integration collector after building: node examples/paragraph-panel/verify-equipment.mjs <playwright-root> <new-output-directory>. Protected CI and independent review are separate delivery gates. The macOS CPU job uses macos-15-intel after the current main's macos-latest job was cancelled without starting; its suite, Windows/Linux checks and required summary remain unchanged. This does not qualify ARM64.

The first protected Windows run (41941452714) passed all 306 publication checks and then stopped at a stale current paragraph declaration identity. The repair updates exactly nine current source/emission identities in each of three existing owners, plus their current authority and exact inverse records. Original predecessors and gate logic remain unchanged; browser inputs did not change. The failed run remains in the integration summary; a new final-head protected run is required.
