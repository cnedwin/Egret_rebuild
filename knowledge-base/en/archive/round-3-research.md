# Third-round research record

English | [简体中文](../../Cns/archive/第三轮研究.md)

Historical research from October 8, 2026. This consolidated record retains the original research/plan, execution and independent audit in order. Statements, dates, results, failures and limitations describe those checkpoints; consolidation on October 10, 2026 adds no experiment or product acceptance. Raw evidence and source snapshots remain at their original shared locations.

[Research / plan](#research) · [Execution](#execution) · [Independent audit](#audit) · [Knowledge base](../README.md)

<a id="research"></a>

## Third Round Real Asset Reference Chain Integration Plan

Updated: 2026-10-08. Under R012, this round prioritizes mature implementations and validates Egret's new interfaces and handoff boundaries. This is a research execution plan; actual results are recorded separately. Plans, source downloads, and static checks do not constitute execution passes.

[Engineering plan](../docs/engineering-plan.md) · [Open-source adoption plan](../docs/open-source-reference-implementations-and-adoption.md) · [Second-round historical validation](round-2-research.md#execution)

### Inputs and tradeoffs

Use the currently verified pinned Three r186 commit to integrate its mature renderer, GLTFLoader, AnimationMixer, and SkeletonUtils into a local WebGL2 reference chain. Retain r180 as the previous source-research snapshot without conflating it with this execution version. Check all third-party bytes against fixed Git blobs, compute SHA256 separately, retain licenses, and run no installation scripts.

The first real asset is RiggedSimple: a cylinder mesh with weighted skinning and keyframes, one skin, two joints, and one animation. It has real glTF import semantics but is not a complete character. Its embedded version has no external texture/compression dependencies, isolating loading, instancing, and recovery. See [third-party notices](../experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) and the [file inventory](../../experiments/asset-reference-probe/sources.json) for provenance and attribution.

### Behaviors to validate in Egret's adaptation

| Integration boundary | Actual observation | Failure condition |
| --- | --- | --- |
| Real asset and animation | Loader creates SkinnedMesh; separate instances advance with Mixer; bones and rendered output change | Only procedural joints, only JSON parsing, invisible mesh, or no animation execution |
| Shared resources and instances | Two instances share geometry/material but retain independent poses; second still draws after first exits; final release reclaims resources | Premature destruction, invalid remaining instance, residual Mixer/skeleton instances |
| 3D/UI state handoff | Three and an independent UI executor alternate on one context; compare the 3D region with a clean UI-free reference | One-time state initialization only, or UI shader/VAO/blend/clip contaminates the next frame |
| Canvas text and cache | Native whole-string measurement/drawing, reuse for identical input, invalidation on fontEpoch change, original text retained | Reimplementing glyph algorithms, unauthorized NFC normalization, old cache overriding new dependencies |
| Import and destruction | Reject unsupported required extensions before import; no rendering/resurrection after destruction/cancellation | Treating loader return as proof all effects are available, or late results continuing to bind |
| Actual device-context recovery | Actual contextlost blocks submission; restored recreates UI resources and restores fixed-time asset/text output | Reporting the work available at the restoration event, blank output, or restoring handles only |

Write failing cases and observe missing behavior first, then implement minimal adaptation and run the actual browser. Retain failure/current reports, source, and environment. Use limited fault mutations at critical new boundaries to confirm tests detect handoff/resource/required/recovery errors. Do not build replacement models for routine upstream algorithms.

### Outputs and boundaries

Deliver an offline-rerunnable reference chain, viewable output, pinned dependencies/assets, red/green reports, bounded counterexamples, independent source review, and knowledge-base updates. The test server provides explicit local-only routes; there is no public deployment or execution of users' private legacy projects.

This round excludes actual KTX2/Basis transcoding; complete 2D skeletons/attachments/constraints; multicharacter control trees; production-scale complex UI; WebGPU scene backends; mini-game/native hosts; and real phones. Canvas system fonts supply limited drawing/cache checks only, not Chinese font identity/coverage/quality, IME, or rendering performance. CPU/GPU frame time, energy use, temperature rise, package-size advantages, the AI creator loop, and R008 complete migration require acceptance in actual environments. The existing 71 results retain their original scope and are not counted again.

<a id="execution"></a>

## Third Round Real Asset Reference Chain Integration Record

Updated: 2026-10-08, knowledge base 0.5.0. The first reference chain actually reuses Three r186 glTF import, skeleton cloning, animation sampling, and WebGL renderer, composing Canvas text UI in the same context. Final local desktop main regression: 17 executed, 17 passed, zero failed; page errors and console diagnostics both zero. This supports further Egret adaptation engineering, not a complete product or performance advantage.

[Home](../README.md) · [Third-round plan](round-3-research.md#research) · [Independent audit](round-3-research.md#audit) · [Engineering plan](../docs/engineering-plan.md) · [Runnable entry point](../experiments/asset-reference-probe/README.md) · [Raw main report](../../evidence/asset-reference-probe-results.json)

### Pinned components and real asset

Three execution version is r186, commit `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`, MIT. The previous r180 is historical source research; raw evidence remains and is not combined with current execution as one version. Modules load locally without CDN or installation scripts. The [source inventory](../../experiments/asset-reference-probe/sources.json) retains pinned URLs, Git blobs, SHA256, and sizes for nine files. [Static dependency checks](../../evidence/asset-reference-dependencies.json) confirm detected import closure for five ESM modules.

The asset is embedded RiggedSimple from Khronos glTF-Sample-Assets commit `edc7c9e67c639d230715049ee31f9a96a6babbbe`, attributed to Cesium 2017 under CC-BY-4.0, not CC0. It is a weighted skinned cylinder with one skin, two joints, one clip, 160 vertices, 188 triangles, and 25,435 bytes of JSON with an embedded 11,136-byte buffer, without images, textures, or compression dependencies. It suffices for real import/instance semantics, not complete characters, art quality, or character-control systems. [Third-party notices](../experiments/asset-reference-probe/THIRD_PARTY_NOTICES.md) and the original license accompany the asset.

### Egret adaptation and executed behavior

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

### How failures changed implementation and verdicts

In the clean test-first red version, all 11 cases failed because behavior was unimplemented. Initial favicon 404 noise is also retained; later behavioral red versions had no module/syntax/404 errors. The first implementation reported 11/11 but had seven diagnostics deleting stale GPU handles after recovery. Adding cleanup assertions produced actual 10/11; GL1282 exposed the earlier oracle gap. Removing old GPU dispose listeners for geometry/skeleton textures made recovery and cleanup pass. This is limited to pinned r186 reference-chain behavior, not a universal upstream engine defect.

Four deliberate faults remove renderer reset, end shared bundles early, ignore required rejection, and omit UI recovery. The original 12-case suite caught one case each: state handoff via GL1282, early release via disposal assertions, required extension via incorrect acceptance, UI recovery via blank/different text pixels. A GL error cannot be described as an observed changed 3D pixel. Mutations only check detection and add no main cases.

Independent review additionally found late owners from repeated starts/leaving during load and incomplete acquired-resource rollback after UI initialization failures. Added failing regressions, corrections, and reruns have independent reports; the main table defines final scope. Failures, pre-correction source, and every actual run report remain. The [audit](round-3-research.md#audit) explains independent verification and final integration rerun responsibilities.

Stopping/restarting the same example before its first frame also exposed UI's UNPACK_PREMULTIPLY_ALPHA_WEBGL=true entering new renderer construction, causing GL1282 and two warnings during empty3D texture upload. Normal restart after the first frame did not reproduce it because that frame changed the state. Retain this genuine normal pass, then reproduce the window using controlled real RAF delivery. After acquiring a reusable context and before renderer construction, the adapter explicitly sets an unpack baseline. This regression is included in the existing example case without additional case counts.

### Package size and product tradeoffs

[File estimates](../../evidence/asset-reference-file-footprint.json) independently calculate 2,313,137 bytes for five untrimmed JS modules plus the embedded asset, with per-file gzip 9 totaling 461,988 bytes and Brotli 11 350,491 bytes. No minification/tree shaking; Egret adapters, HTML, tool metadata, and licenses excluded; no real network/release-package measurement. These values cannot represent the base runtime package, first-playable time, or an advantage over competitors.

Production builds should therefore split by capability: 2D configurations exclude 3D modules, while 3D adds target trimming and dependency inventories. Record initial packages, subpackages, decoders, fonts, and first interaction on real hosts. Three currently reduces integration unknowns and retains replacement boundaries; there is no same-content/same-quality cross-engine speed or package ranking.

### Reproduction and retained limits

Node and Playwright come from the existing execution environment. Enter the reference-chain directory and use these entry points; the environment supplies the Playwright argument. Historical snapshots contain authored modules only. Reproduction temporarily switches to a snapshot following its README, keeps pinned vendor/assets unchanged, and restores current source afterward.

```powershell
node ./run-headless.cjs '<Playwright package root>' verification
node ./server.mjs
```

The test server binds only 127.0.0.1 with a fixed allowlist. Report writes require a temporary random token, bounded target paths, and request sizes. Raw reports record browser 154.0.4258.62, 640×400, DPR 1, antialias=false, preserveDrawingBuffer=true, and source hashes. This readback-validation configuration is not a production default. Final integration execution ID: `d642177d-b007-4c0e-80a2-0f85e150d0c0`. Reruns, historical copies, audits, and mutations do not add main cases.

![Actual pinned-asset reference-chain output](../../evidence/asset-reference-probe.png)

Next: legacy 2D skeleton semantic golden samples, complete 3D characters/complex UI, resource/frame/interactive readiness stages, font providers, target-build trimming, and sustained AI editing. Full 2D attachments/constraints/events, character controls, WebGPU scenes, real phones/mini-game/native hosts, frame time/energy, text coverage/IME, creator tasks, and R008 complete migration still require their own acceptance. D001–D012 remain proposed, H001–H007 untested. V002/V004 have only limited researchProgress; full V002–V006 product implementation/acceptance states remain unchanged. V006 ultimately depends on V001–V005 and retains continued-editing/real-publishing obligations.

<a id="audit"></a>

## Third Round Real Asset Integration Audit

Updated: 2026-10-08, knowledge base 0.5.0. Two lifecycle gaps found by independent AI review passed failing regressions, corrections, and limited rereview. Final integration reran the same source: all 17 main checks passed, normal example startup/shutdown passed, and page errors and console diagnostics were both zero. This conclusion applies only to the current desktop WebGL2 reference chain.

[Integration record](round-3-research.md#execution) · [Engineering plan](../docs/engineering-plan.md) · [Source review](../../evidence/asset-reference-source-audit.json) · [Initial code review](../../evidence/asset-reference-code-review-initial.json) · [Final code review](../../evidence/asset-reference-code-review.json) · [Current execution](../../evidence/asset-reference-probe-results.json)

### Evidence responsibilities and review scope

A source researcher checked maintained versions and pinned provenance. Integration verification acquired original files and checked Git blob/SHA256, licenses, and dependency closure. Another reviewer independently recalculated nine files, five module dependencies, and six-file compression estimates. Source audit did not execute the engine; its conclusions exclude execution and performance.

The implementer first retained a genuine red version lacking required behavior, then integrated mature components. Code reviewers read actual code, failure/current reports, and source digests without rerunning browsers or upstream test suites. Initial specCompliance and quality both required changes. Final specCompliance was pass_with_stated_scope and quality acceptable_with_stated_limits, with no required correction. Final review binds ten Egret-authored files and 19 current execution source digests.

Final integration reran the same frozen source with execution ID d642177d-b007-4c0e-80a2-0f85e150d0c0: 17/17, runnerOutcome exitCode 0. Example startup had one active owner and actually submitted frames; after stop, active owners and pending RAF were zero. Frame counts only establish drawing occurred, not frame rate or performance.

### Findings and corrections

| Actual issue | Counterevidence and correction | Conclusion boundary |
| --- | --- | --- |
| Old GPU cleanup listeners referenced stale handles after recovery | Initial 11/11 had seven diagnostics; adding cleanup assertions produced 10/11 and GL1282. On loss, remove old GPU allocation listeners for geometry/skeleton textures while retaining the CPU bundle; Three uploads again after restoration. | Limited to pinned r186 reference chain. GPU invalidation is not final CPU-reference release, and this does not establish a defect in all upstream scenes. |
| UI initialization exceptions retained acquired resources | Five of the new 17 checks failed; initial rollback fix reached 14/17. Controlled shader/Canvas failures after real parse exposed retained parsed resources, renderer listeners, and partialUI handles. Local transactional rollback retained the original error; dispose-event/listener/handle assertions passed. | Establishes rollback for adapter-acquired resources. Internal objects before a third-party constructor fully returns, arbitrary parsers/OOM, and heap leaks are not exhausted. |
| Repeated example starts or leaving during loading accepted late owners | Actual buttons and window pagehide entered production handlers; failing version created duplicate owners/RAF or late active instances. Synchronous pending, AbortSignal, generation, captured-owner frame loops, and error handling brought results to 17/17. | Controlled real-parse completion validates current handlers, not a platform lifecycle matrix. |
| Stop/restart before the first frame inherited unpack state | Actual restart after a normal first frame passed; a name containing red does not make it a failure. Controlling real RAF delivery produced one failure among 17, GL1282, and two warnings. Explicitly resetting acquired-context unpack state before renderer construction passed. | No upstream modification; controlled timing is not phone-delay measurement. |
| Runner reported success when main regressions passed but example failed | A real Canvas exception controlled only in the example phase made the old runner incorrectly exit 0. Example status/original-error checks, final diagnostic serialization, and strict exit codes produced exit 1 while truthfully retaining 17 main passes. | Example smoke/negative control add no main cases. The 250ms observation window is a current-environment check; slow environments may conservatively fail. It is not a product performance metric. |

Four original faulty mutations remain. Omitting state reset is caught by GL1282; early release by shared-dispose assertions; ignoring required extensions by erroneous acceptance; and missing UI recovery by blank/different text pixels. One verdict is not substituted for another, and multiple runs are not accumulated into pass counts.

### Provenance and historical integrity

[Report integrity](../../evidence/asset-reference-report-integrity.json) recalculates case counts and correspondence of 835 source-digest entries in 47 retained reports. The independent code reviewer checked again; all match current or historical source. The 47 include copies and reruns, and 835 counts comparison entries rather than unique files, features, or tests. The original author's 202 digests over 12 runs and 188 new lifecycle digests remain separately in the [original audit](../../evidence/asset-reference-source-snapshot-audit.json) and [new audit](../../evidence/asset-reference-lifecycle-source-snapshot-audit.json), without overwriting one another.

Before this round's write, 150 digests from 0.4.0 were checked again. Complete 0.4.0 and the three earlier versions remain in internal history. Previous experiments/evidence bytes do not change with this update. reviewedDocumentHashes in the old open-source review bind retained 0.4.0 documents and cannot validate updated 0.5.0 text. The [current version](../../Cns/当前版本.json) records historical binding. [Integration verification](../../evidence/asset-reference-integration-audit.json) separately binds current candidate documents.

One newly added historical author Markdown report contained local paths. Under the [path-metadata record](../../evidence/asset-reference-path-metadata-normalization.json), only workspace and execution-tool positions were replaced; original bytes remain internally retained. Execution JSON, source, cases, counts, failures, and conclusions were not rewritten.

### Conclusions this evidence still cannot establish

RiggedSimple is a textureless, two-joint skinned cylinder, not a complete character or complex 3D scene. An allowlist is not extension compatibility acceptance; KTX2/Basis, Draco, and meshopt were neither configured nor executed. Original text, caching, and limited pixels from Canvas system fonts do not establish font identity/coverage, CJK line breaking, IME, or speed.

Recovery requires nonempty 3D and bright text pixels plus equality at a fixed frame; two blank images cannot pass. It still does not establish recovery of interaction, animation business events, or a complete work. UI covers current simple textures/rectangles and state handoff only, without complete EUI, 2D attachments/constraints/clipping, arbitrary masks/filters, or multiple cameras.

There is no GC/heap proof, real phone/mini-game/native host, WebGPU scene, frame timing, energy use, thermal stability, cold start, or same-content cross-engine advantage data. Local file compression estimates are not actual release packages. D001–D012 remain proposed and H001–H007 untested; full V002–V006 product implementation/acceptance remain unchanged. R008/V006 retain final obligations for one-click migration, continued editing, and real publishing.

[Knowledge-base verification](../../核验记录.json) checks structure, references, path markers, and file digests only; the tool does not execute engine or product acceptance. Current document consistency/digest checks are separately recorded in integration verification. Passing links cannot replace execution, review, or product evidence above.
