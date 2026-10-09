# WebGPU literal rectangle example

[完整中文](README.md)

This example imports only public `@egret/engine` and `@egret/engine/webgpu` APIs to render red .5 then blue .5 rectangles. Build from the repository root with `node tools/build.mjs`, start `node tools/serve-canvas.mjs`, then use its printed loopback address with the path `/examples/webgpu/index.html`. Use a browser with native WebGPU in a secure context; unsupported startup fails explicitly. The ordinary example disables readback. The import map resolves the dependency's public `robust-predicates` root, including its six emitted modules; no product dependency deep import is substituted.

Run the complete native verification from the repository root:

```text
node tools/verify-webgpu.mjs --playwright <installed-playwright-module-directory> --channel msedge --output <private-output-directory-outside-repository>
```

Playwright and pngjs are external verification tools, not product dependencies. The runner loads the supplied Playwright directory's public entry and resolves public pngjs from that directory's module context. If it is installed elsewhere, pass `--pngjs <installed-pngjs-directory>`. No install is performed. The inspected tools are Playwright 1.62.1 and pngjs 7.0.0 (MIT). The runner uses default headless Edge, a fresh nonpersistent profile, secure 127.0.0.1, default adapter/device requests and no additional launch flags. Unsupported startup or a timeout exits nonzero as INCOMPLETE; it never silently falls back or counts as a pass.

The literal oracle uses raw premultiplied RGBA8 from the frozen next-frame public `requestReadback()` ticket, armed before `Engine.renderFrame()`. Expected geometry and color are independent of product helpers. Common UNORM tolerance is two per channel; transparent black and complete reset bytes require exact zero. Strict samples are at least one backing pixel from expected exterior boundaries. The nominal-DPR marker is explicitly a boundary diagnostic. Fan scans cross internal triangulation seams. Separate rational/Canvas coverage compares equivalent premultiplied representations and reports exterior antialias/adjacent-command differences.

The runner also decodes real browser PNG screenshots after two animation frames on opaque black and white page backgrounds, with browser DPR 1 and CSS/backing size 1:1. It records frame/serial, dimensions, CSS, screenshot scale and PNG chunks/profile metadata. Both readback-enabled and disabled configurations are exercised. Screenshots prove browser composition, not physical scanout. The suite covers painter order, alpha inheritance, affine/reflection/composed shear, nested rotated clips and sibling, DPR, full reset/resize, fans and immutable A versus mutated/reparented B.

Bounded lifecycle checks include configured upload/actual device limits, a live pending ticket during close, ordinary borrowed-device survival, explicit destruction of a separate borrowed default device, and a scoped invalid 16-byte buffer descriptor outside any cooperative host lease. This observes real validation, not an OOM threshold or arbitrary driver-reset behavior. Unexpected page/console/network/host errors fail; only the precise controlled-loss diagnostic and scoped validation are expected in their named windows.

Seven finite mutations run against disposable copied engine build trees outside the repository: no-op, reversed order, removed clip, double premultiplication, translation, missing clear and DPR substitution. Each must fail its named literal assertion. Missing clear uses an empty red .5 frame so fresh zeroed browser textures cannot conceal omission. A separately labeled synthetic cached-byte negative checks exhaustive transparent reset assertion machinery. Copies, exact patches, original/copy hashes, raw dumps, PNGs and request logs remain private; final original-product hashes must match. No altered build is a product export.

`result.json` is the authority for the actual run. A selected positive fixture failure remains FAIL/nonzero even when other checks pass; unavailable startup is INCOMPLETE/nonzero. This experimental slice makes no hardware certification, phone, performance, text/texture/UI, 3D, migration or complete-engine claim.
