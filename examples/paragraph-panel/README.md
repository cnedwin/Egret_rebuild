# Readonly paragraphs in UI

English | [简体中文](README.zh-CN.md)

This runnable example uses the built public paragraph, UI, pointer and shared-rendering SDK entries. A normal column contains width-aware Latin/CJK and Arabic paragraphs; its orange footer follows their measured height. A second UiRoot virtualizes 24 multilingual records. Row heights come from the same prepared paragraph metrics that produce their images.

Run `pnpm setup:dev` and `pnpm example:browser`, then open `http://127.0.0.1:4173/examples/paragraph-panel/index.html`. WebGL2 is the default; use `?backend=webgpu` to select WebGPU explicitly. The logical scene is 1100×760. The left column starts at (24,28), width 530; the list starts at (646,28), size 420×704.

Narrow/Wide change the column width between 300 and 530. Larger type selects 26px; minimum line height selects 44 logical pixels. Density switches between 1 and 2 without changing logical line geometry. Prepare unchanged exercises existing preparations and cache reuse. Scroll changes the list offset to 380. Click a list row to observe an Engine pointer notification.

Delay update prepares a new paragraph revision while retaining the previous committed image and geometry. Finish publishes the complete replacement. Replace pending width supersedes delayed content with a new width. Fail update deliberately rejects one real provider request; the previous complete UI remains displayed. These are example-only gates around the real CanvasKit provider, not substitute text renderers.

The page exposes `globalThis.__egretParagraphPanel` with `ready`, `inspect()`, `readback()`, `action(name)`, `beginDelayedUpdate()`, `pendingFrame()`, `finishDelayedUpdate()`, `supersedeDelayedUpdate()` and `close()`. Inspection reports committed UI snapshots, genuine preparation metrics, cache counters, provider calls, input events, failures and cleanup state. Readback returns actual host RGBA. The interface is example code, not a product diagnostic export.

The optional resources in `vendor/` contain the identified backend and original Noto fonts with their notices and provenance. Font bytes are verified before registration; no system-font fallback is silently substituted. The example intentionally loads its selected Latin, Arabic and CJK faces for reproducibility. Applications should choose and load only the fonts they need; this example's transfer size is not a core engine size or startup-performance claim.

Readonly paragraphs do not implement editing, selection or native IME. The selected backend integrates final-line L1/L2 with finite [native/browser qualification](../../knowledge-base/en/docs/paragraph-line-bidi.md). This example does not establish full Unicode correctness, unlisted script/font coverage, GPU timing, physical memory, mobile-device behavior or the remaining M3/M4 acceptance gates. Browser observations and controlled lifecycle tests must be reported separately.

The integrated optional browser check is `node examples/paragraph-panel/verify-browser.mjs <playwright-root> <new-output-directory>` after building, with installed Playwright 1.62.1 and Edge. It runs both backends in one pass. [Recorded observations](../../verification/paragraph-sdk/verification.json) distinguish finite behavior from performance, phone, IME and independent glyph/ink acceptance.

## Paragraph layout controls

Align cycles left/center/right/start/end/justify for the article and virtual rows. The two-line control toggles maxLines=2 and unrestricted wrapping. Following geometry updates from the same prepared metrics. A failed or unsupported update keeps the old frame. The selected layout-r1 runtime provides qualified hard-break ellipsis and recoverable narrow-field refusal. See the [contract and latest evidence](../../knowledge-base/en/docs/paragraph-layout-controls.md).
