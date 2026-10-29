# Final-line bidirectional text

English | [简体中文](../../Cns/docs/paragraph-line-bidi.md)

The optional readonly paragraph backend now resolves bidirectional order for each actual wrapped line. Latin/Arabic/numeric content, embeddings and isolates use their complete paragraph context, while line endings receive the line-specific reset required by Unicode. The SDK API, cache ownership and UI publication protocol are unchanged. This is a bounded M3.2 integration, not completion of M3.2.

The later [layout controls](paragraph-layout-controls.md) add alignment and line caps. Their adapter translates CRLF/CR only in its private layout buffer and maps public indices back to authored UTF-16; the native bidi algorithm and this historical qualification retain their original scope.

## Why line resolution follows wrapping

A paragraph's resolved shaping levels cannot be reused unchanged for every final line. For example, with the pinned fonts at size 20 and width 95, the source below wraps into UTF-16 ranges [0,11), [11,21), [21,24):

```js
const text = 'abc \u202Bمرحبا 123     \u202C xyz';
```

In the previous optional runtime, the five spaces before PDF retained RTL order and pushed the second line's digits to x≈26. The current runtime places the digits at x=0, resets the spaces to LTR and advances them after the digits. The PDF source position has zero advance. These coordinates describe this exact font/size fixture; they are not portable font metrics.

## Shared native contract

1. Retain the original immutable UTF-16 source and solved P1 paragraphs in a native Sheen context. Capture it before optional tab-to-space replacement; a cache-hit path creates it from the original source when needed.
2. Once wrapping determines actual source ranges, call stock SheenBidi's line API on each range, including trailing spaces, formatting controls and separators. Preserve the full P1 context for embeddings and isolates spanning line boundaries.
3. Translate visual line runs through exact UTF-16/UTF-8 boundaries. A final-line fragment references the canonical shaping Run and clusters, with a separate effective line level. Never change a shared Run's shaping level or copy its mutable justification state.
4. Each drawable cluster owns its glyphs once. Formatting source positions are separate zero-advance logical slots; attached default-ignorable controls must not repaint neighboring glyphs or acquire a proportional share of their width. Ordinary adjacent fragments merge only when canonical storage direction is retained.
5. Drawing, shaped-line visits, selection rectangles, hit queries and justification use the same final fragment order. Effective line direction determines logical endpoints; original storage direction determines glyph slices. Ghost geometry advances by unclipped canonical fragment width, independently of a visitor's clipped ink width.
6. Range checks explicitly reject zero-width or reversed intersections. The native range type's empty sentinel is not an overlap predicate. No fallback silently substitutes the old paragraph order when line resolution is refused.

This internal consistency does not add a public selection/caret/editing API. Native line refusal and allocation failure remain terminal in this backend; memory budgets and recoverable OOM require separate work. Retaining an additional P1 context has not received performance or physical-memory acceptance.

## Assets, source and compatibility

The selected version is `runtime/line-bidi-r1/` in the [vendor manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/manifest.json). Glue is 96,090 bytes; Wasm is 8,600,088 bytes; selected runtime is 8,696,178 bytes. The three unchanged fonts total 17,148,712 bytes, making the selected optional payload 25,844,890 raw bytes. These are not compressed-transfer or live-memory measurements. The earlier runtime remains byte-exact for historical compatibility comparisons and is not loaded by the example.

Apply `source/patches/08-final-line-bidi.patch` after the existing 00–07 chain. The delta covers seven native files. The original full-paragraph solver, private qualification exports, upstream algorithm and legal originals remain intact. The patch was replayed against the exact prior seven-file source state and compared byte-for-byte with the compiled source. A complete clean-machine source rebuild has not been observed. The native Emscripten build uses its separately pinned build-time Node toolchain; repository SDK development and tests require Node 26.7.0.

For patch replay on Windows, use `git -c core.autocrlf=false -c core.eol=lf apply <patch>` so local Git defaults cannot change native source bytes. Compare raw hashes after application; do not normalize compiled inputs or historical evidence.

## Consolidated verification

- Native CPU: 90 text/direction/width cases, each with changed-width and restored-width layout, exact restored rectangles and raster bytes; includes nested isolates, explicit embeddings, multiple P1 paragraphs, empty lines, controls, combining marks and finite default-ignorable/soft-hyphen cases.
- Additional native controls: eight alignment/direction combinations; two explicit line-order/zero-advance/ghost-position oracles; reset-space hit queries on both halves of each space. Eight ordinary Latin/Arabic raster comparisons are byte-identical to the prior runtime.
- Actual Edge 156.0.4314.50, Playwright 1.62.1, Node 26.7.0: WebGL2 and WebGPU each pass 14 integrated checks, including the same native line cases, actual SDK/UI wrapping and height, density, unchanged frames, failed/pending/stale updates, virtualization, pointer routing and resource cleanup. No extra browser flags or physical-device claim.
- Independent source review found and resolved the intersection-sentinel and clipped-ghost-advance defects before final acceptance. The corrected seven-file source received a second independent review.

Run `node --test tests/paragraph-line-bidi.test.mjs tests/paragraph-vendor.test.mjs` for the finite native regression and exact resource identities. Run `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>` for actual browser collection. The latter records the exact HTTP dependencies and raw RGBA hashes and saved screenshots; neither command replaces protected-branch merge checks.

Full Unicode conformance, independent glyph/ink references, unlisted scripts/fonts, native editing/IME, Android/iPhone input, broad browser coverage, performance, GPU timing, physical memory and OOM recovery remain OPEN. The finite ZWJ/combining cases do not advertise emoji or general script coverage. M1.2's full-dirty performance target remains OPEN.

## References and attribution

The integration follows [Unicode 17 UAX #9, L1/L2](https://www.unicode.org/reports/tr9/tr9-51.html#L1) and uses unmodified [SheenBidi](https://github.com/Tehreer/SheenBidi/tree/cfe430e7375a7845b679adae9d51dac6deaa8858). Native shaping and drawing retain the pinned [Skia source](https://skia.googlesource.com/skia/+/e2def78fa232884d4aedcf3ad92d4a0dd673b898). Egret's integration changes, upstream algorithms, derived binaries and original fonts retain their distinct provenance and applicable notices in the [vendor guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/paragraph-panel/vendor/README.md).
