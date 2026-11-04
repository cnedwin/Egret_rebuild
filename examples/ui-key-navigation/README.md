# Key-directed virtual-list navigation

English | [简体中文](README.zh-CN.md)

This independently authored Apache-2.0 fixture renders 50,000 keyed records through the public optional UI entry. The selected row changes its estimate from 20 to 80 logical pixels; explicit center reveal is followed by checked commit and existing visible-only focus. A white strip paints focus. Native Space cancellation and Enter delivery use the existing Canvas keyboard bridge. The fixture adds no input listeners, assets, fonts or dependencies.

Run the ordinary example server and open `/examples/ui-key-navigation/index.html?backend=webgpu` or `?backend=webgl2`. Click the reveal button. The local collector is `node examples/ui-key-navigation/verify.mjs <Playwright-1.62.1-directory> <new-external-output-directory>`; it uses default Edge without extra flags. It freezes actual runtime imports, source identities and collector helpers before launch, and saves four literal pixel references, raw RGBA, screenshots and cleanup observations. Generated result summaries are outputs, never frozen inputs.

These desktop checks do not qualify smooth scrolling, automatic offscreen Tab traversal, native editing/IME, accessibility, physical phones or performance. See [the contract](../../knowledge-base/en/docs/ui-data-panel.md#key-directed-reveal).
