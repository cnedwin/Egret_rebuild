# UI data panel example

English | [简体中文](README.zh-CN.md)

This finite desktop example uses built public `@egret/engine`, `@egret/engine/ui`, text, browser pointer and shared WebGPU/WebGL2 entries. Thirty stable rows have repeating heights 24/40/64, solid original colors, a checked bitmap and explicit Ahem X/space lines. Engine owns rendering, clipping and row hits. The DOM buttons are example controls for public setters.

The logical scene is 960×640. Panel A starts at (24,32), 420×360, density 1; Resize selects 600×480, density 2, and Move selects (48,64). Scroll 92 fixes row-02 at offset 28; Scroll 640 exercises recycling; Return restores 92. Delay replacement keeps the old complete row until Finish publishes a height-80 magenta row-02. Panel A supplies explicit list dimensions initially and when resized, retaining its current source identity. Panel B is an Engine column at (700,12), 200×148: its horizontal 20-high toolbar has 96-wide blue and 104-wide brown solid leaves, followed by the 200×128 list at global y=32. Toolbar leaves are decorative and produce no row hit. Its existing row positions remain unchanged, and B stays independent and usable. Close releases both roots, input, cache, font and Engine.

Run `pnpm setup:dev` and `pnpm example:browser`, then open `http://127.0.0.1:4173/examples/ui-data-panel/index.html?backend=webgpu` or replace the backend with `webgl2`. The existing example server and finite verifier resolve the exact import map to the installed pinned dependency. Neither public example nor verifier imports private SDK files directly.

After a reviewed frozen build, run:

```text
node examples/ui-data-panel/verify.mjs --playwright <absolute-installed-playwright-1.62.1-package> --output <new-absolute-directory-outside-repository>
```

The example-local collector freezes the literal fixture, source/declarations/configuration, built literal-import closure, original assets and provenance before launching default headless Edge without extra flags. It verifies exact solid interior/clip pixels, actual mouse hits, scroll/resize/move/recycle, delayed old-complete publication, retained-frame replay and cleanup separately on both backends. It retains full raw RGBA, screenshots, source hashes, hit sequence and cleanup in the output. Read `result.json`: source implementation or fixture tests alone are not browser acceptance, and unavailable backends remain OPEN.

The exact-pixel domain excludes text antialiasing regions (local x 40..64, y 4..16 in each row); font/backend differences there have no general tolerance claim. Explicit text uses TF1 only. This example does not establish paragraphs, shaping, keyboard/native input, focus/IME, mobile/real touch/pen, automatic wheel policy, full controls/accessibility, physical memory or timing/capacity acceptance. See [provenance](PROVENANCE.md).
