# Core engineering progress

English | [简体中文](../../Cns/docs/core-progress.md)

## Current reading: engineering preview 0.20.0

The public [explicit-time SequencePlayer](sequence-player-contract.md) connects admitted atlas metadata to a borrowed Bitmap through the root API, with once/loop selection, immutable samples, backward seeks and explicit disposal. The browser example (`examples/sequence-player/README.md`) and opaque verifier (`tools/sequence-player/README.md`) use public entries. Read the contract acceptance section and its compact record for the exact executed source and scope.

Fourteen focused behavior checks passed. The type gate passed 54 root, 5 web and 28 project expected negative diagnostics; the affected B1 source-admission driver passed 13 cases after a narrowly selected delimiter repair. Full prepush is a separate publication gate. The prerequisite [Bitmap native observation](bitmap-region-evidence.md) remains distinct from the new public player observation.

The [Spine specification](spine-animation-support-and-acceptance.md) remains a confirmed requirement, with implementation and acceptance pending. Full A2/alpha calibration, production hosts, fonts/UI/skeletons, target-device performance, editor/Agent and complete R008/V006 migration remain open. Packages stay private at 0.0.0, protocol pins at 1.0; 0.20.0 is an engineering checkpoint.

The sections below retain historical checkpoint results and delivery statuses, including the earlier 403 response. They do not report current publication status or new test execution.

## Historical local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](legacy-movieclip-contract.md), [evidence](legacy-movieclip-evidence.md) and [compact record](../../evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](3d-cpu-scene-contract.md), [mesh](3d-webgpu-mesh-contract.md), [Host](b1-host-contract.md), [sequence](sequence-clip-contract.md) and [RES intents](legacy-res-plan-contract.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](b1-host-evidence.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

## Historical 0.16.0 overview

The local 0.16.0 engineering preview continues the product direction of complex 2D UI and lightweight 3D. This increment covers bounded image-execution source/mock logic, CPU math and mesh data for 3D, and legacy RES declaration analysis. Packages remain 0.0.0 and protocol pins remain 1.0. The label does not constitute a complete engine release; final publication checks, GitHub submission and delivery status are recorded separately.

## Implemented scope and boundaries

| Scope | Implemented bounded contract | Still requires verification |
| --- | --- | --- |
| A2 Task 1 | Owned CPU source-pixel projections with separate premultiplied and straight representations | Browser upload/sampling precision |
| A2 Task 2 | Mixed rectangle/image preparation and image pass descriptors preserving painter order | Real WebGPU execution and pixels |
| A2 Task 3/C1 | Bounded image-vertex packing, in-flight work and cleanup/error-origin source/mock checks | GPU completion, device interoperability and performance |
| A2 Task 4 | Canvas image-source preparation, frame copying and original-source error classification correction | Actual Canvas image pixels and browser comparison |
| A2 Task 5a | CPU upload/blend reference formulas and explicit per-channel error-bound checks | Task 5b browser calibration, Task 6 confirmation and P0–P7 |
| B0/B1 | binary64 math, owned CPU meshes and exact float32 packing | GPU scenes, materials, skinning and animation |
| RES declarations | Strict JSON declaration checks and frozen reports | Files, decoding, execution and complete R008/V006 migration |

Images enter frame preparation through immutable CPU image identities and cropped views. Admission, projection, packing, execution and retirement each enforce their own boundary; an asset lease or source-level pass descriptor does not establish GPU completion. Error classification uses internally registered origins, rather than caller-constructed error classes or codes. Closing and safe return still follow the host lifetime contract; budgets are deterministic work/byte admission bounds, not heap measurements or promises of real OOM recovery.

Canvas remains in the explicit web entry and WebGPU in the opt-in entry. The engine root remains DOM-free and importing it does not start a host. Internal math, mesh, packing and RES helpers add no public facade; deep imports are unsupported as stable product APIs.

## CPU reference formulas

Task 5a's tool identity is tools/texture-oracle.mjs. expectedUploadRGBA selects floor((C*A+127)/255) for integer straight channels. expectedEncodedOver computes continuous binary64 source-over in the premultiplied encoded domain with explicit opacity. It applies neither UNORM quantization nor color transfer conversion. assertTexturePixel takes four explicit absolute channel bounds from the caller and compares only after admitting every argument. It provides no default, unknown or result-fitted tolerance. These tools neither consume/authenticate browser profiles nor prove native blend precision. Independent rational fixtures and actual device calibration retain their separate authority.

## Historical engineering evidence

The table records saved outcomes on each accepted source identity. This documentation work reran no product tests; full totals include the regression set at that checkpoint and cannot be added into a new pass count. Exact historical commits/trees, acceptance-record identities and named current source hashes are in the [curated evidence summary](../../evidence/core-progress-0.16.0.json).

| Scope | Focused passes | Full passes | Preserved correction and scope |
| --- | ---: | ---: | --- |
| A2 Task 1 | 10 | — | The 10 checks belong to the original projection; Task 4 superseded that source |
| A2 Task 2 | 42 | — | 11 new checks and 31 regressions, CPU/mock scope |
| A2 Task 3/C1 | 124 | 515 | Original failed review retained; accepted after allocation-origin correction; Task 4 later superseded the host |
| A2 Task 4 | 193 | 610 | Earlier 193 checks had 182 passes and 11 failures; the origin-classification successor passed |
| A2 Task 5a | 31 | 825 | All 31 behavioral RED checks failed; final 31/825 passed, CPU formulas/bounds only |

Historical 0.13.0 desktop WebGPU rectangle records retain their results and do not validate A2 images, 3D, fonts, animation, phones or Native SDKs. Source hashes establish byte identities; source/mock tests, browser pixels, device performance and complete product acceptance require distinct evidence.

## Next work and contributions

Next steps separately verify actual browser-image behavior in A2 Task 5b/Task 6 and P0–P7, and actual device execution of the source/mock-verified B1 Host. Chinese fonts, complex-UI device budgets, skeleton/frame animation, Native SDKs, mini-game platforms and performance still need their own experiments. Agent/editor V003, complete migration R008/V006 and full V002 renderer/runtime acceptance remain open.

Community contributions can target declared inputs, ownership, error origins and counterexamples, using fixed primary sources to support design proposals. Implementations follow first-party contracts; public dependencies retain attribution and licenses. Complete legacy conversion still requires version/module inventory, behavior/visual comparison, Agent repair/rollback, actual target publication and continued editing.

[3D CPU foundation](3d-foundation.md) · [Legacy RES declarations](legacy-res-declarations.md) · [Contribution guide](../CONTRIBUTING.md) · [Knowledge base](../README.md)
