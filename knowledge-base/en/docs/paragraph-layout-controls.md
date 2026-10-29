# Paragraph alignment and line limits

English | [简体中文](../../Cns/docs/paragraph-layout-controls.md)

Readonly paragraphs support horizontal alignment and an optional line limit through the existing paragraph cache and UI preparation transaction. This increment is part of M3.2; styled spans, selection, editing and IME remain separate work.

## Request and result contract

| Field | Meaning |
| --- | --- |
| `textAlign` | Optional `left\|right\|center\|start\|end\|justify`. Omitted and explicit `left` share the existing default cache key. |
| `start` / `end` | Resolve against the request's explicit `ltr\|rtl` base direction, then use physical left/right alignment. |
| `maxLines` | Optional safe integer 1–8,193. Omitted keeps unrestricted wrapping within existing input/image limits. |
| `metrics.truncated` | Required boolean on a line-limited result, absent on ordinary results. Actual native overflow state, not a line-count guess. |

When content exceeds `maxLines`, the last visible line carries the fixed U+2026 marker, including overflow at an explicit hard break or blank line. Fitting and empty text report `truncated: false`. Justification follows the pinned backend's paragraph policy: ordinary final/hard-break lines are not stretched; RTL final lines use its right-aligned fallback. Custom marker strings and vertical alignment are outside this increment.

```js
paragraph.setRequest({ ...request, textAlign: 'start', maxLines: 2 });
const metrics = await paragraph.prepare();
// Use metrics.height as the UI measurement; truncated describes hidden content.
```

The provider declares optional `capabilities.textAlign` and `capabilities.maxLines`; the cache snapshots these booleans once. Older custom providers still accept old requests. Nondefault unsupported controls fail with `PARAGRAPH_FEATURE_UNSUPPORTED` before allocating a cache slot or invoking the provider. No implicit alignment or clipping fallback is introduced. Custom providers must supply truthful immutable line metrics and overflow state.

## Native boundary and source coordinates

The selected optional native build exposes layout version 1 and an actual-line ellipsis query in addition to native overflow state. Capability admission requires all three. Earlier runtime artifacts retain basic paragraph/alignment support but refuse this unqualified line-limit profile. Provider identity includes captured capabilities and build/font identities, preventing cache reuse across different behavior.

Patch09 enables a marker at finite hard-break truncation and excludes only the terminating hard-break advance from line width. Authored preceding spaces and source/cluster positions remain intact, including an otherwise blank line. This avoids the previous missing marker and center/right displacement. A marker is a separately shaped affix: it need not inherit pair kerning that literal source text such as `B…` would receive.

The browser adapter maps CRLF to one LF and lone CR to LF only in its private layout buffer. Requests, source/cache identities and public UTF-16 line indices retain the authored text through a bounded boundary map; other bidi controls are not stripped or rewritten. For `A\r\nB\rC`, public line ranges are [0,1), [3,4), [5,6). The existing Unicode17 baseline is retained; [UAX14 revision55 LB5](https://www.unicode.org/reports/tr14/tr14-55.html#LB5) describes the hard-break handling, and [UAX9 revision51 P1](https://www.unicode.org/reports/tr9/tr9-51.html#P1) describes paragraph separation.

If a required ellipsis cannot fit, preparation rejects with `PARAGRAPH_ELLIPSIS_DOES_NOT_FIT` before raster publication. The same provider remains usable. A standalone paragraph or prepared UI leaf retains its preceding committed image and geometry after this refusal. The application may widen the field, change the request or intentionally choose another UI policy. It never receives a successful empty truncated frame. Missing marker glyphs are refused separately.

## Integration and verification

The same immutable preparation result supplies raster pixels, natural logical height and line metrics. Existing entry/job/image budgets, Scope cancellation, texture leases, latest-intent publication and UI sibling/hit geometry remain authoritative. Density changes pixels, not logical line layout. The default Engine entry does not load Wasm or fonts.

The consolidated focused suite passes 36 cases, including public strict positive/negative types, legacy-provider compatibility, cancellation/failure, native alignment, marker/no-fit recovery and UI geometry. Actual default Edge156 / Playwright1.62.1 runs pass 20 checks each on WebGL2 and WebGPU. Each backend also exercises 16 hard-break/direction cases, six hard-break alignment comparisons, six marker-width reservation comparisons, narrow rejection/recovery, authored UTF-16 mapping and the retained 90 native bidi reflows. These are finite functional observations, not independent font/ink or performance acceptance. See the [portable evidence record](https://github.com/cnedwin/Egret_rebuild/blob/main/verification/paragraph-layout/verification.json) and [runnable example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/README.md).

The optional runtime is 8,696,388 raw bytes; three unchanged fonts total 17,148,712 bytes, 25,845,100 combined. Patch09 follows00–08; original licenses, fonts and earlier artifacts remain byte-exact. See the [vendor manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json). The incremental native build and exact patch replay were observed; clean-machine/bit-identical reconstruction was not.

Source-boundary gates bind the current paragraph source/emission hashes together with the current owner identity and exact removable-block copy. Historical predecessor hashes, inverse operations and admission guards remain unchanged. Eight affected source-boundary checks and four refusal/replay controls passed. Failed CI checkpoints remain in the portable evidence record; complete final-head CI is still required.

Full M3.2, independent glyph/ink references, unlisted scripts/fonts, styled spans, selection/caret mapping, IME, Android/iPhone, performance, physical memory and OOM recovery remain OPEN. Protected CI and PR/Main publication are separate delivery evidence.
