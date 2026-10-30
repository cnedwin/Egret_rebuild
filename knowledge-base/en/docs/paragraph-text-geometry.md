# Paragraph source, selection and caret geometry

English | [简体中文](../../Cns/docs/paragraph-text-geometry.md)

The optional paragraph SDK exposes immutable text geometry alongside the image and line metrics from the same preparation. This M3.2 increment supplies coordinates for selection, caret placement and later native-editor integration. Input routing and native composition keep their existing owners.

## Public contract

Set `textGeometry: true` in a paragraph request. A provider must declare `capabilities.textGeometry === true`; unsupported requests fail before cache reservation or provider work. Omitted and false requests share the previous cache key and do not collect geometry. Existing custom providers need no changes for previous requests.

The prepared cache result and committed `paragraph.getStatus()` expose optional `geometry`. It contains authored `text`, immutable `lines` and `clusters`, and these pure queries:

| Query | Result |
| --- | --- |
| `getCaret(offset, affinity?)` | UTF-16 offset, resolved affinity, line index, x and top/bottom; undefined when the native layout contains no lines. |
| `hitTest(x, y)` | Nearest admitted caret on the nearest logical line, with an `inside` flag for a nonzero cluster advance on that line. |
| `getSelectionRects(start, end)` | Frozen visual rectangles with source ranges, line indices and directions; an empty range yields no rectangle. |

Coordinates are paragraph-local logical units before display transforms; image padding, ink bearings and density do not shift them. Consumers convert their own scene coordinates. Selection uses native grapheme advance boxes, not ink-only bounds or estimated character widths. Different directional runs can produce several rectangles on one line.

Offsets use exact authored UTF-16, never UTF-8 bytes or glyph numbers. Affinity is `upstream` or default `downstream`: at a shared bidi/wrap boundary it selects the preceding or following source side. Inside a native grapheme, upstream snaps to its start and downstream to its end. Native grapheme boundaries govern ligature subdivision. Selection expands partial graphemes outward. CRLF interiors choose the preceding/following admitted stop; no caret splits a surrogate pair or CRLF. Invalid offsets, reversed ranges and nonfinite points refuse explicitly.

Synthetic ellipsis is not authored text. Hidden source produces no selection rectangles; caret queries map to the nearest admitted visible stop. Empty native layouts have no caret; blank native lines retain their own line geometry. Zero-width formatting does not acquire neighboring selection ink. A narrowly scoped adapter correction maps an overlapping final empty native line to authored EOF after a terminating hard break, retaining the native line and strict core source-range checks.

## Ownership and commit

The CanvasKit adapter copies native grapheme/range/box data while the same paragraph remains alive for rasterization. Native paragraph and font-run wrappers still retire during preparation; no query retains native objects. The core snapshots and validates all rows before cache or display publication. The default engine entry does not load this optional backend, fonts or Wasm.

The existing AssetManager leases, Scope cancellation and latest-intent paragraph publication own the result. Pending, failed and stale replacements keep the preceding image, metrics and geometry together. UI leaves measure from that same result and expose their node only after the UI transaction commits. Geometry retained by an application is an immutable detached snapshot, not authority over the current display or a native object.

The cache adds optional `maxGeometryBytes` (default 2,097,152; range 0–67,108,864) and `getStatus().geometryBytes`. Admission charges a bounded logical storage fee: two bytes per authored UTF-16 unit, 112 per line and 160 per cluster, covering fixed geometry/caret rows. Image bytes remain separate. Pinned old generations remain charged until their asset retires; disposal releases owned residency and pending work follows existing cancellation. This accounting does not measure physical JS/Wasm/GPU memory. An application that separately retains a detached snapshot owns that retention.

```js
paragraph.setRequest({ ...request, textGeometry: true });
await paragraph.prepare();
const { geometry, committedRevision } = paragraph.getStatus();
const caret = geometry?.getCaret(5, 'downstream');
const selection = geometry?.getSelectionRects(2, 8);
// Apply results only to the display revision from which they were obtained.
```

## Example, sources and qualification

Run `pnpm example:browser`, then open `/examples/paragraph-geometry/index.html`. The example renders selection and caret through the existing shared renderer and prepares paragraph content through the managed UI root. DOM forms query local coordinates; they add no scene touch listeners. WebGL2/WebGPU selection, alignment and reflow are inspectable. The previous paragraph-panel fixtures remain unchanged apart from the truthful provider capability assertion in its test.

First-party query, copying, ownership and example code is independently authored under Apache-2.0 with AI assistance. Native shaping and grapheme boxes come from the existing identified Skia/SheenBidi/ICU build and Noto font resources; original notices and bytes remain unchanged. See the [vendor manifest](../../../examples/paragraph-panel/vendor/manifest.json) and [line-layout contract](paragraph-layout-controls.md).

Current execution results are recorded in [verification/paragraph-geometry](../../../verification/paragraph-geometry/verification.json) after collection. Type/behavior tests, selected native-provider integration and actual browser observations have distinct scopes. Synthetic geometry controls do not qualify fonts or Unicode. Unsupported emoji glyphs remain explicit refusals with the bundled fonts. Full font/script coverage, independent glyph/ink references, native editing/IME, physical phones, accessibility, performance and full M3/M4 acceptance remain open.
