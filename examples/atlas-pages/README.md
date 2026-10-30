# Multipage atlas example

English | [简体中文](README.zh-CN.md)

After `pnpm setup:dev`, run `node examples/atlas-pages/author.mjs`. It authors original PNG/source files and invokes the actual content build/adoption pipeline. Start `pnpm example:browser` and open `/examples/atlas-pages/index.html?config=/work/atlas-pages/run-XXXXXX/browser-config.json`, substituting the printed run directory. Use the page links or `&backend=webgpu` to choose WebGPU; WebGL2 is the default.

The scene shows two separately named pages, including duplicate local frame names and one trimmed/rotated frame. Release closes the display, data and browser provider owners in order. No touch controls are installed.

The optional finite collector is `node examples/atlas-pages/verify-browser.mjs <playwright-1.62.1-root> <new-output-directory>`. It uses installed default Edge, seven authored pixel points on each backend and two controlled HTTP failure/cancellation contexts. It saves original readbacks, screenshots and source identities; it is not a performance or device benchmark.

Read the [content contract](../../knowledge-base/en/docs/multipage-atlas-content.md). Source/pixels are original first-party Apache-2.0 fixtures. They do not establish Spine, exporter, phone or complete M2 acceptance.
