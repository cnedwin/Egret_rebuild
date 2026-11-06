# Readonly paragraphs in UI

English | [简体中文](README.zh-CN.md)

This runnable example uses the built public paragraph, UI, pointer and shared-rendering SDK entries. A normal column contains width-aware Latin/CJK and Arabic paragraphs; its orange footer follows their measured height. A second UiRoot virtualizes 24 multilingual records. Row heights come from the same prepared paragraph metrics that produce their images.

Run `pnpm setup:dev` and `pnpm example:browser`, then open `http://127.0.0.1:4173/examples/paragraph-panel/index.html`. WebGL2 is the default; use `?backend=webgpu` to select WebGPU explicitly. The logical scene is 1100×760. The left column starts at (24,28), width 530; the list starts at (646,28), size 420×704.

Narrow/Wide change the column width between 300 and 530. Larger type selects 26px; minimum line height selects 44 logical pixels. Density switches between 1 and 2 without changing logical line geometry. Prepare unchanged exercises existing preparations and cache reuse. Scroll changes the list offset to 380. Click a list row to observe an Engine pointer notification.

Delay update prepares a new paragraph revision while retaining the previous committed image and geometry. Finish publishes the complete replacement. Replace pending width supersedes delayed content with a new width. Fail update deliberately rejects one real provider request; the previous complete UI remains displayed. These are example-only gates around the real CanvasKit provider, not substitute text renderers.

The page exposes `globalThis.__egretParagraphPanel` with `ready`, `inspect()`, `readback()`, `action(name)`, `beginDelayedUpdate()`, `pendingFrame()`, `finishDelayedUpdate()`, `supersedeDelayedUpdate()` and `close()`. Inspection reports committed UI snapshots, genuine preparation metrics, cache counters, provider calls, input events, failures and cleanup state. Readback returns actual host RGBA. The interface is example code, not a product diagnostic export.

The optional resources in `vendor/` contain the identified backend and original Noto fonts with their notices and provenance. Font bytes are verified before registration; no system-font fallback is silently substituted. The example intentionally loads its selected Latin, Arabic and CJK faces for reproducibility. Applications should choose and load only the fonts they need; this example's transfer size is not a core engine size or startup-performance claim.

Readonly paragraphs do not implement editing, selection or native IME. The selected backend integrates final-line L1/L2 with finite [native/browser qualification](../../knowledge-base/en/docs/paragraph-line-bidi.md). This example does not establish full Unicode correctness, unlisted script/font coverage, GPU timing, physical memory, complete mobile-device qualification or the remaining M3/M4 acceptance gates. Browser observations and controlled lifecycle tests must be reported separately.

The integrated optional browser check is `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>` after building, with installed Playwright 1.62.1 and Edge. It runs both backends in one pass. [Recorded observations](../../verification/paragraph-sdk/verification.json) distinguish finite behavior from performance, phone, IME and independent glyph/ink acceptance.

## Paragraph layout controls

Align cycles left/center/right/start/end/justify for the article and virtual rows. The two-line control toggles maxLines=2 and unrestricted wrapping. Following geometry updates from the same prepared metrics. A failed or unsupported update keeps the old frame. The selected layout-r1 runtime provides qualified hard-break ellipsis and recoverable narrow-field refusal. See the [contract and latest evidence](../../knowledge-base/en/docs/paragraph-layout-controls.md).

## Styled equipment descriptions

Select **Equipment styles** to switch the ordinary column and virtual list to an authored equipment description, or open ?content=equipment (combine with backend=webgpu when needed). Gold headings, smaller rarity text, colored statistics and an explicit CJK font range share one complete paragraph layout. Narrow/Wide, larger type, alignment, two-line truncation and density keep using the existing controls. The footer and recycled rows use the same final measured height; the example adds no separate text renderer or input behavior. Select Equipment styles again to restore the original plain content. The default URL retains the original fixed fixture.

The pure styled-copy.mjs module builds source text and immutable UTF-16 ranges together. UI content revisions own the request snapshot; delayed, failed or superseded requests retain the previous committed image and geometry. This is readonly styling, not rich-text editing, arbitrary HTML/CSS, touch controls or a font/performance qualification. See the [styled paragraph contract](../../knowledge-base/en/docs/paragraph-styled-runs.md).

The example sets a 32 MiB paragraph image-cache budget for overlapping old/new UI transactions at density 2; engine defaults and raster limits are unchanged. Equipment rows start from a conservative 540-unit estimate and settle to measured height. Run node examples/paragraph-panel/verify-equipment.mjs <playwright-root> <new-output-directory> for the finite styled UI checks. [Recorded results and limits](styled-verification-summary.json).

## Optional shared effects

Open `?content=equipment&effects=1&backend=webgl2` or `backend=webgpu` to inspect the same UI with masks and box blur. Cycle all four modes with the effects button; both article and virtual rows republish together. Default content and input routing remain unchanged. See the [effect contract](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/shared-ui-effects.md) for limits, ownership, recovery and qualification.

## Font resources

After building, run node tools/content/author-font-example.mjs. Add its configPath to the example URL as ?fontConfig=<configPath>&backend=webgl2 (or webgpu). The new button changes article fonts while the list keeps its own generation. Failed/cancelled/superseded replacements preserve committed UI; unused font sets retire. Run node examples/paragraph-panel/verify-fonts.mjs <playwright-1.62.1-root> <new-output-directory>. See [font ownership and limits](https://github.com/cnedwin/Egret_rebuild/blob/main/knowledge-base/en/docs/font-resource-generations.md).

Equipment style ranges follow the font group captured for their UI revision. The example keeps the named Noto Sans CJK SC family when present; an alternate group uses its own registered fallback stack. A font face registered under another alias does not register the old name. Unknown-family requests still refuse, and failed candidates preserve committed content. The default/fixed-font fixture, provider admission, fonts and existing byte limits are unchanged. See the [Android component record](../../knowledge-base/en/docs/android-device-validation.md) for the real-device reproduction and its limits.
