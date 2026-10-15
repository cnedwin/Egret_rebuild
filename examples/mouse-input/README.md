# Primary mouse Canvas example

English | [简体中文](README.zh-CN.md)

This bounded example uses public `@egret/engine`, `@egret/engine/web` and `@egret/engine/web/input`. Its 160 × 100 logical scene appears at 320 × 200 CSS pixels. The green region covers part of the red region. Input dispatches typed begin, end and activation events; application rendering remains explicit.

Build the SDK through the repository's normal verification workflow, then serve the repository root over HTTP and open `examples/mouse-input/`. The HTML import map includes the three public entry points and exactly four emitted SDK dependencies: `@egret/runtime`, `@egret/contracts`, `#egret-textured-frame-state` and `#egret-mouse-input`. Application JavaScript keeps the three public imports. The accepted profile requires an ordinary connected canvas with zero borders/padding, object-fit fill and no transformed ancestors. This example owns its Engine and Scope and borrows the canvas.

The verifier uses default headless Edge at 900 × 700 with deviceScaleFactor 2, genuine `page.mouse` input and literal Canvas RGBA checks. It separately observes five native listener pairs and the original Scope's frozen-once abort pair. An explicit disposal probe and a second adapter isolate the CSS rejection witness; evidence is grouped by adapter generation. It performs six independent, source-bound single-fragment controls in disposable served copies, without modifying SDK files. The DPR control requires the complete back-only event route to report X=50, Y=25 for the literal input point (25,25); absent events do not establish this witness. Preparation failures preserve their original cause and remain incomplete.

```text
node tools/verify-mouse-input-canvas.mjs --repository <absolute-built-repository> --playwright <absolute-installed-playwright-package> --channel msedge --output <fresh-absolute-directory-outside-repository>
```

Use the generated receipt to identify the executed build, its source identities and actual behavior result. This desktop subset does not establish touch/pen, capture, full UI, phones, Native SDKs or performance. Successful listener calls and post-close inertness do not establish browser/OS memory reclamation.
