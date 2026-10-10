# Egret Real Asset Reference Chain

English | [简体中文](../../../Cns/experiments/asset-reference-probe/README.md)

A bounded desktop-browser reference implementation. It reuses pinned Three r186 GLTFLoader, SkeletonUtils, and AnimationMixer to load Cesium's RiggedSimple skinned cylinder. It is not a complete character, complete 2D engine, or migration acceptance.

## Running

No dependency installation is needed; use existing Node and Playwright.

```powershell
# Run in this directory; the caller supplies the Playwright package root, without machine paths in code.
node ./run-headless.cjs '<Playwright package root>' green
# Manual example: binds only 127.0.0.1; the console prints this run's local address.
node ./server.mjs
```

The server permits only explicitly listed modules in this directory and pinned asset/upstream files from sources.json. Ports are assigned automatically; ASSET_PROBE_PORT=18767 selects a port. Browser writes require a random run token and target a fixed report file, capped at 256000 bytes. Reports/screenshots go into the knowledge-base evidence/ asset-reference- file family; existing results first receive separate historical files. No CDN, package installation, or public deployment.

Opening the local page first executes 17 real integration cases, after which “查看动画示例” opens the animation example. The manual page displays “验证完成”; only a run with a valid runner token saves reports. Each case records input/expected/actual/limits without timing, energy, or GPU-performance conclusions. After example startup, screenshot, and stop, the runner serializes errors/diagnostics again. The example requires one running owner and actual frames; stop requires no owners/RAF. demoSmoke is recorded separately from main cases. Any case failure, page error, console diagnostic, or demoSmoke failure exits 1.

## API and ownership

`await createReferenceChain(canvas,{assetUrl,fontEpoch,signal?})` returns `acquireInstance()`, `releaseInstance(instance)`, `renderAt(seconds,{ui=true})`, `dispose()`, `waitForRestore()`, `setText(raw,{font,color,resolution,fontEpoch})`, and readable `diagnostics`.

An `instance` retains independent `root` and `mixer`; `timeOffset` permits independent fixed-time samples while geometry/material are shared. Final instance release ends the shared bundle; reacquisition is prohibited and requires a new owner. release is idempotent, clears instance root/mixer, uncaches Mixer, cleans skeleton textures, and clears renderer render lists. Owner disposal also releases; releasing another owner's instance does not modify this owner.

Only the caller owns the frame loop; this module has no RAF/setAnimationLoop. The example's sole RAF drives the same renderAt; stop/pagehide cancels RAF and disposes. Context loss stops frame submission and sets diagnostics to lost. Restoration rebuilds this implementation's UI GPU resources and regenerates Canvas textures from original text/style; Three restores its own rendering resources.

`demo-controller.mjs` installs actual button/pagehide handlers. Pending start immediately acquires AbortController/generation; repeated start is ignored. stop/pagehide cancels and invalidates late results; RAF captures its owner. Failure cleans up, enables retry, retains the original error in diagnostics, and creates no unhandled Promise. `lifecycle-tests.mjs` uses controlled waits around real upstream parsing and actual DOM handlers to check repeated starts, pagehide while loading, stop/restart, stop/restart before first frame, and retry after errors, without replacing scenes/renderers.

Adapter initialization is a bounded transaction. Failed UI initialization cleans partial shader/program/VAO/texture allocations. Failed chain initialization cleans a fully constructed renderer/listeners and parsed CPU bundle, then throws the original error. Tests control actual shader-status checks/native Canvas initialization exceptions and observe real dispose/delete/listener removal. There is no production test switch or general exception framework. No exhaustive analysis is claimed for internal partial allocations before a third-party constructor fully returns.

This chain measured r186 geometry/skeleton-texture GPU dispose listeners retaining old handles before restoration. On lost, public geometry.dispose and instance skeleton.dispose invalidate only obsolete GPU allocations/listeners, retaining CPU geometry/material, bone nodes, animations, and shared references. Three reuploads after restoration. This differs from releaseShared clearing the CPU bundle at final-reference release and is not a universal upstream defect claim.

WebGL2 explicitly uses alpha=true, premultipliedAlpha=true, antialias=false, preserveDrawingBuffer=true for pixel verification. UI owns its shader/VAO in the shared context; Canvas uploads premultiplied data without implicit Y flipping; fragment output matches ONE/ONE_MINUS_SRC_ALPHA blending. Every return to Three calls renderer.resetState; UI explicitly sets required GL state without assuming shared caches.

When recreating a renderer on the same canvas, the adapter first zeroes external-context unpack row/skip/flip/premultiply/PBO state. Three initializes empty3D textures during construction, requiring an upload boundary before its first-frame reset. stop→restart before first frame actually triggered GL1282; the fixed window has zero GL errors. Earlier green normal-restart-after-first-frame records remain and are not misrepresented as red.

Text uses native measureText/fillText without normalizing raw. The current single-texture key includes raw, font/color, resolution, fontEpoch. This is bounded system-font smoke evidence, not full CJK/emoji coverage, IME, multiline/line-breaking policy, or text performance.

Before the loader, required extensions are checked against this reference profile. Unknown required names and unconfigured Draco/KTX2/meshopt decoding are rejected. Unknown optional extensions may be ignored by the loader. The profile does not reinterpret every upstream warning as product acceptance.

## Evidence and reproduction

Green main report: `../../evidence/asset-reference-probe-results.json` and `asset-reference-probe.png`. Each runId corresponds to separate JSON/PNG; repeated red/mutation runs add no main cases. Four mutations remove renderer reset, release shared resources early, ignore required preflight, and omit restoration UI init. Each has actual failure reports and history/ source snapshots.

Initial independent review and the initial integration replay’s 12-case green evidence remain. R1/R2 increase main cases to an actual 17. Five new red→green cases cover shader/text initialization cleanup and real-example duplicate loading/pagehide/error retry. A post-report native-text exception has separate runner-oracle mutation evidence: main 17 still pass, while the new runner correctly reports demoSmoke failure and exits 1 without fabricated main failures.

Historical snapshots retain authored modules with minimal storage. Temporarily copy snapshot authored files into this directory, keep pinned vendor/assets/sources.json unchanged, run the runner, then restore green authored files. SHA256 in historical reports matches those snapshots. Do not start servers from history/; upstream dependencies exist only at this experiment root.

## Pinned provenance and licensing

Three r186: commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`, MIT. Rigged Simple — Cesium (2017), CC BY 4.0; Khronos glTF-Sample-Assets commit `edc7c9e67c639d230715049ee31f9a96a6babbbe`. sources.json contains exact provenance, Git blobs, SHA256. Original licenses: vendor/three/r186/LICENSE, assets/RiggedSimple/LICENSE.md. The skinned cylinder has one animation, one skin, two joints,160 vertices,188 triangles.

Documentation location changed on October 10, 2026. Run the recorded experiment commands from the unchanged shared directory `knowledge-base/experiments/asset-reference-probe` relative to the repository root. This reading-file relocation does not rerun the experiment or alter its original evidence.
