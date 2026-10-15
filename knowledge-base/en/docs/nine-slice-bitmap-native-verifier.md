# NineSliceBitmap native verifier

English | [简体中文](../../Cns/docs/九宫格位图原生核验指南.md)

Engineering preview **0.48.0** · **S102 / V053**. This guide describes the reviewed source interface and frozen browser schedule. Independent review accepted its bounded real WebGPU execution on **2026-10-14**; the [evidence record](nine-slice-bitmap-evidence.md) records the exact scope and historical pending cutoffs. The [leaf contract](nine-slice-bitmap-contract.md) remains separate from renderer verification.

## Explicit mode and inputs

The existing PNG verifier supplies the first-party collector, bounded module graph, raw input/readback recording and browser cleanup mechanisms. NineSliceBitmap uses an explicit opt-in mode:

```text
node tools/verify-browser-png.mjs --nine-slice-bitmap --admission <absolute-reviewed-admission-json> --output <fresh-absolute-directory-outside-repository>
```

The command installs nothing and changes no dependency owner or renderer. A NineSlice admission cannot enter the default PNG route. Omitting this mode retains the previously qualified PNG path; this fixture itself decodes no PNG or font and imports no Spine SDK.

Admission status is `NINE_SLICE_BITMAP_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED`; graph profile is `nine-slice-bitmap`. The encoded-fixture list is explicitly empty, while `schedulePin` binds the original schedule bytes. Required independent review roles are source `plan`, `productSource`, `collectorSource`, and actual `missingEntryRed`, `cpu`, `build`, `strictTypes`, `policy`. Original PASS-qualified zero-finding reviews, full owner/path/raw pins and their source/emission/evidence relationships must match; current hashes alone do not replace original review bindings.

The product binding includes all six changed source files, including Texture's captured intrinsic, and all twelve corresponding JS/DTS emissions. The collector/oracle binding covers the fixture and four host-side files; the original schedule is bound separately. Graph/reader/dependency/runtime pins retain complete identities. The new mode admits only its explicit fixture and the three built public roots `@egret/engine`, `@egret/engine/webgpu`, `@egret/engine/web`; it introduces no generic alias, private product import or wildcard resolver. The physically owned robust-predicates owner accepted for this isolated setup does not change the default PNG owner's requirement.

Installed Node **24.19.0**, Playwright/core **1.62.1** and the actual Edge executable are qualified through original input records. Browser launch remains default headless `msedge`, DPR **1**, without caller-added flags or a replacement executable. Dependency discovery and source approval do not establish a launched browser or GPU identity.

## Frozen composition and oracle

The public fixture is `tools/nine-slice-bitmap-native/fixture.mjs`; independent literal expectations are in `oracle.mjs`, with the exact schedule in `schedule.json`. It creates original **12 × 12** ImageData2D pixels and a genuine Texture crop **(2,2,8,8)**, acquired through the Engine resource manager. The real Scope registers the lease before the leaf. It neither substitutes a structural Texture nor borrows a geometry factory to manufacture expected pixels.

The leaf is positioned at **(2,2)** on a transparent **24 × 24** target with fixed two-unit borders. The frozen schedule is:

| Step | Required observation |
| --- | --- |
| N1 | Construct at 16 × 12; capture and submit the genuine owned textured frame. |
| N2 | Resize to 12 × 16; capture and submit fresh geometry while retaining the original frame. |
| N3 | Retire originating Engine/Scope/lease/Texture/host/device; replay the exact N1 frame on a fresh genuine textured WebGPU host, Engine and device. |

The schedule requires **three submissions**, **two captures**, **one replay**. Each raw RGBA readback has **576 pixels / 2304 channels**, totalling **6912 channels** at tolerance **zero**. N1/replay buffers must also be identical. The Node oracle's original palette/rectangle rows are independent of captured product geometry; raw bytes are retained before assertions. The accepted execution completed this schedule as one main case and independently matched all three full buffers, including the identical N1/N3 2304-byte replay.

## Refusal and retirement

Two separate Canvas negatives require `ENGINE_RENDER_PROFILE_UNSUPPORTED` during Engine profile creation and `CANVAS_FRAME_PROFILE_UNSUPPORTED` when a genuine textured frame is submitted directly to a started Canvas host. The latter compares unchanged native target bytes. Positive Canvas submissions are **zero**; this work adds no Canvas mesh renderer or silent host-mode promotion.

Startup, submission and readback retain their original asynchronous tickets. Before safe return, the fixture checks no pending frame/upload/readback/geometry work, closes the borrowed host, then destroys each application-owned device and observes its loss. Timeout or unsettled originals retain ownership/quarantine and incomplete cleanup. The collector separately owns loopback, context/browser closure, output recording and before/after source/runtime identity checks. Source obligations and successful ordinary cleanup do not by themselves establish forced cancellation or failing-cleanup path acceptance.

The accepted ordinary run settled fourteen outer/fifteen inner tickets, destroyed two application-owned devices and closed context/browser/server without pending tickets or primary/cleanup errors. Source/runtime/graph records were stable; default headless Edge 155.0.4283.45 added no launch flags. Adapter identity was **UNOBSERVED**. Forced-timeout/failed-cleanup paths were not run, and no wrong-oracle countercontrol was executed. At that Native acceptance checkpoint, public-content gates and GitHub delivery were separate pending stages.

## Scope and provenance

This first-party fixture reuses Egret's independently authored NS1, Texture, AssetLease, Scope, owned frame and textured WebGPU contracts. It extends the existing first-party PNG tooling through the named mode and introduces no decoder/shader or runtime dependency. Code, original pixels and literal expectations use Apache-2.0. AI preparation and independent source/result review retain their stated scope.

Native SDKs, phones, mini-game hosts, physical GPU/GC, fonts, power, FPS and comparative performance remain separate obligations. Full UI/EUI/layout, Spine **R020/V020** and migration **R008/V006** remain open. Source, actual browser, complete current prepush, required push hook, PR/Main and remote CI must be reported separately.
