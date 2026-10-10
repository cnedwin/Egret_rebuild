# Third Round Real Asset Reference Chain Integration Record

English | [简体中文](../../Cns/docs/第三轮集成记录.md)

Updated: 2026-10-08, knowledge base 0.5.0. The first reference chain actually reuses Three r186 glTF import, skeleton cloning, animation sampling, and WebGL renderer, composing Canvas text UI in the same context. Final local desktop main regression: 17 executed, 17 passed, zero failed; page errors and console diagnostics both zero. This supports further Egret adaptation engineering, not a complete product or performance advantage.

[Home](../README.md) · [Third-round plan](round-3-integration-plan.md) · [Independent audit](round-3-audit.md) · [Engineering plan](engineering-plan.md) · [Runnable entry point](../experiments/asset-reference-probe/README.md) · [Raw main report](../../evidence/asset-reference-probe-results.json)

## Pinned components and real asset

Three execution version is r186, commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`, MIT. The previous r180 is historical source research; raw evidence remains and is not combined with current execution as one version. Modules load locally without CDN or installation scripts. The [source inventory](../../experiments/asset-reference-probe/sources.json) retains pinned URLs, Git blobs, SHA256, and sizes for nine files. [Static dependency checks](../../evidence/asset-reference-dependencies.json) confirm detected import closure for five ESM modules.

The asset is embedded RiggedSimple from Khronos glTF-Sample-Assets commit `edc7c9e67c639d230715049ee31f9a96a6babbbe`, attributed to Cesium 2017 under CC-BY-4.0, not CC0. It is a weighted skinned cylinder with one skin, two joints, one clip, 160 vertices, 188 triangles, and 25,435 bytes of JSON with an embedded 11,136-byte buffer, without images, textures, or compression dependencies. It suffices for real import/instance semantics, not complete characters, art quality, or character-control systems. [Third-party notices](../experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) and the original license accompany the asset.

## Egret adaptation and executed behavior

One caller owns the frame loop. Fixed-time renderAt is also the example's only drawing entry. Three provides mature 3D functionality; an independent UI pass owns its program, VAO, Canvas texture, and explicit GL state. Before returning to Three, resetState synchronizes caches with actual state. Shared context does not mean shared executor caches.

A shared bundle retains geometry/material, original scene, and clips. Each instance owns its skeleton pose and Mixer. First release must not end a still-referenced bundle; final release clears its ownership roots. On contextlost, remove only old GPU allocations/listeners, retaining CPU resources for the mature renderer to reupload. Initialization cancellation/failure, pending example startup, and page exit are also ownership boundaries.

Canvas uses native measureText/fillText on whole strings and preserves business text, including combining characters, emoji sequences, and spaces. The current single-string cache invalidates by original text, style, resolution, and explicit fontEpoch. Graphics recovery regenerates textures from retained text/style. System fonts are used; calls and limited pixels are checked without establishing a particular font identity, glyph coverage, Chinese line breaks, IME, or speed.

| Main regression scenario | Predefined behavior | Final result |
| --- | --- | --- |
| Real asset and animation | Real skinned mesh has two bones; pose/nonempty pixels change between 0 and 0.7 seconds | Pass |
| Shared geometry and independent poses | geometry/material shared; skeletons, bone nodes, and Mixers independent | Pass |
| Final-reference release | Remaining instance draws after first release; final shared disposal clears owner roots | Pass |
| 3D/UI state handoff | 12 handoffs; 3D region matches UI-free reference, text nonempty, no GL errors | Pass |
| Canvas original text/cache generations | Native measurement/drawing preserves original text; identical keys reuse, generations/style/resolution invalidate | Pass |
| Required extension rejection | Unsupported required extension rejected before loader success | Pass |
| Optional extension ignored | Real asset remains visible after unknown optional extension ignored | Pass |
| Actual graphics context recovery | Actual loss rejects drawing; restoration yields nonempty 3D/text and equal fixed frame; cleanup has no GL errors | Pass |
| Post-destruction rejection/cleanup | Reject operations, clear ownership roots, prevent resurrection by restoration events | Pass |
| Cancellation during initialization | Explicit rejection without returning a ready instance | Pass |
| Cancellation after startup | Cancel ready owner, release, and reject further rendering | Pass |
| Cancellation after late real-parse result | Dispose parsed resources and allocate no further WebGL | Pass |
| Shader initialization failure cleanup | Preserve controlled shader error; clean parsed resources, renderer listeners, allocated UI handles | Pass |
| Text initialization failure cleanup | Preserve controlled text error; clean parsed resources, renderer listeners, partial UI handles | Pass |
| Repeated example start/stop/restart | Repeated starts during delayed real loading keep one owner/frame loop; stop/restart correct | Pass |
| Leaving during example loading | Reject late active owners/frame loops | Pass |
| Example failure/retry state | Handle startup error, clean resources/frame loop, enable retry button | Pass |

Required-extension checks are Egret reference-profile policy: reject unsupported required names up front while permitting unknown optional extensions to be ignored. The actual asset has no required extensions. The allowlist is not per-extension product acceptance; Draco, KTX2/Basis, and meshopt decoding were neither configured nor executed.

## How failures changed implementation and verdicts

In the clean test-first red version, all 11 cases failed because behavior was unimplemented. Initial favicon 404 noise is also retained; later behavioral red versions had no module/syntax/404 errors. The first implementation reported 11/11 but had seven diagnostics deleting stale GPU handles after recovery. Adding cleanup assertions produced actual 10/11; GL1282 exposed the earlier oracle gap. Removing old GPU dispose listeners for geometry/skeleton textures made recovery and cleanup pass. This is limited to pinned r186 reference-chain behavior, not a universal upstream engine defect.

Four deliberate faults remove renderer reset, end shared bundles early, ignore required rejection, and omit UI recovery. The original 12-case suite caught one case each: state handoff via GL1282, early release via disposal assertions, required extension via incorrect acceptance, UI recovery via blank/different text pixels. A GL error cannot be described as an observed changed 3D pixel. Mutations only check detection and add no main cases.

Independent review additionally found late owners from repeated starts/leaving during load and incomplete acquired-resource rollback after UI initialization failures. Added failing regressions, corrections, and reruns have independent reports; the main table defines final scope. Failures, pre-correction source, and every actual run report remain. The [audit](round-3-audit.md) explains independent verification and final integration rerun responsibilities.

Stopping/restarting the same example before its first frame also exposed UI's UNPACK_PREMULTIPLY_ALPHA_WEBGL=true entering new renderer construction, causing GL1282 and two warnings during empty3D texture upload. Normal restart after the first frame did not reproduce it because that frame changed the state. Retain this genuine normal pass, then reproduce the window using controlled real RAF delivery. After acquiring a reusable context and before renderer construction, the adapter explicitly sets an unpack baseline. This regression is included in the existing example case without additional case counts.

## Package size and product tradeoffs

[File estimates](../../evidence/asset-reference-file-footprint.json) independently calculate 2,313,137 bytes for five untrimmed JS modules plus the embedded asset, with per-file gzip 9 totaling 461,988 bytes and Brotli 11 350,491 bytes. No minification/tree shaking; Egret adapters, HTML, tool metadata, and licenses excluded; no real network/release-package measurement. These values cannot represent the base runtime package, first-playable time, or an advantage over competitors.

Production builds should therefore split by capability: 2D configurations exclude 3D modules, while 3D adds target trimming and dependency inventories. Record initial packages, subpackages, decoders, fonts, and first interaction on real hosts. Three currently reduces integration unknowns and retains replacement boundaries; there is no same-content/same-quality cross-engine speed or package ranking.

## Reproduction and retained limits

Node and Playwright come from the existing execution environment. Enter the reference-chain directory and use these entry points; the environment supplies the Playwright argument. Historical snapshots contain authored modules only. Reproduction temporarily switches to a snapshot following its README, keeps pinned vendor/assets unchanged, and restores current source afterward.

```powershell
node ./run-headless.cjs '<Playwright package root>' verification
node ./server.mjs
```

The test server binds only 127.0.0.1 with a fixed allowlist. Report writes require a temporary random token, bounded target paths, and request sizes. Raw reports record browser 154.0.4258.62, 640×400, DPR 1, antialias=false, preserveDrawingBuffer=true, and source hashes. This readback-validation configuration is not a production default. Final integration execution ID: `d642177d-b007-4c0e-80a2-0f85e150d0c0`. Reruns, historical copies, audits, and mutations do not add main cases.

![Actual pinned-asset reference-chain output](../../evidence/asset-reference-probe.png)

Next: legacy 2D skeleton semantic golden samples, complete 3D characters/complex UI, resource/frame/interactive readiness stages, font providers, target-build trimming, and sustained AI editing. Full 2D attachments/constraints/events, character controls, WebGPU scenes, real phones/mini-game/native hosts, frame time/energy, text coverage/IME, creator tasks, and R008 complete migration still require their own acceptance. D001–D012 remain proposed, H001–H007 untested. V002/V004 have only limited researchProgress; full V002–V006 product implementation/acceptance states remain unchanged. V006 ultimately depends on V001–V005 and retains continued-editing/real-publishing obligations.
