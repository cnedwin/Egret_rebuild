# Third Round Real Asset Reference Chain Implementation Report

English | [简体中文](../../Cns/evidence/asset-reference-pre-review-implementation-report.md)

Record status: **DONE_WITH_CONCERNS**. Implementation of the bounded reference chain, test-first evidence, four fault mutations, reports, and screenshots is complete. The frozen code version awaited independent review and a fresh rerun. This report records the pre-review snapshot and does not replace subsequent review conclusions.

## Delivered files

New experiment root: `outputs/白鹭引擎重构工程知识库/experiments/asset-reference-probe/`.

- `reference-chain.mjs`: mature glTF/cloning/animation/renderer and ownership boundaries.
- `ui-pass.mjs`: independent shader/VAO/native Canvas text textures/color blocks within one WebGL2 context.
- `integration-tests.mjs`: real-browser cases, independent literal expectations, real pixels, and dispose-event assertions.
- `probe.js`, `index.html`: Chinese verification page and post-verification animation example; manual access displays “验证完成”, while a valid runner token permits “已保存”.
- `server.mjs`:127.0.0.1 only, automatic ports or ASSET_PROBE_PORT, exact allowlist, random run token, fixed report path,256000-byte request limit.
- `run-headless.cjs`: caller-provided Playwright package root, no hardcoded machine paths; fresh test profile, source SHA256, browser version/diagnostics, JSON/screenshots.
- `README.zh-CN.md`: execution, API, ownership/recovery distinction, licensing, scope, historical reproduction.
- `history/`: red, first implementation, recovery-cleanup correction, extended validation, four mutations, final green authored-source snapshots; pinned vendor/assets stay at the experiment root.

Reports belong to `outputs/白鹭引擎重构工程知识库/evidence/asset-reference-*`. Main `asset-reference-probe-results.json` and `asset-reference-probe.png` point to final green. Each red/failed/variant run has independent runId JSON/PNG; old main reports are copied before overwrite. Copies/reruns add no main cases.

## Actual commands and environment

Working directory: `<workspace>`. Actual runs used Node and preinstalled Playwright below. Initial sandbox browser startup failed on fresh Edge profile permissions before tests and is excluded from behavioral red counts. Subsequent automatically reviewed require_escalated execution ran only the local server/fresh-browser test profile. No installation or external-resource access.

```powershell
# Clean behavioral red while production API remained a stub; exit 1.
& 'node' 'outputs/白鹭引擎重构工程知识库/experiments/asset-reference-probe/run-headless.cjs' '<Playwright package root>' red-clean

# Final green after restoring all four mutations and finishing Chinese labels; exit 0.
& 'node' 'outputs/白鹭引擎重构工程知识库/experiments/asset-reference-probe/run-headless.cjs' '<Playwright package root>' green-final
```

Recovery-cleanup failure/correction, extended checks, and mutations use the same command with the final label from the table. Each mutation edits/removes one target fragment in minimal authored source, retains every executed-source snapshot, runs, and finally restores green source. No production test-only switches.

Browser: Edge `154.0.4258.62`, `installed_edge_fresh_test_profile`; Windows desktop, WebGL2,640×400, DPR 1, antialias false. No timing, energy, phone, or production-host data. The main screenshot was actually inspected: Chinese list/native Chinese text, transparent-background checkerboard, and green skinned cylinder were visible.

## Red, green, and faulty runs

Every row counts only its report's actual cases. Final main report: **12 executed/12 passed/0 failed**, pageErrors 0, consoleDiagnostics 0. After the initial 11-case red, actual recovery-release errors strengthened the existing restoration case, then one real-parse late-cancellation case was added. Old runs were not accumulated.

| Label | Run ID | Executed / passed / failed | JSON SHA256 |
| --- | --- | --- | --- |
| red (favicon noise) | 3966c2c1-6a8d-4e80-a47c-5112b35b5bfa | 11 / 0 / 11 | 7e5af9e51df97cf765cd1a3493a39338854d5272632206f7842ea4f33b1a4f4d |
| red-clean | 4852e532-7bff-40a8-b13e-dcc29cdb4022 | 11 / 0 / 11 | caac7088fb9c15198587e8df8e59ace9ebabe5e509eea6e4d86839b9123e0158 |
| green-first | 0176f626-604f-44fe-8b95-6bc74e695b05 | 11 / 11 / 0 | 2212b22e2b3e8ab4a2d72a96680f44c21e568cfafad092e78d37e0f93a20f510 |
| cleanup-red | 559adc7d-2b23-427c-baca-c6ccaf46a903 | 11 / 10 / 1 | 533aecd2fd8c076ed8465e0446a37d86cb27814f4e78343ed51c9fdefa4c1f01 |
| cleanup-green (partial) | 7f7d5599-3060-4885-8ab7-5493263ed3eb | 11 / 10 / 1 | efbb022831829ebde2dd0a44a0cf40760862cd57fd676f0d8e9b24ef68860842 |
| cleanup-green-final | 75fcf3b9-4422-4ad8-8a73-dba283749037 | 11 / 11 / 0 | 90d93e277987699172ac049a71c018d7b64b6818c00bb16453bf13da62a0bc56 |
| extended-green | 04c27d26-3633-4d2e-8941-874126b94237 | 12 / 12 / 0 | 4c4408adad6e5a84944cd92a3bbb60f94c1043749a4eab6af0e5549ffeb13eed |
| mutation-no-reset | dd3cbf40-bff5-405c-b092-9ba3b1512be0 | 12 / 11 / 1 | 23a7cce516f5ceb762a1529b24f03799dd06e35ea028c7f21d304b55ef33ac97 |
| mutation-eager-release | ce803cdf-4986-4cf0-ae0b-c3da3d7db3cd | 12 / 11 / 1 | a7e19284c010c78ef11d10c9f1864796be74609ef85b4c8217f4ad1fa2e4e040 |
| mutation-ignore-required | 24a48ab4-155c-437f-a3d4-a5c5e34526c2 | 12 / 11 / 1 | 2a64fb382beaebc6d1ebf5f44fe88560e323acb31ab543003b0846e0dcb4fcd8 |
| mutation-no-ui-restore | 5adc55f4-6335-431c-b198-25617d40d8b9 | 12 / 11 / 1 | d7101abb2c8f6021b36bbe325be97f9a87c102943a8671f94f6b34d9c8fcb1d0 |
| green-final | 5e478aac-c48a-4c2b-85f0-cf0053255da7 | 12 / 12 / 0 | 797177c7d08e5e9ca0924e1d6bb789a2df8e096563bf4cfeac53068bf0a69cfa |

Independent JSON naming: `asset-reference-{label}-{runId}.json`. At the author's final run, main JSON equaled the last row. That independent screenshot SHA256: `23b9ab75bca50f05a3232fa85a3b9de17b69656d886e79340aa60b0d575cc551`. Independent integration reruns advance main JSON/PNG pointers; later runIds cannot be counted as author runs in this table. Audit this round's green using pinned `asset-reference-green-final-5e478aac-c48a-4c2b-85f0-cf0053255da7.json/png`. Final source checks already saw new integration run `352277fd-10d5-499e-80c4-dbe024495e5c` at the main pointer: 12/12, zero page errors/diagnostics,17 matching source hashes. Its independent assessment is recorded separately by the integration reviewer.

`asset-reference-red-provenance.md` retains stub, error provenance, and environment-startup boundaries. All 11 clean red cases fail with `Reference chain behavior is not implemented`, without page/import/404 faults. required/abort cases explicitly say Wrong rejection, preventing arbitrary throws from masquerading as policy compliance. The first red's sole favicon 404 remains historical; an inline empty favicon removed later irrelevant noise.

`asset-reference-source-snapshot-audit.json` maps authored source from 12 historical reports to history snapshots and pinned sources to unchanged current vendor/assets/sources.json. **All 202 SHA256 comparisons match, zero mismatches.** Audit SHA256: `821c23c0b6e379e10155ec0137c0bf5b40921b7f6d585f7ce9b029747dd72b5f`. Early absent ui-pass is excluded from red execution sources. Completing initial-snapshot provenance checked each report hash rather than pointing old hashes at later green source. Following README, copy snapshot authored files temporarily to the root, keep fixed sources unchanged, run, and restore green. Do not start servers directly in history subdirectories.

## Final actual cases

| Case | Input and independent expectation | Actual observation |
| --- | --- | --- |
| real-skinned-animation | Real asset,0/0.7 seconds; two bones,>1000 nonempty pixels, pose/pixel changes | 7311/7214 colored pixels;29150 changed bytes; bones changed |
| independent-shared-instances | Separate root/skeleton/mixer,0/0.7 offsets; shared geometry/material | Same geometry/material objects, separate skeleton/bone nodes/mixer, different poses |
| last-release-lifecycle | Acquire twice, release first, draw second, final release | First shared dispose 0; second visible; final geometry/material dispose 1 each; both root/mixer null; bundleRoot null |
| ui-three-handoff | Clean no-UI 0.7-second reference;12 real UI/3D handoffs; no-UI again | 3D bytes equal;12288 colored UI pixels,743 bright real-text pixels; GL error 0 |
| native-text-cache-epoch | Original `白鹭 é 👩‍💻  `; same key, epoch 1, font 24px, resolution 2 | Native measureText/fillText four times each, exact raw; same-key reuse; epoch/style/resolution invalidate separately; Canvas width 400 |
| required-extension-policy | Add Egret_unknown_required to real asset required/used | Explicit Unsupported required extension before loader success |
| optional-extension-policy | Unknown optional used only | Ignore and render;7214 colored pixels |
| actual-context-restore | Actual WEBGL_lose_context, fixed 0.7 seconds; reject after loss, actual restore | 3D/text UI bytes restored;568 bright restored-text pixels; Canvas regenerated; ready; GL error 0 after dispose |
| disposed-owner | Render, dispose twice, render/acquire, synthetic restored event | Reject operations, disposed status, instance/bundle/UI roots cleared, no resurrection |
| aborted-initialization | Immediate abort during fetch initialization | Abort rejection, no successful chain |
| aborted-ready-owner | Abort after load/render | Dispose owner, reject later rendering, clear instance root |
| late-parsed-owner-abort | Controlled abort after real GLTFLoader.parseAsync returns parsed scene | AbortError; actual parsing finished; parsed geometry dispose 1; WebGL allocation 0 |

Late cancellation wraps/waits for actual upstream parseAsync only in test code and triggers the controller. It returns no fake scenes/loaders/renderers. Native-text tests temporarily observe native Canvas prototype calls and restore them in finally. Production has no test switches.

Four fault mutations respectively demonstrate: removing renderer.resetState is caught by `ui-three-handoff` GL1282, with actual upload/VAO diagnostics; premature releaseShared by first shared-dispose assertions; ignored required preflight by required rejection, although upstream warns/continues; missing restoration UI init by empty/different Canvas text pixels. Diagnostics remain excluded from green counts. Fixed-time equality proves regional determinism only, not that every state error necessarily changes pixels; NO_ERROR/four mutations add evidence.

## Minimal API and recovery adaptation

Required create/acquire/release/renderAt/dispose/waitForRestore remain. Added `signal`, `setText`, instance `timeOffset`, public `diagnostics` support real owner invalidation, raw/style/epoch text recovery, and inspectable fixed-time samples, without a general asset/editor/scene framework.

GLTFLoader parses, SkeletonUtils clones skeletons, AnimationMixer updates mature tracks/poses, WebGLRenderer renders/recovers resources. Normalization uses asset bounds/parent transforms only; geometry, skeleton, animation data, and materials remain unchanged. One caller owns RAF; renderAt is the only frame entry. The chain has no RAF/setAnimationLoop; stop/pagehide cancels the sole RAF and disposes.

geometry/material form a CPU shared bundle. Final-instance release or owner dispose calls releaseShared and clears references/bundleRoot/clips. Each instance stops/uncaches its mixer, cleans skeleton GPU texture/renderLists, and nulls root/mixer. Final release prevents acquire; a new owner may create another chain.

The first post-recovery release produced seven stale-handle delete warnings. Stronger cleanup assertions yielded a real GL1282 red. Pinned r186 paths/minimal differences located old onGeometryDispose closures in WebGLGeometries and onTextureDispose skeleton-texture closures retaining pre-restoration GPU handles. Geometry invalidation on lost removed six; skeleton-texture invalidation removed the last. Final recovery/cleanup both NO_ERROR. **This applies only to reproducible reference-chain paths, not all r186 upstream scenes.**

onLost calls public geometry.dispose/instance skeleton.dispose to invalidate obsolete GPU allocations/listeners, retaining CPU geometry/material/bone nodes/poses/animation/shared references. GL delete is a no-op while lost, and mature dispose events remove listeners. Three recreates/uploads resources and skeleton textures without swapping renderer or adding a replacement recovery renderer. This GPU invalidation is distinct from final CPU-bundle release. Measured final shared disposal without loss occurs once; lost-time GPU disposal cannot be interpreted as early CPU-bundle termination.

UI explicitly aligns context alpha/premultiplication, Canvas unpack, fragment output, and blend on the same WebGL2 context, with independent program/VAO/explicit state. It resets Three state before handoff. Restoration recreates UI GL and Canvas texture from retained raw/style. System-font smoke remains below coverage/IME/performance acceptance.

## Concerns and unresolved items

- Only desktop Edge/WebGL2 and pinned RiggedSimple cylinder are validated, not complete characters/game assets. No device matrix, all texture/material recovery paths, phones, production hosts, timing/energy, complete 2D, or migration acceptance. Unknown optional policy is demonstrated only with current samples.
- requiredProfile excludes unconfigured Draco/KTX2/meshopt decoders; other allowlisted extensions rely on the mature loader without per-extension product acceptance. Upstream warning branches are not universally reinterpreted.
- preserveDrawingBuffer=true supports reference readback, not a production recommendation. Cache holds current text only, without a general size/paragraph/emoji/CJK/IME system. Coverage/performance remain unaccepted.
- Cancellation covers immediate fetch, after real parse, and ready owners, without exhaustive leak analysis for every third-party parser failure, OOM, shader compile failure, or partial external multifile glTF failure.
- No process GC/heap snapshot proves all external references disappear. Implementation clears owned root/mixer/bundle/texture collections/renderLists; tests observe ownership roots/mature dispose. References retained by callers cannot be forcibly deleted by this owner.
- The initial local Edge launch did not execute cases because of test-environment permissions; later authorized local runs completed the reruns. The startup restriction is excluded from behavioral failures. Source hash audits and repeated red/mutation runs do not increase the number of main cases.
- At this pre-review snapshot, no observed behavioral failure remained unfixed; independent code, source and license review, a fresh green rerun, and assessment of knowledge-base integration were still required. This report does not mean the complete engine was finished.
