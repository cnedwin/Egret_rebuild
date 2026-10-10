# Display and Frame Implementation Plan

English | [简体中文](../../Cns/docs/显示与帧执行实现计划.md)

Candidate 0.12.0. Authority: [Display and Frame Execution Contract](display-and-frame-execution-contract.md). The plan advances the independent CPU core into a bounded rectangle renderer. It does not accept GPU performance, complete UI, 3D or migration by inference.

## Global Constraints

- Existing Apache-2.0 attribution and independent authorship remain. No original private source or competitor implementation is an input to these changes.
- Keep the dependency DAG contracts → none, runtime → contracts, engine → contracts/runtime. Root core uses strict ES2022, types=[], and no DOM/Node ambient globals.
- Public behavior tests and examples consume built `@egret/engine`; browser tests may consume `@egret/engine/web`. Internal factories and the collector are never reexported by the facade.
- Preserve all existing behavior checks. Use literal geometric/pixel oracles, fail-first tests and explicit adversarial lifecycle cases.
- Public documentation always has a complete Chinese/English pair; critical code uses English comments. Actual evidence includes code identity, environment, limits, failures and corrections.
- Publication requires the recorded checks and separate repository review; no main merge or npm release is part of this milestone.

## Step 1: Display State and CPU Frame Lifecycle

Files: contracts/src/RenderFrame2D.ts and index.ts; runtime/src/DisplayObject.ts, Sprite.ts, Graphics.ts, displayVisualState.ts, frameCapture.ts, index.ts; engine/src/Engine.ts, createEngine.ts, index.ts; related diagnostic types; top-level tests/frame.test.mjs and type fixtures.

Implement the exact contract types, visual defaults, validation, immutable clip copy, Graphics fill snapshot and Sprite ownership. Internal WeakMap state is registered once with each DisplayObject; Graphics has its owning Sprite's liveness and bound-engine guards. Internal `collectFrameCommands(stage: Stage): readonly RectangleCommand2D[]` performs iterative parent-before-child traversal, copies/freezes geometry, and raises FRAME_TRANSFORM_INVALID on derived overflow. It is exported only by runtime as a cross-package implementation port, never by engine.

Implement Engine.captureFrame and renderFrame. Defaults are clearColor=0x000000 and clearAlpha=0. Set busy before external getters; stable render method is captured before surface reservation and invoked using Reflect.apply. A missing port permits captureFrame but rejects renderFrame. Invalid port types/getters raise INVALID_RENDERER before acquiring a surface. After external reads recheck open state. Positive safe frame IDs start at1; failed capture consumes no ID, a failed backend may consume a completed capture. Freeze the whole DTO. Await a frame-idle barrier before shutdown destroys scenes or host work, while state changes to closing immediately. All exits release busy/barrier through finally. Reject a non-undefined backend return and observe a native Promise rejection without accepting asynchronous rendering. Preserve existing shutdown authority and quarantine behavior.

Fail-first tests: literal world matrix and four corners from the contract, draw order with Graphics clear/endFill/fill snapshots, ancestor visibility/alpha, clipping inheritance and immutable snapshots after later scene edits, zero-area omissions, finite/primitive/range rejection with atomic old state, detached bound mutation after closing, hostile public getters not consulted, deep iterative tree, options getter reentry and dispose, backend dispose waiting for render unwind, backend throw/invalid return and diagnostic isolation, original receiver and hostile function.call/property replacement, pre-reservation getter rejection, failed derived overflow with no backend call, missing renderer with capture still available. Add meaningful readonly DTO / invalid async-port type checks. Build and run relevant tests, then all existing core gates.

Preserve versioned code and tests with attributable authorship. Keep raw red/green logs outside the public source tree; publish curated results and identity-only receipts. Record commands, counts, failures/corrections, source revision and unresolved concerns.

## Step 2: Canvas Web Adapter and Real Browser Acceptance

Files: engine/web/CanvasHost.ts and index.ts, separate engine/tsconfig.web.json, engine package exports and root project references; tools/check-boundaries.mjs; tests/canvas-host.test.mjs, type fixtures; examples/canvas-scene/*; tools/verify-canvas.mjs and related narrowly scoped browser harness.

Compile browser sources separately to dist/web with ES2022+DOM and project references to contracts/runtime. The root tsconfig excludes web and its root export never imports/reexports it. Allow DOM only in that exact web subtree; still reject Node imports/globals, unapproved dependencies and leaking internal ports. Add a DOM-free consumer check and import-side-effect checks.

Implement createCanvasHost with pixelRatio=1 and maxBackingPixels=16777216, stable input copy, lifecycle states, synchronous render gate and close idle barrier. surface is exactly the supplied canvas. Validate/copy full DTO, transformed endpoints/corners, scaled matrices and all dimensions before canvas/context mutation; recheck active after getters. Backing sizes use ceil, the unsigned-long bound4294967295 and budget arithmetic safely. After validation reassign dimensions every frame to reset bitmap/clip/path/state. Normalize shadows/filters/compositing/alpha and implement the contract's order, transforms, clipping, opacity and per-command save/restore. Canvas is exclusively owned for drawing during host lifetime; do not promise preservation of external state/path/pixels. Borrowed DOM element remains external ownership. Add incoming clip/shadow/filter counterexamples; close during drawing stops later commands at safe boundaries. A host may not be shared by two engines.

Serve a runnable example through an import map using the built core and web adapter; pointer interaction changes a scene and renders again, without claiming a general input system. Serve favicon. Reuse the installed Edge and pinned bundled Playwright for real-browser verification; no production dependency is added. Acceptance includes literal overlap pixels (64,0,128,255) with tolerance2, parent alpha, translated/rotated/scaled geometry, rotated clip and sibling isolation, DPR dimensions and pixels, frame clearing, rejection before invalid frame mutation, terminal close rejection, visible example pointer interaction, unexpected page/console/network failures. Include a no-op executor counterexample proving pixel checks fail. Record browser/automation versions and adapter conditions; no physical-device, GPU or performance conclusion.

Run the complete core gate after browser checks. Preserve implementation and evidence scripts with the same bounded reporting discipline as Step 1.

## Step 3: Public Evidence, Bilingual Publication and Remote Verification

Files: README/architecture/implementation/evidence pairs and knowledge-base index/registries; localization.json; source-origin.json; verification identities and critical English comment index; release metadata/manifest and delivery records. Preserve historical evidence and the sealed 0.11.0 candidate.

Record actual acceptance, regressions and independent review with precise limits. Register new spec/evidence IDs without altering historical identity hashes or falsely accepting unimplemented UI/fonts/skeletons/3D/migration. Update the source-origin independent file set and current paired document/comment hashes using inspectable tooling. Audit public wording, references, translation parity, dependency/license attribution and exclusion of private work/credentials.

Run tools/prepush.mjs, publication regression tests and the real browser gate on final identities. Create a user-facing 0.12.0 candidate under outputs with a complete manifest/archive and report. Fast-forward the existing draft PR branch after successful checks; update its bilingual description to the final scope. Independently fetch and compare remote commit/tree/bytes/modes with the candidate; verify main remains unchanged. GitHub errors are reported and bounded, while independent local development continues.

After this milestone, proceed to the separately specified project transaction model and subsequent rendering/resource work. This plan does not close the overall engine reconstruction.
