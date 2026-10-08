# Canvas scene

English | [简体中文](README.md)

From the repository root, build with `node tools/build.mjs`, then run `node tools/serve-canvas.mjs` and open its printed local URL. Click or tap the canvas to move the blue rectangle and submit a new frame. This example demonstrates one DOM pointer listener; it does not implement general input or hit testing.

The browser uses an import map for the built `@egret/engine` and `@egret/engine/web` entries. Importing either entry starts no host or scheduler. The root remains DOM-free; the web entry compiles separately with DOM types. `createCanvasHost({canvas, pixelRatio:1, maxBackingPixels:16777216})` defaults to logical pixel ratio 1. It uses the supplied canvas itself as fixed surface identity. Canvas drawing is exclusively controlled by the host while active; the host does not remove the borrowed element or dispose externally owned listeners. Every frame resets bitmap, paths, clips and drawing state. Invalid DTOs and derived geometry reject before mutation. Native allocation can still fail despite accepted dimensions and budget; context loss is checked before and after drawing where supported.

For real browser acceptance using an already installed Playwright and branded browser, run:

```text
node tools/verify-canvas.mjs --playwright <installed-playwright-directory> --channel msedge --output <evidence-directory>
```

`PLAYWRIGHT_MODULE` can supply the module directory instead of `--playwright`. No browser download or production dependency is needed. The runner captures page, console and network failures, screenshots, browser/automation versions, actual pixels, pointer-driven bitmap changes and the intentionally failing no-op executor. Literal overlap expects (64,0,128,255), tolerance 2. Coverage includes parent alpha, transforms, rotated clips, sibling isolation, DPR, clearing, invalid submission, terminal close and bounded narrow allocation observations. Desktop Canvas results establish neither phone, GPU nor performance coverage.
